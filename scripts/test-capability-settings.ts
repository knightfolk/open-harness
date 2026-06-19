import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { listCapabilities, setCapabilityEnabled } from '../server/capabilities';
import { listPromptPlugins } from '../server/promptPlugins';

const projectDir = mkdtempSync(join(tmpdir(), 'openharness-capabilities-'));
const pluginDir = join(projectDir, '.openharness', 'prompt-plugins');
mkdirSync(pluginDir, { recursive: true });

const manifest = {
  schemaVersion: '0.1.0',
  id: 'local.test-pack',
  name: 'Local Test Pack',
  version: '0.1.0',
  description: 'Test prompt plugin for capability settings.',
  author: { name: 'OpenHarness tests' },
  license: 'UNLICENSED',
  provenance: {
    source: 'test',
    trust: 'trusted',
  },
  targets: {
    roles: ['coder'],
    routeModes: ['execute'],
  },
  renderers: [{
    id: 'default',
    format: 'markdown',
    template: '{{sections}}',
    sectionOrder: ['test'],
  }],
  sections: [{
    id: 'test',
    title: 'Test',
    placement: 'append-task',
    priority: 100,
    content: 'Use the test prompt plugin.',
  }],
  evals: [{ id: 'capability-test-eval', minimumScore: 0.8 }],
  packs: [{ id: 'capability-test-pack', name: 'Capability Test Pack', pluginIds: ['local.test-pack'] }],
  safety: {
    permissions: {},
    untrustedContextPolicy: 'wrap-and-label',
    canOverrideProjectInstructions: false,
  },
};

writeFileSync(join(pluginDir, 'local.test-pack.prompt-plugin.json'), JSON.stringify(manifest, null, 2), 'utf-8');

const enabledPluginRegistry = listPromptPlugins(projectDir);
assert.equal(enabledPluginRegistry.plugins.length, 1, 'fixture should load one prompt plugin');
assert.equal(enabledPluginRegistry.plugins[0].enabled, true, 'prompt plugin should default to enabled');
assert.equal(enabledPluginRegistry.packs.length, 1, 'enabled prompt plugin should contribute its pack');

const capabilityRegistry = listCapabilities(undefined, enabledPluginRegistry);
assert.equal(capabilityRegistry.skills.length, 20, 'Settings should expose the top 20 skills');
assert.ok(capabilityRegistry.plugins.some((plugin) => plugin.id === 'plugin.github'), 'Settings should expose top curated plugins');
assert.ok(capabilityRegistry.plugins.some((plugin) => plugin.id === 'prompt-plugin.local.test-pack'), 'Settings should expose discovered prompt plugins');

const disabledSkillSettings = setCapabilityEnabled(undefined, 'skills', 'skill.imagegen', false);
assert.deepEqual(disabledSkillSettings.disabledSkills, ['skill.imagegen'], 'turning off a skill should persist its id');
const restoredSkillSettings = setCapabilityEnabled(disabledSkillSettings, 'skills', 'skill.imagegen', true);
assert.deepEqual(restoredSkillSettings.disabledSkills, [], 'turning a skill back on should remove its disabled id');

const disabledPluginRegistry = listPromptPlugins(projectDir, ['prompt-plugin.local.test-pack']);
assert.equal(disabledPluginRegistry.plugins[0].enabled, false, 'disabled prompt plugin should be marked off in plugin registry');
assert.equal(disabledPluginRegistry.packs.length, 0, 'disabled prompt plugin should not contribute runnable packs');

const disabledCapabilityRegistry = listCapabilities(
  { disabledSkills: [], disabledPlugins: ['prompt-plugin.local.test-pack'] },
  disabledPluginRegistry,
);
const disabledPromptPlugin = disabledCapabilityRegistry.plugins.find((plugin) => plugin.id === 'prompt-plugin.local.test-pack');
assert.equal(disabledPromptPlugin?.enabled, false, 'Settings should show disabled discovered prompt plugin as off');

console.log('Capability settings regression checks passed.');
