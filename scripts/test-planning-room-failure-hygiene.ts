import { strict as assert } from 'node:assert';
import { runOrchestratorPipeline } from '../server/orchestrator';
import type { RouteDecision } from '../server/router';
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
        { id: 'good-planner', name: 'Good Planner', enabled: true },
        { id: 'markup-only', name: 'Markup Only', enabled: true },
        { id: 'auth-fail', name: 'Auth Fail', enabled: true },
      ],
    },
  ],
  mcpServers: [],
  personality: '',
  activeModel: 'mock:good-planner',
  activeTheme: 'midnight',
  roleAssignments: {
    planner: 'mock:good-planner',
    reasoner: 'mock:markup-only',
    reviewer: 'mock:auth-fail',
  },
  trustMode: 'workspace-write',
};

const route: RouteDecision = {
  mode: 'plan',
  role: 'planner',
  complexity: 'medium',
  needsTools: true,
  needsValidation: false,
  suggestedModels: [],
  reason: 'test Planning Room',
};

const originalFetch = globalThis.fetch;

try {
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || '{}'));
    const model = body.model;
    const text = body.messages.map((message: any) => message.content).join('\n');

    if (model === 'auth-fail') {
      return new Response(JSON.stringify({ error: { message: 'Authentication parameter not received in Header' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (model === 'markup-only') {
      return new Response(JSON.stringify({
        choices: [{ message: { content: '<tool_call>\n<list_directory><path>.</path></list_directory>\n</tool_call>' } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const content = text.includes('Planning Room: Final Synthesis')
      ? 'Final recommendation: keep the clean participant output and show phase failures.'
      : text.includes('Planning Room: Peer Review')
        ? 'Cross-check: the clean participant is usable.'
        : 'Recommendation: use the bounded P0 implementation plan.';

    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  const result = await runOrchestratorPipeline(route, 'Review the P0 routing slice.', config, process.cwd());

  assert.equal(result.ok, false, 'partial Planning Room failures should keep overall status as failed');
  assert.match(result.finalText, /Final recommendation/, 'usable synthesis should remain visible');
  assert.match(result.finalText, /Phase Issues/, 'failed phases should be visible to the user');
  assert.match(result.finalText, /auth-fail/i, 'auth failures should name the failed phase');
  assert.match(result.finalText, /without producing a final answer|empty response after cleanup/i, 'markup-only responses should be reported as unusable');
  assert.doesNotMatch(result.finalText, /<tool_call>|<list_directory>/i, 'raw tool markup should not leak into final Planning Room output');

  const allFailedConfig: StoredConfig = {
    ...config,
    providers: [
      {
        ...config.providers[0],
        models: [
          { id: 'markup-only', name: 'Markup Only', enabled: true },
          { id: 'auth-fail', name: 'Auth Fail', enabled: true },
        ],
      },
    ],
    activeModel: 'mock:markup-only',
    roleAssignments: {
      planner: 'mock:markup-only',
      reasoner: 'mock:auth-fail',
      reviewer: 'mock:auth-fail',
    },
  };
  const allFailed = await runOrchestratorPipeline(route, 'Review the P0 routing slice.', allFailedConfig, process.cwd());
  assert.equal(allFailed.ok, false, 'all-failed Planning Room should fail overall');
  assert.match(allFailed.finalText, /Planning Room Failed/, 'all-failed output should be explicit');
  assert.match(allFailed.finalText, /Phase Issues/, 'all-failed output should include phase details');
  assert.match(allFailed.finalText, /auth-fail|without producing a final answer|empty response after cleanup/i, 'all-failed output should include actionable phase errors');
  assert.doesNotMatch(allFailed.finalText, /<tool_call>|<list_directory>/i, 'all-failed output should not leak raw tool markup');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('Planning Room failure hygiene tests passed.');
