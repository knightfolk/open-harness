import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const runTraceSource = readFileSync('server/runTrace.ts', 'utf8');
const clientTypesSource = readFileSync('src/types/index.ts', 'utf8');
const apiTypesSource = readFileSync('src/utils/api.ts', 'utf8');
const serverSource = readFileSync('server/index.ts', 'utf8');
const agentRuntimeSource = readFileSync('server/agentRuntime.ts', 'utf8');
const trackerSource = readFileSync('src/components/SubAgentTracker.tsx', 'utf8');
const appSource = readFileSync('src/App.tsx', 'utf8');
const timeoutSource = readFileSync('server/modelTimeouts.ts', 'utf8');

for (const source of [runTraceSource, clientTypesSource, apiTypesSource]) {
  assert.ok(
    source.includes("timeoutPolicy?: 'default' | 'slow-model'"),
    'model_request run-step types should carry timeout policy metadata',
  );
  assert.ok(
    source.includes('timeoutMs?: number'),
    'model_request run-step types should carry timeout milliseconds',
  );
  assert.ok(
    source.includes('timeoutLabel?: string'),
    'model_request run-step types should carry a user-readable timeout label',
  );
  assert.ok(
    source.includes('phasePlan?: AgentPhasePlan'),
    'model_request run-step types should carry optional planned phase deadline metadata',
  );
  assert.ok(
    source.includes('startedAt?: string; completedAt?: string; durationMs?: number'),
    'model_request run-step types should carry explicit measured duration metadata',
  );
}

assert.ok(
  timeoutSource.includes('getModelRequestTimeoutDecision'),
  'timeout policy module should expose one decision helper for timeout ms and label',
);
assert.ok(
  timeoutSource.includes('getAgentRequestTimeoutDecision'),
  'timeout policy module should expose an agent decision helper for timeout ms and label',
);
assert.ok(
  serverSource.includes('const modelRequestTimeout = getModelRequestTimeoutDecision(effectiveModel, providerId)'),
  'main chat should resolve timeout ms and policy from one model-aware decision',
);
assert.ok(
  serverSource.includes('...modelRequestTimeout'),
  'model_request trace steps should include timeout metadata',
);
assert.ok(
  serverSource.includes('const attemptTimeout = getModelRequestTimeoutDecision(modelRef, attemptProviderId)'),
  'main chat fallback attempts should resolve timeout metadata from the attempted model and provider',
);
assert.ok(
  serverSource.includes("startTimedModelRequestStep(res, run, { type: 'model_request', round: round + 1, model: modelRef, ...attemptTimeout })"),
  'main chat fallback attempts should emit timed model_request steps for the model that actually runs',
);
assert.ok(
  serverSource.includes('const createRequestSignal = (timeoutMs: number) =>'),
  'main chat should build request abort signals from the per-attempt timeout',
);
assert.ok(
  serverSource.includes('signal: createRequestSignal(attemptTimeout.timeoutMs)'),
  'main chat fetches should apply the attempted model timeout to the provider request',
);
assert.ok(
  serverSource.includes('startTimedModelRequestStep('),
  'main chat should create model_request steps with explicit start timestamps',
);
assert.ok(
  serverSource.includes('completeTimedModelRequestStep(res, run, timedModelRequestStep)'),
  'main chat should complete model_request steps with explicit completion timestamps',
);
assert.ok(
  !serverSource.includes('nextStep.startedAt'),
  'main chat should not infer model request duration from neighboring run steps',
);
assert.ok(
  serverSource.includes('attemptedProviderModels: []'),
  'main chat should track provider attempts from actual fetches',
);
assert.ok(
  serverSource.includes('lastProviderAttempt: ProviderAttemptTelemetry | null'),
  'main chat should keep terminal provider attempt metadata for adherence records',
);
assert.ok(
  serverSource.includes('const attemptedFallbackModels = attemptedProviderModels.filter((modelId) => modelId !== effectiveModel)'),
  'main chat should derive fallbackAttempted from actually executed fallback models',
);
assert.ok(
  serverSource.includes('fallbackModelId: lastProviderAttempt?.isFallback ? lastProviderAttempt.modelId : undefined'),
  'main chat adherence records should name the terminal fallback model when a fallback actually failed',
);
assert.ok(
  serverSource.includes('lastAttemptedTimeoutMs: lastProviderAttempt?.timeoutMs'),
  'main chat adherence records should preserve the terminal attempt timeout',
);
assert.ok(
  serverSource.includes('fallbackAttempted: attemptedFallbackModels.length > 0'),
  'main chat adherence records should not report configured fallbacks as attempted fallbacks',
);
assert.ok(
  !serverSource.includes("if (run) emitRunStep(res, run, { type: 'model_request', round: round + 1, model: effectiveModel, ...modelRequestTimeout });"),
  'main chat should not emit a single primary-scoped model_request before provider failover',
);
assert.ok(
  agentRuntimeSource.includes('function agentModelRequestStep('),
  'agent runtime should centralize model_request timeout metadata emission',
);
assert.ok(
  agentRuntimeSource.includes('function agentAppliedTimeoutMs('),
  'agent runtime should centralize applied per-call timeout calculation',
);
assert.ok(
  agentRuntimeSource.includes('function agentPhaseTimeoutMs('),
  'agent runtime should separate the serial phase deadline from per-call model timeouts',
);
assert.ok(
  agentRuntimeSource.includes('function agentPhasePlan('),
  'agent runtime should centralize planned phase deadline metadata',
);
assert.ok(
  agentRuntimeSource.includes('getAgentRequestTimeoutDecision(modelId, providerId)'),
  'agent model_request steps should derive timeout policy from the request model and provider',
);
assert.ok(
  agentRuntimeSource.includes('withTimedAgentModelRequest('),
  'agent runtime should complete model_request steps with explicit measured duration metadata',
);
assert.ok(
  agentRuntimeSource.includes('const primaryRequestStep = agentModelRequestStep(modelId, provider.providerId, round + 1, requestTimeoutMs, round === 0 ? phasePlan : undefined)'),
  'agent tool-loop model requests should include applied timeout metadata',
);
assert.ok(
  agentRuntimeSource.includes('round === 0 ? phasePlan : undefined'),
  'agent runtime should attach planned phase deadline metadata to the first model request only',
);
assert.ok(
  agentRuntimeSource.includes('const primaryFinalRequestStep = agentModelRequestStep(modelId, provider.providerId, maxToolRounds + 1, requestTimeoutMs)'),
  'agent final-answer model requests should include applied timeout metadata',
);
assert.ok(
  agentRuntimeSource.includes('const fallbackTimeoutMs = agentAppliedTimeoutMs(fbModelId, fbProvider.providerId, req.timeoutMs)'),
  'agent fallback model requests should compute their own applied timeout from the fallback provider',
);
assert.ok(
  agentRuntimeSource.includes('const fallbackRequestStep = agentModelRequestStep(fbModelId, fbProvider.providerId, round + 1, fallbackTimeoutMs)'),
  'agent fallback model requests should emit their own applied timeout metadata using the fallback provider',
);
assert.ok(
  agentRuntimeSource.includes('const fallbackFinalRequestStep = agentModelRequestStep(fbModelId, fbProvider.providerId, maxToolRounds + 1, fallbackTimeoutMs)'),
  'agent final-answer fallback model requests should emit their own applied timeout metadata using the fallback provider',
);
assert.ok(
  agentRuntimeSource.includes('const phaseTimeoutMs = agentPhaseTimeoutMs(config, modelId, provider.providerId, fallbackChain, req.timeoutMs)'),
  'agent runtime should size the outer watchdog from the serial retry/fallback chain',
);
assert.ok(
  trackerSource.includes('formatModelRequestTimeoutDetail(step)'),
  'run replay should include shared timeout policy details for model requests',
);
assert.ok(
  appSource.includes('formatModelRequestTimeoutSuffix(step)'),
  'stream progress descriptions should include shared timeout policy details for model requests',
);

console.log('Model timeout trace visibility checks passed.');
