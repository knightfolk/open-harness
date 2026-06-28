import { strict as assert } from 'node:assert';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HarnessRunStep } from '../src/types';
import { buildRouterExplanation } from '../src/utils/routerExplanation';

type AutoRouterStep = Extract<HarnessRunStep, { type: 'auto_router' }>;
const repoRoot = fileURLToPath(new URL('..', import.meta.url));
(globalThis as typeof globalThis & { React: typeof React }).React = React;
const { RouterExplanationSection } = await import('../src/components/PromptMicroscopeRouterExplanation');

const baseStep: AutoRouterStep = {
  type: 'auto_router',
  modelId: 'provider:cheap-strong',
  score: 0.82,
  reason: 'Cheap strong model cleared the route threshold.',
  cached: false,
  fallback: false,
  classifierModel: 'provider:classifier',
  candidateScores: {
    'provider:luxury-deep': 0.88,
    'provider:cheap-strong': 0.82,
    'provider:worker-fast': 0.61,
  },
  stages: {
    modelSelectionPolicy: 'cheap-direct',
    policy: 'Cost gate kept the cheapest viable candidate above threshold.',
    heuristic: { mode: 'direct', role: 'coder', complexity: 'simple' },
  },
};

const throwingScores = new Proxy({} as Record<string, number>, {
  ownKeys() {
    throw new Error('must not inspect candidate scores while collapsed');
  },
});

assert.equal(
  buildRouterExplanation({ ...baseStep, candidateScores: throwingScores }, false),
  null,
  'Router explanation should do no candidate-score work while collapsed',
);

const explanation = buildRouterExplanation(baseStep, true);
const repeatedExplanation = buildRouterExplanation(baseStep, true);

assert.ok(explanation, 'Expanded router explanation should be available for auto-router steps');
assert.deepEqual(
  repeatedExplanation,
  explanation,
  'Router explanations should be deterministic for identical trace input',
);
assert.equal(explanation.selectedModel, 'provider:cheap-strong');
assert.equal(explanation.decision, 'Cheap direct selection');
assert.equal(explanation.selectionReason, 'Cheap strong model cleared the route threshold.');
assert.deepEqual(
  explanation.policyEvidence,
  [
    {
      id: 'cheap-direct',
      label: 'Cheap direct policy',
      evidence: 'simple direct request',
      impact: 'Skipped classifier and chose the cheapest viable candidate.',
    },
  ],
  'Router explanations should reuse Auto-Router policy evidence instead of building a separate rationale',
);
assert.equal(
  explanation.selectionSummary,
  'Cost gate selected provider:cheap-strong at 0.82; provider:luxury-deep would have scored 0.06 higher but the cost gate kept provider:cheap-strong.',
  'Cheap-direct explanations should summarize when a higher-scoring candidate loses to the cost gate',
);
assert.equal(explanation.alternatives.length, 2);
assert.equal(explanation.alternatives[0].model, 'provider:luxury-deep');
assert.match(
  explanation.alternatives[0].reason,
  /scored 0\.06 above selected/i,
  'Higher-scoring rejected candidates should be explained honestly',
);
assert.match(
  explanation.alternatives[0].reason,
  /cost gate/i,
  'Cheap-direct routes should call out cost gates when a higher score loses',
);
assert.match(
  explanation.alternatives[1].reason,
  /lost by 0\.21/i,
  'Lower-scoring alternatives should show classifier-score distance',
);

const markup = renderToStaticMarkup(
  React.createElement(RouterExplanationSection, { explanation }),
);

for (const expected of [
  'Router explanation',
  'Selection summary',
  'Cost gate selected provider:cheap-strong at 0.82',
  'Why selected',
  'provider:cheap-strong',
  'Cheap strong model cleared the route threshold.',
  'Policy evidence',
  'Cheap direct policy',
  'simple direct request',
  'Why not alternatives',
  'provider:luxury-deep',
  'scored 0.06 above selected',
  'cost gate',
]) {
  assert.ok(markup.includes(expected), `Router explanation markup should include ${expected}`);
}

assert.ok(
  markup.includes('Auto-Router explanation: selected provider:cheap-strong'),
  'Router explanation should expose an accessible selected-model label',
);

assert.ok(
  markup.includes('Router selection summary: Cost gate selected provider:cheap-strong at 0.82'),
  'Router explanation should expose an accessible selection-summary label',
);

const hiddenMarkup = renderToStaticMarkup(
  React.createElement(RouterExplanationSection, { explanation: null }),
);

assert.equal(hiddenMarkup, '', 'Router explanation section should stay hidden without explanation data');

const noPolicyEvidenceExplanation = buildRouterExplanation({
  ...baseStep,
  stages: undefined,
}, true);
assert.ok(noPolicyEvidenceExplanation, 'Router explanations should still build when route-stage metadata is absent');
assert.deepEqual(
  noPolicyEvidenceExplanation.policyEvidence,
  [],
  'Router explanations should degrade to empty policy evidence when no route-stage metadata exists',
);
const noPolicyEvidenceMarkup = renderToStaticMarkup(
  React.createElement(RouterExplanationSection, { explanation: noPolicyEvidenceExplanation }),
);
assert.ok(!noPolicyEvidenceMarkup.includes('Policy evidence'), 'Router explanation should not render an empty policy evidence row');

const fallbackExplanation = buildRouterExplanation({
  ...baseStep,
  score: 0,
  fallback: true,
  cached: true,
  classifierModel: null,
  candidateScores: {},
}, true);

assert.ok(fallbackExplanation, 'Fallback auto-router steps should still produce a stable explanation');
assert.match(
  fallbackExplanation.summary,
  /fallback/i,
  'Fallback explanations should say candidate-score evidence is unavailable because this was a fallback',
);
assert.equal(
  fallbackExplanation.selectionSummary,
  'Fallback selected provider:cheap-strong; classifier scores were unavailable for this route.',
  'Fallback explanations should use an explicit no-score selection summary',
);
assert.equal(
  fallbackExplanation.classifier,
  'unavailable',
  'Fallback explanations should reserve unavailable for missing classifier evidence',
);

const classifierAllZeroFallbackExplanation = buildRouterExplanation({
  ...baseStep,
  score: 0,
  reason: 'all scores zero; used default model',
  fallback: true,
  cached: false,
  classifierModel: 'provider:classifier',
  candidateScores: {
    'provider:cheap-strong': 0,
    'provider:luxury-deep': 0,
  },
  stages: {
    ...baseStep.stages,
    modelSelectionPolicy: 'classifier',
    threshold: 0.7,
  },
}, true);

assert.ok(classifierAllZeroFallbackExplanation, 'All-zero classifier fallback routes should still build a router explanation');
assert.equal(
  classifierAllZeroFallbackExplanation.thresholdSummary,
  '0.70 viability gate · no candidate cleared; default fallback used.',
  'All-zero classifier fallback threshold summaries should not claim the classifier gate was skipped',
);

const unavailableScoreFallbackExplanation = buildRouterExplanation({
  ...baseStep,
  score: Number.NaN,
  fallback: true,
  cached: false,
  classifierModel: 'provider:classifier',
  candidateScores: {
    'provider:cheap-strong': Number.NaN,
    'provider:luxury-deep': 0.61,
  },
  stages: {
    ...baseStep.stages,
    modelSelectionPolicy: 'classifier',
    threshold: 0.7,
  },
}, true);

assert.ok(unavailableScoreFallbackExplanation, 'Fallback routes with unavailable selected scores should still build an explanation');
assert.equal(
  unavailableScoreFallbackExplanation.thresholdSummary,
  '0.70 viability gate · fallback route; classifier threshold was not applied.',
  'Fallback threshold summaries should keep fallback wording even when the selected score is unavailable',
);

const deterministicNoClassifierExplanation = buildRouterExplanation({
  ...baseStep,
  classifierModel: null,
  candidateScores: {},
}, true);

assert.ok(
  deterministicNoClassifierExplanation,
  'Deterministic non-fallback auto-router steps should still produce a stable explanation',
);
assert.equal(
  deterministicNoClassifierExplanation.classifier,
  'skipped',
  'Deterministic non-fallback explanations should say the classifier was skipped',
);
assert.equal(
  deterministicNoClassifierExplanation.policyEvidence[0]?.id,
  'cheap-direct',
  'Deterministic non-fallback explanations should still show the route policy evidence when stages are available',
);

const closeRaceExplanation = buildRouterExplanation({
  ...baseStep,
  modelId: 'provider:cheap-strong',
  score: 0.82,
  candidateScores: {
    'provider:cheap-strong': 0.82,
    'provider:near-peer': 0.81,
    'provider:worker-fast': 0.61,
  },
  stages: {
    ...baseStep.stages,
    modelSelectionPolicy: 'classifier',
    threshold: 0.7,
  },
}, true);

assert.ok(closeRaceExplanation, 'Close classifier races should still build a router explanation');
assert.equal(
  closeRaceExplanation.summary,
  'Close classifier race; provider:near-peer trailed provider:cheap-strong by 0.01.',
  'Router explanations should call out near-tie candidate scores instead of sounding overconfident',
);

const thresholdMarkup = renderToStaticMarkup(
  React.createElement(RouterExplanationSection, { explanation: closeRaceExplanation }),
);

for (const expected of [
  'Threshold',
  '0.70 viability gate',
  'selected score cleared by 0.12',
]) {
  assert.ok(thresholdMarkup.includes(expected), `Router explanation markup should include ${expected}`);
}

const componentStyles = readFileSync(join(repoRoot, 'src/styles/components.css'), 'utf8');
assert.ok(
  componentStyles.includes('.pm-score-row-block'),
  'Router explanation policy evidence rows should have a block score-row style for long evidence copy',
);
const routerExplanationSource = readFileSync(join(repoRoot, 'src/utils/routerExplanation.ts'), 'utf8');
for (const expected of [
  'return `scored ${formatScoreDisplay(delta)} above selected; ${gate} kept the selected model.`;',
  'return `lost by ${formatScoreDisplay(Math.abs(delta))} classifier score.`;',
  'const thresholdLabel = formatScoreDisplay(threshold);',
  'return `${thresholdLabel} viability gate · selected score cleared by ${formatScoreDisplay(gap)}.`;',
  'return `${thresholdLabel} viability gate · selected score fell below by ${formatScoreDisplay(Math.abs(gap))}; classifier picked highest score.`;',
]) {
  assert.ok(routerExplanationSource.includes(expected), `Router explanation should use shared score formatting: ${expected}`);
}
for (const forbidden of [
  'delta.toFixed(2)',
  'Math.abs(delta).toFixed(2)',
  'threshold.toFixed(2)',
  'gap.toFixed(2)',
  'Math.abs(gap).toFixed(2)',
]) {
  assert.ok(!routerExplanationSource.includes(forbidden), `Router explanation should not use local raw score formatting: ${forbidden}`);
}

const belowThresholdExplanation = buildRouterExplanation({
  ...baseStep,
  modelId: 'provider:cheap-strong',
  score: 0.62,
  candidateScores: {
    'provider:cheap-strong': 0.62,
    'provider:near-peer': 0.61,
  },
  stages: {
    ...baseStep.stages,
    modelSelectionPolicy: 'classifier',
    threshold: 0.7,
  },
}, true);

assert.ok(belowThresholdExplanation, 'Below-threshold classifier routes should still explain the selected best score');
assert.equal(
  belowThresholdExplanation.thresholdSummary,
  '0.70 viability gate · selected score fell below by 0.08; classifier picked highest score.',
  'Threshold summaries should distinguish best-score classifier selections from threshold-cleared selections',
);

const unavailableScoreThresholdExplanation = buildRouterExplanation({
  ...baseStep,
  modelId: 'provider:cheap-strong',
  score: Number.NaN,
  candidateScores: {
    'provider:cheap-strong': Number.NaN,
    'provider:near-peer': 0.61,
  },
  stages: {
    ...baseStep.stages,
    modelSelectionPolicy: 'classifier',
    threshold: 0.7,
  },
}, true);

assert.ok(unavailableScoreThresholdExplanation, 'Non-finite selected scores should still build a router explanation');
assert.equal(
  unavailableScoreThresholdExplanation.thresholdSummary,
  '0.70 viability gate · selected score was unavailable.',
  'Threshold summaries should not fabricate a below-threshold gap when the selected score is unavailable',
);
assert.doesNotMatch(
  unavailableScoreThresholdExplanation.thresholdSummary || '',
  /NaN|Infinity|fell below by/,
  'Threshold summaries should avoid non-finite values and fabricated gap wording for unavailable selected scores',
);
const unavailableScoreThresholdMarkup = renderToStaticMarkup(
  React.createElement(RouterExplanationSection, { explanation: unavailableScoreThresholdExplanation }),
);
assert.ok(
  unavailableScoreThresholdMarkup.includes('selected score was unavailable'),
  'Router explanation threshold markup should describe unavailable selected scores directly',
);
assert.doesNotMatch(
  unavailableScoreThresholdMarkup,
  /NaN|Infinity|fell below by 0\.70/,
  'Router explanation threshold markup should not leak non-finite values or fabricated threshold gaps',
);

const catalogStep: AutoRouterStep = {
  ...baseStep,
  modelId: 'xai:grok-3',
  score: 0.84,
  candidateScores: {
    'xai:grok-3': 0.84,
    'meta:llama-4-scout': 0.76,
    'unknown:future-model': 0.72,
    'qwen:qwen3-coder': 0.7,
  },
};

const catalogExplanation = buildRouterExplanation(catalogStep, true);

assert.ok(catalogExplanation, 'Catalog-backed router explanations should be available when expanded');
assert.equal(
  catalogExplanation.selectedSignal.costLabel,
  '$3/$15 per 1M tokens',
  'Selected model should expose catalog input/output cost per 1M tokens',
);
assert.equal(
  catalogExplanation.selectedSignal.routerWeightLabel,
  'router weight 0.95',
  'Selected model should expose the catalog router-cost weight',
);
assert.equal(
  catalogExplanation.selectedSignal.speedLabel,
  'Fast',
  'Selected model should expose a deterministic catalog speed hint',
);
assert.equal(
  catalogExplanation.selectedSignal.freshnessLabel,
  'Unverified editorial card',
  'Selected model should expose source freshness beside cost/latency signals',
);
assert.equal(
  catalogExplanation.alternatives[0].signal.costLabel,
  '$0.11/$0.34 per 1M tokens',
  'Rejected alternatives with catalog cards should expose cost signals',
);
assert.equal(
  catalogExplanation.alternatives[0].signal.speedLabel,
  'Fast',
  'Rejected alternatives should expose speed hints',
);
assert.equal(
  catalogExplanation.alternatives[0].signal.freshnessLabel,
  'Advisory gateway metadata, checked 2026-06-18',
  'Rejected alternatives should expose advisory source freshness',
);
assert.equal(
  catalogExplanation.alternatives[1].signal.catalogStatus,
  'missing',
  'Missing catalog cards should be explicit and stable',
);
assert.equal(
  catalogExplanation.alternatives[1].signal.costLabel,
  'catalog card missing',
  'Missing catalog cards should not leak undefined cost labels',
);
assert.equal(
  catalogExplanation.alternatives[1].signal.freshnessLabel,
  'freshness unknown',
  'Missing catalog cards should expose a stable freshness fallback',
);
assert.equal(
  catalogExplanation.alternatives[2].signal.costLabel,
  'low relative cost',
  'Catalog cards without token pricing should use a clean relative-cost fallback',
);
assert.equal(
  catalogExplanation.selectionSummary,
  'Classifier selected xai:grok-3 at 0.84; meta:llama-4-scout trailed by 0.08.',
  'Classifier explanations should summarize the nearest shown alternative score gap',
);
assert.ok(
  !catalogExplanation.alternatives[2].signal.costLabel.includes('relative relative'),
  'Relative-cost fallback should not duplicate wording',
);

const catalogMarkup = renderToStaticMarkup(
  React.createElement(RouterExplanationSection, { explanation: catalogExplanation }),
);

for (const expected of [
  'Catalog signal',
  '$3/$15 per 1M tokens',
  'router weight 0.95',
  'Fast',
  'Unverified editorial card',
  '$0.11/$0.34 per 1M tokens',
  'Advisory gateway metadata, checked 2026-06-18',
  'catalog card missing',
  'freshness unknown',
  'low relative cost',
]) {
  assert.ok(catalogMarkup.includes(expected), `Catalog-backed router explanation markup should include ${expected}`);
}

console.log('Prompt Microscope router explanation checks passed.');
