import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { buildPromptMicroscopeTraceIndex } from '../src/utils/promptMicroscopeSections';
import type { HarnessRun, RoutingStageTrace } from '../src/types';

const routeMode: NonNullable<NonNullable<NonNullable<HarnessRun['steps'][number] & { type: 'prompt_built' }>['assembly']>['routeMode']> = {
  requested: 'manual',
  applied: 'compare',
  fallback: false,
  reason: 'User requested compare.',
};

const signal: NonNullable<RoutingStageTrace['signal']> = {
  hasImages: false,
  turns: 3,
  toolCount: 5,
  estimatedInputTokens: 1800,
};

const throwingToolInput = {
  toJSON() {
    throw new Error('must not stringify tool input while collapsed');
  },
};

const throwingCandidateScores = new Proxy({} as Record<string, number>, {
  ownKeys() {
    throw new Error('must not inspect candidate scores while collapsed indexing');
  },
  get() {
    throw new Error('must not read candidate scores while collapsed indexing');
  },
});

const runTrace: HarnessRun = {
  id: 'run-trace-index',
  sessionId: 'session-trace-index',
  userMessageId: 'message-trace-index',
  role: 'reviewer',
  requestedModel: 'auto',
  effectiveModel: 'openrouter:qwen3-coder',
  providerId: 'openrouter',
  status: 'complete',
  startedAt: new Date(0).toISOString(),
  context: {
    tokensUsed: 0,
    budget: 0,
    compressedCount: 0,
    summarized: false,
  },
  steps: [
    {
      type: 'route',
      role: 'reviewer',
      model: 'openrouter:qwen3-coder',
      reason: 'Review language.',
      stages: { heuristic: { mode: 'investigate', role: 'reviewer', complexity: 'medium' }, signal },
    },
    {
      type: 'prompt_built',
      promptPreview: 'prompt preview',
      toolCount: 5,
      assembly: {
        modelId: 'openrouter:qwen3-coder',
        family: 'qwen',
        style: 'xml-tagged',
        target: 'system',
        routeMode,
        sections: [
          {
            id: 'identity',
            label: 'Identity',
            source: 'project',
            tokenEstimate: 5,
            included: true,
            reason: 'Project identity',
            redacted: false,
            preview: 'identity',
          },
          {
            id: 'secret',
            label: 'Secret',
            source: 'runtime',
            tokenEstimate: 4,
            included: true,
            reason: 'Secret redaction proof',
            redacted: true,
            preview: '[redacted]',
          },
        ],
        totalTokenEstimate: 9,
      },
    },
    {
      type: 'auto_router',
      modelId: 'openrouter:qwen3-coder',
      score: 0.91,
      reason: 'Best coding-review fit.',
      cached: false,
      fallback: false,
      classifierModel: 'deepseek-v4-flash',
      candidateScores: throwingCandidateScores,
      stages: {
        heuristic: { mode: 'investigate', role: 'reviewer', complexity: 'medium' },
        policy: 'Classifier selected reviewer model.',
        modelSelectionPolicy: 'classifier',
        signal,
      },
    },
    { type: 'model_request', round: 1, model: 'openrouter:qwen3-coder' },
    { type: 'model_text', chars: 42 },
    { type: 'model_text', chars: 58 },
    { type: 'final_answer', chars: 120 },
    {
      type: 'tool_call',
      id: 'tool-1',
      name: 'read_file',
      input: throwingToolInput,
      status: 'complete',
    },
    {
      type: 'worktree_isolation',
      status: 'ready',
      agent: 'planner',
      reason: 'First worktree event.',
      path: '/tmp/first',
    },
    {
      type: 'worktree_isolation',
      status: 'preserved',
      agent: 'planner',
      reason: 'Latest worktree event.',
      path: '/tmp/latest',
    },
    {
      type: 'orchestration',
      mode: 'compare',
      label: 'Compare',
      detail: 'Compare two candidate answers.',
    },
    { type: 'error', message: 'Retryable provider warning' },
  ],
};

let stringifyCalls = 0;
const originalStringify = JSON.stringify;
JSON.stringify = ((value: unknown, replacer?: Parameters<typeof JSON.stringify>[1], space?: Parameters<typeof JSON.stringify>[2]) => {
  stringifyCalls += 1;
  return originalStringify(value, replacer, space);
}) as typeof JSON.stringify;

try {
  const collapsedIndex = buildPromptMicroscopeTraceIndex(runTrace, false);

  assert.ok(collapsedIndex, 'Trace index should exist for a run trace');
  assert.deepEqual(collapsedIndex.sections, [], 'Collapsed trace index should not build preview sections');
  assert.equal(stringifyCalls, 0, 'Collapsed trace index should not stringify tool inputs');
  assert.equal(collapsedIndex.routeStep?.role, 'reviewer');
  assert.equal(collapsedIndex.promptStep?.toolCount, 5);
  assert.equal(collapsedIndex.outputStyle, undefined);
  assert.equal(collapsedIndex.routeMode?.applied, 'compare');
  assert.equal(collapsedIndex.autoRouterStep?.modelId, 'openrouter:qwen3-coder');
  assert.equal(collapsedIndex.orchestrationStep?.mode, 'compare');
  assert.equal(collapsedIndex.errorSteps.length, 1);
  assert.equal(collapsedIndex.modelRequests.length, 1);
  assert.equal(collapsedIndex.toolCalls.length, 1);
  assert.equal(collapsedIndex.worktreeIsolation?.path, '/tmp/latest');
  assert.deepEqual(
    collapsedIndex.resultSummary,
    {
      modelTextChunkCount: 2,
      modelTextChars: 100,
      finalAnswerChars: 120,
    },
    'Trace index should derive compact run-result evidence without requiring expanded prompt sections',
  );
  assert.deepEqual(
    collapsedIndex.collapsedSummary?.items.map((item) => item.value),
    ['compare', 'openrouter:qwen3-coder', '0.91', 'Classifier decision', '2 sections', '9 tokens', '1 redacted section', '1 error'],
    'Trace index should preserve collapsed summary evidence',
  );
} finally {
  JSON.stringify = originalStringify;
}

const expandedIndex = buildPromptMicroscopeTraceIndex(
  {
    ...runTrace,
    steps: runTrace.steps.map((step) => (
      step.type === 'tool_call'
        ? { ...step, input: { path: 'src/App.tsx' } }
        : step.type === 'auto_router'
          ? { ...step, candidateScores: { 'openrouter:qwen3-coder': 0.91, 'openrouter:deepseek-v4': 0.87 } }
          : step
    )),
  },
  true,
);

assert.ok(expandedIndex, 'Expanded trace index should exist');
assert.ok(expandedIndex.sections.some((section) => section.id === 'modeltext:42'), 'Expanded trace index should keep model-output sections');
assert.ok(expandedIndex.sections.some((section) => section.id === 'final:120'), 'Expanded trace index should keep final-answer sections');
assert.ok(expandedIndex.sections.some((section) => section.id === 'toolcall:tool-1'), 'Expanded trace index should build tool preview sections');
assert.equal(
  expandedIndex.sections.find((section) => section.id === 'toolcall:tool-1')?.text,
  '{"path":"src/App.tsx"}',
  'Expanded trace index should keep the existing tool-call preview behavior',
);

const promptMicroscopeSource = readFileSync('src/components/PromptMicroscope.tsx', 'utf8');
const promptMicroscopeSectionsSource = readFileSync('src/utils/promptMicroscopeSections.ts', 'utf8');
const source = `${promptMicroscopeSource}\n${promptMicroscopeSectionsSource}`;
assert.ok(
  promptMicroscopeSource.includes('buildPromptMicroscopeTraceIndex(runTrace, expanded)'),
  'Prompt Microscope should build one trace index for shared route/prompt evidence',
);
assert.ok(
  !/runTrace\.steps\.(find|filter|slice)/.test(promptMicroscopeSource),
  'Prompt Microscope should consume the trace index instead of directly re-scanning runTrace.steps',
);
for (const expectedSource of [
  'interface PromptMicroscopeResultSummary',
  'resultSummary?: PromptMicroscopeResultSummary',
  'function buildPromptMicroscopeResultSummary({',
  'let resultSummaryModelTextChunkCount = 0',
  'resultSummaryModelTextChunkCount += 1',
  'resultSummaryModelTextChars += step.chars',
  'resultSummaryFinalAnswerChars += step.chars',
  'const resultSummary = buildPromptMicroscopeResultSummary({',
  'resultSummary,',
  '<span>Run result</span>',
  'Final answer chars',
  'Model output chars',
  'Model output chunks',
]) {
  assert.ok(source.includes(expectedSource), `Prompt Microscope run-result evidence should include source marker: ${expectedSource}`);
}

const duplicateRun: HarnessRun = {
  ...runTrace,
  steps: [
    {
      type: 'route',
      role: 'first-route',
      model: 'model:first-route',
    },
    {
      type: 'route',
      role: 'second-route',
      model: 'model:second-route',
    },
    {
      type: 'prompt_built',
      promptPreview: 'first prompt',
      toolCount: 1,
      assembly: {
        modelId: 'model:first-prompt',
        family: 'qwen',
        style: 'xml-tagged',
        target: 'system',
        routeMode: {
          requested: 'first',
          applied: 'first-applied',
          fallback: false,
          reason: 'First prompt.',
        },
        sections: [],
        totalTokenEstimate: 0,
      },
    },
    {
      type: 'prompt_built',
      promptPreview: 'second prompt',
      toolCount: 2,
      assembly: {
        modelId: 'model:second-prompt',
        family: 'qwen',
        style: 'xml-tagged',
        target: 'system',
        routeMode: {
          requested: 'second',
          applied: 'second-applied',
          fallback: false,
          reason: 'Second prompt.',
        },
        sections: [],
        totalTokenEstimate: 0,
      },
    },
    {
      type: 'auto_router',
      modelId: 'model:first-auto',
      score: 0.51,
      reason: 'First auto-router step.',
      cached: false,
      fallback: false,
      classifierModel: 'classifier',
    },
    {
      type: 'auto_router',
      modelId: 'model:second-auto',
      score: 0.88,
      reason: 'Second auto-router step.',
      cached: true,
      fallback: false,
      classifierModel: 'classifier',
    },
    {
      type: 'orchestration',
      mode: 'direct',
      label: 'First orchestration',
    },
    {
      type: 'orchestration',
      mode: 'execute',
      label: 'Second orchestration',
    },
    {
      type: 'worktree_isolation',
      status: 'ready',
      agent: 'first',
      reason: 'First isolation.',
      path: '/tmp/first-worktree',
    },
    {
      type: 'worktree_isolation',
      status: 'preserved',
      agent: 'second',
      reason: 'Second isolation.',
      path: '/tmp/second-worktree',
    },
  ],
};

const duplicateIndex = buildPromptMicroscopeTraceIndex(duplicateRun, false);

assert.ok(duplicateIndex, 'Duplicate trace index should exist');
assert.equal(duplicateIndex.routeStep?.role, 'first-route', 'Trace index should preserve first route-step display semantics');
assert.equal(duplicateIndex.promptStep?.toolCount, 1, 'Trace index should preserve first prompt-step display semantics');
assert.equal(duplicateIndex.routeMode?.applied, 'first-applied', 'Expanded route-mode details should follow first prompt-step display semantics');
assert.equal(duplicateIndex.autoRouterStep?.modelId, 'model:first-auto', 'Trace index should preserve first auto-router display semantics');
assert.equal(duplicateIndex.orchestrationStep?.mode, 'direct', 'Trace index should preserve first orchestration display semantics');
assert.equal(duplicateIndex.worktreeIsolation?.path, '/tmp/second-worktree', 'Trace index should preserve latest worktree-isolation display semantics');
assert.deepEqual(
  duplicateIndex.collapsedSummary?.items.map((item) => item.value),
  ['second-applied', 'model:second-auto', '0.88', 'Cached classifier decision'],
  'Collapsed summary should continue to use the latest prompt and auto-router summary evidence',
);
