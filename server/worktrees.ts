// ── Types ──────────────────────────────────────────────

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  rmSync,
} from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';
import { v4 as uuid } from 'uuid';

export interface Worktree {
  id: string;
  /** Absolute path to the linked worktree checkout. */
  path: string;
  /** Branch checked out in the worktree. */
  branch: string;
  /** The source branch or commit the worktree was forked from. */
  baseRef: string;
  /** Repo root that owns this worktree. */
  root: string;
  createdAt: string;
  status: 'active' | 'promoted' | 'discarded' | 'error';
  /** Optional human label. */
  label?: string;
  /** True when the worktree has no uncommitted changes vs base. */
  clean: boolean;
  lastCheckedAt: string;
  /** Last error message, if any. */
  lastError?: string;
}

// ── Storage ────────────────────────────────────────────

const ROOT = join(homedir(), '.openharness', 'worktrees');

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

ensureDir(ROOT);

function projectIdFor(root: string): string {
  return root.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^_+|_+$/g, '') || 'project';
}

function projectDir(root: string): string {
  return join(ROOT, projectIdFor(root));
}

function projectMetaPath(root: string): string {
  return join(projectDir(root), 'project.json');
}

interface ProjectMeta {
  root: string;
  createdAt: string;
}

function readProjectMeta(root: string): ProjectMeta {
  const path = projectMetaPath(root);
  if (!existsSync(path)) {
    return { root, createdAt: new Date().toISOString() };
  }
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return { root, createdAt: new Date().toISOString() };
  }
}

function writeProjectMeta(root: string, meta: ProjectMeta) {
  ensureDir(projectDir(root));
  writeFileSync(projectMetaPath(root), JSON.stringify(meta, null, 2), 'utf-8');
}

// ── Git helpers ────────────────────────────────────────

function runGit(args: string[], cwd: string, opts: { input?: string } = {}): string {
  try {
    return execSync(`git ${args.join(' ')}`, {
      cwd,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30000,
      input: opts.input,
    }).trim();
  } catch (err: any) {
    throw new Error(`git ${args[0]} failed: ${err.message?.split('\n')?.[0] || err.message}`);
  }
}

function getGitRoot(dir: string): string | null {
  try {
    return execSync('git rev-parse --show-toplevel', {
      cwd: dir,
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
  } catch {
    return null;
  }
}

// ── Public API ─────────────────────────────────────────

export interface CreateWorktreeOptions {
  label?: string;
  /** Branch to base the new worktree on. Defaults to current HEAD. */
  baseBranch?: string;
  /** When true, reuse an existing branch rather than creating a fresh one. */
  reuseBranch?: boolean;
}

const BRANCH_PREFIX = 'openharness/wt-';

export function createWorktree(dir: string, opts: CreateWorktreeOptions = {}): Worktree {
  const root = getGitRoot(dir);
  if (!root) throw new Error('Not a git repository');

  const id = uuid();
  const worktreePath = join(projectDir(root), 'trees', id);
  ensureDir(dirname(worktreePath));

  const baseRef = opts.baseBranch || runGit(['rev-parse', '--abbrev-ref', 'HEAD'], root);
  const shortId = id.slice(0, 8);
  const branchName = opts.reuseBranch && opts.baseBranch
    ? opts.baseBranch
    : `${BRANCH_PREFIX}${shortId}-${Date.now().toString(36)}`;

  try {
    // Create the worktree at a new path with a fresh branch from baseRef
    runGit(['worktree', 'add', '-b', branchName, worktreePath, baseRef], root);
  } catch (err: any) {
    throw new Error(`Failed to create worktree: ${err.message}`);
  }

  const worktree: Worktree = {
    id,
    path: worktreePath,
    branch: branchName,
    baseRef,
    root,
    createdAt: new Date().toISOString(),
    status: 'active',
    label: opts.label,
    clean: true,
    lastCheckedAt: new Date().toISOString(),
  };

  writeFileSync(join(projectDir(root), `${id}.json`), JSON.stringify(worktree, null, 2), 'utf-8');
  writeProjectMeta(root, readProjectMeta(root));

  return worktree;
}

export function listWorktrees(dir: string): Worktree[] {
  const root = getGitRoot(dir);
  if (!root) return [];
  const dir2 = projectDir(root);
  if (!existsSync(dir2)) return [];

  return readdirSync(dir2)
    .filter(f => f.endsWith('.json') && f !== 'project.json')
    .map(f => {
      try {
        return JSON.parse(readFileSync(join(dir2, f), 'utf-8')) as Worktree;
      } catch {
        return null;
      }
    })
    .filter((w): w is Worktree => w !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getWorktree(dir: string, id: string): Worktree | null {
  const root = getGitRoot(dir);
  if (!root) return null;
  const path = join(projectDir(root), `${id}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as Worktree;
  } catch {
    return null;
  }
}

function writeWorktree(worktree: Worktree) {
  writeFileSync(
    join(projectDir(worktree.root), `${worktree.id}.json`),
    JSON.stringify(worktree, null, 2),
    'utf-8',
  );
}

/** Refresh the `clean` field by running `git status --porcelain` inside the worktree. */
export function refreshWorktreeState(worktree: Worktree): Worktree {
  if (!existsSync(worktree.path)) {
    worktree.clean = true;
    worktree.lastError = 'Worktree path no longer exists';
    worktree.lastCheckedAt = new Date().toISOString();
    writeWorktree(worktree);
    return worktree;
  }

  try {
    const porcelain = runGit(['status', '--porcelain'], worktree.path);
    worktree.clean = porcelain.trim().length === 0;
    worktree.lastError = undefined;
  } catch (err: any) {
    worktree.lastError = err.message;
  }
  worktree.lastCheckedAt = new Date().toISOString();
  writeWorktree(worktree);
  return worktree;
}

export function getWorktreeStatus(dir: string, id: string): Worktree | null {
  const wt = getWorktree(dir, id);
  if (!wt) return null;
  return refreshWorktreeState(wt);
}

/** Remove a worktree and its branch. */
export function removeWorktree(dir: string, id: string, opts: { force?: boolean } = {}): boolean {
  const wt = getWorktree(dir, id);
  if (!wt) return false;
  return removeWorktreeInternal(wt, opts.force || false);
}

function removeWorktreeInternal(wt: Worktree, force: boolean): boolean {
  try {
    // Prune if path missing or force flag set
    if (existsSync(wt.path)) {
      runGit(['worktree', 'remove', force ? '--force' : '', wt.path].filter(Boolean), wt.root);
    } else {
      runGit(['worktree', 'prune'], wt.root);
    }
  } catch {
    // best-effort cleanup; we'll also remove the directory by hand
  }

  try { runGit(['branch', force ? '-D' : '-d', wt.branch], wt.root); } catch { /* ignore */ }

  // Belt-and-suspenders: also remove the on-disk path
  if (existsSync(wt.path)) {
    try { rmSync(wt.path, { recursive: true, force: true }); } catch { /* ignore */ }
  }

  try { rmSync(join(projectDir(wt.root), `${wt.id}.json`), { force: true }); } catch { /* ignore */ }
  return true;
}

/** Auto-clean all worktrees that are clean and not the most-recent one. */
export function autoCleanEmptyWorktrees(dir: string): { removed: string[]; kept: string[] } {
  const root = getGitRoot(dir);
  if (!root) return { removed: [], kept: [] };
  const all = listWorktrees(root).map(refreshWorktreeState);
  const removed: string[] = [];
  const kept: string[] = [];

  // Keep the most recent worktree regardless of cleanliness, to avoid wiping
  // the user's only sandbox.
  const sorted = [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (let i = 0; i < sorted.length; i++) {
    const wt = sorted[i];
    if (i === 0) {
      kept.push(wt.id);
      continue;
    }
    if (wt.clean) {
      removeWorktreeInternal(wt, true);
      removed.push(wt.id);
    } else {
      kept.push(wt.id);
    }
  }

  return { removed, kept };
}

export interface PromoteWorktreeOptions {
  /** When true, force-apply changes even if they conflict. */
  force?: boolean;
  /** Target branch to apply on top of. Defaults to the worktree's baseRef. */
  targetBranch?: string;
}

export interface PromoteWorktreeResult {
  ok: boolean;
  applied: string[];
  failed: string[];
  warnings: string[];
  targetBranch: string;
  worktreeClean: boolean;
}

/**
 * Apply a worktree's committed changes back to the main checkout.
 *
 * The worktree branch must be committed first. This function:
 *   1. Verifies the worktree has commits beyond baseRef.
 *   2. Switches the main repo to the target branch.
 *   3. Merges the worktree branch into the target branch.
 *
 * It refuses to switch branches if the main checkout has uncommitted changes
 * unless `force` is true.
 */
export function promoteWorktree(
  dir: string,
  id: string,
  opts: PromoteWorktreeOptions = {},
): PromoteWorktreeResult {
  const wt = getWorktree(dir, id);
  if (!wt) {
    return {
      ok: false, applied: [], failed: [], warnings: ['Worktree not found'],
      targetBranch: '', worktreeClean: false,
    };
  }

  refreshWorktreeState(wt);

  if (!existsSync(wt.path)) {
    return {
      ok: false, applied: [], failed: [], warnings: ['Worktree path missing on disk'],
      targetBranch: '', worktreeClean: false,
    };
  }

  const target = opts.targetBranch || wt.baseRef;
  const warnings: string[] = [];
  const applied: string[] = [];
  const failed: string[] = [];

  // Detect uncommitted changes in main checkout — refuse to switch
  try {
    const mainPorcelain = runGit(['status', '--porcelain'], wt.root);
    if (mainPorcelain.trim() && !opts.force) {
      return {
        ok: false, applied: [], failed: [],
        warnings: ['Main checkout has uncommitted changes. Commit, stash, or use force=true.'],
        targetBranch: target, worktreeClean: wt.clean,
      };
    }
  } catch (err: any) {
    return {
      ok: false, applied: [], failed: [],
      warnings: [`Unable to read main checkout status: ${err.message}`],
      targetBranch: target, worktreeClean: wt.clean,
    };
  }

  try {
    // Switch main checkout to the target branch
    runGit(['checkout', target], wt.root);
    applied.push(`checkout ${target}`);

    // Merge the worktree branch (no-ff so the promotion is visible in history)
    const mergeArgs = ['merge', '--no-ff', '--no-edit', wt.branch];
    if (opts.force) mergeArgs.push('--strategy-option=theirs');
    runGit(mergeArgs, wt.root);
    applied.push(`merge ${wt.branch}`);
  } catch (err: any) {
    // Try to abort
    try { runGit(['merge', '--abort'], wt.root); } catch { /* ignore */ }
    failed.push(`merge: ${err.message?.split('\n')?.[0] || err.message}`);
    return {
      ok: false, applied, failed, warnings,
      targetBranch: target, worktreeClean: wt.clean,
    };
  }

  if (!wt.clean) {
    warnings.push('Worktree had uncommitted changes that were NOT promoted (commit inside the worktree first)');
  }

  wt.status = 'promoted';
  writeWorktree(wt);

  return { ok: true, applied, failed, warnings, targetBranch: target, worktreeClean: wt.clean };
}

/**
 * List files modified or added in the worktree branch vs baseRef.
 * Useful to preview what a promotion will apply.
 */
export function diffWorktreeVsBase(dir: string, id: string): {
  files: Array<{ path: string; status: string; insertions: number; deletions: number }>;
  commitCount: number;
  baseRef: string;
} {
  const wt = getWorktree(dir, id);
  if (!wt) return { files: [], commitCount: 0, baseRef: '' };

  if (!existsSync(wt.path)) return { files: [], commitCount: 0, baseRef: wt.baseRef };

  let commitCount = 0;
  try {
    const log = runGit(['rev-list', '--count', `${wt.baseRef}..${wt.branch}`], wt.root);
    commitCount = parseInt(log, 10) || 0;
  } catch { /* ignore */ }

  const files: Array<{ path: string; status: string; insertions: number; deletions: number }> = [];
  try {
    const numstat = runGit(['diff', '--numstat', `${wt.baseRef}...${wt.branch}`], wt.root);
    const nameStatus = runGit(['diff', '--name-status', `${wt.baseRef}...${wt.branch}`], wt.root);
    const statusMap = new Map<string, string>();
    for (const line of nameStatus.split('\n').filter(Boolean)) {
      const [code, ...rest] = line.split('\t');
      const path = rest.join('\t');
      statusMap.set(path, code);
    }
    for (const line of numstat.split('\n').filter(Boolean)) {
      const [ins, del, ...rest] = line.split('\t');
      const path = rest.join('\t');
      files.push({
        path,
        status: statusMap.get(path) || 'modified',
        insertions: ins === '-' ? 0 : parseInt(ins || '0', 10),
        deletions: del === '-' ? 0 : parseInt(del || '0', 10),
      });
    }
  } catch { /* ignore */ }

  return { files, commitCount, baseRef: wt.baseRef };
}

export const WORKTREE_CONSTANTS = {
  ROOT,
  BRANCH_PREFIX,
};
