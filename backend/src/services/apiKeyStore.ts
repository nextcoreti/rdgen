import crypto from 'crypto';
import { ApiKey } from '../types';
import logger from '../utils/logger';
import db from './db';

function rowToApiKey(row: any): ApiKey {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    tenantId: row.tenant_id,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    rateLimit: row.rate_limit ?? undefined,
    buildsToday: row.builds_today ?? undefined,
    lastResetDate: row.last_reset_date ?? undefined,
    defaultConfig: row.default_config ? JSON.parse(row.default_config) : undefined,
  };
}

export function generateApiKey(): string {
  return `rdgen_${crypto.randomBytes(32).toString('hex')}`;
}

export function createApiKey(
  name: string,
  tenantId: string,
  options?: {
    rateLimit?: number;
    expiresAt?: string;
    defaultConfig?: Partial<ApiKey['defaultConfig']>;
  }
): ApiKey {
  const id = crypto.randomUUID();
  const key = generateApiKey();
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  db.prepare(`
    INSERT INTO api_keys (id, key, name, tenant_id, is_active, created_at, rate_limit, builds_today, last_reset_date, expires_at, default_config)
    VALUES (?, ?, ?, ?, 1, ?, ?, 0, ?, ?, ?)
  `).run(
    id, key, name, tenantId, now,
    options?.rateLimit ?? 10,
    today,
    options?.expiresAt ?? null,
    options?.defaultConfig ? JSON.stringify(options.defaultConfig) : null
  );

  logger.info(`Created API key for tenant: ${tenantId}`);
  return rowToApiKey(db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id) as any);
}

export function getApiKeyByKey(key: string): ApiKey | undefined {
  const row = db.prepare('SELECT * FROM api_keys WHERE key = ?').get(key) as any;
  return row ? rowToApiKey(row) : undefined;
}

export function getApiKeyById(id: string): ApiKey | undefined {
  const row = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id) as any;
  return row ? rowToApiKey(row) : undefined;
}

export function getApiKeysByTenant(tenantId: string): ApiKey[] {
  const rows = db.prepare('SELECT * FROM api_keys WHERE tenant_id = ?').all(tenantId) as any[];
  return rows.map(rowToApiKey);
}

export function getAllApiKeys(): ApiKey[] {
  const rows = db.prepare('SELECT * FROM api_keys').all() as any[];
  return rows.map(rowToApiKey);
}

export function updateApiKey(id: string, updates: Partial<ApiKey>): ApiKey | undefined {
  const row = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id) as any;
  if (!row) return undefined;

  delete (updates as any).id;
  delete (updates as any).key;

  db.prepare(`
    UPDATE api_keys SET
      name = ?, tenant_id = ?, is_active = ?, last_used_at = ?,
      expires_at = ?, rate_limit = ?, builds_today = ?, last_reset_date = ?, default_config = ?
    WHERE id = ?
  `).run(
    updates.name ?? row.name,
    updates.tenantId ?? row.tenant_id,
    updates.isActive !== undefined ? (updates.isActive ? 1 : 0) : row.is_active,
    updates.lastUsedAt ?? row.last_used_at,
    updates.expiresAt ?? row.expires_at,
    updates.rateLimit ?? row.rate_limit,
    updates.buildsToday ?? row.builds_today,
    updates.lastResetDate ?? row.last_reset_date,
    updates.defaultConfig !== undefined ? JSON.stringify(updates.defaultConfig) : row.default_config,
    id
  );

  return rowToApiKey(db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id) as any);
}

export function deleteApiKey(id: string): boolean {
  const result = db.prepare('DELETE FROM api_keys WHERE id = ?').run(id);
  return result.changes > 0;
}

export function validateApiKey(key: string): { valid: boolean; apiKey?: ApiKey; error?: string } {
  const apiKey = getApiKeyByKey(key);

  if (!apiKey) return { valid: false, error: 'Invalid API key' };
  if (!apiKey.isActive) return { valid: false, error: 'API key is disabled' };
  if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
    return { valid: false, error: 'API key has expired' };
  }

  const today = new Date().toISOString().split('T')[0];
  if (apiKey.lastResetDate !== today) {
    updateApiKey(apiKey.id, { buildsToday: 0, lastResetDate: today });
    apiKey.buildsToday = 0;
  }

  if (apiKey.rateLimit && (apiKey.buildsToday ?? 0) >= apiKey.rateLimit) {
    return { valid: false, error: `Rate limit exceeded (${apiKey.rateLimit} builds/day)` };
  }

  return { valid: true, apiKey };
}

export function incrementBuildCount(id: string): void {
  const apiKey = getApiKeyById(id);
  if (apiKey) {
    updateApiKey(id, { buildsToday: (apiKey.buildsToday || 0) + 1, lastUsedAt: new Date().toISOString() });
  }
}

export function recordApiKeyUsage(id: string): void {
  updateApiKey(id, { lastUsedAt: new Date().toISOString() });
}
