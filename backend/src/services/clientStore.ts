import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { encryptConfig, decryptConfig } from './cryptoService';
import db from './db';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ClientVersion {
  versionId: string;
  createdAt: string;
  label: string;
  iv: string;
  authTag: string;
  ciphertext: string;
}

interface ProfileEntry {
  profileId: string;
  name: string;
  host: string;
  platform: string;
  createdAt: string;
  updatedAt: string;
  latestVersionId: string;
  versions: ClientVersion[];
}

interface ClientData {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  profiles: ProfileEntry[];
}

export interface ClientListItem {
  id: string;
  name: string;
  profileCount: number;
  updatedAt: string;
}

export interface ProfileListItem {
  profileId: string;
  name: string;
  host: string;
  platform: string;
  versionCount: number;
  latestVersionId: string;
  updatedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildClientData(clientId: string): ClientData | undefined {
  const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId) as any;
  if (!row) return undefined;

  const profileRows = db.prepare(
    'SELECT * FROM profiles WHERE client_id = ? ORDER BY created_at ASC'
  ).all(clientId) as any[];

  const profiles: ProfileEntry[] = profileRows.map((p) => {
    const versionRows = db.prepare(
      'SELECT * FROM profile_versions WHERE profile_id = ? ORDER BY created_at ASC'
    ).all(p.id) as any[];

    return {
      profileId: p.id,
      name: p.name,
      host: p.host,
      platform: p.platform,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      latestVersionId: p.latest_version_id,
      versions: versionRows.map((v) => ({
        versionId: v.id,
        createdAt: v.created_at,
        label: v.label,
        iv: v.iv,
        authTag: v.auth_tag,
        ciphertext: v.ciphertext,
      })),
    };
  });

  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    profiles,
  };
}

// ── Init ───────────────────────────────────────────────────────────────────────

export function initClientStore(): void {
  // No-op: SQLite tables are created in db.ts on import
}

// ── Client-level functions ─────────────────────────────────────────────────────

export function listClients(): ClientListItem[] {
  const rows = db.prepare(`
    SELECT c.id, c.name, c.updated_at, COUNT(p.id) as profile_count
    FROM clients c
    LEFT JOIN profiles p ON p.client_id = c.id
    GROUP BY c.id
    ORDER BY c.updated_at DESC
  `).all() as any[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    profileCount: r.profile_count,
    updatedAt: r.updated_at,
  }));
}

export function getClient(id: string): ClientData | undefined {
  return buildClientData(id);
}

export function createClient(name: string): ClientData {
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO clients (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
  ).run(id, name, now, now);

  logger.info(`Created client ${id} (${name})`);

  return { id, name, createdAt: now, updatedAt: now, profiles: [] };
}

export function renameClient(id: string, name: string): ClientData | undefined {
  const now = new Date().toISOString();
  const result = db.prepare(
    'UPDATE clients SET name = ?, updated_at = ? WHERE id = ?'
  ).run(name, now, id);

  if (result.changes === 0) {
    logger.warn(`Client ${id} not found for rename`);
    return undefined;
  }

  logger.info(`Renamed client ${id} to "${name}"`);
  return buildClientData(id);
}

export function deleteClient(id: string): boolean {
  const result = db.prepare('DELETE FROM clients WHERE id = ?').run(id);
  if (result.changes === 0) {
    logger.warn(`Client ${id} not found for deletion`);
    return false;
  }
  logger.info(`Deleted client ${id}`);
  return true;
}

// ── Profile-level functions ────────────────────────────────────────────────────

export function createProfile(
  clientId: string,
  profileName: string,
  host: string,
  platform: string,
  config: Record<string, unknown>
): ProfileEntry | undefined {
  const client = db.prepare('SELECT id FROM clients WHERE id = ?').get(clientId);
  if (!client) {
    logger.warn(`Client ${clientId} not found for createProfile`);
    return undefined;
  }

  const profileId = uuidv4();
  const versionId = uuidv4();
  const now = new Date().toISOString();
  const encrypted = encryptConfig(config);

  db.prepare(`
    INSERT INTO profiles (id, client_id, name, host, platform, created_at, updated_at, latest_version_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(profileId, clientId, profileName, host, platform, now, now, versionId);

  db.prepare(`
    INSERT INTO profile_versions (id, profile_id, created_at, label, iv, auth_tag, ciphertext)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(versionId, profileId, now, '', encrypted.iv, encrypted.authTag, encrypted.ciphertext);

  db.prepare('UPDATE clients SET updated_at = ? WHERE id = ?').run(now, clientId);

  logger.info(`Created profile ${profileId} (${profileName}) for client ${clientId}`);

  return {
    profileId,
    name: profileName,
    host,
    platform,
    createdAt: now,
    updatedAt: now,
    latestVersionId: versionId,
    versions: [{ versionId, createdAt: now, label: '', iv: encrypted.iv, authTag: encrypted.authTag, ciphertext: encrypted.ciphertext }],
  };
}

export function addProfileVersion(
  clientId: string,
  profileId: string,
  config: Record<string, unknown>
): ProfileEntry | undefined {
  const profile = db.prepare(
    'SELECT * FROM profiles WHERE id = ? AND client_id = ?'
  ).get(profileId, clientId) as any;

  if (!profile) {
    logger.warn(`Profile ${profileId} not found in client ${clientId}`);
    return undefined;
  }

  const versionId = uuidv4();
  const now = new Date().toISOString();
  const encrypted = encryptConfig(config);

  db.prepare(`
    INSERT INTO profile_versions (id, profile_id, created_at, label, iv, auth_tag, ciphertext)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(versionId, profileId, now, '', encrypted.iv, encrypted.authTag, encrypted.ciphertext);

  db.prepare(
    'UPDATE profiles SET latest_version_id = ?, updated_at = ? WHERE id = ?'
  ).run(versionId, now, profileId);

  db.prepare('UPDATE clients SET updated_at = ? WHERE id = ?').run(now, clientId);

  logger.info(`Added version ${versionId} to profile ${profileId} in client ${clientId}`);

  const versionRows = db.prepare(
    'SELECT * FROM profile_versions WHERE profile_id = ? ORDER BY created_at ASC'
  ).all(profileId) as any[];

  return {
    profileId: profile.id,
    name: profile.name,
    host: profile.host,
    platform: profile.platform,
    createdAt: profile.created_at,
    updatedAt: now,
    latestVersionId: versionId,
    versions: versionRows.map((v) => ({
      versionId: v.id,
      createdAt: v.created_at,
      label: v.label,
      iv: v.iv,
      authTag: v.auth_tag,
      ciphertext: v.ciphertext,
    })),
  };
}

export function getProfileVersion(
  clientId: string,
  profileId: string,
  versionId: string
): Record<string, unknown> | undefined {
  const profile = db.prepare(
    'SELECT id FROM profiles WHERE id = ? AND client_id = ?'
  ).get(profileId, clientId);

  if (!profile) return undefined;

  const version = db.prepare(
    'SELECT * FROM profile_versions WHERE id = ? AND profile_id = ?'
  ).get(versionId, profileId) as any;

  if (!version) return undefined;

  try {
    return decryptConfig(version.iv, version.auth_tag, version.ciphertext);
  } catch (error) {
    logger.error(`Failed to decrypt version ${versionId} in profile ${profileId}:`, error);
    return undefined;
  }
}

export function renameProfile(
  clientId: string,
  profileId: string,
  name: string
): ProfileEntry | undefined {
  const now = new Date().toISOString();
  const result = db.prepare(
    'UPDATE profiles SET name = ?, updated_at = ? WHERE id = ? AND client_id = ?'
  ).run(name, now, profileId, clientId);

  if (result.changes === 0) {
    logger.warn(`Profile ${profileId} not found in client ${clientId}`);
    return undefined;
  }

  db.prepare('UPDATE clients SET updated_at = ? WHERE id = ?').run(now, clientId);
  logger.info(`Renamed profile ${profileId} to "${name}" in client ${clientId}`);

  const profileRow = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId) as any;
  const versionRows = db.prepare(
    'SELECT * FROM profile_versions WHERE profile_id = ? ORDER BY created_at ASC'
  ).all(profileId) as any[];

  return {
    profileId: profileRow.id,
    name: profileRow.name,
    host: profileRow.host,
    platform: profileRow.platform,
    createdAt: profileRow.created_at,
    updatedAt: profileRow.updated_at,
    latestVersionId: profileRow.latest_version_id,
    versions: versionRows.map((v) => ({
      versionId: v.id,
      createdAt: v.created_at,
      label: v.label,
      iv: v.iv,
      authTag: v.auth_tag,
      ciphertext: v.ciphertext,
    })),
  };
}

export function deleteProfile(clientId: string, profileId: string): boolean {
  const result = db.prepare(
    'DELETE FROM profiles WHERE id = ? AND client_id = ?'
  ).run(profileId, clientId);

  if (result.changes === 0) {
    logger.warn(`Profile ${profileId} not found in client ${clientId}`);
    return false;
  }

  db.prepare('UPDATE clients SET updated_at = ? WHERE id = ?').run(
    new Date().toISOString(), clientId
  );
  logger.info(`Deleted profile ${profileId} from client ${clientId}`);
  return true;
}

export function updateProfileHost(
  clientId: string,
  profileId: string,
  host: string
): ProfileEntry | undefined {
  const now = new Date().toISOString();
  const result = db.prepare(
    'UPDATE profiles SET host = ?, updated_at = ? WHERE id = ? AND client_id = ?'
  ).run(host, now, profileId, clientId);

  if (result.changes === 0) {
    logger.warn(`Profile ${profileId} not found in client ${clientId}`);
    return undefined;
  }

  db.prepare('UPDATE clients SET updated_at = ? WHERE id = ?').run(now, clientId);
  logger.info(`Updated host for profile ${profileId} in client ${clientId}`);

  const profileRow = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId) as any;
  const versionRows = db.prepare(
    'SELECT * FROM profile_versions WHERE profile_id = ? ORDER BY created_at ASC'
  ).all(profileId) as any[];

  return {
    profileId: profileRow.id,
    name: profileRow.name,
    host: profileRow.host,
    platform: profileRow.platform,
    createdAt: profileRow.created_at,
    updatedAt: profileRow.updated_at,
    latestVersionId: profileRow.latest_version_id,
    versions: versionRows.map((v) => ({
      versionId: v.id,
      createdAt: v.created_at,
      label: v.label,
      iv: v.iv,
      authTag: v.auth_tag,
      ciphertext: v.ciphertext,
    })),
  };
}
