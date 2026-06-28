import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  ROUTING_ACTION_CUE_CONFIDENCE_FILTERS,
  ROUTING_LEARNING_STALE_DECISION_DAYS,
  buildRoutingLearningActionCues,
  filterRoutingLearningActionCues,
  isRoutingLearningCueStale,
  routingLearningActionCueFilterLabel,
} from '../src/utils/routingLearningActionCues';

const nowMs = Date.parse('2026-06-29T00:00:00.000Z');
const cues = buildRoutingLearningActionCues([
  { taskType: 'execute', model: 'provider:strong-model', total: 8, success: 7, rate: 0.875, sampleCount: 8, firstSeenAt: '2026-06-20T00:00:00.000Z', lastSeenAt: '2026-06-28T12:34:56.000Z' },
  { taskType: 'direct', model: 'provider:veteran-model', total: 12, success: 11, rate: 0.917, sampleCount: 12, firstSeenAt: '2026-06-10T00:00:00.000Z', lastSeenAt: '2026-06-22T00:00:00.000Z' },
  { taskType: 'investigate', model: 'provider:research-model', total: 3, success: 3, rate: 1 },
  { taskType: 'compare', model: 'provider:mixed-model', total: 6, success: 4, rate: 0.667 },
], nowMs);

assert.deepEqual(
  cues.map((cue) => ({
    taskType: cue.taskType,
    model: cue.model,
    status: cue.status,
    label: cue.label,
    detail: cue.detail,
    confidence: cue.confidence,
    confidenceLabel: cue.confidenceLabel,
    confidenceDetail: cue.confidenceDetail,
    decisionFreshnessLabel: cue.decisionFreshnessLabel,
    freshnessDetail: cue.freshnessDetail,
  })),
  [
    {
      taskType: 'execute',
      model: 'provider:strong-model',
      status: 'actionable',
      label: 'Candidate card cue',
      detail: 'Use as advisory routing-card evidence: provider:strong-model handled execute at 88% across 8 reviewed outcomes. Confidence: limited sample; review before relying on this cue.',
      confidence: 'limited',
      confidenceLabel: 'Limited sample',
      confidenceDetail: 'Only 8 reviewed execute outcomes support this cue.',
      decisionFreshnessLabel: 'Last routed 2026-06-28',
      freshnessDetail: 'Decision freshness: 8 reviewed routing decisions; first routed 2026-06-20, most recent routed 2026-06-28. This is routing-decision age, not outcome-review age.',
    },
    {
      taskType: 'direct',
      model: 'provider:veteran-model',
      status: 'actionable',
      label: 'Candidate card cue',
      detail: 'Use as advisory routing-card evidence: provider:veteran-model handled direct at 92% across 12 reviewed outcomes.',
      confidence: 'high',
      confidenceLabel: 'High confidence',
      confidenceDetail: '12 reviewed direct outcomes support this cue.',
      decisionFreshnessLabel: 'Last routed 2026-06-22',
      freshnessDetail: 'Decision freshness: 12 reviewed routing decisions; first routed 2026-06-10, most recent routed 2026-06-22. This is routing-decision age, not outcome-review age.',
    },
    {
      taskType: 'investigate',
      model: 'provider:research-model',
      status: 'learning',
      label: 'Needs more outcomes',
      detail: 'Collect 2 more reviewed investigate outcomes before using provider:research-model as routing-card evidence.',
      confidence: 'learning',
      confidenceLabel: 'Learning',
      confidenceDetail: '3 reviewed investigate outcomes is below the 5-outcome action bar.',
      decisionFreshnessLabel: '',
      freshnessDetail: '',
    },
    {
      taskType: 'compare',
      model: 'provider:mixed-model',
      status: 'context',
      label: 'Context only',
      detail: 'provider:mixed-model is the current compare winner, but 67% is below the 80% action bar.',
      confidence: 'weak',
      confidenceLabel: 'Weak signal',
      confidenceDetail: '67% is below the 80% action bar for compare.',
      decisionFreshnessLabel: '',
      freshnessDetail: '',
    },
  ],
  'routing action cues should separate actionable card evidence from thin or weak task-type winners',
);

assert.equal(buildRoutingLearningActionCues([]).length, 0, 'empty winner lists should produce no action cues');
assert.equal(ROUTING_LEARNING_STALE_DECISION_DAYS, 30, 'routing cue freshness should use the documented 30-day review window');
assert.equal(isRoutingLearningCueStale({ lastSeenAt: '2026-05-31T00:00:00.000Z' }, nowMs), false, '29-day-old routing decisions should remain fresh');
assert.equal(isRoutingLearningCueStale({ lastSeenAt: '2026-05-30T00:00:00.000Z' }, nowMs), false, 'exactly 30-day-old routing decisions should remain fresh');
assert.equal(isRoutingLearningCueStale({ lastSeenAt: '2026-05-29T23:59:59.000Z' }, nowMs), true, 'routing decisions older than 30 days should be stale');
assert.equal(isRoutingLearningCueStale({ lastSeenAt: null }, nowMs), false, 'missing routing-decision timestamps should be unknown rather than stale');
assert.equal(isRoutingLearningCueStale({ lastSeenAt: 'not-a-date' }, nowMs), false, 'unparseable routing-decision timestamps should be unknown rather than stale');

const staleActionCue = buildRoutingLearningActionCues([
  { taskType: 'execute', model: 'provider:stale-winner', total: 15, success: 14, rate: 0.933, sampleCount: 15, firstSeenAt: '2026-04-01T00:00:00.000Z', lastSeenAt: '2026-05-01T00:00:00.000Z' },
], nowMs)[0];
assert.equal(staleActionCue.status, 'actionable', 'stale winners should keep their historical actionability visible in Routing Learning');
assert.equal(staleActionCue.confidence, 'high', 'stale winners should keep their sample confidence visible in Routing Learning');
assert.equal(staleActionCue.stale, true, 'stale winners should be explicitly marked stale');
assert.equal(staleActionCue.staleLabel, 'Stale (>30d)', 'stale winners should have a compact stale badge label');
assert.match(
  staleActionCue.detail,
  /Refresh recent outcomes before using this as routing-card evidence/i,
  'stale winners should not invite immediate candidate-card use',
);
assert.match(
  staleActionCue.ariaLabel,
  /No routing decisions recorded in the last 30 days; most recent routed 2026-05-01/i,
  'stale winners should explain why the evidence is context-only for routing authority',
);
assert.deepEqual(
  ROUTING_ACTION_CUE_CONFIDENCE_FILTERS,
  ['all', 'high', 'limited', 'learning', 'weak'],
  'routing action cue filters should expose one confidence axis plus all',
);
assert.deepEqual(
  ROUTING_ACTION_CUE_CONFIDENCE_FILTERS.map(routingLearningActionCueFilterLabel),
  ['All', 'High', 'Limited', 'Learning', 'Weak'],
  'routing action cue filters should have compact labels for segmented controls',
);
assert.deepEqual(
  filterRoutingLearningActionCues(cues, 'all').map((cue) => cue.taskType),
  ['execute', 'direct', 'investigate', 'compare'],
  'all action cue filter should preserve every cue',
);
assert.deepEqual(
  filterRoutingLearningActionCues(cues, 'high').map((cue) => cue.taskType),
  ['direct'],
  'high action cue filter should show only high-confidence cues',
);
assert.deepEqual(
  filterRoutingLearningActionCues(cues, 'limited').map((cue) => cue.taskType),
  ['execute'],
  'limited action cue filter should show only limited-sample cues',
);
assert.deepEqual(
  filterRoutingLearningActionCues(cues, 'learning').map((cue) => cue.taskType),
  ['investigate'],
  'learning action cue filter should show only below-action-bar sample cues',
);
assert.deepEqual(
  filterRoutingLearningActionCues(cues, 'weak').map((cue) => cue.taskType),
  ['compare'],
  'weak action cue filter should show only weak-rate cues',
);

const paneSource = readFileSync('src/components/RoutingLearningPane.tsx', 'utf8');
const styleSource = readFileSync('src/styles/components.css', 'utf8');
for (const expected of [
  "ROUTING_ACTION_CUE_CONFIDENCE_FILTERS,",
  'filterRoutingLearningActionCues,',
  "const routingActionCues = useMemo(() => buildRoutingLearningActionCues(summary?.bestByTaskType || []), [summary?.bestByTaskType]);",
  "const [routingActionCueFilter, setRoutingActionCueFilter] = useState<RoutingActionCueConfidenceFilter>('all');",
  'const visibleRoutingActionCues = useMemo(() => filterRoutingLearningActionCues(routingActionCues, routingActionCueFilter), [routingActionCues, routingActionCueFilter]);',
  'Routing Action Cues',
  'Use these as advisory candidate-card context; they do not change live routing.',
  'ROUTING_ACTION_CUE_CONFIDENCE_FILTERS.map((filter) =>',
  'routingLearningActionCueFilterLabel(filter)',
  'setRoutingActionCueFilter(filter)',
  'visibleRoutingActionCues.map((cue) =>',
  'cue.decisionFreshnessLabel &&',
  'cue.freshnessDetail &&',
]) {
  assert.ok(paneSource.includes(expected), `Routing Learning should render advisory action cues: ${expected}`);
}

for (const expected of [
  '.routing-action-cues',
  '.routing-action-cue-filters',
  '.routing-action-cue-filter',
  '.routing-action-cue-filter.active',
  '.routing-action-cue-list',
  '.routing-action-cue.actionable',
  '.routing-action-cue.learning',
  '.routing-action-cue.context',
]) {
  assert.ok(styleSource.includes(expected), `Routing Learning action cues should be styled: ${expected}`);
}

assert.ok(
  /\.routing-action-cue-filter:hover,[\s\S]*?\.routing-action-cue-filter\.active\s*\{[^}]*border-color:\s*var\(--accent-primary,\s*#6366f1\)/s.test(styleSource),
  'Routing Learning action cue filters should use accent-primary with a fallback for hover/focus/active borders',
);
assert.ok(
  !/\.routing-action-cue-filter:hover,[\s\S]*?\.routing-action-cue-filter\.active\s*\{[^}]*border-color:\s*var\(--accent-color\)/s.test(styleSource),
  'Routing Learning action cue filters should not use undefined --accent-color token',
);

console.log('Routing Learning action cue checks passed.');
