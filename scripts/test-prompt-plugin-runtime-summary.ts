import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { promptPluginRuntimeCostSummary } from '../src/utils/promptPluginRuntimeSummary';
import { buildPromptMicroscopeTraceIndex } from '../src/utils/promptMicroscopeSections';
import type { HarnessRun, HarnessRunStep } from '../src/types';

type PromptPluginStep = Extract<HarnessRunStep, { type: 'prompt_plugins' }>;

function step(overrides: Partial<PromptPluginStep>): PromptPluginStep {
  return {
    type: 'prompt_plugins',
    enabled: true,
    allowedPluginCount: 1,
    selectedPluginIds: ['local.safe'],
    selectedSectionCount: 2,
    selectionDurationMs: 18,
    manifestsScanned: 2,
    cache: { entries: 2, hits: 0, misses: 2 },
    ...overrides,
  };
}

assert.equal(
  promptPluginRuntimeCostSummary(step({ manifestsScanned: 2, cache: { entries: 2, hits: 0, misses: 2 }, selectionDurationMs: 18 })),
  'Scanned 2 manifests, 0 cache hits, 2 cache misses, 18ms',
  'Prompt plugin runtime summary should lead with manifest scanning when filesystem work dominated',
);
assert.equal(
  promptPluginRuntimeCostSummary(step({ manifestsScanned: 0, cache: { entries: 3, hits: 4, misses: 0 }, selectionDurationMs: 3 })),
  'Cache-only selection, 4 cache hits, 0 cache misses, 3ms',
  'Prompt plugin runtime summary should identify a fully cached selection without warm/cold jargon',
);
assert.equal(
  promptPluginRuntimeCostSummary(step({ manifestsScanned: 0, cache: { entries: 0, hits: 0, misses: 0 }, selectionDurationMs: 0 })),
  'No plugin manifest work, 0ms',
  'Prompt plugin runtime summary should stay explicit when prompt-plugin rendering has no work',
);

const runTrace: HarnessRun = {
  id: 'prompt-plugin-runtime-summary-run',
  sessionId: 'prompt-plugin-runtime-summary-session',
  userMessageId: 'prompt-plugin-runtime-summary-message',
  role: 'coder',
  requestedModel: 'auto',
  effectiveModel: 'qwen3-coder-480b',
  providerId: 'test',
  status: 'complete',
  startedAt: new Date(0).toISOString(),
  context: {
    tokensUsed: 0,
    budget: 0,
    compressedCount: 0,
    summarized: false,
  },
  steps: [step({ manifestsScanned: 2, cache: { entries: 2, hits: 0, misses: 2 }, selectionDurationMs: 18 })],
};

const expandedIndex = buildPromptMicroscopeTraceIndex(runTrace, true);
assert.ok(
  expandedIndex?.sections.some((section) => (
    section.id === 'promptplugins:selection'
    && section.text.includes('Runtime cost: Scanned 2 manifests, 0 cache hits, 2 cache misses, 18ms')
  )),
  'Expanded Prompt Microscope trace text should include the same deterministic runtime cost summary',
);

const componentSource = readFileSync('src/components/PromptMicroscope.tsx', 'utf8');
for (const expected of [
  'promptPluginRuntimeCostSummary(promptPluginRuntime)',
  'Runtime cost',
]) {
  assert.ok(componentSource.includes(expected), `Prompt Microscope should render plugin runtime cost summary: ${expected}`);
}

const packageSource = readFileSync('package.json', 'utf8');
assert.ok(packageSource.includes('test:prompt-plugin-runtime-summary'), 'package.json should expose the prompt plugin runtime summary test');

console.log('Prompt plugin runtime summary checks passed.');
