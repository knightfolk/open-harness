import type { RoutingStageTrace } from '../types';

type RouteSignal = NonNullable<RoutingStageTrace['signal']>;

export interface RouteInputSummaryItem {
  label: string;
  value: string;
}

function yesNo(value: boolean): string {
  return value ? 'yes' : 'no';
}

function requiredCount(value: number): string {
  return Number.isFinite(value) && value >= 0 ? String(value) : 'unavailable';
}

function optionalCount(value: number | undefined): string | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? String(value) : null;
}

export function buildRouteInputSummary(signal: RouteSignal | undefined): RouteInputSummaryItem[] {
  if (!signal) return [];

  const rows: RouteInputSummaryItem[] = [
    { label: 'Images', value: yesNo(signal.hasImages) },
    { label: 'Turns', value: requiredCount(signal.turns) },
    { label: 'Tools available', value: requiredCount(signal.toolCount) },
    { label: 'Estimated input tokens', value: requiredCount(signal.estimatedInputTokens) },
  ];

  const artifacts = optionalCount(signal.artifactCount);
  if (artifacts != null) {
    rows.push({ label: 'Attached artifacts', value: artifacts });
  }
  if (signal.dirtyGitState !== undefined) {
    rows.push({ label: 'Git state', value: signal.dirtyGitState ? 'dirty' : 'clean' });
  }
  if (signal.thinkingEffort) {
    rows.push({ label: 'Thinking effort', value: signal.thinkingEffort });
  }
  if (signal.requiresStrongToolUse !== undefined) {
    rows.push({ label: 'Strong tool use required', value: yesNo(signal.requiresStrongToolUse) });
  }

  return rows;
}
