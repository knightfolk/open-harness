import type { HarnessRun } from '../types';

type PromptPluginStep = Extract<HarnessRun['steps'][number], { type: 'prompt_plugins' }>;

function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function promptPluginRuntimeCostSummary(step: PromptPluginStep): string {
  const duration = `${step.selectionDurationMs}ms`;
  if (step.manifestsScanned <= 0 && step.cache.hits <= 0 && step.cache.misses <= 0) {
    return `No plugin manifest work, ${duration}`;
  }

  const hits = countLabel(step.cache.hits, 'cache hit');
  const misses = countLabel(step.cache.misses, 'cache miss', 'cache misses');
  if (step.manifestsScanned > 0) {
    return `Scanned ${countLabel(step.manifestsScanned, 'manifest')}, ${hits}, ${misses}, ${duration}`;
  }

  if (step.cache.misses === 0 && step.cache.hits > 0) {
    return `Cache-only selection, ${hits}, ${misses}, ${duration}`;
  }

  if (step.cache.hits > step.cache.misses) {
    return `Mostly cached selection, ${hits}, ${misses}, ${duration}`;
  }

  return `Cache checked, ${hits}, ${misses}, ${duration}`;
}
