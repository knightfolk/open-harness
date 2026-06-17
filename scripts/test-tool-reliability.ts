import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildRetryReductionRecommendations, buildToolReliabilitySummary, normalizeToolStatus } from '../server/toolReliability';
import { annotateCandidatesWithToolReliability } from '../server/autoRouter';
import type { HarnessRun, HarnessRunStep } from '../server/runTrace';

function run(id: string, status: HarnessRun['status'], steps: HarnessRunStep[]): HarnessRun {
  return {
    id,
    sessionId: 'session-1',
    userMessageId: `${id}-user`,
    role: 'coder',
    requestedModel: 'Auto',
    effectiveModel: id.includes('fallback') ? 'fallback-model' : 'primary-model',
    providerId: id.includes('providerless') ? 'fallback-provider' : 'primary-provider',
    status,
    startedAt: `2026-06-17T00:00:0${id.length % 9}.000Z`,
    completedAt: `2026-06-17T00:00:1${id.length % 9}.000Z`,
    context: { tokensUsed: 0, budget: 0, compressedCount: 0, summarized: false },
    steps,
  };
}

const promptBuiltStep = {
  type: 'prompt_built',
  promptPreview: 'strategy prompt',
  toolCount: 3,
  assembly: {
    promptStrategy: {
      id: 'qwen-xml-code-v1',
      variantId: 'qwen-coder-tool-proof',
    },
  },
} as unknown as HarnessRunStep;

const recoveredRun = run('recovered-run', 'complete', [
  promptBuiltStep,
  {
    type: 'tool_call',
    id: 'tool-1',
    name: 'read_file',
    input: { path: 'missing.ts' },
    status: 'error',
    error: 'ENOENT',
    outputPreview: 'Error: ENOENT',
    durationMs: 20,
    model: 'primary-model',
    providerId: 'primary-provider',
    round: 0,
  },
  {
    type: 'tool_call',
    id: 'tool-2',
    name: 'list_directory',
    input: { path: '.' },
    status: 'complete',
    outputPreview: 'src',
    durationMs: 40,
    model: 'primary-model',
    providerId: 'primary-provider',
    round: 1,
  },
  { type: 'final_answer', chars: 120 },
]);

const failedRun = run('failed-run', 'error', [
  promptBuiltStep,
  {
    type: 'tool_call',
    id: 'tool-3',
    name: 'write_file',
    input: { path: '/blocked' },
    status: 'error',
    error: 'permission denied',
    durationMs: 10,
    model: 'primary-model',
    providerId: 'primary-provider',
    round: 0,
  },
  { type: 'error', message: 'permission denied' },
]);

const mixedRun = run('providerless-fallback-run', 'complete', [
  {
    type: 'tool_call',
    id: 'tool-4',
    name: 'read_file',
    input: { path: 'README.md' },
    outputPreview: 'OpenHarness',
    durationMs: 30,
  },
  {
    type: 'tool_call',
    id: 'tool-5',
    name: 'read_file',
    input: { path: 'README.md' },
    status: 'skipped',
    outputPreview: 'duplicate',
    durationMs: 0,
  },
  {
    type: 'tool_call',
    id: 'tool-6',
    name: 'search',
    input: { q: 'routing' },
  },
  { type: 'final_answer', chars: 80 },
]);

const summary = buildToolReliabilitySummary([
  {
    id: 'session-1',
    messages: [
      { timestamp: '2026-06-17T00:01:00.000Z', runTrace: recoveredRun },
      { timestamp: '2026-06-17T00:02:00.000Z', runTrace: failedRun },
      { timestamp: '2026-06-17T00:03:00.000Z', runTrace: mixedRun },
      { timestamp: '2026-06-17T00:04:00.000Z' },
    ],
  },
]);

assert.equal(summary.totalToolCalls, 6, 'should count every tool call');
assert.equal(summary.completedToolCalls, 2, 'should infer legacy duration tool call as complete');
assert.equal(summary.errorToolCalls, 2, 'should count explicit error tool calls');
assert.equal(summary.skippedToolCalls, 1, 'should count skipped tool calls');
assert.equal(summary.runningToolCalls, 1, 'should infer legacy no-duration tool call as running');
assert.equal(summary.runsWithToolCalls, 3, 'should count runs that issued at least one tool call');
assert.equal(summary.firstCallErrorRuns, 2, 'should count runs whose first tool call failed');
assert.equal(summary.runsWithToolErrors, 2, 'should count runs with at least one tool error');
assert.equal(summary.recoveredRunsWithToolErrors, 1, 'should count error runs that reached a final answer');
assert.equal(summary.avgRecoveryRounds, 1, 'should average tool rounds needed after first tool error');
assert.equal(summary.recoveryExamples.length, 1, 'should capture recovered error-run paths');
assert.equal(summary.recoveryExamples[0].firstError.model, 'primary-model', 'recovery example should include the model that produced the first tool error');
assert.equal(summary.recoveryExamples[0].evidenceSource, 'saved_session_trace', 'recovery examples should identify saved session traces as their evidence source');
assert.equal(summary.recoveryExamples[0].sessionId, 'session-1', 'recovery examples should stay tied to the saved session that produced them');
assert.equal(summary.recoveryExamples[0].runId, 'recovered-run', 'recovery examples should stay tied to the run trace that produced them');
assert.equal(summary.recoveryExamples[0].promptStrategyId, 'qwen-xml-code-v1', 'recovery examples should preserve prompt strategy context');
assert.equal(summary.recoveryExamples[0].promptStrategyVariantId, 'qwen-coder-tool-proof', 'recovery examples should preserve prompt strategy variant context');
assert.equal(summary.recoveryExamples[0].firstError.tool, 'read_file', 'recovery example should include the first failed tool');
assert.equal(summary.recoveryExamples[0].recoveredBy[0].tool, 'list_directory', 'recovery example should include the later successful tool');
assert.equal(summary.recoveryExamples[0].recoveredBy[0].model, 'primary-model', 'recovery example should include the model that ultimately completed a later tool call');
assert.equal(summary.recoveryExamples[0].finalAnswerCaptured, true, 'recovery example should show whether the session reached a final answer');
assert.equal(summary.recoveryExamples[0].recoveryRounds, 1, 'recovery example should preserve retry/recovery round distance');
assert.equal(summary.outcomeExamples.length, 2, 'should capture session outcomes for recovered and unrecovered tool-error runs');
assert.equal(summary.outcomeExamples[0].failedTool, 'write_file', 'newest outcome should describe the latest failed tool');
assert.equal(summary.outcomeExamples[0].outcome, 'unrecovered_error', 'unrecovered tool-error runs should be explicit');
assert.equal(summary.outcomeExamples[1].failedTool, 'read_file', 'older outcome should preserve the recovered failed tool');
assert.equal(summary.outcomeExamples[1].outcome, 'recovered_tool_path', 'same-model later tool success should be marked as a recovered tool path');
assert.equal(summary.outcomeExamples[1].evidenceSource, 'saved_session_trace', 'outcome mining should identify saved session traces as the evidence source');
assert.equal(summary.outcomeExamples[1].sessionId, 'session-1', 'outcome mining should preserve the saved session id for log/session review');
assert.equal(summary.outcomeExamples[1].runId, 'recovered-run', 'outcome mining should preserve the run id for log/session review');
assert.equal(summary.outcomeExamples[1].workedBy?.tool, 'list_directory', 'outcome should record what ultimately worked after the tool error');
assert.equal(summary.outcomeExamples[1].promptStrategyVariantId, 'qwen-coder-tool-proof', 'outcome should preserve prompt strategy variant context');
assert.equal(summary.outcomeExamples[1].retryDistance, 1, 'outcome should preserve retry distance from failed tool to working path');
assert.equal(summary.recoveryPatterns.length, 1, 'should aggregate recurring recovery paths');
assert.equal(summary.recoveryPatterns[0].failedModel, 'primary-model', 'recovery pattern should include failed model');
assert.equal(summary.recoveryPatterns[0].failedTool, 'read_file', 'recovery pattern should include failed first tool');
assert.equal(summary.recoveryPatterns[0].failedProviderId, 'primary-provider', 'recovery pattern should include failed provider');
assert.equal(summary.recoveryPatterns[0].recoveredByTool, 'list_directory', 'recovery pattern should include the tool that worked later');
assert.equal(summary.recoveryPatterns[0].recoveredByProviderId, 'primary-provider', 'recovery pattern should include the provider path of the recovered tool');
assert.equal(summary.recoveryPatterns[0].runs, 1, 'recovery pattern should count matching runs');
assert.equal(summary.recoveryPatterns[0].finalAnswerRuns, 1, 'recovery pattern should count final-answer recoveries');
assert.equal(summary.recoveryPatterns[0].avgRecoveryRounds, 1, 'recovery pattern should average retry rounds');
assert.deepEqual(summary.recoveryPatterns[0].exampleSessionIds, ['session-1'], 'recovery pattern should keep example session ids for saved session inspection');
assert.deepEqual(summary.recoveryPatterns[0].exampleRunIds, ['recovered-run'], 'recovery pattern should keep example run ids for saved run inspection');
assert.deepEqual(summary.recoveryPatterns[0].exampleEvidenceSources, ['saved_session_trace'], 'recovery pattern should keep the evidence source behind saved run inspection');
assert.equal(summary.failureMemory.length, 2, 'should build model failure memory for each failed model/tool path');
assert.equal(summary.failureMemory[0].model, 'primary-model', 'failure memory should include failed model');
assert.equal(summary.failureMemory[0].tool, 'write_file', 'unrecovered failures should sort first');
assert.equal(summary.failureMemory[0].unrecoveredRuns, 1, 'failure memory should count unrecovered failures');
assert.equal(summary.failureMemory[1].tool, 'read_file', 'recovered failures should remain visible');
assert.equal(summary.failureMemory[1].recoveredRuns, 1, 'failure memory should count recovered runs');
assert.equal(summary.failureMemory[1].fixedBy[0].tool, 'list_directory', 'failure memory should record what fixed the failed tool path');
assert.equal(summary.failureMemory[1].fixedBy[0].avgRecoveryRounds, 1, 'failure memory should preserve the retry cost of the working path');
assert.deepEqual(summary.failureMemory[1].exampleSessionIds, ['session-1'], 'failure memory should keep example session ids for saved session inspection');
assert.deepEqual(summary.failureMemory[1].exampleRunIds, ['recovered-run'], 'failure memory should keep example run ids for session/log inspection');
assert.deepEqual(summary.failureMemory[1].exampleEvidenceSources, ['saved_session_trace'], 'failure memory should keep the evidence source for session/log inspection');
assert.deepEqual(summary.failureMemory[1].exampleSessionIds, summary.recoveryPatterns[0].exampleSessionIds, 'failure memory should inherit saved-session breadcrumbs from recovery patterns');
assert.equal(summary.failureMemory[1].promptStrategies[0].id, 'qwen-xml-code-v1', 'failure memory should preserve prompt strategy context');
assert.equal(summary.failureMemory[1].promptStrategyVariants[0].id, 'qwen-coder-tool-proof', 'failure memory should preserve prompt strategy variant context');
assert.equal(summary.errorSignatures.length, 2, 'should group recurring tool errors by normalized error signature');
assert.equal(summary.errorSignatures[0].tool, 'write_file', 'unrecovered signatures should sort first');
assert.equal(summary.errorSignatures[0].signature, 'permission denied', 'signatures should preserve normalized error causes');
assert.equal(summary.errorSignatures[0].unrecoveredRuns, 1, 'signature memory should count unrecovered runs');
assert.equal(summary.errorSignatures[1].tool, 'read_file', 'recovered signatures should remain visible');
assert.equal(summary.errorSignatures[1].signature, 'enoent', 'signature memory should normalize error prefixes and casing');
assert.equal(summary.errorSignatures[1].recoveredRuns, 1, 'signature memory should count recovered runs');
assert.equal(summary.errorSignatures[1].workedBy[0].tool, 'list_directory', 'signature memory should record the follow-up tool that worked');
assert.equal(summary.errorSignatures[1].workedBy[0].avgRetryDistance, 1, 'signature memory should preserve average retry distance');
assert.deepEqual(summary.errorSignatures[1].exampleSessionIds, ['session-1'], 'signature memory should keep example session ids for saved session inspection');
assert.deepEqual(summary.errorSignatures[1].exampleRunIds, ['recovered-run'], 'signature memory should keep example run ids for session/log inspection');
assert.deepEqual(summary.errorSignatures[1].exampleEvidenceSources, ['saved_session_trace'], 'signature memory should keep the evidence source for session/log inspection');
assert.equal(summary.errorSignatures[1].promptStrategyVariants[0].id, 'qwen-coder-tool-proof', 'signature memory should preserve prompt strategy variant context');
assert.equal(summary.retryReductionRecommendations.length, 2, 'should derive retry-reduction recommendations from tool-error outcomes');
assert.equal(summary.retryReductionRecommendations[0].avoidPath, 'primary-model/read_file', 'recommendation should identify the failed first model/tool path');
assert.equal(summary.retryReductionRecommendations[0].preferPath, 'primary-model/list_directory', 'recommendation should identify the later working model/tool path');
assert.equal(summary.retryReductionRecommendations[0].avoidProviderPath, 'primary-provider:primary-model/read_file', 'recommendation should identify the failed provider/model/tool path');
assert.equal(summary.retryReductionRecommendations[0].preferProviderPath, 'primary-provider:primary-model/list_directory', 'recommendation should identify the later working provider/model/tool path');
assert.equal(summary.retryReductionRecommendations[0].retryDistance, 1, 'recommendation should preserve retry distance');
assert.equal(summary.retryReductionRecommendations[0].supportRunCount, 1, 'recommendation should preserve how many runs support the avoid/prefer path');
assert.deepEqual(summary.retryReductionRecommendations[0].supportSessionIds, ['session-1'], 'recommendation should preserve supporting session breadcrumbs');
assert.deepEqual(summary.retryReductionRecommendations[0].supportRunIds, ['recovered-run'], 'recommendation should preserve supporting run breadcrumbs');
assert.equal(summary.retryReductionRecommendations[0].evidenceConfidence, 'single_trace', 'single-run recommendations should be marked as single-trace confidence');
assert.equal(summary.retryReductionRecommendations[0].avgRetryDistance, 1, 'recommendation should preserve average retry distance for the avoid/prefer path');
assert.equal(summary.retryReductionRecommendations[0].evidenceSource, 'saved_session_trace', 'recommendation should preserve evidence source');
assert.equal(summary.retryReductionRecommendations[0].tuningAction, 'tune_local_router', 'saved-session recommendations should be marked safe for local router tuning after review');
assert.match(summary.retryReductionRecommendations[0].recommendation, /Prefer primary-model\/list_directory before repeating primary-model\/read_file/, 'recommendation should tell routing what to prefer before adding retries');
assert.match(summary.retryReductionRecommendations[0].tuningGuidance, /Local saved-session evidence/, 'recommendation should explain why this source can tune the local router');
const dedupedRecommendations = buildRetryReductionRecommendations([
  summary.outcomeExamples[1],
  { ...summary.outcomeExamples[1], runId: 'recovered-run-copy', timestamp: '2026-06-17T00:05:00.000Z' },
]);
assert.equal(dedupedRecommendations.length, 1, 'matching avoid/prefer recommendations should collapse into one row');
assert.equal(dedupedRecommendations[0].supportRunCount, 2, 'deduped recommendation should preserve the number of supporting runs');
assert.deepEqual(dedupedRecommendations[0].supportSessionIds, ['session-1'], 'deduped recommendation should preserve supporting session ids');
assert.deepEqual(dedupedRecommendations[0].supportRunIds, ['recovered-run', 'recovered-run-copy'], 'deduped recommendation should preserve supporting run ids');
assert.equal(dedupedRecommendations[0].evidenceConfidence, 'repeated_trace', 'deduped repeated evidence should be marked as repeated trace confidence');
assert.equal(dedupedRecommendations[0].avgRetryDistance, 1, 'deduped recommendation should average retry distance across supporting runs');
const providerSeparatedRecommendations = buildRetryReductionRecommendations([
  summary.outcomeExamples[1],
  {
    ...summary.outcomeExamples[1],
    failedProviderId: 'secondary-provider',
    workedBy: summary.outcomeExamples[1].workedBy ? {
      ...summary.outcomeExamples[1].workedBy,
      providerId: 'secondary-provider',
    } : undefined,
    runId: 'secondary-provider-run',
  },
]);
assert.equal(providerSeparatedRecommendations.length, 2, 'matching model/tool recommendations from different providers should stay separate rows');
assert.ok(providerSeparatedRecommendations.some((item) => item.avoidProviderPath === 'primary-provider:primary-model/read_file'), 'primary provider path should remain visible in retry-reduction advice');
assert.ok(providerSeparatedRecommendations.some((item) => item.avoidProviderPath === 'secondary-provider:primary-model/read_file'), 'secondary provider path should remain visible in retry-reduction advice');
const sourceMappedRecommendations = buildRetryReductionRecommendations([
  { ...summary.outcomeExamples[1], evidenceSource: 'log_trace', sessionId: 'log-session', runId: 'log-run' },
  { ...summary.outcomeExamples[1], evidenceSource: 'imported_trace', sessionId: 'import-session', runId: 'import-run' },
]);
assert.equal(sourceMappedRecommendations.length, 2, 'different evidence sources should not collapse into one retry-reduction row');
assert.equal(sourceMappedRecommendations.find((item) => item.evidenceSource === 'log_trace')?.tuningAction, 'review_before_tuning', 'log-derived recommendations should require source review before tuning');
assert.equal(sourceMappedRecommendations.find((item) => item.evidenceSource === 'imported_trace')?.tuningAction, 'context_only', 'imported recommendations should stay context-only until reviewed merge');
assert.match(sourceMappedRecommendations.find((item) => item.evidenceSource === 'log_trace')?.tuningGuidance || '', /review the originating log/i, 'log-derived tuning guidance should require log review');
assert.match(sourceMappedRecommendations.find((item) => item.evidenceSource === 'imported_trace')?.tuningGuidance || '', /context only/i, 'imported tuning guidance should prevent silent local tuning');
const annotatedCandidates = annotateCandidatesWithToolReliability([
  {
    modelId: 'provider:qwen3-primary-model',
    cost: 1,
    supportsImages: false,
    card: 'Primary model candidate.',
  },
  {
    modelId: 'provider:fallback-model',
    cost: 2,
    supportsImages: false,
    card: 'Fallback model candidate.',
  },
  {
    modelId: 'provider:qwen3-new-model',
    cost: 3,
    supportsImages: false,
    card: 'New Qwen-family model candidate.',
  },
], summary);
assert.match(annotatedCandidates[0].card, /Tool reliability evidence for primary-model/i, 'candidate card should include model-specific tool reliability evidence');
assert.match(annotatedCandidates[0].card, /2\/3 traced tool calls errored/i, 'candidate card should expose error counts to the classifier');
assert.match(annotatedCandidates[0].card, /read_file failed, then list_directory completed/i, 'candidate card should expose the recent recovery path');
assert.match(annotatedCandidates[0].card, /Repeated recovery patterns/i, 'candidate card should expose recurring recovery patterns');
assert.match(annotatedCandidates[0].card, /read_file failed, then primary-model\/list_directory worked/i, 'candidate card should show what later worked');
assert.match(annotatedCandidates[0].card, /read_file failed under primary-provider:primary-model\/read_file; then primary-provider:primary-model\/list_directory worked/i, 'candidate card should expose provider-qualified recovery paths');
assert.match(annotatedCandidates[0].card, /evidence saved_session_trace, examples session session-1, run recovered-run/i, 'candidate card should expose recovery pattern source, session, and run breadcrumbs');
assert.match(annotatedCandidates[0].card, /Model failure memory/i, 'candidate card should expose compact failure memory');
assert.match(annotatedCandidates[0].card, /write_file failed in 1 run/i, 'candidate card should include unrecovered tool failure memory');
assert.match(annotatedCandidates[0].card, /read_file failed in 1 run .*evidence saved_session_trace, examples session session-1, run recovered-run/i, 'candidate card should expose failure-memory source, session, and run breadcrumbs');
assert.match(annotatedCandidates[0].card, /Tool error signatures/i, 'candidate card should expose normalized error signatures');
assert.match(annotatedCandidates[0].card, /write_file "permission denied" in 1 run/i, 'candidate card should include unrecovered error signatures');
assert.match(annotatedCandidates[0].card, /read_file "enoent" in 1 run/i, 'candidate card should include recovered error signatures');
assert.match(annotatedCandidates[0].card, /read_file "enoent" in 1 run .*evidence saved_session_trace, examples session session-1, run recovered-run/i, 'candidate card should expose signature source, session, and run breadcrumbs');
assert.match(annotatedCandidates[0].card, /later worked via primary-model\/list_directory/i, 'candidate card should expose what worked after a matching signature');
assert.match(annotatedCandidates[0].card, /Retry-reduction recommendations/i, 'candidate card should expose distilled retry-reduction recommendations');
assert.match(annotatedCandidates[0].card, /Prompt strategy best practice for qwen-xml-code-v1/i, 'candidate card should expose source-backed prompt strategy best-practice guidance');
assert.match(annotatedCandidates[0].card, /Eval cue:/i, 'candidate card should expose prompt-strategy evaluation cues');
assert.match(annotatedCandidates[0].card, /not an automatic routing override/i, 'candidate card should frame prompt best practices as advisory evidence');
assert.match(annotatedCandidates[0].card, /first failed primary-provider:primary-model\/read_file, recovered primary-model\/list_directory, prefer after 1 rounds; avg recovery distance 1; evidence saved_session_trace; confidence single_trace from 1 run; supporting sessions session-1; supporting runs recovered-run; tuning action tune_local_router/i, 'candidate card should expose first-failed recovered path with average recovery distance, confidence, source, and breadcrumbs');
assert.match(annotatedCandidates[0].card, /provider path avoid primary-provider:primary-model\/read_file; provider path prefer primary-provider:primary-model\/list_directory/i, 'candidate card should expose provider-qualified avoid/prefer paths');
assert.match(annotatedCandidates[0].card, /Session outcomes after tool errors/i, 'candidate card should expose session outcome mining');
assert.match(annotatedCandidates[0].card, /write_file -> error \(unrecovered_error, retry distance 0\)/i, 'candidate card should include unrecovered outcomes');
assert.match(annotatedCandidates[0].card, /read_file -> primary-model\/list_directory \(recovered_tool_path, retry distance 1\)/i, 'candidate card should include the working path after an error');
assert.match(annotatedCandidates[0].card, /primary-provider:primary-model\/read_file -> primary-model\/list_directory/i, 'candidate card should expose provider-qualified outcome failure->recovery path');
assert.match(annotatedCandidates[0].card, /read_file -> primary-model\/list_directory .*evidence saved_session_trace, session session-1, run recovered-run/i, 'candidate card should expose outcome source, session, and run breadcrumbs');
assert.match(annotatedCandidates[0].card, /prompt variants qwen-coder-tool-proof/i, 'candidate card should include prompt variant failure memory');
assert.match(annotatedCandidates[0].card, /Specific risky tools for this model/i, 'candidate card should expose model/tool-pair risk evidence');
assert.match(annotatedCandidates[0].card, /read_file 1\/1 errors/i, 'candidate card should include risky read_file pair evidence');
assert.match(annotatedCandidates[0].card, /write_file 1\/1 errors/i, 'candidate card should include risky write_file pair evidence');
assert.match(annotatedCandidates[0].card, /Prompt strategy tool evidence for qwen-xml-code-v1/i, 'candidate card should expose matching prompt-strategy tool reliability evidence');
assert.match(annotatedCandidates[0].card, /Risky prompt variants: qwen-xml-code-v1:qwen-coder-tool-proof 2\/3 errors/i, 'candidate card should expose prompt strategy variant tool reliability evidence');
assert.match(annotatedCandidates[0].card, /Penalize this candidate for tool-heavy execute tasks/i, 'candidate card should tell the classifier how to use repeated tool failures');
assert.match(annotatedCandidates[1].card, /0\/3 traced tool-call errors/i, 'clean candidate card should expose positive tool reliability evidence');
assert.match(annotatedCandidates[2].card, /Prompt strategy tool evidence for qwen-xml-code-v1/i, 'new candidate without model history should still inherit matching prompt-strategy reliability evidence');
assert.match(annotatedCandidates[2].card, /Prompt strategy best practice for qwen-xml-code-v1/i, 'new candidate without model history should still inherit source-backed prompt best-practice evidence');
assert.match(annotatedCandidates[2].card, /until this model has its own tool traces/i, 'new candidate strategy-only evidence should be framed as provisional');

assert.equal(summary.byModel['primary-model'].total, 3, 'primary model should include its three traced calls');
assert.equal(summary.byModel['primary-model'].error, 2, 'primary model should include both errors');
assert.equal(summary.byModel['primary-model'].runs, 2, 'primary model should include two tool-using runs');
assert.equal(summary.byModel['primary-model'].firstCallErrors, 2, 'primary model should include both first-call failures');
assert.equal(summary.byModel['primary-model'].firstCallErrorRate, 1, 'primary model first-call error rate should be exact');
assert.equal(summary.byModel['primary-model'].affectedRuns, 2, 'primary model should have two affected error runs');
assert.equal(summary.byModel['primary-model'].recoveredRuns, 1, 'primary model should have one recovered error run');
assert.equal(summary.byModel['primary-model'].avgRecoveryRounds, 1, 'primary model should record recovery rounds');
assert.equal(summary.byModel['primary-model'].avgDurationMs, 23, 'primary model average duration should be rounded');
assert.equal(summary.byProvider['fallback-provider'].total, 3, 'provider fallback should use run provider when step provider is absent');
assert.equal(summary.byTool.read_file.total, 3, 'read_file should aggregate across runs');
assert.equal(summary.byTool.read_file.error, 1, 'read_file should preserve error count');
assert.equal(summary.byTool.read_file.skipped, 1, 'read_file should preserve skipped count');
assert.equal(summary.byTool.read_file.firstCallErrors, 1, 'read_file should preserve first-call error count');
assert.equal(summary.byTool.read_file.avgRecoveryRounds, 1, 'read_file should preserve recovery rounds');
assert.equal(summary.byModelTool['primary-model / read_file'].total, 1, 'model/tool pair should preserve model-specific tool totals');
assert.equal(summary.byModelTool['primary-model / read_file'].error, 1, 'model/tool pair should preserve model-specific tool errors');
assert.equal(summary.byModelTool['primary-model / read_file'].firstCallErrors, 1, 'model/tool pair should preserve first-call failures for the pair');
assert.equal(summary.byModelTool['primary-model / read_file'].recoveredRuns, 1, 'model/tool pair should preserve recovered runs for the pair');
assert.equal(summary.byModelTool['primary-model / write_file'].error, 1, 'model/tool pair should separate failures by tool name');
assert.equal(summary.byPromptStrategy['qwen-xml-code-v1'].total, 3, 'prompt strategy bucket should aggregate tool calls from runs with prompt assembly metadata');
assert.equal(summary.byPromptStrategy['qwen-xml-code-v1'].error, 2, 'prompt strategy bucket should preserve tool errors');
assert.equal(summary.byPromptStrategy['qwen-xml-code-v1'].firstCallErrors, 2, 'prompt strategy bucket should preserve first-call failures');
assert.equal(summary.byPromptStrategyVariant['qwen-xml-code-v1:qwen-coder-tool-proof'].total, 3, 'strategy variant bucket should aggregate exact role/task prompt contracts');
assert.equal(summary.byPromptStrategyVariant['qwen-xml-code-v1:qwen-coder-tool-proof'].runs, 2, 'strategy variant bucket should preserve recovered run count via run membership');
assert.ok(!Object.hasOwn(summary.byPromptStrategyVariant, 'unknown'), 'unknown strategy variant bucket should not be present when prompt strategy is inferred for all runs');
assert.equal(summary.byEvidenceSource.length, 1, 'evidence source summary should aggregate saved trace outcomes');
assert.equal(summary.byEvidenceSource[0].source, 'saved_session_trace', 'evidence source summary should identify saved session traces');
assert.equal(summary.byEvidenceSource[0].tuningAction, 'tune_local_router', 'evidence source summary should identify the tuning action for saved traces');
assert.equal(summary.byEvidenceSource[0].outcomeRuns, 2, 'evidence source summary should count outcome runs');
assert.equal(summary.byEvidenceSource[0].recoveredRuns, 1, 'evidence source summary should count recovered outcome runs');
assert.equal(summary.byEvidenceSource[0].unrecoveredRuns, 1, 'evidence source summary should count unrecovered outcome runs');
assert.equal(summary.byEvidenceSource[0].retryReductionRecommendations, 2, 'evidence source summary should count retry-reduction recommendations');
assert.equal(summary.byEvidenceSource[0].avgRetryDistance, 0.5, 'evidence source summary should average retry distance across outcomes');
assert.equal(summary.toolHeavyAdvice[0].scope, 'model', 'highest advice should flag the riskiest model first');
assert.equal(summary.toolHeavyAdvice[0].key, 'primary-model', 'primary model should be flagged for tool-use review');
assert.equal(summary.toolHeavyAdvice[0].tone, 'risk', 'high model error rate should produce risk advice');
assert.match(summary.toolHeavyAdvice[0].detail, /capability card or effective cost/, 'model advice should tell reviewers how to tune routing');
assert.equal(summary.toolHeavyAdvice[0].firstCallErrorRate, 1, 'advice should expose first-call error rate');
assert.equal(summary.toolHeavyAdvice[0].avgRecoveryRounds, 1, 'advice should expose average recovery rounds');
assert.ok(summary.toolHeavyAdvice.some((item) => item.scope === 'tool' && item.key === 'read_file' && item.tone === 'risk'), 'recurring tool failures should produce tool-scope advice');
assert.ok(summary.toolHeavyAdvice.some((item) => item.scope === 'model_tool' && item.key === 'primary-model / read_file' && item.tone === 'risk'), 'model/tool pair failures should produce retry-reduction advice');
assert.ok(summary.toolHeavyAdvice.some((item) => item.scope === 'prompt_strategy' && item.key === 'qwen-xml-code-v1' && item.tone === 'risk'), 'prompt strategy failures should produce prompt-contract advice');
assert.ok(summary.toolHeavyAdvice.some((item) => item.scope === 'strategy_variant' && item.key === 'qwen-xml-code-v1:qwen-coder-tool-proof' && item.tone === 'risk'), 'prompt strategy variant failures should produce variant-specific advice');
assert.ok(summary.toolHeavyAdvice.some((item) => item.scope === 'model' && item.key === 'fallback-model' && item.tone === 'good'), 'clean model traces should produce positive evidence advice');
assert.equal(summary.recentErrors[0].tool, 'write_file', 'recent errors should be newest first');
assert.equal(summary.recentErrors[0].evidenceSource, 'saved_session_trace', 'recent errors should keep the saved session evidence source');
assert.equal(summary.recentErrors[1].tool, 'read_file', 'older error should follow newest error');
assert.equal(normalizeToolStatus({ type: 'tool_call', id: 'legacy', name: 'x', input: {}, durationMs: 1 }), 'complete');
assert.equal(normalizeToolStatus({ type: 'tool_call', id: 'legacy-running', name: 'x', input: {} }), 'running');

const tempHome = mkdtempSync(join(tmpdir(), 'openharness-tool-reliability-log-trace-'));
process.env.HOME = tempHome;
const logTraceModulePath = `${pathToFileURL(join(process.cwd(), 'server/toolReliabilityLogTrace.ts')).href}?probe=${Date.now()}`;
const { getToolReliabilitySessions } = await import(logTraceModulePath);
const runTraceLogDir = join(tempHome, '.openharness', 'process-ledger', 'logs');
mkdirSync(runTraceLogDir, { recursive: true });
const probeRunId = `probe-run-${Date.now()}`;
const probeLogPath = join(runTraceLogDir, `${probeRunId}.log`);

try {
  const probeRunA = `${probeRunId}-a`;
  const probeRunB = `${probeRunId}-b`;
  const probeLogLines = [
    `[run-step] ${JSON.stringify({ runId: probeRunA, step: { type: 'tool_call', name: 'read_file', status: 'error', model: 'qwen3-coder-probe', providerId: 'primary-provider', round: 0, error: 'ENOENT' } })}`,
    `[run-step] ${JSON.stringify({ runId: probeRunA, step: { type: 'tool_call', name: 'search', status: 'complete', model: 'qwen3-coder-probe', providerId: 'primary-provider', round: 1 } })}`,
    `[run-step] ${JSON.stringify({ runId: probeRunA, step: { type: 'final_answer', chars: 150 } })}`,
    `[run-complete] ${JSON.stringify({ runId: probeRunA, status: 'complete' })}`,
    `[run-step] ${JSON.stringify({ runId: probeRunB, step: { type: 'tool_call', name: 'read_file', status: 'error', model: 'unknown-probe-worker', providerId: 'fallback-provider', round: 0, error: 'permission denied' } })}`,
    `[run-complete] ${JSON.stringify({ runId: probeRunB, status: 'error' })}`,
  ].join('\n');
  writeFileSync(probeLogPath, `${probeLogLines}\n`, 'utf-8');

  const logSessions = getToolReliabilitySessions();
  const recoveredSession = logSessions.find((session) => session.id === `log-session-${probeRunA}`);
  const unrecoveredSession = logSessions.find((session) => session.id === `log-session-${probeRunB}`);
  assert.ok(recoveredSession?.messages?.[0]?.runTrace, 'log reconstruction should produce a recovered run session entry');
  assert.ok(unrecoveredSession?.messages?.[0]?.runTrace, 'log reconstruction should produce an unrecovered run session entry');

  const logSummary = buildToolReliabilitySummary(logSessions);
  const recoveredOutcome = logSummary.outcomeExamples.find((item) => item.runId === probeRunA && item.evidenceSource === 'log_trace');
  const unrecoveredOutcome = logSummary.outcomeExamples.find((item) => item.runId === probeRunB && item.evidenceSource === 'log_trace');
  assert.equal(recoveredOutcome?.outcome, 'recovered_tool_path', 'log-derived recovered run should produce recovered outcome');
  assert.equal(recoveredOutcome?.retryDistance, 1, 'log-derived recovered run should capture retry distance');
  assert.equal(recoveredOutcome?.finalStatus, 'complete', 'recovered log run should preserve final status');
  assert.equal(unrecoveredOutcome?.outcome, 'unrecovered_error', 'log-derived unrecovered run should produce unrecovered outcome');
  assert.equal(unrecoveredOutcome?.finalStatus, 'error', 'unrecovered log run should preserve error status');
  assert.ok(recoveredOutcome?.promptStrategyId, 'log-derived outcomes should retain inferred prompt strategy id');
  assert.ok(recoveredOutcome?.promptStrategyVariantId, 'log-derived outcomes should retain inferred prompt strategy variant when available');
  assert.ok(logSummary.recoveryPatterns.some((pattern) => pattern.failedModel === 'qwen3-coder-probe'), 'log traces should create recovery patterns from failed-then-successful tool runs');
  assert.equal(logSummary.byEvidenceSource.find((item) => item.source === 'log_trace')?.outcomeRuns, 2, 'log trace evidence summary should report outcome run count');
  assert.ok(logSummary.byEvidenceSource.find((item) => item.source === 'log_trace')?.retryReductionRecommendations >= 1, 'log trace evidence should contribute retry-reduction recommendations');
  assert.equal(logSummary.byEvidenceSource.find((item) => item.source === 'log_trace')?.tuningAction, 'review_before_tuning', 'log-trace recommendations should require review before tuning');
} finally {
  rmSync(tempHome, { recursive: true, force: true });
}

console.log('Tool reliability tests passed.');
