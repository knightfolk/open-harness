import type { RoutingEvent } from './api';

export type RoutingPolicyFilter = 'all' | NonNullable<RoutingEvent['modelSelectionPolicy']>;

export const ROUTING_POLICY_FILTERS: Array<Exclude<RoutingPolicyFilter, 'all'>> = [
  'cheap-direct',
  'classifier',
  'escalated',
];

export function routingPolicyFilterLabel(filter: RoutingPolicyFilter): string {
  if (filter === 'cheap-direct') return 'Cheap direct';
  if (filter === 'classifier') return 'Classifier';
  if (filter === 'escalated') return 'Escalated';
  return 'All policies';
}

export function matchesRoutingPolicyFilter(event: Pick<RoutingEvent, 'modelSelectionPolicy'>, filter: RoutingPolicyFilter): boolean {
  return filter === 'all' || event.modelSelectionPolicy === filter;
}

export function buildRoutingPolicyFilterCounts(events: Pick<RoutingEvent, 'modelSelectionPolicy'>[]): Record<Exclude<RoutingPolicyFilter, 'all'>, number> {
  const counts = {
    'cheap-direct': 0,
    classifier: 0,
    escalated: 0,
  };
  for (const event of events) {
    if (event.modelSelectionPolicy && event.modelSelectionPolicy in counts) {
      counts[event.modelSelectionPolicy] += 1;
    }
  }
  return counts;
}
