import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf-8')) as { scripts: Record<string, string> };
const checklist = readFileSync('docs/PREMIER_HARNESS_PROOF_CHECKLIST.md', 'utf-8');
const nextSession = readFileSync('NEXT_SESSION.md', 'utf-8');
const proof = readFileSync('docs/proof/2026-06-16-premier-harness-closeout.md', 'utf-8');

assert.ok(
  pkg.scripts['test:premier-no-spend']?.includes('npm run test:premier-approval-boundaries'),
  'Premier no-spend bundle should include the approval-boundaries guard',
);

for (const expected of [
  'Provider-backed proof run approval needed.',
  'Please approve one option:',
  'Approve smallest proof runs only.',
  'Approve eval proof plus same-model prompt strategy comparison.',
  'Approve eval proof only.',
  'Approve bench proof only.',
  'Do not run provider-backed proof yet.',
  'Same-model prompt strategy comparison: [yes/no], matrix: [prompts] x [models] x [strategies]',
  'Runtime trace/export artifacts: [yes/no], paths: [Planning Room / execute-or-investigate / steering event]',
  'Provider-spend proof, after approval:',
]) {
  assert.ok(
    checklist.includes(expected),
    `Proof checklist should preserve provider-spend approval boundary: ${expected}`,
  );
}

for (const expected of [
  'Browser/manual proof pass approval needed.',
  'Final closeout gates need approval before running local validation.',
  'Provider-backed Model Lab strategy comparisons still require',
  'explicit budget approval',
  'durable proof artifacts directly',
  'durable screenshot or DOM-note artifact paths',
  'durable runtime trace/export paths',
  'durable gate log/artifact paths',
  'Same-model prompt strategy comparison optional, 1 prompt x 1 model x 2 strategies',
  'Run premier no-spend check and save durable gate logs.',
  'Run browser/manual proof pass and save durable screenshot/DOM-note artifacts.',
  'Treat stale, indirect, ambiguous, or partial evidence as not complete',
]) {
  assert.ok(
    nextSession.includes(expected),
    `NEXT_SESSION should preserve approval/final-gate boundary: ${expected}`,
  );
}

for (const expected of [
  'provider-approved prompt trace and same-model prompt-strategy comparison remain pending',
  'Same-model prompt strategy comparison: proposed smallest 1 prompt x 1 model x',
  'Durable screenshot or DOM-note artifact path recorded for desktop and',
  'with durable runtime trace/export paths for Planning Room, execute/investigate,',
  'Save durable gate log/artifact paths for each command that runs.',
  'live active-run proof remains pending',
  'Validation was not rerun in this slice',
  'No server restart was required',
]) {
  assert.ok(
    proof.includes(expected),
    `Closeout proof should preserve incomplete-proof language: ${expected}`,
  );
}

console.log('Premier approval-boundary checks passed.');
