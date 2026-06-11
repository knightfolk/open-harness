import { strict as assert } from 'node:assert';
import { routeRequest } from '../server/router';
import { buildCompareModelSet, buildPlanningRoomModelSet } from '../server/orchestrator';
import { repairProviderAliasCredentials } from '../server/config';
import type { StoredConfig } from '../server/config';

const config: StoredConfig = {
  version: 1,
  providers: [
    {
      id: 'minimax',
      name: 'MiniMax',
      type: 'openai-compatible',
      apiKey: 'test-key',
      baseURL: 'https://api.minimax.io/v1',
      models: [
        { id: 'MiniMax-M3', name: 'MiniMax M3', enabled: true },
      ],
    },
    {
      id: 'zai',
      name: 'Z.ai',
      type: 'openai-compatible',
      apiKey: 'test-key',
      baseURL: 'https://api.z.ai/v1',
      models: [
        { id: 'glm-4.6', name: 'GLM 4.6', enabled: true },
      ],
    },
  ],
  mcpServers: [],
  personality: '',
  activeModel: 'Auto',
  activeTheme: 'midnight',
  roleAssignments: {
    planner: 'Auto',
    reviewer: 'minimax:MiniMax-M3',
    reasoner: 'MiniMax-M3',
  },
  trustMode: 'workspace-write',
  autoRouter: {
    enabled: true,
    classifierModel: 'Auto',
    candidates: [
      { modelId: 'Auto', cost: 0, supportsImages: false, card: 'invalid placeholder' },
      { modelId: 'minimax:MiniMax-M3', cost: 0.2, supportsImages: true, card: 'same model as role assignment' },
      { modelId: 'zai:glm-4.6', cost: 0.3, supportsImages: false, card: 'second distinct configured model' },
    ],
  },
};

const teamPlan = routeRequest(
  'spawn a team of agents to do a complete and thorough review of this project and have them all compare notes and produce a single plan',
  'Auto',
  config.roleAssignments,
);

assert.equal(teamPlan.mode, 'plan', 'team plan requests with compare notes should use Planning Room, not compare mode');
assert.equal(teamPlan.role, 'planner', 'team plan requests should use the planner role');
assert.deepEqual(teamPlan.suggestedModels, ['MiniMax-M3'], 'router suggestions should drop Auto placeholders');

const executeHarnessRegression = routeRequest(
  [
    'Run this in Auto mode as an EXECUTE-mode OpenHarness harness and auto-routing regression test.',
    'Perform a cradle-to-grave test of OpenHarness routing, orchestration, tool safety, streaming/progress, and validation discipline.',
    'Do not stop at a plan.',
    'Run:',
    'npm run lint',
    'npm run build',
    'npm run test:hardening',
    'npx tsx scripts/test-orchestration-routing.ts',
    'Final Judge: summarize evidence and give PASS/FAIL.',
  ].join('\n'),
  'Auto',
  config.roleAssignments,
);

assert.equal(executeHarnessRegression.mode, 'execute', 'explicit EXECUTE-mode validation prompts should not route to Planning Room');
assert.equal(executeHarnessRegression.role, 'coder', 'validation-heavy execute prompts should use the coder role');
assert.equal(executeHarnessRegression.needsValidation, true, 'execute validation prompts should require validation');

const informationalRunQuestion = routeRequest('how do I run tests for this project?', 'Auto', config.roleAssignments);
assert.notEqual(informationalRunQuestion.mode, 'execute', 'informational run questions should not launch execute mode');

const compareModels = buildCompareModelSet(teamPlan, config);
assert.deepEqual(compareModels, ['MiniMax-M3', 'zai:glm-4.6'], 'compare model set should include only distinct resolvable models');

const planningModels = buildPlanningRoomModelSet(teamPlan, config);
assert.deepEqual(planningModels, ['MiniMax-M3', 'zai:glm-4.6'], 'planning room should ignore Auto and duplicate aliases');

const splitZaiConfig: StoredConfig = {
  ...config,
  providers: [
    {
      id: 'z-ai-zhipu',
      name: 'Z.AI / Zhipu',
      type: 'openai-compatible',
      apiKey: '',
      baseURL: 'https://api.z.ai/api/coding/paas/v4',
      models: [
        { id: 'glm-4.7', name: 'glm-4.7', enabled: true },
      ],
    },
    {
      id: 'zhipu',
      name: 'Z.AI / Zhipu',
      type: 'openai-compatible',
      apiKey: 'test-key',
      baseURL: 'https://api.z.ai/api/coding/paas/v4',
      models: [],
    },
    ...config.providers,
  ],
  roleAssignments: {
    planner: 'z-ai-zhipu:glm-4.7',
    reviewer: 'minimax:MiniMax-M3',
  },
};

const splitZaiModels = buildPlanningRoomModelSet(teamPlan, splitZaiConfig);
assert.ok(!splitZaiModels.includes('z-ai-zhipu:glm-4.7'), 'planning room should not choose keyless split Z.ai provider before config repair');

const repairedSplitZaiModels = buildPlanningRoomModelSet(teamPlan, {
  ...splitZaiConfig,
  providers: repairProviderAliasCredentials(splitZaiConfig.providers),
});
assert.ok(repairedSplitZaiModels.includes('z-ai-zhipu:glm-4.7'), 'config repair should copy the Z.ai key onto the provider entry that owns GLM models');

console.log('Orchestration routing tests passed.');
