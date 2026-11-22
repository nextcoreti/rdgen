import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '../../uploads');
const BUILDS_DIR = process.env.BUILDS_DIR || path.join(__dirname, '../../builds');

// Ensure directories exist
[UPLOADS_DIR, BUILDS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

export function saveBase64Image(
  base64Data: string,
  uuid: string,
  filename: string
): string {
  const uuidDir = path.join(UPLOADS_DIR, uuid);
  if (!fs.existsSync(uuidDir)) {
    fs.mkdirSync(uuidDir, { recursive: true });
  }

  // Remove data URL prefix if present
  const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Content, 'base64');

  const filePath = path.join(uuidDir, filename);
  fs.writeFileSync(filePath, buffer);

  logger.info(`Saved image to ${filePath}`);
  return filePath;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMAGE_NAMES = new Set(['icon.png', 'logo.png', 'privacy.png']);

// Backs the PUBLIC /api/get_png route: only server-generated uuids and the three image
// names are allowed, and the final path must stay inside UPLOADS_DIR (no traversal).
export function getImagePath(uuid: unknown, filename: unknown): string | null {
  if (typeof uuid !== 'string' || typeof filename !== 'string') return null;
  if (!UUID_RE.test(uuid) || !IMAGE_NAMES.has(filename)) return null;
  const base = path.resolve(UPLOADS_DIR);
  const filePath = path.resolve(base, uuid, filename);
  if (!filePath.startsWith(base + path.sep)) return null;
  return fs.existsSync(filePath) ? filePath : null;
}

export function saveBuildArtifact(
  uuid: string,
  filename: string,
  data: Buffer
): string {
  const uuidDir = path.join(BUILDS_DIR, uuid);
  if (!fs.existsSync(uuidDir)) {
    fs.mkdirSync(uuidDir, { recursive: true });
  }

  const filePath = path.join(uuidDir, filename);
  fs.writeFileSync(filePath, data);

  logger.info(`Saved build artifact to ${filePath}`);
  return filePath;
}

export function getBuildArtifactPath(uuid: string, filename: string): string | null {
  const filePath = path.join(BUILDS_DIR, uuid, filename);
  if (fs.existsSync(filePath)) {
    return filePath;
  }
  return null;
}

export function getBuildArtifactByExtension(uuid: string, extension: string): { path: string; filename: string } | null {
  const uuidDir = path.join(BUILDS_DIR, uuid);
  if (!fs.existsSync(uuidDir)) {
    return null;
  }

  const files = fs.readdirSync(uuidDir);
  const normalizedExt = extension.toLowerCase().startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;

  // Special handling for different file types
  let matchingFile: string | undefined;

  if (normalizedExt === '.appimage') {
    // AppImage files are case-insensitive
    matchingFile = files.find(f => f.toLowerCase().endsWith('.appimage'));
  } else if (normalizedExt === '.zst' || normalizedExt === '.pkg') {
    // pkg.tar.zst files
    matchingFile = files.find(f => f.toLowerCase().endsWith('.pkg.tar.zst') || f.toLowerCase().endsWith('.zst'));
  } else if (normalizedExt === '.rpm-suse') {
    // SUSE RPM files
    matchingFile = files.find(f => f.toLowerCase().includes('suse') && f.toLowerCase().endsWith('.rpm'));
  } else if (normalizedExt === '.rpm') {
    // Regular RPM files (not SUSE)
    matchingFile = files.find(f => f.toLowerCase().endsWith('.rpm') && !f.toLowerCase().includes('suse'));
  } else if (normalizedExt === '.dmg-x64') {
    // macOS DMG for Intel (x86_64)
    matchingFile = files.find(f => f.toLowerCase().endsWith('.dmg') && (f.includes('x86_64') || f.includes('x64')));
  } else if (normalizedExt === '.dmg-arm64') {
    // macOS DMG for Apple Silicon (aarch64/arm64)
    matchingFile = files.find(f => f.toLowerCase().endsWith('.dmg') && (f.includes('aarch64') || f.includes('arm64')));
  } else {
    matchingFile = files.find(f => f.toLowerCase().endsWith(normalizedExt));
  }

  if (matchingFile) {
    return {
      path: path.join(uuidDir, matchingFile),
      filename: matchingFile
    };
  }

  return null;
}

export function listBuildArtifacts(uuid: string): string[] {
  const uuidDir = path.join(BUILDS_DIR, uuid);
  if (!fs.existsSync(uuidDir)) {
    return [];
  }
  return fs.readdirSync(uuidDir);
}

export function cleanupOldFiles(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
  const now = Date.now();

  [UPLOADS_DIR, BUILDS_DIR].forEach((baseDir) => {
    if (!fs.existsSync(baseDir)) return;

    const dirs = fs.readdirSync(baseDir);
    for (const dir of dirs) {
      const dirPath = path.join(baseDir, dir);
      const stat = fs.statSync(dirPath);

      if (stat.isDirectory() && now - stat.mtimeMs > maxAgeMs) {
        fs.rmSync(dirPath, { recursive: true, force: true });
        logger.info(`Cleaned up old directory: ${dirPath}`);
      }
    }
  });
}

// Run cleanup every hour
setInterval(() => cleanupOldFiles(), 60 * 60 * 1000);

export { UPLOADS_DIR, BUILDS_DIR };
