import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { formatModelLabHistoryTimestamp, getRecentModelLabHistory, getVisibleModelLabHistory, getVisibleModelLabHistoryWindow } from '../src/utils/modelLabHistory';
import type { EvalReportSummary } from '../src/utils/api';

const reports: EvalReportSummary[] = [
  {
    id: 'started-newer',
    name: 'Started newer',
    status: 'complete',
    createdAt: '2026-06-26T09:00:00.000Z',
    total: 2,
  },
  {
    id: 'completed-latest',
    name: 'Completed latest',
    status: 'complete',
    createdAt: '2026-06-20T09:00:00.000Z',
    completedAt: '2026-06-26T12:00:00.000Z',
    total: 2,
    artifactPath: '/proof/frontier-alpha.md',
    packContext: {
      packId: 'pack-alpha',
      packName: 'Frontier Alpha',
      evalIds: ['alpha-a'],
      matchedEvalIds: ['alpha-a'],
    },
    proofReview: {
      status: 'approved',
      reviewedAt: '2026-06-26T12:30:00.000Z',
      note: 'Approved for routing proof',
    },
  },
  {
    id: 'tie-b',
    name: 'Tie B',
    status: 'complete',
    createdAt: '2026-06-25T09:00:00.000Z',
    completedAt: '2026-06-26T10:00:00.000Z',
    total: 2,
  },
  {
    id: 'tie-a',
    name: 'Tie A',
    status: 'complete',
    createdAt: '2026-06-25T09:00:00.000Z',
    completedAt: '2026-06-26T10:00:00.000Z',
    total: 2,
  },
  {
    id: 'invalid-date',
    name: 'Invalid date',
    status: 'error',
    createdAt: 'not-a-date',
    total: 1,
  },
];

const originalOrder = reports.map((report) => report.id);
const visible = getRecentModelLabHistory(reports, 4);
const duplicateReports: EvalReportSummary[] = [
  {
    id: 'repeat-run',
    name: 'Repeat run newer',
    status: 'complete',
    createdAt: '2026-06-26T12:00:00.000Z',
    total: 1,
  },
  {
    id: 'repeat-run',
    name: 'Repeat run older',
    status: 'complete',
    createdAt: '2026-06-26T11:00:00.000Z',
    total: 1,
  },
  {
    id: 'unique-run',
    name: 'Unique run',
    status: 'complete',
    createdAt: '2026-06-26T10:00:00.000Z',
    total: 1,
  },
];

assert.deepEqual(
  reports.map((report) => report.id),
  originalOrder,
  'History ordering should not mutate the source report array',
);
assert.deepEqual(
  visible.map((report) => report.id),
  ['completed-latest', 'tie-a', 'tie-b', 'started-newer'],
  'History ordering should use completedAt before createdAt and tie-break deterministically by id',
);
assert.deepEqual(
  getRecentModelLabHistory(reports, 0),
  [],
  'History ordering should return no rows for zero visible capacity',
);
assert.deepEqual(
  getRecentModelLabHistory(reports, -1),
  [],
  'History ordering should return no rows for negative visible capacity',
);
assert.deepEqual(
  getRecentModelLabHistory(reports, 99).map((report) => report.id).at(-1),
  'invalid-date',
  'History ordering should push invalid or missing timestamps to the end',
);
assert.deepEqual(
  getRecentModelLabHistory(duplicateReports, 2).map((report) => `${report.id}:${report.name}`),
  ['repeat-run:Repeat run newer', 'unique-run:Unique run'],
  'History ordering should collapse duplicate run ids before applying the visible cap',
);
assert.deepEqual(
  getVisibleModelLabHistory(duplicateReports, 2, 'run').map((report) => `${report.id}:${report.name}`),
  ['repeat-run:Repeat run newer', 'unique-run:Unique run'],
  'History filtering should also dedupe duplicate run ids before applying the visible cap',
);
assert.deepEqual(
  {
    rows: getVisibleModelLabHistoryWindow(duplicateReports, 1, 'run').rows.map((report) => `${report.id}:${report.name}`),
    matchCount: getVisibleModelLabHistoryWindow(duplicateReports, 1, 'run').matchCount,
  },
  {
    rows: ['repeat-run:Repeat run newer'],
    matchCount: 2,
  },
  'History windows should count all matching unique runs before applying the visible cap',
);
assert.deepEqual(
  getVisibleModelLabHistory(reports, 4, 'frontier alpha approved').map((report) => report.id),
  ['completed-latest'],
  'History filtering should match prompt-pack provenance and proof status before applying the latest-first cap',
);
assert.deepEqual(
  {
    rows: getVisibleModelLabHistoryWindow(reports, 2, 'complete').rows.map((report) => report.id),
    matchCount: getVisibleModelLabHistoryWindow(reports, 2, 'complete').matchCount,
  },
  {
    rows: ['completed-latest', 'tie-a'],
    matchCount: 4,
  },
  'History windows should expose the filtered match count separately from the visible rows',
);
assert.deepEqual(
  getVisibleModelLabHistoryWindow(reports, 0, 'complete'),
  { rows: [], matchCount: 4 },
  'History windows should still report the filtered match count when the visible cap is zero',
);
assert.deepEqual(
  getVisibleModelLabHistory(reports, 2, 'complete').map((report) => report.id),
  ['completed-latest', 'tie-a'],
  'History filtering should preserve newest-first ordering and visible cap after matching status',
);
assert.deepEqual(
  getVisibleModelLabHistoryWindow(reports, 4, 'no such proof'),
  { rows: [], matchCount: 0 },
  'History windows should report zero matches for unmatched proof searches',
);
assert.deepEqual(
  getVisibleModelLabHistory(reports, 4, 'no such proof').map((report) => report.id),
  [],
  'History filtering should return no rows for unmatched proof searches',
);
assert.deepEqual(
  {
    label: formatModelLabHistoryTimestamp(reports[1]).label,
    iso: formatModelLabHistoryTimestamp(reports[1]).iso,
  },
  {
    label: 'Completed',
    iso: '2026-06-26T12:00:00.000Z',
  },
  'History timestamp labels should prefer completedAt because ordering does too',
);
assert.deepEqual(
  {
    label: formatModelLabHistoryTimestamp(reports[0]).label,
    iso: formatModelLabHistoryTimestamp(reports[0]).iso,
  },
  {
    label: 'Started',
    iso: '2026-06-26T09:00:00.000Z',
  },
  'History timestamp labels should fall back to createdAt for still-running or incomplete rows',
);
assert.deepEqual(
  formatModelLabHistoryTimestamp(reports[4]),
  { label: 'Time', display: 'unknown', iso: null },
  'History timestamp labels should degrade cleanly for invalid timestamps',
);

const componentSource = readFileSync('src/components/ModelLabPanel.tsx', 'utf8');
for (const expected of [
  'formatModelLabHistoryTimestamp',
  'const [historyFilter, setHistoryFilter] = useState(\'\');',
  'getVisibleModelLabHistoryWindow(reports, HISTORY_VISIBLE_LIMIT, historyFilter)',
  'getVisibleModelLabHistoryWindow(benchRuns, HISTORY_VISIBLE_LIMIT, historyFilter)',
  'const latestReport = getRecentModelLabHistory(r, 1)[0];',
  'const latestBenchRun = getRecentModelLabHistory(b, 1)[0];',
  'const visibleReports = visibleReportWindow.rows;',
  'const visibleBenchRuns = visibleBenchRunWindow.rows;',
  'const historyFilterActive = historyFilter.trim().length > 0;',
  'const visibleReportMatchCount = historyFilterActive ? visibleReportWindow.matchCount : reports.length;',
  'const visibleBenchRunMatchCount = historyFilterActive ? visibleBenchRunWindow.matchCount : benchRuns.length;',
  'const reportTimestamp = formatModelLabHistoryTimestamp(r);',
  'const benchTimestamp = formatModelLabHistoryTimestamp(r);',
  '{reportTimestamp.label}: {reportTimestamp.display}',
  '{benchTimestamp.label}: {benchTimestamp.display}',
  'aria-label="Filter Model Lab history by name, id, status, pack, proof, or artifact"',
  'No eval reports match this history filter.',
  'No bench runs match this history filter.',
  'visibleReports.length > 0 && (reports.length > HISTORY_VISIBLE_LIMIT || historyFilterActive)',
  'visibleBenchRuns.length > 0 && (benchRuns.length > HISTORY_VISIBLE_LIMIT || historyFilterActive)',
  'Showing latest {visibleReports.length} of {visibleReportMatchCount} eval reports{historyFilterActive ? \' matching filter\' : \'\'}',
  'Showing latest {visibleBenchRuns.length} of {visibleBenchRunMatchCount} bench runs{historyFilterActive ? \' matching filter\' : \'\'}',
  'visibleReports.map',
  'visibleBenchRuns.map',
]) {
  assert.ok(componentSource.includes(expected), `Model Lab history should use memoized pure ordering: ${expected}`);
}
assert.equal(
  componentSource.includes('.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())'),
  false,
  'Model Lab history should not sort state arrays in render by createdAt only',
);
for (const forbidden of [
  'new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime()',
  'new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()',
]) {
  assert.equal(
    componentSource.includes(forbidden),
    false,
    `Model Lab initial history selection should not use raw date sort: ${forbidden}`,
  );
}

const packageSource = readFileSync('package.json', 'utf8');
assert.ok(packageSource.includes('test:model-lab-history-order'), 'package.json should expose the Model Lab history ordering test');

console.log('Model Lab history ordering checks passed.');
