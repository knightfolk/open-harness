import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const agentFocusPanel = readFileSync('src/components/AgentFocusPanel.tsx', 'utf-8');
const subAgentTracker = readFileSync('src/components/SubAgentTracker.tsx', 'utf-8');
const subAgentReplaySummary = readFileSync('src/utils/subAgentReplaySummary.ts', 'utf-8');
const appShell = readFileSync('src/App.tsx', 'utf-8');

for (const expected of [
  'className="agent-focus-shell"',
  'role="region"',
  'aria-label="Right-hand Agent detail pane"',
  '<AgentFocusPanel',
  'onRunSteer={handleRunSteer}',
]) {
  assert.ok(
    appShell.includes(expected),
    `App shell should expose Agent detail as a named right-hand inspector region: ${expected}`,
  );
}

for (const expected of [
  "const SubAgentTracker = lazy(() => import('./SubAgentTracker')",
  'role="complementary" aria-label="Agent detail inspector"',
  'aria-label="Close Agent detail"',
  '<span>Agent detail</span>',
  'role="status"',
  'aria-live="polite"',
  'aria-label={`Agent run summary:',
  'role="list" aria-label="Agent detail list"',
  'aria-current={isActive ? \'true\' : undefined}',
  'aria-label={agentLabel}',
  'aria-label={`Selected agent detail:',
  '<Suspense fallback={<div className="empty-state">Loading agent detail...</div>}>',
  'onRunSteer={onRunSteer}',
]) {
  assert.ok(
    agentFocusPanel.includes(expected),
    `AgentFocusPanel should preserve right-hand inspector semantics: ${expected}`,
  );
}

for (const expected of [
  'function WorkFlowStrip({ state }: { state: ActiveWorkState })',
  'role="group" aria-label={`${state.workflowLabel} workflow progress`}',
  'role="list" aria-label={`${state.workflowLabel} steps`}',
  'aria-current={step.status === \'in_progress\' ? \'step\' : undefined}',
  'function visibleRunSteps(steps: HarnessRunStep[]): HarnessRunStep[]',
  'compactToolBundle(toolSteps)',
  'function RunReplaySummary({ steps }: { steps: HarnessRunStep[] })',
  'className="sub-agent-summary"',
  'aria-label={`Harness run summary:',
  'Run replay summary:',
  'isolated worktrees',
  'Latest proof',
  'buildSubAgentReplaySummary(steps)',
  'subAgentReplaySummary.latestProof',
  'subAgentReplaySummary.errors',
  'subAgentReplaySummary.runningToolCalls',
]) {
  assert.ok(
    subAgentTracker.includes(expected),
    `SubAgentTracker should preserve trace-backed workflow/replay detail: ${expected}`,
  );
}

for (const expected of [
  'function promptBuiltReplayDetail(step: Extract<HarnessRunStep, { type: \'prompt_built\' }>): string | null',
  'case \'prompt_built\': return promptBuiltReplayDetail(step)',
  'step.promptPreviewRedacted',
  'Prompt preview unavailable',
]) {
  assert.ok(
    subAgentTracker.includes(expected),
    `SubAgentTracker should default Agent detail prompt previews to redacted replay text: ${expected}`,
  );
}
assert.ok(
  !subAgentTracker.includes("case 'prompt_built': return step.promptPreview;"),
  'SubAgentTracker Agent detail should not render the raw prompt preview directly',
);

for (const expected of [
  "const steeringActions: Array<{ action: RunSteeringAction; label: string }>",
  "{ action: 'flag-assumption', label: 'Flag assumption' }",
  "{ action: 'redirect', label: 'Redirect' }",
  "{ action: 'pause', label: 'Pause run' }",
  "{ action: 'cancel', label: 'Cancel run' }",
  "{ action: 'request-proof', label: 'Request proof' }",
  "{ action: 'approve-artifact', label: 'Approve artifact' }",
  "{ action: 'needs-revision', label: 'Needs revision' }",
  'const target = agent.id.includes(\':phase:\') ? \'agent\' : \'orchestrator\'',
  'onRunSteer(agent.runTrace.id, action, target, note)',
  'onRunSteer(agent.runTrace.id, action, target)',
  'aria-label={`${canSteer ? \'Steering controls\' : \'Steering history\'} for ${agent.name}`}',
  'aria-label={`Available steering actions for ${agent.name}`}',
  'aria-label={`Steering note for ${agent.name}`}',
  'aria-describedby={steeringDescriptionIds}',
  'aria-label={`Add steering note for ${agent.name}`}',
  'Steering actions are shown only while work is active; use the replay filters below to inspect proof, routing, artifact feedback, and past steering events.',
]) {
  assert.ok(
    subAgentTracker.includes(expected),
    `SubAgentTracker should preserve structured steering controls in the inspector: ${expected}`,
  );
}

for (const expected of [
  "type ReplayFilter = 'all' | 'proof' | 'files' | 'tools' | 'routing' | 'steering' | 'errors'",
  "{ id: 'proof', label: 'Proof' }",
  "{ id: 'tools', label: 'Tools' }",
  "{ id: 'routing', label: 'Routing' }",
  "{ id: 'steering', label: 'Steering' }",
  "{ id: 'errors', label: 'Errors' }",
  'function stepMatchesReplayFilter',
  "step.type === 'worktree_isolation'",
  "if (filter === 'steering') return step.type === 'steering'",
  'role="list" aria-label={`Replay events for ${agent.name}`}',
  'role="group" aria-label={`Replay filters for ${agent.name}`}',
  'aria-pressed={replayFilter === filter.id}',
  'aria-label={`Show ${filterCount} ${filter.label.toLowerCase()} replay event',
  'role="listitem" aria-label={`${stepTitle(step)}${detail ? `. ${detail}` : \'\'}',
]) {
  assert.ok(
    subAgentTracker.includes(expected),
    `SubAgentTracker should preserve replay filters and event inspection: ${expected}`,
  );
}

for (const expected of [
  "case 'worktree_isolation': return Package",
  'Worktree isolation ready',
  'Worktree isolation ${step.status}',
]) {
  assert.ok(
    subAgentTracker.includes(expected),
    `SubAgentTracker should expose worktree isolation proof in Agent detail replay: ${expected}`,
  );
}

for (const expected of [
  'Worktree isolation ready for ${proofStep.agent}',
  'isolated worktree',
]) {
  assert.ok(
    subAgentReplaySummary.includes(expected),
    `SubAgent replay summary helper should preserve latest worktree proof text: ${expected}`,
  );
}

const checklist = readFileSync('docs/PREMIER_HARNESS_PROOF_CHECKLIST.md', 'utf-8');
for (const expected of [
  'completed, blocked, or inactive Agent detail runs do not',
  'show unsafe live steering controls',
  'replay filters available for',
]) {
  assert.ok(
    checklist.includes(expected),
    `Proof checklist should preserve inactive-run Agent detail steering boundary: ${expected}`,
  );
}

console.log('Premier agent-detail checks passed.');
