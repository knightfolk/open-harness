type SseEvent = { event: string; data: any };

type ToolCallEvent = {
  id?: string;
  name?: string;
  status?: string;
  error?: string;
  output?: string;
};

const base = (process.env.OPENHARNESS_BASE || 'http://127.0.0.1:3001').replace(/\/$/, '');
const workingDir = process.env.OPENHARNESS_WORKING_DIR || process.cwd();
const modelId = process.env.OPENHARNESS_LIVE_TOOL_ERROR_MODEL || '';
const approved = process.env.OPENHARNESS_APPROVE_LIVE_TOOL_ERROR === '1';
const prompt = process.env.OPENHARNESS_LIVE_TOOL_ERROR_PROMPT || [
  'Provider-approved live tool-error recovery proof.',
  'Use the available tools, not prose-only reasoning.',
  'First, intentionally call read_file for ./__openharness_missing_tool_error_probe__.txt so the first tool call fails.',
  'Then recover by calling list_directory for . and use that successful tool result to answer.',
  'In the final answer, briefly state the failed tool path, later working tool path, and retry distance if visible.',
].join(' ');

async function jsonRequest(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${path} returned ${res.status}: ${text}`);
  return body;
}

function parseSseBlock(block: string): SseEvent | null {
  let event = 'message';
  let data = '';
  for (const line of block.split('\n')) {
    if (line.startsWith('event: ')) event = line.slice(7).trim();
    if (line.startsWith('data: ')) data += line.slice(6);
  }
  if (!data) return null;
  try {
    return { event, data: JSON.parse(data) };
  } catch {
    return { event, data };
  }
}

async function streamScenario(sessionId: string): Promise<{ events: SseEvent[]; toolCalls: ToolCallEvent[]; runId: string | null }> {
  const res = await fetch(`${base}/api/sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: prompt, modelId: modelId || undefined }),
  });
  if (!res.ok || !res.body) throw new Error(`message stream returned ${res.status}: ${await res.text()}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const events: SseEvent[] = [];
  const toolCalls: ToolCallEvent[] = [];
  let runId: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    while (buffer.includes('\n\n')) {
      const index = buffer.indexOf('\n\n');
      const block = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      const parsed = parseSseBlock(block);
      if (!parsed) continue;
      events.push(parsed);
      if (parsed.event === 'run_start' && parsed.data?.id) runId = parsed.data.id;
      if (parsed.event === 'run_step' && parsed.data?.runId) runId = parsed.data.runId;
      if (parsed.event === 'tool_call') toolCalls.push(parsed.data as ToolCallEvent);
    }
  }

  return { events, toolCalls, runId };
}

async function readEvidenceStatus() {
  const body = await jsonRequest('/api/router/learning/tool-errors?summaryOnly=true');
  return body.summary;
}

if (!approved) {
  const summary = await readEvidenceStatus().catch(() => null);
  console.log(JSON.stringify({
    ok: true,
    approved: false,
    skipped: true,
    reason: 'Set OPENHARNESS_APPROVE_LIVE_TOOL_ERROR=1 to run the provider/local runtime scenario.',
    modelRequired: 'Set OPENHARNESS_LIVE_TOOL_ERROR_MODEL when you want a specific configured tool-capable model.',
    currentStatus: summary?.liveEvidenceStatus || 'unavailable',
    closeoutReady: false,
  }, null, 2));
  process.exit(0);
}

const session = await jsonRequest('/api/sessions', {
  method: 'POST',
  body: JSON.stringify({
    title: 'Live tool-error recovery proof',
    workingDir,
  }),
});

const before = await readEvidenceStatus();
const streamed = await streamScenario(session.id);
await new Promise((resolve) => setTimeout(resolve, 500));
const after = await readEvidenceStatus();

const failedTool = streamed.toolCalls.find((tool) => tool.status === 'error');
const laterWorkingTool = failedTool
  ? streamed.toolCalls.slice(streamed.toolCalls.indexOf(failedTool) + 1).find((tool) => tool.status === 'complete')
  : undefined;

const closeoutReady = after?.liveEvidenceStatus === 'available'
  && after.totalErrorEvents > before.totalErrorEvents
  && Boolean(failedTool)
  && Boolean(laterWorkingTool);

console.log(JSON.stringify({
  ok: true,
  approved: true,
  sessionId: session.id,
  runId: streamed.runId,
  requestedModel: modelId || 'active model',
  before: {
    status: before.liveEvidenceStatus,
    totalErrorEvents: before.totalErrorEvents,
    persistedEventCount: before.persistedEventCount,
    logTraceEventCount: before.logTraceEventCount,
  },
  after: {
    status: after.liveEvidenceStatus,
    totalErrorEvents: after.totalErrorEvents,
    persistedEventCount: after.persistedEventCount,
    logTraceEventCount: after.logTraceEventCount,
  },
  observedToolCalls: streamed.toolCalls.map((tool) => ({ name: tool.name, status: tool.status, error: tool.error || tool.output })),
  failedTool: failedTool ? { name: failedTool.name, error: failedTool.error || failedTool.output } : null,
  laterWorkingTool: laterWorkingTool ? { name: laterWorkingTool.name } : null,
  closeoutReady,
  message: closeoutReady
    ? 'Live tool-error recovery scenario produced closeout-ready evidence. Run npm run check:live-tool-error-evidence and record the proof artifact.'
    : 'Scenario finished but did not produce closeout-ready evidence. Inspect the run debug bundle and provider/tool behavior.',
}, null, 2));
