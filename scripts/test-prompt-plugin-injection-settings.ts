import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import type { CapabilityItem, PromptPluginRenderingConfig } from '../src/utils/api';
import {
  buildPromptPluginInjectionRows,
  normalizePromptPluginRenderingConfig,
  promptPluginManifestId,
  togglePromptPluginInjectionAllowed,
  togglePromptPluginRenderingEnabled,
} from '../src/utils/promptPluginRenderingSettings';

const rawConfig: PromptPluginRenderingConfig = {
  enabled: true,
  allowedPluginIds: [
    'prompt-plugin.local.safe',
    'local.safe',
    '',
    '  local.other  ',
  ],
};

assert.deepEqual(
  normalizePromptPluginRenderingConfig(rawConfig),
  { enabled: true, allowedPluginIds: ['local.other', 'local.safe'] },
  'Prompt plugin injection config should dedupe ids and store manifest ids rather than capability ids',
);

assert.deepEqual(
  normalizePromptPluginRenderingConfig(undefined),
  { enabled: false, allowedPluginIds: [] },
  'Prompt plugin injection should stay disabled until the user turns it on',
);

assert.equal(promptPluginManifestId('prompt-plugin.local.safe'), 'local.safe');
assert.equal(promptPluginManifestId('local.safe'), 'local.safe');

const enabledOff = togglePromptPluginRenderingEnabled(rawConfig, false);
assert.deepEqual(
  enabledOff,
  { enabled: false, allowedPluginIds: [] },
  'Turning injection off should clear the allowlist so fail-closed is one server-owned invariant',
);

const removed = togglePromptPluginInjectionAllowed(rawConfig, 'prompt-plugin.local.safe', false);
assert.deepEqual(
  removed,
  { enabled: true, allowedPluginIds: ['local.other'] },
  'Unchecking a prompt plugin should remove only that manifest id and leave the global injection switch alone',
);

const added = togglePromptPluginInjectionAllowed({ enabled: false, allowedPluginIds: [] }, 'prompt-plugin.local.safe', true);
assert.deepEqual(
  added,
  { enabled: false, allowedPluginIds: [] },
  'A plugin cannot become allowlisted while global injection is disabled',
);

const capability = (overrides: Partial<CapabilityItem>): CapabilityItem => ({
  id: 'plugin.github',
  name: 'GitHub',
  description: 'GitHub plugin',
  category: 'source-control',
  source: 'curated',
  enabled: true,
  configurable: true,
  status: 'ready',
  ...overrides,
});

const rows = buildPromptPluginInjectionRows([
  capability({ id: 'plugin.github', source: 'curated' }),
  capability({ id: 'prompt-plugin.local.safe', name: 'Local Safe', source: 'prompt-plugin', enabled: true, status: 'ready' }),
  capability({ id: 'prompt-plugin.local.blocked', name: 'Local Blocked', source: 'prompt-plugin', enabled: true, status: 'blocked', issue: 'blocked trust' }),
  capability({ id: 'prompt-plugin.local.off', name: 'Local Off', source: 'prompt-plugin', enabled: false, status: 'ready' }),
], rawConfig);

assert.deepEqual(
  rows.map((row) => ({
    id: row.id,
    manifestId: row.manifestId,
    allowed: row.allowed,
    injectable: row.injectable,
    reason: row.reason,
  })),
  [
    { id: 'prompt-plugin.local.safe', manifestId: 'local.safe', allowed: true, injectable: true, reason: '' },
    { id: 'prompt-plugin.local.blocked', manifestId: 'local.blocked', allowed: false, injectable: false, reason: 'blocked trust' },
    { id: 'prompt-plugin.local.off', manifestId: 'local.off', allowed: false, injectable: false, reason: 'Turn the plugin on before allowing prompt injection.' },
  ],
  'Prompt plugin injection rows should ignore curated plugins and prevent checked-but-invisible blocked or disabled plugin state',
);

const assistantPaneSource = readFileSync('src/components/settings/AssistantSettingsPanes.tsx', 'utf8');
for (const expected of [
  'Prompt plugin injection',
  'api.setPromptPluginRenderingEnabled(!renderingConfig.enabled, workingDir)',
  'api.setPromptPluginInjectionAllowed(row.id, !row.allowed, workingDir)',
  'buildPromptPluginInjectionRows(items, renderingConfig)',
  'togglePromptPluginRenderingEnabled(renderingConfig, !renderingConfig.enabled)',
  'togglePromptPluginInjectionAllowed(renderingConfig, row.id, !row.allowed)',
  'aria-label={`${row.allowed ? \'Disallow\' : \'Allow\'} prompt injection for ${row.name}`}',
]) {
  assert.ok(assistantPaneSource.includes(expected), `Assistant plugin Settings should expose injection control wiring: ${expected}`);
}

const apiSource = readFileSync('src/utils/api.ts', 'utf8');
for (const expected of [
  'setPromptPluginRenderingEnabled',
  'setPromptPluginInjectionAllowed',
  '/api/prompt-plugin-rendering',
]) {
  assert.ok(apiSource.includes(expected), `Client API should expose server-owned prompt plugin injection mutation: ${expected}`);
}

const serverRouteSource = readFileSync('server/routes/labUtilityRoutes.ts', 'utf8');
for (const expected of [
  '/api/prompt-plugin-rendering',
  'promptPluginManifestId',
  'canOverrideProjectInstructions',
  'allowedPluginIds',
]) {
  assert.ok(serverRouteSource.includes(expected), `Server route should own prompt plugin injection invariants: ${expected}`);
}

const packageSource = readFileSync('package.json', 'utf8');
assert.ok(packageSource.includes('test:prompt-plugin-injection-settings'), 'package.json should expose the prompt plugin injection settings test');

console.log('Prompt plugin injection Settings checks passed.');
