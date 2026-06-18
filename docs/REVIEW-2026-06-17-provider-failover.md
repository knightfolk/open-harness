# Review: Provider Failover for Transient Errors

**Date:** 2026-06-17
**Author:** Friday (OpenHarness assistant)
**Status:** Ready for team review
**Related docs:** [Design spec](./superpowers/specs/2026-06-17-provider-failover-design.md) · [Implementation plan](./superpowers/plans/2026-06-17-provider-failover.md)

---

## TL;DR

A provider `529 overloaded_error` ("peak-hour surge… recovers in 1–5 minutes") used to abort an investigation or chat turn outright — surfacing as `Investigation failed: Provider returned 529…` / `Explorer error: …`. This change adds automatic recovery: **retry the same model with backoff, then transparently fail over to another configured model**, so a transient surge no longer ends the user's turn. The user only sees a failure when every configured candidate is exhausted.

No new config schema, no new UI panels, no new branching logic in the request handler.

---

## The problem

Both throw sites that produced the reported errors had **zero retry, backoff, or failover** anywhere in the codebase:

- `server/agentRuntime.ts` — `callAgentModel` threw `Provider returned ${status}: …` on any non-OK response.
- `server/orchestrator.ts:runInvestigatePipeline` — when the explorer phase errored, the whole investigation aborted (`Investigation failed: …`).
- `server/index.ts` — the main chat streaming loop wrote an SSE error and `return`ed on the first non-OK response.

`recordRoutingAdherenceEvent` already tagged these errors `retryable: true`, but nothing acted on the flag.

---

## The solution

A pure helper pair in `server/agentRuntime.ts`:

### 1. `isTransientProviderError(err): boolean`

Classifies an error as recoverable:

| Signal | Transient? |
|--------|-----------|
| HTTP **529, 502, 503, 504** (overloaded / gateway) | ✅ yes |
| HTTP **429** (rate limit), **500** | ✅ yes |
| `overloaded_error` / `rate_limit_error` substring in body | ✅ yes |
| Network `TypeError`, `AbortError`/`TimeoutError` (timeout-driven) | ✅ yes |
| HTTP **400, 401, 403, 404, other 4xx** | ❌ no (won't self-heal) |

HTTP status is parsed from the stringified message (`/returned (\d{3})/`) because the existing throw sites discard the structured response — we did **not** change those throw strings, keeping the error UX stable. Callers distinguish a user-driven abort (by checking their own `AbortSignal` first) before invoking the wrapper.

### 2. `retryWithProviderFailover<T>(options): Promise<T>`

Generic wrapper, two phases:

```
Phase 1 — same model, backoff [2s, 5s]  (3 total attempts)
  attempt 0 → original model
    ↳ transient err → wait 2s → attempt 1 (same model)
    ↳ transient err → wait 5s → attempt 2 (same model)
    ↳ transient err → Phase 2
Phase 2 — cross-model failover (one attempt per candidate)
  for each fallbackModelId → one attempt
```

**Key behaviors a reviewer should verify:**

- **Non-transient errors short-circuit** — rethrown immediately, no backoff, no failover. (Test: `non-transient propagates`.)
- **Backoff is interruptible** — each sleep races against the request's `AbortSignal`; a user cancel propagates at once instead of waiting through a 5s sleep. (Test: `abort short-circuits backoff`.)
- **Single attempt per fallback model** — bounds worst-case latency at ~7s + N×(one call), N ≤ 4. A non-transient error on a fallback advances to the next candidate rather than aborting.
- **Bytes-already-streamed guard** — the wrapper wraps only the request fetch + initial `!res.ok` check, never partial stream parsing.
- On full exhaustion, the **last** error is surfaced — same failure UX as before, no regression.
- On successful failover, the artifact records `recover-model=<id>` in its notes.

---

## Files changed

| File | Change | Lines |
|------|--------|------:|
| `server/agentRuntime.ts` | New `isTransientProviderError`, `retryWithProviderFailover`, `buildFallbackModelChain`, `canResolveModelId`; `BackgroundAgentRequest.fallbackModelIds?` field; both `callAgentModel` call sites in `runAgentPhase` wrapped | +190 |
| `server/orchestrator.ts` | New `fallbackModelsForPhase(route, modelId)` helper; `fallbackModelIds` passed to all **12** `runAgentPhase` call sites (planning room ×3, execute planner/impl/retry/repair/review ×5, investigate explorer/synthesis ×2, compare per-model/judge ×2) | +25 |
| `server/index.ts` | New `buildMainChatFallbackChain`; streaming-loop `fetch` wrapped via `agentRuntime.retryWithProviderFailover`; `attemptModelRequest` helper re-resolves provider per fallback model | +75 |
| `scripts/test-provider-failover.ts` | Unit tests: 13 classification cases + 4 wrapper scenarios | +161 |
| `scripts/test-provider-failover-runtime.ts` | Integration tests through `runAgentPhase`: same-model recovery, cross-model failover, non-transient propagation | +118 |
| `docs/superpowers/specs/2026-06-17-provider-failover-design.md` | Design spec | +112 |
| `docs/superpowers/plans/2026-06-17-provider-failover.md` | Implementation plan | +918 |

---

## Commits (in order)

```
3ee01581 Add provider failover design spec
e6ff5805 Add isTransientProviderError predicate for provider failover
ccf8900b Add retryWithProviderFailover wrapper with backoff + cross-model failover
d9984f87 Wire retry+failover into runAgentPhase model calls
42fec892 Pass fallbackModelIds from route.suggestedModels into runAgentPhase
ea723891 Wrap main chat streaming fetch with retry+failover
d1f9eb7e Add provider-failover runtime integration tests
16347b5e Add provider failover implementation plan
```

Each commit is independently green (TDD: test first, then implementation). Reviewers can `git show <sha>` to inspect any step in isolation.

> **Note:** A separate, unrelated commit `8a1776bd Add agent identity (callsigns, avatars, taglines) to UI` is also on this branch. It was pre-existing in-progress UI work (a `src/utils/agentIdentity.ts` role→callsign/avatar/tagline mapping surfaced in the sidebar, message bubbles, and agent panel) and is **not** part of the failover change. It's called out here only for completeness so reviewers aren't surprised by the `src/` diff.

---

## How fallback models are chosen (no new config)

Per the agreed design, we **reuse existing candidate lists** rather than adding a config field:

- **Orchestration path:** `fallbackModelsForPhase(route, primaryModelId)` returns `route.suggestedModels` with the primary removed — the auto-router's already-ordered candidate list.
- **Runtime fallback chain** (if a caller supplies no list): `buildFallbackModelChain` derives one from `config.roleAssignments` → `config.activeModel` → `autoRouter.candidates[].modelId`, deduped, capped at 4, excluding the primary and any model that fails `canResolveModelId`.
- **Main chat path:** `buildMainChatFallbackChain` similarly draws from `route.suggestedModels` → `activeModel` → `roleAssignments`.

Each candidate is validated with `pickProviderForModel` / `resolveProviderForModel` before use, so no attempt is ever made against a model with no resolvable provider.

---

## Backoff & latency budget

| Phase | Worst-case time |
|-------|----------------|
| Same-model retries (`[2s, 5s]`, 3 attempts) | ~7s + 3×(one call) |
| Cross-model failover (≤4 models, 1 attempt each) | + N×(one call) |

Inside the 529's stated 1–5 min recovery window without over-burdening the user.

---

## Verification evidence

All run against the committed code:

| Check | Result |
|-------|--------|
| `npx tsx scripts/test-provider-failover.ts` | ✅ 13 classification cases + 4 wrapper scenarios pass |
| `npx tsx scripts/test-provider-failover-runtime.ts` | ✅ same-model recovery, cross-model failover, non-transient propagation all pass |
| `npx tsx scripts/test-agent-runtime-tool-limit.ts` | ✅ regression — unchanged behavior |
| `npx tsx scripts/test-orchestration-routing.ts` | ✅ regression — unchanged behavior |
| `npm run lint` (my files only) | ✅ clean (1 pre-existing error in untouched `scripts/test-auto-router-context.ts`, confirmed via stash) |
| `npm run build` / `vite build` | ✅ `✓ built in 138ms`, fresh `dist/` |
| `tsc -b` error count | 21 baseline, **unchanged** by this work (verified: 21 with changes stashed too). All 21 are in untouched files (`autoRouter.ts`, `evals.ts`, `promptBuilder.ts`, `toolReliabilityLogTrace.ts`) |
| Core Rule 1 (server restart) | ✅ killed old server (PID 39689) + Electron; relaunched `dev:all`; new server PID 41578 returns `HTTP 200` on `:3001`; `retryWithProviderFailover`/`isTransientProviderError` confirmed loaded |

---

## Reviewer focus areas

These are the spots most worth a careful read:

1. **`isTransientProviderError` classification** (`server/agentRuntime.ts`) — Confirm the 5xx/429/500-inclusive + 4xx-exclusive split matches your intent. We included 500 (often a transient upstream fault); some teams treat 500 as non-transient.
2. **Abort disambiguation** — The wrapper's `isTransient` callback is `(err) => !controller.signal.aborted && isTransientProviderError(err)`. A user-driven abort sets `controller.signal.aborted` true, so we skip retry; a timeout-driven abort does not, so we retry. Confirm this matches the abort semantics you expect.
3. **Single attempt per fallback model** — Chosen to bound latency. If you'd rather maximize recovery odds, each fallback could get one retry; this is a one-line change in `retryWithProviderFailover` (wrap `fallbackAttempt` body in a small retry loop).
4. **Main chat loop** (`server/index.ts`, the `attemptModelRequest` + `try/catch` block) — The error-handling branch preserves the exact prior UX (SSE error, `persistAssistantError`, `propagateProviderErrors` honoring) and now reports `fallbackAttempted: mainFallbackChain.length > 0`.
5. **`[2s, 5s]` backoff schedule** — Picked to sit inside the 529's 1–5 min recovery window. Adjust in the two `backoffMs: [2000, 5000]` call sites if you want it shorter/longer.

---

## Out of scope (deliberately, per design)

- No new `fallbackModels` config field / settings UI — reuses existing candidate lists.
- No persistent circuit-breaker or per-provider cooldown across requests (the existing `checkAndRecordProviderRateLimit` handles proactive throttling).
- No retries on non-transient errors. No retries mid-stream after bytes have been sent.
- The 21 pre-existing `tsc -b` baseline errors are left untouched (surgical-changes rule); happy to address separately if wanted.
