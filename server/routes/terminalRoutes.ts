import type express from 'express';
import type { StoredConfig } from '../config';
import type { ApprovalAction } from '../actionApprovals';
import { createSession as createTermSession, getHistory as getTermHistory, runCommand as runTermCommand, cancelCommand as cancelTermCommand, getEntry as getTermEntry } from '../terminalSessions';
import { checkToolActionPolicy, isReadPathAllowed, type TrustMode } from '../toolPolicy';

type ControlResult = { ok: true } | { ok: false; status: number; error: string };
type ApprovalCheckResult = ControlResult & { approval?: unknown };

interface TerminalRouteDeps {
  getConfig: () => StoredConfig;
  ensureLocalControl: (req: express.Request) => ControlResult;
  ensureLocalMutationWithControl: (req: express.Request) => ControlResult;
  ensureAskBeforeWriteApproval: (req: express.Request, action: ApprovalAction) => ApprovalCheckResult;
  isKnownWorkspacePath: (dir: string | undefined) => boolean;
  runShellCommand: (command: string, cwd: string) => Promise<{ output: string; exitCode: number }>;
  redactOutputText: (text: string) => string;
}

function rejectForMissingApproval(res: express.Response, check: ApprovalCheckResult) {
  if (check.ok) return false;
  res.status(check.status).json({ error: check.error, approval: check.approval });
  return true;
}

export function registerTerminalRoutes(app: express.Express, deps: TerminalRouteDeps) {
  app.post('/api/terminal/exec', async (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const { command, cwd } = req.body as { command: string; cwd?: string };
    if (!command?.trim()) return res.status(400).json({ error: 'Command is required' });
    const cmdTrustMode = (deps.getConfig().trustMode || 'workspace-write') as TrustMode;
    const workingDir = deps.isKnownWorkspacePath(cwd) ? cwd! : process.cwd();
    const cmdPolicy = checkToolActionPolicy('exec_command', { command, cwd: workingDir }, cmdTrustMode, workingDir);
    if (!cmdPolicy.allowed) return res.status(403).json({ error: cmdPolicy.reason || 'Command not allowed' });
    const approval = deps.ensureAskBeforeWriteApproval(req, {
      kind: 'command',
      route: '/api/terminal/exec',
      description: 'Run terminal command',
      cwd: workingDir,
      command,
    });
    if (rejectForMissingApproval(res, approval)) return;

    const start = Date.now();
    const result = await deps.runShellCommand(command, workingDir);
    res.json({
      command: deps.redactOutputText(command),
      output: result.output,
      exitCode: result.exitCode,
      duration: Date.now() - start,
      cwd: workingDir,
    });
  });

  app.post('/api/terminal/sessions', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const { cwd } = req.body as { cwd?: string };
    if (cwd && !deps.isKnownWorkspacePath(cwd)) {
      return res.status(403).json({ error: 'Terminal sessions must be created inside a trusted workspace' });
    }
    const workingDir = cwd || process.cwd();
    const trustMode = (deps.getConfig().trustMode || 'workspace-write') as TrustMode;
    const readPolicy = isReadPathAllowed(workingDir, trustMode, workingDir);
    if (!readPolicy.allowed) return res.status(403).json({ error: readPolicy.reason || 'Workspace not allowed' });
    const session = createTermSession(workingDir);
    res.status(201).json(session);
  });

  app.get('/api/terminal/sessions/:sessionId/history', (req, res) => {
    const control = deps.ensureLocalControl(req);
    if (!control.ok) return res.status(control.status).json({ error: control.error });
    const entries = getTermHistory(req.params.sessionId);
    res.json(entries);
  });

  app.post('/api/terminal/sessions/:sessionId/run', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const { command, cwd } = req.body as { command?: string; cwd?: string };
    if (!command?.trim()) return res.status(400).json({ error: 'Command is required' });
    const trustMode = (deps.getConfig().trustMode || 'workspace-write') as TrustMode;
    const workingDir = deps.isKnownWorkspacePath(cwd) ? cwd! : process.cwd();
    const cmdPolicy = checkToolActionPolicy('exec_command', { command, cwd: workingDir }, trustMode, workingDir);
    if (!cmdPolicy.allowed) return res.status(403).json({ error: cmdPolicy.reason || 'Command not allowed' });
    const approval = deps.ensureAskBeforeWriteApproval(req, {
      kind: 'command',
      route: `/api/terminal/sessions/${req.params.sessionId}/run`,
      description: 'Run terminal session command',
      cwd: workingDir,
      command,
    });
    if (rejectForMissingApproval(res, approval)) return;

    const entry = runTermCommand({
      sessionId: req.params.sessionId,
      command,
      cwd: workingDir,
      timeout: 120_000,
    });
    res.status(201).json(entry);
  });

  app.post('/api/terminal/commands/:commandId/cancel', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const cancelled = cancelTermCommand(req.params.commandId);
    res.json({ cancelled });
  });

  app.get('/api/terminal/commands/:commandId', (req, res) => {
    const control = deps.ensureLocalControl(req);
    if (!control.ok) return res.status(control.status).json({ error: control.error });
    const entry = getTermEntry(req.params.commandId);
    if (!entry) return res.status(404).json({ error: 'Command not found' });
    res.json(entry);
  });
}
