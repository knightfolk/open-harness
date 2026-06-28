import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { selectPromptPluginsForPrompt } from '../server/promptPlugins';

const projectDir = mkdtempSync(join(tmpdir(), 'openharness-prompt-plugin-runtime-'));
const pluginDir = join(projectDir, '.openharness', 'prompt-plugins');
mkdirSync(pluginDir, { recursive: true });

function writeManifest(id: string, overrides: Record<string, unknown> = {}) {
  const manifest = {
    schemaVersion: '0.1.0',
    id,
    name: id,
    version: '0.1.0',
    description: `Runtime selection fixture for ${id}.`,
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
      sectionOrder: ['append'],
    }],
    sections: [{
      id: 'append',
      title: 'Append',
      placement: 'append-system',
      priority: 20,
      content: `${id} append content.`,
    }],
    evals: [],
    packs: [{ id: `${id}.pack`, name: `${id} Pack`, pluginIds: [id] }],
    safety: {
      permissions: {},
      untrustedContextPolicy: 'wrap-and-label',
      canOverrideProjectInstructions: false,
    },
    ...overrides,
  };
  writeFileSync(join(pluginDir, `${id}.prompt-plugin.json`), JSON.stringify(manifest, null, 2), 'utf-8');
}

writeManifest('local.safe', {
  sections: [
    { id: 'append', title: 'Append', placement: 'append-system', priority: 20, content: 'safe append content' },
    { id: 'replace', title: 'Replace', placement: 'replace-role', priority: 1, content: 'unsafe replace content' },
    { id: 'review-only', title: 'Review only', placement: 'append-system', priority: 30, content: 'review-only content', conditions: { roles: ['reviewer'] } },
  ],
});
writeManifest('local.override', {
  safety: {
    permissions: {},
    untrustedContextPolicy: 'wrap-and-label',
    canOverrideProjectInstructions: true,
  },
});
writeManifest('local.blocked', {
  provenance: {
    source: 'test',
    trust: 'blocked',
  },
});
writeManifest('local.disabled');
writeManifest('local.wrong-model', {
  targets: {
    roles: ['coder'],
    routeModes: ['execute'],
    modelFamilies: ['mistral'],
    modelIds: ['mistral-large-3'],
  },
});

const noAllowlist = selectPromptPluginsForPrompt(projectDir, [], {
  role: 'coder',
  routeMode: 'execute',
  modelFamily: 'qwen',
  modelId: 'qwen3-coder-480b',
  allowedPluginIds: [],
});
assert.deepEqual(noAllowlist, [], 'Prompt plugin runtime selection should fail closed when no plugin ids are allowlisted');

const selected = selectPromptPluginsForPrompt(projectDir, ['prompt-plugin.local.disabled'], {
  role: 'coder',
  routeMode: 'execute',
  modelFamily: 'qwen',
  modelId: 'qwen3-coder-480b',
  allowedPluginIds: ['local.safe', 'local.override', 'local.blocked', 'local.disabled', 'local.wrong-model'],
});

assert.deepEqual(selected.map((plugin) => plugin.id), ['local.safe'], 'Runtime selection should keep only explicitly allowlisted, enabled, ready, target-matching plugins');
assert.deepEqual(
  selected[0].sections.map((section) => section.id),
  ['append'],
  'Runtime selection should omit replacement and non-matching conditional sections structurally',
);
assert.equal(selected[0].sections[0].content, 'safe append content', 'Runtime selection should preserve selected manifest section content for the builder');

const serverIndex = readFileSync('server/index.ts', 'utf8');
assert.ok(serverIndex.includes('selectPromptPluginsForPrompt'), 'main chat runtime should use the prompt plugin selector');
assert.ok(serverIndex.includes('promptPluginRendering?.enabled'), 'main chat runtime should gate prompt plugin rendering behind the disabled-by-default config flag');
assert.ok(serverIndex.includes('allowedPluginIds'), 'main chat runtime should require an explicit prompt plugin allowlist');

const configSource = readFileSync('server/config.ts', 'utf8');
assert.ok(configSource.includes('promptPluginRendering'), 'stored config should include prompt plugin rendering settings');
assert.ok(configSource.includes('allowedPluginIds'), 'stored config should persist the prompt plugin allowlist');
assert.ok(configSource.includes('enabled: false'), 'prompt plugin rendering should default off');

console.log('Prompt plugin runtime selection checks passed.');
