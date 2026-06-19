import type express from 'express';
import { join } from 'path';
import type { ApprovalAction } from '../actionApprovals';
import * as git from '../git';
import { applyPatch as nodeApplyPatch } from '../patchApply';
import { parseUnifiedDiff } from '../patchParse';
import {
  objectSchema,
  optionalString,
  parseBody,
  requiredString,
  requiredStringArray,
} from '../requestSchemas';
import { sendRouteError } from '../routeSupport';
import { runShipReadiness } from '../shipReadiness';
import { isPathAllowed, type TrustMode } from '../toolPolicy';

type ControlResult = { ok: true } | { ok: false; status: number; error: string };
type WorkspaceResult = { ok: true; dir: string } | { ok: false; status: number; error: string };
type ApprovalCheckResult = ControlResult & { approval?: unknown };

interface GitRouteDeps {
  getTrustMode: () => TrustMode;
  ensureWorkspaceReadAllowed: (dir: string) => WorkspaceResult;
  ensureWorkspaceMutationAllowed: (req: express.Request, dir: string) => WorkspaceResult;
  ensureAskBeforeWriteApproval: (req: express.Request, action: ApprovalAction) => ApprovalCheckResult;
  validateRepoRelativePaths: (paths: string[], workspace: string) => ControlResult;
  validateSessionWorkingDir: (dir: string) => WorkspaceResult;
}

const WORKSPACE_DIR_MAX = 4096;
const REPO_PATH_MAX = 2048;

const gitPathsMutationSchema = objectSchema({
  dir: requiredString({ max: WORKSPACE_DIR_MAX }),
  paths: requiredStringArray({ max: 2000, itemMax: REPO_PATH_MAX }),
});

const gitCommitSchema = objectSchema({
  dir: requiredString({ max: WORKSPACE_DIR_MAX }),
  message: requiredString({ trim: false, max: 20000 }),
});

const patchApplySchema = objectSchema({
  patch: requiredString({ trim: false }),
  workingDir: optionalString({ max: WORKSPACE_DIR_MAX }),
});

function rejectForMissingApproval(res: express.Response, check: ApprovalCheckResult) {
  if (check.ok) return false;
  res.status(check.status).json({ error: check.error, approval: check.approval });
  return true;
}

export function registerGitRoutes(app: express.Express, deps: GitRouteDeps) {
  app.get('/api/git/status', (req, res) => {
    const dir = req.query.dir as string;
    if (!dir) return res.status(400).json({ error: 'dir is required' });
    const workspace = deps.ensureWorkspaceReadAllowed(dir);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    try {
      res.json(git.getStatus(workspace.dir));
    } catch (err: any) {
      sendRouteError(res, { route: 'GET /api/git/status', status: 502, fallback: 'Git status failed', err });
    }
  });

  app.get('/api/git/diff', (req, res) => {
    const dir = req.query.dir as string;
    if (!dir) return res.status(400).json({ error: 'dir is required' });
    const workspace = deps.ensureWorkspaceReadAllowed(dir);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    if (req.query.path) {
      const pathCheck = deps.validateRepoRelativePaths([req.query.path as string], workspace.dir);
      if (!pathCheck.ok) return res.status(pathCheck.status).json({ error: pathCheck.error });
    }
    try {
      const opts: { cached?: boolean; path?: string } = {};
      if (req.query.cached) opts.cached = true;
      if (req.query.path) opts.path = req.query.path as string;
      res.json(git.getDiff(workspace.dir, opts));
    } catch (err: any) {
      sendRouteError(res, { route: 'GET /api/git/diff', status: 502, fallback: 'Git diff failed', err });
    }
  });

  app.get('/api/git/file-diff', (req, res) => {
    const dir = req.query.dir as string;
    const path = req.query.path as string;
    if (!dir || !path) return res.status(400).json({ error: 'dir and path are required' });
    const workspace = deps.ensureWorkspaceReadAllowed(dir);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    const pathCheck = deps.validateRepoRelativePaths([path], workspace.dir);
    if (!pathCheck.ok) return res.status(pathCheck.status).json({ error: pathCheck.error });
    try {
      res.json(git.getFileDiff(workspace.dir, path));
    } catch (err: any) {
      sendRouteError(res, { route: 'GET /api/git/file-diff', status: 502, fallback: 'Git file diff failed', err });
    }
  });

  app.post('/api/git/stage', (req, res) => {
    const body = parseBody(req, res, gitPathsMutationSchema);
    if (!body) return;
    const { dir, paths } = body;
    const workspace = deps.ensureWorkspaceMutationAllowed(req, dir);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    const pathCheck = deps.validateRepoRelativePaths(paths, workspace.dir);
    if (!pathCheck.ok) return res.status(pathCheck.status).json({ error: pathCheck.error });
    const approval = deps.ensureAskBeforeWriteApproval(req, {
      kind: 'write',
      route: '/api/git/stage',
      description: 'Stage files',
      cwd: workspace.dir,
      paths,
    });
    if (rejectForMissingApproval(res, approval)) return;
    try {
      git.stageFiles(workspace.dir, paths);
      res.json({ ok: true });
    } catch (err: any) {
      sendRouteError(res, { route: 'POST /api/git/stage', status: 502, fallback: 'Git stage failed', err });
    }
  });

  app.post('/api/git/unstage', (req, res) => {
    const body = parseBody(req, res, gitPathsMutationSchema);
    if (!body) return;
    const { dir, paths } = body;
    const workspace = deps.ensureWorkspaceMutationAllowed(req, dir);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    const pathCheck = deps.validateRepoRelativePaths(paths, workspace.dir);
    if (!pathCheck.ok) return res.status(pathCheck.status).json({ error: pathCheck.error });
    const approval = deps.ensureAskBeforeWriteApproval(req, {
      kind: 'write',
      route: '/api/git/unstage',
      description: 'Unstage files',
      cwd: workspace.dir,
      paths,
    });
    if (rejectForMissingApproval(res, approval)) return;
    try {
      git.unstageFiles(workspace.dir, paths);
      res.json({ ok: true });
    } catch (err: any) {
      sendRouteError(res, { route: 'POST /api/git/unstage', status: 502, fallback: 'Git unstage failed', err });
    }
  });

  app.post('/api/git/commit', (req, res) => {
    const body = parseBody(req, res, gitCommitSchema);
    if (!body) return;
    const { dir, message } = body;
    if (!message.trim()) return res.status(400).json({ error: 'dir and message are required' });
    const workspace = deps.ensureWorkspaceMutationAllowed(req, dir);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    const approval = deps.ensureAskBeforeWriteApproval(req, {
      kind: 'write',
      route: '/api/git/commit',
      description: 'Create git commit',
      cwd: workspace.dir,
      metadata: { message },
    });
    if (rejectForMissingApproval(res, approval)) return;
    try {
      const result = git.commit(workspace.dir, message);
      res.json(result);
    } catch (err: any) {
      sendRouteError(res, { route: 'POST /api/git/commit', status: 502, fallback: 'Git commit failed', err });
    }
  });

  app.get('/api/git/log', (req, res) => {
    const dir = req.query.dir as string;
    if (!dir) return res.status(400).json({ error: 'dir is required' });
    const workspace = deps.ensureWorkspaceReadAllowed(dir);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    try {
      const count = req.query.count ? parseInt(req.query.count as string, 10) : 20;
      res.json(git.getLog(workspace.dir, count));
    } catch (err: any) {
      sendRouteError(res, { route: 'GET /api/git/log', status: 502, fallback: 'Git log failed', err });
    }
  });

  app.get('/api/ship/readiness', (req, res) => {
    const dir = String(req.query.dir || '');
    const validation = deps.validateSessionWorkingDir(dir);
    if (!validation.ok) return res.status(validation.status).json({ error: validation.error });
    const workspace = deps.ensureWorkspaceReadAllowed(validation.dir);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    try {
      res.json(runShipReadiness(workspace.dir));
    } catch (err: any) {
      sendRouteError(res, { route: 'GET /api/ship/readiness', status: 500, fallback: 'Ship readiness failed', err });
    }
  });

  app.post('/api/patches/apply', (req, res) => {
    const body = parseBody(req, res, patchApplySchema);
    if (!body) return;
    const { patch, workingDir } = body;
    if (!patch?.trim()) return res.status(400).json({ error: 'patch is required' });
    const wd = workingDir || process.cwd();
    const trustMode = deps.getTrustMode();
    const workspace = deps.ensureWorkspaceMutationAllowed(req, wd);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });

    if (trustMode === 'read-only' || trustMode === 'chat-only') {
      return res.status(400).json({ error: `Write operations not allowed in ${trustMode} mode` });
    }

    let parsed: ReturnType<typeof parseUnifiedDiff>;
    try {
      parsed = parseUnifiedDiff(patch);
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || 'Patch parse failed' });
    }
    if (parsed.length === 0) {
      const hasLegacyMarker = /^(@@|\+\+\+ |--- )/m.test(patch);
      if (!hasLegacyMarker) {
        return res.status(400).json({ error: 'Patch has no files to apply' });
      }
    } else {
      for (const f of parsed) {
        const candidate = join(workspace.dir, f.filePath);
        const check = isPathAllowed(candidate, trustMode, workspace.dir);
        if (!check.allowed) {
          return res.status(400).json({ error: check.reason || 'Path refused' });
        }
      }
    }
    const approval = deps.ensureAskBeforeWriteApproval(req, {
      kind: 'write',
      route: '/api/patches/apply',
      description: 'Apply patch to workspace',
      cwd: workspace.dir,
      paths: parsed.map((file) => file.filePath),
    });
    if (rejectForMissingApproval(res, approval)) return;

    try {
      const result = nodeApplyPatch(patch, workspace.dir);
      res.json(result);
    } catch (err: any) {
      sendRouteError(res, { route: 'POST /api/patches/apply', status: 502, fallback: 'Patch apply failed', err });
    }
  });
}
