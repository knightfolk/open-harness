import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import {
  deleteLog,
  getProcessById,
  spawnTracked,
  tailLog,
} from '../server/processLedger';

const secret = 'sk-123456789012345678901234';

const { child, entry } = spawnTracked(
  process.execPath,
  ['-e', `console.log(${JSON.stringify(secret)}); console.error(${JSON.stringify(`err:${secret}`)});`],
  {
    kind: 'other',
    name: `redaction-${Date.now()}`,
    notes: `notes ${secret}`,
  },
);

await new Promise<void>((resolve, reject) => {
  child.on('error', reject);
  child.on('close', () => resolve());
});

const refreshed = getProcessById(entry.id);
assert.ok(refreshed, 'tracked process should remain in the ledger');
assert.equal(JSON.stringify(refreshed).includes(secret), false, 'ledger metadata should redact raw secrets');
assert.ok(JSON.stringify(refreshed).includes('<redacted:OPENAI_KEY>'), 'ledger metadata should include redaction marker');

assert.ok(existsSync(entry.logFile), 'tracked process log should exist');
const rawLog = readFileSync(entry.logFile, 'utf-8');
assert.equal(rawLog.includes(secret), false, 'process log should not persist raw secrets');
assert.ok(rawLog.includes('<redacted:OPENAI_KEY>'), 'process log should include redaction marker');

const tail = tailLog(entry.pid);
assert.ok(tail, 'tailLog should return the tracked log');
assert.equal(tail.tail.includes(secret), false, 'tailLog output should not expose raw secrets');
assert.ok(tail.tail.includes('<redacted:OPENAI_KEY>'), 'tailLog output should include redaction marker');

deleteLog(entry.pid);

console.log('Process ledger redaction tests passed.');
