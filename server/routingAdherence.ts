// server/routingAdherence.ts
//
// Phase 1 telemetry for routing and prompt-adherence debugging. Events are
// append-only JSONL records, redacted before disk, and intentionally do not
// feed back into routing behavior.
import { existsSync, mkdirSync, appendFileSync, closeSync, fstatSync, openSync, readSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';
import { v4 as uuid } from 'uuid';
import { redactSecrets } from './sectionRedaction';

export type RoutingAdherencePhase =
  | 'router-classifier'
  | 'agent-request'
  | 'provider-stream'
  | 'tool-call'
  | 'client-sse'
  | 'orchestrator-phase';

const ROUTING_ADHERENCE_PHASES: RoutingAdherencePhase[] = [
  'router-classifier',
  'agent-request',
  'provider-stream',
  'tool-call',
  'client-sse',
  'orchestrator-phase',
];
const DEFAULT_TAIL_CHUNK_BYTES = 64 * 1024;
const DEFAULT_TAIL_MAX_BYTES = 8 * 1024 * 1024;

export type RoutingAdherenceKind = 'timeout' | 'error' | 'abort';

export interface RoutingAdherenceEventInput {
  kind: RoutingAdherenceKind;
  phase: RoutingAdherencePhase;
  sessionId?: string;
  runId?: string;
  routeMode?: string;
  role?: string;
  complexity?: string;
  selectedModel?: string;
  providerId?: string;
  classifierModel?: string | null;
  candidateScores?: Record<string, number>;
  promptHash?: string;
  timeoutMs?: number;
  elapsedMs?: number;
  error?: string;
  statusCode?: number;
  lastEvent?: string;
  retryable?: boolean;
  fallbackAttempted?: boolean;
  fallbackModelId?: string;
  metadata?: Record<string, unknown>;
}

export interface RoutingAdherenceEvent extends RoutingAdherenceEventInput {
  id: string;
  createdAt: string;
}

const DEFAULT_BASE_DIR = join(homedir(), '.openharness', 'routing-adherence');
let baseDirOverride: string | null = null;

export function setRoutingAdherenceBaseDirForTest(dir: string | null): void {
  baseDirOverride = dir;
}

export function getRoutingAdherenceBaseDir(): string {
  return baseDirOverride || DEFAULT_BASE_DIR;
}

function ensureDir(): void {
  const dir = getRoutingAdherenceBaseDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function eventsPath(): string {
  return join(getRoutingAdherenceBaseDir(), 'events.jsonl');
}

export function hashPrompt(input: string | undefined | null): string | undefined {
  if (!input) return undefined;
  return createHash('sha256').update(input).digest('hex').slice(0, 24);
}

function redactValue<T>(value: T): T {
  if (typeof value === 'string') return redactSecrets(value).redacted as T;
  if (Array.isArray(value)) return value.map((item) => redactValue(item)) as T;
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (/api[_-]?key|auth(?:orization|token)?|password|secret|token/i.test(key)) {
        output[key] = '<redacted:SECRET>';
      } else {
        output[key] = redactValue(item);
      }
    }
    return output as T;
  }
  return value;
}

function normalizeEvent(input: RoutingAdherenceEventInput): RoutingAdherenceEvent {
  return redactValue({
    id: uuid(),
    createdAt: new Date().toISOString(),
    ...input,
    elapsedMs: typeof input.elapsedMs === 'number' ? Math.max(0, Math.round(input.elapsedMs)) : undefined,
    timeoutMs: typeof input.timeoutMs === 'number' ? Math.max(0, Math.round(input.timeoutMs)) : undefined,
  });
}

export function recordRoutingAdherenceEvent(input: RoutingAdherenceEventInput): RoutingAdherenceEvent {
  const event = normalizeEvent(input);
  try {
    ensureDir();
    appendFileSync(eventsPath(), JSON.stringify(event) + '\n', 'utf-8');
  } catch (err) {
    console.warn('[routing-adherence] failed to persist event:', err);
  }
  return event;
}

export function routingAdherencePhaseFromQuery(value: unknown): RoutingAdherencePhase | undefined | null {
  if (value == null) return undefined;
  const normalized = String(value).trim();
  if (!normalized) return undefined;
  return (ROUTING_ADHERENCE_PHASES as string[]).includes(normalized) ? normalized as RoutingAdherencePhase : null;
}

function readNewestJsonlLines(
  path: string,
  opts: { maxTailBytes?: number; chunkBytes?: number } = {},
): string[] {
  const fd = openSync(path, 'r');
  try {
    const size = fstatSync(fd).size;
    if (size <= 0) return [];
    const maxTailBytes = Math.max(1, Math.floor(opts.maxTailBytes ?? DEFAULT_TAIL_MAX_BYTES));
    const chunkBytes = Math.max(1, Math.floor(opts.chunkBytes ?? DEFAULT_TAIL_CHUNK_BYTES));
    const bytesToRead = Math.min(size, maxTailBytes);
    const chunks: Buffer[] = [];
    let position = size;
    let remaining = bytesToRead;

    while (remaining > 0) {
      const readLength = Math.min(chunkBytes, remaining);
      position -= readLength;
      const chunk = Buffer.allocUnsafe(readLength);
      const bytesRead = readSync(fd, chunk, 0, readLength, position);
      if (bytesRead <= 0) break;
      chunks.unshift(bytesRead === readLength ? chunk : chunk.subarray(0, bytesRead));
      remaining -= bytesRead;
    }

    if (chunks.length === 0) return [];
    const tail = Buffer.concat(chunks);
    let completeStart = 0;
    if (bytesToRead < size) {
      const firstNewline = tail.indexOf(0x0a);
      if (firstNewline === -1) return [];
      completeStart = firstNewline + 1;
    }

    return tail
      .subarray(completeStart)
      .toString('utf-8')
      .split('\n')
      .map((line) => line.replace(/\r$/, ''))
      .filter(Boolean);
  } finally {
    closeSync(fd);
  }
}

export function listRoutingAdherenceEvents(
  limit = 100,
  opts: { phase?: RoutingAdherencePhase; maxTailBytes?: number; chunkBytes?: number } = {},
): RoutingAdherenceEvent[] {
  const safeLimit = Math.max(1, Math.min(Math.floor(limit) || 100, 1000));
  const path = eventsPath();
  if (!existsSync(path)) return [];
  const lines = readNewestJsonlLines(path, opts);
  const events: RoutingAdherenceEvent[] = [];
  // Iterate newest-to-oldest and stop after enough matches. Slicing before a
  // phase filter lets noisy phases hide older provider-stream failures. This is
  // a bounded latest-window read, so sparse matches older than the tail window
  // may return fewer than `limit` rows rather than scanning the whole log.
  for (let index = lines.length - 1; index >= 0 && events.length < safeLimit; index--) {
    const line = lines[index];
    try {
      const event = JSON.parse(line) as RoutingAdherenceEvent;
      if (opts.phase && event.phase !== opts.phase) continue;
      events.push(event);
    } catch {
      // Skip malformed records; the writer is append-only.
    }
  }
  return events;
}
