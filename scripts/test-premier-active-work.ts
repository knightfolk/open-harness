import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  PHASE_PREFIX,
  buildActiveWorkState,
  buildRunTree,
  getActiveWorkState,
} from '../src/utils/agentWorkState';
import type { HarnessRun, SubAgent } from '../src/types';

function agent(partial: Partial<SubAgent> & Pick<SubAgent, 'id'>): SubAgent {
  return {
    id: partial.id,
    name: partial.name || partial.id,
    model: partial.model || 'qwen3-coder',
    status: partial.status || 'running',
    task: partial.task || 'Implement the kickoff slice',
    startTime: partial.startTime || new Date('2026-06-17T00:00:00.000Z'),
    ...partial,
  };
}

const runTrace = {
  id: 'run-1',
  sessionId: 'session-1',
  userMessageId: 'message-1',
  role: 'coder',
  requestedModel: 'Auto',
  effectiveModel: 'qwen3-coder',
  providerId: 'openrouter',
  status: 'running',
  startedAt: '2026-06-17T00:00:00.000Z',
  context: { tokensUsed: 0, budget: 0, compressedCount: 0, summarized: false },
  steps: [
    { type: 'orchestration', label: 'execute mode', mode: 'execute' },
    { type: 'orchestration', label: 'plan' },
    { type: 'orchestration', label: 'implement' },
    { type: 'orchestration', label: 'verify' },
    {
      type: 'worktree_isolation',
      status: 'ready',
      agent: 'implementer',
      reason: 'Execute-mode implementation writes and validation are scoped to an isolated git worktree.',
      worktreeId: 'wt-123',
      path: '/tmp/openharness-worktree',
      branch: 'openharness/wt-123',
      baseRef: 'main',
    },
  ],
} as unknown as HarnessRun;

const run = agent({
  id: 'run-1',
  name: 'Execution run',
  status: 'running',
  task: 'Ship the Premier slice',
  runTrace,
});
const planPhase = agent({
  id: `run-1${PHASE_PREFIX}plan`,
  name: 'Plan phase',
  status: 'complete',
  task: 'Plan the slice',
  startTime: new Date('2026-06-17T00:01:00.000Z'),
});
const implementPhase = agent({
  id: `run-1${PHASE_PREFIX}implement`,
  name: 'Implement phase',
  status: 'running',
  task: 'Implement the active-work gate',
  startTime: new Date('2026-06-17T00:02:00.000Z'),
});
const unrelatedPhase = agent({
  id: `other-run${PHASE_PREFIX}review`,
  name: 'Other review',
  status: 'running',
  task: 'Should not attach to run-1',
  startTime: new Date('2026-06-17T00:03:00.000Z'),
});

const tree = buildRunTree([unrelatedPhase, implementPhase, run, planPhase]);
assert.equal(tree.length, 1, 'run tree should only include root runs as top-level items');
assert.equal(tree[0].run.id, 'run-1', 'run tree should preserve the owning run');
assert.deepEqual(tree[0].phases.map((phase) => phase.id), [planPhase.id, implementPhase.id], 'run tree should nest only matching phase agents under the owning run in start-time order');

const activeWork = buildActiveWorkState([run, planPhase, implementPhase, unrelatedPhase]);
assert.ok(activeWork, 'active work should be derived from a running run with phases');
assert.equal(activeWork.workflowLabel, 'Execution flow', 'execute-mode runs should be labelled as execution flow');
assert.equal(activeWork.currentTask, 'Implement the active-work gate', 'active work should show the running phase task before the root run task');
assert.equal(activeWork.modelProvider, 'qwen3-coder / openrouter', 'active work should expose model/provider from run trace');
assert.equal(activeWork.latestArtifact, 'isolated worktree: wt-123', 'active work should surface isolated worktree proof before artifact proof');
assert.deepEqual(
  activeWork.steps.map((step) => `${step.label}:${step.status}`),
  ['Plan:completed', 'Implement:in_progress'],
  'active work should summarize phase status without fake percentage progress',
);
assert.equal(getActiveWorkState([run, planPhase, implementPhase])?.workflowLabel, 'Execution flow', 'legacy helper should route to the same active-work state');
assert.equal(buildActiveWorkState([{ ...run, status: 'complete' }]), null, 'completed root runs without active phases should not keep noisy active-work chrome');

const chatPanel = readFileSync('src/components/ChatPanel.tsx', 'utf-8');
const sidebar = readFileSync('src/components/Sidebar.tsx', 'utf-8');
const environmentRail = readFileSync('src/components/EnvironmentRail.tsx', 'utf-8');
const agentWorkState = readFileSync('src/utils/agentWorkState.ts', 'utf-8');

for (const expected of [
  'activeWorkState && (',
  '<ActiveWorkStrip',
  'state={activeWorkState}',
  'onOpenDetails={onFocusAgents}',
  'role="status" aria-live="polite"',
  'aria-label={`${state.workflowLabel} active work progress`}',
  'role="list" aria-label={`${state.workflowLabel} steps`}',
  'aria-current={step.status === \'in_progress\' ? \'step\' : undefined}',
  '<span className="active-work-strip-action">Agent detail</span>',
]) {
  assert.ok(
    chatPanel.includes(expected),
    `Chat active-work strip should remain a compact status entry point: ${expected}`,
  );
}

for (const expected of [
  'function SubAgentRow',
  'phaseAccessibleLabel',
  'const runAccessibleLabel = [',
  '`Focus ${normalizeRunLabel(run)}`',
  '`status ${statusText}`',
  'run.task ? `task ${run.task}` : null',
  'run.model ? `model ${run.model}` : null',
  'run.runTrace?.providerId ? `provider ${run.runTrace.providerId}` : null',
  '`elapsed ${formatAgentDuration(run.startTime)}`',
  '`Focus ${label || agent.name}`',
  '`status ${formatRunStatus(agent.status)}`',
  'agent.task ? `task ${agent.task}` : null',
  'agent.runTrace?.providerId ? `provider ${agent.runTrace.providerId}` : null',
  'agent.model ? `model ${agent.model}` : null',
  'latestRunArtifactCue(agent)',
  'aria-label={`Focus ${label || agent.name} in Agent detail`}',
  'sub-agent-attention',
]) {
  assert.ok(
    sidebar.includes(expected),
    `Sidebar active-work rows should expose status, task, model/provider, attention, and focus cues: ${expected}`,
  );
}

for (const expected of [
  'activeWorkState ? <span className="env-change-count">{activeWorkState.workflowLabel}</span> : null',
  'className="env-workflow"',
  'role="status" aria-live="polite"',
  'aria-label={`${activeWorkState.workflowLabel} active work progress`}',
  'activeWorkState.currentTask && <span role="group" aria-label={`Current task: ${activeWorkState.currentTask}`}>{activeWorkState.currentTask}</span>',
  'activeWorkState.modelProvider && <span role="group" aria-label={`Model and provider: ${activeWorkState.modelProvider}`}>{activeWorkState.modelProvider}</span>',
  'activeWorkState.latestArtifact && <span role="group" aria-label={`Latest proof or artifact: ${activeWorkState.latestArtifact}`}>{activeWorkState.latestArtifact}</span>',
  'role="list" aria-label={`${activeWorkState.workflowLabel} steps`}',
  'aria-current={step.status === \'in_progress\' ? \'step\' : undefined}',
  'Agent detail',
]) {
  assert.ok(
    environmentRail.includes(expected),
    `Environment rail should mirror active-work status without becoming a second chat: ${expected}`,
  );
}

for (const expected of [
  'export const DEFAULT_WORKFLOW_STEPS',
  'export const PLANNING_WORKFLOW_STEPS',
  'orchestrationPhaseLabels(run)',
  'phaseAgentLabels(phases)',
  "orchestrationMode === 'plan'",
  "orchestrationMode === 'execute'",
  "status: 'blocked'",
  "status: 'error'",
  'latestArtifact: latestArtifactCue',
  "step.type === 'worktree_isolation'",
  'isolated worktree:',
  'worktree isolation ${isolationStep.status}',
]) {
  assert.ok(
    agentWorkState.includes(expected),
    `Agent work state should stay trace-backed and status-specific: ${expected}`,
  );
}

console.log('Premier active-work checks passed.');
