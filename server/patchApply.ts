import { execFileSync } from 'child_process';

import { isAbsolute, relative, resolve } from 'path';

export interface PatchResult {
  files: string[];
  errors: string[];
}

/**
 * Apply a unified diff patch using the system `patch` command, scoped to
 * `workingDir`. The patch text is passed over stdin with `cwd = workingDir`,
 * so the system `patch` binary only ever touches the directory the caller
 * asked for.
 *
 * `workingDir` is required. The function also performs a static pre-flight
 * scan: any `diff --git a/X b/X` line whose `X` resolves to an absolute
 * path or to a path that escapes `workingDir` is rejected before
 * `patch` is invoked. This is belt-and-suspenders on top of the route-level
 * `isPathAllowed` check.
 */
export function applyPatch(patchText: string, workingDir: string): PatchResult {
  if (typeof patchText !== 'string') {
    return { files: [], errors: ['patch text must be a string'] };
  }
  if (typeof workingDir !== 'string' || workingDir.length === 0) {
    return { files: [], errors: ['workingDir is required'] };
  }

  const safeWorkingDir = resolve(workingDir);

  // Static pre-flight: scan both git-style headers and legacy unified-diff
  // file labels. The `patch -p1` invocation strips one leading path
  // component, so `a/file`, `b/file`, and `file` are normalised before
  // containment checks. Reject anything absolute or escaping workingDir.
  const candidatePaths: string[] = [];
  const prefix = 'diff --git a/';
  for (const raw of patchText.split('\n')) {
    if (raw.startsWith(prefix)) {
      const tail = raw.slice(prefix.length);
      const sep = tail.indexOf(' b/');
      if (sep !== -1) {
        candidatePaths.push(tail.slice(0, sep), tail.slice(sep + 3));
      }
      continue;
    }
    if (raw.startsWith('--- ') || raw.startsWith('+++ ')) {
      const label = raw.slice(4).trim();
      if (label !== '/dev/null') candidatePaths.push(label);
    }
  }

  for (const rawPath of candidatePaths) {
    const p = normalizePatchPath(rawPath);
    if (!p || p === '/dev/null') continue;
    if (isAbsolute(p)) {
      return { files: [], errors: [`Patch references absolute path: ${p}`] };
    }
    const resolved = resolve(safeWorkingDir, p);
    if (!isWithin(resolved, safeWorkingDir)) {
      return { files: [], errors: [`Patch path escapes workingDir: ${p}`] };
    }
  }

  try {
    // 1) Dry-run. If the patch is malformed, abort before touching disk.
    execFileSync('patch', ['--dry-run', '-p1', '--no-backup-if-mismatch'], {
      encoding: 'utf-8',
      timeout: 10_000,
      cwd: safeWorkingDir,
      input: patchText,
    });

    // 2) Real apply, again scoped to workingDir.
    const stdout = execFileSync('patch', ['-p1', '--no-backup-if-mismatch'], {
      encoding: 'utf-8',
      timeout: 10_000,
      cwd: safeWorkingDir,
      input: patchText,
    });

    const patched: string[] = [];
    for (const m of stdout.matchAll(/^patching file (.+)$/gm)) {
      patched.push(m[1]);
    }
    return { files: patched, errors: [] };
  } catch (err: any) {
    const text = [
      err?.stdout,
      err?.stderr,
      err?.message || 'Patch apply failed',
    ].filter(Boolean).join('\n');
    const lines = text.split('\n').filter((l: string) => l.trim());
    return { files: [], errors: lines.slice(0, 10) };
  }
}

function normalizePatchPath(rawPath: string): string {
  let p = rawPath.trim();
  const tab = p.indexOf('\t');
  if (tab !== -1) p = p.slice(0, tab);
  if (p.startsWith('"') && p.endsWith('"') && p.length >= 2) {
    p = p.slice(1, -1);
  }
  if (p.startsWith('a/') || p.startsWith('b/')) p = p.slice(2);
  return p;
}

function isWithin(candidate: string, workspace: string): boolean {
  const rel = relative(workspace, candidate);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}
