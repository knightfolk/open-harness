import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  formatModelRequestDurationDetail,
  formatModelRequestDurationSuffix,
  formatModelRequestPatienceDetail,
  formatModelRequestTimeoutDetail,
  formatModelRequestTimeoutSuffix,
} from '../src/utils/modelRequestTimeoutDisplay';
import { glmPatienceLaneLabel, glmPatientPartnerLabel, glmPatientWaitLabel, modelRequestLaneLabel } from '../shared/glmModelPreference';

const slowStep = {
  type: 'model_request' as const,
  round: 1,
  model: 'z-ai-zhipu:glm-5.2',
  timeoutMs: 240_000,
  timeoutPolicy: 'slow-model' as const,
  timeoutLabel: 'Slow model lane',
};

const glm51SlowStep = {
  type: 'model_request' as const,
  round: 1,
  model: 'z-ai-zhipu:glm-5.1',
  timeoutMs: 240_000,
  timeoutPolicy: 'slow-model' as const,
  timeoutLabel: 'Slow model lane',
};

const customGlmSlowStep = {
  type: 'model_request' as const,
  round: 1,
  model: 'z-ai-zhipu:glm-5.2',
  timeoutMs: 240_000,
  timeoutPolicy: 'slow-model' as const,
  timeoutLabel: 'Reviewer patience lane',
};

const defaultStep = {
  type: 'model_request' as const,
  round: 1,
  model: 'openai:gpt-4.1',
  timeoutMs: 90_000,
  timeoutPolicy: 'default' as const,
  timeoutLabel: 'Default model lane',
};

const slowFallbackStep = {
  type: 'model_request' as const,
  round: 1,
  model: 'z-ai-zhipu:glm-5.2',
  timeoutMs: 240_000,
  timeoutPolicy: 'slow-model' as const,
};

const defaultFallbackStep = {
  type: 'model_request' as const,
  round: 1,
  model: 'openai:gpt-4.1',
  timeoutMs: 90_000,
  timeoutPolicy: 'default' as const,
};

const unknownPolicyStep = {
  type: 'model_request' as const,
  round: 1,
  model: 'custom:model',
  timeoutMs: 120_000,
  timeoutPolicy: 'custom-slow-lane' as any,
};

const nonGlmSlowStep = {
  type: 'model_request' as const,
  round: 1,
  model: 'custom:large-reasoner',
  timeoutMs: 240_000,
  timeoutPolicy: 'slow-model' as const,
};

const missingModelSlowStep = {
  type: 'model_request' as const,
  round: 1,
  model: '',
  timeoutMs: 240_000,
  timeoutPolicy: 'slow-model' as const,
};

const glm52StyleSlowStep = {
  type: 'model_request' as const,
  round: 1,
  model: 'zhipu:glm-52',
  timeoutMs: 240_000,
  timeoutPolicy: 'slow-model' as const,
};

const compactGlm5StyleSlowStep = {
  type: 'model_request' as const,
  round: 1,
  model: 'zhipu:glm5.2',
  timeoutMs: 240_000,
  timeoutPolicy: 'slow-model' as const,
};

const missingPolicyWithTimeoutStep = {
  type: 'model_request' as const,
  round: 1,
  model: 'legacy:model',
  timeoutMs: 120_000,
};

const missingStep = {
  type: 'model_request' as const,
  round: 1,
  model: 'legacy:model',
};

const zeroStep = {
  type: 'model_request' as const,
  round: 1,
  model: 'broken:model',
  timeoutMs: 0,
};

const labelWithSeparatorStep = {
  type: 'model_request' as const,
  round: 1,
  model: 'custom:model',
  timeoutMs: 120_000,
  timeoutPolicy: 'default' as const,
  timeoutLabel: 'Custom · policy',
};

const measuredMsStep = {
  type: 'model_request' as const,
  round: 1,
  model: 'fast:model',
  startedAt: '2026-06-28T00:00:00.000Z',
  completedAt: '2026-06-28T00:00:00.420Z',
};

const measuredSecondsStep = {
  type: 'model_request' as const,
  round: 1,
  model: 'slow:model',
  startedAt: '2026-06-28T00:00:00.000Z',
  completedAt: '2026-06-28T00:00:01.440Z',
};

const explicitDurationStep = {
  type: 'model_request' as const,
  round: 1,
  model: 'explicit:model',
  durationMs: 2_250,
};

const thresholdDurationStep = {
  type: 'model_request' as const,
  round: 1,
  model: 'threshold:model',
  durationMs: 30_000,
};

const slowDurationStep = {
  type: 'model_request' as const,
  round: 1,
  model: 'slow:model',
  durationMs: 30_001,
};

const glmPatienceDurationStep = {
  type: 'model_request' as const,
  round: 1,
  model: 'z-ai-zhipu:glm-5.2',
  timeoutMs: 240_000,
  timeoutPolicy: 'slow-model' as const,
  timeoutLabel: 'Slow model lane',
  durationMs: 45_000,
};

const glm51PatienceDurationStep = {
  type: 'model_request' as const,
  round: 1,
  model: 'z-ai-zhipu:glm-5.1',
  timeoutMs: 240_000,
  timeoutPolicy: 'slow-model' as const,
  timeoutLabel: 'Slow model lane',
  durationMs: 45_000,
};

const glmDefaultLaneSlowDurationStep = {
  type: 'model_request' as const,
  round: 1,
  model: 'z-ai-zhipu:glm-5.2',
  timeoutMs: 90_000,
  timeoutPolicy: 'default' as const,
  timeoutLabel: 'Default model lane',
  durationMs: 45_000,
};

const genericNearTimeoutDurationStep = {
  type: 'model_request' as const,
  round: 1,
  model: 'custom:large-reasoner',
  timeoutMs: 90_000,
  timeoutPolicy: 'default' as const,
  timeoutLabel: 'Default model lane',
  durationMs: 88_000,
};

const glmNearTimeoutDurationStep = {
  type: 'model_request' as const,
  round: 1,
  model: 'z-ai-zhipu:glm-5.2',
  timeoutMs: 240_000,
  timeoutPolicy: 'slow-model' as const,
  timeoutLabel: 'Slow model lane',
  durationMs: 220_000,
};

const glmNearTimeoutBoundaryDurationStep = {
  type: 'model_request' as const,
  round: 1,
  model: 'z-ai-zhipu:glm-5.2',
  timeoutMs: 240_000,
  timeoutPolicy: 'slow-model' as const,
  timeoutLabel: 'Slow model lane',
  durationMs: 204_000,
};

const missingDurationStep = {
  type: 'model_request' as const,
  round: 1,
  model: 'legacy:model',
  startedAt: '2026-06-28T00:00:00.000Z',
};

const invalidDurationStep = {
  type: 'model_request' as const,
  round: 1,
  model: 'broken:model',
  startedAt: '2026-06-28T00:00:02.000Z',
  completedAt: '2026-06-28T00:00:01.000Z',
};

assert.equal(
  formatModelRequestTimeoutDetail(slowStep),
  'GLM-5.2 patience lane · 240s timeout',
  'slow-lane GLM-5.2 model request detail should show the specific intentional wait policy',
);
assert.equal(
  formatModelRequestTimeoutSuffix(slowStep),
  ' · GLM-5.2 patience lane, 240s timeout',
  'progress text should use the GLM-specific compact suffix form',
);
assert.equal(
  formatModelRequestPatienceDetail(slowStep),
  'GLM-5.2 patience lane · extended timeout for slow responses',
  'slow GLM-5.2 request rows should explain that the longer wait is intentional patience, not a hang',
);
assert.equal(
  formatModelRequestPatienceDetail(glm51SlowStep),
  'GLM patience lane · extended timeout for slow responses',
  'slow GLM-5.1 request rows should keep the family-level patience label',
);
assert.equal(
  formatModelRequestTimeoutDetail(customGlmSlowStep),
  'Reviewer patience lane · 240s timeout',
  'custom GLM timeout labels should stay authoritative in replay and Prompt Microscope rows',
);
assert.equal(
  formatModelRequestPatienceDetail(customGlmSlowStep),
  '',
  'custom GLM timeout labels should not get a redundant stock GLM patience detail',
);
assert.equal(
  formatModelRequestTimeoutDetail(defaultStep),
  'Default model lane · 90s timeout',
  'default model request detail should remain explicit when metadata exists',
);
assert.equal(
  formatModelRequestPatienceDetail(defaultStep),
  '',
  'default model request rows should not render patience policy noise',
);
assert.equal(
  formatModelRequestTimeoutDetail(slowFallbackStep),
  'GLM-5.2 patience lane · 240s timeout',
  'slow-lane GLM timeout detail should fall back to the shared GLM-specific lane when label is missing',
);
assert.equal(
  formatModelRequestPatienceDetail(slowFallbackStep),
  'GLM-5.2 patience lane · extended timeout for slow responses',
  'slow-lane GLM fallback rows should still explain the patience contract',
);
assert.equal(
  formatModelRequestPatienceDetail(nonGlmSlowStep),
  'Slow-model patience lane · extended timeout policy',
  'non-GLM slow-model request rows should get generic patience wording instead of GLM-specific wording',
);
assert.equal(
  formatModelRequestPatienceDetail(missingModelSlowStep),
  'Slow-model patience lane · extended timeout policy',
  'slow-model request rows without a model id should fall back to generic patience wording',
);
assert.equal(
  formatModelRequestPatienceDetail(glm52StyleSlowStep),
  'Slow-model patience lane · extended timeout policy',
  'slow-model rows for non-GLM-5 ids like glm-52 should not get GLM-specific patience wording',
);
assert.equal(
  formatModelRequestPatienceDetail(compactGlm5StyleSlowStep),
  'GLM-5.2 patience lane · extended timeout for slow responses',
  'compact GLM5.2 ids should use the same GLM-5.2-specific patience wording as timeout policy',
);
assert.equal(
  formatModelRequestTimeoutDetail(defaultFallbackStep),
  'Default model lane · 90s timeout',
  'default timeout detail should fall back from policy when label is missing',
);
assert.equal(
  formatModelRequestTimeoutDetail(unknownPolicyStep),
  'Model request timeout · 120s timeout',
  'unknown timeout policies should not be mislabeled as the default lane',
);
assert.equal(
  formatModelRequestPatienceDetail(unknownPolicyStep),
  '',
  'unknown timeout policies should not render slow-lane patience wording',
);
assert.equal(
  formatModelRequestTimeoutSuffix(unknownPolicyStep),
  ' · Model request timeout, 120s timeout',
  'progress text should use a neutral suffix for unknown timeout policies',
);
assert.equal(
  formatModelRequestTimeoutDetail(missingPolicyWithTimeoutStep),
  'Model request timeout · 120s timeout',
  'legacy timeout metadata without a policy should stay visible without claiming a lane',
);
assert.equal(
  formatModelRequestTimeoutDetail(missingStep),
  '',
  'legacy model request steps without timeout metadata should not render placeholder noise',
);
assert.equal(
  formatModelRequestTimeoutDetail(zeroStep),
  '',
  'zero or invalid timeout metadata should not render placeholder noise',
);
assert.equal(
  formatModelRequestTimeoutSuffix(labelWithSeparatorStep),
  ' · Custom · policy, 120s timeout',
  'suffix formatting should not rewrite separators inside custom labels',
);
assert.equal(
  formatModelRequestDurationDetail(measuredMsStep),
  '420ms',
  'measured model request durations under a second should render in milliseconds',
);
assert.equal(
  formatModelRequestDurationSuffix(measuredMsStep),
  ' · 420ms',
  'progress text should expose measured model request duration when timestamps are explicit',
);
assert.equal(
  formatModelRequestDurationDetail(measuredSecondsStep),
  '1.4s',
  'measured model request durations at or above a second should render with one decimal second precision',
);
assert.equal(
  formatModelRequestDurationDetail(explicitDurationStep),
  '2.3s',
  'explicit model request duration should be used when present',
);
assert.equal(
  formatModelRequestDurationDetail(thresholdDurationStep),
  '30.0s',
  'model request durations exactly at the shared slow threshold should not be marked slow',
);
assert.equal(
  formatModelRequestDurationDetail(slowDurationStep),
  '30.0s · slow request',
  'model request durations strictly above the shared slow threshold should show the shared slow marker',
);
assert.equal(
  formatModelRequestDurationSuffix(slowDurationStep),
  ' · 30.0s · slow request',
  'stream progress text should expose the same slow request marker as Prompt Microscope and replay rows',
);
assert.equal(
  formatModelRequestDurationDetail(glmPatienceDurationStep),
  '45.0s · GLM-5.2 patient wait',
  'slow GLM-5.2 patience-lane durations should read as intentional wait time instead of a generic slow request',
);
assert.equal(
  formatModelRequestDurationSuffix(glmPatienceDurationStep),
  ' · 45.0s · GLM-5.2 patient wait',
  'stream progress text should keep GLM-5.2 patience wording for slow GLM-5.2 requests',
);
assert.equal(
  formatModelRequestDurationDetail(glm51PatienceDurationStep),
  '45.0s · GLM patient wait',
  'slow GLM-5.1 patience-lane durations should keep the family-level GLM patient wait label',
);
assert.equal(
  formatModelRequestDurationDetail(glmDefaultLaneSlowDurationStep),
  '45.0s · slow request',
  'GLM requests outside the slow-model lane should not receive patience wording that hides an unexpected slow request',
);
assert.equal(
  formatModelRequestDurationDetail(genericNearTimeoutDurationStep),
  '88.0s · slow request · nearing timeout',
  'non-GLM requests near their configured timeout should escalate beyond the generic slow request marker',
);
assert.equal(
  formatModelRequestDurationDetail(glmNearTimeoutDurationStep),
  '220.0s · GLM-5.2 patient wait · nearing timeout',
  'GLM patience-lane durations near the configured timeout should keep the raw time visible and add a stronger warning',
);
assert.equal(
  formatModelRequestDurationDetail(glmNearTimeoutBoundaryDurationStep),
  '204.0s · GLM-5.2 patient wait · nearing timeout',
  'GLM near-timeout warning should be inclusive at the named 85 percent threshold',
);
assert.equal(
  formatModelRequestDurationDetail(missingDurationStep),
  '',
  'model request duration should not be inferred when completedAt is missing',
);
assert.equal(
  formatModelRequestDurationDetail(invalidDurationStep),
  '',
  'negative or invalid model request durations should not render misleading zero-duration evidence',
);
assert.equal(glmPatienceLaneLabel('z-ai-zhipu:glm-5.2'), 'GLM-5.2 patience lane', 'shared GLM label helper should name GLM-5.2 patience specifically');
assert.equal(glmPatienceLaneLabel('Z-AI/GLM-5.2-PRO'), 'GLM-5.2 patience lane', 'shared GLM label helper should normalize mixed-case GLM-5.2 variants');
assert.equal(glmPatienceLaneLabel('z-ai-zhipu:glm-5.1'), 'GLM patience lane', 'shared GLM label helper should keep non-5.2 GLM-5 models on the family label');
assert.equal(glmPatienceLaneLabel(''), 'GLM patience lane', 'shared GLM label helper should tolerate missing model ids');
assert.equal(glmPatientPartnerLabel('z-ai-zhipu:glm-5.2'), 'GLM-5.2 patient partner', 'shared GLM partner helper should name GLM-5.2 specifically');
assert.equal(glmPatientPartnerLabel('z-ai-zhipu:glm-5.1'), 'GLM patient partner', 'shared GLM partner helper should keep non-5.2 GLM models on the family label');
assert.equal(glmPatientPartnerLabel('custom:reasoner'), 'GLM patient partner', 'shared GLM partner helper fallback should stay generic for unknown model ids');
assert.equal(glmPatientPartnerLabel(undefined), 'GLM patient partner', 'shared GLM partner helper fallback should tolerate missing model ids');
assert.equal(glmPatientWaitLabel('z-ai-zhipu:glm-5.2'), 'GLM-5.2 patient wait', 'shared GLM wait helper should name GLM-5.2 wait specifically');
assert.equal(glmPatientWaitLabel('z-ai-zhipu:glm-5.1'), 'GLM patient wait', 'shared GLM wait helper should keep non-5.2 GLM-5 models on the family label');
assert.equal(modelRequestLaneLabel({ model: 'z-ai-zhipu:glm-5.2', timeoutPolicy: 'slow-model' }), 'GLM-5.2 patience lane', 'shared lane resolver should use the GLM-5.2 patience lane for stock GLM-5.2 slow requests');
assert.equal(modelRequestLaneLabel({ model: 'z-ai-zhipu:glm-5.1', timeoutPolicy: 'slow-model' }), 'GLM patience lane', 'shared lane resolver should use the GLM family patience lane for non-5.2 GLM slow requests');
assert.equal(modelRequestLaneLabel({ model: 'custom:large-reasoner', timeoutPolicy: 'slow-model' }), 'Slow model lane', 'shared lane resolver should keep generic slow-model labels for non-GLM slow requests');
assert.equal(modelRequestLaneLabel({ model: 'openai:gpt-4.1', timeoutPolicy: 'default' }), 'Default model lane', 'shared lane resolver should keep default labels for default policy requests');
assert.equal(modelRequestLaneLabel({ model: 'legacy:model' }), 'Model request timeout', 'shared lane resolver should avoid calling legacy missing-policy timeout requests default-lane requests');
assert.equal(modelRequestLaneLabel({ model: 'z-ai-zhipu:glm-5.2', timeoutPolicy: 'slow-model', timeoutLabel: 'Reviewer patience lane' }), 'Reviewer patience lane', 'shared lane resolver should keep custom timeout labels authoritative');

const appSource = readFileSync('src/App.tsx', 'utf8');
const trackerSource = readFileSync('src/components/SubAgentTracker.tsx', 'utf8');
const microscopeSource = readFileSync('src/components/PromptMicroscope.tsx', 'utf8');
const modelRequestTimeoutSource = readFileSync('src/utils/modelRequestTimeoutDisplay.ts', 'utf8');
const chatStreamSupportSource = readFileSync('server/chatStreamSupport.ts', 'utf8');
const glmPreferenceSource = readFileSync('shared/glmModelPreference.ts', 'utf8');
const typesSource = readFileSync('src/types/index.ts', 'utf8');
const apiTypesSource = readFileSync('src/utils/api.ts', 'utf8');

assert.ok(
  appSource.includes("import { formatModelRequestDurationSuffix, formatModelRequestTimeoutSuffix } from './utils/modelRequestTimeoutDisplay'"),
  'stream progress descriptions should use the shared timeout suffix formatter',
);
assert.ok(
  trackerSource.includes("import { formatModelRequestDurationDetail, formatModelRequestPatienceDetail, formatModelRequestTimeoutDetail } from '../utils/modelRequestTimeoutDisplay'"),
  'run replay should use the shared timeout and patience detail formatters',
);
assert.ok(
  microscopeSource.includes("import { formatModelRequestDurationDetail, formatModelRequestPatienceDetail, formatModelRequestTimeoutDetail } from '../utils/modelRequestTimeoutDisplay'"),
  'Prompt Microscope should use the shared timeout and patience detail formatters',
);
assert.ok(
  trackerSource.includes('formatModelRequestPatienceDetail(step)'),
  'run replay should include the shared patience detail when slow-model policy is active',
);
assert.ok(
  microscopeSource.includes('formatModelRequestPatienceDetail(req)'),
  'Prompt Microscope model request rows should include the shared patience detail when slow-model policy is active',
);
assert.ok(
  microscopeSource.includes('[req.model, formatModelRequestTimeoutDetail(req), formatModelRequestPatienceDetail(req), formatModelRequestDurationDetail(req)].filter(Boolean).join'),
  'Prompt Microscope should append patience context without replacing timeout or duration evidence',
);
assert.ok(
  modelRequestTimeoutSource.includes("import { isSlowModelRequestDurationMs } from '../../shared/modelRequestDuration'"),
  'model request duration display should use the shared slow-duration helper',
);
assert.ok(
  modelRequestTimeoutSource.includes("return nearingTimeout ? `${detail} · slow request · nearing timeout` : `${detail} · slow request`;")
    && modelRequestTimeoutSource.includes('const waitLabel = glmPatientWaitLabel(step.model);'),
  'model request duration display should treat slow GLM patience-lane durations with model-specific intentional wait wording',
);
assert.ok(
  modelRequestTimeoutSource.includes('isModelRequestNearingTimeout(step, durationMs)'),
  'model request duration display should escalate GLM patience wording near the configured timeout',
);
assert.ok(
  glmPreferenceSource.includes('export function glmPatienceLaneLabel')
    && glmPreferenceSource.includes('export function glmPatientWaitLabel')
    && glmPreferenceSource.includes('export function glmPatientPartnerLabel')
    && glmPreferenceSource.includes('export function modelRequestLaneLabel')
    && glmPreferenceSource.includes('export function isStockModelRequestTimeoutLabel'),
  'shared GLM model preference helper should own GLM patience/wait labels and model-request lane resolution so server and client cannot drift',
);
assert.ok(
  modelRequestTimeoutSource.includes('modelRequestLaneLabel')
    && modelRequestTimeoutSource.includes('isStockModelRequestTimeoutLabel')
    && !modelRequestTimeoutSource.includes("isGlm52ModelId(modelId) ? 'GLM-5.2 patience lane'")
    && !modelRequestTimeoutSource.includes("isGlm52ModelId(modelId) ? 'GLM-5.2 patient wait'"),
  'client timeout display should use the shared model-request lane helpers instead of local label branching',
);
assert.ok(
  !glmPreferenceSource.includes("'GLM-5 patient partner'"),
  'shared GLM partner helper should not hard-code a GLM-5 family label that will drift for newer GLM models',
);
assert.ok(
  !glmPreferenceSource.includes("'GLM-5 patience lane'")
    && !glmPreferenceSource.includes("'GLM-5 patient wait'"),
  'shared GLM label helpers should keep non-5.2 GLM display labels generic so newer GLM models do not inherit stale GLM-5 copy',
);
assert.ok(
  chatStreamSupportSource.includes("import { modelRequestLaneLabel } from '../shared/glmModelPreference'")
    && chatStreamSupportSource.includes('modelRequestLaneLabel(step)')
    && !chatStreamSupportSource.includes("isGlm52ModelId(step.model) ? 'GLM-5.2 patience lane'"),
  'server live status should use the same shared model-request lane resolver as client replay and Prompt Microscope',
);
assert.ok(
  modelRequestTimeoutSource.includes('GLM_PATIENCE_NEAR_TIMEOUT_RATIO = 0.85')
    && modelRequestTimeoutSource.includes('Math.round(step.timeoutMs * GLM_PATIENCE_NEAR_TIMEOUT_RATIO)'),
  'model request duration display should name and round the GLM near-timeout threshold',
);
assert.ok(
  appSource.includes('formatModelRequestDurationSuffix(step)'),
  'stream progress descriptions should use the shared model request duration suffix formatter',
);
assert.ok(
  trackerSource.includes('formatModelRequestDurationDetail(step)'),
  'run replay should use the shared model request duration detail formatter',
);
assert.ok(
  microscopeSource.includes('formatModelRequestDurationDetail(req)'),
  'Prompt Microscope model request rows should use the shared duration formatter',
);
assert.ok(
  microscopeSource.includes('Request timeout'),
  'Prompt Microscope metadata should expose the model request timeout policy',
);
for (const source of [typesSource, apiTypesSource]) {
  assert.ok(
    source.includes('startedAt?: string; completedAt?: string; durationMs?: number'),
    'client model_request step types should allow explicit measured request duration metadata',
  );
}

console.log('Model timeout display checks passed.');
