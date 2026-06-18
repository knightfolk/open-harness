# Provider Failover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover from transient provider errors (529 overloaded_error / 429 / 5xx / network) by retrying the same model with backoff, then failing over to another configured model — so a peak-hour surge no longer aborts an investigation or chat turn.

**Architecture:** A pure helper pair (`isTransientProviderError` + `retryWithProviderFailover`) lives in `server/agentRuntime.ts` and wraps the existing `callAgentModel`/`callNativeAgentModel` fetch boundary. The same retry-then-failover logic also wraps the streaming fetch in `server/index.ts`. The orchestrator passes an ordered candidate list (`fallbackModelIds`) down to `runAgentPhase`. Three total same-model attempts (`[2s, 5s]` backoff), then one attempt per fallback model.

**Tech Stack:** TypeScript (strict), Node 18+ `fetch`/`AbortSignal.any`/`AbortSignal.timeout`, `tsx` for test scripts, `node:assert`. Existing patterns from `scripts/test-agent-runtime-*.ts`.

**Spec:** `docs/superpowers/specs/2026-06-17-provider-failover-design.md`

---

### Task 1: Add `isTransientProviderError` predicate

**Files:**
- Modify: `server/agentRuntime.ts` (add near other helpers, after the imports ~line 23)
- Test: `scripts/test-provider-failover.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `scripts/test-provider-failover.ts`:

```ts
import { strict as assert } from 'node:assert';
import { isTransientProviderError } from '../server/agentRuntime';

const cases: Array<{ name: string; input: unknown; expected: boolean }> = [
  { name: '529 overloaded', input: new Error('Provider returned 529: {"type":"error","error":{"type":"overloaded_error"}}'), expected: true },
  { name: '502 bad gateway', input: new Error('Provider returned 502: Bad Gateway'), expected: true },
  { name: '503 service unavailable', input: new Error('Provider returned 503: unavailable'), expected: true },
  { name: '504 gateway timeout', input: new Error('Provider returned 504: timeout'), expected: true },
  { name: '429 rate limit', input: new Error('Provider returned 429: rate_limit_error'), expected: true },
  { name: '500 server error', input: new Error('Provider returned 500: Internal Server Error'), expected: true },
  { name: 'overloaded_error body substring', input: new Error('upstream said overloaded_error, retry later'), expected: true },
  { name: 'network TypeError', input: new TypeError('fetch failed'), expected: true },
  { name: '400 bad request', input: new Error('Provider returned 400: bad request'), expected: false },
  { name: '401 unauthorized', input: new Error('Provider returned 401: unauthorized'), expected: false },
  { name: '403 forbidden', input: new Error('Provider returned 403: forbidden'), expected: false },
  { name: '404 not found', input: new Error('Provider returned 404: not found'), expected: false },
  { name: 'generic non-transient', input: new Error('Agent exhausted tool rounds'), expected: false },
];

let failures = 0;
for (const c of cases) {
  const got = isTransientProviderError(c.input);
  if (got !== c.expected) {
    console.error(`FAIL  ${c.name}: expected ${c.expected}, got ${got}`);
    failures++;
  } else {
    console.log(`ok    ${c.name}`);
  }
}
assert.equal(failures, 0, `${failures} transient-classification case(s) failed`);
console.log('isTransientProviderError: all cases pass');
```

- [ ] **Step 2: Run test to verify it fails (import not exported yet)**

Run: `npx tsx scripts/test-provider-failover.ts`
Expected: FAIL — `isTransientProviderError is not a function` (not exported).

- [ ] **Step 3: Add the predicate to `server/agentRuntime.ts`**

Insert immediately after the imports block (after line 23, before `export interface BackgroundAgentRequest`):

```ts
// ── Provider failover: transient-error classification ──
// A provider error is "transient" if a short retry or a model switch could
// plausibly recover it: server overload (529/5xx), rate limits (429), and
// network failures. Client errors that won't self-heal (400/401/403/404) and
// user-driven aborts are NOT transient and must propagate immediately.
const TRANSIENT_HTTP_STATUSES = new Set([429, 500, 502, 503, 504, 529]);
const TRANSIENT_BODY_MARKERS = ['overloaded_error', 'rate_limit_error'];

export function isTransientProviderError(err: unknown): boolean {
  if (!err) return false;
  const message = err instanceof Error ? err.message : String(err);
  // Body markers (Anthropic-style JSON bodies forwarded by the native adapter).
  if (TRANSIENT_BODY_MARKERS.some((marker) => message.includes(marker))) return true;
  // HTTP status parsed from "Provider returned NNN: ..." or "… NNN …".
  const statusMatch = message.match(/(?:returned\s+|status\s+)(\d{3})/i);
  if (statusMatch) {
    const status = Number(statusMatch[1]);
    return TRANSIENT_HTTP_STATUSES.has(status);
  }
  // Network-layer failures (no HTTP status, thrown by fetch itself).
  if (err instanceof TypeError) return true;
  // Timeout-abort errors are transient; the caller distinguishes user-abort
  // before calling the wrapper, so any AbortError that reaches here is treated
  // as a timeout-driven abort.
  const name = (err as Error)?.name;
  if (name === 'AbortError' || name === 'TimeoutError') return true;
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx scripts/test-provider-failover.ts`
Expected: PASS — `isTransientProviderError: all cases pass`.

- [ ] **Step 5: Commit**

```bash
git add server/agentRuntime.ts scripts/test-provider-failover.ts
git commit -m "Add isTransientProviderError predicate for provider failover"
```

---

### Task 2: Add `retryWithProviderFailover` wrapper

**Files:**
- Modify: `server/agentRuntime.ts` (add after `isTransientProviderError`)
- Test: `scripts/test-provider-failover.ts` (extend)

- [ ] **Step 1: Extend the test with backoff/failover behavior**

Append to `scripts/test-provider-failover.ts` (before the final `console.log`):

```ts
import { retryWithProviderFailover } from '../server/agentRuntime';

// ── retryWithProviderFailover: same-model recovery ──
// Stub fetch to fail twice with 529 then succeed on the same model.
{
  let calls = 0;
  const originalFetch = globalThis.fetch;
  const sleeps: number[] = [];
  try {
    globalThis.fetch = (async () => {
      calls++;
      if (calls < 3) {
        return new Response('{"error":"overloaded_error"}', { status: 529 });
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: 'recovered' } }] }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    const result = await retryWithProviderFailover({
      attempt: async () => {
        const res = await fetch('https://x');
        if (!res.ok) throw new Error(`Provider returned ${res.status}: ${await res.text()}`);
        return { recovered: true, model: 'same' };
      },
      isTransient: isTransientProviderError,
      backoffMs: [10, 20],          // short for the test
      onSleep: (ms) => sleeps.push(ms),
      fallbackModelIds: [],
      fallbackAttempt: async () => { throw new Error('should not reach fallback'); },
      signal: undefined,
    });
    assert.equal(calls, 3, 'should have retried twice on same model then succeeded');
    assert.deepEqual(sleeps, [10, 20], 'should have backed off twice');
    assert.equal(result.recovered, true);
    console.log('ok    retryWithProviderFailover same-model recovery');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// ── retryWithProviderFailover: cross-model failover ──
// Original model always 529; first fallback model succeeds.
{
  const attempts: string[] = [];
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => {
      return new Response('{"error":"overloaded_error"}', { status: 529 });
    }) as typeof fetch;
    const result = await retryWithProviderFailover({
      attempt: async (modelId: string) => {
        attempts.push(modelId);
        const res = await fetch('https://x');
        if (!res.ok) throw new Error(`Provider returned ${res.status}`);
        return { recovered: true, model: modelId };
      },
      isTransient: isTransientProviderError,
      backoffMs: [5, 5],
      fallbackModelIds: ['fallback-a', 'fallback-b'],
      fallbackAttempt: async (modelId: string) => {
        attempts.push('fallback:' + modelId);
        if (modelId === 'fallback-a') return { recovered: true, model: 'fallback-a', assistedByFallback: true };
        throw new Error('Provider returned 529');
      },
      signal: undefined,
    });
    assert.deepEqual(attempts, ['orig', 'orig', 'orig', 'fallback:fallback-a'],
      'should retry orig 3x then try first fallback');
    assert.equal(result.recovered, true);
    assert.equal((result as any).assistedByFallback, true);
    console.log('ok    retryWithProviderFailover cross-model failover');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// ── retryWithProviderFailover: non-transient error propagates immediately ──
{
  let calls = 0;
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => {
      calls++;
      return new Response('{"error":"bad request"}', { status: 400 });
    }) as typeof fetch;
    await retryWithProviderFailover({
      attempt: async () => {
        const res = await fetch('https://x');
        if (!res.ok) throw new Error(`Provider returned ${res.status}`);
        return { recovered: true };
      },
      isTransient: isTransientProviderError,
      backoffMs: [10, 20],
      fallbackModelIds: ['fb'],
      fallbackAttempt: async () => { throw new Error('fallback should not run'); },
      signal: undefined,
    });
    assert.fail('should have thrown on non-transient error');
  } catch (err: any) {
    assert.match(err.message, /400/);
    assert.equal(calls, 1, 'non-transient error should short-circuit after one call');
    console.log('ok    retryWithProviderFailover non-transient propagates');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// ── retryWithProviderFailover: user abort short-circuits backoff ──
{
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 5);
  try {
    await retryWithProviderFailover({
      attempt: async () => { throw new Error('Provider returned 529'); },
      isTransient: isTransientProviderError,
      backoffMs: [5000, 5000],
      fallbackModelIds: [],
      fallbackAttempt: async () => { throw new Error('Provider returned 529'); },
      signal: controller.signal,
    });
    assert.fail('should have thrown on abort');
  } catch (err: any) {
    assert.match(err.message, /abort/i, 'should surface abort, not keep waiting');
    console.log('ok    retryWithProviderFailover abort short-circuits backoff');
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx scripts/test-provider-failover.ts`
Expected: FAIL — `retryWithProviderFailover is not a function`.

- [ ] **Step 3: Add the wrapper to `server/agentRuntime.ts`**

Insert immediately after `isTransientProviderError`:

```ts
// ── Provider failover: retry-with-backoff + cross-model failover ──
export interface ProviderFailoverOptions<T> {
  // Attempt the call for a given model. Throws on failure.
  attempt: (modelId: string) => Promise<T>;
  // Classify an error as transient. Non-transient errors propagate immediately.
  isTransient: (err: unknown) => boolean;
  // Backoff delays before each same-model retry (e.g. [2000, 5000] → 3 total attempts).
  backoffMs: number[];
  // Ordered fallback model ids to try (one attempt each) after same-model retries.
  fallbackModelIds: string[];
  // Attempt a fallback model. Same signature as `attempt`.
  fallbackAttempt: (modelId: string) => Promise<T>;
  // If provided, an abort signal that interrupts backoff sleeps immediately.
  signal?: AbortSignal;
  // Optional hook for observability/tests.
  onSleep?: (ms: number) => void;
  onRetry?: (info: { modelId: string; attempt: number; error: unknown }) => void;
  onFailover?: (info: { fromModelId: string; toModelId: string }) => void;
}

function abortSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) return new Promise((r) => setTimeout(r, ms));
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error('Aborted before backoff'));
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('Backoff aborted'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export async function retryWithProviderFailover<T>(opts: ProviderFailoverOptions<T>): Promise<T> {
  const { attempt, isTransient, backoffMs, fallbackModelIds, fallbackAttempt, signal } = opts;
  const totalSameModelAttempts = backoffMs.length + 1; // initial + one per backoff slot
  let lastErr: unknown;

  // Phase 1: retry the original model with backoff.
  for (let i = 0; i < totalSameModelAttempts; i++) {
    try {
      return await attempt('__PRIMARY__');
    } catch (err: unknown) {
      lastErr = err;
      if (!isTransient(err)) throw err;
      opts.onRetry?.({ modelId: '__PRIMARY__', attempt: i + 1, error: err });
      if (i < backoffMs.length) {
        const delay = backoffMs[i];
        opts.onSleep?.(delay);
        await abortSleep(delay, signal); // throws on user-abort → propagates
      }
    }
  }

  // Phase 2: cross-model failover, one attempt per candidate.
  for (const fallbackModelId of fallbackModelIds) {
    try {
      opts.onFailover?.({ fromModelId: '__PRIMARY__', toModelId: fallbackModelId });
      return await fallbackAttempt(fallbackModelId);
    } catch (err: unknown) {
      lastErr = err;
      // Non-transient errors on a fallback still advance to the next candidate
      // (the fallback model may be misconfigured); we do not throw, we continue.
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr ?? 'All provider attempts failed'));
}
```

> **Note on `__PRIMARY__` token:** the `attempt` thunk already knows which model it's calling (it's a closure over the resolved primary model). The `modelId` arg exists for symmetry with `fallbackAttempt` and for the `onRetry`/`onFailover` observability hooks. Callers ignore it for the primary path.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx scripts/test-provider-failover.ts`
Expected: PASS — all `ok` lines, no `FAIL`.

- [ ] **Step 5: Commit**

```bash
git add server/agentRuntime.ts scripts/test-provider-failover.ts
git commit -m "Add retryWithProviderFailover wrapper with backoff + cross-model failover"
```

---

### Task 3: Add `fallbackModelIds` to `BackgroundAgentRequest` and wire into `runAgentPhase`

**Files:**
- Modify: `server/agentRuntime.ts` (interface `~line 26`, `runAgentPhase` body `~454-687`)

- [ ] **Step 1: Extend the interface**

In `server/agentRuntime.ts`, add a field to `BackgroundAgentRequest` (after `toolContinuationInstruction?: string;`):

```ts
  /** Ordered model ids to try if the primary model fails with a transient error. */
  fallbackModelIds?: string[];
```

- [ ] **Step 2: Add a fallback-chain builder**

Add near `resolveModelId` / `pickProviderForModel` (~line 240), after `providerCanAuthenticate`:

```ts
/**
 * Build an ordered fallback model chain for a primary model, drawing from the
 * caller-supplied list first, then role assignments, active model, and
 * auto-router candidates. The primary model and unresolvable ids are excluded.
 */
function buildFallbackModelChain(
  config: StoredConfig,
  primaryModelId: string,
  requested: string[] | undefined,
): string[] {
  const seen = new Set<string>();
  const chain: string[] = [];
  const add = (id?: string) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    if (id === primaryModelId) return;
    if (!canResolveModelId(config, id)) return;
    chain.push(id);
  };
  (requested || []).forEach(add);
  Object.values(config.roleAssignments || {}).forEach(add);
  add(config.activeModel);
  (config.autoRouter?.candidates || []).forEach((c) => add(c.modelId));
  return chain.slice(0, 4);
}

function canResolveModelId(config: StoredConfig, modelId: string): boolean {
  return pickProviderForModel(config, modelId) !== null;
}
```

- [ ] **Step 3: Wrap the per-round model call in `runAgentPhase`**

In `runAgentPhase`, locate the line (around line 513):

```ts
      const modelResponse = await callAgentModel(provider, modelId, messages, profile.temperature, controller.signal, agentTools, requestTimeoutMs);
```

Replace with a failover-wrapped call. First, **before the `for (let round = 0;` loop** (after `let exhaustedToolRounds = false;`), build the chain once:

```ts
    const fallbackChain = buildFallbackModelChain(config, modelId, req.fallbackModelIds);
```

Then replace the per-round `callAgentModel` invocation with:

```ts
      const modelResponse = await retryWithProviderFailover({
        attempt: () => callAgentModel(provider, modelId, messages, profile.temperature, controller.signal, agentTools, requestTimeoutMs),
        isTransient: (err) => !controller.signal.aborted && isTransientProviderError(err),
        backoffMs: [2000, 5000],
        fallbackModelIds: fallbackChain,
        fallbackAttempt: (fbModelId) => {
          const fbProvider = pickProviderForModel(config, fbModelId);
          if (!fbProvider) throw new Error(`No provider for fallback model ${fbModelId}`);
          notes.push(`recover-model=${fbModelId}`);
          return callAgentModel(fbProvider, fbModelId, messages, profile.temperature, controller.signal, agentTools, requestTimeoutMs);
        },
        signal: req.signal,
      });
```

- [ ] **Step 4: Wrap the final forced-synthesis call identically**

Locate the `finalResponse` call (~line 608):

```ts
      const finalResponse = await callAgentModel(provider, modelId, [
        ...messages,
        { role: 'user', content: [...] },
      ], profile.temperature, controller.signal, [], requestTimeoutMs);
```

Wrap it the same way (same options; reuse `fallbackChain`):

```ts
      const finalResponse = await retryWithProviderFailover({
        attempt: () => callAgentModel(provider, modelId, [
          ...messages,
          {
            role: 'user',
            content: [
              `You have reached the read-only tool limit.`,
              `Do not request more tools.`,
              `Produce the final answer now from the evidence already gathered.`,
            ].join('\n'),
          },
        ], profile.temperature, controller.signal, [], requestTimeoutMs),
        isTransient: (err) => !controller.signal.aborted && isTransientProviderError(err),
        backoffMs: [2000, 5000],
        fallbackModelIds: fallbackChain,
        fallbackAttempt: (fbModelId) => {
          const fbProvider = pickProviderForModel(config, fbModelId);
          if (!fbProvider) throw new Error(`No provider for fallback model ${fbModelId}`);
          notes.push(`recover-model=${fbModelId}`);
          return callAgentModel(fbProvider, fbModelId, [
            ...messages,
            {
              role: 'user',
              content: [
                `You have reached the read-only tool limit.`,
                `Do not request more tools.`,
                `Produce the final answer now from the evidence already gathered.`,
              ].join('\n'),
            },
          ], profile.temperature, controller.signal, [], requestTimeoutMs);
        },
        signal: req.signal,
      });
```

- [ ] **Step 5: Verify existing agent-runtime tests still pass**

Run: `npx tsx scripts/test-agent-runtime-tool-limit.ts`
Expected: PASS (unchanged behavior — no transient errors injected).

Run: `npx tsx scripts/test-provider-failover.ts`
Expected: PASS (all cases).

- [ ] **Step 6: Commit**

```bash
git add server/agentRuntime.ts
git commit -m "Wire retry+failover into runAgentPhase model calls"
```

---

### Task 4: Pass `fallbackModelIds` from the orchestrator into all `runAgentPhase` calls

**Files:**
- Modify: `server/orchestrator.ts` (12 call sites, lines ~176, 254, 323, 582, 733, 797, 907, 1002, 1133, 1220, 1672, 1725)

- [ ] **Step 1: Add a helper to derive the candidate list from a route**

Near `resolveAgentModel` (~line 1975) in `server/orchestrator.ts`, add:

```ts
/** Candidate fallback models for a phase: the route's suggested models minus the chosen one. */
function fallbackModelsForPhase(route: RouteDecision, primaryModelId: string): string[] {
  const suggested = route.suggestedModels || [];
  const chain: string[] = [];
  const seen = new Set<string>([primaryModelId]);
  for (const id of suggested) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    chain.push(id);
  }
  return chain;
}
```

- [ ] **Step 2: Thread `fallbackModelIds` into each call site**

At each of the 12 `runAgentPhase(config, {...})` call sites, add `fallbackModelIds: fallbackModelsForPhase(route, <primaryVar>)` where `<primaryVar>` is the `modelId:` value already passed to that call. For example, at line 1133 (investigate explorer):

```ts
    exploreArtifact = await runAgentPhase(config, {
      profileId: exploreProfile,
      prompt: explorePrompt,
      modelId: exploreModel,
      fallbackModelIds: fallbackModelsForPhase(route, exploreModel),
      workingDir,
      signal: callbacks.signal,
      onStep: callbacks.onStep,
      tools: callbacks.tools,
      invokeTool: callbacks.invokeTool,
    });
```

Apply the same one-line addition to all 12 sites, using the existing `modelId`/`<role>Model` variable name at each site:
- `:176` → `modelId,` (planning room independent plan, inside `targetModels.map`)
- `:254` → `modelId,` (planning room second pass)
- `:323` → `synthesisModel,` (planning room synthesis)
- `:582` → `plannerModel,` (execute planner)
- `:733` → `implModel,` (execute implementer) — confirm the var name at site
- `:797` → `modelId,` (execute retry)
- `:907` → `modelId,` (execute repair)
- `:1002` → `reviewModel,` (execute reviewer) — confirm the var name at site
- `:1133` → `exploreModel,` (investigate explorer)
- `:1220` → `synthesisModel,` (investigate synthesis)
- `:1672` → `modelId,` (compare per-model)
- `:1725` → `judgeModel,` (compare judge) — confirm the var name at site

> **Read each site before editing** to confirm the exact `modelId:` variable name; the line numbers are a guide, not a contract. Where the call site is inside a `.map((modelId) => ...)` (e.g. `:174-186`), use `fallbackModelsForPhase(route, modelId)`.

- [ ] **Step 3: Verify the orchestrator type-checks and existing orchestration test still passes**

Run: `npx tsx scripts/test-orchestration-routing.ts`
Expected: PASS.

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add server/orchestrator.ts
git commit -m "Pass fallbackModelIds from route.suggestedModels into runAgentPhase"
```

---

### Task 5: Wrap the streaming fetch in the main chat loop

**Files:**
- Modify: `server/index.ts` (streaming loop, fetch at `~4518`, `!response.ok` branch at `~4529`)

- [ ] **Step 1: Read the current fetch + error block**

Re-read `server/index.ts:4514-4559` to confirm exact current code (variables `chatURL`, `apiKey`, `providerId`, `effectiveModel`, `apiModelId`, `effectiveResolved`, `requestBody`, `requestSignal`, `response`, `providerStartedAt`, `propagateProviderErrors`).

- [ ] **Step 2: Build a fallback chain at the top of the per-round block**

Just before `const response = await fetch(chatURL, {...})` (~line 4518), add:

```ts
      // Provider failover: candidate models to try if this model returns a transient error.
      const mainFallbackChain = buildMainChatFallbackChain(effectiveModel, route);
```

- [ ] **Step 3: Extract the request into a helper `attemptModelRequest(modelRef)`**

Define a local function inside the round loop (before the `for` body uses it) that resolves provider + builds + fires the fetch for a given model ref, returning the `Response` (throwing on `!res.ok`):

```ts
      const attemptModelRequest = async (modelRef: string): Promise<Response> => {
        const resolved = resolveProviderForModel(modelRef);
        const attemptChatURL = resolved?.chatURL ?? chatURL;
        const attemptApiKey = resolved?.apiKey ?? apiKey;
        const attemptApiModelId = splitModelRef(modelRef).bareModelId;
        const attemptBody = { ...requestBody, model: attemptApiModelId };
        const attemptResponse = await fetch(attemptChatURL, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + attemptApiKey,
            'x-api-key': attemptApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(attemptBody),
          signal: requestSignal,
        });
        if (!attemptResponse.ok) {
          const errText = await attemptResponse.text().catch(() => '');
          throw Object.assign(new Error(`Provider returned ${attemptResponse.status}: ${errText.slice(0, 200)}`), { statusCode: attemptResponse.status });
        }
        return attemptResponse;
      };
```

- [ ] **Step 4: Replace the direct `fetch` with the failover-wrapped call**

Replace the block:
```ts
      const response = await fetch(chatURL, { ... });
      if (!response.ok) {
        const err = await response.text();
        const message = `${providerId} API error: ${response.status} ${err}`;
        ...
        return;
      }
```

with:

```ts
      let response: Response;
      try {
        response = await retryWithProviderFailover({
          attempt: () => attemptModelRequest(effectiveModel),
          isTransient: (err) => !abortSignal?.aborted && isTransientProviderError(err),
          backoffMs: [2000, 5000],
          fallbackModelIds: mainFallbackChain,
          fallbackAttempt: (fbModelId) => attemptModelRequest(fbModelId),
          signal: abortSignal,
        });
      } catch (err: any) {
        const statusCode = err?.statusCode;
        const message = `${providerId} API error: ${statusCode ?? ''} ${err?.message ?? err}`.trim();
        recordRoutingAdherenceEvent({
          kind: 'error',
          phase: 'provider-stream',
          sessionId: session.id,
          runId: run?.id,
          routeMode: route.mode,
          role: classifiedRole,
          complexity: route.complexity,
          selectedModel: effectiveModel,
          providerId,
          classifierModel: route.routerData?.classifierModel ?? null,
          candidateScores: route.routerData?.candidateScores,
          promptHash: currentPromptHash,
          timeoutMs: MODEL_REQUEST_TIMEOUT_MS,
          elapsedMs: Date.now() - providerStartedAt,
          error: message,
          statusCode,
          lastEvent: 'model_request',
          retryable: true,
          fallbackAttempted: mainFallbackChain.length > 0,
        });
        if (run) emitRunStep(res, run, { type: 'error', message });
        if (propagateProviderErrors) throw new Error(message);
        if (run) run.status = 'error';
        res.write('event: error\ndata: ' + JSON.stringify({ error: message }) + '\n\n');
        persistAssistantError(session, assistantId, `Error: ${message}`, run);
        return;
      }
```

- [ ] **Step 5: Add `buildMainChatFallbackChain` and import the helpers**

Add an import at the top of `server/index.ts` (near the other `./agentRuntime` imports if any; otherwise add):

```ts
import { isTransientProviderError, retryWithProviderFailover } from './agentRuntime';
```

Add a helper near `resolveSelectedModel` (~line 689):

```ts
function buildMainChatFallbackChain(primaryModelId: string, route: RouteDecision): string[] {
  const seen = new Set<string>([primaryModelId]);
  const chain: string[] = [];
  const add = (id?: string) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    if (!resolveProviderForModel(id)) return;
    chain.push(id);
  };
  (route.suggestedModels || []).forEach(add);
  add(appConfig.activeModel);
  Object.values(appConfig.roleAssignments || {}).forEach(add);
  return chain.slice(0, 4);
}
```

- [ ] **Step 6: Verify type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors. If `Response`/`requestSignal`/`requestBody` types complain, annotate `attemptModelRequest`'s return as `Promise<Response>` (already shown) and ensure `requestBody` is declared with `const` (it is).

- [ ] **Step 7: Commit**

```bash
git add server/index.ts
git commit -m "Wrap main chat streaming fetch with retry+failover"
```

---

### Task 6: Integration test — end-to-end recovery through `runAgentPhase`

**Files:**
- Test: `scripts/test-provider-failover-runtime.ts` (create)

- [ ] **Step 1: Write the integration test**

Create `scripts/test-provider-failover-runtime.ts`:

```ts
import { strict as assert } from 'node:assert';
import { runAgentPhase } from '../server/agentRuntime';
import type { StoredConfig } from '../server/config';

const config: StoredConfig = {
  version: 1,
  providers: [
    {
      id: 'mock',
      name: 'Mock Provider',
      type: 'openai-compatible',
      apiKey: 'test-key',
      baseURL: 'https://mock.provider/v1',
      models: [
        { id: 'primary', name: 'Primary', enabled: true },
        { id: 'backup', name: 'Backup', enabled: true },
      ],
    },
  ],
  mcpServers: [],
  personality: '',
  activeModel: 'mock:backup',
  activeTheme: 'midnight',
  roleAssignments: { summarizer: 'mock:primary' },
  trustMode: 'workspace-write',
};

// Scenario A: primary 529s twice, then recovers on the same model (no failover).
{
  const originalFetch = globalThis.fetch;
  let primaryCalls = 0;
  try {
    globalThis.fetch = (async () => {
      primaryCalls++;
      if (primaryCalls < 3) {
        return new Response('{"error":"overloaded_error"}', { status: 529 });
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Same-model recovery answer.' } }] }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const artifact = await runAgentPhase(config, {
      profileId: 'summarizer',
      prompt: 'Summarize this.',
      modelId: 'mock:primary',
      fallbackModelIds: ['mock:backup'],
      timeoutMs: 10_000,
    });

    assert.equal(artifact.status, 'complete', `expected complete, got ${artifact.status}: ${artifact.error}`);
    assert.match(artifact.response, /Same-model recovery/);
    assert.ok(!artifact.notes.some((n) => n.includes('recover-model')),
      'same-model recovery must not mark assistedByFallback');
    console.log('ok    runtime same-model recovery (529 x2 → success)');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// Scenario B: primary always 529, fallback model succeeds.
{
  const originalFetch = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = (async (_input: any, init?: RequestInit) => {
      calls++;
      const body = JSON.parse(String(init?.body || '{}'));
      if (body.model === 'primary') {
        return new Response('{"error":"overloaded_error"}', { status: 529 });
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Fallback model answer.' } }] }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const artifact = await runAgentPhase(config, {
      profileId: 'summarizer',
      prompt: 'Summarize this.',
      modelId: 'mock:primary',
      fallbackModelIds: ['mock:backup'],
      timeoutMs: 10_000,
    });

    assert.equal(artifact.status, 'complete', `expected complete, got ${artifact.status}: ${artifact.error}`);
    assert.match(artifact.response, /Fallback model answer/);
    assert.ok(artifact.notes.some((n) => n.includes('recover-model=mock:backup')),
      `expected recover-model note, got: ${JSON.stringify(artifact.notes)}`);
    console.log('ok    runtime cross-model failover (primary 529 → backup)');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// Scenario C: non-transient 400 propagates, no retry, no failover.
{
  const originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = (async () => {
      calls++;
      return new Response('{"error":"bad request"}', { status: 400 });
    }) as typeof fetch;
    const artifact = await runAgentPhase(config, {
      profileId: 'summarizer',
      prompt: 'Summarize this.',
      modelId: 'mock:primary',
      fallbackModelIds: ['mock:backup'],
      timeoutMs: 10_000,
    });
    assert.equal(artifact.status, 'error');
    assert.match(artifact.error || '', /400/);
    assert.equal(calls, 1, '400 must not trigger retry or failover');
    console.log('ok    runtime non-transient (400) propagates without retry');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

console.log('provider-failover runtime integration: all scenarios pass');
```

- [ ] **Step 2: Run the integration test**

Run: `npx tsx scripts/test-provider-failover-runtime.ts`
Expected: PASS — all three `ok` lines + the final summary line.

- [ ] **Step 3: Commit**

```bash
git add scripts/test-provider-failover-runtime.ts
git commit -m "Add provider-failover runtime integration tests"
```

---

### Task 7: Lint, build, and restart server (AGENTS.md Core Rule 1)

**Files:** none (verification gate)

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: no errors. Fix any lint findings in the touched files.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: build succeeds (`tsc -b && vite build`).

- [ ] **Step 3: Re-run all failover tests**

Run:
```bash
npx tsx scripts/test-provider-failover.ts && \
npx tsx scripts/test-provider-failover-runtime.ts && \
npx tsx scripts/test-agent-runtime-tool-limit.ts
```
Expected: all PASS.

- [ ] **Step 4: Restart the OpenHarness server (Core Rule 1 — server/runtime code changed)**

Kill the existing OpenHarness server/app processes and relaunch, then verify the app is reachable. The user-facing command depends on how they run it; the implementer should follow the project's standard restart procedure and confirm the health endpoint responds.

- [ ] **Step 5: Commit any lint fixes if needed, then done**

If lint/build required fixes:
```bash
git add -A
git commit -m "Fix lint/build findings from provider failover"
```

---

## Self-Review

**Spec coverage:**
- §1 Transient classification → Task 1. ✅
- §2 Retry-with-backoff → Task 2 (wrapper) + Task 3 step 3/4 (wired, `[2000,5000]`). ✅
- §3 Cross-model failover → Task 2 (wrapper) + Task 3 (fallbackAttempt) + Task 5 (main chat). ✅
- §4 Integration points (agentRuntime, index, orchestrator) → Tasks 3, 4, 5. ✅
- §5 Observability → `onRetry`/`onFailover` hooks present; `recover-model` notes; main-chat reuses existing `recordRoutingAdherenceEvent` with `retryable: true` + `fallbackAttempted`. ✅
- §6 Testing → Tasks 1, 2 (unit), Task 6 (integration). ✅
- Core Rule 1 restart → Task 7 step 4. ✅

**Placeholder scan:** The orchestrator Task 4 step 2 instructs the implementer to read each site before editing (line numbers are a guide). All shown code is complete; no "TBD". ✅

**Type consistency:** `ProviderFailoverOptions<T>` is generic; `attempt`/`fallbackAttempt` share signature `(modelId: string) => Promise<T>`; `BackgroundAgentRequest.fallbackModelIds?: string[]` matches `fallbackModelsForPhase` return; `buildMainChatFallbackChain` returns `string[]` matching `fallbackModelIds`. ✅
