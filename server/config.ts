/**
 * OpenHarness persistent configuration
 * Stores providers, MCP servers, personality, theme to ~/.openharness/config.json
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
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
  accessMode?: 'api-key' | 'subscription';
  planId?: string;
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


/**
 * Auto-router configuration for per-task model selection.
 * When enabled, a cheap classifier model scores each candidate
 * on task fitness; the cheapest viable candidate wins.
 * Ported from UltraCode-Shim's auto-router design.
 */
export interface AutoRouterConfig {
  /** Master switch — off by default */
  enabled: boolean;
  /** Classifier model ID (cheapest model for scoring) */
  classifierModel: string;
  /** Quality bar 0–1; cheapest candidate scoring >= this wins */
  threshold: number;
  /** Fallback model when classifier can't run */
  defaultModel: string;
  /** Per-task cache TTL in milliseconds */
  cacheTTLMs: number;
  /** Candidate models the router chooses among */
  candidates: AutoRouterCandidateConfig[];
}

export interface AutoRouterCandidateConfig {
  /** Model ID (must resolve to a configured provider) */
  modelId: string;
  /** Relative cost weight — only ordering matters */
  cost: number;
  /** Whether this model can accept image attachments */
  supportsImages: boolean;
  /** Short capability description for the classifier */
  card: string;
}

/**
 * Context budget configuration controls.
 * Controls which sections are included or excluded from the context window.
 */
export interface ContextConfig {
  /** Maximum tokens for repo map summary */
  repoMapBudget: number;
  /** Maximum tokens for context pack */
  contextPackBudget: number;
  /** Always include these section IDs in the context window */
  includePatterns: string[];
  /** Never include these section IDs in the context window */
  neverIncludePatterns: string[];
  /** Compress tool outputs aggressively to save tokens */
  compressToolOutputs: boolean;
  /** Safety margin as fraction of total (0.0-0.2) */
  safetyMargin: number;
  /** Minimum recent pairs to always keep intact */
  minRecentPairs: number;
}

export interface StoredConfig {
  version: number;
  providers: StoredProvider[];
  mcpServers: StoredMCPServer[];
  personality: string;
  activeModel: string;
  activeTheme: string;
  roleAssignments: Record<string, string>; // roleId -> modelId
  autoRouter?: AutoRouterConfig;
  contextConfig?: Partial<ContextConfig>;
  trustMode: string; // TrustMode
}

// ── Config path ────────────────────────────────────────

const LEGACY_CONFIG_DIR = join(homedir(), '.open-harness');
const CONFIG_DIR = join(homedir(), '.openharness');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

export function getConfigPath(): string {
  return CONFIG_PATH;
}

const DEFAULT_CONFIG: StoredConfig = {
  version: 1,
  providers: [
    {
      id: 'minimax',
      name: 'MiniMax',
      type: 'openai-compatible',
      apiKey: '',
      baseURL: 'https://api.minimax.io/v1',
      accessMode: 'subscription',
      planId: 'token-plan-pro',
      models: [
        { id: 'MiniMax-M3', name: 'MiniMax M3', enabled: true },
        { id: 'MiniMax-M2.7', name: 'MiniMax M2.7', enabled: true },
      ],
    },
  ],
  mcpServers: [],
  personality: '',
  activeModel: 'MiniMax-M3',
  activeTheme: 'midnight',
  trustMode: 'workspace-write',
  roleAssignments: {
    coder: 'MiniMax-M3',         // Primary coding agent
    reasoner: 'MiniMax-M3',      // Complex reasoning / planning
    summarizer: 'MiniMax-M3',    // Text summarization
    title: 'MiniMax-M3',         // Short title generation
    planner: 'MiniMax-M3',       // Task decomposition
    reviewer: 'MiniMax-M3',      // Code review
    worker: 'MiniMax-M3',        // Fast parallel tasks
  },
  contextConfig: {
    repoMapBudget: 2000,
    contextPackBudget: 3000,
    includePatterns: ['system', 'projectProfile'],
    neverIncludePatterns: [],
    compressToolOutputs: true,
    safetyMargin: 0.05,
    minRecentPairs: 2,
  },
};

// ── Read / Write ───────────────────────────────────────

export function loadConfig(): StoredConfig {
  try {
    migrateLegacyConfigDir();
    if (!existsSync(CONFIG_PATH)) {
      // Try to bootstrap MiniMax key from existing mmx config
      const mmxKey = tryReadMmxKey();
      const config = cloneDefaultConfig();
      if (mmxKey) {
        config.providers[0].apiKey = mmxKey;
      }
      saveConfig(config);
      return config;
    }
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as StoredConfig;
    // Merge with defaults for forward-compat
    const normalizedProviders = (parsed.providers || cloneDefaultConfig().providers).map((provider) => ({
      ...provider,
      apiKey: typeof provider.apiKey === 'string' ? provider.apiKey.trim() : '',
      accessMode: (provider.accessMode === 'subscription' ? 'subscription' : 'api-key') as StoredProvider['accessMode'],
      planId: typeof provider.planId === 'string' && provider.planId ? provider.planId : undefined,
    }));
    return {
      ...cloneDefaultConfig(),
      ...parsed,
      providers: normalizedProviders,
      mcpServers: parsed.mcpServers || [],
      trustMode: parsed.trustMode || DEFAULT_CONFIG.trustMode,
      roleAssignments: {
        ...DEFAULT_CONFIG.roleAssignments,
        ...normalizeRoleAssignments(parsed.roleAssignments || {}),
      },
    };
  } catch {
    return cloneDefaultConfig();
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

function migrateLegacyConfigDir(): void {
  if (existsSync(CONFIG_DIR) || !existsSync(LEGACY_CONFIG_DIR)) return;
  try {
    cpSync(LEGACY_CONFIG_DIR, CONFIG_DIR, { recursive: true, errorOnExist: false });
  } catch {
    // Best-effort migration; fall back to bootstrapping a fresh config.
  }
}

// ── Provider resolution ───────────────────────────────

export interface ResolvedProvider {
  provider: StoredProvider;
  apiKey: string;
  chatURL: string;
}

/** Find the provider that owns a given model, and build its chat completions URL. */
export function getProviderForModel(config: StoredConfig, modelId: string): ResolvedProvider | null {
  const { providerId, bareModelId } = splitModelRef(modelId);
  for (const provider of config.providers) {
    if (providerId && provider.id !== providerId) continue;
    const match = provider.models.find((m) => m.id === bareModelId && m.enabled);
    if (match) {
      return {
        provider,
        apiKey: provider.apiKey,
        chatURL: buildChatURL(provider),
      };
    }
  }
  return null;
}

export function splitModelRef(modelRef: string): { providerId?: string; bareModelId: string } {
  const idx = modelRef.indexOf(':');
  if (idx <= 0) return { bareModelId: modelRef };
  return {
    providerId: modelRef.slice(0, idx),
    bareModelId: modelRef.slice(idx + 1),
  };
}

function buildChatURL(provider: StoredProvider): string {
  const base = provider.baseURL.replace(/\/+$/, '');
  if (/\/chat\/completions$/i.test(base)) return base;
  if (/\/v\d+$/i.test(base)) return `${base}/chat/completions`;
  if (base.includes('/v1/')) return `${base.split('/v1/')[0]}/v1/chat/completions`;
  const versionMatch = base.match(/(.*\/v\d+)\/.*/i);
  if (versionMatch) return `${versionMatch[1]}/chat/completions`;
  return `${base}/v1/chat/completions`;
}

function cloneDefaultConfig(): StoredConfig {
  return structuredClone(DEFAULT_CONFIG);
}

function normalizeRoleAssignments(assignments: Record<string, string>): Record<string, string> {
  const legacyToCurrent: Record<string, string> = {
    planning: 'planner',
    implementation: 'coder',
    bugfix: 'coder',
    design: 'coder',
    image: 'worker',
    toolrunning: 'worker',
    review: 'reviewer',
  };

  const normalized: Record<string, string> = {};
  for (const [role, modelId] of Object.entries(assignments)) {
    normalized[legacyToCurrent[role] || role] = modelId;
  }
  return normalized;
}
