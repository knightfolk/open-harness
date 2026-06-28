import type { LearningSummary, RoutingEvent } from './routerLearning';
import type { ToolReliabilitySummary } from './toolReliability';
import type { AutoRouterThresholdAdvice } from './autoRouter';
import { PROMPT_STRATEGY_PROFILES } from './promptStrategies';
import { buildRoutingLearningActionCues } from '../shared/routingLearningActionCues';

type TunableEvidenceSource = ToolReliabilitySummary['byEvidenceSource'][number]['source'];

function tuningActionForEvidenceSource(source: TunableEvidenceSource): ToolReliabilitySummary['retryReductionRecommendations'][number]['tuningAction'] {
  if (source === 'saved_session_trace') return 'tune_local_router';
  if (source === 'log_trace') return 'review_before_tuning';
  return 'context_only';
}

function tuningGuidanceForEvidenceSource(source: TunableEvidenceSource): string {
  if (source === 'saved_session_trace') {
    return 'Local saved-session evidence: safe to use for candidate-card, prompt-contract, or cost tuning after normal review.';
  }
  if (source === 'log_trace') {
    return 'Log-derived evidence: review the originating log before changing routing defaults.';
  }
  return 'Imported evidence: context only until a reviewed merge path promotes it into local routing evidence.';
}

function normalizeToolReliabilityForExport(toolReliability: ToolReliabilitySummary): ToolReliabilitySummary {
  return {
    ...toolReliability,
    retryReductionRecommendations: toolReliability.retryReductionRecommendations.map((recommendation) => ({
      ...recommendation,
      tuningAction: recommendation.tuningAction || tuningActionForEvidenceSource(recommendation.evidenceSource),
      tuningGuidance: recommendation.tuningGuidance
        || tuningGuidanceForEvidenceSource(recommendation.evidenceSource),
    })),
  };
}

export interface RouterEvidenceFreshness {
  enabled: boolean;
  candidateEvidenceRefreshedAt: string | null;
  candidateEvidenceRefreshCount: number;
  thresholdAdvice?: AutoRouterThresholdAdvice | null;
  configuredCandidateCount: number;
  activeCandidateCount: number;
}

type RouterLearningExportSummary = LearningSummary & {
  toolReliability: ToolReliabilitySummary;
  routingActionCues: ReturnType<typeof buildRoutingLearningActionCues>;
  model_request_duration: {
    by_model: Record<string, { samples: number; avg_ms: number; slow: boolean; threshold_ms: number }>;
    by_task_type: Record<string, { samples: number; avg_ms: number; slow: boolean; threshold_ms: number }>;
  };
};

export interface RouterLearningExportPayload {
  schemaVersion: 1;
  generatedAt: string;
  routerEvidenceFreshness: RouterEvidenceFreshness;
  promptStrategyBestPractices: RouterLearningPromptStrategyBestPractice[];
  summary: RouterLearningExportSummary;
  eventCount: number;
  productionEventCount: number;
  benchmarkEventCount: number;
  events: RouterLearningExportEvent[];
}

export type RouterLearningExportEvent = RoutingEvent & {
  model_request_duration_ms: number | null;
};

export interface RouterLearningPromptStrategyBestPractice {
  strategyId: string;
  family: string;
  systemStyle: string;
  sourceRefs: string[];
  bestPracticeNotes: Array<{
    id: string;
    sourceRef: string;
    appliesTo: string[];
    guidance: string;
    rationale: string;
    evaluationCue: string;
  }>;
}

function promptStrategyBestPracticesForEvents(events: RoutingEvent[]): RouterLearningPromptStrategyBestPractice[] {
  const referencedStrategyIds = new Set(events.map((event) => event.promptStrategyId).filter((id): id is string => Boolean(id)));
  return Object.values(PROMPT_STRATEGY_PROFILES)
    .filter((profile) => referencedStrategyIds.has(profile.id))
    .map((profile) => ({
      strategyId: profile.id,
      family: profile.family,
      systemStyle: profile.systemStyle,
      sourceRefs: profile.sourceRefs,
      bestPracticeNotes: profile.bestPracticeNotes.map((note) => ({
        id: note.id,
        sourceRef: note.sourceRef,
        appliesTo: note.appliesTo,
        guidance: note.guidance,
        rationale: note.rationale,
        evaluationCue: note.evaluationCue,
      })),
    }));
}

function routingEventForExport(event: RoutingEvent): RouterLearningExportEvent {
  return {
    ...event,
    model_request_duration_ms: typeof event.modelRequestDurationMs === 'number' && Number.isFinite(event.modelRequestDurationMs)
      ? Math.round(event.modelRequestDurationMs)
      : null,
  };
}

function snakeCaseDurationBuckets(input: Record<string, { samples: number; avgMs: number; slow: boolean; thresholdMs: number }>): Record<string, { samples: number; avg_ms: number; slow: boolean; threshold_ms: number }> {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, {
      samples: value.samples,
      avg_ms: value.avgMs,
      slow: value.slow,
      threshold_ms: value.thresholdMs,
    }]),
  );
}

function modelRequestDurationForExport(summary: LearningSummary['modelRequestDuration']): RouterLearningExportSummary['model_request_duration'] {
  return {
    by_model: snakeCaseDurationBuckets(summary.byModel),
    by_task_type: snakeCaseDurationBuckets(summary.byTaskType),
  };
}

export function buildRouterLearningExportPayload({
  events,
  generatedAt = new Date().toISOString(),
  learningSummary,
  toolReliability,
  routerState,
}: {
  events: RoutingEvent[];
  generatedAt?: string;
  learningSummary: LearningSummary;
  toolReliability: ToolReliabilitySummary;
  routerState: {
    enabled: boolean;
    candidateEvidenceRefreshedAt: string | null;
    candidateEvidenceRefreshCount: number;
    thresholdAdvice?: AutoRouterThresholdAdvice | null;
    configuredCandidateCount: number;
    candidateCount: number;
  };
}): RouterLearningExportPayload {
  const benchmarkEventCount = events.filter((event) => event.datasetKind === 'benchmark').length;
  const generatedAtMs = Date.parse(generatedAt);
  const cueNowMs = Number.isFinite(generatedAtMs) ? generatedAtMs : Date.now();
  return {
    schemaVersion: 1,
    generatedAt,
    routerEvidenceFreshness: {
      enabled: routerState.enabled,
      candidateEvidenceRefreshedAt: routerState.candidateEvidenceRefreshedAt,
      candidateEvidenceRefreshCount: routerState.candidateEvidenceRefreshCount,
      thresholdAdvice: routerState.thresholdAdvice ?? null,
      configuredCandidateCount: routerState.configuredCandidateCount,
      activeCandidateCount: routerState.candidateCount,
    },
    promptStrategyBestPractices: promptStrategyBestPracticesForEvents(events),
    summary: {
      ...learningSummary,
      routingActionCues: buildRoutingLearningActionCues(learningSummary.bestByTaskType, cueNowMs),
      model_request_duration: modelRequestDurationForExport(learningSummary.modelRequestDuration),
      toolReliability: normalizeToolReliabilityForExport(toolReliability),
    },
    eventCount: events.length,
    productionEventCount: events.length - benchmarkEventCount,
    benchmarkEventCount,
    events: events.map(routingEventForExport),
  };
}
