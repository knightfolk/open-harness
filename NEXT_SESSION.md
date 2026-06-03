# Next Session — Open Issues Handoff

## Identity
You are **Friday**, the AI assistant for OpenHarness. Follow all rules in `AGENTS.md`.

## Where We Are

`/Users/kevink/Projects/OpenHarness` is on `main`. The repo was clean during the 2026-06-01 document reconciliation, and both `npm run lint` and `npm run build` passed after the review. Re-check `git status --short` before touching anything.

The old Assignment 0 items are mostly landed: multi-provider onboarding, default personality/trust setup, Docker readiness, Docker MCP start/stop/restart controls, curated MCP suggestions, native Anthropic/Gemini tool loops, Gemini SSE parsing, and weighted eval score breakdowns exist in code. Do not redo that work unless current code proves it regressed.

## Active Open Issues, In Recommended Order

### 1. Worktree isolation, promotion, and post-patch browser verification

Source: `docs/HARNESS_WORK_ROADMAP.md` Milestone 12, Milestone 14, and the patch-review follow-ups.

Current code state:
- `server/worktrees.ts` has create/list/status/diff/promote/discard scaffolding.
- `server/checkpoints.ts` has checkpoint create/restore APIs.
- `server/processLedger.ts` exists.
- `src/components/SafetyPanel.tsx` surfaces worktree/checkpoint state.
- `src/components/PatchReviewPanel.tsx` exists and can apply accepted patch hunks.
- `server/browserPreview.ts` exposes preview capture and health checks, but it is still shallow.

Open work:
- Add a real "Run in isolated worktree" affordance for patch proposals inside the active project.
- Let users promote or discard isolated worktree results from the review flow.
- After successful patch apply, detect a local dev server and capture a screenshot or preview artifact on demand or automatically.
- Surface the browser verification artifact in `PatchReviewPanel.tsx` next to apply/validation output.

Success criteria:
- A patch proposal can be isolated into a worktree, reviewed, promoted, or discarded without dirtying the main checkout unexpectedly.
- Promotion applies accepted changes to the real working tree and cleans up the worktree.
- A successful patch apply can produce a browser verification artifact visible from the patch review panel.
- `npm run lint` and `npm run build` pass.

### 2. Patch review workflow polish

Source: `docs/HARNESS_WORK_ROADMAP.md` Milestone 15.

Open work:
- Link chat-created proposals, run traces, apply results, validation output, and browser verification in one obvious workflow.
- Add manual or automated smoke coverage for empty proposal, rejected-all proposal, failed apply, failed validation, and hunk toggle states.
- Improve accept/reject-per-file behavior if the current file rollup controls are not complete enough.

Success criteria:
- A user can move from chat/model output to proposal review to apply/validation results without hunting through panels.
- Edge states are exercised and documented.
- `npm run lint` and `npm run build` pass.

### 3. Inline comments and release workflow

Source: `docs/HARNESS_WORK_ROADMAP.md` Milestone 15 P1.

Open work:
- Let reviewer agents attach comments to exact files/lines.
- Show severity, rationale, suggested fix, and resolved/unresolved state.
- Convert selected comments into follow-up tasks.
- Add commit-message generation from run trace and diff.
- Add validation gate before commit unless the user overrides.
- Add optional branch creation and optional GitHub PR creation when configured.

Success criteria:
- Review findings are line-specific and resolvable.
- User can go from accepted patch to commit/PR without leaving OpenHarness.
- `npm run lint` and `npm run build` pass.

### 4. Provider operations: health, cost, fallback, and IDs

Source: `docs/HARNESS_WORK_ROADMAP.md` Milestone 17 and open decisions.

Open work:
- Add provider health probes for chat, streaming, tool calls, JSON mode, context length, and error handling.
- Save provider health history and show stale/failed state in Settings/status.
- Record real token/cost/latency data per run instead of placeholders.
- Add routing/fallback policies based on task class, trust mode, model health, budget, and eval results.
- Decide whether to fully migrate model IDs to `providerId:modelId`.
- Run and record a credential-backed MiniMax smoke test when credentials are available.

Success criteria:
- Provider settings show real health/capability status.
- Run traces include usable token/cost/latency data where providers expose it.
- Failed providers fall back cleanly without losing run trace context.
- `npm run lint` and `npm run build` pass.

### 5. Context, prompt, and memory governance

Source: `docs/HARNESS_WORK_ROADMAP.md` Milestone 16.

Open work:
- Redact secrets in prompt microscope while preserving debuggability.
- Show token estimates per prompt section.
- Link prompt sections back to source artifacts.
- Add context budget controls and show omitted context.
- Add include/never-include controls for files and paths.
- Build project memory UI for view/edit/pin/archive/delete/export.

Success criteria:
- Users can inspect what was sent to the model and why.
- Memory use is visible, editable, and removable.
- Context trimming decisions are explicit.
- `npm run lint` and `npm run build` pass.

### 6. Deeper browser verification and multi-agent runtime

Source: `docs/HARNESS_WORK_ROADMAP.md` Milestones 13 and 14.

Open work:
- Upgrade browser capture from shallow preview into DOM, accessibility tree, console, network, screenshot, and scripted journey artifacts.
- Add built-in smoke checks for OpenHarness flows.
- Add agent profiles for explorer, planner, implementer, reviewer, debugger, browser-tester, and eval-judge.
- Add background read-only agents with independent traces, cancelation, and structured artifacts.

Success criteria:
- Browser smoke checks can run from UI and eval suites.
- Multi-agent work is visible, cancelable, and structured.
- Agent handoffs use patch proposals or artifacts rather than silent disk writes.
- `npm run lint` and `npm run build` pass.

## Validation Rules

For implementation work:

```bash
npm run lint
npm run build
```

If server/runtime code changes, follow `AGENTS.md`: kill existing OpenHarness server/app processes, relaunch, and verify reachability. If only docs, client UI, or non-server files change, do not restart the running app/server; tell the user whether a browser refresh is enough.

## Do Not Do

- Do not rewrite history.
- Do not rename OpenHarness back to CMDui.
- Do not redo landed Assignment 0 work unless current code proves it is broken.
- Do not silently apply model changes to disk; route model edits through patch proposals and trust-mode checks.
