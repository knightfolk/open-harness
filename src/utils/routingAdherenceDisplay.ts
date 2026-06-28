import type { RoutingAdherenceEvent, RoutingEvent } from './api';

export const PROVIDER_FAILURE_SCOPE_NOTE = 'Shows the most recent provider-stream failures from a rolling tail of the adherence log, not a full-history audit. Older entries may have aged out.';
export const PROVIDER_FAILURE_STRATEGY_LINK_MIN_FRACTION = 0.5;

export interface ProviderFailureRow {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
  runId?: string;
  attemptPath: string;
  terminalProvider: string;
  terminalTimeout: string;
  cause: ProviderFailureCause;
  promptHash?: string;
  routingContext?: ProviderFailureRoutingContext;
  error: string;
}

export type ProviderFailureCause = 'rate_limit' | 'auth' | 'timeout' | 'network' | 'server_5xx' | 'client_4xx' | 'aborted' | 'unknown';

export interface ProviderFailureRoutingContext {
  runId: string;
  selectedModel: string;
  taskType: string;
  role: string;
  promptStrategyId?: string;
  promptStrategyFamily?: string;
  promptStrategyStyle?: string;
  promptStrategyVariantId?: string;
  promptStrategySelectionReason?: string;
}

export interface ProviderFailureSummary {
  rowCount: number;
  terminalProviderCount: number;
  distinctAttemptPathCount: number;
  distinctErrorCount: number;
  promptHashedFailureCount: number;
  distinctPromptHashCount: number;
  routingContextLinkedCount: number;
  routingContextUnmatchedRunCount: number;
  distinctPromptStrategyCount: number;
  causeCounts: Partial<Record<ProviderFailureCause, number>>;
  dominantCause: ProviderFailureCause | null;
}

export interface ProviderFailureStrategyBreakdown {
  strategyId: string;
  failureCount: number;
  selectedModelCount: number;
  modelCounts: Array<{ model: string; count: number }>;
  causeCounts: Partial<Record<ProviderFailureCause, number>>;
  dominantCause: ProviderFailureCause | null;
}

export interface ProviderFailureStrategyEvidence {
  strategyId: string;
  breakdown: ProviderFailureStrategyBreakdown;
  rows: ProviderFailureRow[];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function stringArrayValue(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function ms(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 'timeout unknown';
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
  return `${Math.round(value)}ms`;
}

function eventTimeLabel(value: string): string {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return 'time unknown';
  return new Date(time).toISOString();
}

function buildRoutingContextIndex(events: RoutingEvent[]): Map<string, ProviderFailureRoutingContext> {
  const index = new Map<string, ProviderFailureRoutingContext>();
  for (const event of events) {
    if (!event.runId || index.has(event.runId)) continue;
    index.set(event.runId, {
      runId: event.runId,
      selectedModel: event.selectedModel,
      taskType: event.taskType || 'unknown',
      role: event.role || 'unknown',
      promptStrategyId: event.promptStrategyId,
      promptStrategyFamily: event.promptStrategyFamily,
      promptStrategyStyle: event.promptStrategyStyle,
      promptStrategyVariantId: event.promptStrategyVariantId,
      promptStrategySelectionReason: event.promptStrategySelectionReason,
    });
  }
  return index;
}

export function classifyProviderFailureCause(event: Pick<RoutingAdherenceEvent, 'kind' | 'statusCode' | 'error'>): ProviderFailureCause {
  if (event.kind === 'abort') return 'aborted';
  if (event.kind === 'timeout') return 'timeout';
  const statusCode = event.statusCode;
  if (typeof statusCode === 'number' && Number.isFinite(statusCode)) {
    if (statusCode === 429) return 'rate_limit';
    if (statusCode === 401 || statusCode === 403) return 'auth';
    if (statusCode >= 500 && statusCode <= 599) return 'server_5xx';
    if (statusCode >= 400 && statusCode <= 499) return 'client_4xx';
  }
  const error = (event.error || '').toLowerCase();
  if (/rate\s*limit|too many requests|\b429\b/.test(error)) return 'rate_limit';
  if (/unauthorized|forbidden|api key|auth|credential|\b401\b|\b403\b/.test(error)) return 'auth';
  if (/timeout|timed out|deadline/.test(error)) return 'timeout';
  if (/econnreset|enotfound|network|socket hang up|connection reset|fetch failed/.test(error)) return 'network';
  if (/\b5\d\d\b|server error|service unavailable|bad gateway|gateway timeout/.test(error)) return 'server_5xx';
  if (/\b4\d\d\b|bad request|not found|invalid request/.test(error)) return 'client_4xx';
  return 'unknown';
}

export function buildProviderFailureRows(events: RoutingAdherenceEvent[], limit = 5, routingEvents: RoutingEvent[] = []): ProviderFailureRow[] {
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 5;
  const routingContextByRunId = buildRoutingContextIndex(routingEvents);
  return events
    .filter((event) => event.phase === 'provider-stream')
    .slice(0, safeLimit)
    .map((event) => {
      const metadata = event.metadata || {};
      const selectedModel = event.selectedModel || 'unknown model';
      const fallbackModel = event.fallbackModelId || stringValue(metadata.lastAttemptedModelId);
      const terminalModel = stringValue(metadata.lastAttemptedModelId) || fallbackModel || selectedModel;
      const terminalProvider = stringValue(metadata.lastAttemptedProviderId) || event.providerId || 'unknown provider';
      const terminalTimeout = ms(typeof metadata.lastAttemptedTimeoutMs === 'number' ? metadata.lastAttemptedTimeoutMs : event.timeoutMs);
      const attemptedModels = stringArrayValue(metadata.attemptedProviderModels);
      const attemptPath = attemptedModels.length > 0 ? attemptedModels.join(' -> ') : 'attempt path unavailable';
      const title = fallbackModel && fallbackModel !== selectedModel
        ? `${selectedModel} -> ${fallbackModel}`
        : selectedModel;

      return {
        id: event.id,
        title,
        detail: [
          `Terminal provider ${terminalProvider}`,
          `model ${terminalModel}`,
          fallbackModel && fallbackModel !== selectedModel ? `fallback ${fallbackModel}` : undefined,
          terminalTimeout,
        ].filter(Boolean).join(' · '),
        createdAt: eventTimeLabel(event.createdAt),
        runId: event.runId,
        attemptPath,
        terminalProvider,
        terminalTimeout,
        cause: classifyProviderFailureCause(event),
        promptHash: event.promptHash,
        routingContext: event.runId ? routingContextByRunId.get(event.runId) : undefined,
        error: event.error || `${event.kind} during provider stream`,
      };
    });
}

export function summarizeProviderFailureAdherence(rows: ProviderFailureRow[]): ProviderFailureSummary {
  const causeCounts: Partial<Record<ProviderFailureCause, number>> = {};
  for (const row of rows) causeCounts[row.cause] = (causeCounts[row.cause] || 0) + 1;
  const dominantCause = Object.entries(causeCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] as ProviderFailureCause | undefined;
  return {
    rowCount: rows.length,
    terminalProviderCount: new Set(rows.map((row) => row.terminalProvider)).size,
    distinctAttemptPathCount: new Set(rows.map((row) => row.attemptPath)).size,
    distinctErrorCount: new Set(rows.map((row) => row.error)).size,
    promptHashedFailureCount: rows.filter((row) => Boolean(row.promptHash)).length,
    distinctPromptHashCount: new Set(rows.map((row) => row.promptHash).filter(Boolean)).size,
    routingContextLinkedCount: rows.filter((row) => Boolean(row.routingContext)).length,
    routingContextUnmatchedRunCount: rows.filter((row) => Boolean(row.runId) && !row.routingContext).length,
    distinctPromptStrategyCount: new Set(rows.map((row) => row.routingContext?.promptStrategyId).filter(Boolean)).size,
    causeCounts,
    dominantCause: dominantCause || null,
  };
}

export function formatProviderFailureDistinctStrategyLabel(summary: Pick<ProviderFailureSummary, 'distinctPromptStrategyCount'>): string | null {
  return summary.distinctPromptStrategyCount > 1
    ? `${summary.distinctPromptStrategyCount} distinct prompt strategies`
    : null;
}

export function buildProviderFailureStrategyBreakdown(rows: ProviderFailureRow[]): ProviderFailureStrategyBreakdown[] {
  const groups = new Map<string, {
    failureCount: number;
    modelCounts: Map<string, number>;
    causeCounts: Partial<Record<ProviderFailureCause, number>>;
  }>();

  for (const row of rows) {
    const strategyId = row.routingContext?.promptStrategyId;
    if (!strategyId) continue;
    const group = groups.get(strategyId) || {
      failureCount: 0,
      modelCounts: new Map<string, number>(),
      causeCounts: {},
    };
    group.failureCount += 1;
    const selectedModel = row.routingContext?.selectedModel || 'unknown model';
    group.modelCounts.set(selectedModel, (group.modelCounts.get(selectedModel) || 0) + 1);
    group.causeCounts[row.cause] = (group.causeCounts[row.cause] || 0) + 1;
    groups.set(strategyId, group);
  }

  return Array.from(groups.entries())
    .map(([strategyId, group]) => {
      const dominantCause = Object.entries(group.causeCounts)
        .sort(([causeA, countA], [causeB, countB]) => (countB || 0) - (countA || 0) || causeA.localeCompare(causeB))[0]?.[0] as ProviderFailureCause | undefined;
      return {
        strategyId,
        failureCount: group.failureCount,
        selectedModelCount: group.modelCounts.size,
        modelCounts: Array.from(group.modelCounts.entries())
          .sort(([modelA, countA], [modelB, countB]) => countB - countA || modelA.localeCompare(modelB))
          .map(([model, count]) => ({ model, count })),
        causeCounts: group.causeCounts,
        dominantCause: dominantCause || null,
      };
    })
    .sort((a, b) => b.failureCount - a.failureCount || a.strategyId.localeCompare(b.strategyId));
}

export function buildProviderFailureStrategyEvidence(rows: ProviderFailureRow[], strategyId: string): ProviderFailureStrategyEvidence {
  const matchingRows = rows.filter((row) => row.routingContext?.promptStrategyId === strategyId);
  const breakdown = buildProviderFailureStrategyBreakdown(matchingRows)[0] || {
    strategyId,
    failureCount: 0,
    selectedModelCount: 0,
    modelCounts: [],
    causeCounts: {},
    dominantCause: null,
  };
  return {
    strategyId,
    breakdown,
    rows: matchingRows,
  };
}

export function formatProviderFailureStrategyFailureShareWidth(failureCount: number, maxFailureCount: number): string {
  if (!Number.isFinite(failureCount) || !Number.isFinite(maxFailureCount) || failureCount <= 0 || maxFailureCount <= 0) {
    return '0%';
  }
  return `${Math.round(Math.min(1, failureCount / maxFailureCount) * 100)}%`;
}

export function deriveProviderFailureRoutingHint(summary: ProviderFailureSummary): string {
  if (summary.rowCount < 3) {
    return `Insufficient samples (${summary.rowCount}); collect more before adjusting routing.`;
  }
  const linkedRows = summary.routingContextLinkedCount || 0;
  const unmatchedRuns = summary.routingContextUnmatchedRunCount || 0;
  const runLinkedRows = linkedRows + unmatchedRuns;
  if (runLinkedRows > 0 && linkedRows === 0) {
    return `No loaded routing decisions matched ${unmatchedRuns} provider failure run ids; refresh routing decisions before interpreting prompt-strategy context.`;
  }
  if (runLinkedRows > 0 && linkedRows / summary.rowCount < PROVIDER_FAILURE_STRATEGY_LINK_MIN_FRACTION) {
    return `Routing context is partial (${linkedRows}/${summary.rowCount} rows linked); refresh routing decisions before interpreting prompt-strategy context.`;
  }
  if (linkedRows > 0 && summary.distinctPromptStrategyCount >= 2) {
    return `Provider failures span ${summary.distinctPromptStrategyCount} prompt strategies across ${linkedRows}/${summary.rowCount} linked rows; compare strategy-specific failures before rerouting.`;
  }
  if (summary.promptHashedFailureCount >= Math.ceil(summary.rowCount / 2) && summary.distinctPromptHashCount === 1) {
    return `Failures cluster on one prompt hash (${summary.promptHashedFailureCount}/${summary.rowCount}); revise that prompt before changing routing.`;
  }
  if (summary.promptHashedFailureCount >= Math.ceil(summary.rowCount / 2)) {
    return `Prompt hashes cover ${summary.promptHashedFailureCount}/${summary.rowCount} rows across ${summary.distinctPromptHashCount} prompts; compare prompt content before changing routing.`;
  }
  if (summary.distinctAttemptPathCount >= Math.ceil(summary.rowCount * 0.8)) {
    return `Near-unique attempt paths (${summary.distinctAttemptPathCount}/${summary.rowCount}); apply backoff or circuit-breaking before rerouting.`;
  }
  if (summary.terminalProviderCount === 1) {
    return `Single terminal provider (${summary.terminalProviderCount}); deprioritize or fail over.`;
  }
  if (summary.distinctErrorCount > summary.rowCount / 2) {
    return `Heterogeneous errors (${summary.distinctErrorCount} distinct); improve diagnostics before rerouting.`;
  }
  return `Dominant cause: ${summary.dominantCause || 'unknown'}; monitor and reroute on recurrence.`;
}
