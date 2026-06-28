import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clearPromptPluginManifestCache, selectPromptPluginsForPromptWithTelemetry } from '../server/promptPlugins';
import { buildPromptPluginSelectionTraceStep } from '../server/promptPluginTrace';

const projectDir = mkdtempSync(join(tmpdir(), 'openharness-prompt-plugin-trace-step-'));
const pluginDir = join(projectDir, '.openharness', 'prompt-plugins');
mkdirSync(pluginDir, { recursive: true });

writeFileSync(join(pluginDir, 'local.safe.prompt-plugin.json'), JSON.stringify({
  schemaVersion: '0.1.0',
  id: 'local.safe',
  name: 'Local Safe',
  version: '0.1.0',
  description: 'Runtime trace-step fixture.',
  author: { name: 'OpenHarness tests' },
  license: 'UNLICENSED',
  provenance: {
    source: 'test',
    trust: 'trusted',
  },
  targets: {
    roles: ['coder'],
    routeModes: ['execute'],
    modelFamilies: ['qwen'],
    modelIds: ['qwen3-coder-480b'],
  },
  renderers: [{
    id: 'default',
    format: 'markdown',
    template: '{{sections}}',
    sectionOrder: ['append', 'task'],
  }],
  sections: [
    {
      id: 'append',
      title: 'Append',
      placement: 'append-system',
      priority: 20,
      content: 'safe append content',
    },
    {
      id: 'task',
      title: 'Task',
      placement: 'append-task',
      priority: 30,
      content: 'safe task content',
    },
  ],
  evals: [],
  packs: [],
  safety: {
    permissions: {},
    untrustedContextPolicy: 'wrap-and-label',
    canOverrideProjectInstructions: false,
  },
}, null, 2), 'utf-8');

clearPromptPluginManifestCache(projectDir);

const selection = selectPromptPluginsForPromptWithTelemetry(projectDir, [], {
  role: 'coder',
  routeMode: 'execute',
  modelFamily: 'qwen',
  modelId: 'qwen3-coder-480b',
  allowedPluginIds: ['local.safe'],
});

assert.equal(selection.plugins.length, 1, 'fixture should select the allowlisted prompt plugin through the real selector');
assert.equal(selection.telemetry.selectedSectionCount, 2, 'fixture should expose real selected-section telemetry');
assert.equal(selection.telemetry.manifestsScanned, 1, 'fixture should scan exactly one prompt-plugin manifest');

const step = buildPromptPluginSelectionTraceStep(selection);

assert.deepEqual(step, {
  type: 'prompt_plugins',
  enabled: true,
  allowedPluginCount: 1,
  selectedPluginIds: ['local.safe'],
  selectedSectionCount: 2,
  selectionDurationMs: selection.telemetry.selectionDurationMs,
  manifestsScanned: 1,
  cache: selection.telemetry.cache,
}, 'runtime trace-step builder should preserve selector telemetry without reshaping or re-counting it');

const serverIndexSource = readFileSync('server/index.ts', 'utf8');
const runtimePromptBlock = serverIndexSource.slice(serverIndexSource.indexOf('const promptPluginSelection'));
assert.ok(
  runtimePromptBlock.includes('buildPromptPluginSelectionTraceStep(promptPluginSelection)'),
  'streamModelWithFallback should emit the production prompt_plugins step through the tested helper',
);
assert.ok(
  runtimePromptBlock.indexOf('buildPromptPluginSelectionTraceStep(promptPluginSelection)') < runtimePromptBlock.indexOf("type: 'prompt_built'"),
  'runtime prompt_plugins trace should remain ordered before prompt_built',
);

const packageSource = readFileSync('package.json', 'utf8');
assert.ok(packageSource.includes('test:prompt-plugin-runtime-trace-step'), 'package.json should expose the prompt plugin runtime trace-step test');

console.log('Prompt plugin runtime trace-step checks passed.');
