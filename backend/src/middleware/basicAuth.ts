import { Request, Response, NextFunction } from 'express';
import { validatePassword, getUserByUsername, PERMISSIONS, Role } from '../services/userStore';

const PUBLIC_ENDPOINTS = [
  '/api/health',
  '/api/updategh',
  '/api/save_custom_client',
  '/api/get_png',
  '/api/build-config/',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/status/',
  '/api/artifact/',
  '/api/token/',
];

function isPublicEndpoint(path: string): boolean {
  const normalizedPath = path.startsWith('/api') ? path : `/api${path}`;
  return PUBLIC_ENDPOINTS.some(endpoint => normalizedPath.startsWith(endpoint));
}

const sessions: Map<string, { userId: string; username: string; role: Role; expires: number }> = new Map();

export function basicAuth(req: Request, res: Response, next: NextFunction) {
  if (isPublicEndpoint(req.path)) return next();
  if (req.headers['x-api-key']) return next();
  if (req.headers['x-admin-secret']) return next();

  const sessionToken = req.headers['x-session-token'] as string;
  if (sessionToken) {
    const session = sessions.get(sessionToken);
    if (session && Date.now() < session.expires) {
      req.user = { id: session.userId, username: session.username, name: '', role: session.role };
      return next();
    }
    if (session) sessions.delete(sessionToken);
  }

  return res.status(401).json({ success: false, error: 'Authentication required' });
}

export function createSession(username: string, password: string): { token: string; user: any } | null {
  const user = validatePassword(username, password);
  if (!user) return null;

  const token = generateToken();
  const expires = Date.now() + 24 * 60 * 60 * 1000;
  sessions.set(token, { userId: user.id, username: user.username, role: user.role, expires });

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      permissions: PERMISSIONS[user.role],
    },
  };
}

export function deleteSession(token: string): void {
  sessions.delete(token);
}

export function getSessionUser(token: string): any | null {
  const session = sessions.get(token);
  if (!session || Date.now() > session.expires) {
    if (session) sessions.delete(token);
    return null;
  }
  return { id: session.userId, username: session.username, role: session.role };
}

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
