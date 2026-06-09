import { strict as assert } from 'node:assert';
import { existsSync, readFileSync, readdirSync, statSync, unlinkSync, utimesSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { saveSession, type PersistedSession } from '../server/sessionStore';

const SESSIONS_DIR = join(homedir(), '.openharness', 'sessions');
const THRESHOLD_MS = 2 * 60 * 1000;
const RECENT_FILE_MS = 30 * 1000;

interface FlaggedSession {
  id: string;
  title: string;
  lastRole: string;
  lastTimestamp: string;
  ageMs: number;
}

function hasCanceledMarker(session: PersistedSession): boolean {
  for (const msg of session.messages) {
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

function scanForLatestUserOnly(): FlaggedSession[] {
  if (!existsSync(SESSIONS_DIR)) return [];
  const files = readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
  const now = Date.now();
  const flagged: FlaggedSession[] = [];

  for (const file of files) {
    try {
      const filePath = join(SESSIONS_DIR, file);
      const raw = readFileSync(filePath, 'utf-8');
      const session = JSON.parse(raw) as PersistedSession;
      if (!session.messages || session.messages.length === 0) continue;

      const fileAge = now - statSync(filePath).mtimeMs;
      if (fileAge < RECENT_FILE_MS) continue;

      if (hasCanceledMarker(session)) continue;

      const sorted = [...session.messages].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
      const last = sorted[sorted.length - 1];
      if (last.role !== 'user') continue;

      const ageMs = now - new Date(last.timestamp).getTime();
      if (ageMs < THRESHOLD_MS) continue;

      const assistantExists = sorted.some(
        m => m.role === 'assistant' && new Date(m.timestamp).getTime() > new Date(last.timestamp).getTime(),
      );
      if (assistantExists) continue;

      flagged.push({
        id: session.id,
        title: session.title,
        lastRole: last.role,
        lastTimestamp: last.timestamp,
        ageMs,
      });
    } catch { /* skip corrupted */ }
  }

  return flagged;
}

const testSessionId = `persistence-regression-test-${Date.now()}`;
const testSession: PersistedSession = {
  id: testSessionId,
  title: 'Regression test - should be cleaned up',
  workingDir: null,
  createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  messages: [
    {
      id: 'user-1',
      role: 'user',
      content: 'This is a test message that should be flagged',
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
  ],
};

const canceledSessionId = `persistence-regression-canceled-${Date.now()}`;
const canceledSession: PersistedSession = {
  id: canceledSessionId,
  title: 'Regression test - canceled session',
  workingDir: null,
  createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  messages: [
    {
      id: 'asst-2',
      role: 'assistant',
      content: '[canceled by user]',
      timestamp: new Date(Date.now() - 4.9 * 60 * 1000).toISOString(),
    },
    {
      id: 'user-2',
      role: 'user',
      content: 'This session was interrupted',
      timestamp: new Date(Date.now() - 4.8 * 60 * 1000).toISOString(),
    },
  ],
};

try {
  saveSession(testSession);
  saveSession(canceledSession);

  const backdate = new Date(Date.now() - 60 * 1000);
  utimesSync(join(SESSIONS_DIR, `${testSessionId}.json`), backdate, backdate);
  utimesSync(join(SESSIONS_DIR, `${canceledSessionId}.json`), backdate, backdate);

  const flagged = scanForLatestUserOnly();
  const found = flagged.find(f => f.id === testSessionId);

  assert.equal(!!found, true, 'Test session with latest-user-only should be flagged');
  assert.equal(found!.lastRole, 'user', 'Flagged session should have user as last role');

  const canceledFound = flagged.find(f => f.id === canceledSessionId);
  assert.equal(!!canceledFound, false, 'Session with canceled marker should NOT be flagged');

  console.log('Session persistence regression test passed.');
  console.log(`  Test session correctly flagged as latest-user-only (${Math.round(found!.ageMs / 1000)}s old)`);
  console.log('  Canceled session correctly exempted');

  const realFlagged = flagged.filter(
    f => !f.id.startsWith('persistence-regression-test-') && !f.id.startsWith('persistence-regression-canceled-'),
  );
  if (realFlagged.length > 0) {
    console.log(`\n  WARNING: ${realFlagged.length} real session(s) flagged as latest-user-only:`);
    for (const s of realFlagged) {
      console.log(`    - ${s.id} (${s.title?.slice(0, 50)}) — ${Math.round(s.ageMs / 1000)}s old`);
    }
  } else {
    console.log('  No real sessions flagged (healthy).');
  }
} finally {
  try { unlinkSync(join(SESSIONS_DIR, `${testSessionId}.json`)); } catch { /* ignore */ }
  try { unlinkSync(join(SESSIONS_DIR, `${canceledSessionId}.json`)); } catch { /* ignore */ }
}
