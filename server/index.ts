import express from 'express';
import cors from 'cors';
import { v4 as uuid } from 'uuid';

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

// ── In-memory store ────────────────────────────────────
const sessions: Map<string, SessionRow> = new Map();

// ── Routes ─────────────────────────────────────────────

// List sessions
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

// Get single session with messages
app.get('/api/sessions/:id', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

// Create session
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

// Delete session
app.delete('/api/sessions/:id', (req, res) => {
  sessions.delete(req.params.id);
  res.status(204).end();
});

// Send a message and stream the response from OpenAI
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

  // Update session title from first message
  if (session.messages.filter((m) => m.role === 'user').length === 1) {
    session.title = content.slice(0, 60);
  }
  session.updatedAt = new Date().toISOString();

  // Stream response
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const assistantId = uuid();

  // Send the user message event
  res.write(`event: user_message\ndata: ${JSON.stringify(userMsg)}\n\n`);

  // Send assistant message start
  res.write(`event: assistant_start\ndata: ${JSON.stringify({ id: assistantId, role: 'assistant' })}\n\n`);

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    // No API key — fall back to a helpful local echo response
    await streamLocalResponse(content, res, assistantId, session);
  } else {
    // Real OpenAI streaming
    await streamOpenAIResponse(apiKey, session.messages, res, assistantId);
  }

  // Finalize
  res.write(`event: done\ndata: {}\n\n`);
  res.end();
});

// ── Local fallback (no API key) ────────────────────────
async function streamLocalResponse(content: string, res: express.Response, assistantId: string, session: SessionRow) {
  const responses = [
    `I'll help you with that. Let me analyze your request:\n\n> ${content.slice(0, 100)}\n\nHere's what I'm thinking:\n\n1. First, I'll break down the problem\n2. Then identify the key components\n3. Finally, implement a solution\n\nLet me start by examining the relevant code.\n\n\`\`\`typescript\nconst result = await analyze(content);\nconsole.log(result);\n\`\`\`\n\nThis approach gives us a clear path forward. Want me to continue?`,
    `Good question! Let me look into this.\n\n**Analysis:**\n\nBased on the context, here's what I recommend:\n\n- Use a modular approach for maximum flexibility\n- Keep the implementation simple and testable\n- Document key decisions along the way\n\n\`\`\`bash\n$ npm run analyze\n\n✓ Found 3 relevant modules\n✓ Dependencies up to date\n✓ No conflicts detected\n\`\`\`\n\nShall I proceed with the implementation?`,
    `Absolutely, let me work on that right away.\n\nHere's my plan:\n\n1. **Explore** the current state of the codebase\n2. **Design** the solution architecture\n3. **Implement** the changes\n4. **Test** everything works correctly\n\n::code-comment{title="[P1] TODO" body="Need to add error handling here before shipping to production." file="/src/utils/api.ts" start=24 priority=1}\n\nI'll start by examining the existing code structure and then build from there.\n\n\`\`\`tsx\nconst Component = () => {\n  const [state, setState] = useState(initial);\n  // Implementation goes here\n  return <Layout>{content}</Layout>;\n};\n\`\`\``,
  ];

  const response = responses[Math.floor(Math.random() * responses.length)];
  const words = response.split(' ');
  let accumulated = '';

  // Simulate tool call
  res.write(`event: tool_call\ndata: ${JSON.stringify({
    id: uuid(),
    name: 'exec_command',
    status: 'running',
    input: 'echo "analyzing..."',
  })}\n\n`);

  await sleep(300);

  res.write(`event: tool_call\ndata: ${JSON.stringify({
    id: uuid(),
    name: 'exec_command',
    status: 'complete',
    input: 'npm run analyze',
    output: '✓ Analysis complete\n✓ 3 modules affected\n✓ No issues found',
    duration: 1200,
  })}\n\n`);

  // Stream text word by word
  for (let i = 0; i < words.length; i++) {
    accumulated += (i > 0 ? ' ' : '') + words[i];
    res.write(`event: text\ndata: ${JSON.stringify({ id: assistantId, text: i > 0 ? ' ' + words[i] : words[i] })}\n\n`);
    await sleep(20 + Math.random() * 40);
  }

  // Save to session
  const assistantMsg: MessageRow = {
    id: assistantId,
    role: 'assistant',
    content: response,
    timestamp: new Date().toISOString(),
    toolCalls: [
      { id: uuid(), name: 'exec_command', status: 'complete', input: 'npm run analyze', output: '✓ Analysis complete\n✓ 3 modules affected\n✓ No issues found', duration: 1200 },
    ],
  };
  session.messages.push(assistantMsg);
}

// ── Real OpenAI streaming ──────────────────────────────
async function streamOpenAIResponse(apiKey: string, messages: MessageRow[], res: express.Response, assistantId: string) {
  const apiMessages = messages.map(({ role, content }) => ({ role, content }));

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: apiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      res.write(`event: error\ndata: ${JSON.stringify({ error: err })}\n\n`);
      return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));

      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            accumulated += delta;
            res.write(`event: text\ndata: ${JSON.stringify({ id: assistantId, text: delta })}\n\n`);
          }
        } catch { /* skip malformed chunks */ }
      }
    }

    // Save to session
    const session = Array.from(sessions.values()).find((s) =>
      s.messages.some((m) => m.id === messages[messages.length - 1]?.id)
    );
    if (session) {
      session.messages.push({
        id: assistantId,
        role: 'assistant',
        content: accumulated,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err: any) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Start ──────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`CMDui server running on http://localhost:${PORT}`);
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠  No OPENAI_API_KEY set — using local fallback responses');
  }
});
