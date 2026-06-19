import type express from 'express';
import { basename, extname, join } from 'path';
import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from 'fs';
import { isReadPathAllowed, type TrustMode } from '../toolPolicy';

interface FilesystemRouteDeps {
  getTrustMode: () => TrustMode;
  trustedWorkspaceFromRequest: (req: express.Request) => string | undefined;
}

export function registerFilesystemRoutes(app: express.Express, deps: FilesystemRouteDeps) {
  app.get('/api/fs/list', (req, res) => {
    const dir = req.query.path as string;
    if (!dir || !existsSync(dir)) return res.status(400).json({ error: 'Invalid path' });
    const readPolicy = isReadPathAllowed(dir, deps.getTrustMode(), deps.trustedWorkspaceFromRequest(req));
    if (!readPolicy.allowed) return res.status(403).json({ error: readPolicy.reason || 'Path refused' });

    try {
      const stat = statSync(dir);
      if (!stat.isDirectory()) return res.status(400).json({ error: 'Not a directory' });

      const entries = readdirSync(dir)
        .filter(name => !name.startsWith('.'))
        .map(name => {
          try {
            const fullPath = join(dir, name);
            const s = lstatSync(fullPath);
            return {
              name,
              path: fullPath,
              type: s.isDirectory() ? 'directory' : 'file',
              extension: s.isFile() ? extname(name).toLowerCase() : undefined,
              size: s.size,
              modified: s.mtime.toISOString(),
            };
          } catch { return null; }
        })
        .filter(Boolean)
        .sort((a: any, b: any) => {
          if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

      res.json({ path: dir, entries });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/fs/read', (req, res) => {
    const filePath = req.query.path as string;
    if (!filePath || !existsSync(filePath)) return res.status(400).json({ error: 'Invalid path' });
    const readPolicy = isReadPathAllowed(filePath, deps.getTrustMode(), deps.trustedWorkspaceFromRequest(req));
    if (!readPolicy.allowed) return res.status(403).json({ error: readPolicy.reason || 'Path refused' });

    try {
      const stat = statSync(filePath);
      if (stat.isDirectory()) return res.status(400).json({ error: 'Path is a directory' });
      if (stat.size > 1024 * 1024) return res.status(400).json({ error: 'File too large (max 1MB)' });

      const content = readFileSync(filePath, 'utf-8');
      res.json({
        path: filePath,
        name: basename(filePath),
        extension: extname(filePath),
        size: stat.size,
        modified: stat.mtime.toISOString(),
        content,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
