import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { StoredConfig } from '../server/config';

const tempHome = mkdtempSync(join(tmpdir(), 'openharness-auto-router-action-cues-'));
process.env.HOME = tempHome;

try {
  const routerLearning = await import('../server/routerLearning.ts');
  const autoRouter = await import('../server/autoRouter.ts');

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
        { id: 'stale-model', name: 'Stale Model', enabled: true },
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
        { modelId: 'probe:stale-model', cost: 0.1, supportsImages: false, supportsThinking: false, card: 'Formerly strong model.' },
      ],
    },
  } satisfies StoredConfig;

  const recentBaseMs = Date.parse('2026-06-28T00:00:00.000Z');
  for (let i = 0; i < 5; i += 1) {
    const id = routerLearning.recordRoutingDecision({
      timestamp: new Date(recentBaseMs + i).toISOString(),
      sessionId: 'action-cue-session',
      taskHash: `execute-success-${i}`,
      selectedModel: 'probe:strong-model',
      score: 0.91,
      candidateScores: {
        'probe:strong-model': 0.91,
        'probe:weak-model': 0.62,
      },
      wasFallback: false,
      wasCached: false,
      classifierModel: 'probe:weak-model',
      surface: 'chat',
      complexity: 'medium',
      taskType: 'execute',
      role: 'coder',
      userTurns: 1,
    });
    assert.equal(routerLearning.recordOutcome(id, 'success', 'action cue probe'), true);
  }

  for (let i = 0; i < 5; i += 1) {
    const id = routerLearning.recordRoutingDecision({
      timestamp: new Date(Date.parse('2020-01-01T00:00:00.000Z') + i).toISOString(),
      sessionId: 'action-cue-session',
      taskHash: `stale-success-${i}`,
      selectedModel: 'probe:stale-model',
      score: 0.93,
      candidateScores: {
        'probe:strong-model': 0.72,
        'probe:weak-model': 0.62,
        'probe:stale-model': 0.93,
      },
      wasFallback: false,
      wasCached: false,
      classifierModel: 'probe:weak-model',
      surface: 'chat',
      complexity: 'medium',
      taskType: 'direct',
      role: 'worker',
      userTurns: 1,
    });
    assert.equal(routerLearning.recordOutcome(id, 'success', 'stale action cue probe'), true);
  }

  for (let i = 0; i < 4; i += 1) {
    const id = routerLearning.recordRoutingDecision({
      timestamp: new Date(100 + i).toISOString(),
      sessionId: 'action-cue-session',
      taskHash: `review-failure-${i}`,
      selectedModel: 'probe:weak-model',
      score: 0.65,
      candidateScores: {
        'probe:strong-model': 0.7,
        'probe:weak-model': 0.65,
      },
      wasFallback: false,
      wasCached: false,
      classifierModel: 'probe:weak-model',
      surface: 'chat',
      complexity: 'medium',
      taskType: 'review',
      role: 'reviewer',
      userTurns: 1,
    });
    assert.equal(routerLearning.recordOutcome(id, 'failure', 'negative cue probe'), true);
  }

  const candidates = autoRouter.annotateCandidatesWithRoutingLearningActionCues(
    config.autoRouter.candidates,
    routerLearning.getLearningSummary(),
    Date.parse('2026-06-29T00:00:00.000Z'),
  );
  const strong = candidates.find((candidate: { modelId: string }) => candidate.modelId === 'probe:strong-model');
  const weak = candidates.find((candidate: { modelId: string }) => candidate.modelId === 'probe:weak-model');
  const stale = candidates.find((candidate: { modelId: string }) => candidate.modelId === 'probe:stale-model');

  assert.equal(strong?.cost, 0.2, 'action cues must not mutate candidate cost');
  assert.equal(config.autoRouter.threshold, 0.7, 'action cues must not mutate configured router threshold');
  assert.match(
    strong?.card || '',
    /Routing learning action cue: advisory only; probe:strong-model handled execute at 100% across 5 reviewed outcomes; limited sample, review before relying/i,
    'actionable task-type winners should annotate matching candidate cards with shared confidence caveats',
  );
  assert.doesNotMatch(
    weak?.card || '',
    /Routing learning action cue/i,
    'weak or failed task-type winners should not annotate candidate cards',
  );
  assert.doesNotMatch(
    stale?.card || '',
    /Routing learning action cue/i,
    'stale task-type winners should remain visible in Routing Learning but not annotate candidate cards',
  );
  assert.doesNotMatch(
    strong?.card || '',
    /handled review/i,
    'candidate cards should only include their own actionable task-type cue',
  );

  const futureCandidates = autoRouter.annotateCandidatesWithRoutingLearningActionCues(
    config.autoRouter.candidates,
    routerLearning.getLearningSummary(),
    Date.parse('2026-08-01T00:00:00.000Z'),
  );
  const futureStrong = futureCandidates.find((candidate: { modelId: string }) => candidate.modelId === 'probe:strong-model');
  assert.doesNotMatch(
    futureStrong?.card || '',
    /Routing learning action cue/i,
    'candidate-card cue freshness should be deterministic under an injected future clock',
  );

  const autoRouterSource = readFileSync('server/autoRouter.ts', 'utf8');
  assert.match(
    autoRouterSource,
    /annotateCandidatesWithRoutingLearningActionCues\(\s*annotatedCandidates,\s*getLearningSummary\(\)/s,
    'current candidate evidence refresh should include routing action cues from live learning summary',
  );

  console.log('Auto-router action-cue candidate-card checks passed.');
} finally {
  rmSync(tempHome, { recursive: true, force: true });
}
