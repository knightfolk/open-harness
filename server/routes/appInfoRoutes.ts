import type express from 'express';
import {
  deletePersonalizationProfile,
  getPersonalizationLoadError,
  getPersonalizationProfilePath,
  loadPersonalizationProfile,
  savePersonalizationProfile,
} from '../personalization';
import { getReleaseNotes } from '../releaseNotes';
import { buildCrashReportBundle, getCrashReportSummary } from '../crashReports';

type ControlResult = { ok: true } | { ok: false; status: number; error: string };

interface AppInfoRouteDeps {
  ensureLocalMutationWithControl: (req: express.Request) => ControlResult;
}

export function registerAppInfoRoutes(app: express.Express, deps: AppInfoRouteDeps) {
  app.get('/api/personalization', (_req, res) => {
    const profile = loadPersonalizationProfile();
    res.json({
      profile,
      path: getPersonalizationProfilePath(),
      error: getPersonalizationLoadError(),
    });
  });

  app.put('/api/personalization', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const profile = savePersonalizationProfile(req.body || {});
    res.json({
      ok: true,
      profile,
      path: getPersonalizationProfilePath(),
    });
  });

  app.delete('/api/personalization', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    deletePersonalizationProfile();
    res.json({
      ok: true,
      profile: loadPersonalizationProfile(),
      path: getPersonalizationProfilePath(),
    });
  });

  app.get('/api/release-notes', (_req, res) => {
    res.json(getReleaseNotes());
  });

  app.get('/api/crash-reports', (_req, res) => {
    res.json(getCrashReportSummary());
  });

  app.get('/api/crash-reports/export', (_req, res) => {
    const bundle = buildCrashReportBundle();
    const stamp = bundle.generatedAt.replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="openharness-crash-report-${stamp}.json"`);
    res.send(JSON.stringify(bundle, null, 2));
  });
}
