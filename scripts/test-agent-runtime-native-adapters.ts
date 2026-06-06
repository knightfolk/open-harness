import { strict as assert } from 'node:assert';
import { runAgentPhase } from '../server/agentRuntime';
import type { StoredConfig } from '../server/config';

function configFor(type: 'anthropic' | 'google'): StoredConfig {
  return {
    version: 1,
    providers: [
      {
        id: type,
        name: `${type} test provider`,
        type,
        apiKey: 'test-key',
        baseURL: type === 'anthropic'
          ? 'https://api.anthropic.test/v1'
          : 'https://generativelanguage.googleapis.test/v1beta',
        models: [{ id: 'planner-model', name: 'Planner Model', enabled: true }],
      },
    ],
    mcpServers: [],
    personality: '',
    activeModel: `${type}:planner-model`,
    activeTheme: 'midnight',
    roleAssignments: { planner: `${type}:planner-model` },
    trustMode: 'workspace-write',
  };
}

function anthropicResponse(): Response {
  const body = [
    'data: {"type":"content_block_start","content_block":{"type":"text","text":""}}',
    '',
    'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Final recommendation: keep Planning Room working."}}',
    '',
    'data: {"type":"content_block_stop"}',
    '',
    'data: {"type":"message_stop"}',
    '',
  ].join('\n');
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

function googleResponse(): Response {
  const body = JSON.stringify({
    candidates: [
      {
        content: {
          parts: [
            { text: 'Final recommendation: keep Planning Room working.' },
          ],
        },
      },
    ],
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } });
}

const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes('anthropic.test')) return anthropicResponse();
    if (url.includes('generativelanguage.googleapis.test')) return googleResponse();
    throw new Error(`Unexpected fetch URL: ${url}`);
  }) as typeof fetch;

  for (const providerType of ['anthropic', 'google'] as const) {
    const artifact = await runAgentPhase(configFor(providerType), {
      profileId: 'planner',
      prompt: 'Create a plan.',
      modelId: `${providerType}:planner-model`,
    });

    assert.equal(artifact.status, 'complete', `${providerType} agent should complete`);
    assert.match(artifact.response, /Final recommendation/, `${providerType} response should be captured`);
  }
} finally {
  globalThis.fetch = originalFetch;
}

console.log('Agent runtime native adapter tests passed.');
