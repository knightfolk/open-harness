import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import type { RouterLearningSummary, ToolReliabilityBucket, ToolReliabilitySummary } from '../src/utils/api';
import { buildAutoRouterCandidateEvidence, promptStrategyIdForRouterCandidate } from '../src/utils/autoRouterCandidateEvidence';
import { resolvePromptStrategyForModel } from '../src/utils/promptStrategyResolver';
import { ROUTER_LEARNING_SUMMARY_TTL_MS, createRouterLearningSummaryLoader } from '../src/utils/routerLearningSummaryCache';
import { isGlm52ModelId, isGlm5ModelId } from '../shared/glmModelPreference';

function bucket(overrides: Partial<ToolReliabilityBucket>): ToolReliabilityBucket {
  const total = overrides.total ?? 0;
  const error = overrides.error ?? 0;
  const runs = overrides.runs ?? 0;
  return {
    total,
    complete: overrides.complete ?? Math.max(0, total - error),
    error,
    skipped: overrides.skipped ?? 0,
    running: overrides.running ?? 0,
    runs,
    firstCallErrors: overrides.firstCallErrors ?? 0,
    affectedRuns: overrides.affectedRuns ?? 0,
    recoveredRuns: overrides.recoveredRuns ?? 0,
    errorRate: overrides.errorRate ?? (total > 0 ? error / total : 0),
    firstCallErrorRate: overrides.firstCallErrorRate ?? 0,
    recoveryRate: overrides.recoveryRate ?? 0,
    avgRecoveryRounds: overrides.avgRecoveryRounds ?? 0,
    avgDurationMs: overrides.avgDurationMs ?? 0,
  };
}

function toolReliability(overrides: Partial<ToolReliabilitySummary> = {}): ToolReliabilitySummary {
  return {
    totalToolCalls: 0,
    completedToolCalls: 0,
    errorToolCalls: 0,
    skippedToolCalls: 0,
    runningToolCalls: 0,
    runsWithToolCalls: 0,
    firstCallErrorRuns: 0,
    runsWithToolErrors: 0,
    recoveredRunsWithToolErrors: 0,
    avgRecoveryRounds: 0,
    byModel: {},
    byProvider: {},
    byTool: {},
    byModelTool: {},
    byPromptStrategy: {},
    byPromptStrategyVariant: {},
    byEvidenceSource: [],
    toolHeavyAdvice: [],
    recoveryExamples: [],
    outcomeExamples: [],
    recoveryPatterns: [],
    failureMemory: [],
    errorSignatures: [],
    retryReductionRecommendations: [],
    recentErrors: [],
    ...overrides,
  };
}

function learningSummary(overrides: Partial<RouterLearningSummary> = {}): RouterLearningSummary {
  return {
    totalEvents: 0,
    models: {},
    successRate: 0,
    outdated: false,
    byTaskType: {},
    byRole: {},
    byComplexity: {},
    bestByTaskType: [],
    bestPromptStrategyVariants: [],
    ...overrides,
  };
}

assert.equal(promptStrategyIdForRouterCandidate('qwen:qwen3-coder'), 'qwen-xml-code-v1');
assert.equal(promptStrategyIdForRouterCandidate('minimax:MiniMax-M3'), 'minimax-long-context-agent-v1');
assert.equal(promptStrategyIdForRouterCandidate('z-ai-zhipu:glm-5.2'), 'glm-5-patient-partner-v1');
assert.equal(isGlm52ModelId('z-ai-zhipu:glm-5.2'), true, 'GLM-5.2 should be recognized through provider-qualified ids');
assert.equal(isGlm52ModelId('z-ai/glm-5.2-turbo'), true, 'GLM-5.2 variants should keep the specific GLM-5.2 policy label');
assert.equal(isGlm52ModelId('glm-5'), false, 'Base GLM-5 should keep the family-level policy label');
assert.equal(isGlm52ModelId('glm-52'), false, 'GLM-52-style ids should not be confused with GLM-5.2');
assert.equal(isGlm52ModelId('glm-5.20'), false, 'GLM-5.20-style ids should not be confused with GLM-5.2');
assert.equal(isGlm52ModelId('z-ai-zhipu:glm-5.3'), false, 'Future GLM-5.x models should not be mislabeled as GLM-5.2');
assert.equal(isGlm52ModelId(''), false, 'Missing model ids should not be mislabeled as GLM-5.2');
assert.equal(isGlm52ModelId(undefined), false, 'Undefined model ids should not be mislabeled as GLM-5.2');
for (const modelId of ['z-ai-zhipu:glm-5.2', 'z-ai/glm-5.2-turbo', 'glm-5', 'glm-52', 'glm-5.20', 'z-ai-zhipu:glm-5.3']) {
  assert.equal(
    !isGlm52ModelId(modelId) || isGlm5ModelId(modelId),
    true,
    `GLM-5.2-specific matcher should remain a subset of the GLM-5 family matcher for ${modelId}`,
  );
}

const candidateEvidenceModule = await import('../src/utils/autoRouterCandidateEvidence') as Record<string, unknown>;
const candidateEvidenceToneSource = readFileSync('src/utils/autoRouterCandidateEvidence.ts', 'utf8');
assert.equal(
  typeof candidateEvidenceModule.routerModelKeysMatch,
  'function',
  'Auto-router candidate evidence should export the shared model-key matcher for Settings router evidence',
);
assert.equal(
  typeof candidateEvidenceModule.createAutoRouterCandidateEvidenceBuilder,
  'function',
  'Auto-router candidate evidence should expose an indexed per-summary builder for repeated candidate lookups',
);
const routerModelKeysMatch = candidateEvidenceModule.routerModelKeysMatch as (candidate: string, evidenceKey: string) => boolean;
const createAutoRouterCandidateEvidenceBuilder = candidateEvidenceModule.createAutoRouterCandidateEvidenceBuilder as (
  summary: RouterLearningSummary | null | undefined,
  options?: { nowMs?: number },
) => { forModel: (modelId: string) => ReturnType<typeof buildAutoRouterCandidateEvidence> };
assert.equal(
  routerModelKeysMatch('z-ai-zhipu:glm-5.2', 'glm-5.2'),
  true,
  'Shared model-key matcher should connect provider-prefixed candidates to bare learned evidence keys',
);
assert.equal(
  routerModelKeysMatch('glm-5.2', 'z-ai-zhipu:glm-5.2'),
  true,
  'Shared model-key matcher should also connect bare candidates to provider-prefixed learned evidence keys',
);
assert.equal(
  routerModelKeysMatch('minimax:MiniMax-M3', 'qwen:qwen3-coder'),
  false,
  'Shared model-key matcher should keep unrelated provider-prefixed model keys separate',
);
assert.equal(
  routerModelKeysMatch('claude-sonnet-4', 'claude-3-5-sonnet-4'),
  false,
  'Shared model-key matcher should not treat distinct same-family model names as the same evidence key',
);

assert.equal(
  resolvePromptStrategyForModel('tenant/openai:o1-mini@2026-06').strategyId,
  'openai-openai-reasoning-v1',
  'Shared prompt strategy resolver should preserve server reasoning-model overrides for Prompt Microscope evidence',
);
assert.equal(
  promptStrategyIdForRouterCandidate('tenant/openai:o1-mini@2026-06'),
  'openai-openai-reasoning-v1',
  'Prompt Microscope candidate evidence should mirror the server prompt strategy for provider-prefixed reasoning models',
);

const glmPolicyCue = buildAutoRouterCandidateEvidence(null, 'z-ai-zhipu:glm-5.2');
assert.equal(
  glmPolicyCue?.text,
  'Evidence: Policy GLM-5.2 patient partner',
  'Prompt Microscope should surface the configured GLM-5.2 patient-partner prompt policy even before router-learning evidence exists',
);
assert.equal(glmPolicyCue?.tone, 'context', 'Static GLM-5.2 prompt policy should be context-toned instead of risk-toned');
assert.equal(glmPolicyCue?.stale, false, 'Static GLM-5.2 prompt policy should not be styled as stale learning evidence');
assert.match(
  glmPolicyCue?.ariaLabel || '',
  /GLM-5\.2.*patient partner.*private plan.*proof-first.*visible chain-of-thought/i,
  'GLM-5.2 policy cue should explain the patient-partner prompt contract without exposing chain-of-thought',
);
assert.match(
  glmPolicyCue?.ariaLabel || '',
  /GLM-5\.2 patience lane.*intentional.*hung model/i,
  'GLM-5.2 policy cue should explain the runtime patience lane without expanding the compact candidate-row text',
);
assert.equal(
  glmPolicyCue?.text,
  'Evidence: Policy GLM-5.2 patient partner',
  'GLM-5.2 patience context should stay in accessible detail instead of making candidate rows noisy',
);

const glmFamilyPolicyCue = buildAutoRouterCandidateEvidence(null, 'z-ai-zhipu:glm-5');
assert.equal(
  glmFamilyPolicyCue?.text,
  'Evidence: Policy GLM patient partner',
  'Prompt Microscope should keep a family-level GLM label for non-5.2 GLM candidates',
);
assert.match(
  glmFamilyPolicyCue?.ariaLabel || '',
  /GLM patience lane.*intentional.*hung model/i,
  'Prompt Microscope should keep the family-level patience lane in non-5.2 GLM-5 policy detail',
);

const glm52VariantPolicyCue = buildAutoRouterCandidateEvidence(null, 'z-ai/glm-5.2-turbo');
assert.equal(
  glm52VariantPolicyCue?.text,
  'Evidence: Policy GLM-5.2 patient partner',
  'Prompt Microscope should keep the specific GLM-5.2 label for GLM-5.2 variants',
);

const miniMaxM3PolicyCue = buildAutoRouterCandidateEvidence(learningSummary(), 'minimax:MiniMax-M3');
assert.equal(
  miniMaxM3PolicyCue?.text,
  'Evidence: Policy MiniMax M3 preferred',
  'Prompt Microscope should surface the MiniMax M3 preference policy without requiring learned evidence',
);
assert.equal(miniMaxM3PolicyCue?.tone, 'context', 'Static MiniMax M3 policy should be context-toned');
assert.match(
  miniMaxM3PolicyCue?.ariaLabel || '',
  /same-provider MiniMax M2\.x.*M3 is viable/i,
  'MiniMax M3 policy cue should explain the same-provider M2.x preference boundary',
);

const miniMaxM2PolicyCue = buildAutoRouterCandidateEvidence(null, 'minimax:MiniMax-M2.7');
assert.equal(
  miniMaxM2PolicyCue?.text,
  'Evidence: Policy MiniMax M2 fallback',
  'Prompt Microscope should label older MiniMax candidates as fallback policy when they remain visible',
);
assert.equal(miniMaxM2PolicyCue?.tone, 'context', 'Static MiniMax M2 fallback policy should be context-toned');
assert.equal(miniMaxM2PolicyCue?.stale, false, 'Static MiniMax M2 fallback policy should not be styled as stale learning evidence');
assert.match(
  miniMaxM2PolicyCue?.ariaLabel || '',
  /fallback.*M3 is absent, filtered, or on a different provider/i,
  'MiniMax M2 policy cue should explain why the older MiniMax lane may still be usable',
);

const glmRiskPolicyCue = buildAutoRouterCandidateEvidence(learningSummary({
  toolReliability: toolReliability({
    byModel: {
      'z-ai-zhipu:glm-5.2': bucket({ total: 5, error: 2, runs: 3, firstCallErrors: 1 }),
    },
  }),
}), 'z-ai-zhipu:glm-5.2');
assert.equal(
  glmRiskPolicyCue?.text,
  'Evidence: Policy GLM-5.2 patient partner · Tool 2/5',
  'Prompt Microscope should prepend GLM-5.2 policy context while preserving compact learned-risk evidence',
);
assert.equal(glmRiskPolicyCue?.tone, 'risk', 'Policy context must not downgrade fresh learned risk evidence');
assert.match(
  glmRiskPolicyCue?.ariaLabel || '',
  /static prompt policy.*model-specific tool reliability 2 errors from 5 traced tool calls/i,
  'Policy plus learned-risk cues should keep both evidence sources in accessible detail',
);

const summary = learningSummary({
  bestByTaskType: [
    { taskType: 'execute', model: 'qwen:qwen3-coder', total: 8, success: 7, rate: 0.875, sampleCount: 8, firstSeenAt: '2026-06-20T00:00:00.000Z', lastSeenAt: '2026-06-28T12:34:56.000Z' },
    { taskType: 'investigate', model: 'minimax:MiniMax-M3', total: 3, success: 3, rate: 1, sampleCount: 3, firstSeenAt: '2026-06-21T00:00:00.000Z', lastSeenAt: '2026-06-22T00:00:00.000Z' },
    { taskType: 'compare', model: 'global-other-model', total: 6, success: 4, rate: 0.667, sampleCount: 6, firstSeenAt: '2026-06-19T00:00:00.000Z', lastSeenAt: '2026-06-25T00:00:00.000Z' },
  ],
  toolReliability: toolReliability({
    byModel: {
      'qwen:qwen3-coder': bucket({ total: 10, error: 2, runs: 4, firstCallErrors: 1 }),
      'global-other-model': bucket({ total: 99, error: 88, runs: 20 }),
    },
    byPromptStrategy: {
      'qwen-xml-code-v1': bucket({ total: 4, error: 1, runs: 3, firstCallErrors: 1 }),
      'minimax-long-context-agent-v1': bucket({ total: 8, error: 0, runs: 4 }),
    },
    byPromptStrategyVariant: {
      'qwen-xml-code-v1:qwen-coder-tool-proof': bucket({ total: 3, error: 2, runs: 2, firstCallErrors: 2 }),
      'qwen-xml-code-v1:qwen-reviewer-findings': bucket({ total: 2, error: 1, runs: 2 }),
      'qwen-xml-code-v1:qwen-cold-start': bucket({ total: 1, error: 1, runs: 1 }),
    },
    outcomeExamples: [
      {
        evidenceSource: 'saved_session_trace',
        sessionId: 'session-qwen',
        runId: 'run-qwen',
        failedModel: 'qwen:qwen3-coder',
        failedProviderId: 'qwen',
        failedTool: 'read_file',
        promptStrategyId: 'qwen-xml-code-v1',
        promptStrategyVariantId: 'qwen-coder-tool-proof',
        outcome: 'recovered_tool_path',
        workedBy: {
          model: 'qwen:qwen3-coder',
          providerId: 'qwen',
          tool: 'list_directory',
          round: 2,
          durationMs: 31,
        },
        finalStatus: 'complete',
        finalAnswerCaptured: true,
        recoveryRounds: 1,
        retryDistance: 1,
        timestamp: '2026-06-27T00:00:00.000Z',
      },
      {
        evidenceSource: 'saved_session_trace',
        sessionId: 'session-other',
        runId: 'run-other',
        failedModel: 'global-other-model',
        failedProviderId: 'global',
        failedTool: 'write_file',
        outcome: 'unrecovered_error',
        finalStatus: 'error',
        finalAnswerCaptured: false,
        recoveryRounds: 0,
        retryDistance: 0,
        timestamp: '2026-06-27T00:01:00.000Z',
      },
    ],
    retryReductionRecommendations: [
      {
        evidenceSource: 'saved_session_trace',
        tuningAction: 'tune_local_router',
        sessionId: 'session-qwen',
        runId: 'run-qwen',
        failedModel: 'qwen:qwen3-coder',
        failedProviderId: 'qwen',
        failedTool: 'read_file',
        promptStrategyId: 'qwen-xml-code-v1',
        promptStrategyVariantId: 'qwen-coder-tool-proof',
        outcome: 'recovered_tool_path',
        avoidPath: 'qwen:qwen3-coder/read_file',
        preferPath: 'qwen:qwen3-coder/list_directory',
        avoidProviderPath: 'qwen:qwen:qwen3-coder/read_file',
        preferProviderPath: 'qwen:qwen:qwen3-coder/list_directory',
        supportRunCount: 1,
        supportSessionIds: ['session-qwen'],
        supportRunIds: ['run-qwen'],
        evidenceConfidence: 'single_trace',
        avgRetryDistance: 1,
        retryDistance: 1,
        recommendation: 'Prefer qwen:qwen3-coder/list_directory before repeating qwen:qwen3-coder/read_file.',
        tuningGuidance: 'Local saved-session evidence can tune the local router after review.',
        timestamp: '2026-06-27T00:00:00.000Z',
      },
      {
        evidenceSource: 'saved_session_trace',
        tuningAction: 'review_before_tuning',
        sessionId: 'session-other',
        runId: 'run-other',
        failedModel: 'global-other-model',
        failedProviderId: 'global',
        failedTool: 'write_file',
        outcome: 'unrecovered_error',
        avoidPath: 'global-other-model/write_file',
        preferPath: 'global-other-model/read_file',
        avoidProviderPath: 'global:global-other-model/write_file',
        preferProviderPath: 'global:global-other-model/read_file',
        supportRunCount: 1,
        supportSessionIds: ['session-other'],
        supportRunIds: ['run-other'],
        evidenceConfidence: 'single_trace',
        avgRetryDistance: 1,
        retryDistance: 1,
        recommendation: 'Other model recommendation should not render.',
        tuningGuidance: 'Other model guidance should not render.',
        timestamp: '2026-06-27T00:01:00.000Z',
      },
    ],
  }),
});

const qwenCue = buildAutoRouterCandidateEvidence(summary, 'qwen:qwen3-coder');
const indexedCueBuilder = createAutoRouterCandidateEvidenceBuilder(summary);
assert.deepEqual(
  indexedCueBuilder.forModel('qwen:qwen3-coder'),
  qwenCue,
  'Indexed candidate evidence builder should exactly match the existing one-shot builder for model, strategy, variant, recovery, and retry evidence',
);
assert.ok(qwenCue, 'Candidate evidence should be available when model or strategy evidence exists');
assert.equal(
  qwenCue?.text,
  'Evidence: RL execute 88%/8 · limited · routed=2026-06-28 · Tool 2/10 · Strategy qwen-xml-code-v1 1/4 · Variant qwen-coder-tool-proof 2/3 · Recovery read_file -> list_directory · Retry 1 run · Single trace',
  'Candidate cue should keep visible evidence compact while preserving action cue provenance, model, strategy, variant, recovery, retry, and trust signal',
);
assert.ok(
  (qwenCue?.text.length || 0) <= 210,
  'Candidate cue visible text should stay compact enough for the Prompt Microscope score row',
);
assert.match(
  qwenCue?.ariaLabel || '',
  /Routing Learning action cue for execute: advisory only; qwen:qwen3-coder handled execute at 88% across 8 reviewed outcomes/i,
  'Prompt Microscope candidate evidence should expose actionable Routing Learning cues as source-labeled advisory evidence',
);
assert.match(
  qwenCue?.ariaLabel || '',
  /confidence limited sample: only 8 reviewed execute outcomes support this cue/i,
  'Prompt Microscope candidate evidence should expose the shared confidence caveat for limited action cues',
);
assert.match(
  qwenCue?.ariaLabel || '',
  /Decision freshness: 8 reviewed routing decisions; first routed 2026-06-20, most recent routed 2026-06-28\. This is routing-decision age, not outcome-review age/i,
  'Prompt Microscope candidate evidence should expose freshness as decision-time context, not routing authority',
);
assert.doesNotMatch(
  qwenCue?.text || '',
  /\b(use|prefer|recommend|best)\b/i,
  'Routing Learning action cues should render as provenance, not as candidate-card recommendation copy',
);
assert.ok(
  !/single_trace|recovered_tool_path|session-qwen|run-qwen/i.test(qwenCue?.text || ''),
  'Candidate cue visible text should keep trace internals in the accessible detail instead of the compact row',
);
assert.equal(qwenCue?.tone, 'risk', 'Any model/strategy errors should mark the compact cue as risk-toned');
assert.match(qwenCue?.ariaLabel || '', /model-specific tool reliability 2 errors from 10 traced tool calls/i);
assert.match(qwenCue?.ariaLabel || '', /prompt strategy qwen-xml-code-v1 1 errors from 4 traced tool calls/i);
assert.match(qwenCue?.ariaLabel || '', /risky prompt variant qwen-xml-code-v1:qwen-coder-tool-proof 2 errors from 3 traced tool calls/i);
assert.match(
  qwenCue?.ariaLabel || '',
  /recovered_tool_path|retry distance 1/i,
  'Candidate cue aria label should retain the full session-outcome recovery evidence for the matching model',
);
assert.match(
  qwenCue?.ariaLabel || '',
  /single_trace|supported by 1 run/i,
  'Candidate cue aria label should retain retry-reduction confidence and support detail for the matching model',
);
assert.match(
  qwenCue?.ariaLabel || '',
  /session outcome saved_session_trace session session-qwen run run-qwen: qwen:qwen3-coder\/read_file recovered by qwen:qwen3-coder\/list_directory with retry distance 1/i,
  'Candidate cue aria label should preserve evidence source and provider-qualified recovery breadcrumbs',
);
assert.match(
  qwenCue?.ariaLabel || '',
  /retry-reduction recommendation from saved_session_trace with single_trace confidence: prefer qwen:qwen3-coder\/list_directory over qwen:qwen3-coder\/read_file, supported by 1 run/i,
  'Candidate cue aria label should preserve retry-reduction confidence and support count',
);
assert.match(
  qwenCue?.ariaLabel || '',
  /trust signal single trace/i,
  'Candidate cue aria label should explain why single-run retry evidence is weak enough to verify before tuning',
);
assert.ok(
  !qwenCue?.text.includes('qwen-cold-start'),
  'Riskiest variant should ignore cold-start buckets below the minimum sample threshold',
);
assert.ok(
  !qwenCue?.text.includes('global-other-model'),
  'Candidate cue should not leak unrelated global or different-model evidence into the row',
);
assert.ok(
  !qwenCue?.text.includes('write_file'),
  'Candidate cue should not leak unrelated model outcome or retry evidence into the row',
);
assert.ok(
  !candidateEvidenceToneSource.includes("parts.some((part) => !part.includes(' 0/')"),
  'Candidate evidence tone should be derived from evidence source flags, not parsed display text',
);
assert.ok(
  candidateEvidenceToneSource.includes('riskParts.push('),
  'Candidate evidence should track risk structurally as evidence parts are added',
);

assert.equal(
  buildAutoRouterCandidateEvidence(learningSummary({
    bestByTaskType: [
      { taskType: 'execute', model: 'qwen:qwen3-coder', total: 15, success: 14, rate: 0.933, sampleCount: 15, firstSeenAt: '2020-01-01T00:00:00.000Z', lastSeenAt: '2020-01-05T00:00:00.000Z' },
    ],
  }), 'qwen:qwen3-coder', { nowMs: Date.parse('2020-01-10T00:00:00.000Z') })?.text,
  'Evidence: RL execute 93%/15 · routed=2020-01-05',
  'Prompt Microscope candidate evidence should accept an injected freshness clock for deterministic fresh-cue tests',
);
const staleWithheldCue = createAutoRouterCandidateEvidenceBuilder(learningSummary({
    bestByTaskType: [
      { taskType: 'execute', model: 'qwen:qwen3-coder', total: 15, success: 14, rate: 0.933, sampleCount: 15, firstSeenAt: '2020-01-01T00:00:00.000Z', lastSeenAt: '2020-01-05T00:00:00.000Z' },
    ],
  }), { nowMs: Date.parse('2020-02-10T00:00:00.000Z') }).forModel('qwen:qwen3-coder');
assert.equal(
  staleWithheldCue?.text,
  'Evidence: Stale RL context withheld · last routed=2020-01-05 · >30d',
  'Prompt Microscope candidate evidence should explain when stale Routing Learning winners are withheld from candidate evidence',
);
assert.equal(staleWithheldCue?.tone, 'context', 'Withheld stale routing evidence should be context-toned, not risk-toned');
assert.equal(staleWithheldCue?.stale, true, 'Withheld stale routing evidence should use stale evidence styling');
assert.match(
  staleWithheldCue?.ariaLabel || '',
  /stale Routing Learning context withheld from scoring annotation because it is stale/i,
  'Withheld stale routing evidence should explain that it is diagnostic context, not routing authority',
);
assert.doesNotMatch(
  staleWithheldCue?.ariaLabel || '',
  /Routing Learning action cue for execute/i,
  'Withheld stale routing evidence should not use action-cue wording that sounds authoritative',
);
const multiStaleCue = createAutoRouterCandidateEvidenceBuilder(learningSummary({
  bestByTaskType: [
    { taskType: 'execute', model: 'qwen:qwen3-coder', total: 15, success: 14, rate: 0.933, sampleCount: 15, firstSeenAt: '2020-01-01T00:00:00.000Z', lastSeenAt: '2020-01-05T00:00:00.000Z' },
    { taskType: 'direct', model: 'qwen:qwen3-coder', total: 12, success: 11, rate: 0.917, sampleCount: 12, firstSeenAt: '2020-01-03T00:00:00.000Z', lastSeenAt: '2020-01-08T00:00:00.000Z' },
  ],
}), { nowMs: Date.parse('2020-02-10T00:00:00.000Z') }).forModel('qwen:qwen3-coder');
assert.equal(
  multiStaleCue?.text,
  'Evidence: 2 stale RL contexts withheld · last routed=2020-01-08 · >30d',
  'Prompt Microscope should collapse multiple stale Routing Learning winners into one compact context cue',
);
assert.equal(multiStaleCue?.tone, 'context', 'Collapsed stale routing evidence should stay context-toned when no fresh risk evidence exists');
assert.equal(multiStaleCue?.stale, true, 'Collapsed stale routing evidence should keep stale evidence styling');
assert.match(
  multiStaleCue?.ariaLabel || '',
  /2 stale Routing Learning contexts withheld from scoring annotation because they are stale/i,
  'Collapsed stale routing evidence should explain all stale task wins are diagnostic context only',
);
assert.match(
  multiStaleCue?.ariaLabel || '',
  /execute 93%\/15; direct 92%\/12/i,
  'Collapsed stale routing evidence should preserve the affected task types in accessible detail',
);

const reviewFirstCue = buildAutoRouterCandidateEvidence(summary, 'global-other-model');
assert.ok(reviewFirstCue, 'Candidate evidence should render for a model with review-required retry evidence');
assert.match(
  reviewFirstCue?.text || '',
  /Review first/,
  'Candidate cue should visibly flag retry evidence that requires review before router tuning',
);
assert.ok(
  !reviewFirstCue?.text.includes('Single trace'),
  'Review-required retry evidence should prefer the review-first trust label over the generic single-trace label',
);
assert.match(
  reviewFirstCue?.ariaLabel || '',
  /trust signal review first/i,
  'Candidate cue aria label should explain review-before-tuning retry evidence',
);

const cleanStrategyCue = buildAutoRouterCandidateEvidence(summary, 'minimax:MiniMax-M3');
assert.deepEqual(
  indexedCueBuilder.forModel('minimax:MiniMax-M3'),
  cleanStrategyCue,
  'Indexed candidate evidence builder should preserve strategy-only candidate evidence',
);
assert.equal(
  cleanStrategyCue?.text,
  'Evidence: Policy MiniMax M3 preferred · Strategy minimax-long-context-agent-v1 0/8',
  'Learning/context-only task-type winners should not render as Prompt Microscope action cues while preserving MiniMax M3 policy context',
);
assert.equal(cleanStrategyCue?.tone, 'ok');
assert.doesNotMatch(
  cleanStrategyCue?.ariaLabel || '',
  /Routing Learning action cue/i,
  'Prompt Microscope should render only actionable Routing Learning winners as candidate evidence',
);

const staleCue = buildAutoRouterCandidateEvidence({ ...summary, outdated: true }, 'qwen:qwen3-coder');
assert.deepEqual(
  createAutoRouterCandidateEvidenceBuilder({ ...summary, outdated: true }).forModel('qwen:qwen3-coder'),
  staleCue,
  'Indexed candidate evidence builder should preserve stale-learning visible and aria detail',
);
assert.ok(staleCue?.text.includes('Learning stale'), 'Outdated router learning summaries should be visible in compact candidate evidence');
assert.equal(staleCue?.stale, true, 'Candidate evidence should expose server-provided outdated state without re-deriving it');
assert.match(staleCue?.ariaLabel || '', /router learning summary is marked outdated/i);
assert.ok(
  !qwenCue?.text.includes('Learning stale'),
  'Fresh router learning summaries should not render stale evidence wording',
);

assert.equal(buildAutoRouterCandidateEvidence(null, 'qwen:qwen3-coder'), null);
assert.equal(
  createAutoRouterCandidateEvidenceBuilder(null).forModel('qwen:qwen3-coder'),
  null,
  'Indexed candidate evidence builder should preserve null-summary behavior',
);
assert.equal(buildAutoRouterCandidateEvidence(learningSummary(), 'qwen:qwen3-coder'), null);
assert.equal(
  buildAutoRouterCandidateEvidence(learningSummary({
    toolReliability: toolReliability({
      byModel: { 'qwen:qwen3-coder': bucket({ total: 1, error: 1, runs: 1 }) },
    }),
  }), 'qwen:qwen3-coder'),
  null,
  'Evidence below the minimum sample threshold should not render misleading 1/1 cues',
);
assert.equal(
  createAutoRouterCandidateEvidenceBuilder(learningSummary({
    toolReliability: toolReliability({
      byModel: { 'qwen:qwen3-coder': bucket({ total: 1, error: 1, runs: 1 }) },
    }),
  })).forModel('qwen:qwen3-coder'),
  null,
  'Indexed candidate evidence builder should preserve the minimum sample threshold',
);

let now = 1000;
let calls = 0;
const loaded: RouterLearningSummary[] = [
  learningSummary({ totalEvents: 1 }),
  learningSummary({ totalEvents: 2 }),
];
const loader = createRouterLearningSummaryLoader(async () => {
  calls += 1;
  return loaded[calls - 1] || learningSummary({ totalEvents: calls });
}, {
  now: () => now,
  ttlMs: ROUTER_LEARNING_SUMMARY_TTL_MS,
});

const firstLoad = await loader.load();
const secondLoad = await loader.load();
assert.equal(calls, 1, 'Router learning summary loader should reuse cached summary within the TTL');
assert.equal(firstLoad.totalEvents, 1);
assert.equal(secondLoad.totalEvents, 1);

now += ROUTER_LEARNING_SUMMARY_TTL_MS + 1;
const thirdLoad = await loader.load();
assert.equal(calls, 2, 'Router learning summary loader should refresh after the TTL elapses');
assert.equal(thirdLoad.totalEvents, 2);

let slowResolve: ((summary: RouterLearningSummary) => void) | undefined;
let slowCalls = 0;
const slowLoader = createRouterLearningSummaryLoader(() => {
  slowCalls += 1;
  return new Promise<RouterLearningSummary>((resolve) => {
    slowResolve = resolve;
  });
});
const pendingA = slowLoader.load();
const pendingB = slowLoader.load();
slowResolve?.(learningSummary({ totalEvents: 7 }));
assert.equal((await pendingA).totalEvents, 7);
assert.equal((await pendingB).totalEvents, 7);
assert.equal(slowCalls, 1, 'Concurrent router learning requests should share one in-flight summary fetch');

const componentSource = readFileSync('src/components/PromptMicroscope.tsx', 'utf8');
for (const expected of [
  'createAutoRouterCandidateEvidenceBuilder',
  'const [routerLearningSummary, setRouterLearningSummary] = useState<api.RouterLearningSummary | null>(null)',
  "const [routerLearningSummaryStatus, setRouterLearningSummaryStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle')",
  'createRouterLearningSummaryLoader(() => api.getRouterLearning())',
  "setRouterLearningSummaryStatus('idle')",
  "setRouterLearningSummaryStatus('loading')",
  'routerLearningSummaryLoader.load().then((summary) => {',
  "setRouterLearningSummaryStatus('ready')",
  "setRouterLearningSummaryStatus('unavailable')",
  'const routerLearningEvidenceStatusLabel = routerLearningSummaryStatus === \'loading\'',
  'Router learning evidence loading',
  'Router learning evidence unavailable',
  'pm-router-learning-status',
  'Router learning evidence status:',
  'const candidateEvidenceBuilder = useMemo(() => (',
  'autoRouterScores.length > 0 ? createAutoRouterCandidateEvidenceBuilder(routerLearningSummary) : null',
  '), [autoRouterScores.length, routerLearningSummary])',
  'candidateEvidenceByModel',
  'if (!candidateEvidenceBuilder) return byModel',
  'candidateEvidenceBuilder.forModel(model)',
  'const candidateEvidence = candidateEvidenceByModel.get(model)',
  'pm-evidence-cue',
  'candidateEvidence.stale ? \' pm-evidence-cue-stale\' : \'\'',
  'aria-label={row.candidateEvidence.ariaLabel}',
  'title={row.candidateEvidence.ariaLabel}',
  'tabIndex={0}',
  'function buildAutoRouterCandidateRows({',
  'const autoRouterCandidateRows = useMemo(() => buildAutoRouterCandidateRows({',
  'candidateScores: autoRouterScores',
  'selectedModelId: autoRouterStep?.modelId || null',
  'candidateEvidenceByModel',
  'const scoreLabel = formatScoreDisplay(score)',
  'ariaLabel: `${decisionLabel} ${model}, classifier score ${scoreLabel}${candidateEvidence ? `. ${candidateEvidence.ariaLabel}` : \'\'}`',
  'autoRouterCandidateRows.map((row) =>',
  'aria-label={row.ariaLabel}',
  '{row.scoreLabel}',
]) {
  assert.ok(componentSource.includes(expected), `Prompt Microscope should wire compact candidate evidence: ${expected}`);
}
assert.ok(
  !componentSource.includes('role="note"'),
  'Prompt Microscope evidence cues should not add repeated note roles for dense candidate rows',
);
assert.ok(
  !componentSource.includes('Router learning evidence ready'),
  'Prompt Microscope should keep ready router-learning evidence silent so candidate cues remain the happy-path signal',
);

const candidateEvidenceSource = readFileSync('src/utils/autoRouterCandidateEvidence.ts', 'utf8');
assert.ok(
  candidateEvidenceSource.includes("from './promptStrategyResolver'"),
  'Prompt Microscope candidate evidence should use the shared prompt strategy resolver',
);
assert.ok(
  candidateEvidenceSource.includes('miniMaxM3PreferencePolicyLabel')
    && candidateEvidenceSource.includes('miniMaxM3PreferencePolicyDetail')
    && candidateEvidenceSource.includes('miniMaxM2FallbackPolicyLabel')
    && candidateEvidenceSource.includes('miniMaxM2FallbackPolicyDetail'),
  'Prompt Microscope MiniMax policy evidence should use shared MiniMax policy copy helpers',
);
for (const localMiniMaxPolicyLiteral of [
  "text: 'Policy MiniMax M3 preferred'",
  "text: 'Policy MiniMax M2 fallback'",
  'MiniMax M3 is preferred over same-provider MiniMax M2.x',
  'older MiniMax M2.x remains a fallback',
]) {
  assert.ok(
    !candidateEvidenceSource.includes(localMiniMaxPolicyLiteral),
    `Prompt Microscope MiniMax policy evidence should not own shared MiniMax copy locally: ${localMiniMaxPolicyLiteral}`,
  );
}
for (const expected of [
  'interface IndexedRoutingActionCue',
  'interface IndexedToolReliabilityEntry',
  'interface IndexedToolReliabilityOutcome',
  'interface IndexedRetryRecommendation',
  'normalizedModelKey: string',
  'function normalizedModelKeysMatch',
  'const normalizedModelKey = normalizeModelKey(modelId)',
  'candidateActionCues(index, normalizedModelKey)',
  'candidateStaleActionCues(index, normalizedModelKey)',
  'candidateToolBucket(index, normalizedModelKey)',
  'latestOutcomeForCandidate(index, normalizedModelKey)',
  'latestRetryRecommendationForCandidate(index, normalizedModelKey)',
]) {
  assert.ok(candidateEvidenceSource.includes(expected), `Prompt Microscope candidate evidence should pre-normalize hot candidate lookup data: ${expected}`);
}
for (const removedPattern of [
  'candidateActionCues(index, modelId)',
  'candidateStaleActionCues(index, modelId)',
  'candidateToolBucket(index, modelId)',
  'latestOutcomeForCandidate(index, modelId)',
  'latestRetryRecommendationForCandidate(index, modelId)',
]) {
  assert.ok(
    !candidateEvidenceSource.includes(removedPattern),
    `Prompt Microscope candidate evidence should avoid repeated raw model-key normalization in hot candidate lookup: ${removedPattern}`,
  );
}
assert.ok(
  !candidateEvidenceSource.includes('PROMPT_STRATEGY_MODEL_HINTS'),
  'Prompt Microscope candidate evidence should not keep a second local model-to-strategy hint table',
);

const settingsSource = readFileSync('src/components/SettingsModal.tsx', 'utf8');
assert.ok(
  settingsSource.includes("from '../utils/promptStrategyResolver'"),
  'Settings auto-router evidence should use the shared prompt strategy resolver',
);
assert.ok(
  settingsSource.includes("import { createAutoRouterCandidateEvidenceBuilder, routerModelKeysMatch } from '../utils/autoRouterCandidateEvidence'"),
  'Settings auto-router evidence should reuse the shared compact candidate evidence indexed builder and model-key matcher',
);
assert.ok(
  settingsSource.includes('const routerCandidateEvidenceBuilder = useMemo(() => createAutoRouterCandidateEvidenceBuilder(routerLearningSummary), [routerLearningSummary])'),
  'Settings auto-router evidence should create one indexed evidence builder per router-learning summary',
);
assert.ok(
  settingsSource.includes('const routerCandidateEvidence = routerCandidateEvidenceBuilder.forModel(c.modelId)'),
  'Settings auto-router candidate rows should derive compact evidence through the indexed builder',
);
for (const expected of [
  'routerModelKeysMatch(modelId, model)',
  'routerModelKeysMatch(modelId, example.firstError.model)',
  'routerModelKeysMatch(modelId, recommendation.failedModel)',
  'routerModelKeysMatch(candidateModelId, recommendationModelId)',
  'routerModelKeysMatch(modelId, modelPart)',
]) {
  assert.ok(settingsSource.includes(expected), `Settings router evidence should share model-key matching with compact candidate evidence: ${expected}`);
}
assert.ok(
  !settingsSource.includes('normalized === candidateKey || normalized.endsWith(candidateKey) || candidateKey.endsWith(normalized)'),
  'Settings router evidence helpers should not keep a duplicate provider-prefix matcher',
);
for (const expected of [
  'settings-router-evidence-cue',
  'routerCandidateEvidence.stale ? \' pm-evidence-cue-stale\' : \'\'',
  'aria-label={routerCandidateEvidence.ariaLabel}',
  'title={routerCandidateEvidence.ariaLabel}',
  'tabIndex={0}',
  '{routerCandidateEvidence.text}',
  'Tool reliability · {toolReliability.error}/{toolReliability.total}',
]) {
  assert.ok(settingsSource.includes(expected), `Settings auto-router candidate rows should preserve compact evidence affordance: ${expected}`);
}
assert.ok(
  !settingsSource.includes('Tool {toolReliability.error}/{toolReliability.total}'),
  'Settings auto-router candidate rows should replace the standalone tool-count badge with the shared compact cue to avoid duplicate tool counts',
);
assert.ok(
  !settingsSource.includes('PROMPT_STRATEGY_MODEL_HINTS'),
  'Settings auto-router evidence should not keep a second local model-to-strategy hint table',
);

const cssSource = readFileSync('src/styles/components.css', 'utf8');
for (const expected of [
  '.pm-evidence-cue',
  '.pm-evidence-cue-risk',
  '.pm-evidence-cue-ok',
  '.pm-evidence-cue-context',
  '.pm-evidence-cue-stale',
  '.pm-evidence-cue:focus-visible',
  '.pm-router-learning-status',
  '.pm-router-learning-status-unavailable',
]) {
  assert.ok(cssSource.includes(expected), `Prompt Microscope candidate evidence CSS should include ${expected}`);
}

const packageSource = readFileSync('package.json', 'utf8');
assert.ok(packageSource.includes('test:prompt-microscope-candidate-evidence'), 'package.json should expose the candidate-evidence test');
assert.ok(
  packageSource.includes('npm run test:prompt-microscope-candidate-evidence && npm run test:prompt-microscope-router-explanation'),
  'Premier no-spend should include candidate evidence before router explanation coverage',
);

console.log('Prompt Microscope candidate evidence checks passed.');
