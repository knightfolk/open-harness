import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { HarnessRun, HarnessRunStep } from './runTrace';
import { getToolReliabilitySessions } from './toolReliabilityLogTrace';
import { normalizeToolStatus } from './toolReliability';

type ToolErrorEvidenceSource = 'saved_session_trace' | 'log_trace' | 'imported_trace';

export interface ToolErrorLedgerEvent {
  id: string;
  timestamp: string;
  evidenceSource: ToolErrorEvidenceSource;
  sessionId: string;
  runId: string;
  failedModel: string;
  failedProviderId: string;
  failedTool: string;
  round?: number;
  error?: string;
  runRecovered: boolean;
  finalStatus: HarnessRun['status'];
  finalAnswerCaptured: boolean;
  recoveryModel?: string;
  recoveryProviderId?: string;
  recoveryTool?: string;
  recoveryRound?: number;
  retryDistance?: number;
}

export interface ToolErrorModelAggregate {
  errors: number;
  recovered: number;
  unrecovered: number;
  recoveredRate: number;
  latestTimestamp: string;
  exampleSessionIds: string[];
  exampleRunIds: string[];
}

export interface ToolErrorLedgerSummary {
  totalErrorEvents: number;
  persistedLedgerExists: boolean;
  persistedEventCount: number;
  logTraceEventCount: number;
  liveEvidenceStatus: 'missing_ledger' | 'empty' | 'available';
  byModel: Record<string, ToolErrorModelAggregate>;
  byModelProvider: Record<string, ToolErrorModelAggregate>;
  byTool: Record<string, ToolErrorModelAggregate>;
  topUnrecoveredPaths: Array<{
    model: string;
    providerId: string;
    tool: string;
    unrecovered: number;
    errors: number;
    recoveredRate: number;
  }>;
  recentEvents: ToolErrorLedgerEvent[];
}

export interface ToolFailureTrainingExportRecord {
  timestamp: string;
  evidenceSource: ToolErrorEvidenceSource;
  failed: {
    model: string;
    providerId: string;
    tool: string;
    round?: number;
    message?: string;
  };
  workaround: {
    completed: boolean;
    type: 'recovered_tool_path' | 'final_answer_only' | 'unrecovered_or_unknown';
    model?: string;
    providerId?: string;
    tool?: string;
    round?: number;
    retryDistance?: number;
    finalStatus: HarnessRun['status'];
    finalAnswerCaptured: boolean;
    summary: string;
  };
}

export interface ToolFailureTrainingExportPayload {
  schemaVersion: 1;
  generatedAt: string;
  privacyBoundary: {
    includes: string[];
    excludes: string[];
  };
  recordCount: number;
  records: ToolFailureTrainingExportRecord[];
}

interface ToolErrorLedgerOptions {
  model?: string;
  providerId?: string;
  tool?: string;
  limit?: number;
  evidenceSource?: ToolErrorEvidenceSource;
}

interface ToolErrorLedgerQuery {
  model?: string;
  providerId?: string;
  tool?: string;
  evidenceSource?: ToolErrorEvidenceSource;
  limit: number;
}

const BASE_DIR = join(homedir(), '.openharness', 'router-learning');
const TOOL_ERROR_DB_PATH = join(BASE_DIR, 'tool-error-ledger.jsonl');

function emptyAggregate(): ToolErrorModelAggregate {
  return {
    errors: 0,
    recovered: 0,
    unrecovered: 0,
    recoveredRate: 0,
    latestTimestamp: new Date(0).toISOString(),
    exampleSessionIds: [],
    exampleRunIds: [],
  };
}

function parseToolSteps(run: HarnessRun): Extract<HarnessRunStep, { type: 'tool_call' }>[] {
  return run.steps.filter((step): step is Extract<HarnessRunStep, { type: 'tool_call' }> => step.type === 'tool_call');
}

export function buildToolErrorLedgerEventsFromRun(run: HarnessRun, evidenceSource: ToolErrorEvidenceSource): ToolErrorLedgerEvent[] {
  const toolSteps = parseToolSteps(run);
  if (toolSteps.length === 0) return [];

  const finalAnswerCaptured = run.steps.some((step) => step.type === 'final_answer');
  const errorSteps = toolSteps
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => normalizeToolStatus(step) === 'error');

  if (errorSteps.length === 0) return [];

  const timestamp = run.startedAt || new Date().toISOString();
  const lines: ToolErrorLedgerEvent[] = [];

  for (const { step, index } of errorSteps) {
    const failedModel = modelFromStep(step, run.effectiveModel);
    const failedProviderId = providerFromStep(step, run.providerId);
    const failedTool = step.name || 'unknown';
    const recoveryStep = getRecoveryAfterError(toolSteps, index);
    const recoveredBy = recoveryStep
      ? {
          model: modelFromStep(recoveryStep, run.effectiveModel),
          providerId: providerFromStep(recoveryStep, run.providerId),
          tool: recoveryStep.name || 'unknown',
          round: recoveryStep.round,
        }
      : null;
    const retryDistance = recoveryStep && typeof recoveryStep.round === 'number' && typeof step.round === 'number'
      ? Math.max(0, recoveryStep.round - step.round)
      : undefined;

    lines.push({
      id: `${run.id}-${step.id}`,
      timestamp,
      evidenceSource,
      sessionId: run.sessionId,
      runId: run.id,
      failedModel,
      failedProviderId,
      failedTool,
      round: step.round,
      error: step.error || step.outputPreview,
      runRecovered: run.status === 'complete' && Boolean(recoveredBy),
      finalStatus: run.status,
      finalAnswerCaptured,
      recoveryModel: recoveredBy?.model,
      recoveryProviderId: recoveredBy?.providerId,
      recoveryTool: recoveredBy?.tool,
      recoveryRound: recoveredBy?.round,
      retryDistance,
    });
  }

  return lines;
}

function getLogTraceToolErrorEvents(): ToolErrorLedgerEvent[] {
  try {
    const sessions = getToolReliabilitySessions();
    const events: ToolErrorLedgerEvent[] = [];

    for (const session of sessions) {
      const messages = session.messages || [];
      for (const message of messages) {
        const run = message.runTrace;
        if (!run) continue;
        if (message.evidenceSource !== 'log_trace' && session.evidenceSource !== 'log_trace') continue;
        events.push(...buildToolErrorLedgerEventsFromRun(run, 'log_trace'));
      }
    }

    return events;
  } catch {
    return [];
  }
}

function addTopExamples(target: string[], value: string, max = 5): void {
  if (!value || target.includes(value)) return;
  target.push(value);
  if (target.length > max) target.shift();
}

function sortAggregateByUnrecovered(summary: ToolErrorLedgerSummary): void {
  const pathAggregate: Array<{
    model: string;
    providerId: string;
    tool: string;
    unrecovered: number;
    errors: number;
    recoveredRate: number;
  }> = [];
  for (const [modelProviderTool, row] of Object.entries(summary.byModelProvider)) {
    const parts = modelProviderTool.split('||');
    pathAggregate.push({
      model: parts[0] || 'unknown',
      providerId: parts[1] || 'unknown',
      tool: parts[2] || 'unknown',
      unrecovered: row.unrecovered,
      errors: row.errors,
      recoveredRate: row.recoveredRate,
    });
  }
  summary.topUnrecoveredPaths = pathAggregate
    .filter((row) => row.errors > 0)
    .sort((a, b) => b.unrecovered - a.unrecovered || b.errors - a.errors || a.tool.localeCompare(b.tool))
    .slice(0, 12);
}

function readAllEvents(): ToolErrorLedgerEvent[] {
  if (!existsSync(TOOL_ERROR_DB_PATH)) return [];
  const raw = readFileSync(TOOL_ERROR_DB_PATH, 'utf-8').split('\n').filter(Boolean);
  const events: ToolErrorLedgerEvent[] = [];
  for (const line of raw) {
    try {
      const parsed = JSON.parse(line) as ToolErrorLedgerEvent;
      if (parsed && parsed.id && parsed.timestamp) {
        events.push(parsed);
      }
    } catch {
      // ignore malformed entries
    }
  }
  return events.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

function matchEvent(event: ToolErrorLedgerEvent, query: ToolErrorLedgerQuery): boolean {
  if (query.model && query.model !== event.failedModel) return false;
  if (query.providerId && query.providerId !== event.failedProviderId) return false;
  if (query.tool && query.tool !== event.failedTool) return false;
  if (query.evidenceSource && query.evidenceSource !== event.evidenceSource) return false;
  return true;
}

function incrementAggregate(target: Record<string, ToolErrorModelAggregate>, key: string, event: ToolErrorLedgerEvent): void {
  if (!target[key]) target[key] = emptyAggregate();
  const row = target[key];
  row.errors += 1;
  if (event.runRecovered) row.recovered += 1;
  row.unrecovered = row.errors - row.recovered;
  row.recoveredRate = row.errors > 0 ? row.recovered / row.errors : 0;
  if (Date.parse(event.timestamp) > Date.parse(row.latestTimestamp)) {
    row.latestTimestamp = event.timestamp;
  }
  addTopExamples(row.exampleSessionIds, event.sessionId);
  addTopExamples(row.exampleRunIds, event.runId);
}

function buildSummary(
  events: ToolErrorLedgerEvent[],
  meta: {
    persistedLedgerExists: boolean;
    persistedEventCount: number;
    logTraceEventCount: number;
  } = {
    persistedLedgerExists: existsSync(TOOL_ERROR_DB_PATH),
    persistedEventCount: 0,
    logTraceEventCount: 0,
  },
): ToolErrorLedgerSummary {
  const summary: ToolErrorLedgerSummary = {
    totalErrorEvents: events.length,
    persistedLedgerExists: meta.persistedLedgerExists,
    persistedEventCount: meta.persistedEventCount,
    logTraceEventCount: meta.logTraceEventCount,
    liveEvidenceStatus: meta.persistedLedgerExists
      ? events.length > 0
        ? 'available'
        : 'empty'
      : 'missing_ledger',
    byModel: {},
    byModelProvider: {},
    byTool: {},
    topUnrecoveredPaths: [],
    recentEvents: events.slice(0, 20),
  };

  for (const event of events) {
    const modelKey = event.failedModel || 'unknown';
    const providerKey = event.failedProviderId || 'unknown';
    const toolKey = event.failedTool || 'unknown';
    const modelProviderKey = `${modelKey}||${providerKey}||${toolKey}`;

    incrementAggregate(summary.byModel, modelKey, event);
    incrementAggregate(summary.byModelProvider, modelProviderKey, event);
    incrementAggregate(summary.byTool, toolKey, event);
  }

  sortAggregateByUnrecovered(summary);
  return summary;
}

function modelFromStep(step: Extract<HarnessRunStep, { type: 'tool_call' }>, fallbackModel: string): string {
  return step.model || fallbackModel || 'unknown';
}

function providerFromStep(step: Extract<HarnessRunStep, { type: 'tool_call' }>, fallbackProvider: string): string {
  return step.providerId || fallbackProvider || 'unknown';
}

function cleanFailureMessage(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const compact = value.replace(/\s+/g, ' ').trim();
  if (!compact) return undefined;
  return compact.slice(0, 500);
}

function workaroundForEvent(event: ToolErrorLedgerEvent): ToolFailureTrainingExportRecord['workaround'] {
  if (event.recoveryTool) {
    return {
      completed: event.runRecovered,
      type: 'recovered_tool_path',
      model: event.recoveryModel,
      providerId: event.recoveryProviderId,
      tool: event.recoveryTool,
      round: event.recoveryRound,
      retryDistance: event.retryDistance,
      finalStatus: event.finalStatus,
      finalAnswerCaptured: event.finalAnswerCaptured,
      summary: `Recovered by ${event.recoveryModel || 'unknown'} using ${event.recoveryTool}.`,
    };
  }
  if (event.finalStatus === 'complete' && event.finalAnswerCaptured) {
    return {
      completed: true,
      type: 'final_answer_only',
      finalStatus: event.finalStatus,
      finalAnswerCaptured: event.finalAnswerCaptured,
      summary: 'Task completed without a later successful tool call captured after this failure.',
    };
  }
  return {
    completed: false,
    type: 'unrecovered_or_unknown',
    finalStatus: event.finalStatus,
    finalAnswerCaptured: event.finalAnswerCaptured,
    summary: 'No completed workaround captured for this failure.',
  };
}

function getRecoveryAfterError(
  toolSteps: Extract<HarnessRunStep, { type: 'tool_call' }>[],
  errorIndex: number,
): Extract<HarnessRunStep, { type: 'tool_call' }> | undefined {
  return toolSteps.slice(errorIndex + 1).find((step) => normalizeToolStatus(step) === 'complete');
}

export function getToolErrorLedgerEvents(options: ToolErrorLedgerOptions = {}): ToolErrorLedgerEvent[] {
  const limit = Number.isFinite(options.limit ?? 0) && (options.limit || 0) > 0 ? Number(options.limit) : 80;
  const query: ToolErrorLedgerQuery = {
    model: options.model,
    providerId: options.providerId,
    tool: options.tool,
    evidenceSource: options.evidenceSource,
    limit,
  };

  const persistedEvents = readAllEvents();
  const logEvents = getLogTraceToolErrorEvents();
  const combined = [...persistedEvents, ...logEvents];
  return combined
    .filter((event) => matchEvent(event, query))
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, query.limit);
}

export function getToolErrorLedgerSummary(options: ToolErrorLedgerOptions = {}): ToolErrorLedgerSummary {
  const query: ToolErrorLedgerQuery = {
    model: options.model,
    providerId: options.providerId,
    tool: options.tool,
    evidenceSource: options.evidenceSource,
    limit: Number.MAX_SAFE_INTEGER,
  };
  const persistedLedgerExists = existsSync(TOOL_ERROR_DB_PATH);
  const persistedEvents = readAllEvents();
  const logEvents = getLogTraceToolErrorEvents();
  const combined = [...persistedEvents, ...logEvents]
    .filter((event) => matchEvent(event, query))
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  return buildSummary(combined, {
    persistedLedgerExists,
    persistedEventCount: persistedEvents.filter((event) => matchEvent(event, query)).length,
    logTraceEventCount: logEvents.filter((event) => matchEvent(event, query)).length,
  });
}

export function buildToolFailureTrainingExportPayload({
  events,
  generatedAt = new Date().toISOString(),
}: {
  events: ToolErrorLedgerEvent[];
  generatedAt?: string;
}): ToolFailureTrainingExportPayload {
  const records = events.map((event) => ({
    timestamp: event.timestamp,
    evidenceSource: event.evidenceSource,
    failed: {
      model: event.failedModel || 'unknown',
      providerId: event.failedProviderId || 'unknown',
      tool: event.failedTool || 'unknown',
      round: event.round,
      message: cleanFailureMessage(event.error),
    },
    workaround: workaroundForEvent(event),
  }));

  return {
    schemaVersion: 1,
    generatedAt,
    privacyBoundary: {
      includes: [
        'failure timestamp',
        'evidence source',
        'failed model',
        'failed provider',
        'failed tool',
        'failure message',
        'completion status',
        'recovery model/provider/tool when captured',
        'retry distance when captured',
      ],
      excludes: [
        'user prompts',
        'assistant responses',
        'session titles',
        'artifacts',
        'file contents',
        'raw tool input',
        'raw tool output',
        'full run traces',
        'session ids',
        'run ids',
      ],
    },
    recordCount: records.length,
    records,
  };
}

export function recordToolErrorRunEvents(run: HarnessRun): void {
  try {
    if (!existsSync(BASE_DIR)) {
      mkdirSync(BASE_DIR, { recursive: true });
    }
    const events = buildToolErrorLedgerEventsFromRun(run, 'saved_session_trace');
    if (events.length === 0) return;
    const lines = events.map((event) => JSON.stringify(event));
    appendFileSync(TOOL_ERROR_DB_PATH, `${lines.join('\n')}\n`, 'utf-8');
  } catch {
    // Do not block runtime behavior on telemetry persistence errors.
  }
}
