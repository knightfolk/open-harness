// server/routingAdherence.ts
//
// Phase 1 telemetry for routing and prompt-adherence debugging. Events are
// append-only JSONL records, redacted before disk, and intentionally do not
// feed back into routing behavior.
import { existsSync, mkdirSync, readFileSync, appendFileSync } from 'fs';
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

export function listRoutingAdherenceEvents(limit = 100): RoutingAdherenceEvent[] {
  const safeLimit = Math.max(1, Math.min(Math.floor(limit) || 100, 1000));
  const path = eventsPath();
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, 'utf-8').split('\n').filter(Boolean);
  const events: RoutingAdherenceEvent[] = [];
  for (const line of lines.slice(-safeLimit).reverse()) {
    try {
      events.push(JSON.parse(line) as RoutingAdherenceEvent);
    } catch {
      // Skip malformed records; the writer is append-only.
    }
  }
  return events;
}
