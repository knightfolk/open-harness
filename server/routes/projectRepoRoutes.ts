import type express from 'express';
import { getProjectProfile } from '../projectProfile';
import {
  buildContextPack,
  findSymbolDefinition,
  getDirectDependencies,
  getRepoMap,
  getReverseDependencies,
  suggestContextPack,
  summarizeChangeImpact,
  summarizeRepoMap,
  type ContextPackName,
} from '../repoMap';

type WorkspaceResult = { ok: true; dir: string } | { ok: false; status: number; error: string };
type FilesResult = { ok: true } | { ok: false; status: number; error: string };

interface ProjectRepoRouteDeps {
  validateRepoQueryPath: (value: unknown) => WorkspaceResult;
  validateRepoFiles: (files: string[], workspace: string) => FilesResult;
}

const VALID_PACKS: ContextPackName[] = ['bugfix', 'feature', 'review', 'docs', 'ui-smoke'];

function parsePack(value: unknown): ContextPackName | null {
  if (typeof value !== 'string') return null;
  return VALID_PACKS.includes(value as ContextPackName) ? (value as ContextPackName) : null;
}

export function registerProjectRepoRoutes(app: express.Express, deps: ProjectRepoRouteDeps) {
  app.get('/api/project/profile', (req, res) => {
    const targetPath = req.query.path as string;
    if (!targetPath) return res.status(400).json({ error: 'path is required' });
    const workspace = deps.validateRepoQueryPath(targetPath);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    try {
      res.json(getProjectProfile(workspace.dir));
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to build project profile' });
    }
  });

  app.get('/api/repo/map', (req, res) => {
    const workspace = deps.validateRepoQueryPath(req.query.path);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    const budgetRaw = Number(req.query.tokenBudget);
    const tokenBudget = Number.isFinite(budgetRaw) && budgetRaw > 0 ? Math.min(Math.floor(budgetRaw), 20000) : 4500;
    try {
      const map = getRepoMap(workspace.dir);
      res.json(summarizeRepoMap(map, tokenBudget));
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to build repo map' });
    }
  });

  app.get('/api/repo/symbol', (req, res) => {
    const workspace = deps.validateRepoQueryPath(req.query.path);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    const name = (req.query.name as string || '').trim();
    if (!name) return res.status(400).json({ error: 'name is required' });
    try {
      const map = getRepoMap(workspace.dir);
      const matches = findSymbolDefinition(map, name).slice(0, 50);
      res.json({ query: name, matchCount: matches.length, matches });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to search symbols' });
    }
  });

  app.get('/api/repo/deps', (req, res) => {
    const workspace = deps.validateRepoQueryPath(req.query.path);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    const file = (req.query.file as string || '').trim();
    if (!file) return res.status(400).json({ error: 'file is required' });
    const filesCheck = deps.validateRepoFiles([file], workspace.dir);
    if (!filesCheck.ok) return res.status(filesCheck.status).json({ error: filesCheck.error });
    try {
      const map = getRepoMap(workspace.dir);
      res.json({
        file,
        imports: getDirectDependencies(map, file),
        importedBy: getReverseDependencies(map, file),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to load dependencies' });
    }
  });

  app.get('/api/repo/impact', (req, res) => {
    const workspace = deps.validateRepoQueryPath(req.query.path);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    const raw = (req.query.files as string || '').trim();
    if (!raw) return res.status(400).json({ error: 'files is required (comma-separated)' });
    const files = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const filesCheck = deps.validateRepoFiles(files, workspace.dir);
    if (!filesCheck.ok) return res.status(filesCheck.status).json({ error: filesCheck.error });
    try {
      const map = getRepoMap(workspace.dir);
      res.json({ files, ...summarizeChangeImpact(map, files) });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to compute impact' });
    }
  });

  app.get('/api/repo/context-pack/suggest', (req, res) => {
    const userMessage = (req.query.userMessage as string) || '';
    res.json(suggestContextPack(userMessage));
  });

  app.get('/api/repo/context-pack', (req, res) => {
    const workspace = deps.validateRepoQueryPath(req.query.path);
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    const pack = parsePack(req.query.pack) || suggestContextPack((req.query.userMessage as string) || '').pack;
    const userMessage = (req.query.userMessage as string) || '';
    const budgetRaw = Number(req.query.budgetTokens);
    const budgetTokens = Number.isFinite(budgetRaw) && budgetRaw > 0 ? Math.min(Math.floor(budgetRaw), 20000) : 2500;
    try {
      const map = getRepoMap(workspace.dir);
      const cp = buildContextPack(map, pack, userMessage, budgetTokens);
      res.json(cp);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to build context pack' });
    }
  });
}
