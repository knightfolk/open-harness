import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { StoredConfig } from '../server/config';
import { MODEL_REQUEST_SLOW_DURATION_MS } from '../shared/modelRequestDuration';

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
  assert.deepEqual(
    initialRouterState.thresholdAdvice,
    {
      configuredThreshold: 0.7,
      activeThreshold: 0.7,
      suggestedThreshold: 0.7,
      reason: 'No historical data',
      dataPoints: 0,
      applied: false,
    },
    'router state should expose threshold advice even before enough learning data exists',
  );

  autoRouter.configureAutoRouter({
    ...config,
    autoRouter: {
      ...config.autoRouter,
      threshold: 0.30000000000000004,
    },
  });
  const noisyThresholdState = autoRouter.getAutoRouterState();
  assert.equal(noisyThresholdState.threshold, 0.3, 'router state should round configured threshold float noise');
  assert.equal(noisyThresholdState.thresholdAdvice.configuredThreshold, 0.3, 'threshold advice should round configured threshold float noise');
  assert.equal(noisyThresholdState.thresholdAdvice.activeThreshold, 0.3, 'threshold advice should round active threshold float noise');

  autoRouter.configureAutoRouter(config);

  const slowTimingEventId = routerLearning.recordRoutingDecision({
    timestamp: new Date(10).toISOString(),
    sessionId: 'debug-loop-session',
    taskHash: 'slow-timing-advisory',
    selectedModel: 'probe:weak-model',
    score: 0.72,
    candidateScores: {
      'probe:strong-model': 0.82,
      'probe:weak-model': 0.72,
    },
    wasFallback: false,
    wasCached: false,
    classifierModel: 'probe:weak-model',
    surface: 'chat',
    complexity: 'medium',
    taskType: 'execute',
    role: 'coder',
    modelRequestDurationMs: MODEL_REQUEST_SLOW_DURATION_MS + 1,
    userTurns: 1,
  });
  assert.equal(routerLearning.recordOutcome(slowTimingEventId, 'success', 'slow timing should be advisory only'), true);

  autoRouter.configureAutoRouter(config);
  const slowTimingState = autoRouter.getAutoRouterState();
  assert.equal(slowTimingState.threshold, 0.7, 'slow timing context alone must not mutate the active router threshold');
  assert.equal(slowTimingState.thresholdAdvice.activeThreshold, 0.7, 'slow timing advice must preserve the active threshold');
  assert.deepEqual(
    slowTimingState.thresholdAdvice.slowTimingContext,
    {
      advisoryOnly: true,
      slowRowCount: 2,
      thresholdMs: MODEL_REQUEST_SLOW_DURATION_MS,
      note: '2 slow model-request duration rows exceed 30.0s; use as review context only, not threshold control.',
    },
    'threshold advice should expose slow timing context without turning it into threshold control',
  );

  rmSync(join(tempHome, '.openharness', 'router-learning'), { recursive: true, force: true });
  autoRouter.configureAutoRouter(config);

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
  assert.equal(afterFeedbackState.thresholdAdvice.activeThreshold, 0.7, 'recording feedback alone must not rewrite threshold advice until router reconfigure');

  autoRouter.configureAutoRouter(config);
  const reconfiguredState = autoRouter.getAutoRouterState();
  assert.equal(reconfiguredState.threshold, 0.8, 'router reconfigure should apply high-confidence learned safety threshold');
  assert.deepEqual(
    reconfiguredState.thresholdAdvice,
    {
      configuredThreshold: 0.7,
      activeThreshold: 0.8,
      suggestedThreshold: 0.8,
      reason: 'Low success rate (0% over 10 rated outcomes); raising threshold for safety',
      dataPoints: 10,
      applied: true,
    },
    'router state should explain the learned threshold adjustment that was applied',
  );

  console.log('Router learning debug loop probe passed.');
} finally {
  rmSync(tempHome, { recursive: true, force: true });
}
