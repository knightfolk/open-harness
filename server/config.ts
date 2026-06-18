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

export interface StoredProviderOAuth {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  scopes?: string[];
  accountLabel?: string;
  connectedAt?: string;
}

export interface StoredProvider {
  id: string;
  name: string;
  type: 'openai-compatible' | 'anthropic' | 'google' | 'local' | 'custom';
  apiKey: string;
  baseURL: string;
  accessMode?: 'api-key' | 'subscription';
  planId?: string;
  oauth?: StoredProviderOAuth;
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

export type ThinkingEffort = 'low' | 'medium' | 'high' | 'xhigh';


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
  /** Whether this model exposes native thinking/reasoning output */
  supportsThinking?: boolean;
  /** Optional override for native/tool-call reliability. Defaults from model family profile. */
  toolCallQuality?: 'excellent' | 'good' | 'basic' | 'none';
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

export interface ModelBudget {
  /** Model ID, or "*" for a global default budget */
  modelId: string;
  /** Max input tokens per budget period; 0 disables this limit */
  maxInputTokens: number;
  /** Max output tokens per budget period; 0 disables this limit */
  maxOutputTokens: number;
  /** Max estimated cost per budget period; 0 disables this limit */
  maxCost: number;
  /** Budget reset period */
  period: 'monthly' | 'weekly' | 'daily';
  /** What to do when the budget is exceeded */
  onExceeded: 'block' | 'warn' | 'allow';
}

export interface ProviderRateLimit {
  /** Provider ID, or "*" for a global default rate limit */
  providerId: string;
  /** Maximum provider requests per rolling minute; 0 disables this limit */
  maxRequestsPerMinute: number;
  /** Maximum estimated input+output tokens per rolling minute; 0 disables this limit */
  maxTokensPerMinute: number;
  /** What to do when the rate limit is exceeded */
  onExceeded: 'block' | 'warn' | 'allow';
}

export interface StoredConfig {
  version: number;
  providers: StoredProvider[];
  mcpServers: StoredMCPServer[];
  personality: string;
  activeModel: string;
  activeTheme: string;
  installedThemePluginManifests?: string[];
  favoriteModels?: string[];
  roleAssignments: Record<string, string>; // roleId -> modelId
  thinkingEffort?: ThinkingEffort;
  roleThinking?: Record<string, ThinkingEffort>;
  autoRouter?: AutoRouterConfig;
  contextConfig?: Partial<ContextConfig>;
  modelBudgets?: ModelBudget[];
  providerRateLimits?: ProviderRateLimit[];
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
  providers: [],
  mcpServers: [],
  personality: '',
  activeModel: 'Auto',
  activeTheme: 'midnight',
  installedThemePluginManifests: [],
  favoriteModels: [],
  trustMode: 'workspace-write',
  thinkingEffort: 'medium',
  roleThinking: {
    coder: 'medium',
    reasoner: 'xhigh',
    summarizer: 'low',
    title: 'medium',
    planner: 'medium',
    reviewer: 'high',
    worker: 'low',
  },
  roleAssignments: {
    coder: 'Auto',         // Primary coding agent
    reasoner: 'Auto',      // Complex reasoning / planning
    summarizer: 'Auto',    // Text summarization
    title: 'Auto',         // Short title generation
    planner: 'Auto',       // Task decomposition
    reviewer: 'Auto',      // Code review
    worker: 'Auto',        // Fast parallel tasks
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
  modelBudgets: [],
  providerRateLimits: [],
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
        config.providers.push(createMiniMaxProvider(mmxKey));
        config.activeModel = 'MiniMax-M3';
        config.roleAssignments = Object.fromEntries(
          Object.keys(config.roleAssignments).map((role) => [role, 'MiniMax-M3'])
        );
      }
      saveConfig(config);
      return config;
    }
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as StoredConfig;
    // Merge with defaults for forward-compat
    const normalizedProviders = hydrateProviderEnvCredentials(repairProviderAliasCredentials((parsed.providers || cloneDefaultConfig().providers).map((provider) => ({
      ...provider,
      apiKey: typeof provider.apiKey === 'string' ? provider.apiKey.trim() : '',
      accessMode: (provider.accessMode === 'subscription' ? 'subscription' : 'api-key') as StoredProvider['accessMode'],
      planId: typeof provider.planId === 'string' && provider.planId ? provider.planId : undefined,
      oauth: normalizeProviderOAuth((provider as any).oauth),
    }))));
    const normalizedFavoriteModels = Array.isArray(parsed.favoriteModels)
      ? [...new Set(parsed.favoriteModels.filter((id): id is string => typeof id === 'string').map((id) => id.trim()).filter(Boolean))]
      : [];
    const normalizedThemeManifests = Array.isArray(parsed.installedThemePluginManifests)
      ? [...new Set(parsed.installedThemePluginManifests
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0))]
      : [];
    return {
      ...cloneDefaultConfig(),
      ...parsed,
      providers: normalizedProviders,
      mcpServers: parsed.mcpServers || [],
      favoriteModels: normalizedFavoriteModels,
      installedThemePluginManifests: normalizedThemeManifests,
      trustMode: parsed.trustMode || DEFAULT_CONFIG.trustMode,
      thinkingEffort: normalizeThinkingEffort((parsed as any).thinkingEffort),
      roleThinking: normalizeRoleThinking((parsed as any).roleThinking || {}),
      roleAssignments: {
        ...DEFAULT_CONFIG.roleAssignments,
        ...normalizeRoleAssignments(parsed.roleAssignments || {}),
      },
      modelBudgets: normalizeModelBudgets((parsed as any).modelBudgets),
      providerRateLimits: normalizeProviderRateLimits((parsed as any).providerRateLimits),
    };
  } catch {
    return cloneDefaultConfig();
  }
}

function normalizeProviderRateLimits(value: unknown): ProviderRateLimit[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): ProviderRateLimit | null => {
      if (!entry || typeof entry !== 'object') return null;
      const item = entry as any;
      const providerId = typeof item.providerId === 'string' && item.providerId.trim() ? item.providerId.trim() : '';
      if (!providerId) return null;
      const onExceeded = item.onExceeded === 'block' || item.onExceeded === 'warn' || item.onExceeded === 'allow' ? item.onExceeded : 'warn';
      return {
        providerId,
        maxRequestsPerMinute: Math.max(0, Number(item.maxRequestsPerMinute) || 0),
        maxTokensPerMinute: Math.max(0, Number(item.maxTokensPerMinute) || 0),
        onExceeded,
      };
    })
    .filter((entry): entry is ProviderRateLimit => !!entry);
}

function normalizeModelBudgets(value: unknown): ModelBudget[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): ModelBudget | null => {
      if (!entry || typeof entry !== 'object') return null;
      const item = entry as any;
      const modelId = typeof item.modelId === 'string' && item.modelId.trim() ? item.modelId.trim() : '';
      if (!modelId) return null;
      const period = item.period === 'daily' || item.period === 'weekly' || item.period === 'monthly' ? item.period : 'monthly';
      const onExceeded = item.onExceeded === 'block' || item.onExceeded === 'warn' || item.onExceeded === 'allow' ? item.onExceeded : 'warn';
      return {
        modelId,
        maxInputTokens: Math.max(0, Number(item.maxInputTokens) || 0),
        maxOutputTokens: Math.max(0, Number(item.maxOutputTokens) || 0),
        maxCost: Math.max(0, Number(item.maxCost) || 0),
        period,
        onExceeded,
      };
    })
    .filter((entry): entry is ModelBudget => !!entry);
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

function createMiniMaxProvider(apiKey: string): StoredProvider {
  return {
    id: 'minimax',
    name: 'MiniMax',
    type: 'openai-compatible',
    apiKey,
    baseURL: 'https://api.minimax.io/v1',
    accessMode: 'subscription',
    planId: 'token-plan-pro',
    models: [
      { id: 'MiniMax-M3', name: 'MiniMax M3', enabled: true },
      { id: 'MiniMax-M2.7', name: 'MiniMax M2.7', enabled: true },
    ],
  };
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

export function providerAuthToken(provider: StoredProvider): string {
  return provider.apiKey || provider.oauth?.accessToken || '';
}

/** Find the provider that owns a given model, and build its chat completions URL. */
export function getProviderForModel(config: StoredConfig, modelId: string): ResolvedProvider | null {
  const { providerId, bareModelId } = splitModelRef(modelId);
  for (const provider of config.providers) {
    if (providerId && provider.id !== providerId) continue;
    if (!providerCanAuthenticate(provider)) continue;
    const match = provider.models.find((m) => m.id === bareModelId && m.enabled);
    if (match) {
      return {
        provider,
        apiKey: providerAuthToken(provider),
        chatURL: buildChatURL(provider),
      };
    }
  }
  return null;
}

function providerCanAuthenticate(provider: StoredProvider): boolean {
  return provider.type === 'local'
    || !!provider.apiKey
    || !!provider.oauth?.accessToken;
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

function normalizeProviderOAuth(value: unknown): StoredProviderOAuth | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const oauth: StoredProviderOAuth = {};
  if (typeof raw.accessToken === 'string' && raw.accessToken.trim()) oauth.accessToken = raw.accessToken.trim();
  if (typeof raw.refreshToken === 'string' && raw.refreshToken.trim()) oauth.refreshToken = raw.refreshToken.trim();
  if (typeof raw.expiresAt === 'number' && Number.isFinite(raw.expiresAt)) oauth.expiresAt = raw.expiresAt;
  if (Array.isArray(raw.scopes)) oauth.scopes = raw.scopes.filter((scope): scope is string => typeof scope === 'string' && scope.trim().length > 0);
  if (typeof raw.accountLabel === 'string' && raw.accountLabel.trim()) oauth.accountLabel = raw.accountLabel.trim();
  if (typeof raw.connectedAt === 'string' && raw.connectedAt.trim()) oauth.connectedAt = raw.connectedAt.trim();
  return Object.keys(oauth).length > 0 ? oauth : undefined;
}

export function repairProviderAliasCredentials(providers: StoredProvider[]): StoredProvider[] {
  const aliasGroups = [
    new Set(['z-ai-zhipu', 'zhipu']),
  ];

  return providers.map((provider) => {
    const group = aliasGroups.find((aliases) => aliases.has(provider.id));
    if (!group) return provider;

    const siblings = providers.filter((candidate) => group.has(candidate.id));
    const credentialSource = siblings.find((candidate) => candidate.apiKey)
      || siblings.find((candidate) => candidate.oauth?.accessToken);
    const allModels = new Map<string, StoredProviderModel>();
    for (const sibling of siblings) {
      for (const model of sibling.models || []) {
        allModels.set(model.id, model);
      }
    }

    return {
      ...provider,
      apiKey: provider.apiKey || credentialSource?.apiKey || '',
      oauth: provider.oauth || credentialSource?.oauth,
      models: provider.models.length > 0 ? provider.models : Array.from(allModels.values()),
    };
  });
}

function providerEnvKeys(provider: StoredProvider): string[] {
  const normalizedId = provider.id.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  const normalizedName = provider.name.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  const keys = [
    `${normalizedId}_API_KEY`,
    `${normalizedName}_API_KEY`,
    `OPENHARNESS_${normalizedId}_API_KEY`,
  ];
  if (/minimax/i.test(`${provider.id} ${provider.name}`)) {
    keys.push('MINIMAX_API_KEY', 'ZENCODER_MINIMAX_API_KEY');
  }
  if (/(z[-_ ]?ai|zhipu|glm)/i.test(`${provider.id} ${provider.name}`)) {
    keys.push('ZAI_API_KEY', 'ZENCODER_ZAI_API_KEY');
  }
  if (/opencode/i.test(`${provider.id} ${provider.name}`)) {
    keys.push('OPENCODE_API_KEY', 'ZENCODER_OPENCODE_GO_API_KEY');
  }
  return Array.from(new Set(keys));
}

function hydrateProviderEnvCredentials(providers: StoredProvider[]): StoredProvider[] {
  return providers.map((provider) => {
    if (provider.apiKey || provider.type === 'local') return provider;
    const envKey = providerEnvKeys(provider).find((key) => process.env[key]?.trim());
    if (!envKey) return provider;
    return { ...provider, apiKey: process.env[envKey]!.trim() };
  });
}

function normalizeThinkingEffort(value: unknown): ThinkingEffort {
  return value === 'low' || value === 'high' || value === 'xhigh' ? value : 'medium';
}

function normalizeRoleThinking(assignments: Record<string, unknown>): Record<string, ThinkingEffort> {
  const legacyToCurrent: Record<string, string> = {
    planning: 'planner',
    implementation: 'coder',
    bugfix: 'coder',
    design: 'coder',
    image: 'worker',
    toolrunning: 'worker',
    review: 'reviewer',
  };

  const normalized: Record<string, ThinkingEffort> = { ...(DEFAULT_CONFIG.roleThinking || {}) };
  for (const [role, effort] of Object.entries(assignments)) {
    normalized[legacyToCurrent[role] || role] = normalizeThinkingEffort(effort);
  }
  return normalized;
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
