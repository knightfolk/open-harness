#!/usr/bin/env node
/**
 * MiniMax credential-backed smoke test.
 *
 * Exercises the new chat-path code against the real MiniMax provider that is
 * already configured with a key in ~/.openharness/config.json. Validates:
 *
 *   1. The OpenHarness server is reachable.
 *   2. The persisted config has a MiniMax provider with an apiKey.
 *   3. /api/models returns the MiniMax models (new filter regression test).
 *   4. /api/test/run streams a real answer through the new streamModel code
 *      (resolveProviderForModel → either OpenAI branch or the new native
 *      branch). MiniMax is openai-compatible so it goes through the OpenAI
 *      path, but the same prompt/streaming code is exercised.
 *   5. The response is a real answer, not monologue narration or empty.
 *
 * Exits 0 on success, 1 on any failure.
 *
 * Usage:
 *   node scripts/smoke-minimax.mjs                # against default :3001
 *   OPENHARNESS_PORT=3001 node scripts/smoke-minimax.mjs
 *   OPENHARNESS_BASE=http://localhost:3001 node scripts/smoke-minimax.mjs
 *   OPENHARNESS_MODEL=MiniMax-M3 node scripts/smoke-minimax.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.OPENHARNESS_BASE || `http://localhost:${process.env.OPENHARNESS_PORT || 3001}`;
const MODEL = process.env.OPENHARNESS_MODEL || 'MiniMax-M3';
const PROMPT = 'Reply with exactly: PONG. No other text, no markdown, no code blocks.';
const TIMEOUT_MS = Number(process.env.OPENHARNESS_TIMEOUT_MS || 60_000);

let failed = 0;
const log = (ok, label, detail) => {
  const tag = ok ? 'PASS' : 'FAIL';
  console.log(`  [${tag}] ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) failed += 1;
};

async function timedFetch(url, opts = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  console.log(`OpenHarness MiniMax smoke test`);
  console.log(`  base = ${BASE}`);
  console.log(`  model = ${MODEL}`);
  console.log('');

  // 1. Server reachability
  let config;
  try {
    const res = await timedFetch(`${BASE}/api/config`);
    if (!res.ok) {
      log(false, 'server reachable', `GET /api/config → ${res.status}`);
      process.exit(1);
    }
    config = await res.json();
    log(true, 'server reachable', `${BASE} (providers=${config.providers?.length || 0})`);
  } catch (err) {
    log(false, 'server reachable', `${err.message || err}`);
    process.exit(1);
  }

  // 2. MiniMax provider has a key
  const minimax = config.providers?.find((p) => p.id === 'minimax') || config.providers?.[0];
  if (!minimax) {
    log(false, 'MiniMax provider configured', 'no providers in config');
    process.exit(1);
  }
  if (!minimax.hasKey && minimax.type !== 'local') {
    log(false, 'MiniMax has a key', `provider type=${minimax.type}`);
    process.exit(1);
  }
  log(true, 'MiniMax provider configured', `id=${minimax.id} type=${minimax.type} hasKey=${minimax.hasKey} models=${minimax.models?.length || 0}`);

  // Also confirm the on-disk key file actually has one (the API masks it).
  try {
    const configPath = join(homedir(), '.openharness', 'config.json');
    if (existsSync(configPath)) {
      const onDisk = JSON.parse(readFileSync(configPath, 'utf-8'));
      const diskProvider = onDisk.providers?.find((p) => p.id === minimax.id);
      log(!!diskProvider?.apiKey, 'config.json has raw key on disk', diskProvider?.apiKey ? `${diskProvider.apiKey.length} chars` : 'missing');
    }
  } catch (err) {
    log(false, 'config.json readable', err.message);
  }

  // 3. /api/models includes MiniMax (proves the new filter works)
  try {
    const res = await timedFetch(`${BASE}/api/models`);
    const models = await res.json();
    const found = models.find((m) => m.id === MODEL || m.providerId === 'minimax');
    log(!!found, '/api/models returns MiniMax', `count=${models.length} sample=${found?.id || 'none'}`);
  } catch (err) {
    log(false, '/api/models reachable', err.message);
  }

  // 4. Real chat round-trip
  console.log('');
  console.log('  Streaming a real chat through /api/test/run ...');
  const t0 = Date.now();
  try {
    const res = await timedFetch(`${BASE}/api/test/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: PROMPT,
        modelId: MODEL,
        workingDir: homedir(),
        testId: `smoke-minimax-${Date.now()}`,
      }),
    });
    if (!res.ok) {
      log(false, '/api/test/run', `HTTP ${res.status}`);
      process.exit(1);
    }
    const result = await res.json();
    const dur = Date.now() - t0;
    console.log(`  raw response (${dur} ms):`);
    console.log(`    model=${result.model}`);
    console.log(`    toolCallCount=${result.toolCallCount}`);
    console.log(`    messageCount=${result.messageCount}`);
    console.log(`    response.length=${result.response?.length || 0}`);
    console.log(`    response.preview=${JSON.stringify((result.response || '').slice(0, 200))}`);

    if (result.error) {
      log(false, 'no error in result', result.error);
    } else {
      log(true, 'no error in result');
    }
    log(!!result.response, 'response is non-empty', `${result.response?.length || 0} chars`);
    log(/PONG/i.test(result.response || ''), 'response contains PONG', 'regression check for the anti-narration system prompt');
  } catch (err) {
    log(false, '/api/test/run reachable', err.message);
  }

  console.log('');
  if (failed === 0) {
    console.log('SMOKE TEST: PASS');
    process.exit(0);
  } else {
    console.log(`SMOKE TEST: FAIL (${failed} check(s) failed)`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
