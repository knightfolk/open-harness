// server/patchProposals.ts
//
// In-memory + JSONL disk-backed store of patch proposals. Each proposal is a
// model-supplied (or user-supplied) unified diff, parsed into per-file
// per-hunk records so the UI can show file-by-file and hunk-by-hunk
// accept/reject controls before anything is written to disk.
//
// Storage layout:
//   ~/.openharness/patch-proposals/<id>.json
//
// This module is pure data; it does not import the patchApply executor and it
// does not touch the working tree. The apply logic lives in server/index.ts
// where it can use the same trust-mode + workingDir guards as the rest of the
// write surface.
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { v4 as uuid } from 'uuid';

import { parseUnifiedDiff, type ParsedFile, type ParsedHunk, type FileAction, serializeHunks } from './patchParse';

const PROPOSALS_DIR = join(homedir(), '.openharness', 'patch-proposals');

function ensureDir(): void {
  if (!existsSync(PROPOSALS_DIR)) mkdirSync(PROPOSALS_DIR, { recursive: true });
}

function proposalPath(id: string): string {
  return join(PROPOSALS_DIR, `${id}.json`);
}

export type HunkStatus = 'pending' | 'accepted' | 'rejected';

export interface PatchHunkRecord {
  id: string;            // stable within a proposal
  status: HunkStatus;
  header: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  sectionHeading?: string;
  // We do not persist the full line array in the file when it is huge; for
  // v1 we keep it inline because each proposal is small and the UI needs it
  // to render the diff body.
  lines: Array<{
    kind: 'context' | 'add' | 'del' | 'no-newline';
    text: string;
    oldLine?: number;
    newLine?: number;
  }>;
}

export interface PatchFileRecord {
  id: string;
  filePath: string;
  oldPath?: string;
  action: FileAction;
  binary: boolean;
  status: HunkStatus;    // rollup: accepted iff all hunks accepted, rejected iff all rejected
  rawHeader: string;
  hunks: PatchHunkRecord[];
}

export interface PatchProposal {
  id: string;
  sessionId: string;
  runId?: string;
  workingDir: string;
  explanation: string;
  source: 'model-message' | 'diff-viewer' | 'manual';
  files: PatchFileRecord[];
  verificationCommands: string[];
  status: 'open' | 'applied' | 'discarded' | 'failed';
  sandbox?: PatchProposalSandbox;
  preview?: PatchProposalPreview;
  appliedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PatchProposalSandbox {
  worktreeId: string;
  path: string;
  root: string;
  status: 'ready' | 'promoted' | 'discarded' | 'failed';
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface PatchProposalPreview {
  url: string;
  screenshotPath: string;
  screenshotBase64?: string;
  title?: string;
  timestamp: string;
  errors: Array<{ type: 'error' | 'warning'; message: string; source?: string; line?: number }>;
}

function rollupStatus(hunks: PatchHunkRecord[]): HunkStatus {
  if (hunks.length === 0) return 'pending';
  if (hunks.every((h) => h.status === 'accepted')) return 'accepted';
  if (hunks.every((h) => h.status === 'rejected')) return 'rejected';
  return 'pending';
}

function parsedHunkToRecord(h: ParsedHunk): PatchHunkRecord {
  return {
    id: h.id,
    status: 'accepted',  // default: accept all hunks; user toggles later
    header: h.header,
    oldStart: h.oldStart,
    oldCount: h.oldCount,
    newStart: h.newStart,
    newCount: h.newCount,
    sectionHeading: h.sectionHeading,
    lines: h.lines.map((l) => ({
      kind: l.kind,
      text: l.text,
      oldLine: l.oldLine,
      newLine: l.newLine,
    })),
  };
}

function parsedFileToRecord(f: ParsedFile): PatchFileRecord {
  const record: PatchFileRecord = {
    id: f.id,
    filePath: f.filePath,
    oldPath: f.oldPath,
    action: f.action,
    binary: f.binary,
    status: 'accepted',
    rawHeader: f.rawHeader,
    hunks: f.hunks.map(parsedHunkToRecord),
  };
  record.status = rollupStatus(record.hunks);
  return record;
}

export interface CreateProposalInput {
  patch: string;
  workingDir: string;
  sessionId: string;
  runId?: string;
  explanation?: string;
  source?: PatchProposal['source'];
  verificationCommands?: string[];
}

export function createProposal(input: CreateProposalInput): PatchProposal {
  const parsed = parseUnifiedDiff(input.patch);
  const now = new Date().toISOString();
  const proposal: PatchProposal = {
    id: uuid(),
    sessionId: input.sessionId,
    runId: input.runId,
    workingDir: input.workingDir,
    explanation: input.explanation ?? '',
    source: input.source ?? 'manual',
    files: parsed.map(parsedFileToRecord),
    verificationCommands: input.verificationCommands ?? [],
    status: 'open',
    createdAt: now,
    updatedAt: now,
  };
  persist(proposal);
  return proposal;
}

function persist(p: PatchProposal): void {
  ensureDir();
  writeFileSync(proposalPath(p.id), JSON.stringify(p, null, 2), 'utf-8');
}

export function getProposal(id: string): PatchProposal | null {
  // Memory cache is not used in v1 to keep the module stateless across
  // hot-reloads; the disk file is the source of truth.
  const path = proposalPath(id);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as PatchProposal;
  } catch {
    return null;
  }
}

export function listProposals(opts: { sessionId?: string } = {}): PatchProposal[] {
  ensureDir();
  const out: PatchProposal[] = [];
  for (const f of readdirSync(PROPOSALS_DIR)) {
    if (!f.endsWith('.json')) continue;
    try {
      const p = JSON.parse(readFileSync(join(PROPOSALS_DIR, f), 'utf-8')) as PatchProposal;
      if (opts.sessionId && p.sessionId !== opts.sessionId) continue;
      out.push(p);
    } catch {
      // skip corrupt files
    }
  }
  out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return out;
}

export function setHunkStatus(
  id: string,
  fileId: string,
  hunkId: string,
  status: HunkStatus,
): PatchProposal | null {
  const p = getProposal(id);
  if (!p) return null;
  if (p.status !== 'open') return p;
  const file = p.files.find((f) => f.id === fileId);
  if (!file) return p;
  const hunk = file.hunks.find((h) => h.id === hunkId);
  if (!hunk) return p;
  hunk.status = status;
  file.status = rollupStatus(file.hunks);
  p.updatedAt = new Date().toISOString();
  persist(p);
  return p;
}

export function acceptAll(id: string): PatchProposal | null {
  return bulkSetStatus(id, 'accepted');
}

export function rejectAll(id: string): PatchProposal | null {
  return bulkSetStatus(id, 'rejected');
}

function bulkSetStatus(id: string, status: HunkStatus): PatchProposal | null {
  const p = getProposal(id);
  if (!p) return null;
  if (p.status !== 'open') return p;
  for (const f of p.files) {
    for (const h of f.hunks) h.status = status;
    f.status = rollupStatus(f.hunks);
  }
  p.updatedAt = new Date().toISOString();
  persist(p);
  return p;
}

export function discardProposal(id: string): PatchProposal | null {
  const p = getProposal(id);
  if (!p) return null;
  p.status = 'discarded';
  p.updatedAt = new Date().toISOString();
  persist(p);
  return p;
}

export function recordApplyResult(
  id: string,
  result: { status: 'applied' | 'failed' },
): PatchProposal | null {
  const p = getProposal(id);
  if (!p) return null;
  p.status = result.status;
  p.appliedAt = new Date().toISOString();
  p.updatedAt = p.appliedAt;
  persist(p);
  return p;
}

export function recordSandbox(
  id: string,
  sandbox: PatchProposalSandbox,
): PatchProposal | null {
  const p = getProposal(id);
  if (!p) return null;
  p.sandbox = sandbox;
  p.updatedAt = new Date().toISOString();
  persist(p);
  return p;
}

export function updateSandboxStatus(
  id: string,
  status: PatchProposalSandbox['status'],
  error?: string,
): PatchProposal | null {
  const p = getProposal(id);
  if (!p || !p.sandbox) return p;
  p.sandbox = {
    ...p.sandbox,
    status,
    updatedAt: new Date().toISOString(),
    error,
  };
  p.updatedAt = p.sandbox.updatedAt;
  persist(p);
  return p;
}

export function recordPreview(
  id: string,
  preview: PatchProposalPreview,
): PatchProposal | null {
  const p = getProposal(id);
  if (!p) return null;
  p.preview = preview;
  p.updatedAt = new Date().toISOString();
  persist(p);
  return p;
}

// Build a minimal unified-diff body containing only the hunks the user has
// accepted. The returned text is suitable for piping to `patch -p1`.
export function serializeAcceptedPatch(p: PatchProposal): string {
  const acceptedHunkIds = new Set<string>();
  for (const f of p.files) {
    for (const h of f.hunks) {
      if (h.status === 'accepted') acceptedHunkIds.add(h.id);
    }
  }
  // Re-hydrate the parsed file shape that serializeHunks expects.
  const rehydrated: ParsedFile[] = p.files.map((f) => ({
    id: f.id,
    filePath: f.filePath,
    oldPath: f.oldPath,
    action: f.action,
    binary: f.binary,
    rawHeader: f.rawHeader,
    hunks: f.hunks.map((h) => ({
      id: h.id,
      header: h.header,
      oldStart: h.oldStart,
      oldCount: h.oldCount,
      newStart: h.newStart,
      newCount: h.newCount,
      sectionHeading: h.sectionHeading,
      lines: h.lines.map((l) => ({ kind: l.kind, text: l.text, oldLine: l.oldLine, newLine: l.newLine })),
    })),
  }));
  return serializeHunks(rehydrated, acceptedHunkIds);
}

export function deleteProposal(id: string): boolean {
  const path = proposalPath(id);
  if (!existsSync(path)) return false;
  try {
    unlinkSync(path);
    return true;
  } catch {
    return false;
  }
}
