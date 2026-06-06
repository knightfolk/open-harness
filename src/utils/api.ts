import type { BrowserPreviewResult, PatchValidationResult } from '../types';
import { TOP_MODEL_CATALOG } from '../data/modelCatalog';

function defaultApiBase(): string {
  if (typeof window === 'undefined' || !window.location.hostname) return 'http://localhost:3001';
  const { protocol, hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return 'http://localhost:3001';
  }
  return `${protocol}//${hostname}:3001`;
}

function resolveApiBase(): string {
  const configured = import.meta.env.VITE_API_URL;
  if (!configured || typeof window === 'undefined') return configured || defaultApiBase();
  const hostname = window.location.hostname;
  const isLocalPage = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  if (!isLocalPage && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?/i.test(configured)) {
    return defaultApiBase();
  }
  return configured;
}

export const API_BASE = resolveApiBase();

// ── Types ──────────────────────────────────────────────


export interface HarnessRun {
  id: string;
  sessionId: string;
  userMessageId: string;
  role: 'coder' | 'planner' | 'reviewer' | 'summarizer' | 'worker' | 'reasoner';
  requestedModel: string;
  effectiveModel: string;
  providerId: string;
  status: 'running' | 'complete' | 'error';
  startedAt: string;
  completedAt?: string;
  context: { tokensUsed: number; budget: number; compressedCount: number; summarized: boolean };
  steps: HarnessRunStep[];
}

export type HarnessRunStep =
  | { type: 'orchestration'; mode: 'direct' | 'plan' | 'investigate' | 'execute' | 'compare'; label: string; detail?: string }
  | { type: 'route'; role: string; model: string; reason?: string }
  | { type: 'prompt_built'; promptPreview: string; toolCount: number }
  | { type: 'auto_router'; modelId: string; score: number; reason: string; cached: boolean; fallback: boolean; classifierModel: string | null }
  | { type: 'model_request'; round: number; model: string }
  | { type: 'tool_call'; id: string; name: string; input: unknown; outputPreview?: string; durationMs?: number }
  | { type: 'model_text'; chars: number }
  | { type: 'model_thinking'; chars: number; preview?: string; source: 'provider' | 'router' }
  | { type: 'final_answer'; chars: number }
  | { type: 'error'; message: string }
  | {
      type: 'repo_map';
      tokenBudget: number;
      totalFiles: number;
      truncated: boolean;
      topFiles: string[];
    }
  | {
      type: 'context_pack';
      pack: string;
      files: string[];
      tokens: number;
      reasons: Record<string, string>;
      suggestion: string;
    };

export interface SessionInfo {
  id: string;
  title: string;
  workingDir: string | null;
  createdAt: string;
  updatedAt: string;
  preview: string;
  messageCount: number;
}

export interface SessionDetail {
  id: string;
  title: string;
  workingDir: string | null;
  messages: MessageInfo[];
  createdAt: string;
  updatedAt: string;
}

export interface MessageInfo {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  toolCalls?: ToolCallInfo[];
  runTrace?: HarnessRun;
}

export interface ToolCallInfo {
  id: string;
  name: string;
  status: 'running' | 'complete' | 'error';
  input?: string;
  output?: string;
  duration?: number;
}

export interface StreamCallbacks {
  onUserMessage: (msg: MessageInfo) => void;
  onAssistantStart: (id: string) => void;
  onText: (id: string, text: string) => void;
  onAssistantMessage?: (msg: MessageInfo) => void;
  onToolCall: (toolCall: ToolCallInfo) => void;
  onRunStart?: (run: HarnessRun) => void;
  onRunStep?: (runId: string, step: HarnessRunStep) => void;
  onRunComplete?: (run: HarnessRun) => void;
  onError: (error: string) => void;
  onDone: () => void;
}

export interface SendMessageOptions {
  modelId?: string;
  sideChat?: {
    includeMainChat?: boolean;
    mainSessionId?: string;
  };
}

// ── Config API ─────────────────────────────────────────

export interface AutoRouterState {
  enabled: boolean;
  classifierModel: string | null;
  threshold: number;
  candidateCount: number;
  candidates: Array<{ modelId: string; cost: number; supportsImages: boolean; contextWindowTokens: number }>;
  cacheSize: number;
}

export interface AutoRouterCandidateConfig {
  modelId: string;
  cost: number;
  supportsImages: boolean;
  card: string;
}

export interface AutoRouterConfig {
  enabled: boolean;
  classifierModel: string;
  threshold: number;
  defaultModel: string;
  cacheTTLMs: number;
  candidates: AutoRouterCandidateConfig[];
}

export interface ContextConfig {
  repoMapBudget: number;
  contextPackBudget: number;
  includePatterns: string[];
  neverIncludePatterns: string[];
  compressToolOutputs: boolean;
  safetyMargin: number;
  minRecentPairs: number;
}

export interface AppConfig {
  version: number;
  configPath?: string;
  providers: ProviderInfo[];
  mcpServers: MCPServerInfo[];
  personality: string;
  activeModel: string;
  activeTheme: string;
  installedThemePluginManifests?: string[];
  favoriteModels?: string[];
  roleAssignments: Record<string, string>;
  trustMode: string;
  autoRouter?: AutoRouterConfig;
  contextConfig?: ContextConfig;
}

export async function getConfig(): Promise<AppConfig | null> {
  try {
    const res = await fetch(`${API_BASE}/api/config`);
    if (res.ok) return res.json();
  } catch { /* server not available */ }
  return null;
}

export async function updateConfig(updates: Partial<Pick<AppConfig, 'personality' | 'activeModel' | 'activeTheme' | 'roleAssignments' | 'trustMode' | 'contextConfig' | 'favoriteModels' | 'installedThemePluginManifests'>>): Promise<void> {
  await fetch(`${API_BASE}/api/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}


// ── Auto-Router APIs ───────────────────────────────────

export async function getRouterState(): Promise<AutoRouterState> {
  const res = await fetch(`${API_BASE}/api/router/state`);
  if (!res.ok) throw new Error(`Failed to get router state: ${res.status}`);
  return res.json();
}

export async function configureRouter(config: AutoRouterConfig): Promise<{ ok: boolean; state: AutoRouterState }> {
  const res = await fetch(`${API_BASE}/api/router/configure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(`Failed to configure router: ${res.status}`);
  return res.json();
}

export async function clearRouterCache(): Promise<void> {
  await fetch(`${API_BASE}/api/router/clear-cache`, { method: 'POST' });
}

export async function getRouterCandidates(): Promise<AutoRouterCandidateConfig[]> {
  const res = await fetch(`${API_BASE}/api/router/candidates`);
  if (!res.ok) throw new Error(`Failed to get router candidates: ${res.status}`);
  return res.json();
}


// ── Cost estimation helpers ────────────────────────────

/** Rough pricing per-million-tokens (USD). Same data as server/modelProfiles.ts. */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  ...Object.fromEntries(TOP_MODEL_CATALOG
    .filter((card) => card.inputCostPerMTok != null && card.outputCostPerMTok != null)
    .flatMap((card) => [card.id, ...card.aliases].map((id) => [id, { input: card.inputCostPerMTok!, output: card.outputCostPerMTok! }]))),
  'MiniMax-M3': { input: 0.15, output: 0.60 },
  'MiniMax-M2.7': { input: 1.50, output: 6.00 },
  'deepseek-chat': { input: 0.27, output: 1.10 },
  'claude-sonnet-4-6': { input: 3.00, output: 15.00 },
  'gpt-4.1': { input: 2.00, output: 8.00 },
  'gpt-4.1-mini': { input: 0.40, output: 1.60 },
  'mistral-large': { input: 2.00, output: 8.00 },
  'grok-3': { input: 3.00, output: 15.00 },
  'qwen-3-235b': { input: 1.00, output: 4.00 },
};

export function estimateModelCost(modelId: string, inputTokens: number, outputTokens: number): { inputCost: number; outputCost: number; total: number } | null {
  const bareId = modelId.includes(':') ? modelId.split(':').slice(1).join(':') : modelId;
  const pricing = MODEL_PRICING[bareId] || MODEL_PRICING[modelId];
  if (!pricing) return null;
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return { inputCost, outputCost, total: inputCost + outputCost };
}

// ── Provider APIs ──────────────────────────────────────

export interface ProviderInfo {
  id: string;
  name: string;
  type: string;
  apiKey: string;
  hasKey?: boolean;
  baseURL: string;
  accessMode?: 'api-key' | 'subscription';
  planId?: string;
  models: ProviderModelInfo[];
}

export interface ProviderModelInfo {
  id: string;
  name: string;
  enabled: boolean;
}

export interface LocalProviderDiscovery {
  id: string;
  name: string;
  type: string;
  baseURL: string;
  reachable: boolean;
  latencyMs: number;
  modelsCount?: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  providerId: string;
  providerName: string;
  type: string;
  family: string;
  contextWindowTokens: number;
}

export async function getProviders(): Promise<ProviderInfo[]> {
  try {
    const res = await fetch(`${API_BASE}/api/providers`);
    if (res.ok) return res.json();
  } catch { /* not available yet */ }
  return [];
}

export async function discoverLocalProviders(): Promise<LocalProviderDiscovery[]> {
  try {
    const res = await fetch(`${API_BASE}/api/providers/local-discovery`);
    if (res.ok) return res.json();
  } catch { /* local discovery is optional */ }
  return [];
}

export async function addProvider(provider: { id?: string; name: string; type: string; apiKey: string; baseURL: string; accessMode?: 'api-key' | 'subscription'; planId?: string; models?: ProviderModelInfo[] }): Promise<ProviderInfo> {
  const res = await fetch(`${API_BASE}/api/providers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(provider),
  });
  if (!res.ok) throw new Error(`Failed to add provider: ${res.status}`);
  return res.json();
}

export async function updateProvider(id: string, updates: Partial<ProviderInfo>): Promise<ProviderInfo> {
  const res = await fetch(`${API_BASE}/api/providers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`Failed to update provider: ${res.status}`);
  return res.json();
}

export async function deleteProvider(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/providers/${id}`, { method: 'DELETE' });
}

export interface TestConnectionResult {
  ok: boolean;
  error?: string;
  latencyMs?: number;
  modelsCount?: number;
}

export async function testProviderConnection(providerId: string, tempKey?: string, tempURL?: string): Promise<TestConnectionResult> {
  const res = await fetch(`${API_BASE}/api/providers/${providerId}/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: tempKey, baseURL: tempURL }),
  });
  if (!res.ok) throw new Error(`Test failed: ${res.status}`);
  return res.json();
}

export interface FetchedModel {
  id: string;
  name: string;
}

export async function fetchProviderModels(providerId: string, tempKey?: string, tempURL?: string): Promise<FetchedModel[]> {
  const res = await fetch(`${API_BASE}/api/providers/${providerId}/models`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: tempKey, baseURL: tempURL }),
  });
  if (!res.ok) throw new Error(`Fetch models failed: ${res.status}`);
  return res.json();
}

export async function getModels(): Promise<ModelInfo[]> {
  try {
    const res = await fetch(`${API_BASE}/api/models`);
    if (res.ok) return res.json();
  } catch { /* not available yet */ }
  return [];
}

export async function setModel(modelID: string): Promise<void> {
  await updateConfig({ activeModel: modelID });
}

// ── MCP Server APIs ────────────────────────────────────

export interface MCPServerInfo {
  id: string;
  name: string;
  endpoint: string;
  authType: 'none' | 'bearer';
  authToken: string;
  enabled: boolean;
  builtIn?: boolean;
  description?: string;
  toolCount?: number;
}

export async function getMCPServers(): Promise<MCPServerInfo[]> {
  try {
    const res = await fetch(`${API_BASE}/api/mcp-servers`);
    if (res.ok) return res.json();
  } catch { /* not available yet */ }
  return [];
}

export interface MCPToolStatus {
  name: string;
  description: string;
  inputSchema: any;
  allowed?: boolean;
}

export interface MCPServerStatus {
  id: string;
  name: string;
  running: boolean;
  toolCount: number;
  usableToolCount?: number;
  blockedToolCount?: number;
  resourceCount: number;
  tools?: MCPToolStatus[];
  error?: string;
}

export async function getMCPStatus(): Promise<MCPServerStatus[]> {
  try {
    const res = await fetch(`${API_BASE}/api/mcp/status`);
    if (res.ok) return res.json();
  } catch { /* not available yet */ }
  return [];
}

export async function startMCPServer(serverId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/mcp/${serverId}/start`, { method: 'POST' });
  if (!res.ok) throw new Error(await responseErrorMessage(res, 'Failed to start MCP server'));
  return res.json();
}

export async function stopMCPServer(serverId: string): Promise<void> {
  await fetch(`${API_BASE}/api/mcp/${serverId}/stop`, { method: 'POST' });
}

export async function addMCPServer(server: { name: string; endpoint: string; authType?: string; authToken?: string; enabled?: boolean }): Promise<MCPServerInfo> {
  const res = await fetch(`${API_BASE}/api/mcp-servers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(server),
  });
  if (!res.ok) throw new Error(`Failed to add MCP server: ${res.status}`);
  return res.json();
}

export async function deleteMCPServer(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/mcp-servers/${id}`, { method: 'DELETE' });
}

// ── Docker / Docker MCP readiness (Milestone 19) ──
export interface DockerReadiness {
  dockerInstalled: boolean;
  daemonRunning: boolean;
  dockerMcpAvailable: boolean;
  profileReady: boolean;
  version?: string;
  serverVersion?: string;
  mcpVersion?: string;
  profiles: string[];
  hints: string[];
  checkedAt: string;
}

export async function getDockerReadiness(): Promise<DockerReadiness | null> {
  try {
    const res = await fetch(`${API_BASE}/api/mcp/docker/readiness`);
    if (res.ok) return res.json();
  } catch { /* server not available */ }
  return null;
}

// ── Curated MCP catalog (Milestone 19) ──
export type CuratedPermission = 'local-files' | 'network-read' | 'network-write' | 'browser' | 'database' | 'containers' | 'shell' | 'memory';

export interface CuratedMcpServer {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: 'files' | 'git' | 'web' | 'database' | 'memory' | 'browser' | 'containers' | 'thinking';
  transport: 'stdio' | 'http';
  endpoint?: string;
  permissions: CuratedPermission[];
  requiresTrustMode: 'chat-only' | 'read-only' | 'workspace-write' | 'full-local';
  homepage?: string;
  installHint: string;
  installed: boolean;
  permissionSummary: string;
}

export async function getCuratedMcpServers(): Promise<CuratedMcpServer[]> {
  try {
    const res = await fetch(`${API_BASE}/api/mcp/curated`);
    if (res.ok) return res.json();
  } catch { /* not available yet */ }
  return [];
}

export async function installCuratedMcpServer(id: string): Promise<MCPServerInfo> {
  const res = await fetch(`${API_BASE}/api/mcp/curated/install`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error(`Failed to install curated MCP server: ${res.status}`);
  return res.json();
}

export async function restartMCPServer(serverId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/mcp/${serverId}/restart`, { method: 'POST' });
  if (!res.ok) throw new Error(await responseErrorMessage(res, 'Failed to restart MCP server'));
  return res.json();
}

async function responseErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (body?.error) return `${fallback}: ${body.error}`;
  } catch { /* ignore */ }
  return `${fallback}: ${res.status}`;
}

// ── Multi-provider batch save (Milestone 18 onboarding) ──
export async function saveProvidersBatch(providers: Array<{ id?: string; name: string; type: string; apiKey: string; baseURL: string; accessMode?: 'api-key' | 'subscription'; planId?: string }>): Promise<{ providers: ProviderInfo[]; count: number }> {
  const res = await fetch(`${API_BASE}/api/providers/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providers }),
  });
  if (!res.ok) throw new Error(`Failed to save providers: ${res.status}`);
  return res.json();
}

export interface ProjectProfile {
  root: string;
  name: string;
  git: { branch: string; dirty: boolean; changedFiles: string[] };
  packageManager?: 'npm' | 'pnpm' | 'yarn' | 'bun';
  languages: string[];
  frameworks: string[];
  scripts: Record<string, string>;
  validation: { build?: string; test?: string; lint?: string; typecheck?: string };
  instructions: { agentsMd?: string; readme?: string };
  importantFiles: string[];
  todoCount: number;
}

// ── Repo Map (Milestone 11) ────────────────────────────────────
export type ContextPackName = 'bugfix' | 'feature' | 'review' | 'docs' | 'ui-smoke';

export interface RepoMapSummary {
  root: string;
  generatedAt: string;
  totalFiles: number;
  indexedFiles: number;
  languages: string[];
  entryPoints: string[];
  routeCount: number;
  componentCount: number;
  endpointCount: number;
  text: string;
  budgetTokens: number;
  truncated: boolean;
  topFiles: { path: string; score: number; reasons: string[] }[];
}

export interface RepoSymbolMatch {
  name: string;
  kind: string;
  file: string;
  line: number;
  exported: boolean;
  signature?: string;
}

export interface RepoDeps {
  file: string;
  imports: string[];
  importedBy: string[];
}

export interface RepoImpact {
  files: string[];
  totalDependents: number;
  impacted: string[];
}

export interface ContextPack {
  name: ContextPackName;
  description: string;
  files: string[];
  symbols: string[];
  reasons: Record<string, string>;
  totalLines: number;
  budgetTokens: number;
  text: string;
}

export interface PackSuggestion {
  pack: ContextPackName;
  reason: string;
}

export async function getRepoMap(path: string, tokenBudget?: number): Promise<RepoMapSummary> {
  const params = new URLSearchParams({ path });
  if (tokenBudget) params.set('tokenBudget', String(tokenBudget));
  const res = await fetch(`${API_BASE}/api/repo/map?${params.toString()}`);
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to load repo map');
  return res.json();
}

export async function searchSymbols(path: string, name: string): Promise<{ query: string; matchCount: number; matches: RepoSymbolMatch[] }> {
  const params = new URLSearchParams({ path, name });
  const res = await fetch(`${API_BASE}/api/repo/symbol?${params.toString()}`);
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to search symbols');
  return res.json();
}

export async function getRepoDeps(path: string, file: string): Promise<RepoDeps> {
  const params = new URLSearchParams({ path, file });
  const res = await fetch(`${API_BASE}/api/repo/deps?${params.toString()}`);
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to load deps');
  return res.json();
}

export async function getChangeImpact(path: string, files: string[]): Promise<RepoImpact> {
  const params = new URLSearchParams({ path, files: files.join(',') });
  const res = await fetch(`${API_BASE}/api/repo/impact?${params.toString()}`);
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to compute impact');
  return res.json();
}

export async function getContextPack(path: string, pack: ContextPackName, userMessage = '', budgetTokens?: number): Promise<ContextPack> {
  const params = new URLSearchParams({ path, pack, userMessage });
  if (budgetTokens) params.set('budgetTokens', String(budgetTokens));
  const res = await fetch(`${API_BASE}/api/repo/context-pack?${params.toString()}`);
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to build context pack');
  return res.json();
}

export async function suggestContextPack(userMessage: string): Promise<PackSuggestion> {
  const params = new URLSearchParams({ userMessage });
  const res = await fetch(`${API_BASE}/api/repo/context-pack/suggest?${params.toString()}`);
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to suggest pack');
  return res.json();
}

export async function getProjectProfile(path: string): Promise<ProjectProfile> {
  const res = await fetch(`${API_BASE}/api/project/profile?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(`Failed to get project profile: ${res.status}`);
  return res.json();
}

// ── Session APIs ───────────────────────────────────────

export async function listSessions(): Promise<SessionInfo[]> {
  const res = await fetch(`${API_BASE}/api/sessions`);
  if (!res.ok) throw new Error(`Failed to list sessions: ${res.status}`);
  return res.json();
}

export async function getSession(id: string): Promise<SessionDetail> {
  const res = await fetch(`${API_BASE}/api/sessions/${id}`);
  if (!res.ok) throw new Error(`Failed to get session: ${res.status}`);
  return res.json();
}

export async function createSession(title?: string, workingDir?: string): Promise<SessionDetail> {
  const res = await fetch(`${API_BASE}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, workingDir }),
  });
  if (!res.ok) throw new Error(`Failed to create session: ${res.status}`);
  return res.json();
}

export async function deleteSession(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/sessions/${id}`, { method: 'DELETE' });
}

// ── Send Message (streaming) ───────────────────────────

export async function sendMessage(sessionId: string, content: string, callbacks: StreamCallbacks, options: SendMessageOptions = {}): Promise<void> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, modelId: options.modelId, sideChat: options.sideChat }),
  });

  if (!res.ok) {
    const err = await res.text();
    callbacks.onError(`Request failed: ${res.status} ${err}`);
    return;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    while (buffer.includes('\n\n')) {
      const blockEnd = buffer.indexOf('\n\n');
      const block = buffer.slice(0, blockEnd);
      buffer = buffer.slice(blockEnd + 2);

      let eventType = '';
      let data = '';

      for (const line of block.split('\n')) {
        if (line.startsWith('event: ')) eventType = line.slice(7).trim();
        else if (line.startsWith('data: ')) data = line.slice(6);
      }

      if (!data) continue;

      try {
        const parsed = JSON.parse(data);
        switch (eventType) {
          case 'user_message': callbacks.onUserMessage(parsed as MessageInfo); break;
          case 'assistant_start': callbacks.onAssistantStart(parsed.id); break;
          case 'text': callbacks.onText(parsed.id, parsed.text); break;
          case 'orchestration_text': callbacks.onText('', parsed.text); break;
          case 'assistant_message': callbacks.onAssistantMessage?.(parsed as MessageInfo); break;
          case 'tool_call': callbacks.onToolCall(parsed as ToolCallInfo); break;
          case 'run_start': callbacks.onRunStart?.(parsed as HarnessRun); break;
          case 'run_step': callbacks.onRunStep?.(parsed.runId, parsed.step as HarnessRunStep); break;
          case 'run_complete': callbacks.onRunComplete?.(parsed as HarnessRun); break;
          case 'error': callbacks.onError(parsed.error || 'Unknown error'); break;
        }
      } catch { /* skip malformed */ }
    }
  }

  callbacks.onDone();
}

// ── Native Dialog (Electron) ───────────────────────────

export async function openFolderDialog(): Promise<string | null> {
  // Use Electron's native dialog if available
  if (typeof window !== 'undefined' && (window as any).OpenHarnessNative?.openFolderDialog) {
    return (window as any).OpenHarnessNative.openFolderDialog();
  }
  // Fallback to server-side dialog
  const res = await fetch(`${API_BASE}/api/dialog/open-folder`, { method: 'POST' });
  if (!res.ok) return null;
  const data = await res.json();
  return data.path;
}

// ── Filesystem ─────────────────────────────────────────

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  extension?: string;
  size: number;
  modified: string;
}

export interface DirectoryInfo {
  path: string;
  entries: FileEntry[];
}

export interface FileInfo {
  path: string;
  name: string;
  extension: string;
  size: number;
  modified: string;
  content: string;
}

export async function listDirectory(dirPath: string, workingDir?: string | null): Promise<DirectoryInfo> {
  const params = new URLSearchParams({ path: dirPath });
  if (workingDir) params.set('workingDir', workingDir);
  const res = await fetch(`${API_BASE}/api/fs/list?${params.toString()}`);
  if (!res.ok) throw new Error(await responseErrorMessage(res, 'Failed to list directory'));
  return res.json();
}

export async function readFile(filePath: string, workingDir?: string | null): Promise<FileInfo> {
  const params = new URLSearchParams({ path: filePath });
  if (workingDir) params.set('workingDir', workingDir);
  const res = await fetch(`${API_BASE}/api/fs/read?${params.toString()}`);
  if (!res.ok) throw new Error(await responseErrorMessage(res, 'Failed to read file'));
  return res.json();
}

// ── Terminal ───────────────────────────────────────────

export interface TerminalResult {
  command: string;
  output: string;
  exitCode: number;
  duration: number;
  cwd: string;
}

export async function execCommand(command: string, cwd?: string): Promise<TerminalResult> {
  const res = await fetch(`${API_BASE}/api/terminal/exec`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, cwd }),
  });
  if (!res.ok) throw new Error(`Command failed: ${res.status}`);
  return res.json();
}

// ── Terminal Session APIs ─────────────────────────────

export interface TerminalSessionInfo {
  id: string;
  cwd: string;
  createdAt: string;
}

export interface TerminalCommandInfo {
  id: string;
  sessionId: string;
  command: string;
  cwd: string;
  status: 'running' | 'complete' | 'error' | 'cancelled';
  exitCode: number | null;
  output: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
}

export async function createTerminalSession(cwd: string): Promise<TerminalSessionInfo> {
  const res = await fetch(`${API_BASE}/api/terminal/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cwd }),
  });
  if (!res.ok) throw new Error(`Failed to create terminal session: ${res.status}`);
  return res.json();
}

export async function getTerminalHistory(sessionId: string): Promise<TerminalCommandInfo[]> {
  const res = await fetch(`${API_BASE}/api/terminal/sessions/${sessionId}/history`);
  if (!res.ok) throw new Error(`Failed to get terminal history: ${res.status}`);
  return res.json();
}

export async function runTerminalCommand(sessionId: string, command: string, cwd?: string): Promise<TerminalCommandInfo> {
  const res = await fetch(`${API_BASE}/api/terminal/sessions/${sessionId}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, cwd }),
  });
  if (!res.ok) throw new Error(`Command failed: ${res.status}`);
  return res.json();
}

export async function cancelTerminalCommand(commandId: string): Promise<{ cancelled: boolean }> {
  const res = await fetch(`${API_BASE}/api/terminal/commands/${commandId}/cancel`, { method: 'POST' });
  if (!res.ok) throw new Error(`Cancel failed: ${res.status}`);
  return res.json();
}

export async function getTerminalCommand(commandId: string): Promise<TerminalCommandInfo> {
  const res = await fetch(`${API_BASE}/api/terminal/commands/${commandId}`);
  if (!res.ok) throw new Error(`Failed to get command: ${res.status}`);
  return res.json();
}

// ── Git APIs ──────────────────────────────────────────

export interface GitStatusInfo {
  branch: string;
  ahead: number;
  behind: number;
  staged: Array<{ path: string; status: string; staged: boolean; insertions: number; deletions: number }>;
  unstaged: Array<{ path: string; status: string; staged: boolean; insertions: number; deletions: number }>;
  untracked: string[];
  clean: boolean;
  root: string;
}

export interface GitDiffInfo {
  path: string;
  oldPath?: string;
  status: string;
  insertions: number;
  deletions: number;
  diff: string;
  binary: boolean;
}

export async function getGitStatus(dir: string): Promise<GitStatusInfo> {
  const res = await fetch(`${API_BASE}/api/git/status?dir=${encodeURIComponent(dir)}`);
  if (!res.ok) throw new Error(`Failed to get git status: ${res.status}`);
  return res.json();
}

export async function getGitDiff(dir: string, options?: { cached?: boolean; path?: string }): Promise<GitDiffInfo[]> {
  const params = new URLSearchParams();
  params.set('dir', dir);
  if (options?.cached) params.set('cached', '1');
  if (options?.path) params.set('path', options.path);
  const res = await fetch(`${API_BASE}/api/git/diff?${params}`);
  if (!res.ok) throw new Error(`Failed to get git diff: ${res.status}`);
  return res.json();
}

export async function getGitFileDiff(dir: string, filePath: string): Promise<GitDiffInfo | null> {
  const params = new URLSearchParams();
  params.set('dir', dir);
  params.set('path', filePath);
  const res = await fetch(`${API_BASE}/api/git/file-diff?${params}`);
  if (!res.ok) throw new Error(`Failed to get file diff: ${res.status}`);
  return res.json();
}

export async function gitStage(dir: string, paths: string[]): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/api/git/stage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dir, paths }),
  });
  if (!res.ok) throw new Error(`Stage failed: ${res.status}`);
  return res.json();
}

export async function gitUnstage(dir: string, paths: string[]): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/api/git/unstage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dir, paths }),
  });
  if (!res.ok) throw new Error(`Unstage failed: ${res.status}`);
  return res.json();
}

export async function gitCommit(dir: string, message: string): Promise<{ hash: string }> {
  const res = await fetch(`${API_BASE}/api/git/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dir, message }),
  });
  if (!res.ok) throw new Error(`Commit failed: ${res.status}`);
  return res.json();
}

export async function getGitLog(dir: string, count?: number): Promise<Array<{ hash: string; message: string; author: string; date: string }>> {
  const params = new URLSearchParams();
  params.set('dir', dir);
  if (count) params.set('count', String(count));
  const res = await fetch(`${API_BASE}/api/git/log?${params}`);
  if (!res.ok) throw new Error(`Failed to get git log: ${res.status}`);
  return res.json();
}

// ── Browser Preview APIs ─────────────────────────────

export interface BrowserPreviewInfo {
  url: string;
  screenshotPath: string;
  screenshotBase64?: string;
  title?: string;
  timestamp: string;
  errors: Array<{ type: 'error' | 'warning'; message: string }>;
}

export interface ServerHealthInfo {
  reachable: boolean;
  statusCode?: number;
  latencyMs: number;
}

export async function captureBrowserPreview(url: string): Promise<BrowserPreviewInfo> {
  const res = await fetch(`${API_BASE}/api/browser/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error(`Preview failed: ${res.status}`);
  return res.json();
}

export async function checkServerHealth(url: string): Promise<ServerHealthInfo> {
  const res = await fetch(`${API_BASE}/api/browser/health?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

// ── Patch Proposal APIs ──────────────────────────────
//
// M15 P0 introduced a multi-file / multi-hunk proposal lifecycle on the
// server. The client wrappers below mirror the routes in
// server/index.ts. The legacy single-file ProposedPatch view remains as a
// type-only alias for any consumer that was written before the M15 model
// landed.

/**
 * @deprecated Prefer the full {@link PatchProposal} flow. Kept as a type
 * alias so any code that imported the old name still compiles.
 */
export type ApplyPatchProposalInfo = {
  id: string;
  file: string;
  action: 'create' | 'update' | 'delete';
  diff: string;
  explanation: string;
  status: 'pending' | 'accepted' | 'rejected' | 'applied';
};

/**
 * @deprecated Use the full {@link PatchProposal} type instead.
 */
export type PatchProposalInfo = ApplyPatchProposalInfo;

export interface CreatePatchProposalParams {
  patch: string;
  workingDir: string;
  sessionId: string;
  runId?: string;
  explanation?: string;
  source?: 'model-message' | 'diff-viewer' | 'manual';
  verificationCommands?: string[];
}

export interface CreatePatchProposalResponse {
  id: string;
  proposal: import('../types').PatchProposal;
}

/**
 * Send a unified diff to the server. The server parses it into a
 * proposal with one record per file and one per hunk, persists it to
 * disk, and returns the new proposal id.
 */
export async function createPatchProposal(
  params: CreatePatchProposalParams,
): Promise<CreatePatchProposalResponse> {
  const res = await fetch(`${API_BASE}/api/patch-proposals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.error || `Create patch proposal failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch one proposal by id. Returns `null` if the server says 404.
 */
export async function getPatchProposal(
  id: string,
): Promise<import('../types').PatchProposal | null> {
  const res = await fetch(`${API_BASE}/api/patch-proposals/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Get patch proposal failed: ${res.status}`);
  return res.json();
}

export interface ListPatchProposalsParams {
  sessionId?: string;
}

/**
 * List proposals on the server, optionally scoped to a session.
 */
export async function listPatchProposals(
  params: ListPatchProposalsParams = {},
): Promise<import('../types').PatchProposal[]> {
  const qs = params.sessionId ? `?sessionId=${encodeURIComponent(params.sessionId)}` : '';
  const res = await fetch(`${API_BASE}/api/patch-proposals${qs}`);
  if (!res.ok) throw new Error(`List patch proposals failed: ${res.status}`);
  const body = await res.json();
  return body.proposals ?? [];
}

export interface SetHunkStatusParams {
  proposalId: string;
  fileId: string;
  hunkId: string;
  status: 'accepted' | 'rejected';
}

/**
 * Accept or reject a single hunk. Returns the updated proposal, or
 * `null` if the server could not find the proposal / file / hunk.
 */
export async function setPatchProposalHunkStatus(
  params: SetHunkStatusParams,
): Promise<import('../types').PatchProposal | null> {
  const action = params.status === 'accepted' ? 'accept' : 'reject';
  const res = await fetch(
    `${API_BASE}/api/patch-proposals/${encodeURIComponent(params.proposalId)}/hunks/${encodeURIComponent(params.fileId)}/${action}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hunkId: params.hunkId }),
    },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.error || `Set hunk status failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Accept every hunk in a proposal. Returns the updated proposal, or
 * `null` if the server could not find the proposal.
 */
export async function acceptAllPatchProposalHunks(
  id: string,
): Promise<import('../types').PatchProposal | null> {
  const res = await fetch(
    `${API_BASE}/api/patch-proposals/${encodeURIComponent(id)}/accept-all`,
    { method: 'POST' },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Accept all failed: ${res.status}`);
  return res.json();
}

/**
 * Reject every hunk in a proposal. Returns the updated proposal, or
 * `null` if the server could not find the proposal.
 */
export async function rejectAllPatchProposalHunks(
  id: string,
): Promise<import('../types').PatchProposal | null> {
  const res = await fetch(
    `${API_BASE}/api/patch-proposals/${encodeURIComponent(id)}/reject-all`,
    { method: 'POST' },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Reject all failed: ${res.status}`);
  return res.json();
}

/**
 * Mark a proposal as discarded. The on-disk record is kept but the
 * status flips to `discarded` and the apply route will refuse to act
 * on it. Returns the updated proposal, or `null` if the server could
 * not find the proposal.
 */
export async function discardPatchProposal(
  id: string,
): Promise<import('../types').PatchProposal | null> {
  const res = await fetch(
    `${API_BASE}/api/patch-proposals/${encodeURIComponent(id)}/discard`,
    { method: 'POST' },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Discard failed: ${res.status}`);
  return res.json();
}

export async function isolatePatchProposal(
  id: string,
): Promise<{
  proposal: import('../types').PatchProposal | null;
  sandbox?: import('../types').PatchProposalSandbox;
  appliedFiles: string[];
  errors: string[];
}> {
  const res = await fetch(
    `${API_BASE}/api/patch-proposals/${encodeURIComponent(id)}/isolate`,
    { method: 'POST' },
  );
  if (res.status === 404) return { proposal: null, appliedFiles: [], errors: ['Proposal not found'] };
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.error || detail?.errors?.join('\n') || `Isolate failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Apply the proposal: only the accepted hunks are written to disk in
 * the proposal's `workingDir`. Returns the apply summary.
 */
export async function applyPatchProposal(
  id: string,
): Promise<import('../types').ApplyPatchProposalResult> {
  const res = await fetch(
    `${API_BASE}/api/patch-proposals/${encodeURIComponent(id)}/apply`,
    { method: 'POST' },
  );
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.error || `Apply failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Low-level escape hatch for callers that have a raw patch text and a
 * workingDir but no proposal record. Forwards `workingDir` so the
 * hardened M15 P0 server route will accept it.
 */
export async function applyPatch(
  patch: string,
  workingDir?: string,
): Promise<{ files: string[]; errors: string[] }> {
  const res = await fetch(`${API_BASE}/api/patches/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patch, workingDir }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.error || `Patch apply failed: ${res.status}`);
  }
  return res.json();
}

// ── Eval / Model Lab APIs ─────────────────────────────

export interface PromptCase {
  id: string;
  name: string;
  prompt: string;
  category: string;
  expectedBehavior?: string;
}

export interface EvalScores {
  usedTools: boolean;
  answeredUser: boolean;
  referencedRealFiles: boolean;
  avoidedHallucinatedPaths: boolean;
  producedSummary: boolean;
  latencyMs: number;
  toolCount: number;
  validationPassed: boolean;
  validationScore: number;
  overallScore: number;
  breakdown: EvalScoreBreakdown;
}

export type EvalSignalCategory = 'structural' | 'runtime' | 'style';

export interface EvalSignalScore {
  id: string;
  label: string;
  category: EvalSignalCategory;
  passed: boolean;
  score: number;
  maxScore: number;
}

export interface EvalScoreBreakdown {
  structural: number;
  runtime: number;
  style: number;
  total: number;
  weakestSignal: EvalSignalScore;
  signals: EvalSignalScore[];
}

export interface EvalResult {
  modelId: string;
  promptId: string;
  promptName: string;
  status: 'ok' | 'error';
  response: string;
  responseLength: number;
  toolCallCount: number;
  toolCalls: Array<{ name: string; status: string }>;
  wallMs: number;
  scores: EvalScores;
}

export interface EvalSummary {
  byModel: Record<string, { avgScore: number; avgLatencyMs: number; avgToolCount: number; totalRuns: number }>;
  bestModel: string;
  recommendations: Array<{ role: string; modelId: string; reason: string }>;
}

export interface EvalRecommendation {
  role: string;
  modelId: string;
  reason: string;
  reportId: string;
  reportName: string;
  generatedAt: string;
}

export interface EvalReport {
  id: string;
  configId: string;
  name: string;
  status: 'running' | 'complete' | 'error';
  total: number;
  completed: number;
  results: EvalResult[];
  createdAt: string;
  completedAt?: string;
  summary?: EvalSummary;
}

export interface EvalReportSummary {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  total: number;
}

export async function getEvalPrompts(): Promise<PromptCase[]> {
  const res = await fetch(`${API_BASE}/api/evals/prompts`);
  if (!res.ok) throw new Error(`Failed to get prompts: ${res.status}`);
  return res.json();
}

export async function getEvalReports(): Promise<EvalReportSummary[]> {
  const res = await fetch(`${API_BASE}/api/evals/reports`);
  if (!res.ok) throw new Error(`Failed to get reports: ${res.status}`);
  return res.json();
}

export async function getEvalReport(id: string): Promise<EvalReport> {
  const res = await fetch(`${API_BASE}/api/evals/reports/${id}`);
  if (!res.ok) throw new Error(`Failed to get report: ${res.status}`);
  return res.json();
}

export async function runEval(params: {
  name?: string;
  promptIds: string[];
  modelIds: string[];
  workingDir?: string;
}): Promise<{ id: string; status: string; total: number }> {
  const res = await fetch(`${API_BASE}/api/evals/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Eval run failed: ${res.status}`);
  return res.json();
}

export async function getEvalRecommendations(): Promise<EvalRecommendation[]> {
  const res = await fetch(`${API_BASE}/api/evals/recommendations`);
  if (!res.ok) return [];
  return res.json();
}

// ── Project Memory APIs ───────────────────────────────

export interface ProjectMemoryInfo {
  projectPath: string;
  profile?: any;
  memoryMd: string;
  updatedAt: string;
  createdAt: string;
}

export async function getProjectMemory(path: string): Promise<ProjectMemoryInfo> {
  const res = await fetch(`${API_BASE}/api/project/memory?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(`Failed to get project memory: ${res.status}`);
  return res.json();
}

export async function updateProjectMemory(path: string, content: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/project/memory`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  });
  if (!res.ok) throw new Error(`Failed to update project memory: ${res.status}`);
}

export async function appendProjectMemory(path: string, content: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/project/memory/append`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  });
  if (!res.ok) throw new Error(`Failed to append project memory: ${res.status}`);
}

// ── Compare Model API ──────────────────────────────────

export interface CompareModelResult {
  model: string;
  providerId: string;
  response: string;
  toolCalls: Array<{ name: string; status: string }>;
  wallMs: number;
}

export async function compareModel(sessionId: string, targetModel: string, messageIndex?: number): Promise<CompareModelResult> {
  const res = await fetch(`${API_BASE}/api/chat/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, targetModel, messageIndex }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Compare failed: ${res.status}`);
  }
  return res.json();
}

// ── Harness Task API ───────────────────────────────────

export interface HarnessTask {
  id: string;
  name: string;
  prompt: string;
  workingDir: string;
  setupCommands: string[];
  verificationCommands: string[];
  expectedChangedFiles?: string[];
  forbiddenChangedFiles?: string[];
  trustMode: 'read-only' | 'ask-before-write' | 'workspace-write';
  timeoutMs: number;
  rubric: Array<{ id: string; points: number; description: string }>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskSuite {
  id: string;
  name: string;
  description: string;
  tasks: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export async function getTasks(filter?: { tag?: string; trustMode?: string }): Promise<HarnessTask[]> {
  const params = new URLSearchParams();
  if (filter?.tag) params.set('tag', filter.tag);
  if (filter?.trustMode) params.set('trustMode', filter.trustMode);
  const qs = params.toString();
  const res = await fetch(`${API_BASE}/api/tasks${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error(`Failed to get tasks: ${res.status}`);
  return res.json();
}

export async function getTask(id: string): Promise<HarnessTask> {
  const res = await fetch(`${API_BASE}/api/tasks/${id}`);
  if (!res.ok) throw new Error(`Task not found: ${res.status}`);
  return res.json();
}

export async function createTask(task: Omit<HarnessTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<HarnessTask> {
  const res = await fetch(`${API_BASE}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  if (!res.ok) throw new Error(`Failed to create task: ${res.status}`);
  return res.json();
}

export async function deleteTask(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/tasks/${id}`, { method: 'DELETE' });
}

export async function seedTasks(workingDir?: string): Promise<void> {
  await fetch(`${API_BASE}/api/tasks/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workingDir }),
  });
}

export async function getTaskSuites(): Promise<TaskSuite[]> {
  const res = await fetch(`${API_BASE}/api/task-suites`);
  if (!res.ok) throw new Error(`Failed to get suites: ${res.status}`);
  return res.json();
}

// ── Bench Run API ──────────────────────────────────────

export interface BenchRunSummary {
  id: string;
  name: string;
  status: string;
  total: number;
  completed: number;
  createdAt: string;
  completedAt?: string;
  suiteId?: string;
}

export interface ValidationCommandResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  findings: string[];
  durationMs: number;
  passed: boolean;
}

export interface BenchScores {
  usedTools: boolean;
  answeredUser: boolean;
  referencedRealFiles: boolean;
  avoidedHallucinatedPaths: boolean;
  producedSummary: boolean;
  latencyMs: number;
  toolCount: number;
  validationPassed: boolean;
  validationScore: number;
  styleScore: number;
  overallScore: number;
  breakdown: EvalScoreBreakdown;
  resolvedStatus: 'resolved' | 'unresolved' | 'partial';
  stepCount: number;
  tokenCount: number;
  costEstimate: number;
}

export interface BenchRunResult {
  taskId: string;
  taskName: string;
  modelId: string;
  providerId: string;
  status: 'ok' | 'error' | 'timeout' | 'validation-failed';
  prompt: string;
  response: string;
  responseLength: number;
  toolCalls: Array<{ name: string; status: string }>;
  validationResults: ValidationCommandResult[];
  validationPassed: boolean;
  wallMs: number;
  scores: BenchScores;
  startedAt: string;
  completedAt: string;
  error?: string;
}

export interface BenchRun {
  id: string;
  name: string;
  suiteId?: string;
  status: 'running' | 'complete' | 'error';
  taskIds: string[];
  modelIds: string[];
  results: BenchRunResult[];
  total: number;
  completed: number;
  createdAt: string;
  completedAt?: string;
  summary?: {
    byModel: Record<string, {
      resolved: number; unresolved: number; partial: number;
      avgScore: number; avgValidationScore: number;
      avgLatencyMs: number; avgCost: number; avgSteps: number; totalRuns: number;
    }>;
    bestModel: string;
    regressionFlags: Array<{ taskId: string; modelId: string; reason: string }>;
  };
  previousDelta?: {
    previousRunId: string;
    previousRunName: string;
    previousCreatedAt: string;
    avgScoreDelta: number;
    avgScoreDeltaPct: number;
    avgValidationDelta: number;
    avgStyleDelta: number;
    taskDeltas: Array<{
      taskId: string;
      taskName: string;
      modelId: string;
      currentScore: number;
      previousScore: number;
      delta: number;
    }>;
  } | null;
}

export async function getBenchRuns(): Promise<BenchRunSummary[]> {
  const res = await fetch(`${API_BASE}/api/bench/runs`);
  if (!res.ok) throw new Error(`Failed to get bench runs: ${res.status}`);
  return res.json();
}

export async function getBenchRun(id: string): Promise<BenchRun> {
  const res = await fetch(`${API_BASE}/api/bench/runs/${id}`);
  if (!res.ok) throw new Error(`Bench run not found: ${res.status}`);
  return res.json();
}

export async function runBench(params: {
  name?: string;
  taskIds: string[];
  modelIds: string[];
  suiteId?: string;
  workingDir?: string;
}): Promise<{ id: string; status: string; total: number }> {
  const res = await fetch(`${API_BASE}/api/bench/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Failed to start bench: ${res.status}`);
  return res.json();
}

export async function exportBenchRun(id: string, format: 'json' | 'csv' = 'json'): Promise<string> {
  const res = await fetch(`${API_BASE}/api/bench/runs/${id}/export?format=${format}`);
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  return res.text();
}

// ── Milestone 12 — Checkpoints / Worktrees / Safety ──

export interface CheckpointFile {
  path: string;
  kind: 'tracked' | 'untracked';
  status: string;
  content: string;
  size?: number;
}

export interface Checkpoint {
  id: string;
  projectId: string;
  workingDir: string;
  root: string;
  branch: string;
  head: string;
  upstream?: string;
  files: CheckpointFile[];
  inlineUntracked: string[];
  untrackedTooLarge: string[];
  createdAt: string;
  label: string;
  status: 'active' | 'restored' | 'discarded';
  restoredAt?: string;
}

export async function createCheckpoint(dir: string, label?: string): Promise<Checkpoint> {
  const res = await fetch(`${API_BASE}/api/checkpoints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dir, label }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listCheckpoints(dir: string): Promise<Checkpoint[]> {
  const res = await fetch(`${API_BASE}/api/checkpoints?dir=${encodeURIComponent(dir)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteCheckpoint(dir: string, id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/checkpoints/${id}?dir=${encodeURIComponent(dir)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
}

export async function restoreCheckpoint(dir: string, id: string, mode: 'reset' | 'apply' = 'reset'): Promise<{ ok: boolean; applied: string[]; failed: string[]; warnings: string[]; changed: boolean }> {
  const res = await fetch(`${API_BASE}/api/checkpoints/${id}/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dir, mode }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export interface Worktree {
  id: string;
  path: string;
  branch: string;
  baseRef: string;
  root: string;
  createdAt: string;
  status: 'active' | 'promoted' | 'discarded' | 'error';
  label?: string;
  clean: boolean;
  lastCheckedAt: string;
  lastError?: string;
}

export async function createWorktree(dir: string, opts: { label?: string; baseBranch?: string } = {}): Promise<Worktree> {
  const res = await fetch(`${API_BASE}/api/worktrees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dir, ...opts }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listWorktrees(dir: string): Promise<Worktree[]> {
  const res = await fetch(`${API_BASE}/api/worktrees?dir=${encodeURIComponent(dir)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteWorktree(dir: string, id: string, force = false): Promise<void> {
  const res = await fetch(`${API_BASE}/api/worktrees/${id}?dir=${encodeURIComponent(dir)}&force=${force ? 1 : 0}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
}

export async function getWorktreeDiff(dir: string, id: string): Promise<{ files: Array<{ path: string; status: string; insertions: number; deletions: number }>; commitCount: number; baseRef: string }> {
  const res = await fetch(`${API_BASE}/api/worktrees/${id}/diff?dir=${encodeURIComponent(dir)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function promoteWorktree(dir: string, id: string, opts: { targetBranch?: string; force?: boolean } = {}): Promise<{ ok: boolean; applied: string[]; failed: string[]; warnings: string[]; targetBranch: string; worktreeClean: boolean }> {
  const res = await fetch(`${API_BASE}/api/worktrees/${id}/promote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dir, ...opts }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function autoCleanWorktrees(dir: string): Promise<{ removed: string[]; kept: string[] }> {
  const res = await fetch(`${API_BASE}/api/worktrees/auto-clean`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dir }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export interface ProtectedPathRule {
  pattern: string;
  category: string;
  reason: string;
  severity: 'block' | 'warn';
}

export async function listProtectedRules(): Promise<ProtectedPathRule[]> {
  const res = await fetch(`${API_BASE}/api/protected/rules`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function checkPathProtected(path: string): Promise<{ protected: boolean; rule?: ProtectedPathRule; reason?: string }> {
  const res = await fetch(`${API_BASE}/api/protected/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export interface SecretFinding {
  kind: string;
  match: string;
  start: number;
  end: number;
  redacted: string;
}

export async function scanSecrets(text: string): Promise<{ hasSecrets: boolean; findings: SecretFinding[]; redactedText: string }> {
  const res = await fetch(`${API_BASE}/api/secrets/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function redactForExport(text: string): Promise<{ text: string; hadSecrets: boolean }> {
  const res = await fetch(`${API_BASE}/api/export/redact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export type ProcessKind = 'server' | 'electron' | 'vite' | 'terminal' | 'browser' | 'worktree-cmd' | 'agent' | 'other';

export interface OwnedProcess {
  pid: number;
  id: string;
  kind: ProcessKind;
  name: string;
  command: string;
  args: string[];
  cwd?: string;
  parentPid?: number;
  startedAt: string;
  exitedAt?: string;
  exitCode?: number | null;
  status: 'running' | 'exited' | 'killed' | 'failed';
  logFile: string;
  notes?: string;
}

export interface LogTail {
  pid: number;
  logFile: string;
  exists: boolean;
  sizeBytes: number;
  tail: string;
}

export async function listProcesses(includeExited = false): Promise<OwnedProcess[]> {
  const res = await fetch(`${API_BASE}/api/processes?includeExited=${includeExited ? 1 : 0}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function killProcess(pid: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/processes/${pid}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
}

export async function killAllProcesses(kinds?: ProcessKind[]): Promise<{ killed: number[]; skipped: number[] }> {
  const res = await fetch(`${API_BASE}/api/processes/kill-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kinds }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getProcessLog(pid: number, maxBytes = 16384): Promise<LogTail> {
  const res = await fetch(`${API_BASE}/api/processes/${pid}/log?maxBytes=${maxBytes}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function clearProcessLog(pid: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/processes/${pid}/log`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
}

export async function pruneExitedProcesses(): Promise<{ removed: number }> {
  const res = await fetch(`${API_BASE}/api/processes/prune`, { method: 'POST' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export interface SafetySummary {
  checkpoints: { count: number; latest: Checkpoint | null };
  worktrees: { count: number; active: number; clean: number; list: Worktree[] };
  processes: { count: number; byKind: Record<string, number> };
}

export async function getSafetySummary(dir: string): Promise<SafetySummary> {
  const res = await fetch(`${API_BASE}/api/safety/summary?dir=${encodeURIComponent(dir)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
// ── Router Learning API ─────────────────────────────
export interface RouterLearningSummary {
  totalEvents: number;
  models: Record<string, { total: number; success: number; rate: number }>;
  successRate: number;
  outdated: boolean;
  byTaskType: Record<string, { total: number; success: number; rate: number; byModel: Record<string, { total: number; success: number; rate: number }> }>;
  byRole: Record<string, { total: number; success: number; rate: number; byModel: Record<string, { total: number; success: number; rate: number }> }>;
  byComplexity: Record<string, { total: number; success: number; rate: number; byModel: Record<string, { total: number; success: number; rate: number }> }>;
  bestByTaskType: Array<{ taskType: string; model: string; total: number; success: number; rate: number }>;
}

export interface RoutingEvent {
  id: string;
  timestamp: string;
  sessionId: string;
  taskType: string;
  role: string;
  complexity: string;
  selectedModel: string;
  score: number;
  candidateScores?: Record<string, number>;
  wasFallback: boolean;
  wasCached: boolean;
  outcome: 'success' | 'failure' | 'ambiguous' | null;
}

export async function getRouterLearning(): Promise<RouterLearningSummary> {
  const res = await fetch(`${API_BASE}/api/router/learning`);
  if (!res.ok) return {
    totalEvents: 0,
    models: {},
    successRate: 0,
    outdated: true,
    byTaskType: {},
    byRole: {},
    byComplexity: {},
    bestByTaskType: [],
  };
  return res.json();
}

export async function getRouterLearningEvents(sessionId?: string, limit = 50): Promise<RoutingEvent[]> {
  const params = new URLSearchParams();
  if (sessionId) params.set('sessionId', sessionId);
  params.set('limit', String(limit));
  const res = await fetch(`${API_BASE}/api/router/learning/events?${params}`);
  if (!res.ok) return [];
  return res.json();
}

export async function getModelSuccessRates(): Promise<Record<string, { total: number; success: number; rate: number }>> {
  const res = await fetch(`${API_BASE}/api/router/learning/success-rates`);
  if (!res.ok) return {};
  return res.json();
}

export async function suggestRouterThreshold(currentThreshold: number): Promise<{ suggestedThreshold: number; reason: string; dataPoints: number }> {
  const res = await fetch(`${API_BASE}/api/router/learning/suggest-threshold`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentThreshold }),
  });
  if (!res.ok) return { suggestedThreshold: currentThreshold, reason: 'Failed', dataPoints: 0 };
  return res.json();
}

export async function recordRoutingOutcome(eventId: string, outcome: 'success' | 'failure' | 'ambiguous', note?: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/router/learning/outcome`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId, outcome, note }),
  });
  return res.ok;
}


// ============================================================================
// Patch Review / Commit Validation stubs (server endpoints TBD)
// These functions were introduced by PatchReviewPanel and related UI work.
// The corresponding server endpoints are not yet implemented; the stubs
// return safe defaults so the frontend builds and renders. When the server
// routes land, replace the body with real fetch calls.
// ============================================================================

export type ReviewCommentSeverity = 'info' | 'warning' | 'error' | 'blocker';

export interface ReviewComment {
  id: string;
  proposalId: string;
  filePath: string;
  startLine: number;
  endLine?: number;
  severity: ReviewCommentSeverity;
  rationale: string;
  suggestedFix?: string;
  status: 'open' | 'resolved' | 'dismissed';
  resolvedBy?: string;
  author?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CommitMessageResult {
  subject: string;
  body: string;
  fullText: string;
  scope?: string;
  breaking?: boolean;
}

export interface ValidationGateResult {
  ok: boolean;
  bypassed: boolean;
  results: PatchValidationResult[];
  blockers: number;
}

export interface CaptureProposalPreviewResult {
  ok: boolean;
  preview?: BrowserPreviewResult;
  error?: string;
}

export interface CommitProposalResult {
  ok: boolean;
  hash?: string;
  subject?: string;
  bypassed?: boolean;
  error?: string;
  gate?: ValidationGateResult;
  blockedBy?: number;
}

async function safeJson<T>(res: Response, fallback: T): Promise<T> {
  if (!res.ok) return fallback;
  try { return await res.json() as T; } catch { return fallback; }
}

async function readJson<T>(res: Response, fallback: T): Promise<T> {
  try { return await res.json() as T; } catch { return fallback; }
}

export async function listReviewComments(proposalId: string): Promise<ReviewComment[]> {
  const res = await fetch(`${API_BASE}/api/patch-proposals/${encodeURIComponent(proposalId)}/comments`);
  return safeJson<ReviewComment[]>(res, []);
}

export async function addReviewComment(input: {
  proposalId: string;
  filePath: string;
  startLine: number;
  endLine?: number;
  severity: ReviewCommentSeverity;
  rationale: string;
  suggestedFix?: string;
}): Promise<ReviewComment | null> {
  const { proposalId, ...body } = input;
  const res = await fetch(`${API_BASE}/api/patch-proposals/${encodeURIComponent(proposalId)}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return safeJson<ReviewComment | null>(res, null);
}

export async function updateReviewComment(
  proposalId: string,
  commentId: string,
  update: { status?: 'open' | 'resolved' | 'dismissed'; rationale?: string; resolvedBy?: string },
): Promise<ReviewComment | null> {
  const res = await fetch(
    `${API_BASE}/api/patch-proposals/${encodeURIComponent(proposalId)}/comments/${encodeURIComponent(commentId)}`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(update) },
  );
  return safeJson<ReviewComment | null>(res, null);
}

export async function deleteReviewComment(proposalId: string, commentId: string): Promise<boolean> {
  const res = await fetch(
    `${API_BASE}/api/patch-proposals/${encodeURIComponent(proposalId)}/comments/${encodeURIComponent(commentId)}`,
    { method: 'DELETE' },
  );
  return res.ok;
}

export async function captureProposalPreview(proposalId: string): Promise<CaptureProposalPreviewResult | null> {
  const res = await fetch(
    `${API_BASE}/api/patch-proposals/${encodeURIComponent(proposalId)}/preview`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
  );
  return safeJson<CaptureProposalPreviewResult | null>(res, null);
}

export async function generateProposalCommitMessage(
  proposalId: string,
  _opts: Record<string, unknown>,
): Promise<CommitMessageResult | null> {
  const res = await fetch(
    `${API_BASE}/api/patch-proposals/${encodeURIComponent(proposalId)}/commit-message`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
  );
  return safeJson<CommitMessageResult | null>(res, null);
}

export async function runProposalValidationGate(
  proposalId: string,
  opts: { force: boolean },
): Promise<ValidationGateResult | null> {
  const res = await fetch(
    `${API_BASE}/api/patch-proposals/${encodeURIComponent(proposalId)}/validate`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(opts) },
  );
  return safeJson<ValidationGateResult | null>(res, null);
}

export async function commitProposal(
  proposalId: string,
  opts: { subjectOverride?: string },
): Promise<CommitProposalResult> {
  const res = await fetch(
    `${API_BASE}/api/patch-proposals/${encodeURIComponent(proposalId)}/commit`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(opts) },
  );
  const fallback = { ok: false, error: res.ok ? 'Commit failed' : `Commit failed (${res.status})` };
  const parsed = await readJson<CommitProposalResult>(res, fallback);
  if (!res.ok) return { ...parsed, ok: false };
  return parsed;
}

export async function archiveProjectMemory(workingDir: string): Promise<{ ok: boolean; archivedAt?: string; error?: string }> {
  const res = await fetch(`${API_BASE}/api/project/memory/archive`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: workingDir }),
  });
  return safeJson<{ ok: boolean; archivedAt?: string; error?: string }>(res, { ok: false, error: `Archive failed (${res.status})` });
}

export async function exportProjectMemory(workingDir: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/project/memory/export?path=${encodeURIComponent(workingDir)}`);
  if (!res.ok) return '';
  return res.text();
}

// ============================================================================
// Prompt Microscope stubs
// ============================================================================

export interface SectionEstimate {
  id: string;
  label: string;
  tokens: number;
  truncated: boolean;
  text: string;
  redactedHits: number;
}

export async function estimatePromptSections(sections: Array<{ id: string; label: string; text: string }>): Promise<SectionEstimate[]> {
  // Client-side fallback: estimate ~4 chars per token. Used until the
  // server-side estimator lands.
  return sections.map((s) => {
    const text = s.text || '';
    const tokens = Math.ceil(text.length / 4);
    return { id: s.id, label: s.label, tokens, truncated: tokens > 4000, text, redactedHits: 0 };
  });
}

// ============================================================================
// Provider Health stubs
// ============================================================================

export interface ProviderHealthSummary {
  providerId: string;
  providerName: string;
  lastChecked: string;
  status: 'ok' | 'stale' | 'fail';
  lastLatencyMs?: number;
  lastError?: string;
  // Aggregated view used by the SettingsModal badge.
  failed: boolean;
  stale: boolean;
  total: number;
  latest?: {
    latencyMs?: number;
    error?: string;
    capabilities: Array<{ ok: boolean; name?: string }>;
  };
}

export interface ProviderHealthRecord {
  id: string;
  providerId: string;
  timestamp: string;
  status: 'ok' | 'stale' | 'fail';
  latencyMs?: number;
  tokens?: { input: number; output: number };
  cost?: number;
  error?: string;
}

export interface ProviderHealthBundle {
  summary: ProviderHealthSummary;
  history: ProviderHealthRecord[];
}

export interface ProviderHealthIndex {
  providers: ProviderHealthSummary[];
  history: Record<string, ProviderHealthRecord[]>;
}

export async function getProviderHealth(providerId: string): Promise<ProviderHealthBundle>;
export async function getProviderHealth(): Promise<ProviderHealthIndex>;
export async function getProviderHealth(providerId?: string): Promise<ProviderHealthBundle | ProviderHealthIndex> {
  if (providerId) {
    const res = await fetch(`${API_BASE}/api/providers/${encodeURIComponent(providerId)}/health`);
    const fallback: ProviderHealthBundle = {
      summary: {
        providerId,
        providerName: providerId,
        lastChecked: new Date().toISOString(),
        status: 'stale',
        failed: false,
        stale: true,
        total: 0,
      },
      history: [],
    };
    return safeJson<ProviderHealthBundle>(res, fallback);
  }
  const res = await fetch(`${API_BASE}/api/providers/health`);
  return safeJson<ProviderHealthIndex>(res, { providers: [], history: {} });
}

export async function probeProviderHealth(providerId: string): Promise<ProviderHealthRecord | null> {
  const res = await fetch(`${API_BASE}/api/providers/${encodeURIComponent(providerId)}/health/probe`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  return safeJson<ProviderHealthRecord | null>(res, null);
}
