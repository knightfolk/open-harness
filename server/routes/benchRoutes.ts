import express from 'express';

import * as benchRuns from '../benchRuns';

interface BenchRouteDeps {
  ensureLocalMutationWithControl: (req: express.Request) => { ok: true } | { ok: false; status: number; error: string };
}

export function registerBenchRoutes(app: express.Express, deps: BenchRouteDeps) {
  app.get('/api/bench/runs', (_req, res) => {
    res.json(benchRuns.listBenchRuns());
  });

  app.get('/api/bench/runs/:id', (req, res) => {
    const run = benchRuns.getBenchRun(req.params.id);
    if (!run) return res.status(404).json({ error: 'Bench run not found' });
    res.json({
      ...run,
      artifactPath: benchRuns.getBenchArtifactPath(req.params.id),
      previousDelta: benchRuns.getPreviousRunDelta(run),
    });
  });

  app.post('/api/bench/runs/:id/proof-review', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const run = benchRuns.getBenchRun(req.params.id);
    if (!run) return res.status(404).json({ error: 'Bench run not found' });
    const status = req.body?.status === 'approved' || req.body?.status === 'needs-attention' || req.body?.status === 'unreviewed'
      ? req.body.status
      : 'unreviewed';
    const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 2000) : undefined;
    run.proofReview = {
      status,
      ...(note ? { note } : {}),
      reviewedAt: new Date().toISOString(),
    };
    benchRuns.saveBenchRun(run);
    res.json({ ...run, previousDelta: benchRuns.getPreviousRunDelta(run) });
  });

  app.get('/api/bench/runs/:id/export', (req, res) => {
    const format = req.query.format as string || 'json';
    if (format === 'csv') {
      const csv = benchRuns.exportBenchRunCSV(req.params.id);
      if (!csv) return res.status(404).json({ error: 'Bench run not found' });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="bench-${req.params.id}.csv"`);
      res.send(csv);
    } else {
      const json = benchRuns.exportBenchRunJSON(req.params.id);
      if (!json) return res.status(404).json({ error: 'Bench run not found' });
      res.setHeader('Content-Type', 'application/json');
      res.send(json);
    }
  });
}
