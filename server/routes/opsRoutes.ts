import type express from 'express';
import { existsSync } from 'fs';
import type { ApprovalAction } from '../actionApprovals';
import * as benchRuns from '../benchRuns';
import * as checkpoints from '../checkpoints';
import type { ProjectProfile } from '../projectProfile';
import * as processLedger from '../processLedger';
import * as protectedPaths from '../protectedPaths';
import {
  objectSchema,
  optionalBoolean,
  optionalEnum,
  optionalNumber,
  optionalString,
  optionalStringArray,
  parseBody,
  requiredString,
  requiredStringArray,
} from '../requestSchemas';
import { sendRouteError } from '../routeSupport';
import { checkCommandPolicy, type TrustMode } from '../toolPolicy';
import * as worktrees from '../worktrees';

type ControlResult = { ok: true } | { ok: false; status: number; error: string };
type WorkspaceResult = { ok: true; dir: string } | { ok: false; status: number; error: string };
type ApprovalCheckResult = ControlResult & { approval?: unknown };

interface OpsRouteDeps {
  getTrustMode: () => TrustMode;
  ensureLocalControl: (req: express.Request) => ControlResult;
  ensureLocalMutationWithControl: (req: express.Request) => ControlResult;
  ensureWorkspaceReadAllowed: (dir: string) => WorkspaceResult;
  ensureWorkspaceMutationAllowed: (req: express.Request, dir: string) => WorkspaceResult;
  ensureAskBeforeWriteApproval: (req: express.Request, action: ApprovalAction) => ApprovalCheckResult;
  getProjectProfile: (dir: string) => ProjectProfile;
  isPathWithin: (candidate: string, root: string) => boolean;
}

const WORKSPACE_DIR_MAX = 4096;

const checkpointCreateSchema = objectSchema({
  dir: requiredString({ max: WORKSPACE_DIR_MAX }),
  label: optionalString({ max: 200 }),
});

const checkpointRestoreSchema = objectSchema({
  dir: requiredString({ max: WORKSPACE_DIR_MAX }),
  mode: optionalEnum(['reset', 'apply'] as const),
});

const worktreeCreateSchema = objectSchema({
  dir: requiredString({ max: WORKSPACE_DIR_MAX }),
  label: optionalString({ max: 200 }),
  baseBranch: optionalString({ max: 200 }),
  reuseBranch: optionalBoolean(),
});

const worktreePromoteSchema = objectSchema({
  dir: requiredString({ max: WORKSPACE_DIR_MAX }),
  targetBranch: optionalString({ max: 200 }),
  force: optionalBoolean(),
});

const worktreeValidateSchema = objectSchema({
  dir: requiredString({ max: WORKSPACE_DIR_MAX }),
  commands: optionalStringArray({ max: 20, itemMax: 2000 }),
});

const workspaceDirSchema = objectSchema({
  dir: requiredString({ max: WORKSPACE_DIR_MAX }),
});

const protectedPathCheckSchema = objectSchema({
  path: requiredString({ max: WORKSPACE_DIR_MAX }),
});

const secretTextSchema = objectSchema({
  text: optionalString({ trim: false, allowEmpty: true }),
});

const secretScanFilesSchema = objectSchema({
  root: requiredString({ max: WORKSPACE_DIR_MAX }),
  paths: requiredStringArray({ max: 2000, itemMax: WORKSPACE_DIR_MAX }),
  maxBytes: optionalNumber({ min: 1, max: 5 * 1024 * 1024 }),
  ignore: optionalStringArray({ max: 200, itemMax: 500 }),
});

function rejectForMissingApproval(res: express.Response, check: ApprovalCheckResult) {
  if (check.ok) return false;
  res.status(check.status).json({ error: check.error, approval: check.approval });
  return true;
}

export function registerOpsRoutes(app: express.Express, deps: OpsRouteDeps) {
  app.post('/api/checkpoints', (req, res) => {
    const body = parseBody(req, res, checkpointCreateSchema);
    if (!body) return;
    const { dir, label } = body;
    const workspace = deps.ensureWorkspaceMutationAllowed(req, dir);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    try {
      const cp = checkpoints.createCheckpoint(workspace.dir, { label });
      res.status(201).json(cp);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/checkpoints', (req, res) => {
    const dir = (req.query.dir as string) || '';
    if (!dir) return res.json([]);
    const workspace = deps.ensureWorkspaceReadAllowed(dir);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    try {
      res.json(checkpoints.listCheckpoints(workspace.dir));
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/checkpoints/:id', (req, res) => {
    const dir = (req.query.dir as string) || '';
    if (!dir) return res.status(400).json({ error: 'dir is required' });
    const workspace = deps.ensureWorkspaceReadAllowed(dir);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    const cp = checkpoints.getCheckpoint(workspace.dir, req.params.id);
    if (!cp) return res.status(404).json({ error: 'Checkpoint not found' });
    res.json(cp);
  });

  app.delete('/api/checkpoints/:id', (req, res) => {
    const dir = (req.query.dir as string) || '';
    if (!dir) return res.status(400).json({ error: 'dir is required' });
    const workspace = deps.ensureWorkspaceMutationAllowed(req, dir);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    if (!checkpoints.deleteCheckpoint(workspace.dir, req.params.id)) {
      return res.status(404).json({ error: 'Checkpoint not found' });
    }
    res.status(204).end();
  });

  app.post('/api/checkpoints/:id/restore', (req, res) => {
    const body = parseBody(req, res, checkpointRestoreSchema);
    if (!body) return;
    const { dir, mode } = body;
    const workspace = deps.ensureWorkspaceMutationAllowed(req, dir);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    const op = mode === 'apply' ? checkpoints.applyCheckpointDiff : checkpoints.restoreCheckpoint;
    try {
      res.json(op(workspace.dir, req.params.id));
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/checkpoints/projects', (_req, res) => {
    res.json(checkpoints.listProjectsWithCheckpoints());
  });

  app.post('/api/worktrees', (req, res) => {
    const body = parseBody(req, res, worktreeCreateSchema);
    if (!body) return;
    const { dir, label, baseBranch, reuseBranch } = body;
    const workspace = deps.ensureWorkspaceMutationAllowed(req, dir);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    try {
      const wt = worktrees.createWorktree(workspace.dir, { label, baseBranch, reuseBranch });
      res.status(201).json(wt);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/worktrees', (req, res) => {
    const dir = (req.query.dir as string) || '';
    if (!dir) return res.json([]);
    const workspace = deps.ensureWorkspaceReadAllowed(dir);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    try {
      res.json(worktrees.listWorktrees(workspace.dir));
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/worktrees/:id', (req, res) => {
    const dir = (req.query.dir as string) || '';
    if (!dir) return res.status(400).json({ error: 'dir is required' });
    const workspace = deps.ensureWorkspaceReadAllowed(dir);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    const wt = worktrees.getWorktreeStatus(workspace.dir, req.params.id);
    if (!wt) return res.status(404).json({ error: 'Worktree not found' });
    res.json(wt);
  });

  app.get('/api/worktrees/:id/diff', (req, res) => {
    const dir = (req.query.dir as string) || '';
    if (!dir) return res.status(400).json({ error: 'dir is required' });
    const workspace = deps.ensureWorkspaceReadAllowed(dir);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    res.json(worktrees.diffWorktreeVsBase(workspace.dir, req.params.id));
  });

  app.delete('/api/worktrees/:id', (req, res) => {
    const dir = (req.query.dir as string) || '';
    const force = req.query.force === '1' || req.query.force === 'true';
    if (!dir) return res.status(400).json({ error: 'dir is required' });
    const workspace = deps.ensureWorkspaceMutationAllowed(req, dir);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    if (!worktrees.removeWorktree(workspace.dir, req.params.id, { force })) {
      return res.status(404).json({ error: 'Worktree not found' });
    }
    res.status(204).end();
  });

  app.post('/api/worktrees/:id/promote', (req, res) => {
    const body = parseBody(req, res, worktreePromoteSchema);
    if (!body) return;
    const { dir, targetBranch, force } = body;
    const workspace = deps.ensureWorkspaceMutationAllowed(req, dir);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    try {
      res.json(worktrees.promoteWorktree(workspace.dir, req.params.id, { targetBranch, force }));
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/worktrees/:id/validate', async (req, res) => {
    const body = parseBody(req, res, worktreeValidateSchema);
    if (!body) return;
    const { dir, commands } = body;
    const workspace = deps.ensureWorkspaceMutationAllowed(req, dir);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    const wt = worktrees.getWorktreeStatus(workspace.dir, req.params.id);
    if (!wt) return res.status(404).json({ error: 'Worktree not found' });
    if (!existsSync(wt.path)) return res.status(404).json({ error: 'Worktree path no longer exists' });

    let validationCommands = (commands || []).filter((command) => typeof command === 'string' && command.trim().length > 0);
    if (validationCommands.length === 0) {
      try {
        const profile = deps.getProjectProfile(wt.path);
        validationCommands = [
          profile.validation.lint,
          profile.validation.typecheck,
          profile.validation.build,
        ].filter((command): command is string => Boolean(command));
      } catch {
        validationCommands = [];
      }
    }
    if (validationCommands.length === 0) {
      return res.status(400).json({ error: 'No validation commands configured for this worktree' });
    }
    const trustMode = deps.getTrustMode();
    for (const command of validationCommands) {
      const policy = checkCommandPolicy(command, trustMode);
      if (!policy.allowed) {
        return res.status(403).json({ error: `Validation command refused: ${policy.reason || 'Command not allowed'}` });
      }
    }
    const approval = deps.ensureAskBeforeWriteApproval(req, {
      kind: 'command',
      route: `/api/worktrees/${req.params.id}/validate`,
      description: 'Run worktree validation commands',
      cwd: wt.path,
      command: validationCommands.join(' && '),
    });
    if (rejectForMissingApproval(res, approval)) return;

    try {
      const results = await benchRuns.runValidation(validationCommands, wt.path);
      res.json({
        worktree: worktrees.refreshWorktreeState(wt),
        results,
        passed: results.length > 0 && results.every((result) => result.passed),
      });
    } catch (err: any) {
      sendRouteError(res, { route: 'POST /api/worktrees/:id/validate', status: 500, fallback: 'Worktree validation failed', err });
    }
  });

  app.post('/api/worktrees/auto-clean', (req, res) => {
    const body = parseBody(req, res, workspaceDirSchema);
    if (!body) return;
    const { dir } = body;
    const workspace = deps.ensureWorkspaceMutationAllowed(req, dir);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    try {
      res.json(worktrees.autoCleanEmptyWorktrees(workspace.dir));
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/protected/rules', (_req, res) => {
    res.json(protectedPaths.listDefaultRules());
  });

  app.post('/api/protected/check', (req, res) => {
    const body = parseBody(req, res, protectedPathCheckSchema);
    if (!body) return;
    const filePath = body.path;
    res.json(protectedPaths.isPathProtected(filePath));
  });

  app.post('/api/secrets/scan', (req, res) => {
    const body = parseBody(req, res, secretTextSchema);
    if (!body) return;
    const { text } = body;
    if (text === undefined) return res.status(400).json({ error: 'text is required' });
    res.json(protectedPaths.scanForSecrets(text));
  });

  app.post('/api/secrets/scan-files', (req, res) => {
    const body = parseBody(req, res, secretScanFilesSchema);
    if (!body) return;
    const { root, paths, maxBytes, ignore } = body;
    const workspace = deps.ensureWorkspaceReadAllowed(root);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    for (const p of paths) {
      if (typeof p !== 'string' || !p.trim() || !deps.isPathWithin(p, workspace.dir)) {
        return res.status(403).json({ error: `Path ${p} is outside trusted workspace` });
      }
    }
    res.json(protectedPaths.scanFilesForSecrets(workspace.dir, paths, { maxBytes, ignore }));
  });

  app.post('/api/export/redact', (req, res) => {
    const body = parseBody(req, res, secretTextSchema);
    if (!body) return;
    const { text } = body;
    if (text === undefined) return res.status(400).json({ error: 'text is required' });
    res.json(protectedPaths.redactForExport(text));
  });

  app.get('/api/processes', (req, res) => {
    const includeExited = req.query.includeExited === '1' || req.query.includeExited === 'true';
    res.json(processLedger.listProcesses({ includeExited }));
  });

  app.get('/api/processes/:pid', (req, res) => {
    const pid = parseInt(req.params.pid, 10);
    const proc = processLedger.getProcess(pid);
    if (!proc) return res.status(404).json({ error: 'Process not found' });
    res.json(proc);
  });

  app.get('/api/processes/:pid/log', (req, res) => {
    const control = deps.ensureLocalControl(req);
    if (!control.ok) return res.status(control.status).json({ error: control.error });
    const pid = parseInt(req.params.pid, 10);
    const maxBytes = parseInt((req.query.maxBytes as string) || '32768', 10);
    const tail = processLedger.tailLog(pid, maxBytes);
    if (!tail) return res.status(404).json({ error: 'Process not found' });
    res.json(tail);
  });

  app.delete('/api/processes/:pid/log', (req, res) => {
    const pid = parseInt(req.params.pid, 10);
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    if (!processLedger.clearLog(pid)) return res.status(404).json({ error: 'Process not found' });
    res.status(204).end();
  });

  app.delete('/api/processes/:pid', (req, res) => {
    const pid = parseInt(req.params.pid, 10);
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    if (!processLedger.killProcess(pid)) return res.status(404).json({ error: 'Process not found' });
    res.status(204).end();
  });

  app.post('/api/processes/kill-all', (req, res) => {
    const { kinds } = (req.body || {}) as { kinds?: processLedger.ProcessKind[] };
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    res.json(processLedger.killAll({ kinds }));
  });

  app.post('/api/processes/prune', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    res.json({ removed: processLedger.pruneExited() });
  });

  app.get('/api/safety/summary', (req, res) => {
    const dir = (req.query.dir as string) || process.cwd();
    const workspace = deps.ensureWorkspaceReadAllowed(dir);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    const cps = checkpoints.listCheckpoints(workspace.dir);
    const wts = worktrees.listWorktrees(workspace.dir).map(w => worktrees.refreshWorktreeState(w));
    const procs = processLedger.listProcesses();
    res.json({
      checkpoints: { count: cps.length, latest: cps[0] || null },
      worktrees: {
        count: wts.length,
        active: wts.filter(w => w.status === 'active').length,
        clean: wts.filter(w => w.clean).length,
        list: wts,
      },
      processes: {
        count: procs.length,
        byKind: procs.reduce((acc: Record<string, number>, p) => {
          acc[p.kind] = (acc[p.kind] || 0) + 1;
          return acc;
        }, {}),
      },
    });
  });
}
