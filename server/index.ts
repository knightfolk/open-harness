import express from 'express';
import cors from 'cors';
import { v4 as uuid } from 'uuid';
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const app = express();
app.use(cors());
app.use(express.json());

// ── Types ──────────────────────────────────────────────
interface SessionRow {
  id: string;
  title: string;
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

// ── MiniMax config ─────────────────────────────────────
const MINIMAX_API_URL = 'https://api.minimax.io/v1/chat/completions';
const MINIMAX_MODEL = 'MiniMax-M2.7';

function getMiniMaxApiKey(): string | null {
  // 1. Check env var
  if (process.env.MINIMAX_API_KEY) return process.env.MINIMAX_API_KEY;
  // 2. Check ~/.mmx/config.json
  try {
    const config = JSON.parse(readFileSync(join(homedir(), '.mmx', 'config.json'), 'utf-8'));
    if (config.api_key) return config.api_key;
  } catch { /* ignore */ }
  return null;
}

// ── In-memory store ────────────────────────────────────
const sessions: Map<string, SessionRow> = new Map();

// ── Routes ─────────────────────────────────────────────

app.get('/api/sessions', (_req, res) => {
  const list = Array.from(sessions.values())
    .map(({ id, title, createdAt, updatedAt, messages }) => ({
      id,
      title,
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
  res.json(session);
});

app.post('/api/sessions', (req, res) => {
  const { title } = req.body as { title?: string };
  const session: SessionRow = {
    id: uuid(),
    title: title || 'New Session',
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

// ── Send message (stream MiniMax response) ─────────────
app.post('/api/sessions/:id/messages', async (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { content } = req.body as { content: string };
  if (!content?.trim()) return res.status(400).json({ error: 'Content is required' });

  // Add user message
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

  // SSE setup
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
  const apiMessages = [
    {
      role: 'system' as const,
      content: 'You are a helpful AI coding assistant. Respond concisely with code examples where appropriate. Use markdown formatting.',
    },
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
        model: MINIMAX_MODEL,
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
        } catch { /* skip malformed */ }
      }
    }

    // Save assistant message to session
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

// ── Local fallback (no API key) ────────────────────────
async function streamLocalFallback(content: string, res: express.Response, assistantId: string, session: SessionRow) {
  const responses = [
    `I'll help you with that. Let me analyze your request:\n\n> ${content.slice(0, 100)}\n\nHere's my approach:\n\n1. Break down the problem\n2. Identify key components\n3. Implement a solution\n\n\`\`\`typescript\nconst result = await analyze(content);\nconsole.log(result);\n\`\`\`\n\nWant me to continue?`,
    `Good question! Let me work on this.\n\n**Analysis:**\n\nBased on the context, I recommend:\n\n- A modular approach for flexibility\n- Simple, testable implementation\n- Document key decisions\n\n\`\`\`bash\n$ npm run analyze\n\n✓ Found 3 relevant modules\n✓ No conflicts detected\n\`\`\``,
    `Let me look into this right away.\n\nHere's my plan:\n\n1. **Explore** the current codebase\n2. **Design** the solution\n3. **Implement** changes\n4. **Test** everything\n\n\`\`\`tsx\nconst Component = () => {\n  const [state, setState] = useState(initial);\n  return <Layout>{content}</Layout>;\n};\n\`\`\``,
  ];

  const response = responses[Math.floor(Math.random() * responses.length)];
  const words = response.split(' ');

  // Simulated tool call
  res.write(`event: tool_call\ndata: ${JSON.stringify({
    id: uuid(), name: 'exec_command', status: 'running', input: 'echo "analyzing..."',
  })}\n\n`);
  await sleep(300);
  res.write(`event: tool_call\ndata: ${JSON.stringify({
    id: uuid(), name: 'exec_command', status: 'complete',
    input: 'npm run analyze', output: '✓ Analysis complete\n✓ 3 modules affected', duration: 1200,
  })}\n\n`);

  for (let i = 0; i < words.length; i++) {
    res.write(`event: text\ndata: ${JSON.stringify({ id: assistantId, text: i > 0 ? ' ' + words[i] : words[i] })}\n\n`);
    await sleep(20 + Math.random() * 40);
  }

  session.messages.push({
    id: assistantId,
    role: 'assistant',
    content: response,
    timestamp: new Date().toISOString(),
    toolCalls: [
      { id: uuid(), name: 'exec_command', status: 'complete', input: 'npm run analyze', output: '✓ Analysis complete\n✓ 3 modules affected', duration: 1200 },
    ],
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
  console.log(`CMDui server running on http://localhost:${PORT}`);
  console.log(`Model: ${MINIMAX_MODEL}`);
  if (apiKey) {
    console.log(`✓ MiniMax API key loaded`);
  } else {
    console.log(`⚠  No MiniMax API key found — using local fallback`);
    console.log(`   Set MINIMAX_API_KEY or add key to ~/.mmx/config.json`);
  }
});
