import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { StoredConfig } from '../server/config';

const tempHome = mkdtempSync(join(tmpdir(), 'openharness-router-debug-loop-'));
process.env.HOME = tempHome;

try {
  const routerLearningPath = pathToFileURL(join(process.cwd(), 'server/routerLearning.ts')).href;
  const autoRouterPath = pathToFileURL(join(process.cwd(), 'server/autoRouter.ts')).href;
  const routerLearning = await import(`${routerLearningPath}?test=${Date.now()}`);
  const autoRouter = await import(`${autoRouterPath}?test=${Date.now()}`);

  const config = {
    version: 1,
    providers: [{
      id: 'probe',
      name: 'Probe Provider',
      type: 'openai-compatible',
      apiKey: 'test-key',
      baseURL: 'http://127.0.0.1:9/v1',
      models: [
        { id: 'strong-model', name: 'Strong Model', enabled: true },
        { id: 'weak-model', name: 'Weak Model', enabled: true },
      ],
    }],
    mcpServers: [],
    personality: '',
    activeModel: 'Auto',
    activeTheme: 'midnight',
    favoriteModels: [],
    roleAssignments: {},
    roleThinking: {},
    trustMode: 'workspace-write',
    autoRouter: {
      enabled: true,
      classifierModel: 'probe:weak-model',
      threshold: 0.7,
      defaultModel: 'probe:strong-model',
      cacheTTLMs: 300000,
      candidates: [
        { modelId: 'probe:strong-model', cost: 0.2, supportsImages: false, supportsThinking: false, card: 'Strong coding model.' },
        { modelId: 'probe:weak-model', cost: 0.05, supportsImages: false, supportsThinking: false, card: 'Cheap routine worker.' },
      ],
    },
  } satisfies StoredConfig;

  autoRouter.configureAutoRouter(config);
  const initialRouterState = autoRouter.getAutoRouterState();
  assert.equal(initialRouterState.threshold, 0.7, 'probe router should start at configured threshold');

  for (let i = 0; i < 10; i += 1) {
    const id = routerLearning.recordRoutingDecision({
      timestamp: new Date(i).toISOString(),
      sessionId: 'debug-loop-session',
      taskHash: `failure-${i}`,
      selectedModel: 'probe:weak-model',
      score: 0.52,
      candidateScores: {
        'probe:strong-model': 0.91,
        'probe:weak-model': 0.52,
      },
      wasFallback: i % 2 === 0,
      wasCached: false,
      classifierModel: 'probe:weak-model',
      surface: 'chat',
      complexity: 'medium',
      taskType: 'execute',
      role: 'coder',
      userTurns: 1,
    });
    assert.equal(routerLearning.recordOutcome(id, 'failure', 'debug-loop probe'), true);
  }

  const summary = routerLearning.getLearningSummary();
  assert.equal(summary.totalEvents, 10, 'rated outcomes should feed the learning summary');
  assert.equal(summary.successRate, 0, 'failed outcomes should lower observed success');
  assert.equal(summary.models['probe:weak-model'].total, 10, 'selected model should collect rated outcomes');
  assert.equal(summary.byTaskType.execute.byModel['probe:weak-model'].total, 10, 'task-type recommendation inputs should include rated outcomes');

  const suggestion = routerLearning.suggestThresholdAdjustment(0.7);
  assert.equal(suggestion.dataPoints, 10, 'threshold suggestion should see rated outcomes');
  assert.ok(Math.abs(suggestion.suggestedThreshold - 0.8) < 0.0001, 'low success should recommend a safer threshold');

  const afterFeedbackState = autoRouter.getAutoRouterState();
  assert.equal(afterFeedbackState.threshold, initialRouterState.threshold, 'recording feedback must not mutate current router threshold');
  assert.equal(afterFeedbackState.candidateCount, initialRouterState.candidateCount, 'recording feedback must not mutate router candidates');

  console.log('Router learning debug loop probe passed.');
} finally {
  rmSync(tempHome, { recursive: true, force: true });
}
