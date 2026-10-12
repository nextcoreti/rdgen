import crypto from 'crypto';
import logger from '../utils/logger';

// Verifies GitHub Actions OIDC tokens so a workflow run can prove it is a
// build of this repository without any shared secret.
const ISSUER = 'https://token.actions.githubusercontent.com';
const JWKS_URL = `${ISSUER}/.well-known/jwks`;
export const OIDC_AUDIENCE = 'rdgen';

let jwksCache: { keys: any[]; fetchedAt: number } | null = null;

async function getSigningKey(kid: string): Promise<crypto.KeyObject | undefined> {
  const stale = !jwksCache || Date.now() - jwksCache.fetchedAt > 60 * 60 * 1000;
  if (stale || !jwksCache!.keys.some(k => k.kid === kid)) {
    const res = await fetch(JWKS_URL);
    if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
    jwksCache = { keys: ((await res.json()) as any).keys, fetchedAt: Date.now() };
  }
  const jwk = jwksCache!.keys.find(k => k.kid === kid);
  return jwk ? crypto.createPublicKey({ key: jwk, format: 'jwk' }) : undefined;
}

function decodePart(part: string): any {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

// Returns the token claims when the token is valid and was issued to a
// workflow_dispatch run on the master branch of the given repository.
export async function verifyGithubOidc(token: string, repository: string): Promise<any | null> {
  try {
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return null;
    const header = decodePart(h);
    if (header.alg !== 'RS256' || !header.kid) return null;

    const key = await getSigningKey(header.kid);
    if (!key) return null;
    const valid = crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`), key, Buffer.from(s, 'base64url'));
    if (!valid) return null;

    const claims = decodePart(p);
    const now = Math.floor(Date.now() / 1000);
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (claims.iss !== ISSUER || !aud.includes(OIDC_AUDIENCE)) return null;
    if (typeof claims.exp !== 'number' || claims.exp < now) return null;
    if (typeof claims.nbf === 'number' && claims.nbf > now + 60) return null;
    if (claims.repository !== repository) return null;
    if (claims.ref !== 'refs/heads/master' || claims.event_name !== 'workflow_dispatch') return null;
    return claims;
  } catch (err: any) {
    logger.warn(`OIDC verification error: ${err.message}`);
    return null;
  }
}
