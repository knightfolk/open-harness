import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  clearPromptPluginManifestCache,
  getPromptPluginManifestCacheStats,
  selectPromptPluginsForPrompt,
} from '../server/promptPlugins';

const projectDir = mkdtempSync(join(tmpdir(), 'openharness-prompt-plugin-cache-'));
const pluginDir = join(projectDir, '.openharness', 'prompt-plugins');
const manifestPath = join(pluginDir, 'local.safe.prompt-plugin.json');
mkdirSync(pluginDir, { recursive: true });

function writeManifest(content: string) {
  const manifest = {
    schemaVersion: '0.1.0',
    id: 'local.safe',
    name: 'Local Safe',
    version: '0.1.0',
    description: 'Cache fixture.',
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
      content,
    }],
    evals: [],
    packs: [],
    safety: {
      permissions: {},
      untrustedContextPolicy: 'wrap-and-label',
      canOverrideProjectInstructions: false,
    },
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
}

function selection(disabledPluginIds: string[] = []) {
  return selectPromptPluginsForPrompt(projectDir, disabledPluginIds, {
    role: 'coder',
    routeMode: 'execute',
    modelFamily: 'qwen',
    modelId: 'qwen3-coder-480b',
    allowedPluginIds: ['local.safe'],
  });
}

clearPromptPluginManifestCache();
writeManifest('first cached content');

const first = selection();
assert.equal(first[0]?.sections[0]?.content, 'first cached content');
const afterFirst = getPromptPluginManifestCacheStats();
assert.equal(afterFirst.entries, 1, 'Prompt plugin manifest cache should store parsed manifests after first selection');
assert.ok(afterFirst.misses >= 1, 'First selection should populate cache through a miss');

const second = selection();
assert.equal(second[0]?.sections[0]?.content, 'first cached content');
const afterSecond = getPromptPluginManifestCacheStats();
assert.ok(afterSecond.hits > afterFirst.hits, 'Second selection should reuse cached parsed manifest data');

const disabled = selection(['prompt-plugin.local.safe']);
assert.deepEqual(disabled, [], 'Disabled plugin ids should still filter cached manifests on every call');
const afterDisabled = getPromptPluginManifestCacheStats();
assert.ok(afterDisabled.hits > afterSecond.hits, 'Disabled filtering should happen after cached manifest retrieval');

const beforeUpdate = statSync(manifestPath).mtimeMs;
writeManifest('second cached content');
let afterUpdate = statSync(manifestPath).mtimeMs;
if (afterUpdate <= beforeUpdate) {
  const bumped = new Date(Date.now() + 2000);
  utimesSync(manifestPath, bumped, bumped);
  afterUpdate = statSync(manifestPath).mtimeMs;
}
assert.ok(afterUpdate > beforeUpdate, 'test fixture should force a detectable manifest mtime change');

const updated = selection();
assert.equal(updated[0]?.sections[0]?.content, 'second cached content', 'Manifest mtime changes should refresh cached parsed data without a TTL wait');
const afterMtimeRefresh = getPromptPluginManifestCacheStats();
assert.ok(afterMtimeRefresh.misses > afterDisabled.misses, 'Mtime refresh should be accounted as a cache miss');

clearPromptPluginManifestCache();
assert.equal(getPromptPluginManifestCacheStats().entries, 0, 'Explicit cache clear should empty manifest cache for imports and tests');

const packageSource = await import('node:fs').then((fs) => fs.readFileSync('package.json', 'utf8'));
assert.ok(packageSource.includes('test:prompt-plugin-selection-cache'), 'package.json should expose the prompt plugin selection cache test');

console.log('Prompt plugin selection cache checks passed.');
