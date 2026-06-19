import type express from 'express';
import * as projectMemory from '../projectMemory';

type WorkspaceResult = { ok: true; dir: string } | { ok: false; status: number; error: string };

interface ProjectMemoryRouteDeps {
  ensureKnownWorkspace: (dir: string) => WorkspaceResult;
  ensureWorkspaceMutationAllowed: (req: express.Request, dir: string) => WorkspaceResult;
}

export function registerProjectMemoryRoutes(app: express.Express, deps: ProjectMemoryRouteDeps) {
  app.get('/api/project/memory', (req, res) => {
    const path = req.query.path as string;
    if (!path) return res.status(400).json({ error: 'path is required' });
    const workspace = deps.ensureKnownWorkspace(path);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    const memory = projectMemory.loadProjectMemory(workspace.dir);
    res.json(memory);
  });

  app.put('/api/project/memory', (req, res) => {
    const { path, content } = req.body as { path: string; content: string };
    if (!path || content == null) return res.status(400).json({ error: 'path and content are required' });
    const workspace = deps.ensureWorkspaceMutationAllowed(req, path);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    projectMemory.saveMemory(workspace.dir, content);
    res.json({ ok: true });
  });

  app.post('/api/project/memory/append', (req, res) => {
    const { path, content } = req.body as { path: string; content: string };
    if (!path || !content) return res.status(400).json({ error: 'path and content are required' });
    const workspace = deps.ensureWorkspaceMutationAllowed(req, path);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    projectMemory.appendToMemory(workspace.dir, content);
    res.json({ ok: true });
  });

  app.post('/api/project/memory/archive', (req, res) => {
    const path = (req.body as { path?: string })?.path;
    if (!path) return res.status(400).json({ error: 'path is required' });
    const workspace = deps.ensureWorkspaceMutationAllowed(req, path);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    projectMemory.saveMemory(workspace.dir, projectMemory.loadMemory(workspace.dir));
    res.json({ ok: true, archived: true, archivedAt: stamp });
  });

  app.get('/api/project/memory/export', (req, res) => {
    const path = req.query.path as string;
    if (!path) return res.status(400).json({ error: 'path is required' });
    const workspace = deps.ensureKnownWorkspace(path);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    const memory = projectMemory.loadMemory(workspace.dir);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="openharness-memory-${path.replace(/[^a-zA-Z0-9._-]/g, '_')}.md"`);
    res.send(memory || '# (empty)');
  });
}
