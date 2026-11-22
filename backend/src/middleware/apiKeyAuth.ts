import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { validateApiKey, isApiKeyUsable, incrementBuildCount, recordApiKeyUsage } from '../services/apiKeyStore';
import { ApiKey } from '../types';
import logger from '../utils/logger';

// Extend Express Request to include API key info
declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKey;
      tenantId?: string;
    }
  }
}

// Admin secret for managing API keys (set in .env). No default: without it, admin access is off.
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

// True only for the configured admin secret (constant-time compare).
export function isAdminSecret(value: unknown): boolean {
  if (typeof value !== 'string' || !ADMIN_SECRET) return false;
  const a = Buffer.from(value);
  const b = Buffer.from(ADMIN_SECRET);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// True only for an existing, active API key (presence of the header is not enough).
export function isValidApiKeyHeader(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0 && isApiKeyUsable(value);
}

// Middleware to validate API key (required)
export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKeyHeader = req.headers['x-api-key'] as string;

  if (!apiKeyHeader) {
    return res.status(401).json({
      success: false,
      error: 'API key required. Provide X-API-Key header.',
    });
  }

  const result = validateApiKey(apiKeyHeader);

  if (!result.valid) {
    logger.warn(`Invalid API key attempt: ${result.error}`);
    return res.status(401).json({
      success: false,
      error: result.error,
    });
  }

  // Attach API key info to request
  req.apiKey = result.apiKey;
  req.tenantId = result.apiKey?.tenantId;

  // Record usage
  if (result.apiKey) {
    recordApiKeyUsage(result.apiKey.id);
  }

  next();
}

// Middleware to validate API key (optional - allows anonymous access)
export function optionalApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKeyHeader = req.headers['x-api-key'] as string;

  if (apiKeyHeader) {
    const result = validateApiKey(apiKeyHeader);

    if (result.valid && result.apiKey) {
      req.apiKey = result.apiKey;
      req.tenantId = result.apiKey.tenantId;
      recordApiKeyUsage(result.apiKey.id);
    } else {
      // A key that was sent but fails (over quota, disabled, expired) must not fall
      // through as "no key": that used to skip the build quota entirely.
      const overQuota = (result.error || '').startsWith('Rate limit');
      return res.status(overQuota ? 429 : 401).json({ success: false, error: result.error });
    }
  }

  next();
}

// Middleware to require admin secret
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isAdminSecret(req.headers['x-admin-secret'])) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
    });
  }

  next();
}

// Middleware to check rate limit and increment build count
export function checkBuildRateLimit(req: Request, res: Response, next: NextFunction) {
  if (req.apiKey) {
    const result = validateApiKey(req.apiKey.key);

    if (!result.valid) {
      return res.status(429).json({
        success: false,
        error: result.error,
      });
    }

    // Increment build count
    incrementBuildCount(req.apiKey.id);
  }

  next();
}
