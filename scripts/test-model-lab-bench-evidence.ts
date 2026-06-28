import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { createModelLabBenchResultIndex, getVisibleModelLabBenchResults, type BenchResultStatusFilter } from '../src/utils/modelLabBenchEvidence';
import type { BenchRunResult, BenchScores, PromptStrategyTrace } from '../src/utils/api';

function scores(overallScore: number, resolvedStatus: BenchScores['resolvedStatus'], weakestLabel: string, validationPassed: boolean): BenchScores {
  return {
    usedTools: true,
    answeredUser: true,
    referencedRealFiles: true,
    avoidedHallucinatedPaths: true,
    producedSummary: true,
    latencyMs: 1200,
    toolCount: 1,
    validationPassed,
    validationScore: validationPassed ? 2 : 0,
    styleScore: 1,
    overallScore,
    breakdown: {
      structural: overallScore,
      runtime: overallScore,
      style: overallScore,
      total: overallScore,
      weakestSignal: {
        id: weakestLabel.toLowerCase().replace(/\s+/g, '-'),
        label: weakestLabel,
        category: 'runtime',
        passed: validationPassed,
        score: validationPassed ? 1 : 0,
        maxScore: 1,
      },
      signals: [
        {
          id: weakestLabel.toLowerCase().replace(/\s+/g, '-'),
          label: weakestLabel,
          category: 'runtime',
          passed: validationPassed,
          score: validationPassed ? 1 : 0,
          maxScore: 1,
        },
      ],
    },
    resolvedStatus,
    stepCount: 2,
    tokenCount: 800,
    costEstimate: 0.002,
    assistedByFallback: false,
    rubricCoverage: {
      passedPoints: validationPassed ? 2 : 1,
      totalPoints: 2,
      ratio: validationPassed ? 1 : 0.5,
      items: [
        { id: 'proof', points: 1, passed: validationPassed, evidence: validationPassed ? 'proof passed' : 'missing proof' },
      ],
    },
  };
}

const qwenStrategy: PromptStrategyTrace = {
  id: 'qwen-xml-code-v1',
  family: 'qwen',
  systemStyle: 'xml-tagged',
  contextOrder: 'instructions-first',
  examplePolicy: 'format-only',
  reasoningPolicy: 'native',
  toolPolicy: 'native-tools',
  outputContract: 'proof-first',
  variantId: 'qwen-coder-tool-proof',
  role: 'coder',
  taskType: 'coding',
  selectionReason: 'Coding and tool-heavy work should lead with routing proof.',
  bestPractice: {
    guidance: 'Use XML-tagged task boundaries for coding and tool-heavy work.',
    rationale: 'Qwen follows structured prompt sections well.',
    evaluationCue: 'Compare first-tool success and proof structure on identical benchmark tasks.',
    sourceRef: 'official-qwen-docs',
  },
  updatedAt: '2026-06-17',
};

function benchResult(
  taskName: string,
  modelId: string,
  status: BenchRunResult['status'],
  resolvedStatus: BenchScores['resolvedStatus'],
  validationPassed: boolean,
  promptStrategy?: PromptStrategyTrace,
): BenchRunResult {
  return {
    taskId: taskName.toLowerCase().replace(/\s+/g, '-'),
    taskName,
    modelId,
    providerId: 'local',
    status,
    prompt: `Benchmark prompt for ${taskName}`,
    response: `${modelId} response for ${taskName}`,
    responseLength: 120,
    promptStrategy,
    toolCalls: [{ name: 'read_file', status: validationPassed ? 'complete' : 'error' }],
    validationResults: validationPassed ? [] : [
      {
        command: 'npm test',
        exitCode: 1,
        stdout: '',
        stderr: 'runtime proof missing',
        findings: ['runtime proof missing'],
        durationMs: 100,
        passed: false,
      },
    ],
    validationPassed,
    wallMs: 1200,
    scores: scores(validationPassed ? 8 : 4, resolvedStatus, validationPassed ? 'Style proof' : 'Runtime proof', validationPassed),
    startedAt: '2026-06-26T00:00:00.000Z',
    completedAt: '2026-06-26T00:00:01.200Z',
    error: status === 'error' ? 'provider failed' : undefined,
    traceProof: {
      mode: 'execute',
      role: 'coder',
      complexity: 'medium',
      routeSource: 'auto',
      selectedModel: modelId,
      providerId: 'local',
      modelRequests: 1,
      toolCalls: 1,
      validationChecks: validationPassed ? 1 : 0,
      assistedByFallback: false,
      summary: validationPassed ? 'trace complete' : 'trace warning: validation proof missing',
      warnings: validationPassed ? [] : ['validation proof missing'],
    },
  };
}

const rows: BenchRunResult[] = [
  benchResult('Summarize task output', 'mistral-small', 'ok', 'resolved', true),
  benchResult('Fix routing proof', 'qwen-coder', 'validation-failed', 'partial', false, qwenStrategy),
  benchResult('Review prompt regression', 'glm-reviewer', 'error', 'unresolved', false),
  benchResult('Plan route policy', 'deepseek-v4', 'ok', 'assisted', true),
];

assert.deepEqual(
  getVisibleModelLabBenchResults(rows, 10, 'qwen native-tools trace runtime', 'all').map((row) => row.modelId),
  ['qwen-coder'],
  'Bench filtering should search task, prompt strategy, trace proof, weakest signal, and tool fields',
);

assert.deepEqual(
  getVisibleModelLabBenchResults(rows, 2, '', 'all').map((row) => row.modelId),
  ['qwen-coder', 'glm-reviewer'],
  'Bench rows needing attention should be pinned before applying the visible cap',
);

assert.deepEqual(
  getVisibleModelLabBenchResults(rows, 10, '', 'attention').map((row) => row.modelId),
  ['qwen-coder', 'glm-reviewer', 'deepseek-v4'],
  'Bench attention filter should include failed, validation-failed, partial, unresolved, and assisted rows',
);

assert.deepEqual(
  getVisibleModelLabBenchResults(rows, 10, 'not-a-bench-row', 'all').map((row) => row.modelId),
  [],
  'Bench filtering should return no rows for unmatched searches',
);

const indexedBenchRows = createModelLabBenchResultIndex(rows);
for (const [query, statusFilter, maxItems] of [
  ['', 'all', 10],
  ['qwen native-tools trace runtime', 'all', 10],
  ['', 'attention', 10],
  ['routing proof', 'partial', 10],
  ['', 'all', 2],
  ['not-a-bench-row', 'all', 10],
] as Array<[string, BenchResultStatusFilter, number]>) {
  assert.deepEqual(
    indexedBenchRows.getVisibleResults(maxItems, query, statusFilter),
    getVisibleModelLabBenchResults(rows, maxItems, query, statusFilter),
    `Indexed bench result filtering should preserve legacy behavior for query "${query}" and status ${statusFilter}`,
  );
}

const cappedAttentionWindow = indexedBenchRows.getVisibleResultWindow(1, '', 'attention');
assert.deepEqual(
  cappedAttentionWindow.rows.map((row) => row.modelId),
  ['qwen-coder'],
  'Bench result windows should keep the same pinned row order under the visible cap',
);
assert.equal(cappedAttentionWindow.matchCount, 3, 'Bench result windows should count all status matches before applying the visible cap');

const zeroCapAttentionWindow = indexedBenchRows.getVisibleResultWindow(0, '', 'attention');
assert.deepEqual(zeroCapAttentionWindow.rows, [], 'A zero visible cap should return no bench rows');
assert.equal(zeroCapAttentionWindow.matchCount, 3, 'A zero visible cap should still report the full matching bench result count');

const queryStatusWindow = indexedBenchRows.getVisibleResultWindow(10, 'routing proof', 'partial');
assert.deepEqual(
  queryStatusWindow.rows.map((row) => row.modelId),
  ['qwen-coder'],
  'Bench result windows should AND text and status filters',
);
assert.equal(queryStatusWindow.matchCount, 1, 'Bench result windows should count combined query and status matches');

const emptyBenchWindow = createModelLabBenchResultIndex([]).getVisibleResultWindow(10, '', 'all');
assert.deepEqual(emptyBenchWindow.rows, [], 'Empty bench result windows should return no rows');
assert.equal(emptyBenchWindow.matchCount, 0, 'Empty bench result windows should return a zero match count');

const mutableRows = rows.slice();
const snapshottedBenchIndex = createModelLabBenchResultIndex(mutableRows);
mutableRows.push(benchResult('Late mutated task', 'late-model', 'ok', 'resolved', true));
const snapshottedWindow = snapshottedBenchIndex.getVisibleResultWindow(10, '', 'all');
assert.equal(snapshottedWindow.matchCount, rows.length, 'Existing bench result indexes should snapshot rows at creation time');
assert.equal(
  snapshottedWindow.rows.some((row) => row.modelId === 'late-model'),
  false,
  'Existing bench result indexes should not surface rows pushed after index creation',
);

let benchSearchTextBuildCount = 0;
const instrumentedBenchIndex = createModelLabBenchResultIndex(rows, {
  getSearchText: (row) => {
    benchSearchTextBuildCount += 1;
    return [
      row.taskName,
      row.modelId,
      row.status,
      row.scores.resolvedStatus,
      row.promptStrategy?.id,
      row.traceProof?.summary,
    ].filter(Boolean).join(' ');
  },
});
assert.equal(benchSearchTextBuildCount, 0, 'Model Lab bench result indexes should defer search text until a text query exists');
const zeroCapUnfilteredWindow = instrumentedBenchIndex.getVisibleResultWindow(0, '', 'all');
assert.equal(zeroCapUnfilteredWindow.matchCount, rows.length, 'Unfiltered bench windows should report total rows even with a zero cap');
instrumentedBenchIndex.getVisibleResults(2, '', 'all');
instrumentedBenchIndex.getVisibleResultWindow(10, '', 'attention');
assert.equal(benchSearchTextBuildCount, 0, 'Empty and status-only bench filters should not build unused search text');
instrumentedBenchIndex.getVisibleResults(10, 'qwen', 'all');
instrumentedBenchIndex.getVisibleResultWindow(10, 'glm-reviewer', 'attention');
instrumentedBenchIndex.getVisibleResults(2, '', 'all');
assert.equal(
  benchSearchTextBuildCount,
  rows.length,
  'Repeated Model Lab bench filters should reuse indexed search text instead of rebuilding per query',
);

const modelLabSource = readFileSync('src/components/ModelLabPanel.tsx', 'utf8');
for (const expected of [
  'const [benchResultFilter, setBenchResultFilter] = useState(\'\');',
  'const [benchResultStatusFilter, setBenchResultStatusFilter] = useState<BenchResultStatusFilter>(\'all\');',
  'const benchResultFiltersActive = benchResultFilter.trim().length > 0 || benchResultStatusFilter !== \'all\';',
  'const selectedBenchResultIndex = useMemo(',
  '() => selectedBenchRun ? createModelLabBenchResultIndex(selectedBenchRun.results) : null',
  'const visibleSelectedBenchResultWindow = useMemo(',
  'selectedBenchResultIndex ? selectedBenchResultIndex.getVisibleResultWindow(MODEL_LAB_RESULT_VISIBLE_LIMIT, benchResultFilter, benchResultStatusFilter) : { rows: [], matchCount: 0 }',
  'const visibleSelectedBenchResults = visibleSelectedBenchResultWindow.rows;',
  'const selectedBenchResultMatchCount = benchResultFiltersActive ? visibleSelectedBenchResultWindow.matchCount : selectedBenchRun?.results.length || 0;',
  'Showing {visibleSelectedBenchResults.length} of {selectedBenchResultMatchCount} bench result rows{benchResultFiltersActive ? \' that match filters\' : \'\'}.',
  'aria-label="Filter Model Lab bench result rows by task, model, status, score, strategy, trace, validation, or tool"',
  'aria-label="Clear Model Lab bench result row filters"',
  'setBenchResultFilter(\'\');',
  'setBenchResultStatusFilter(\'all\');',
  'disabled={!benchResultFiltersActive}',
  'No bench result rows match this filter.',
  'visibleSelectedBenchResults.map',
]) {
  assert.ok(
    modelLabSource.includes(expected),
    `Model Lab bench table should expose searchable capped proof rows: ${expected}`,
  );
}

const packageSource = readFileSync('package.json', 'utf8');
assert.ok(packageSource.includes('test:model-lab-bench-evidence'), 'package.json should expose the Model Lab bench evidence test');

console.log('Model Lab bench evidence checks passed.');
