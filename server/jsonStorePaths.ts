import { isAbsolute, relative, resolve } from 'path';

export function safeStoreId(id: string): string | null {
  if (typeof id !== 'string') return null;
  const trimmed = id.trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(trimmed)) return null;
  if (trimmed.includes('..')) return null;
  return trimmed;
}

export function safeJsonStorePath(root: string, id: string): string | null {
  const safeId = safeStoreId(id);
  if (!safeId) return null;
  const resolvedRoot = resolve(root);
  const candidate = resolve(resolvedRoot, `${safeId}.json`);
  const rel = relative(resolvedRoot, candidate);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return null;
  return candidate;
}
