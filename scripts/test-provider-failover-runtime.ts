import { strict as assert } from 'node:assert';
import { runAgentPhase } from '../server/agentRuntime';
import type { StoredConfig } from '../server/config';
import type { HarnessRunStep } from '../server/runTrace';

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

const mixedTimeoutConfig: StoredConfig = {
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
    {
      id: 'zhipu',
      name: 'Zhipu Mock Provider',
      type: 'openai-compatible',
      apiKey: 'test-key',
      baseURL: 'https://zhipu.mock/v1',
      models: [
        { id: 'glm-5.2', name: 'GLM 5.2', enabled: true },
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

// Scenario D: fast primary fails over to GLM slow lane and keeps the GLM timeout in replay.
{
  const originalFetch = globalThis.fetch;
  const steps: HarnessRunStep[] = [];
  try {
    globalThis.fetch = (async (_input: any, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || '{}'));
      if (body.model === 'primary') {
        return new Response('{"error":"overloaded_error"}', { status: 529 });
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: 'GLM fallback answer.' } }] }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const artifact = await runAgentPhase(mixedTimeoutConfig, {
      profileId: 'summarizer',
      prompt: 'Summarize this.',
      modelId: 'mock:primary',
      fallbackModelIds: ['zhipu:glm-5.2'],
      onStep: (step) => steps.push(step),
      maxToolRounds: 1,
    });

    assert.equal(artifact.status, 'complete', `expected complete, got ${artifact.status}: ${artifact.error}`);
    const primaryStep = steps.find((step) => step.type === 'model_request' && step.model === 'mock:primary');
    assert.ok(primaryStep, `expected primary model_request step, got ${JSON.stringify(steps)}`);
    assert.deepEqual(primaryStep.phasePlan, {
      timeoutMs: 1_027_000,
      primaryModel: 'mock:primary',
      fallbackModels: ['zhipu:glm-5.2', 'mock:backup'],
      plannedRetryCount: 2,
      plannedBackoffMs: [2_000, 5_000],
    }, `expected serial phase deadline metadata on the first request, got ${JSON.stringify(primaryStep.phasePlan)}`);
    const fallbackStep = steps.find((step) => step.type === 'model_request' && step.model === 'zhipu:glm-5.2');
    assert.ok(fallbackStep, `expected GLM fallback model_request step, got ${JSON.stringify(steps)}`);
    assert.equal(fallbackStep.timeoutPolicy, 'slow-model');
    assert.equal(fallbackStep.timeoutLabel, 'Slow model lane');
    assert.equal(fallbackStep.timeoutMs, 300_000, `GLM fallback should use its own slow-lane timeout, got ${fallbackStep.timeoutMs}`);
    console.log('ok    runtime fallback to GLM keeps slow-lane timeout metadata');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// Scenario E: GLM primary fails over to a fast model and does not stamp the fallback with GLM's 300s timeout.
{
  const originalFetch = globalThis.fetch;
  const steps: HarnessRunStep[] = [];
  try {
    globalThis.fetch = (async (_input: any, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || '{}'));
      if (body.model === 'glm-5.2') {
        return new Response('{"error":"overloaded_error"}', { status: 529 });
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Fast fallback answer.' } }] }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const artifact = await runAgentPhase(mixedTimeoutConfig, {
      profileId: 'summarizer',
      prompt: 'Summarize this.',
      modelId: 'zhipu:glm-5.2',
      fallbackModelIds: ['mock:backup'],
      onStep: (step) => steps.push(step),
      maxToolRounds: 1,
    });

    assert.equal(artifact.status, 'complete', `expected complete, got ${artifact.status}: ${artifact.error}`);
    const fallbackStep = steps.find((step) => step.type === 'model_request' && step.model === 'mock:backup');
    assert.ok(fallbackStep, `expected fast fallback model_request step, got ${JSON.stringify(steps)}`);
    assert.equal(fallbackStep.timeoutPolicy, 'default');
    assert.equal(fallbackStep.timeoutLabel, 'Default model lane');
    assert.equal(fallbackStep.timeoutMs, 180_000, `fast fallback should use its own default timeout, got ${fallbackStep.timeoutMs}`);
    console.log('ok    runtime fallback from GLM keeps fast-lane timeout metadata');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

console.log('provider-failover runtime integration: all scenarios pass');
