import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import db from './db';

const SALT_ROUNDS = 10;

export type Role = 'admin' | 'operador' | 'construtor' | 'visualizador';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
}

export type UserWithoutHash = Omit<User, 'passwordHash'>;

export const PERMISSIONS: Record<Role, string[]> = {
  admin: ['clients:read', 'clients:write', 'profiles:save', 'builds:generate', 'users:manage'],
  operador: ['clients:read', 'clients:write', 'profiles:save', 'builds:generate'],
  construtor: ['clients:read', 'builds:generate'],
  visualizador: ['clients:read'],
};

function rowToUser(row: any): User {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    name: row.name,
    role: row.role as Role,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    lastLogin: row.last_login ?? undefined,
  };
}

export function initUserStore(): void {
  const existing = db.prepare('SELECT id FROM users LIMIT 1').get();
  if (!existing) {
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'rdgen@2024';
    const adminName = process.env.ADMIN_NAME || 'Administrador';

    db.prepare(`
      INSERT INTO users (id, username, password_hash, name, role, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `).run(uuidv4(), adminUser, bcrypt.hashSync(adminPass, SALT_ROUNDS), adminName, 'admin', new Date().toISOString());

    logger.info(`Created initial admin user: ${adminUser}`);
  }
}

export function getAllUsers(): UserWithoutHash[] {
  const rows = db.prepare('SELECT * FROM users').all() as any[];
  return rows.map((r) => {
    const { passwordHash, ...rest } = rowToUser(r);
    return rest;
  });
}

export function getUserByUsername(username: string): User | undefined {
  const row = db.prepare(
    'SELECT * FROM users WHERE username = ? AND is_active = 1'
  ).get(username) as any;
  return row ? rowToUser(row) : undefined;
}

export function getUserById(id: string): User | undefined {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  return row ? rowToUser(row) : undefined;
}

export function createUser(username: string, password: string, name: string, role: Role): User {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) throw new Error('Username already exists');

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, username, password_hash, name, role, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `).run(id, username, bcrypt.hashSync(password, SALT_ROUNDS), name, role, now);

  logger.info(`Created user ${username} with role ${role}`);
  return rowToUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any);
}

export function updateUser(
  id: string,
  updates: Partial<Pick<User, 'name' | 'role' | 'isActive' | 'passwordHash'>>
): User | undefined {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  if (!row) return undefined;

  const name = updates.name ?? row.name;
  const role = updates.role ?? row.role;
  const isActive = updates.isActive !== undefined ? (updates.isActive ? 1 : 0) : row.is_active;
  const passwordHash = updates.passwordHash ?? row.password_hash;

  db.prepare(`
    UPDATE users SET name = ?, role = ?, is_active = ?, password_hash = ? WHERE id = ?
  `).run(name, role, isActive, passwordHash, id);

  logger.info(`Updated user ${id}`);
  return rowToUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any);
}

export function deleteUser(id: string): boolean {
  const result = db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(id);
  if (result.changes === 0) return false;
  logger.info(`Deactivated user ${id}`);
  return true;
}

export function validatePassword(username: string, password: string): User | undefined {
  const user = getUserByUsername(username);
  if (!user || !user.isActive) return undefined;
  if (!bcrypt.compareSync(password, user.passwordHash)) return undefined;

  db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(
    new Date().toISOString(), user.id
  );

  return user;
}

export function changePassword(id: string, newPassword: string): boolean {
  const result = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
    bcrypt.hashSync(newPassword, SALT_ROUNDS), id
  );
  if (result.changes === 0) return false;
  logger.info(`Changed password for user ${id}`);
  return true;
}
