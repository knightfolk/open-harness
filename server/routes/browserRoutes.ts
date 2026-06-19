import type express from 'express';
import { captureDeepBrowser } from '../browserCapture';
import { analyzeDomStructure, checkResourceHealth } from '../browserCaptureEnhancements';
import { capturePreview, checkServerHealth } from '../browserPreview';
import { sendRouteError } from '../routeSupport';

const consoleLogStore: Array<{ sessionId: string; level: string; message: string; timestamp: string }> = [];
const MAX_CONSOLE_LOGS = 500;

export function registerBrowserRoutes(app: express.Express) {
  app.post('/api/browser/preview', async (req, res) => {
    const { url } = req.body as { url?: string };
    if (!url?.trim()) return res.status(400).json({ error: 'url is required' });
    try {
      const result = await capturePreview(url);
      res.json(result);
    } catch (err: any) {
      sendRouteError(res, { route: 'POST /api/browser/preview', status: 502, fallback: 'Browser preview failed', err });
    }
  });

  app.get('/api/browser/health', (req, res) => {
    const url = req.query.url as string;
    if (!url?.trim()) return res.status(400).json({ error: 'url is required' });
    try {
      const result = checkServerHealth(url);
      res.json(result);
    } catch (err: any) {
      sendRouteError(res, { route: 'GET /api/browser/health', status: 502, fallback: 'Browser health check failed', err });
    }
  });

  app.post('/api/browser/deep', async (req, res) => {
    const url = (req.body as { url?: string })?.url;
    if (!url?.trim()) return res.status(400).json({ error: 'url is required' });
    try {
      const artifact = await captureDeepBrowser(url);
      if (!artifact) {
        return res.status(400).json({ error: 'Only localhost URLs are supported' });
      }
      if (artifact.bodyTextPreview && !artifact.domStructure) {
        try {
          const htmlRes = await fetch(artifact.url, { signal: AbortSignal.timeout(5000) });
          if (htmlRes.ok) {
            const buf = await htmlRes.arrayBuffer();
            const html = new TextDecoder('utf-8').decode(buf.slice(0, 2 * 1024 * 1024));
            artifact.domStructure = analyzeDomStructure(html);
            try {
              artifact.resourceHealth = await checkResourceHealth(html, artifact.url);
            } catch {}
          }
        } catch {
          // Enhancement is best-effort.
        }
      }
      res.json(artifact);
    } catch (err: any) {
      sendRouteError(res, { route: 'POST /api/browser/deep', status: 500, fallback: 'Deep capture failed', err });
    }
  });

  app.post('/api/browser/console-log', (req, res) => {
    const { sessionId, level, message, timestamp } = (req.body || {}) as { sessionId?: string; level?: string; message?: string; timestamp?: string };
    if (!message) return res.status(400).json({ error: 'message is required' });
    const entry = {
      sessionId: sessionId || 'anonymous',
      level: level || 'log',
      message: String(message).slice(0, 2000),
      timestamp: timestamp || new Date().toISOString(),
    };
    consoleLogStore.push(entry);
    if (consoleLogStore.length > MAX_CONSOLE_LOGS) {
      consoleLogStore.splice(0, consoleLogStore.length - MAX_CONSOLE_LOGS);
    }
    res.json({ ok: true });
  });

  app.get('/api/browser/console-log', (req, res) => {
    const sessionId = req.query.sessionId as string | undefined;
    const limit = parseInt(String(req.query.limit || '200'), 10);
    let entries = consoleLogStore;
    if (sessionId) entries = entries.filter((e) => e.sessionId === sessionId);
    res.json(entries.slice(-limit));
  });

  app.delete('/api/browser/console-log', (req, res) => {
    const sessionId = req.query.sessionId as string | undefined;
    if (sessionId) {
      let removed = 0;
      for (let i = consoleLogStore.length - 1; i >= 0; i--) {
        if (consoleLogStore[i].sessionId === sessionId) {
          consoleLogStore.splice(i, 1);
          removed++;
        }
      }
      res.json({ removed });
    } else {
      const count = consoleLogStore.length;
      consoleLogStore.length = 0;
      res.json({ removed: count });
    }
  });
}
