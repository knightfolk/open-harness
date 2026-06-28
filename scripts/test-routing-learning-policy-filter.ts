import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import type { RoutingEvent } from '../src/utils/api';
import {
  ROUTING_POLICY_FILTERS,
  buildRoutingPolicyFilterCounts,
  matchesRoutingPolicyFilter,
  routingPolicyFilterLabel,
  type RoutingPolicyFilter,
} from '../src/utils/routingLearningPolicyFilter';

function event(id: string, modelSelectionPolicy?: RoutingEvent['modelSelectionPolicy']): RoutingEvent {
  return {
    id,
    timestamp: new Date(0).toISOString(),
    sessionId: 'policy-filter-session',
    taskType: 'execute',
    role: 'coder',
    complexity: 'medium',
    selectedModel: `provider:${id}`,
    score: 0.5,
    candidateScores: {},
    wasFallback: false,
    wasCached: false,
    modelSelectionPolicy,
    classifierModel: null,
    outcome: null,
  };
}

const events = [
  event('cheap-a', 'cheap-direct'),
  event('cheap-b', 'cheap-direct'),
  event('classifier-a', 'classifier'),
  event('escalated-a', 'escalated'),
  event('legacy'),
];

assert.deepEqual(
  ROUTING_POLICY_FILTERS,
  ['cheap-direct', 'classifier', 'escalated'],
  'Routing Learning should expose the three current model-selection policy filters in stable order',
);

assert.deepEqual(
  buildRoutingPolicyFilterCounts(events),
  { 'cheap-direct': 2, classifier: 1, escalated: 1 },
  'Policy filter counts should count only loaded events with explicit policies',
);

assert.deepEqual(
  (['all', 'cheap-direct', 'classifier', 'escalated'] as RoutingPolicyFilter[])
    .map((filter) => [filter, events.filter((item) => matchesRoutingPolicyFilter(item, filter)).map((item) => item.id)]),
  [
    ['all', ['cheap-a', 'cheap-b', 'classifier-a', 'escalated-a', 'legacy']],
    ['cheap-direct', ['cheap-a', 'cheap-b']],
    ['classifier', ['classifier-a']],
    ['escalated', ['escalated-a']],
  ],
  'Policy filters should include legacy events only in the all-policy view',
);

assert.equal(routingPolicyFilterLabel('all'), 'All policies');
assert.equal(routingPolicyFilterLabel('cheap-direct'), 'Cheap direct');
assert.equal(routingPolicyFilterLabel('classifier'), 'Classifier');
assert.equal(routingPolicyFilterLabel('escalated'), 'Escalated');

const componentSource = readFileSync('src/components/RoutingLearningPane.tsx', 'utf8');
const helperSource = readFileSync('src/utils/routingLearningRecentDecisions.ts', 'utf8');
const source = `${componentSource}\n${helperSource}`;

for (const expected of [
  'const [policyFilter, setPolicyFilter] = useState<RoutingPolicyFilter>(\'all\')',
  'policyFilterCounts',
  'buildRoutingPolicyFilterCounts(events)',
  'matchesRoutingPolicyFilter(event, filters.policyFilter)',
  'ROUTING_POLICY_FILTERS.map((filter)',
  'routingPolicyFilterLabel(filter)',
  'setPolicyFilter(\'all\')',
]) {
  assert.ok(source.includes(expected), `Routing Learning pane should include policy-filter wiring: ${expected}`);
}

console.log('Routing Learning policy filter checks passed.');
