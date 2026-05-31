const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
  | { type: 'orchestration'; mode: 'direct' | 'investigate' | 'execute' | 'compare'; label: string; detail?: string }
  | { type: 'route'; role: string; model: string; reason?: string }
  | { type: 'prompt_built'; promptPreview: string; toolCount: number }
  | { type: 'model_request'; round: number; model: string }
  | { type: 'tool_call'; id: string; name: string; input: unknown; outputPreview?: string; durationMs?: number }
  | { type: 'model_text'; chars: number }
  | { type: 'final_answer'; chars: number }
  | { type: 'error'; message: string };

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
  onToolCall: (toolCall: ToolCallInfo) => void;
  onRunStart?: (run: HarnessRun) => void;
  onRunStep?: (runId: string, step: HarnessRunStep) => void;
  onRunComplete?: (run: HarnessRun) => void;
  onError: (error: string) => void;
  onDone: () => void;
}

// ── Config API ─────────────────────────────────────────

export interface AppConfig {
  version: number;
  providers: ProviderInfo[];
  mcpServers: MCPServerInfo[];
  personality: string;
  activeModel: string;
  activeTheme: string;
  roleAssignments: Record<string, string>;
}

export async function getConfig(): Promise<AppConfig | null> {
  try {
    const res = await fetch(`${API_BASE}/api/config`);
    if (res.ok) return res.json();
  } catch { /* server not available */ }
  return null;
}

export async function updateConfig(updates: Partial<Pick<AppConfig, 'personality' | 'activeModel' | 'activeTheme' | 'roleAssignments'>>): Promise<void> {
  await fetch(`${API_BASE}/api/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}

// ── Provider APIs ──────────────────────────────────────

export interface ProviderInfo {
  id: string;
  name: string;
  type: string;
  apiKey: string;
  hasKey?: boolean;
  baseURL: string;
  models: ProviderModelInfo[];
}

export interface ProviderModelInfo {
  id: string;
  name: string;
  enabled: boolean;
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

export async function addProvider(provider: { id?: string; name: string; type: string; apiKey: string; baseURL: string; models?: ProviderModelInfo[] }): Promise<ProviderInfo> {
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
}

export interface MCPServerStatus {
  id: string;
  name: string;
  running: boolean;
  toolCount: number;
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
  if (!res.ok) throw new Error(`Failed to start MCP server: ${res.status}`);
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

export async function sendMessage(sessionId: string, content: string, callbacks: StreamCallbacks): Promise<void> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
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
  if (typeof window !== 'undefined' && (window as any).CMDuiNative?.openFolderDialog) {
    return (window as any).CMDuiNative.openFolderDialog();
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

export async function listDirectory(dirPath: string): Promise<DirectoryInfo> {
  const res = await fetch(`${API_BASE}/api/fs/list?path=${encodeURIComponent(dirPath)}`);
  if (!res.ok) throw new Error(`Failed to list directory: ${res.status}`);
  return res.json();
}

export async function readFile(filePath: string): Promise<FileInfo> {
  const res = await fetch(`${API_BASE}/api/fs/read?path=${encodeURIComponent(filePath)}`);
  if (!res.ok) throw new Error(`Failed to read file: ${res.status}`);
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

export interface PatchProposalInfo {
  id: string;
  file: string;
  action: 'create' | 'update' | 'delete';
  diff: string;
  explanation: string;
  status: 'pending' | 'accepted' | 'rejected' | 'applied';
}

export async function applyPatch(patch: string): Promise<{ files: string[]; errors: string[] }> {
  const res = await fetch(`${API_BASE}/api/patches/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patch }),
  });
  if (!res.ok) throw new Error(`Patch apply failed: ${res.status}`);
  return res.json();
}
