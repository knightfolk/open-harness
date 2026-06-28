import { strict as assert } from 'node:assert';
import { deriveNextActions } from '../src/utils/runSignals';
import type { HarnessRun, Message, WorkProductArtifact } from '../src/types';

const validationArtifact: WorkProductArtifact = {
  id: 'validation-proof-1',
  type: 'validation_proof',
  title: 'Validation proof',
  createdAt: '2026-06-26T12:00:00.000Z',
  summary: 'lint and build passed',
  data: {
    workspace: '/Users/kevink/Projects/OpenHarness',
    sessionId: 'session-1',
    capturedAt: '2026-06-26T12:00:00.000Z',
    commands: [
      { id: 'lint', command: 'npm run lint', status: 'passed' },
      { id: 'build', command: 'npm run build', status: 'passed' },
    ],
    rawMarkdown: 'Validation passed.',
  },
};

const failedValidationArtifact: WorkProductArtifact = {
  id: 'validation-proof-failed-1',
  type: 'validation_proof',
  title: 'Validation proof',
  createdAt: '2026-06-26T12:05:00.000Z',
  summary: 'lint failed',
  data: {
    workspace: '/Users/kevink/Projects/OpenHarness',
    sessionId: 'session-1',
    capturedAt: '2026-06-26T12:05:00.000Z',
    commands: [
      {
        id: 'lint',
        command: 'npm run lint',
        status: 'failed',
        exitCode: 1,
        outputTail: 'src/App.tsx:12:5 lint failed because no-unused-vars tripped',
      },
    ],
    rawMarkdown: 'Validation failed.',
  },
};

function run(overrides: Partial<HarnessRun> = {}): HarnessRun {
  return {
    id: 'run-handoff',
    sessionId: 'session-1',
    userMessageId: 'message-user-1',
    role: 'coder',
    requestedModel: 'Auto',
    effectiveModel: 'local:MiniMax-M3',
    providerId: 'local',
    status: 'complete',
    startedAt: '2026-06-26T11:59:00.000Z',
    completedAt: '2026-06-26T12:00:00.000Z',
    context: { tokensUsed: 1200, budget: 8000, compressedCount: 0, summarized: false },
    steps: [
      { type: 'route', role: 'coder', model: 'local:MiniMax-M3', reason: 'execute request with proof' },
      { type: 'artifact', artifact: validationArtifact },
      { type: 'final_answer', chars: 220 },
    ],
    ...overrides,
  };
}

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: 'assistant-message-1',
    role: 'assistant',
    content: 'Implemented the slice. Validation: lint and build passed. Remaining risk: browser refresh needed.',
    timestamp: new Date('2026-06-26T12:00:00.000Z'),
    status: 'complete',
    runTrace: run(),
    ...overrides,
  };
}

const projectProfile = {
  validation: {
    lint: 'npm run lint',
    build: 'npm run build',
  },
};

const unvalidatedExecuteRun = run({
  steps: [
    { type: 'orchestration', mode: 'execute', label: 'Execute', detail: 'implementation run' },
    { type: 'tool_call', id: 'edit-1', name: 'write_file', input: { path: 'src/App.tsx' }, status: 'complete' },
    { type: 'final_answer', chars: 220 },
  ],
});

const validationActions = deriveNextActions(message({
  content: 'Implemented the slice. Build and lint still need to be run before this is treated as shipped.',
  runTrace: unvalidatedExecuteRun,
}), projectProfile);
const runValidationAction = validationActions.find((action) => action.id === 'run-validation');

assert.ok(runValidationAction, 'completed execute runs without validation proof should suggest a semantic Run validation action');
assert.equal(runValidationAction?.label, 'Run validation');
assert.equal(runValidationAction?.action, 'run-command');
assert.equal(runValidationAction?.payload, 'npm run lint && npm run build');
assert.equal(runValidationAction?.priority, 48);
assert.equal(
  validationActions.some((action) => action.id === 'run-build' || action.id === 'run-lint' || action.id === 'run-test'),
  false,
  'Run validation should suppress duplicate keyword build/test/lint chips for the same unvalidated execute run',
);

const failedValidationRun = run({
  steps: [
    { type: 'orchestration', mode: 'execute', label: 'Execute', detail: 'implementation run' },
    { type: 'artifact', artifact: failedValidationArtifact },
    { type: 'final_answer', chars: 240 },
  ],
});
const failedValidationActions = deriveNextActions(message({
  content: 'Implemented the slice. Lint failed; build still needs to be run after the fix.',
  runTrace: failedValidationRun,
}), projectProfile);
const fixValidationAction = failedValidationActions.find((action) => action.id === 'fix-validation-failure');

assert.ok(fixValidationAction, 'completed execute runs with failed validation proof should suggest a structural fix action');
assert.equal(fixValidationAction?.label, 'Fix validation failure');
assert.equal(fixValidationAction?.action, 'send-message');
assert.equal(fixValidationAction?.priority, 49);
assert.match(fixValidationAction?.payload || '', /Fix the failed validation from this OpenHarness run/i);
assert.match(fixValidationAction?.payload || '', /Run id: run-handoff/i);
assert.match(fixValidationAction?.payload || '', /Route and model: coder via local:MiniMax-M3 \(local\)/i);
assert.match(fixValidationAction?.payload || '', /npm run lint/i);
assert.match(fixValidationAction?.payload || '', /status: failed/i);
assert.match(fixValidationAction?.payload || '', /exit code: 1/i);
assert.match(fixValidationAction?.payload || '', /no-unused-vars tripped/i);
assert.match(fixValidationAction?.payload || '', /Do not claim the failure is fixed until validation has been rerun/i);
assert.equal(
  failedValidationActions.some((action) => action.id === 'run-validation'),
  false,
  'failed validation proof should replace Run validation instead of rerunning the same failed command',
);
assert.equal(
  failedValidationActions.some((action) => action.id === 'run-lint'),
  false,
  'failed validation proof should suppress duplicate keyword chips for the same failed command',
);
assert.equal(
  failedValidationActions.some((action) => action.id === 'run-build'),
  true,
  'failed validation proof should preserve distinct validation chips whose command did not fail',
);

assert.equal(
  deriveNextActions(message({
    runTrace: run({
      steps: [
        { type: 'orchestration', mode: 'execute', label: 'Execute' },
        {
          type: 'artifact',
          artifact: {
            ...failedValidationArtifact,
            data: {
              ...failedValidationArtifact.data,
              commands: [{ id: 'lint', command: 'npm run lint', status: 'passed', exitCode: 0 }],
            },
          },
        },
        { type: 'final_answer', chars: 220 },
      ],
    }),
  }), projectProfile).some((action) => action.id === 'fix-validation-failure'),
  false,
  'passed validation proof should not suggest Fix validation failure',
);

assert.match(
  deriveNextActions(message({
    runTrace: run({
      steps: [
        { type: 'orchestration', mode: 'execute', label: 'Execute' },
        {
          type: 'artifact',
          artifact: {
            ...failedValidationArtifact,
            data: {
              ...failedValidationArtifact.data,
              commands: [{ id: 'lint', command: 'npm run lint', status: 'failed', exitCode: 1 }],
            },
          },
        },
        { type: 'final_answer', chars: 220 },
      ],
    }),
  }), projectProfile).find((action) => action.id === 'fix-validation-failure')?.payload || '',
  /output tail: unavailable/,
  'failed validation proof without an output tail should degrade gracefully',
);

assert.equal(
  deriveNextActions(message(), projectProfile).some((action) => action.id === 'run-validation'),
  false,
  'completed runs with passed validation proof artifacts should not suggest Run validation again',
);

assert.equal(
  deriveNextActions(message({
    runTrace: run({
      steps: [
        { type: 'orchestration', mode: 'investigate', label: 'Investigate' },
        { type: 'tool_call', id: 'read-1', name: 'read_file', input: 'src/App.tsx', status: 'complete' },
        { type: 'final_answer', chars: 220 },
      ],
    }),
  }), projectProfile).some((action) => action.id === 'run-validation'),
  false,
  'non-execute runs should not suggest Run validation',
);

assert.equal(
  deriveNextActions(message({
    status: 'streaming',
    runTrace: run({
      status: 'running',
      steps: [
        { type: 'orchestration', mode: 'execute', label: 'Execute' },
        { type: 'tool_call', id: 'edit-1', name: 'write_file', input: { path: 'src/App.tsx' }, status: 'complete' },
      ],
    }),
  }), projectProfile).some((action) => action.id === 'run-validation'),
  false,
  'streaming or no-final-answer execute runs should not suggest Run validation yet',
);

assert.equal(
  deriveNextActions(message({
    content: 'Implemented the slice. Build and lint still need to be run.',
    runTrace: unvalidatedExecuteRun,
  })).some((action) => action.id === 'run-validation'),
  false,
  'Run validation should not appear without deterministic project validation commands',
);

const actions = deriveNextActions(message());
const handoffAction = actions.find((action) => action.id === 'create-handoff-note');

assert.ok(handoffAction, 'completed assistant runs with artifacts and final answers should suggest a companion handoff note');
assert.equal(handoffAction?.label, 'Create handoff note');
assert.equal(handoffAction?.action, 'send-message');
assert.equal(handoffAction?.priority, 47);
assert.match(handoffAction?.payload || '', /Create a concise companion note for this OpenHarness run/i);
assert.match(handoffAction?.payload || '', /Route and model: coder via local:MiniMax-M3 \(local\)/i);
assert.match(handoffAction?.payload || '', /Artifacts\/proof: Validation proof \(validation_proof\)/i);
assert.match(handoffAction?.payload || '', /Validation status: validation proof captured/i);
assert.match(handoffAction?.payload || '', /residual risks/i);
assert.match(handoffAction?.payload || '', /next safe step/i);
assert.match(handoffAction?.payload || '', /Do not claim unverified work/i);

const promptPluginActions = deriveNextActions(message({
  content: [
    'Implemented prompt plugin routing polish.',
    'The new prompt strategy variant adds stronger reviewer instructions and keeps project rules intact.',
    'Validation: prompt-routing tests passed.',
  ].join(' '),
}));
const draftPromptPluginAction = promptPluginActions.find((action) => action.id === 'draft-prompt-plugin');

assert.ok(draftPromptPluginAction, 'prompt/plugin-focused completed answers should suggest drafting a reusable prompt plugin');
assert.equal(draftPromptPluginAction?.label, 'Draft prompt plugin');
assert.equal(draftPromptPluginAction?.action, 'send-message');
assert.equal(draftPromptPluginAction?.priority, 46);
assert.match(draftPromptPluginAction?.payload || '', /Draft a reusable OpenHarness prompt plugin/i);
assert.match(draftPromptPluginAction?.payload || '', /Do not save files, enable plugin injection, or change prompt plugin settings/i);
assert.match(draftPromptPluginAction?.payload || '', /Suggested manifest fields/i);
assert.match(draftPromptPluginAction?.payload || '', /Route and model: coder via local:MiniMax-M3 \(local\)/i);
assert.match(draftPromptPluginAction?.payload || '', /Implemented prompt plugin routing polish/i);

assert.equal(
  deriveNextActions(message({
    content: 'Implemented the UI slice. Validation: lint and build passed. Remaining risk: browser refresh needed.',
  })).some((action) => action.id === 'draft-prompt-plugin'),
  false,
  'generic completed answers should not show the prompt-plugin draft action',
);

assert.equal(
  deriveNextActions(message({ runTrace: run({ steps: [{ type: 'final_answer', chars: 220 }] }) }))
    .some((action) => action.id === 'create-handoff-note'),
  false,
  'handoff note action should stay hidden when no artifacts or proof were captured',
);

assert.equal(
  deriveNextActions(message({ runTrace: run({ steps: [{ type: 'artifact', artifact: validationArtifact }] }) }))
    .some((action) => action.id === 'create-handoff-note'),
  false,
  'handoff note action should stay hidden when the run has not captured a final answer',
);

assert.equal(
  deriveNextActions(message({ role: 'user' }))
    .some((action) => action.id === 'create-handoff-note'),
  false,
  'handoff note action should only be derived for assistant messages',
);

const packageSource = await import('node:fs').then((fs) => fs.readFileSync('package.json', 'utf8'));
const nextBestActionsSource = await import('node:fs').then((fs) => fs.readFileSync('src/components/NextBestActions.tsx', 'utf8'));
assert.ok(packageSource.includes('test:run-signals-next-actions'), 'package.json should expose the run-signals next-actions test');
assert.ok(
  nextBestActionsSource.includes("case 'send-message':"),
  'Draft prompt plugin should reuse the existing send-message action path instead of adding a fake persistence handler',
);
assert.ok(
  !nextBestActionsSource.includes('draft-prompt-plugin'),
  'Draft prompt plugin should not add a bespoke save/create handler until a real persistence endpoint exists',
);

console.log('Run-signal next action checks passed.');
