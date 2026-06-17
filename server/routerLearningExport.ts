import type { LearningSummary, RoutingEvent } from './routerLearning';
import type { ToolReliabilitySummary } from './toolReliability';
import { PROMPT_STRATEGY_PROFILES } from './promptStrategies';

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
  configuredCandidateCount: number;
  activeCandidateCount: number;
}

export interface RouterLearningExportPayload {
  schemaVersion: 1;
  generatedAt: string;
  routerEvidenceFreshness: RouterEvidenceFreshness;
  promptStrategyBestPractices: RouterLearningPromptStrategyBestPractice[];
  summary: LearningSummary & { toolReliability: ToolReliabilitySummary };
  eventCount: number;
  productionEventCount: number;
  benchmarkEventCount: number;
  events: RoutingEvent[];
}

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
    configuredCandidateCount: number;
    candidateCount: number;
  };
}): RouterLearningExportPayload {
  const benchmarkEventCount = events.filter((event) => event.datasetKind === 'benchmark').length;
  return {
    schemaVersion: 1,
    generatedAt,
    routerEvidenceFreshness: {
      enabled: routerState.enabled,
      candidateEvidenceRefreshedAt: routerState.candidateEvidenceRefreshedAt,
      candidateEvidenceRefreshCount: routerState.candidateEvidenceRefreshCount,
      configuredCandidateCount: routerState.configuredCandidateCount,
      activeCandidateCount: routerState.candidateCount,
    },
    promptStrategyBestPractices: promptStrategyBestPracticesForEvents(events),
    summary: {
      ...learningSummary,
      toolReliability: normalizeToolReliabilityForExport(toolReliability),
    },
    eventCount: events.length,
    productionEventCount: events.length - benchmarkEventCount,
    benchmarkEventCount,
    events,
  };
}
