// ── Types ──────────────────────────────────────────────

export interface CheckpointFile {
  path: string;
  kind: 'tracked' | 'untracked';
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'type-changed' | 'untracked';
  /** Unified diff for tracked changes; for untracked small files, the full content. */
  content: string;
  /** For untracked: the file size in bytes. */
  size?: number;
}

export interface Checkpoint {
  id: string;
  projectId: string;
  workingDir: string;
  root: string;
  branch: string;
  head: string;
  upstream?: string;
  files: CheckpointFile[];
  /** Snapshot of untracked file paths that fit under MAX_INLINE_BYTES. */
  inlineUntracked: string[];
  /** Untracked file paths that could not be safely restored automatically. */
  untrackedTooLarge: string[];
  createdAt: string;
  label: string;
  status: 'active' | 'restored' | 'discarded';
  restoredAt?: string;
}

// ── Storage ────────────────────────────────────────────

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  unlinkSync,
  statSync,
} from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';
import { v4 as uuid } from 'uuid';
import { getStatus, getFileDiff } from './git';

const ROOT = join(homedir(), '.openharness', 'checkpoints');

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

ensureDir(ROOT);

/** Files larger than this many bytes are not embedded; they are warned-only. */
const MAX_INLINE_BYTES = 64 * 1024;

/** Project id is a stable, filesystem-safe label of the project root. */
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
  lastCheckpointAt: string;
}

function readProjectMeta(root: string): ProjectMeta {
  const path = projectMetaPath(root);
  if (!existsSync(path)) {
    return { root, createdAt: new Date().toISOString(), lastCheckpointAt: '' };
  }
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return { root, createdAt: new Date().toISOString(), lastCheckpointAt: '' };
  }
}

function writeProjectMeta(root: string, meta: ProjectMeta) {
  ensureDir(projectDir(root));
  writeFileSync(projectMetaPath(root), JSON.stringify(meta, null, 2), 'utf-8');
}

// ── Git helpers ────────────────────────────────────────

function runGit(args: string[], cwd: string): string {
  try {
    return execSync(`git ${args.join(' ')}`, {
      cwd,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 15000,
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

function readUntrackedFile(root: string, path: string): { content: string; size: number } | null {
  const fullPath = join(root, path);
  if (!existsSync(fullPath)) return null;
  const stat = statSync(fullPath);
  if (stat.isDirectory()) return null;
  if (stat.size > MAX_INLINE_BYTES) {
    return { content: '', size: stat.size };
  }
  return { content: readFileSync(fullPath, 'utf-8'), size: stat.size };
}

// ── Public API ─────────────────────────────────────────

export interface CreateCheckpointOptions {
  label?: string;
}

export function createCheckpoint(dir: string, opts: CreateCheckpointOptions = {}): Checkpoint {
  const root = getGitRoot(dir);
  if (!root) throw new Error('Not a git repository');

  const status = getStatus(dir);
  const files: CheckpointFile[] = [];

  // Capture staged + unstaged tracked changes
  for (const change of [...status.staged, ...status.unstaged]) {
    const diff = getFileDiff(dir, change.path);
    files.push({
      path: change.path,
      kind: 'tracked',
      status: change.status,
      content: diff?.diff || '',
    });
  }

  // Capture small untracked files inline, mark large ones for warning
  const inlineUntracked: string[] = [];
  const untrackedTooLarge: string[] = [];
  for (const path of status.untracked) {
    const data = readUntrackedFile(root, path);
    if (!data) continue;
    if (data.size > MAX_INLINE_BYTES) {
      untrackedTooLarge.push(`${path} (${data.size} bytes)`);
      continue;
    }
    inlineUntracked.push(path);
    files.push({
      path,
      kind: 'untracked',
      status: 'untracked',
      content: data.content,
      size: data.size,
    });
  }

  // Upstream tracking, if any
  let upstream: string | undefined;
  try {
    upstream = runGit(['rev-parse', '--abbrev-ref', '@{upstream}'], root) || undefined;
  } catch { /* no upstream */ }

  const checkpoint: Checkpoint = {
    id: uuid(),
    projectId: projectIdFor(root),
    workingDir: dir,
    root,
    branch: status.branch,
    head: runGit(['rev-parse', 'HEAD'], root),
    upstream,
    files,
    inlineUntracked,
    untrackedTooLarge,
    createdAt: new Date().toISOString(),
    label: opts.label || `Snapshot @ ${new Date().toLocaleString()}`,
    status: 'active',
  };

  const dir2 = projectDir(root);
  ensureDir(dir2);
  writeFileSync(join(dir2, `${checkpoint.id}.json`), JSON.stringify(checkpoint, null, 2), 'utf-8');

  const meta = readProjectMeta(root);
  meta.lastCheckpointAt = checkpoint.createdAt;
  writeProjectMeta(root, meta);

  return checkpoint;
}

export function listCheckpoints(dir: string): Checkpoint[] {
  const root = getGitRoot(dir);
  if (!root) return [];
  const dir2 = projectDir(root);
  if (!existsSync(dir2)) return [];

  return readdirSync(dir2)
    .filter(f => f.endsWith('.json') && f !== 'project.json')
    .map(f => {
      try {
        return JSON.parse(readFileSync(join(dir2, f), 'utf-8')) as Checkpoint;
      } catch {
        return null;
      }
    })
    .filter((c): c is Checkpoint => c !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getCheckpoint(dir: string, id: string): Checkpoint | null {
  const root = getGitRoot(dir);
  if (!root) return null;
  const path = join(projectDir(root), `${id}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as Checkpoint;
  } catch {
    return null;
  }
}

export function deleteCheckpoint(dir: string, id: string): boolean {
  const root = getGitRoot(dir);
  if (!root) return false;
  const path = join(projectDir(root), `${id}.json`);
  if (!existsSync(path)) return false;
  unlinkSync(path);
  return true;
}

export interface RestoreCheckpointResult {
  ok: boolean;
  applied: string[];
  failed: string[];
  warnings: string[];
  /** True if the working tree was modified by the restore (vs. already clean). */
  changed: boolean;
}

/**
 * Restore a checkpoint by reverting the working tree to match HEAD.
 * Tracked files are reset to the state they were in at checkpoint creation.
 *
 * Untracked files that were snapshotted inline are recreated on disk.
 * Untracked files that were too large are reported as warnings — they were
 * not embedded so they cannot be safely restored.
 */
export function restoreCheckpoint(dir: string, id: string): RestoreCheckpointResult {
  const checkpoint = getCheckpoint(dir, id);
  if (!checkpoint) {
    return { ok: false, applied: [], failed: [], warnings: ['Checkpoint not found'], changed: false };
  }

  const root = checkpoint.root;
  const applied: string[] = [];
  const failed: string[] = [];
  const warnings: string[] = [...checkpoint.untrackedTooLarge];

  // Reset tracked files to HEAD using `git checkout HEAD -- <path>`
  for (const file of checkpoint.files.filter(f => f.kind === 'tracked')) {
    try {
      if (file.status === 'added') {
        // File did not exist at HEAD — remove it
        const full = join(root, file.path);
        if (existsSync(full)) unlinkSync(full);
        applied.push(file.path);
        continue;
      }
      runGit(['checkout', 'HEAD', '--', file.path], root);
      applied.push(file.path);
    } catch (err: any) {
      failed.push(`${file.path}: ${err.message}`);
    }
  }

  // Recreate inline untracked files
  for (const file of checkpoint.files.filter(f => f.kind === 'untracked')) {
    try {
      const full = join(root, file.path);
      ensureDir(dirname(full));
      writeFileSync(full, file.content, 'utf-8');
      applied.push(file.path);
    } catch (err: any) {
      failed.push(`${file.path}: ${err.message}`);
    }
  }

  checkpoint.status = 'restored';
  checkpoint.restoredAt = new Date().toISOString();
  const meta = readProjectMeta(root);
  writeProjectMeta(root, meta);
  writeFileSync(join(projectDir(root), `${checkpoint.id}.json`), JSON.stringify(checkpoint, null, 2), 'utf-8');

  return {
    ok: failed.length === 0,
    applied,
    failed,
    warnings,
    changed: applied.length > 0,
  };
}

/**
 * Re-apply the dirty changes recorded in a checkpoint as a working diff.
 * Used to bring back the user's in-progress work after a manual reset.
 */
export function applyCheckpointDiff(dir: string, id: string): RestoreCheckpointResult {
  const checkpoint = getCheckpoint(dir, id);
  if (!checkpoint) {
    return { ok: false, applied: [], failed: [], warnings: ['Checkpoint not found'], changed: false };
  }

  const root = checkpoint.root;
  const applied: string[] = [];
  const failed: string[] = [];

  for (const file of checkpoint.files.filter(f => f.kind === 'tracked' && f.content)) {
    try {
      const full = join(root, file.path);
      ensureDir(dirname(full));
      execSync('git apply --whitespace=nowarn -', {
        cwd: root,
        input: file.content,
        encoding: 'utf-8',
        timeout: 15000,
      });
      applied.push(file.path);
    } catch (err: any) {
      failed.push(`${file.path}: ${err.message?.split('\n')?.[0] || err.message}`);
    }
  }

  return {
    ok: failed.length === 0,
    applied,
    failed,
    warnings: [...checkpoint.untrackedTooLarge],
    changed: applied.length > 0,
  };
}

export interface ProjectCheckpointSummary {
  root: string;
  projectId: string;
  createdAt: string;
  lastCheckpointAt: string;
  count: number;
}

export function listProjectsWithCheckpoints(): ProjectCheckpointSummary[] {
  if (!existsSync(ROOT)) return [];
  return readdirSync(ROOT, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => {
      const metaPath = join(ROOT, d.name, 'project.json');
      if (!existsSync(metaPath)) return null;
      try {
        const meta = JSON.parse(readFileSync(metaPath, 'utf-8')) as ProjectMeta;
        const checkpoints = readdirSync(join(ROOT, d.name))
          .filter(f => f.endsWith('.json') && f !== 'project.json');
        return {
          root: meta.root,
          projectId: d.name,
          createdAt: meta.createdAt,
          lastCheckpointAt: meta.lastCheckpointAt,
          count: checkpoints.length,
        };
      } catch {
        return null;
      }
    })
    .filter((p): p is ProjectCheckpointSummary => p !== null);
}

export const CHECKPOINT_CONSTANTS = {
  ROOT,
  MAX_INLINE_BYTES,
};
