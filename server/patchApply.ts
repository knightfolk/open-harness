import { execSync } from 'child_process';

import { writeFileSync, unlinkSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export interface PatchResult {
  files: string[];
  errors: string[];
}

/**
 * Apply a unified diff patch using the system `patch` command.
 * The patch is written to a temp file and applied with --no-backup-if-mismatch.
 */
export function applyPatch(patchText: string): PatchResult {
  const files: string[] = [];

  // Parse file paths from the patch
  const fileMatches = patchText.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm);
  for (const match of fileMatches) {
    files.push(match[2] || match[1]);
  }

  if (files.length === 0) {
    // Maybe it's a simple file-level patch without the diff --git header
    const simpleMatches = patchText.matchAll(/^\+\+\+ b\/(.+)$/gm);
    for (const match of simpleMatches) {
      files.push(match[1]);
    }
  }

  // Write patch to temp file
  const tmpDir = mkdtempSync(join(tmpdir(), 'cmdui-patch-'));
  const patchFile = join(tmpDir, 'patch.diff');
  writeFileSync(patchFile, patchText, 'utf-8');

  try {
    // Apply with --dry-run first to check
    execSync(`patch --dry-run -p1 --no-backup-if-mismatch < "${patchFile}" 2>&1`, {
      encoding: 'utf-8',
      timeout: 10000,
    });

    // Actually apply
    const output = execSync(`patch -p1 --no-backup-if-mismatch < "${patchFile}" 2>&1`, {
      encoding: 'utf-8',
      timeout: 10000,
    });

    // Parse which files were actually patched
    const patchedFiles = output.matchAll(/^patching file (.+)$/gm);
    const patched: string[] = [];
    for (const m of patchedFiles) {
      patched.push(m[1]);
    }

    return { files: patched.length > 0 ? patched : files, errors: [] };
  } catch (err: any) {
    const errMsg = err.stdout || err.message || 'Patch apply failed';
    const lines = errMsg.split('\n').filter((l: string) => l.trim());
    return { files: [], errors: lines.slice(0, 10) };
  } finally {
    try { unlinkSync(patchFile); } catch { /* ignore */ }
  }
}
