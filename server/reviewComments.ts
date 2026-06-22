// server/reviewComments.ts
//
// Review comments attached to specific files/lines in a patch proposal.
// Comments are scoped to a proposal and survive across sessions because
// the proposal itself persists under ~/.openharness/patch-proposals.
// We store comments inline on the proposal record so the existing
// `getProposal` / `getProposalList` calls return them without a second
// disk read.
//
// Each comment has:
//   - severity: blocker | warning | nit | suggestion
//   - file / startLine / endLine: the anchor in the proposal
//   - rationale: why the reviewer raised it
//   - suggestedFix: optional proposed patch snippet
//   - resolved / resolvedAt: completion state
//
// All mutations go through this module so the on-disk JSON is the single
// source of truth. Concurrency is bounded by the server's single-process
// model: we read, mutate, and write back synchronously.
import { getProposal } from './patchProposals';
import type { PatchProposal } from './patchProposals';

export type ReviewCommentSeverity = 'blocker' | 'warning' | 'nit' | 'suggestion';
export type ReviewCommentStatus = 'open' | 'resolved';

export interface ReviewComment {
  id: string;
  filePath: string;
  /** 1-based line number; the hunk's newStart is the canonical anchor. */
  startLine: number;
  endLine?: number;
  severity: ReviewCommentSeverity;
  status: ReviewCommentStatus;
  author: string;
  rationale: string;
  suggestedFix?: string;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

interface CommentStore {
  comments: ReviewComment[];
}

function readStore(p: PatchProposal): CommentStore {
  // We piggy-back on the proposal file but keep the comment list
  // separate so we never accidentally strip comments during a status
  // flip. The shape is forward-compatible: future fields can land in
  // `CommentStore` without touching PatchProposal.
  const anyP = p as PatchProposal & { review?: CommentStore };
  return anyP.review ?? { comments: [] };
}

function writeStore(p: PatchProposal, store: CommentStore): PatchProposal {
  const anyP = p as PatchProposal & { review?: CommentStore };
  anyP.review = store;
  anyP.updatedAt = new Date().toISOString();
  // The proposal module exposes a persist path indirectly through
  // its mutator functions. We import the write helper to keep the
  // on-disk shape consistent.
  persistProposal(anyP);
  return anyP;
}

// Defer to patchProposals' persistence layer.
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { v4 as uuid } from 'uuid';
import { safeJsonStorePath } from './jsonStorePaths';

const PROPOSALS_DIR = join(homedir(), '.openharness', 'patch-proposals');
function ensureDir(): void {
  if (!existsSync(PROPOSALS_DIR)) mkdirSync(PROPOSALS_DIR, { recursive: true });
}
function proposalPath(id: string): string {
  const path = safeJsonStorePath(PROPOSALS_DIR, id);
  if (!path) throw new Error('Invalid patch proposal id');
  return path;
}
function persistProposal(p: PatchProposal): void {
  ensureDir();
  writeFileSync(proposalPath(p.id), JSON.stringify(p, null, 2), 'utf-8');
}

export interface CreateCommentInput {
  proposalId: string;
  filePath: string;
  startLine: number;
  endLine?: number;
  severity: ReviewCommentSeverity;
  rationale: string;
  suggestedFix?: string;
  author?: string;
}

export function addComment(input: CreateCommentInput): ReviewComment | null {
  const proposal = getProposal(input.proposalId);
  if (!proposal) return null;
  const store = readStore(proposal);
  const comment: ReviewComment = {
    id: uuid(),
    filePath: input.filePath,
    startLine: input.startLine,
    endLine: input.endLine,
    severity: input.severity,
    status: 'open',
    author: input.author || 'reviewer',
    rationale: input.rationale,
    suggestedFix: input.suggestedFix,
    createdAt: new Date().toISOString(),
  };
  store.comments.push(comment);
  writeStore(proposal, store);
  return comment;
}

export function updateComment(
  proposalId: string,
  commentId: string,
  patch: Partial<Pick<ReviewComment, 'severity' | 'rationale' | 'suggestedFix' | 'status'>>,
  resolvedBy?: string,
): ReviewComment | null {
  const proposal = getProposal(proposalId);
  if (!proposal) return null;
  const store = readStore(proposal);
  const c = store.comments.find((x) => x.id === commentId);
  if (!c) return null;
  if (patch.severity) c.severity = patch.severity;
  if (patch.rationale) c.rationale = patch.rationale;
  if (patch.suggestedFix !== undefined) c.suggestedFix = patch.suggestedFix;
  if (patch.status) {
    c.status = patch.status;
    if (patch.status === 'resolved') {
      c.resolvedAt = new Date().toISOString();
      c.resolvedBy = resolvedBy;
    } else {
      c.resolvedAt = undefined;
      c.resolvedBy = undefined;
    }
  }
  writeStore(proposal, store);
  return c;
}

export function deleteComment(proposalId: string, commentId: string): boolean {
  const proposal = getProposal(proposalId);
  if (!proposal) return false;
  const store = readStore(proposal);
  const before = store.comments.length;
  store.comments = store.comments.filter((x) => x.id !== commentId);
  if (store.comments.length === before) return false;
  writeStore(proposal, store);
  return true;
}

export function listComments(proposalId: string): ReviewComment[] {
  const proposal = getProposal(proposalId);
  if (!proposal) return [];
  return readStore(proposal).comments;
}

export function countOpenBlockers(proposalId: string): number {
  return listComments(proposalId).filter((c) => c.status === 'open' && c.severity === 'blocker').length;
}
