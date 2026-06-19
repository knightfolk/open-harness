import express from 'express';

import * as harnessTasks from '../harnessTasks';
import { checkCommandPolicy, type TrustMode } from '../toolPolicy';

interface TaskRouteDeps {
  getTrustMode: () => TrustMode;
  ensureLocalMutationWithControl: (req: express.Request) => { ok: true } | { ok: false; status: number; error: string };
  ensureKnownWorkspace: (dir: string) => { ok: true; dir: string } | { ok: false; status: number; error: string };
}

const TASK_TRUST_MODES = new Set(['read-only', 'ask-before-write', 'workspace-write']);

function validateHarnessTaskInput(
  input: Partial<harnessTasks.HarnessTask>,
  deps: TaskRouteDeps,
  fallbackWorkingDir?: string,
): { ok: true; task: any } | { ok: false; status: number; error: string } {
  const workingDir = typeof input.workingDir === 'string' && input.workingDir.trim()
    ? input.workingDir
    : fallbackWorkingDir || process.cwd();
  const workspace = deps.ensureKnownWorkspace(workingDir);
  if (!workspace.ok) return workspace;

  const trustMode = input.trustMode || 'workspace-write';
  if (!TASK_TRUST_MODES.has(trustMode)) {
    return { ok: false, status: 400, error: 'Invalid task trustMode' };
  }

  const setupCommands = Array.isArray(input.setupCommands) ? input.setupCommands : [];
  const verificationCommands = Array.isArray(input.verificationCommands) ? input.verificationCommands : [];
  for (const command of [...setupCommands, ...verificationCommands]) {
    if (typeof command !== 'string' || !command.trim()) {
      return { ok: false, status: 400, error: 'Task commands must be non-empty strings' };
    }
    const policy = checkCommandPolicy(command, deps.getTrustMode());
    if (!policy.allowed) {
      return { ok: false, status: 403, error: `Task command refused: ${policy.reason || 'Command not allowed'}` };
    }
  }

  return {
    ok: true,
    task: {
      ...input,
      workingDir: workspace.dir,
      trustMode,
      setupCommands,
      verificationCommands,
    },
  };
}

export function registerTaskRoutes(app: express.Express, deps: TaskRouteDeps) {
  app.get('/api/tasks', (req, res) => {
    const { tag, trustMode } = req.query as { tag?: string; trustMode?: string };
    res.json(harnessTasks.listTasks({ tag, trustMode }));
  });

  app.get('/api/tasks/:id', (req, res) => {
    const task = harnessTasks.getTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  });

  app.post('/api/tasks', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const validated = validateHarnessTaskInput(req.body, deps);
    if (!validated.ok) return res.status(validated.status).json({ error: validated.error });
    const task = harnessTasks.createTask(validated.task);
    res.status(201).json(task);
  });

  app.put('/api/tasks/:id', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const existing = harnessTasks.getTask(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Task not found' });
    const validated = validateHarnessTaskInput({ ...existing, ...req.body }, deps, existing.workingDir);
    if (!validated.ok) return res.status(validated.status).json({ error: validated.error });
    const task = harnessTasks.updateTask(req.params.id, validated.task);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  });

  app.delete('/api/tasks/:id', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    if (!harnessTasks.deleteTask(req.params.id)) return res.status(404).json({ error: 'Task not found' });
    res.status(204).end();
  });

  app.post('/api/tasks/seed', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const { workingDir } = req.body as { workingDir?: string };
    const workspace = deps.ensureKnownWorkspace(workingDir || process.cwd());
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    harnessTasks.seedFixtures(workspace.dir);
    res.json({ ok: true, count: harnessTasks.listTasks().length });
  });

  app.get('/api/task-suites', (_req, res) => {
    res.json(harnessTasks.listSuites());
  });

  app.get('/api/task-suites/:id', (req, res) => {
    const suite = harnessTasks.getSuite(req.params.id);
    if (!suite) return res.status(404).json({ error: 'Suite not found' });
    res.json(suite);
  });

  app.post('/api/task-suites', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const suite = harnessTasks.createSuite(req.body);
    res.status(201).json(suite);
  });

  app.delete('/api/task-suites/:id', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    if (!harnessTasks.deleteSuite(req.params.id)) return res.status(404).json({ error: 'Suite not found' });
    res.status(204).end();
  });

  app.get('/api/task-suites/:id/export', (req, res) => {
    const data = harnessTasks.exportSuite(req.params.id);
    if (!data) return res.status(404).json({ error: 'Suite not found' });
    res.json(data);
  });

  app.post('/api/task-suites/import', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    try {
      const tasks = Array.isArray(req.body?.tasks) ? req.body.tasks : [];
      const validatedTasks = [];
      for (const task of tasks) {
        const validated = validateHarnessTaskInput(task, deps);
        if (!validated.ok) return res.status(validated.status).json({ error: validated.error });
        validatedTasks.push(validated.task);
      }
      const suite = harnessTasks.importSuite({ ...req.body, tasks: validatedTasks });
      res.status(201).json(suite);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });
}
