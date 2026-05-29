/**
 * Open-Harness persistent configuration
 * Stores providers, MCP servers, personality, theme to ~/.open-harness/config.json
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// ── Types ──────────────────────────────────────────────

export interface StoredProviderModel {
  id: string;
  name: string;
  enabled: boolean;
}

export interface StoredProvider {
  id: string;
  name: string;
  type: 'openai-compatible' | 'anthropic' | 'google' | 'local' | 'custom';
  apiKey: string;
  baseURL: string;
  models: StoredProviderModel[];
}

export interface StoredMCPServer {
  id: string;
  name: string;
  endpoint: string;
  authType: 'none' | 'bearer';
  authToken: string;
  enabled: boolean;
  toolCount?: number;
}

export interface StoredConfig {
  version: number;
  providers: StoredProvider[];
  mcpServers: StoredMCPServer[];
  personality: string;
  activeModel: string;
  activeTheme: string;
  roleAssignments: Record<string, string>; // roleId -> modelId
}

// ── Config path ────────────────────────────────────────

const CONFIG_DIR = join(homedir(), '.open-harness');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: StoredConfig = {
  version: 1,
  providers: [
    {
      id: 'minimax',
      name: 'MiniMax',
      type: 'openai-compatible',
      apiKey: '',
      baseURL: 'https://api.minimax.io/v1',
      models: [
        { id: 'MiniMax-M2.7', name: 'MiniMax M2.7', enabled: true },
      ],
    },
  ],
  mcpServers: [],
  personality: '',
  activeModel: 'MiniMax-M2.7',
  activeTheme: 'midnight',
  roleAssignments: {},
};

// ── Read / Write ───────────────────────────────────────

export function loadConfig(): StoredConfig {
  try {
    if (!existsSync(CONFIG_PATH)) {
      // Try to bootstrap MiniMax key from existing mmx config
      const mmxKey = tryReadMmxKey();
      const config = { ...DEFAULT_CONFIG };
      if (mmxKey) {
        config.providers[0].apiKey = mmxKey;
      }
      saveConfig(config);
      return config;
    }
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as StoredConfig;
    // Merge with defaults for forward-compat
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: StoredConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

// ── Provider helpers ───────────────────────────────────

export function getProvider(config: StoredConfig, providerId: string): StoredProvider | undefined {
  return config.providers.find((p) => p.id === providerId);
}

export function upsertProvider(config: StoredConfig, provider: StoredProvider): StoredConfig {
  const idx = config.providers.findIndex((p) => p.id === provider.id);
  if (idx >= 0) {
    config.providers[idx] = provider;
  } else {
    config.providers.push(provider);
  }
  return config;
}

export function removeProvider(config: StoredConfig, providerId: string): StoredConfig {
  config.providers = config.providers.filter((p) => p.id !== providerId);
  return config;
}

// ── MCP server helpers ────────────────────────────────

export function upsertMCPServer(config: StoredConfig, server: StoredMCPServer): StoredConfig {
  const idx = config.mcpServers.findIndex((s) => s.id === server.id);
  if (idx >= 0) {
    config.mcpServers[idx] = server;
  } else {
    config.mcpServers.push(server);
  }
  return config;
}

export function removeMCPServer(config: StoredConfig, serverId: string): StoredConfig {
  config.mcpServers = config.mcpServers.filter((s) => s.id !== serverId);
  return config;
}

// ── Bootstrap ─────────────────────────────────────────

function tryReadMmxKey(): string {
  try {
    const mmxConfig = JSON.parse(readFileSync(join(homedir(), '.mmx', 'config.json'), 'utf-8'));
    return mmxConfig.api_key || '';
  } catch {
    return '';
  }
}
