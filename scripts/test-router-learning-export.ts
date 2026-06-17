import { strict as assert } from 'node:assert';
import { buildRouterLearningExportPayload } from '../server/routerLearningExport';
import type { LearningSummary, RoutingEvent } from '../server/routerLearning';
import type { ToolReliabilitySummary } from '../server/toolReliability';

const event = {
  id: 'event-1',
  timestamp: '2026-06-17T00:00:00.000Z',
  sessionId: 'session-1',
  taskHash: 'task',
  selectedModel: 'provider:model',
  score: 0.91,
  candidateScores: { 'provider:model': 0.91 },
  wasFallback: false,
  wasCached: false,
  classifierModel: 'provider:classifier',
  surface: 'chat',
  complexity: 'medium',
  taskType: 'execute',
  role: 'coder',
  promptStrategyId: 'qwen-xml-code-v1',
  promptStrategyFamily: 'qwen',
  promptStrategyStyle: 'xml-tagged',
  promptStrategyVariantId: 'qwen-coder-tool-proof',
  promptStrategyTaskType: 'coding',
  promptStrategySelectionReason: 'Coding and tool-heavy work should lead with applied result, proof, and concise changed-file evidence.',
  userTurns: 1,
  outcome: 'success',
  datasetKind: 'production',
} satisfies RoutingEvent;

const benchmarkEvent = {
  ...event,
  id: 'event-2',
  taskHash: 'benchmark-task',
  datasetKind: 'benchmark',
} satisfies RoutingEvent;

const learningSummary: LearningSummary = {
  totalEvents: 1,
  models: { 'provider:model': { total: 1, success: 1, rate: 1 } },
  successRate: 1,
  outdated: false,
  byTaskType: {},
  byRole: {},
  byComplexity: {},
  byPromptStrategy: {},
  byPromptStrategyFamily: {},
  byPromptStrategyVariant: {},
  bestByTaskType: [],
  bestPromptStrategyVariants: [],
};

const toolReliability = {
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
  byEvidenceSource: [
    {
      source: 'saved_session_trace',
      tuningAction: 'tune_local_router',
      outcomeRuns: 1,
      recoveredRuns: 1,
      unrecoveredRuns: 0,
      retryReductionRecommendations: 1,
      avgRetryDistance: 1,
      latestTimestamp: '2026-06-17T00:30:00.000Z',
    },
  ],
  toolHeavyAdvice: [],
  recoveryExamples: [
    {
      evidenceSource: 'saved_session_trace',
      sessionId: 'session-1',
      runId: 'run-1',
      promptStrategyId: 'qwen-xml-code-v1',
      promptStrategyVariantId: 'qwen-xml-code-v1:qwen-coder-tool-proof',
      firstError: {
        model: 'provider:model',
        providerId: 'provider',
        tool: 'read_file',
        round: 0,
        error: 'ENOENT',
      },
      recoveredBy: [
        {
          model: 'provider:model',
          providerId: 'provider',
          tool: 'list_directory',
          round: 1,
          durationMs: 42,
        },
      ],
      finalStatus: 'complete',
      finalAnswerCaptured: true,
      recoveryRounds: 1,
      timestamp: '2026-06-17T00:30:00.000Z',
    },
  ],
  outcomeExamples: [
    {
      evidenceSource: 'saved_session_trace',
      tuningAction: 'tune_local_router',
      sessionId: 'session-1',
      runId: 'run-1',
      failedModel: 'provider:model',
      failedProviderId: 'provider',
      failedTool: 'read_file',
      promptStrategyId: 'qwen-xml-code-v1',
      promptStrategyVariantId: 'qwen-xml-code-v1:qwen-coder-tool-proof',
      outcome: 'recovered_tool_path',
      workedBy: {
        model: 'provider:model',
        providerId: 'provider',
        tool: 'list_directory',
        round: 1,
        durationMs: 42,
      },
      finalStatus: 'complete',
      finalAnswerCaptured: true,
      recoveryRounds: 1,
      retryDistance: 1,
      error: 'ENOENT',
      timestamp: '2026-06-17T00:30:00.000Z',
    },
  ],
  recoveryPatterns: [
    {
      failedModel: 'provider:model',
      failedProviderId: 'provider',
      failedTool: 'read_file',
      recoveredByModel: 'provider:model',
      recoveredByProviderId: 'provider',
      recoveredByTool: 'list_directory',
      runs: 1,
      finalAnswerRuns: 1,
      avgRecoveryRounds: 1,
      latestTimestamp: '2026-06-17T00:30:00.000Z',
      exampleSessionIds: ['session-1'],
      exampleRunIds: ['run-1'],
      exampleEvidenceSources: ['saved_session_trace'],
    },
  ],
  failureMemory: [
    {
      model: 'provider:model',
      providerId: 'provider',
      tool: 'read_file',
      errorRuns: 1,
      recoveredRuns: 1,
      unrecoveredRuns: 0,
      fallbackRecoveryRuns: 0,
      promptStrategies: [{ id: 'qwen-xml-code-v1', runs: 1 }],
      promptStrategyVariants: [{ id: 'qwen-xml-code-v1:qwen-coder-tool-proof', runs: 1 }],
      latestError: 'ENOENT',
      latestTimestamp: '2026-06-17T00:30:00.000Z',
      fixedBy: [
        {
          model: 'provider:model',
          providerId: 'provider',
          tool: 'list_directory',
          runs: 1,
          avgRecoveryRounds: 1,
        },
      ],
      exampleSessionIds: ['session-1'],
      exampleRunIds: ['run-1'],
      exampleEvidenceSources: ['saved_session_trace'],
    },
  ],
  errorSignatures: [
    {
      signature: 'enoent',
      model: 'provider:model',
      providerId: 'provider',
      tool: 'read_file',
      runs: 1,
      recoveredRuns: 1,
      unrecoveredRuns: 0,
      fallbackRecoveryRuns: 0,
      promptStrategies: [{ id: 'qwen-xml-code-v1', runs: 1 }],
      promptStrategyVariants: [{ id: 'qwen-xml-code-v1:qwen-coder-tool-proof', runs: 1 }],
      sampleError: 'ENOENT',
      latestTimestamp: '2026-06-17T00:30:00.000Z',
      workedBy: [
        {
          model: 'provider:model',
          providerId: 'provider',
          tool: 'list_directory',
          runs: 1,
          avgRetryDistance: 1,
        },
      ],
      exampleSessionIds: ['session-1'],
      exampleRunIds: ['run-1'],
      exampleEvidenceSources: ['saved_session_trace'],
    },
  ],
  retryReductionRecommendations: [
    {
      evidenceSource: 'saved_session_trace',
      sessionId: 'session-1',
      runId: 'run-1',
      failedModel: 'provider:model',
      failedProviderId: 'provider',
      failedTool: 'read_file',
      promptStrategyId: 'qwen-xml-code-v1',
      promptStrategyVariantId: 'qwen-xml-code-v1:qwen-coder-tool-proof',
      outcome: 'recovered_tool_path',
      avoidPath: 'provider:model/read_file',
      preferPath: 'provider:model/list_directory',
      avoidProviderPath: 'provider:provider:model/read_file',
      preferProviderPath: 'provider:provider:model/list_directory',
      supportRunCount: 1,
      supportSessionIds: ['session-1'],
      supportRunIds: ['run-1'],
      evidenceConfidence: 'single_trace',
      avgRetryDistance: 1,
      retryDistance: 1,
      tuningAction: 'tune_local_router',
      recommendation: 'Prefer provider:model/list_directory before repeating provider:model/read_file for similar tool-heavy work.',
      tuningGuidance: 'Local saved-session evidence: safe to use for candidate-card, prompt-contract, or cost tuning after normal review.',
      timestamp: '2026-06-17T00:30:00.000Z',
    },
  ],
  recentErrors: [],
} satisfies ToolReliabilitySummary;

const payload = buildRouterLearningExportPayload({
  events: [event, benchmarkEvent],
  generatedAt: '2026-06-17T01:00:00.000Z',
  learningSummary,
  toolReliability,
  routerState: {
    enabled: true,
    candidateEvidenceRefreshedAt: '2026-06-17T00:59:00.000Z',
    candidateEvidenceRefreshCount: 3,
    configuredCandidateCount: 4,
    candidateCount: 2,
  },
});

assert.equal(payload.schemaVersion, 1, 'export schema version should be stable');
assert.equal(payload.generatedAt, '2026-06-17T01:00:00.000Z', 'export should preserve provided generation time');
assert.equal(payload.eventCount, 2, 'export should count all events');
assert.equal(payload.productionEventCount, 1, 'export should count production events');
assert.equal(payload.benchmarkEventCount, 1, 'export should count benchmark events');
assert.equal(payload.promptStrategyBestPractices.length, 1, 'export should include source-backed prompt strategy metadata for referenced strategies');
assert.equal(payload.promptStrategyBestPractices[0].strategyId, 'qwen-xml-code-v1', 'export should identify the referenced prompt strategy');
assert.ok(
  payload.promptStrategyBestPractices[0].bestPracticeNotes.some((note) =>
    note.sourceRef === 'https://qwen.readthedocs.io/en/stable/getting_started/quickstart.html'
  ),
  'export should preserve qwen quickstart source-backed best-practice guidance',
);
assert.equal(
  payload.promptStrategyBestPractices[0].bestPracticeNotes[0].sourceRef,
  'https://qwen.readthedocs.io/en/stable/getting_started/quickstart.html',
  'export should preserve the first prompt strategy best-practice source reference',
);
assert.ok(
  payload.promptStrategyBestPractices[0].bestPracticeNotes.some((note) =>
    /first-call|retry|recovery path|proof quality/i.test(note.evaluationCue)
  ),
  'export should preserve at least one prompt strategy eval cue related to recoverability or proof quality',
);
assert.equal(payload.summary.toolReliability.outcomeExamples.length, toolReliability.outcomeExamples.length, 'export should include tool reliability outcome evidence in the summary');
assert.equal(payload.summary.toolReliability.outcomeExamples[0].workedBy?.tool, 'list_directory', 'export should preserve session outcome working-path evidence');
assert.equal(payload.summary.toolReliability.outcomeExamples[0].evidenceSource, 'saved_session_trace', 'export should preserve session outcome evidence source');
assert.equal(payload.summary.toolReliability.outcomeExamples[0].promptStrategyVariantId, 'qwen-xml-code-v1:qwen-coder-tool-proof', 'export should preserve prompt strategy context for tool-error outcomes');
assert.equal(payload.summary.toolReliability.recoveryExamples[0].promptStrategyVariantId, 'qwen-xml-code-v1:qwen-coder-tool-proof', 'export should preserve prompt strategy context for recovery examples');
assert.deepEqual(payload.summary.toolReliability.recoveryPatterns[0].exampleSessionIds, ['session-1'], 'export should preserve recovery-pattern session breadcrumbs');
assert.deepEqual(payload.summary.toolReliability.recoveryPatterns[0].exampleEvidenceSources, ['saved_session_trace'], 'export should preserve recovery-pattern evidence sources');
assert.deepEqual(payload.summary.toolReliability.failureMemory[0].exampleSessionIds, ['session-1'], 'export should preserve failure-memory session breadcrumbs');
assert.deepEqual(payload.summary.toolReliability.failureMemory[0].exampleEvidenceSources, ['saved_session_trace'], 'export should preserve failure-memory evidence sources');
assert.deepEqual(payload.summary.toolReliability.errorSignatures[0].exampleSessionIds, ['session-1'], 'export should preserve normalized signature session breadcrumbs');
assert.deepEqual(payload.summary.toolReliability.errorSignatures[0].exampleEvidenceSources, ['saved_session_trace'], 'export should preserve normalized signature evidence sources');
assert.equal(payload.summary.toolReliability.errorSignatures[0].workedBy[0].avgRetryDistance, 1, 'export should preserve normalized signature retry-distance evidence');
assert.equal(payload.summary.toolReliability.retryReductionRecommendations[0].avoidPath, 'provider:model/read_file', 'export should preserve retry-reduction avoid path');
assert.equal(payload.summary.toolReliability.retryReductionRecommendations[0].preferPath, 'provider:model/list_directory', 'export should preserve retry-reduction preferred path');
assert.equal(payload.summary.toolReliability.retryReductionRecommendations[0].avoidProviderPath, 'provider:provider:model/read_file', 'export should preserve provider-qualified retry-reduction avoid path');
assert.equal(payload.summary.toolReliability.retryReductionRecommendations[0].preferProviderPath, 'provider:provider:model/list_directory', 'export should preserve provider-qualified retry-reduction preferred path');
assert.equal(payload.summary.toolReliability.retryReductionRecommendations[0].supportRunCount, 1, 'export should preserve retry-reduction support count');
assert.deepEqual(payload.summary.toolReliability.retryReductionRecommendations[0].supportSessionIds, ['session-1'], 'export should preserve retry-reduction supporting session ids');
assert.deepEqual(payload.summary.toolReliability.retryReductionRecommendations[0].supportRunIds, ['run-1'], 'export should preserve retry-reduction supporting run ids');
assert.equal(payload.summary.toolReliability.retryReductionRecommendations[0].evidenceConfidence, 'single_trace', 'export should preserve retry-reduction confidence');
assert.equal(payload.summary.toolReliability.retryReductionRecommendations[0].avgRetryDistance, 1, 'export should preserve retry-reduction average retry distance');
assert.equal(payload.summary.toolReliability.retryReductionRecommendations[0].evidenceSource, 'saved_session_trace', 'export should preserve retry-reduction evidence source');
assert.equal(payload.summary.toolReliability.retryReductionRecommendations[0].tuningAction, 'tune_local_router', 'export should preserve retry-reduction tuning action');
assert.equal(payload.summary.toolReliability.byEvidenceSource[0].source, 'saved_session_trace', 'export should preserve tool-error evidence source summary');
assert.equal(payload.summary.toolReliability.byEvidenceSource[0].tuningAction, 'tune_local_router', 'export should preserve evidence-source tuning action');
assert.equal(payload.summary.toolReliability.byEvidenceSource[0].retryReductionRecommendations, 1, 'export should preserve evidence-source recommendation counts');
assert.deepEqual(payload.routerEvidenceFreshness, {
  enabled: true,
  candidateEvidenceRefreshedAt: '2026-06-17T00:59:00.000Z',
  candidateEvidenceRefreshCount: 3,
  configuredCandidateCount: 4,
  activeCandidateCount: 2,
}, 'export should preserve router candidate evidence freshness');

console.log('Router learning export tests passed.');
