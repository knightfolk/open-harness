import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import type { HarnessRun } from '../src/types';
import {
  PROMPT_SECTION_FILTERS,
  buildPromptSectionFilterCounts,
  filterPromptMicroscopeSections,
  promptSectionFilterLabel,
} from '../src/utils/promptMicroscopeSectionFilters';
import { buildPromptMicroscopeTraceIndex, type PromptMicroscopeSection } from '../src/utils/promptMicroscopeSections';

const pluginSection: PromptMicroscopeSection = {
  id: 'assembly:prompt-plugin:local.safe:append',
  label: 'Append · promptPlugin:local.safe · rendered',
  text: 'sensitive plugin prompt content',
  source: 'promptPlugin:local.safe',
  reason: 'rendered',
  redacted: true,
  pluginId: 'local.safe',
  placement: 'append-system',
};

const sections: PromptMicroscopeSection[] = [
  pluginSection,
  { id: 'assembly:identity', label: 'Identity', text: 'identity', source: 'project', reason: 'core' },
  { id: 'toolcall:read-file', label: 'Tool call', text: '{}', source: 'tool' },
];

assert.deepEqual(
  PROMPT_SECTION_FILTERS,
  ['all', 'redacted', 'project', 'runtime', 'plugins', 'tools', 'router-model', 'output'],
  'Prompt Microscope should expose a stable plugin filter beside other prompt sources',
);

assert.equal(promptSectionFilterLabel('plugins'), 'Plugins');
assert.deepEqual(
  filterPromptMicroscopeSections(sections, null, 'plugins').map((section) => section.id),
  ['assembly:prompt-plugin:local.safe:append'],
  'Plugin filtering should use structured pluginId metadata before source text',
);
assert.equal(buildPromptSectionFilterCounts(sections, null).plugins, 1);
assert.equal(buildPromptSectionFilterCounts(sections, null).redacted, 1);

const traceRun: HarnessRun = {
  id: 'prompt-plugin-evidence-run',
  sessionId: 'prompt-plugin-evidence-session',
  userMessageId: 'prompt-plugin-evidence-message',
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
          {
            id: 'identity',
            label: 'Identity',
            source: 'project',
            tokenEstimate: 5,
            included: true,
            reason: 'core',
            redacted: false,
            preview: 'identity',
          },
        ],
        totalTokenEstimate: 14,
      },
    },
  ],
};

const traceIndex = buildPromptMicroscopeTraceIndex(traceRun, true);
assert.equal(traceIndex?.sections[0]?.pluginId, 'local.safe');
assert.equal(traceIndex?.sections[0]?.placement, 'append-system');
assert.deepEqual(
  traceIndex?.promptPluginSections.map((section) => ({
    pluginId: section.pluginId,
    label: section.label,
    placement: section.placement,
  })),
  [{ pluginId: 'local.safe', label: 'Safe plugin append', placement: 'append-system' }],
  'Prompt Microscope trace index should derive plugin evidence from assembly sections without widening the run schema',
);
assert.ok(
  traceIndex?.collapsedSummary?.items.some((item) => item.label === 'Plugins' && item.value === '1 plugin section'),
  'Collapsed Prompt Microscope summary should show when prompt plugin sections were injected',
);

const componentSource = readFileSync('src/components/PromptMicroscope.tsx', 'utf8');
const promptMicroscopeSectionsSource = readFileSync('src/utils/promptMicroscopeSections.ts', 'utf8');
for (const expected of [
  'promptPluginSections',
  'Prompt plugins',
]) {
  assert.ok(componentSource.includes(expected), `Prompt Microscope should expose plugin evidence safely: ${expected}`);
}
for (const expected of [
  'Prompt plugin section hidden while redaction is on.',
  'section.pluginId && section.redacted',
]) {
  assert.ok(promptMicroscopeSectionsSource.includes(expected), `Prompt Microscope resolver should expose plugin evidence safely: ${expected}`);
}

const packageSource = readFileSync('package.json', 'utf8');
assert.ok(packageSource.includes('test:prompt-microscope-plugin-evidence'), 'package.json should expose the Prompt Microscope plugin evidence test');

console.log('Prompt Microscope plugin evidence checks passed.');
