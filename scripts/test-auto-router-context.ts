import { strict as assert } from 'node:assert';
import { createServer } from 'node:http';
import { configureAutoRouter, clearRouterCache, getAutoRouterState, getAvailableCandidates, routeTask } from '../server/autoRouter';
import { getModelConfig } from '../server/modelProfiles';
import { routeWithAutoRouter } from '../server/router';
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
assert.ok(configuredState.candidateEvidenceRefreshedAt, 'router state should expose candidate evidence refresh time');
assert.equal(configuredState.candidateEvidenceRefreshCount, 1, 'configure should build candidate evidence once');

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
const refreshedCandidateCard = getAvailableCandidates().find((candidate) => candidate.modelId === 'local:phi-4')?.card || '';
assert.equal((refreshedCandidateCard.match(/Native thinking:/g) || []).length, 1, 'candidate evidence refresh should not duplicate normalized capability hints');
assert.equal((refreshedCandidateCard.match(/Tool quality:/g) || []).length, 1, 'candidate evidence refresh should rebuild from baseline candidates instead of stacking annotations');
const refreshedState = getAutoRouterState();
assert.ok(refreshedState.candidateEvidenceRefreshCount > configuredState.candidateEvidenceRefreshCount, 'route-time candidate evidence refreshes should be visible in router state');
assert.ok(refreshedState.candidateEvidenceRefreshedAt, 'route-time candidate evidence refresh should preserve a timestamp');

let classifierRequests = 0;
const classifierServer = createServer((req, res) => {
  classifierRequests += 1;
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    choices: [{
      message: {
        content: JSON.stringify({
          scores: {
            'local:phi-4': 0.55,
            'local:MiniMax-M3': 0.82,
            'local:claude-opus-4.8': 0.94,
          },
          reasoning: 'Medium implementation task benefits from the balanced coding model.',
        }),
      },
    }],
  }));
});
await new Promise<void>((resolve) => classifierServer.listen(0, '127.0.0.1', resolve));
const classifierAddress = classifierServer.address();
assert.ok(classifierAddress && typeof classifierAddress === 'object', 'test classifier should bind to a local port');

try {
  const policyConfig: StoredConfig = {
    ...config,
    activeModel: 'Auto',
    providers: [{
      ...config.providers[0],
      baseURL: `http://127.0.0.1:${classifierAddress.port}/v1`,
    }],
    autoRouter: {
      ...config.autoRouter!,
      classifierModel: 'local:phi-4',
      threshold: 0.7,
      defaultModel: 'local:phi-4',
      cacheTTLMs: 0,
    },
  };
  configureAutoRouter(policyConfig);
  clearRouterCache();

  const helloRoute = await routeWithAutoRouter('hello', policyConfig, { toolCount: 8 });
  assert.equal(helloRoute.mode, 'direct', 'hello should remain a direct workflow');
  assert.equal(helloRoute.complexity, 'simple', 'hello should be simple');
  assert.equal(helloRoute.suggestedModels[0], 'local:phi-4', 'hello should pick the cheapest viable model');
  assert.equal(helloRoute.routerData?.modelSelectionPolicy, 'cheap-direct', 'hello should use the cheap-direct policy');
  assert.equal(helloRoute.routerData?.classifierModel, null, 'hello should skip the classifier');
  assert.equal(classifierRequests, 0, 'hello should not pay classifier overhead');

  const directQuestionRoute = await routeWithAutoRouter('what is a token budget?', policyConfig, { toolCount: 8 });
  assert.equal(directQuestionRoute.suggestedModels[0], 'local:phi-4', 'tiny direct questions should pick the cheapest viable model');
  assert.equal(directQuestionRoute.routerData?.modelSelectionPolicy, 'cheap-direct');
  assert.equal(classifierRequests, 0, 'tiny direct questions should not call the classifier');

  const mediumCodingRoute = await routeWithAutoRouter('Create a small browser app for testing model routing.', policyConfig, { toolCount: 8 });
  assert.equal(mediumCodingRoute.mode, 'execute', 'medium coding request should still route to execute workflow');
  assert.equal(mediumCodingRoute.complexity, 'medium', 'medium coding request should stay classifier-eligible');
  assert.equal(mediumCodingRoute.suggestedModels[0], 'local:MiniMax-M3', 'classifier flow should choose the cheapest candidate above threshold');
  assert.equal(mediumCodingRoute.routerData?.modelSelectionPolicy, 'classifier', 'medium tasks should use classifier policy');
  assert.equal(mediumCodingRoute.routerData?.classifierModel, 'local:phi-4', 'medium tasks should record the classifier model');
  assert.equal(classifierRequests, 1, 'medium tasks should call the classifier exactly once');

  const shallowReviewRoute = await routeWithAutoRouter('review', policyConfig, { toolCount: 8 });
  assert.equal(shallowReviewRoute.mode, 'investigate', 'one-word review should remain a bounded investigation workflow');
  assert.equal(shallowReviewRoute.complexity, 'simple', 'one-word review should use shallow simple complexity');
  assert.equal(shallowReviewRoute.routerData?.modelSelectionPolicy, 'cheap-direct', 'one-word review should not spend deep-review budget');
  assert.equal(classifierRequests, 1, 'one-word review should skip classifier');

  const toolHeavyRoute = await routeWithAutoRouter('Run lint and build, then validate the exact result.', policyConfig, { toolCount: 8 });
  assert.equal(toolHeavyRoute.mode, 'execute', 'validation-heavy requests should use execute workflow');
  assert.equal(toolHeavyRoute.routerData?.modelSelectionPolicy, 'escalated', 'tool-heavy validation requests should escalate without classifier');
  assert.equal(toolHeavyRoute.routerData?.signal?.requiresStrongToolUse, true, 'tool-heavy validation requests should mark strong tool use');
  assert.equal(toolHeavyRoute.suggestedModels[0], 'local:claude-opus-4.8', 'tool-heavy tasks should skip weak/basic tool candidates when strong candidates exist');
  assert.match(toolHeavyRoute.reason, /strong tool-call quality/i, 'tool-heavy trace should explain weak tool candidate filtering');
  assert.equal(classifierRequests, 1, 'tool-heavy validation should not call classifier');

  const deepReviewRoute = await routeWithAutoRouter('do a deep repo review', policyConfig, { toolCount: 8 });
  assert.equal(deepReviewRoute.mode, 'investigate', 'deep repo review should use investigation workflow');
  assert.equal(deepReviewRoute.complexity, 'deep', 'deep repo review should be deep complexity');
  assert.equal(deepReviewRoute.suggestedModels[0], 'local:claude-opus-4.8', 'deep repo review should escalate to the strongest suitable candidate');
  assert.equal(deepReviewRoute.routerData?.modelSelectionPolicy, 'escalated', 'deep repo review should use escalated policy');
  assert.equal(deepReviewRoute.routerData?.classifierModel, null, 'deep repo review should skip classifier');
  assert.equal(classifierRequests, 1, 'deep repo review should not call classifier');

  const imageRoute = await routeWithAutoRouter('what is shown in this screenshot?', policyConfig, {
    hasImages: true,
    toolCount: 8,
  });
  assert.equal(imageRoute.complexity, 'simple', 'simple image question should remain simple');
  assert.equal(imageRoute.suggestedModels[0], 'local:MiniMax-M3', 'image tasks should skip image-incapable cheap candidates');
  assert.equal(imageRoute.routerData?.modelSelectionPolicy, 'cheap-direct', 'simple image tasks should still avoid classifier overhead');
  assert.equal(classifierRequests, 1, 'simple image tasks should skip classifier while respecting image capability');
} finally {
  await new Promise<void>((resolve, reject) => classifierServer.close((err) => err ? reject(err) : resolve()));
}

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
