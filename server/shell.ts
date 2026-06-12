import { existsSync } from 'fs';

const FALLBACK_SHELLS = ['/bin/bash', '/usr/bin/bash', '/bin/sh', '/usr/bin/sh'];

export function resolveShell(): string {
  const configured = process.env.SHELL?.trim();
  if (configured && existsSync(configured)) return configured;

  return FALLBACK_SHELLS.find((shell) => existsSync(shell)) || 'sh';
}
