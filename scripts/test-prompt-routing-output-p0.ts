import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeBenchScores, generateBenchSummary, runSetupCommands, validateChangedFiles } from '../server/benchRuns';
import { estimateCostForRanking } from '../server/modelProfiles';
import { buildPromptForModel } from '../server/promptBuilder';
import { routeRequest } from '../server/router';
import { parseToolCallMarkup } from '../server/toolCallMarkup';

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
  assert.ok(withoutMetadata.assembly.totalTokenEstimate > 0, 'Prompt assembly should include token estimate');
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
}

testPromptAssemblyMetadata();
testBoundedReviewRouting();
testDirectAnswerNoRegression();
testRunCheckRouting();
testCreationPromptRouting();
testMiniMaxInvokeDelimiterRegression();
testScoringRejectsBadOutput();
testBenchRankingUsesSpendAndLatency();
testUnknownModelPricingIsNotFree();
await testSetupCommandsAreScoredAsValidation();
testBenchChangedFileValidation();

console.log('prompt/routing/output P0 regression checks passed');
