import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { buildPromptMicroscopeTraceIndex } from '../src/utils/promptMicroscopeSections';
import type { HarnessRun } from '../src/types';

const runTrace: HarnessRun = {
  id: 'prompt-plugin-trace-run',
  sessionId: 'prompt-plugin-trace-session',
  userMessageId: 'prompt-plugin-trace-message',
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
  steps: [
    {
      type: 'prompt_plugins',
      enabled: true,
      selectedPluginIds: ['local.safe'],
      selectedSectionCount: 2,
      selectionDurationMs: 7,
      manifestsScanned: 3,
      allowedPluginCount: 1,
      cache: {
        entries: 3,
        hits: 2,
        misses: 1,
      },
    },
    {
      type: 'prompt_built',
      promptPreview: 'prompt preview',
      toolCount: 0,
      assembly: {
        modelId: 'qwen3-coder-480b',
        family: 'qwen',
        style: 'xml-tagged',
        target: 'system',
        sections: [
          {
            id: 'prompt-plugin:local.safe:append',
            label: 'Safe plugin append',
            source: 'promptPlugin:local.safe',
            tokenEstimate: 9,
            included: true,
            reason: 'Prompt plugin Local Safe rendered as append-system after core project and safety rules.',
            redacted: true,
            preview: 'safe plugin content',
            pluginId: 'local.safe',
            placement: 'append-system',
          },
        ],
        totalTokenEstimate: 9,
      },
    },
  ],
};

const collapsedIndex = buildPromptMicroscopeTraceIndex(runTrace, false);
assert.equal(collapsedIndex?.promptPluginRuntime?.selectedPluginIds[0], 'local.safe');
assert.equal(collapsedIndex?.promptPluginRuntime?.selectionDurationMs, 7);
assert.ok(
  collapsedIndex?.collapsedSummary?.items.some((item) => item.label === 'Plugins' && item.value === '1 plugin section'),
  'Collapsed Prompt Microscope summary should keep prompt plugin section count',
);

const expandedIndex = buildPromptMicroscopeTraceIndex(runTrace, true);
assert.ok(
  expandedIndex?.sections.some((section) => (
    section.id === 'promptplugins:selection'
    && section.text.includes('Selection duration: 7ms')
    && section.text.includes('Manifest files scanned: 3')
    && section.text.includes('Cache: 2 hits / 1 misses')
  )),
  'Expanded Prompt Microscope sections should include prompt plugin selection/cache evidence',
);

const componentSource = readFileSync('src/components/PromptMicroscope.tsx', 'utf8');
for (const expected of [
  'promptPluginRuntime',
  'Prompt plugin selection',
  'selectionDurationMs',
  'manifestsScanned',
]) {
  assert.ok(componentSource.includes(expected), `Prompt Microscope should render prompt plugin runtime evidence: ${expected}`);
}

const serverIndexSource = readFileSync('server/index.ts', 'utf8');
for (const expected of [
  'selectPromptPluginsForPromptWithTelemetry',
  'buildPromptPluginSelectionTraceStep(promptPluginSelection)',
]) {
  assert.ok(serverIndexSource.includes(expected), `Server runtime should emit prompt plugin selection trace: ${expected}`);
}

const promptPluginTraceSource = readFileSync('server/promptPluginTrace.ts', 'utf8');
for (const expected of [
  "type: 'prompt_plugins'",
  'selectedPluginIds: selection.plugins.map',
  'selectionDurationMs',
  'selection.telemetry.selectionDurationMs',
]) {
  assert.ok(promptPluginTraceSource.includes(expected), `Prompt plugin trace helper should preserve runtime trace shape: ${expected}`);
}

const packageSource = readFileSync('package.json', 'utf8');
assert.ok(packageSource.includes('test:prompt-plugin-trace-visibility'), 'package.json should expose the prompt plugin trace visibility test');

console.log('Prompt plugin trace visibility checks passed.');
