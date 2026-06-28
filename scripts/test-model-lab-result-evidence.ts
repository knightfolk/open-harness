import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { createModelLabResultIndex, findModelLabEvidenceReportMatches, formatModelLabEvidenceReportMatch, formatModelLabEvidenceSearchDiagnostics, getModelLabEvidenceGate, getVisibleModelLabResults, routingDecisionToModelLabEvidenceScope, summarizeModelLabEvidenceReportSearch, summarizeModelLabEvidenceScope } from '../src/utils/modelLabResultEvidence';
import type { EvalResult, EvalScores, PromptStrategyTrace } from '../src/utils/api';

function scores(overallScore: number, weakestLabel: string, weakestPassed: boolean): EvalScores {
  return {
    usedTools: true,
    answeredUser: true,
    referencedRealFiles: true,
    avoidedHallucinatedPaths: true,
    producedSummary: true,
    latencyMs: 1200,
    toolCount: 1,
    validationPassed: weakestPassed,
    validationScore: weakestPassed ? 1 : 0,
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
        passed: weakestPassed,
        score: weakestPassed ? 1 : 0,
        maxScore: 1,
      },
      signals: [
        {
          id: weakestLabel.toLowerCase().replace(/\s+/g, '-'),
          label: weakestLabel,
          category: 'runtime',
          passed: weakestPassed,
          score: weakestPassed ? 1 : 0,
          maxScore: 1,
        },
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
  selectionReason: 'Coding and tool-heavy work should lead with proof.',
  bestPractice: {
    guidance: 'Use XML-tagged task boundaries for coding and tool-heavy work.',
    rationale: 'Qwen follows structured prompt sections well.',
    evaluationCue: 'Compare first-tool success and proof structure on identical code prompts.',
    sourceRef: 'official-qwen-docs',
  },
  updatedAt: '2026-06-17',
};

const qwenLookalikeStrategy: PromptStrategyTrace = {
  ...qwenStrategy,
  id: 'qwen-xml-code-v10',
  variantId: 'qwen-coder-tool-proof-extended',
  selectionReason: 'Lookalike strategy id should not satisfy exact evidence scopes.',
  bestPractice: {
    ...qwenStrategy.bestPractice!,
    sourceRef: 'lookalike-qwen-docs',
  },
};

function result(
  modelId: string,
  promptName: string,
  status: EvalResult['status'],
  overallScore: number,
  weakestLabel: string,
  promptStrategy?: PromptStrategyTrace,
): EvalResult {
  return {
    modelId,
    promptId: promptName.toLowerCase().replace(/\s+/g, '-'),
    promptName,
    status,
    response: `${modelId} response for ${promptName}`,
    responseLength: 120,
    promptStrategy,
    toolCallCount: 1,
    toolCalls: [{ name: 'read_file', status: status === 'ok' ? 'complete' : 'error' }],
    wallMs: 1200,
    scores: scores(overallScore, weakestLabel, status === 'ok'),
  };
}

const rows: EvalResult[] = [
  result('mistral-small', 'Summarize planning output', 'ok', 8, 'Style proof'),
  result('deepseek-v4', 'Review route policy', 'ok', 7, 'Runtime proof'),
  result('qwen-coder', 'Fix routing proof', 'ok', 9, 'Runtime proof', qwenStrategy),
  result('qwen-coder', 'Fix routing proof extended', 'ok', 6, 'Runtime proof', qwenLookalikeStrategy),
  result('qwen-coder', 'Fix routing proof without strategy', 'ok', 5, 'Runtime proof'),
  result('glm-reviewer', 'Detect prompt regression', 'error', 3, 'Tool failure'),
];

assert.deepEqual(
  getVisibleModelLabResults(rows, 10, 'qwen tool-proof runtime official-qwen-docs').map((row) => row.modelId),
  ['qwen-coder'],
  'Result filtering should search model, prompt strategy, tool policy, and weakest runtime signal fields',
);

assert.deepEqual(
  getVisibleModelLabResults(rows, 2, '').map((row) => row.modelId),
  ['glm-reviewer', 'mistral-small'],
  'Error rows should be pinned before applying the visible cap, with original order preserved inside each bucket',
);

assert.deepEqual(
  getVisibleModelLabResults(rows, 10, 'not-a-result').map((row) => row.modelId),
  [],
  'Result filtering should return no rows for unmatched searches',
);

const qwenDecisionScope = routingDecisionToModelLabEvidenceScope({
  id: 'route-qwen-1',
  selectedModel: 'qwen-coder',
  promptStrategyId: 'qwen-xml-code-v1',
  promptStrategyVariantId: 'qwen-coder-tool-proof',
  promptStrategyFamily: 'qwen',
  promptStrategyStyle: 'xml-tagged',
  modelSelectionPolicy: 'classifier',
  taskType: 'coding',
  role: 'coder',
});

assert.equal(
  qwenDecisionScope.resultFilter,
  'qwen-coder qwen-xml-code-v1 qwen-coder-tool-proof qwen xml-tagged',
  'Routing decisions should map to a Model Lab result filter made only from searchable result evidence terms',
);

assert.deepEqual(
  getVisibleModelLabResults(rows, 10, qwenDecisionScope).map((row) => `${row.modelId}:${row.promptStrategy?.id || 'none'}`),
  ['qwen-coder:qwen-xml-code-v1'],
  'Routing decision evidence scopes should exact-match model and prompt strategy without widening to lookalike or strategy-less rows',
);

const resultWindowIndex = createModelLabResultIndex(rows);
for (const [query, maxItems] of [
  ['', 10],
  ['qwen tool-proof runtime official-qwen-docs', 10],
  ['not-a-result', 10],
  ['', 2],
  [qwenDecisionScope, 10],
] as Array<[string | typeof qwenDecisionScope, number]>) {
  assert.deepEqual(
    resultWindowIndex.getVisibleResults(maxItems, query),
    getVisibleModelLabResults(rows, maxItems, query),
    `Indexed result filtering should preserve legacy rows for query ${typeof query === 'string' ? query : query.id}`,
  );
}

const cappedErrorWindow = resultWindowIndex.getVisibleResultWindow(1, '');
assert.deepEqual(
  cappedErrorWindow.rows.map((row) => row.modelId),
  ['glm-reviewer'],
  'Eval result windows should keep error rows pinned before applying the visible cap',
);
assert.equal(cappedErrorWindow.matchCount, rows.length, 'Unfiltered eval result windows should count all rows before applying the visible cap');

const zeroCapSearchWindow = resultWindowIndex.getVisibleResultWindow(0, 'routing proof');
assert.deepEqual(zeroCapSearchWindow.rows, [], 'A zero visible cap should return no eval result rows');
assert.equal(zeroCapSearchWindow.matchCount, 3, 'A zero visible cap should still report the full eval result match count');

const exactEvidenceWindow = resultWindowIndex.getVisibleResultWindow(1, qwenDecisionScope);
assert.deepEqual(
  exactEvidenceWindow.rows.map((row) => `${row.modelId}:${row.promptStrategy?.id || 'none'}`),
  ['qwen-coder:qwen-xml-code-v1'],
  'Eval result windows should keep exact route evidence rows visible under a cap',
);
assert.equal(exactEvidenceWindow.matchCount, 1, 'Eval result windows should count exact route evidence matches without widening to text matches');

const emptyResultWindow = createModelLabResultIndex([]).getVisibleResultWindow(10, '');
assert.deepEqual(emptyResultWindow.rows, [], 'Empty eval result windows should return no rows');
assert.equal(emptyResultWindow.matchCount, 0, 'Empty eval result windows should return a zero match count');

const mutableRows = rows.slice();
const snapshottedResultIndex = createModelLabResultIndex(mutableRows);
mutableRows.push(result('late-model', 'Late mutated prompt', 'ok', 10, 'Style proof'));
const snapshottedResultWindow = snapshottedResultIndex.getVisibleResultWindow(100, '');
assert.equal(snapshottedResultWindow.matchCount, rows.length, 'Existing eval result indexes should snapshot rows at creation time');
assert.equal(
  snapshottedResultWindow.rows.some((row) => row.modelId === 'late-model'),
  false,
  'Existing eval result indexes should not surface rows pushed after index creation',
);

let resultSearchTextBuildCount = 0;
const instrumentedResultIndex = createModelLabResultIndex(rows, {
  getSearchText: (row) => {
    resultSearchTextBuildCount += 1;
    return [
      row.modelId,
      row.promptName,
      row.status,
      row.scores.overallScore,
      row.promptStrategy?.id,
      row.promptStrategy?.variantId,
      row.scores.breakdown?.weakestSignal?.label,
    ].filter(Boolean).join(' ');
  },
});
assert.equal(resultSearchTextBuildCount, 0, 'Model Lab eval result indexes should defer search text until a text query exists');
instrumentedResultIndex.getVisibleResultWindow(2, '');
instrumentedResultIndex.getVisibleResultWindow(10, qwenDecisionScope);
assert.equal(resultSearchTextBuildCount, 0, 'Unfiltered and exact-route eval result windows should not build unused search text');
instrumentedResultIndex.getVisibleResults(10, 'qwen');
instrumentedResultIndex.getVisibleResultWindow(10, 'glm-reviewer');
instrumentedResultIndex.getVisibleResults(2, '');
assert.equal(
  resultSearchTextBuildCount,
  rows.length,
  'Repeated Model Lab eval result filters should reuse indexed search text instead of rebuilding per query',
);

const matchingReport = {
  id: 'eval-report-with-qwen-strategy',
  name: 'Qwen strategy proof report',
  status: 'complete',
  createdAt: '2026-06-20T10:00:00.000Z',
  completedAt: '2026-06-20T10:02:00.000Z',
  results: rows,
};
const missingReport = {
  id: 'eval-report-without-qwen-strategy',
  name: 'Unrelated proof report',
  createdAt: '2026-06-27T10:00:00.000Z',
  completedAt: '2026-06-27T10:01:00.000Z',
  results: rows.filter((row) => row.promptStrategy?.id !== 'qwen-xml-code-v1'),
};
const newerMatchingReport = {
  id: 'eval-report-newer-qwen-strategy',
  name: 'Newer qwen strategy proof report',
  status: 'complete',
  createdAt: '2026-06-26T10:00:00.000Z',
  completedAt: '2026-06-26T10:02:00.000Z',
  results: [
    result('qwen-coder', 'Fix routing proof retry', 'ok', 8, 'Runtime proof', qwenStrategy),
    result('qwen-coder', 'Fix routing proof rerun', 'ok', 7, 'Runtime proof', qwenStrategy),
  ],
};
const overflowMatchingReport = {
  id: 'eval-report-sample-overflow',
  name: 'Overflow qwen strategy proof report',
  status: 'running',
  createdAt: '2026-06-27T11:00:00.000Z',
  results: [
    result('qwen-coder', 'Alpha exact proof', 'ok', 8, 'Runtime proof', qwenStrategy),
    result('qwen-coder', 'Beta exact proof', 'ok', 7, 'Runtime proof', qwenStrategy),
    result('qwen-coder', 'Gamma exact proof', 'ok', 7, 'Runtime proof', qwenStrategy),
    result('qwen-coder', 'Wrong strategy proof', 'ok', 7, 'Runtime proof', qwenLookalikeStrategy),
    result('qwen-coder', 'Alpha exact proof', 'ok', 8, 'Runtime proof', qwenStrategy),
  ],
};
const fallbackPromptIdReport = {
  id: 'eval-report-fallback-prompt-id',
  name: 'Fallback prompt id proof report',
  status: 'complete',
  createdAt: '2026-06-25T11:00:00.000Z',
  completedAt: '2026-06-25T11:02:00.000Z',
  results: [
    {
      ...result('qwen-coder', '', 'ok', 8, 'Runtime proof', qwenStrategy),
      promptId: 'fallback-exact-prompt-id',
    },
  ],
};
const strategyOnlyReport = {
  id: 'eval-report-strategy-only',
  name: 'Strategy only proof report',
  status: 'complete',
  createdAt: '2026-06-24T11:00:00.000Z',
  completedAt: '2026-06-24T11:02:00.000Z',
  results: [
    result('deepseek-v4', 'Different model qwen strategy', 'ok', 8, 'Runtime proof', qwenStrategy),
  ],
};
const splitEvidenceReport = {
  id: 'eval-report-split-evidence',
  name: 'Split evidence proof report',
  status: 'complete',
  createdAt: '2026-06-23T11:00:00.000Z',
  completedAt: '2026-06-23T11:02:00.000Z',
  results: [
    result('qwen-coder', 'Qwen model different strategy', 'ok', 8, 'Runtime proof', qwenLookalikeStrategy),
    result('deepseek-v4', 'Different model qwen strategy', 'ok', 8, 'Runtime proof', qwenStrategy),
  ],
};
const neitherEvidenceReport = {
  id: 'eval-report-neither-evidence',
  name: 'Neither evidence proof report',
  status: 'complete',
  createdAt: '2026-06-22T11:00:00.000Z',
  completedAt: '2026-06-22T11:02:00.000Z',
  results: [
    result('mistral-small', 'Unrelated route proof', 'ok', 8, 'Runtime proof'),
  ],
};
assert.deepEqual(
  summarizeModelLabEvidenceScope(qwenDecisionScope, null),
  {
    status: 'no-report',
    modelId: 'qwen-coder',
    promptStrategyId: 'qwen-xml-code-v1',
    reportId: null,
    reportName: null,
    matchCount: 0,
    totalRows: 0,
  },
  'Evidence summary should distinguish missing report selection from zero matches inside a selected report',
);
assert.deepEqual(
  summarizeModelLabEvidenceScope(qwenDecisionScope, matchingReport),
  {
    status: 'matched',
    modelId: 'qwen-coder',
    promptStrategyId: 'qwen-xml-code-v1',
    reportId: 'eval-report-with-qwen-strategy',
    reportName: 'Qwen strategy proof report',
    matchCount: getVisibleModelLabResults(rows, Number.MAX_SAFE_INTEGER, qwenDecisionScope).length,
    totalRows: rows.length,
  },
  'Evidence summary should count matches through the same exact filter as the result table',
);
assert.deepEqual(
  summarizeModelLabEvidenceScope(qwenDecisionScope, missingReport),
  {
    status: 'no-match',
    modelId: 'qwen-coder',
    promptStrategyId: 'qwen-xml-code-v1',
    reportId: 'eval-report-without-qwen-strategy',
    reportName: 'Unrelated proof report',
    matchCount: 0,
    totalRows: missingReport.results.length,
  },
  'Evidence summary should name zero-match selected-report states without implying evidence is absent everywhere',
);

const reportMatches = findModelLabEvidenceReportMatches(qwenDecisionScope, [
  matchingReport,
  missingReport,
  newerMatchingReport,
], {
  maxMatches: 2,
  excludeReportId: missingReport.id,
});
assert.deepEqual(
  reportMatches.map((match) => `${match.reportId}:${match.matchCount}/${match.totalRows}`),
  [
    'eval-report-newer-qwen-strategy:2/2',
    'eval-report-with-qwen-strategy:1/6',
  ],
  'Evidence report matches should exclude the selected no-match report, keep only exact matches, and rank by recent completion time',
);
for (const match of reportMatches) {
  const openedReport = [matchingReport, missingReport, newerMatchingReport].find((report) => report.id === match.reportId);
  assert.ok(openedReport, `Test fixture should include opened report ${match.reportId}`);
  assert.equal(
    getVisibleModelLabResults(openedReport.results, Number.MAX_SAFE_INTEGER, qwenDecisionScope).length,
    match.matchCount,
    'Opening a surfaced report with the same exact evidence scope should render the promised matches',
  );
}
assert.deepEqual(
  reportMatches.map((match) => ({
    reportId: match.reportId,
    samplePromptLabels: match.samplePromptLabels,
    sampleOverflowCount: match.sampleOverflowCount,
  })),
  [
    {
      reportId: 'eval-report-newer-qwen-strategy',
      samplePromptLabels: ['Fix routing proof retry', 'Fix routing proof rerun'],
      sampleOverflowCount: 0,
    },
    {
      reportId: 'eval-report-with-qwen-strategy',
      samplePromptLabels: ['Fix routing proof'],
      sampleOverflowCount: 0,
    },
  ],
  'Evidence report matches should sample only exact rows and exclude lookalike or missing prompt strategies from the preview',
);
const overflowReportMatch = findModelLabEvidenceReportMatches(qwenDecisionScope, [overflowMatchingReport])[0];
assert.deepEqual(
  {
    matchCount: overflowReportMatch.matchCount,
    samplePromptLabels: overflowReportMatch.samplePromptLabels,
    sampleOverflowCount: overflowReportMatch.sampleOverflowCount,
  },
  {
    matchCount: 4,
    samplePromptLabels: ['Alpha exact proof', 'Beta exact proof'],
    sampleOverflowCount: 2,
  },
  'Evidence report match samples should stay capped while counting additional exact rows and excluding wrong-strategy rows',
);
assert.deepEqual(
  findModelLabEvidenceReportMatches(qwenDecisionScope, [fallbackPromptIdReport])[0].samplePromptLabels,
  ['fallback-exact-prompt-id'],
  'Evidence report match samples should fall back to prompt id when an exact row has no prompt name',
);
const reportSearch = summarizeModelLabEvidenceReportSearch(qwenDecisionScope, [
  matchingReport,
  missingReport,
  strategyOnlyReport,
  splitEvidenceReport,
  neitherEvidenceReport,
], {
  maxMatches: 2,
  excludeReportId: missingReport.id,
});
assert.deepEqual(
  reportSearch.matches.map((match) => `${match.reportId}:${match.matchCount}`),
  ['eval-report-with-qwen-strategy:1'],
  'Evidence report search should keep match results aligned with the exact-report matcher',
);
assert.deepEqual(
  reportSearch.diagnostics,
  {
    checkedReportCount: 4,
    exactReportCount: 1,
    modelOnlyReportCount: 0,
    strategyOnlyReportCount: 1,
    splitReportCount: 1,
    neitherReportCount: 1,
  },
  'Evidence report search diagnostics should bucket checked reports without counting the excluded selected report',
);
const reportSearchWithModelOnly = summarizeModelLabEvidenceReportSearch(qwenDecisionScope, [
  matchingReport,
  missingReport,
  strategyOnlyReport,
  splitEvidenceReport,
  neitherEvidenceReport,
]);
assert.deepEqual(
  reportSearchWithModelOnly.diagnostics,
  {
    checkedReportCount: 5,
    exactReportCount: 1,
    modelOnlyReportCount: 1,
    strategyOnlyReportCount: 1,
    splitReportCount: 1,
    neitherReportCount: 1,
  },
  'Evidence report search diagnostics should distinguish model-only, strategy-only, split, and neither near-misses',
);
const reportSearchWithCoverage = summarizeModelLabEvidenceReportSearch(qwenDecisionScope, [
  matchingReport,
  missingReport,
  strategyOnlyReport,
  splitEvidenceReport,
], {
  maxMatches: 1,
  candidateReportCount: 8,
  failedReportCount: 2,
  stoppedAtMatchLimit: true,
});
assert.deepEqual(
  reportSearchWithCoverage.diagnostics,
  {
    checkedReportCount: 4,
    candidateReportCount: 8,
    failedReportCount: 2,
    exactReportCount: 1,
    modelOnlyReportCount: 1,
    strategyOnlyReportCount: 1,
    splitReportCount: 1,
    neitherReportCount: 0,
    stoppedAtMatchLimit: true,
  },
  'Evidence report search diagnostics should preserve candidate, failed-load, and match-limit coverage metadata without widening the search',
);
assert.deepEqual(
  formatModelLabEvidenceSearchDiagnostics(reportSearchWithModelOnly.diagnostics, qwenDecisionScope),
  {
    coverageLabel: null,
    summaryLabel: 'Checked 5 recent reports: 1 exact, 1 with qwen-coder on other strategies, 1 with qwen-xml-code-v1 on other models, 1 split across rows, 1 with neither.',
    warningLabel: null,
    accessibleLabel: 'Recent evidence search checked 5 reports: 1 exact report, 1 report with qwen-coder on other prompt strategies, 1 report with qwen-xml-code-v1 on other models, 1 report with model and strategy split across rows, and 1 report with neither.',
  },
  'Evidence report search diagnostics should format a compact, screen-reader-friendly near-miss summary',
);
assert.deepEqual(
  formatModelLabEvidenceSearchDiagnostics(reportSearchWithCoverage.diagnostics, qwenDecisionScope),
  {
    coverageLabel: 'Checked 4 of 8 recent reports; showing first 1 matching report.',
    summaryLabel: 'Checked 4 recent reports: 1 exact, 1 with qwen-coder on other strategies, 1 with qwen-xml-code-v1 on other models, 1 split across rows.',
    warningLabel: '2 reports could not be loaded.',
    accessibleLabel: 'Recent evidence search checked 4 of 8 reports and is showing the first 1 matching report. 2 reports could not be loaded. Buckets: 1 exact report, 1 report with qwen-coder on other prompt strategies, 1 report with qwen-xml-code-v1 on other models, and 1 report with model and strategy split across rows.',
  },
  'Evidence report search diagnostics should format coverage and partial-load warnings without claiming the whole recent window was checked',
);
assert.equal(
  formatModelLabEvidenceSearchDiagnostics({
    checkedReportCount: 0,
    candidateReportCount: 0,
    failedReportCount: 0,
    exactReportCount: 0,
    modelOnlyReportCount: 0,
    strategyOnlyReportCount: 0,
    splitReportCount: 0,
    neitherReportCount: 0,
    stoppedAtMatchLimit: false,
  }, qwenDecisionScope).summaryLabel,
  null,
  'Evidence report search diagnostics should stay quiet when no reports were checked',
);
assert.deepEqual(
  formatModelLabEvidenceReportMatch(reportMatches[0]),
  {
    statusLabel: 'Complete',
    statusTone: 'success',
    timestampLabel: 'Completed 2026-06-26',
    suffixLabel: 'Complete · Completed 2026-06-26',
    sampleLabel: 'Sample matches: Fix routing proof retry; Fix routing proof rerun',
    accessibleLabel: 'Open matching report Newer qwen strategy proof report, Complete, Completed 2026-06-26, 2 exact matches of 2 rows, sample matches Fix routing proof retry; Fix routing proof rerun',
  },
  'Evidence report match formatting should expose complete status, completed date, sample prompts, and a full accessible button label',
);
assert.deepEqual(
  formatModelLabEvidenceReportMatch(overflowReportMatch),
  {
    statusLabel: 'Running',
    statusTone: 'warning',
    timestampLabel: 'Started 2026-06-27',
    suffixLabel: 'Running · Started 2026-06-27',
    sampleLabel: 'Sample matches: Alpha exact proof; Beta exact proof (+2 more)',
    accessibleLabel: 'Open matching report Overflow qwen strategy proof report, Running, Started 2026-06-27, 4 exact matches of 5 rows, sample matches Alpha exact proof; Beta exact proof, plus 2 more exact rows',
  },
  'Evidence report match formatting should flag capped sample previews without implying they are exhaustive',
);
assert.deepEqual(
  formatModelLabEvidenceReportMatch({
    reportId: 'running-report',
    reportName: 'Running report',
    reportStatus: 'running',
    createdAt: '2026-06-27T08:30:00.000Z',
    completedAt: '2026-06-27T09:30:00.000Z',
    matchCount: 1,
    totalRows: 4,
  }),
  {
    statusLabel: 'Running',
    statusTone: 'warning',
    timestampLabel: 'Started 2026-06-27',
    suffixLabel: 'Running · Started 2026-06-27',
    sampleLabel: null,
    accessibleLabel: 'Open matching report Running report, Running, Started 2026-06-27, 1 exact match of 4 rows',
  },
  'Running evidence reports should prefer createdAt over completedAt so the timestamp source is unambiguous',
);
assert.deepEqual(
  formatModelLabEvidenceReportMatch({
    reportId: 'future-status-report',
    reportName: 'Future status report',
    reportStatus: 'archived',
    createdAt: 'not-a-date',
    matchCount: 1,
    totalRows: 1,
  }),
  {
    statusLabel: 'Status unknown',
    statusTone: 'neutral',
    timestampLabel: 'Time unknown',
    suffixLabel: 'Status unknown · Time unknown',
    sampleLabel: null,
    accessibleLabel: 'Open matching report Future status report, Status unknown, Time unknown, 1 exact match of 1 row',
  },
  'Evidence report match formatting should be total over unknown statuses and invalid timestamps',
);

const indexedRows = createModelLabResultIndex(rows);
for (const query of ['', 'qwen runtime', qwenDecisionScope]) {
  assert.deepEqual(
    indexedRows.getVisibleResults(10, query),
    getVisibleModelLabResults(rows, 10, query),
    'Indexed Model Lab result filtering should preserve legacy visible-result behavior',
  );
}

let searchTextBuildCount = 0;
const instrumentedIndex = createModelLabResultIndex(rows, {
  getSearchText: (row) => {
    searchTextBuildCount += 1;
    return [
      row.modelId,
      row.promptName,
      row.promptStrategy?.id,
      row.scores.breakdown?.weakestSignal?.label,
    ].filter(Boolean).join(' ');
  },
});
assert.equal(searchTextBuildCount, 0, 'Model Lab result indexes should defer search text until a text query exists');
instrumentedIndex.getVisibleResults(10, '');
instrumentedIndex.getVisibleResults(10, qwenDecisionScope);
assert.equal(searchTextBuildCount, 0, 'Unfiltered and exact-route result filters should not build unused search text');
instrumentedIndex.getVisibleResults(10, 'qwen runtime');
instrumentedIndex.getVisibleResults(10, 'glm-reviewer');
instrumentedIndex.getVisibleResults(10, qwenDecisionScope);
assert.equal(
  searchTextBuildCount,
  rows.length,
  'Repeated Model Lab result filters should reuse indexed search text instead of rebuilding per query',
);

assert.throws(
  () => routingDecisionToModelLabEvidenceScope({ id: 'broken-route', selectedModel: '' }),
  /selected model/i,
  'Routing decision evidence scopes should fail loudly instead of opening Model Lab with an empty filter',
);

assert.throws(
  () => routingDecisionToModelLabEvidenceScope({ id: 'missing-strategy-route', selectedModel: 'qwen-coder' }),
  /prompt-strategy provenance/i,
  'Routing decision evidence scopes should fail loudly instead of falling back to model-only evidence',
);

const knownStrategyIds = new Set(['qwen-xml-code-v1']);
assert.deepEqual(
  getModelLabEvidenceGate({ selectedModel: '', promptStrategyId: 'qwen-xml-code-v1' }, knownStrategyIds),
  { enabled: false, reason: 'Select a model before opening Model Lab evidence.', strategyLabel: 'qwen-xml-code-v1' },
  'Evidence gate should name the selected-model precondition',
);
assert.deepEqual(
  getModelLabEvidenceGate({ selectedModel: 'qwen-coder' }, knownStrategyIds),
  { enabled: false, reason: 'No prompt-strategy provenance for this route.', strategyLabel: 'none' },
  'Evidence gate should name missing prompt-strategy provenance and expose none as the row label',
);
assert.deepEqual(
  getModelLabEvidenceGate({ selectedModel: 'qwen-coder', promptStrategyId: 'unknown-strategy' }, knownStrategyIds),
  { enabled: false, reason: 'Prompt strategy unknown-strategy is not in the loaded Model Lab registry.', strategyLabel: 'unknown-strategy' },
  'Evidence gate should name unknown prompt strategy ids instead of rendering a dead button',
);
assert.deepEqual(
  getModelLabEvidenceGate({ selectedModel: 'qwen-coder', promptStrategyId: 'qwen-xml-code-v1' }, knownStrategyIds),
  { enabled: true, reason: null, strategyLabel: 'qwen-xml-code-v1' },
  'Evidence gate should enable only when model and known prompt strategy are both present',
);

const modelLabSource = readFileSync('src/components/ModelLabPanel.tsx', 'utf8');
for (const expected of [
  'const MODEL_LAB_RESULT_VISIBLE_LIMIT = 50;',
  'const [resultFilter, setResultFilter] = useState(\'\');',
  'const [activeEvidenceScope, setActiveEvidenceScope] = useState<ModelLabEvidenceScope | null>(null);',
  'const [evidenceReportMatches, setEvidenceReportMatches] = useState<ModelLabEvidenceReportMatch[]>([]);',
  'const [evidenceSearchDiagnostics, setEvidenceSearchDiagnostics] = useState<ModelLabEvidenceSearchDiagnostics | null>(null);',
  'const [evidenceReportSearchStatus, setEvidenceReportSearchStatus] = useState<ModelLabEvidenceSearchStatus>(\'idle\');',
  'const activeEvidenceSummary = useMemo(',
  'summarizeModelLabEvidenceScope(activeEvidenceScope, selectedReport, selectedReportResultIndex)',
  'const shouldShowEvidenceSummaryCallout = Boolean(activeEvidenceSummary && activeEvidenceSummary.status !== \'matched\');',
  'const EVIDENCE_REPORT_SEARCH_WINDOW = 8;',
  'const EVIDENCE_REPORT_MATCH_LIMIT = 3;',
  'evidenceReportSearchGenerationRef.current += 1;',
  'findModelLabEvidenceReportMatches(activeEvidenceScope, fetchedReports, {',
  'summarizeModelLabEvidenceReportSearch(activeEvidenceScope, fetchedReports, {',
  'excludeReportId: selectedReport.id,',
  'candidateReportCount: recentReports.length,',
  'failedReportCount: failedFetchCount,',
  'let stoppedAtMatchLimit = false;',
  'stoppedAtMatchLimit,',
  'status={evidenceReportSearchStatus}',
  'matches={evidenceReportMatches}',
  'diagnostics={evidenceSearchDiagnostics}',
  'onOpenReport={handleSelectReport}',
  'const selectedReportResultIndex = useMemo(',
  '() => selectedReport ? createModelLabResultIndex(selectedReport.results) : null,',
  '[selectedReport],',
  'const resultFiltersActive = resultFilter.trim().length > 0;',
  'const selectedReportResultWindow = useMemo(',
  'selectedReportResultIndex ? selectedReportResultIndex.getVisibleResultWindow(MODEL_LAB_RESULT_VISIBLE_LIMIT, activeEvidenceScope || resultFilter) : { rows: [], matchCount: 0 }',
  'const visibleSelectedReportResults = selectedReportResultWindow.rows;',
  'const selectedReportResultMatchCount = activeEvidenceScope || resultFiltersActive ? selectedReportResultWindow.matchCount : selectedReport?.results.length || 0;',
  'const showExactEvidenceEmptyState = Boolean(activeEvidenceScope && visibleSelectedReportResults.length === 0);',
  'const showResultFilterEmptyState = Boolean(selectedReport && selectedReport.results.length > 0 && visibleSelectedReportResults.length === 0 && resultFilter.trim() && !activeEvidenceScope);',
  '[activeEvidenceScope, resultFilter, selectedReportResultIndex]',
  'selectedReport.results.length > MODEL_LAB_RESULT_VISIBLE_LIMIT || activeEvidenceScope || resultFiltersActive',
  'Showing {visibleSelectedReportResults.length} of {selectedReportResultMatchCount} result rows{activeEvidenceScope ? \' matching exact route evidence\' : resultFiltersActive ? \' that match filters\' : \'\'}.',
  'aria-label="Filter Model Lab result rows by model, prompt, status, score, strategy, weakest signal, or tool"',
  'aria-label="Clear Model Lab result row filters"',
  'clearModelLabResultFilter',
  'disabled={!resultFiltersActive}',
  'exact-evidence-status',
  'Checking the last 8 eval reports for this exact route evidence.',
  'Recent matching reports',
  'formatModelLabEvidenceSearchDiagnostics(diagnostics, summary)',
  'diagnosticsDisplay?.coverageLabel',
  'diagnosticsDisplay?.warningLabel',
  'exact-evidence-status-coverage',
  'exact-evidence-status-warning',
  'No exact matches found in the last 8 eval reports.',
  'Open matching report',
  'formatModelLabEvidenceReportMatch(match)',
  'matchDisplay.suffixLabel',
  'matchDisplay.sampleLabel',
  'exact-evidence-status-report-sample',
  'aria-label={matchDisplay.accessibleLabel}',
  'Evidence check needs a selected eval report.',
  'This selected report has no exact rows for the route evidence scope.',
  'No result rows match this exact route evidence.',
  'Use History or run an eval with this model and prompt strategy to create matching evidence.',
  'showExactEvidenceEmptyState',
  'showResultFilterEmptyState',
  'visibleSelectedReportResults.map',
  'initialEvidenceScope?: ModelLabEvidenceScope | null;',
  'onInitialEvidenceScopeConsumed?: () => void;',
  'setTab(\'results\');',
  'setResultFilter(initialEvidenceScope.resultFilter);',
  'setActiveEvidenceScope(initialEvidenceScope);',
  'onInitialEvidenceScopeConsumed?.();',
]) {
  assert.ok(
    modelLabSource.includes(expected),
    `Model Lab selected report table should expose searchable capped result rows: ${expected}`,
  );
}
assert.ok(
  !modelLabSource.includes('No Model Lab runs match this exact route evidence scope.'),
  'Model Lab should route exact-evidence zero states through the evidence status callout instead of a duplicate table empty state',
);

const routingLearningSource = readFileSync('src/components/RoutingLearningPane.tsx', 'utf8');
for (const expected of [
  'onOpenModelLabEvidence?: (scope: ModelLabEvidenceScope) => void;',
  'getModelLabEvidenceGate(event, promptStrategyIds)',
  'routingDecisionToModelLabEvidenceScope(event)',
  'strategyLabel',
  'routing-evidence-provenance',
  'Evidence unavailable',
  'Open Model Lab evidence',
]) {
  assert.ok(
    routingLearningSource.includes(expected),
    `Routing Learning should expose a route-to-Model-Lab evidence handoff: ${expected}`,
  );
}

const panelContentSource = readFileSync('src/components/layout/PanelContent.tsx', 'utf8');
for (const expected of [
  'modelLabEvidenceScope?: ModelLabEvidenceScope | null;',
  'onOpenModelLabEvidence?: (scope: ModelLabEvidenceScope) => void;',
  'initialEvidenceScope={context.modelLabEvidenceScope || null}',
  'onInitialEvidenceScopeConsumed={context.onModelLabEvidenceScopeConsumed}',
  'onOpenModelLabEvidence={context.onOpenModelLabEvidence}',
]) {
  assert.ok(
    panelContentSource.includes(expected),
    `PanelContent should pass Model Lab evidence handoff props across panels: ${expected}`,
  );
}

const appSource = readFileSync('src/App.tsx', 'utf8');
for (const expected of [
  'const [pendingModelLabEvidenceScope, setPendingModelLabEvidenceScope] = useState<ModelLabEvidenceScope | null>(null);',
  'const handleOpenModelLabEvidence = useCallback((scope: ModelLabEvidenceScope) => {',
  "addPanel('model-lab', 'right');",
  'modelLabEvidenceScope: pendingModelLabEvidenceScope,',
  'onModelLabEvidenceScopeConsumed: handleModelLabEvidenceScopeConsumed,',
  'onOpenModelLabEvidence: handleOpenModelLabEvidence,',
]) {
  assert.ok(
    appSource.includes(expected),
    `App should own and clear the pending Model Lab evidence scope: ${expected}`,
  );
}

const componentStyles = readFileSync('src/styles/components.css', 'utf8');
assert.ok(
  componentStyles.includes('.routing-event-actions button {\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;'),
  'Routing event action buttons should align icon+text evidence actions without cramped layout',
);

const packageSource = readFileSync('package.json', 'utf8');
assert.ok(packageSource.includes('test:model-lab-result-evidence'), 'package.json should expose the Model Lab result evidence test');

console.log('Model Lab result evidence checks passed.');
