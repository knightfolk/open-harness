import type express from 'express';
import type { ModelBudget } from '../config';
import { checkBudget, getAllUsageSummaries, recordUsage } from '../usageTracker';

interface UsageRouteDeps {
  getConfig: () => { modelBudgets?: ModelBudget[] };
}

export function registerUsageRoutes(app: express.Express, deps: UsageRouteDeps) {
  app.get('/api/usage', (_req, res) => {
    res.json(getAllUsageSummaries(deps.getConfig().modelBudgets || []));
  });

  app.post('/api/usage/record', (req, res) => {
    const { modelId, inputTokens, outputTokens, cost, sessionId } = (req.body || {}) as any;
    if (!modelId) return res.status(400).json({ error: 'modelId required' });
    recordUsage({
      timestamp: new Date().toISOString(),
      modelId,
      inputTokens: inputTokens || 0,
      outputTokens: outputTokens || 0,
      cost: cost || 0,
      sessionId: sessionId || 'unknown',
    });
    res.json({ ok: true });
  });

  app.get('/api/usage/check', (req, res) => {
    const modelId = (req.query.modelId as string) || '';
    const estimatedInput = parseInt(String(req.query.estimatedInput || '0'), 10);
    const estimatedOutput = parseInt(String(req.query.estimatedOutput || '0'), 10);
    const estimatedCost = parseFloat(String(req.query.estimatedCost || '0'));
    if (!modelId) return res.status(400).json({ error: 'modelId required' });
    res.json(checkBudget(modelId, deps.getConfig().modelBudgets || [], estimatedInput, estimatedOutput, estimatedCost));
  });
}
