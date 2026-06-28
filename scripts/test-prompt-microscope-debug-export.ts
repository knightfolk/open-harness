import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const componentSource = readFileSync('src/components/PromptMicroscope.tsx', 'utf8');

for (const expected of [
  "type PromptMicroscopeExportState = 'idle' | 'exporting' | 'exported' | 'failed'",
  "const [exportState, setExportState] = useState<PromptMicroscopeExportState>('idle')",
  "const [exportManifest, setExportManifest] = useState<api.RunDebugBundleManifest | null>(null)",
  "if (!runTrace || exportState === 'exporting') return",
  "setExportState('exporting')",
  "const manifest = await api.downloadRunDebugBundle(runTrace.id)",
  "setExportManifest(manifest)",
  "setExportState('exported')",
  "setExportState('failed')",
  "const exportButtonLabel = exportState === 'exporting'",
  "const exportManifestHint = exportManifest ? formatRunDebugBundleManifestHint(exportManifest) : ''",
  "disabled={exportState === 'exporting'}",
  "title=\"Export this run's replay, prompts, routing, artifacts, and proof bundle\"",
  "aria-label={`Export this run's replay, prompts, routing, artifacts, and proof bundle for run ${runTrace.id.slice(0, 8)}`}",
  "{exportButtonLabel}",
  "{exportManifestHint && (",
  "{exportManifestHint}",
]) {
  assert.ok(componentSource.includes(expected), `Prompt Microscope debug export should expose guarded export state: ${expected}`);
}

assert.ok(
  !componentSource.includes("title=\"Export run replay and support data\""),
  'Prompt Microscope debug export should use the clearer replay/prompt/routing/proof copy',
);
assert.ok(
  !componentSource.includes("exportStatus || 'Export'"),
  'Prompt Microscope debug export should not rely on a loose status string for button text',
);

console.log('Prompt Microscope debug export checks passed.');
