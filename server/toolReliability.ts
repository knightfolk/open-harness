import type { HarnessRun, HarnessRunStep } from './runTrace';

export type ToolReliabilityStatus = 'running' | 'complete' | 'error' | 'skipped';
export type ToolReliabilityEvidenceSource = 'saved_session_trace' | 'log_trace' | 'imported_trace';
export type ToolReliabilityTuningAction = 'tune_local_router' | 'review_before_tuning' | 'context_only';
export type ToolReliabilityEvidenceConfidence = 'single_trace' | 'repeated_trace';

export interface ToolReliabilityBucket {
  total: number;
  complete: number;
  error: number;
  skipped: number;
  running: number;
  runs: number;
  firstCallErrors: number;
  affectedRuns: number;
  recoveredRuns: number;
  errorRate: number;
  firstCallErrorRate: number;
  recoveryRate: number;
  avgRecoveryRounds: number;
  avgDurationMs: number;
}

export interface ToolReliabilitySummary {
  totalToolCalls: number;
  completedToolCalls: number;
  errorToolCalls: number;
  skippedToolCalls: number;
  runningToolCalls: number;
  runsWithToolCalls: number;
  firstCallErrorRuns: number;
  runsWithToolErrors: number;
  recoveredRunsWithToolErrors: number;
  avgRecoveryRounds: number;
  byModel: Record<string, ToolReliabilityBucket>;
  byProvider: Record<string, ToolReliabilityBucket>;
  byTool: Record<string, ToolReliabilityBucket>;
  byModelTool: Record<string, ToolReliabilityBucket>;
  byPromptStrategy: Record<string, ToolReliabilityBucket>;
  byPromptStrategyVariant: Record<string, ToolReliabilityBucket>;
  byEvidenceSource: ToolReliabilityEvidenceSourceSummary[];
  toolHeavyAdvice: ToolReliabilityAdvice[];
  recoveryExamples: ToolReliabilityRecoveryExample[];
  outcomeExamples: ToolReliabilityOutcomeExample[];
  recoveryPatterns: ToolReliabilityRecoveryPattern[];
  failureMemory: ToolReliabilityFailureMemory[];
  errorSignatures: ToolReliabilityErrorSignature[];
  retryReductionRecommendations: ToolReliabilityRetryReductionRecommendation[];
  recentErrors: ToolReliabilityErrorExample[];
}

export interface ToolReliabilityErrorExample {
  evidenceSource: ToolReliabilityEvidenceSource;
  sessionId: string;
  runId: string;
  model: string;
  providerId: string;
  tool: string;
  promptStrategyId?: string;
  promptStrategyVariantId?: string;
  round?: number;
  error?: string;
  timestamp: string;
}

export interface ToolReliabilityRecoveryExample {
  evidenceSource: ToolReliabilityEvidenceSource;
  sessionId: string;
  runId: string;
  promptStrategyId?: string;
  promptStrategyVariantId?: string;
  firstError: {
    model: string;
    providerId: string;
    tool: string;
    round?: number;
    error?: string;
  };
  recoveredBy: Array<{
    model: string;
    providerId: string;
    tool: string;
    round?: number;
    durationMs?: number;
  }>;
  finalStatus: HarnessRun['status'];
  finalAnswerCaptured: boolean;
  recoveryRounds: number;
  timestamp: string;
}

export type ToolReliabilityOutcomeKind =
  | 'recovered_tool_path'
  | 'fallback_tool_path'
  | 'final_answer_only'
  | 'unrecovered_error'
  | 'running_or_unknown';

export interface ToolReliabilityOutcomeExample {
  evidenceSource: ToolReliabilityEvidenceSource;
  sessionId: string;
  runId: string;
  failedModel: string;
  failedProviderId: string;
  failedTool: string;
  promptStrategyId?: string;
  promptStrategyVariantId?: string;
  outcome: ToolReliabilityOutcomeKind;
  workedBy?: {
    model: string;
    providerId: string;
    tool: string;
    round?: number;
    durationMs?: number;
  };
  finalStatus: HarnessRun['status'];
  finalAnswerCaptured: boolean;
  recoveryRounds: number;
  retryDistance: number;
  error?: string;
  timestamp: string;
}

export interface ToolReliabilityRecoveryPattern {
  failedModel: string;
  failedProviderId: string;
  failedTool: string;
  recoveredByModel: string;
  recoveredByProviderId: string;
  recoveredByTool: string;
  runs: number;
  finalAnswerRuns: number;
  avgRecoveryRounds: number;
  latestTimestamp: string;
  exampleSessionIds: string[];
  exampleRunIds: string[];
  exampleEvidenceSources: ToolReliabilityEvidenceSource[];
}

export interface ToolReliabilityFailureMemory {
  model: string;
  providerId: string;
  tool: string;
  errorRuns: number;
  recoveredRuns: number;
  unrecoveredRuns: number;
  fallbackRecoveryRuns: number;
  promptStrategies: Array<{ id: string; runs: number }>;
  promptStrategyVariants: Array<{ id: string; runs: number }>;
  latestError?: string;
  latestTimestamp: string;
  fixedBy: Array<{
    model: string;
    providerId: string;
    tool: string;
    runs: number;
    avgRecoveryRounds: number;
  }>;
  exampleSessionIds: string[];
  exampleRunIds: string[];
  exampleEvidenceSources: ToolReliabilityEvidenceSource[];
}

export interface ToolReliabilityErrorSignature {
  signature: string;
  model: string;
  providerId: string;
  tool: string;
  runs: number;
  recoveredRuns: number;
  unrecoveredRuns: number;
  fallbackRecoveryRuns: number;
  promptStrategies: Array<{ id: string; runs: number }>;
  promptStrategyVariants: Array<{ id: string; runs: number }>;
  sampleError?: string;
  latestTimestamp: string;
  workedBy: Array<{
    model: string;
    providerId: string;
    tool: string;
    runs: number;
    avgRetryDistance: number;
  }>;
  exampleSessionIds: string[];
  exampleRunIds: string[];
  exampleEvidenceSources: ToolReliabilityEvidenceSource[];
}

export interface ToolReliabilityRetryReductionRecommendation {
  evidenceSource: ToolReliabilityEvidenceSource;
  tuningAction: ToolReliabilityTuningAction;
  sessionId: string;
  runId: string;
  failedModel: string;
  failedProviderId: string;
  failedTool: string;
  promptStrategyId?: string;
  promptStrategyVariantId?: string;
  outcome: ToolReliabilityOutcomeKind;
  avoidPath: string;
  preferPath: string;
  avoidProviderPath: string;
  preferProviderPath: string;
  supportRunCount: number;
  supportSessionIds: string[];
  supportRunIds: string[];
  evidenceConfidence: ToolReliabilityEvidenceConfidence;
  avgRetryDistance: number;
  retryDistance: number;
  recommendation: string;
  tuningGuidance: string;
  timestamp: string;
}

export interface ToolReliabilityEvidenceSourceSummary {
  source: ToolReliabilityEvidenceSource;
  tuningAction: ToolReliabilityTuningAction;
  outcomeRuns: number;
  recoveredRuns: number;
  unrecoveredRuns: number;
  retryReductionRecommendations: number;
  avgRetryDistance: number;
  latestTimestamp: string;
}

export interface ToolReliabilityAdvice {
  scope: 'model' | 'tool' | 'model_tool' | 'prompt_strategy' | 'strategy_variant';
  key: string;
  tone: 'good' | 'caution' | 'risk';
  title: string;
  detail: string;
  total: number;
  errorRate: number;
  firstCallErrorRate: number;
  recoveryRate: number;
  avgRecoveryRounds: number;
}

export interface ToolReliabilityMessage {
  timestamp?: string;
  runTrace?: HarnessRun;
  evidenceSource?: ToolReliabilityEvidenceSource;
}

export interface ToolReliabilitySession {
  id: string;
  messages?: ToolReliabilityMessage[];
  evidenceSource?: ToolReliabilityEvidenceSource;
}

function toolReliabilityEvidenceSource(
  session: ToolReliabilitySession,
  message: ToolReliabilityMessage,
): ToolReliabilityEvidenceSource {
  return message.evidenceSource || session.evidenceSource || 'saved_session_trace';
}

function emptyToolReliabilityBucket(): ToolReliabilityBucket {
  return {
    total: 0,
    complete: 0,
    error: 0,
    skipped: 0,
    running: 0,
    runs: 0,
    firstCallErrors: 0,
    affectedRuns: 0,
    recoveredRuns: 0,
    errorRate: 0,
    firstCallErrorRate: 0,
    recoveryRate: 0,
    avgRecoveryRounds: 0,
    avgDurationMs: 0,
  };
}

export function normalizeToolStatus(step: Extract<HarnessRunStep, { type: 'tool_call' }>): ToolReliabilityStatus {
  if (step.status === 'running' || step.status === 'complete' || step.status === 'error' || step.status === 'skipped') return step.status;
  if (typeof step.error === 'string' && step.error.trim()) return 'error';
  const output = typeof (step as { outputPreview?: string }).outputPreview === 'string'
    ? (step as { outputPreview?: string }).outputPreview.trim()
    : '';
  if (/^error\W/i.test(output)) return 'error';
  if (/^\{\"?error\"?[:\s]/i.test(output)) return 'error';
  return step.durationMs == null ? 'running' : 'complete';
}

function incrementToolBucket(
  buckets: Record<string, ToolReliabilityBucket>,
  durations: Record<string, { totalMs: number; count: number }>,
  key: string,
  status: ToolReliabilityStatus,
  durationMs?: number,
): void {
  const safeKey = key || 'unknown';
  const bucket = buckets[safeKey] || emptyToolReliabilityBucket();
  bucket.total += 1;
  bucket[status] += 1;
  buckets[safeKey] = bucket;
  if (typeof durationMs === 'number' && Number.isFinite(durationMs)) {
    const duration = durations[safeKey] || { totalMs: 0, count: 0 };
    duration.totalMs += durationMs;
    duration.count += 1;
    durations[safeKey] = duration;
  }
}

function finalizeToolBuckets(
  buckets: Record<string, ToolReliabilityBucket>,
  durations: Record<string, { totalMs: number; count: number }>,
  affectedRuns: Record<string, Set<string>>,
  recoveredRuns: Record<string, Set<string>>,
  allRuns: Record<string, Set<string>>,
  firstCallErrorRuns: Record<string, Set<string>>,
  recoveryRounds: Record<string, { totalRounds: number; count: number }>,
): Record<string, ToolReliabilityBucket> {
  for (const [key, bucket] of Object.entries(buckets)) {
    bucket.runs = allRuns[key]?.size || 0;
    bucket.firstCallErrors = firstCallErrorRuns[key]?.size || 0;
    bucket.affectedRuns = affectedRuns[key]?.size || 0;
    bucket.recoveredRuns = recoveredRuns[key]?.size || 0;
    bucket.errorRate = bucket.total > 0 ? bucket.error / bucket.total : 0;
    bucket.firstCallErrorRate = bucket.runs > 0 ? bucket.firstCallErrors / bucket.runs : 0;
    bucket.recoveryRate = bucket.affectedRuns > 0 ? bucket.recoveredRuns / bucket.affectedRuns : 0;
    const recovery = recoveryRounds[key];
    bucket.avgRecoveryRounds = recovery && recovery.count > 0 ? Math.round((recovery.totalRounds / recovery.count) * 10) / 10 : 0;
    const duration = durations[key];
    bucket.avgDurationMs = duration && duration.count > 0 ? Math.round(duration.totalMs / duration.count) : 0;
  }
  return buckets;
}

function addRunMembership(map: Record<string, Set<string>>, key: string, runId: string): void {
  const safeKey = key || 'unknown';
  if (!map[safeKey]) map[safeKey] = new Set<string>();
  map[safeKey].add(runId);
}

function addRecoveryRounds(map: Record<string, { totalRounds: number; count: number }>, key: string, rounds: number): void {
  const safeKey = key || 'unknown';
  const current = map[safeKey] || { totalRounds: 0, count: 0 };
  current.totalRounds += rounds;
  current.count += 1;
  map[safeKey] = current;
}

function toolStepRound(step: Extract<HarnessRunStep, { type: 'tool_call' }>, fallback: number): number {
  return typeof step.round === 'number' && Number.isFinite(step.round) ? step.round : fallback;
}

export function normalizeToolErrorSignature(error?: string): string {
  const text = String(error || '').trim();
  if (!text) return 'unknown-tool-error';
  return text
    .replace(/Error:\s*/gi, '')
    .replace(/\b[A-Z]:\\[^\s"'`]+/g, '<path>')
    .replace(/\/(?:Users|var|tmp|private|Volumes|home)\/[^\s"'`]+/g, '<path>')
    .replace(/\b[0-9a-f]{8,}\b/gi, '<id>')
    .replace(/\b\d+\b/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, 140) || 'unknown-tool-error';
}

export function buildToolReliabilitySummary(sessions: ToolReliabilitySession[]): ToolReliabilitySummary {
  const summary: ToolReliabilitySummary = {
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
  };
  const modelDurations: Record<string, { totalMs: number; count: number }> = {};
  const providerDurations: Record<string, { totalMs: number; count: number }> = {};
  const toolDurations: Record<string, { totalMs: number; count: number }> = {};
  const modelToolDurations: Record<string, { totalMs: number; count: number }> = {};
  const promptStrategyDurations: Record<string, { totalMs: number; count: number }> = {};
  const promptStrategyVariantDurations: Record<string, { totalMs: number; count: number }> = {};
  const modelAffectedRuns: Record<string, Set<string>> = {};
  const providerAffectedRuns: Record<string, Set<string>> = {};
  const toolAffectedRuns: Record<string, Set<string>> = {};
  const modelToolAffectedRuns: Record<string, Set<string>> = {};
  const promptStrategyAffectedRuns: Record<string, Set<string>> = {};
  const promptStrategyVariantAffectedRuns: Record<string, Set<string>> = {};
  const modelRecoveredRuns: Record<string, Set<string>> = {};
  const providerRecoveredRuns: Record<string, Set<string>> = {};
  const toolRecoveredRuns: Record<string, Set<string>> = {};
  const modelToolRecoveredRuns: Record<string, Set<string>> = {};
  const promptStrategyRecoveredRuns: Record<string, Set<string>> = {};
  const promptStrategyVariantRecoveredRuns: Record<string, Set<string>> = {};
  const modelAllRuns: Record<string, Set<string>> = {};
  const providerAllRuns: Record<string, Set<string>> = {};
  const toolAllRuns: Record<string, Set<string>> = {};
  const modelToolAllRuns: Record<string, Set<string>> = {};
  const promptStrategyAllRuns: Record<string, Set<string>> = {};
  const promptStrategyVariantAllRuns: Record<string, Set<string>> = {};
  const modelFirstCallErrorRuns: Record<string, Set<string>> = {};
  const providerFirstCallErrorRuns: Record<string, Set<string>> = {};
  const toolFirstCallErrorRuns: Record<string, Set<string>> = {};
  const modelToolFirstCallErrorRuns: Record<string, Set<string>> = {};
  const promptStrategyFirstCallErrorRuns: Record<string, Set<string>> = {};
  const promptStrategyVariantFirstCallErrorRuns: Record<string, Set<string>> = {};
  const modelRecoveryRounds: Record<string, { totalRounds: number; count: number }> = {};
  const providerRecoveryRounds: Record<string, { totalRounds: number; count: number }> = {};
  const toolRecoveryRounds: Record<string, { totalRounds: number; count: number }> = {};
  const modelToolRecoveryRounds: Record<string, { totalRounds: number; count: number }> = {};
  const promptStrategyRecoveryRounds: Record<string, { totalRounds: number; count: number }> = {};
  const promptStrategyVariantRecoveryRounds: Record<string, { totalRounds: number; count: number }> = {};
  let totalRecoveryRounds = 0;

  for (const session of sessions) {
    for (const message of session.messages || []) {
      const run = message.runTrace;
      if (!run?.steps?.length) continue;
      const evidenceSource = toolReliabilityEvidenceSource(session, message);
      const toolSteps = run.steps.filter((step): step is Extract<HarnessRunStep, { type: 'tool_call' }> => step.type === 'tool_call');
      if (toolSteps.length === 0) continue;
      const promptBuiltStep = run.steps.find((step) => step.type === 'prompt_built');
      const promptStrategy = promptBuiltStep?.type === 'prompt_built' ? promptBuiltStep.assembly?.promptStrategy : undefined;
      const promptStrategyKey = promptStrategy?.id || 'unknown';
      const promptStrategyVariantId = (promptStrategy as { variantId?: string } | undefined)?.variantId;
      const promptStrategyVariantKey = promptStrategyVariantId
        ? `${promptStrategyKey}:${promptStrategyVariantId}`
        : promptStrategyKey;
      summary.runsWithToolCalls += 1;
      const erroredSteps = toolSteps.filter((step) => normalizeToolStatus(step) === 'error');
      const firstToolStep = toolSteps[0];
      const firstToolStatus = normalizeToolStatus(firstToolStep);
      const firstToolModel = firstToolStep.model || run.effectiveModel || 'unknown';
      const firstToolProvider = firstToolStep.providerId || run.providerId || 'unknown';
      const firstToolName = firstToolStep.name || 'unknown';
      const firstToolModelTool = `${firstToolModel} / ${firstToolName}`;
      const firstCallFailed = firstToolStatus === 'error';
      const runRecovered = erroredSteps.length > 0
        && run.status === 'complete'
        && run.steps.some((step) => step.type === 'final_answer');
      if (erroredSteps.length > 0) summary.runsWithToolErrors += 1;
      if (firstCallFailed) summary.firstCallErrorRuns += 1;
      const firstErrorRound = erroredSteps.length > 0
        ? Math.min(...erroredSteps.map((step, index) => toolStepRound(step, index)))
        : 0;
      const maxToolRound = Math.max(...toolSteps.map((step, index) => toolStepRound(step, index)));
      const recoveryRounds = runRecovered ? Math.max(0, maxToolRound - firstErrorRound) : 0;
      if (erroredSteps.length > 0) {
        const firstErrorStep = erroredSteps
          .slice()
          .sort((a, b) => toolStepRound(a, 0) - toolStepRound(b, 0))[0];
        const firstErrorIndex = toolSteps.indexOf(firstErrorStep);
        const laterCompleteSteps = toolSteps
          .slice(firstErrorIndex + 1)
          .filter((step) => normalizeToolStatus(step) === 'complete')
          .slice(0, 4);
        const workedStep = laterCompleteSteps[0];
        const failedModel = firstErrorStep.model || run.effectiveModel || 'unknown';
        const failedProviderId = firstErrorStep.providerId || run.providerId || 'unknown';
        const fallbackWorked = workedStep
          ? (workedStep.model || run.effectiveModel || 'unknown') !== failedModel
            || (workedStep.providerId || run.providerId || 'unknown') !== failedProviderId
          : false;
        const finalAnswerCaptured = run.steps.some((step) => step.type === 'final_answer');
        const retryDistance = workedStep
          ? Math.max(0, toolStepRound(workedStep, firstErrorIndex + 1) - toolStepRound(firstErrorStep, firstErrorIndex))
          : recoveryRounds;
        summary.outcomeExamples.push({
          evidenceSource,
          sessionId: session.id,
          runId: run.id,
          failedModel,
          failedProviderId,
          failedTool: firstErrorStep.name || 'unknown',
          promptStrategyId: promptStrategyKey,
          promptStrategyVariantId: promptStrategyVariantKey,
          outcome: runRecovered
            ? workedStep
              ? fallbackWorked ? 'fallback_tool_path' : 'recovered_tool_path'
              : 'final_answer_only'
            : run.status === 'running' ? 'running_or_unknown' : 'unrecovered_error',
          workedBy: workedStep
            ? {
                model: workedStep.model || run.effectiveModel || 'unknown',
                providerId: workedStep.providerId || run.providerId || 'unknown',
                tool: workedStep.name || 'unknown',
                round: workedStep.round,
                durationMs: workedStep.durationMs,
              }
            : undefined,
          finalStatus: run.status,
          finalAnswerCaptured,
          recoveryRounds,
          retryDistance,
          error: firstErrorStep.error || firstErrorStep.outputPreview,
          timestamp: message.timestamp || run.completedAt || run.startedAt,
        });
        if (runRecovered) {
          summary.recoveredRunsWithToolErrors += 1;
          totalRecoveryRounds += recoveryRounds;
        summary.recoveryExamples.push({
          evidenceSource,
          sessionId: session.id,
          runId: run.id,
          promptStrategyId: promptStrategyKey,
          promptStrategyVariantId: promptStrategyVariantKey,
          firstError: {
            model: failedModel,
            providerId: failedProviderId,
            tool: firstErrorStep.name || 'unknown',
            round: firstErrorStep.round,
            error: firstErrorStep.error || firstErrorStep.outputPreview,
          },
          recoveredBy: laterCompleteSteps.map((step) => ({
            model: step.model || run.effectiveModel || 'unknown',
            providerId: step.providerId || run.providerId || 'unknown',
            tool: step.name || 'unknown',
            round: step.round,
            durationMs: step.durationMs,
          })),
          finalStatus: run.status,
          finalAnswerCaptured,
          recoveryRounds,
          timestamp: message.timestamp || run.completedAt || run.startedAt,
        });
        }
      }

      for (const step of toolSteps) {
        const status = normalizeToolStatus(step);
        const model = step.model || run.effectiveModel || 'unknown';
        const providerId = step.providerId || run.providerId || 'unknown';
        const tool = step.name || 'unknown';
        const modelTool = `${model} / ${tool}`;
        summary.totalToolCalls += 1;
        if (status === 'complete') summary.completedToolCalls += 1;
        if (status === 'error') summary.errorToolCalls += 1;
        if (status === 'skipped') summary.skippedToolCalls += 1;
        if (status === 'running') summary.runningToolCalls += 1;

        incrementToolBucket(summary.byModel, modelDurations, model, status, step.durationMs);
        incrementToolBucket(summary.byProvider, providerDurations, providerId, status, step.durationMs);
        incrementToolBucket(summary.byTool, toolDurations, tool, status, step.durationMs);
        incrementToolBucket(summary.byModelTool, modelToolDurations, modelTool, status, step.durationMs);
        incrementToolBucket(summary.byPromptStrategy, promptStrategyDurations, promptStrategyKey, status, step.durationMs);
        incrementToolBucket(summary.byPromptStrategyVariant, promptStrategyVariantDurations, promptStrategyVariantKey, status, step.durationMs);
        addRunMembership(modelAllRuns, model, run.id);
        addRunMembership(providerAllRuns, providerId, run.id);
        addRunMembership(toolAllRuns, tool, run.id);
        addRunMembership(modelToolAllRuns, modelTool, run.id);
        addRunMembership(promptStrategyAllRuns, promptStrategyKey, run.id);
        addRunMembership(promptStrategyVariantAllRuns, promptStrategyVariantKey, run.id);

        if (erroredSteps.length > 0) {
          addRunMembership(modelAffectedRuns, model, run.id);
          addRunMembership(providerAffectedRuns, providerId, run.id);
          addRunMembership(toolAffectedRuns, tool, run.id);
          addRunMembership(modelToolAffectedRuns, modelTool, run.id);
          addRunMembership(promptStrategyAffectedRuns, promptStrategyKey, run.id);
          addRunMembership(promptStrategyVariantAffectedRuns, promptStrategyVariantKey, run.id);
        }
        if (runRecovered) {
          addRunMembership(modelRecoveredRuns, model, run.id);
          addRunMembership(providerRecoveredRuns, providerId, run.id);
          addRunMembership(toolRecoveredRuns, tool, run.id);
          addRunMembership(modelToolRecoveredRuns, modelTool, run.id);
          addRunMembership(promptStrategyRecoveredRuns, promptStrategyKey, run.id);
          addRunMembership(promptStrategyVariantRecoveredRuns, promptStrategyVariantKey, run.id);
        }
        if (status === 'error') {
          summary.recentErrors.push({
            evidenceSource,
            sessionId: session.id,
            runId: run.id,
            model,
            providerId,
            tool,
            promptStrategyId: promptStrategyKey,
            promptStrategyVariantId: promptStrategyVariantKey,
            round: step.round,
            error: step.error || step.outputPreview,
            timestamp: message.timestamp || run.completedAt || run.startedAt,
          });
        }
      }
      if (firstCallFailed) {
        addRunMembership(modelFirstCallErrorRuns, firstToolModel, run.id);
        addRunMembership(providerFirstCallErrorRuns, firstToolProvider, run.id);
        addRunMembership(toolFirstCallErrorRuns, firstToolName, run.id);
        addRunMembership(modelToolFirstCallErrorRuns, firstToolModelTool, run.id);
        addRunMembership(promptStrategyFirstCallErrorRuns, promptStrategyKey, run.id);
        addRunMembership(promptStrategyVariantFirstCallErrorRuns, promptStrategyVariantKey, run.id);
      }
      if (runRecovered) {
        for (const step of erroredSteps) {
          const model = step.model || run.effectiveModel || 'unknown';
          const providerId = step.providerId || run.providerId || 'unknown';
          const tool = step.name || 'unknown';
          const modelTool = `${model} / ${tool}`;
          addRecoveryRounds(modelRecoveryRounds, model, recoveryRounds);
          addRecoveryRounds(providerRecoveryRounds, providerId, recoveryRounds);
          addRecoveryRounds(toolRecoveryRounds, tool, recoveryRounds);
          addRecoveryRounds(modelToolRecoveryRounds, modelTool, recoveryRounds);
          addRecoveryRounds(promptStrategyRecoveryRounds, promptStrategyKey, recoveryRounds);
          addRecoveryRounds(promptStrategyVariantRecoveryRounds, promptStrategyVariantKey, recoveryRounds);
        }
      }
    }
  }

  summary.avgRecoveryRounds = summary.recoveredRunsWithToolErrors > 0
    ? Math.round((totalRecoveryRounds / summary.recoveredRunsWithToolErrors) * 10) / 10
    : 0;
  summary.byModel = finalizeToolBuckets(summary.byModel, modelDurations, modelAffectedRuns, modelRecoveredRuns, modelAllRuns, modelFirstCallErrorRuns, modelRecoveryRounds);
  summary.byProvider = finalizeToolBuckets(summary.byProvider, providerDurations, providerAffectedRuns, providerRecoveredRuns, providerAllRuns, providerFirstCallErrorRuns, providerRecoveryRounds);
  summary.byTool = finalizeToolBuckets(summary.byTool, toolDurations, toolAffectedRuns, toolRecoveredRuns, toolAllRuns, toolFirstCallErrorRuns, toolRecoveryRounds);
  summary.byModelTool = finalizeToolBuckets(summary.byModelTool, modelToolDurations, modelToolAffectedRuns, modelToolRecoveredRuns, modelToolAllRuns, modelToolFirstCallErrorRuns, modelToolRecoveryRounds);
  summary.byPromptStrategy = finalizeToolBuckets(summary.byPromptStrategy, promptStrategyDurations, promptStrategyAffectedRuns, promptStrategyRecoveredRuns, promptStrategyAllRuns, promptStrategyFirstCallErrorRuns, promptStrategyRecoveryRounds);
  summary.byPromptStrategyVariant = finalizeToolBuckets(summary.byPromptStrategyVariant, promptStrategyVariantDurations, promptStrategyVariantAffectedRuns, promptStrategyVariantRecoveredRuns, promptStrategyVariantAllRuns, promptStrategyVariantFirstCallErrorRuns, promptStrategyVariantRecoveryRounds);
  summary.toolHeavyAdvice = buildToolHeavyAdvice(summary);
  summary.recoveryPatterns = buildRecoveryPatterns(summary.recoveryExamples);
  summary.failureMemory = buildFailureMemory(summary.recentErrors, summary.recoveryPatterns);
  summary.errorSignatures = buildErrorSignatures(summary.recentErrors, summary.outcomeExamples);
  summary.retryReductionRecommendations = buildRetryReductionRecommendations(summary.outcomeExamples);
  summary.byEvidenceSource = buildEvidenceSourceSummary(summary.outcomeExamples, summary.retryReductionRecommendations);
  summary.recoveryExamples = summary.recoveryExamples
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, 12);
  summary.outcomeExamples = summary.outcomeExamples
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, 20);
  summary.recentErrors = summary.recentErrors
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, 20);
  return summary;
}

export function buildEvidenceSourceSummary(
  outcomes: ToolReliabilityOutcomeExample[],
  recommendations: ToolReliabilityRetryReductionRecommendation[],
): ToolReliabilityEvidenceSourceSummary[] {
  const recommendationRunsBySource: Record<string, Set<string>> = {};
  for (const recommendation of recommendations) {
    const key = recommendation.evidenceSource;
    if (!recommendationRunsBySource[key]) recommendationRunsBySource[key] = new Set<string>();
    recommendationRunsBySource[key].add(recommendation.runId);
  }

  const sources: Record<string, {
    source: ToolReliabilityEvidenceSource;
    runIds: Set<string>;
    recoveredRunIds: Set<string>;
    totalRetryDistance: number;
    retryDistanceCount: number;
    latestTimestamp: string;
  }> = {};

  for (const outcome of outcomes) {
    const key = outcome.evidenceSource;
    const current = sources[key] || {
      source: outcome.evidenceSource,
      runIds: new Set<string>(),
      recoveredRunIds: new Set<string>(),
      totalRetryDistance: 0,
      retryDistanceCount: 0,
      latestTimestamp: outcome.timestamp,
    };
    current.runIds.add(outcome.runId);
    if (outcome.outcome !== 'unrecovered_error' && outcome.outcome !== 'running_or_unknown') {
      current.recoveredRunIds.add(outcome.runId);
    }
    current.totalRetryDistance += outcome.retryDistance;
    current.retryDistanceCount += 1;
    if (Date.parse(outcome.timestamp) > Date.parse(current.latestTimestamp)) current.latestTimestamp = outcome.timestamp;
    sources[key] = current;
  }

  return Object.values(sources)
    .map((item) => ({
      source: item.source,
      tuningAction: tuningActionForEvidenceSource(item.source),
      outcomeRuns: item.runIds.size,
      recoveredRuns: item.recoveredRunIds.size,
      unrecoveredRuns: Math.max(0, item.runIds.size - item.recoveredRunIds.size),
      retryReductionRecommendations: recommendationRunsBySource[item.source]?.size || 0,
      avgRetryDistance: item.retryDistanceCount > 0 ? Math.round((item.totalRetryDistance / item.retryDistanceCount) * 10) / 10 : 0,
      latestTimestamp: item.latestTimestamp,
    }))
    .sort((a, b) => b.outcomeRuns - a.outcomeRuns || Date.parse(b.latestTimestamp) - Date.parse(a.latestTimestamp));
}

export function buildRetryReductionRecommendations(
  outcomes: ToolReliabilityOutcomeExample[],
): ToolReliabilityRetryReductionRecommendation[] {
  const supportRunsByPath: Record<string, Set<string>> = {};
  const supportSessionsByPath: Record<string, Set<string>> = {};
  const retryDistanceByPath: Record<string, { total: number; count: number }> = {};
  for (const outcome of outcomes) {
    const avoidPath = `${outcome.failedModel}/${outcome.failedTool}`;
    const avoidProviderPath = `${outcome.failedProviderId}:${outcome.failedModel}/${outcome.failedTool}`;
    const preferPath = outcome.workedBy
      ? `${outcome.workedBy.model}/${outcome.workedBy.tool}`
      : outcome.finalAnswerCaptured
        ? 'final answer without another completed tool call'
        : 'no recovered path captured';
    const preferProviderPath = outcome.workedBy
      ? `${outcome.workedBy.providerId}:${outcome.workedBy.model}/${outcome.workedBy.tool}`
      : preferPath;
    const key = [outcome.evidenceSource, avoidProviderPath, preferProviderPath].join('\u0000');
    if (!supportRunsByPath[key]) supportRunsByPath[key] = new Set<string>();
    if (!supportSessionsByPath[key]) supportSessionsByPath[key] = new Set<string>();
    supportRunsByPath[key].add(outcome.runId);
    supportSessionsByPath[key].add(outcome.sessionId);
    const retryStats = retryDistanceByPath[key] || { total: 0, count: 0 };
    retryStats.total += outcome.retryDistance;
    retryStats.count += 1;
    retryDistanceByPath[key] = retryStats;
  }
  const seenRecommendationKeys = new Set<string>();
  return outcomes
    .map((outcome): ToolReliabilityRetryReductionRecommendation => {
      const tuningAction = tuningActionForEvidenceSource(outcome.evidenceSource);
      const avoidPath = `${outcome.failedModel}/${outcome.failedTool}`;
      const avoidProviderPath = `${outcome.failedProviderId}:${outcome.failedModel}/${outcome.failedTool}`;
      const preferPath = outcome.workedBy
        ? `${outcome.workedBy.model}/${outcome.workedBy.tool}`
        : outcome.finalAnswerCaptured
          ? 'final answer without another completed tool call'
          : 'no recovered path captured';
      const preferProviderPath = outcome.workedBy
        ? `${outcome.workedBy.providerId}:${outcome.workedBy.model}/${outcome.workedBy.tool}`
        : preferPath;
      const recommendationKey = [outcome.evidenceSource, avoidProviderPath, preferProviderPath].join('\u0000');
      const supportRunCount = supportRunsByPath[recommendationKey]?.size || 1;
      const supportSessionIds = Array.from(supportSessionsByPath[recommendationKey] || [outcome.sessionId]).slice(0, 4);
      const supportRunIds = Array.from(supportRunsByPath[recommendationKey] || [outcome.runId]).slice(0, 4);
      const retryStats = retryDistanceByPath[recommendationKey];
      const avgRetryDistance = retryStats && retryStats.count > 0
        ? Math.round((retryStats.total / retryStats.count) * 10) / 10
        : outcome.retryDistance;
      const recommendation = outcome.workedBy
        ? `Prefer ${preferPath} before repeating ${avoidPath} for similar tool-heavy work.`
        : outcome.finalAnswerCaptured
          ? `Do not blindly retry ${avoidPath}; the saved run reached a final answer without another completed tool call.`
          : `Avoid repeating ${avoidPath} without changing the model, tool contract, or prompt strategy.`;
      return {
        evidenceSource: outcome.evidenceSource,
        tuningAction,
        sessionId: outcome.sessionId,
        runId: outcome.runId,
        failedModel: outcome.failedModel,
        failedProviderId: outcome.failedProviderId,
        failedTool: outcome.failedTool,
        promptStrategyId: outcome.promptStrategyId,
        promptStrategyVariantId: outcome.promptStrategyVariantId,
        outcome: outcome.outcome,
        avoidPath,
        preferPath,
        avoidProviderPath,
        preferProviderPath,
        supportRunCount,
        supportSessionIds,
        supportRunIds,
        evidenceConfidence: supportRunCount > 1 ? 'repeated_trace' : 'single_trace',
        avgRetryDistance,
        retryDistance: outcome.retryDistance,
        recommendation,
        tuningGuidance: tuningGuidanceForAction(tuningAction),
        timestamp: outcome.timestamp,
      };
    })
    .sort((a, b) => {
      const aRecovered = a.outcome === 'recovered_tool_path' || a.outcome === 'fallback_tool_path';
      const bRecovered = b.outcome === 'recovered_tool_path' || b.outcome === 'fallback_tool_path';
      if (aRecovered !== bRecovered) return aRecovered ? -1 : 1;
      if (a.supportRunCount !== b.supportRunCount) return b.supportRunCount - a.supportRunCount;
      return Date.parse(b.timestamp) - Date.parse(a.timestamp);
    })
    .filter((recommendation) => {
      const key = [recommendation.evidenceSource, recommendation.avoidProviderPath, recommendation.preferProviderPath].join('\u0000');
      if (seenRecommendationKeys.has(key)) return false;
      seenRecommendationKeys.add(key);
      return true;
    })
    .slice(0, 12);
}

function tuningActionForEvidenceSource(source: ToolReliabilityEvidenceSource): ToolReliabilityTuningAction {
  if (source === 'saved_session_trace') return 'tune_local_router';
  if (source === 'log_trace') return 'review_before_tuning';
  return 'context_only';
}

function tuningGuidanceForAction(action: ToolReliabilityTuningAction): string {
  if (action === 'tune_local_router') return 'Local saved-session evidence: safe to use for candidate-card, prompt-contract, or cost tuning after normal review.';
  if (action === 'review_before_tuning') return 'Log-derived evidence: review the originating log before changing routing defaults.';
  return 'Imported evidence: context only until a reviewed merge path promotes it into local routing evidence.';
}

export function buildErrorSignatures(
  errors: ToolReliabilityErrorExample[],
  outcomes: ToolReliabilityOutcomeExample[],
): ToolReliabilityErrorSignature[] {
  const outcomeByRunTool: Record<string, ToolReliabilityOutcomeExample[]> = {};
  for (const outcome of outcomes) {
    const key = failureKey(outcome.failedModel, outcome.failedProviderId, outcome.failedTool);
    const compoundKey = `${outcome.runId}\u0000${key}`;
    if (!outcomeByRunTool[compoundKey]) outcomeByRunTool[compoundKey] = [];
    outcomeByRunTool[compoundKey].push(outcome);
  }

  const signatures: Record<string, ToolReliabilityErrorSignature & {
    runIds: Set<string>;
    recoveredRunIds: Set<string>;
    fallbackRunIds: Set<string>;
    promptStrategyCounts: Record<string, Set<string>>;
    promptStrategyVariantCounts: Record<string, Set<string>>;
    workedByCounts: Record<string, { model: string; providerId: string; tool: string; runs: Set<string>; totalRetryDistance: number }>;
  }> = {};

  for (const error of errors) {
    const signature = normalizeToolErrorSignature(error.error);
    const key = [
      error.model || 'unknown',
      error.providerId || 'unknown',
      error.tool || 'unknown',
      signature,
    ].join('\u0000');
    const current = signatures[key] || {
      signature,
      model: error.model,
      providerId: error.providerId,
      tool: error.tool,
      runs: 0,
      recoveredRuns: 0,
      unrecoveredRuns: 0,
      fallbackRecoveryRuns: 0,
      promptStrategies: [],
      promptStrategyVariants: [],
      sampleError: error.error,
      latestTimestamp: error.timestamp,
      workedBy: [],
      exampleSessionIds: [],
      exampleRunIds: [],
      exampleEvidenceSources: [],
      runIds: new Set<string>(),
      recoveredRunIds: new Set<string>(),
      fallbackRunIds: new Set<string>(),
      promptStrategyCounts: {},
      promptStrategyVariantCounts: {},
      workedByCounts: {},
    };

    current.runIds.add(error.runId);
    if (error.promptStrategyId) {
      if (!current.promptStrategyCounts[error.promptStrategyId]) current.promptStrategyCounts[error.promptStrategyId] = new Set<string>();
      current.promptStrategyCounts[error.promptStrategyId].add(error.runId);
    }
    if (error.promptStrategyVariantId) {
      if (!current.promptStrategyVariantCounts[error.promptStrategyVariantId]) current.promptStrategyVariantCounts[error.promptStrategyVariantId] = new Set<string>();
      current.promptStrategyVariantCounts[error.promptStrategyVariantId].add(error.runId);
    }

    const matchingOutcomes = outcomeByRunTool[`${error.runId}\u0000${failureKey(error.model, error.providerId, error.tool)}`] || [];
    for (const outcome of matchingOutcomes) {
      if (outcome.outcome !== 'unrecovered_error' && outcome.outcome !== 'running_or_unknown') {
        current.recoveredRunIds.add(error.runId);
      }
      if (outcome.outcome === 'fallback_tool_path') current.fallbackRunIds.add(error.runId);
      if (outcome.workedBy) {
        const workedKey = failureKey(outcome.workedBy.model, outcome.workedBy.providerId, outcome.workedBy.tool);
        const worked = current.workedByCounts[workedKey] || {
          model: outcome.workedBy.model,
          providerId: outcome.workedBy.providerId,
          tool: outcome.workedBy.tool,
          runs: new Set<string>(),
          totalRetryDistance: 0,
        };
        worked.runs.add(error.runId);
        worked.totalRetryDistance += outcome.retryDistance;
        current.workedByCounts[workedKey] = worked;
      }
    }

    if (Date.parse(error.timestamp) >= Date.parse(current.latestTimestamp)) {
      current.latestTimestamp = error.timestamp;
      current.sampleError = error.error;
    }
    if (current.exampleSessionIds.length < 4 && !current.exampleSessionIds.includes(error.sessionId)) current.exampleSessionIds.push(error.sessionId);
    if (current.exampleRunIds.length < 4 && !current.exampleRunIds.includes(error.runId)) current.exampleRunIds.push(error.runId);
    if (current.exampleEvidenceSources.length < 4 && !current.exampleEvidenceSources.includes(error.evidenceSource)) current.exampleEvidenceSources.push(error.evidenceSource);
    signatures[key] = current;
  }

  return Object.values(signatures)
    .map((item) => {
      const {
        runIds,
        recoveredRunIds,
        fallbackRunIds,
        promptStrategyCounts,
        promptStrategyVariantCounts,
        workedByCounts,
        ...publicItem
      } = item;
      const runs = runIds.size;
      const recoveredRuns = recoveredRunIds.size;
      return {
        ...publicItem,
        runs,
        recoveredRuns,
        unrecoveredRuns: Math.max(0, runs - recoveredRuns),
        fallbackRecoveryRuns: fallbackRunIds.size,
        promptStrategies: Object.entries(promptStrategyCounts)
          .map(([id, runSet]) => ({ id, runs: runSet.size }))
          .sort((a, b) => b.runs - a.runs || a.id.localeCompare(b.id))
          .slice(0, 4),
        promptStrategyVariants: Object.entries(promptStrategyVariantCounts)
          .map(([id, runSet]) => ({ id, runs: runSet.size }))
          .sort((a, b) => b.runs - a.runs || a.id.localeCompare(b.id))
          .slice(0, 4),
        workedBy: Object.values(workedByCounts)
          .map((worked) => ({
            model: worked.model,
            providerId: worked.providerId,
            tool: worked.tool,
            runs: worked.runs.size,
            avgRetryDistance: worked.runs.size > 0 ? Math.round((worked.totalRetryDistance / worked.runs.size) * 10) / 10 : 0,
          }))
          .sort((a, b) => b.runs - a.runs || a.avgRetryDistance - b.avgRetryDistance)
          .slice(0, 4),
      };
    })
    .sort((a, b) => b.unrecoveredRuns - a.unrecoveredRuns || b.runs - a.runs || Date.parse(b.latestTimestamp) - Date.parse(a.latestTimestamp))
    .slice(0, 12);
}

function failureKey(model: string, providerId: string, tool: string): string {
  return [model || 'unknown', providerId || 'unknown', tool || 'unknown'].join('\u0000');
}

export function buildFailureMemory(
  errors: ToolReliabilityErrorExample[],
  patterns: ToolReliabilityRecoveryPattern[],
): ToolReliabilityFailureMemory[] {
  const memory: Record<string, ToolReliabilityFailureMemory & {
    runIds: Set<string>;
    promptStrategyCounts: Record<string, Set<string>>;
    promptStrategyVariantCounts: Record<string, Set<string>>;
  }> = {};
  for (const error of errors) {
    const key = failureKey(error.model, error.providerId, error.tool);
    const current = memory[key] || {
      model: error.model,
      providerId: error.providerId,
      tool: error.tool,
      errorRuns: 0,
      recoveredRuns: 0,
      unrecoveredRuns: 0,
      fallbackRecoveryRuns: 0,
      promptStrategies: [],
      promptStrategyVariants: [],
      latestError: error.error,
      latestTimestamp: error.timestamp,
      fixedBy: [],
      exampleSessionIds: [],
      exampleRunIds: [],
      exampleEvidenceSources: [],
      runIds: new Set<string>(),
      promptStrategyCounts: {},
      promptStrategyVariantCounts: {},
    };
    current.runIds.add(error.runId);
    if (error.promptStrategyId) {
      if (!current.promptStrategyCounts[error.promptStrategyId]) current.promptStrategyCounts[error.promptStrategyId] = new Set<string>();
      current.promptStrategyCounts[error.promptStrategyId].add(error.runId);
    }
    if (error.promptStrategyVariantId) {
      if (!current.promptStrategyVariantCounts[error.promptStrategyVariantId]) current.promptStrategyVariantCounts[error.promptStrategyVariantId] = new Set<string>();
      current.promptStrategyVariantCounts[error.promptStrategyVariantId].add(error.runId);
    }
    if (Date.parse(error.timestamp) >= Date.parse(current.latestTimestamp)) {
      current.latestTimestamp = error.timestamp;
      current.latestError = error.error;
    }
    if (current.exampleSessionIds.length < 4 && !current.exampleSessionIds.includes(error.sessionId)) current.exampleSessionIds.push(error.sessionId);
    if (current.exampleRunIds.length < 4 && !current.exampleRunIds.includes(error.runId)) current.exampleRunIds.push(error.runId);
    if (current.exampleEvidenceSources.length < 4 && !current.exampleEvidenceSources.includes(error.evidenceSource)) current.exampleEvidenceSources.push(error.evidenceSource);
    memory[key] = current;
  }

  for (const pattern of patterns) {
    const key = failureKey(pattern.failedModel, pattern.failedProviderId, pattern.failedTool);
    const current = memory[key];
    if (!current) continue;
    current.recoveredRuns += pattern.runs;
    if (pattern.recoveredByModel !== pattern.failedModel || pattern.recoveredByProviderId !== pattern.failedProviderId) {
      current.fallbackRecoveryRuns += pattern.runs;
    }
    current.fixedBy.push({
      model: pattern.recoveredByModel,
      providerId: pattern.recoveredByProviderId,
      tool: pattern.recoveredByTool,
      runs: pattern.runs,
      avgRecoveryRounds: pattern.avgRecoveryRounds,
    });
    for (const sessionId of pattern.exampleSessionIds) {
      if (current.exampleSessionIds.length < 4 && !current.exampleSessionIds.includes(sessionId)) current.exampleSessionIds.push(sessionId);
    }
    for (const runId of pattern.exampleRunIds) {
      if (current.exampleRunIds.length < 4 && !current.exampleRunIds.includes(runId)) current.exampleRunIds.push(runId);
    }
    for (const source of pattern.exampleEvidenceSources) {
      if (current.exampleEvidenceSources.length < 4 && !current.exampleEvidenceSources.includes(source)) current.exampleEvidenceSources.push(source);
    }
  }

  return Object.values(memory)
    .map((item) => {
      const { runIds, promptStrategyCounts, promptStrategyVariantCounts, ...publicItem } = item;
      const errorRuns = runIds.size;
      return {
        ...publicItem,
        errorRuns,
        unrecoveredRuns: Math.max(0, errorRuns - item.recoveredRuns),
        promptStrategies: Object.entries(promptStrategyCounts)
          .map(([id, runs]) => ({ id, runs: runs.size }))
          .sort((a, b) => b.runs - a.runs || a.id.localeCompare(b.id))
          .slice(0, 4),
        promptStrategyVariants: Object.entries(promptStrategyVariantCounts)
          .map(([id, runs]) => ({ id, runs: runs.size }))
          .sort((a, b) => b.runs - a.runs || a.id.localeCompare(b.id))
          .slice(0, 4),
        fixedBy: item.fixedBy.sort((a, b) => b.runs - a.runs || a.avgRecoveryRounds - b.avgRecoveryRounds).slice(0, 4),
      };
    })
    .sort((a, b) => b.unrecoveredRuns - a.unrecoveredRuns || b.errorRuns - a.errorRuns || Date.parse(b.latestTimestamp) - Date.parse(a.latestTimestamp))
    .slice(0, 12);
}

export function buildRecoveryPatterns(examples: ToolReliabilityRecoveryExample[]): ToolReliabilityRecoveryPattern[] {
  const patterns: Record<string, ToolReliabilityRecoveryPattern & { totalRecoveryRounds: number }> = {};
  for (const example of examples) {
    const recoveredStep = example.recoveredBy[0];
    const recoveredByModel = recoveredStep?.model || example.firstError.model;
    const recoveredByProviderId = recoveredStep?.providerId || example.firstError.providerId;
    const recoveredByTool = recoveredStep?.tool || 'final_answer';
    const key = [
      example.firstError.model,
      example.firstError.providerId,
      example.firstError.tool,
      recoveredByModel,
      recoveredByProviderId,
      recoveredByTool,
    ].join('\u0000');
    const current = patterns[key] || {
      failedModel: example.firstError.model,
      failedProviderId: example.firstError.providerId,
      failedTool: example.firstError.tool,
      recoveredByModel,
      recoveredByProviderId,
      recoveredByTool,
      runs: 0,
      finalAnswerRuns: 0,
      avgRecoveryRounds: 0,
      latestTimestamp: example.timestamp,
      exampleSessionIds: [],
      exampleRunIds: [],
      exampleEvidenceSources: [],
      totalRecoveryRounds: 0,
    };
    current.runs += 1;
    current.finalAnswerRuns += example.finalAnswerCaptured ? 1 : 0;
    current.totalRecoveryRounds += example.recoveryRounds;
    if (Date.parse(example.timestamp) > Date.parse(current.latestTimestamp)) current.latestTimestamp = example.timestamp;
    if (current.exampleSessionIds.length < 4 && !current.exampleSessionIds.includes(example.sessionId)) current.exampleSessionIds.push(example.sessionId);
    if (current.exampleRunIds.length < 4) current.exampleRunIds.push(example.runId);
    if (current.exampleEvidenceSources.length < 4 && !current.exampleEvidenceSources.includes(example.evidenceSource)) current.exampleEvidenceSources.push(example.evidenceSource);
    patterns[key] = current;
  }

  return Object.values(patterns)
    .map((pattern) => {
      const { totalRecoveryRounds, ...publicPattern } = pattern;
      return {
        ...publicPattern,
        avgRecoveryRounds: pattern.runs > 0 ? Math.round((totalRecoveryRounds / pattern.runs) * 10) / 10 : 0,
      };
    })
    .sort((a, b) => b.runs - a.runs || Date.parse(b.latestTimestamp) - Date.parse(a.latestTimestamp))
    .slice(0, 12);
}

function adviceRank(tone: ToolReliabilityAdvice['tone']): number {
  if (tone === 'risk') return 0;
  if (tone === 'caution') return 1;
  return 2;
}

function adviceScopeRank(scope: ToolReliabilityAdvice['scope']): number {
  if (scope === 'model') return 0;
  if (scope === 'tool') return 1;
  if (scope === 'model_tool') return 2;
  if (scope === 'prompt_strategy') return 3;
  return 4;
}

export function buildToolHeavyAdvice(summary: Pick<ToolReliabilitySummary, 'byModel' | 'byTool' | 'byModelTool' | 'byPromptStrategy' | 'byPromptStrategyVariant'>): ToolReliabilityAdvice[] {
  const advice: ToolReliabilityAdvice[] = [];

  for (const [model, bucket] of Object.entries(summary.byModel)) {
    if (bucket.total < 3) continue;
    if (bucket.errorRate >= 0.25) {
      advice.push({
        scope: 'model',
        key: model,
        tone: 'risk',
        title: `${model} needs tool-use review`,
        detail: `${bucket.error}/${bucket.total} traced tool calls failed, with ${bucket.firstCallErrors}/${bucket.runs} tool-using run${bucket.runs === 1 ? '' : 's'} failing on the first call. Review this candidate's capability card or effective cost before using it for tool-heavy execute tasks.`,
        total: bucket.total,
        errorRate: bucket.errorRate,
        firstCallErrorRate: bucket.firstCallErrorRate,
        recoveryRate: bucket.recoveryRate,
        avgRecoveryRounds: bucket.avgRecoveryRounds,
      });
    } else if (bucket.error > 0) {
      advice.push({
        scope: 'model',
        key: model,
        tone: 'caution',
        title: `${model} has some tool-call friction`,
        detail: `${bucket.error}/${bucket.total} traced tool calls failed, with ${bucket.firstCallErrors}/${bucket.runs} first-call failure${bucket.firstCallErrors === 1 ? '' : 's'}. Keep this model eligible, but inspect recent errors before increasing tool-heavy routing weight.`,
        total: bucket.total,
        errorRate: bucket.errorRate,
        firstCallErrorRate: bucket.firstCallErrorRate,
        recoveryRate: bucket.recoveryRate,
        avgRecoveryRounds: bucket.avgRecoveryRounds,
      });
    } else {
      advice.push({
        scope: 'model',
        key: model,
        tone: 'good',
        title: `${model} has clean tool traces`,
        detail: `No tool-call errors across ${bucket.total} traced call${bucket.total === 1 ? '' : 's'} and no first-call failures across ${bucket.runs} tool-using run${bucket.runs === 1 ? '' : 's'}. This is positive evidence for tool-heavy tasks, not a guarantee of future success.`,
        total: bucket.total,
        errorRate: bucket.errorRate,
        firstCallErrorRate: bucket.firstCallErrorRate,
        recoveryRate: bucket.recoveryRate,
        avgRecoveryRounds: bucket.avgRecoveryRounds,
      });
    }
  }

  for (const [tool, bucket] of Object.entries(summary.byTool)) {
    if (bucket.total < 3 || bucket.errorRate < 0.25) continue;
    advice.push({
      scope: 'tool',
      key: tool,
      tone: 'risk',
      title: `${tool} is a recurring failure point`,
      detail: `${bucket.error}/${bucket.total} traced ${tool} calls failed. Check prompt/tool schema clarity before blaming only the selected model.`,
      total: bucket.total,
      errorRate: bucket.errorRate,
      firstCallErrorRate: bucket.firstCallErrorRate,
      recoveryRate: bucket.recoveryRate,
      avgRecoveryRounds: bucket.avgRecoveryRounds,
    });
  }

  for (const [modelTool, bucket] of Object.entries(summary.byModelTool)) {
    if (bucket.total < 1 || bucket.errorRate < 0.5) continue;
    advice.push({
      scope: 'model_tool',
      key: modelTool,
      tone: bucket.firstCallErrorRate >= 0.5 ? 'risk' : 'caution',
      title: `${modelTool} is retry-prone`,
      detail: `${bucket.error}/${bucket.total} traced calls failed for this exact model/tool pair, with ${bucket.firstCallErrors}/${bucket.runs} first-call failure${bucket.firstCallErrors === 1 ? '' : 's'}. Prefer a cleaner model for this tool or tighten the prompt contract before routing similar tool-heavy work here.`,
      total: bucket.total,
      errorRate: bucket.errorRate,
      firstCallErrorRate: bucket.firstCallErrorRate,
      recoveryRate: bucket.recoveryRate,
      avgRecoveryRounds: bucket.avgRecoveryRounds,
    });
  }

  for (const [strategy, bucket] of Object.entries(summary.byPromptStrategy)) {
    if (strategy === 'unknown' || bucket.total < 3 || bucket.errorRate < 0.25) continue;
    advice.push({
      scope: 'prompt_strategy',
      key: strategy,
      tone: bucket.firstCallErrorRate >= 0.5 ? 'risk' : 'caution',
      title: `${strategy} needs tool prompt review`,
      detail: `${bucket.error}/${bucket.total} traced tool calls failed under this prompt strategy. Compare its tool instructions against recovered runs before using it as the default for execute-mode or MCP-heavy tasks.`,
      total: bucket.total,
      errorRate: bucket.errorRate,
      firstCallErrorRate: bucket.firstCallErrorRate,
      recoveryRate: bucket.recoveryRate,
      avgRecoveryRounds: bucket.avgRecoveryRounds,
    });
  }

  for (const [variant, bucket] of Object.entries(summary.byPromptStrategyVariant)) {
    if (variant === 'unknown' || bucket.total < 3 || bucket.errorRate < 0.25) continue;
    advice.push({
      scope: 'strategy_variant',
      key: variant,
      tone: bucket.firstCallErrorRate >= 0.5 ? 'risk' : 'caution',
      title: `${variant} adds tool-call friction`,
      detail: `${bucket.error}/${bucket.total} traced tool calls failed for this exact role/task prompt variant. Use recovered paths to simplify tool-selection wording, output schema expectations, or first-tool guidance for similar tasks.`,
      total: bucket.total,
      errorRate: bucket.errorRate,
      firstCallErrorRate: bucket.firstCallErrorRate,
      recoveryRate: bucket.recoveryRate,
      avgRecoveryRounds: bucket.avgRecoveryRounds,
    });
  }

  return advice
    .sort((a, b) => adviceRank(a.tone) - adviceRank(b.tone) || adviceScopeRank(a.scope) - adviceScopeRank(b.scope) || b.errorRate - a.errorRate || b.total - a.total)
    .slice(0, 8);
}
