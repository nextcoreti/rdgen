/**
 * One-time migration from JSON files to SQLite.
 * Runs automatically on startup if JSON files exist and SQLite is empty.
 */
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';
import db from './db';

const DATA_DIR = path.join(__dirname, '../../data');
const CLIENTS_DIR = path.join(DATA_DIR, 'clients');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');
const API_KEYS_FILE = path.join(DATA_DIR, 'apikeys.json');

export function runMigration(): void {
  migrateClients();
  migrateUsers();
  migrateJobs();
  migrateApiKeys();
}

function migrateClients(): void {
  if (!fs.existsSync(CLIENTS_DIR)) return;

  const clientCount = (db.prepare('SELECT COUNT(*) as n FROM clients').get() as any).n;
  if (clientCount > 0) return;

  const files = fs.readdirSync(CLIENTS_DIR).filter((f) => f.endsWith('.json'));
  if (files.length === 0) return;

  logger.info(`Migrating ${files.length} client(s) from JSON to SQLite...`);

  const insertClient = db.prepare(
    'INSERT OR IGNORE INTO clients (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
  );
  const insertProfile = db.prepare(
    'INSERT OR IGNORE INTO profiles (id, client_id, name, host, platform, created_at, updated_at, latest_version_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const insertVersion = db.prepare(
    'INSERT OR IGNORE INTO profile_versions (id, profile_id, created_at, label, iv, auth_tag, ciphertext) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  const migrate = db.transaction(() => {
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(CLIENTS_DIR, file), 'utf-8'));
        insertClient.run(data.id, data.name, data.createdAt, data.updatedAt);

        for (const p of (data.profiles || [])) {
          insertProfile.run(
            p.profileId, data.id, p.name, p.host, p.platform,
            p.createdAt, p.updatedAt, p.latestVersionId
          );
          for (const v of (p.versions || [])) {
            insertVersion.run(v.versionId, p.profileId, v.createdAt, v.label, v.iv, v.authTag, v.ciphertext);
          }
        }
      } catch (err) {
        logger.error(`Failed to migrate client file ${file}:`, err);
      }
    }
  });

  migrate();
  logger.info('Client migration completed.');
}

function migrateUsers(): void {
  if (!fs.existsSync(USERS_FILE)) return;

  const userCount = (db.prepare('SELECT COUNT(*) as n FROM users').get() as any).n;
  if (userCount > 0) return;

  try {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    if (!Array.isArray(users) || users.length === 0) return;

    logger.info(`Migrating ${users.length} user(s) from JSON to SQLite...`);

    const insert = db.prepare(
      'INSERT OR IGNORE INTO users (id, username, password_hash, name, role, is_active, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );

    const migrate = db.transaction(() => {
      for (const u of users) {
        insert.run(
          u.id, u.username, u.passwordHash, u.name, u.role,
          u.isActive ? 1 : 0, u.createdAt, u.lastLogin ?? null
        );
      }
    });

    migrate();
    logger.info('User migration completed.');
  } catch (err) {
    logger.error('Failed to migrate users:', err);
  }
}

function migrateJobs(): void {
  if (!fs.existsSync(JOBS_FILE)) return;

  const jobCount = (db.prepare('SELECT COUNT(*) as n FROM jobs').get() as any).n;
  if (jobCount > 0) return;

  try {
    const jobs = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf-8'));
    if (!Array.isArray(jobs) || jobs.length === 0) return;

    logger.info(`Migrating ${jobs.length} job(s) from JSON to SQLite...`);

    const insert = db.prepare(`
      INSERT OR IGNORE INTO jobs (
        id, uuid, config, status, progress, status_message, logs,
        artifact_url, artifact_msi_url, artifact_deb_url, artifact_rpm_url,
        artifact_rpm_suse_url, artifact_app_image_url, artifact_pkg_url,
        artifact_dmg_x64_url, artifact_dmg_arm64_url, artifact_apk_url,
        created_at, updated_at, completed_at, workflow_run_id, workflow_run_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const migrate = db.transaction(() => {
      for (const j of jobs) {
        insert.run(
          j.id, j.uuid, JSON.stringify(j.config), j.status, j.progress,
          j.statusMessage, JSON.stringify(j.logs),
          j.artifactUrl ?? null, j.artifactMsiUrl ?? null,
          j.artifactDebUrl ?? null, j.artifactRpmUrl ?? null,
          j.artifactRpmSuseUrl ?? null, j.artifactAppImageUrl ?? null, j.artifactPkgUrl ?? null,
          j.artifactDmgX64Url ?? null, j.artifactDmgArm64Url ?? null, j.artifactApkUrl ?? null,
          j.createdAt, j.updatedAt, j.completedAt ?? null,
          j.workflowRunId ?? null, j.workflowRunUrl ?? null
        );
      }
    });

    migrate();
    logger.info('Job migration completed.');
  } catch (err) {
    logger.error('Failed to migrate jobs:', err);
  }
}

function migrateApiKeys(): void {
  if (!fs.existsSync(API_KEYS_FILE)) return;

  const keyCount = (db.prepare('SELECT COUNT(*) as n FROM api_keys').get() as any).n;
  if (keyCount > 0) return;

  try {
    const keys = JSON.parse(fs.readFileSync(API_KEYS_FILE, 'utf-8'));
    if (!Array.isArray(keys) || keys.length === 0) return;

    logger.info(`Migrating ${keys.length} API key(s) from JSON to SQLite...`);

    const insert = db.prepare(`
      INSERT OR IGNORE INTO api_keys (id, key, name, tenant_id, is_active, created_at, last_used_at, expires_at, rate_limit, builds_today, last_reset_date, default_config)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const migrate = db.transaction(() => {
      for (const k of keys) {
        insert.run(
          k.id, k.key, k.name, k.tenantId, k.isActive ? 1 : 0,
          k.createdAt, k.lastUsedAt ?? null, k.expiresAt ?? null,
          k.rateLimit ?? 10, k.buildsToday ?? 0,
          k.lastResetDate ?? null,
          k.defaultConfig ? JSON.stringify(k.defaultConfig) : null
        );
      }
    });

    migrate();
    logger.info('API key migration completed.');
  } catch (err) {
    logger.error('Failed to migrate API keys:', err);
  }
}
