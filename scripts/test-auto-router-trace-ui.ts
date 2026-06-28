import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AUTO_ROUTER_CLOSE_SCORE_GAP,
  AUTO_ROUTER_TIED_SCORE_GAP,
  autoRouterClassifierTimeoutCue,
  autoRouterConfidenceCue,
  autoRouterDecisionLabel,
  autoRouterScoreMarginCue,
  autoRouterScoreMarginSummary,
  autoRouterStepTraceText,
  autoRouterPolicyEvidence,
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

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

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

const slowClassifierFallbackStep = {
  ...fallbackStep,
  classifierModel: 'zhipu:glm-5.2',
  reason: 'Fallback: classifier error (slow-model, Slow classifier lane, 90000ms): The operation was aborted due to timeout',
} as const;

const reorderedSlowClassifierFallbackStep = {
  ...slowClassifierFallbackStep,
  reason: 'Fallback: classifier error (Slow classifier lane, slow-model, 90500ms): The operation was aborted due to timeout',
} as const;

const ordinaryClassifierErrorStep = {
  ...fallbackStep,
  reason: 'Fallback: classifier error (default, Default classifier lane, 12000ms): classifier HTTP 500',
} as const;

const malformedClassifierTimeoutStep = {
  ...fallbackStep,
  reason: 'Fallback: classifier error (slow-model, Slow classifier lane, eventually): The operation was aborted due to timeout',
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
  stages: {
    heuristic: { mode: 'execute', role: 'coder', complexity: 'medium' },
    modelSelectionPolicy: 'classifier',
    policy: 'classifier: medium task; classifier scored candidates before cost-aware selection',
    signal: {
      hasImages: false,
      turns: 4,
      toolCount: 5,
      estimatedInputTokens: 2500,
      dirtyGitState: true,
      requiresStrongToolUse: false,
    },
  },
} as const;

const cheapDirectStep = {
  ...scoredStep,
  modelId: 'provider:cheap-model',
  score: 1,
  cached: false,
  classifierModel: null,
  candidateScores: { 'provider:cheap-model': 1, 'provider:strong-model': 0 },
  reason: 'Cost policy selected cheapest viable candidate.',
  stages: {
    heuristic: { mode: 'direct', role: 'coder', complexity: 'simple' },
    modelSelectionPolicy: 'cheap-direct',
    policy: 'cheap-direct: simple low-risk task; selected cheapest viable candidate and skipped classifier',
    signal: {
      hasImages: false,
      turns: 1,
      toolCount: 0,
      estimatedInputTokens: 400,
      requiresStrongToolUse: false,
    },
  },
} as const;

const escalatedStep = {
  ...scoredStep,
  modelId: 'provider:strong-model',
  score: 1,
  cached: false,
  classifierModel: null,
  candidateScores: { 'provider:cheap-model': 0, 'provider:strong-model': 1 },
  reason: 'Cost policy selected strongest viable candidate.',
  stages: {
    heuristic: { mode: 'execute', role: 'coder', complexity: 'deep' },
    modelSelectionPolicy: 'escalated',
    policy: 'escalated: deep/high-risk task; selected strongest suitable candidate and skipped classifier',
    signal: {
      hasImages: false,
      turns: 8,
      toolCount: 12,
      estimatedInputTokens: 45_000,
      dirtyGitState: true,
      thinkingEffort: 'high',
      requiresStrongToolUse: true,
    },
  },
} as const;

const closeRaceStep = {
  ...scoredStep,
  cached: false,
  score: 0.82,
  candidateScores: {
    'provider:strong-model': 0.82,
    'provider:near-peer': 0.81,
    'provider:cheap-model': 0.64,
  },
} as const;

const tiedStep = {
  ...scoredStep,
  cached: false,
  score: 0.82,
  candidateScores: {
    'provider:strong-model': 0.82,
    'provider:tied-model': 0.82,
  },
} as const;

const tieBoundaryStep = {
  ...scoredStep,
  cached: false,
  score: 0.825,
  candidateScores: {
    'provider:strong-model': 0.825,
    'provider:boundary-model': 0.82,
  },
} as const;

const closeBoundaryStep = {
  ...scoredStep,
  cached: false,
  score: 0.84,
  candidateScores: {
    'provider:strong-model': 0.84,
    'provider:boundary-model': 0.82,
  },
} as const;

const policyOverrideStep = {
  ...scoredStep,
  cached: false,
  score: 0.76,
  candidateScores: {
    'provider:strong-model': 0.76,
    'provider:higher-score': 0.84,
  },
} as const;

const insufficientEvidenceStep = {
  ...scoredStep,
  cached: false,
  score: Number.NaN,
  candidateScores: {},
} as const;

const nonFiniteScoreWithCandidatesStep = {
  ...scoredStep,
  cached: false,
  score: Number.NaN,
} as const;

const malformedSignalStep = {
  ...scoredStep,
  stages: {
    ...scoredStep.stages,
    signal: {
      ...scoredStep.stages.signal,
      turns: Number.NaN,
      toolCount: Number.POSITIVE_INFINITY,
      estimatedInputTokens: -1,
    },
  },
} as const;

const fractionalSignalStep = {
  ...scoredStep,
  stages: {
    ...scoredStep.stages,
    signal: {
      ...scoredStep.stages.signal,
      turns: 2.5,
      toolCount: 3.7,
      estimatedInputTokens: 1234.6,
      dirtyGitState: false,
    },
  },
} as const;

const zeroSignalStep = {
  ...scoredStep,
  stages: {
    ...scoredStep.stages,
    signal: {
      ...scoredStep.stages.signal,
      turns: 0,
      toolCount: 0,
      estimatedInputTokens: 0,
      dirtyGitState: false,
    },
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
assert.equal(
  routingEventDecisionLabel({
    selectedModel: 'provider:cheap',
    score: 1,
    wasFallback: false,
    wasCached: false,
    classifierModel: null,
    modelSelectionPolicy: 'cheap-direct',
  }),
  'Cheap direct selection',
  'routing event labels should preserve cheap-direct policy decisions',
);
assert.equal(
  routingEventDecisionLabel({
    selectedModel: 'provider:escalated',
    score: 1,
    wasFallback: false,
    wasCached: true,
    classifierModel: null,
    modelSelectionPolicy: 'escalated',
  }),
  'Escalated selection',
  'routing event labels should preserve escalated policy decisions before cached-classifier fallback',
);
assert.equal(
  routingEventDecisionLabel({
    selectedModel: fallbackStep.modelId,
    score: 0,
    wasFallback: true,
    wasCached: true,
    classifierModel: fallbackStep.classifierModel,
    modelSelectionPolicy: 'escalated',
  }),
  'Default fallback',
  'routing event labels should keep fallback-first decision semantics',
);
assert.equal(candidateScoresUnavailableLabel({ fallback: true }), 'No candidate scores for this fallback');
assert.ok(
  AUTO_ROUTER_TIED_SCORE_GAP < AUTO_ROUTER_CLOSE_SCORE_GAP,
  'Auto-Router tied threshold should stay stricter than close-score threshold',
);
assert.deepEqual(sortedCandidateScores(scoredStep.candidateScores, 2).map(([model]) => model), ['provider:strong-model', 'provider:middle-model']);
assert.match(formatAutoRouterScoreList(scoredStep.candidateScores), /provider:strong-model: 0\.91/);
assert.deepEqual(
  autoRouterConfidenceCue(fallbackStep),
  {
    label: 'Fallback route',
    ariaLabel: 'Routing confidence: fallback route. Auto-Router used the default fallback; candidate confidence is unavailable.',
    verdict: 'fallback',
    tone: 'warning',
  },
  'Fallback routes should not pretend classifier confidence exists',
);
assert.deepEqual(
  autoRouterConfidenceCue({ ...scoredStep, cached: false, candidateScores: {} }),
  {
    label: 'Insufficient evidence',
    ariaLabel: 'Routing confidence: insufficient evidence. Candidate scores are unavailable or incomplete.',
    verdict: 'insufficient',
    tone: 'muted',
  },
  'Missing candidate scores should produce an insufficient-confidence cue',
);
assert.deepEqual(
  autoRouterConfidenceCue(insufficientEvidenceStep),
  {
    label: 'Insufficient evidence',
    ariaLabel: 'Routing confidence: insufficient evidence. Candidate scores are unavailable or incomplete.',
    verdict: 'insufficient',
    tone: 'muted',
  },
  'Non-finite route scores should produce an insufficient-confidence cue',
);
assert.deepEqual(
  autoRouterConfidenceCue(scoredStep),
  {
    label: 'Decisive route · cached',
    ariaLabel: 'Routing confidence: decisive route. provider:strong-model led provider:middle-model by 0.10 score points. Decision came from cached routing evidence.',
    verdict: 'decisive',
    tone: 'neutral',
  },
  'Large classifier margins should render decisive confidence while retaining cached provenance',
);
assert.deepEqual(
  autoRouterConfidenceCue(closeRaceStep),
  {
    label: 'Close route',
    ariaLabel: 'Routing confidence: close route. provider:strong-model led provider:near-peer by 0.01 score points.',
    verdict: 'close',
    tone: 'warning',
  },
  'Close classifier races should be visible as lower-confidence routing evidence',
);
assert.deepEqual(
  autoRouterConfidenceCue(tiedStep),
  {
    label: 'Tied route',
    ariaLabel: 'Routing confidence: tied route. provider:strong-model tied provider:tied-model on classifier score.',
    verdict: 'tied',
    tone: 'warning',
  },
  'Tied classifier scores should be explicit rather than reported as decisive',
);
assert.equal(
  autoRouterConfidenceCue(tieBoundaryStep).verdict,
  'close',
  'A score gap at the tied threshold should leave the tied band and classify as close',
);
assert.equal(
  autoRouterConfidenceCue(closeBoundaryStep).verdict,
  'close',
  'A score gap at the close threshold should remain a close route instead of becoming decisive',
);
assert.deepEqual(
  autoRouterConfidenceCue(policyOverrideStep),
  {
    label: 'Policy override',
    ariaLabel: 'Routing confidence: policy override. provider:higher-score scored 0.08 above selected model provider:strong-model.',
    verdict: 'override',
    tone: 'warning',
  },
  'Policy overrides should show that the selected model did not win the raw candidate score',
);
assert.deepEqual(
  autoRouterScoreMarginCue(scoredStep),
  {
    label: 'Selected over provider:middle-model by 0.10',
    ariaLabel: 'Auto-Router selected provider:strong-model over next-best alternative provider:middle-model by 0.10 score points.',
    comparisonModel: 'provider:middle-model',
    margin: 0.1,
    tone: 'neutral',
  },
  'Margin cue should explain the selected model versus the runner-up without attributing unverifiable causes',
);
assert.equal(
  autoRouterScoreMarginCue(closeRaceStep)?.tone,
  'warning',
  'Close score margins should be visually flagged without changing the factual wording',
);
assert.deepEqual(
  autoRouterScoreMarginCue(tiedStep),
  {
    label: 'Tied with provider:tied-model',
    ariaLabel: 'Auto-Router selected provider:strong-model; alternative provider:tied-model tied its classifier score.',
    comparisonModel: 'provider:tied-model',
    margin: 0,
    tone: 'warning',
  },
  'Tied scores should be called out explicitly',
);
assert.equal(
  autoRouterScoreMarginSummary(tiedStep),
  'Tied with provider:tied-model.',
  'Text score-margin summary should match the structured tied-score cue',
);
assert.deepEqual(
  autoRouterScoreMarginCue(policyOverrideStep),
  {
    label: 'provider:higher-score scored 0.08 higher',
    ariaLabel: 'Auto-Router selected provider:strong-model, but highest-scoring alternative provider:higher-score scored 0.08 score points higher.',
    comparisonModel: 'provider:higher-score',
    margin: -0.08,
    tone: 'warning',
  },
  'Policy overrides should not pretend the selected model won the raw classifier score',
);
assert.equal(autoRouterScoreMarginCue(fallbackStep), null, 'Fallback routes should not show a score-margin cue');
assert.equal(
  autoRouterScoreMarginCue({ ...scoredStep, candidateScores: { 'provider:strong-model': 0.91 } }),
  null,
  'Single-candidate routes should not show a runner-up cue',
);
assert.equal(
  autoRouterScoreMarginCue({ ...scoredStep, score: Number.NaN }),
  null,
  'Non-finite selected scores should not show a score-margin cue',
);
assert.deepEqual(
  autoRouterScoreMarginCue({ ...scoredStep, score: 0.44 }),
  {
    label: 'Selected over provider:middle-model by 0.10',
    ariaLabel: 'Auto-Router selected provider:strong-model over next-best alternative provider:middle-model by 0.10 score points.',
    comparisonModel: 'provider:middle-model',
    margin: 0.1,
    tone: 'neutral',
  },
  'Score-margin cue should compare saved candidate scores instead of mixing adjusted selected score with raw candidates',
);
assert.equal(
  autoRouterScoreMarginSummary({ ...scoredStep, score: 0.44 }),
  'provider:strong-model led provider:middle-model by 0.10.',
  'Text score-margin summary should compare saved candidate scores just like the structured cue does',
);
assert.equal(
  autoRouterScoreMarginSummary(nonFiniteScoreWithCandidatesStep),
  null,
  'Text score-margin summary should not report a classifier margin when the saved selected score is non-finite',
);
assert.equal(
  autoRouterScoreMarginCue({ ...scoredStep, candidateScores: { 'provider:middle-model': 0.81 } }),
  null,
  'Selected model must have a saved candidate score before the cue compares it to alternatives',
);
assert.match(formatAutoRouterStepTitle(scoredStep), /^Auto-Router · provider:strong-model \(0\.91\)$/);
assert.match(formatAutoRouterStepDetail(fallbackStep), /^Default fallback · classifier: opencode-go:deepseek-v4-flash/);
assert.equal(
  autoRouterClassifierTimeoutCue(slowClassifierFallbackStep),
  'Classifier timeout: Slow classifier lane · 90s bounded wait',
  'Slow GLM classifier fallbacks should expose a readable bounded-timeout cue',
);
assert.equal(
  autoRouterClassifierTimeoutCue(reorderedSlowClassifierFallbackStep),
  'Classifier timeout: Slow classifier lane · 91s bounded wait',
  'Classifier timeout cue parsing should tolerate reordered timeout metadata fields and round milliseconds for display',
);
assert.equal(
  autoRouterClassifierTimeoutCue(ordinaryClassifierErrorStep),
  null,
  'Default classifier errors should not render slow-classifier timeout cues',
);
assert.equal(
  autoRouterClassifierTimeoutCue(malformedClassifierTimeoutStep),
  null,
  'Malformed classifier timeout metadata should suppress the derived timeout cue instead of rendering a misleading wait',
);
assert.match(
  formatAutoRouterStepDetail(slowClassifierFallbackStep),
  /Classifier timeout: Slow classifier lane · 90s bounded wait/,
  'Auto-Router replay detail should surface the slow-classifier timeout cue before the raw fallback reason',
);
assert.match(
  autoRouterStepTraceText(slowClassifierFallbackStep),
  /Classifier timeout: Slow classifier lane · 90s bounded wait/,
  'Expanded Auto-Router trace text should include the slow-classifier timeout cue',
);
assert.equal(
  autoRouterClassifierTimeoutCue(fallbackStep),
  null,
  'Fallback reasons without structured classifier timeout metadata should not render timeout cue noise',
);
assert.deepEqual(
  autoRouterPolicyEvidence(cheapDirectStep),
  [
    {
      id: 'cheap-direct',
      label: 'Cheap direct policy',
      evidence: 'simple direct request; no images; 1 turn; 0 tools; about 400 input tokens',
      impact: 'Skipped classifier and chose the cheapest viable candidate.',
    },
  ],
  'Cheap-direct routes should expose the concrete policy evidence used to skip classifier overhead',
);
assert.deepEqual(
  autoRouterPolicyEvidence(escalatedStep),
  [
    {
      id: 'escalated',
      label: 'Escalation policy',
      evidence: 'deep execute request; 8 turns; 12 tools; about 45000 input tokens; dirty git state; strong tool use; high thinking',
      impact: 'Skipped classifier and chose the strongest suitable candidate.',
    },
  ],
  'Escalated routes should expose the concrete risk evidence behind strongest-model selection',
);
assert.deepEqual(
  autoRouterPolicyEvidence(scoredStep)[0],
  {
    id: 'classifier',
    label: 'Classifier policy',
    evidence: 'medium execute request; 4 turns; 5 tools; about 2500 input tokens; dirty git state',
    impact: 'Ran classifier scoring before cost-aware model selection.',
  },
  'Classifier routes should expose the concrete signals that justified classifier overhead',
);
assert.deepEqual(
  autoRouterPolicyEvidence(malformedSignalStep)[0],
  {
    id: 'classifier',
    label: 'Classifier policy',
    evidence: 'medium execute request; dirty git state',
    impact: 'Ran classifier scoring before cost-aware model selection.',
  },
  'Malformed signal numbers should be omitted without losing valid neighboring route evidence',
);
assert.doesNotMatch(
  autoRouterStepTraceText(malformedSignalStep),
  /NaN|Infinity|-1 input tokens/,
  'Expanded Auto-Router trace text should not leak malformed signal numbers',
);
assert.equal(
  autoRouterPolicyEvidence(fractionalSignalStep)[0].evidence,
  'medium execute request; about 1235 input tokens',
  'Fractional count fields should be omitted, while approximate token estimates should round for display',
);
assert.equal(
  autoRouterPolicyEvidence(zeroSignalStep)[0].evidence,
  'medium execute request; 0 turns; 0 tools; about 0 input tokens',
  'Zero-valued signal fields should remain valid evidence',
);
assert.equal(
  describeAutoRouterRunStep(scoredStep),
  'Auto-Router selected provider:strong-model from cached routing evidence. Details are in Routing Learning.',
  'default Auto-Router summary should avoid raw scores and candidate counts',
);
assert.doesNotMatch(describeAutoRouterRunStep(scoredStep), /0\.91|score|candidate/i, 'default Auto-Router summary should keep diagnostics out of main chat copy');
assert.match(
  autoRouterStepTraceText(scoredStep),
  /Routing confidence: Decisive route · cached/,
  'Expanded Auto-Router trace text should include the same confidence cue as the Prompt Microscope UI',
);
assert.match(
  autoRouterStepTraceText(cheapDirectStep),
  /Policy evidence:\ncheap-direct — simple direct request; no images; 1 turn; 0 tools; about 400 input tokens/,
  'Expanded Auto-Router trace text should explain cheap-direct evidence',
);
assert.match(
  autoRouterStepTraceText(escalatedStep),
  /Policy evidence:\nescalated — deep execute request; 8 turns; 12 tools; about 45000 input tokens; dirty git state; strong tool use; high thinking/,
  'Expanded Auto-Router trace text should explain escalated evidence',
);
assert.match(
  autoRouterStepTraceText(closeRaceStep),
  /Routing confidence: Close route/,
  'Expanded Auto-Router trace text should call out close classifier races',
);
assert.match(
  autoRouterStepTraceText(tiedStep),
  /Score margin: Tied with provider:tied-model\./,
  'Expanded Auto-Router trace text should not describe tied scores as a trailing close race',
);
assert.doesNotMatch(
  autoRouterStepTraceText(tiedStep),
  /trailed .*0\.00/,
  'Expanded Auto-Router trace text should avoid contradictory zero-margin close-race wording',
);
assert.match(
  autoRouterStepTraceText(fallbackStep),
  /Routing confidence: Fallback route/,
  'Expanded Auto-Router trace text should call out default fallback routes',
);
assert.match(
  autoRouterStepTraceText(insufficientEvidenceStep),
  /Routing confidence: Insufficient evidence/,
  'Expanded Auto-Router trace text should degrade cleanly when candidate confidence is unavailable',
);
assert.match(
  autoRouterStepTraceText(nonFiniteScoreWithCandidatesStep),
  /Score: unavailable/,
  'Expanded Auto-Router trace text should avoid rendering NaN as a score',
);
assert.doesNotMatch(
  autoRouterStepTraceText(nonFiniteScoreWithCandidatesStep),
  /Score: NaN/,
  'Expanded Auto-Router trace text should avoid exposing non-finite numeric output',
);
assert.doesNotMatch(
  autoRouterStepTraceText(nonFiniteScoreWithCandidatesStep),
  /Score margin:/,
  'Expanded Auto-Router trace text should not show a score-margin line when selected-score confidence is insufficient',
);
assert.match(autoRouterStepTraceText(fallbackStep), /Candidate scores: No candidate scores for this fallback/);
assert.match(
  autoRouterStepTraceText(closeRaceStep),
  /Score margin: Close classifier race; provider:near-peer trailed provider:strong-model by 0\.01\./,
  'Expanded Auto-Router trace text should preserve close-race score context',
);

const autoRouterTraceSource = readFileSync(join(repoRoot, 'src/utils/autoRouterTrace.ts'), 'utf8');
for (const expected of [
  'const marginLabel = formatScoreDisplay(margin);',
  'const absMarginLabel = formatScoreDisplay(Math.abs(margin));',
  'const gapLabel = formatScoreDisplay(gap);',
  'const absGapLabel = formatScoreDisplay(Math.abs(gap));',
  'label: `Selected over ${comparisonModel} by ${marginLabel}`',
  'ariaLabel: `Auto-Router selected ${input.modelId} over next-best alternative ${comparisonModel} by ${marginLabel} score points.`',
  'ariaLabel: `Routing confidence: close route. ${input.modelId} led ${comparisonModel} by ${marginLabel} score points.${cachedSentence}`',
  'return `Close classifier race; ${model} trailed ${input.modelId} by ${gapLabel}.`;',
]) {
  assert.ok(autoRouterTraceSource.includes(expected), `Auto-Router trace margins should use shared display formatting: ${expected}`);
}
for (const forbidden of [
  'const absMargin = Math.abs(margin).toFixed(2);',
  'margin.toFixed(2)',
  'Math.abs(gap).toFixed(2)',
  'gap.toFixed(2)',
]) {
  assert.ok(!autoRouterTraceSource.includes(forbidden), `Auto-Router trace should not use raw margin display formatting: ${forbidden}`);
}

const promptMicroscopeSource = readFileSync(join(repoRoot, 'src/components/PromptMicroscope.tsx'), 'utf8');
const statusBarSource = readFileSync(join(repoRoot, 'src/components/StatusBar.tsx'), 'utf8');
for (const expected of [
  'autoRouterConfidenceCue',
  'autoRouterPolicyEvidence',
  'const autoRouterConfidence = expanded && autoRouterStep ? autoRouterConfidenceCue(autoRouterStep) : null;',
  'const autoRouterPolicyEvidenceRows = expanded && autoRouterStep ? autoRouterPolicyEvidence(autoRouterStep) : [];',
  'aria-label={autoRouterConfidence.ariaLabel}',
  'Policy evidence',
  'pm-router-confidence-cue pm-router-confidence-cue-${autoRouterConfidence.tone}',
  '{autoRouterConfidence.label}',
]) {
  assert.ok(
    promptMicroscopeSource.includes(expected),
    `Prompt Microscope should render compact Auto-Router confidence cue: ${expected}`,
  );
}

for (const expected of [
  "autoRouterConfidenceCue",
  "const autoRouterConfidence = autoRouterStep ? autoRouterConfidenceCue(autoRouterStep) : null;",
  "const autoModelPickerLabel = autoRouterConfidence",
  "Choose model, currently ${autoModelLabel}. ${autoRouterConfidence.ariaLabel}",
  "status-bar-router-confidence",
  "aria-hidden=\"true\"",
  "aria-label={isAuto ? autoModelPickerLabel : `Choose model, currently ${activeModel}`}",
  "{autoRouterConfidence.label}",
]) {
  assert.ok(
    statusBarSource.includes(expected),
    `StatusBar should show compact Auto-Router confidence beside the Auto model label: ${expected}`,
  );
}

const componentStyles = readFileSync(join(repoRoot, 'src/styles/components.css'), 'utf8');
for (const expected of [
  '.pm-router-confidence-cue',
  '.pm-router-confidence-cue-warning',
  '.pm-router-confidence-cue-muted',
  '.status-bar-router-confidence',
  '.status-bar-router-confidence-warning',
  '.status-bar-router-confidence-muted',
  '.pm-policy-evidence-list',
  '.pm-policy-evidence-row',
  '.pm-policy-evidence-detail',
]) {
  assert.ok(componentStyles.includes(expected), `Prompt Microscope Auto-Router CSS should include ${expected}`);
}

console.log('Auto-Router trace UI helper tests passed.');
