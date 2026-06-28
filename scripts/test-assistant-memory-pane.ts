import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import type { ProjectMemoryInfo } from '../src/utils/api';
import { buildAssistantMemoryEntries } from '../src/utils/assistantMemoryInventory';

const loadedMemory: ProjectMemoryInfo = {
  projectPath: '/Users/kevink/Projects/OpenHarness',
  memoryMd: '# OpenHarness\n\nPrefer verified routing proof.\n',
  profile: {
    name: 'OpenHarness',
    validation: { lint: 'npm run lint', build: 'npm run build' },
  },
  createdAt: '',
  updatedAt: '2026-06-26T12:00:00.000Z',
};

const entries = buildAssistantMemoryEntries(loadedMemory);
assert.equal(entries.length, 2, 'project memory with profile metadata should expose memory and profile rows');
assert.deepEqual(
  entries.map((entry) => ({ id: entry.id, type: entry.type, name: entry.name })),
  [
    { id: 'project-memory:/Users/kevink/Projects/OpenHarness', type: 'file', name: 'Project memory' },
    { id: 'project-profile:/Users/kevink/Projects/OpenHarness', type: 'context', name: 'Project profile' },
  ],
  'assistant memory inventory should expose stable project memory and profile rows',
);
assert.match(entries[0].description, /3 line/, 'project memory description should include line count');
assert.match(entries[0].description, /45 chars/, 'project memory description should include character count');
assert.equal(entries[0].path, '/Users/kevink/Projects/OpenHarness');
assert.equal(entries[0].lastAccessed?.toISOString(), '2026-06-26T12:00:00.000Z');
assert.match(entries[1].description, /name, validation/, 'profile row should summarize top-level profile keys');

const emptyEntries = buildAssistantMemoryEntries({
  ...loadedMemory,
  memoryMd: '',
  profile: null,
});
assert.equal(emptyEntries.length, 1, 'loaded empty project memory should still render a real project row');
assert.match(emptyEntries[0].description, /No project memory saved yet/, 'empty project memory should get a clear empty-state row');

assert.deepEqual(buildAssistantMemoryEntries(null), [], 'missing memory payload should produce no inventory rows');

const settingsPaneSource = readFileSync('src/components/settings/AssistantSettingsPanes.tsx', 'utf8');
assert.ok(
  settingsPaneSource.includes('api.getProjectMemory(workingDir)'),
  'Assistant memory pane should fetch live project memory for the active workspace',
);
assert.ok(
  settingsPaneSource.includes('useRef'),
  'Assistant memory pane should track in-flight memory loads so stale workspace responses cannot overwrite newer state',
);
assert.ok(
  settingsPaneSource.includes('const loadProjectMemory = useCallback(async () => {'),
  'Assistant memory pane should share one request helper between initial load and manual refresh',
);
assert.equal(
  settingsPaneSource.match(/api\.getProjectMemory\(workingDir\)/g)?.length,
  1,
  'Assistant memory pane should call getProjectMemory from one shared helper instead of duplicating fetch logic',
);
assert.ok(
  settingsPaneSource.includes('if (requestId !== memoryLoadSeq.current) return;'),
  'Assistant memory pane should ignore stale project-memory responses after workspace changes or newer refreshes',
);
assert.ok(
  settingsPaneSource.includes('buildAssistantMemoryEntries(memory)'),
  'Assistant memory pane should render normalized live memory inventory rows',
);
assert.ok(
  !settingsPaneSource.includes('Demo memory examples. Live Codex memory inventory is not wired'),
  'Assistant memory pane should remove the stale demo-only copy',
);

const settingsModalSource = readFileSync('src/components/SettingsModal.tsx', 'utf8');
assert.ok(
  !settingsModalSource.includes('mockMemoryEntries'),
  'SettingsModal should not import or pass demo memory rows',
);
assert.ok(
  settingsModalSource.includes('<AssistantMemoryPane workingDir={workingDir} />'),
  'SettingsModal should pass the active working directory to AssistantMemoryPane',
);

const packageSource = readFileSync('package.json', 'utf8');
assert.ok(packageSource.includes('test:assistant-memory-pane'), 'package.json should expose the Assistant memory pane regression');

console.log('Assistant memory pane checks passed.');
