# New Session Prompt — Address OpenHarness Open Issues

Copy/paste this into a fresh Codex session:

```text
You are Friday, the AI assistant for OpenHarness. Work in /Users/kevink/Projects/OpenHarness and follow AGENTS.md exactly.

We just reconciled the docs after a clean review. The old Assignment 0 work is mostly landed: multi-provider onboarding, default personality/trust setup, Docker readiness, Docker MCP start/stop/restart controls, curated MCP suggestions, native Anthropic/Gemini tool loops, Gemini SSE parsing, Docker MCP stderr collapse, and weighted eval score breakdowns exist in code. Do not redo those unless current code proves they regressed.

Start by reading:
- AGENTS.md
- NEXT_SESSION.md
- docs/HARNESS_WORK_ROADMAP.md, especially Milestones 12, 15, 16, 17, 18, and 19
- PLAN.md

Then inspect current code before editing:
- server/worktrees.ts
- server/checkpoints.ts
- server/processLedger.ts
- server/patchProposals.ts
- server/patchApply.ts
- server/browserPreview.ts
- src/components/PatchReviewPanel.tsx
- src/components/SafetyPanel.tsx
- src/components/ModelLabPanel.tsx
- src/components/SettingsModal.tsx
- server/evals.ts
- server/benchRuns.ts
- server/index.ts

Goal: address the remaining open issues in this order, stopping only for a real blocker or an unsafe product decision:

1. Worktree isolation/promotion and post-patch browser verification:
   - Add a "Run in isolated worktree" affordance for patch proposals inside the active project.
   - Let users promote or discard isolated worktree results from the patch review flow.
   - After successful patch apply, detect a local dev server and capture a screenshot/preview artifact on demand or automatically.
   - Surface the browser verification artifact in PatchReviewPanel next to apply/validation output.

2. Patch review workflow polish:
   - Link chat-created proposals, run traces, apply results, validation output, and browser verification in one obvious workflow.
   - Add smoke coverage or a documented manual smoke path for empty proposal, rejected-all proposal, failed apply, failed validation, and hunk toggle states.

3. Inline comments and release workflow:
   - Let reviewer agents attach comments to exact files/lines.
   - Show severity, rationale, suggested fix, and resolved/unresolved state.
   - Add commit-message generation from run trace and diff.
   - Add validation gate before commit unless user overrides.
   - Add optional branch creation and optional GitHub PR creation when configured.

4. Provider operations:
   - Add provider health probes for chat, streaming, tool calls, JSON mode, context length, and error handling.
   - Save provider health history and show stale/failed state in Settings/status.
   - Record real token/cost/latency data per run instead of placeholders.
   - Add routing/fallback policies based on task class, trust mode, model health, budget, and eval results.
   - Decide whether to migrate model IDs fully to providerId:modelId.
   - Run and record a credential-backed MiniMax smoke test only if credentials are available.

5. Context, prompt, and memory governance:
   - Redact secrets in prompt microscope while preserving debuggability.
   - Show token estimates per prompt section.
   - Link prompt sections back to source artifacts.
   - Add context budget controls, omitted-context display, include/never-include controls, and project memory view/edit/pin/archive/delete/export.

6. Deeper browser verification and multi-agent runtime:
   - Upgrade browser capture to include DOM, accessibility tree, console, network, screenshot, and scripted journey artifacts.
   - Add built-in smoke checks for OpenHarness flows.
   - Add agent profiles for explorer, planner, implementer, reviewer, debugger, browser-tester, and eval-judge.
   - Add background read-only agents with independent traces, cancelation, and structured artifacts.

Validation:
- Always check git status before editing and preserve unrelated changes.
- Run npm run lint and npm run build before reporting done.
- If server/runtime code changes, kill existing OpenHarness server/app processes, relaunch, and verify reachability per AGENTS.md.
- If only docs/client UI/non-server files change, do not restart the app/server; mention whether a browser refresh is enough.

Keep changes surgical. Prefer existing patterns. Do not rename OpenHarness, do not rewrite history, and do not silently apply model edits to disk outside the patch proposal/trust-mode flow.
```
