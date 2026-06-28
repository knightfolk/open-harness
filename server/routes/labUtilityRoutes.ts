import express from 'express';
import { resolve } from 'path';

import type { StoredConfig } from '../config';
import type { ApprovalAction } from '../actionApprovals';
import * as evals from '../evals';
import { listCapabilities, setCapabilityEnabled, type CapabilityKind } from '../capabilities';
import { ensurePromptPluginRoots, importSkillAsPromptPlugin, listPromptPlugins, type PromptPluginRegistry } from '../promptPlugins';
import { PROMPT_STRATEGY_PROFILES } from '../promptStrategies';
import { estimateSections, redactSecrets } from '../sectionRedaction';
import { isPathWithin } from '../toolPolicy';

interface LabUtilityRouteDeps {
  getConfig: () => StoredConfig;
  saveConfig: (config: StoredConfig) => void;
  ensureLocalMutationWithControl: (req: express.Request) => { ok: true } | { ok: false; status: number; error: string };
  ensureExplicitApproval: (req: express.Request, action: ApprovalAction) => { ok: true } | { ok: false; status: number; error: string; approval?: unknown };
  ensureKnownWorkspace: (dir: string) => { ok: true; dir: string } | { ok: false; status: number; error: string };
  buildRunDebugBundle: (sessionId: string, messageId: string) => { run: { id: string } } | null;
  buildRunDebugBundleByRunId: (runId: string) => { run: { id: string } } | null;
}

function optionalWorkspace(
  rawWorkingDir: unknown,
  deps: LabUtilityRouteDeps,
): { ok: true; dir?: string } | { ok: false; status: number; error: string } {
  const workingDir = typeof rawWorkingDir === 'string' ? rawWorkingDir : undefined;
  if (!workingDir) return { ok: true, dir: undefined };
  return deps.ensureKnownWorkspace(workingDir);
}

function promptPluginManifestId(id: string): string {
  const trimmed = id.trim();
  return trimmed.startsWith('prompt-plugin.') ? trimmed.slice('prompt-plugin.'.length) : trimmed;
}

function injectablePromptPluginIds(registry: PromptPluginRegistry): Set<string> {
  return new Set(registry.plugins
    .filter((plugin) => (
      plugin.enabled
      && plugin.status === 'ready'
      && !plugin.safety.canOverrideProjectInstructions
    ))
    .map((plugin) => plugin.id));
}

function normalizePromptPluginRenderingForRegistry(
  config: StoredConfig['promptPluginRendering'],
  registry: PromptPluginRegistry,
): NonNullable<StoredConfig['promptPluginRendering']> {
  const enabled = config?.enabled === true;
  if (!enabled) return { enabled: false, allowedPluginIds: [] };
  const injectableIds = injectablePromptPluginIds(registry);
  const allowedPluginIds = [...new Set((config?.allowedPluginIds || [])
    .filter((id): id is string => typeof id === 'string')
    .map(promptPluginManifestId)
    .filter((id) => injectableIds.has(id)))]
    .sort();
  return { enabled: true, allowedPluginIds };
}

export function registerLabUtilityRoutes(app: express.Express, deps: LabUtilityRouteDeps) {
  app.get('/api/evals/prompts', (_req, res) => {
    res.json(evals.getAllPrompts());
  });

  app.get('/api/prompt-strategies', (_req, res) => {
    res.json(Object.values(PROMPT_STRATEGY_PROFILES));
  });

  app.get('/api/evals/reports', (_req, res) => {
    res.json(evals.listReports());
  });

  app.get('/api/evals/reports/:id', (req, res) => {
    const report = evals.getReport(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json({ ...report, artifactPath: evals.getEvalArtifactPath(req.params.id) });
  });

  app.post('/api/evals/reports/:id/proof-review', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const report = evals.getReport(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    const status = req.body?.status === 'approved' || req.body?.status === 'needs-attention' || req.body?.status === 'unreviewed'
      ? req.body.status
      : 'unreviewed';
    const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 2000) : undefined;
    report.proofReview = {
      status,
      ...(note ? { note } : {}),
      reviewedAt: new Date().toISOString(),
    };
    evals.saveReport(report);
    res.json(report);
  });

  app.get('/api/evals/reports/:id/recommendation-report', (req, res) => {
    const markdown = evals.exportEvalRecommendationMarkdown(req.params.id);
    if (!markdown) return res.status(404).json({ error: 'Report not found' });
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="eval-recommendations-${req.params.id}.md"`);
    res.send(markdown);
  });

  app.get('/api/evals/recommendations', (_req, res) => {
    res.json(evals.getLatestEvalRecommendations());
  });

  app.get('/api/capabilities', (req, res) => {
    const targetWorkspace = optionalWorkspace(req.query.workingDir, deps);
    if (!targetWorkspace.ok) return res.status(targetWorkspace.status).json({ error: targetWorkspace.error });
    const appConfig = deps.getConfig();
    res.json(listCapabilities(appConfig.capabilitySettings, listPromptPlugins(targetWorkspace.dir, appConfig.capabilitySettings?.disabledPlugins)));
  });

  app.put('/api/capabilities/:kind/:id', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const kind = req.params.kind as CapabilityKind;
    if (kind !== 'skills' && kind !== 'plugins') return res.status(400).json({ error: 'kind must be skills or plugins' });
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!id) return res.status(400).json({ error: 'id is required' });
    const appConfig = deps.getConfig();
    appConfig.capabilitySettings = setCapabilityEnabled(appConfig.capabilitySettings, kind, id, req.body?.enabled === true);
    deps.saveConfig(appConfig);
    const targetWorkspace = optionalWorkspace(req.body?.workingDir, deps);
    if (!targetWorkspace.ok) return res.status(targetWorkspace.status).json({ error: targetWorkspace.error });
    res.json(listCapabilities(appConfig.capabilitySettings, listPromptPlugins(targetWorkspace.dir, appConfig.capabilitySettings?.disabledPlugins)));
  });

  app.put('/api/prompt-plugin-rendering', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const targetWorkspace = optionalWorkspace(req.body?.workingDir, deps);
    if (!targetWorkspace.ok) return res.status(targetWorkspace.status).json({ error: targetWorkspace.error });
    const appConfig = deps.getConfig();
    const registry = listPromptPlugins(targetWorkspace.dir, appConfig.capabilitySettings?.disabledPlugins);
    appConfig.promptPluginRendering = normalizePromptPluginRenderingForRegistry({
      enabled: req.body?.enabled === true,
      allowedPluginIds: req.body?.enabled === true ? appConfig.promptPluginRendering?.allowedPluginIds || [] : [],
    }, registry);
    deps.saveConfig(appConfig);
    res.json(appConfig.promptPluginRendering);
  });

  app.put('/api/prompt-plugin-rendering/plugins/:id', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const targetWorkspace = optionalWorkspace(req.body?.workingDir, deps);
    if (!targetWorkspace.ok) return res.status(targetWorkspace.status).json({ error: targetWorkspace.error });
    const appConfig = deps.getConfig();
    const registry = listPromptPlugins(targetWorkspace.dir, appConfig.capabilitySettings?.disabledPlugins);
    const current = normalizePromptPluginRenderingForRegistry(appConfig.promptPluginRendering, registry);
    const allowedIds = new Set(current.allowedPluginIds);
    const manifestId = promptPluginManifestId(req.params.id || '');
    if (current.enabled && req.body?.allowed === true && injectablePromptPluginIds(registry).has(manifestId)) {
      allowedIds.add(manifestId);
    } else {
      allowedIds.delete(manifestId);
    }
    appConfig.promptPluginRendering = normalizePromptPluginRenderingForRegistry({
      enabled: current.enabled,
      allowedPluginIds: [...allowedIds],
    }, registry);
    deps.saveConfig(appConfig);
    res.json(appConfig.promptPluginRendering);
  });

  app.get('/api/prompt-plugins', (req, res) => {
    const targetWorkspace = optionalWorkspace(req.query.workingDir, deps);
    if (!targetWorkspace.ok) return res.status(targetWorkspace.status).json({ error: targetWorkspace.error });
    const appConfig = deps.getConfig();
    res.json(listPromptPlugins(targetWorkspace.dir, appConfig.capabilitySettings?.disabledPlugins));
  });

  app.post('/api/prompt-plugins/ensure-roots', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const targetWorkspace = optionalWorkspace(req.body?.workingDir, deps);
    if (!targetWorkspace.ok) return res.status(targetWorkspace.status).json({ error: targetWorkspace.error });
    const appConfig = deps.getConfig();
    ensurePromptPluginRoots(targetWorkspace.dir);
    res.json(listPromptPlugins(targetWorkspace.dir, appConfig.capabilitySettings?.disabledPlugins));
  });

  app.post('/api/prompt-plugins/import-skill', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const workingDir = typeof req.body?.workingDir === 'string' ? req.body.workingDir : undefined;
    const sourcePath = typeof req.body?.sourcePath === 'string' ? req.body.sourcePath : '';
    if (!workingDir) return res.status(400).json({ error: 'workingDir is required' });
    if (!sourcePath.trim()) return res.status(400).json({ error: 'sourcePath is required' });
    const targetWorkspace = deps.ensureKnownWorkspace(workingDir);
    if (!targetWorkspace.ok) return res.status(targetWorkspace.status).json({ error: targetWorkspace.error });
    const resolvedSource = resolve(sourcePath);
    if (!isPathWithin(resolvedSource, targetWorkspace.dir)) {
      const approval = deps.ensureExplicitApproval(req, {
        kind: 'read',
        route: '/api/prompt-plugins/import-skill',
        description: 'Import prompt skill instructions from outside the active workspace',
        cwd: targetWorkspace.dir,
        paths: [resolvedSource],
      });
      if (!approval.ok) return res.status(approval.status).json({ error: approval.error, approval: approval.approval });
    }
    const appConfig = deps.getConfig();
    const result = importSkillAsPromptPlugin(targetWorkspace.dir, sourcePath);
    if (!result.ok) return res.status(400).json(result);
    res.status(201).json({ ...result, registry: listPromptPlugins(targetWorkspace.dir, appConfig.capabilitySettings?.disabledPlugins) });
  });

  app.get('/api/sessions/:sessionId/messages/:messageId/debug-bundle', (req, res) => {
    const bundle = deps.buildRunDebugBundle(req.params.sessionId, req.params.messageId);
    if (!bundle) return res.status(404).json({ error: 'Run debug bundle not found' });
    res.setHeader('Content-Disposition', `attachment; filename="openharness-run-${bundle.run.id}.json"`);
    res.json(bundle);
  });

  app.get('/api/runs/:runId/debug-bundle', (req, res) => {
    const bundle = deps.buildRunDebugBundleByRunId(req.params.runId);
    if (!bundle) return res.status(404).json({ error: 'Run debug bundle not found' });
    res.setHeader('Content-Disposition', `attachment; filename="openharness-run-${bundle.run.id}.json"`);
    res.json(bundle);
  });

  app.post('/api/prompt/redact', (req, res) => {
    const text = (req.body as { text?: string })?.text ?? '';
    const result = redactSecrets(text);
    res.json(result);
  });

  app.post('/api/prompt/estimate', (req, res) => {
    const sections = ((req.body as { sections?: Array<{ id: string; label: string; text: string }> })?.sections) ?? [];
    res.json({ sections: estimateSections(sections) });
  });
}
