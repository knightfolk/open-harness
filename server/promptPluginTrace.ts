import type { PromptPluginSelectionResult } from './promptPlugins';
import type { HarnessRunStep } from './runTrace';

type PromptPluginTraceStep = Extract<HarnessRunStep, { type: 'prompt_plugins' }>;

export function buildPromptPluginSelectionTraceStep(selection: PromptPluginSelectionResult): PromptPluginTraceStep {
  return {
    type: 'prompt_plugins',
    enabled: true,
    allowedPluginCount: selection.telemetry.allowedPluginCount,
    selectedPluginIds: selection.plugins.map((plugin) => plugin.id),
    selectedSectionCount: selection.telemetry.selectedSectionCount,
    selectionDurationMs: selection.telemetry.selectionDurationMs,
    manifestsScanned: selection.telemetry.manifestsScanned,
    cache: selection.telemetry.cache,
  };
}
