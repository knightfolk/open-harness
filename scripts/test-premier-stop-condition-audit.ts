import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const kickoff = readFileSync('docs/PREMIER_HARNESS_KICKOFF.md', 'utf-8');
const checklist = readFileSync('docs/PREMIER_HARNESS_PROOF_CHECKLIST.md', 'utf-8');
const proof = readFileSync('docs/proof/2026-06-16-premier-harness-closeout.md', 'utf-8');
const nextSession = readFileSync('NEXT_SESSION.md', 'utf-8');

const stopConditions = [
  'Default UI is chat-first, flat, and non-draggable.',
  'Active agents are visible under the owning thread.',
  'Clicking an agent opens right-hand detail.',
  'The user can flag or steer bad agent direction.',
  'Chat no longer shows every diagnostic surface by default.',
  'Theme textures are subtle, bounded, and accessible.',
  'Model routing and evaluation are visible enough to trust.',
  'Prompt response strategy is model-specific, traceable, testable, and backed by',
  'OpenHarness can explain which model/tool/prompt-strategy combinations failed,',
  'Auto-Router candidate-card evidence includes saved session/run breadcrumbs',
  'Settings Auto-Router candidate rows expose the same saved session/run',
  'tool, prompt strategy, saved session/run id, retry distance, and later working',
  'Lint/build pass.',
  'Server/runtime changes have been relaunched and reachability verified.',
  'Runtime relaunch does not leave duplicate OpenHarness/Electron windows.',
];

for (const condition of stopConditions) {
  assert.ok(
    kickoff.includes(condition),
    `Kickoff should preserve stop condition: ${condition}`,
  );
  assert.ok(
    proof.includes(condition),
    `Closeout proof audit should preserve stop condition row/evidence: ${condition}`,
  );
}

for (const expected of [
  'Phase-mapped review matrix',
  'Phase 1 chat-first shell',
  'Phase 2 agent work model',
  'Phase 3 detail and steering',
  'Phase 4 calm chat and artifacts',
  'Phase 5 texture accessibility',
  'Phase 6 model harness trust',
  'Phase 7 prompt strategy and routing memory',
  'Phase 7 tool-error breadcrumb evidence',
  'Premier Harness Closeout Evidence',
  'Runtime Scenario Proof',
  'Final Gates',
  'Auto-Router candidate-card breadcrumb examples',
]) {
  assert.ok(
    checklist.includes(expected),
    `Proof checklist should preserve source-of-truth closeout section: ${expected}`,
  );
}

for (const expected of [
  'live active-run proof remains pending',
  'recording and next-phase use of a steering note remain pending',
  'live reduced-transparency/reduced-motion browser proof remains pending',
  'proof-review decisions, and approved/trusted apply evidence remains pending',
  'provider-approved prompt trace and same-model prompt-strategy comparison remain pending',
  'saved local sessions currently do not contain populated real-world failure-memory/recovery-pattern rows',
  'tool-call outcome learning goal alignment',
  'pending',
]) {
  assert.ok(
    proof.includes(expected),
    `Closeout proof should keep remaining risk/gap language before goal completion: ${expected}`,
  );
}

for (const expected of [
  'Use `docs/PREMIER_HARNESS_KICKOFF.md` as the source of truth',
  'Use the checklist\'s `Premier Harness Closeout Evidence` template',
  'Treat stale, indirect, ambiguous, or partial evidence as not complete',
  'Provider-backed proof run approval needed.',
  'Final closeout gates need approval before running local validation.',
  'Browser/manual proof pass approval needed.',
  'classifier candidate-card annotations keep those session/run breadcrumb',
]) {
  assert.ok(
    nextSession.includes(expected),
    `NEXT_SESSION should preserve closeout/approval handoff guard: ${expected}`,
  );
}

console.log('Premier stop-condition audit checks passed.');
