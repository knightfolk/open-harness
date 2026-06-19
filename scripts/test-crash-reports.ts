import assert from 'node:assert/strict';
import { selectCrashLogLines } from '../server/crashReports';

const excerpt = selectCrashLogLines([
  'user prompt: please keep this out of report',
  'info: server started',
  'Error: provider returned 529',
  'handled workaround: retried with another model',
  'fatal: renderer crashed',
].join('\n'));

assert.match(excerpt, /provider returned 529/);
assert.match(excerpt, /renderer crashed/);
assert.doesNotMatch(excerpt, /please keep this out/);

console.log('crash report excerpt selection ok');
