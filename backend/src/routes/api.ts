import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { BuildConfig, BuildJob } from '../types';
import {
  createJob,
  getJob,
  getJobByUuid,
  getAllJobs,
  updateJob,
  updateJobStatus,
} from '../services/jobStore';
import { triggerWorkflow, cancelWorkflow, isMockMode } from '../services/githubService';
import {
  saveBase64Image,
  getImagePath,
  saveBuildArtifact,
  getBuildArtifactPath,
  getBuildArtifactByExtension,
  BUILDS_DIR,
} from '../services/fileService';
import {
  createApiKey,
  getAllApiKeys,
  getApiKeyById,
  updateApiKey,
  deleteApiKey,
  getApiKeysByTenant,
} from '../services/apiKeyStore';
import {
  requireApiKey,
  optionalApiKey,
  requireAdmin,
  checkBuildRateLimit,
} from '../middleware/apiKeyAuth';
import {
  createSession,
  deleteSession,
  getSessionUser,
} from '../middleware/basicAuth';
import { createUser, getAllUsers, updateUser, deleteUser, changePassword } from '../services/userStore';
import { requirePermission } from '../middleware/permissions';
import logger from '../utils/logger';

const router = Router();

// Configure multer for image uploads
const storage = multer.memoryStorage();
const uploadImage = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Configure multer for build artifact uploads (Windows + Linux)
const uploadArtifact = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB limit for build artifacts
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.exe', '.msi', '.deb', '.rpm', '.appimage', '.flatpak', '.zst', '.dmg', '.apk'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only EXE, MSI, DEB, RPM, AppImage, Flatpak, pkg.tar.zst and DMG files are allowed'));
    }
  },
});

// Health check
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      mockMode: isMockMode(),
      timestamp: new Date().toISOString(),
    },
  });
});

// Start a new build (supports optional API key authentication)
router.post('/build', optionalApiKey, checkBuildRateLimit, async (req: Request, res: Response) => {
  try {
    let config: BuildConfig = req.body;

    // If API key has default config, merge it
    if (req.apiKey?.defaultConfig) {
      config = { ...req.apiKey.defaultConfig, ...config };
    }

    // Validate required fields
    if (!config.configName) {
      return res.status(400).json({
        success: false,
        error: 'Configuration name is required',
      });
    }

    // Generate UUIDs
    const jobId = uuidv4();
    const uuid = uuidv4();

    // Save icons if provided
    if (config.iconBase64) {
      saveBase64Image(config.iconBase64, uuid, 'icon.png');
    }
    if (config.logoBase64) {
      saveBase64Image(config.logoBase64, uuid, 'logo.png');
    }
    if (config.privacyBase64) {
      saveBase64Image(config.privacyBase64, uuid, 'privacy.png');
    }

    // Create job
    const job: BuildJob & { tenantId?: string } = {
      id: jobId,
      uuid,
      config,
      status: 'pending',
      progress: 0,
      statusMessage: 'Initializing build...',
      logs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(req.tenantId && { tenantId: req.tenantId }),
    };

    createJob(job);

    // Trigger GitHub workflow
    const result = await triggerWorkflow(job, config);

    if (!result.success) {
      updateJobStatus(jobId, 'failed', result.error || 'Failed to start build', 0);
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }

    // Return updated job
    const updatedJob = getJob(jobId);
    res.json({
      success: true,
      data: updatedJob,
    });
  } catch (error: any) {
    logger.error('Error starting build:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

// Get build status
router.get('/status/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = getJob(jobId);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Job not found',
    });
  }

  res.json({
    success: true,
    data: job,
  });
});

// Get artifact download
router.get('/artifact/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params;
  const { type = 'exe' } = req.query;

  const job = getJob(jobId);
  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Job not found',
    });
  }

  if (job.status !== 'completed') {
    return res.status(400).json({
      success: false,
      error: 'Build not completed yet',
    });
  }

  // Helper function to get filename based on type
  const getFilename = (artifactType: string): string => {
    const baseName = job.config.filename || 'rustdesk';
    switch (artifactType) {
      case 'msi':
        return `${baseName}.msi`;
      case 'deb':
        return `${baseName}.deb`;
      case 'rpm':
        return `${baseName}.rpm`;
      case 'rpm-suse':
        return `${baseName}-suse.rpm`;
      case 'appimage':
        return `${baseName}.AppImage`;
      case 'pkg':
        return `${baseName}.pkg.tar.zst`;
      case 'dmg-x64':
        return `${baseName}-x86_64.dmg`;
      case 'dmg-arm64':
        return `${baseName}-aarch64.dmg`;
      case 'apk':
        return `${baseName}.apk`;
      case 'exe':
      default:
        return `${baseName}.exe`;
    }
  };

  const typeStr = type as string;

  // In mock mode, return a placeholder file
  if (isMockMode()) {
    const filename = getFilename(typeStr);
    const content = `This is a mock ${typeStr.toUpperCase()} file for testing.\nJob ID: ${jobId}\nBuild Config: ${job.config.configName}`;

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
    return;
  }

  // Real mode - try to find the artifact
  // For Linux and macOS files, search by extension since filenames may vary
  const extensionTypes = ['deb', 'rpm', 'rpm-suse', 'appimage', 'pkg', 'dmg-x64', 'dmg-arm64', 'apk'];

  if (extensionTypes.includes(typeStr)) {
    const artifact = getBuildArtifactByExtension(job.uuid, typeStr);
    if (!artifact) {
      return res.status(404).json({
        success: false,
        error: 'Artifact not found',
      });
    }
    res.download(artifact.path, artifact.filename);
    return;
  }

  // For Windows files, use exact filename matching
  const filename = getFilename(typeStr);
  const artifactPath = getBuildArtifactPath(job.uuid, filename);

  if (!artifactPath) {
    return res.status(404).json({
      success: false,
      error: 'Artifact not found',
    });
  }

  res.download(artifactPath, filename);
});

// List all jobs
router.get('/jobs', (req: Request, res: Response) => {
  const jobs = getAllJobs();
  res.json({
    success: true,
    data: jobs,
  });
});

// Cancel a build
router.post('/cancel/:jobId', async (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = getJob(jobId);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Job not found',
    });
  }

  if (job.status === 'completed' || job.status === 'cancelled' || job.status === 'failed') {
    return res.status(400).json({
      success: false,
      error: 'Job already finished',
    });
  }

  if (job.workflowRunId) {
    await cancelWorkflow(jobId, job.workflowRunId);
  } else {
    updateJobStatus(jobId, 'cancelled', 'Build cancelled', 0);
  }

  res.json({
    success: true,
    data: getJob(jobId),
  });
});

// Upload icon
router.post('/upload/icon', uploadImage.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded',
    });
  }

  const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  res.json({
    success: true,
    data: { base64 },
  });
});

// Upload logo
router.post('/upload/logo', uploadImage.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded',
    });
  }

  const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  res.json({
    success: true,
    data: { base64 },
  });
});

// Get PNG image (for GitHub Actions to fetch)
router.get('/get_png', (req: Request, res: Response) => {
  const { filename, uuid } = req.query;

  if (!filename || !uuid) {
    return res.status(400).json({
      success: false,
      error: 'Missing filename or uuid',
    });
  }

  const imagePath = getImagePath(uuid as string, filename as string);
  if (!imagePath) {
    return res.status(404).json({
      success: false,
      error: 'Image not found',
    });
  }

  res.sendFile(imagePath);
});

// Update job status (called by GitHub Actions)
router.post('/updategh', (req: Request, res: Response) => {
  const { uuid, status } = req.body;

  if (!uuid || !status) {
    return res.status(400).json({
      success: false,
      error: 'Missing uuid or status',
    });
  }

  const job = getJobByUuid(uuid);
  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Job not found',
    });
  }

  // Parse progress from status message
  let progress = job.progress;
  const progressMatch = status.match(/(\d+)%/);
  if (progressMatch) {
    progress = parseInt(progressMatch[1], 10);
  }

  // Determine job status
  let jobStatus = job.status;
  if (status === 'Success') {
    jobStatus = 'completed';
    progress = 100;
  } else if (status.includes('failed') || status.includes('cancelled')) {
    jobStatus = status.includes('cancelled') ? 'cancelled' : 'failed';
  } else {
    jobStatus = 'in_progress';
  }

  updateJob(job.id, {
    status: jobStatus,
    statusMessage: status,
    progress,
  });

  res.json({ success: true });
});

// Save custom client (called by GitHub Actions)
router.post(
  '/save_custom_client',
  uploadArtifact.single('file'),
  async (req: Request, res: Response) => {
    const { uuid } = req.body;

    if (!uuid || !req.file) {
      return res.status(400).json({
        success: false,
        error: 'Missing uuid or file',
      });
    }

    const job = getJobByUuid(uuid);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }

    const filePath = saveBuildArtifact(uuid, req.file.originalname, req.file.buffer);
    logger.info(`Saved build artifact: ${filePath}`);

    // Code signing is done in the GitHub Actions workflows (jsign + Google Cloud KMS)

    // Update job with artifact URL
    const filename = req.file.originalname.toLowerCase();
    const isExe = filename.endsWith('.exe');
    const isMsi = filename.endsWith('.msi');
    const isDeb = filename.endsWith('.deb');
    const isRpm = filename.endsWith('.rpm');
    const isAppImage = filename.endsWith('.appimage');
    const isPkg = filename.endsWith('.zst'); // pkg.tar.zst
    const isDmg = filename.endsWith('.dmg');
    const isApk = filename.endsWith('.apk');

    const updates: Partial<BuildJob> = {};
    if (isExe) {
      updates.artifactUrl = `/api/artifact/${job.id}?type=exe`;
    }
    if (isMsi) {
      updates.artifactMsiUrl = `/api/artifact/${job.id}?type=msi`;
    }
    if (isDeb) {
      updates.artifactDebUrl = `/api/artifact/${job.id}?type=deb`;
    }
    if (isRpm) {
      // Check if it's a SUSE RPM
      if (filename.includes('suse')) {
        updates.artifactRpmSuseUrl = `/api/artifact/${job.id}?type=rpm-suse`;
      } else {
        updates.artifactRpmUrl = `/api/artifact/${job.id}?type=rpm`;
      }
    }
    if (isAppImage) {
      updates.artifactAppImageUrl = `/api/artifact/${job.id}?type=appimage`;
    }
    if (isPkg) {
      updates.artifactPkgUrl = `/api/artifact/${job.id}?type=pkg`;
    }
    if (isDmg) {
      // Check if it's x86_64 or aarch64 (arm64/M1)
      if (filename.includes('x86_64') || filename.includes('x64')) {
        updates.artifactDmgX64Url = `/api/artifact/${job.id}?type=dmg-x64`;
      } else if (filename.includes('aarch64') || filename.includes('arm64')) {
        updates.artifactDmgArm64Url = `/api/artifact/${job.id}?type=dmg-arm64`;
      } else {
        // Default to x64 if architecture not specified
        updates.artifactDmgX64Url = `/api/artifact/${job.id}?type=dmg-x64`;
      }
    }
    if (isApk) {
      updates.artifactApkUrl = `/api/artifact/${job.id}?type=apk`;
    }

    updateJob(job.id, updates);

    res.json({ success: true });
  }
);

// =====================
// API Key Management (Admin endpoints)
// =====================

// Create a new API key (admin only)
router.post('/admin/apikeys', requireAdmin, (req: Request, res: Response) => {
  const { name, tenantId, rateLimit, expiresAt, defaultConfig } = req.body;

  if (!name || !tenantId) {
    return res.status(400).json({
      success: false,
      error: 'Name and tenantId are required',
    });
  }

  const apiKey = createApiKey(name, tenantId, {
    rateLimit,
    expiresAt,
    defaultConfig,
  });

  res.json({
    success: true,
    data: apiKey,
  });
});

// List all API keys (admin only)
router.get('/admin/apikeys', requireAdmin, (req: Request, res: Response) => {
  const keys = getAllApiKeys();

  // Hide the actual key for security (show only last 8 chars)
  const safeKeys = keys.map(k => ({
    ...k,
    key: `...${k.key.slice(-8)}`,
  }));

  res.json({
    success: true,
    data: safeKeys,
  });
});

// Get a specific API key (admin only)
router.get('/admin/apikeys/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const apiKey = getApiKeyById(id);

  if (!apiKey) {
    return res.status(404).json({
      success: false,
      error: 'API key not found',
    });
  }

  res.json({
    success: true,
    data: apiKey,
  });
});

// Update an API key (admin only)
router.put('/admin/apikeys/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  const updatedKey = updateApiKey(id, updates);

  if (!updatedKey) {
    return res.status(404).json({
      success: false,
      error: 'API key not found',
    });
  }

  res.json({
    success: true,
    data: updatedKey,
  });
});

// Delete an API key (admin only)
router.delete('/admin/apikeys/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const deleted = deleteApiKey(id);

  if (!deleted) {
    return res.status(404).json({
      success: false,
      error: 'API key not found',
    });
  }

  res.json({
    success: true,
    message: 'API key deleted',
  });
});

// =====================
// Tenant self-service endpoints
// =====================

// Get my API key info (requires API key)
router.get('/me', requireApiKey, (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      tenantId: req.tenantId,
      name: req.apiKey?.name,
      rateLimit: req.apiKey?.rateLimit,
      buildsToday: req.apiKey?.buildsToday,
      expiresAt: req.apiKey?.expiresAt,
    },
  });
});

// Get my builds (requires API key)
router.get('/me/builds', requireApiKey, (req: Request, res: Response) => {
  const allJobs = getAllJobs() as (BuildJob & { tenantId?: string })[];
  const myJobs = allJobs.filter(j => j.tenantId === req.tenantId);

  res.json({
    success: true,
    data: myJobs,
  });
});

// =====================
// Authentication endpoints (for panel access)
// =====================

// Login
router.post('/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Username and password required',
    });
  }

  const session = createSession(username, password);
  if (!session) {
    logger.warn(`Failed login attempt for user: ${username}`);
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials',
    });
  }

  logger.info(`User logged in: ${username}`);

  res.json({
    success: true,
    data: {
      token: session.token,
      user: session.user,
    },
  });
});

// Logout
router.post('/auth/logout', (req: Request, res: Response) => {
  const token = req.headers['x-session-token'] as string;

  if (token) {
    deleteSession(token);
  }

  res.json({
    success: true,
    message: 'Logged out',
  });
});

// Check auth status
router.get('/auth/check', (req: Request, res: Response) => {
  const token = req.headers['x-session-token'] as string;
  if (!token) return res.json({ success: true, data: { authenticated: false } });
  const user = getSessionUser(token);
  if (!user) return res.json({ success: true, data: { authenticated: false } });
  res.json({ success: true, data: { authenticated: true, user } });
});

// =====================
// Token MVP - Test endpoints for RustDesk token authentication
// =====================

interface ConnectToken {
  token: string;
  deviceId: string;
  password: string;
  expiresAt: number;
  used: boolean;
  createdAt: number;
}

// In-memory token storage (use Redis in production)
const connectTokens = new Map<string, ConnectToken>();

// Cleanup expired tokens every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of connectTokens) {
    if (value.expiresAt < now) {
      connectTokens.delete(key);
    }
  }
}, 60000);

// Generate a test token (called by your RMM or for testing)
router.post('/token/generate', (req: Request, res: Response) => {
  const { deviceId, password } = req.body;

  if (!deviceId || !password) {
    return res.status(400).json({
      success: false,
      error: 'deviceId and password are required',
    });
  }

  // Generate random token
  const token = require('crypto').randomBytes(32).toString('hex');
  const expiresIn = 60; // 60 seconds

  // Store token
  connectTokens.set(token, {
    token,
    deviceId,
    password,
    expiresAt: Date.now() + (expiresIn * 1000),
    used: false,
    createdAt: Date.now(),
  });

  logger.info(`Token generated for device ${deviceId}: ${token.substring(0, 8)}...`);

  res.json({
    success: true,
    token,
    expiresIn,
    // URL that RustDesk will open
    rustdeskUrl: `rustdesk://connection/new/${deviceId}?token=${token}`,
  });
});

// Resolve token to password (called by modified RustDesk)
router.get('/token/resolve/:token', (req: Request, res: Response) => {
  const { token } = req.params;

  const data = connectTokens.get(token);

  if (!data) {
    logger.warn(`Token not found: ${token.substring(0, 8)}...`);
    return res.status(404).json({
      success: false,
      error: 'Token not found',
    });
  }

  if (data.expiresAt < Date.now()) {
    connectTokens.delete(token);
    logger.warn(`Token expired: ${token.substring(0, 8)}...`);
    return res.status(410).json({
      success: false,
      error: 'Token expired',
    });
  }

  if (data.used) {
    logger.warn(`Token already used: ${token.substring(0, 8)}...`);
    return res.status(410).json({
      success: false,
      error: 'Token already used',
    });
  }

  // Mark as used
  data.used = true;

  // Delete after 5 seconds (give time for retry if needed)
  setTimeout(() => connectTokens.delete(token), 5000);

  logger.info(`Token resolved for device ${data.deviceId}: ${token.substring(0, 8)}...`);

  res.json({
    success: true,
    password: data.password,
    deviceId: data.deviceId,
  });
});

// List active tokens (for debugging only - remove in production)
router.get('/token/list', (req: Request, res: Response) => {
  const tokens = Array.from(connectTokens.values()).map(t => ({
    token: t.token.substring(0, 8) + '...',
    deviceId: t.deviceId,
    used: t.used,
    expiresIn: Math.max(0, Math.round((t.expiresAt - Date.now()) / 1000)),
  }));

  res.json({
    success: true,
    count: tokens.length,
    tokens,
  });
});



// =====================
// User Management (admin only)
// =====================

router.get('/admin/users', requirePermission('users:manage'), (req: Request, res: Response) => {
  try {
    const users = getAllUsers();
    res.json({ success: true, data: users });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/admin/users', requirePermission('users:manage'), (req: Request, res: Response) => {
  try {
    const { username, password, name, role } = req.body;
    if (!username || !password || !name || !role) {
      return res.status(400).json({ success: false, error: 'username, password, name and role are required' });
    }
    const user = createUser(username, password, name, role);
    const { passwordHash, ...safe } = user as any;
    res.status(201).json({ success: true, data: safe });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.patch('/admin/users/:id', requirePermission('users:manage'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, role, isActive, password } = req.body;

    if (isActive === false && req.user?.id === id) {
      return res.status(400).json({ success: false, error: 'Cannot deactivate yourself' });
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (role !== undefined) updates.role = role;
    if (isActive !== undefined) updates.isActive = isActive;

    const user = updateUser(id, updates);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    if (password) changePassword(id, password);

    const { passwordHash, ...safe } = user as any;
    res.json({ success: true, data: safe });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/admin/users/:id', requirePermission('users:manage'), (req: Request, res: Response) => {
  try {
    if (req.user?.id === req.params.id) {
      return res.status(400).json({ success: false, error: 'Cannot deactivate yourself' });
    }
    const deleted = deleteUser(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, message: 'User deactivated' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
