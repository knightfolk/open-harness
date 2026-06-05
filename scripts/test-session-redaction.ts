import { strict as assert } from 'node:assert';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { saveSession, type PersistedSession } from '../server/sessionStore';

const fakeKey = 'sk-123456789012345678901234';
const sessionId = `redaction-test-${Date.now()}`;
const path = join(homedir(), '.openharness', 'sessions', `${sessionId}.json`);

const session: PersistedSession = {
  id: sessionId,
  title: `secret ${fakeKey}`,
  workingDir: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  messages: [
    {
      id: 'm1',
      role: 'assistant',
      content: `Here is ${fakeKey}`,
      timestamp: new Date().toISOString(),
      toolCalls: [
        { id: 't1', name: 'exec_command', status: 'complete', input: `echo ${fakeKey}`, output: fakeKey },
      ],
      runTrace: { steps: [{ type: 'tool_call', input: fakeKey, outputPreview: fakeKey }] },
    },
  ],
};

try {
  saveSession(session);
  assert.equal(existsSync(path), true, 'test session file should be written');
  const stored = readFileSync(path, 'utf-8');
  assert.equal(stored.includes(fakeKey), false, 'persisted session should not contain raw secret');
  assert.equal(stored.includes('<redacted:OPENAI_KEY>'), true, 'persisted session should contain redaction marker');
  console.log('Session redaction tests passed.');
} finally {
  try { unlinkSync(path); } catch { /* ignore */ }
}
