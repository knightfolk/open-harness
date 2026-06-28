import type express from 'express';
import type { StoredConfig } from '../config';
import { saveConfig } from '../config';
import { checkRouterHealth, clearRouterCache, configureAutoRouter, getAutoRouterState, getAvailableCandidates } from '../autoRouter';
import {
  getAllRoutingEvents,
  getLearningSummary,
  getModelSuccessRates,
  getRoutingEvents,
  importRoutingEvents,
  recordOutcome,
  suggestThresholdAdjustment,
} from '../routerLearning';
import { listRoutingAdherenceEvents, routingAdherencePhaseFromQuery } from '../routingAdherence';
import { getToolReliabilityCacheMeta, getToolReliabilitySummaryCached, invalidateToolReliabilitySummaryCache } from '../toolReliabilityStore';
import { buildToolFailureTrainingExportPayload, getToolErrorLedgerEvents, getToolErrorLedgerSummary } from '../toolErrorLedger';
import { buildRouterLearningExportPayload } from '../routerLearningExport';
import { buildRouterLearningImportPreview } from '../routerLearningImport';

type ControlResult = { ok: true } | { ok: false; status: number; error: string };

interface RouterRouteDeps {
  getConfig: () => StoredConfig;
  setConfig: (config: StoredConfig) => void;
  ensureLocalMutationWithControl: (req: express.Request) => ControlResult;
}

export function registerRouterRoutes(app: express.Express, deps: RouterRouteDeps) {
  app.get('/api/router/state', (_req, res) => {
    res.json(getAutoRouterState());
  });

  app.post('/api/router/configure', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const appConfig = deps.getConfig();
    (appConfig as any).autoRouter = req.body;
    configureAutoRouter(appConfig);
    saveConfig(appConfig);
    deps.setConfig(appConfig);
    res.json({ ok: true, state: getAutoRouterState() });
  });

  app.post('/api/router/clear-cache', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    clearRouterCache();
    res.json({ ok: true });
  });

  app.get('/api/router/candidates', (_req, res) => {
    res.json(getAvailableCandidates());
  });

  app.get('/api/router/health', async (_req, res) => {
    const health = await checkRouterHealth(deps.getConfig());
    res.json(health);
  });

  app.get('/api/router/learning', (_req, res) => {
    const toolReliability = getToolReliabilitySummaryCached();
    res.json({
      ...getLearningSummary(),
      toolReliability,
      toolErrorLedger: getToolErrorLedgerSummary(),
    });
  });

  app.get('/api/router/learning/events', (req, res) => {
    const sessionId = req.query.sessionId as string | undefined;
    const limit = parseInt(String(req.query.limit || '100'), 10);
    res.json(getRoutingEvents(sessionId, limit));
  });

  app.get('/api/router/learning/export', (_req, res) => {
    const events = getAllRoutingEvents();
    const toolReliability = getToolReliabilitySummaryCached();
    res.json(buildRouterLearningExportPayload({
      events,
      learningSummary: getLearningSummary(),
      toolReliability,
      routerState: getAutoRouterState(),
    }));
  });

  app.get('/api/router/learning/tool-errors', (req, res) => {
    const summaryOnly = req.query.summaryOnly === 'true';
    const model = req.query.model as string | undefined;
    const providerId = req.query.providerId as string | undefined;
    const tool = req.query.tool as string | undefined;
    const evidenceSource = req.query.evidenceSource as 'saved_session_trace' | 'log_trace' | 'imported_trace' | undefined;
    const limit = Math.max(1, Math.min(300, parseInt(String(req.query.limit || '80'), 10) || 80));

    res.json({
      summary: getToolErrorLedgerSummary({ model, providerId, tool, evidenceSource }),
      events: summaryOnly ? [] : getToolErrorLedgerEvents({
        model,
        providerId,
        tool,
        evidenceSource,
        limit,
      }),
    });
  });

  app.get('/api/router/learning/tool-error-training-export', (req, res) => {
    const model = req.query.model as string | undefined;
    const providerId = req.query.providerId as string | undefined;
    const tool = req.query.tool as string | undefined;
    const evidenceSource = req.query.evidenceSource as 'saved_session_trace' | 'log_trace' | 'imported_trace' | undefined;
    const limit = Math.max(1, Math.min(1000, parseInt(String(req.query.limit || '300'), 10) || 300));
    const events = getToolErrorLedgerEvents({ model, providerId, tool, evidenceSource, limit });
    res.json(buildToolFailureTrainingExportPayload({ events }));
  });

  app.get('/api/router/learning/tool-reliability/cache', (_req, res) => {
    res.json(getToolReliabilityCacheMeta());
  });

  app.post('/api/router/learning/tool-reliability/cache/refresh', (_req, res) => {
    invalidateToolReliabilitySummaryCache();
    const toolReliability = getToolReliabilitySummaryCached({ forceRefresh: true });
    res.json({
      ok: true,
      cache: getToolReliabilityCacheMeta(),
      toolReliability,
    });
  });

  app.post('/api/router/learning/import', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const body = req.body || {};
    const dryRun = body.dryRun === true || req.query.dryRun === 'true';
    const datasetKind = body.datasetKind === 'production' || req.query.datasetKind === 'production' ? 'production' : 'benchmark';
    const { events, importSource, schemaVersion, schemaSupported, warnings, toolReliabilityPreview, promptBestPracticePreview, providerFailureAdherencePreview } = buildRouterLearningImportPreview(body);
    if (!Array.isArray(events)) return res.status(400).json({ error: 'events array required' });
    res.json({ ok: true, ...importRoutingEvents(events, { dryRun, datasetKind }), importSource, schemaVersion, schemaSupported, warnings, toolReliabilityPreview, promptBestPracticePreview, providerFailureAdherencePreview });
  });

  app.get('/api/router/adherence/events', (req, res) => {
    const limit = parseInt(String(req.query.limit || '100'), 10);
    const phase = routingAdherencePhaseFromQuery(req.query.phase);
    if (phase === null) return res.status(400).json({ error: 'Unknown routing adherence phase' });
    res.json(listRoutingAdherenceEvents(limit, { phase }));
  });

  app.get('/api/router/learning/success-rates', (_req, res) => {
    res.json(getModelSuccessRates());
  });

  app.post('/api/router/learning/suggest-threshold', (req, res) => {
    const currentThreshold = (req.body?.currentThreshold as number) ?? 0.7;
    res.json(suggestThresholdAdjustment(currentThreshold));
  });

  app.post('/api/router/learning/outcome', (req, res) => {
    const { eventId, outcome, note } = (req.body || {}) as { eventId?: string; outcome?: string; note?: string };
    if (!eventId || !outcome) return res.status(400).json({ error: 'eventId and outcome required' });
    if (!['success', 'failure', 'ambiguous'].includes(outcome)) {
      return res.status(400).json({ error: 'outcome must be success, failure, or ambiguous' });
    }
    const ok = recordOutcome(eventId, outcome as any, note);
    if (!ok) return res.status(404).json({ error: 'Event not found' });
    res.json({ ok: true });
  });
}
