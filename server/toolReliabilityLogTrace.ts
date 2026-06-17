import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

import { loadAllSessions } from './sessionStore';
import { getProcessLedgerLogsDir } from './processLedger';
import type { ToolReliabilitySession } from './toolReliability';
import type { HarnessRun, HarnessRunStep } from './runTrace';

const MAX_LOG_BYTES_PER_FILE = 512 * 1024;
const RUN_STEP_MARKER = '[run-step] ';
const RUN_COMPLETE_MARKER = '[run-complete] ';
type ToolCallStatus = 'running' | 'complete' | 'error' | 'skipped';
type ReconstructedRunStep =
  | {
      type: 'tool_call';
      id: string;
      name: string;
      status?: ToolCallStatus;
      model?: string;
      providerId?: string;
      round?: number;
      error?: string;
      input: unknown;
      outputPreview?: string;
      durationMs?: number;
    }
  | {
      type: 'final_answer';
      chars: number;
    };

type ParsedEvent = ParsedRunStepEvent | ParsedRunCompleteEvent;

interface ParsedRunStepEvent {
  kind: 'run-step';
  runId: string;
  step: {
    type: 'tool_call' | 'final_answer';
    name?: string;
    status?: ToolCallStatus;
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
  steps: HarnessRunStep[];
  providerId?: string;
  requestedModel?: string;
}

interface RawLogLine {
  file: string;
  line: number;
  raw: string;
}

export interface ToolReliabilitySourceFingerprint {
  sessions: {
    count: number;
    sessionFileNames: string[];
    latestMtimeMs: number;
  };
  logs: {
    count: number;
    logFileNames: string[];
    latestMtimeMs: number;
    totalLogBytes: number;
  };
  computedAt: string;
}

const SESSIONS_DIR = join(homedir(), '.openharness', 'sessions');

function safeStat(path: string): ReturnType<typeof statSync> | null {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

function collectSessionsFingerprint(): ToolReliabilitySourceFingerprint['sessions'] {
  try {
    const files = readdirSync(SESSIONS_DIR).filter((name) => name.endsWith('.json')).sort();
    const latestMtime = files
      .map((name) => safeStat(join(SESSIONS_DIR, name)))
      .map((stat) => stat?.mtimeMs || 0)
      .reduce((max, value) => Math.max(max, value), 0);
    return {
      count: files.length,
      sessionFileNames: files.slice(-20),
      latestMtimeMs: latestMtime,
    };
  } catch {
    return {
      count: 0,
      sessionFileNames: [],
      latestMtimeMs: 0,
    };
  }
}

function collectLogFingerprint(): ToolReliabilitySourceFingerprint['logs'] {
  const logsDir = getProcessLedgerLogsDir();
  const rootDir = logsDir.replace(/\/logs$/, '');
  const collectFrom = (dir: string) => {
    if (!existsSync(dir)) return [];
    const names = readdirSync(dir).filter((name) => name.endsWith('.log')).sort();
    return names.map((name) => join(dir, name));
  };

  try {
    const files = [...collectFrom(logsDir), ...collectFrom(rootDir)];
    let latestMtime = 0;
    let totalLogBytes = 0;
    const fileNames = files
      .filter((path) => {
        const stat = safeStat(path);
        if (!stat || !stat.isFile()) return false;
        latestMtime = Math.max(latestMtime, stat.mtimeMs);
        totalLogBytes += stat.size;
        return true;
      })
      .map((path) => path.split(/[/\\]/).pop() || path)
      .sort();
    return {
      count: fileNames.length,
      logFileNames: fileNames.slice(-20),
      latestMtimeMs: latestMtime,
      totalLogBytes,
    };
  } catch {
    return {
      count: 0,
      logFileNames: [],
      latestMtimeMs: 0,
      totalLogBytes: 0,
    };
  }
}

export function getToolReliabilitySourceFingerprint(): ToolReliabilitySourceFingerprint {
  return {
    sessions: collectSessionsFingerprint(),
    logs: collectLogFingerprint(),
    computedAt: new Date().toISOString(),
  };
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
  const logTraceLogDir = getProcessLedgerLogsDir();
  const entries = (() => {
    try {
      return (readdirSync(logTraceLogDir, { withFileTypes: false, recursive: false }) as string[]).filter((name) => name.endsWith('.log'));
    } catch {
      return [];
    }
  })();

  for (const fileName of entries) {
    const logPath = join(logTraceLogDir, fileName);
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
  const firstToolStep = record.steps.find((step): step is Extract<HarnessRunStep, { type: 'tool_call' }> => step.type === 'tool_call');
  const firstProvider = firstToolStep?.providerId;
  const firstModel = firstToolStep?.model;
  const requestedModel = record.requestedModel || firstModel || 'unknown-model';
  return {
    id: record.runId,
    sessionId: `log-session-${record.runId}`,
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

function toRunTraceStep(step: ParsedRunStepEvent['step']): ReconstructedRunStep {
  if (step.type === 'tool_call') {
    return {
      type: 'tool_call',
      id: `log-tool-${step.round ?? 0}-${Math.random().toString(16).slice(2, 10)}`,
      name: step.name || 'unknown',
      status: step.status,
      input: {},
      outputPreview: undefined,
      durationMs: undefined,
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
