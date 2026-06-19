import express from 'express';
import { execFileSync } from 'child_process';

import { estimateCost } from '../modelProfiles';

interface SystemRouteDeps {
  staticDir?: string;
  appRoot?: string;
}

export function registerSystemRoutes(app: express.Express, deps: SystemRouteDeps) {
  app.get('/api/ready', (req, res) => {
    const electronHandshake = process.env.OPENHARNESS_ELECTRON_HANDSHAKE || '';
    if (electronHandshake) {
      if (req.get('x-openharness-electron-handshake') !== electronHandshake) {
        return res.status(401).json({ ok: false, error: 'Invalid Electron readiness handshake' });
      }
      res.setHeader('x-openharness-electron-handshake-ok', '1');
    }
    res.json({
      ok: true,
      pid: process.pid,
      packaged: Boolean(deps.staticDir),
      staticDir: deps.staticDir || null,
      appRoot: deps.appRoot || null,
    });
  });

  app.post('/api/dialog/open-folder', (_req, res) => {
    try {
      const result = execFileSync(
        'osascript',
        ['-e', 'POSIX path of (choose folder with prompt "Open Folder")'],
        { encoding: 'utf-8' },
      ).trim();
      res.json({ path: result });
    } catch {
      res.json({ path: null });
    }
  });

  app.post('/api/cost/estimate', (req, res) => {
    const { model, inputTokens = 0, outputTokens = 0 } = (req.body || {}) as { model?: string; inputTokens?: number; outputTokens?: number };
    if (!model) return res.status(400).json({ error: 'model is required' });
    try {
      const cost = estimateCost(model, inputTokens, outputTokens);
      res.json({ model, inputTokens, outputTokens, cost });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Cost estimation failed' });
    }
  });
}
