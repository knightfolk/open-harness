import { strict as assert } from 'node:assert';
import { isTransientProviderError } from '../server/agentRuntime';

const cases: Array<{ name: string; input: unknown; expected: boolean }> = [
  { name: '529 overloaded', input: new Error('Provider returned 529: {"type":"error","error":{"type":"overloaded_error"}}'), expected: true },
  { name: '502 bad gateway', input: new Error('Provider returned 502: Bad Gateway'), expected: true },
  { name: '503 service unavailable', input: new Error('Provider returned 503: unavailable'), expected: true },
  { name: '504 gateway timeout', input: new Error('Provider returned 504: timeout'), expected: true },
  { name: '429 rate limit', input: new Error('Provider returned 429: rate_limit_error'), expected: true },
  { name: '500 server error', input: new Error('Provider returned 500: Internal Server Error'), expected: true },
  { name: 'overloaded_error body substring', input: new Error('upstream said overloaded_error, retry later'), expected: true },
  { name: 'network TypeError', input: new TypeError('fetch failed'), expected: true },
  { name: '400 bad request', input: new Error('Provider returned 400: bad request'), expected: false },
  { name: '401 unauthorized', input: new Error('Provider returned 401: unauthorized'), expected: false },
  { name: '403 forbidden', input: new Error('Provider returned 403: forbidden'), expected: false },
  { name: '404 not found', input: new Error('Provider returned 404: not found'), expected: false },
  { name: 'generic non-transient', input: new Error('Agent exhausted tool rounds'), expected: false },
];

let failures = 0;
for (const c of cases) {
  const got = isTransientProviderError(c.input);
  if (got !== c.expected) {
    console.error(`FAIL  ${c.name}: expected ${c.expected}, got ${got}`);
    failures++;
  } else {
    console.log(`ok    ${c.name}`);
  }
}
assert.equal(failures, 0, `${failures} transient-classification case(s) failed`);
console.log('isTransientProviderError: all cases pass');
