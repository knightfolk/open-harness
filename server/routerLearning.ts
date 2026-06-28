/**
 * server/routerLearning.ts
 *
 * Cross-session routing learning system.
 * Persists routing decisions and outcome signals to disk, and provides
 * query functions for the auto-router to learn from historical data.
 *
 * Storage layout:
 *   ~/.openharness/router-learning/
 *     events.jsonl    — append-only log of routing events
 *     summary.json    — aggregated stats (updated periodically)
 *
 * Each event records the decision, context, and (when available) a
 * success/failure signal that can be used to improve future routing.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { MODEL_REQUEST_SLOW_DURATION_MS, isSlowModelRequestDurationMs } from '../shared/modelRequestDuration';
import { redactSecrets } from './sectionRedaction';

// ── Types ──────────────────────────────────────────────

export type ModelSelectionPolicy = 'cheap-direct' | 'classifier' | 'escalated';

export interface RoutingRouteSignal {
  hasImages: boolean;
  turns: number;
  toolCount: number;
  estimatedInputTokens: number;
  artifactCount?: number;
  dirtyGitState?: boolean;
  thinkingEffort?: string;
  requiresStrongToolUse?: boolean;
}

export interface RoutingTaskPromptSnapshot {
  text: string;
  hash: string;
  charCount: number;
  redactedHits: number;
  truncated: boolean;
  limit: number;
}

export interface RoutingEvent {
  /** Unique event ID */
  id: string;
  /** ISO timestamp */
  timestamp: string;
  /** Session this event belongs to */
  sessionId: string;
  /** Harness run this decision belongs to, when available */
  runId?: string;
  /** The task text (hashed for privacy, full text in dev mode) */
  taskHash: string;
  /** Bounded redacted routed-task prompt evidence for offline replay review */
  taskPromptSnapshot?: RoutingTaskPromptSnapshot;
  /** The model that was selected */
  selectedModel: string;
  /** Auto-router score for the selected model (0-1) */
  score: number;
  /** Classifier viability threshold used for this decision, when classifier routing ran */
  threshold?: number;
  /** All candidate scores */
  candidateScores: Record<string, number>;
  /** Whether the fallback was used */
  wasFallback: boolean;
  /** Whether the decision was cached */
  wasCached: boolean;
  /** Deterministic model-selection policy used before/around classifier scoring */
  modelSelectionPolicy?: ModelSelectionPolicy;
  /** Route input features used by the workflow/model router */
  routeSignal?: RoutingRouteSignal;
  /** The classifier model used */
  classifierModel: string | null;
  /** Routing mode (orchestrator/worker) */
  surface: string;
  /** Complexity as determined by heuristic router */
  complexity: string;
  /** Routed task intent (direct, execute, investigate, plan, compare) */
  taskType: string;
  /** Role bucket used for routing */
  role: string;
  /** Prompt strategy profile selected for the model family */
  promptStrategyId?: string;
  /** Prompt strategy family bucket */
  promptStrategyFamily?: string;
  /** Prompt strategy system style */
  promptStrategyStyle?: string;
  /** Prompt strategy role/task variant */
  promptStrategyVariantId?: string;
  /** Prompt strategy inferred task type */
  promptStrategyTaskType?: string;
  /** Prompt strategy variant selection reason */
  promptStrategySelectionReason?: string;
  /** Measured first model request duration for this routed run, when explicitly captured */
  modelRequestDurationMs?: number;
  /** User turns at time of routing */
  userTurns: number;
  /** Outcome signal (null until received) */
  outcome: 'success' | 'failure' | 'ambiguous' | null;
  /** Human-readable note about the outcome */
  outcomeNote?: string;
  /** Whether the event should influence production learning summaries */
  datasetKind?: 'production' | 'benchmark';
}

export type RoutingDecisionInput = Omit<RoutingEvent, 'outcome' | 'outcomeNote' | 'id'> & {
  /** Raw routed task text; redacted and capped before persistence */
  taskPromptText?: string;
};

export interface TaskTypeModelSuccess {
  total: number;
  success: number;
  rate: number;
  sampleCount: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
}

export interface BestTaskTypeRoutingSignal extends TaskTypeModelSuccess {
  taskType: string;
  model: string;
}

export interface TaskTypeRoutingSummary {
  total: number;
  success: number;
  rate: number;
  byModel: Record<string, TaskTypeModelSuccess>;
}

export interface ModelRequestDurationBucket {
  samples: number;
  avgMs: number;
  slow: boolean;
  thresholdMs: number;
}

export interface ModelRequestDurationSummary {
  byModel: Record<string, ModelRequestDurationBucket>;
  byTaskType: Record<string, ModelRequestDurationBucket>;
}

export interface LearningSummary {
  totalEvents: number;
  models: Record<string, { total: number; success: number; rate: number }>;
  successRate: number;
  outdated: boolean;
  byTaskType: Record<string, TaskTypeRoutingSummary>;
  byRole: Record<string, TaskTypeRoutingSummary>;
  byComplexity: Record<string, TaskTypeRoutingSummary>;
  byPromptStrategy: Record<string, TaskTypeRoutingSummary>;
  byPromptStrategyFamily: Record<string, TaskTypeRoutingSummary>;
  byPromptStrategyVariant: Record<string, TaskTypeRoutingSummary>;
  modelRequestDuration: ModelRequestDurationSummary;
  bestByTaskType: BestTaskTypeRoutingSignal[];
  bestPromptStrategyVariants: Array<{ strategyVariant: string; model: string; total: number; success: number; rate: number }>;
}

export interface RoutingImportResult {
  total: number;
  imported: number;
  skippedExisting: number;
  rejected: number;
  dryRun?: boolean;
  importSource?: string;
  schemaVersion?: number | null;
  warnings?: string[];
  datasetKind?: 'production' | 'benchmark';
}

// ── Storage ────────────────────────────────────────────

const BASE_DIR = join(homedir(), '.openharness', 'router-learning');
export const ROUTING_TASK_PROMPT_SNAPSHOT_CHAR_LIMIT = 4000;

function ensureDir(): void {
  if (!existsSync(BASE_DIR)) mkdirSync(BASE_DIR, { recursive: true });
}

function eventsPath(): string {
  return join(BASE_DIR, 'events.jsonl');
}

function readEvents(path: string): RoutingEvent[] {
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, 'utf-8').split('\n').filter(Boolean);
  const events: RoutingEvent[] = [];
  for (const line of lines) {
    try {
      const e = JSON.parse(line) as RoutingEvent;
      events.push(e);
    } catch {
      // skip malformed lines
    }
  }
  return events;
}

function normalizeString(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function stableTextHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function normalizeSnapshotLimit(value: unknown): number {
  const limit = Number(value);
  if (!Number.isFinite(limit) || limit <= 0) return ROUTING_TASK_PROMPT_SNAPSHOT_CHAR_LIMIT;
  return Math.min(ROUTING_TASK_PROMPT_SNAPSHOT_CHAR_LIMIT, Math.floor(limit));
}

export function buildRoutingTaskPromptSnapshot(taskPromptText: unknown): RoutingTaskPromptSnapshot | undefined {
  if (typeof taskPromptText !== 'string') return undefined;
  const redaction = redactSecrets(taskPromptText);
  const charCount = redaction.redacted.length;
  const truncated = charCount > ROUTING_TASK_PROMPT_SNAPSHOT_CHAR_LIMIT;
  const text = truncated
    ? redaction.redacted.slice(0, ROUTING_TASK_PROMPT_SNAPSHOT_CHAR_LIMIT)
    : redaction.redacted;
  return {
    text,
    hash: stableTextHash(redaction.redacted),
    charCount,
    redactedHits: redaction.hits.length,
    truncated,
    limit: ROUTING_TASK_PROMPT_SNAPSHOT_CHAR_LIMIT,
  };
}

function normalizeRoutingTaskPromptSnapshot(value: unknown): RoutingTaskPromptSnapshot | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const input = value as Record<string, unknown>;
  if (typeof input.text !== 'string') return undefined;
  const limit = normalizeSnapshotLimit(input.limit);
  const redaction = redactSecrets(input.text);
  const charCount = Math.max(
    redaction.redacted.length,
    Number.isFinite(Number(input.charCount)) ? Math.floor(Number(input.charCount)) : 0,
  );
  const truncated = redaction.redacted.length > limit || Boolean(input.truncated);
  const text = redaction.redacted.slice(0, limit);
  return {
    text,
    hash: typeof input.hash === 'string' && /^[a-z0-9]{8}$/i.test(input.hash)
      ? input.hash
      : stableTextHash(redaction.redacted),
    charCount,
    redactedHits: Math.max(
      redaction.hits.length,
      Number.isFinite(Number(input.redactedHits)) ? Math.floor(Number(input.redactedHits)) : 0,
    ),
    truncated,
    limit,
  };
}

function updateTimestampRange(stat: { firstSeenAt: string | null; lastSeenAt: string | null }, timestamp: string): void {
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time)) return;
  if (!stat.firstSeenAt || time < Date.parse(stat.firstSeenAt)) stat.firstSeenAt = timestamp;
  if (!stat.lastSeenAt || time > Date.parse(stat.lastSeenAt)) stat.lastSeenAt = timestamp;
}

function addTimedSuccess(
  statMap: Record<string, { total: number; success: number; firstSeenAt: string | null; lastSeenAt: string | null }>,
  key: string,
  isSuccess: boolean,
  timestamp: string,
): void {
  if (!statMap[key]) statMap[key] = { total: 0, success: 0, firstSeenAt: null, lastSeenAt: null };
  statMap[key].total += 1;
  if (isSuccess) statMap[key].success += 1;
  updateTimestampRange(statMap[key], timestamp);
}

function toRate(stats: Record<string, { total: number; success: number }>): Record<string, { total: number; success: number; rate: number }> {
  const out: Record<string, { total: number; success: number; rate: number }> = {};
  for (const [model, s] of Object.entries(stats)) {
    out[model] = {
      ...s,
      rate: s.total > 0 ? s.success / s.total : 0,
    };
  }
  return out;
}

function buildSummaryByKey(
  events: RoutingEvent[],
  getKey: (event: RoutingEvent) => string,
): Record<string, TaskTypeRoutingSummary> {
  const grouped: Record<string, {
    total: number;
    success: number;
    byModel: Record<string, { total: number; success: number; firstSeenAt: string | null; lastSeenAt: string | null }>;
  }> = {};

  for (const event of events) {
    if (!event.outcome) continue;
    const key = normalizeString(getKey(event), 'unknown');
    const model = event.selectedModel || 'unknown';
    if (!grouped[key]) grouped[key] = { total: 0, success: 0, byModel: {} };
    grouped[key].total += 1;
    if (event.outcome === 'success') grouped[key].success += 1;
    addTimedSuccess(grouped[key].byModel, model, event.outcome === 'success', event.timestamp);
  }

  const output: Record<string, TaskTypeRoutingSummary> = {};
  for (const [taskType, agg] of Object.entries(grouped)) {
    const byModel: Record<string, TaskTypeModelSuccess> = {};
    for (const [model, s] of Object.entries(agg.byModel)) {
      byModel[model] = {
        total: s.total,
        success: s.success,
        rate: s.total > 0 ? s.success / s.total : 0,
        sampleCount: s.total,
        firstSeenAt: s.firstSeenAt,
        lastSeenAt: s.lastSeenAt,
      };
    }
    output[taskType] = {
      total: agg.total,
      success: agg.success,
      rate: agg.total > 0 ? agg.success / agg.total : 0,
      byModel,
    };
  }

  return output;
}

function buildTaskTypeSummary(events: RoutingEvent[]): Record<string, TaskTypeRoutingSummary> {
  return buildSummaryByKey(events, (event) => event.taskType);
}

function buildRoleSummary(events: RoutingEvent[]): Record<string, TaskTypeRoutingSummary> {
  return buildSummaryByKey(events, (event) => event.role);
}

function buildComplexitySummary(events: RoutingEvent[]): Record<string, TaskTypeRoutingSummary> {
  return buildSummaryByKey(events, (event) => event.complexity);
}

function bestByTaskType(taskTypeSummary: Record<string, TaskTypeRoutingSummary>): BestTaskTypeRoutingSignal[] {
  return Object.entries(taskTypeSummary).map(([taskType, data]) => {
    let bestModel = '';
    let best: TaskTypeModelSuccess | null = null;
    for (const [model, modelData] of Object.entries(data.byModel)) {
      if (!best || modelData.rate > best.rate || (modelData.rate === best.rate && modelData.total > best.total)) {
        best = modelData;
        bestModel = model;
      }
    }
    return {
      taskType,
      model: bestModel || 'unknown',
      total: best?.total || 0,
      success: best?.success || 0,
      rate: best?.rate || 0,
      sampleCount: best?.sampleCount || 0,
      firstSeenAt: best?.firstSeenAt || null,
      lastSeenAt: best?.lastSeenAt || null,
    };
  }).filter((row) => row.model !== 'unknown');
}

function addDurationSample(
  buckets: Record<string, { samples: number; totalMs: number }>,
  key: string,
  durationMs: number,
): void {
  const normalizedKey = normalizeString(key, 'unknown');
  if (!buckets[normalizedKey]) buckets[normalizedKey] = { samples: 0, totalMs: 0 };
  buckets[normalizedKey].samples += 1;
  buckets[normalizedKey].totalMs += durationMs;
}

function finalizeDurationBuckets(
  buckets: Record<string, { samples: number; totalMs: number }>,
): Record<string, ModelRequestDurationBucket> {
  const output: Record<string, ModelRequestDurationBucket> = {};
  for (const [key, bucket] of Object.entries(buckets)) {
    if (bucket.samples <= 0) continue;
    const avgMs = Math.round(bucket.totalMs / bucket.samples);
    output[key] = {
      samples: bucket.samples,
      avgMs,
      slow: isSlowModelRequestDurationMs(avgMs),
      thresholdMs: MODEL_REQUEST_SLOW_DURATION_MS,
    };
  }
  return output;
}

function buildModelRequestDurationSummary(events: RoutingEvent[]): ModelRequestDurationSummary {
  const byModel: Record<string, { samples: number; totalMs: number }> = {};
  const byTaskType: Record<string, { samples: number; totalMs: number }> = {};
  for (const event of events) {
    if (typeof event.modelRequestDurationMs !== 'number' || !Number.isFinite(event.modelRequestDurationMs) || event.modelRequestDurationMs < 0) {
      continue;
    }
    addDurationSample(byModel, event.selectedModel || 'unknown', event.modelRequestDurationMs);
    addDurationSample(byTaskType, event.taskType || 'unknown', event.modelRequestDurationMs);
  }
  return {
    byModel: finalizeDurationBuckets(byModel),
    byTaskType: finalizeDurationBuckets(byTaskType),
  };
}

function bestPromptStrategyVariants(strategySummary: Record<string, TaskTypeRoutingSummary>): Array<{ strategyVariant: string; model: string; total: number; success: number; rate: number }> {
  return Object.entries(strategySummary)
    .map(([strategyVariant, data]) => {
      let bestModel = '';
      let best: { total: number; success: number; rate: number } | null = null;
      for (const [model, modelData] of Object.entries(data.byModel)) {
        if (!best || modelData.rate > best.rate || (modelData.rate === best.rate && modelData.total > best.total)) {
          best = modelData;
          bestModel = model;
        }
      }
      return {
        strategyVariant,
        model: bestModel || 'unknown',
        total: data.total,
        success: data.success,
        rate: data.rate,
      };
    })
    .filter((row) => row.model !== 'unknown')
    .sort((a, b) => b.rate - a.rate || b.total - a.total || a.strategyVariant.localeCompare(b.strategyVariant))
    .slice(0, 8);
}

function normalizeOutcome(value: unknown): RoutingEvent['outcome'] {
  return value === 'success' || value === 'failure' || value === 'ambiguous' ? value : null;
}

function normalizeDatasetKind(value: unknown): 'production' | 'benchmark' {
  return value === 'benchmark' ? 'benchmark' : 'production';
}

function normalizeRoutingThreshold(
  value: unknown,
  modelSelectionPolicy: ModelSelectionPolicy | undefined,
): number | undefined {
  if (modelSelectionPolicy !== 'classifier') return undefined;
  const threshold = Number(value);
  return Number.isFinite(threshold) ? threshold : undefined;
}

function normalizeModelSelectionPolicy(value: unknown): ModelSelectionPolicy | undefined {
  return value === 'cheap-direct' || value === 'classifier' || value === 'escalated' ? value : undefined;
}

function normalizeNonNegativeNumber(value: unknown): number | undefined {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : undefined;
}

function normalizeRouteSignal(value: unknown): RoutingRouteSignal | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  if (typeof input.hasImages !== 'boolean') return undefined;
  const turns = normalizeNonNegativeNumber(input.turns);
  const toolCount = normalizeNonNegativeNumber(input.toolCount);
  const estimatedInputTokens = normalizeNonNegativeNumber(input.estimatedInputTokens);
  if (turns == null || toolCount == null || estimatedInputTokens == null) return undefined;

  const signal: RoutingRouteSignal = {
    hasImages: input.hasImages,
    turns,
    toolCount,
    estimatedInputTokens,
  };
  const artifactCount = normalizeNonNegativeNumber(input.artifactCount);
  if (artifactCount != null) signal.artifactCount = artifactCount;
  if (typeof input.dirtyGitState === 'boolean') signal.dirtyGitState = input.dirtyGitState;
  if (typeof input.thinkingEffort === 'string' && input.thinkingEffort.trim()) signal.thinkingEffort = input.thinkingEffort.trim();
  if (typeof input.requiresStrongToolUse === 'boolean') signal.requiresStrongToolUse = input.requiresStrongToolUse;
  return signal;
}

function productionEvents(events: RoutingEvent[]): RoutingEvent[] {
  return events.filter((event) => event.datasetKind !== 'benchmark');
}

function normalizeImportedEvent(value: unknown, datasetKind: 'production' | 'benchmark' = 'production'): RoutingEvent | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const id = typeof input.id === 'string' ? input.id.trim() : '';
  const timestamp = typeof input.timestamp === 'string' ? input.timestamp.trim() : '';
  const selectedModel = typeof input.selectedModel === 'string' ? input.selectedModel.trim() : '';
  if (!id || !timestamp || Number.isNaN(Date.parse(timestamp)) || !selectedModel) return null;

  const candidateScores = input.candidateScores && typeof input.candidateScores === 'object' && !Array.isArray(input.candidateScores)
    ? Object.fromEntries(Object.entries(input.candidateScores as Record<string, unknown>)
      .filter(([, score]) => Number.isFinite(Number(score)))
      .map(([model, score]) => [model, Number(score)]))
    : {};

  const modelSelectionPolicy = normalizeModelSelectionPolicy(input.modelSelectionPolicy);

  return {
    id,
    timestamp,
    sessionId: typeof input.sessionId === 'string' ? input.sessionId : 'imported',
    runId: typeof input.runId === 'string' && input.runId.trim() ? input.runId.trim() : undefined,
    taskHash: typeof input.taskHash === 'string' ? input.taskHash : '',
    taskPromptSnapshot: normalizeRoutingTaskPromptSnapshot(input.taskPromptSnapshot),
    selectedModel,
    score: Number.isFinite(Number(input.score)) ? Number(input.score) : 0,
    threshold: normalizeRoutingThreshold(input.threshold, modelSelectionPolicy),
    candidateScores,
    wasFallback: Boolean(input.wasFallback),
    wasCached: Boolean(input.wasCached),
    modelSelectionPolicy,
    routeSignal: normalizeRouteSignal(input.routeSignal),
    classifierModel: typeof input.classifierModel === 'string' ? input.classifierModel : null,
    surface: typeof input.surface === 'string' ? input.surface : 'imported',
    complexity: typeof input.complexity === 'string' ? input.complexity : 'unknown',
    taskType: typeof input.taskType === 'string' ? input.taskType : 'unknown',
    role: typeof input.role === 'string' ? input.role : 'unknown',
    promptStrategyId: typeof input.promptStrategyId === 'string' ? input.promptStrategyId : undefined,
    promptStrategyFamily: typeof input.promptStrategyFamily === 'string' ? input.promptStrategyFamily : undefined,
    promptStrategyStyle: typeof input.promptStrategyStyle === 'string' ? input.promptStrategyStyle : undefined,
    promptStrategyVariantId: typeof input.promptStrategyVariantId === 'string' ? input.promptStrategyVariantId : undefined,
    promptStrategyTaskType: typeof input.promptStrategyTaskType === 'string' ? input.promptStrategyTaskType : undefined,
    promptStrategySelectionReason: typeof input.promptStrategySelectionReason === 'string' ? input.promptStrategySelectionReason : undefined,
    modelRequestDurationMs: normalizeNonNegativeNumber(input.modelRequestDurationMs),
    userTurns: Number.isFinite(Number(input.userTurns)) ? Number(input.userTurns) : 0,
    outcome: normalizeOutcome(input.outcome),
    outcomeNote: typeof input.outcomeNote === 'string' ? input.outcomeNote : undefined,
    datasetKind: normalizeDatasetKind(datasetKind || input.datasetKind),
  };
}


// ── Public API ─────────────────────────────────────────

/**
 * Record a routing decision. Call after each auto-router invocation.
 * Returns the event ID for later outcome recording.
 */
export function recordRoutingDecision(event: RoutingDecisionInput): string {
  ensureDir();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const taskPromptSnapshot = buildRoutingTaskPromptSnapshot(event.taskPromptText)
    || normalizeRoutingTaskPromptSnapshot(event.taskPromptSnapshot);
  const { taskPromptText: _taskPromptText, taskPromptSnapshot: _taskPromptSnapshot, ...routingEvent } = event;
  const record: RoutingEvent = {
    ...routingEvent,
    taskPromptSnapshot: buildRoutingTaskPromptSnapshot(event.taskPromptText) || taskPromptSnapshot,
    threshold: normalizeRoutingThreshold(event.threshold, event.modelSelectionPolicy),
    routeSignal: normalizeRouteSignal(event.routeSignal),
    id,
    outcome: null,
    datasetKind: 'production',
  };
  // Avoid writing full task text by default (stripping in non-dev mode)
  appendFileSync(eventsPath(), JSON.stringify(record) + '\n', 'utf-8');
  return id;
}

/**
 * Record an outcome signal for a previously recorded routing decision.
 */
export function recordOutcome(eventId: string, outcome: RoutingEvent['outcome'], note?: string): boolean {
  ensureDir();
  const path = eventsPath();
  if (!existsSync(path)) return false;

  const lines = readFileSync(path, 'utf-8').split('\n').filter(Boolean);
  let found = false;
  const updated = lines.map((line) => {
    try {
      const event = JSON.parse(line) as RoutingEvent;
      if (event.id === eventId) {
        event.outcome = outcome;
        event.outcomeNote = note;
        found = true;
      }
      return JSON.stringify(event);
    } catch {
      return line; // preserve malformed lines
    }
  });

  writeFileSync(path, updated.join('\n') + '\n', 'utf-8');
  return found;
}

export function recordModelRequestDuration(eventId: string, durationMs: unknown): boolean {
  const normalizedDurationMs = normalizeNonNegativeNumber(durationMs);
  if (normalizedDurationMs == null) return false;
  ensureDir();
  const path = eventsPath();
  if (!existsSync(path)) return false;

  const lines = readFileSync(path, 'utf-8').split('\n').filter(Boolean);
  let found = false;
  const updated = lines.map((line) => {
    try {
      const event = JSON.parse(line) as RoutingEvent;
      if (event.id === eventId) {
        event.modelRequestDurationMs = Math.round(normalizedDurationMs);
        found = true;
      }
      return JSON.stringify(event);
    } catch {
      return line;
    }
  });

  if (!found) return false;
  writeFileSync(path, updated.join('\n') + '\n', 'utf-8');
  return true;
}

/**
 * Get all routing events, newest first. Optionally filter by session.
 */
export function getRoutingEvents(sessionId?: string, limit = 100): RoutingEvent[] {
  return readEvents(eventsPath())
    .filter((event) => !sessionId || event.sessionId === sessionId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

/**
 * Get every persisted routing event, newest first. Used for full evidence export.
 */
export function getAllRoutingEvents(): RoutingEvent[] {
  return readEvents(eventsPath())
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Merge imported routing events without overwriting local records.
 */
export function importRoutingEvents(rawEvents: unknown[], options: { dryRun?: boolean; datasetKind?: 'production' | 'benchmark' } = {}): RoutingImportResult {
  ensureDir();
  const path = eventsPath();
  const existing = readEvents(path);
  const seenIds = new Set(existing.map((event) => event.id));
  const toImport: RoutingEvent[] = [];
  let skippedExisting = 0;
  let rejected = 0;

  const datasetKind = normalizeDatasetKind(options.datasetKind);

  for (const raw of rawEvents) {
    const event = normalizeImportedEvent(raw, datasetKind);
    if (!event) {
      rejected += 1;
      continue;
    }
    if (seenIds.has(event.id)) {
      skippedExisting += 1;
      continue;
    }
    seenIds.add(event.id);
    toImport.push(event);
  }

  if (options.dryRun) {
    return {
      total: rawEvents.length,
      imported: toImport.length,
      skippedExisting,
      rejected,
      dryRun: true,
      datasetKind,
    };
  }

  if (toImport.length > 0) {
    const merged = [...existing, ...toImport]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    writeFileSync(path, merged.map((event) => JSON.stringify(event)).join('\n') + '\n', 'utf-8');
  } else if (!existsSync(path)) {
    writeFileSync(path, '', 'utf-8');
  }

  return {
    total: rawEvents.length,
    imported: toImport.length,
    skippedExisting,
    rejected,
    dryRun: false,
    datasetKind,
  };
}

/**
 * Compute historical success rates per model, used by
 * the auto-router to adjust candidate ordering and scoring.
 */
export function getModelSuccessRates(): Record<string, { total: number; success: number; rate: number }> {
  const path = eventsPath();
  if (!existsSync(path)) return {};

  const events = productionEvents(readEvents(path));

  const stats: Record<string, { total: number; success: number }> = {};

  for (const e of events) {
    if (!e.selectedModel) continue;
    if (e.outcome === null) continue;
    if (!stats[e.selectedModel]) stats[e.selectedModel] = { total: 0, success: 0 };
    stats[e.selectedModel].total++;
    if (e.outcome === 'success') stats[e.selectedModel].success++;
  }

  return toRate(stats);
}

/**
 * Suggest an auto-router threshold adjustment based on historical outcomes.
 * Returns the suggested new threshold and the reasoning.
 */
export function suggestThresholdAdjustment(
  currentThreshold: number,
): { suggestedThreshold: number; reason: string; dataPoints: number } {
  const path = eventsPath();
  if (!existsSync(path)) {
    return { suggestedThreshold: currentThreshold, reason: 'No historical data', dataPoints: 0 };
  }

  const rates = getModelSuccessRates();
  const models = Object.keys(rates);
  if (models.length === 0) {
    return { suggestedThreshold: currentThreshold, reason: 'No outcome data yet', dataPoints: 0 };
  }

  // Calculate overall success rate
  let totalEvents = 0;
  let totalSuccess = 0;
  for (const m of models) {
    totalEvents += rates[m].total;
    totalSuccess += rates[m].success;
  }
  const overallRate = totalEvents > 0 ? totalSuccess / totalEvents : 0;
  const dataPoints = totalEvents;

  // Strategy:
  // - If overall success rate > 90%, threshold can be lowered (more aggressive cost savings)
  // - If overall success rate < 70%, threshold should be raised (fewer risky picks)
  // - Otherwise, keep current threshold
  let suggestedThreshold = currentThreshold;
  let reason: string;

  if (dataPoints < 10) {
    reason = `Only ${dataPoints} rated outcomes; insufficient for adjustment`;
    suggestedThreshold = currentThreshold;
  } else if (overallRate > 0.9) {
    suggestedThreshold = Math.max(0.5, currentThreshold - 0.1);
    reason = `High success rate (${(overallRate * 100).toFixed(0)}% over ${dataPoints} rated outcomes); lowering threshold for cost savings`;
  } else if (overallRate < 0.7) {
    suggestedThreshold = Math.min(0.9, currentThreshold + 0.1);
    reason = `Low success rate (${(overallRate * 100).toFixed(0)}% over ${dataPoints} rated outcomes); raising threshold for safety`;
  } else {
    reason = `Acceptable success rate (${(overallRate * 100).toFixed(0)}% over ${dataPoints} rated outcomes); no adjustment needed`;
  }

  return { suggestedThreshold, reason, dataPoints };
}

/**
 * Get a quick summary of the learning system state.
 */
export function getLearningSummary() {
  const path = eventsPath();
  if (!existsSync(path)) {
    return {
      totalEvents: 0,
      models: {},
      successRate: 0,
      outdated: true,
      byTaskType: {},
      byRole: {},
      byComplexity: {},
      byPromptStrategy: {},
      byPromptStrategyFamily: {},
      byPromptStrategyVariant: {},
      modelRequestDuration: { byModel: {}, byTaskType: {} },
      bestByTaskType: [],
      bestPromptStrategyVariants: [],
    } as LearningSummary;
  }

  const rates = getModelSuccessRates();
  const events = productionEvents(readEvents(path)).filter((event) => event.outcome !== null);
  const byTaskType = buildTaskTypeSummary(events);
  const byRole = buildRoleSummary(events);
  const byComplexity = buildComplexitySummary(events);
  const byPromptStrategy = buildSummaryByKey(events, (event) => event.promptStrategyId || 'unknown');
  const byPromptStrategyFamily = buildSummaryByKey(events, (event) => event.promptStrategyFamily || 'unknown');
  const byPromptStrategyVariant = buildSummaryByKey(events, (event) =>
    event.promptStrategyVariantId
      ? `${event.promptStrategyId || 'unknown'}:${event.promptStrategyVariantId}`
      : event.promptStrategyId || 'unknown'
  );
  const modelRequestDuration = buildModelRequestDurationSummary(events);

  let total = 0;
  let successes = 0;
  for (const m of Object.keys(rates)) {
    total += rates[m].total;
    successes += rates[m].success;
  }

  return {
    totalEvents: total,
    models: rates,
    successRate: total > 0 ? successes / total : 0,
    outdated: false,
    byTaskType,
    byRole,
    byComplexity,
    byPromptStrategy,
    byPromptStrategyFamily,
    byPromptStrategyVariant,
    modelRequestDuration,
    bestByTaskType: bestByTaskType(byTaskType),
    bestPromptStrategyVariants: bestPromptStrategyVariants(byPromptStrategyVariant),
  };
}

export function getLearningSummaryByTaskType(): LearningSummary {
  return getLearningSummary();
}
