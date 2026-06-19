import type express from 'express';
import { timingSafeEqual } from 'crypto';
import { isIP } from 'net';

export function normalizeAddressForControlCheck(address: string | undefined): string {
  if (!address) return '';
  const unwrapped = address.replace(/^\[|]$/g, '');
  if (unwrapped.startsWith('::ffff:')) return unwrapped.slice(7);
  return unwrapped;
}

export function isLoopbackAddress(address: string): boolean {
  const normalized = normalizeAddressForControlCheck(address).toLowerCase();
  if (!normalized) return false;
  if (!isIP(normalized)) {
    return normalized === 'localhost';
  }
  if (normalized === '::1' || normalized === '127.0.0.1') return true;
  if (normalized.startsWith('127.')) return true;
  return false;
}

export function isLoopbackListenHost(host: string): boolean {
  const normalized = normalizeAddressForControlCheck(host).toLowerCase();
  return normalized === '' || isLoopbackAddress(normalized);
}

export function secureTokenEquals(providedToken: string, expectedToken: string): boolean {
  const expected = Buffer.from(expectedToken, 'utf8');
  const actual = Buffer.from(providedToken, 'utf8');
  if (expected.length !== actual.length) return false;
  try {
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function getBearerOrHeaderToken(req: express.Request, headerNames: string[]): string {
  const bearer = req.get('authorization');
  if (bearer && /^bearer\s+/i.test(bearer)) {
    return bearer.replace(/^bearer\s+/i, '').trim();
  }
  for (const headerName of headerNames) {
    const value = req.get(headerName);
    if (value) return value.trim();
  }
  return '';
}

export function createRemoteApiGuard(options: {
  enabled: boolean;
  token: string;
}): express.RequestHandler {
  return (req, res, next) => {
    if (!req.path.startsWith('/api/')) return next();
    if (isLoopbackAddress(req.ip || '')) return next();
    if (!options.enabled || !options.token) {
      return res.status(403).json({ error: 'Remote API access is disabled' });
    }
    const providedToken = getBearerOrHeaderToken(req, ['x-openharness-api-token', 'x-openharness-remote-token']);
    if (!providedToken || !secureTokenEquals(providedToken, options.token)) {
      return res.status(401).json({ error: 'Remote API token required' });
    }
    return next();
  };
}
