import type { RoutingEvent } from './api';

type RouteSignal = NonNullable<RoutingEvent['routeSignal']>;

export interface RouteLearningSignalChip {
  label: string;
  value: string;
}

function maybeNumber(value: number | undefined): string | null {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0 ? String(value) : null;
}

function yesNo(value: boolean): string {
  return value ? 'yes' : 'no';
}

export function buildRouteLearningSignalChips(signal: RouteSignal | undefined): RouteLearningSignalChip[] {
  if (!signal) return [];

  const chips: RouteLearningSignalChip[] = [];
  if (signal.hasImages) chips.push({ label: 'Images', value: 'yes' });
  const turns = maybeNumber(signal.turns);
  if (turns) chips.push({ label: 'Turns', value: turns });
  const tools = maybeNumber(signal.toolCount);
  if (tools) chips.push({ label: 'Tools', value: tools });
  const tokens = maybeNumber(signal.estimatedInputTokens);
  if (tokens) chips.push({ label: 'Input tokens', value: tokens });
  const artifacts = maybeNumber(signal.artifactCount);
  if (artifacts) chips.push({ label: 'Artifacts', value: artifacts });
  if (signal.dirtyGitState !== undefined) chips.push({ label: 'Git', value: signal.dirtyGitState ? 'dirty' : 'clean' });
  if (signal.thinkingEffort) chips.push({ label: 'Thinking', value: signal.thinkingEffort });
  if (signal.requiresStrongToolUse !== undefined) chips.push({ label: 'Strong tools', value: yesNo(signal.requiresStrongToolUse) });
  return chips;
}

export function formatRouteLearningSignalSummary(signal: RouteSignal | undefined): string {
  return buildRouteLearningSignalChips(signal)
    .map((chip) => `${chip.label} ${chip.value}`)
    .join(', ');
}
