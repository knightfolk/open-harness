import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  buildPromptCostSummary,
  estimatePromptCost,
  estimatePromptTextTokens,
  fitPromptSectionsToBudget,
} from '../src/utils/promptCost';

function assertNoNonFiniteNumbers(input: Record<string, unknown>, message: string): void {
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'number') assert.ok(Number.isFinite(value), `${message}: ${key} was ${String(value)}`);
  }
}

const prose120 = 'abcd '.repeat(24);
const code120 = 'if(x){return y+z;} '.repeat(6).padEnd(120, ';').slice(0, 120);

assert.equal(prose120.length, 120);
assert.equal(code120.length, 120);
assert.equal(estimatePromptTextTokens(''), 0, 'empty strings should estimate to zero tokens');
assert.equal(estimatePromptTextTokens(prose120), 30, 'plain prose should use the stable four-chars-per-token heuristic');
assert.ok(
  estimatePromptTextTokens(code120) > estimatePromptTextTokens(prose120),
  'code-like prompts should estimate more tokens than prose of the same character length',
);

assert.deepEqual(
  estimatePromptCost({
    inputTokens: 1_000,
    expectedOutputTokens: 500,
    inputCostPerMTok: 2,
    outputCostPerMTok: 8,
  }),
  {
    inputCost: 0.002,
    outputCost: 0.004,
    totalCost: 0.006,
  },
  'prompt cost math should match per-million-token pricing',
);

assert.deepEqual(
  estimatePromptCost({
    inputTokens: Number.NaN,
    expectedOutputTokens: Number.POSITIVE_INFINITY,
    inputCostPerMTok: -1,
    outputCostPerMTok: Number.NaN,
  }),
  {
    inputCost: 0,
    outputCost: 0,
    totalCost: 0,
  },
  'prompt cost math should clamp malformed token and price inputs instead of leaking non-finite costs',
);

assert.deepEqual(
  fitPromptSectionsToBudget([
    { id: 'identity', text: 'a'.repeat(40), priority: 1 },
    { id: 'rules', text: 'b'.repeat(80), priority: 2 },
    { id: 'context', text: 'c'.repeat(120), priority: 3 },
  ], 35),
  {
    kept: ['identity', 'rules'],
    dropped: ['context'],
    estTokens: 30,
  },
  'budget fitting should keep highest-priority sections until the token budget is reached',
);

assert.deepEqual(
  fitPromptSectionsToBudget([
    { id: 'first', text: 'a'.repeat(20), priority: 1 },
    { id: 'second', text: 'b'.repeat(20), priority: 1 },
    { id: 'third', text: 'c'.repeat(20), priority: 1 },
  ], 10),
  {
    kept: ['first', 'second'],
    dropped: ['third'],
    estTokens: 10,
  },
  'budget fitting should preserve insertion order for priority ties',
);

assert.deepEqual(
  fitPromptSectionsToBudget([
    { id: 'negative', text: 'a'.repeat(40), tokens: -50, priority: 1 },
    { id: 'infinite', text: 'b'.repeat(80), tokens: Number.POSITIVE_INFINITY, priority: 2 },
    { id: 'nan', text: 'c'.repeat(120), tokens: Number.NaN, priority: 3 },
  ], 35),
  {
    kept: ['negative', 'infinite'],
    dropped: ['nan'],
    estTokens: 30,
  },
  'budget fitting should fall back to text estimates for malformed section token counts',
);

const budgetInputSections = [
  { id: 'first', text: 'a'.repeat(40), priority: 1 },
  { id: 'second', text: 'b'.repeat(20), priority: 2 },
];
for (const budgetTokens of [Number.NaN, Number.POSITIVE_INFINITY, -1, 0]) {
  assert.deepEqual(
    fitPromptSectionsToBudget(budgetInputSections, budgetTokens),
    {
      kept: [],
      dropped: ['first', 'second'],
      estTokens: 0,
    },
    `Malformed budget token input ${String(budgetTokens)} should not keep sections or leak invalid budget math`,
  );
}
assert.deepEqual(
  fitPromptSectionsToBudget(budgetInputSections, 10.9),
  {
    kept: ['first'],
    dropped: ['second'],
    estTokens: 10,
  },
  'Budget fitting should floor fractional token budgets before fitting sections',
);

assert.deepEqual(
  buildPromptCostSummary({
    modelId: 'MiniMax-M3',
    sections: [
      { id: 'system', text: 'a'.repeat(400) },
      { id: 'context', text: 'b'.repeat(200) },
    ],
    estimates: [
      { id: 'system', tokens: 90 },
      { id: 'context', tokens: 60 },
    ],
    expectedOutputTokens: 1_000,
    budgetTokens: 1_200,
  }),
  {
    inputTokens: 150,
    expectedOutputTokens: 1_000,
    totalTokens: 1_150,
    budgetTokens: 1_200,
    budgetRatio: 0.9583333333333334,
    budgetTone: 'warning',
    budgetLabel: '96% of context budget',
    pricingKnown: true,
    costLabel: '$0.0006 est.',
    inputCost: 0.0000225,
    outputCost: 0.0006,
    totalCost: 0.0006225,
  },
  'prompt cost summary should combine estimates, expected output, budget pressure, and known model pricing',
);

const malformedCostSummary = buildPromptCostSummary({
  modelId: 'MiniMax-M3',
  sections: [
    { id: 'system', text: 'a'.repeat(40), tokens: Number.POSITIVE_INFINITY },
    { id: 'context', text: 'b'.repeat(80) },
  ],
  estimates: [
    { id: 'system', tokens: Number.NaN },
    { id: 'context', tokens: Number.NEGATIVE_INFINITY },
  ],
  expectedOutputTokens: Number.POSITIVE_INFINITY,
  budgetTokens: Number.NaN,
});
assertNoNonFiniteNumbers(
  malformedCostSummary as unknown as Record<string, unknown>,
  'Prompt cost summaries should not leak non-finite token math into user-visible readouts',
);
assert.deepEqual(
  malformedCostSummary,
  {
    inputTokens: 30,
    expectedOutputTokens: 1_000,
    totalTokens: 1_030,
    budgetTokens: null,
    budgetRatio: null,
    budgetTone: 'unknown',
    budgetLabel: 'context budget unavailable',
    pricingKnown: true,
    costLabel: '$0.0006 est.',
    inputCost: 0.0000045,
    outputCost: 0.0006,
    totalCost: 0.0006045,
  },
  'Malformed token inputs should fall back to text estimates and the default expected-output assumption',
);
assert.ok(Number.isFinite(malformedCostSummary.totalTokens), 'Malformed prompt cost summaries should keep total tokens finite');

for (const expectedOutputTokens of [Number.NaN, Number.NEGATIVE_INFINITY, -1, null, undefined, '100']) {
  const summary = buildPromptCostSummary({
    modelId: 'MiniMax-M3',
    sections: [],
    expectedOutputTokens: expectedOutputTokens as any,
  });
  assert.equal(
    summary.expectedOutputTokens,
    1_000,
    `Malformed expected-output token input ${String(expectedOutputTokens)} should use the default assumption`,
  );
  assertNoNonFiniteNumbers(summary as unknown as Record<string, unknown>, 'Malformed expected-output token inputs should not leak into cost summaries');
}

for (const budgetTokens of [0, -1, Number.POSITIVE_INFINITY, null, undefined]) {
  const summary = buildPromptCostSummary({
    modelId: 'MiniMax-M3',
    sections: [],
    budgetTokens: budgetTokens as any,
  });
  assert.equal(
    summary.budgetTokens,
    null,
    `Malformed budget token input ${String(budgetTokens)} should mark budget availability as unknown`,
  );
  assert.equal(summary.budgetLabel, 'context budget unavailable');
  assertNoNonFiniteNumbers(summary as unknown as Record<string, unknown>, 'Malformed budget token inputs should not leak into cost summaries');
}

assert.equal(
  buildPromptCostSummary({
    modelId: 'provider:MiniMax-M3',
    sections: [],
  }).pricingKnown,
  true,
  'Provider-prefixed model ids should resolve to the same known pricing card',
);

assert.equal(
  buildPromptCostSummary({
    modelId: 'unknown-model',
    sections: [{ id: 'prompt', text: 'a'.repeat(40) }],
    expectedOutputTokens: 100,
  }).costLabel,
  'pricing unavailable',
  'unknown model pricing should degrade gracefully',
);

const microscopeSource = readFileSync('src/components/PromptMicroscope.tsx', 'utf8');
assert.ok(
  microscopeSource.includes('buildPromptCostSummary({'),
  'Prompt Microscope should build one prompt cost summary from visible section estimates',
);
assert.ok(
  microscopeSource.includes('pm-cost-readout'),
  'Prompt Microscope should render a compact prompt cost readout',
);
assert.ok(
  microscopeSource.includes('Expected output'),
  'Prompt Microscope cost readout should disclose the expected-output assumption',
);
assert.ok(
  microscopeSource.includes("tokenBudgetHeaderInputTokens: estimateStatus === 'ready' ? totalEstimatedInputTokens : fallbackInputTokens"),
  'Prompt Microscope Token Budget header should avoid zero-token loading states by using fallback input estimates until server estimates are ready',
);
assert.ok(
  microscopeSource.includes('fallbackInputTokens: promptCostSummary.inputTokens'),
  'Prompt Microscope Token Budget header should pass prompt cost fallback input tokens into the estimate summary',
);
assert.ok(
  microscopeSource.includes('estimated input tokens across {sections.length} sections'),
  'Prompt Microscope Token Budget header should label the number as input-token evidence',
);
assert.ok(
  !microscopeSource.includes('Token Budget ({totalTokens} estimated tokens across {sections.length} sections)'),
  'Prompt Microscope Token Budget header should not use the old estimate-array-only total',
);

console.log('Prompt cost helper checks passed.');
