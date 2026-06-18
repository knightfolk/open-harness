# Provider Failover for Transient Errors

**Status:** Approved design (2026-06-17)
**Author:** Friday
**Spec for:** Recovering from provider `529 overloaded_error` / `429` / `5xx` so a peak-hour surge no longer aborts an investigation or chat turn.

## Problem

A provider `529 overloaded_error` ("peak-hour surge… usually recovers in 1–5 minutes") today ends the user's turn outright:

- `server/agentRuntime.ts:727` and `:370` throw `Provider returned ${res.status}: …` on any non-OK response. There is **no retry, no backoff, no failover** anywhere in the codebase.
- The throw surfaces as `Explorer error: …` (`server/orchestrator.ts:1151`) and `Investigation failed: …` (`:1170`), aborting the whole investigate pipeline when the explorer phase fails.
- The main chat streaming loop (`server/index.ts:4529`) hits the same wall: a `529` writes an SSE error and returns, ending the turn.

`recordRoutingAdherenceEvent` already tags these errors `retryable: true`, but nothing acts on the flag.

## Goal

When a transient provider error occurs, transparently recover the request by (1) retrying the same model with backoff, then (2) failing over to another configured model. The user should only see a failure when every reasonable recovery path is exhausted.

### Non-goals (out of scope)

- No new `fallbackModels` config field or settings UI — we reuse existing candidate lists.
- No persistent circuit-breaker / per-provider cooldown state across requests. The existing local rate-limiter (`checkAndRecordProviderRateLimit`) handles proactive throttling.
- No retries for non-transient errors. No retries mid-stream after bytes have been sent.

## Design

### 1. Transient-error classification

A shared predicate `isTransientProviderError(err): { transient: boolean; status?: number; reason?: string }` classifies an error:

| Signal | Transient? |
|--------|-----------|
| HTTP **529, 502, 503, 504** (overloaded / gateway) | ✅ yes |
| HTTP **429** (rate limit) | ✅ yes |
| HTTP **500** (often a transient upstream fault) | ✅ yes |
| `overloaded_error` / `rate_limit_error` substring in the error text (parsed from the JSON body) | ✅ yes |
| Network error / fetch `TypeError` / `AbortSignal.timeout` (non-user-abort) | ✅ yes |
| HTTP **400, 401, 403, 404, 4xx (other)** | ❌ no (won't self-heal) |
| User abort (`AbortError` from the request's own signal, distinct from the timeout signal) | ❌ no (must propagate) |

The HTTP status is parsed from the stringified message via regex (`/returned (\d{3})/`), because the existing throw sites discard the structured response and we are not changing those throw strings (keeps the error UX stable). The body-substring check (`overloaded_error`, `rate_limit_error`) covers Anthropic-style JSON bodies that arrive over the native adapter path.

**Edge case — abort disambiguation:** both the user's request `AbortSignal` and the per-call `AbortSignal.timeout` can produce an `AbortError`. A timeout-driven abort is transient (retry it); a user-driven abort is not (propagate it). The helper distinguishes these by checking whether the caller's request signal is aborted before treating an `AbortError` as transient.

### 2. Retry-with-backoff layer (same model)

`retryWithProviderFailover(options)` wraps a model-call thunk. Phase 1 retries the **same** model:

```
attempt 0 → original model
  ↳ transient error → wait 2s → attempt 1 (same model)
  ↳ transient error → wait 5s → attempt 2 (same model)
  ↳ transient error → proceed to phase 2 (cross-model failover)
```

- **Backoff schedule:** `[2000ms, 5000ms]` → at most ~7s of waiting before failover. Inside the 529's stated 1–5 min recovery window without over-burdening the user.
- **Three total attempts** on the original model (initial + 2 retries).
- **Backoff is interruptible:** each delay is `Promise.race([sleep(ms), abortPromise])`, where `abortPromise` rejects when the request's `AbortSignal` fires. User cancels and session aborts propagate immediately — no waiting through a backoff for a dead request.
- **Non-transient errors short-circuit:** the wrapper rethrows immediately, skipping both backoff and failover.
- **Bytes-already-streamed guard:** the wrapper wraps only the request fetch + initial `!res.ok` check, never the stream-consumption step. So we never retry after partial output has been sent downstream. This is naturally true for `runAgentPhase` (non-streaming) and for the main loop's `!response.ok` branch.

### 3. Cross-model failover layer

After same-model retries are exhausted, switch to the next model in a **candidate chain** and attempt it **once** (single attempt per fallback model, to bound worst-case latency):

**Chain construction, in priority order:**

1. Caller-supplied `fallbackModelIds` (the orchestrator passes `route.suggestedModels` with the already-tried model removed).
2. If absent, the runtime derives a chain from `config`: other `roleAssignments` values → `config.activeModel` → `autoRouter?.candidates[].modelId`, deduped and capped at 4 entries.
3. Each candidate is validated with `canResolveModel` / `pickProviderForModel` before use, so no attempt is ever made against a model with no resolvable provider.
4. The originally-tried model is excluded from the chain.

When a fallback succeeds:
- The artifact records `assistedByFallback: true` and a note naming the recovering model (`recover-model=<fallbackModelId>`).
- A low-noise run step is emitted so the user can see why their answer came from a different model: `{ type: 'orchestration', label: 'Provider failover', detail: '<orig> 529 → recovered via <fallback>' }`.

When **all** candidates fail:
- The **last** error is surfaced. This matches today's failure UX — no regression in the genuinely-exhausted case.

**Worst-case latency:** ~7s (same-model backoff) + N×(one model call), where N ≤ 4 fallback models. Bounded and predictable.

### 4. Integration points

Only two server files change for the core mechanism, plus a mechanical edit to pass the candidate list down:

| File | Change |
|------|--------|
| **`server/agentRuntime.ts`** | Add `isTransientProviderError` + `retryWithProviderFailover` helpers. The wrapper sits one level above `callAgentModel`: its `attempt` thunk takes a `modelId`, internally resolves that model's provider via the existing `pickProviderForModel`, then calls `callAgentModel` (OpenAI-compatible path) or `callNativeAgentModel` (Anthropic/Google). Retries call the thunk with the same model; failover calls it with each candidate. Add `fallbackModelIds?: string[]` to `BackgroundAgentRequest`; `runAgentPhase` builds the chain and delegates to the wrapper. |
| **`server/index.ts`** | Wrap the streaming-loop `fetch` at `:4518` so a transient `!response.ok` at `:4529` retries/fails over **before** any SSE error is emitted. Re-resolve `chatURL` / `apiKey` / `providerId` per fallback model. |
| **`server/orchestrator.ts`** | Mechanical: pass `fallbackModelIds` (derived from `route.suggestedModels`, minus the chosen model) into each of the 12 `runAgentPhase` call sites. |

`runAgentPhase` remains the single owner of orchestration branching (per AGENTS.md — no new branching logic in `index.ts`). The wrapper is a pure helper.

### 5. Observability

- Reuse the existing `recordRoutingAdherenceEvent` plumbing. Each retry and each failover attempt emits `kind: 'error'`, `retryable: true`, and new `lastEvent` values: `'provider_retry'` and `'provider_failover'`, with `fallbackAttempted: true`. Today these fields are inert; this wires them up.
- Successful failover emits the `Provider failover` run step described in §3.
- No new config schema, no new UI panels (AGENTS.md Core Rule 4).

## Testing

- **Unit — `isTransientProviderError`:** truth table covering 529/502/503/504/429/500/network-error/timeout in; 400/401/403/404 out; `overloaded_error` and `rate_limit_error` body parsing; user-abort vs timeout-abort disambiguation.
- **Unit — `retryWithProviderFailover`:** with a stubbed clock, assert backoff timing, abort-honoring (user abort short-circuits), fallback-chain traversal order, `assistedByFallback` set on recovery, and that the last error is surfaced when everything fails.
- **Integration-style script** matching the repo's `scripts/test-*.ts` pattern: stub `fetch` to throw `529` twice then succeed; assert the artifact completes, records the retry notes, and does **not** mark `assistedByFallback` (same-model recovery). A second case: `529` on the original model on every attempt, success on the first fallback; assert `assistedByFallback: true` and the recovering model in notes.
- **Existing gates:** `npm run lint && npm run build` (AGENTS.md Validation Rules). Since this touches server/runtime code, AGENTS.md Core Rule 1 applies — kill and relaunch the running server, verify the app is reachable.

## Open questions resolved

1. **Fallback attempts per model** → single attempt per fallback model (bounds worst-case latency at ~7s + N×one-call).
2. **Backoff schedule** → `[2s, 5s]`, ≈7s before failover, inside the 529's stated recovery window.
