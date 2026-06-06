import type { HarnessRunStep, Message } from '../types';

export type AutoRouterStep = Extract<HarnessRunStep, { type: 'auto_router' }>;
export type RoutingOutcome = 'success' | 'failure' | 'ambiguous' | null;

export interface RoutingTraceEventLike {
  selectedModel: string;
  score: number;
  candidateScores?: Record<string, number>;
  wasFallback: boolean;
  wasCached: boolean;
  classifierModel?: string | null;
}

export const AUTO_ROUTER_LABEL = 'Auto-Router';
export const ROUTING_FEEDBACK_GUIDANCE = 'Mark this route as Worked, Failed, or Unclear in Routing Learning.';

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

export function autoRouterDecisionLabel(input: { fallback?: boolean; cached?: boolean }): string {
  if (input.fallback) return 'Default fallback';
  return input.cached ? 'Cached classifier decision' : 'Classifier decision';
}

export function candidateScoresUnavailableLabel(input?: { fallback?: boolean }): string {
  return input?.fallback ? 'No candidate scores for this fallback' : 'Candidate scores unavailable';
}

export function formatAutoRouterScoreList(scores?: Record<string, number>, limit = 5): string {
  const entries = sortedCandidateScores(scores, limit);
  if (entries.length === 0) return candidateScoresUnavailableLabel();
  return entries.map(([model, score]) => `${model}: ${score.toFixed(2)}`).join('\n');
}

export function formatAutoRouterStepTitle(step: AutoRouterStep): string {
  return `${AUTO_ROUTER_LABEL} · ${step.modelId} (${step.score.toFixed(2)})`;
}

export function formatAutoRouterStepDetail(step: AutoRouterStep): string {
  const parts = [
    autoRouterDecisionLabel({ fallback: step.fallback, cached: step.cached }),
    step.classifierModel ? `classifier: ${step.classifierModel}` : 'classifier: unavailable',
  ];
  if (step.cached) parts.push('cached');
  return `${parts.join(' · ')}\n${step.reason}\n${ROUTING_FEEDBACK_GUIDANCE}`;
}

export function describeAutoRouterRunStep(step: AutoRouterStep): string {
  const scoreCount = sortedCandidateScores(step.candidateScores).length;
  const scoreText = scoreCount > 0 ? ` · ${scoreCount} candidate score${scoreCount === 1 ? '' : 's'}` : '';
  const verb = step.fallback ? 'used default fallback' : 'selected';
  return `${AUTO_ROUTER_LABEL} ${verb} ${step.modelId} (${step.score.toFixed(2)})${step.cached ? ' from cache' : ''}${scoreText}`;
}

export function autoRouterStepTraceText(step: AutoRouterStep): string {
  const scores = sortedCandidateScores(step.candidateScores);
  return [
    `Selected model: ${step.modelId}`,
    `Decision: ${autoRouterDecisionLabel({ fallback: step.fallback, cached: step.cached })}`,
    `Score: ${step.score.toFixed(2)}`,
    `Reason: ${step.reason}`,
    `Classifier: ${step.classifierModel || 'unavailable'}`,
    scores.length > 0
      ? `Candidate scores:\n${scores.map(([model, score]) => `${model}: ${score.toFixed(2)}`).join('\n')}`
      : `Candidate scores: ${candidateScoresUnavailableLabel({ fallback: step.fallback })}`,
    `Feedback: ${ROUTING_FEEDBACK_GUIDANCE}`,
  ].join('\n');
}

export function routingEventDecisionLabel(event: RoutingTraceEventLike): string {
  return autoRouterDecisionLabel({ fallback: event.wasFallback, cached: event.wasCached });
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
