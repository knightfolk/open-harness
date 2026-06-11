import { strict as assert } from 'node:assert';
import { configureAutoRouter, clearRouterCache, getAutoRouterState, routeTask } from '../server/autoRouter';
import { getModelConfig } from '../server/modelProfiles';
import type { StoredConfig } from '../server/config';

const config: StoredConfig = {
  version: 1,
  providers: [
    {
      id: 'local',
      name: 'Local Test Provider',
      type: 'local',
      apiKey: '',
      baseURL: 'http://127.0.0.1:9/v1',
      models: [
        { id: 'phi-4', name: 'Phi 4', enabled: true },
        { id: 'MiniMax-M3', name: 'MiniMax M3', enabled: true },
        { id: 'claude-opus-4.8', name: 'Claude Opus 4.8', enabled: true },
      ],
    },
  ],
  mcpServers: [],
  personality: '',
  activeModel: 'local:phi-4',
  activeTheme: 'midnight',
  roleAssignments: {},
  trustMode: 'workspace-write',
  autoRouter: {
    enabled: true,
    classifierModel: 'local:phi-4',
    threshold: 0.7,
    defaultModel: 'local:phi-4',
    cacheTTLMs: 0,
    candidates: [
      {
        modelId: 'local:phi-4',
        cost: 0.01,
        supportsImages: false,
        card: 'Tiny local model with a 16K context limit. Cheap, but not suitable for large-context tasks.',
      },
      {
        modelId: 'local:MiniMax-M3',
        cost: 0.5,
        supportsImages: true,
        card: 'Large-context 1M-token model. Use when the task or conversation cannot fit smaller models.',
      },
      {
        modelId: 'local:claude-opus-4.8',
        cost: 1.2,
        supportsImages: true,
        supportsThinking: true,
        card: 'Premium frontier-style model for hard reasoning, architecture, and code review.',
      },
    ],
  },
};

configureAutoRouter(config);
clearRouterCache();

const configuredState = getAutoRouterState();
assert.equal(configuredState.configuredCandidateCount, 3, 'router state should report the configured candidate count');
assert.equal(configuredState.candidateCount, 3, 'all authenticated candidates should be usable');
assert.deepEqual(configuredState.unavailableCandidates, [], 'usable config should not report dropped candidates');

const smallDecision = await routeTask({
  task: 'Rename a variable in one file.',
  surface: 'orchestrator',
  hasImages: false,
  turns: 1,
  toolCount: 5,
  estimatedInputTokens: 1_000,
}, config, { forceCostStrategy: 'cheapest' });

assert.equal(smallDecision?.modelId, 'local:phi-4', 'small tasks should still use the cheapest context-safe candidate');
assert.equal(smallDecision?.scores['local:phi-4'], 1);

const largeDecision = await routeTask({
  task: 'Analyze a very large repository and preserve all relevant context.',
  surface: 'orchestrator',
  hasImages: false,
  turns: 12,
  toolCount: 25,
  estimatedInputTokens: 120_000,
}, config, { forceCostStrategy: 'cheapest' });

assert.equal(largeDecision?.modelId, 'local:MiniMax-M3', 'large tasks should skip candidates whose context window cannot fit the input');
assert.equal(largeDecision?.scores['local:phi-4'], 0, 'context-incompatible candidates should be scored as unusable');
assert.match(largeDecision?.reason || '', /Skipped 1 candidate/i, 'router reason should explain context-limit filtering');

const xHighDecision = await routeTask({
  task: 'Carefully review a risky architecture change.',
  surface: 'orchestrator',
  hasImages: false,
  turns: 3,
  toolCount: 10,
  estimatedInputTokens: 12_000,
}, config, { thinkingEffort: 'xhigh' });

assert.equal(xHighDecision?.modelId, 'local:claude-opus-4.8', 'xHigh thinking should prefer premium-weight candidates when available');
assert.match(xHighDecision?.reason || '', /xHigh thinking/i, 'router reason should identify the xHigh strategy');

assert.equal(getModelConfig('MiniMax-M2.7').contextWindowTokens, 204_800, 'MiniMax M2.7 should not inherit M3 1M context');
assert.equal(getModelConfig('MiniMax-M3').contextWindowTokens, 1_000_000, 'MiniMax M3 should keep 1M context');

configureAutoRouter({
  ...config,
  providers: [
    ...config.providers,
    {
      id: 'missing-auth',
      name: 'Missing Auth Provider',
      type: 'openai-compatible',
      apiKey: '',
      baseURL: 'https://example.invalid/v1',
      models: [{ id: 'strong-model', name: 'Strong Model', enabled: true }],
    },
  ],
  autoRouter: {
    ...config.autoRouter!,
    candidates: [
      ...config.autoRouter!.candidates,
      {
        modelId: 'missing-auth:strong-model',
        cost: 0.2,
        supportsImages: false,
        card: 'Configured but unavailable because the provider has no credentials.',
      },
    ],
  },
});
const diagnosticState = getAutoRouterState();
assert.equal(diagnosticState.configuredCandidateCount, 4, 'router state should include configured-but-unavailable candidates');
assert.equal(diagnosticState.candidateCount, 3, 'router should keep unavailable candidates out of routing decisions');
assert.match(
  diagnosticState.unavailableCandidates.find((candidate) => candidate.modelId === 'missing-auth:strong-model')?.reason || '',
  /no API key or OAuth token/i,
  'router state should explain dropped candidates',
);

console.log('Auto-router context-limit tests passed.');
