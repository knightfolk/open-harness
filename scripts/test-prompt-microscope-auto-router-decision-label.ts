import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { autoRouterClassifierLabel, autoRouterDecisionLabel, autoRouterScoreMarginCue } from '../src/utils/autoRouterTrace';
import { buildRouterExplanation } from '../src/utils/routerExplanation';
import type { HarnessRunStep } from '../src/types';

assert.equal(
  autoRouterDecisionLabel({ fallback: false, cached: false, modelSelectionPolicy: 'cheap-direct' }),
  'Cheap direct selection',
  'Cheap-direct policy routes should have a policy-specific decision label',
);
assert.equal(
  autoRouterDecisionLabel({ fallback: false, cached: false, modelSelectionPolicy: 'escalated' }),
  'Escalated selection',
  'Escalated policy routes should have a policy-specific decision label',
);
assert.equal(
  autoRouterDecisionLabel({ fallback: true, cached: true, modelSelectionPolicy: 'escalated' }),
  'Default fallback',
  'Fallback routes should keep existing fallback-first decision semantics',
);
assert.equal(
  autoRouterDecisionLabel({ fallback: false, cached: true }),
  'Cached classifier decision',
  'Cached classifier routes should keep cached-classifier decision semantics',
);
assert.equal(
  autoRouterDecisionLabel({ fallback: false, cached: false }),
  'Classifier decision',
  'Classifier routes without a policy should keep classifier decision semantics',
);
assert.equal(
  autoRouterClassifierLabel({ classifierModel: 'provider:classifier', fallback: false }),
  'provider:classifier',
  'Classifier label should show the classifier model when one actually ran',
);
assert.equal(
  autoRouterClassifierLabel({ classifierModel: null, fallback: false }),
  'skipped',
  'Classifier label should say skipped when deterministic routing intentionally avoided the classifier',
);
assert.equal(
  autoRouterClassifierLabel({ classifierModel: null, fallback: true }),
  'unavailable',
  'Classifier label should reserve unavailable for fallback routes without classifier evidence',
);
assert.equal(
  autoRouterScoreMarginCue({
    modelId: 'provider:selected',
    score: 0.82,
    candidateScores: { 'provider:selected': 0.82, 'provider:runner-up': 0.78 },
    fallback: false,
  })?.label,
  'Selected over provider:runner-up by 0.04',
  'Score-margin cue should summarize why the selected model beat the runner-up in the expanded Auto-Router panel',
);

type AutoRouterStep = Extract<HarnessRunStep, { type: 'auto_router' }>;

function autoRouterStep(policy: string | undefined, cached = false, fallback = false): AutoRouterStep {
  return {
    type: 'auto_router',
    modelId: 'provider:selected',
    score: fallback ? 0 : 0.82,
    reason: 'Selected by test route.',
    cached,
    fallback,
    classifierModel: fallback ? null : 'provider:classifier',
    candidateScores: fallback ? {} : { 'provider:selected': 0.82, 'provider:alternative': 0.76 },
    stages: policy ? { modelSelectionPolicy: policy } : undefined,
  };
}

for (const [step, expected] of [
  [autoRouterStep('cheap-direct'), 'Cheap direct selection'],
  [autoRouterStep('escalated'), 'Escalated selection'],
  [autoRouterStep(undefined, true), 'Cached classifier decision'],
  [autoRouterStep(undefined), 'Classifier decision'],
  [autoRouterStep('escalated', true, true), 'Default fallback'],
] as Array<[AutoRouterStep, string]>) {
  assert.equal(
    buildRouterExplanation(step, true)?.decision,
    expected,
    `Router explanation decision should match expanded decision label: ${expected}`,
  );
}

const promptMicroscopeSource = readFileSync('src/components/PromptMicroscope.tsx', 'utf8');

assert.ok(
  promptMicroscopeSource.includes('const autoRouterDecision = autoRouterStep ? autoRouterDecisionLabel({'),
  'Prompt Microscope should derive one expanded Auto-Router decision label',
);
assert.ok(
  promptMicroscopeSource.includes('modelSelectionPolicy: autoRouterStep.stages?.modelSelectionPolicy'),
  'Expanded Auto-Router decision label should include modelSelectionPolicy',
);
assert.ok(
  promptMicroscopeSource.includes('autoRouterClassifierLabel({'),
  'Expanded Auto-Router classifier row should use the shared classifier provenance label',
);
assert.ok(
  promptMicroscopeSource.includes('Auto-Router decision: selected ${autoRouterStep.modelId}, score ${autoRouterScoreLabel}, ${autoRouterDecision}'),
  'Expanded Auto-Router group aria-label should reuse the policy-aware decision and safe score label',
);
assert.ok(
  promptMicroscopeSource.includes('const autoRouterScoreLabel = autoRouterStep ? formatScoreDisplay(autoRouterStep.score) :'),
  'Expanded Auto-Router group should derive one safe selected-score label',
);
assert.ok(
  promptMicroscopeSource.includes('aria-label={`Decision ${autoRouterDecision}`}'),
  'Expanded Auto-Router decision row aria-label should reuse the policy-aware decision',
);
assert.ok(
  promptMicroscopeSource.includes('<span className="pm-value">{autoRouterDecision}</span>'),
  'Expanded Auto-Router visible decision value should reuse the policy-aware decision',
);
assert.ok(
  promptMicroscopeSource.includes('const autoRouterMarginCue = expanded && autoRouterStep ? autoRouterScoreMarginCue(autoRouterStep) : null'),
  'Prompt Microscope should derive one expanded Auto-Router score-margin cue',
);
assert.ok(
  promptMicroscopeSource.includes('aria-label={autoRouterMarginCue.ariaLabel}'),
  'Expanded Auto-Router score-margin cue should expose an accessible explanation',
);
assert.ok(
  promptMicroscopeSource.includes('pm-router-margin-cue'),
  'Expanded Auto-Router score-margin cue should render with dedicated compact styling',
);
assert.ok(
  !promptMicroscopeSource.includes('autoRouterDecisionLabel({ fallback: autoRouterStep.fallback, cached: autoRouterStep.cached })'),
  'Expanded Auto-Router UI should not use fallback/cached-only decision labels',
);
