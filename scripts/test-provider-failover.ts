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

import { retryWithProviderFailover } from '../server/agentRuntime';

// ── retryWithProviderFailover: same-model recovery ──
// Stub fetch to fail twice with 529 then succeed on the same model.
{
  let calls = 0;
  const originalFetch = globalThis.fetch;
  const sleeps: number[] = [];
  try {
    globalThis.fetch = (async () => {
      calls++;
      if (calls < 3) {
        return new Response('{"error":"overloaded_error"}', { status: 529 });
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: 'recovered' } }] }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    const result = await retryWithProviderFailover({
      attempt: async () => {
        const res = await fetch('https://x');
        if (!res.ok) throw new Error(`Provider returned ${res.status}: ${await res.text()}`);
        return { recovered: true, model: 'same' };
      },
      isTransient: isTransientProviderError,
      backoffMs: [10, 20],          // short for the test
      onSleep: (ms) => sleeps.push(ms),
      fallbackModelIds: [],
      fallbackAttempt: async () => { throw new Error('should not reach fallback'); },
      signal: undefined,
    });
    assert.equal(calls, 3, 'should have retried twice on same model then succeeded');
    assert.deepEqual(sleeps, [10, 20], 'should have backed off twice');
    assert.equal(result.recovered, true);
    console.log('ok    retryWithProviderFailover same-model recovery');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// ── retryWithProviderFailover: cross-model failover ──
// Original model always 529; first fallback model succeeds.
{
  const attempts: string[] = [];
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => {
      return new Response('{"error":"overloaded_error"}', { status: 529 });
    }) as typeof fetch;
    const result = await retryWithProviderFailover({
      attempt: async (modelId: string) => {
        attempts.push(modelId);
        const res = await fetch('https://x');
        if (!res.ok) throw new Error(`Provider returned ${res.status}`);
        return { recovered: true, model: modelId };
      },
      isTransient: isTransientProviderError,
      backoffMs: [5, 5],
      fallbackModelIds: ['fallback-a', 'fallback-b'],
      fallbackAttempt: async (modelId: string) => {
        attempts.push('fallback:' + modelId);
        if (modelId === 'fallback-a') return { recovered: true, model: 'fallback-a', assistedByFallback: true };
        throw new Error('Provider returned 529');
      },
      signal: undefined,
    });
    assert.deepEqual(attempts, ['__PRIMARY__', '__PRIMARY__', '__PRIMARY__', 'fallback:fallback-a'],
      `should retry primary 3x then try first fallback; got ${JSON.stringify(attempts)}`);
    assert.equal(result.recovered, true);
    assert.equal((result as any).assistedByFallback, true);
    console.log('ok    retryWithProviderFailover cross-model failover');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// ── retryWithProviderFailover: non-transient error propagates immediately ──
{
  let calls = 0;
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => {
      calls++;
      return new Response('{"error":"bad request"}', { status: 400 });
    }) as typeof fetch;
    await retryWithProviderFailover({
      attempt: async () => {
        const res = await fetch('https://x');
        if (!res.ok) throw new Error(`Provider returned ${res.status}`);
        return { recovered: true };
      },
      isTransient: isTransientProviderError,
      backoffMs: [10, 20],
      fallbackModelIds: ['fb'],
      fallbackAttempt: async () => { throw new Error('fallback should not run'); },
      signal: undefined,
    });
    assert.fail('should have thrown on non-transient error');
  } catch (err: any) {
    assert.match(err.message, /400/);
    assert.equal(calls, 1, 'non-transient error should short-circuit after one call');
    console.log('ok    retryWithProviderFailover non-transient propagates');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// ── retryWithProviderFailover: user abort short-circuits backoff ──
{
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 5);
  try {
    await retryWithProviderFailover({
      attempt: async () => { throw new Error('Provider returned 529'); },
      isTransient: isTransientProviderError,
      backoffMs: [5000, 5000],
      fallbackModelIds: [],
      fallbackAttempt: async () => { throw new Error('Provider returned 529'); },
      signal: controller.signal,
    });
    assert.fail('should have thrown on abort');
  } catch (err: any) {
    assert.match(err.message, /abort/i, 'should surface abort, not keep waiting');
    console.log('ok    retryWithProviderFailover abort short-circuits backoff');
  }
}

console.log('retryWithProviderFailover: all scenarios pass');

