import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import type { RoutingEvent } from '../src/utils/api';
import {
  MAX_RECENT_EVENT_DISPLAY_LIMIT,
  RECENT_EVENT_BATCH_SIZE,
  buildRoutingEventDisplayWindow,
  buildRoutingDecisionScanCards,
  buildRoutingEventDecisionExplanation,
  buildRoutingEventEvidenceView,
  buildRoutingEventReplayReadiness,
  buildRoutingEventScoreEvidenceKey,
  buildRoutingEventTraceChips,
  buildRoutingEventViewModel,
  buildRoutingLearningRecentDecisionState,
  formatRoutingEventTraceSummary,
  routingEventNeedsOutcome,
  routeEventIsStaleAt,
  routeEventTimeLabelAt,
} from '../src/utils/routingLearningRecentDecisions';
import type { RoutingPolicyFilter } from '../src/utils/routingLearningPolicyFilter';

const nowMs = Date.parse('2026-06-26T12:00:00.000Z');
const minute = 60_000;
const day = 24 * 60 * minute;

function ago(ms: number): string {
  return new Date(nowMs - ms).toISOString();
}

function event(id: string, overrides: Partial<RoutingEvent> = {}): RoutingEvent {
  return {
    id,
    timestamp: ago(minute),
    sessionId: 'recent-decision-state-session',
    taskHash: `task-hash-${id}`,
    taskPromptSnapshot: {
      text: `Review prompt ${id}`,
      hash: `prompt-${id.slice(0, 8)}`,
      charCount: `Review prompt ${id}`.length,
      redactedHits: 0,
      truncated: false,
      limit: 4000,
    },
    taskType: 'execute',
    role: 'coder',
    complexity: 'medium',
    selectedModel: `provider:${id}`,
    score: 0.5,
    candidateScores: {},
    wasFallback: false,
    wasCached: false,
    classifierModel: null,
    routeSignal: {
      hasImages: false,
      turns: 2,
      toolCount: 4,
      estimatedInputTokens: 1800,
      artifactCount: 1,
      dirtyGitState: true,
      thinkingEffort: 'medium',
    },
    outcome: null,
    datasetKind: 'production',
    ...overrides,
  };
}

const events: RoutingEvent[] = [
  event('latest-cheap', {
    timestamp: ago(30_000),
    runId: 'run-latest-cheap-abcdef123456',
    selectedModel: 'model-alpha',
    score: 0.92,
    candidateScores: {
      'model-alpha': 0.92,
      'model-beta': 0.87,
      'model-gamma': 0.51,
      'model-delta': 0.2,
    },
    modelSelectionPolicy: 'cheap-direct',
  }),
  event('stale-escalated-fallback', {
    timestamp: ago(8 * day),
    selectedModel: 'model-fallback',
    score: 0.1,
    candidateScores: {
      'model-top': 0.9,
      'model-fallback': 0.1,
    },
    wasFallback: true,
    modelSelectionPolicy: 'escalated',
    outcome: 'failure',
  }),
  event('benchmark-classifier-note', {
    timestamp: ago(2 * 60 * minute),
    runId: 'run-benchmark-classifier-abcdef123456',
    selectedModel: 'model-classifier',
    score: 0.77,
    candidateScores: {
      'model-classifier': 0.77,
      'model-runner-up': 0.7,
    },
    modelSelectionPolicy: 'classifier',
    threshold: 0.7,
    outcome: 'success',
    outcomeNote: 'Imported benchmark note',
    datasetKind: 'benchmark',
  }),
  event('legacy-fallback', {
    timestamp: ago(5 * minute),
    selectedModel: 'model-legacy',
    score: 0.33,
    wasFallback: true,
  }),
];

const outcomeNotes = {
  'latest-cheap': 'Reviewer note from current UI state',
  'stale-escalated-fallback': '   ',
  'legacy-fallback': '',
};

function stateWith(policyFilter: RoutingPolicyFilter, filters = {}) {
  return buildRoutingLearningRecentDecisionState({
    events,
    outcomeNotes,
    nowMs,
    filters: {
      showUnexplainedOnly: false,
      showUnratedOnly: false,
      showStaleOnly: false,
      showFallbackOnly: false,
      showBenchmarkOnly: false,
      showEvidenceGapsOnly: false,
      policyFilter,
      ...filters,
    },
  });
}

const state = stateWith('all');

assert.equal(state.latestEvent?.id, 'latest-cheap');
assert.deepEqual(state.latestScores, [
  ['model-alpha', 0.92],
  ['model-beta', 0.87],
  ['model-gamma', 0.51],
]);
assert.deepEqual(state.fallbackEvents.map((item) => item.id), ['stale-escalated-fallback', 'legacy-fallback']);
assert.deepEqual(state.ratedFallbackEvents.map((item) => item.id), ['stale-escalated-fallback']);
assert.equal(state.notedEventCount, 2);
assert.equal(state.latestEventAge, 'just now');
assert.equal(state.latestEventIsStale, false);
assert.equal(state.unexplainedEventCount, 2);
assert.equal(state.unratedEventCount, 2);
assert.equal(state.staleEventCount, 1);
assert.equal(state.benchmarkEventCount, 1);
assert.equal(state.productionEventCount, 3);
assert.deepEqual(state.replayReadinessCounts, { ready: 2, partial: 1, missing: 1 });
assert.equal(state.replayGapEventCount, 2);
assert.deepEqual(state.policyFilterCounts, { 'cheap-direct': 1, classifier: 1, escalated: 1 });
assert.deepEqual(state.visibleRecentEvents.map((item) => item.id), events.map((item) => item.id));
assert.deepEqual(
  buildRoutingDecisionScanCards(state).map((card) => `${card.id}:${card.value}:${card.tone}:${card.filterTarget || 'none'}`),
  [
    'latest:model-alpha:ok:none',
    'unrated:2:warning:needs-outcome',
    'fallbacks:2:warning:fallbacks',
    'evidence-gaps:2:warning:evidence-gaps',
    'stale:1:warning:stale',
    'dataset:3/1:muted:none',
  ],
  'Decision scan cards should summarize latest route, review gaps, fallbacks, stale rows, and dataset mix while exposing only true queue filter targets',
);
assert.deepEqual(
  buildRoutingDecisionScanCards(state)[0],
  {
    id: 'latest',
    label: 'Latest route',
    value: 'model-alpha',
    detail: 'just now · Cheap direct selection · Needs review',
    tone: 'ok',
    filterTarget: null,
  },
  'Latest decision scan card should combine recency, decision policy, and outcome',
);
assert.deepEqual(
  buildRoutingDecisionScanCards(state)[1],
  {
    id: 'unrated',
    label: 'Needs outcome',
    value: '2',
    detail: '2 of 4 loaded decisions still need Worked, Failed, or Unclear.',
    tone: 'warning',
    filterTarget: 'needs-outcome',
  },
  'Unrated decision scan card should focus on outcome feedback gaps, not only note gaps',
);
assert.deepEqual(
  buildRoutingDecisionScanCards(state)[3],
  {
    id: 'evidence-gaps',
    label: 'Evidence gaps',
    value: '2',
    detail: '2 of 4 loaded decisions are missing score or prompt replay evidence.',
    tone: 'warning',
    filterTarget: 'evidence-gaps',
  },
  'Evidence-gap scan card should summarize partial and blocked route score evidence without implying full prompt replay',
);

const replayReady = buildRoutingEventReplayReadiness(events[0]);
assert.equal(replayReady.status, 'ready');
assert.equal(replayReady.replayable, true);
assert.deepEqual(replayReady.missing, []);
assert.match(
  replayReady.detail,
  /redacted prompt snapshot/i,
  'Route replay readiness should identify decisions with scores, policy, signals, linked run evidence, and prompt evidence',
);

const scoreEvidenceKey = buildRoutingEventScoreEvidenceKey(events[0]);
assert.match(
  scoreEvidenceKey.id,
  /^[a-z0-9]{8}$/,
  'Score evidence key should be a compact stable routing-metadata fingerprint',
);
assert.equal(
  scoreEvidenceKey.detail,
  'Derived from task hash, routing metadata, and redacted prompt snapshot metadata; it does not contain prompt text.',
  'Score evidence key copy should avoid embedding prompt text while acknowledging replay metadata',
);
assert.equal(
  buildRoutingEventScoreEvidenceKey(events[0]).id,
  scoreEvidenceKey.id,
  'Score evidence key should be stable for identical task hash and routing metadata',
);
assert.notEqual(
  buildRoutingEventScoreEvidenceKey(event('strategy-variant-a', {
    taskHash: 'same-task-hash',
    selectedModel: 'model-alpha',
    candidateScores: { 'model-alpha': 0.72, 'model-beta': 0.7 },
    modelSelectionPolicy: 'classifier',
    threshold: 0.7,
    promptStrategyId: 'strategy-a',
    promptStrategyVariantId: 'variant-a',
    runId: 'run-strategy-variant-a',
  })).id,
  buildRoutingEventScoreEvidenceKey(event('strategy-variant-b', {
    taskHash: 'same-task-hash',
    selectedModel: 'model-alpha',
    candidateScores: { 'model-alpha': 0.72, 'model-beta': 0.7 },
    modelSelectionPolicy: 'classifier',
    threshold: 0.7,
    promptStrategyId: 'strategy-a',
    promptStrategyVariantId: 'variant-b',
    runId: 'run-strategy-variant-b',
  })).id,
  'Score evidence key should change when prompt strategy variant changes even with the same task hash',
);

const missingTaskHashReadiness = buildRoutingEventReplayReadiness(event('missing-task-hash', {
  taskHash: '',
  selectedModel: 'model-alpha',
  candidateScores: { 'model-alpha': 0.72, 'model-beta': 0.7 },
  modelSelectionPolicy: 'cheap-direct',
  runId: 'run-missing-task-hash',
}));
assert.equal(missingTaskHashReadiness.status, 'partial');
assert.ok(
  missingTaskHashReadiness.missing.includes('task hash'),
  'Score evidence readiness should call out legacy/imported routing events without task hashes',
);

const replayPartial = buildRoutingEventReplayReadiness(event('partial-replay', {
  selectedModel: 'model-alpha',
  candidateScores: { 'model-alpha': 0.72, 'model-beta': 0.7 },
  modelSelectionPolicy: 'classifier',
  threshold: undefined,
  routeSignal: undefined,
  runId: undefined,
  taskPromptSnapshot: undefined,
}));
assert.equal(replayPartial.status, 'partial');
assert.equal(replayPartial.replayable, false);
assert.deepEqual(
  replayPartial.missing,
  ['classifier threshold', 'route input signals', 'linked run id', 'redacted prompt snapshot'],
  'Partial replay readiness should name the missing evidence instead of implying full replay is possible',
);
assert.match(replayPartial.detail, /Missing classifier threshold, route input signals, linked run id, redacted prompt snapshot\./);

const replayMissing = buildRoutingEventReplayReadiness(event('missing-replay', {
  candidateScores: {},
  modelSelectionPolicy: undefined,
}));
assert.equal(replayMissing.status, 'missing');
assert.equal(replayMissing.replayable, false);
assert.ok(
  replayMissing.missing.includes('candidate scores'),
  'Missing replay readiness should treat absent candidate scores as a hard replay gap',
);

assert.deepEqual(
  stateWith('escalated', { showFallbackOnly: true }).visibleRecentEvents.map((item) => item.id),
  ['stale-escalated-fallback'],
  'Fallback and policy filters should combine as an AND filter',
);
assert.deepEqual(
  buildRoutingDecisionScanCards(stateWith('all', { showFallbackOnly: true }))[1],
  {
    id: 'unrated',
    label: 'Needs outcome',
    value: '2',
    detail: '2 of 4 loaded decisions still need Worked, Failed, or Unclear.',
    tone: 'warning',
    filterTarget: 'needs-outcome',
  },
  'Actionable scan-card counts should describe the needs-outcome destination, not the current fallback-filtered subset',
);
assert.deepEqual(
  buildRoutingDecisionScanCards(stateWith('cheap-direct', { showFallbackOnly: true }))[1],
  {
    id: 'unrated',
    label: 'Needs outcome',
    value: '1',
    detail: '1 of 1 loaded decision still needs Worked, Failed, or Unclear.',
    tone: 'warning',
    filterTarget: 'needs-outcome',
  },
  'Actionable scan-card counts should preserve the active policy filter while ignoring sibling broad filters',
);
assert.deepEqual(
  buildRoutingDecisionScanCards(stateWith('cheap-direct', { showUnratedOnly: true })).map((card) => `${card.id}:${card.value}:${card.tone}:${card.filterTarget || 'none'}`),
  [
    'latest:model-alpha:ok:none',
    'unrated:1:warning:needs-outcome',
    'fallbacks:0:muted:fallbacks',
    'evidence-gaps:0:ok:evidence-gaps',
    'stale:0:ok:stale',
    'dataset:3/1:muted:none',
  ],
  'All actionable scan-card destination counts should preserve policy filters while ignoring sibling broad filters',
);
assert.deepEqual(
  stateWith('all', { showEvidenceGapsOnly: true }).visibleRecentEvents.map((item) => item.id),
  ['stale-escalated-fallback', 'legacy-fallback'],
  'Evidence-gap filter should show partial and blocked decisions while hiding score-evidence-ready decisions',
);
assert.deepEqual(
  stateWith('classifier', { showEvidenceGapsOnly: true }).visibleRecentEvents.map((item) => item.id),
  [],
  'Evidence-gap filter should combine with policy filters as an AND filter',
);
assert.deepEqual(
  stateWith('all', { showUnexplainedOnly: true }).visibleRecentEvents.map((item) => item.id),
  ['stale-escalated-fallback', 'legacy-fallback'],
  'Unexplained filter should use live outcomeNotes before stored event notes',
);
assert.deepEqual(
  stateWith('all', { showUnratedOnly: true }).visibleRecentEvents.map((item) => item.id),
  ['latest-cheap', 'legacy-fallback'],
  'Needs-outcome filter should use unrated outcome state without depending on reviewer-note gaps',
);
assert.deepEqual(
  stateWith('cheap-direct', { showUnratedOnly: true }).visibleRecentEvents.map((item) => item.id),
  ['latest-cheap'],
  'Needs-outcome filter should combine with policy filters as an AND filter',
);
assert.deepEqual(
  buildRoutingDecisionScanCards(stateWith('all', { showUnratedOnly: true }))[1],
  {
    id: 'unrated',
    label: 'Needs outcome',
    value: '2',
    detail: '2 of 4 loaded decisions still need Worked, Failed, or Unclear.',
    tone: 'warning',
    filterTarget: 'needs-outcome',
  },
  'Needs-outcome scan card count should describe its policy-scoped destination even while the needs-outcome filter is active',
);
assert.deepEqual(
  stateWith('all', { showStaleOnly: true }).visibleRecentEvents.map((item) => item.id),
  ['stale-escalated-fallback'],
);
assert.deepEqual(
  stateWith('all', { showBenchmarkOnly: true }).visibleRecentEvents.map((item) => item.id),
  ['benchmark-classifier-note'],
);

const emptyState = buildRoutingLearningRecentDecisionState({
  events: [],
  outcomeNotes: {},
  nowMs,
  filters: {
    showUnexplainedOnly: false,
    showUnratedOnly: false,
    showStaleOnly: false,
    showFallbackOnly: false,
    showBenchmarkOnly: false,
    showEvidenceGapsOnly: false,
    policyFilter: 'all',
  },
});

assert.equal(emptyState.latestEvent, null);
assert.equal(emptyState.latestEventAge, 'No route yet');
assert.equal(emptyState.latestEventIsStale, true);
assert.deepEqual(emptyState.visibleRecentEvents, []);
assert.deepEqual(
  buildRoutingDecisionScanCards(emptyState),
  [
    {
      id: 'latest',
      label: 'Latest route',
      value: 'None',
      detail: 'No routing decisions recorded yet.',
      tone: 'muted',
      filterTarget: null,
    },
  ],
  'Decision scan cards should have a quiet empty state',
);

assert.equal(routingEventNeedsOutcome(event('needs-outcome-null', { outcome: null })), true);
assert.equal(routingEventNeedsOutcome(event('needs-outcome-success', { outcome: 'success' })), false);
assert.equal(routingEventNeedsOutcome(event('needs-outcome-failure', { outcome: 'failure' })), false);
assert.equal(routingEventNeedsOutcome(event('needs-outcome-ambiguous', { outcome: 'ambiguous' })), false);

assert.equal(routeEventTimeLabelAt(ago(5 * minute), nowMs), '5m ago');
assert.equal(routeEventTimeLabelAt(ago(2 * 60 * minute), nowMs), '2h ago');
assert.equal(routeEventTimeLabelAt(ago(3 * day), nowMs), '3d ago');
assert.equal(routeEventTimeLabelAt('not-a-date', nowMs), 'time unknown');
assert.equal(routeEventIsStaleAt(ago(8 * day), nowMs), true);
assert.equal(routeEventIsStaleAt(ago(day), nowMs), false);
assert.equal(routeEventIsStaleAt('not-a-date', nowMs), true);

const cheapDirectTraceChips = buildRoutingEventTraceChips(events[0], nowMs);
assert.deepEqual(
  cheapDirectTraceChips.map((chip) => chip.label),
  ['Cheap direct selection', 'classifier: skipped', 'run: run-late', 'production data', 'just now'],
  'Cheap-direct deterministic route chips should expose skipped classifier provenance, run join key, and dataset context',
);
assert.equal(
  cheapDirectTraceChips.find((chip) => chip.label === 'production data')?.title,
  'Production routing event.',
  'Production routing trace chip should keep its explanatory tooltip',
);
assert.equal(
  cheapDirectTraceChips.at(-1)?.title,
  events[0].timestamp,
  'Trace time chip should expose the exact event timestamp',
);
assert.equal(
  formatRoutingEventTraceSummary(events[0], nowMs),
  'Cheap direct selection; classifier: skipped; run: run-late; production data; just now',
  'Trace summary should reuse the visible chip labels for exports and accessible summaries',
);

assert.deepEqual(
  buildRoutingEventDecisionExplanation(events[0]),
  {
    reason: 'Cheap direct won',
    detail: 'Cheap direct selection chose model-alpha with a 0.05 score gap over model-beta.',
    contributors: [
      { label: 'score gap 0.05', title: 'model-alpha 0.920 vs model-beta 0.870' },
      { label: 'policy: cheap direct', title: 'Cheap direct selection' },
    ],
  },
  'Decision explanation should make cheap-direct score wins scannable without rereading raw scores',
);

assert.deepEqual(
  buildRoutingEventDecisionExplanation(event('close-classifier', {
    selectedModel: 'model-near',
    score: 0.81,
    threshold: 0.7,
    candidateScores: {
      'model-near': 0.81,
      'model-peer': 0.80,
    },
    modelSelectionPolicy: 'classifier',
  })),
  {
    reason: 'Close classifier race',
    detail: 'Classifier decision chose model-near with a 0.01 score gap over model-peer. It cleared the 0.70 viability gate by 0.11.',
    contributors: [
      { label: 'score gap 0.01', title: 'model-near 0.810 vs model-peer 0.800' },
      { label: 'cleared threshold 0.11', title: 'selected score 0.810 vs threshold 0.700' },
      { label: 'policy: classifier', title: 'Classifier decision' },
    ],
  },
  'Decision explanation should call out close classifier races',
);

const thresholdClearedExplanation = buildRoutingEventDecisionExplanation(event('threshold-cleared', {
  selectedModel: 'model-near',
  score: 0.81,
  threshold: 0.7,
  candidateScores: {
    'model-near': 0.81,
    'model-peer': 0.78,
  },
  modelSelectionPolicy: 'classifier',
}));
assert.equal(
  thresholdClearedExplanation.detail,
  'Classifier decision chose model-near with a 0.03 score gap over model-peer. It cleared the 0.70 viability gate by 0.11.',
  'Classifier decision explanations should connect score margins to threshold clearance',
);
assert.deepEqual(
  thresholdClearedExplanation.contributors,
  [
    { label: 'score gap 0.03', title: 'model-near 0.810 vs model-peer 0.780' },
    { label: 'cleared threshold 0.11', title: 'selected score 0.810 vs threshold 0.700' },
    { label: 'policy: classifier', title: 'Classifier decision' },
  ],
  'Classifier threshold clearance should be scannable as a decision contributor',
);
const thresholdIgnoredExplanation = buildRoutingEventDecisionExplanation(event('threshold-ignored', {
  selectedModel: 'model-near',
  score: 0.81,
  threshold: 0.7,
  candidateScores: {
    'model-near': 0.81,
    'model-peer': 0.78,
  },
  modelSelectionPolicy: 'cheap-direct',
}));
assert.ok(
  !thresholdIgnoredExplanation.detail.includes('viability gate')
    && !thresholdIgnoredExplanation.contributors.some((chip) => chip.label.includes('threshold')),
  'Non-classifier decision explanations should ignore threshold metadata',
);
const thresholdBelowExplanation = buildRoutingEventDecisionExplanation(event('threshold-below', {
  selectedModel: 'model-near',
  score: 0.62,
  threshold: 0.7,
  candidateScores: {
    'model-near': 0.62,
    'model-peer': 0.6,
  },
  modelSelectionPolicy: 'classifier',
}));
assert.equal(
  thresholdBelowExplanation.detail,
  'Classifier decision chose model-near with a 0.02 score gap over model-peer. It fell below the 0.70 viability gate by 0.08; classifier picked the highest score.',
  'Below-threshold classifier decisions should explain best-score fallback semantics',
);
assert.ok(
  thresholdBelowExplanation.contributors.some((chip) =>
    chip.label === 'below threshold 0.08'
      && chip.title === 'selected score 0.620 vs threshold 0.700'
  ),
  'Below-threshold classifier decisions should expose a scannable threshold contributor',
);

const malformedScoreExplanation = buildRoutingEventDecisionExplanation(event('malformed-score', {
  selectedModel: 'model-broken',
  score: Number.NaN,
  threshold: 0.7,
  candidateScores: {
    'model-broken': Number.NaN,
    'model-peer': 0.6,
  },
  modelSelectionPolicy: 'classifier',
}));
const malformedScoreText = JSON.stringify(malformedScoreExplanation);
assert.doesNotMatch(
  malformedScoreText,
  /NaN|Infinity/,
  'Routing decision explanations should not leak non-finite selected scores',
);
assert.match(
  malformedScoreText,
  /unavailable/,
  'Routing decision explanations should use the shared unavailable score fallback',
);
assert.ok(
  malformedScoreExplanation.contributors.some((chip) =>
    chip.label === 'score gap unavailable'
      && chip.title === 'model-broken unavailable vs model-peer 0.600'
  ),
  'Routing decision explanations should expose non-finite selected scores through unavailable contributor labels',
);
assert.ok(
  malformedScoreExplanation.contributors.some((chip) =>
    chip.label === 'threshold comparison unavailable'
      && chip.title === 'selected score unavailable vs threshold 0.700'
  ),
  'Threshold contributors should explain non-finite selected-score comparisons without leaking raw score math',
);

const malformedAlternativeExplanation = buildRoutingEventDecisionExplanation(
  event('malformed-alternative', {
    selectedModel: 'model-selected',
    score: 0.6,
    candidateScores: {
      'model-selected': 0.6,
      'model-peer': Number.POSITIVE_INFINITY,
    },
    modelSelectionPolicy: 'classifier',
  }),
  [
    ['model-selected', 0.6],
    ['model-peer', Number.POSITIVE_INFINITY],
  ],
);
assert.doesNotMatch(
  JSON.stringify(malformedAlternativeExplanation),
  /NaN|Infinity/,
  'Routing decision explanations should not leak non-finite alternative scores',
);
assert.match(
  JSON.stringify(malformedAlternativeExplanation),
  /unavailable/,
  'Routing decision explanations should use the unavailable fallback for malformed alternatives',
);
assert.notEqual(
  malformedAlternativeExplanation.reason,
  'Close classifier race',
  'Non-finite score gaps should not be described as close classifier races',
);
assert.ok(
  malformedAlternativeExplanation.contributors.some((chip) =>
    chip.label === 'score gap unavailable'
      && chip.title === 'model-selected 0.600 vs model-peer unavailable'
  ),
  'Routing decision explanations should expose non-finite alternative scores through unavailable contributor labels',
);

const malformedFallbackExplanation = buildRoutingEventDecisionExplanation(
  event('malformed-fallback', {
    selectedModel: 'model-fallback',
    score: 0.1,
    candidateScores: {
      'model-fallback': 0.1,
      'model-peer': Number.NEGATIVE_INFINITY,
    },
    wasFallback: true,
    modelSelectionPolicy: 'escalated',
  }),
  [
    ['model-fallback', 0.1],
    ['model-peer', Number.NEGATIVE_INFINITY],
  ],
);
assert.doesNotMatch(
  JSON.stringify(malformedFallbackExplanation),
  /NaN|Infinity/,
  'Fallback decision explanations should not leak non-finite alternative scores',
);
assert.match(
  JSON.stringify(malformedFallbackExplanation),
  /unavailable/,
  'Fallback decision explanations should use the unavailable fallback for malformed alternatives',
);

const malformedMarginSummary = buildRoutingEventViewModel(event('malformed-margin', {
  selectedModel: 'model-selected',
  score: Number.NEGATIVE_INFINITY,
  candidateScores: {
    'model-selected': Number.NEGATIVE_INFINITY,
    'model-peer': 0.4,
  },
  modelSelectionPolicy: 'classifier',
})).marginSummary;
assert.doesNotMatch(
  malformedMarginSummary,
  /NaN|Infinity/,
  'Routing margin summaries should not leak non-finite score math',
);
assert.match(
  malformedMarginSummary,
  /unavailable/,
  'Routing margin summaries should use the unavailable fallback for malformed score math',
);

const classifierThresholdTraceChips = buildRoutingEventTraceChips(event('threshold-classifier', {
  selectedModel: 'model-threshold',
  score: 0.81,
  threshold: 0.7,
  candidateScores: {
    'model-threshold': 0.81,
    'model-peer': 0.78,
  },
  modelSelectionPolicy: 'classifier',
  classifierModel: 'provider:classifier',
}), nowMs);
assert.deepEqual(
  classifierThresholdTraceChips.map((chip) => chip.label),
  ['Classifier decision', 'classifier: provider:classifier', 'threshold 0.70', 'production data', '1m ago'],
  'Classifier route chips should expose the recorded viability threshold',
);
assert.equal(
  classifierThresholdTraceChips.find((chip) => chip.label === 'threshold 0.70')?.title,
  'Classifier viability gate',
  'Threshold trace chip should explain that the number is a gate, not a quality score',
);
assert.equal(
  formatRoutingEventTraceSummary(event('threshold-classifier', {
    score: 0.81,
    threshold: 0.7,
    modelSelectionPolicy: 'classifier',
    classifierModel: 'provider:classifier',
  }), nowMs),
  'Classifier decision; classifier: provider:classifier; threshold 0.70; production data; 1m ago',
  'Trace summaries and exports should include classifier threshold chips through the shared formatter',
);
assert.equal(
  buildRoutingEventTraceChips(event('legacy-threshold', {
    threshold: 0.7,
    modelSelectionPolicy: 'cheap-direct',
    classifierModel: null,
  }), nowMs).some((chip) => chip.label.startsWith('threshold ')),
  false,
  'Deterministic or legacy events should not show threshold chips unless the classifier path used the gate',
);
const malformedThresholdTraceText = buildRoutingEventTraceChips(event('malformed-threshold', {
  selectedModel: 'model-threshold',
  score: Number.NaN,
  threshold: Number.POSITIVE_INFINITY,
  candidateScores: {
    'model-threshold': Number.NaN,
    'model-peer': 0.5,
  },
  modelSelectionPolicy: 'classifier',
}), nowMs).flatMap((chip) => [chip.label, chip.title ?? '']).join('|');
assert.doesNotMatch(
  malformedThresholdTraceText,
  /NaN|Infinity/,
  'Trace chips should not leak non-finite score or threshold values',
);
assert.doesNotMatch(
  malformedThresholdTraceText,
  /threshold /,
  'Trace chips should omit classifier threshold chips when the threshold is non-finite',
);

const displayWindowEvents = Array.from({ length: 40 }, (_, index) => event(`display-${index}`));
const defaultDisplayWindow = buildRoutingEventDisplayWindow(displayWindowEvents);
assert.equal(defaultDisplayWindow.limit, RECENT_EVENT_BATCH_SIZE, 'Recent-decision display windows should default to the shared batch size');
assert.equal(defaultDisplayWindow.events.length, 12, 'Recent-decision display windows should render the first batch by default');
assert.equal(defaultDisplayWindow.hiddenCount, 28, 'Recent-decision display windows should expose hidden matching decisions');
assert.equal(defaultDisplayWindow.nextCount, 12, 'Recent-decision display windows should offer the next full batch when enough rows remain');
assert.equal(defaultDisplayWindow.canShowMore, true, 'Recent-decision display windows should allow explicit expansion while rows remain hidden');
assert.equal(defaultDisplayWindow.canShowFewer, false, 'Default recent-decision windows should not show a collapse action');

const shortRemainderWindow = buildRoutingEventDisplayWindow(displayWindowEvents.slice(0, 15));
assert.equal(shortRemainderWindow.nextCount, 3, 'Show-more labels should use the real remaining count when fewer than a full batch remains');

const expandedDisplayWindow = buildRoutingEventDisplayWindow(displayWindowEvents.slice(0, 15), 24);
assert.equal(expandedDisplayWindow.events.length, 15, 'Expanded recent-decision windows should never exceed the matching event count');
assert.equal(expandedDisplayWindow.hiddenCount, 0, 'Expanded recent-decision windows should report no hidden rows after all matches are visible');
assert.equal(expandedDisplayWindow.canShowMore, false, 'Expanded recent-decision windows should hide show-more after all matches are visible');
assert.equal(expandedDisplayWindow.canShowFewer, true, 'Expanded recent-decision windows should keep a show-fewer affordance even when no rows are hidden');

const clampedDisplayWindow = buildRoutingEventDisplayWindow(displayWindowEvents, 1);
assert.equal(clampedDisplayWindow.limit, RECENT_EVENT_BATCH_SIZE, 'Recent-decision display windows should clamp invalid low limits to the batch size');

const maxDisplayWindowEvents = Array.from({ length: MAX_RECENT_EVENT_DISPLAY_LIMIT + 8 }, (_, index) => event(`display-max-${index}`));
const cappedDisplayWindow = buildRoutingEventDisplayWindow(maxDisplayWindowEvents, MAX_RECENT_EVENT_DISPLAY_LIMIT + RECENT_EVENT_BATCH_SIZE);
assert.equal(cappedDisplayWindow.limit, MAX_RECENT_EVENT_DISPLAY_LIMIT, 'Recent-decision display windows should clamp high limits to the maximum review window');
assert.equal(cappedDisplayWindow.events.length, MAX_RECENT_EVENT_DISPLAY_LIMIT, 'Recent-decision display windows should never render more than the maximum review window');
assert.equal(cappedDisplayWindow.hiddenCount, 8, 'Recent-decision display windows should still report rows hidden past the maximum review window');
assert.equal(cappedDisplayWindow.nextCount, 0, 'Recent-decision display windows should not offer another batch after reaching the maximum review window');
assert.equal(cappedDisplayWindow.canShowMore, false, 'Recent-decision display windows should stop show-more at the maximum review window');
assert.equal(cappedDisplayWindow.canShowFewer, true, 'Recent-decision display windows should still allow collapse after reaching the maximum review window');
assert.equal(cappedDisplayWindow.reachedLimit, true, 'Recent-decision display windows should expose when rows remain hidden because of the maximum review window');

const sharedViewModel = buildRoutingEventViewModel(event('view-model', {
  selectedModel: 'model-selected',
  score: 0.72,
  candidateScores: {
    'model-selected': 0.72,
    'model-peer': 0.64,
    'model-distant': 0.2,
  },
  modelSelectionPolicy: 'classifier',
  classifierModel: 'provider:classifier',
  modelRequestDurationMs: 1440,
}), nowMs);
assert.deepEqual(
  sharedViewModel.topScores,
  [
    ['model-selected', 0.72],
    ['model-peer', 0.64],
    ['model-distant', 0.2],
  ],
  'Shared routing-event view model should expose candidate scores in display order',
);
assert.equal(
  sharedViewModel.traceSummary,
  'Classifier decision; classifier: provider:classifier; model request 1.4s; production data; 1m ago',
  'Shared routing-event view model should derive export trace text including measured request duration from the same chips used by the row',
);
assert.deepEqual(
  sharedViewModel.requestDuration,
  { durationMs: 1440, label: 'model request 1.4s', slow: false, thresholdMs: 30000 },
  'Shared routing-event view model should expose measured model request duration when present',
);
assert.equal(
  sharedViewModel.marginSummary,
  'Selected by 0.08 over model-peer.',
  'Shared routing-event view model should centralize route margin text',
);
assert.equal(
  sharedViewModel.decisionExplanation.reason,
  'Classifier won',
  'Shared routing-event view model should include the same decision explanation used by recent-decision rows',
);

const sharedEvidenceView = buildRoutingEventEvidenceView(events[0], nowMs, outcomeNotes['latest-cheap']);
const sharedEvidenceBaseView = buildRoutingEventViewModel(events[0], nowMs);
assert.equal(
  sharedEvidenceView.event,
  events[0],
  'Shared routing-event evidence view should keep the original event reference for row consumers',
);
assert.equal(
  sharedEvidenceView.outcomeNote,
  outcomeNotes['latest-cheap'],
  'Shared routing-event evidence view should carry the resolved outcome note for exports',
);
assert.deepEqual(
  {
    topScores: sharedEvidenceView.topScores,
    traceChips: sharedEvidenceView.traceChips,
    traceSummary: sharedEvidenceView.traceSummary,
    decisionExplanation: sharedEvidenceView.decisionExplanation,
    marginSummary: sharedEvidenceView.marginSummary,
    requestDuration: sharedEvidenceView.requestDuration,
  },
  sharedEvidenceBaseView,
  'Shared routing-event evidence view should preserve the existing row view model output',
);
assert.deepEqual(
  sharedEvidenceView.scoreEvidenceKey,
  buildRoutingEventScoreEvidenceKey(events[0]),
  'Shared routing-event evidence view should compute the same score evidence key once for every consumer',
);
assert.deepEqual(
  sharedEvidenceView.scoreEvidenceReadiness,
  buildRoutingEventReplayReadiness(events[0]),
  'Shared routing-event evidence view should compute the same score evidence readiness once for every consumer',
);

const missingDurationViewModel = buildRoutingEventViewModel(event('missing-duration'), nowMs);
assert.equal(
  missingDurationViewModel.requestDuration,
  null,
  'Shared routing-event view model should keep missing measured request duration absent instead of rendering 0s',
);
assert.ok(
  !missingDurationViewModel.traceSummary.includes('model request 0'),
  'Trace summaries should not imply missing request duration was a fast zero-duration request',
);

const thresholdDurationViewModel = buildRoutingEventViewModel(event('threshold-duration', {
  classifierModel: 'provider:classifier',
  modelRequestDurationMs: 30000,
}), nowMs);
assert.deepEqual(
  thresholdDurationViewModel.requestDuration,
  { durationMs: 30000, label: 'model request 30.0s', slow: false, thresholdMs: 30000 },
  'Per-event model request duration should use the shared strict threshold and not flag at-threshold requests as slow',
);
assert.equal(
  thresholdDurationViewModel.traceSummary,
  'Classifier decision; classifier: provider:classifier; model request 30.0s; production data; 1m ago',
  'At-threshold model request duration should not render a slow route chip',
);

const slowDurationViewModel = buildRoutingEventViewModel(event('slow-duration', {
  classifierModel: 'provider:classifier',
  modelRequestDurationMs: 30001,
}), nowMs);
assert.deepEqual(
  slowDurationViewModel.requestDuration,
  { durationMs: 30001, label: 'model request 30.0s', slow: true, thresholdMs: 30000 },
  'Per-event model request duration should flag strictly above-threshold requests as slow',
);
assert.equal(
  slowDurationViewModel.traceSummary,
  'Classifier decision; classifier: provider:classifier; model request 30.0s; slow request; production data; 1m ago',
  'Slow model request duration should render a recent-decision slow route chip without changing policy text',
);

assert.deepEqual(
  buildRoutingEventDecisionExplanation(events[1]),
  {
    reason: 'Fallback over scored alternative',
    detail: 'Default fallback selected model-fallback while model-top scored 0.90.',
    contributors: [
      { label: 'fallback used', title: 'Default fallback' },
      { label: 'top score 0.90', title: 'model-top scored above model-fallback' },
      { label: 'policy: escalated', title: 'Escalated selection' },
    ],
  },
  'Decision explanation should make fallback-over-score routes obvious',
);

assert.deepEqual(
  buildRoutingEventDecisionExplanation(event('fallback-empty', {
    selectedModel: 'model-default',
    score: 0,
    candidateScores: {},
    wasFallback: true,
  })),
  {
    reason: 'Default fallback',
    detail: 'No candidate scores were recorded for this fallback route.',
    contributors: [
      { label: 'fallback used', title: 'Default fallback' },
    ],
  },
  'Decision explanation should have a quiet no-score fallback state',
);

const fallbackTraceChips = buildRoutingEventTraceChips(events[1], nowMs);
for (const expected of ['Default fallback', 'classifier: unavailable', 'fallback used', 'production data']) {
  assert.ok(
    fallbackTraceChips.some((chip) => chip.label === expected),
    `Fallback route trace chips should include ${expected}`,
  );
}

const runIdTraceChips = buildRoutingEventTraceChips(events[0], nowMs);
assert.equal(
  runIdTraceChips.find((chip) => chip.label === 'run: run-late')?.title,
  'Harness run id run-latest-cheap-abcdef123456 links routing decisions to provider-failure telemetry when both streams record it.',
  'Routing trace chips should expose a compact harness run id join key when present',
);

const benchmarkTraceChips = buildRoutingEventTraceChips(events[2], nowMs);
assert.equal(
  benchmarkTraceChips.find((chip) => chip.label === 'benchmark data')?.title,
  'Benchmark events are preserved but excluded from production learning summaries.',
  'Benchmark routing trace chip should explain why it is separated from production learning',
);

const componentSource = readFileSync('src/components/RoutingLearningPane.tsx', 'utf8');
const helperSource = readFileSync('src/utils/routingLearningRecentDecisions.ts', 'utf8');
const componentStylesSource = readFileSync('src/styles/components.css', 'utf8');
const source = `${componentSource}\n${helperSource}`;
const exportHandlerSource = componentSource.slice(componentSource.indexOf('const handleExportEvidence'));

for (const expected of [
  'buildRoutingLearningRecentDecisionState({',
  'const recentDecisionState = useMemo(',
  'const [routeDecisionNowMs, setRouteDecisionNowMs] = useState(() => Date.now());',
  'const [recentEventDisplayLimit, setRecentEventDisplayLimit] = useState(RECENT_EVENT_BATCH_SIZE);',
  'const [adherenceEvents, setAdherenceEvents] = useState<api.RoutingAdherenceEvent[]>([]);',
  'const [adherenceLoadError, setAdherenceLoadError] = useState<string | null>(null);',
  'const [showUnratedOnly, setShowUnratedOnly] = useState(false);',
  'MAX_RECENT_EVENT_DISPLAY_LIMIT',
  'routingEventNeedsOutcome(event)',
  'setRouteDecisionNowMs(Date.now())',
  'nowMs: routeDecisionNowMs,',
  'routeDecisionNowMs,',
  '} = recentDecisionState;',
  'buildRoutingEventEvidenceView(event, routeDecisionNowMs, outcomeNotes[event.id] || event.outcomeNote)',
  'const routingEventEvidenceViews = useMemo(',
  'const routingEventEvidenceById = useMemo(',
  'const visibleRecentEventEvidenceViews = useMemo(',
  'routingEventEvidenceExportRow(eventEvidence: RoutingEventEvidenceView)',
  'recentEvents: routingEventEvidenceViews.map(routingEventEvidenceExportRow)',
  'filteredRecentEvents: visibleRecentEventEvidenceViews.map(routingEventEvidenceExportRow)',
  'const { topScores, traceChips, decisionExplanation, marginSummary } = eventEvidence;',
  'Route trace context for ${event.selectedModel}: ${traceChips.map((chip) => chip.label).join(\', \')}',
  'const decisionScanCards = useMemo(() => buildRoutingDecisionScanCards(recentDecisionState), [recentDecisionState]);',
  'buildRoutingEventScoreEvidenceKey(event)',
  'scoreEvidenceKey,',
  'scoreEvidenceReadiness,',
  'scoreEvidenceKey is derived from task hashes, routing metadata, and redacted prompt snapshot metadata; it does not contain prompt text.',
  '- Score evidence keys: derived from task hashes, routing metadata, and redacted prompt snapshot metadata; no prompt text is stored in the key.',
  'const routingDecisionScanCardPressed = (filterTarget: RoutingDecisionScanFilterTarget | null): boolean => {',
  'const handleRoutingDecisionScanCard = (filterTarget: RoutingDecisionScanFilterTarget) => {',
  'const shouldClear = routingDecisionScanCardPressed(filterTarget);',
  'setShowUnratedOnly(!shouldClear && filterTarget === \'needs-outcome\');',
  'setShowFallbackOnly(!shouldClear && filterTarget === \'fallbacks\');',
  'setShowStaleOnly(!shouldClear && filterTarget === \'stale\');',
  'setRecentEventDisplayLimit(RECENT_EVENT_BATCH_SIZE);',
  'const recentEventDisplayWindow = useMemo(() => buildRoutingEventDisplayWindow(visibleRecentEventEvidenceViews, recentEventDisplayLimit), [visibleRecentEventEvidenceViews, recentEventDisplayLimit]);',
  'const displayedRecentEventViews = recentEventDisplayWindow.events;',
  'const displayedRecentEvents = displayedRecentEventViews.map((eventEvidence) => eventEvidence.event);',
  'const hiddenRecentEventCount = recentEventDisplayWindow.hiddenCount;',
  'const showRecentEventSliceControls = hiddenRecentEventCount > 0 || recentEventDisplayWindow.canShowFewer;',
  'function buildToolReliabilityTopRows',
  'const toolReliabilityTopRows = useMemo(() => buildToolReliabilityTopRows(summary?.toolReliability), [summary?.toolReliability]);',
  'toolReliabilityTopRows.byModel.length',
  'toolReliabilityTopRows.byTool.length',
  'toolReliabilityTopRows.byModelTool.length',
  'toolReliabilityTopRows.byPromptStrategyVariant.length',
  'const modelRequestDurationRows = useMemo(() => buildModelRequestDurationRows(summary?.modelRequestDuration), [summary?.modelRequestDuration]);',
  'modelRequestDurationRows.byModel.length',
  'modelRequestDurationRows.byTaskType.length',
  '<ModelRequestDurationColumn title="By model" rows={modelRequestDurationRows.byModel} />',
  '<ModelRequestDurationColumn title="By task" rows={modelRequestDurationRows.byTaskType} />',
  'Model Request Duration',
  'className={item.slow ? \'routing-duration-slow\' : undefined}',
  'slow > ${ms(item.thresholdMs)}',
  "import { buildModelRequestDurationEvidence, modelRequestDurationEvidenceLines, sortModelRequestDurationRows } from '../utils/modelRequestDurationEvidence';",
  'const modelRequestDurationEvidence = useMemo(() => buildModelRequestDurationEvidence(modelRequestDurationRows), [modelRequestDurationRows]);',
  'modelRequestDurationEvidence.summary.slowRowCount',
  'modelRequestDurationEvidence.summary.thresholdMs',
  '{modelRequestDurationEvidence.summary.slowRowCount} slow',
  'threshold {ms(modelRequestDurationEvidence.summary.thresholdMs)}',
  'return sortModelRequestDurationRows(Object.entries(data || {})',
  'modelRequestDurationEvidence,',
  '...modelRequestDurationEvidenceLines(modelRequestDurationRows),',
  '<ToolReliabilityColumn title="By model" rows={toolReliabilityTopRows.byModel} />',
  '<ToolReliabilityColumn title="By tool" rows={toolReliabilityTopRows.byTool} />',
  'rows: ToolReliabilityRow[];',
  'function buildRoutingLearningReviewExportState({',
  'const reviewExportState = useMemo(() => buildRoutingLearningReviewExportState({',
  'activeFilter: activeFilterLabel(showUnratedOnly, showUnexplainedOnly, showStaleOnly, showFallbackOnly, showBenchmarkOnly, showEvidenceGapsOnly, policyFilter)',
  'visibleRecentEventCount: visibleRecentEvents.length',
  'reviewExportState.activeFilter',
  'reviewExportState.visibleRecentEventCount',
  'reviewExportState.reviewedEvents.length',
  'reviewExportState.unratedEvents.length',
  'reviewExportState.notedEventCount',
  'reviewExportState.latestEvidenceTimestamp',
  'reviewExportState.latestEvidenceAge',
  'reviewExportState.freshnessWarning',
  'interface RoutingMetricCardProps',
  'function RoutingMetricCard({ label, value, detail, tone, ariaLabel }: RoutingMetricCardProps)',
  "className={['routing-metric-card', tone].filter(Boolean).join(' ')}",
  'role="listitem"',
  'aria-label={ariaLabel}',
  '<section className="routing-metrics" role="list"',
  'label="Reviewed outcomes"',
  'label="Observed success"',
  'label="Candidate evidence"',
  'label="Live tool-error ledger"',
  'const runtimeThresholdAdvice = routerState?.thresholdAdvice ?? null;',
  'function pct(value: unknown): string {',
  'return formatPercentDisplay(value);',
  'const successRate = summary?.successRate ?? 0;',
  'pct(routingTrend.winRate)',
  'thresholdAdvice: routerState?.thresholdAdvice ?? null,',
  '`- Runtime threshold advice: ${routerState?.thresholdAdvice',
  '`- Configured threshold: ${formatScoreDisplay(routerState.thresholdAdvice.configuredThreshold)}`',
  '`- Active threshold: ${formatScoreDisplay(routerState.thresholdAdvice.activeThreshold)}`',
  '`- Suggested threshold: ${formatScoreDisplay(routerState.thresholdAdvice.suggestedThreshold)}`',
  '`- Applied to runtime: ${routerState.thresholdAdvice.applied ? \'yes\' : \'no\'}`',
  'Runtime threshold',
  "runtimeThresholdAdvice?.applied ? 'ok' : runtimeThresholdAdvice ? 'low' : ''",
  'runtimeThresholdAdvice ? formatScoreDisplay(runtimeThresholdAdvice.activeThreshold) : \'--\'',
  'runtimeThresholdAdvice.applied',
  '(runtimeThresholdAdvice || thresholdSuggestion) && (',
  'Runtime threshold advice applied:',
  'Runtime threshold advice is advisory:',
  'runtimeThresholdAdvice.reason',
  '<div className="routing-decision-scan" role="list" aria-label="Routing decision scan summary">',
  "const [showEvidenceGapsOnly, setShowEvidenceGapsOnly] = useState(false);",
  'const scanCardFilterTarget = card.filterTarget;',
  'className="routing-scan-card-shell"',
  'scanCardFilterTarget ? (',
  'type="button"',
  'className={`${scanCardClassName} actionable${scanCardPressed ? \' active\' : \'\'}`}',
  'aria-pressed={scanCardPressed}',
  'aria-label={`${scanCardPressed ? \'Clear\' : \'Show\'} ${card.label.toLowerCase()} routing decisions. ${card.detail}`}',
  'onClick={() => handleRoutingDecisionScanCard(scanCardFilterTarget)}',
  'className={scanCardClassName}',
  'routing-scan-card ${card.tone}',
  '{card.label}',
  '{card.value}',
  '{card.detail}',
  'traceSummary: eventEvidence.traceSummary,',
  'traceChips: eventEvidence.traceChips,',
  "const PROVIDER_FAILURE_ADHERENCE_PHASE = 'provider-stream';",
  'const PROVIDER_FAILURE_ADHERENCE_EVENT_LIMIT = 8;',
  'const PROVIDER_FAILURE_ADHERENCE_ROW_LIMIT = 5;',
  'api.getRouterAdherenceEvents(PROVIDER_FAILURE_ADHERENCE_EVENT_LIMIT, PROVIDER_FAILURE_ADHERENCE_PHASE)',
  'const providerFailureRows = useMemo(() => buildProviderFailureRows(adherenceEvents, PROVIDER_FAILURE_ADHERENCE_ROW_LIMIT, events), [adherenceEvents, events]);',
  'providerFailureAdherence: {',
  "scope: 'rolling-tail'",
  'scopeNote: PROVIDER_FAILURE_SCOPE_NOTE',
  'phase: PROVIDER_FAILURE_ADHERENCE_PHASE',
  'rows: providerFailureRows',
  '<h3>Provider Failure Adherence</h3>',
  'Router decisions stay separate from execution failures; this shows the provider attempt path when fallback actually ran.',
  'visibleProviderFailureRows.map((row) => (',
  '{row.attemptPath}',
  '{row.terminalTimeout}',
  'No provider failure adherence events loaded yet.',
  'displayedRecentEventViews.map((eventEvidence) => {',
  "if (filterTarget === 'evidence-gaps') return showEvidenceGapsOnly;",
  "setShowEvidenceGapsOnly(!shouldClear && filterTarget === 'evidence-gaps');",
  'Trace: ${eventEvidence.traceSummary}.',
  'Needs outcome (${unratedEventCount})',
  'setShowUnratedOnly((value) => !value);',
  'All loaded routing events have outcomes.',
  'recentEventDisplayWindow.canShowMore && (',
  'className="routing-event-slice-note"',
  'role="status"',
  'aria-live="polite"',
  'Showing {displayedRecentEvents.length} of {visibleRecentEvents.length} matching decisions;',
  '{hiddenRecentEventCount} more match the current filters.',
  'recentEventDisplayWindow.reachedLimit && (',
  'Review window cap reached at {MAX_RECENT_EVENT_DISPLAY_LIMIT} decisions.',
  'Show {recentEventDisplayWindow.nextCount} more',
  'setRecentEventDisplayLimit((limit) => Math.min(visibleRecentEvents.length, limit + RECENT_EVENT_BATCH_SIZE))',
  'recentEventDisplayWindow.canShowFewer',
  'Show fewer',
  'autoRouterClassifierLabel({ classifierModel: event.classifierModel, fallback: event.wasFallback })',
  'buildRoutingEventTraceChips(event, nowMs)',
  'buildRoutingEventReplayReadiness(event)',
  'Score evidence: {replayReadiness.label}',
  'Evidence key: {scoreEvidenceKey.id}',
  'All loaded routing events have the score evidence needed for routing evidence review.',
  'Missing: {replayReadiness.missing.join(\', \')}',
  'decisionExplanation: buildRoutingEventDecisionExplanation(event, scores)',
  'marginSummary: buildRouteMarginSummary(event, topScores)',
  "import { formatPercentDisplay, formatScoreDisplay } from '../utils/scoreDisplay';",
  'formatScoreDisplay(score)',
  'formatScoreDisplay(event.score)',
  'routing-event-decision-explanation',
  'Route decision explanation for ${event.selectedModel}: ${decisionExplanation.detail}',
  '{decisionExplanation.reason}',
  '{decisionExplanation.detail}',
  'decisionExplanation.contributors.map((chip)',
  'const requestDuration = buildRoutingEventRequestDuration(event)',
  'requestDuration,',
  'formatModelRequestDurationMs(event.modelRequestDurationMs)',
  'model request ${durationLabel}',
  "import { MODEL_REQUEST_SLOW_DURATION_MS, isSlowModelRequestDurationMs } from '../../shared/modelRequestDuration';",
  'slow: isSlowModelRequestDurationMs(durationMs),',
  'thresholdMs: MODEL_REQUEST_SLOW_DURATION_MS,',
  "label: 'slow request'",
]) {
  assert.ok(source.includes(expected), `Routing Learning recent-decision trace should use shared derived state: ${expected}`);
}

assert.ok(
  /\.routing-duration-slow\s*\{[^}]*color:\s*var\(--accent-warning,\s*#b45309\)/s.test(componentStylesSource),
  'Routing Learning slow request-duration rows should use accent-warning with a contrast-safe fallback',
);
assert.ok(
  !/\.routing-duration-slow\s*\{[^}]*color:\s*var\(--warning\)/s.test(componentStylesSource),
  'Routing Learning slow request-duration rows should not use undefined --warning token',
);

for (const removed of [
  'const fallbackEvents = events.filter((event) => event.wasFallback);',
  'const visibleRecentEvents = events.filter((event) => {',
  'const staleEventCount = events.filter((event) => routeEventIsStale(event.timestamp)).length;',
  '{event.classifierModel && <span>classifier: {event.classifierModel}</span>}',
  '<span>{routingEventDecisionLabel(event)}</span>',
  'traceChips: buildRoutingEventTraceChips(event, routeDecisionNowMs).map((chip) => chip.label),',
  'function routeMarginSummary(event: api.RoutingEvent): string',
  'const topScores = sortedCandidateScores(event.candidateScores, 4);',
  'const traceChips = buildRoutingEventTraceChips(event, routeDecisionNowMs);',
  'const decisionExplanation = buildRoutingEventDecisionExplanation(event);',
  'const eventView = buildRoutingEventViewModel(event, routeDecisionNowMs);',
  'const scoreEvidenceKey = buildRoutingEventScoreEvidenceKey(event);',
  'const replayReadiness = buildRoutingEventReplayReadiness(event);',
  '{routeMarginSummary(event)}',
  'score.toFixed(2)',
  'event.score.toFixed(2)',
  'routerState.thresholdAdvice.configuredThreshold.toFixed(2)',
  'routerState.thresholdAdvice.activeThreshold.toFixed(2)',
  'routerState.thresholdAdvice.suggestedThreshold.toFixed(2)',
  'thresholdSuggestion.suggestedThreshold.toFixed(2)',
  'runtimeThresholdAdvice.activeThreshold.toFixed(2)',
  'function pct(value: number): string',
  "if (typeof value !== 'number' || !Number.isFinite(value)) return 'unavailable';",
  'const successRate = summary?.successRate || 0;',
  'Math.round(routingTrend.winRate * 100)',
  'hiddenRecentEventCount > 0 && (',
  'visibleRecentEvents.slice(0, 12).map((event)',
  'visibleRecentEvents.slice(0, 12)',
  '<div key={card.id} className={`routing-scan-card ${card.tone}`} role="listitem" title={card.detail}>',
]) {
  assert.ok(!componentSource.includes(removed), `Routing Learning pane should not keep repeated inline recent-decision derivation: ${removed}`);
}
for (const removed of [
  'const reviewedEvents = events.filter((event) => event.outcome !== null);',
  'const unratedEvents = events.filter((event) => event.outcome === null);',
]) {
  assert.ok(!exportHandlerSource.includes(removed), `Routing Learning export handlers should use reviewExportState instead of inline filters: ${removed}`);
}

console.log('Routing Learning recent-decision state checks passed.');
