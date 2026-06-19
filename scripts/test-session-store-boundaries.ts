import { strict as assert } from 'node:assert';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { v4 as uuid } from 'uuid';
import {
  deleteSession,
  isValidSessionId,
  loadAllSessions,
  loadSession,
  saveSession,
  type PersistedSession,
} from '../server/sessionStore';

const sessionsDir = join(homedir(), '.openharness', 'sessions');
mkdirSync(sessionsDir, { recursive: true });

const validId = uuid();
const escapedTarget = join(tmpdir(), 'openharness-session-escape.json');

const session: PersistedSession = {
  id: validId,
  title: 'Boundary test',
  workingDir: process.cwd(),
  messages: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

try {
  assert.equal(isValidSessionId(validId), true, 'UUID session id should be valid');
  assert.equal(isValidSessionId('../escape'), false, 'traversal marker should be invalid');
  assert.equal(isValidSessionId('..%2Fescape'), false, 'encoded separator text should be invalid');
  assert.equal(isValidSessionId('..%252Fescape'), false, 'double-encoded separator text should be invalid');
  assert.equal(isValidSessionId('/tmp/escape'), false, 'absolute path should be invalid');
  assert.equal(isValidSessionId('..\\escape'), false, 'Windows separator traversal should be invalid');
  assert.equal(isValidSessionId('not-a-uuid'), false, 'malformed id should be invalid');

  assert.equal(loadSession('../escape'), null, 'loadSession should reject traversal ids');
  assert.equal(deleteSession('../escape'), false, 'deleteSession should reject traversal ids');
  assert.throws(
    () => saveSession({ ...session, id: '../escape' }),
    /Invalid session id/,
    'saveSession should reject traversal ids',
  );
  assert.equal(existsSync(escapedTarget), false, 'invalid session ids should not write outside the session directory');

  saveSession(session);
  assert.equal(loadSession(validId)?.id, validId, 'valid session should round-trip');

  writeFileSync(join(sessionsDir, 'not-a-session.json'), '{"id":"not-a-session","messages":[]}', 'utf-8');
  assert.equal(
    loadAllSessions().some((item) => item.id === 'not-a-session'),
    false,
    'loadAllSessions should skip non-UUID session filenames',
  );

  assert.equal(deleteSession(validId), true, 'deleteSession should delete valid existing sessions');
} finally {
  deleteSession(validId);
  rmSync(join(sessionsDir, 'not-a-session.json'), { force: true });
  rmSync(escapedTarget, { force: true });
}

console.log('Session store boundary tests passed.');
