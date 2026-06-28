import type { EvalReportSummary, PromptCase, PromptPluginRegistry, PromptPluginSummary } from './api';

export interface PromptPackLastUsed {
  packId: string;
  packName: string;
  reportId: string;
  reportName: string;
  status: string;
  usedAt: string;
  declaredEvalCount: number;
  matchedEvalCount: number;
}

export type PromptPackEvalReadinessStatus = 'ready' | 'partial' | 'missing' | 'empty';

export interface PromptPackEvalReadiness {
  status: PromptPackEvalReadinessStatus;
  label: string;
  installedCount: number;
  declaredCount: number;
  detail: string;
}

interface PromptPackEvalCoverage {
  id: string;
  installed: boolean;
  minimumScore: number;
  pluginIds: string[];
}

function reportUsedAt(report: EvalReportSummary): string {
  return report.completedAt || report.createdAt;
}

function stableTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRelativeUsage(usedAt: string, now: Date): string {
  const usedTime = stableTimestamp(usedAt);
  const nowTime = now.getTime();
  if (!usedTime || !Number.isFinite(nowTime)) return 'used time unknown';

  const elapsedMs = Math.max(0, nowTime - usedTime);
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (elapsedMs < minuteMs) return 'used just now';
  if (elapsedMs < hourMs) return `used ${Math.floor(elapsedMs / minuteMs)}m ago`;
  if (elapsedMs < dayMs) return `used ${Math.floor(elapsedMs / hourMs)}h ago`;
  return `used ${Math.floor(elapsedMs / dayMs)}d ago`;
}

function isNewerPackUsage(candidate: PromptPackLastUsed, current: PromptPackLastUsed): boolean {
  const candidateTime = stableTimestamp(candidate.usedAt);
  const currentTime = stableTimestamp(current.usedAt);
  if (candidateTime !== currentTime) return candidateTime > currentTime;
  return candidate.reportId.localeCompare(current.reportId) > 0;
}

export function buildPromptPackLastUsedMap(reports: EvalReportSummary[]): Map<string, PromptPackLastUsed> {
  const lastUsed = new Map<string, PromptPackLastUsed>();
  for (const report of reports) {
    const packContext = report.packContext;
    if (!packContext) continue;

    const declaredEvalIds = Array.isArray(packContext.evalIds) ? packContext.evalIds : [];
    const matchedEvalIds = Array.isArray(packContext.matchedEvalIds) ? packContext.matchedEvalIds : [];
    const candidate: PromptPackLastUsed = {
      packId: packContext.packId,
      packName: packContext.packName,
      reportId: report.id,
      reportName: report.name,
      status: report.status,
      usedAt: reportUsedAt(report),
      declaredEvalCount: declaredEvalIds.length,
      matchedEvalCount: matchedEvalIds.length,
    };

    const current = lastUsed.get(candidate.packId);
    if (!current || isNewerPackUsage(candidate, current)) {
      lastUsed.set(candidate.packId, candidate);
    }
  }
  return lastUsed;
}

export function formatPromptPackLastUsed(lastUsed: PromptPackLastUsed | undefined, now = new Date()): string {
  if (!lastUsed) return 'Last used: no Model Lab run recorded for this pack';
  const usedAt = new Date(lastUsed.usedAt).toLocaleString();
  return [
    `Last used: ${usedAt}`,
    formatRelativeUsage(lastUsed.usedAt, now),
    `report ${lastUsed.reportId}`,
    `matched ${lastUsed.matchedEvalCount}/${lastUsed.declaredEvalCount}`,
    lastUsed.status,
  ].join(' \u00b7 ');
}

export function formatPromptPackHistoryProvenance(report: EvalReportSummary): string | null {
  const packContext = report.packContext;
  if (!packContext) return null;
  const packLabel = packContext.packName.trim() || packContext.packId;
  const declaredEvalIds = Array.isArray(packContext.evalIds) ? packContext.evalIds : [];
  const matchedEvalIds = Array.isArray(packContext.matchedEvalIds) ? packContext.matchedEvalIds : [];
  return `Prompt pack: ${packLabel} \u00b7 ${matchedEvalIds.length}/${declaredEvalIds.length} evals matched`;
}

function uniqueNormalizedIds(ids: Iterable<string>): string[] {
  return Array.from(new Set(Array.from(ids, (id) => id.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function installedPromptIdSet(installedPromptIds: ReadonlySet<string> | readonly string[]): Set<string> {
  return new Set(uniqueNormalizedIds(installedPromptIds instanceof Set ? installedPromptIds : installedPromptIds));
}

export function summarizePromptPackEvalReadiness(
  declaredEvalIds: readonly string[],
  installedPromptIds: ReadonlySet<string> | readonly string[],
): PromptPackEvalReadiness {
  const declared = uniqueNormalizedIds(declaredEvalIds);
  if (declared.length === 0) {
    return {
      status: 'empty',
      label: 'No evals',
      installedCount: 0,
      declaredCount: 0,
      detail: 'No evals declared',
    };
  }

  const installed = installedPromptIdSet(installedPromptIds);
  const installedCount = declared.filter((id) => installed.has(id)).length;
  const status: PromptPackEvalReadinessStatus = installedCount === declared.length
    ? 'ready'
    : installedCount > 0
      ? 'partial'
      : 'missing';
  const label = status === 'ready' ? 'Ready' : status === 'partial' ? 'Partial' : 'Missing';
  return {
    status,
    label,
    installedCount,
    declaredCount: declared.length,
    detail: `${label} \u00b7 ${installedCount}/${declared.length} eval ids installed`,
  };
}

function buildPromptPackEvalCoverage(
  plugins: PromptPluginSummary[],
  prompts: PromptCase[],
): PromptPackEvalCoverage[] {
  const installedPromptIds = new Set(prompts.map((prompt) => prompt.id));
  const coverageById = new Map<string, { id: string; minimumScore: number; pluginIds: Set<string> }>();

  for (const plugin of plugins) {
    for (const ev of plugin.evals) {
      const current = coverageById.get(ev.id);
      if (current) {
        current.minimumScore = Math.max(current.minimumScore, ev.minimumScore);
        current.pluginIds.add(plugin.id);
      } else {
        coverageById.set(ev.id, {
          id: ev.id,
          minimumScore: ev.minimumScore,
          pluginIds: new Set([plugin.id]),
        });
      }
    }
  }

  return Array.from(coverageById.values())
    .map((ev) => ({
      id: ev.id,
      installed: installedPromptIds.has(ev.id),
      minimumScore: ev.minimumScore,
      pluginIds: Array.from(ev.pluginIds).sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function buildPromptPackEvidenceBrief(
  pack: PromptPluginRegistry['packs'][number],
  plugins: PromptPluginSummary[],
  prompts: PromptCase[],
  lastUsed?: PromptPackLastUsed,
): string {
  const evals = buildPromptPackEvalCoverage(plugins, prompts);
  const installed = evals.filter((ev) => ev.installed);
  const readiness = summarizePromptPackEvalReadiness(evals.map((ev) => ev.id), prompts.map((prompt) => prompt.id));
  const blockedPlugins = plugins.filter((plugin) => plugin.status !== 'ready' || plugin.trust === 'blocked');
  return [
    '# Prompt Pack Evidence Brief',
    '',
    `Pack: ${pack.name}`,
    `Pack id: ${pack.id}`,
    `Trust: ${pack.trust}`,
    `Sources: ${pack.sources.join(', ') || 'none recorded'}`,
    `Manifest count: ${pack.pluginCount}`,
    `Plugin ids: ${pack.pluginIds.join(', ') || 'none recorded'}`,
    '',
    '## Last used',
    '',
    ...(lastUsed ? [
      formatPromptPackLastUsed(lastUsed),
      `Report id: ${lastUsed.reportId}`,
      `Report name: ${lastUsed.reportName}`,
      `Status: ${lastUsed.status}`,
      `Used at: ${lastUsed.usedAt}`,
      `Matched evals: ${lastUsed.matchedEvalCount}/${lastUsed.declaredEvalCount}`,
    ] : [
      'No Model Lab run recorded for this pack yet.',
    ]),
    '',
    '## Eval coverage',
    '',
    `Eval readiness: ${readiness.detail}`,
    `Unique declared eval ids: ${evals.length}`,
    `Installed eval ids: ${installed.length}/${evals.length}`,
    '',
    ...(evals.length > 0
      ? evals.map((ev) => `- ${ev.id}: ${ev.installed ? 'installed' : 'missing'}; minimum score ${ev.minimumScore}; declared by ${ev.pluginIds.join(', ')}`)
      : ['- No eval IDs declared by this pack.']),
    '',
    '## Manifest health',
    '',
    ...(plugins.length > 0
      ? plugins.map((plugin) => [
        `- ${plugin.name} (${plugin.id})`,
        `  Status: ${plugin.status}; trust: ${plugin.trust}; version: ${plugin.version}`,
        `  Sections: ${plugin.sections.length}; evals: ${plugin.evals.length}; path: ${plugin.path}`,
        plugin.issues.length > 0 ? `  Issues: ${plugin.issues.join('; ')}` : '',
      ].filter(Boolean).join('\n'))
      : ['- No plugin manifests matched this pack in the current registry.']),
    '',
    '## Risks',
    '',
    ...(blockedPlugins.length > 0
      ? blockedPlugins.map((plugin) => `- ${plugin.id}: ${plugin.status}/${plugin.trust}${plugin.issues.length ? ` - ${plugin.issues.join('; ')}` : ''}`)
      : ['- No blocked or invalid plugin manifests detected for this pack.']),
    '',
    '## Next proof action',
    '',
    installed.length > 0
      ? `Run Model Lab Eval with the ${installed.length} installed prompt id${installed.length === 1 ? '' : 's'} selected from this pack, then export the eval proof brief.`
      : 'Add or install matching eval prompt cases before claiming this pack has runnable proof.',
  ].join('\n');
}
