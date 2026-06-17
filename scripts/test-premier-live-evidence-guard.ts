import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf-8')) as { scripts: Record<string, string> };
const kickoff = readFileSync('docs/PREMIER_HARNESS_KICKOFF.md', 'utf-8');
const checklist = readFileSync('docs/PREMIER_HARNESS_PROOF_CHECKLIST.md', 'utf-8');
const proof = readFileSync('docs/proof/2026-06-16-premier-harness-closeout.md', 'utf-8');
const nextSession = readFileSync('NEXT_SESSION.md', 'utf-8');

assert.ok(
  pkg.scripts['test:premier-no-spend']?.includes('npm run test:premier-live-evidence-guard'),
  'Premier no-spend bundle should include the live-evidence guard',
);

for (const expected of [
  'If any checklist item is missing or only indirectly proven, keep the',
  'overhaul open.',
]) {
  assert.ok(
    kickoff.includes(expected),
    `Kickoff should preserve no-indirect-closeout guard: ${expected}`,
  );
}

for (const expected of [
  'Direct evidence is required for closeout',
  'Indirect evidence does not close an item.',
  'Stale evidence must be refreshed',
  'Provider-Spend Guard',
  'Provider-backed proof run approval needed.',
  'Provider-spend proof, after approval:',
  'Passing the no-provider baseline is not closeout by itself',
  'current manual/browser evidence, runtime scenario proof, provider-backed',
  'Runtime Scenario Proof',
  'Final Gates',
]) {
  assert.ok(
    checklist.includes(expected),
    `Proof checklist should preserve live/provider evidence boundary: ${expected}`,
  );
}

for (const expected of [
  'provider-approved prompt trace and same-model prompt-strategy comparison remain pending',
  'saved local sessions currently do not contain populated real-world failure-memory/recovery-pattern rows',
  'live active-run proof remains pending',
  'recording and next-phase use of a steering note remain pending',
  'live reduced-transparency/reduced-motion browser proof remains pending',
]) {
  assert.ok(
    proof.includes(expected),
    `Closeout proof should preserve explicit live-evidence gap: ${expected}`,
  );
}

for (const expected of [
  'Remaining Phase 7 proof gap',
  'Provider-backed Model Lab strategy comparisons still require',
  'explicit budget approval',
  'Treat stale, indirect, ambiguous, or partial evidence as not complete',
  'Browser/manual proof pass approval needed.',
  'Final closeout gates need approval before running local validation.',
]) {
  assert.ok(
    nextSession.includes(expected),
    `NEXT_SESSION should preserve future-session proof guard: ${expected}`,
  );
}

console.log('Premier live-evidence guard checks passed.');
