import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  routingEventDecisionLabel,
  routingOutcomeHelp,
  routingOutcomeLabel,
  sortedCandidateScores,
} from '../src/utils/autoRouterTrace';

const tempHome = mkdtempSync(join(tmpdir(), 'openharness-router-learning-'));
process.env.HOME = tempHome;

try {
  const routerLearningPath = pathToFileURL(join(process.cwd(), 'server/routerLearning.ts')).href;
  const routerLearning = await import(`${routerLearningPath}?test=${Date.now()}`);

  const baseEvent = {
    timestamp: new Date(0).toISOString(),
    sessionId: 'outcome-probe-session',
    runId: 'run-outcome-probe',
    taskHash: 'probe',
    selectedModel: 'provider:strong-model',
    score: 0.91,
    candidateScores: {
      'provider:weak-model': 0.41,
      'provider:strong-model': 0.91,
    },
    wasFallback: false,
    wasCached: false,
    modelSelectionPolicy: 'cheap-direct',
    routeSignal: {
      hasImages: true,
      turns: 7,
      toolCount: 12,
      estimatedInputTokens: 3456,
      artifactCount: 3,
      dirtyGitState: true,
      thinkingEffort: 'xhigh',
      requiresStrongToolUse: true,
    },
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
    taskPromptText: 'Please review this diff with key sk-123456789012345678901234 and explain the risk.',
    userTurns: 1,
  };

  const successId = routerLearning.recordRoutingDecision(baseEvent);
  const failureId = routerLearning.recordRoutingDecision({
    ...baseEvent,
    selectedModel: 'provider:weak-model',
    score: 0.41,
    taskHash: 'probe-failure',
  });
  const unclearId = routerLearning.recordRoutingDecision({
    ...baseEvent,
    selectedModel: 'provider:middle-model',
    score: 0.72,
    taskHash: 'probe-unclear',
    wasCached: true,
    modelSelectionPolicy: 'escalated',
  });

  assert.equal(routerLearning.recordOutcome(successId, 'success', 'probe success'), true);
  assert.equal(routerLearning.recordOutcome(failureId, 'failure', 'probe failure'), true);
  assert.equal(routerLearning.recordOutcome(unclearId, 'ambiguous', 'probe unclear'), true);
  assert.equal(routerLearning.recordModelRequestDuration(successId, 30_000), true, 'routing events should accept explicit measured model-request duration updates');
  assert.equal(routerLearning.recordModelRequestDuration(unclearId, 30_001), true, 'routing events should collect multiple measured request duration samples');
  assert.equal(routerLearning.recordModelRequestDuration(failureId, undefined), false, 'routing duration updates should reject missing duration instead of recording 0ms');

  const events = routerLearning.getRoutingEvents('outcome-probe-session', 10);
  assert.equal(events.length, 3, 'routing events should persist and hydrate by session');
  assert.deepEqual(new Set(events.map((event: any) => event.outcome)), new Set(['success', 'failure', 'ambiguous']));

  const summary = routerLearning.getLearningSummary();
  assert.equal(summary.totalEvents, 3, 'all marked outcomes should count as reviewed');
  assert.equal(summary.models['provider:strong-model'].success, 1, 'success outcome should count as success');
  assert.equal(summary.models['provider:weak-model'].success, 0, 'failure outcome should not count as success');
  assert.equal(summary.models['provider:middle-model'].success, 0, 'unclear outcome should not count as success');
  assert.equal(summary.byPromptStrategy['qwen-xml-code-v1'].total, 3, 'base prompt strategy summary should include marked outcomes');
  assert.equal(summary.byPromptStrategyVariant['qwen-xml-code-v1:qwen-coder-tool-proof'].total, 3, 'variant prompt strategy summary should include marked outcomes');
  assert.deepEqual(
    summary.modelRequestDuration.byModel['provider:strong-model'],
    { samples: 1, avgMs: 30000, slow: false, thresholdMs: 30000 },
    'summary should aggregate measured model-request duration by selected model without flagging at-threshold rows as slow',
  );
  assert.deepEqual(
    summary.modelRequestDuration.byModel['provider:middle-model'],
    { samples: 1, avgMs: 30001, slow: true, thresholdMs: 30000 },
    'summary should aggregate each measured model-request duration by selected model and flag strictly above-threshold rows as slow',
  );
  assert.equal(
    summary.modelRequestDuration.byModel['provider:weak-model'],
    undefined,
    'summary should not create zero-duration aggregates for events missing measured request duration',
  );
  assert.deepEqual(
    summary.modelRequestDuration.byTaskType.execute,
    { samples: 2, avgMs: 30001, slow: true, thresholdMs: 30000 },
    'summary should aggregate measured model-request duration by task type using only present samples and the same strict slow threshold',
  );
  assert.equal(summary.bestPromptStrategyVariants[0].strategyVariant, 'qwen-xml-code-v1:qwen-coder-tool-proof', 'summary should expose best prompt strategy variant signal');
  assert.equal(summary.bestPromptStrategyVariants[0].model, 'provider:strong-model', 'best strategy variant signal should keep best model evidence');
  const initialExecuteWinner = summary.bestByTaskType.find((row: any) => row.taskType === 'execute');
  assert.equal(initialExecuteWinner?.model, 'provider:strong-model', 'best task type signal should identify the current winning model');
  assert.equal(initialExecuteWinner?.sampleCount, 1, 'best task type freshness should expose the winning model sample count');
  assert.equal(initialExecuteWinner?.firstSeenAt, baseEvent.timestamp, 'best task type freshness should use the earliest reviewed event timestamp');
  assert.equal(initialExecuteWinner?.lastSeenAt, baseEvent.timestamp, 'best task type freshness should use the latest reviewed event timestamp');

  const laterTimestamp = new Date('2026-06-28T12:34:56.000Z').toISOString();
  const laterSuccessId = routerLearning.recordRoutingDecision({
    ...baseEvent,
    timestamp: laterTimestamp,
    taskHash: 'probe-later-success',
  });
  assert.equal(routerLearning.recordOutcome(laterSuccessId, 'success', 'probe later success'), true);
  const refreshedSummary = routerLearning.getLearningSummary();
  const refreshedExecuteWinner = refreshedSummary.bestByTaskType.find((row: any) => row.taskType === 'execute');
  assert.equal(refreshedExecuteWinner?.model, 'provider:strong-model', 'best task type signal should keep the current winner after later evidence');
  assert.equal(refreshedExecuteWinner?.total, 2, 'later winning-model evidence should increment the reviewed total');
  assert.equal(refreshedExecuteWinner?.sampleCount, 2, 'later winning-model evidence should increment the sample count');
  assert.equal(refreshedExecuteWinner?.firstSeenAt, baseEvent.timestamp, 'later evidence should not regress the earliest reviewed timestamp');
  assert.equal(refreshedExecuteWinner?.lastSeenAt, laterTimestamp, 'later evidence should advance the latest reviewed timestamp');

  const successEvent = events.find((event: any) => event.id === successId);
  const unclearEvent = events.find((event: any) => event.id === unclearId);
  assert.equal(successEvent.promptStrategyVariantId, 'qwen-coder-tool-proof', 'routing events should hydrate prompt strategy variant metadata');
  assert.equal(successEvent.runId, 'run-outcome-probe', 'routing events should persist the harness run id for provider-failure joins');
  assert.equal(successEvent.taskPromptSnapshot?.text.includes('sk-123456789012345678901234'), false, 'routing prompt snapshots should redact raw secrets before persistence');
  assert.ok(successEvent.taskPromptSnapshot?.text.includes('<redacted:OPENAI_KEY>'), 'routing prompt snapshots should preserve redaction placeholders for replay evidence');
  assert.equal(successEvent.taskPromptSnapshot?.redactedHits, 1, 'routing prompt snapshots should record redaction hit counts');
  assert.equal(successEvent.taskPromptSnapshot?.truncated, false, 'short routing prompt snapshots should not be marked truncated');
  assert.match(successEvent.taskPromptSnapshot?.hash || '', /^[a-z0-9]{8}$/, 'routing prompt snapshots should include a compact stable prompt hash');
  assert.equal(successEvent.promptStrategyTaskType, 'coding', 'routing events should hydrate prompt strategy task type');
  assert.equal(successEvent.modelSelectionPolicy, 'cheap-direct', 'routing events should persist model-selection policy metadata');
  assert.equal(successEvent.modelRequestDurationMs, 30000, 'routing events should persist measured model-request duration for recent decision review');
  assert.equal(events.find((event: any) => event.id === failureId).modelRequestDurationMs, undefined, 'routing events should leave missing request duration absent');
  assert.equal(unclearEvent.modelSelectionPolicy, 'escalated', 'cached routing events should still persist model-selection policy metadata');
  assert.deepEqual(
    successEvent.routeSignal,
    {
      hasImages: true,
      turns: 7,
      toolCount: 12,
      estimatedInputTokens: 3456,
      artifactCount: 3,
      dirtyGitState: true,
      thinkingEffort: 'xhigh',
      requiresStrongToolUse: true,
    },
    'routing events should persist route input signal metadata',
  );
  assert.equal(routingOutcomeLabel(successEvent.outcome), 'Worked');
  assert.equal(routingOutcomeLabel(events.find((event: any) => event.id === failureId).outcome), 'Failed');
  assert.equal(routingOutcomeLabel(unclearEvent.outcome), 'Unclear');
  assert.match(routingOutcomeHelp(null), /Worked, Failed, or Unclear/);
  assert.equal(routingEventDecisionLabel(successEvent), 'Cheap direct selection');
  assert.equal(routingEventDecisionLabel(unclearEvent), 'Escalated selection');
  assert.deepEqual(sortedCandidateScores(successEvent.candidateScores, 1), [['provider:strong-model', 0.91]]);

  const thresholdId = routerLearning.recordRoutingDecision({
    ...baseEvent,
    sessionId: 'threshold-probe-session',
    taskHash: 'threshold-probe',
    modelSelectionPolicy: 'classifier',
    threshold: 0.7,
  });
  const thresholdEvent = routerLearning.getRoutingEvents('threshold-probe-session', 1)[0];
  assert.equal(thresholdEvent.id, thresholdId, 'threshold probe event should persist separately');
  assert.equal(thresholdEvent.threshold, 0.7, 'classifier routing events should persist the viability threshold');

  const importPreview = routerLearning.importRoutingEvents([
    {
      ...thresholdEvent,
      id: 'imported-variant-event',
      sessionId: 'imported-variant-session',
      taskHash: 'imported-variant',
      timestamp: new Date(1).toISOString(),
    },
  ], { dryRun: true, datasetKind: 'benchmark' });
  assert.equal(importPreview.imported, 1, 'dry-run import should preserve variant event as importable');
  const importResult = routerLearning.importRoutingEvents([
    {
      ...thresholdEvent,
      id: 'imported-variant-event',
      sessionId: 'imported-variant-session',
      taskHash: 'imported-variant',
      timestamp: new Date(1).toISOString(),
    },
  ], { datasetKind: 'benchmark' });
  assert.equal(importResult.imported, 1, 'import should accept variant event');
  const imported = routerLearning.getRoutingEvents('imported-variant-session', 1)[0];
  assert.equal(imported.selectedModel, 'provider:strong-model', 'imported routing event should preserve selected model identity');
  assert.equal(imported.runId, 'run-outcome-probe', 'imported routing event should preserve the harness run id for provider-failure joins');
  assert.equal(imported.modelSelectionPolicy, 'classifier', 'imported routing event should preserve model-selection policy');
  assert.equal(imported.routeSignal?.toolCount, 12, 'imported routing event should preserve normalized route input signal');
  assert.equal(imported.routeSignal?.dirtyGitState, true, 'imported routing event should preserve optional route signal booleans');
  assert.ok(imported.taskPromptSnapshot?.text.includes('<redacted:OPENAI_KEY>'), 'imported routing event should preserve redacted prompt replay evidence');
  assert.equal(routingEventDecisionLabel(imported), 'Classifier decision', 'imported routing event labels should preserve policy-specific decisions');
  assert.equal(imported.promptStrategyVariantId, 'qwen-coder-tool-proof', 'imported routing event should preserve prompt strategy variant');
  assert.equal(imported.threshold, 0.7, 'imported routing event should preserve finite classifier threshold metadata');
  assert.equal(imported.datasetKind, 'benchmark', 'imported routing event should use selected dataset kind');

  const chatMessageRoutesSource = readFileSync('server/routes/chatMessageRoutes.ts', 'utf8');
  const clientApiSource = readFileSync('src/utils/api.ts', 'utf8');
  assert.ok(
    chatMessageRoutesSource.includes('runId: run.id'),
    'chat message routing decisions should record the harness run id for later provider-failure correlation',
  );
  assert.ok(
    chatMessageRoutesSource.includes('recordModelRequestDuration(routingEventId, modelRequestDurationMs)'),
    'chat message routing decisions should update the routing event with measured model-request duration after the run completes',
  );
  assert.ok(
    clientApiSource.includes('runId?: string;'),
    'client routing event type should expose the optional run id join key',
  );
  assert.ok(
    clientApiSource.includes('modelRequestDurationMs?: number;'),
    'client routing event type should expose optional measured model-request duration',
  );
  assert.ok(
    clientApiSource.includes('taskPromptSnapshot?: {'),
    'client routing event type should expose optional redacted prompt replay evidence',
  );
  assert.ok(
    clientApiSource.includes('modelRequestDuration: {'),
    'client routing summary type should expose measured model-request duration aggregates',
  );

  const routerLearningSource = readFileSync('server/routerLearning.ts', 'utf8');
  assert.ok(
    routerLearningSource.includes("import { MODEL_REQUEST_SLOW_DURATION_MS, isSlowModelRequestDurationMs } from '../shared/modelRequestDuration';"),
    'router learning summaries should use the shared model request duration threshold helper',
  );
  assert.ok(
    routerLearningSource.includes('slow: isSlowModelRequestDurationMs(avgMs),'),
    'router learning summaries should derive slow flags from the same strict duration helper used by recent decisions',
  );
  assert.ok(
    routerLearningSource.includes('taskPromptSnapshot: buildRoutingTaskPromptSnapshot(event.taskPromptText)'),
    'router learning should build redacted prompt replay evidence from the routed task text before persistence',
  );

  console.log('Router learning outcome persistence probe passed.');
} finally {
  rmSync(tempHome, { recursive: true, force: true });
}
