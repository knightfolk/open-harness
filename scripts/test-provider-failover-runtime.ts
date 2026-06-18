import { strict as assert } from 'node:assert';
import { runAgentPhase } from '../server/agentRuntime';
import type { StoredConfig } from '../server/config';

const config: StoredConfig = {
  version: 1,
  providers: [
    {
      id: 'mock',
      name: 'Mock Provider',
      type: 'openai-compatible',
      apiKey: 'test-key',
      baseURL: 'https://mock.provider/v1',
      models: [
        { id: 'primary', name: 'Primary', enabled: true },
        { id: 'backup', name: 'Backup', enabled: true },
      ],
    },
  ],
  mcpServers: [],
  personality: '',
  activeModel: 'mock:backup',
  activeTheme: 'midnight',
  roleAssignments: { summarizer: 'mock:primary' },
  trustMode: 'workspace-write',
};

// Scenario A: primary 529s twice, then recovers on the same model (no failover).
{
  const originalFetch = globalThis.fetch;
  let primaryCalls = 0;
  try {
    globalThis.fetch = (async () => {
      primaryCalls++;
      if (primaryCalls < 3) {
        return new Response('{"error":"overloaded_error"}', { status: 529 });
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Same-model recovery answer.' } }] }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const artifact = await runAgentPhase(config, {
      profileId: 'summarizer',
      prompt: 'Summarize this.',
      modelId: 'mock:primary',
      fallbackModelIds: ['mock:backup'],
      timeoutMs: 10_000,
    });

    assert.equal(artifact.status, 'complete', `expected complete, got ${artifact.status}: ${artifact.error}`);
    assert.match(artifact.response, /Same-model recovery/);
    assert.ok(!artifact.notes.some((n) => n.includes('recover-model')),
      'same-model recovery must not mark assistedByFallback');
    console.log('ok    runtime same-model recovery (529 x2 -> success)');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// Scenario B: primary always 529, fallback model succeeds.
{
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (_input: any, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || '{}'));
      if (body.model === 'primary') {
        return new Response('{"error":"overloaded_error"}', { status: 529 });
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Fallback model answer.' } }] }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const artifact = await runAgentPhase(config, {
      profileId: 'summarizer',
      prompt: 'Summarize this.',
      modelId: 'mock:primary',
      fallbackModelIds: ['mock:backup'],
      timeoutMs: 10_000,
    });

    assert.equal(artifact.status, 'complete', `expected complete, got ${artifact.status}: ${artifact.error}`);
    assert.match(artifact.response, /Fallback model answer/);
    assert.ok(artifact.notes.some((n) => n.includes('recover-model=mock:backup')),
      `expected recover-model note, got: ${JSON.stringify(artifact.notes)}`);
    console.log('ok    runtime cross-model failover (primary 529 -> backup)');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// Scenario C: non-transient 400 propagates, no retry, no failover.
{
  const originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = (async () => {
      calls++;
      return new Response('{"error":"bad request"}', { status: 400 });
    }) as typeof fetch;
    const artifact = await runAgentPhase(config, {
      profileId: 'summarizer',
      prompt: 'Summarize this.',
      modelId: 'mock:primary',
      fallbackModelIds: ['mock:backup'],
      timeoutMs: 10_000,
    });
    assert.equal(artifact.status, 'error');
    assert.match(artifact.error || '', /400/);
    assert.equal(calls, 1, '400 must not trigger retry or failover');
    console.log('ok    runtime non-transient (400) propagates without retry');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

console.log('provider-failover runtime integration: all scenarios pass');
