const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ── Types ──────────────────────────────────────────────

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
  onError: (error: string) => void;
  onDone: () => void;
}

// ── Provider / Model APIs ──────────────────────────────

export interface ProviderInfo {
  id: string;
  name: string;
  type: string;
  apiKey?: string;
  baseURL?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  providerID: string;
  apiModel: string;
}

export async function getProviders(): Promise<ProviderInfo[]> {
  try {
    const res = await fetch(`${API_BASE}/api/providers`);
    if (res.ok) return res.json();
  } catch { /* not available yet */ }
  return [];
}

export async function getModels(): Promise<ModelInfo[]> {
  try {
    const res = await fetch(`${API_BASE}/api/models`);
    if (res.ok) return res.json();
  } catch { /* not available yet */ }
  return [];
}

export async function setModel(modelID: string): Promise<void> {
  await fetch(`${API_BASE}/api/model`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelID }),
  });
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
