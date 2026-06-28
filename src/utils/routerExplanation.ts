import type { HarnessRunStep } from '../types';
import type { ModelCatalogCard } from '../data/modelCatalog';
import { findModelCatalogCard, modelCatalogFreshness } from '../data/modelCatalog';
import { autoRouterClassifierLabel, autoRouterDecisionLabel, autoRouterPolicyEvidence, autoRouterScoreMarginSummary, candidateScoresUnavailableLabel, sortedCandidateScores, type AutoRouterPolicyEvidenceRow } from './autoRouterTrace';
import { formatScoreDisplay } from './scoreDisplay';

type AutoRouterStep = Extract<HarnessRunStep, { type: 'auto_router' }>;

export interface RouterCostLatencySignal {
  catalogStatus: 'available' | 'missing';
  costLabel: string;
  routerWeightLabel: string;
  speedLabel: 'Fast' | 'Mixed' | 'Slower' | 'Unknown';
  freshnessLabel: string;
  freshnessStatus: 'fresh' | 'stale' | 'advisory' | 'unverified' | 'unknown';
}

export interface RouterExplanationAlternative {
  model: string;
  score: number;
  reason: string;
  signal: RouterCostLatencySignal;
}

export interface RouterExplanation {
  selectedModel: string;
  selectedScore: number;
  decision: string;
  selectionSummary: string;
  selectionReason: string;
  summary: string;
  classifier: string;
  policy: string;
  policyEvidence: AutoRouterPolicyEvidenceRow[];
  thresholdSummary: string | null;
  selectedSignal: RouterCostLatencySignal;
  alternatives: RouterExplanationAlternative[];
}

function policyGateLabel(step: AutoRouterStep): string {
  if (step.stages?.modelSelectionPolicy === 'cheap-direct') return 'cost gate';
  if (step.stages?.modelSelectionPolicy === 'escalated') return 'escalation policy';
  if (step.cached) return 'cached decision';
  return 'policy gate';
}

function alternativeReason(score: number, selectedScore: number, gate: string): string {
  if (!Number.isFinite(score)) return `score unavailable; ${gate} kept the selected model.`;
  if (!Number.isFinite(selectedScore)) return `scored ${formatScoreDisplay(score)}; selected score was unavailable.`;
  const delta = score - selectedScore;
  if (Math.abs(delta) < 0.005) {
    return `tied the selected score; ${gate} kept the selected model.`;
  }
  if (delta > 0) {
    return `scored ${formatScoreDisplay(delta)} above selected; ${gate} kept the selected model.`;
  }
  return `lost by ${formatScoreDisplay(Math.abs(delta))} classifier score.`;
}

function summaryFor(step: AutoRouterStep, alternatives: RouterExplanationAlternative[]): string {
  if (step.fallback) {
    return `Fallback route; ${candidateScoresUnavailableLabel({ fallback: true }).toLowerCase()}.`;
  }
  if (alternatives.length === 0) {
    return `${candidateScoresUnavailableLabel()} for this route, so no rejected alternatives can be ranked.`;
  }
  if (!Number.isFinite(step.score)) {
    return `Selected score unavailable; candidate score evidence is incomplete for ${step.modelId}.`;
  }
  const higherScore = alternatives.find((alt) => alt.score > step.score);
  if (higherScore) {
    return `${higherScore.model} scored higher, but the final ${policyGateLabel(step)} kept ${step.modelId}.`;
  }
  const marginSummary = autoRouterScoreMarginSummary(step);
  if (marginSummary?.startsWith('Close classifier race')) return marginSummary;
  return `${step.modelId} had the strongest saved classifier score among shown candidates.`;
}

function selectionSummaryFor(step: AutoRouterStep, alternatives: RouterExplanationAlternative[]): string {
  const selected = `${step.modelId} at ${formatScoreDisplay(step.score)}`;
  if (step.fallback) {
    return `Fallback selected ${step.modelId}; classifier scores were unavailable for this route.`;
  }
  if (!Number.isFinite(step.score)) {
    return `${autoRouterDecisionLabel({
      fallback: step.fallback,
      cached: step.cached,
      modelSelectionPolicy: step.stages?.modelSelectionPolicy,
    })} selected ${step.modelId}; selected score was unavailable.`;
  }

  const higherScore = alternatives.find((alt) => alt.score > step.score);
  if (step.stages?.modelSelectionPolicy === 'cheap-direct' && higherScore) {
    return `Cost gate selected ${selected}; ${higherScore.model} would have scored ${formatScoreDisplay(higherScore.score - step.score)} higher but the cost gate kept ${step.modelId}.`;
  }

  const nearestAlternative = alternatives[0];
  if (!nearestAlternative) {
    return `${autoRouterDecisionLabel({
      fallback: step.fallback,
      cached: step.cached,
      modelSelectionPolicy: step.stages?.modelSelectionPolicy,
    })} selected ${selected}; no ranked alternatives were saved.`;
  }

  const gap = Math.abs(step.score - nearestAlternative.score);
  if (gap < 0.005) {
    return `Classifier selected ${selected}; ${nearestAlternative.model} tied the selected score.`;
  }
  if (nearestAlternative.score > step.score) {
    return `${policyGateLabel(step)} selected ${selected}; ${nearestAlternative.model} scored ${formatScoreDisplay(gap)} higher.`;
  }
  return `Classifier selected ${selected}; ${nearestAlternative.model} trailed by ${formatScoreDisplay(gap)}.`;
}

function thresholdSummaryFor(step: AutoRouterStep): string | null {
  const threshold = step.stages?.threshold;
  if (typeof threshold !== 'number' || !Number.isFinite(threshold)) return null;

  const thresholdLabel = formatScoreDisplay(threshold);
  if (step.fallback) {
    if (/all scores zero|used default model/i.test(step.reason || '')) {
      return `${thresholdLabel} viability gate · no candidate cleared; default fallback used.`;
    }
    return `${thresholdLabel} viability gate · fallback route; classifier threshold was not applied.`;
  }
  if (!Number.isFinite(step.score)) {
    return `${thresholdLabel} viability gate · selected score was unavailable.`;
  }
  const gap = step.score - threshold;
  if (gap >= 0) {
    return `${thresholdLabel} viability gate · selected score cleared by ${formatScoreDisplay(gap)}.`;
  }
  return `${thresholdLabel} viability gate · selected score fell below by ${formatScoreDisplay(Math.abs(gap))}; classifier picked highest score.`;
}

function splitModelRef(modelId: string): { providerId: string; modelId: string } {
  const separator = modelId.indexOf(':');
  if (separator <= 0) return { providerId: '', modelId };
  return { providerId: modelId.slice(0, separator), modelId: modelId.slice(separator + 1) };
}

function formatCost(card: ModelCatalogCard): string {
  if (card.inputCostPerMTok != null && card.outputCostPerMTok != null) {
    return `$${card.inputCostPerMTok}/$${card.outputCostPerMTok} per 1M tokens`;
  }
  return `${card.relativeCost} relative cost`;
}

function formatRouterWeight(card: ModelCatalogCard): string {
  return `router weight ${card.routerCost.toFixed(2).replace(/\.?0+$/, '')}`;
}

function catalogSpeedHint(card: ModelCatalogCard): RouterCostLatencySignal['speedLabel'] {
  const speedText = [
    card.displayName,
    card.compactDescription,
    card.reviewSummary,
    ...card.strengths,
    ...card.bestFor,
    ...card.benchmarkHighlights,
  ].join(' ').toLowerCase();
  if (card.routerCost <= 0.45 || /\b(speed|fast|latency|worker|flash)\b/.test(speedText)) return 'Fast';
  if (card.relativeCost === 'luxury' || card.contextWindowTokens >= 1_000_000) return 'Slower';
  return 'Mixed';
}

function catalogSignalForModel(modelId: string): RouterCostLatencySignal {
  const modelRef = splitModelRef(modelId);
  const card = findModelCatalogCard(modelRef.modelId, modelRef.providerId) || findModelCatalogCard(modelId);
  if (!card) {
    return {
      catalogStatus: 'missing',
      costLabel: 'catalog card missing',
      routerWeightLabel: 'router weight unknown',
      speedLabel: 'Unknown',
      freshnessLabel: 'freshness unknown',
      freshnessStatus: 'unknown',
    };
  }
  const freshness = modelCatalogFreshness(card);
  return {
    catalogStatus: 'available',
    costLabel: formatCost(card),
    routerWeightLabel: formatRouterWeight(card),
    speedLabel: catalogSpeedHint(card),
    freshnessLabel: freshness.label,
    freshnessStatus: freshness.status,
  };
}

export function buildRouterExplanation(step: AutoRouterStep | undefined, expanded: boolean): RouterExplanation | null {
  if (!expanded || !step) return null;

  const gate = policyGateLabel(step);
  const alternatives = sortedCandidateScores(step.candidateScores)
    .filter(([model]) => model !== step.modelId)
    .slice(0, 4)
    .map(([model, score]) => ({
      model,
      score,
      reason: alternativeReason(score, step.score, gate),
      signal: catalogSignalForModel(model),
    }));

  return {
    selectedModel: step.modelId,
    selectedScore: step.score,
    decision: autoRouterDecisionLabel({
      fallback: step.fallback,
      cached: step.cached,
      modelSelectionPolicy: step.stages?.modelSelectionPolicy,
    }),
    selectionSummary: selectionSummaryFor(step, alternatives),
    selectionReason: step.reason || 'No router reason was saved for this run.',
    summary: summaryFor(step, alternatives),
    classifier: autoRouterClassifierLabel({ classifierModel: step.classifierModel, fallback: step.fallback }),
    policy: step.stages?.policy || gate,
    policyEvidence: autoRouterPolicyEvidence(step),
    thresholdSummary: thresholdSummaryFor(step),
    selectedSignal: catalogSignalForModel(step.modelId),
    alternatives,
  };
}
