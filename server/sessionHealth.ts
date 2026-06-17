import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { PersistedSession } from './sessionStore';

export const DEFAULT_LATEST_USER_ONLY_THRESHOLD_MS = 2 * 60 * 1000;
export const DEFAULT_RECENT_SESSION_FILE_GRACE_MS = 30 * 1000;

export interface LatestUserOnlySession {
  id: string;
  title: string;
  workingDir: string | null;
  lastRole: string;
  lastTimestamp: string;
  ageMs: number;
  messageCount: number;
  fileMtime: string;
}

export interface LatestUserOnlyScanOptions {
  sessionsDir?: string;
  now?: number;
  thresholdMs?: number;
  recentFileGraceMs?: number;
}

export interface LatestUserOnlyRepairResult {
  repaired: LatestUserOnlySession[];
  skipped: LatestUserOnlySession[];
}

function defaultSessionsDir(): string {
  return join(homedir(), '.openharness', 'sessions');
}

export function hasCanceledMarker(session: PersistedSession, afterTimestampMs = Number.NEGATIVE_INFINITY): boolean {
  for (const msg of session.messages || []) {
    const msgTimestampMs = new Date(msg.timestamp).getTime();
    if (Number.isFinite(msgTimestampMs) && msgTimestampMs <= afterTimestampMs) continue;
    if (msg.role === 'assistant' && msg.runTrace) {
      const run = msg.runTrace;
      if (run.status === 'error') {
        const steps = run.steps ?? [];
        const hasAbort = steps.some(
          (s: any) =>
            s.type === 'error' &&
            typeof s.message === 'string' &&
            /cancel|abort|client.disconnect|client-sse/i.test(s.message),
        );
        if (hasAbort) return true;
      }
    }
    if (
      msg.role === 'assistant' &&
      typeof msg.content === 'string' &&
      /\[cancel|\babort\b|\binterrupted\b/i.test(msg.content)
    ) {
      return true;
    }
  }
  return false;
}

export function scanForLatestUserOnlySessions(options: LatestUserOnlyScanOptions = {}): LatestUserOnlySession[] {
  const sessionsDir = options.sessionsDir || defaultSessionsDir();
  if (!existsSync(sessionsDir)) return [];

  const now = options.now ?? Date.now();
  const thresholdMs = options.thresholdMs ?? DEFAULT_LATEST_USER_ONLY_THRESHOLD_MS;
  const recentFileGraceMs = options.recentFileGraceMs ?? DEFAULT_RECENT_SESSION_FILE_GRACE_MS;
  const flagged: LatestUserOnlySession[] = [];

  for (const file of readdirSync(sessionsDir).filter((f) => f.endsWith('.json'))) {
    try {
      const filePath = join(sessionsDir, file);
      const fileStat = statSync(filePath);
      if (now - fileStat.mtimeMs < recentFileGraceMs) continue;

      const session = JSON.parse(readFileSync(filePath, 'utf-8')) as PersistedSession;
      if (!session.messages || session.messages.length === 0) continue;

      const sorted = [...session.messages].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
      const last = sorted[sorted.length - 1];
      if (last.role !== 'user') continue;

      const lastTimestampMs = new Date(last.timestamp).getTime();
      if (!Number.isFinite(lastTimestampMs) || now - lastTimestampMs < thresholdMs) continue;
      if (hasCanceledMarker(session, lastTimestampMs)) continue;

      const assistantExists = sorted.some(
        (m) => m.role === 'assistant' && new Date(m.timestamp).getTime() > lastTimestampMs,
      );
      if (assistantExists) continue;

      flagged.push({
        id: session.id,
        title: session.title,
        workingDir: session.workingDir,
        lastRole: last.role,
        lastTimestamp: last.timestamp,
        ageMs: now - lastTimestampMs,
        messageCount: session.messages.length,
        fileMtime: fileStat.mtime.toISOString(),
      });
    } catch {
      // Ignore corrupted session files during health scans.
    }
  }

  return flagged.sort((a, b) => new Date(a.lastTimestamp).getTime() - new Date(b.lastTimestamp).getTime());
}

export function repairLatestUserOnlySessions(options: LatestUserOnlyScanOptions = {}): LatestUserOnlyRepairResult {
  const sessionsDir = options.sessionsDir || defaultSessionsDir();
  const flagged = scanForLatestUserOnlySessions(options);
  const repaired: LatestUserOnlySession[] = [];
  const skipped: LatestUserOnlySession[] = [];

  for (const item of flagged) {
    const filePath = join(sessionsDir, `${item.id}.json`);
    try {
      const session = JSON.parse(readFileSync(filePath, 'utf-8')) as PersistedSession;
      const lastTimestampMs = new Date(item.lastTimestamp).getTime();
      if (hasCanceledMarker(session, Number.isFinite(lastTimestampMs) ? lastTimestampMs : undefined)) {
        skipped.push(item);
        continue;
      }
      const timestamp = new Date().toISOString();
      const runTrace = {
        id: `session-repair-${item.id}-${Date.now()}`,
        sessionId: session.id,
        userMessageId: session.messages[session.messages.length - 1]?.id || '',
        requestedModel: 'unknown',
        effectiveModel: 'unknown',
        providerId: 'session-health',
        role: 'worker',
        status: 'error',
        startedAt: item.lastTimestamp,
        completedAt: timestamp,
        steps: [
          {
            id: `step-${Date.now()}`,
            timestamp,
            type: 'error',
            message: 'Recovered stale run: no assistant response was saved after the latest user message.',
          },
        ],
      };
      session.messages.push({
        id: `assistant-repair-${Date.now()}`,
        role: 'assistant',
        content: 'Run interrupted: OpenHarness recovered this session because no assistant response was saved after your last message. Please retry the request.',
        timestamp,
        runTrace,
      });
      session.updatedAt = timestamp;
      writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
      repaired.push(item);
    } catch {
      skipped.push(item);
    }
  }

  return { repaired, skipped };
}
