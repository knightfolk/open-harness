import express from 'express';
import cors from 'cors';
import { v4 as uuid } from 'uuid';
import { readFileSync, readdirSync, statSync, readlinkSync, existsSync, lstatSync } from 'fs';
import { join, basename, extname, relative, dirname } from 'path';
import { homedir } from 'os';
import { execSync, spawn } from 'child_process';
import { loadConfig, saveConfig, upsertProvider, removeProvider, upsertMCPServer, removeMCPServer } from './config';
import type { StoredProvider, StoredMCPServer } from './config';
import { testProviderConnection, fetchProviderModels } from './providers';

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

// Legacy MiniMax helpers (still used for streaming)
const MINIMAX_API_URL = 'https://api.minimax.io/v1/chat/completions';

function getMiniMaxApiKey(): string | null {
  const minimaxProvider = appConfig.providers.find((p) => p.id === 'minimax');
  if (minimaxProvider?.apiKey) return minimaxProvider.apiKey;
  if (process.env.MINIMAX_API_KEY) return process.env.MINIMAX_API_KEY;
  try {
    const config = JSON.parse(readFileSync(join(homedir(), '.mmx', 'config.json'), 'utf-8'));
    if (config.api_key) return config.api_key;
  } catch { /* ignore */ }
  return null;
}

function getActiveModel(): string {
  return appConfig.activeModel || 'MiniMax-M2.7';
}

function getPersonality(): string {
  return appConfig.personality || '';
}

// ── In-memory store ────────────────────────────────────
const sessions: Map<string, SessionRow> = new Map();

// ── Helpers ────────────────────────────────────────────
function safePath(base: string, sub: string): string | null {
  const resolved = join(base, sub);
  // Ensure the resolved path is within the base
  if (!resolved.startsWith(base)) return null;
  if (!existsSync(resolved)) return null;
  return resolved;
}

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
  const { id, name, type, apiKey, baseURL, models } = req.body as Partial<StoredProvider>;
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

  const updates = req.body as Partial<StoredProvider>;
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
    const models = await fetchProviderModels(fetchProvider);
    res.json(models);
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
  const { name, endpoint, authType, authToken, enabled } = req.body as Partial<StoredMCPServer>;
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
  res.status(204).end();
});

// ── Models endpoint (all enabled models across providers) ──

app.get('/api/models', (_req, res) => {
  const models = appConfig.providers
    .filter((p) => p.apiKey || p.type === 'local')
    .flatMap((p) =>
      p.models
        .filter((m) => m.enabled)
        .map((m) => ({
          id: m.id,
          name: m.name,
          providerId: p.id,
          providerName: p.name,
          type: p.type,
        }))
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

  const apiKey = getMiniMaxApiKey();
  if (!apiKey) {
    await streamLocalFallback(content, res, assistantId, session);
  } else {
    await streamMiniMax(apiKey, session.messages, res, assistantId, session);
  }

  res.write(`event: done\ndata: {}\n\n`);
  res.end();
});

// ── MiniMax streaming ──────────────────────────────────
async function streamMiniMax(
  apiKey: string,
  messages: MessageRow[],
  res: express.Response,
  assistantId: string,
  session: SessionRow,
) {
  // Build system prompt with personality + working directory context
  const personality = getPersonality();
  let systemPrompt = personality
    || 'You are a helpful AI coding assistant. Respond concisely with code examples where appropriate. Use markdown formatting.';
  if (session.workingDir) {
    systemPrompt += `\n\nThe user has a project open at: ${session.workingDir}`;
    systemPrompt += '\nYou can reference files by their paths. When showing code, always use proper file paths in code blocks.';
  }

  const apiMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...messages.map(({ role, content }) => ({ role: role as string, content })),
  ];

  try {
    const response = await fetch(MINIMAX_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: getActiveModel(),
        messages: apiMessages,
        stream: true,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      res.write(`event: error\ndata: ${JSON.stringify({ error: `MiniMax API error: ${response.status} ${err}` })}\n\n`);
      return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';
    let buffer = '';

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
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            accumulated += delta;
            res.write(`event: text\ndata: ${JSON.stringify({ id: assistantId, text: delta })}\n\n`);
          }
        } catch { /* skip */ }
      }
    }

    session.messages.push({
      id: assistantId,
      role: 'assistant',
      content: accumulated,
      timestamp: new Date().toISOString(),
    });
    session.updatedAt = new Date().toISOString();

  } catch (err: any) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
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

// ── Start ──────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  const apiKey = getMiniMaxApiKey();
  console.log(`Open-Harness server running on http://localhost:${PORT}`);
  console.log(`Model: ${getActiveModel()}`);
  console.log(`Providers: ${appConfig.providers.length} configured`);
  if (apiKey) {
    console.log(`✓ MiniMax API key loaded`);
  } else {
    console.log(`⚠  No MiniMax API key found — using local fallback`);
  }
  console.log(`✓ Config loaded from ~/.open-harness/config.json`);
});
