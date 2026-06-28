import type { RoutingEvent } from './api';

export interface RoutingTrendSignal {
  signal: string;
  count: number;
}

export interface RoutingTrend {
  totalDecisions: number;
  windowSize: number;
  recentCount: number;
  winRate: number;
  dominantPolicy: string | null;
  topSignals: RoutingTrendSignal[];
}

function eventTime(event: RoutingEvent): number {
  const time = Date.parse(event.timestamp || '');
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
}

function signalLabels(event: RoutingEvent): string[] {
  const labels: string[] = [];
  const signal = event.routeSignal;
  if (signal?.hasImages) labels.push('images');
  if ((signal?.toolCount || 0) > 0) labels.push('tools');
  if ((signal?.artifactCount || 0) > 0) labels.push('artifacts');
  if ((signal?.estimatedInputTokens || 0) >= 8000) labels.push('large context');
  if (signal?.dirtyGitState) labels.push('dirty git');
  if (signal?.requiresStrongToolUse) labels.push('strong tool use');
  if (signal?.thinkingEffort) labels.push(`thinking:${signal.thinkingEffort}`);
  if (event.wasFallback) labels.push('fallback');
  if (event.wasCached) labels.push('cached');
  return labels;
}

function sortedCounts(counts: Map<string, number>, limit: number): RoutingTrendSignal[] {
  return Array.from(counts.entries())
    .sort(([a, aCount], [b, bCount]) => bCount - aCount || a.localeCompare(b))
    .slice(0, limit)
    .map(([signal, count]) => ({ signal, count }));
}

export function computeRoutingTrend(events: RoutingEvent[] | null | undefined, windowSize = 12): RoutingTrend {
  const list = Array.isArray(events) ? events : [];
  const safeWindowSize = Math.max(0, Math.floor(windowSize));
  const recent = [...list]
    .sort((a, b) => eventTime(b) - eventTime(a))
    .slice(0, safeWindowSize);
  const policyCounts = new Map<string, number>();
  const signalCounts = new Map<string, number>();

  for (const event of recent) {
    if (event.modelSelectionPolicy) {
      policyCounts.set(event.modelSelectionPolicy, (policyCounts.get(event.modelSelectionPolicy) || 0) + 1);
    }
    for (const label of signalLabels(event)) {
      signalCounts.set(label, (signalCounts.get(label) || 0) + 1);
    }
  }

  const successCount = recent.filter((event) => event.outcome === 'success').length;

  return {
    totalDecisions: list.length,
    windowSize: safeWindowSize,
    recentCount: recent.length,
    winRate: recent.length > 0 ? successCount / recent.length : 0,
    dominantPolicy: sortedCounts(policyCounts, 1)[0]?.signal || null,
    topSignals: sortedCounts(signalCounts, 5),
  };
}
