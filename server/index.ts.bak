import express from 'express';
import cors from 'cors';
import { v4 as uuid } from 'uuid';
import { readFileSync, readdirSync, statSync, existsSync, lstatSync, writeFileSync, mkdirSync as mkdirSyncFs } from 'fs';
import { join, basename, extname } from 'path';
import { homedir } from 'os';
import { execSync, spawn } from 'child_process';
import { loadConfig, saveConfig, upsertProvider, removeProvider, upsertMCPServer, removeMCPServer, getProviderForModel } from './config';
// Types from config used inline
import { testProviderConnection, fetchProviderModels } from './providers';
import { mcpManager } from './mcp';
import { getModelConfig, isReasoningModel, detectModelFamily } from './modelProfiles';
import { buildContextWindow, estimateTokens } from './contextManager';
import { buildPromptForModel, toolsAsText } from './promptBuilder';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ── Types ──────────────────────────────────────────────
interface SessionRow {
  id: string;
  title: string;
  workingDir: string | null;
  messages: MessageRow[];
  createdAt: string;
  updatedAt: string;
}

interface MessageRow {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  toolCalls?: ToolCallRow[];
}

interface ToolCallRow {
  id: string;
  name: string;
  status: 'running' | 'complete' | 'error';
  input?: string;
  output?: string;
  duration?: number;
}

// ── Config ─────────────────────────────────────────────
let appConfig = loadConfig();


// ── Thinking tag stripping ─────────────────────────────
const THINKING_TAG_PATTERNS: RegExp[] = [
  /<\/?think>/gs,
  /<\/?thinking>/gs,
  /<\/?reasoning>/gs,
  /<QDom[\s\S]*?<\/QDom>/g,
  /<transitioned[\s\S]*?<\/transitioned>/gs,
];

function stripThinkingTags(text: string): string {
  let cleaned = text;
  for (const pattern of THINKING_TAG_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned.trimStart();
}

// ── Monologue stripping ──────────────────────────────────
// Models sometimes narrate their thinking as plain text before the actual answer.
// "The user wants me to... Let me explore... Now I have a comprehensive view..."
// This buffer holds initial text and releases it once structured content begins.

const MONOLOGUE_PATTERNS = /^(The user (wants|asked|is asking)|Let me |I need to |I should |I'll start|I will now|Now I (have|need|will)|First,? I|I'm going to|I should |To (do|answer|complete) this)/i;
const ANSWER_START = /^(\s*#{1,3}\s|\s*\*\*[^*]+\*\*|\s*---|\s*\|.*\||\s*```|\s*\d+\.\s|\s*[-*]\s|\s*[A-Z][a-z].*:)/;

class MonologueBuffer {
  private buffer = '';
  private flushed = false;
  private readonly maxBuffer = 1500;

  feed(text: string): string | null {
    if (this.flushed) return text;

    this.buffer += text;

    // Check if we've hit structured content (answer started)
    const lines = this.buffer.split('\n');
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      // A non-monologue line = the answer has started
      if (!MONOLOGUE_PATTERNS.test(line) && line.length > 10) {
        this.flushed = true;
        // Return everything from this point on
        const beforeAnswer = lines.slice(0, i).join('\n');
        // Check if the pre-answer text is all monologue — if so, drop it
        const monologueLines = beforeAnswer.split('\n').filter(l => l.trim());
        const allMonologue = monologueLines.every(l => MONOLOGUE_PATTERNS.test(l.trim()) || l.trim().length < 15);
        if (allMonologue) {
          // Drop the monologue, return from answer start
          return lines.slice(i).join('\n');
        } else {
          // Mixed content — keep it all
          return this.buffer;
        }
      }
    }

    // Buffer full but no answer detected — flush everything (it's a plain answer)
    if (this.buffer.length > this.maxBuffer) {
      this.flushed = true;
      return this.buffer;
    }

    // Still buffering — don't emit anything yet
    return null;
  }

  flush(): string {
    this.flushed = true;
    const remaining = this.buffer;
    this.buffer = '';
    return remaining;
  }
}

// ── Tool dedup tracking ────────────────────────────────
interface ToolCallTracker {
  listedDirs: Set<string>;
  readFiles: Set<string>;
}

function createToolTracker(): ToolCallTracker {
  return { listedDirs: new Set(), readFiles: new Set() };
}

function isRedundantToolCall(tracker: ToolCallTracker, name: string, args: Record<string, any>): boolean {
  if (name === 'list_directory') {
    const dir = (args.path as string || '').replace(/\/+$/, '');
    if (tracker.listedDirs.has(dir)) return true;
    tracker.listedDirs.add(dir);
  }
  if (name === 'read_file') {
    const file = (args.path as string || '').replace(/\/+$/, '');
    if (tracker.readFiles.has(file)) return true;
    tracker.readFiles.add(file);
  }
  return false;
}

// ── Test run status tracking ───────────────────────────
const activeTestRuns: Map<string, { total: number; completed: number; status: string; results: any[] }> = new Map();

// ── Resolve provider for any model (no global mutation) ──
function resolveProviderForModel(modelId: string): { chatURL: string; apiKey: string; providerId: string } | null {
  const resolved = getProviderForModel(appConfig, modelId);
  if (!resolved) return null;
  return { chatURL: resolved.chatURL, apiKey: resolved.apiKey, providerId: resolved.provider.id };
}

// ── Provider resolution ─────────────────────────────
function resolveActiveProvider(): { chatURL: string; apiKey: string; providerId: string } | null {
  const modelId = appConfig.activeModel || 'MiniMax-M2.7';
  const resolved = getProviderForModel(appConfig, modelId);
  if (!resolved) return null;
  return { chatURL: resolved.chatURL, apiKey: resolved.apiKey, providerId: resolved.provider.id };
}

function getActiveModel(): string {
  return appConfig.activeModel || 'MiniMax-M2.7';
}

function getPersonality(): string {
  return appConfig.personality || '';
}

// ── In-memory store ────────────────────────────────────
const sessions: Map<string, SessionRow> = new Map();

// ── Session Routes ─────────────────────────────────────

app.get('/api/sessions', (_req, res) => {
  const list = Array.from(sessions.values())
    .map(({ id, title, workingDir, createdAt, updatedAt, messages }) => ({
      id,
      title,
      workingDir,
      createdAt,
      updatedAt,
      preview: messages.length > 0 ? messages[messages.length - 1].content.slice(0, 80) : '',
      messageCount: messages.length,
    }))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  res.json(list);
});

app.get('/api/sessions/:id', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const { id, title, workingDir, messages, createdAt, updatedAt } = session;
  res.json({ id, title, workingDir, messages, createdAt, updatedAt });
});

app.post('/api/sessions', (req, res) => {
  const { title, workingDir } = req.body as { title?: string; workingDir?: string };
  const session: SessionRow = {
    id: uuid(),
    title: title || 'New Session',
    workingDir: workingDir || null,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  sessions.set(session.id, session);
  res.status(201).json(session);
});

app.delete('/api/sessions/:id', (req, res) => {
  sessions.delete(req.params.id);
  res.status(204).end();
});

// ── Config endpoints ───────────────────────────────────

app.get('/api/config', (_req, res) => {
  const safeConfig = {
    ...appConfig,
    providers: appConfig.providers.map((p) => ({
      ...p,
      apiKey: p.apiKey ? '••••' + p.apiKey.slice(-4) : '', // mask the key
    })),
    mcpServers: appConfig.mcpServers.map((s) => ({
      ...s,
      authToken: s.authToken ? '••••' + s.authToken.slice(-4) : '',
    })),
  };
  res.json(safeConfig);
});

app.put('/api/config', (req, res) => {
  const updates = req.body;
  // Only allow updating safe fields
  if (updates.personality !== undefined) appConfig.personality = updates.personality;
  if (updates.activeModel !== undefined) appConfig.activeModel = updates.activeModel;
  if (updates.activeTheme !== undefined) appConfig.activeTheme = updates.activeTheme;
  if (updates.roleAssignments !== undefined) appConfig.roleAssignments = updates.roleAssignments;
  saveConfig(appConfig);
  res.json({ ok: true });
});

// ── Provider endpoints ─────────────────────────────────

app.get('/api/providers', (_req, res) => {
  const providers = appConfig.providers.map((p) => ({
    ...p,
    apiKey: p.apiKey ? '••••' + p.apiKey.slice(-4) : '',
    hasKey: !!p.apiKey,
  }));
  res.json(providers);
});

app.post('/api/providers', (req, res) => {
  const { id, name, type, apiKey, baseURL, models } = req.body as any;
  if (!name || !type || !baseURL) {
    return res.status(400).json({ error: 'name, type, and baseURL are required' });
  }
  const provider: StoredProvider = {
    id: id || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    type: type as StoredProvider['type'],
    apiKey: apiKey || '',
    baseURL,
    models: models || [],
  };
  appConfig = upsertProvider(appConfig, provider);
  saveConfig(appConfig);
  res.status(201).json({ ...provider, apiKey: '••••', hasKey: !!provider.apiKey });
});

app.put('/api/providers/:id', (req, res) => {
  const existing = appConfig.providers.find((p) => p.id === req.params.id);
  if (!existing) return res.status(404).json({ error: 'Provider not found' });

  const updates = req.body as any;
  // Merge selectively — don't allow clearing the apiKey with a masked value
  if (updates.name !== undefined) existing.name = updates.name;
  if (updates.type !== undefined) existing.type = updates.type;
  if (updates.baseURL !== undefined) existing.baseURL = updates.baseURL;
  if (updates.apiKey && !updates.apiKey.startsWith('••••')) existing.apiKey = updates.apiKey;
  if (updates.models !== undefined) existing.models = updates.models;

  appConfig = upsertProvider(appConfig, existing);
  saveConfig(appConfig);
  res.json({ ...existing, apiKey: '••••', hasKey: !!existing.apiKey });
});

app.delete('/api/providers/:id', (req, res) => {
  appConfig = removeProvider(appConfig, req.params.id);
  saveConfig(appConfig);
  res.status(204).end();
});

// ── Test provider connection ───────────────────────────

app.post('/api/providers/:id/test', async (req, res) => {
  const provider = appConfig.providers.find((p) => p.id === req.params.id);
  if (!provider) return res.status(404).json({ error: 'Provider not found' });

  // If a new apiKey/baseURL is provided in the test request, use it
  const testProvider = { ...provider };
  if (req.body?.apiKey && !req.body.apiKey.startsWith('••••')) testProvider.apiKey = req.body.apiKey;
  if (req.body?.baseURL) testProvider.baseURL = req.body.baseURL;

  const result = await testProviderConnection(testProvider);
  res.json(result);
});

// ── Fetch models from provider ─────────────────────────

app.post('/api/providers/:id/models', async (req, res) => {
  const provider = appConfig.providers.find((p) => p.id === req.params.id);
  if (!provider) return res.status(404).json({ error: 'Provider not found' });

  // Allow passing temp credentials for the fetch
  const fetchProvider = { ...provider };
  if (req.body?.apiKey && !req.body.apiKey.startsWith('••••')) fetchProvider.apiKey = req.body.apiKey;
  if (req.body?.baseURL) fetchProvider.baseURL = req.body.baseURL;

  try {
    const fetchedModels = await fetchProviderModels(fetchProvider);

    // Merge with existing models, preserving enabled state
    const existingMap = new Map(provider.models.map((m) => [m.id, m]));
    const merged = fetchedModels.map((fm) => {
      const existing = existingMap.get(fm.id);
      return { id: fm.id, name: fm.name, enabled: existing ? existing.enabled : true };
    });

    // Persist to config
    provider.models = merged;
    appConfig = upsertProvider(appConfig, provider);
    saveConfig(appConfig);

    res.json(merged);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

// ── MCP Server endpoints ───────────────────────────────

app.get('/api/mcp-servers', (_req, res) => {
  const servers = appConfig.mcpServers.map((s) => ({
    ...s,
    authToken: s.authToken ? '••••' + s.authToken.slice(-4) : '',
  }));
  // Include Docker MCP as a built-in
  const builtIn = {
    id: 'docker-mcp',
    name: 'Docker MCP',
    endpoint: 'stdio://mcp-docker',
    authType: 'none',
    authToken: '',
    enabled: true,
    builtIn: true,
    description: 'Containerized tool execution via Docker MCP server',
  };
  res.json([builtIn, ...servers]);
});

app.post('/api/mcp-servers', (req, res) => {
  const { name, endpoint, authType, authToken, enabled } = req.body as any;
  if (!name || !endpoint) {
    return res.status(400).json({ error: 'name and endpoint are required' });
  }
  const server: StoredMCPServer = {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    endpoint,
    authType: authType || 'none',
    authToken: authToken || '',
    enabled: enabled !== false,
  };
  appConfig = upsertMCPServer(appConfig, server);
  saveConfig(appConfig);
  res.status(201).json({ ...server, authToken: '••••' });
});

app.delete('/api/mcp-servers/:id', (req, res) => {
  appConfig = removeMCPServer(appConfig, req.params.id);
  saveConfig(appConfig);
  // Also stop the process if running
  mcpManager.stopServer(req.params.id).catch(() => {});
  res.status(204).end();
});

// ── MCP runtime endpoints ─────────────────────────────

app.get('/api/mcp/status', (_req, res) => {
  res.json(mcpManager.getStatus());
});

app.post('/api/mcp/:serverId/tools/:toolName', async (req, res) => {
  const { serverId, toolName } = req.params;
  const args = req.body || {};
  try {
    const result = await mcpManager.callTool(serverId, toolName, args);
    res.json({ result });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/mcp/:serverId/start', async (req, res) => {
  const { serverId } = req.params;
  const server = serverId === 'docker-mcp'
    ? { id: 'docker-mcp', name: 'Docker MCP', endpoint: 'stdio://docker mcp gateway run --transport stdio --profile ai_coding' }
    : appConfig.mcpServers.find((s) => s.id === serverId);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  try {
    const client = await mcpManager.startServer(server.id, server.name, server.endpoint);
    res.json({
      id: client.id,
      name: client.name,
      running: client.isConnected(),
      toolCount: client.getTools().length,
    });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/mcp/:serverId/stop', async (req, res) => {
  await mcpManager.stopServer(req.params.serverId);
  res.json({ ok: true });
});

// ── Models endpoint (all enabled models across providers) ──

app.get('/api/models', (_req, res) => {
  const models = appConfig.providers
    .filter((p) => p.apiKey || p.type === 'local')
    .flatMap((p) =>
      p.models
        .filter((m) => m.enabled)
        .map((m) => {
          const family = detectModelFamily(m.id);
          const profile = getModelConfig(m.id);
          return {
            id: m.id,
            name: m.name,
            providerId: p.id,
            providerName: p.name,
            type: p.type,
            family,
            contextWindowTokens: profile.contextWindowTokens,
          };
        })
    );
  res.json(models);
});

// ── Filesystem Routes ──────────────────────────────────

// List directory contents
app.get('/api/fs/list', (req, res) => {
  const dir = req.query.path as string;
  if (!dir || !existsSync(dir)) return res.status(400).json({ error: 'Invalid path' });

  try {
    const stat = statSync(dir);
    if (!stat.isDirectory()) return res.status(400).json({ error: 'Not a directory' });

    const entries = readdirSync(dir)
      .filter(name => !name.startsWith('.'))
      .map(name => {
        try {
          const fullPath = join(dir, name);
          const s = lstatSync(fullPath);
          return {
            name,
            path: fullPath,
            type: s.isDirectory() ? 'directory' : 'file',
            extension: s.isFile() ? extname(name).toLowerCase() : undefined,
            size: s.size,
            modified: s.mtime.toISOString(),
          };
        } catch { return null; }
      })
      .filter(Boolean)
      .sort((a: any, b: any) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    res.json({ path: dir, entries });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Read file contents
app.get('/api/fs/read', (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath || !existsSync(filePath)) return res.status(400).json({ error: 'Invalid path' });

  try {
    const stat = statSync(filePath);
    if (stat.isDirectory()) return res.status(400).json({ error: 'Path is a directory' });
    if (stat.size > 1024 * 1024) return res.status(400).json({ error: 'File too large (max 1MB)' });

    const content = readFileSync(filePath, 'utf-8');
    res.json({
      path: filePath,
      name: basename(filePath),
      extension: extname(filePath),
      size: stat.size,
      modified: stat.mtime.toISOString(),
      content,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Terminal Route ─────────────────────────────────────

app.post('/api/terminal/exec', (req, res) => {
  const { command, cwd } = req.body as { command: string; cwd?: string };
  if (!command?.trim()) return res.status(400).json({ error: 'Command is required' });

  const workingDir = cwd || homedir();
  const start = Date.now();

  try {
    const output = execSync(command, {
      cwd: workingDir,
      timeout: 30000,
      maxBuffer: 1024 * 1024,
      encoding: 'utf-8',
      shell: '/bin/zsh',
    });

    res.json({
      command,
      output: output || '',
      exitCode: 0,
      duration: Date.now() - start,
      cwd: workingDir,
    });
  } catch (err: any) {
    res.json({
      command,
      output: err.stdout || '' + (err.stderr || ''),
      exitCode: err.status || 1,
      duration: Date.now() - start,
      cwd: workingDir,
    });
  }
});

// ── Open Folder (native dialog) ────────────────────────
app.post('/api/dialog/open-folder', (_req, res) => {
  // Use osascript on macOS to show a folder picker
  try {
    const result = execSync(
      `osascript -e 'POSIX path of (choose folder with prompt "Open Folder")'`,
      { encoding: 'utf-8' }
    ).trim();
    res.json({ path: result });
  } catch {
    // User cancelled or not available
    res.json({ path: null });
  }
});

// ── Send message (stream MiniMax response) ─────────────
app.post('/api/sessions/:id/messages', async (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { content } = req.body as { content: string };
  if (!content?.trim()) return res.status(400).json({ error: 'Content is required' });

  const userMsg: MessageRow = {
    id: uuid(),
    role: 'user',
    content,
    timestamp: new Date().toISOString(),
  };
  session.messages.push(userMsg);

  if (session.messages.filter((m) => m.role === 'user').length === 1) {
    session.title = content.slice(0, 60);
  }
  session.updatedAt = new Date().toISOString();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const assistantId = uuid();
  res.write(`event: user_message\ndata: ${JSON.stringify(userMsg)}\n\n`);
  res.write(`event: assistant_start\ndata: ${JSON.stringify({ id: assistantId, role: 'assistant' })}\n\n`);

  const resolved = resolveActiveProvider();
  if (!resolved) {
    await streamLocalFallback(content, res, assistantId, session);
  } else {
    await streamModel(resolved.chatURL, resolved.apiKey, resolved.providerId, session.messages, res, assistantId, session);
  }

  res.write(`event: done\ndata: {}\n\n`);
  res.end();
});

// ── MCP tool helpers for chat ──────────────────────────

function gatherMCPToolsForAPI(): { tools: any[]; toolServerMap: Record<string, string> } {
  const status = mcpManager.getStatus();
  const tools: any[] = [];
  const toolServerMap: Record<string, string> = {};

  // ── Built-in filesystem tools (always available) ────
  tools.push({
    type: 'function',
    function: {
      name: 'list_directory',
      description: 'List files and directories at a given path. Returns name, type (file/directory), size, and extension for each entry.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute directory path to list' },
        },
        required: ['path'],
      },
    },
  });
  toolServerMap['list_directory'] = '__builtin__';

  tools.push({
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file. Returns the file content as text. Max 1MB.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute file path to read' },
        },
        required: ['path'],
      },
    },
  });
  toolServerMap['read_file'] = '__builtin__';

  tools.push({
    type: 'function',
    function: {
      name: 'exec_command',
      description: 'Execute a shell command and return stdout/stderr. Use for running git, grep, wc, find, etc. 30s timeout, 1MB max output.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to execute' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['command'],
      },
    },
  });
  toolServerMap['exec_command'] = '__builtin__';

  // ── MCP tools from Docker/external servers ──────────
  for (const server of status) {
    if (!server.running) continue;
    const client = mcpManager.getClient(server.id);
    if (!client) continue;
    const mcpTools = client.getTools();
    for (const tool of mcpTools) {
      tools.push({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description || '',
          parameters: tool.inputSchema || { type: 'object', properties: {} },
        },
      });
      toolServerMap[tool.name] = server.id;
    }
  }
  return { tools, toolServerMap };
}

async function invokeMCPTool(
  toolName: string,
  args: Record<string, any>,
  toolServerMap: Record<string, string>,
): Promise<any> {
  const serverId = toolServerMap[toolName];
  if (!serverId) throw new Error('No server for tool: ' + toolName);

  // ── Built-in tools (handled locally) ────────────────
  if (serverId === '__builtin__') {
    switch (toolName) {
      case 'list_directory': {
        const dir = args.path as string;
        if (!dir || !existsSync(dir)) return { error: 'Invalid path' };
        try {
          const stat = statSync(dir);
          if (!stat.isDirectory()) return { error: 'Not a directory' };
          const entries = readdirSync(dir)
            .filter(name => !name.startsWith('.'))
            .map(name => {
              try {
                const full = join(dir, name);
                const s = lstatSync(full);
                return { name, type: s.isDirectory() ? 'directory' : 'file', size: s.size, extension: s.isFile() ? extname(name).toLowerCase() : undefined };
              } catch { return null; }
            })
            .filter(Boolean)
            .sort((a: any, b: any) => a.type !== b.type ? (a.type === 'directory' ? -1 : 1) : a.name.localeCompare(b.name));
          return { path: dir, entries };
        } catch (err: any) { return { error: err.message }; }
      }
      case 'read_file': {
        const filePath = args.path as string;
        if (!filePath || !existsSync(filePath)) return { error: 'Invalid path' };
        try {
          const stat = statSync(filePath);
          if (stat.isDirectory()) return { error: 'Path is a directory' };
          if (stat.size > 1024 * 1024) return { error: 'File too large (max 1MB)' };
          return { path: filePath, content: readFileSync(filePath, 'utf-8'), size: stat.size };
        } catch (err: any) { return { error: err.message }; }
      }
      case 'exec_command': {
        const command = args.command as string;
        const cwd = (args.cwd as string) || homedir();
        if (!command?.trim()) return { error: 'No command' };
        try {
          const output = execSync(command, { cwd, timeout: 30000, maxBuffer: 1024 * 1024, encoding: 'utf-8', shell: '/bin/zsh' });
          return { output: output || '', exitCode: 0, cwd };
        } catch (err: any) {
          return { output: (err.stdout || '') + (err.stderr || ''), exitCode: err.status || 1, cwd };
        }
      }
      default:
        return { error: 'Unknown built-in tool: ' + toolName };
    }
  }

  // ── MCP tools (handled by MCP manager) ──────────────
  return mcpManager.callTool(serverId, toolName, args);
}

async function parseStreamForContentAndTools(
  response: Response,
  res: express.Response,
  assistantId: string,
): Promise<{ content: string; toolCalls: Array<{ id: string; name: string; arguments: string }> }> {
  const reader = (response as any).body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  const toolCallMap = new Map<number, { id: string; name: string; arguments: string }>();
  const monologueBuf = new MonologueBuffer();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta;
        if (!delta) continue;

        // Handle text content (with monologue stripping)
        if (delta.content) {
          content += delta.content;
          const cleaned = stripThinkingTags(delta.content);
          const filtered = monologueBuf.feed(cleaned);
          if (filtered) res.write('event: text\ndata: ' + JSON.stringify({ id: assistantId, text: filtered }) + '\n\n');
        }

        // Handle tool calls (OpenAI-compatible streaming format)
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCallMap.has(idx)) {
              toolCallMap.set(idx, { id: tc.id || '', name: '', arguments: '' });
            }
            const existing = toolCallMap.get(idx)!;
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.name = tc.function.name;
            if (tc.function?.arguments) existing.arguments += tc.function.arguments;
          }
        }
      } catch { /* skip malformed chunks */ }
    }
  }

  // Flush any remaining monologue buffer content
  const remaining = monologueBuf.flush();
  if (remaining) res.write('event: text\ndata: ' + JSON.stringify({ id: assistantId, text: remaining }) + '\n\n');

  const toolCalls = Array.from(toolCallMap.values()).filter((tc) => tc.name);
  return { content, toolCalls };
}

// ── Universal model streaming (with MCP tool-calling loop) ─
async function streamModel(
  chatURL: string,
  apiKey: string,
  providerId: string,
  messages: MessageRow[],
  res: express.Response,
  assistantId: string,
  session: SessionRow,
  overrideModelId?: string,
) {
  // ── Model-aware prompt building ─────────────────────
  // Use the promptBuilder to generate a system prompt, tool config, and
  // generation parameters adapted to the active model's family profile.
  const activeModel = overrideModelId || getActiveModel();
  const modelConfig = getModelConfig(activeModel);
  const personality = getPersonality();

  // Gather MCP tools from all connected servers first
  const { tools: mcpApiTools, toolServerMap } = gatherMCPToolsForAPI();

  // Build the complete prompt configuration for this model
  const promptResult = buildPromptForModel({
    modelId: activeModel,
    role: 'coder',
    personality: personality || undefined,
    workingDir: session.workingDir || undefined,
    tools: mcpApiTools.length > 0 ? mcpApiTools : undefined,
    enableThinking: isReasoningModel(activeModel),
  });

  // If the model doesn't support native tool calls, append tool descriptions as text
  let systemPrompt = promptResult.systemPrompt;
  if (!promptResult.useNativeToolCalls && mcpApiTools.length > 0) {
    systemPrompt += toolsAsText(mcpApiTools);
  }
  // Prevent model from narrating its thought process before the answer
  systemPrompt += '\n\nRULE: Start your response directly with the answer. Do NOT narrate your planning process. Never say things like The user wants me to or Let me or I need to or I will or Now I. Begin immediately with the substantive response.';


  // ── Context management: fit conversation within model's token budget ──
  const sessionMsgs: any[] = messages.map(({ role, content }) => ({ role: role as string, content }));
  const ctx = buildContextWindow(
    sessionMsgs,
    activeModel,
    systemPrompt,
    promptResult.generationConfig.max_tokens,
  );
  const apiMessages: any[] = [
    { role: 'system', content: systemPrompt },
    ...ctx.messages,
  ];
  if (ctx.compressedCount > 0 || ctx.summarized) {
    console.log(`[ctx] ${activeModel}: kept ${ctx.keptCount}/${messages.length} msgs, ${ctx.compressedCount} compressed, budget ${ctx.tokensUsed}/${ctx.budget.availableForHistory} tokens`);
  }

  const MAX_TOOL_ROUNDS = 6;
  const toolTracker = createToolTracker();
  let finalContent = '';
  const sessionToolCalls: ToolCallRow[] = [];

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const requestBody: any = {
        model: activeModel,
        messages: apiMessages,
        stream: true,
        max_tokens: promptResult.generationConfig.max_tokens,
        temperature: promptResult.generationConfig.temperature,
      };
      // Leave the final round tool-free so the model must produce a user-facing answer.
      if (round < MAX_TOOL_ROUNDS - 1 && mcpApiTools.length > 0 && promptResult.useNativeToolCalls) {
        requestBody.tools = mcpApiTools;
      }
      // On the last round, tools are simply omitted — the model produces its final answer naturally.

      const response = await fetch(chatURL, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const err = await response.text();
        res.write('event: error\ndata: ' + JSON.stringify({ error: `${providerId} API error: ${response.status} ${err}` }) + '\n\n');
        return;
      }

      // Parse streaming response — extracts both text deltas and tool calls
      const { content, toolCalls } = await parseStreamForContentAndTools(response, res, assistantId);

      // No tool calls → we're done, this is the final text answer.
      if (toolCalls.length === 0) {
        finalContent = content;
        break;
      }

      if (content.trim()) finalContent = content;

      // Add the assistant message with tool calls to the conversation context
      apiMessages.push({
        role: 'assistant',
        content: content || null,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: tc.arguments },
        })),
      });

      // Invoke each tool call via MCP
      for (const tc of toolCalls) {
        const tcId = tc.id || uuid();
        res.write('event: tool_call\ndata: ' + JSON.stringify({ id: tcId, name: tc.name, status: 'running', input: tc.arguments }) + '\n\n');

        const startTime = Date.now();
        let output: string;
        let parsedArgs: any = {};
        try { parsedArgs = JSON.parse(tc.arguments); } catch { parsedArgs = {}; }

        // Skip redundant tool calls (already listed/read this path)
        if (isRedundantToolCall(toolTracker, tc.name, parsedArgs)) {
          const skipMsg = `[Skipped: ${tc.name} already called with same path]`;
          res.write('event: tool_call\ndata: ' + JSON.stringify({ id: tcId, name: tc.name, status: 'complete', input: tc.arguments, output: skipMsg, duration: 0 }) + '\n\n');
          apiMessages.push({ role: 'tool', tool_call_id: tcId, content: skipMsg });
          sessionToolCalls.push({ id: tcId, name: tc.name, status: 'complete', input: tc.arguments, output: skipMsg, duration: 0 });
          continue;
        }

        try {
          const mcpResult = await invokeMCPTool(tc.name, parsedArgs, toolServerMap);
          output = typeof mcpResult === 'string' ? mcpResult : JSON.stringify(mcpResult, null, 2);
        } catch (err: any) {
          output = 'Error: ' + err.message;
        }
        const duration = Date.now() - startTime;

        res.write('event: tool_call\ndata: ' + JSON.stringify({ id: tcId, name: tc.name, status: 'complete', input: tc.arguments, output: output.slice(0, 500), duration }) + '\n\n');

        sessionToolCalls.push({ id: tcId, name: tc.name, status: 'complete', input: tc.arguments, output: output.slice(0, 2000), duration });

        // Add tool result to conversation for next round
        apiMessages.push({ role: 'tool', tool_call_id: tcId, content: output });
      }
    }

    if (!finalContent.trim()) {
      finalContent = 'I used the available tools but did not receive a final model response. Please try again, or narrow the request and I will continue from there.';
      res.write('event: text\ndata: ' + JSON.stringify({ id: assistantId, text: finalContent }) + '\n\n');
    }

    // Save the final assistant message
    session.messages.push({
      id: assistantId,
      role: 'assistant',
      content: stripThinkingTags(finalContent),
      timestamp: new Date().toISOString(),
      toolCalls: sessionToolCalls.length > 0 ? sessionToolCalls : undefined,
    });
    session.updatedAt = new Date().toISOString();

  } catch (err: any) {
    res.write('event: error\ndata: ' + JSON.stringify({ error: err.message }) + '\n\n');
  }
}

// ── Local fallback ─────────────────────────────────────
async function streamLocalFallback(content: string, res: express.Response, assistantId: string, session: SessionRow) {
  const responses = [
    `I'll help you with that. Let me analyze your request:\n\n> ${content.slice(0, 100)}\n\nHere's my approach:\n\n1. Break down the problem\n2. Identify key components\n3. Implement a solution\n\n\`\`\`typescript\nconst result = await analyze(content);\nconsole.log(result);\n\`\`\``,
    `Good question! Let me work on this.\n\n**Analysis:**\n\n- A modular approach for flexibility\n- Simple, testable implementation\n- Document key decisions\n\n\`\`\`bash\n$ npm run analyze\n\n✓ Found 3 relevant modules\n✓ No conflicts detected\n\`\`\``,
    `Let me look into this right away.\n\n1. **Explore** the current codebase\n2. **Design** the solution\n3. **Implement** changes\n4. **Test** everything\n\n\`\`\`tsx\nconst Component = () => {\n  const [state, setState] = useState(initial);\n  return <Layout>{content}</Layout>;\n};\n\`\`\``,
  ];

  const response = responses[Math.floor(Math.random() * responses.length)];
  const words = response.split(' ');

  res.write(`event: tool_call\ndata: ${JSON.stringify({ id: uuid(), name: 'exec_command', status: 'running', input: 'echo "analyzing..."' })}\n\n`);
  await sleep(300);
  res.write(`event: tool_call\ndata: ${JSON.stringify({ id: uuid(), name: 'exec_command', status: 'complete', input: 'npm run analyze', output: '✓ Analysis complete', duration: 1200 })}\n\n`);

  for (let i = 0; i < words.length; i++) {
    res.write(`event: text\ndata: ${JSON.stringify({ id: assistantId, text: i > 0 ? ' ' + words[i] : words[i] })}\n\n`);
    await sleep(20 + Math.random() * 40);
  }

  session.messages.push({
    id: assistantId, role: 'assistant', content: response,
    timestamp: new Date().toISOString(),
    toolCalls: [{ id: uuid(), name: 'exec_command', status: 'complete', input: 'npm run analyze', output: '✓ Analysis complete', duration: 1200 }],
  });
  session.updatedAt = new Date().toISOString();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Test Harness ──────────────────────────────────────
app.post('/api/test/run', async (req, res) => {
  const { prompt, modelId, workingDir, testId } = req.body as {
    prompt: string;
    modelId?: string;
    workingDir?: string;
    testId?: string;
  };

  if (!prompt?.trim()) return res.status(400).json({ error: 'prompt is required' });

  const tid = testId || 'test-' + Date.now();
  const targetModel = modelId || appConfig.activeModel;
  const targetDir = workingDir || '/Users/kevink/Projects/Chains';

  // Create a temporary session for the test
  const testSession: SessionRow = {
    id: uuid(),
    title: `[test] ${tid}`,
    workingDir: targetDir,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  sessions.set(testSession.id, testSession);

  // Resolve provider directly for the target model — no global mutation
  const resolved = resolveProviderForModel(targetModel);
  if (!resolved) {
    res.json({ testId: tid, model: targetModel, error: 'No provider for model', response: '' });
    return;
  }

  // Collect full response using a writer callback (no mock res object)
  const chunks: string[] = [];
  const toolCalls: any[] = [];

  const writer = {
    write: (data: string) => {
      const lines = data.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const payload = line.slice(6);
          if (payload === '{}' || payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.text) chunks.push(parsed.text);
            if (parsed.name && parsed.status) toolCalls.push(parsed);
          } catch {}
        }
      }
      return true;
    },
    setHeader: () => {},
    end: () => {},
  } as unknown as express.Response;

  const userMsg: MessageRow = {
    id: uuid(),
    role: 'user',
    content: prompt,
    timestamp: new Date().toISOString(),
  };
  testSession.messages.push(userMsg);

  // Register this test run for status tracking
  activeTestRuns.set(tid, { total: 1, completed: 0, status: 'running', results: [] });

  try {
    await streamModel(
      resolved.chatURL, resolved.apiKey, resolved.providerId,
      testSession.messages, writer, uuid(), testSession,
      targetModel, // pass model directly — no global mutation
    );
  } catch (testErr: any) {
    console.error('[test] streamModel error:', testErr.message);
  }

  // Update status
  const runStatus = activeTestRuns.get(tid);
  if (runStatus) {
    runStatus.completed = 1;
    runStatus.status = 'complete';
  }

  const response = chunks.join('');
  res.json({
    testId: tid,
    model: targetModel,
    workingDir: targetDir,
    toolCallCount: toolCalls.length,
    toolCalls: toolCalls.map(tc => ({ name: tc.name, status: tc.status })),
    response,
    messageCount: testSession.messages.length,
    duration: Date.now() - new Date(testSession.createdAt).getTime(),
  });
});

// ── Test status endpoint ──────────────────────────────
app.get('/api/test/status', (req, res) => {
  const runId = req.query.runId as string;
  if (runId) {
    const run = activeTestRuns.get(runId);
    if (!run) return res.status(404).json({ error: 'Test run not found' });
    return res.json({
      runId,
      status: run.status,
      total: run.total,
      completed: run.completed,
      results: run.results,
    });
  }
  // Return all active/recent runs
  const all: any[] = [];
  for (const [id, run] of activeTestRuns) {
    all.push({ runId: id, ...run });
  }
  res.json(all);
});

// ── Batch test endpoint (for multi-model testing) ─────
app.post('/api/test/batch', async (req, res) => {
  const { prompts, modelIds, workingDir, runId } = req.body as {
    prompts: Array<{ id: string; name: string; prompt: string }>;
    modelIds: string[];
    workingDir?: string;
    runId?: string;
  };

  if (!prompts?.length || !modelIds?.length) {
    return res.status(400).json({ error: 'prompts and modelIds are required' });
  }

  const tid = runId || 'batch-' + Date.now();
  const targetDir = workingDir || '/Users/kevink/Projects/Chains';
  const total = prompts.length * modelIds.length;

  activeTestRuns.set(tid, { total, completed: 0, status: 'running', results: [] });

  // Don't await — stream results as they complete
  res.json({ runId: tid, total, status: 'running' });

  // Run tests in background
  const runStatus = activeTestRuns.get(tid)!;

  for (const modelId of modelIds) {
    const resolved = resolveProviderForModel(modelId);
    if (!resolved) {
      for (const p of prompts) {
        runStatus.results.push({ model: modelId, prompt: p.id, status: 'error', error: 'No provider for model' });
        runStatus.completed++;
      }
      continue;
    }

    for (const p of prompts) {
      const testSession: SessionRow = {
        id: uuid(),
        title: `[test] ${modelId}--${p.id}`,
        workingDir: targetDir,
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      sessions.set(testSession.id, testSession);

      const chunks: string[] = [];
      const toolCalls: any[] = [];
      const writer = {
        write: (data: string) => {
          const lines = data.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const payload = line.slice(6);
              if (payload === '{}' || payload === '[DONE]') continue;
              try {
                const parsed = JSON.parse(payload);
                if (parsed.text) chunks.push(parsed.text);
                if (parsed.name && parsed.status) toolCalls.push(parsed);
              } catch {}
            }
          }
          return true;
        },
        setHeader: () => {},
        end: () => {},
      } as unknown as express.Response;

      testSession.messages.push({
        id: uuid(), role: 'user', content: p.prompt, timestamp: new Date().toISOString(),
      });

      const startMs = Date.now();
      try {
        await streamModel(
          resolved.chatURL, resolved.apiKey, resolved.providerId,
          testSession.messages, writer, uuid(), testSession,
          modelId,
        );
      } catch (err: any) {
        console.error(`[test-batch] ${modelId}/${p.id} error:`, err.message);
      }

      const response = chunks.join('');
      runStatus.results.push({
        model: modelId,
        prompt: p.id,
        promptName: p.name,
        status: 'ok',
        toolCallCount: toolCalls.length,
        toolCalls: toolCalls.map(tc => ({ name: tc.name, status: tc.status })),
        responseLength: response.length,
        response,
        wallMs: Date.now() - startMs,
        messageCount: testSession.messages.length,
        usedTools: toolCalls.some(tc => tc.name === 'list_directory' || tc.name === 'read_file'),
      });
      runStatus.completed++;
    }
  }

  runStatus.status = 'complete';
});

// ── Start ──────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Open-Harness server running on http://localhost:${PORT}`);
  const _activeModel = appConfig.activeModel || 'MiniMax-M2.7';
  const _family = detectModelFamily(_activeModel);
  const _cfg = getModelConfig(_activeModel);
  const _resolved = resolveActiveProvider();
  console.log(`Model: ${_activeModel} (family: ${_family}, style: ${_cfg.systemPromptStyle}, tool quality: ${_cfg.toolCallQuality})`);
  console.log(`Providers: ${appConfig.providers.length} configured`);
  if (_resolved) {
    console.log(`✓ Active provider: ${_resolved.providerId} (${_resolved.chatURL})`);
  } else {
    console.log(`⚠  No provider found for model ${_activeModel} — using local fallback`);
  }
  console.log(`✓ Config loaded from ~/.open-harness/config.json`);

  // Auto-start Docker MCP gateway via stdio (keeps process alive as child)
  try {
    execSync('which docker', { encoding: 'utf-8' });
    const mcpGateway = spawn('docker', [
      'mcp', 'gateway', 'run',
      '--transport', 'stdio',
      '--profile', 'ai_coding',
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    mcpGateway.on('error', (err: Error) => console.log('[mcp-gw] Failed:', err.message));
    mcpGateway.on('exit', (code: number | null) => console.log('[mcp-gw] exited with code', code));
    mcpGateway.stderr?.on('data', (d: Buffer) => console.log('[mcp-gw:err]', d.toString().trim()));

    // Connect via stdio using the MCP client after the gateway initializes
    setTimeout(async () => {
      try {
        await mcpManager.startStdioClient('docker-mcp', 'Docker MCP', mcpGateway);
        const c = mcpManager.getClient('docker-mcp');
        console.log('✓ Docker MCP connected — tools:', c?.getTools?.()?.length || 0);
      } catch (err: any) {
        console.log('⚠  Docker MCP stdio connection failed:', err.message);
      }
    }, 5000);
    console.log('✓ Docker MCP gateway starting (stdio)');
  } catch {
    console.log('  Docker not found — Docker MCP will show as unavailable');
  }
});
