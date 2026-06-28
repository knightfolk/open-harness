import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { buildRouterLearningExportPayload } from '../server/routerLearningExport';
import type { LearningSummary, RoutingEvent } from '../server/routerLearning';
import type { ToolReliabilitySummary } from '../server/toolReliability';
import { buildToolFailureTrainingExportPayload, type ToolErrorLedgerEvent } from '../server/toolErrorLedger';

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
  modelRequestDurationMs: 30001,
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
  modelRequestDuration: {
    byModel: {
      'provider:model': { samples: 1, avgMs: 30001, slow: true, thresholdMs: 30000 },
    },
    byTaskType: {
      execute: { samples: 1, avgMs: 30001, slow: true, thresholdMs: 30000 },
    },
  },
  bestByTaskType: [
    { taskType: 'execute', model: 'provider:model', total: 8, success: 7, rate: 0.875, sampleCount: 8, firstSeenAt: '2026-05-01T00:00:00.000Z', lastSeenAt: '2026-05-20T00:00:00.000Z' },
    { taskType: 'direct', model: 'provider:veteran-model', total: 12, success: 11, rate: 0.917 },
    { taskType: 'investigate', model: 'provider:research-model', total: 3, success: 3, rate: 1 },
    { taskType: 'compare', model: 'provider:mixed-model', total: 6, success: 4, rate: 0.667 },
  ],
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
      promptStrategyVariantId: 'qwen-coder-tool-proof',
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
      promptStrategyVariantId: 'qwen-coder-tool-proof',
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
      promptStrategyVariants: [{ id: 'qwen-coder-tool-proof', runs: 1 }],
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
      promptStrategyVariants: [{ id: 'qwen-coder-tool-proof', runs: 1 }],
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
      promptStrategyVariantId: 'qwen-coder-tool-proof',
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
    thresholdAdvice: {
      configuredThreshold: 0.7,
      activeThreshold: 0.8,
      suggestedThreshold: 0.8,
      reason: 'Low success rate (0% over 10 rated outcomes); raising threshold for safety',
      dataPoints: 10,
      applied: true,
    },
    configuredCandidateCount: 4,
    candidateCount: 2,
  },
});

assert.equal(payload.schemaVersion, 1, 'export schema version should be stable');
assert.equal(payload.generatedAt, '2026-06-17T01:00:00.000Z', 'export should preserve provided generation time');
assert.equal(payload.eventCount, 2, 'export should count all events');
assert.equal(payload.productionEventCount, 1, 'export should count production events');
assert.equal(payload.benchmarkEventCount, 1, 'export should count benchmark events');
assert.equal(payload.events[0].modelRequestDurationMs, 30001, 'export should preserve measured model-request duration on routing events');
assert.equal((payload.events[0] as any).model_request_duration_ms, 30001, 'export should include machine-friendly measured request duration field');
assert.equal((payload.events[1] as any).model_request_duration_ms, 30001, 'benchmark export rows should preserve imported measured request duration when present');
assert.deepEqual(
  payload.summary.modelRequestDuration.byModel['provider:model'],
  { samples: 1, avgMs: 30001, slow: true, thresholdMs: 30000 },
  'export should preserve measured request duration aggregates and slow flags by model',
);
assert.deepEqual(
  (payload.summary as any).model_request_duration.by_task_type.execute,
  { samples: 1, avg_ms: 30001, slow: true, threshold_ms: 30000 },
  'export should include machine-friendly measured request duration aggregates and slow flags by task type',
);
assert.deepEqual(
  (payload.summary as any).routingActionCues.map((cue: any) => ({
    taskType: cue.taskType,
    model: cue.model,
    status: cue.status,
    confidence: cue.confidence,
    confidenceLabel: cue.confidenceLabel,
    confidenceDetail: cue.confidenceDetail,
    detail: cue.detail,
    stale: cue.stale,
    freshnessDetail: cue.freshnessDetail,
  })),
  [
    {
      taskType: 'execute',
      model: 'provider:model',
      status: 'actionable',
      confidence: 'limited',
      confidenceLabel: 'Limited sample',
      confidenceDetail: 'Only 8 reviewed execute outcomes support this cue.',
      detail: 'Use as advisory routing-card evidence: provider:model handled execute at 88% across 8 reviewed outcomes. Confidence: limited sample; review before relying on this cue.',
      stale: false,
      freshnessDetail: 'Decision freshness: 8 reviewed routing decisions; first routed 2026-05-01, most recent routed 2026-05-20. This is routing-decision age, not outcome-review age.',
    },
    {
      taskType: 'direct',
      model: 'provider:veteran-model',
      status: 'actionable',
      confidence: 'high',
      confidenceLabel: 'High confidence',
      confidenceDetail: '12 reviewed direct outcomes support this cue.',
      detail: 'Use as advisory routing-card evidence: provider:veteran-model handled direct at 92% across 12 reviewed outcomes.',
      stale: false,
      freshnessDetail: '',
    },
    {
      taskType: 'investigate',
      model: 'provider:research-model',
      status: 'learning',
      confidence: 'learning',
      confidenceLabel: 'Learning',
      confidenceDetail: '3 reviewed investigate outcomes is below the 5-outcome action bar.',
      detail: 'Collect 2 more reviewed investigate outcomes before using provider:research-model as routing-card evidence.',
      stale: false,
      freshnessDetail: '',
    },
    {
      taskType: 'compare',
      model: 'provider:mixed-model',
      status: 'context',
      confidence: 'weak',
      confidenceLabel: 'Weak signal',
      confidenceDetail: '67% is below the 80% action bar for compare.',
      detail: 'provider:mixed-model is the current compare winner, but 67% is below the 80% action bar.',
      stale: false,
      freshnessDetail: '',
    },
  ],
  'export should preserve Routing Learning action cue confidence exactly as the UI and Prompt Microscope derive it',
);
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
assert.equal(payload.summary.toolReliability.outcomeExamples[0].workedBy?.providerId, 'provider', 'export should preserve worked-by provider id');
assert.equal(payload.summary.toolReliability.outcomeExamples[0].failedProviderId, 'provider', 'export should preserve failed provider id for outcome rows');
assert.equal(payload.summary.toolReliability.outcomeExamples[0].evidenceSource, 'saved_session_trace', 'export should preserve session outcome evidence source');
assert.equal(payload.summary.toolReliability.outcomeExamples[0].promptStrategyVariantId, 'qwen-coder-tool-proof', 'export should preserve prompt strategy context for tool-error outcomes');
assert.equal(payload.summary.toolReliability.recoveryExamples[0].promptStrategyVariantId, 'qwen-coder-tool-proof', 'export should preserve prompt strategy context for recovery examples');
assert.equal(payload.summary.toolReliability.recoveryPatterns[0].failedProviderId, 'provider', 'export should preserve failed provider id for recovery pattern');
assert.equal(payload.summary.toolReliability.recoveryPatterns[0].recoveredByProviderId, 'provider', 'export should preserve recovered-by provider id for recovery pattern');
assert.deepEqual(payload.summary.toolReliability.recoveryPatterns[0].exampleSessionIds, ['session-1'], 'export should preserve recovery-pattern session breadcrumbs');
assert.deepEqual(payload.summary.toolReliability.recoveryPatterns[0].exampleEvidenceSources, ['saved_session_trace'], 'export should preserve recovery-pattern evidence sources');
assert.deepEqual(payload.summary.toolReliability.failureMemory[0].exampleSessionIds, ['session-1'], 'export should preserve failure-memory session breadcrumbs');
assert.deepEqual(payload.summary.toolReliability.failureMemory[0].exampleEvidenceSources, ['saved_session_trace'], 'export should preserve failure-memory evidence sources');
assert.equal(payload.summary.toolReliability.failureMemory[0].fixedBy[0].providerId, 'provider', 'export should preserve failure-memory fix path provider id');
assert.deepEqual(payload.summary.toolReliability.errorSignatures[0].exampleSessionIds, ['session-1'], 'export should preserve normalized signature session breadcrumbs');
assert.deepEqual(payload.summary.toolReliability.errorSignatures[0].exampleEvidenceSources, ['saved_session_trace'], 'export should preserve normalized signature evidence sources');
assert.equal(payload.summary.toolReliability.errorSignatures[0].workedBy[0].avgRetryDistance, 1, 'export should preserve normalized signature retry-distance evidence');
assert.equal(payload.summary.toolReliability.errorSignatures[0].workedBy[0].providerId, 'provider', 'export should preserve error-signature worked-by provider id');
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
  thresholdAdvice: {
    configuredThreshold: 0.7,
    activeThreshold: 0.8,
    suggestedThreshold: 0.8,
    reason: 'Low success rate (0% over 10 rated outcomes); raising threshold for safety',
    dataPoints: 10,
    applied: true,
  },
  configuredCandidateCount: 4,
  activeCandidateCount: 2,
}, 'export should preserve router candidate evidence freshness');

const apiSource = readFileSync('src/utils/api.ts', 'utf8');
for (const expected of [
  'thresholdAdvice?: {',
  'configuredThreshold: number;',
  'activeThreshold: number;',
  'suggestedThreshold: number;',
  'reason: string;',
  'dataPoints: number;',
  'applied: boolean;',
  "import type { RoutingLearningActionCue } from '../../shared/routingLearningActionCues';",
  'routingActionCues?: Array<RoutingLearningActionCue>;',
]) {
  assert.ok(apiSource.includes(expected), `Router learning export API type should expose action-cue confidence: ${expected}`);
}

const toolFailureEvents: ToolErrorLedgerEvent[] = [
  {
    id: 'run-1-tool-1',
    timestamp: '2026-06-17T00:30:00.000Z',
    evidenceSource: 'saved_session_trace',
    sessionId: 'secret-session-id',
    runId: 'secret-run-id',
    failedModel: 'provider:model',
    failedProviderId: 'provider',
    failedTool: 'read_file',
    round: 0,
    error: 'ENOENT: missing file',
    runRecovered: true,
    finalStatus: 'complete',
    finalAnswerCaptured: true,
    recoveryModel: 'provider:model',
    recoveryProviderId: 'provider',
    recoveryTool: 'list_directory',
    recoveryRound: 1,
    retryDistance: 1,
  },
  {
    id: 'run-2-tool-1',
    timestamp: '2026-06-17T00:45:00.000Z',
    evidenceSource: 'saved_session_trace',
    sessionId: 'secret-session-id-2',
    runId: 'secret-run-id-2',
    failedModel: 'provider:model',
    failedProviderId: 'provider',
    failedTool: 'shell',
    error: 'Command timed out after 1000ms',
    runRecovered: false,
    finalStatus: 'complete',
    finalAnswerCaptured: true,
  },
];

const toolFailureTrainingExport = buildToolFailureTrainingExportPayload({
  events: toolFailureEvents,
  generatedAt: '2026-06-17T02:00:00.000Z',
});

assert.equal(toolFailureTrainingExport.schemaVersion, 1, 'tool failure training export schema should be stable');
assert.equal(toolFailureTrainingExport.recordCount, 2, 'tool failure training export should include one row per tool failure');
assert.equal(toolFailureTrainingExport.records[0].failed.model, 'provider:model', 'tool failure training export should include failed model');
assert.equal(toolFailureTrainingExport.records[0].failed.tool, 'read_file', 'tool failure training export should include failed tool');
assert.equal(toolFailureTrainingExport.records[0].failed.message, 'ENOENT: missing file', 'tool failure training export should include failure message');
assert.equal(toolFailureTrainingExport.records[0].workaround.type, 'recovered_tool_path', 'tool failure training export should identify recovered tool paths');
assert.equal(toolFailureTrainingExport.records[0].workaround.tool, 'list_directory', 'tool failure training export should include the workaround tool');
assert.equal(toolFailureTrainingExport.records[1].workaround.type, 'final_answer_only', 'tool failure training export should identify completed runs without a later successful tool');
assert.ok(toolFailureTrainingExport.privacyBoundary.excludes.includes('user prompts'), 'tool failure training export should document prompt exclusion');

const serializedToolFailureRecords = JSON.stringify(toolFailureTrainingExport.records);
for (const forbidden of [
  'secret-session-id',
  'secret-run-id',
  'sessionId',
  'runId',
  'prompt',
  'artifact',
  'file content',
]) {
  assert.equal(
    serializedToolFailureRecords.includes(forbidden),
    false,
    `tool failure training export should not leak forbidden runtime field ${forbidden}`,
  );
}

console.log('Router learning export tests passed.');
