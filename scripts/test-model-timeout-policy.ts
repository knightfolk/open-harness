import { strict as assert } from 'node:assert';
import {
  DEFAULT_AGENT_REQUEST_TIMEOUT_MS,
  DEFAULT_CLASSIFIER_REQUEST_TIMEOUT_MS,
  DEFAULT_MODEL_REQUEST_TIMEOUT_MS,
  MAX_AGENT_REQUEST_TIMEOUT_MS,
  MIN_AGENT_REQUEST_TIMEOUT_MS,
  SLOW_CLASSIFIER_REQUEST_TIMEOUT_MS,
  getAgentRequestTimeoutDecision,
  getAgentRequestTimeoutMs,
  getClassifierRequestTimeoutDecision,
  getModelRequestTimeoutMs,
  normalizeAgentTimeout,
} from '../server/modelTimeouts';
import { isGlm5ModelId, normalizeGlmModelId } from '../shared/glmModelPreference';

const glm5Fixtures: Array<{ modelId: string; providerId?: string; slow: boolean; normalized: string }> = [
  { modelId: 'glm-5', providerId: 'zhipu', slow: true, normalized: 'glm-5' },
  { modelId: 'glm 5.0', providerId: 'zhipu', slow: true, normalized: 'glm-5-0' },
  { modelId: 'z-ai/glm-5.2', providerId: 'z-ai', slow: true, normalized: 'glm-5-2' },
  { modelId: 'z-ai-zhipu:glm5.2', providerId: 'zhipu', slow: true, normalized: 'glm5-2' },
  { modelId: 'zhipu:glm-5.2-pro', providerId: 'zhipu', slow: true, normalized: 'glm-5-2-pro' },
  { modelId: 'glm-52', providerId: 'zhipu', slow: false, normalized: 'glm-52' },
  { modelId: 'glm-50', providerId: 'zhipu', slow: false, normalized: 'glm-50' },
  { modelId: 'zhipu:glm-4.7', providerId: 'zhipu', slow: false, normalized: 'glm-4-7' },
  { modelId: 'notglm-5.2', providerId: 'openai', slow: false, normalized: 'notglm-5-2' },
  { modelId: 'zglm-5', providerId: 'zhipu', slow: false, normalized: 'zglm-5' },
  { modelId: 'zhipu:qwen-72b', providerId: 'zhipu', slow: false, normalized: 'qwen-72b' },
];

for (const fixture of glm5Fixtures) {
  assert.equal(
    normalizeGlmModelId(fixture.modelId),
    fixture.normalized,
    `shared GLM model normalization should be deterministic for ${fixture.modelId}`,
  );
  assert.equal(
    isGlm5ModelId(fixture.modelId),
    fixture.slow,
    `shared GLM-5 matcher should classify ${fixture.modelId} consistently`,
  );
  assert.equal(
    getModelRequestTimeoutMs(fixture.modelId, fixture.providerId) === 240_000,
    fixture.slow,
    `main-chat timeout lane should follow the shared GLM-5 matcher for ${fixture.modelId}`,
  );
  assert.equal(
    getClassifierRequestTimeoutDecision(fixture.modelId, fixture.providerId).timeoutMs === SLOW_CLASSIFIER_REQUEST_TIMEOUT_MS,
    fixture.slow,
    `classifier timeout lane should follow the shared GLM-5 matcher for ${fixture.modelId}`,
  );
}

assert.equal(
  getModelRequestTimeoutMs('openai:gpt-4.1', 'openai'),
  DEFAULT_MODEL_REQUEST_TIMEOUT_MS,
  'ordinary models should keep the default main-chat timeout',
);

assert.equal(
  getAgentRequestTimeoutMs('minimax:MiniMax-M3', 'minimax'),
  DEFAULT_AGENT_REQUEST_TIMEOUT_MS,
  'ordinary background agents should keep the default agent timeout',
);

assert.equal(
  getModelRequestTimeoutMs('z-ai-zhipu:glm-5.2', 'zhipu'),
  240_000,
  'GLM-5.2 should get the slow-lane main-chat timeout',
);

assert.equal(
  getModelRequestTimeoutMs('z-ai-zhipu:glm5.2', 'zhipu'),
  240_000,
  'compact GLM5.2 aliases should get the slow-lane main-chat timeout',
);

assert.equal(
  getModelRequestTimeoutMs('z-ai-zhipu:glm-5.1', 'zhipu'),
  240_000,
  'GLM-5.1 should get the slow-lane main-chat timeout',
);

assert.equal(
  getAgentRequestTimeoutMs('zhipu/glm-5.1', 'zhipu'),
  300_000,
  'GLM-5 family background agents should get extra room beyond a single slow model request',
);

assert.deepEqual(
  getAgentRequestTimeoutDecision('zhipu/glm-5.1', 'zhipu'),
  {
    timeoutMs: 300_000,
    timeoutPolicy: 'slow-model',
    timeoutLabel: 'Slow model lane',
  },
  'GLM-5 family background agents should expose slow-lane timeout metadata for replay UI',
);

assert.deepEqual(
  getAgentRequestTimeoutDecision('minimax:MiniMax-M3', 'minimax'),
  {
    timeoutMs: DEFAULT_AGENT_REQUEST_TIMEOUT_MS,
    timeoutPolicy: 'default',
    timeoutLabel: 'Default model lane',
  },
  'ordinary background agents should expose default timeout metadata for replay UI',
);

assert.deepEqual(
  getClassifierRequestTimeoutDecision('minimax:MiniMax-M3', 'minimax'),
  {
    timeoutMs: DEFAULT_CLASSIFIER_REQUEST_TIMEOUT_MS,
    timeoutPolicy: 'default',
    timeoutLabel: 'Default classifier lane',
  },
  'ordinary classifier models should keep the fast classifier timeout',
);

assert.deepEqual(
  getClassifierRequestTimeoutDecision('z-ai-zhipu:glm-5.2', 'zhipu'),
  {
    timeoutMs: SLOW_CLASSIFIER_REQUEST_TIMEOUT_MS,
    timeoutPolicy: 'slow-model',
    timeoutLabel: 'Slow classifier lane',
  },
  'GLM-5 classifier models should get a bounded slow-classifier timeout',
);

assert.equal(
  getClassifierRequestTimeoutDecision('zhipu:glm-5.1', 'zhipu').timeoutMs,
  SLOW_CLASSIFIER_REQUEST_TIMEOUT_MS,
  'GLM-5.1 classifier aliases should get the bounded slow-classifier timeout',
);

assert.equal(
  getModelRequestTimeoutMs('notglm-5.2', 'openai'),
  DEFAULT_MODEL_REQUEST_TIMEOUT_MS,
  'coincidental model names should not be classified as GLM',
);

assert.equal(
  getClassifierRequestTimeoutDecision('notglm-5.2', 'openai').timeoutMs,
  DEFAULT_CLASSIFIER_REQUEST_TIMEOUT_MS,
  'coincidental classifier model names should not be classified as GLM',
);

assert.equal(
  getModelRequestTimeoutMs('notglm5.2', 'openai'),
  DEFAULT_MODEL_REQUEST_TIMEOUT_MS,
  'compact coincidental names should not be classified as GLM',
);

assert.equal(
  getModelRequestTimeoutMs('zhipu:qwen-72b', 'zhipu'),
  DEFAULT_MODEL_REQUEST_TIMEOUT_MS,
  'non-GLM models on a Zhipu provider should stay on the default timeout',
);

assert.equal(
  getClassifierRequestTimeoutDecision('zhipu:qwen-72b', 'zhipu').timeoutMs,
  DEFAULT_CLASSIFIER_REQUEST_TIMEOUT_MS,
  'non-GLM classifier models on a Zhipu provider should stay on the fast classifier timeout',
);

assert.equal(
  getModelRequestTimeoutMs('zhipu:glm-4.7', 'zhipu'),
  DEFAULT_MODEL_REQUEST_TIMEOUT_MS,
  'fast GLM worker models should stay on the default timeout',
);

assert.equal(
  getClassifierRequestTimeoutDecision('zhipu:glm-4.7', 'zhipu').timeoutMs,
  DEFAULT_CLASSIFIER_REQUEST_TIMEOUT_MS,
  'fast GLM worker classifier models should stay on the fast classifier timeout',
);

assert.equal(
  normalizeAgentTimeout(undefined, getAgentRequestTimeoutMs('zhipu:glm-5.2', 'zhipu')),
  300_000,
  'missing GLM agent overrides should fall back to the extended slow-agent timeout',
);

assert.equal(
  normalizeAgentTimeout(Number.NaN, getAgentRequestTimeoutMs('zhipu:glm-5.2', 'zhipu')),
  300_000,
  'invalid GLM agent overrides should fall back to the extended slow-agent timeout',
);

assert.equal(
  normalizeAgentTimeout(120_000, getAgentRequestTimeoutMs('zhipu:glm-5.2', 'zhipu')),
  120_000,
  'in-range explicit agent timeout overrides should be preserved',
);

assert.equal(
  normalizeAgentTimeout(1_000, getAgentRequestTimeoutMs('zhipu:glm-5.2', 'zhipu')),
  MIN_AGENT_REQUEST_TIMEOUT_MS,
  'agent timeout overrides below the minimum should be clamped up',
);

assert.equal(
  normalizeAgentTimeout(360_000, getAgentRequestTimeoutMs('zhipu:glm-5.2', 'zhipu')),
  MAX_AGENT_REQUEST_TIMEOUT_MS,
  'agent timeout overrides above the maximum should be clamped down',
);

console.log('Model timeout policy checks passed.');
