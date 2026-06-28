import { strict as assert } from 'node:assert';
import { getCollapsedMicroscopeSummary } from '../src/utils/promptMicroscopeSections';
import { getPromptMicroscopeSections } from '../src/utils/promptMicroscopeSections';
import type { HarnessRun, RoutingStageTrace } from '../src/types';
import { readFileSync } from 'node:fs';

function makeRun(input: unknown): HarnessRun {
  return {
    id: 'run-lazy-proof',
    sessionId: 'session-lazy-proof',
    userMessageId: 'message-lazy-proof',
    role: 'coder',
    requestedModel: 'local:test',
    effectiveModel: 'local:test',
    providerId: 'test-provider',
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
        type: 'tool_call',
        id: 'tool-1',
        name: 'read_file',
        input,
      },
    ],
  };
}

let stringifyCalls = 0;
const originalStringify = JSON.stringify;
JSON.stringify = ((value: unknown, replacer?: Parameters<typeof JSON.stringify>[1], space?: Parameters<typeof JSON.stringify>[2]) => {
  stringifyCalls += 1;
  return originalStringify(value, replacer, space);
}) as typeof JSON.stringify;

try {
  const throwingInput = {
    toJSON() {
      throw new Error('must not stringify while collapsed');
    },
  };

  const collapsedSections = getPromptMicroscopeSections(makeRun(throwingInput), false);

  assert.deepEqual(
    collapsedSections,
    [],
    'Prompt Microscope should build no preview sections while collapsed',
  );
  assert.equal(
    stringifyCalls,
    0,
    'Prompt Microscope should not stringify tool inputs while collapsed',
  );
} finally {
  JSON.stringify = originalStringify;
}

const expandedSections = getPromptMicroscopeSections(makeRun({ path: 'src/App.tsx' }), true);

assert.equal(
  expandedSections.length,
  1,
  'Prompt Microscope should build tool-call preview sections when expanded',
);
assert.equal(expandedSections[0].id, 'toolcall:tool-1');
assert.equal(expandedSections[0].label, 'Tool call: read_file');
assert.equal(expandedSections[0].text, '{"path":"src/App.tsx"}');

const unserializableExpandedSections = getPromptMicroscopeSections(
  makeRun({
    toJSON() {
      throw new Error('stringify failed');
    },
  }),
  true,
);

assert.equal(
  unserializableExpandedSections[0].text,
  '(unserializable input)',
  'Prompt Microscope should show a stable placeholder for unserializable tool input',
);

const undefinedExpandedSections = getPromptMicroscopeSections(makeRun(undefined), true);

assert.equal(
  undefinedExpandedSections[0].text,
  '(unserializable input)',
  'Prompt Microscope should show a stable placeholder when tool input cannot stringify to text',
);

const routeMode: NonNullable<NonNullable<NonNullable<HarnessRun['steps'][number] & { type: 'prompt_built' }>['assembly']>['routeMode']> = {
  requested: 'legacy-mode',
  applied: 'execute',
  fallback: true,
  reason: 'Unsupported requested mode; using execute.',
};
const signal: NonNullable<RoutingStageTrace['signal']> = {
  hasImages: false,
  turns: 4,
  toolCount: 9,
  estimatedInputTokens: 2048,
};
const throwingCandidateScores = new Proxy({} as Record<string, number>, {
  ownKeys() {
    throw new Error('must not inspect candidate scores while collapsed');
  },
  get() {
    throw new Error('must not read candidate scores while collapsed');
  },
});

const collapsedRun: HarnessRun = {
  id: 'run-collapsed-summary',
  sessionId: 'session-collapsed-summary',
  userMessageId: 'message-collapsed-summary',
  role: 'coder',
  requestedModel: 'auto',
  effectiveModel: 'xai:grok-3',
  providerId: 'xai',
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
      type: 'prompt_built',
      promptPreview: 'system prompt preview',
      toolCount: 9,
      assembly: {
        modelId: 'xai:grok-3',
        family: 'grok',
        style: 'structured',
        target: 'system',
        routeMode,
        sections: [
          {
            id: 'identity',
            label: 'Identity',
            source: 'project',
            tokenEstimate: 8,
            included: true,
            reason: 'Project rule',
            redacted: false,
            get preview(): string {
              throw new Error('must not read prompt section preview while collapsed');
            },
          },
          {
            id: 'secret',
            label: 'Secret',
            source: 'project',
            tokenEstimate: 3,
            included: true,
            reason: 'Secret redaction proof',
            redacted: true,
            get preview(): string {
              throw new Error('must not read prompt section preview while collapsed');
            },
          },
        ],
        totalTokenEstimate: 11,
      },
    },
    {
      type: 'auto_router',
      modelId: 'xai:grok-3',
      score: 0.84,
      reason: 'Selected by classifier.',
      cached: true,
      fallback: false,
      classifierModel: 'local:classifier',
      candidateScores: throwingCandidateScores,
      stages: {
        heuristic: { mode: 'execute', role: 'coder', complexity: 'medium' },
        policy: 'Classifier route selected a capable model.',
        modelSelectionPolicy: 'classifier',
        signal,
      },
    },
    {
      type: 'route',
      role: 'coder',
      model: 'local:fallback',
      reason: 'Heuristic fallback.',
      stages: {
        heuristic: { mode: 'execute', role: 'coder', complexity: 'medium' },
        signal,
      },
    },
    { type: 'error', message: 'Provider retryable error' },
  ],
};

const collapsedSummary = getCollapsedMicroscopeSummary(collapsedRun);

assert.ok(collapsedSummary, 'Collapsed microscope summary should exist when run trace has routing evidence');
assert.deepEqual(
  collapsedSummary.items.map((item) => item.value),
  ['execute', 'xai:grok-3', '0.84', 'Cached classifier decision', '2 sections', '11 tokens', '1 redacted section', '1 error'],
  'Collapsed summary should expose applied route mode, selected model, score, decision, prompt size, redacted section count, and error count',
);
assert.match(
  collapsedSummary.ariaLabel,
  /execute.*xai:grok-3.*0\.84.*Cached classifier decision.*2 sections.*11 tokens.*1 redacted section.*1 error/i,
  'Collapsed summary aria label should include the same at-a-glance evidence without requiring expansion',
);
assert.ok(
  !collapsedSummary.items.some((item) => item.value === 'legacy-mode'),
  'Collapsed summary should use applied route mode instead of requested route mode',
);

const normalResultSummary = getCollapsedMicroscopeSummary({
  ...collapsedRun,
  steps: [
    ...collapsedRun.steps.filter((step) => step.type !== 'error'),
    { type: 'model_text', chars: 80 },
    { type: 'model_text', chars: 40 },
    { type: 'final_answer', chars: 120 },
  ],
});

assert.ok(normalResultSummary, 'Collapsed summary should exist for normal result evidence');
assert.ok(
  !normalResultSummary.items.some((item) => item.value.startsWith('result:')),
  'Collapsed summary should not add a visible result chip for normal runs',
);
assert.match(
  normalResultSummary.ariaLabel,
  /Result: 120 chars, 2 chunks/i,
  'Collapsed summary aria label should include compact result evidence without adding chip clutter',
);

const emptyResultSummary = getCollapsedMicroscopeSummary({
  ...collapsedRun,
  steps: [
    ...collapsedRun.steps.filter((step) => step.type !== 'error'),
    { type: 'model_text', chars: 80 },
    { type: 'final_answer', chars: 0 },
  ],
});

assert.ok(emptyResultSummary, 'Collapsed summary should exist for empty result evidence');
assert.deepEqual(
  emptyResultSummary.items.filter((item) => item.label === 'Result').map((item) => [item.value, item.tone]),
  [['result: empty', 'warning']],
  'Collapsed summary should show a warning result chip when a run produced no final answer and no error chip',
);

const erroredEmptyResultSummary = getCollapsedMicroscopeSummary({
  ...collapsedRun,
  steps: [
    ...collapsedRun.steps,
    { type: 'model_text', chars: 80 },
    { type: 'final_answer', chars: 0 },
  ],
});

assert.ok(erroredEmptyResultSummary, 'Collapsed summary should exist for errored empty result evidence');
assert.ok(
  !erroredEmptyResultSummary.items.some((item) => item.value === 'result: empty'),
  'Collapsed summary should suppress the empty-result chip when an error chip already explains the failure',
);
assert.match(
  erroredEmptyResultSummary.ariaLabel,
  /Result: 0 chars, 1 chunk/i,
  'Collapsed summary aria label should still include empty-result evidence when an error chip is visible',
);

const shortResultSummary = getCollapsedMicroscopeSummary({
  ...collapsedRun,
  steps: [
    ...collapsedRun.steps.filter((step) => step.type !== 'error'),
    { type: 'model_text', chars: 1000 },
    { type: 'final_answer', chars: 20 },
  ],
});

assert.ok(shortResultSummary, 'Collapsed summary should exist for short result evidence');
assert.deepEqual(
  shortResultSummary.items.filter((item) => item.label === 'Result').map((item) => [item.value, item.tone]),
  [['result: short', 'warning']],
  'Collapsed summary should flag suspiciously short final answers against streamed model output',
);

const promptMicroscopeSource = readFileSync('src/components/PromptMicroscope.tsx', 'utf8');
const promptMicroscopeSectionsSource = readFileSync('src/utils/promptMicroscopeSections.ts', 'utf8');
assert.ok(
  promptMicroscopeSource.includes('buildPromptMicroscopeTraceIndex(runTrace, expanded)'),
  'Prompt Microscope should build one shared trace index',
);
assert.ok(
  promptMicroscopeSource.includes('traceIndex?.collapsedSummary'),
  'Prompt Microscope should use the trace index collapsed summary',
);
assert.ok(
  promptMicroscopeSource.includes('pm-toggle-summary'),
  'Prompt Microscope should render collapsed summary chips in the toggle',
);
assert.ok(
  promptMicroscopeSource.includes('toggleAriaLabel'),
  'Prompt Microscope should derive the toggle aria-label from collapsed summary evidence',
);
assert.ok(
  promptMicroscopeSource.includes('${collapsedSummary.ariaLabel}'),
  'Prompt Microscope toggle aria-label should include selected model, decision, redactions, and errors',
);
for (const expectedSource of [
  'const EMPTY_PROMPT_SECTION_ESTIMATE_LOOKUP',
  'const EMPTY_PROMPT_SECTION_FILTER_COUNTS',
  'const EMPTY_PROMPT_COST_SUMMARY',
  'const EMPTY_PROMPT_ESTIMATE_SUMMARY',
  'const EMPTY_PROMPT_BUDGET',
  'const estimateById = useMemo(() => (expanded ? buildPromptSectionEstimateLookup(estimates) : EMPTY_PROMPT_SECTION_ESTIMATE_LOOKUP)',
  'const sectionFilterCounts = useMemo(() => (expanded ? buildPromptSectionFilterCounts(sections, estimates) : EMPTY_PROMPT_SECTION_FILTER_COUNTS)',
  'const visibleSections = useMemo(() => (expanded',
  'filterPromptMicroscopeSections(sections, estimates, sectionFilter, sectionQuery, redactionOn)',
  'const promptCostSummary = useMemo(() => (expanded',
  'buildPromptCostSummary({',
  'const promptEstimateSummary = useMemo(() => (expanded',
  'buildPromptEstimateSummary({',
  'const promptBudget = useMemo(() => (expanded',
  'computePromptBudget({',
  "const modelRequestTimeoutDetail = expanded ? modelRequests.map(formatModelRequestTimeoutDetail).find(Boolean) || '' : '';",
]) {
  assert.ok(promptMicroscopeSource.includes(expectedSource), `Collapsed Prompt Microscope should keep expanded-only work gated: ${expectedSource}`);
}
for (const expectedSource of [
  'RESULT_SHORT_RATIO_THRESHOLD',
  'buildCollapsedResultSummaryItem(',
  'result: empty',
  'result: short',
  'resultSummary:',
  'Result:',
]) {
  assert.ok(promptMicroscopeSectionsSource.includes(expectedSource), `Collapsed result summary should include source marker: ${expectedSource}`);
}

const heuristicOnlyRun: HarnessRun = {
  ...collapsedRun,
  steps: [
    {
      type: 'route',
      role: 'reviewer',
      model: 'local:reviewer',
      reason: 'Review request.',
      stages: {
        heuristic: { mode: 'investigate', role: 'reviewer', complexity: 'simple' },
      },
    },
  ],
};

const heuristicSummary = getCollapsedMicroscopeSummary(heuristicOnlyRun);

assert.ok(heuristicSummary, 'Collapsed summary should fall back to heuristic route evidence');
assert.deepEqual(
  heuristicSummary.items.map((item) => item.value),
  ['reviewer', 'local:reviewer'],
  'Collapsed summary should fall back to heuristic role/model when auto-router and applied route mode are absent',
);

console.log('Prompt Microscope collapsed laziness checks passed.');
