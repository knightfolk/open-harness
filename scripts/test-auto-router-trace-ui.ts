import { strict as assert } from 'node:assert';
import {
  autoRouterDecisionLabel,
  autoRouterStepTraceText,
  candidateScoresUnavailableLabel,
  describeAutoRouterRunStep,
  formatAutoRouterScoreList,
  formatAutoRouterStepDetail,
  formatAutoRouterStepTitle,
  latestAutoRouterStep,
  routingEventDecisionLabel,
  sortedCandidateScores,
} from '../src/utils/autoRouterTrace';
import type { HarnessRun, Message } from '../src/types';

const fallbackStep = {
  type: 'auto_router',
  modelId: 'minimax:MiniMax-M3',
  score: 0,
  reason: 'Fallback: classifier returned empty scores',
  cached: false,
  fallback: true,
  classifierModel: 'opencode-go:deepseek-v4-flash',
  candidateScores: {},
} as const;

const scoredStep = {
  type: 'auto_router',
  modelId: 'provider:strong-model',
  score: 0.91,
  reason: 'Selected strongest viable candidate',
  cached: true,
  fallback: false,
  classifierModel: 'provider:classifier',
  candidateScores: {
    'provider:cheap-model': 0.72,
    'provider:strong-model': 0.91,
    'provider:middle-model': 0.81,
  },
} as const;

const runTrace = {
  id: 'run-1',
  sessionId: 'session-1',
  userMessageId: 'message-1',
  role: 'coder',
  requestedModel: 'Auto',
  effectiveModel: 'provider:strong-model',
  providerId: 'provider',
  status: 'complete',
  startedAt: new Date(0).toISOString(),
  completedAt: new Date(1000).toISOString(),
  context: { tokensUsed: 1, budget: 1000, compressedCount: 0, summarized: false },
  steps: [fallbackStep, scoredStep],
} satisfies HarnessRun;

const messages = [
  { id: 'user-1', role: 'user', content: 'hello', timestamp: new Date(), runTrace: undefined },
  { id: 'assistant-1', role: 'assistant', content: 'hi', timestamp: new Date(), runTrace },
] satisfies Message[];

assert.equal(latestAutoRouterStep(messages)?.modelId, 'provider:strong-model', 'latest saved Auto-Router step should hydrate from message history');
assert.equal(autoRouterDecisionLabel(fallbackStep), 'Default fallback', 'fallback wording should be consistent');
assert.equal(autoRouterDecisionLabel(scoredStep), 'Cached classifier decision', 'cached classifier wording should be consistent');
assert.equal(routingEventDecisionLabel({ selectedModel: fallbackStep.modelId, score: 0, wasFallback: true, wasCached: false, classifierModel: fallbackStep.classifierModel }), 'Default fallback');
assert.equal(candidateScoresUnavailableLabel({ fallback: true }), 'No candidate scores for this fallback');
assert.deepEqual(sortedCandidateScores(scoredStep.candidateScores, 2).map(([model]) => model), ['provider:strong-model', 'provider:middle-model']);
assert.match(formatAutoRouterScoreList(scoredStep.candidateScores), /provider:strong-model: 0\.91/);
assert.match(formatAutoRouterStepTitle(scoredStep), /^Auto-Router · provider:strong-model \(0\.91\)$/);
assert.match(formatAutoRouterStepDetail(fallbackStep), /^Default fallback · classifier: opencode-go:deepseek-v4-flash/);
assert.match(describeAutoRouterRunStep(fallbackStep), /Auto-Router used default fallback minimax:MiniMax-M3/);
assert.match(autoRouterStepTraceText(fallbackStep), /Candidate scores: No candidate scores for this fallback/);

console.log('Auto-Router trace UI helper tests passed.');
