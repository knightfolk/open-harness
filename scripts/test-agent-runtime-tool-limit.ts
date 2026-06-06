import { strict as assert } from 'node:assert';
import { runAgentPhase } from '../server/agentRuntime';
import type { StoredConfig } from '../server/config';

const config: StoredConfig = {
  version: 1,
  providers: [
    {
      id: 'mock',
      name: 'Mock OpenAI Provider',
      type: 'openai-compatible',
      apiKey: 'test-key',
      baseURL: 'https://mock.provider/v1',
      models: [{ id: 'planner-model', name: 'Planner Model', enabled: true }],
    },
  ],
  mcpServers: [],
  personality: '',
  activeModel: 'mock:planner-model',
  activeTheme: 'midnight',
  roleAssignments: { planner: 'mock:planner-model' },
  trustMode: 'workspace-write',
};

const originalFetch = globalThis.fetch;
const requestedRounds: number[] = [];

try {
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || '{}'));
    requestedRounds.push(body.messages.length);
    const finalInstruction = body.messages.some((message: any) =>
      typeof message.content === 'string' && message.content.includes('Produce the final answer now')
    );

    if (finalInstruction) {
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'Final recommendation: use the gathered files to create the plan.' } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      choices: [{ message: { content: '<tool_call>{"name":"read_file","arguments":{"path":"AGENTS.md"}}</tool_call>' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  const artifact = await runAgentPhase(config, {
    profileId: 'planner',
    prompt: 'Create a Planning Room plan.',
    modelId: 'mock:planner-model',
    workingDir: process.cwd(),
    invokeTool: async () => 'mock tool result',
  });

  assert.equal(artifact.status, 'complete', 'agent should stay complete after forced synthesis');
  assert.match(artifact.response, /Final recommendation/, 'forced synthesis response should be captured');
  assert.equal(requestedRounds.length, 7, 'runtime should make one final no-tools synthesis request after six tool rounds');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('Agent runtime tool-limit synthesis tests passed.');
