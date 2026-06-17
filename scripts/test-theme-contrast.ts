import { strict as assert } from 'node:assert';
import { validateBuiltins } from '../src/theme/builtins';

const violations = validateBuiltins().filter((entry) => entry.violations.length > 0);

assert.deepEqual(
  violations,
  [],
  'built-in themes should not emit contrast regressions'
);

console.log('Theme contrast checks passed.');
