import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { HarnessRunStep } from '../src/types';
import { formatScoreDisplay } from '../src/utils/scoreDisplay';
import { buildRouterExplanation } from '../src/utils/routerExplanation';

(globalThis as typeof globalThis & { React?: typeof React }).React = React;
const { RouterExplanationSection } = await import('../src/components/PromptMicroscopeRouterExplanation');

type AutoRouterStep = Extract<HarnessRunStep, { type: 'auto_router' }>;
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, null, undefined, '1.0']) {
  assert.equal(formatScoreDisplay(value), 'unavailable', `Non-finite or non-number score ${String(value)} should display as unavailable`);
}

assert.equal(formatScoreDisplay(0), '0.00', 'Zero should keep fixed score precision');
assert.equal(formatScoreDisplay(2), '2.00', 'Integer scores should keep fixed score precision');
assert.equal(formatScoreDisplay(0.1 + 0.2), '0.30', 'Finite decimal scores should round with fixed precision');
assert.equal(formatScoreDisplay(-0), '0.00', 'Negative zero should not render as -0.00');
assert.equal(formatScoreDisplay(0.825, 3), '0.825', 'Custom precision should be supported');
assert.equal(formatScoreDisplay(1.23456, Number.NaN), '1.23', 'Non-finite precision should fall back to default precision');
assert.equal(formatScoreDisplay(1.23456, Number.POSITIVE_INFINITY), '1.23', 'Infinite precision should fall back to default precision');
assert.equal(formatScoreDisplay(1.23456, 3.9), '1.235', 'Fractional precision should truncate before formatting');
assert.equal(formatScoreDisplay(Number.NaN, 2, 'score unavailable'), 'score unavailable', 'Fallback label should be caller-controlled');
assert.equal(formatScoreDisplay(1, -1), '1', 'Negative precision should clamp instead of throwing');
assert.equal(formatScoreDisplay(1, 101), '1.0000000000', 'Overlarge precision should clamp instead of throwing');

const scoreDisplayModule = await import('../src/utils/scoreDisplay') as typeof import('../src/utils/scoreDisplay') & {
  buildModelLabBreakdownDisplaySegments?: (breakdown?: unknown) => Array<{
    label: string;
    valueLabel: string;
    widthPercent: number;
    width: string;
    title: string;
  }>;
  formatModelLabMetricValue?: (value: unknown) => string;
  formatModelLabMetricRatio?: (value: unknown, maxValue: unknown) => string;
  formatModelLabMetricValueForSamples?: (value: unknown, sampleCount?: unknown) => string;
  formatModelLabMetricRatioForSamples?: (value: unknown, maxValue: unknown, sampleCount?: unknown) => string;
  formatModelLabDurationMsForSamples?: (value: unknown, sampleCount?: unknown) => string;
  formatModelLabCostForSamples?: (value: unknown, sampleCount?: unknown) => string;
  modelLabScoreColorForSamples?: (value: unknown, sampleCount?: unknown) => string;
  modelLabScoreColor?: (value: unknown) => string;
  formatModelLabDurationMs?: (value: unknown) => string;
  formatModelLabCost?: (value: unknown) => string;
  formatModelLabPercent?: (value: unknown) => string;
  compareModelLabMetricValues?: (a: unknown, b: unknown) => number;
  averageModelLabMetricValues?: (values: unknown[], digits?: unknown) => number | null;
  isMalformedModelLabMetricRatio?: (value: unknown, maxValue: unknown) => boolean;
  compareModelLabMetricRatios?: (aValue: unknown, aMaxValue: unknown, bValue: unknown, bMaxValue: unknown) => number;
  formatModelLabRubricCoverage?: (coverage?: unknown) => string;
  modelLabRubricCoverageColor?: (coverage?: unknown) => string;
  formatModelLabSignedDelta?: (value: unknown) => string;
  modelLabDeltaColor?: (value: unknown) => string;
  formatModelLabLatencyMs?: (value: unknown) => string;
  modelLabTimestampMs?: (value: unknown) => number | null;
  formatModelLabTimestamp?: (value: unknown) => string;
  formatPercentDisplay?: (value: unknown) => string;
};
assert.equal(
  typeof scoreDisplayModule.buildModelLabBreakdownDisplaySegments,
  'function',
  'Score display utilities should expose safe Model Lab breakdown segment formatting',
);
assert.equal(
  typeof scoreDisplayModule.formatModelLabMetricValue,
  'function',
  'Score display utilities should expose safe Model Lab scalar value formatting',
);
assert.equal(
  typeof scoreDisplayModule.formatModelLabMetricRatio,
  'function',
  'Score display utilities should expose safe Model Lab scalar ratio formatting',
);
assert.equal(
  typeof scoreDisplayModule.formatModelLabMetricValueForSamples,
  'function',
  'Score display utilities should expose sample-aware Model Lab scalar value formatting',
);
assert.equal(
  typeof scoreDisplayModule.formatModelLabMetricRatioForSamples,
  'function',
  'Score display utilities should expose sample-aware Model Lab scalar ratio formatting',
);
assert.equal(
  typeof scoreDisplayModule.formatModelLabDurationMsForSamples,
  'function',
  'Score display utilities should expose sample-aware Model Lab latency formatting',
);
assert.equal(
  typeof scoreDisplayModule.formatModelLabCostForSamples,
  'function',
  'Score display utilities should expose sample-aware Model Lab cost formatting',
);
assert.equal(
  typeof scoreDisplayModule.modelLabScoreColorForSamples,
  'function',
  'Score display utilities should expose sample-aware Model Lab score coloring',
);
assert.equal(
  typeof scoreDisplayModule.modelLabScoreColor,
  'function',
  'Score display utilities should expose safe Model Lab score coloring',
);
assert.equal(
  typeof scoreDisplayModule.formatModelLabDurationMs,
  'function',
  'Score display utilities should expose safe Model Lab latency formatting',
);
assert.equal(
  typeof scoreDisplayModule.formatModelLabCost,
  'function',
  'Score display utilities should expose safe Model Lab cost formatting',
);
assert.equal(
  typeof scoreDisplayModule.formatModelLabPercent,
  'function',
  'Score display utilities should expose safe Model Lab percent formatting',
);
assert.equal(
  typeof scoreDisplayModule.compareModelLabMetricValues,
  'function',
  'Score display utilities should expose safe Model Lab metric sorting',
);
assert.equal(
  typeof scoreDisplayModule.averageModelLabMetricValues,
  'function',
  'Score display utilities should expose safe Model Lab metric averaging',
);
assert.equal(
  typeof scoreDisplayModule.isMalformedModelLabMetricRatio,
  'function',
  'Score display utilities should expose malformed Model Lab ratio detection',
);
assert.equal(
  typeof scoreDisplayModule.compareModelLabMetricRatios,
  'function',
  'Score display utilities should expose safe Model Lab metric ratio sorting',
);
assert.equal(
  typeof scoreDisplayModule.formatModelLabRubricCoverage,
  'function',
  'Score display utilities should expose safe Model Lab rubric coverage formatting',
);
assert.equal(
  typeof scoreDisplayModule.modelLabRubricCoverageColor,
  'function',
  'Score display utilities should expose safe Model Lab rubric coverage coloring',
);
assert.equal(
  typeof scoreDisplayModule.formatModelLabSignedDelta,
  'function',
  'Score display utilities should expose safe Model Lab signed delta formatting',
);
assert.equal(
  typeof scoreDisplayModule.modelLabDeltaColor,
  'function',
  'Score display utilities should expose safe Model Lab delta coloring',
);
assert.equal(
  typeof scoreDisplayModule.formatModelLabLatencyMs,
  'function',
  'Score display utilities should expose safe Model Lab millisecond latency formatting',
);
assert.equal(
  typeof scoreDisplayModule.modelLabTimestampMs,
  'function',
  'Score display utilities should expose safe Model Lab timestamp parsing',
);
assert.equal(
  typeof scoreDisplayModule.formatModelLabTimestamp,
  'function',
  'Score display utilities should expose safe Model Lab timestamp formatting',
);
assert.equal(
  typeof scoreDisplayModule.formatPercentDisplay,
  'function',
  'Score display utilities should expose shared safe percent formatting',
);

for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, '8', null, undefined]) {
  assert.equal(
    scoreDisplayModule.formatModelLabMetricValue(value),
    'unavailable',
    `Malformed Model Lab scalar value ${String(value)} should render as unavailable`,
  );
  assert.equal(
    scoreDisplayModule.modelLabScoreColor(value),
    'var(--text-tertiary)',
    `Malformed Model Lab scalar value ${String(value)} should use neutral score color`,
  );
}
assert.equal(scoreDisplayModule.formatModelLabMetricValue(-0), '0', 'Model Lab scalar values should not render negative zero');
assert.equal(scoreDisplayModule.formatModelLabMetricValue(8.5), '8.5', 'Model Lab scalar values should preserve finite numeric labels');
assert.equal(scoreDisplayModule.modelLabScoreColor(8), 'var(--accent-success)', 'High finite Model Lab scores should keep success color');
assert.equal(scoreDisplayModule.modelLabScoreColor(5), 'var(--accent-warning)', 'Medium finite Model Lab scores should keep warning color');
assert.equal(scoreDisplayModule.modelLabScoreColor(2), 'var(--accent-error)', 'Low finite Model Lab scores should keep error color');
assert.equal(scoreDisplayModule.formatModelLabDurationMs(1234), '1.2s', 'Model Lab durations should preserve current one-decimal seconds formatting');
assert.equal(scoreDisplayModule.formatModelLabDurationMs(-0), '0.0s', 'Model Lab durations should normalize negative zero');
assert.equal(scoreDisplayModule.formatModelLabCost(0.1234567), '$0.123457', 'Model Lab costs should preserve six-decimal dollar formatting');
assert.equal(scoreDisplayModule.formatModelLabCost(-0), '$0.000000', 'Model Lab costs should normalize negative zero');
assert.equal(scoreDisplayModule.formatModelLabPercent(0.876), '88%', 'Model Lab percents should preserve rounded percentage formatting');
assert.equal(scoreDisplayModule.formatModelLabPercent(-0), '0%', 'Model Lab percents should normalize negative zero');
for (const [value, text] of [
  [0, '0%'],
  [-0, '0%'],
  [0.5, '50%'],
  [1, '100%'],
  [0.505, '51%'],
  [0.015, '2%'],
  [0.035, '4%'],
  [0.145, '15%'],
  [0.004, '0%'],
  [-0.004, '0%'],
  [-0.005, '-1%'],
  [-0.015, '-2%'],
  [-0.1, '-10%'],
  [1.5, '150%'],
  [Number.NaN, 'unavailable'],
  [Number.POSITIVE_INFINITY, 'unavailable'],
  [Number.NEGATIVE_INFINITY, 'unavailable'],
  ['0.5', 'unavailable'],
  [null, 'unavailable'],
  [undefined, 'unavailable'],
  [{}, 'unavailable'],
] as Array<[unknown, string]>) {
  assert.equal(scoreDisplayModule.formatPercentDisplay(value), text, `Shared percent ${String(value)} should render safe text`);
}
for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, '1200', null, undefined]) {
  assert.equal(scoreDisplayModule.formatModelLabDurationMs(value), 'unavailable', `Malformed duration ${String(value)} should render as unavailable`);
  assert.equal(scoreDisplayModule.formatModelLabCost(value), 'unavailable', `Malformed cost ${String(value)} should render as unavailable`);
  assert.equal(scoreDisplayModule.formatModelLabPercent(value), 'unavailable', `Malformed percent ${String(value)} should render as unavailable`);
}
const sortableMetricValues = [Number.NaN, 0.1, -0, 0.2, Number.POSITIVE_INFINITY];
assert.deepEqual(
  sortableMetricValues.slice().sort(scoreDisplayModule.compareModelLabMetricValues),
  [-0, 0.1, 0.2, Number.NaN, Number.POSITIVE_INFINITY],
  'Model Lab metric sorting should preserve valid ascending order and sink invalid values',
);
assert.equal(scoreDisplayModule.averageModelLabMetricValues([], 1), null, 'Empty Model Lab metric averages should be unavailable');
assert.equal(scoreDisplayModule.averageModelLabMetricValues([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY], 1), null, 'All-poisoned Model Lab metric averages should be unavailable');
assert.equal(scoreDisplayModule.averageModelLabMetricValues([8, Number.NaN, 6, Number.POSITIVE_INFINITY], 1), 7, 'Mixed Model Lab metric averages should ignore non-finite values');
assert.equal(scoreDisplayModule.averageModelLabMetricValues([0, -0, 1], 1), 0.3, 'Model Lab metric averages should preserve true finite zero values');
assert.equal(scoreDisplayModule.averageModelLabMetricValues([1.234, 1.235], 2), 1.23, 'Model Lab metric averages should support caller-controlled precision');
assert.equal(scoreDisplayModule.averageModelLabMetricValues([1.234, 1.235], Number.NaN), 1.2, 'Model Lab metric averages should fall back when precision is malformed');
assert.equal(scoreDisplayModule.formatModelLabMetricRatio(8, 10), '8/10', 'Finite Model Lab score ratios should render as value/max');
assert.equal(scoreDisplayModule.formatModelLabMetricRatio(-0, 10), '0/10', 'Model Lab score ratios should normalize negative zero');
assert.equal(scoreDisplayModule.formatModelLabMetricValueForSamples(0, 0), 'unavailable', 'Zero-sample scalar metrics should render as unavailable instead of fake zero');
assert.equal(scoreDisplayModule.formatModelLabMetricRatioForSamples(0, 10, 0), 'unavailable', 'Zero-sample score ratios should render as unavailable instead of fake 0/10');
assert.equal(scoreDisplayModule.formatModelLabDurationMsForSamples(0, 0), 'unavailable', 'Zero-sample latencies should render as unavailable instead of fake 0.0s');
assert.equal(scoreDisplayModule.formatModelLabCostForSamples(0, 0), 'unavailable', 'Zero-sample costs should render as unavailable instead of fake $0.000000');
assert.equal(scoreDisplayModule.modelLabScoreColorForSamples(0, 0), 'var(--text-tertiary)', 'Zero-sample score colors should stay neutral');
assert.equal(scoreDisplayModule.formatModelLabMetricValueForSamples(0, 1), '0', 'Positive sample counts should preserve true scalar zero values');
assert.equal(scoreDisplayModule.formatModelLabMetricRatioForSamples(0, 10, 1), '0/10', 'Positive sample counts should preserve true zero ratios');
assert.equal(scoreDisplayModule.formatModelLabDurationMsForSamples(0, 1), '0.0s', 'Positive sample counts should preserve true zero latencies');
assert.equal(scoreDisplayModule.formatModelLabCostForSamples(0, 1), '$0.000000', 'Positive sample counts should preserve true zero costs');
assert.equal(scoreDisplayModule.modelLabScoreColorForSamples(0, 1), 'var(--accent-error)', 'Positive sample counts should color true low scores normally');
assert.equal(scoreDisplayModule.formatModelLabMetricRatioForSamples(0, 10), '0/10', 'Missing sample counts should preserve legacy Model Lab score rendering');
assert.equal(scoreDisplayModule.formatModelLabMetricRatioForSamples(0, 10, null), 'unavailable', 'Malformed sample counts should not make fake zeroes look trustworthy');
assert.equal(scoreDisplayModule.isMalformedModelLabMetricRatio(0, 1), false, 'Zero score with positive max should be a well-formed ratio');
assert.equal(scoreDisplayModule.isMalformedModelLabMetricRatio(1, 1), false, 'Finite positive ratios should be well formed');
for (const [value, maxValue] of [
  [Number.NaN, 1],
  [Number.POSITIVE_INFINITY, 1],
  [Number.NEGATIVE_INFINITY, 1],
  [-1, 1],
  [1, 0],
  [1, -1],
  [1, Number.NaN],
  ['1', 1],
]) {
  assert.equal(
    scoreDisplayModule.isMalformedModelLabMetricRatio(value, maxValue),
    true,
    `Malformed Model Lab ratio ${String(value)}/${String(maxValue)} should be detected`,
  );
}
const sortedMetricRatioRows = [
  { id: 'weak-high', score: 4, maxScore: 10 },
  { id: 'malformed', score: Number.NaN, maxScore: 10 },
  { id: 'weak-low', score: 1, maxScore: 10 },
].sort((a, b) => scoreDisplayModule.compareModelLabMetricRatios(a.score, a.maxScore, b.score, b.maxScore));
assert.deepEqual(
  sortedMetricRatioRows.map((row) => row.id),
  ['weak-low', 'weak-high', 'malformed'],
  'Safe Model Lab ratio sorting should keep well-formed weak ratios ordered and sink malformed ratios by default',
);
const rubricCoverageCases = [
  { label: 'missing coverage', coverage: undefined, text: '—', color: 'var(--text-tertiary)' },
  { label: 'zero total points', coverage: { passedPoints: 0, totalPoints: 0, ratio: 0 }, text: '—', color: 'var(--text-tertiary)' },
  { label: 'NaN passed points', coverage: { passedPoints: Number.NaN, totalPoints: 5, ratio: 0.5 }, text: 'unavailable', color: 'var(--text-tertiary)' },
  { label: 'Infinity total points', coverage: { passedPoints: 5, totalPoints: Number.POSITIVE_INFINITY, ratio: 0.5 }, text: 'unavailable', color: 'var(--text-tertiary)' },
  { label: 'NaN ratio', coverage: { passedPoints: 3, totalPoints: 5, ratio: Number.NaN }, text: 'unavailable', color: 'var(--text-tertiary)' },
  { label: 'Infinity ratio', coverage: { passedPoints: 3, totalPoints: 5, ratio: Number.POSITIVE_INFINITY }, text: 'unavailable', color: 'var(--text-tertiary)' },
  { label: 'negative ratio', coverage: { passedPoints: 3, totalPoints: 5, ratio: -0.1 }, text: 'unavailable', color: 'var(--text-tertiary)' },
  { label: 'overlarge ratio', coverage: { passedPoints: 3, totalPoints: 5, ratio: 1.5 }, text: 'unavailable', color: 'var(--text-tertiary)' },
  { label: 'low coverage', coverage: { passedPoints: 1, totalPoints: 5, ratio: 0.2 }, text: '1/5 pts · 20%', color: 'var(--accent-error)' },
  { label: 'medium coverage', coverage: { passedPoints: 3, totalPoints: 5, ratio: 0.6 }, text: '3/5 pts · 60%', color: '#f59e0b' },
  { label: 'high coverage', coverage: { passedPoints: 4, totalPoints: 5, ratio: 0.8 }, text: '4/5 pts · 80%', color: 'var(--accent-success)' },
  { label: 'rounded coverage', coverage: { passedPoints: 3.45, totalPoints: 5.78, ratio: 3.45 / 5.78 }, text: '3.5/5.8 pts · 60%', color: '#f59e0b' },
];
for (const { label, coverage, text, color } of rubricCoverageCases) {
  assert.equal(scoreDisplayModule.formatModelLabRubricCoverage(coverage), text, `Rubric coverage ${label} should render safe text`);
  assert.equal(scoreDisplayModule.modelLabRubricCoverageColor(coverage), color, `Rubric coverage ${label} should render safe color`);
}
for (const [value, text, color] of [
  [1, '+1', 'var(--accent-success)'],
  [0, '+0', 'var(--accent-success)'],
  [-1.5, '-1.5', 'var(--accent-error)'],
  [Number.NaN, '—', 'var(--text-tertiary)'],
  [Number.POSITIVE_INFINITY, '—', 'var(--text-tertiary)'],
  [Number.NEGATIVE_INFINITY, '—', 'var(--text-tertiary)'],
  [undefined, '—', 'var(--text-tertiary)'],
  [null, '—', 'var(--text-tertiary)'],
] as Array<[unknown, string, string]>) {
  assert.equal(scoreDisplayModule.formatModelLabSignedDelta(value), text, `Signed delta ${String(value)} should render safe text`);
  assert.equal(scoreDisplayModule.modelLabDeltaColor(value), color, `Signed delta ${String(value)} should render safe color`);
}
for (const [value, text] of [
  [1234, '1234ms'],
  [1234.4, '1234ms'],
  [1234.5, '1235ms'],
  [0, '0ms'],
  [-0, '0ms'],
  [Number.NaN, 'unavailable'],
  [Number.POSITIVE_INFINITY, 'unavailable'],
  [Number.NEGATIVE_INFINITY, 'unavailable'],
  [-1, 'unavailable'],
  [undefined, 'unavailable'],
  [null, 'unavailable'],
] as Array<[unknown, string]>) {
  assert.equal(scoreDisplayModule.formatModelLabLatencyMs(value), text, `Latency ${String(value)} should render safe milliseconds`);
}
const validTimestamp = '2026-06-27T12:34:56.000Z';
assert.equal(scoreDisplayModule.modelLabTimestampMs(validTimestamp), Date.parse(validTimestamp), 'Valid ISO timestamps should parse to epoch milliseconds');
assert.equal(scoreDisplayModule.modelLabTimestampMs(Date.parse(validTimestamp)), Date.parse(validTimestamp), 'Finite numeric timestamps should be accepted');
assert.equal(scoreDisplayModule.modelLabTimestampMs(-0), 0, 'Timestamp parsing should normalize negative zero');
for (const value of ['not-a-date', '', Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, null, undefined, {}]) {
  assert.equal(scoreDisplayModule.modelLabTimestampMs(value), null, `Malformed timestamp ${String(value)} should parse as unavailable`);
  assert.equal(scoreDisplayModule.formatModelLabTimestamp(value), 'unavailable', `Malformed timestamp ${String(value)} should format as unavailable`);
}
assert.doesNotMatch(
  scoreDisplayModule.formatModelLabTimestamp(validTimestamp),
  /Invalid Date|NaN|Infinity/,
  'Valid timestamp formatting should not leak invalid date labels',
);
for (const [value, maxValue] of [
  [Number.NaN, 10],
  [8, Number.NaN],
  [8, Number.POSITIVE_INFINITY],
  [8, 0],
  [8, -1],
  [-1, 10],
  ['8', 10],
]) {
  assert.equal(
    scoreDisplayModule.formatModelLabMetricRatio(value, maxValue),
    'unavailable',
    `Malformed Model Lab score ratio ${String(value)}/${String(maxValue)} should render as unavailable`,
  );
}

const malformedBreakdownSegments = scoreDisplayModule.buildModelLabBreakdownDisplaySegments({
  structural: Number.NaN,
  runtime: Number.POSITIVE_INFINITY,
  style: -1,
} as never);
assert.deepEqual(
  malformedBreakdownSegments.map((segment) => ({
    label: segment.label,
    valueLabel: segment.valueLabel,
    widthPercent: segment.widthPercent,
    width: segment.width,
    title: segment.title,
  })),
  [
    { label: 'Structural', valueLabel: '0', widthPercent: 0, width: '0%', title: 'Structural 0/4.5' },
    { label: 'Runtime', valueLabel: '0', widthPercent: 0, width: '0%', title: 'Runtime 0/3.5' },
    { label: 'Style', valueLabel: '0', widthPercent: 0, width: '0%', title: 'Style 0/2' },
  ],
  'Malformed Model Lab breakdown values should render as finite zero-width segments',
);
assert.doesNotMatch(
  JSON.stringify(malformedBreakdownSegments),
  /NaN|Infinity|-0/,
  'Model Lab breakdown segment display data should not leak non-finite or negative-zero labels',
);
const validBreakdownSegments = scoreDisplayModule.buildModelLabBreakdownDisplaySegments({
  structural: 4,
  runtime: 3,
  style: 2,
} as never);
assert.deepEqual(
  validBreakdownSegments.map((segment) => segment.width),
  ['40%', '30%', '20%'],
  'Valid Model Lab breakdown values should preserve the existing max(10, sum) width floor',
);
const mixedBreakdownSegments = scoreDisplayModule.buildModelLabBreakdownDisplaySegments({
  structural: -0,
  runtime: 2,
  style: 'bad',
} as never);
assert.deepEqual(
  mixedBreakdownSegments.map((segment) => ({ valueLabel: segment.valueLabel, width: segment.width })),
  [
    { valueLabel: '0', width: '0%' },
    { valueLabel: '2', width: '20%' },
    { valueLabel: '0', width: '0%' },
  ],
  'Mixed malformed Model Lab breakdown values should keep valid components and suppress invalid labels',
);

const brokenScoreStep: AutoRouterStep = {
  type: 'auto_router',
  modelId: 'provider:broken-score',
  score: Number.NaN,
  reason: 'Classifier score was not usable.',
  cached: false,
  fallback: false,
  classifierModel: 'provider:classifier',
  candidateScores: {
    'provider:broken-score': Number.NaN,
    'provider:runner-up': 0.74,
  },
  stages: {
    modelSelectionPolicy: 'classifier',
    threshold: 0.7,
    heuristic: { mode: 'direct', role: 'coder', complexity: 'medium' },
  },
};

const explanation = buildRouterExplanation(brokenScoreStep, true);
assert.ok(explanation, 'Router explanation should build even when the selected score is non-finite');
const explanationMarkup = renderToStaticMarkup(
  createElement(RouterExplanationSection, { explanation }),
);
assert.ok(explanationMarkup.includes('unavailable'), 'Router explanation should render unavailable for non-finite scores');
assert.doesNotMatch(explanationMarkup, /NaN|Infinity/, 'Router explanation markup should not leak non-finite score labels');

const promptMicroscopeSource = readFileSync(join(repoRoot, 'src/components/PromptMicroscope.tsx'), 'utf8');
const modelLabSource = readFileSync(join(repoRoot, 'src/components/ModelLabPanel.tsx'), 'utf8');
for (const expected of [
  "import { formatScoreDisplay } from '../utils/scoreDisplay';",
  'const autoRouterScoreLabel = autoRouterStep ? formatScoreDisplay(autoRouterStep.score) :',
  'formatScoreDisplay(score)',
]) {
  assert.ok(promptMicroscopeSource.includes(expected), `Prompt Microscope should use safe score display: ${expected}`);
}
assert.ok(
  !promptMicroscopeSource.includes('autoRouterStep.score.toFixed(2)'),
  'Prompt Microscope should not render the selected Auto-Router score with raw toFixed',
);
assert.ok(
  modelLabSource.includes("from '../utils/scoreDisplay';")
    && [
      'buildModelLabBreakdownDisplaySegments',
      'compareModelLabMetricValues',
      'formatModelLabCost',
      'formatModelLabDurationMs',
      'formatModelLabCostForSamples',
      'formatModelLabDurationMsForSamples',
      'formatModelLabMetricRatio',
      'formatModelLabMetricRatioForSamples',
      'formatModelLabPercent',
      'formatModelLabMetricValueForSamples',
      'averageModelLabMetricValues',
      'isMalformedModelLabMetricRatio',
      'compareModelLabMetricRatios',
      'formatModelLabRubricCoverage',
      'modelLabRubricCoverageColor',
      'formatModelLabSignedDelta',
      'modelLabDeltaColor',
      'formatModelLabLatencyMs',
      'modelLabTimestampMs',
      'formatModelLabTimestamp',
      'modelLabScoreColor',
      'modelLabScoreColorForSamples',
    ].every((helper) => modelLabSource.includes(helper)),
  'Model Lab should import safe score display helpers',
);
assert.ok(
  modelLabSource.includes('buildModelLabBreakdownDisplaySegments(breakdown)'),
  'Model Lab score bars should render from sanitized breakdown display segments',
);
assert.ok(
  !modelLabSource.includes('breakdown.structural + breakdown.runtime + breakdown.style'),
  'Model Lab score bars should not compute totals from raw breakdown values',
);
assert.ok(
  !modelLabSource.includes('`${(breakdown.structural / total) * 100}%`'),
  'Model Lab score bars should not interpolate raw structural widths',
);
for (const expected of [
  'formatModelLabMetricRatio(r.scores.overallScore, 10)',
  'formatModelLabMetricRatio(result.scores.overallScore, 10)',
  'formatModelLabMetricRatio(row.avgScore, 10)',
  'formatModelLabMetricRatio(weakest.score, weakest.maxScore)',
  'formatModelLabMetricRatio(signal.score, signal.maxScore)',
  'modelLabScoreColor(r.scores.overallScore)',
  'modelLabScoreColor(result.scores.overallScore)',
  'modelLabScoreColor(row.avgScore)',
]) {
  assert.ok(modelLabSource.includes(expected), `Model Lab scalar scores should use safe display helpers: ${expected}`);
}
assert.ok(
  !modelLabSource.includes('{weakest.score}/{weakest.maxScore}'),
  'Model Lab weak-signal callouts should not interpolate raw weakest-signal scores',
);
assert.ok(
  !modelLabSource.includes('scoreColor(r.scores.overallScore)'),
  'Model Lab result rows should not color raw overall scores directly',
);
for (const expected of [
  'formatModelLabDurationMs(r.wallMs)',
  'formatModelLabPercent(data.resolvedRate)',
  'compareModelLabMetricValues(a.scores.overallScore, b.scores.overallScore)',
]) {
  assert.ok(modelLabSource.includes(expected), `Model Lab numeric fields should use safe display helpers: ${expected}`);
}
for (const forbidden of [
  '(data.avgLatencyMs / 1000).toFixed(1)',
  '(r.wallMs / 1000).toFixed(1)',
  '(result.wallMs / 1000).toFixed(1)',
  'data.avgCost.toFixed(6)',
  'Math.round(data.resolvedRate * 100)',
  'Math.round(coverage.ratio * 100)',
  'a.scores.overallScore - b.scores.overallScore',
  '(a.score / a.maxScore) - (b.score / b.maxScore)',
  'signal.score < signal.maxScore',
  '{signal.score}/{signal.maxScore}',
]) {
  assert.ok(!modelLabSource.includes(forbidden), `Model Lab should not use raw numeric display/sort expression: ${forbidden}`);
}
for (const expected of [
  'formatModelLabMetricRatioForSamples(data.avgScore, 10, data.scoreSampleCount)',
  'formatModelLabMetricRatioForSamples(data.avgValidationScore, 2, data.validationSampleCount)',
  'formatModelLabDurationMsForSamples(data.avgLatencyMs, data.latencySampleCount)',
  'formatModelLabCostForSamples(data.avgCost, data.costSampleCount)',
  'formatModelLabMetricValueForSamples(data.avgToolCount, data.toolSampleCount)',
  'modelLabScoreColorForSamples(data.avgScore, data.scoreSampleCount)',
]) {
  assert.ok(modelLabSource.includes(expected), `Model Lab summary averages should honor sample counts: ${expected}`);
}
assert.ok(
  modelLabSource.includes('formatBenchValueScore(data)'),
  'Model Lab bench value score should derive availability from the component sample counts used to compute value',
);
for (const expected of [
  'averageModelLabMetricValues(taskResults.map((result) => result.scores.overallScore))',
  'averageModelLabMetricValues(taskResults.map((result) => result.scores.validationScore))',
  'averageModelLabMetricValues(taskResults.map((result) => result.scores.breakdown?.style))',
  'formatModelLabMetricValue(row.avgValidation)',
  'formatModelLabMetricValue(row.avgStyle)',
]) {
  assert.ok(modelLabSource.includes(expected), `Model Lab per-task averages should use safe aggregation/display: ${expected}`);
}
for (const forbidden of [
  'taskResults.reduce((sum, r) => sum + r.scores.overallScore, 0)',
  'taskResults.reduce((sum, r) => sum + r.scores.validationScore, 0)',
  'taskResults.reduce((sum, r) => sum + (r.scores.breakdown?.style ?? 0), 0)',
]) {
  assert.ok(!modelLabSource.includes(forbidden), `Model Lab per-task averages should not use raw reduction: ${forbidden}`);
}
for (const expected of [
  'const malformed = signals',
  'isMalformedModelLabMetricRatio(signal.score, signal.maxScore)',
  'const weak = signals',
  'compareModelLabMetricRatios(a.score, a.maxScore, b.score, b.maxScore)',
  'Data issue',
]) {
  assert.ok(modelLabSource.includes(expected), `Model Lab weak-signal diagnostics should surface malformed rows first: ${expected}`);
}
for (const expected of [
  "function rubricCoverageLabel(coverage?: api.BenchScores['rubricCoverage'])",
  'return formatModelLabRubricCoverage(coverage)',
  "function rubricCoverageColor(coverage?: api.BenchScores['rubricCoverage'])",
  'return modelLabRubricCoverageColor(coverage)',
]) {
  assert.ok(modelLabSource.includes(expected), `Model Lab rubric coverage should use safe shared helpers: ${expected}`);
}
for (const forbidden of [
  'roundTenth(coverage.passedPoints)',
  'roundTenth(coverage.totalPoints)',
  'coverage.ratio >= 0.7',
  'coverage.ratio >= 0.4',
]) {
  assert.ok(!modelLabSource.includes(forbidden), `Model Lab rubric coverage should not use raw coverage arithmetic: ${forbidden}`);
}
for (const expected of [
  'const scoreDeltaLabel = formatModelLabSignedDelta(delta.avgScoreDelta)',
  'const scoreDeltaPctLabel = formatModelLabSignedDelta(delta.avgScoreDeltaPct)',
  'const deltaTone = modelLabDeltaColor(delta.avgScoreDelta)',
  'scoreDeltaPctLabel ===',
  'validation {formatModelLabSignedDelta(delta.avgValidationDelta)}',
  'style {formatModelLabSignedDelta(delta.avgStyleDelta)}',
  'color: modelLabDeltaColor(row.delta)',
  'formatModelLabSignedDelta(row.delta)',
]) {
  assert.ok(modelLabSource.includes(expected), `Model Lab bench deltas should use safe delta helpers: ${expected}`);
}
for (const forbidden of [
  'const positive = delta.avgScoreDelta >= 0',
  "{positive ? '+' : ''}{delta.avgScoreDeltaPct}",
  "{positive ? '+' : ''}{delta.avgScoreDelta}/10",
  'formatSigned(delta.avgValidationDelta)',
  'formatSigned(delta.avgStyleDelta)',
  'function formatSigned(n: number)',
  'row.delta >= 0 ?',
]) {
  assert.ok(!modelLabSource.includes(forbidden), `Model Lab bench deltas should not use raw delta arithmetic: ${forbidden}`);
}
for (const expected of [
  'function ProviderHealthSummary({ signal, compact = false }',
  'const latencyMs = formatModelLabLatencyMs(signal.maxLatencyMs)',
  'Latest health check: {formatModelLabTimestamp(signal.latestChecked)}',
  'const timestampMs = modelLabTimestampMs(timestamp)',
  'timestampMs == null',
  'latestCheckedMs',
  'latencyMs ===',
  '<ProviderHealthSummary signal={providerHealthSignal} compact />',
  '<ProviderHealthSummary signal={providerHealthSignal} />',
]) {
  assert.ok(modelLabSource.includes(expected), `Model Lab provider health latency should use safe latency helper: ${expected}`);
}
for (const forbidden of [
  'Math.round(providerHealthSignal.maxLatencyMs)',
  '${providerHealthSignal.maxLatencyMs}ms',
  "typeof providerHealthSignal.maxLatencyMs === 'number' ? ` · slowest",
  "if (typeof latencyMs === 'number') maxLatencyMs = Math.max(maxLatencyMs || 0, latencyMs)",
  'new Date(timestamp).getTime()',
  'new Date(signal.latestChecked).toLocaleString()',
  'timestamp && (!latestChecked || timestamp > latestChecked)',
]) {
  assert.ok(!modelLabSource.includes(forbidden), `Model Lab provider health should not use raw latency formatting: ${forbidden}`);
}

console.log('Score display formatting checks passed.');
