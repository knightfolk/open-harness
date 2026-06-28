import type { RoutingEvent } from './api';
import { MODEL_REQUEST_SLOW_DURATION_MS, isSlowModelRequestDurationMs } from '../../shared/modelRequestDuration';
import { autoRouterClassifierLabel, candidateScoresUnavailableLabel, routingEventDecisionLabel, routingOutcomeLabel, sortedCandidateScores } from './autoRouterTrace';
import { formatModelRequestDurationMs } from './modelRequestTimeoutDisplay';
import {
  buildRoutingPolicyFilterCounts,
  matchesRoutingPolicyFilter,
  type RoutingPolicyFilter,
} from './routingLearningPolicyFilter';
import { formatScoreDisplay } from './scoreDisplay';

const STALE_ROUTE_EVENT_MS = 7 * 24 * 60 * 60 * 1000;
export const RECENT_EVENT_BATCH_SIZE = 12;
export const MAX_RECENT_EVENT_DISPLAY_LIMIT = 120;

export interface RoutingLearningRecentDecisionFilters {
  showUnexplainedOnly: boolean;
  showUnratedOnly: boolean;
  showStaleOnly: boolean;
  showFallbackOnly: boolean;
  showBenchmarkOnly: boolean;
  showEvidenceGapsOnly: boolean;
  policyFilter: RoutingPolicyFilter;
}

export interface BuildRoutingLearningRecentDecisionStateOptions {
  events: RoutingEvent[];
  outcomeNotes: Record<string, string>;
  filters: RoutingLearningRecentDecisionFilters;
  nowMs?: number;
}

export interface RoutingLearningRecentDecisionState {
  latestEvent: RoutingEvent | null;
  latestScores: Array<[string, number]>;
  fallbackEvents: RoutingEvent[];
  ratedFallbackEvents: RoutingEvent[];
  notedEventCount: number;
  latestEventAge: string;
  latestEventIsStale: boolean;
  unexplainedEventCount: number;
  unratedEventCount: number;
  staleEventCount: number;
  benchmarkEventCount: number;
  productionEventCount: number;
  replayReadinessCounts: Record<RoutingEventReplayReadiness['status'], number>;
  replayGapEventCount: number;
  policyFilterCounts: Record<Exclude<RoutingPolicyFilter, 'all'>, number>;
  scanDestinationEventCount: number;
  scanDestinationUnratedEventCount: number;
  scanDestinationFallbackEventCount: number;
  scanDestinationRatedFallbackEventCount: number;
  scanDestinationStaleEventCount: number;
  scanDestinationReplayGapEventCount: number;
  visibleRecentEvents: RoutingEvent[];
}

export interface RoutingEventTraceChip {
  label: string;
  title?: string;
}

export interface RoutingEventDecisionExplanation {
  reason: string;
  detail: string;
  contributors: RoutingEventTraceChip[];
}

export interface RoutingEventViewModel {
  topScores: Array<[string, number]>;
  traceChips: RoutingEventTraceChip[];
  traceSummary: string;
  decisionExplanation: RoutingEventDecisionExplanation;
  marginSummary: string;
  requestDuration: { durationMs: number; label: string; slow: boolean; thresholdMs: number } | null;
}

export interface RoutingEventEvidenceView extends RoutingEventViewModel {
  event: RoutingEvent;
  outcomeNote?: string;
  scoreEvidenceKey: RoutingEventScoreEvidenceKey;
  scoreEvidenceReadiness: RoutingEventReplayReadiness;
}

export interface RoutingEventReplayReadiness {
  status: 'ready' | 'partial' | 'missing';
  replayable: boolean;
  label: string;
  detail: string;
  missing: string[];
}

export interface RoutingEventScoreEvidenceKey {
  id: string;
  detail: string;
}

export interface RoutingEventDisplayWindow<T> {
  events: T[];
  limit: number;
  hiddenCount: number;
  nextCount: number;
  canShowMore: boolean;
  canShowFewer: boolean;
  reachedLimit: boolean;
}

export type RoutingDecisionScanFilterTarget = 'needs-outcome' | 'fallbacks' | 'evidence-gaps' | 'stale';

export interface RoutingDecisionScanCard {
  id: 'latest' | 'unrated' | 'fallbacks' | 'evidence-gaps' | 'stale' | 'dataset';
  label: string;
  value: string;
  detail: string;
  tone: 'ok' | 'warning' | 'muted';
  filterTarget: RoutingDecisionScanFilterTarget | null;
}

function routeEventExactTimeLabel(timestamp: string): string {
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time)) return 'unknown timestamp';
  return new Date(time).toISOString();
}

export function routingEventNeedsOutcome(event: RoutingEvent): boolean {
  return event.outcome == null;
}

function decisionPolicyChip(event: RoutingEvent): RoutingEventTraceChip | null {
  if (!event.modelSelectionPolicy) return null;
  const policyLabels: Record<NonNullable<RoutingEvent['modelSelectionPolicy']>, string> = {
    'cheap-direct': 'Cheap direct selection',
    classifier: 'Classifier decision',
    escalated: 'Escalated selection',
  };
  const policyLabel = policyLabels[event.modelSelectionPolicy];
  const policyName = event.modelSelectionPolicy === 'cheap-direct' ? 'cheap direct' : event.modelSelectionPolicy;
  return { label: `policy: ${policyName}`, title: policyLabel };
}

function thresholdTraceChip(event: RoutingEvent): RoutingEventTraceChip | null {
  if (event.modelSelectionPolicy !== 'classifier') return null;
  if (typeof event.threshold !== 'number' || !Number.isFinite(event.threshold)) return null;
  return {
    label: `threshold ${formatScoreDisplay(event.threshold)}`,
    title: 'Classifier viability gate',
  };
}

function runIdTraceChip(event: RoutingEvent): RoutingEventTraceChip | null {
  if (!event.runId) return null;
  return {
    label: `run: ${event.runId.slice(0, 8)}`,
    title: `Harness run id ${event.runId} links routing decisions to provider-failure telemetry when both streams record it.`,
  };
}

function hasFiniteScore(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function stableScoreLabel(value: unknown): string {
  return hasFiniteScore(value) ? Number(value).toFixed(4) : 'missing';
}

function stableRouteSignalLabel(event: RoutingEvent): string {
  const signal = event.routeSignal;
  if (!signal) return 'missing';
  return [
    `images:${signal.hasImages ? 'yes' : 'no'}`,
    `turns:${Number.isFinite(signal.turns) ? signal.turns : 'missing'}`,
    `tools:${Number.isFinite(signal.toolCount) ? signal.toolCount : 'missing'}`,
    `tokens:${Number.isFinite(signal.estimatedInputTokens) ? signal.estimatedInputTokens : 'missing'}`,
    `artifacts:${Number.isFinite(signal.artifactCount) ? signal.artifactCount : 'missing'}`,
    `dirty:${signal.dirtyGitState ? 'yes' : 'no'}`,
    `effort:${signal.thinkingEffort || 'missing'}`,
    `strongTools:${signal.requiresStrongToolUse ? 'yes' : 'no'}`,
  ].join(',');
}

export function buildRoutingEventScoreEvidenceKey(event: RoutingEvent): RoutingEventScoreEvidenceKey {
  const scoreEntries = Object.entries(event.candidateScores || {})
    .filter(([, score]) => hasFiniteScore(score))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([model, score]) => `${model}:${stableScoreLabel(score)}`)
    .join(',');
  const parts = [
    `task:${event.taskHash || 'missing'}`,
    `selected:${event.selectedModel || 'missing'}`,
    `score:${stableScoreLabel(event.score)}`,
    `scores:${scoreEntries || 'missing'}`,
    `policy:${event.modelSelectionPolicy || 'missing'}`,
    `threshold:${stableScoreLabel(event.threshold)}`,
    `classifier:${event.classifierModel || 'missing'}`,
    `strategy:${event.promptStrategyId || 'missing'}`,
    `variant:${event.promptStrategyVariantId || 'missing'}`,
    `strategyTask:${event.promptStrategyTaskType || 'missing'}`,
    `promptSnapshot:${event.taskPromptSnapshot?.hash || 'missing'}`,
    `promptChars:${hasFiniteScore(event.taskPromptSnapshot?.charCount) ? event.taskPromptSnapshot?.charCount : 'missing'}`,
    `promptTruncated:${event.taskPromptSnapshot?.truncated ? 'yes' : 'no'}`,
    `signals:${stableRouteSignalLabel(event)}`,
  ];
  return {
    id: stableHash(parts.join('|')),
    detail: 'Derived from task hash, routing metadata, and redacted prompt snapshot metadata; it does not contain prompt text.',
  };
}

export function buildRoutingEventReplayReadiness(event: RoutingEvent): RoutingEventReplayReadiness {
  const candidateScoreEntries = Object.entries(event.candidateScores || {})
    .filter(([, score]) => hasFiniteScore(score));
  const missing: string[] = [];
  if (!event.taskHash) missing.push('task hash');
  if (candidateScoreEntries.length === 0) missing.push('candidate scores');
  if (!event.modelSelectionPolicy) missing.push('model selection policy');
  if (event.modelSelectionPolicy === 'classifier' && !hasFiniteScore(event.threshold)) missing.push('classifier threshold');
  if (!event.routeSignal) missing.push('route input signals');
  if (!event.runId) missing.push('linked run id');
  if (!event.taskPromptSnapshot?.hash || !event.taskPromptSnapshot.text) missing.push('redacted prompt snapshot');
  if (candidateScoreEntries.length > 0 && !hasFiniteScore(event.candidateScores?.[event.selectedModel])) missing.push('selected model score');

  if (missing.length === 0) {
    return {
      status: 'ready',
      replayable: true,
      label: 'Score evidence ready',
      detail: 'Score evidence ready from saved candidate scores, policy, route signals, threshold, linked run evidence, and a redacted prompt snapshot.',
      missing,
    };
  }

  if (candidateScoreEntries.length === 0) {
    return {
      status: 'missing',
      replayable: false,
      label: 'Score evidence blocked',
      detail: `Missing ${missing.join(', ')}. Stored routing metadata is not enough for offline route review.`,
      missing,
    };
  }

  return {
    status: 'partial',
    replayable: false,
    label: 'Score evidence partial',
    detail: `Missing ${missing.join(', ')}. Stored scores can still be inspected, but this decision is not ready for offline evidence review.`,
    missing,
  };
}

export function buildRoutingEventRequestDuration(event: RoutingEvent): { durationMs: number; label: string; slow: boolean; thresholdMs: number } | null {
  if (typeof event.modelRequestDurationMs !== 'number' || !Number.isFinite(event.modelRequestDurationMs) || event.modelRequestDurationMs < 0) {
    return null;
  }
  const durationMs = Math.round(event.modelRequestDurationMs);
  const durationLabel = formatModelRequestDurationMs(event.modelRequestDurationMs);
  return {
    durationMs,
    label: `model request ${durationLabel}`,
    slow: isSlowModelRequestDurationMs(durationMs),
    thresholdMs: MODEL_REQUEST_SLOW_DURATION_MS,
  };
}

function thresholdDecisionContext(event: RoutingEvent, selectedScore: number): { sentence: string; contributor: RoutingEventTraceChip } | null {
  if (event.modelSelectionPolicy !== 'classifier') return null;
  if (typeof event.threshold !== 'number' || !Number.isFinite(event.threshold)) return null;
  const gap = selectedScore - event.threshold;
  const thresholdLabel = formatScoreDisplay(event.threshold);
  const scoreLabel = formatScoreDisplay(selectedScore, 3);
  const thresholdTitleLabel = formatScoreDisplay(event.threshold, 3);
  if (!Number.isFinite(gap)) {
    return {
      sentence: `Selected score was unavailable for the ${thresholdLabel} viability gate.`,
      contributor: {
        label: 'threshold comparison unavailable',
        title: `selected score ${scoreLabel} vs threshold ${thresholdTitleLabel}`,
      },
    };
  }
  if (gap >= 0) {
    return {
      sentence: `It cleared the ${thresholdLabel} viability gate by ${formatScoreDisplay(gap)}.`,
      contributor: {
        label: `cleared threshold ${formatScoreDisplay(gap)}`,
        title: `selected score ${scoreLabel} vs threshold ${thresholdTitleLabel}`,
      },
    };
  }
  const absGap = Math.abs(gap);
  return {
    sentence: `It fell below the ${thresholdLabel} viability gate by ${formatScoreDisplay(absGap)}; classifier picked the highest score.`,
    contributor: {
      label: `below threshold ${formatScoreDisplay(absGap)}`,
      title: `selected score ${scoreLabel} vs threshold ${thresholdTitleLabel}`,
    },
  };
}

export function routeEventTimeLabelAt(timestamp: string, nowMs = Date.now()): string {
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time)) return 'time unknown';
  const elapsedMs = nowMs - time;
  if (elapsedMs < 0) return new Date(time).toLocaleString();
  const elapsedMinutes = Math.floor(elapsedMs / 60_000);
  if (elapsedMinutes < 1) return 'just now';
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) return `${elapsedDays}d ago`;
  return new Date(time).toLocaleDateString();
}

export function buildRoutingEventTraceChips(event: RoutingEvent, nowMs = Date.now()): RoutingEventTraceChip[] {
  const datasetIsBenchmark = event.datasetKind === 'benchmark';
  const chips: RoutingEventTraceChip[] = [
    { label: routingEventDecisionLabel(event) },
    { label: `classifier: ${autoRouterClassifierLabel({ classifierModel: event.classifierModel, fallback: event.wasFallback })}` },
  ];
  const thresholdChip = thresholdTraceChip(event);
  if (thresholdChip) chips.push(thresholdChip);
  const runChip = runIdTraceChip(event);
  if (runChip) chips.push(runChip);
  const requestDuration = buildRoutingEventRequestDuration(event);
  if (requestDuration) {
    chips.push({
      label: requestDuration.label,
      title: 'Measured model request duration captured from the linked run trace.',
    });
    if (requestDuration.slow) {
      chips.push({
        label: 'slow request',
        title: `Model request exceeded the ${formatModelRequestDurationMs(requestDuration.thresholdMs)} slow threshold.`,
      });
    }
  }
  if (event.wasCached) chips.push({ label: 'cached' });
  if (event.wasFallback) chips.push({ label: 'fallback used' });
  chips.push({
    label: datasetIsBenchmark ? 'benchmark data' : 'production data',
    title: datasetIsBenchmark
      ? 'Benchmark events are preserved but excluded from production learning summaries.'
      : 'Production routing event.',
  });
  chips.push({
    label: routeEventTimeLabelAt(event.timestamp, nowMs),
    title: routeEventExactTimeLabel(event.timestamp),
  });
  return chips;
}

export function buildRoutingEventDecisionExplanation(event: RoutingEvent, scores = sortedCandidateScores(event.candidateScores)): RoutingEventDecisionExplanation {
  const selectedScore = event.candidateScores?.[event.selectedModel] ?? event.score;
  const closestAlternative = scores.find(([model]) => model !== event.selectedModel);
  const contributors: RoutingEventTraceChip[] = [];
  const policyChip = decisionPolicyChip(event);

  if (event.wasFallback) {
    contributors.push({ label: 'fallback used', title: 'Default fallback' });
    if (!closestAlternative) {
      return {
        reason: 'Default fallback',
        detail: 'No candidate scores were recorded for this fallback route.',
        contributors,
      };
    }
    const [altModel, altScore] = closestAlternative;
    contributors.push({
      label: `top score ${formatScoreDisplay(altScore)}`,
      title: `${altModel} scored above ${event.selectedModel}`,
    });
    if (policyChip) contributors.push(policyChip);
    return {
      reason: 'Fallback over scored alternative',
      detail: `Default fallback selected ${event.selectedModel} while ${altModel} scored ${formatScoreDisplay(altScore)}.`,
      contributors,
    };
  }

  if (!closestAlternative) {
    if (policyChip) contributors.push(policyChip);
    return {
      reason: routingEventDecisionLabel(event),
      detail: `Selected ${event.selectedModel} with no scored alternatives.`,
      contributors,
    };
  }

  const [altModel, altScore] = closestAlternative;
  const scoreGap = selectedScore - altScore;
  const thresholdContext = thresholdDecisionContext(event, selectedScore);
  const scoreGapLabel = formatScoreDisplay(scoreGap);
  contributors.push({
    label: `score gap ${scoreGapLabel}`,
    title: `${event.selectedModel} ${formatScoreDisplay(selectedScore, 3)} vs ${altModel} ${formatScoreDisplay(altScore, 3)}`,
  });
  if (thresholdContext) contributors.push(thresholdContext.contributor);
  if (policyChip) contributors.push(policyChip);

  if (Number.isFinite(scoreGap) && Math.abs(scoreGap) <= 0.02 && event.modelSelectionPolicy === 'classifier') {
    return {
      reason: 'Close classifier race',
      detail: [
        `Classifier decision chose ${event.selectedModel} with a ${scoreGapLabel} score gap over ${altModel}.`,
        thresholdContext?.sentence,
      ].filter(Boolean).join(' '),
      contributors,
    };
  }

  const policyShort = routingEventDecisionLabel(event)
    .replace(/\s+(selection|decision)$/i, '');
  return {
    reason: `${policyShort} won`,
    detail: [
      `${routingEventDecisionLabel(event)} chose ${event.selectedModel} with a ${scoreGapLabel} score gap over ${altModel}.`,
      thresholdContext?.sentence,
    ].filter(Boolean).join(' '),
    contributors,
  };
}

export function formatRoutingEventTraceSummary(event: RoutingEvent, nowMs = Date.now()): string {
  return buildRoutingEventTraceChips(event, nowMs).map((chip) => chip.label).join('; ');
}

function buildRouteMarginSummary(event: RoutingEvent, scores: Array<[string, number]>): string {
  if (scores.length === 0) return candidateScoresUnavailableLabel({ fallback: event.wasFallback });
  const selectedScore = event.candidateScores?.[event.selectedModel] ?? event.score;
  const closest = scores.find(([model]) => model !== event.selectedModel);
  if (!closest) return `Selected ${event.selectedModel} with no scored alternatives.`;
  const [altModel, altScore] = closest;
  const margin = selectedScore - altScore;
  if (!Number.isFinite(margin)) {
    return `Score margin unavailable for ${event.selectedModel}; top scored alternative was ${altModel} at ${formatScoreDisplay(altScore)}.`;
  }
  if (margin >= 0) return `Selected by ${formatScoreDisplay(margin)} over ${altModel}.`;
  return `Fallback selected ${event.selectedModel}; top scored alternative was ${altModel} at ${formatScoreDisplay(altScore)}.`;
}

export function buildRoutingEventViewModel(event: RoutingEvent, nowMs = Date.now(), scoreLimit = 4): RoutingEventViewModel {
  const scores = sortedCandidateScores(event.candidateScores);
  const topScores = typeof scoreLimit === 'number' ? scores.slice(0, scoreLimit) : scores;
  const traceChips = buildRoutingEventTraceChips(event, nowMs);
  const requestDuration = buildRoutingEventRequestDuration(event);
  return {
    topScores,
    traceChips,
    traceSummary: traceChips.map((chip) => chip.label).join('; '),
    decisionExplanation: buildRoutingEventDecisionExplanation(event, scores),
    marginSummary: buildRouteMarginSummary(event, topScores),
    requestDuration,
  };
}

export function buildRoutingEventEvidenceView(event: RoutingEvent, nowMs = Date.now(), outcomeNote?: string): RoutingEventEvidenceView {
  return {
    ...buildRoutingEventViewModel(event, nowMs),
    event,
    outcomeNote,
    scoreEvidenceKey: buildRoutingEventScoreEvidenceKey(event),
    scoreEvidenceReadiness: buildRoutingEventReplayReadiness(event),
  };
}

export function buildRoutingEventDisplayWindow<T>(
  events: readonly T[],
  requestedLimit = RECENT_EVENT_BATCH_SIZE,
): RoutingEventDisplayWindow<T> {
  const safeLimit = Number.isFinite(requestedLimit)
    ? Math.min(MAX_RECENT_EVENT_DISPLAY_LIMIT, Math.max(RECENT_EVENT_BATCH_SIZE, Math.floor(requestedLimit)))
    : RECENT_EVENT_BATCH_SIZE;
  const displayedEvents = events.slice(0, safeLimit);
  const hiddenCount = Math.max(0, events.length - displayedEvents.length);
  const remainingWindowCapacity = Math.max(0, MAX_RECENT_EVENT_DISPLAY_LIMIT - displayedEvents.length);
  const nextCount = Math.min(RECENT_EVENT_BATCH_SIZE, hiddenCount, remainingWindowCapacity);
  const canShowMore = nextCount > 0;
  return {
    events: displayedEvents,
    limit: safeLimit,
    hiddenCount,
    nextCount,
    canShowMore,
    canShowFewer: safeLimit > RECENT_EVENT_BATCH_SIZE && events.length > RECENT_EVENT_BATCH_SIZE,
    reachedLimit: hiddenCount > 0 && !canShowMore,
  };
}

export function routeEventIsStaleAt(timestamp: string, nowMs = Date.now()): boolean {
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time)) return true;
  return nowMs - time > STALE_ROUTE_EVENT_MS;
}

export function buildRoutingLearningRecentDecisionState({
  events,
  outcomeNotes,
  filters,
  nowMs = Date.now(),
}: BuildRoutingLearningRecentDecisionStateOptions): RoutingLearningRecentDecisionState {
  const latestEvent = events[0] || null;
  const latestScores = sortedCandidateScores(latestEvent?.candidateScores, 3);
  const fallbackEvents: RoutingEvent[] = [];
  const ratedFallbackEvents: RoutingEvent[] = [];
  const visibleRecentEvents: RoutingEvent[] = [];
  let notedEventCount = 0;
  let unexplainedEventCount = 0;
  let unratedEventCount = 0;
  let staleEventCount = 0;
  let benchmarkEventCount = 0;
  let scanDestinationEventCount = 0;
  let scanDestinationUnratedEventCount = 0;
  let scanDestinationFallbackEventCount = 0;
  let scanDestinationRatedFallbackEventCount = 0;
  let scanDestinationStaleEventCount = 0;
  let scanDestinationReplayGapEventCount = 0;
  const replayReadinessCounts: Record<RoutingEventReplayReadiness['status'], number> = {
    ready: 0,
    partial: 0,
    missing: 0,
  };

  for (const event of events) {
    const hasNote = (outcomeNotes[event.id] || event.outcomeNote || '').trim().length > 0;
    const needsOutcome = routingEventNeedsOutcome(event);
    const isStale = routeEventIsStaleAt(event.timestamp, nowMs);
    const isBenchmark = event.datasetKind === 'benchmark';
    const matchesPolicy = matchesRoutingPolicyFilter(event, filters.policyFilter);
    const replayReadiness = buildRoutingEventReplayReadiness(event);
    const hasReplayEvidenceGap = replayReadiness.status !== 'ready';
    replayReadinessCounts[replayReadiness.status] += 1;

    if (event.wasFallback) {
      fallbackEvents.push(event);
      if (event.outcome !== null) ratedFallbackEvents.push(event);
    }
    if (hasNote) {
      notedEventCount += 1;
    } else {
      unexplainedEventCount += 1;
    }
    if (needsOutcome) unratedEventCount += 1;
    if (isStale) staleEventCount += 1;
    if (isBenchmark) benchmarkEventCount += 1;
    if (matchesPolicy) {
      scanDestinationEventCount += 1;
      if (needsOutcome) scanDestinationUnratedEventCount += 1;
      if (event.wasFallback) {
        scanDestinationFallbackEventCount += 1;
        if (event.outcome !== null) scanDestinationRatedFallbackEventCount += 1;
      }
      if (isStale) scanDestinationStaleEventCount += 1;
      if (hasReplayEvidenceGap) scanDestinationReplayGapEventCount += 1;
    }

    const matchesUnexplained = !filters.showUnexplainedOnly || !hasNote;
    const matchesUnrated = !filters.showUnratedOnly || needsOutcome;
    const matchesStale = !filters.showStaleOnly || isStale;
    const matchesFallback = !filters.showFallbackOnly || event.wasFallback;
    const matchesBenchmark = !filters.showBenchmarkOnly || isBenchmark;
    const matchesEvidenceGaps = !filters.showEvidenceGapsOnly || hasReplayEvidenceGap;
    if (
      matchesUnexplained
      && matchesUnrated
      && matchesStale
      && matchesFallback
      && matchesBenchmark
      && matchesEvidenceGaps
      && matchesPolicy
    ) {
      visibleRecentEvents.push(event);
    }
  }

  return {
    latestEvent,
    latestScores,
    fallbackEvents,
    ratedFallbackEvents,
    notedEventCount,
    latestEventAge: latestEvent ? routeEventTimeLabelAt(latestEvent.timestamp, nowMs) : 'No route yet',
    latestEventIsStale: !latestEvent || routeEventIsStaleAt(latestEvent.timestamp, nowMs),
    unexplainedEventCount,
    unratedEventCount,
    staleEventCount,
    benchmarkEventCount,
    productionEventCount: events.length - benchmarkEventCount,
    replayReadinessCounts,
    replayGapEventCount: replayReadinessCounts.partial + replayReadinessCounts.missing,
    policyFilterCounts: buildRoutingPolicyFilterCounts(events),
    scanDestinationEventCount,
    scanDestinationUnratedEventCount,
    scanDestinationFallbackEventCount,
    scanDestinationRatedFallbackEventCount,
    scanDestinationStaleEventCount,
    scanDestinationReplayGapEventCount,
    visibleRecentEvents,
  };
}

export function buildRoutingDecisionScanCards(state: RoutingLearningRecentDecisionState): RoutingDecisionScanCard[] {
  if (!state.latestEvent) {
    return [{
      id: 'latest',
      label: 'Latest route',
      value: 'None',
      detail: 'No routing decisions recorded yet.',
      tone: 'muted',
      filterTarget: null,
    }];
  }

  const total = state.benchmarkEventCount + state.productionEventCount;
  const unratedCount = state.scanDestinationUnratedEventCount;
  const unratedVerb = unratedCount === 1 ? 'needs' : 'need';
  return [
    {
      id: 'latest',
      label: 'Latest route',
      value: state.latestEvent.selectedModel,
      detail: `${state.latestEventAge} · ${routingEventDecisionLabel(state.latestEvent)} · ${routingOutcomeLabel(state.latestEvent.outcome)}`,
      tone: state.latestEventIsStale ? 'warning' : 'ok',
      filterTarget: null,
    },
    {
      id: 'unrated',
      label: 'Needs outcome',
      value: String(unratedCount),
      detail: `${unratedCount} of ${state.scanDestinationEventCount} loaded decision${state.scanDestinationEventCount === 1 ? '' : 's'} still ${unratedVerb} Worked, Failed, or Unclear.`,
      tone: unratedCount > 0 ? 'warning' : 'ok',
      filterTarget: 'needs-outcome',
    },
    {
      id: 'fallbacks',
      label: 'Fallbacks',
      value: String(state.scanDestinationFallbackEventCount),
      detail: `${state.scanDestinationRatedFallbackEventCount} fallback decision${state.scanDestinationRatedFallbackEventCount === 1 ? '' : 's'} already rated.`,
      tone: state.scanDestinationFallbackEventCount > state.scanDestinationRatedFallbackEventCount ? 'warning' : 'muted',
      filterTarget: 'fallbacks',
    },
    {
      id: 'evidence-gaps',
      label: 'Evidence gaps',
      value: String(state.scanDestinationReplayGapEventCount),
      detail: `${state.scanDestinationReplayGapEventCount} of ${state.scanDestinationEventCount} loaded decision${state.scanDestinationEventCount === 1 ? '' : 's'} ${state.scanDestinationReplayGapEventCount === 1 ? 'is' : 'are'} missing score or prompt replay evidence.`,
      tone: state.scanDestinationReplayGapEventCount > 0 ? 'warning' : 'ok',
      filterTarget: 'evidence-gaps',
    },
    {
      id: 'stale',
      label: 'Stale routes',
      value: String(state.scanDestinationStaleEventCount),
      detail: `${state.scanDestinationStaleEventCount} loaded decision${state.scanDestinationStaleEventCount === 1 ? '' : 's'} older than 7 days.`,
      tone: state.scanDestinationStaleEventCount > 0 ? 'warning' : 'ok',
      filterTarget: 'stale',
    },
    {
      id: 'dataset',
      label: 'Data mix',
      value: `${state.productionEventCount}/${state.benchmarkEventCount}`,
      detail: `${state.productionEventCount} production and ${state.benchmarkEventCount} benchmark decision${total === 1 ? '' : 's'} loaded.`,
      tone: 'muted',
      filterTarget: null,
    },
  ];
}
