import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import type { HarnessRunStep, WorkProductArtifact } from '../src/types';
import { buildSubAgentReplaySummary } from '../src/utils/subAgentReplaySummary';

const validationArtifact: WorkProductArtifact = {
  id: 'proof-1',
  type: 'validation_proof',
  title: 'Focused checks',
  createdAt: '2026-06-26T12:00:00.000Z',
  summary: 'lint and build passed',
  data: {
    workspace: '/Users/kevink/Projects/OpenHarness',
    sessionId: 'session-sub-agent-replay',
    capturedAt: '2026-06-26T12:00:00.000Z',
    commands: [],
    rawMarkdown: 'lint and build passed',
  },
};

const steps: HarnessRunStep[] = [
  { type: 'context_pack', pack: 'selected', files: ['src/App.tsx', 'src/components/SubAgentTracker.tsx'], tokens: 900, reasons: { ui: 'focused panel' }, suggestion: 'Inspect tracker' },
  { type: 'repo_map', tokenBudget: 3000, totalFiles: 24, truncated: false, topFiles: ['src/components/SubAgentTracker.tsx', 'src/utils/agentWorkState.ts'] },
  { type: 'tool_call', id: 'tool-running', name: 'exec_command', input: { command: 'npm run lint' }, status: 'running' },
  { type: 'tool_call', id: 'tool-complete', name: 'read_file', input: { path: 'src/App.tsx' }, status: 'complete', durationMs: 32, outputPreview: 'content' },
  { type: 'tool_call', id: 'tool-error', name: 'exec_command', input: { command: 'npm test' }, status: 'error', durationMs: 19, error: 'failed' },
  { type: 'tool_call', id: 'tool-skipped', name: 'exec_command', input: { command: 'npm run optional' }, status: 'skipped' },
  { type: 'artifact', artifact: validationArtifact },
  { type: 'worktree_isolation', status: 'ready', agent: 'coder', reason: 'isolated implementation', worktreeId: 'wt-1' },
  { type: 'steering', action: 'request-proof', target: 'agent', source: 'user', createdAt: '2026-06-26T12:01:00.000Z' },
  {
    type: 'model_request',
    round: 2,
    model: 'qwen3-coder',
    phasePlan: {
      timeoutMs: 847_000,
      primaryModel: 'qwen3-coder',
      fallbackModels: ['glm-5.2'],
      plannedRetryCount: 2,
      plannedBackoffMs: [2_000, 5_000],
    },
  },
  { type: 'final_answer', chars: 700 },
  { type: 'error', message: 'Tool retry budget exhausted' },
];

assert.deepEqual(
  buildSubAgentReplaySummary([]),
  {
    totalEvents: 0,
    artifacts: 0,
    validationProofs: 0,
    contextFiles: 0,
    readyWorktreeIsolations: 0,
    toolCalls: 0,
    runningToolCalls: 0,
    steeringEvents: 0,
    modelRequests: 0,
    errors: 0,
    hasFinalAnswer: false,
    latestProof: 'Waiting for proof.',
    phaseDeadline: '',
  },
  'empty replay summaries should return zeroed defaults',
);

assert.deepEqual(
  buildSubAgentReplaySummary(steps),
  {
    totalEvents: 12,
    artifacts: 1,
    validationProofs: 1,
    contextFiles: 3,
    readyWorktreeIsolations: 1,
    toolCalls: 4,
    runningToolCalls: 1,
    steeringEvents: 1,
    modelRequests: 1,
    errors: 2,
    hasFinalAnswer: true,
    latestProof: 'Tool retry budget exhausted',
    phaseDeadline: 'Phase deadline 847s · primary qwen3-coder · 1 fallback · up to 2 retries · backoff 2s, 5s',
  },
  'sub-agent replay summaries should count trace errors, running tools, proof, context, and latest proof in one pass',
);

const trackerSource = readFileSync('src/components/SubAgentTracker.tsx', 'utf8');
assert.ok(
  trackerSource.includes('buildSubAgentReplaySummary(steps)'),
  'SubAgentTracker should use the shared replay summary selector',
);
assert.ok(
  trackerSource.includes('subAgentReplaySummary.errors'),
  'SubAgentTracker should surface trace-level error counts in the summary grid',
);
assert.ok(
  trackerSource.includes('subAgentReplaySummary.runningToolCalls'),
  'SubAgentTracker should surface running tool counts in the summary grid',
);
assert.ok(
  trackerSource.includes('subAgentReplaySummary.phaseDeadline'),
  'SubAgentTracker should surface the planned phase deadline in the summary strip',
);

console.log('Sub-agent replay summary checks passed.');
