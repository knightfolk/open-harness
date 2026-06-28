import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import type { RoutingEvent } from '../src/utils/api';
import { computeRoutingTrend } from '../src/utils/routingTrend';

const baseTime = Date.parse('2026-06-26T12:00:00.000Z');

function at(minutesAgo: number): string {
  return new Date(baseTime - minutesAgo * 60_000).toISOString();
}

function event(id: string, overrides: Partial<RoutingEvent> = {}): RoutingEvent {
  return {
    id,
    timestamp: at(1),
    sessionId: 'routing-trend-session',
    taskType: 'execute',
    role: 'coder',
    complexity: 'medium',
    selectedModel: `provider:${id}`,
    score: 0.7,
    candidateScores: {},
    wasFallback: false,
    wasCached: false,
    classifierModel: null,
    outcome: null,
    datasetKind: 'production',
    ...overrides,
  };
}

assert.deepEqual(
  computeRoutingTrend([], 5),
  {
    totalDecisions: 0,
    windowSize: 5,
    recentCount: 0,
    winRate: 0,
    dominantPolicy: null,
    topSignals: [],
  },
  'empty routing trends should return zeroed defaults',
);

const decisions: RoutingEvent[] = [
  event('older-success-cheap', {
    timestamp: at(8),
    outcome: 'success',
    modelSelectionPolicy: 'cheap-direct',
    routeSignal: { hasImages: false, turns: 1, toolCount: 1, estimatedInputTokens: 400, dirtyGitState: true },
  }),
  event('newest-failure-classifier', {
    timestamp: at(1),
    outcome: 'failure',
    modelSelectionPolicy: 'classifier',
    routeSignal: { hasImages: true, turns: 4, toolCount: 2, estimatedInputTokens: 9000, artifactCount: 1, requiresStrongToolUse: true },
  }),
  event('middle-success-escalated', {
    timestamp: at(3),
    outcome: 'success',
    modelSelectionPolicy: 'escalated',
    wasCached: true,
    routeSignal: { hasImages: false, turns: 2, toolCount: 0, estimatedInputTokens: 9500, thinkingEffort: 'high' },
  }),
  event('second-success-classifier', {
    timestamp: at(2),
    outcome: 'success',
    modelSelectionPolicy: 'classifier',
    wasFallback: true,
    routeSignal: { hasImages: true, turns: 3, toolCount: 3, estimatedInputTokens: 3000, artifactCount: 2, dirtyGitState: true },
  }),
  event('bad-timestamp-cheap', {
    timestamp: 'not-a-date',
    outcome: 'success',
    modelSelectionPolicy: 'cheap-direct',
    routeSignal: { hasImages: false, turns: 1, toolCount: 9, estimatedInputTokens: 2000 },
  }),
];

assert.deepEqual(
  computeRoutingTrend(decisions, 3),
  {
    totalDecisions: 5,
    windowSize: 3,
    recentCount: 3,
    winRate: 2 / 3,
    dominantPolicy: 'classifier',
    topSignals: [
      { signal: 'artifacts', count: 2 },
      { signal: 'images', count: 2 },
      { signal: 'large context', count: 2 },
      { signal: 'tools', count: 2 },
      { signal: 'cached', count: 1 },
    ],
  },
  'routing trend should use the latest timestamped window, win-rate math, dominant policy, and top recurring signals',
);

assert.deepEqual(
  computeRoutingTrend([
    event('cheap', { timestamp: at(1), modelSelectionPolicy: 'cheap-direct', outcome: 'success' }),
    event('classifier', { timestamp: at(2), modelSelectionPolicy: 'classifier', outcome: 'failure' }),
  ], 2).dominantPolicy,
  'cheap-direct',
  'dominant policy ties should use alphabetical order for deterministic output',
);

assert.deepEqual(
  computeRoutingTrend([
    event('unknown', { timestamp: at(1), modelSelectionPolicy: undefined, routeSignal: undefined }),
    event('nullish', { timestamp: at(2), routeSignal: { hasImages: false, turns: 0, toolCount: 0, estimatedInputTokens: 0 } }),
  ], 5),
  {
    totalDecisions: 2,
    windowSize: 5,
    recentCount: 2,
    winRate: 0,
    dominantPolicy: null,
    topSignals: [],
  },
  'missing policy and signal fields should be skipped without throwing or producing NaN',
);

const paneSource = readFileSync('src/components/RoutingLearningPane.tsx', 'utf8');
assert.ok(
  paneSource.includes('computeRoutingTrend(events, 12)'),
  'Routing Learning should memoize a recent routing trend rollup',
);
assert.ok(
  paneSource.includes('routing-trend-rollup'),
  'Routing Learning should render a compact trend rollup above decision scan cards',
);
assert.ok(
  paneSource.includes('routingTrend.topSignals.slice(0, 5)'),
  'Routing Learning should cap visible trend signal chips',
);

console.log('Routing trend checks passed.');
