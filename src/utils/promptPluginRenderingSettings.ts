import type { CapabilityItem, PromptPluginRenderingConfig } from './api';

export interface PromptPluginInjectionRow extends CapabilityItem {
  manifestId: string;
  allowed: boolean;
  injectable: boolean;
  reason: string;
}

export function promptPluginManifestId(id: string): string {
  const trimmed = id.trim();
  return trimmed.startsWith('prompt-plugin.') ? trimmed.slice('prompt-plugin.'.length) : trimmed;
}

function cleanAllowlist(ids: readonly string[] | undefined): string[] {
  return [...new Set((ids || [])
    .filter((id): id is string => typeof id === 'string')
    .map((id) => promptPluginManifestId(id))
    .map((id) => id.trim())
    .filter(Boolean))]
    .sort();
}

export function normalizePromptPluginRenderingConfig(
  config: PromptPluginRenderingConfig | null | undefined,
): PromptPluginRenderingConfig {
  const enabled = config?.enabled === true;
  return {
    enabled,
    allowedPluginIds: enabled ? cleanAllowlist(config?.allowedPluginIds) : [],
  };
}

export function togglePromptPluginRenderingEnabled(
  config: PromptPluginRenderingConfig | null | undefined,
  enabled: boolean,
): PromptPluginRenderingConfig {
  const current = normalizePromptPluginRenderingConfig(config);
  return {
    enabled,
    allowedPluginIds: enabled ? current.allowedPluginIds : [],
  };
}

export function togglePromptPluginInjectionAllowed(
  config: PromptPluginRenderingConfig | null | undefined,
  pluginId: string,
  allowed: boolean,
): PromptPluginRenderingConfig {
  const current = normalizePromptPluginRenderingConfig(config);
  if (!current.enabled) return current;
  const next = new Set(current.allowedPluginIds);
  const manifestId = promptPluginManifestId(pluginId);
  if (allowed) next.add(manifestId);
  else next.delete(manifestId);
  return {
    enabled: true,
    allowedPluginIds: [...next].sort(),
  };
}

export function buildPromptPluginInjectionRows(
  items: readonly CapabilityItem[],
  config: PromptPluginRenderingConfig | null | undefined,
): PromptPluginInjectionRow[] {
  const rendering = normalizePromptPluginRenderingConfig(config);
  const allowed = new Set(rendering.allowedPluginIds);
  return items
    .filter((item) => item.source === 'prompt-plugin')
    .map((item): PromptPluginInjectionRow => {
      const manifestId = promptPluginManifestId(item.id);
      const injectable = item.enabled && item.status === 'ready';
      const reason = !item.enabled
        ? 'Turn the plugin on before allowing prompt injection.'
        : item.status !== 'ready'
          ? (item.issue || `Plugin is ${item.status}.`)
          : '';
      return {
        ...item,
        manifestId,
        injectable,
        reason,
        allowed: rendering.enabled && injectable && allowed.has(manifestId),
      };
    });
}
