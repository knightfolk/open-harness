import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeBenchScores, createBenchRun, createOrchestrationProofFailure, exportBenchRunCSV, generateBenchSummary, runSetupCommands, runValidation, saveBenchRun, summarizeValidationFailure, validateChangedFiles, validateExpectedPathChanges } from '../server/benchRuns';
import { estimateCostForRanking } from '../server/modelProfiles';
import { buildPromptForModel } from '../server/promptBuilder';
import { routeRequest } from '../server/router';
import { parseToolCallMarkup } from '../server/toolCallMarkup';
import { buildComparisonArtifact, buildEvidenceArtifact, buildInvestigationExplorePrompt, buildReviewFindingsArtifact, extractComparisonSubject, investigationSynthesisProfile, isScoringRubricOutput, normalizeCompareFinalOutput, normalizeExecuteFinalOutput, normalizeInvestigationFinalOutput } from '../server/orchestrator';
import { filterMonologue, normalizeDirectAnswer, StreamCleaner } from '../server/streamCleaner';
import { appendRunStep, createHarnessRun } from '../server/runTrace';
import { applyGoalCommand, formatGoalForPrompt, parseGoalCommand } from '../server/sessionGoals';

function testPromptAssemblyMetadata() {
  const withoutMetadata = buildPromptForModel({
    modelId: 'unknown-model',
    role: 'coder',
    workingDir: '/tmp/project',
    projectProfileSummary: 'Project profile summary',
    taskDescription: 'Answer directly.',
  });
  const repeat = buildPromptForModel({
    modelId: 'unknown-model',
    role: 'coder',
    workingDir: '/tmp/project',
    projectProfileSummary: 'Project profile summary',
    taskDescription: 'Answer directly.',
  });

  assert.equal(repeat.systemPrompt, withoutMetadata.systemPrompt, 'Prompt assembly metadata must not change emitted prompt text');
  assert.ok(withoutMetadata.assembly.sections.length >= 5, 'Prompt assembly should expose ordered sections');
  assert.ok(withoutMetadata.assembly.sections.some((section) => section.id === 'identity'), 'Prompt assembly should include identity metadata');
  assert.ok(withoutMetadata.assembly.sections.some((section) => section.id === 'context-pack'), 'Prompt assembly should include context metadata');
  assert.ok(withoutMetadata.assembly.sections.some((section) => section.id === 'grounding'), 'Prompt assembly should include grounding metadata');
  assert.ok(withoutMetadata.assembly.totalTokenEstimate > 0, 'Prompt assembly should include token estimate');
  assert.match(withoutMetadata.systemPrompt, /Do not claim you changed files, used tools, ran commands, launched an app, or validated output unless/i);
  assert.match(withoutMetadata.systemPrompt, /When work is not applied and validated, label it as a proposal or next step/i);
  assert.match(withoutMetadata.systemPrompt, /Stay grounded in provided context, tool results, files, and explicit user instructions/i);
  assert.match(withoutMetadata.systemPrompt, /If evidence is missing, ask for the needed context or label the statement as an assumption/i);
  const coderOutputStyle = withoutMetadata.assembly.sections.find((section) => section.id === 'output-style');
  assert.match(coderOutputStyle?.preview || '', /changed files, validation proof, and remaining risk/i);
  assert.match(coderOutputStyle?.preview || '', /isolated code questions or explanations/i);
  assert.match(coderOutputStyle?.preview || '', /start with a "Findings" heading/i);
  assert.match(coderOutputStyle?.preview || '', /do not include style nits unless they affect behavior/i);
  assert.match(coderOutputStyle?.preview || '', /Do not add repo-specific claims, lint claims, broad defensive rewrites, or extra issues/i);
  assert.match(withoutMetadata.systemPrompt, /changed files, validation proof, and remaining risk/i);
  assert.equal(withoutMetadata.assembly.outputStyle.id, 'implementation-report');
  assert.equal(withoutMetadata.assembly.outputStyle.source, 'promptBuilder');
  assert.deepEqual(withoutMetadata.assembly.outputStyle.mustHave, [
    'changed files or delivered answer',
    'validation proof when work ran',
    'remaining risk',
    'concise isolated-snippet answer',
  ]);

  const minimalPrompt = buildPromptForModel({
    modelId: 'phi-4-mini',
    role: 'coder',
    workingDir: '/tmp/project',
    taskDescription: 'Create a tiny artifact.',
  });
  assert.match(minimalPrompt.systemPrompt, /final answers must name the files changed and the exact validation proof/i);
  assert.match(minimalPrompt.systemPrompt, /Do not invent APIs, files, settings, test results, dates, prices, or external facts/i);

  const reviewerPrompt = buildPromptForModel({
    modelId: 'claude-sonnet-4.6',
    role: 'reviewer',
    workingDir: '/tmp/project',
    projectProfileSummary: 'Project profile summary',
    taskDescription: 'Review routing output.',
  });
  const reviewerOutputStyle = reviewerPrompt.assembly.sections.find((section) => section.id === 'output-style');
  assert.match(reviewerOutputStyle?.preview || '', /findings first, ordered by severity/i);
  assert.match(reviewerPrompt.systemPrompt, /findings first, ordered by severity/i);
  assert.equal(reviewerPrompt.assembly.outputStyle.id, 'code-review-findings');
  assert.ok(reviewerPrompt.assembly.outputStyle.mustHave.includes('severity order'));
}

function testSessionGoalCommands() {
  const session = { goal: null as any, updatedAt: '2026-06-12T00:00:00.000Z' };
  const command = parseGoalCommand('/goal Improve multi-model output convergence');
  assert.deepEqual(command, { action: 'set', objective: 'Improve multi-model output convergence' });
  const started = applyGoalCommand(session, command!, '2026-06-12T01:00:00.000Z');
  assert.match(started, /^## Goal Started/m);
  assert.equal(session.goal?.status, 'active');
  assert.equal(session.goal?.objective, 'Improve multi-model output convergence');
  assert.match(formatGoalForPrompt(session.goal) || '', /Active Session Goal/);
  assert.match(formatGoalForPrompt(session.goal) || '', /Improve multi-model output convergence/);

  const status = applyGoalCommand(session, parseGoalCommand('/goal status')!, '2026-06-12T01:01:00.000Z');
  assert.match(status, /Status: active/);
  const done = applyGoalCommand(session, parseGoalCommand('/goal done')!, '2026-06-12T01:02:00.000Z');
  assert.match(done, /^## Goal Completed/m);
  assert.equal(session.goal?.status, 'complete');
  assert.equal(formatGoalForPrompt(session.goal), undefined, 'completed goals should not keep steering future prompts');
  const cleared = applyGoalCommand(session, parseGoalCommand('/goal clear')!, '2026-06-12T01:03:00.000Z');
  assert.match(cleared, /^## Goal Cleared/m);
  assert.equal(session.goal, null);
}

function testOutputStyleRunTraceMetadata() {
  const prompt = buildPromptForModel({
    modelId: 'claude-sonnet-4.6',
    role: 'reviewer',
    workingDir: '/tmp/project',
    taskDescription: 'Review routed output shape.',
  });
  const run = createHarnessRun({
    sessionId: 'session',
    userMessageId: 'message',
    requestedModel: 'Auto',
    effectiveModel: 'claude-sonnet-4.6',
    providerId: 'anthropic',
    role: 'reviewer',
  });
  const step = appendRunStep(run, {
    type: 'prompt_built',
    promptPreview: prompt.systemPrompt.slice(0, 80),
    toolCount: 0,
    assembly: prompt.assembly,
    outputStyle: prompt.assembly.outputStyle,
  });

  assert.equal(step.type, 'prompt_built');
  if (step.type === 'prompt_built') {
    assert.equal(step.outputStyle?.id, 'code-review-findings', 'prompt_built trace should expose the output style per run');
    assert.equal(step.assembly?.outputStyle?.id, 'code-review-findings', 'assembly should also carry output style metadata');
    assert.match(step.outputStyle?.contract || '', /findings first/i);
  }
}

function testBoundedReviewRouting() {
  for (const prompt of ['review', 'review this']) {
    const route = routeRequest(prompt, 'local-model');
    assert.equal(route.mode, 'investigate', `${prompt} should still route to read-only investigation`);
    assert.equal(route.role, 'reviewer', `${prompt} should use reviewer role`);
    assert.equal(route.complexity, 'simple', `${prompt} should use a bounded shallow default`);
    assert.match(route.reason, /bounded shallow review/i, `${prompt} should explain bounded behavior`);
  }

  const deep = routeRequest('do a deep repo review', 'local-model');
  assert.equal(deep.mode, 'investigate');
  assert.equal(deep.role, 'reviewer');
  assert.equal(deep.complexity, 'deep');
}

function testDirectAnswerNoRegression() {
  const hello = routeRequest('hello', 'local-model');
  assert.equal(hello.mode, 'direct');
  assert.equal(hello.complexity, 'simple');
  assert.equal(hello.needsTools, false);

  const question = routeRequest('what is a token budget?', 'local-model');
  assert.equal(question.mode, 'direct');
  assert.equal(question.complexity, 'simple');

  const productExplanation = routeRequest(
    'In two short paragraphs, explain how OpenHarness should help a non-expert choose a model without exposing routing knobs.',
    'local-model',
  );
  assert.equal(productExplanation.mode, 'direct', 'conceptual product explanation should not force repo investigation');
  assert.equal(productExplanation.needsTools, false, 'conceptual product explanation should not require tools');
}

function testRunCheckRouting() {
  const route = routeRequest('Run the prompt-routing quality readiness check and summarize the exact result. Do not edit files.', 'local-model');
  assert.equal(route.mode, 'execute', 'run-check requests should use execution routing');
  assert.equal(route.needsValidation, true, 'run-check requests should require validation');
}

function testCreationPromptRouting() {
  for (const prompt of [
    'Build me a playable roguelike game in its own folder.',
    'Make a small browser app for testing model routing.',
    'Create a demo website that compares three model choices.',
    'Scaffold a prototype tool for checking generated artifacts.',
    'Make me a Flappy Bird clone in a new folder.',
    'Prototype a platformer in a standalone directory.',
    'Generate an arcade puzzle in its own folder.',
  ]) {
    const route = routeRequest(prompt, 'local-model');
    assert.equal(route.mode, 'execute', `${prompt} should route to execution`);
    assert.equal(route.role, 'coder', `${prompt} should use an implementation-capable role`);
    assert.equal(route.needsValidation, true, `${prompt} should require validation proof`);
  }

  const conceptual = routeRequest(
    'In two short paragraphs, explain how to create a playable browser game prototype.',
    'local-model',
  );
  assert.equal(conceptual.mode, 'direct', 'conceptual create/how-to explanation should stay direct');
  assert.equal(conceptual.needsTools, false, 'conceptual create/how-to explanation should not require tools');
}

function testMiniMaxInvokeDelimiterRegression() {
  const text = [
    '<|tool_call_begin|><|invoke|="read_file"|>',
    '<parameter name="path">server/router.ts</parameter>',
    '</invoke><|tool_call_end|>',
  ].join('');

  const parsed = parseToolCallMarkup(text, ['read_file']);
  assert.equal(parsed.calls.length, 1, 'MiniMax piped invoke delimiter should parse as a tool call');
  assert.equal(parsed.calls[0].name, 'read_file');
  assert.deepEqual(parsed.calls[0].arguments, { path: 'server/router.ts' });
  assert.equal(parsed.remainder.trim(), '', 'parsed MiniMax tool call should be fully removed from final text');

  const legacyJson = parseToolCallMarkup(
    '<tool_call>{"tool":"read_file","arguments":{"path":"server/router.ts"}}</tool_call>',
    ['read_file'],
  );
  assert.equal(legacyJson.calls.length, 1, 'legacy JSON tool key should still parse');
  assert.equal(legacyJson.calls[0].name, 'read_file');
  assert.deepEqual(legacyJson.calls[0].arguments, { path: 'server/router.ts' });

  const attrEnvelope = parseToolCallMarkup(
    '<tool_call name="list_directory">\n<path>/tmp/project</path>\n</tool_call>',
    ['list_directory'],
  );
  assert.equal(attrEnvelope.calls.length, 1, 'attribute-style tool_call envelope should parse');
  assert.equal(attrEnvelope.calls[0].name, 'list_directory');
  assert.deepEqual(attrEnvelope.calls[0].arguments, { path: '/tmp/project' });
  assert.equal(attrEnvelope.remainder.trim(), '', 'attribute-style tool_call should be fully removed from final text');

  const pathResidue = parseToolCallMarkup(
    '<tool_call>{"name":"list_directory","arguments":{"path":"/Users/kevink/Projects/neon-decade-descent</path>"}}</tool_call>',
    ['list_directory'],
  );
  assert.equal(pathResidue.calls.length, 1, 'JSON tool call with path tag residue should still parse');
  assert.deepEqual(
    pathResidue.calls[0].arguments,
    { path: '/Users/kevink/Projects/neon-decade-descent' },
    'path tag residue should be stripped before trust policy checks',
  );
}

function testScoringRejectsBadOutput() {
  const fakeToolNonsense = [
    'Here are some words that look long enough to pass a lazy length check.',
    'This answer does not address the task, does not provide evidence, and does not validate anything.',
    'It simply repeats filler text so it crosses a character threshold and should not be considered resolved.',
  ].join(' ');
  const score = computeBenchScores({
    response: fakeToolNonsense,
    toolCalls: [{ name: 'read_file', status: 'complete' }],
    wallMs: 1200,
    validationResults: [],
    stepCount: 1,
    tokenCount: 90,
    costEstimate: 0.001,
  });
  assert.notEqual(score.resolvedStatus, 'resolved', 'unvalidated filler with a fake tool call must not be resolved');
  assert.ok(score.overallScore < 8, `bad output should not score near-perfect, got ${score.overallScore}`);

  const preambleScore = computeBenchScores({
    response: 'I have enough. The user wants me to inspect files before giving the answer.',
    toolCalls: [{ name: 'read_file', status: 'complete' }],
    wallMs: 1200,
    validationResults: [{
      command: 'synthetic',
      exitCode: 0,
      stdout: '',
      stderr: '',
      findings: [],
      durationMs: 1,
      passed: true,
    }],
    stepCount: 1,
    tokenCount: 40,
    costEstimate: 0.001,
  });
  assert.notEqual(preambleScore.resolvedStatus, 'resolved', 'preamble-only output must not be resolved');
  assert.equal(
    preambleScore.breakdown.signals.find((signal) => signal.id === 'no-preamble')?.passed,
    false,
    'preamble leakage should be a visible scoring signal',
  );
}

function testBenchRankingUsesSpendAndLatency() {
  const validationResults = [{
    command: 'synthetic',
    exitCode: 0,
    stdout: '',
    stderr: '',
    findings: [],
    durationMs: 1,
    passed: true,
  }];
  const response = '# Result\n\n- Clear answer\n- Validation proof\n- Concrete next step';
  const base = {
    taskId: 'task',
    taskName: 'Task',
    providerId: 'provider',
    status: 'ok',
    prompt: 'Prompt',
    response,
    responseLength: response.length,
    toolCalls: [{ name: 'read_file', status: 'complete' }],
    validationResults,
    validationPassed: true,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  } as const;
  const summary = generateBenchSummary([
    {
      ...base,
      modelId: 'cheap-fast',
      wallMs: 10_000,
      scores: computeBenchScores({
        response,
        toolCalls: base.toolCalls,
        wallMs: 10_000,
        validationResults,
        stepCount: 1,
        tokenCount: 500,
        costEstimate: 0.0001,
      }),
    },
    {
      ...base,
      modelId: 'expensive-slow',
      wallMs: 80_000,
      scores: computeBenchScores({
        response,
        toolCalls: base.toolCalls,
        wallMs: 80_000,
        validationResults,
        stepCount: 1,
        tokenCount: 500,
        costEstimate: 0.02,
      }),
    },
  ] as any);

  assert.equal(summary.bestModel, 'cheap-fast', 'quality ties should prefer better value');
  assert.ok(summary.byModel['cheap-fast'].valueScore > summary.byModel['expensive-slow'].valueScore);
  assert.match(summary.bestModelReason || '', /cost/i);
}

function testFallbackAssistedRunsDoNotLookModelResolved() {
  const validationResults = [{
    command: 'synthetic',
    exitCode: 0,
    stdout: '',
    stderr: '',
    findings: [],
    durationMs: 1,
    passed: true,
  }];
  const response = [
    '## Delivered',
    '',
    '### Assistance',
    'OpenHarness generated a deterministic fallback scaffold because the selected model did not create artifact files.',
    '',
    '### Implementation',
    'Created a runnable browser game artifact and validation passed.',
  ].join('\n');
  const assistedScore = computeBenchScores({
    response,
    toolCalls: [],
    wallMs: 12_000,
    validationResults,
    stepCount: 4,
    tokenCount: 600,
    costEstimate: 0.001,
    assistedByFallback: true,
  });

  assert.equal(assistedScore.resolvedStatus, 'assisted', 'fallback output should be marked assisted, not resolved');
  assert.equal(assistedScore.assistedByFallback, true);
  assert.ok(assistedScore.overallScore <= 7, `fallback-assisted score should be capped, got ${assistedScore.overallScore}`);
  assert.equal(
    assistedScore.breakdown.signals.find((signal) => signal.id === 'model-authored-delivery')?.passed,
    false,
    'fallback-assisted score should expose missing model-authored delivery',
  );

  const authoredScore = computeBenchScores({
    response: '## Delivered\n\n### Implementation\nThe model wrote the requested artifact files directly, listed the changed files, and validation passed with concrete proof for human testing.',
    toolCalls: [{ name: 'write_file', status: 'complete' }],
    wallMs: 12_000,
    validationResults,
    stepCount: 4,
    tokenCount: 600,
    costEstimate: 0.001,
  });
  assert.equal(authoredScore.resolvedStatus, 'resolved', 'model-authored validated writes can still resolve');

  const summary = generateBenchSummary([
    {
      taskId: 'task',
      taskName: 'Task',
      modelId: 'fallback-model',
      providerId: 'provider',
      status: 'assisted',
      prompt: 'Prompt',
      response,
      responseLength: response.length,
      toolCalls: [{ name: 'write_file', status: 'complete' }],
      validationResults,
      validationPassed: true,
      wallMs: 12_000,
      scores: assistedScore,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      assistedByFallback: true,
    },
  ] as any);
  assert.equal(summary.byModel['fallback-model'].resolved, 0, 'assisted fallback should not increase resolved count');
  assert.equal(summary.byModel['fallback-model'].assisted, 1, 'assisted fallback should be counted separately');
  assert.match(summary.bestModelReason || '', /assisted 1\/1/i);

  const run = createBenchRun({
    name: 'assisted export regression',
    taskIds: ['task'],
    modelIds: ['fallback-model'],
  });
  run.results.push({
    taskId: 'task',
    taskName: 'Task',
    modelId: 'fallback-model',
    providerId: 'provider',
    status: 'assisted',
    prompt: 'Prompt',
    response,
    responseLength: response.length,
    toolCalls: [{ name: 'write_file', status: 'complete' }],
    validationResults,
    validationPassed: true,
    wallMs: 12_000,
    scores: assistedScore,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    assistedByFallback: true,
    traceProof: {
      mode: 'execute',
      role: 'coder',
      complexity: 'medium',
      routeSource: 'heuristic',
      selectedModel: 'fallback-model',
      providerId: 'provider',
      modelRequests: 2,
      toolCalls: 1,
      validationChecks: 1,
      assistedByFallback: true,
      summary: 'execute/coder · heuristic · 2 model requests · 1 tool call · 1 validation check · assisted fallback',
      warnings: ['Result was assisted by OpenHarness fallback.'],
    },
  });
  saveBenchRun(run);
  const csv = exportBenchRunCSV(run.id) || '';
  assert.match(csv.split('\n')[0], /assisted_by_fallback,model_authored_delivery,trace_proof/);
  assert.match(csv, /fallback-model,assisted,assisted,true,false,"execute\/coder/);
}

function testRubricCoverageIsScored() {
  const validationResults = [{
    command: 'node scripts/verify-standalone-artifact-fixture.mjs',
    exitCode: 0,
    stdout: 'Standalone artifact verification passed.',
    stderr: '',
    findings: [],
    durationMs: 1,
    passed: true,
  }];
  const rubric = [
    { id: 'complete-artifact', points: 2, description: 'Creates a standalone HTML CSS JS README artifact in the requested folder only' },
    { id: 'playable-loop', points: 3, description: 'Implements player movement hazards enemies collectibles state restart and progression' },
    { id: 'era-theme', points: 1.5, description: 'Uses concrete 1980s icons events and items in gameplay' },
    { id: 'validation-passes', points: 2, description: 'Passes standalone artifact verification' },
  ];
  const strong = computeBenchScores({
    response: [
      '## Delivered',
      'Created a standalone HTML CSS JS README artifact.',
      'The playable loop includes player movement, enemies, hazards, collectibles, state, restart, and progression.',
      'The 1980s era theme uses arcade, mixtape, VHS, floppy, mall, and space-shuttle events in gameplay.',
      'Validation passed with the standalone artifact verifier.',
    ].join('\n'),
    toolCalls: [{ name: 'write_file', status: 'complete' }],
    wallMs: 1000,
    validationResults,
    stepCount: 3,
    tokenCount: 500,
    costEstimate: 0.001,
    rubric,
  });
  assert.ok(strong.rubricCoverage, 'rubric tasks should expose rubric coverage');
  assert.ok((strong.rubricCoverage?.ratio || 0) >= 0.7, 'strong task-specific output should pass rubric coverage');
  assert.equal(
    strong.breakdown.signals.find((signal) => signal.id === 'rubric-coverage')?.passed,
    true,
    'rubric coverage should appear as a passing score signal',
  );

  const generic = computeBenchScores({
    response: '## Delivered\nValidation passed. The answer is concise and complete enough to inspect.',
    toolCalls: [{ name: 'write_file', status: 'complete' }],
    wallMs: 1000,
    validationResults,
    stepCount: 3,
    tokenCount: 500,
    costEstimate: 0.001,
    rubric,
  });
  assert.ok((generic.rubricCoverage?.ratio || 0) < 0.7, 'generic validated output should not pass rubric coverage');
  assert.equal(
    generic.breakdown.signals.find((signal) => signal.id === 'rubric-coverage')?.passed,
    false,
    'rubric coverage should fail when task-specific evidence is absent',
  );
  assert.notEqual(generic.resolvedStatus, 'resolved', 'generic validated rubric tasks should not be marked resolved');
  assert.ok(generic.overallScore <= 6.5, `generic rubric miss should cap score, got ${generic.overallScore}`);
}

function testValidationFailureSummaryUsesCommandOutput() {
  const failedValidation = [{
    command: 'node --import tsx scripts/run-ship-readiness.ts test-fixtures/standalone-artifact-eval',
    exitCode: 1,
    stdout: [
      'FAIL: Ship readiness failed with 1 blocker.',
      '- FAIL Browser smoke: Keyboard input did not produce visible game-state evidence.',
    ].join('\n'),
    stderr: '',
    findings: [],
    durationMs: 120,
    passed: false,
  }];

  assert.match(
    summarizeValidationFailure(failedValidation),
    /Ship readiness failed.*Browser smoke|Browser smoke.*Ship readiness failed/,
    'validation summaries should preserve useful ship-readiness stdout when findings are absent',
  );

  const response = '## Delivered\n\nValidation failed; inspect the browser smoke output.';
  const summary = generateBenchSummary([{
    taskId: 'standalone-1980s-roguelike',
    taskName: 'Standalone 1980s roguelike artifact',
    modelId: 'model',
    providerId: 'provider',
    status: 'validation-failed',
    prompt: 'Create a standalone game.',
    response,
    responseLength: response.length,
    toolCalls: [],
    validationResults: failedValidation,
    validationPassed: false,
    wallMs: 1000,
    scores: computeBenchScores({
      response,
      toolCalls: [],
      wallMs: 1000,
      validationResults: failedValidation,
      stepCount: 1,
      tokenCount: 300,
      costEstimate: 0.001,
    }),
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  } as any]);

  assert.match(summary.regressionFlags[0]?.reason || '', /Browser smoke/);
}

function testUnknownModelPricingIsNotFree() {
  const unknown = estimateCostForRanking('unknown-provider:brand-new-model', 1000, 500);
  assert.equal(unknown.estimated, true, 'unknown model pricing should be marked as estimated');
  assert.ok(unknown.total > 0, 'unknown model pricing should use a conservative non-zero fallback');

  const known = estimateCostForRanking('minimax:MiniMax-M3', 1000, 500);
  assert.equal(known.estimated, false, 'known model pricing should not be marked estimated');
  assert.ok(known.total > 0, 'known model pricing should still compute spend');
}

async function testSetupCommandsAreScoredAsValidation() {
  const dir = mkdtempSync(join(tmpdir(), 'openharness-setup-gate-'));
  try {
    const results = await runSetupCommands([
      'printf setup-ok',
      "printf '%s\\n' '- setup exploded' >&2; exit 7",
    ], dir);

    assert.equal(results.length, 2, 'setup gate should return one validation result per command');
    assert.equal(results[0].passed, true, 'passing setup command should pass');
    assert.equal(results[1].passed, false, 'failing setup command should fail');
    assert.match(results[1].command, /^setup: /, 'setup result should be labeled separately from normal validation');
    assert.match(results[1].findings.join('\n'), /setup exploded/, 'setup failure output should become a visible finding');

    const score = computeBenchScores({
      response: 'Setup failed before model execution.',
      toolCalls: [],
      wallMs: 100,
      validationResults: results,
      stepCount: 0,
      tokenCount: 10,
      costEstimate: 0.00001,
    });
    assert.equal(score.validationPassed, false, 'failed setup should fail validation scoring');
    assert.notEqual(score.resolvedStatus, 'resolved', 'failed setup must not be resolved');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function testArtifactValidationFailuresBecomeFindings() {
  const dir = mkdtempSync(join(tmpdir(), 'openharness-artifact-finding-'));
  try {
    const results = await runValidation([
      "printf '%s\\n' 'Standalone artifact verification failed:' 'HTML uses remote or embedded asset references: https://cdn.example.com/game.js' >&2; exit 1",
    ], dir);

    assert.equal(results.length, 1, 'artifact validation should produce one result');
    assert.equal(results[0].passed, false, 'failing artifact validation should fail');
    assert.match(
      results[0].findings.join('\n'),
      /Standalone artifact verification failed|HTML uses remote or embedded asset references/,
      'standalone verifier summary lines should become visible findings',
    );
    assert.match(
      summarizeValidationFailure(results),
      /remote or embedded asset references|Standalone artifact verification failed/i,
      'artifact validation summary should preserve actionable standalone failure details',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function testOrchestrationProofFailureBlocksResolvedStatus() {
  const validationResults = [
    createOrchestrationProofFailure('Execute mode did not produce applied-and-validated proof'),
  ];
  assert.equal(validationResults[0].passed, false, 'orchestration proof failure should be a failed validation result');
  assert.match(validationResults[0].findings.join('\n'), /applied-and-validated proof/);

  const score = computeBenchScores({
    response: '## Orchestration: Execute Mode\n\n### Delivery Status\nThe model produced a plausible answer but no shipped proof is available.',
    toolCalls: [{ name: 'orchestrator', status: 'error' }],
    wallMs: 1000,
    validationResults,
    stepCount: 2,
    tokenCount: 400,
    costEstimate: 0.001,
  });
  assert.equal(score.validationPassed, false, 'unproven orchestration should fail validation scoring');
  assert.notEqual(score.resolvedStatus, 'resolved', 'unproven orchestration must not be model-resolved');
}

function testBenchChangedFileValidation() {
  const pass = validateChangedFiles({
    before: ['README.md'],
    after: [
      'README.md',
      'test-fixtures/flappy-bird-eval/src/App.tsx',
      'test-fixtures/flappy-bird-eval/src/styles.css',
      '.openharness-bench/response.txt',
    ],
    expectedChangedFiles: [
      'test-fixtures/flappy-bird-eval/src/App.tsx',
      'test-fixtures/flappy-bird-eval/src/styles.css',
    ],
    forbiddenChangedFiles: ['server/', 'src/components/'],
  });
  assert.equal(pass.length, 2, 'expected and forbidden file gates should both produce validation results');
  assert.equal(pass.every((result) => result.passed), true, 'valid fixture-only changes should pass file gates');

  const missing = validateChangedFiles({
    before: [],
    after: ['.openharness-bench/response.txt'],
    expectedChangedFiles: ['test-fixtures/flappy-bird-eval/src/App.tsx'],
  });
  assert.equal(missing[0].passed, false, 'missing expected file changes should fail');
  assert.match(missing[0].findings.join('\n'), /Expected change not observed/);

  const forbidden = validateChangedFiles({
    before: [],
    after: ['server/router.ts', 'test-fixtures/flappy-bird-eval/src/App.tsx'],
    forbiddenChangedFiles: ['server/'],
  });
  assert.equal(forbidden[0].passed, false, 'forbidden server edits should fail');
  assert.match(forbidden[0].findings.join('\n'), /Forbidden change observed: server\/router\.ts/);

  const editedDirtyFile = validateChangedFiles({
    before: ['test-fixtures/game/src/App.tsx\told-hash'],
    after: ['test-fixtures/game/src/App.tsx\tnew-hash'],
    expectedChangedFiles: ['test-fixtures/game/src/App.tsx'],
  });
  assert.equal(editedDirtyFile[0].passed, true, 'hash changes should prove edits to files that were already dirty before the run');

  const recreatedTrackedFixture = validateExpectedPathChanges({
    before: [],
    after: [
      'test-fixtures/standalone-artifact-eval/index.html\tnew-html',
      'test-fixtures/standalone-artifact-eval/game.js\tnew-js',
    ],
    expectedChangedFiles: ['test-fixtures/standalone-artifact-eval/'],
  });
  assert.equal(recreatedTrackedFixture[0].passed, true, 'manifest proof should count recreated expected artifact files');

  const unchangedManifest = validateExpectedPathChanges({
    before: ['test-fixtures/standalone-artifact-eval/index.html\tsame'],
    after: ['test-fixtures/standalone-artifact-eval/index.html\tsame'],
    expectedChangedFiles: ['test-fixtures/standalone-artifact-eval/'],
  });
  assert.equal(unchangedManifest[0].passed, false, 'unchanged expected path manifest should not prove a new artifact');
}

function testInvestigationOutputNormalization() {
  const reviewerRoute = routeRequest('review this project for bugs', 'Auto');
  assert.equal(reviewerRoute.role, 'reviewer', 'review request should use reviewer role');
  assert.equal(investigationSynthesisProfile(reviewerRoute), 'reviewer', 'review investigations should keep reviewer synthesis');
  const normalizedReview = normalizeInvestigationFinalOutput(
    reviewerRoute,
    'The auth flow looks risky because src/auth.ts accepts empty tokens.',
  );
  assert.match(normalizedReview, /^## Findings\n\nThe auth flow looks risky/m, 'review synthesis should be normalized to findings-first output');

  const alreadyFindings = normalizeInvestigationFinalOutput(
    reviewerRoute,
    '## Findings\n\n- P1: Already structured.',
  );
  assert.equal(alreadyFindings, '## Findings\n\n- P1: Already structured.', 'structured findings output should not be wrapped twice');

  const summaryRoute = routeRequest('Give me a clear overview of this project architecture.', 'Auto');
  assert.equal(summaryRoute.role, 'summarizer', 'overview request should use summarizer role');
  assert.equal(investigationSynthesisProfile(summaryRoute), 'summarizer', 'overview investigations should use human-facing synthesis');
  const fallbackSummary = normalizeInvestigationFinalOutput(
    summaryRoute,
    'The app has a React client and an Express server.',
    true,
  );
  assert.match(fallbackSummary, /^## Answer\n\nThe app has a React client/m, 'investigation synthesis should be normalized to answer-first output');
  assert.match(fallbackSummary, /Final synthesis failed, so this answer uses explorer evidence directly/i, 'explorer fallback should disclose residual risk');

  const scoringJson = [
    '```json',
    JSON.stringify({
      verdict: 'Strong overview, but this is a judge artifact.',
      rubric: {
        coverage_of_user_question: { weight: 0.2, score: 0.9 },
        citation_accuracy: { weight: 0.15, score: 0.85 },
      },
    }),
    '```',
  ].join('\n');
  assert.equal(isScoringRubricOutput(scoringJson), true, 'internal rubric JSON should be detected before display');
  const normalizedScoringArtifact = normalizeInvestigationFinalOutput(summaryRoute, scoringJson);
  assert.match(normalizedScoringArtifact, /^## Investigation Incomplete/m, 'rubric JSON should not become the chat answer');
  assert.doesNotMatch(normalizedScoringArtifact, /```json|coverage_of_user_question/, 'internal scoring JSON should not be shown to the user');
}

function testInvestigationExplorePromptToolCall() {
  const workspace = '/Users/kevink/Projects/neon-decade-descent';
  const prompt = buildInvestigationExplorePrompt(
    "Give me an overview of this project -- what does it do, what's the architecture, and what are the main components?",
    workspace,
  );
  assert.doesNotMatch(prompt, /<list_directory><path>/, 'investigation prompt should not teach raw XML tool calls');
  assert.doesNotMatch(prompt, /<\/path>/, 'investigation prompt should not include raw path closing tags');
  const parsed = parseToolCallMarkup(prompt, ['list_directory']);
  assert.equal(parsed.calls.length, 1, 'investigation prompt should include one parseable starter tool call');
  assert.deepEqual(parsed.calls[0].arguments, { path: workspace });
}

function testExecuteOutputNormalization() {
  const shipped = normalizeExecuteFinalOutput({
    deliveryProven: true,
    phasesComplete: true,
    proofSummary: [
      '- Direct artifact file writes were used.',
      '- OpenHarness validation gates ran successfully.',
      '- Applied-and-validated proof is available for human testing.',
    ].join('\n'),
    plannerText: 'Inspect the target files, then make the smallest change.',
    implementationText: [
      '## Implementation',
      'Changed src/components/ArtifactDrawer.tsx.',
      '```diff',
      'diff --git a/src/components/ArtifactDrawer.tsx b/src/components/ArtifactDrawer.tsx',
      '@@ -1 +1 @@',
      '-old',
      '+new',
      '```',
    ].join('\n'),
    reviewText: '## Findings\n\nNo blockers found.',
  });

  assert.match(shipped, /^## Delivered/m, 'proven execute output should lead with delivered status');
  assert.match(shipped, /### Delivery Status\nDelivered with applied-and-validated proof\./m);
  assert.match(shipped, /### Changed Files and Proof\n- Direct artifact file writes were used\./m);
  assert.match(shipped, /### Phase Summaries\n- Plan: Inspect the target files, then make the smallest change\./m);
  assert.match(shipped, /- Implementation: Changed src\/components\/ArtifactDrawer\.tsx\. \[diff block omitted from summary\]/m);
  assert.doesNotMatch(shipped, /diff --git/, 'execute report should keep raw patch details out of the main answer');
  assert.match(shipped, /### Review\nNo blockers found\./m);
  assert.match(shipped, /### Residual Risk\n- No additional residual risk was detected beyond normal human review\./m);

  const proposal = normalizeExecuteFinalOutput({
    deliveryProven: false,
    phasesComplete: false,
    proofSummary: '- No unified-diff patch proposal was detected.\n- No concrete validation command was detected.',
    implementationText: 'Here is a proposal.',
    reviewText: '',
  });
  assert.match(proposal, /^## Orchestration: Execute Mode/m, 'unproven execute output should not claim delivery');
  assert.match(proposal, /Proposal only; applied-and-validated proof is still missing\./);
  assert.match(proposal, /No applied-and-validated proof was captured/);
  assert.match(proposal, /Reviewer output was missing/);
}

function testCompareOutputNormalization() {
  assert.equal(
    extractComparisonSubject('Compare outputs for this prompt: What is wrong with `function sum(a,b){ return a - b }`?'),
    'What is wrong with `function sum(a,b){ return a - b }`?',
    'compare mode should run candidate models on the embedded prompt, not the meta-comparison request',
  );

  const judged = normalizeCompareFinalOutput({
    modelLabels: 'fast-model: OK, strong-model: OK',
    judgeOk: true,
    judgeText: [
      '## Analysis',
      'The strong model should win because it named concrete risks and gave a validation path.',
      '',
      '```diff',
      'diff --git a/example b/example',
      '```',
    ].join('\n'),
    responses: [
      { model: 'fast-model', ok: true, text: 'Fast answer, but it skipped validation details.' },
      { model: 'strong-model', ok: true, text: 'Strong answer with concrete risks, tradeoffs, and validation proof.' },
    ],
  });

  assert.match(judged, /^## Comparison Result/m, 'judge-backed compare output should use a scannable heading');
  assert.match(judged, /### Verdict\nThe strong model should win/m, 'compare output should lead with judge verdict text');
  assert.match(judged, /\| Model \| Status \| Response summary \|/m, 'compare output should include a compact model table');
  assert.match(judged, /\| fast-model \| Complete \| Fast answer/m);
  assert.doesNotMatch(judged, /diff --git/, 'compare verdict should summarize raw code blocks instead of dumping them first');
  assert.match(judged, /Raw model outputs are summarized; inspect phase artifacts for full response text when needed\./);

  const jsonJudged = normalizeCompareFinalOutput({
    modelLabels: 'a: OK, b: OK',
    judgeOk: true,
    judgeText: '```json\n{"recommendation":"Choose b","reason":"It is more concise and keeps the corrected snippet."}\n```',
    responses: [
      { model: 'a', ok: true, text: 'Verbose but correct return a + b.' },
      { model: 'b', ok: true, text: 'Findings first and return a + b.' },
    ],
  });
  assert.match(jsonJudged, /### Verdict\nChoose b It is more concise/m);
  assert.doesNotMatch(jsonJudged, /\[json block omitted\]/);

  const partial = normalizeCompareFinalOutput({
    modelLabels: 'fast-model: OK, broken-model: FAILED',
    judgeOk: false,
    error: 'Judge phase failed: provider unavailable',
    responses: [
      { model: 'fast-model', ok: true, text: 'Fast answer only.' },
      { model: 'broken-model', ok: false, text: '' },
    ],
  });

  assert.match(partial, /^## Comparison Result: Partial/m, 'judge failure should be disclosed in the main heading');
  assert.match(partial, /Judge phase failed: provider unavailable/);
  assert.match(partial, /\| broken-model \| Failed \| No usable response\. \|/);
  assert.match(partial, /Fewer than two models produced usable responses/);

  const artifact = buildComparisonArtifact({
    task: 'Compare the same bug-fix prompt across models.',
    judgeOk: true,
    judgeText: 'The strong model should win because it is more specific.',
    responses: [
      { model: 'fast-model', ok: true, text: 'Correct and concise answer with return a + b.' },
      { model: 'strong-model', ok: true, text: 'Correct, grounded, and includes return a + b with validation caveats.' },
    ],
  });
  assert.equal(artifact.type, 'comparison');
  assert.match(artifact.title, /^Comparison:/);
  assert.equal(artifact.data.modelResults.length, 2);
  assert.ok(artifact.data.convergence.some((item) => /corrected snippet/i.test(item)));
  assert.match(artifact.data.recommendation, /strong model should win/i);
}

function testEvidenceArtifactExtraction() {
  const artifact = buildEvidenceArtifact(
    'review authentication',
    '- server/index.ts:3700 shows monologue gating.\n- `src/components/ArtifactDrawer.tsx:41` extracts artifacts.',
    '## Findings\n\nserver/orchestrator.ts:1127 normalizes investigation output.',
  );
  assert.ok(artifact, 'investigation should produce structured evidence when source references are present');
  assert.equal(artifact?.type, 'evidence');
  assert.ok(artifact?.data.items.some((item) => item.source === 'server/index.ts' && item.line === 3700));
  assert.ok(artifact?.data.items.some((item) => item.source === 'src/components/ArtifactDrawer.tsx' && item.line === 41));
}

function testReviewFindingsArtifactExtraction() {
  const artifact = buildReviewFindingsArtifact(
    'review authentication',
    [
      '## Findings',
      '',
      '- P2 server/auth.ts:22 accepts empty tokens.',
      '  Evidence: The guard returns true when token is an empty string.',
      '  Action: Reject blank tokens before session lookup.',
      '',
      '- P0 src/session.ts:9 stores secrets in localStorage.',
      '  Evidence: The API key is written directly to localStorage.',
      '  Action: Move secret handling to the server process.',
    ].join('\n'),
  );

  assert.ok(artifact, 'review output should produce structured findings when severity metadata is present');
  assert.equal(artifact?.type, 'review_findings');
  assert.equal(artifact?.data.findings.length, 2);
  assert.equal(artifact?.data.findings[0].severity, 'P0', 'findings should be severity ordered');
  assert.equal(artifact?.data.findings[0].source, 'src/session.ts');
  assert.equal(artifact?.data.findings[0].line, 9);
  assert.match(artifact?.data.findings[0].action || '', /server process/i);
}

function testStreamCleanerFirstPersonHandling() {
  assert.equal(
    filterMonologue('I need a little more context before I can answer that safely.'),
    'I need a little more context before I can answer that safely.',
    'legitimate first-person direct answers should survive monologue filtering',
  );
  assert.equal(
    filterMonologue('I need to inspect the files first.\nThe route is direct because the prompt is a simple question.'),
    'The route is direct because the prompt is a simple question.',
    'internal planning preamble should still be stripped',
  );

  const cleaner = new StreamCleaner();
  assert.equal(cleaner.feed('I need to inspect the files first.\n'), null);
  assert.equal(cleaner.feed('The answer is ready.'), 'The answer is ready.');
  assert.equal(cleaner.flush(), '');

  const directCleaner = new StreamCleaner();
  assert.equal(directCleaner.feed('I need a little more context before answering.'), 'I need a little more context before answering.');
  assert.equal(directCleaner.flush(), '');
}

function testDirectAnswerNormalization() {
  assert.equal(
    normalizeDirectAnswer('Final Answer: A token budget is the amount of context reserved for a model request.'),
    'A token budget is the amount of context reserved for a model request.',
    'direct answers should drop transcript-style final-answer labels',
  );

  assert.equal(
    normalizeDirectAnswer([
      '## Analysis',
      'I should inspect the prompt first.',
      '',
      '## Answer',
      'Use route-derived output styles by default; add user controls only when a real product need appears.',
    ].join('\n')),
    'Use route-derived output styles by default; add user controls only when a real product need appears.',
    'direct answers should remove leading process sections when an answer section exists',
  );

  assert.equal(
    normalizeDirectAnswer('I need a little more context before I can answer that safely.'),
    'I need a little more context before I can answer that safely.',
    'legitimate first-person direct answers should survive direct-answer normalization',
  );

  assert.equal(
    normalizeDirectAnswer('The user wants me to explain routing.\nRouting has two layers: workflow first, then model selection.'),
    'Routing has two layers: workflow first, then model selection.',
    'direct-answer normalization should still remove internal user-intent preamble',
  );
}

testPromptAssemblyMetadata();
testSessionGoalCommands();
testOutputStyleRunTraceMetadata();
testBoundedReviewRouting();
testDirectAnswerNoRegression();
testRunCheckRouting();
testCreationPromptRouting();
testMiniMaxInvokeDelimiterRegression();
testScoringRejectsBadOutput();
testBenchRankingUsesSpendAndLatency();
testFallbackAssistedRunsDoNotLookModelResolved();
testRubricCoverageIsScored();
testValidationFailureSummaryUsesCommandOutput();
testUnknownModelPricingIsNotFree();
await testSetupCommandsAreScoredAsValidation();
await testArtifactValidationFailuresBecomeFindings();
testOrchestrationProofFailureBlocksResolvedStatus();
testBenchChangedFileValidation();
testInvestigationOutputNormalization();
testInvestigationExplorePromptToolCall();
testExecuteOutputNormalization();
testCompareOutputNormalization();
testEvidenceArtifactExtraction();
testReviewFindingsArtifactExtraction();
testStreamCleanerFirstPersonHandling();
testDirectAnswerNormalization();

console.log('prompt/routing/output P0 regression checks passed');
