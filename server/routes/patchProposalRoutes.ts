import express from 'express';
import { join } from 'path';

import * as benchRuns from '../benchRuns';
import { capturePreview, checkServerHealth } from '../browserPreview';
import * as commitMessage from '../commitMessage';
import { applyPatch as nodeApplyPatch } from '../patchApply';
import { parseUnifiedDiff } from '../patchParse';
import {
  acceptAll as acceptAllHunks,
  createProposal,
  discardProposal,
  getProposal,
  listProposals,
  recordApplyResult,
  recordPreview,
  recordSandbox,
  rejectAll as rejectAllHunks,
  serializeAcceptedPatch,
  setHunkStatus,
  updateSandboxStatus,
  type PatchProposal,
} from '../patchProposals';
import type { ProjectProfile } from '../projectProfile';
import * as reviewComments from '../reviewComments';
import type { ApprovalAction } from '../actionApprovals';
import { isPathAllowed, type TrustMode } from '../toolPolicy';
import * as worktrees from '../worktrees';

type ApprovalCheckResult = { ok: true } | { ok: false; status: number; error: string; approval?: unknown };

interface PatchProposalRouteDeps {
  getTrustMode: () => TrustMode;
  ensureLocalMutationWithControl: (req: express.Request) => { ok: true } | { ok: false; status: number; error: string };
  ensureWorkspaceMutationAllowed: (req: express.Request, dir: string) => { ok: true; dir: string } | { ok: false; status: number; error: string };
  ensureAskBeforeWriteApproval: (req: express.Request, action: ApprovalAction) => ApprovalCheckResult;
  getProjectProfile: (dir: string) => ProjectProfile;
  scopeCheckOrThrow: (workingDir: string) => void;
}

const DEV_PREVIEW_PORTS = [5173, 3000, 4173, 8787, 8080, 4321];

function rejectForMissingApproval(res: express.Response, check: ApprovalCheckResult): boolean {
  if (check.ok) return false;
  res.status(check.status).json({ error: check.error, approval: check.approval });
  return true;
}

function detectDevPreviewUrl(): string | null {
  for (const port of DEV_PREVIEW_PORTS) {
    const url = `http://localhost:${port}`;
    try {
      if (checkServerHealth(url).reachable) return url;
    } catch {
      // Keep probing the common dev-server ports.
    }
  }
  return null;
}

async function captureDetectedPreview() {
  const url = detectDevPreviewUrl();
  if (!url) return null;
  return capturePreview(url);
}

export function registerPatchProposalRoutes(app: express.Express, deps: PatchProposalRouteDeps) {
  app.post('/api/patch-proposals', (req, res) => {
    const body = req.body as {
      patch?: string;
      workingDir?: string;
      sessionId?: string;
      runId?: string;
      explanation?: string;
      source?: PatchProposal['source'];
      verificationCommands?: string[];
    };
    const { patch, workingDir, sessionId } = body;
    if (!patch?.trim()) return res.status(400).json({ error: 'patch is required' });
    if (!workingDir?.trim()) return res.status(400).json({ error: 'workingDir is required' });
    if (!sessionId?.trim()) return res.status(400).json({ error: 'sessionId is required' });
    const workspace = deps.ensureWorkspaceMutationAllowed(req, workingDir);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    try {
      deps.scopeCheckOrThrow(workspace.dir);
    } catch (err: any) {
      return res.status(err.statusCode || 400).json({ error: err.message });
    }
    let verificationCommands = body.verificationCommands;
    if (!verificationCommands || verificationCommands.length === 0) {
      try {
        const profile = deps.getProjectProfile(workspace.dir);
        const defaults: string[] = [];
        if (profile.validation.lint) defaults.push(profile.validation.lint);
        if (profile.validation.typecheck) defaults.push(profile.validation.typecheck);
        if (defaults.length > 0) verificationCommands = defaults;
      } catch {
        // Profile detection is best-effort.
      }
    }

    try {
      const proposal = createProposal({
        patch,
        workingDir: workspace.dir,
        sessionId,
        runId: body.runId,
        explanation: body.explanation,
        source: body.source,
        verificationCommands,
      });
      res.json({ id: proposal.id, proposal });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to create proposal' });
    }
  });

  app.get('/api/patch-proposals', (req, res) => {
    const sessionId = req.query.sessionId as string | undefined;
    res.json({ proposals: listProposals({ sessionId }) });
  });

  app.get('/api/patch-proposals/:id', (req, res) => {
    const proposal = getProposal(req.params.id);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    res.json(proposal);
  });

  function setHunkFromBody(req: express.Request, res: express.Response, status: 'accepted' | 'rejected') {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const hunkId = (req.body as { hunkId?: string }).hunkId;
    if (!hunkId || typeof hunkId !== 'string') {
      return res.status(400).json({ error: 'hunkId is required in body' });
    }
    const proposal = setHunkStatus(String(req.params.id), String(req.params.fileId), hunkId, status);
    if (!proposal) return res.status(404).json({ error: 'Proposal, file, or hunk not found' });
    return res.json(proposal);
  }

  app.post('/api/patch-proposals/:id/hunks/:fileId/accept', (req, res) => {
    return setHunkFromBody(req, res, 'accepted');
  });

  app.post('/api/patch-proposals/:id/hunks/:fileId/reject', (req, res) => {
    return setHunkFromBody(req, res, 'rejected');
  });

  app.post('/api/patch-proposals/:id/accept-all', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const proposal = acceptAllHunks(req.params.id);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    res.json(proposal);
  });

  app.post('/api/patch-proposals/:id/reject-all', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const proposal = rejectAllHunks(req.params.id);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    res.json(proposal);
  });

  app.post('/api/patch-proposals/:id/isolate', (req, res) => {
    const proposal = getProposal(req.params.id);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    if (proposal.status !== 'open') {
      return res.status(409).json({ error: `Proposal is ${proposal.status}` });
    }
    if (proposal.sandbox?.status === 'ready') {
      return res.json({ proposal, sandbox: proposal.sandbox, appliedFiles: [], errors: [] });
    }
    const workspace = deps.ensureWorkspaceMutationAllowed(req, proposal.workingDir);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });

    const trustMode = deps.getTrustMode();
    if (trustMode === 'read-only' || trustMode === 'chat-only') {
      return res.status(400).json({ error: `Write operations not allowed in ${trustMode} mode` });
    }

    const acceptedPatch = serializeAcceptedPatch(proposal);
    if (acceptedPatch.trim().length === 0) {
      return res.status(400).json({ error: 'No hunks accepted; nothing to isolate' });
    }

    let acceptedParsed: ReturnType<typeof parseUnifiedDiff>;
    try {
      acceptedParsed = parseUnifiedDiff(acceptedPatch);
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || 'Patch parse failed' });
    }
    for (const file of acceptedParsed) {
      const candidate = join(proposal.workingDir, file.filePath);
      const check = isPathAllowed(candidate, trustMode, proposal.workingDir);
      if (!check.allowed) return res.status(400).json({ error: check.reason || 'Path refused' });
    }
    const approval = deps.ensureAskBeforeWriteApproval(req, {
      kind: 'write',
      route: `/api/patch-proposals/${proposal.id}/isolate`,
      description: 'Apply accepted patch hunks to isolated worktree',
      cwd: proposal.workingDir,
      paths: acceptedParsed.map((file) => file.filePath),
    });
    if (rejectForMissingApproval(res, approval)) return;

    let wt: worktrees.Worktree | null = null;
    try {
      wt = worktrees.createWorktree(proposal.workingDir, {
        label: `Patch ${proposal.id.slice(0, 8)}`,
      });
      const result = nodeApplyPatch(acceptedPatch, wt.path);
      const sandbox = {
        worktreeId: wt.id,
        path: wt.path,
        root: wt.root,
        status: result.errors.length === 0 ? 'ready' as const : 'failed' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        error: result.errors[0],
      };
      const updated = recordSandbox(proposal.id, sandbox);
      if (result.errors.length > 0) {
        worktrees.removeWorktree(proposal.workingDir, wt.id, { force: true });
        return res.status(400).json({ proposal: updated, sandbox, appliedFiles: result.files, errors: result.errors });
      }
      res.json({ proposal: updated, sandbox, appliedFiles: result.files, errors: [] });
    } catch (err: any) {
      if (wt) {
        try { worktrees.removeWorktree(proposal.workingDir, wt.id, { force: true }); } catch { /* ignore */ }
      }
      res.status(400).json({ error: err?.message || 'Failed to isolate proposal' });
    }
  });

  app.post('/api/patch-proposals/:id/discard', (req, res) => {
    const proposal = getProposal(req.params.id);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    const workspace = deps.ensureWorkspaceMutationAllowed(req, proposal.workingDir);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    if (proposal.sandbox?.worktreeId && proposal.sandbox.status === 'ready') {
      try {
        worktrees.removeWorktree(proposal.workingDir, proposal.sandbox.worktreeId, { force: true });
        updateSandboxStatus(proposal.id, 'discarded');
      } catch (err: any) {
        updateSandboxStatus(proposal.id, 'failed', err?.message || 'Failed to discard worktree');
      }
    }
    const updated = discardProposal(req.params.id);
    if (!updated) return res.status(404).json({ error: 'Proposal not found' });
    res.json(updated);
  });

  app.post('/api/patch-proposals/:id/apply', async (req, res) => {
    const proposal = getProposal(req.params.id);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    if (proposal.status !== 'open') {
      return res.status(409).json({ error: `Proposal is ${proposal.status}` });
    }
    const workspace = deps.ensureWorkspaceMutationAllowed(req, proposal.workingDir);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    const trustMode = deps.getTrustMode();

    if (trustMode === 'read-only' || trustMode === 'chat-only') {
      recordApplyResult(proposal.id, { status: 'failed' });
      return res.status(400).json({ error: `Write operations not allowed in ${trustMode} mode` });
    }

    const acceptedPatch = serializeAcceptedPatch(proposal);
    let acceptedParsed: ReturnType<typeof parseUnifiedDiff>;
    try {
      acceptedParsed = parseUnifiedDiff(acceptedPatch);
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || 'Patch parse failed' });
    }
    for (const file of acceptedParsed) {
      const candidate = join(proposal.workingDir, file.filePath);
      const check = isPathAllowed(candidate, trustMode, proposal.workingDir);
      if (!check.allowed) {
        recordApplyResult(proposal.id, { status: 'failed' });
        return res.status(400).json({ error: check.reason || 'Path refused' });
      }
    }
    const approval = deps.ensureAskBeforeWriteApproval(req, {
      kind: 'write',
      route: `/api/patch-proposals/${proposal.id}/apply`,
      description: 'Apply accepted patch hunks to workspace',
      cwd: proposal.workingDir,
      paths: acceptedParsed.map((file) => file.filePath),
    });
    if (rejectForMissingApproval(res, approval)) return;

    if (acceptedPatch.trim().length === 0) {
      recordApplyResult(proposal.id, { status: 'failed' });
      return res.status(400).json({ error: 'No hunks accepted; nothing to apply' });
    }
    if (acceptedParsed.length === 0) {
      recordApplyResult(proposal.id, { status: 'failed' });
      return res.status(400).json({ error: 'No files parsed from accepted hunks' });
    }

    const result = nodeApplyPatch(acceptedPatch, proposal.workingDir);
    const appliedFiles = result.files;
    const proposedFilePaths = new Set(acceptedParsed.map((file) => file.filePath));
    const skippedFiles = Array.from(proposedFilePaths).filter((file) => !appliedFiles.includes(file));
    const allGood = result.errors.length === 0;

    let validation: benchRuns.ValidationCommandResult[] = [];
    let validationPassed = true;
    if (allGood) {
      const commands = (proposal.verificationCommands ?? []).filter((command) => typeof command === 'string' && command.trim().length > 0);
      if (commands.length > 0) {
        try {
          validation = await benchRuns.runValidation(commands, proposal.workingDir);
          validationPassed = validation.length > 0 && validation.every((value) => value.passed);
        } catch (err: any) {
          validation = [{
            command: '<runValidation>',
            exitCode: 1,
            stdout: '',
            stderr: err?.message || 'Validation runner crashed',
            findings: [err?.message || 'Validation runner crashed'],
            durationMs: 0,
            passed: false,
          }];
          validationPassed = false;
        }
      }
    }

    if (allGood) {
      recordApplyResult(proposal.id, { status: 'applied' });
      if (proposal.sandbox?.worktreeId && proposal.sandbox.status === 'ready') {
        try {
          worktrees.removeWorktree(proposal.workingDir, proposal.sandbox.worktreeId, { force: true });
          updateSandboxStatus(proposal.id, 'promoted');
        } catch (err: any) {
          updateSandboxStatus(proposal.id, 'failed', err?.message || 'Failed to clean up worktree');
        }
      }
    } else {
      recordApplyResult(proposal.id, { status: 'failed' });
    }

    let preview = null;
    if (allGood) {
      try {
        preview = await captureDetectedPreview();
        if (preview) recordPreview(proposal.id, preview);
      } catch {
        preview = null;
      }
    }

    res.json({
      proposalId: proposal.id,
      appliedFiles,
      skippedFiles,
      errors: result.errors,
      validation,
      validationPassed,
      preview,
    });
  });

  app.get('/api/patch-proposals/:id/comments', (req, res) => {
    const proposal = getProposal(req.params.id);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    res.json(reviewComments.listComments(req.params.id));
  });

  app.post('/api/patch-proposals/:id/comments', (req, res) => {
    const body = req.body as Partial<reviewComments.CreateCommentInput>;
    if (!body.filePath || typeof body.startLine !== 'number') {
      return res.status(400).json({ error: 'filePath and startLine are required' });
    }
    if (!body.rationale || !body.severity) {
      return res.status(400).json({ error: 'severity and rationale are required' });
    }
    const validSeverities: reviewComments.ReviewCommentSeverity[] = ['blocker', 'warning', 'nit', 'suggestion'];
    if (!validSeverities.includes(body.severity)) {
      return res.status(400).json({ error: 'invalid severity' });
    }
    const comment = reviewComments.addComment({
      proposalId: req.params.id,
      filePath: body.filePath,
      startLine: body.startLine,
      endLine: body.endLine,
      severity: body.severity,
      rationale: body.rationale,
      suggestedFix: body.suggestedFix,
      author: body.author,
    });
    if (!comment) return res.status(404).json({ error: 'Proposal not found' });
    res.json(comment);
  });

  app.patch('/api/patch-proposals/:id/comments/:commentId', (req, res) => {
    const body = req.body as Partial<reviewComments.ReviewComment>;
    const validSeverities: reviewComments.ReviewCommentSeverity[] = ['blocker', 'warning', 'nit', 'suggestion'];
    const validStatuses: reviewComments.ReviewCommentStatus[] = ['open', 'resolved'];
    const patch: Partial<reviewComments.ReviewComment> = {};
    if (body.severity) {
      if (!validSeverities.includes(body.severity)) {
        return res.status(400).json({ error: 'invalid severity' });
      }
      patch.severity = body.severity;
    }
    if (body.rationale) patch.rationale = body.rationale;
    if (body.suggestedFix !== undefined) patch.suggestedFix = body.suggestedFix;
    if (body.status) {
      if (!validStatuses.includes(body.status)) {
        return res.status(400).json({ error: 'invalid status' });
      }
      patch.status = body.status;
    }
    const comment = reviewComments.updateComment(req.params.id, req.params.commentId, patch, body.resolvedBy);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    res.json(comment);
  });

  app.delete('/api/patch-proposals/:id/comments/:commentId', (req, res) => {
    const ok = reviewComments.deleteComment(req.params.id, req.params.commentId);
    if (!ok) return res.status(404).json({ error: 'Comment not found' });
    res.json({ ok: true });
  });

  app.post('/api/patch-proposals/:id/commit-message', (req, res) => {
    const proposal = getProposal(req.params.id);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    const body = (req.body || {}) as {
      subjectOverride?: string;
      runSummary?: commitMessage.CommitMessageOptions['runSummary'];
      validation?: commitMessage.CommitMessageOptions['validation'];
    };
    res.json(commitMessage.generateCommitMessage(proposal, body));
  });

  app.post('/api/patch-proposals/:id/validate', async (req, res) => {
    const proposal = getProposal(req.params.id);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    const workspace = deps.ensureWorkspaceMutationAllowed(req, proposal.workingDir);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    const body = (req.body || {}) as { force?: boolean };
    try {
      const result = await commitMessage.runValidationGate({
        workingDir: workspace.dir,
        commands: proposal.verificationCommands ?? [],
        force: body.force,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Validation gate failed' });
    }
  });

  app.post('/api/patch-proposals/:id/commit', async (req, res) => {
    const proposal = getProposal(req.params.id);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    const workspace = deps.ensureWorkspaceMutationAllowed(req, proposal.workingDir);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    const body = (req.body || {}) as { subjectOverride?: string; branchName?: string; force?: boolean };
    const gate = await commitMessage.runValidationGate({
      workingDir: workspace.dir,
      commands: proposal.verificationCommands ?? [],
      force: body.force,
    });
    if (!gate.ok) {
      return res.status(409).json({ error: 'Validation gate failed', gate, blockedBy: gate.blockers });
    }
    if (body.branchName && body.branchName.trim()) {
      const branch = commitMessage.createBranch(workspace.dir, body.branchName.trim());
      if (!branch.ok) {
        return res.status(400).json({ error: branch.error || 'Branch creation failed' });
      }
    }
    const filePaths = proposal.files.map((file) => file.filePath);
    const message = commitMessage.generateCommitMessage(proposal, { subjectOverride: body.subjectOverride });
    const result = commitMessage.gitCommit(workspace.dir, message.fullText, filePaths);
    if (!result.ok) {
      return res.status(400).json({ error: result.error || 'Commit failed' });
    }
    res.json({ ok: true, hash: result.hash, subject: message.subject, bypassed: gate.bypassed });
  });

  app.post('/api/patch-proposals/:id/preview', async (req, res) => {
    const proposal = getProposal(req.params.id);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    try {
      const preview = await captureDetectedPreview();
      if (preview) {
        recordPreview(proposal.id, preview);
        res.json({ ok: true, preview });
      } else {
        res.json({ ok: false, error: 'No local dev server detected on common ports' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Preview failed' });
    }
  });
}
