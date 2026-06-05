// server/commitMessage.ts
//
// Commit message generation and validation-gate helpers for patch
// proposals. The commit subject is derived from the proposal's first
// touched file plus the run-trace's role/model. The body summarizes the
// proposal's files, hunks, verification results, and any open review
// comments. We do not call a model here — generating a message in code
// keeps the experience deterministic and offline-friendly.
//
// The validation gate wraps an external command runner (benchRuns.runValidation)
// and refuses to mark a proposal "ready-to-commit" until every configured
// verification command passes. The user can override the gate with
// `force: true` on the commit endpoint, which is surfaced in the UI.
import { existsSync, writeFileSync, unlinkSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, relative } from 'path';
import type { PatchProposal } from './patchProposals';
import { listComments } from './reviewComments';
import type { ValidationCommandResult as PatchValidationResult } from "./benchRuns";

export interface CommitMessageOptions {
  /** Optional one-line human hint that overrides the auto-derived subject. */
  subjectOverride?: string;
  /** Optional run trace summary. When present, gets folded into the body. */
  runSummary?: {
    role?: string;
    model?: string;
    runId?: string;
    startedAt?: string;
    completedAt?: string;
  };
  /** Verification results from a prior apply or manual run. */
  validation?: PatchValidationResult[];
}

export interface CommitMessage {
  subject: string;
  body: string;
  fullText: string;
}

function safeRelative(workingDir: string, filePath: string): string {
  if (filePath.startsWith('/') || filePath.startsWith('\\')) return filePath;
  const rel = relative(workingDir, join(workingDir, filePath));
  return rel || filePath;
}

function detectScope(proposal: PatchProposal): string {
  // Pick the most common top-level directory among the touched files.
  if (proposal.files.length === 0) return 'misc';
  const counts = new Map<string, number>();
  for (const f of proposal.files) {
    const first = f.filePath.split('/').filter(Boolean)[0] || 'misc';
    counts.set(first, (counts.get(first) ?? 0) + 1);
  }
  let best = 'misc';
  let bestN = 0;
  for (const [k, v] of counts.entries()) {
    if (v > bestN) { bestN = v; best = k; }
  }
  return best;
}

function shortHunkSummary(proposal: PatchProposal): string {
  const adds = proposal.files.reduce(
    (sum, f) => sum + f.hunks.reduce((s, h) => s + h.lines.filter((l) => l.kind === 'add').length, 0),
    0,
  );
  const dels = proposal.files.reduce(
    (sum, f) => sum + f.hunks.reduce((s, h) => s + h.lines.filter((l) => l.kind === 'del').length, 0),
    0,
  );
  return `+${adds}/-${dels}`;
}

export function generateCommitMessage(
  proposal: PatchProposal,
  options: CommitMessageOptions = {},
): CommitMessage {
  const verbMap: Record<string, string> = {
    create: 'add',
    update: 'update',
    delete: 'remove',
    rename: 'rename',
  };
  const fileCount = proposal.files.length;
  const summaryParts: string[] = [];
  for (const f of proposal.files) {
    const verb = verbMap[f.action] || f.action;
    summaryParts.push(`${verb} ${f.filePath}`);
  }
  const scope = detectScope(proposal);
  const counts = shortHunkSummary(proposal);

  const subjectDefault = fileCount === 0
    ? 'chore: empty patch proposal'
    : `patch (${scope}): ${fileCount} file${fileCount === 1 ? '' : 's'} (${counts})`;
  const subject = (options.subjectOverride?.trim() || subjectDefault).slice(0, 100);

  const lines: string[] = [];
  lines.push(subject);
  lines.push('');
  if (proposal.explanation) {
    lines.push(proposal.explanation.trim());
    lines.push('');
  }
  lines.push(`Files (${fileCount}):`);
  for (const f of proposal.files) {
    const rel = safeRelative(proposal.workingDir, f.filePath);
    lines.push(`- ${f.action} ${rel}`);
  }
  lines.push('');

  if (options.runSummary) {
    const rs = options.runSummary;
    const parts: string[] = [];
    if (rs.role) parts.push(`role=${rs.role}`);
    if (rs.model) parts.push(`model=${rs.model}`);
    if (rs.runId) parts.push(`run=${rs.runId.slice(0, 8)}`);
    if (parts.length) {
      lines.push(`Run trace: ${parts.join(' ')}`);
      lines.push('');
    }
  }

  if (options.validation && options.validation.length) {
    lines.push(`Validation (${options.validation.length}):`);
    for (const v of options.validation) {
      const mark = v.passed ? 'OK' : 'FAIL';
      lines.push(`- [${mark}] ${v.command} (exit ${v.exitCode}, ${v.durationMs}ms)`);
    }
    lines.push('');
  }

  const openComments = listComments(proposal.id).filter((c) => c.status === 'open');
  if (openComments.length > 0) {
    lines.push(`Open review comments (${openComments.length}):`);
    for (const c of openComments) {
      lines.push(`- [${c.severity}] ${c.filePath}:${c.startLine}${c.endLine ? `-${c.endLine}` : ''} — ${c.rationale}`);
    }
    lines.push('');
  }

  const body = lines.slice(2).join('\n').trimEnd();
  return {
    subject,
    body,
    fullText: lines.join('\n').trimEnd() + '\n',
  };
}

export interface ValidationGateResult {
  ok: boolean;
  /** True when the gate was bypassed by `force: true`. */
  bypassed: boolean;
  results: PatchValidationResult[];
  blockers: number;
}

export interface ValidationGateOptions {
  workingDir: string;
  commands: string[];
  force?: boolean;
  /**
   * Injectable command runner for tests. When omitted we shell out to
   * `benchRuns.runValidation` via dynamic import to keep the module
   * dependency surface small.
   */
  runCommands?: (commands: string[], workingDir: string) => Promise<PatchValidationResult[]>;
}

export async function runValidationGate(opts: ValidationGateOptions): Promise<ValidationGateResult> {
  const cmds = opts.commands.filter((c) => typeof c === 'string' && c.trim().length > 0);
  if (cmds.length === 0) {
    return { ok: true, bypassed: false, results: [], blockers: 0 };
  }
  if (opts.force) {
    return { ok: true, bypassed: true, results: [], blockers: 0 };
  }
  const runner = opts.runCommands;
  let results: PatchValidationResult[];
  if (runner) {
    results = await runner(cmds, opts.workingDir);
  } else {
    // Lazy import to avoid a circular dep with benchRuns.
    const benchRuns = await import('./benchRuns');
    results = await benchRuns.runValidation(cmds, opts.workingDir);
  }
  const ok = results.length > 0 && results.every((r) => r.passed);
  return { ok, bypassed: false, results, blockers: results.filter((r) => !r.passed).length };
}

/**
 * Create a branch off the current HEAD and return the branch name.
 * This is a thin wrapper around `git checkout -b`; failures are
 * surfaced verbatim so the caller can render a useful error.
 */
export function createBranch(workingDir: string, name: string): { ok: boolean; branch?: string; error?: string } {
  try {
    if (!/^[a-zA-Z0-9._/-]+$/.test(name)) {
      return { ok: false, error: 'Branch name contains invalid characters' };
    }
    execFileSync('git', ['checkout', '-b', name], { cwd: workingDir, encoding: 'utf-8', timeout: 10000 });
    return { ok: true, branch: name };
  } catch (err: any) {
    return { ok: false, error: err?.message?.split('\n')?.[0] || 'git checkout -b failed' };
  }
}

/**
 * Stage a list of files (or '.' for everything) and commit with the
 * given message. Returns the commit hash when successful.
 */
export function gitCommit(workingDir: string, message: string, files: string[]): { ok: boolean; hash?: string; error?: string } {
  try {
    const addTargets = files.length > 0 ? files : ['.'];
    execFileSync('git', ['add', '--', ...addTargets], { cwd: workingDir, encoding: 'utf-8', timeout: 10000 });
    const tmpFile = join(workingDir, '.git', 'OPENHARNESS_COMMIT_EDITMSG');
    if (!existsSync(join(workingDir, '.git'))) {
      return { ok: false, error: 'Working directory is not a git repository' };
    }
    writeFileSync(tmpFile, message, 'utf-8');
    execFileSync('git', ['commit', '-F', tmpFile], { cwd: workingDir, encoding: 'utf-8', timeout: 15000 });
    try { unlinkSync(tmpFile); } catch { /* ignore */ }
    const hash = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workingDir, encoding: 'utf-8' }).trim();
    return { ok: true, hash };
  } catch (err: any) {
    return { ok: false, error: err?.message?.split('\n')?.[0] || 'git commit failed' };
  }
}

/** Cheap working-tree lookup of HEAD SHA. */
export function getHeadSha(workingDir: string): string | null {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workingDir, encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}
