import { createHash, randomUUID } from 'crypto';
import { redactSecrets } from './sectionRedaction';

export type ApprovalActionKind = 'command' | 'write' | 'read';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'consumed' | 'expired';

export interface ApprovalAction {
  kind: ApprovalActionKind;
  route: string;
  description: string;
  cwd?: string;
  command?: string;
  paths?: string[];
  metadata?: Record<string, unknown>;
}

export interface ApprovalTransaction {
  id: string;
  status: ApprovalStatus;
  action: ApprovalAction;
  fingerprint: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

const TTL_MS = 10 * 60 * 1000;
const approvals = new Map<string, ApprovalTransaction>();

export function createApprovalTransaction(action: ApprovalAction): ApprovalTransaction {
  expireOldApprovals();
  const fingerprint = actionFingerprint(action);
  const existing = Array.from(approvals.values()).find((approval) => (
    approval.status === 'pending' && approval.fingerprint === fingerprint
  ));
  if (existing) return existing;
  const now = new Date();
  const transaction: ApprovalTransaction = {
    id: randomUUID(),
    status: 'pending',
    action: sanitizeAction(action),
    fingerprint,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + TTL_MS).toISOString(),
  };
  approvals.set(transaction.id, transaction);
  return transaction;
}

export function approveApprovalTransaction(id: string): ApprovalTransaction | null {
  return updateApprovalStatus(id, 'approved');
}

export function rejectApprovalTransaction(id: string): ApprovalTransaction | null {
  return updateApprovalStatus(id, 'rejected');
}

export function listApprovalTransactions(): ApprovalTransaction[] {
  expireOldApprovals();
  return Array.from(approvals.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function consumeApprovedApprovalTransaction(id: string | undefined, action: ApprovalAction): { ok: true; approval: ApprovalTransaction } | { ok: false; reason: string } {
  expireOldApprovals();
  if (!id) return { ok: false, reason: 'approvalId is required' };
  const approval = approvals.get(id);
  if (!approval) return { ok: false, reason: 'Approval transaction not found' };
  if (approval.status !== 'approved') return { ok: false, reason: `Approval transaction is ${approval.status}` };
  if (approval.fingerprint !== actionFingerprint(action)) {
    return { ok: false, reason: 'Approval transaction does not match this action' };
  }
  const now = new Date().toISOString();
  approval.status = 'consumed';
  approval.updatedAt = now;
  return { ok: true, approval };
}

export function clearApprovalTransactionsForTests(): void {
  approvals.clear();
}

function updateApprovalStatus(id: string, status: 'approved' | 'rejected'): ApprovalTransaction | null {
  expireOldApprovals();
  const approval = approvals.get(id);
  if (!approval || approval.status !== 'pending') return null;
  approval.status = status;
  approval.updatedAt = new Date().toISOString();
  return approval;
}

function expireOldApprovals(): void {
  const now = Date.now();
  for (const approval of approvals.values()) {
    if ((approval.status === 'pending' || approval.status === 'approved') && Date.parse(approval.expiresAt) <= now) {
      approval.status = 'expired';
      approval.updatedAt = new Date().toISOString();
    }
  }
}

function actionFingerprint(action: ApprovalAction): string {
  return createHash('sha256').update(JSON.stringify(canonicalAction(action))).digest('hex');
}

function sanitizeAction(action: ApprovalAction): ApprovalAction {
  const redacted = redactSecrets(JSON.stringify(canonicalAction(action))).redacted;
  return JSON.parse(redacted) as ApprovalAction;
}

function canonicalAction(action: ApprovalAction): ApprovalAction {
  return {
    kind: action.kind,
    route: action.route,
    description: action.description,
    cwd: action.cwd || undefined,
    command: action.command || undefined,
    paths: Array.isArray(action.paths) ? [...action.paths].sort() : undefined,
    metadata: action.metadata || undefined,
  };
}
