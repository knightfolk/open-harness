import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  averageModelLabBreakdown,
  buildModelLabBreakdownByModel,
} from '../src/utils/modelLabBreakdownSummary';
import type { EvalScores } from '../src/utils/api';

function scores(structural: number, runtime: number, style: number, weakestLabel: string, weakestScore: number, weakestMax = 1): EvalScores {
  return {
    usedTools: true,
    answeredUser: true,
    referencedRealFiles: true,
    avoidedHallucinatedPaths: true,
    producedSummary: true,
    latencyMs: 1000,
    toolCount: 1,
    validationPassed: weakestScore >= weakestMax,
    validationScore: weakestScore >= weakestMax ? 1 : 0,
    overallScore: structural + runtime + style,
    breakdown: {
      structural,
      runtime,
      style,
      total: structural + runtime + style,
      weakestSignal: {
        id: weakestLabel.toLowerCase().replace(/\s+/g, '-'),
        label: weakestLabel,
        category: 'runtime',
        passed: weakestScore >= weakestMax,
        score: weakestScore,
        maxScore: weakestMax,
      },
      signals: [
        {
          id: weakestLabel.toLowerCase().replace(/\s+/g, '-'),
          label: weakestLabel,
          category: 'runtime',
          passed: weakestScore >= weakestMax,
          score: weakestScore,
          maxScore: weakestMax,
        },
      ],
    },
  };
}

const rows = [
  { modelId: 'qwen-coder', scores: scores(4, 3, 2, 'Runtime proof', 0.5, 1) },
  { modelId: 'qwen-coder', scores: scores(2, 2, 1, 'Style proof', 0.9, 1) },
  { modelId: 'mistral-small', scores: scores(3, 1, 1, 'Tool proof', 0.2, 1) },
];
const tiedRows = [
  { modelId: 'qwen-coder', scores: scores(4, 3, 2, 'First weak signal', 0.5, 1) },
  { modelId: 'qwen-coder', scores: scores(3, 3, 2, 'Later equal weak signal', 0.5, 1) },
];
const malformedRows = [
  { modelId: 'glm-5.2', scores: scores(Number.NaN, Number.POSITIVE_INFINITY, 2, 'Phantom weak signal', Number.NEGATIVE_INFINITY, 1) },
  { modelId: 'glm-5.2', scores: scores(4, 3, 1, 'Real weak signal', 0.25, 1) },
  { modelId: 'minimax-m3', scores: scores(Number.NaN, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, 'Invalid max signal', 0.1, Number.POSITIVE_INFINITY) },
];

function assertFiniteBreakdown(breakdown: NonNullable<ReturnType<typeof averageModelLabBreakdown>>): void {
  for (const [label, value] of [
    ['structural', breakdown.structural],
    ['runtime', breakdown.runtime],
    ['style', breakdown.style],
    ['total', breakdown.total],
    ['weakest signal score', breakdown.weakestSignal.score],
    ['weakest signal maxScore', breakdown.weakestSignal.maxScore],
  ] as const) {
    assert.ok(Number.isFinite(value), `Model Lab breakdown ${label} should stay finite`);
  }
}

const byModel = buildModelLabBreakdownByModel(rows);
assert.deepEqual(
  [...byModel.keys()],
  ['qwen-coder', 'mistral-small'],
  'Breakdown map should preserve first-seen model order for stable summary cards',
);
assert.deepEqual(
  byModel.get('qwen-coder'),
  averageModelLabBreakdown(rows.filter((row) => row.modelId === 'qwen-coder')),
  'One-pass model breakdown map should match the old per-card filter/average behavior',
);
assert.deepEqual(
  byModel.get('mistral-small'),
  averageModelLabBreakdown(rows.filter((row) => row.modelId === 'mistral-small')),
  'One-pass model breakdown map should preserve single-model breakdowns',
);
assert.deepEqual(
  averageModelLabBreakdown([]),
  {
    structural: 0,
    runtime: 0,
    style: 0,
    total: 0,
    weakestSignal: {
      id: 'none',
      label: 'No signals',
      category: 'style',
      passed: false,
      score: 0,
      maxScore: 1,
    },
    signals: [],
  },
  'Empty breakdown fallback should preserve the existing no-signal visual state',
);
assert.deepEqual(
  buildModelLabBreakdownByModel([]),
  new Map(),
  'Empty result arrays should not create phantom model entries',
);
assert.equal(
  buildModelLabBreakdownByModel(tiedRows).get('qwen-coder')?.weakestSignal.label,
  'First weak signal',
  'Accumulator weakest-signal scan should preserve first-encountered tie behavior',
);

const malformedAverage = averageModelLabBreakdown(malformedRows);
assert.deepEqual(
  {
    structural: malformedAverage.structural,
    runtime: malformedAverage.runtime,
    style: malformedAverage.style,
    total: malformedAverage.total,
    weakestSignal: malformedAverage.weakestSignal.label,
  },
  {
    structural: 1.3,
    runtime: 1,
    style: 1,
    total: 3.3,
    weakestSignal: 'Real weak signal',
  },
  'Malformed score components should count as zero while valid rows and weakest signals remain usable',
);
assertFiniteBreakdown(malformedAverage);
const malformedByModel = buildModelLabBreakdownByModel(malformedRows);
assert.deepEqual(
  {
    structural: malformedByModel.get('glm-5.2')?.structural,
    runtime: malformedByModel.get('glm-5.2')?.runtime,
    style: malformedByModel.get('glm-5.2')?.style,
    total: malformedByModel.get('glm-5.2')?.total,
    weakestSignal: malformedByModel.get('glm-5.2')?.weakestSignal.label,
  },
  {
    structural: 2,
    runtime: 1.5,
    style: 1.5,
    total: 5,
    weakestSignal: 'Real weak signal',
  },
  'Per-model summaries should keep finite averages when one row has malformed score components',
);
const malformedFallback = malformedByModel.get('minimax-m3');
assert.ok(malformedFallback, 'Models with only malformed score evidence should still produce a breakdown');
assert.deepEqual(
  malformedFallback.weakestSignal,
  {
    id: 'none',
    label: 'No signals',
    category: 'style',
    passed: false,
    score: 0,
    maxScore: 1,
  },
  'Models with only malformed weakest-signal candidates should use the no-signal fallback',
);
assertFiniteBreakdown(malformedFallback);

const breakdownSource = readFileSync('src/utils/modelLabBreakdownSummary.ts', 'utf8');
assert.ok(
  !breakdownSource.includes('new Map<string, T[]>()'),
  'Model breakdown helper should not retain grouped per-model row arrays',
);
assert.ok(
  !breakdownSource.includes('.sort((a, b) => (a.score / a.maxScore)'),
  'Average breakdown helper should scan weakest signals without sorting every signal list',
);
assert.ok(
  breakdownSource.includes('interface BreakdownAccumulator'),
  'Model breakdown helper should use explicit accumulator state for linear memory use',
);

const modelLabSource = readFileSync('src/components/ModelLabPanel.tsx', 'utf8');
for (const expected of [
  'buildModelLabBreakdownByModel',
  'const selectedReportBreakdownsByModel = useMemo(',
  'const selectedBenchBreakdownsByModel = useMemo(',
  'selectedReportBreakdownsByModel.get(modelId) || averageModelLabBreakdown([])',
  'selectedBenchBreakdownsByModel.get(modelId) || averageModelLabBreakdown([])',
]) {
  assert.ok(
    modelLabSource.includes(expected),
    `Model Lab summaries should use precomputed per-model breakdown maps: ${expected}`,
  );
}
assert.ok(
  !modelLabSource.includes('averageBreakdown(selectedReport.results.filter(r => r.modelId === modelId))'),
  'Eval summary cards should not filter the full result list once per model card',
);
assert.ok(
  !modelLabSource.includes('averageBreakdown(selectedBenchRun.results.filter(r => r.modelId === modelId))'),
  'Bench summary cards should not filter the full result list once per model card',
);

const packageSource = readFileSync('package.json', 'utf8');
assert.ok(packageSource.includes('test:model-lab-breakdown-summary'), 'package.json should expose the Model Lab breakdown summary test');

console.log('Model Lab breakdown summary checks passed.');
