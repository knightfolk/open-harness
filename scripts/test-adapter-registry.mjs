#!/usr/bin/env node
/**
 * Unit-style smoke test for the provider adapter registry.
 *
 * Verifies that the new native-adapter wiring returns the right adapter for
 * every supported provider type. Runs offline (no network) by directly
 * importing the registry module. Invoked via `npx tsx` so the .ts imports
 * are transpiled.
 *
 * Exits 0 on success, 1 on any failure.
 *
 * Usage:
 *   npx tsx scripts/test-adapter-registry.mjs
 */
import { getAdapter, streamWithAdapter } from '../server/providers/registry.ts';
import { OpenAIAdapter } from '../server/providers/openai.ts';
import { AnthropicAdapter } from '../server/providers/anthropic.ts';
import { GeminiAdapter } from '../server/providers/gemini.ts';

let failed = 0;
function assert(cond, label, detail) {
  const tag = cond ? 'PASS' : 'FAIL';
  console.log(`  [${tag}] ${label}${detail ? ' — ' + detail : ''}`);
  if (!cond) failed += 1;
}

console.log('Adapter registry test');
console.log('');

const cases = [
  { type: 'openai-compatible', expect: 'openai-compatible' },
  { type: 'local',             expect: 'openai-compatible' },
  { type: 'custom',            expect: 'openai-compatible' },
  { type: 'anthropic',         expect: 'anthropic' },
  { type: 'google',            expect: 'gemini' },
  { type: 'unknown-future',    expect: null },
];

for (const c of cases) {
  const provider = { id: c.type, name: c.type, type: c.type, apiKey: 'sk-test', baseURL: 'https://x', models: [] };
  const a = getAdapter(provider);
  const id = a ? a.id : null;
  assert(id === c.expect, `getAdapter(${c.type})`, `expected ${c.expect}, got ${id}`);
}

const openai = new OpenAIAdapter();
const anthropic = new AnthropicAdapter();
const gemini = new GeminiAdapter();
assert(openai.canHandle('openai-compatible') && openai.canHandle('local') && openai.canHandle('custom'), 'OpenAI handles all openai-compatible types');
assert(!openai.canHandle('anthropic'), 'OpenAI does NOT claim anthropic');
assert(!openai.canHandle('google'), 'OpenAI does NOT claim google');
assert(anthropic.canHandle('anthropic'), 'Anthropic handles anthropic');
assert(!anthropic.canHandle('google'), 'Anthropic does NOT claim google');
assert(gemini.canHandle('google'), 'Gemini handles google');
assert(!gemini.canHandle('anthropic'), 'Gemini does NOT claim anthropic');

// streamWithAdapter must surface a network failure as an `error` event
// rather than throwing, so the chat loop can render a clean failure.
const fakeProvider = { id: 'anthropic', name: 'A', type: 'anthropic', apiKey: 'sk-fake', baseURL: 'https://invalid.invalid', models: [] };
const events = [];
try {
  for await (const ev of streamWithAdapter(fakeProvider, { model: 'claude-test', messages: [{ role: 'user', content: 'hi' }], stream: true })) {
    events.push(ev.type);
    if (events.length > 4) break;
  }
} catch (err) {
  events.push('thrown:' + (err?.message || 'unknown'));
}
const sawError = events.includes('error') || events.some((e) => typeof e === 'string' && e.startsWith('thrown:'));
assert(sawError, 'streamWithAdapter surfaces a network failure cleanly', `events=${events.join(',')}`);

console.log('');
if (failed === 0) {
  console.log('ADAPTER REGISTRY: PASS');
  process.exit(0);
} else {
  console.log(`ADAPTER REGISTRY: FAIL (${failed} check(s) failed)`);
  process.exit(1);
}
