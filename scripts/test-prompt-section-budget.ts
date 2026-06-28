import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { computePromptBudget } from '../src/utils/promptBudget';

function assertFiniteBudgetState(state: ReturnType<typeof computePromptBudget>, message: string): void {
  assert.ok(Number.isFinite(state.totalTokens), `${message}: totalTokens should be finite`);
  state.sections.forEach((section) => {
    assert.ok(Number.isFinite(section.used), `${message}: ${section.id} used should be finite`);
    if (section.ratio != null) assert.ok(Number.isFinite(section.ratio), `${message}: ${section.id} ratio should be finite`);
  });
}

assert.deepEqual(
  computePromptBudget({ sections: [] }),
  {
    totalTokens: 0,
    sections: [],
    offenders: [],
    status: 'ok',
  },
  'empty prompt budgets should stay ok',
);

assert.deepEqual(
  computePromptBudget({
    sections: [
      { id: 'identity', label: 'Identity', tokens: 79, budget: 100 },
      { id: 'rules', label: 'Rules', tokens: 80, budget: 100 },
      { id: 'context', label: 'Context', tokens: 101, budget: 100 },
      { id: 'runtime', label: 'Runtime', chars: 400, budget: 80 },
      { id: 'unknown', label: 'No budget', tokens: 500 },
    ],
  }),
  {
    totalTokens: 860,
    sections: [
      { id: 'identity', label: 'Identity', used: 79, ratio: 0.79, severity: 'ok' },
      { id: 'rules', label: 'Rules', used: 80, ratio: 0.8, severity: 'warn' },
      { id: 'context', label: 'Context', used: 101, ratio: 1.01, severity: 'over' },
      { id: 'runtime', label: 'Runtime', used: 100, ratio: 1.25, severity: 'over' },
      { id: 'unknown', label: 'No budget', used: 500, ratio: null, severity: 'info' },
    ],
    offenders: [
      { id: 'runtime', label: 'Runtime', used: 100, ratio: 1.25, severity: 'over' },
      { id: 'context', label: 'Context', used: 101, ratio: 1.01, severity: 'over' },
      { id: 'rules', label: 'Rules', used: 80, ratio: 0.8, severity: 'warn' },
    ],
    status: 'over',
  },
  'prompt budget linter should flag over/warn sections, normalize chars, and sort offenders by ratio',
);

assert.deepEqual(
  computePromptBudget({
    warnRatio: 0.5,
    overRatio: 0.9,
    charsPerToken: 5,
    sections: [
      { id: 'a', label: 'A', chars: 250, budget: 100 },
      { id: 'b', label: 'B', tokens: 89, budget: 100 },
      { id: 'c', label: 'C', tokens: 90, budget: 100 },
    ],
  }),
  {
    totalTokens: 229,
    sections: [
      { id: 'a', label: 'A', used: 50, ratio: 0.5, severity: 'warn' },
      { id: 'b', label: 'B', used: 89, ratio: 0.89, severity: 'warn' },
      { id: 'c', label: 'C', used: 90, ratio: 0.9, severity: 'over' },
    ],
    offenders: [
      { id: 'c', label: 'C', used: 90, ratio: 0.9, severity: 'over' },
      { id: 'b', label: 'B', used: 89, ratio: 0.89, severity: 'warn' },
      { id: 'a', label: 'A', used: 50, ratio: 0.5, severity: 'warn' },
    ],
    status: 'over',
  },
  'custom thresholds and chars-per-token estimates should be respected',
);

assert.deepEqual(
  computePromptBudget({
    sections: [
      { id: 'first', label: 'First', tokens: 80, budget: 100 },
      { id: 'second', label: 'Second', tokens: 80, budget: 100 },
    ],
  }).offenders.map((item) => item.id),
  ['first', 'second'],
  'offender sorting should preserve insertion order for equal ratios',
);

const malformedUsageState = computePromptBudget({
  sections: [
    { id: 'nan-token', label: 'NaN token', tokens: Number.NaN, budget: 100 },
    { id: 'infinite-token', label: 'Infinite token', tokens: Number.POSITIVE_INFINITY, budget: 100 },
    { id: 'negative-token', label: 'Negative token', tokens: -50, budget: 100 },
    { id: 'nan-chars', label: 'NaN chars', chars: Number.NaN, budget: 100 },
    { id: 'infinite-chars', label: 'Infinite chars', chars: Number.POSITIVE_INFINITY, budget: 100 },
    { id: 'negative-chars', label: 'Negative chars', chars: -400, budget: 100 },
  ],
});
assertFiniteBudgetState(malformedUsageState, 'Malformed usage input');
assert.deepEqual(
  malformedUsageState,
  {
    totalTokens: 0,
    sections: [
      { id: 'nan-token', label: 'NaN token', used: 0, ratio: null, severity: 'info' },
      { id: 'infinite-token', label: 'Infinite token', used: 0, ratio: null, severity: 'info' },
      { id: 'negative-token', label: 'Negative token', used: 0, ratio: null, severity: 'info' },
      { id: 'nan-chars', label: 'NaN chars', used: 0, ratio: null, severity: 'info' },
      { id: 'infinite-chars', label: 'Infinite chars', used: 0, ratio: null, severity: 'info' },
      { id: 'negative-chars', label: 'Negative chars', used: 0, ratio: null, severity: 'info' },
    ],
    offenders: [],
    status: 'ok',
  },
  'Malformed section usage should not leak non-finite or negative budget values',
);

const malformedBudgetState = computePromptBudget({
  sections: [
    { id: 'zero', label: 'Zero budget', tokens: 10, budget: 0 },
    { id: 'negative', label: 'Negative budget', tokens: 10, budget: -10 },
    { id: 'nan', label: 'NaN budget', tokens: 10, budget: Number.NaN },
    { id: 'infinite', label: 'Infinite budget', tokens: 10, budget: Number.POSITIVE_INFINITY },
  ],
});
assertFiniteBudgetState(malformedBudgetState, 'Malformed budget input');
assert.deepEqual(
  malformedBudgetState.sections.map(({ id, used, ratio, severity }) => ({ id, used, ratio, severity })),
  [
    { id: 'zero', used: 10, ratio: null, severity: 'info' },
    { id: 'negative', used: 10, ratio: null, severity: 'info' },
    { id: 'nan', used: 10, ratio: null, severity: 'info' },
    { id: 'infinite', used: 10, ratio: null, severity: 'info' },
  ],
  'Malformed section budgets should be treated as unavailable budget metadata',
);

assert.deepEqual(
  computePromptBudget({
    warnRatio: Number.NaN,
    overRatio: -1,
    charsPerToken: 0,
    sections: [{ id: 's', label: 'S', chars: 200, budget: 100 }],
  }),
  {
    totalTokens: 50,
    sections: [{ id: 's', label: 'S', used: 50, ratio: 0.5, severity: 'ok' }],
    offenders: [],
    status: 'ok',
  },
  'Malformed budget knobs should fall back to stable defaults',
);

assert.equal(
  computePromptBudget({
    warnRatio: 1.2,
    overRatio: 0.8,
    sections: [{ id: 's', label: 'S', tokens: 90, budget: 100 }],
  }).sections[0].severity,
  'warn',
  'Reversed threshold knobs should fall back to the default warn/over ordering',
);

const microscopeSource = readFileSync('src/components/PromptMicroscope.tsx', 'utf8');
assert.ok(
  microscopeSource.includes('computePromptBudget({'),
  'Prompt Microscope should compute structural section budget flags',
);
assert.ok(
  microscopeSource.includes('pm-budget-flags'),
  'Prompt Microscope should render a compact budget flag rollup',
);
assert.ok(
  microscopeSource.includes('promptBudget.offenders.slice(0, 3)'),
  'Prompt Microscope should cap visible budget offenders',
);

console.log('Prompt section budget checks passed.');
