import { strict as assert } from 'node:assert';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { saveReport, listReports, type EvalReport } from '../server/evals';
import {
  buildPromptPackEvidenceBrief,
  buildPromptPackLastUsedMap,
  formatPromptPackHistoryProvenance,
  formatPromptPackLastUsed,
  summarizePromptPackEvalReadiness,
} from '../src/utils/modelLabPackEvidence';
import type { EvalReportSummary, PromptPluginRegistry, PromptPluginSummary } from '../src/utils/api';

const evalRoot = join(tmpdir(), `openharness-pack-last-used-${process.pid}`);
process.env.OPENHARNESS_EVALS_DIR = evalRoot;
rmSync(evalRoot, { recursive: true, force: true });

function report(id: string, packId: string | undefined, createdAt: string, completedAt?: string): EvalReport {
  return {
    id,
    configId: `config-${id}`,
    name: `Report ${id}`,
    status: 'complete',
    total: 2,
    completed: 2,
    results: [],
    createdAt,
    completedAt,
    ...(packId ? {
      packContext: {
        packId,
        packName: `Pack ${packId}`,
        evalIds: ['prompt-a', 'prompt-b', 'prompt-c'],
        matchedEvalIds: ['prompt-a', 'prompt-b'],
      },
    } : {}),
  };
}

saveReport(report('older-pack-a', 'pack-a', '2026-06-25T10:00:00.000Z'));
saveReport(report('newer-pack-a', 'pack-a', '2026-06-25T09:00:00.000Z', '2026-06-26T12:00:00.000Z'));
saveReport(report('tie-pack-a', 'pack-a', '2026-06-26T12:00:00.000Z'));
saveReport(report('other-pack', 'pack-b', '2026-06-24T12:00:00.000Z'));
saveReport(report('no-pack', undefined, '2026-06-27T12:00:00.000Z'));

const listedReports = listReports();
const summarizedPackReport = listedReports.find((item) => item.id === 'newer-pack-a');

assert.deepEqual(
  summarizedPackReport?.packContext,
  {
    packId: 'pack-a',
    packName: 'Pack pack-a',
    evalIds: ['prompt-a', 'prompt-b', 'prompt-c'],
    matchedEvalIds: ['prompt-a', 'prompt-b'],
  },
  'Eval report summaries should expose pack context for Model Lab pack last-used attribution',
);
assert.equal(
  listedReports.find((item) => item.id === 'no-pack')?.packContext,
  undefined,
  'Reports without pack provenance should keep packContext absent',
);

const summaries: EvalReportSummary[] = [
  {
    id: 'older',
    name: 'Older',
    status: 'complete',
    createdAt: '2026-06-24T12:00:00.000Z',
    completedAt: '2026-06-25T12:00:00.000Z',
    total: 3,
    packContext: {
      packId: 'pack-a',
      packName: 'Pack A',
      evalIds: ['a', 'b', 'c'],
      matchedEvalIds: ['a'],
    },
  },
  {
    id: 'newer',
    name: 'Newer',
    status: 'complete',
    createdAt: '2026-06-26T08:00:00.000Z',
    total: 3,
    packContext: {
      packId: 'pack-a',
      packName: 'Pack A',
      evalIds: ['a', 'b', 'c'],
      matchedEvalIds: ['a', 'b'],
    },
  },
  {
    id: 'newer-z',
    name: 'Same timestamp lexical winner',
    status: 'complete',
    createdAt: '2026-06-26T08:00:00.000Z',
    total: 3,
    packContext: {
      packId: 'pack-a',
      packName: 'Pack A',
      evalIds: ['a', 'b', 'c'],
      matchedEvalIds: ['a', 'b', 'c'],
    },
  },
  {
    id: 'running-latest',
    name: 'Running latest should still count as latest usage',
    status: 'running',
    createdAt: '2026-06-27T08:00:00.000Z',
    total: 3,
    packContext: {
      packId: 'pack-b',
      packName: 'Pack B',
      evalIds: ['x'],
      matchedEvalIds: [],
    },
  },
  {
    id: 'unrelated',
    name: 'Unrelated',
    status: 'complete',
    createdAt: '2026-06-28T08:00:00.000Z',
    total: 1,
  },
];

const lastUsed = buildPromptPackLastUsedMap(summaries);

assert.equal(lastUsed.get('pack-a')?.reportId, 'newer-z', 'Tie breaks should be deterministic by report id');
assert.equal(lastUsed.get('pack-a')?.matchedEvalCount, 3);
assert.equal(lastUsed.get('pack-a')?.declaredEvalCount, 3);
assert.equal(lastUsed.get('pack-b')?.status, 'running');
assert.equal(lastUsed.has('missing-pack'), false);
assert.match(
  formatPromptPackLastUsed(lastUsed.get('pack-a')!),
  /^Last used: .+ · report newer-z · matched 3\/3 · complete$/,
);
assert.match(
  (formatPromptPackLastUsed as (usage: NonNullable<ReturnType<typeof lastUsed.get>>, now?: Date) => string)(
    lastUsed.get('pack-a')!,
    new Date('2026-06-26T11:15:00.000Z'),
  ),
  /used 3h ago/,
  'Last-used evidence should include relative freshness when a clock is supplied',
);
assert.equal(formatPromptPackLastUsed(undefined), 'Last used: no Model Lab run recorded for this pack');
assert.equal(
  formatPromptPackHistoryProvenance(summaries[2]),
  'Prompt pack: Pack A · 3/3 evals matched',
  'History rows should summarize prompt-pack provenance with clear matched-count wording',
);
assert.equal(
  formatPromptPackHistoryProvenance(summaries[4]),
  null,
  'Legacy eval report history rows should not add empty prompt-pack provenance',
);
assert.equal(
  formatPromptPackHistoryProvenance({
    ...summaries[2],
    packContext: {
      packId: 'pack-without-name',
      packName: '',
      evalIds: ['a', 'b'],
      matchedEvalIds: [],
    },
  }),
  'Prompt pack: pack-without-name · 0/2 evals matched',
  'History provenance should fall back to pack id and preserve zero-match evidence',
);

assert.deepEqual(
  summarizePromptPackEvalReadiness(['a', 'b'], new Set(['a', 'b', 'extra'])),
  { status: 'ready', label: 'Ready', installedCount: 2, declaredCount: 2, detail: 'Ready · 2/2 eval ids installed' },
  'Readiness should be ready only when every unique declared eval id is installed',
);
assert.deepEqual(
  summarizePromptPackEvalReadiness(['a', 'a', 'b'], new Set(['a', 'extra'])),
  { status: 'partial', label: 'Partial', installedCount: 1, declaredCount: 2, detail: 'Partial · 1/2 eval ids installed' },
  'Readiness should dedupe declared ids and ignore extra installed prompt ids',
);
assert.deepEqual(
  summarizePromptPackEvalReadiness(['a', 'b'], new Set(['extra'])),
  { status: 'missing', label: 'Missing', installedCount: 0, declaredCount: 2, detail: 'Missing · 0/2 eval ids installed' },
  'Readiness should mark packs with declared evals but no installed matches as missing',
);
assert.deepEqual(
  summarizePromptPackEvalReadiness([], new Set(['extra'])),
  { status: 'empty', label: 'No evals', installedCount: 0, declaredCount: 0, detail: 'No evals declared' },
  'Readiness should keep no-eval packs neutral instead of calling them missing',
);

const pack: PromptPluginRegistry['packs'][number] = {
  id: 'pack-a',
  name: 'Pack A',
  pluginIds: ['plugin-a'],
  pluginCount: 1,
  trust: 'trusted',
  sources: ['project'],
};
const plugin: PromptPluginSummary = {
  id: 'plugin-a',
  name: 'Plugin A',
  version: '1.0.0',
  description: 'Plugin A',
  enabled: true,
  source: 'project',
  trust: 'trusted',
  location: 'project',
  path: '/tmp/plugin-a.json',
  targets: { roles: ['coder'], routeModes: ['execute'], modelFamilies: [], modelIds: [] },
  sections: [],
  evals: [{ id: 'a', minimumScore: 7 }],
  packs: [{ id: 'pack-a', name: 'Pack A', pluginIds: ['plugin-a'] }],
  safety: { canOverrideProjectInstructions: false, untrustedContextPolicy: 'wrap-and-label' },
  status: 'ready',
  issues: [],
};
const brief = buildPromptPackEvidenceBrief(
  pack,
  [plugin],
  [{ id: 'a', name: 'Prompt A', prompt: 'A', category: 'test' }],
  lastUsed.get('pack-a'),
);

assert.ok(brief.includes('## Last used'), 'Pack evidence brief should include a last-used section');
assert.ok(brief.includes('Report id: newer-z'), 'Pack evidence brief should identify the last-used report');
assert.ok(brief.includes('Matched evals: 3/3'), 'Pack evidence brief should include matched eval coverage');
assert.ok(brief.includes('Eval readiness: Ready · 1/1 eval ids installed'), 'Pack evidence brief should include shared eval readiness status');
assert.ok(brief.includes('Unique declared eval ids: 1'), 'Single-plugin evidence should keep one unique declared eval id');
assert.ok(brief.includes('Installed eval ids: 1/1'), 'Single-plugin evidence should keep installed eval coverage');

const duplicateBrief = buildPromptPackEvidenceBrief(
  pack,
  [
    plugin,
    {
      ...plugin,
      id: 'plugin-b',
      name: 'Plugin B',
      evals: [
        { id: 'a', minimumScore: 9 },
        { id: 'b', minimumScore: 6 },
      ],
      packs: [{ id: 'pack-a', name: 'Pack A', pluginIds: ['plugin-a', 'plugin-b'] }],
    },
  ],
  [{ id: 'a', name: 'Prompt A', prompt: 'A', category: 'test' }],
  lastUsed.get('pack-a'),
);
assert.ok(
  duplicateBrief.includes('Eval readiness: Partial · 1/2 eval ids installed'),
  'Duplicate evidence brief should share the same partial readiness language as the pack card',
);
assert.ok(duplicateBrief.includes('Unique declared eval ids: 2'), 'Duplicate eval declarations should count once by eval id');
assert.ok(duplicateBrief.includes('Installed eval ids: 1/2'), 'Installed eval coverage should use unique declared eval ids');
assert.ok(
  duplicateBrief.includes('- a: installed; minimum score 9; declared by plugin-a, plugin-b'),
  'Duplicate eval declarations should preserve sorted plugin provenance and the strictest minimum score',
);
assert.ok(
  duplicateBrief.includes('- b: missing; minimum score 6; declared by plugin-b'),
  'Missing eval IDs should stay visible after unique coverage normalization',
);

const modelLabSource = readFileSync('src/components/ModelLabPanel.tsx', 'utf8');
for (const expected of [
  'buildPromptPackLastUsedMap(reports)',
  'formatPromptPackHistoryProvenance(r)',
  'formatPromptPackLastUsed(lastUsed)',
  'summarizePromptPackEvalReadiness(evalIds, promptIds)',
  'packReadinessColor(readiness.status)',
  'Eval readiness',
  'Last-used evidence',
  'Prompt pack provenance for ${r.name}: ${packProvenance}',
  'buildPromptPackEvidenceBrief(pack, packPlugins(pack), prompts, lastUsed)',
]) {
  assert.ok(modelLabSource.includes(expected), `Model Lab should expose prompt-pack last-used evidence: ${expected}`);
}

const apiSource = readFileSync('src/utils/api.ts', 'utf8');
assert.ok(apiSource.includes("packContext?: EvalReport['packContext'];"), 'EvalReportSummary should expose optional packContext');

const packageSource = readFileSync('package.json', 'utf8');
assert.ok(packageSource.includes('test:model-lab-pack-last-used'), 'package.json should expose the Model Lab pack last-used test');

console.log('Model Lab prompt-pack last-used checks passed.');
