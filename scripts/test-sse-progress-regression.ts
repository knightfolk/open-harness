import { strict as assert } from 'node:assert';

const BASE_URL = process.env.OPENHARNESS_URL || 'http://localhost:3001';
const MOCK_MODE = process.env.SSE_MOCK === '1';

const PROGRESS_EVENTS = new Set([
  'assistant_start',
  'run_start',
  'thinking',
  'run_step',
  'tool_call',
  'auto_router',
  'route',
]);

interface CapturedEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

function parseSSELines(raw: string): CapturedEvent[] {
  const events: CapturedEvent[] = [];
  let currentType = '';
  let currentData = '';
  for (const line of raw.split('\n')) {
    if (line.startsWith('event: ')) {
      currentType = line.slice(7).trim();
    } else if (line.startsWith('data: ')) {
      currentData = line.slice(6).trim();
    } else if (line === '' && currentType) {
      try {
        events.push({
          type: currentType,
          data: JSON.parse(currentData),
          timestamp: Date.now(),
        });
      } catch {
        events.push({ type: currentType, data: { _raw: currentData }, timestamp: Date.now() });
      }
      currentType = '';
      currentData = '';
    }
  }
  return events;
}

function validateEventOrdering(events: CapturedEvent[]): {
  passed: boolean;
  firstProgressIdx: number;
  firstTextIdx: number;
  timeToProgress: number;
  timeToText: number;
} {
  let firstProgressIdx = -1;
  let firstTextIdx = -1;
  const startTs = events[0]?.timestamp ?? 0;

  for (let i = 0; i < events.length; i++) {
    if (firstProgressIdx === -1 && PROGRESS_EVENTS.has(events[i].type)) {
      firstProgressIdx = i;
    }
    if (firstTextIdx === -1 && events[i].type === 'text') {
      firstTextIdx = i;
    }
  }

  const passed = firstProgressIdx !== -1 && (firstTextIdx === -1 || firstProgressIdx < firstTextIdx);

  return {
    passed,
    firstProgressIdx,
    firstTextIdx,
    timeToProgress: firstProgressIdx >= 0 ? events[firstProgressIdx].timestamp - startTs : -1,
    timeToText: firstTextIdx >= 0 ? events[firstTextIdx].timestamp - startTs : -1,
  };
}

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers as Record<string, string>) } });
  if (!res.ok) throw new Error(`${init?.method || 'GET'} ${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

interface SessionResponse { id: string }

async function runLiveTest(): Promise<void> {
  console.log('SSE progress regression test (live mode)');
  console.log(`  Target: ${BASE_URL}`);

  const session = await fetchJSON<SessionResponse>(`${BASE_URL}/api/sessions`, {
    method: 'POST',
    body: JSON.stringify({ title: 'SSE progress regression test' }),
  });
  const sessionId = session.id;
  console.log(`  Created session: ${sessionId}`);

  let sseRaw = '';
  let sessionIdCleaned = false;

  try {
    const res = await fetch(`${BASE_URL}/api/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Say hello in one word.' }),
    });

    if (!res.ok) {
      throw new Error(`POST /messages returned ${res.status}`);
    }

    if (!res.body) {
      throw new Error('Response body is null — streaming not available');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let done = false;

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) sseRaw += decoder.decode(value, { stream: true });
    }

    const events = parseSSELines(sseRaw);
    console.log(`  Captured ${events.length} SSE events`);

    const types = events.map((e) => e.type);
    console.log(`  Event types: ${types.join(', ')}`);

    const result = validateEventOrdering(events);

    assert.equal(result.passed, true, 'At least one progress event must arrive before first text event');

    console.log(`  First progress event index: ${result.firstProgressIdx} (${events[result.firstProgressIdx]?.type})`);
    if (result.firstTextIdx >= 0) {
      console.log(`  First text event index: ${result.firstTextIdx}`);
    } else {
      console.log('  No text event found (progress-only stream)');
    }

    if (result.timeToProgress >= 0) console.log(`  Time to first progress: ${result.timeToProgress}ms`);
    if (result.timeToText >= 0) console.log(`  Time to first text: ${result.timeToText}ms`);

    const doneEvent = events.find((e) => e.type === 'done');
    assert.equal(!!doneEvent, true, 'Stream should end with a "done" event');

    console.log('  SSE progress regression test passed.');
  } finally {
    try {
      await fetch(`${BASE_URL}/api/sessions/${sessionId}`, { method: 'DELETE' });
      sessionIdCleaned = true;
    } catch { /* best effort */ }
    if (sessionIdCleaned) console.log(`  Cleaned up session ${sessionId}`);
  }
}

function runMockTest(): void {
  console.log('SSE progress regression test (mock mode)');

  const goodLog = [
    'event: user_message\ndata: {"id":"u1","role":"user","content":"hi"}\n\n',
    'event: assistant_start\ndata: {"id":"a1","role":"assistant"}\n\n',
    'event: run_start\ndata: {"id":"r1","status":"running"}\n\n',
    'event: thinking\ndata: {"id":"a1","chars":50,"message":"Thinking"}\n\n',
    'event: text\ndata: {"id":"a1","text":"Hello"}\n\n',
    'event: run_complete\ndata: {"id":"r1","status":"complete"}\n\n',
    'event: done\ndata: {}\n\n',
  ].join('');

  const eventsGood = parseSSELines(goodLog);
  const resultGood = validateEventOrdering(eventsGood);
  assert.equal(resultGood.passed, true, 'Mock: progress should appear before text');
  assert.ok(resultGood.firstProgressIdx >= 0, 'Mock: should have a progress event');
  assert.ok(resultGood.firstProgressIdx < resultGood.firstTextIdx, 'Mock: progress before text');
  console.log('  Mock positive case passed: progress before text');

  const badLog = [
    'event: user_message\ndata: {"id":"u1","role":"user","content":"hi"}\n\n',
    'event: text\ndata: {"id":"a1","text":"Hello"}\n\n',
    'event: done\ndata: {}\n\n',
  ].join('');

  const eventsBad = parseSSELines(badLog);
  const resultBad = validateEventOrdering(eventsBad);
  assert.equal(resultBad.passed, false, 'Mock: text without progress should fail');
  console.log('  Mock negative case passed: text without progress correctly flagged');

  const noTextLog = [
    'event: user_message\ndata: {"id":"u1","role":"user","content":"hi"}\n\n',
    'event: assistant_start\ndata: {"id":"a1","role":"assistant"}\n\n',
    'event: run_start\ndata: {"id":"r1","status":"running"}\n\n',
    'event: thinking\ndata: {"id":"a1","chars":50,"message":"Thinking"}\n\n',
    'event: error\ndata: {"error":"Provider error"}\n\n',
    'event: done\ndata: {}\n\n',
  ].join('');

  const eventsNoText = parseSSELines(noTextLog);
  const resultNoText = validateEventOrdering(eventsNoText);
  assert.equal(resultNoText.passed, true, 'Mock: progress without text should pass');
  assert.equal(resultNoText.firstTextIdx, -1, 'Mock: should have no text event');
  console.log('  Mock edge case passed: progress present, no text (error scenario)');

  const emptyLog = '';
  const eventsEmpty = parseSSELines(emptyLog);
  const resultEmpty = validateEventOrdering(eventsEmpty);
  assert.equal(resultEmpty.passed, false, 'Mock: empty event stream should fail');
  console.log('  Mock edge case passed: empty stream correctly flagged');

  console.log('  All mock tests passed.');
}

if (MOCK_MODE) {
  runMockTest();
} else {
  runLiveTest().catch((err: unknown) => {
    console.error('SSE progress regression test FAILED:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
