import { strict as assert } from 'node:assert';
import { unlinkSync, utimesSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { saveSession, type PersistedSession } from '../server/sessionStore';
import { scanForLatestUserOnlySessions } from '../server/sessionHealth';

const SESSIONS_DIR = join(homedir(), '.openharness', 'sessions');

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

  const flagged = scanForLatestUserOnlySessions();
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
      console.log(`    - ${s.id} (${s.title?.slice(0, 50)}) — ${Math.round(s.ageMs / 1000)}s old, messages=${s.messageCount}, cwd=${s.workingDir || 'none'}`);
    }
  } else {
    console.log('  No real sessions flagged (healthy).');
  }
} finally {
  try { unlinkSync(join(SESSIONS_DIR, `${testSessionId}.json`)); } catch { /* ignore */ }
  try { unlinkSync(join(SESSIONS_DIR, `${canceledSessionId}.json`)); } catch { /* ignore */ }
}
