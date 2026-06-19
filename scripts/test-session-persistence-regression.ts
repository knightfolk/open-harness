import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, utimesSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir, tmpdir } from 'os';
import { v4 as uuid } from 'uuid';
import { saveSession, type PersistedSession } from '../server/sessionStore';
import { repairLatestUserOnlySessions, scanForLatestUserOnlySessions } from '../server/sessionHealth';

const SESSIONS_DIR = join(homedir(), '.openharness', 'sessions');

const testSessionId = uuid();
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

const canceledSessionId = uuid();
const canceledSession: PersistedSession = {
  id: canceledSessionId,
  title: 'Regression test - canceled session',
  workingDir: null,
  createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  messages: [
    {
      id: 'user-2',
      role: 'user',
      content: 'This session was interrupted',
      timestamp: new Date(Date.now() - 4.8 * 60 * 1000).toISOString(),
    },
    {
      id: 'asst-2',
      role: 'assistant',
      content: '[canceled by user]',
      timestamp: new Date(Date.now() - 4.7 * 60 * 1000).toISOString(),
    },
  ],
};

const retryAfterInterruptedId = uuid();
const retryAfterInterruptedSession: PersistedSession = {
  id: retryAfterInterruptedId,
  title: 'Regression test - retry after old interrupted marker',
  workingDir: null,
  createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
  updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  messages: [
    {
      id: 'user-old',
      role: 'user',
      content: 'First attempt',
      timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    },
    {
      id: 'assistant-old',
      role: 'assistant',
      content: 'Run interrupted: OpenHarness recovered this session because no assistant response was saved after your last message. Please retry the request.',
      timestamp: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
    },
    {
      id: 'user-new',
      role: 'user',
      content: 'Retry that should still be flagged when no newer assistant exists',
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
  ],
};

try {
  saveSession(testSession);
  saveSession(canceledSession);
  saveSession(retryAfterInterruptedSession);

  const backdate = new Date(Date.now() - 60 * 1000);
  utimesSync(join(SESSIONS_DIR, `${testSessionId}.json`), backdate, backdate);
  utimesSync(join(SESSIONS_DIR, `${canceledSessionId}.json`), backdate, backdate);
  utimesSync(join(SESSIONS_DIR, `${retryAfterInterruptedId}.json`), backdate, backdate);

  const flagged = scanForLatestUserOnlySessions();
  const found = flagged.find(f => f.id === testSessionId);

  assert.equal(!!found, true, 'Test session with latest-user-only should be flagged');
  assert.equal(found!.lastRole, 'user', 'Flagged session should have user as last role');

  const canceledFound = flagged.find(f => f.id === canceledSessionId);
  assert.equal(!!canceledFound, false, 'Session with canceled marker should NOT be flagged');

  const retryAfterInterruptedFound = flagged.find(f => f.id === retryAfterInterruptedId);
  assert.equal(
    !!retryAfterInterruptedFound,
    true,
    'A newer user retry after an old interrupted marker should still be flagged',
  );

  const repair = repairLatestUserOnlySessions();
  assert.equal(
    repair.repaired.some((s) => s.id === testSessionId),
    true,
    'Latest-user-only test session should be repaired with a visible assistant marker',
  );
  assert.equal(
    repair.repaired.some((s) => s.id === retryAfterInterruptedId),
    true,
    'Retry-after-interrupted session should also be repaired',
  );
  const repairedScan = scanForLatestUserOnlySessions();
  assert.equal(
    repairedScan.some((s) => s.id === testSessionId),
    false,
    'Repaired session should no longer be flagged as latest-user-only',
  );
  const repairedStored = JSON.parse(readFileSync(join(SESSIONS_DIR, `${testSessionId}.json`), 'utf-8'));
  const repairedLast = repairedStored.messages[repairedStored.messages.length - 1];
  assert.equal(repairedLast.role, 'assistant', 'Repair marker should be an assistant message');
  assert.match(repairedLast.content, /Run interrupted/i, 'Repair marker should explain the interrupted run');

  console.log('Session persistence regression test passed.');
  console.log(`  Test session correctly flagged as latest-user-only (${Math.round(found!.ageMs / 1000)}s old)`);
  console.log('  Test session correctly repaired with a visible assistant marker');
  console.log('  Canceled session correctly exempted');

  const realFlagged = flagged.filter(
    f => f.id !== testSessionId
      && f.id !== canceledSessionId
      && f.id !== retryAfterInterruptedId,
  );
  if (realFlagged.length > 0) {
    console.log(`\n  WARNING: ${realFlagged.length} real session(s) flagged as latest-user-only:`);
    for (const s of realFlagged) {
      console.log(`    - ${s.id} (${s.title?.slice(0, 50)}) — ${Math.round(s.ageMs / 1000)}s old, messages=${s.messageCount}, cwd=${s.workingDir || 'none'}`);
    }
  } else {
    console.log('  No real sessions flagged (healthy).');
  }
} finally {
  try { unlinkSync(join(SESSIONS_DIR, `${testSessionId}.json`)); } catch { /* ignore */ }
  try { unlinkSync(join(SESSIONS_DIR, `${canceledSessionId}.json`)); } catch { /* ignore */ }
  try { unlinkSync(join(SESSIONS_DIR, `${retryAfterInterruptedId}.json`)); } catch { /* ignore */ }
}

const startupRepairDir = mkdtempSync(join(tmpdir(), 'openharness-session-startup-repair-'));
try {
  mkdirSync(startupRepairDir, { recursive: true });
  const staleSessionId = uuid();
  const staleTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const startupRepairFile = join(startupRepairDir, `${staleSessionId}.json`);
  writeFileSync(startupRepairFile, JSON.stringify({
    id: staleSessionId,
    title: 'Startup repair regression',
    workingDir: null,
    createdAt: staleTimestamp,
    updatedAt: staleTimestamp,
    messages: [{
      id: 'user-startup',
      role: 'user',
      content: 'This should be repaired before app load.',
      timestamp: staleTimestamp,
    }],
  }, null, 2));
  const staleMtime = new Date(Date.now() - 5 * 60 * 1000);
  utimesSync(startupRepairFile, staleMtime, staleMtime);

  const repaired = repairLatestUserOnlySessions({
    sessionsDir: startupRepairDir,
    thresholdMs: 2 * 60 * 1000,
    recentFileGraceMs: 0,
  });
  assert.equal(repaired.repaired.length, 1, 'startup repair should repair one stale session');
  const afterStartupRepair = scanForLatestUserOnlySessions({
    sessionsDir: startupRepairDir,
    thresholdMs: 2 * 60 * 1000,
    recentFileGraceMs: 0,
  });
  assert.equal(afterStartupRepair.length, 0, 'startup-repaired temp session should no longer be latest-user-only');
} finally {
  rmSync(startupRepairDir, { recursive: true, force: true });
}
