import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

import { loadAllSessions } from './sessionStore';
import type { ToolReliabilitySession } from './toolReliability';
import type { HarnessRun, HarnessRunStep } from './runTrace';

const LOG_TRACE_LOG_DIR = join(homedir(), '.openharness', 'process-ledger', 'logs');
const MAX_LOG_BYTES_PER_FILE = 512 * 1024;
const RUN_STEP_MARKER = '[run-step] ';
const RUN_COMPLETE_MARKER = '[run-complete] ';

type ParsedEvent = ParsedRunStepEvent | ParsedRunCompleteEvent;

interface ParsedRunStepEvent {
  kind: 'run-step';
  runId: string;
  step: {
    type: 'tool_call' | 'final_answer';
    name?: string;
    status?: HarnessRunStep['status'];
    model?: string;
    providerId?: string;
    round?: number;
    error?: string;
  };
}

interface ParsedRunCompleteEvent {
  kind: 'run-complete';
  runId: string;
  status: 'running' | 'complete' | 'error';
}

interface ParsedRunRecord {
  runId: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'complete' | 'error';
  steps: Array<{
    type: HarnessRunStep['type'];
    name?: string;
    input?: unknown;
    outputPreview?: string;
    durationMs?: number;
    status?: HarnessRunStep['status'];
    error?: string;
    model?: string;
    providerId?: string;
    round?: number;
    chars?: number;
  }>;
  providerId?: string;
  requestedModel?: string;
}

interface RawLogLine {
  file: string;
  line: number;
  raw: string;
}

function ensureToolReliabilitySessionsFromSavedSessions(): ToolReliabilitySession[] {
  const sessions = loadAllSessions();
  return sessions.map((session) => ({
    id: session.id,
    messages: session.messages.map((message) => ({
      ...message,
      evidenceSource: message.evidenceSource ?? 'saved_session_trace',
    })),
    evidenceSource: 'saved_session_trace',
  }));
}

function parseLogLine(line: RawLogLine): ParsedEvent | null {
  if (!line.raw.startsWith(RUN_STEP_MARKER) && !line.raw.startsWith(RUN_COMPLETE_MARKER)) return null;
  const payload = line.raw.startsWith(RUN_STEP_MARKER)
    ? line.raw.slice(RUN_STEP_MARKER.length)
    : line.raw.slice(RUN_COMPLETE_MARKER.length);
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const record = parsed as Record<string, unknown>;
    if (line.raw.startsWith(RUN_COMPLETE_MARKER)) {
      const runId = typeof record.runId === 'string' ? record.runId.trim() : '';
      const status = record.status === 'error' || record.status === 'complete' || record.status === 'running'
        ? record.status
        : 'running';
      if (!runId) return null;
      return {
        kind: 'run-complete',
        runId,
        status,
      };
    }
    const runId = typeof record.runId === 'string' ? record.runId.trim() : '';
    const step = record.step && typeof record.step === 'object'
      ? record.step as Record<string, unknown>
      : null;
    if (!runId || !step || typeof step.type !== 'string') return null;
    const type = step.type.trim();
    if (type !== 'tool_call' && type !== 'final_answer') return null;
    return {
      kind: 'run-step',
      runId,
      step: {
        type,
        name: typeof step.name === 'string' ? step.name : undefined,
        status: step.status === 'complete' || step.status === 'error' || step.status === 'running' || step.status === 'skipped'
          ? step.status
          : undefined,
        model: typeof step.model === 'string' ? step.model : undefined,
        providerId: typeof step.providerId === 'string' ? step.providerId : undefined,
        round: typeof step.round === 'number' ? step.round : undefined,
        error: typeof step.error === 'string' ? step.error : undefined,
      },
    };
  } catch {
    return null;
  }
}

function collectLogLines(): RawLogLine[] {
  const lines: RawLogLine[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(LOG_TRACE_LOG_DIR, { withFileTypes: false, recursive: false }).filter((name) => name.endsWith('.log'));
  } catch {
    return [];
  }

  for (const fileName of entries) {
    const logPath = join(LOG_TRACE_LOG_DIR, fileName);
    try {
      if (!existsSync(logPath)) continue;
      const stat = statSync(logPath);
      if (!stat.isFile()) continue;
      const start = Math.max(0, stat.size - MAX_LOG_BYTES_PER_FILE);
      const tail = readFileSync(logPath, 'utf-8').slice(start);
      const chunks = tail.split('\n');
      chunks.forEach((raw, index) => {
        if (raw.trim().length === 0) return;
        lines.push({ file: logPath, line: index + 1, raw: raw.trim() });
      });
    } catch {
      continue;
    }
  }
  return lines;
}

function buildRunTrace(record: ParsedRunRecord): HarnessRun {
  const firstProvider = record.steps.find((step) => step.providerId)?.providerId;
  const firstModel = record.steps.find((step) => step.model)?.model;
  const requestedModel = record.requestedModel || firstModel || 'unknown-model';
  return {
    id: record.runId,
    sessionId: `log-session-${record.runId.slice(0, 12)}`,
    userMessageId: `log-run-${record.runId}`,
    role: 'coder',
    requestedModel,
    effectiveModel: requestedModel,
    providerId: firstProvider || record.providerId || 'unknown-provider',
    status: record.status,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    context: { tokensUsed: 0, budget: 0, compressedCount: 0, summarized: false },
    steps: record.steps,
  };
}

export function getToolReliabilitySessions(): ToolReliabilitySession[] {
  const savedSessions = ensureToolReliabilitySessionsFromSavedSessions();
  const savedRunIds = new Set<string>();
  for (const session of savedSessions) {
    for (const message of session.messages || []) {
      if (message.runTrace?.id) savedRunIds.add(message.runTrace.id);
    }
  }

  const byRun = new Map<string, ParsedRunRecord>();
  for (const rawLine of collectLogLines()) {
    const parsed = parseLogLine(rawLine);
    if (!parsed) continue;

    const existing = byRun.get(parsed.runId) || {
      runId: parsed.runId,
      startedAt: new Date().toISOString(),
      status: 'running',
      steps: [],
      providerId: undefined,
      requestedModel: undefined,
    };

    if (parsed.kind === 'run-complete') {
      existing.completedAt = new Date().toISOString();
      existing.status = parsed.status;
      byRun.set(parsed.runId, existing);
      continue;
    }

    const step = toRunTraceStep(parsed.step);
    existing.steps.push(step);
    if (parsed.step.model && !existing.requestedModel) existing.requestedModel = parsed.step.model;
    if (parsed.step.providerId && !existing.providerId) existing.providerId = parsed.step.providerId;
    byRun.set(parsed.runId, existing);
  }

  const logSessions: ToolReliabilitySession[] = [];
  for (const [runId, runRecord] of byRun.entries()) {
    if (savedRunIds.has(runId)) continue;
    const hasToolCalls = runRecord.steps.some((step) => step.type === 'tool_call');
    if (!hasToolCalls) continue;
    if (runRecord.steps.length === 0) continue;
    const runTrace = buildRunTrace(runRecord);
    logSessions.push({
      id: `log-session-${runId}`,
      evidenceSource: 'log_trace',
      messages: [{
        id: `log-message-${runId}`,
        role: 'assistant',
        content: 'Run trace reconstructed from process logs.',
        timestamp: runTrace.startedAt,
        runTrace,
        evidenceSource: 'log_trace',
      }],
    });
  }

  return [...savedSessions, ...logSessions];
}

function toRunTraceStep(step: ParsedRunStepEvent['step']): HarnessRunStep {
  if (step.type === 'tool_call') {
    return {
      type: 'tool_call',
      id: `log-tool-${step.round ?? 0}-${Math.random().toString(16).slice(2, 10)}`,
      name: step.name || 'unknown',
      input: {},
      outputPreview: undefined,
      durationMs: undefined,
      status: step.status,
      error: step.error,
      model: step.model,
      providerId: step.providerId,
      round: step.round,
    };
  }
  return {
    type: 'final_answer',
    chars: 0,
  };
}
