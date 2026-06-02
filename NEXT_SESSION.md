# Next Session — Tackle the Small Issues

## Identity
You are **Friday**, the AI assistant for OpenHarness. Follow all rules in `AGENTS.md`.

## Where We Are

`/Users/kevink/Projects/OpenHarness` is clean at `643ff48` (after `d2ed092` and `183f9fc` from the same day). The big Assignment 0 (multi-provider onboarding + Docker MCP) and the follow-up native-adapter work are landed. Server is running on `:3001` (PID session in the TTY), Docker MCP connected with 34 tools, `smoke:minimax` and `test-adapter-registry` both pass.

Recent commit graph:
- `d000eab` — pre-existing fix (small polish and correctness issues from dogfood)
- `d2ed092` — fix: wire native provider adapters, fix Gemini SSE, refresh MCP status
- `183f9fc` — feat: native provider tool loops, Gemini SSE, MCP log filter, smoke test
- `643ff48` — chore: land prior-session dirty tree + onboarding work + new server modules

What is **not** done is the four small items below. Pick them up in this order.

---

## Small Issue 1 — Worktree isolation/promotion and browser verification depth

Source: `docs/HARNESS_WORK_ROADMAP.md` Milestone 12 and the later worktree-related items.

Current code state:
- `server/worktrees.ts` exists with create/list/diff/promote/discard scaffolding.
- `server/checkpoints.ts` exists with checkpoint create/restore APIs.
- `server/processLedger.ts` exists with process registry.
- `src/components/SafetyPanel.tsx` surfaces trust mode, command risk, worktree state in the UI.

Open work:
- A real "isolate in a worktree" affordance in the chat header — the model proposes a change, the user sees "Run in isolated worktree" as a button, the app creates a worktree, runs the change there, lets the user diff/promote/discard.
- Promotion flow: when the user accepts a patch proposal that was made inside a worktree, the patch should be applied to the real working tree and the worktree cleaned up. If they reject, the worktree is just discarded.
- Browser verification depth: `server/browserPreview.ts` already exposes `capturePreview` and `checkServerHealth`. The follow-up is to auto-screenshot a dev server after each patch (or on demand) and surface the result in `PatchReviewPanel.tsx` next to the diff.

Files to touch (read first, do not rewrite):
- `server/worktrees.ts`, `server/checkpoints.ts`, `server/processLedger.ts`
- `server/patchProposals.ts`, `server/patchApply.ts`
- `src/components/PatchReviewPanel.tsx`, `src/components/SafetyPanel.tsx`, `src/components/TerminalPanel.tsx`
- `server/browserPreview.ts` for the screenshot side

Success criteria:
- "Run in isolated worktree" button appears in `PatchReviewPanel.tsx` for proposals that touched files inside the active project.
- Promote applies the accepted hunks to the real working tree and tears down the worktree; discard does the same without applying.
- After a successful patch apply against a detected dev server (port 3000, 5173, 8787, etc.), a screenshot is captured and shown in the patch panel.

---

## Small Issue 2 — Eval validation weighting and eval-report UI polish

Source: `docs/HARNESS_WORK_ROADMAP.md` Milestone 5 and the smaller "Model Lab" / eval-report items.

Current code state:
- `server/evals.ts` defines the validation signals (JSON validity, schema match, tool-call accuracy, format match, etc.) and computes a per-run score.
- `server/benchRuns.ts` is the benchmark-run store.
- `server/harnessTasks.ts` defines the task suite.
- `src/components/ModelLabPanel.tsx` (~32KB) renders the eval results.

Open work:
- **Weighting:** validation signals are currently aggregated flat. Weight them: structural validation (JSON parses, schema matches) > runtime validation (tool succeeded, exit code 0) > style heuristics (length, formatting). Surface the per-signal breakdown in the report.
- **Report UI:** in `ModelLabPanel.tsx`, replace the single score bar with a stacked breakdown (validation vs style), a "weakest signal" callout, and a small table of per-task scores.
- **Diff against previous run:** when opening a saved run, show the delta against the most recent prior run on the same task suite (regressions in red, improvements in green).

Files to touch:
- `server/evals.ts` (the weighting)
- `server/benchRuns.ts` (diff helper)
- `src/components/ModelLabPanel.tsx` (the breakdown + delta UI)

Success criteria:
- The eval report shows per-signal scores (validation vs style) with the weighted aggregate.
- Opening a saved run that is not the most recent shows a clear "+x% / -y% vs previous" summary.
- `npm run lint` and `npm run build` pass.

---

## Small Issue 3 — Collapse the remaining MCP gateway `Initialize request` JSON

Source: the smoke test noted `[mcp-gw:err]` lines for `{`, `"capabilities":`, `}` etc. — the gateway prints the JSON of the initialize request split across several `data:` chunks, and the single-line filter in `server/index.ts` only checks the first line.

Where the filter lives: `server/index.ts` inside the `mcpGateway.stderr?.on('data', ...)` block (search for `Strip the gateway's "- " / "> " line prefixes`).

What to do:
- Track "we are inside a multiline `Initialize request` payload" state across the loop in the `data` handler. Once you see the `Initialize request:` banner, swallow subsequent lines that are just `{`, `}`, `"key":`, `[`, `]`, `,` until the matching close brace, then optionally print one collapsed `…Initialize request (N lines)` line.
- Apply the same treatment to any other multiline JSON the gateway emits (e.g., the `Read profile` payloads, if any).
- Keep the same collapse-on-repeat behavior for these collapsed lines.

Files to touch:
- `server/index.ts` (one block, ~80 lines, the stderr handler)

Success criteria:
- After server restart, the `[mcp-gw:err]` log no longer contains the inner JSON of the initialize request — it either doesn't print, or prints one collapsed line.
- Genuine errors (HTTP 4xx/5xx from the gateway, connection resets) still surface with full context.

---

## Small Issue 4 — Re-tune `promptBuilder` / `contextManager` / `repoMap` for the native-adapter path

Source: the previous session's "what's still left" notes. Anthropic and Gemini use the new `streamWithNativeAdapter` branch in `server/index.ts`, but `promptBuilder`, `contextManager`, and `repoMap` are still using the same defaults they used for the OpenAI-compatible path.

Where to look:
- `server/promptBuilder.ts` — `buildPromptForModel({ modelId, role, personality, workingDir, projectProfileSummary, tools, enableThinking })` adapts system prompt style by family profile, but the Anthropic / Gemini-specific `systemInstruction` block isn't separated.
- `server/contextManager.ts` — `buildContextWindow(...)` uses the same context window + max_tokens for every family.
- `server/repoMap.ts` — `summarizeRepoMap(...)` is provider-agnostic, but the Gemini context window and Claude context window differ substantially.
- `server/modelProfiles.ts` — `getModelConfig(modelId)` already returns `contextWindowTokens` and per-family styles; check whether Anthropic + Gemini entries are tuned well enough for the new branch.

Open work:
- For Anthropic: add a `systemInstruction` block in the prompt (Anthropic uses a top-level `system` field, not a system message) — verify that `buildPromptForModel` already does this. If not, factor it out.
- For Gemini: add `systemInstruction` support and bump `maxOutputTokens` defaults if appropriate.
- Tune `contextManager.ts` to honor the larger context window for Claude 3.5+ (200k) and Gemini 1.5+ (1M-2M) without over-compressing.
- Make sure `repoMap.ts` doesn't try to inject a repo map into a session that has no working directory (already mostly handled, but verify).

Files to touch:
- `server/promptBuilder.ts`
- `server/contextManager.ts`
- `server/repoMap.ts`
- `server/modelProfiles.ts` (only if a profile entry is wrong)

Success criteria:
- An Anthropic provider added in Settings with `claude-3-5-sonnet-*` shows a `systemInstruction`-style block in the rendered prompt (visible in a server log or test endpoint).
- A Gemini provider with `gemini-1.5-pro-*` keeps more of the conversation history thanks to the larger context window.
- `npm run lint` and `npm run build` pass; the existing `smoke:minimax` and `test-adapter-registry` tests still pass.

---

## How to Run / Verify

```bash
# from /Users/kevink/Projects/OpenHarness
npx tsc --noEmit -p tsconfig.app.json
npx tsc --noEmit -p tsconfig.server.json
npm run lint
npm run build
cd OpenHarnessApp && swift build && cd ..

# server
pkill -f "tsx server/index" 2>/dev/null; sleep 1
# (use a TTY exec_command so the process stays alive)
npx tsx server/index.ts

# smoke tests
npx tsx scripts/test-adapter-registry.mjs
node scripts/smoke-minimax.mjs
```

If you change server code, restart the server (per AGENTS.md rule 1) and re-run the smoke tests. The Electron app picks up client changes via Vite HMR — no restart needed for client-only work, but a hard refresh is sometimes required.

## Don't Touch

- The CMDui → OpenHarness rename is **landed**. Don't rename anything back.
- The 3 prior commits (`d000eab`, `d2ed092`, `183f9fc`, `643ff48`) are stable. Don't rewrite history unless the user explicitly asks.
- The Electron app is currently running on the user's machine. Leave it alone unless you need to test a code path that requires a fresh launch — and even then, ask first.
