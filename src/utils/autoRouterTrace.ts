import type { HarnessRunStep, Message } from '../types';
import { formatScoreDisplay } from './scoreDisplay';

export type AutoRouterStep = Extract<HarnessRunStep, { type: 'auto_router' }>;
export type RoutingOutcome = 'success' | 'failure' | 'ambiguous' | null;

export interface RoutingTraceEventLike {
  selectedModel: string;
  score: number;
  candidateScores?: Record<string, number>;
  wasFallback: boolean;
  wasCached: boolean;
  modelSelectionPolicy?: string;
  classifierModel?: string | null;
}

export const AUTO_ROUTER_LABEL = 'Auto-Router';
export const ROUTING_FEEDBACK_GUIDANCE = 'Mark this route as Worked, Failed, or Unclear in Routing Learning.';
export const AUTO_ROUTER_TIED_SCORE_GAP = 0.005;
export const AUTO_ROUTER_CLOSE_SCORE_GAP = 0.02;

export interface AutoRouterScoreMarginCue {
  label: string;
  ariaLabel: string;
  comparisonModel: string;
  margin: number;
  tone: 'neutral' | 'warning';
}

export interface AutoRouterConfidenceCue {
  label: string;
  ariaLabel: string;
  verdict: 'decisive' | 'close' | 'tied' | 'override' | 'fallback' | 'insufficient';
  tone: 'neutral' | 'warning' | 'muted';
}

export interface AutoRouterPolicyEvidenceRow {
  id: 'cheap-direct' | 'classifier' | 'escalated' | 'unknown';
  label: string;
  evidence: string;
  impact: string;
}

export function routingOutcomeLabel(outcome: RoutingOutcome): string {
  if (outcome === 'success') return 'Worked';
  if (outcome === 'failure') return 'Failed';
  if (outcome === 'ambiguous') return 'Unclear';
  return 'Needs review';
}

export function routingOutcomeHelp(outcome: RoutingOutcome): string {
  if (outcome === 'success') return 'The selected model handled this route well.';
  if (outcome === 'failure') return 'The selected model was the wrong fit or failed the task.';
  if (outcome === 'ambiguous') return 'The result needs judgment before it should count as a win or loss.';
  return ROUTING_FEEDBACK_GUIDANCE;
}

export function sortedCandidateScores(scores?: Record<string, number>, limit?: number): Array<[string, number]> {
  const entries = Object.entries(scores || {})
    .filter(([, score]) => Number.isFinite(score))
    .sort((a, b) => b[1] - a[1]);
  return typeof limit === 'number' ? entries.slice(0, limit) : entries;
}

export function autoRouterDecisionLabel(input: { fallback?: boolean; cached?: boolean; modelSelectionPolicy?: string }): string {
  if (input.fallback) return 'Default fallback';
  if (input.modelSelectionPolicy === 'cheap-direct') return 'Cheap direct selection';
  if (input.modelSelectionPolicy === 'escalated') return 'Escalated selection';
  return input.cached ? 'Cached classifier decision' : 'Classifier decision';
}

export function autoRouterClassifierLabel(input: { classifierModel?: string | null; fallback?: boolean }): string {
  if (input.classifierModel) return input.classifierModel;
  return input.fallback ? 'unavailable' : 'skipped';
}

export function candidateScoresUnavailableLabel(input?: { fallback?: boolean }): string {
  return input?.fallback ? 'No candidate scores for this fallback' : 'Candidate scores unavailable';
}

export function formatAutoRouterScoreList(scores?: Record<string, number>, limit = 5): string {
  const entries = sortedCandidateScores(scores, limit);
  if (entries.length === 0) return candidateScoresUnavailableLabel();
  return entries.map(([model, score]) => `${model}: ${formatScoreDisplay(score)}`).join('\n');
}

export function autoRouterScoreMarginCue(input: { modelId: string; score: number; candidateScores?: Record<string, number>; fallback?: boolean }): AutoRouterScoreMarginCue | null {
  if (input.fallback || !Number.isFinite(input.score)) return null;
  const selectedCandidateScore = input.candidateScores?.[input.modelId];
  if (typeof selectedCandidateScore !== 'number' || !Number.isFinite(selectedCandidateScore)) return null;

  const comparison = sortedCandidateScores(input.candidateScores)
    .find(([model]) => model !== input.modelId);
  if (!comparison) return null;

  const [comparisonModel, comparisonScore] = comparison;
  const margin = Number((selectedCandidateScore - comparisonScore).toFixed(2));
  const marginLabel = formatScoreDisplay(margin);
  const absMarginLabel = formatScoreDisplay(Math.abs(margin));

  // Compare after display rounding so the confidence verdict matches the visible score gap.
  if (Math.abs(margin) < AUTO_ROUTER_TIED_SCORE_GAP) {
    return {
      label: `Tied with ${comparisonModel}`,
      ariaLabel: `Auto-Router selected ${input.modelId}; alternative ${comparisonModel} tied its classifier score.`,
      comparisonModel,
      margin: 0,
      tone: 'warning',
    };
  }

  if (margin < 0) {
    return {
      label: `${comparisonModel} scored ${absMarginLabel} higher`,
      ariaLabel: `Auto-Router selected ${input.modelId}, but highest-scoring alternative ${comparisonModel} scored ${absMarginLabel} score points higher.`,
      comparisonModel,
      margin,
      tone: 'warning',
    };
  }

  const tone: AutoRouterScoreMarginCue['tone'] = margin <= AUTO_ROUTER_CLOSE_SCORE_GAP ? 'warning' : 'neutral';
  return {
    label: `Selected over ${comparisonModel} by ${marginLabel}`,
    ariaLabel: `Auto-Router selected ${input.modelId} over next-best alternative ${comparisonModel} by ${marginLabel} score points.`,
    comparisonModel,
    margin,
    tone,
  };
}

export function autoRouterConfidenceCue(input: {
  modelId: string;
  score: number;
  candidateScores?: Record<string, number>;
  fallback?: boolean;
  cached?: boolean;
}): AutoRouterConfidenceCue {
  const cachedSuffix = input.cached ? ' · cached' : '';
  const cachedSentence = input.cached ? ' Decision came from cached routing evidence.' : '';

  if (input.fallback) {
    return {
      label: `Fallback route${cachedSuffix}`,
      ariaLabel: `Routing confidence: fallback route. Auto-Router used the default fallback; candidate confidence is unavailable.${cachedSentence}`,
      verdict: 'fallback',
      tone: 'warning',
    };
  }

  if (!Number.isFinite(input.score)) {
    return {
      label: `Insufficient evidence${cachedSuffix}`,
      ariaLabel: `Routing confidence: insufficient evidence. Candidate scores are unavailable or incomplete.${cachedSentence}`,
      verdict: 'insufficient',
      tone: 'muted',
    };
  }

  const selectedCandidateScore = input.candidateScores?.[input.modelId];
  if (typeof selectedCandidateScore !== 'number' || !Number.isFinite(selectedCandidateScore)) {
    return {
      label: `Insufficient evidence${cachedSuffix}`,
      ariaLabel: `Routing confidence: insufficient evidence. Candidate scores are unavailable or incomplete.${cachedSentence}`,
      verdict: 'insufficient',
      tone: 'muted',
    };
  }

  const comparison = sortedCandidateScores(input.candidateScores)
    .find(([model]) => model !== input.modelId);
  if (!comparison) {
    return {
      label: `Insufficient evidence${cachedSuffix}`,
      ariaLabel: `Routing confidence: insufficient evidence. Candidate scores are unavailable or incomplete.${cachedSentence}`,
      verdict: 'insufficient',
      tone: 'muted',
    };
  }

  const [comparisonModel, comparisonScore] = comparison;
  const margin = Number((selectedCandidateScore - comparisonScore).toFixed(2));
  const marginLabel = formatScoreDisplay(margin);
  const absMarginLabel = formatScoreDisplay(Math.abs(margin));

  if (Math.abs(margin) < AUTO_ROUTER_TIED_SCORE_GAP) {
    return {
      label: `Tied route${cachedSuffix}`,
      ariaLabel: `Routing confidence: tied route. ${input.modelId} tied ${comparisonModel} on classifier score.${cachedSentence}`,
      verdict: 'tied',
      tone: 'warning',
    };
  }

  if (margin < 0) {
    return {
      label: `Policy override${cachedSuffix}`,
      ariaLabel: `Routing confidence: policy override. ${comparisonModel} scored ${absMarginLabel} above selected model ${input.modelId}.${cachedSentence}`,
      verdict: 'override',
      tone: 'warning',
    };
  }

  if (margin <= AUTO_ROUTER_CLOSE_SCORE_GAP) {
    return {
      label: `Close route${cachedSuffix}`,
      ariaLabel: `Routing confidence: close route. ${input.modelId} led ${comparisonModel} by ${marginLabel} score points.${cachedSentence}`,
      verdict: 'close',
      tone: 'warning',
    };
  }

  return {
    label: `Decisive route${cachedSuffix}`,
    ariaLabel: `Routing confidence: decisive route. ${input.modelId} led ${comparisonModel} by ${marginLabel} score points.${cachedSentence}`,
    verdict: 'decisive',
    tone: 'neutral',
  };
}

export function autoRouterScoreMarginSummary(input: { modelId: string; score: number; candidateScores?: Record<string, number>; fallback?: boolean }): string | null {
  if (input.fallback || !Number.isFinite(input.score)) return null;
  const selectedCandidateScore = input.candidateScores?.[input.modelId];
  if (typeof selectedCandidateScore !== 'number' || !Number.isFinite(selectedCandidateScore)) return null;

  const nearestAlternative = sortedCandidateScores(input.candidateScores)
    .filter(([model]) => model !== input.modelId)[0];
  if (!nearestAlternative) return null;

  const [model, score] = nearestAlternative;
  const gap = Number((selectedCandidateScore - score).toFixed(2));
  const gapLabel = formatScoreDisplay(gap);
  const absGapLabel = formatScoreDisplay(Math.abs(gap));
  if (Math.abs(gap) < AUTO_ROUTER_TIED_SCORE_GAP) {
    return `Tied with ${model}.`;
  }
  if (gap < 0) {
    return `${model} scored ${absGapLabel} above ${input.modelId}.`;
  }
  if (gap <= AUTO_ROUTER_CLOSE_SCORE_GAP) {
    return `Close classifier race; ${model} trailed ${input.modelId} by ${gapLabel}.`;
  }
  return `${input.modelId} led ${model} by ${gapLabel}.`;
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

function roundedNonNegativeEstimate(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : null;
}

function routeSignalEvidence(step: AutoRouterStep): string {
  const signal = step.stages?.signal;
  const heuristic = step.stages?.heuristic;
  const parts: string[] = [];
  const turns = nonNegativeInteger(signal?.turns);
  const toolCount = nonNegativeInteger(signal?.toolCount);
  const estimatedInputTokens = roundedNonNegativeEstimate(signal?.estimatedInputTokens);

  if (heuristic) parts.push(`${heuristic.complexity} ${heuristic.mode} request`);
  if (signal?.hasImages === false && step.stages?.modelSelectionPolicy === 'cheap-direct') parts.push('no images');
  if (turns !== null) parts.push(`${turns} turn${turns === 1 ? '' : 's'}`);
  if (toolCount !== null) parts.push(`${toolCount} tool${toolCount === 1 ? '' : 's'}`);
  if (estimatedInputTokens !== null) parts.push(`about ${estimatedInputTokens} input tokens`);
  if (signal?.dirtyGitState) parts.push('dirty git state');
  if (signal?.requiresStrongToolUse) parts.push('strong tool use');
  if (signal?.thinkingEffort) parts.push(`${signal.thinkingEffort} thinking`);

  return parts.length > 0 ? parts.join('; ') : step.stages?.policy || step.reason;
}

export function autoRouterPolicyEvidence(step: AutoRouterStep): AutoRouterPolicyEvidenceRow[] {
  const policy = step.stages?.modelSelectionPolicy;
  if (policy === 'cheap-direct') {
    return [{
      id: 'cheap-direct',
      label: 'Cheap direct policy',
      evidence: routeSignalEvidence(step),
      impact: 'Skipped classifier and chose the cheapest viable candidate.',
    }];
  }
  if (policy === 'escalated') {
    return [{
      id: 'escalated',
      label: 'Escalation policy',
      evidence: routeSignalEvidence(step),
      impact: 'Skipped classifier and chose the strongest suitable candidate.',
    }];
  }
  if (policy === 'classifier') {
    return [{
      id: 'classifier',
      label: 'Classifier policy',
      evidence: routeSignalEvidence(step),
      impact: 'Ran classifier scoring before cost-aware model selection.',
    }];
  }
  if (!step.stages?.policy && !step.stages?.signal && !step.stages?.heuristic) return [];
  return [{
    id: 'unknown',
    label: 'Routing policy',
    evidence: routeSignalEvidence(step),
    impact: 'Used available route-stage metadata to explain this decision.',
  }];
}

export function formatAutoRouterStepTitle(step: AutoRouterStep): string {
  return `${AUTO_ROUTER_LABEL} · ${step.modelId} (${formatScoreDisplay(step.score)})`;
}

export function autoRouterClassifierTimeoutCue(step: AutoRouterStep): string | null {
  const match = step.reason.match(/classifier error \(([^)]+)\)/i);
  if (!match) return null;
  const fields = match[1].split(',').map((field) => field.trim()).filter(Boolean);
  if (!fields.some((field) => /^slow-model$/i.test(field))) return null;
  const timeoutMsText = fields.find((field) => /^\d+ms$/i.test(field));
  const label = fields.find((field) => !/^slow-model$/i.test(field) && !/^\d+ms$/i.test(field));
  if (!timeoutMsText || !label) return null;
  const timeoutMs = Number(timeoutMsText.replace(/ms$/i, ''));
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return null;
  const timeoutSeconds = Math.round(timeoutMs / 1000);
  return `Classifier timeout: ${label.trim()} · ${timeoutSeconds}s bounded wait`;
}

export function formatAutoRouterStepDetail(step: AutoRouterStep): string {
  const parts = [
    autoRouterDecisionLabel({
      fallback: step.fallback,
      cached: step.cached,
      modelSelectionPolicy: step.stages?.modelSelectionPolicy,
    }),
    `classifier: ${autoRouterClassifierLabel({ classifierModel: step.classifierModel, fallback: step.fallback })}`,
  ];
  if (step.cached) parts.push('cached');
  const timeoutCue = autoRouterClassifierTimeoutCue(step);
  return `${parts.join(' · ')}\n${[timeoutCue, step.reason, ROUTING_FEEDBACK_GUIDANCE].filter(Boolean).join('\n')}`;
}

export function describeAutoRouterRunStep(step: AutoRouterStep): string {
  const verb = step.fallback ? 'used default fallback' : 'selected';
  const cacheText = step.cached ? ' from cached routing evidence' : '';
  return `${AUTO_ROUTER_LABEL} ${verb} ${step.modelId}${cacheText}. Details are in Routing Learning.`;
}

export function autoRouterStepTraceText(step: AutoRouterStep): string {
  const scores = sortedCandidateScores(step.candidateScores);
  const scoreMarginSummary = autoRouterScoreMarginSummary(step);
  const confidenceCue = autoRouterConfidenceCue(step);
  const policyEvidence = autoRouterPolicyEvidence(step);
  const scoreText = formatScoreDisplay(step.score);
  return [
    `Selected model: ${step.modelId}`,
    `Decision: ${autoRouterDecisionLabel({
      fallback: step.fallback,
      cached: step.cached,
      modelSelectionPolicy: step.stages?.modelSelectionPolicy,
    })}`,
    `Routing confidence: ${confidenceCue.label}`,
    `Score: ${scoreText}`,
    scoreMarginSummary ? `Score margin: ${scoreMarginSummary}` : '',
    autoRouterClassifierTimeoutCue(step) || '',
    `Reason: ${step.reason}`,
    `Classifier: ${autoRouterClassifierLabel({ classifierModel: step.classifierModel, fallback: step.fallback })}`,
    policyEvidence.length > 0
      ? `Policy evidence:\n${policyEvidence.map((row) => `${row.id} — ${row.evidence}. ${row.impact}`).join('\n')}`
      : '',
    scores.length > 0
      ? `Candidate scores:\n${scores.map(([model, score]) => `${model}: ${formatScoreDisplay(score)}`).join('\n')}`
      : `Candidate scores: ${candidateScoresUnavailableLabel({ fallback: step.fallback })}`,
    `Feedback: ${ROUTING_FEEDBACK_GUIDANCE}`,
  ].filter(Boolean).join('\n');
}

export function routingEventDecisionLabel(event: RoutingTraceEventLike): string {
  return autoRouterDecisionLabel({
    fallback: event.wasFallback,
    cached: event.wasCached,
    modelSelectionPolicy: event.modelSelectionPolicy,
  });
}

export function latestAutoRouterStep(messages: Pick<Message, 'runTrace'>[]): AutoRouterStep | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const steps = messages[i].runTrace?.steps || [];
    for (let j = steps.length - 1; j >= 0; j -= 1) {
      const step = steps[j];
      if (step.type === 'auto_router') return step;
    }
  }
  return null;
}
