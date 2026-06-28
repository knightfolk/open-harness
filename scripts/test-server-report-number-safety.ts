import assert from 'assert';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

process.env.OPENHARNESS_EVALS_DIR = mkdtempSync(join(tmpdir(), 'openharness-evals-number-safety-'));

const evals = await import('../server/evals');
const benchRuns = await import('../server/benchRuns');

const bannedRenderedNumbers = /\b(?:NaN|Infinity|-Infinity|undefined|null\/10|bad\/10|slow|expensive)\b/;

function assertFiniteNumbers(value: unknown, path = 'value') {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value), `${path} should be finite, got ${value}`);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assertFiniteNumbers(child, `${path}.${key}`);
  }
}

function score(overrides: Record<string, unknown> = {}) {
  const breakdown = evals.buildScoreBreakdown([
    { id: 'answered', label: 'Answered', category: 'structural' as const, passed: true, score: 2, maxScore: 2 },
    { id: 'validation', label: 'Validation', category: 'runtime' as const, passed: true, score: 2, maxScore: 2 },
    { id: 'style', label: 'Style', category: 'style' as const, passed: true, score: 1, maxScore: 1 },
  ]);

  return {
    usedTools: true,
    answeredUser: true,
    referencedRealFiles: true,
    avoidedHallucinatedPaths: true,
    producedSummary: true,
    latencyMs: 1200,
    toolCount: 2,
    validationPassed: true,
    validationScore: 2,
    overallScore: 8.2,
    breakdown,
    ...overrides,
  };
}

function evalResult(modelId: string, overrides: Record<string, unknown> = {}) {
  return {
    modelId,
    promptId: 'prompt-a',
    promptName: 'Prompt A',
    status: 'ok' as const,
    response: 'A complete answer with enough shape for report tests.',
    responseLength: 52,
    toolCallCount: 1,
    toolCalls: [{ name: 'read_file', status: 'complete' }],
    wallMs: 1200,
    promptStrategy: {
      id: 'structured-default',
      family: 'qwen',
      systemStyle: 'structured',
    },
    scores: score(overrides),
  };
}

function benchResult(modelId: string, overrides: Record<string, unknown> = {}) {
  return {
    taskId: `${modelId}-task`,
    taskName: 'Task',
    modelId,
    providerId: 'test-provider',
    status: 'ok' as const,
    prompt: 'Do the task',
    response: 'Delivered a complete result.',
    responseLength: 28,
    toolCalls: [{ name: 'read_file', status: 'complete' }],
    validationResults: [],
    validationPassed: true,
    wallMs: 1200,
    startedAt: new Date(0).toISOString(),
    completedAt: new Date(0).toISOString(),
    scores: {
      ...score(),
      styleScore: 1,
      resolvedStatus: 'resolved' as const,
      stepCount: 2,
      tokenCount: 100,
      costEstimate: 0.0002,
      assistedByFallback: false,
      ...overrides,
    },
  };
}

function testEvalSummaryRejectsMalformedNumbers() {
  const summary = evals.generateSummary([
    evalResult('steady-model'),
    evalResult('poison-model', {
      overallScore: 'bad',
      latencyMs: 'slow',
      toolCount: Number.POSITIVE_INFINITY,
    }),
    evalResult('poison-model', {
      overallScore: Number.NEGATIVE_INFINITY,
      latencyMs: Number.NaN,
      toolCount: undefined,
    }),
  ] as any);

  assert.equal(summary.bestModel, 'steady-model', 'malformed scores should not win best model');
  assert.equal(summary.byModel['poison-model'].scoreSampleCount, 0, 'corrupt score samples should be excluded explicitly');
  assertFiniteNumbers(summary, 'eval summary');
}

function testEvalRecommendationMarkdownRejectsMalformedNumbers() {
  const reportId = 'number-safety-report';
  evals.saveReport({
    id: reportId,
    configId: 'config-a',
    name: 'Number Safety Report',
    status: 'complete',
    total: 2,
    completed: 2,
    createdAt: new Date(0).toISOString(),
    completedAt: new Date(0).toISOString(),
    results: [
      evalResult('steady-model'),
      evalResult('poison-model', {
        overallScore: 'bad',
        latencyMs: 'slow',
        toolCount: Number.POSITIVE_INFINITY,
      }),
    ] as any,
  });

  const markdown = evals.exportEvalRecommendationMarkdown(reportId);
  assert.ok(markdown, 'expected markdown export');
  assert.match(markdown || '', /unavailable/, 'corrupt rendered metrics should be labeled unavailable');
  assert.doesNotMatch(markdown || '', bannedRenderedNumbers);
}

function testEvalRecommendationMarkdownHandlesAllIneligibleModels() {
  const reportId = 'number-safety-all-ineligible-report';
  evals.saveReport({
    id: reportId,
    configId: 'config-a',
    name: 'All Ineligible Number Safety Report',
    status: 'complete',
    total: 1,
    completed: 1,
    createdAt: new Date(0).toISOString(),
    completedAt: new Date(0).toISOString(),
    results: [
      evalResult('poison-model', {
        overallScore: 'bad',
        latencyMs: 'slow',
        toolCount: Number.POSITIVE_INFINITY,
      }),
    ] as any,
  });

  const markdown = evals.exportEvalRecommendationMarkdown(reportId);
  assert.ok(markdown, 'expected markdown export');
  assert.match(markdown || '', /- Best model: n\/a/);
  assert.match(markdown || '', /unavailable/, 'all-ineligible metrics should be labeled unavailable');
  assert.doesNotMatch(markdown || '', /0\/10/, 'all-ineligible scores should not render as confident zeroes');
  assert.doesNotMatch(markdown || '', bannedRenderedNumbers);
}

function testBenchSummaryRejectsMalformedNumbers() {
  const summary = benchRuns.generateBenchSummary([
    benchResult('steady-model'),
    benchResult('poison-model', {
      overallScore: 'bad',
      validationScore: Number.NaN,
      costEstimate: 'expensive',
      stepCount: undefined,
    },),
    {
      ...benchResult('poison-model', {
        overallScore: Number.POSITIVE_INFINITY,
        validationScore: Number.NEGATIVE_INFINITY,
        costEstimate: Number.NaN,
        stepCount: Number.POSITIVE_INFINITY,
      }),
      wallMs: Number.POSITIVE_INFINITY,
    },
  ] as any);

  assert.equal(summary.bestModel, 'steady-model', 'malformed bench scores should not win best model');
  assert.equal(summary.byModel['poison-model'].scoreSampleCount, 0, 'corrupt bench scores should be excluded explicitly');
  assertFiniteNumbers(summary, 'bench summary');
  assert.doesNotMatch(summary.bestModelReason || '', bannedRenderedNumbers);
}

function testBenchSummaryRequiresCostAndLatencyEvidenceForBestModel() {
  const summary = benchRuns.generateBenchSummary([
    benchResult('steady-model', {
      overallScore: 7,
      validationScore: 1.5,
      costEstimate: 0.001,
    }),
    {
      ...benchResult('missing-cost-winner', {
        overallScore: 10,
        validationScore: 2,
        costEstimate: 'expensive',
      }),
      wallMs: 'slow',
    },
  ] as any);

  assert.equal(summary.bestModel, 'steady-model', 'missing cost and latency evidence should not be treated as free or instant');
  assert.equal(summary.byModel['missing-cost-winner'].costSampleCount, 0);
  assert.equal(summary.byModel['missing-cost-winner'].latencySampleCount, 0);
  assertFiniteNumbers(summary, 'bench summary with missing cost');
}

function testBenchSummaryHandlesAllIneligibleModels() {
  const summary = benchRuns.generateBenchSummary([
    {
      ...benchResult('poison-model', {
        overallScore: 'bad',
        validationScore: Number.NaN,
        costEstimate: 'expensive',
        stepCount: undefined,
      }),
      wallMs: 'slow',
    },
  ] as any);

  assert.equal(summary.bestModel, '', 'all-ineligible bench summaries should not choose a winner');
  assert.equal(summary.bestModelReason, '');
  assert.equal(summary.byModel['poison-model'].scoreSampleCount, 0);
  assert.equal(summary.byModel['poison-model'].costSampleCount, 0);
  assertFiniteNumbers(summary, 'all-ineligible bench summary');
}

try {
  testEvalSummaryRejectsMalformedNumbers();
  testEvalRecommendationMarkdownRejectsMalformedNumbers();
  testEvalRecommendationMarkdownHandlesAllIneligibleModels();
  testBenchSummaryRejectsMalformedNumbers();
  testBenchSummaryRequiresCostAndLatencyEvidenceForBestModel();
  testBenchSummaryHandlesAllIneligibleModels();
  console.log('server report number safety tests passed');
} finally {
  rmSync(process.env.OPENHARNESS_EVALS_DIR, { recursive: true, force: true });
}
