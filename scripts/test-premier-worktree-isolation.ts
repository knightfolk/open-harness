import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf-8')) as { scripts: Record<string, string> };
const kickoff = readFileSync('docs/PREMIER_HARNESS_KICKOFF.md', 'utf-8');
const checklist = readFileSync('docs/PREMIER_HARNESS_PROOF_CHECKLIST.md', 'utf-8');
const proof = readFileSync('docs/proof/2026-06-16-premier-harness-closeout.md', 'utf-8');
const nextSession = readFileSync('NEXT_SESSION.md', 'utf-8');
const orchestrator = readFileSync('server/orchestrator.ts', 'utf-8');
const runTrace = readFileSync('server/runTrace.ts', 'utf-8');
const clientTypes = readFileSync('src/types/index.ts', 'utf-8');
const subAgentTracker = readFileSync('src/components/SubAgentTracker.tsx', 'utf-8');
const agentWorkState = readFileSync('src/utils/agentWorkState.ts', 'utf-8');
const app = readFileSync('src/App.tsx', 'utf-8');
const serverIndex = readFileSync('server/index.ts', 'utf-8');
const promptMicroscope = readFileSync('src/components/PromptMicroscope.tsx', 'utf-8');
const safetyPanel = readFileSync('src/components/SafetyPanel.tsx', 'utf-8');

assert.ok(
  pkg.scripts['test:premier-no-spend']?.includes('npm run test:premier-worktree-isolation'),
  'Premier no-spend bundle should include the worktree-isolation guard',
);

for (const expected of [
  'worktree isolation per implementation agent before any multi-agent write flow',
  'Open-source and frontier models should be first-class peers',
  'provider choice, open-source model support, local',
]) {
  assert.ok(
    kickoff.includes(expected),
    `Kickoff should preserve implementation-agent isolation/product requirement: ${expected}`,
  );
}

for (const expected of [
  "import { createWorktree, refreshWorktreeState, removeWorktree, type Worktree } from './worktrees';",
  'let implementationWorktree: Worktree | null = null;',
  'implementationWorkingDir = implementationWorktree.path;',
  "type: 'worktree_isolation'",
  'workingDir: implementationWorkingDir',
  'tryApplyAndValidateExecute(implArtifact?.response || \'\', config, implementationWorkingDir',
  'Implementation ran in isolated worktree',
  'Promote or discard from Safety when ready.',
  'const refreshedWorktree = refreshWorktreeState(implementationWorktree);',
  'if (refreshedWorktree.clean)',
  'removeWorktree(workingDir, refreshedWorktree.id, { force: true })',
  'was auto-discarded',
  'remains available in Safety > Worktrees for Validate, Promote, or Discard',
  "status: removed ? 'auto_discarded' : 'failed'",
  "status: 'preserved'",
]) {
  assert.ok(
    orchestrator.includes(expected),
    `Execute orchestration should create and use isolated implementer worktrees: ${expected}`,
  );
}

for (const source of [runTrace, clientTypes]) {
  for (const expected of [
    "type: 'worktree_isolation'",
    "status: 'ready' | 'preserved' | 'auto_discarded' | 'unavailable' | 'failed'",
    'worktreeId?: string',
    'baseRef?: string',
  ]) {
    assert.ok(
      source.includes(expected),
      `Run trace types should expose worktree isolation evidence: ${expected}`,
    );
  }
}

for (const expected of [
  'Worktree isolation ready',
  'Worktree preserved for Safety',
  'Clean worktree auto-discarded',
  'Worktree isolation ${step.status}',
  'isolated worktrees',
  'Open Safety > Worktrees to validate, promote, or discard this isolated worktree.',
  "step.type === 'worktree_isolation'",
]) {
  assert.ok(
    subAgentTracker.includes(expected),
    `Agent detail should render worktree isolation evidence: ${expected}`,
  );
}

for (const expected of [
  "step.type === 'worktree_isolation'",
  'isolated worktree:',
  'worktree preserved:',
  'clean worktree auto-discarded:',
  'worktree isolation ${isolationStep.status}',
  'latestArtifact: latestArtifactCue',
]) {
  assert.ok(
    agentWorkState.includes(expected),
    `Active work should surface worktree isolation cue: ${expected}`,
  );
}

for (const expected of [
  'Worktree isolation ready for ${step.agent}',
  'Worktree preserved for Safety review for ${step.agent}',
  'Clean worktree auto-discarded for ${step.agent}',
  'Worktree isolation ${step.status} for ${step.agent}',
  "step.type === 'worktree_isolation'",
]) {
  assert.ok(
    app.includes(expected),
    `App live run state should describe worktree isolation events: ${expected}`,
  );
}

for (const expected of [
  'const worktreeIsolation = steps.filter',
  'routeDecision: routeSteps',
  'worktreeIsolation',
  'Worktree isolation ready',
  'Worktree preserved for Safety review',
  'Clean worktree auto-discarded',
  'Worktree isolation ${step.status}',
]) {
  assert.ok(
    serverIndex.includes(expected),
    `Server replay/debug surfaces should preserve worktree isolation evidence: ${expected}`,
  );
}

for (const expected of [
  "step.type === 'worktree_isolation'",
  'runTrace.steps.slice().reverse().find',
  'Worktree isolation',
  'ready · ${worktreeIsolation.worktreeId',
  'preserved · ${worktreeIsolation.worktreeId',
  'auto-discarded · ${worktreeIsolation.worktreeId',
  'Safety > Worktrees',
]) {
  assert.ok(
    promptMicroscope.includes(expected),
    `Prompt Microscope should expose worktree isolation metadata: ${expected}`,
  );
}

for (const expected of [
  'Validate, promote, or discard isolated changes from here.',
  'Show diff vs base',
  'aria-label={`Show diff for isolated worktree ${shortId}: ${worktreeLabel}`}',
  'Run project validation commands inside this isolated worktree',
  'Merge worktree branch into its base',
  'id: <code title={wt.id}>{shortId}</code>',
  'const shortId = wt.id.slice(0, 8)',
  'aria-label={`Validate isolated worktree ${shortId}: ${worktreeLabel}`}',
  'aria-label={`Promote isolated worktree ${shortId}: ${worktreeLabel}`}',
  'aria-label={`${wt.clean ? \'Discard\' : \'Force-discard\'} isolated worktree ${shortId}: ${worktreeLabel}`}',
  'Discard isolated worktree',
  'Force-discard isolated worktree with uncommitted changes',
  'Discard',
]) {
  assert.ok(
    safetyPanel.includes(expected),
    `Safety worktree controls should make validate/promote/discard explicit: ${expected}`,
  );
}

for (const expected of [
  'Phase 6 model harness trust',
  'Model routing and evaluation are visible enough to trust.',
  'worktree isolation',
]) {
  assert.ok(
    checklist.includes(expected),
    `Proof checklist should preserve worktree-isolation closeout coverage: ${expected}`,
  );
}

for (const expected of [
  'worktree isolation',
  'multi-agent write flow',
  'remaining',
]) {
  assert.ok(
    proof.includes(expected),
    `Closeout proof should preserve worktree-isolation evidence/gap language: ${expected}`,
  );
}

for (const expected of [
  'worktree isolation',
  'multi-agent write flow',
  'Premier worktree-isolation regression',
]) {
  assert.ok(
    nextSession.includes(expected),
    `NEXT_SESSION should preserve worktree-isolation handoff language: ${expected}`,
  );
}

console.log('Premier worktree-isolation checks passed.');
