import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, renameSync } from 'fs';
import { basename, join, relative, resolve } from 'path';
import { homedir } from 'os';
import { redactSecrets } from './sectionRedaction';
import type { SessionKind } from './sessionKinds';

// ── Types ──────────────────────────────────────────────

export interface PersistedMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    status: 'running' | 'complete' | 'error';
    input?: string;
    output?: string;
    duration?: number;
  }>;
  runTrace?: any;
  evidenceSource?: 'saved_session_trace' | 'log_trace' | 'imported_trace';
}

export interface PersistedSession {
  id: string;
  title: string;
  workingDir: string | null;
  messages: PersistedMessage[];
  createdAt: string;
  updatedAt: string;
  kind?: SessionKind;
  goal?: SessionGoal | null;
  version?: number;
}

export interface SessionGoal {
  id?: string;
  objective: string;
  status: 'active' | 'complete';
  criteria?: Array<{ id: string; text: string; status: 'pending' | 'complete' | 'blocked' }>;
  evidence?: Array<{ id: string; text: string; source?: string; createdAt: string }>;
  blockers?: Array<{ id: string; text: string; createdAt: string; resolvedAt?: string }>;
  progressNotes?: Array<{ id: string; text: string; createdAt: string }>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

function redactPersistedValue<T>(value: T): T {
  if (typeof value === 'string') return redactSecrets(value).redacted as T;
  if (Array.isArray(value)) return value.map((item) => redactPersistedValue(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redactPersistedValue(item)]),
    ) as T;
  }
  return value;
}

// ── Storage paths ──────────────────────────────────────

const SESSIONS_DIR = join(homedir(), '.openharness', 'sessions');
const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function ensureDir() {
  if (!existsSync(SESSIONS_DIR)) mkdirSync(SESSIONS_DIR, { recursive: true });
}

export function isValidSessionId(id: string): boolean {
  return typeof id === 'string' && SESSION_ID_RE.test(id);
}

function sessionPath(id: string): string {
  if (!isValidSessionId(id)) throw new Error('Invalid session id');
  const base = resolve(SESSIONS_DIR);
  const target = resolve(base, `${id}.json`);
  const rel = relative(base, target);
  if (rel === '..' || rel.startsWith('..') || rel === '' || basename(target) !== `${id}.json`) {
    throw new Error('Invalid session path');
  }
  return target;
}

// ── Save ───────────────────────────────────────────────

export function saveSession(session: PersistedSession): void {
  ensureDir();
  const target = sessionPath(session.id);
  const tmp = join(SESSIONS_DIR, `.${session.id}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(tmp, JSON.stringify(redactPersistedValue(session), null, 2), 'utf-8');
  renameSync(tmp, target);
}

// ── Load ───────────────────────────────────────────────

export function loadSession(id: string): PersistedSession | null {
  if (!isValidSessionId(id)) return null;
  const path = sessionPath(id);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as PersistedSession;
  } catch {
    return null;
  }
}

// ── Load all ───────────────────────────────────────────

export function loadAllSessions(): PersistedSession[] {
  ensureDir();
  const files = readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json') && isValidSessionId(f.slice(0, -5)));
  const sessions: PersistedSession[] = [];
  for (const file of files) {
    try {
      const session = JSON.parse(readFileSync(join(SESSIONS_DIR, file), 'utf-8')) as PersistedSession;
      sessions.push(session);
    } catch { /* skip corrupted */ }
  }
  return sessions;
}

// ── Delete ─────────────────────────────────────────────

export function deleteSession(id: string): boolean {
  if (!isValidSessionId(id)) return false;
  const path = sessionPath(id);
  if (!existsSync(path)) return false;
  try {
    unlinkSync(path);
    return true;
  } catch {
    return false;
  }
}

// ── List summaries ─────────────────────────────────────

export function listSessionSummaries(): Array<{ id: string; title: string; workingDir: string | null; createdAt: string; updatedAt: string; messageCount: number; preview: string; kind?: SessionKind }> {
  const sessions = loadAllSessions();
  return sessions.map(s => ({
    id: s.id,
    title: s.title,
    workingDir: s.workingDir,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    messageCount: s.messages.length,
    preview: s.messages.length > 0 ? s.messages[s.messages.length - 1].content.slice(0, 80) : '',
    kind: s.kind,
  })).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}
