# Next Session — Open Issues Handoff

## Identity
You are **Friday**, the AI assistant for OpenHarness. Follow all rules in `AGENTS.md`.

## Repository State

`/Users/kevink/Projects/OpenHarness` on `main`. Latest local work adds Planning Room; check `git status -sb` before assuming remote push state.
- `npm run lint` — PASSED
- `npm run build` — PASSED

## Current Top Priority

Use `docs/PROMPT_ROUTING_OUTPUT_ROADMAP.md` as the next roadmap for refining prompt processing, routing, Planning Room/team-model output, single-model responses, eval feedback, and native-app presentation.

## Latest Completed Slice — 2026-06-12

Commit to check first: this session should include output-style visibility work after `1a9d04b Add output contracts for routed responses`.

Completed Phase 4 items:
- Output style contracts from `server/promptBuilder.ts` are now structured metadata (`outputStyle`) on prompt assembly and `prompt_built` trace steps.
- Prompt Microscope has a dedicated Output Style section, separated from generic prompt section previews.
- The artifact drawer detects markdown `Evidence`, `Sources`, `Sources Used`, and `Evidence Used` sections as collapsed evidence artifacts.
- Focused regressions cover output-style trace metadata and investigation/review response normalization.

Still open before Phase 5 or eval-feedback-loop work:
- Add explicit user-selectable output style controls only if the product wants styles beyond route/role-derived defaults.
- Make review/investigation sources fully structured objects instead of markdown-section extraction.
- Tighten orchestration normalization for execute reports and direct answers with focused tests.
- Consider stream-cleaning refinements for legitimate first-person direct answers, especially non-reasoning models.

## Current Runtime Status
- ✅ **Server**: Running on `http://127.0.0.1:3001` (via `screen -S oh-server`)
- ✅ **Frontend**: Running on `http://127.0.0.1:5173` (via `screen -S oh-vite`)
- ✅ `GET /api/providers` — returns MiniMax provider
- ✅ `GET /api/router/state` — auto-router enabled with 2 candidates, threshold 0.7
- ✅ `GET /` on server returns Express 404, which is expected because no root API route is defined

### Restart if killed
```bash
screen -dmS oh-server bash -c 'cd /Users/kevink/Projects/OpenHarness && npx tsx server/index.ts'
screen -dmS oh-vite bash -c 'cd /Users/kevink/Projects/OpenHarness && npx vite --port 5173 --host'
```

---

## What's Truly Implemented vs. Still Open

After auditing the source code against the 6 Critical Gaps from PLAN.md and adding Planning Room:

### ✅ Fully Addressed (5 of 6)
1. **Orchestrator spawns agents** — Execute/investigate/compare modes use `agentRuntime.ts` with sub-agents
2. **Auto-router (classifier-based)** — `server/autoRouter.ts` scores candidates on capability
3. **Agent Roles + Planning Room** — Different models per role, and planning requests now run multiple planner participants when configured
4. **Cost-aware/complexity-aware selection** — Simple low-risk tasks use cheap-direct, medium tasks use classifier routing, and deep/tool-heavy/image work escalates through policy gates
6. **"Start with answer" rule gated** — `isReasoningModel()` check at line 2203 of `server/index.ts`

### ✅ New Source of Truth
- **Planning Room is the core product direction** — planning/roadmap/design/strategy requests route to `mode: 'plan'`
- **Planning Room v1** — independent model plans, peer cross-checks, and final team-plan synthesis are implemented in `server/orchestrator.ts`
- **Project Companion is next** — cheap/local side assistant that answers quick questions from plans, run traces, repo maps, and summaries

### ◐ Still Open / Partial (1 of 6)
5. **Eval feedback loop into routing is partial** — candidate cards and threshold adjustment consume some eval/history data, but user-facing dashboards, per-task recommendations, and role-assignment suggestions remain open.

### From NEXT_SESSION.md "What Could Be Next" — Also Open
- **Project Companion** — cheap/local side assistant for quick project questions and token savings
- **Rate limiting / token budget enforcement** in provider adapter layer
- **Electron app polish** — packaging, auto-update, native window chrome
- **Decision tree visualization** for routing decisions in Settings
- **Per-model success dashboard** in Settings → Routing Learning
- **Export/import** routing learning data for benchmarking

---

## Consolidated Todo — Critical Gaps #4 & #5 + Related Items

### Gap #4: Cost-Aware & Complexity-Aware Selection

This is implemented in the current code. Future work should preserve and improve visibility, not rebuild it:
- Simple low-risk tasks use `cheap-direct` and skip classifier overhead.
- Medium tasks use classifier routing.
- Deep, tool-heavy, and image tasks escalate to stronger suitable candidates.
- Route trace separates workflow routing from model-selection policy.

### Gap #5: Eval Feedback Loop into Routing

Do not start this until the remaining higher-priority prompt/routing/output presentation items above are clearly complete.
**Files to touch:** `server/evals.ts`, `server/autoRouter.ts`, `server/router.ts`, `server/index.ts`

1. **Expose `EvalSummary.recommendations`** as an API endpoint
2. **Wire recommendations into auto-router candidates** — update candidate cards based on eval results per role
3. **Track per-task-type routing success/failure** — use `routerLearning.ts` outcome recording with task type metadata
4. **Surface "best model for X tasks"** in a Settings dashboard panel
5. **Auto-adjust role assignments** from eval data — if eval says Qwen3 Coder is best for code, update the "coder" agent role

### P2: Rate Limiting / Token Budget Enforcement
**Files to touch:** `server/providerHealth.ts`, `server/config.ts`

1. **Add rate limit config** — max requests per minute, max tokens per minute
2. **Enforce in provider adapter layer** — wrap `streamChat()` with a token bucket or sliding window
3. **Return rate-limit headers** — `X-RateLimit-Remaining`, `X-RateLimit-Reset`
4. **Show rate limit status in status bar** — visual warning when approaching limits

### P2: Electron App Polish
**Files to touch:** `electron/main.cjs`, `package.json`

1. **Fix `electron .` startup** — add error handling for missing Vite server
2. **Auto-update wiring** — add `electron-updater` with GitHub releases
3. **Native window chrome polish** — custom titlebar, traffic light insets, min size
4. **Packaging config** — update electron-builder config for macOS .dmg signing

### P3: Routing Decision Visualization
**Files to touch:** `src/components/Settings/RoutingLearning.tsx` (new)

1. **Decision tree component** — visual flow of "input → heuristic router → auto-router → model selection"
2. **Show per-decision details** — task text, classification result, selected model, score, cache hit
3. **Filter by date/model/task-type**

### P3: Per-Model Success Dashboard
**Files to touch:** `src/components/Settings/ModelSuccess.tsx` (new), `server/routerLearning.ts`

1. **Success rate table** — model, total tasks, success rate, avg cost, top task types
2. **Historical trend chart** — success rate over time per model
3. **Recommendation panel** — "Qwen3 Coder shows 94% success on coding tasks"

### P3: Export/Import Routing Learning Data
**Files to touch:** `server/routerLearning.ts`, `src/components/Settings/`

1. **JSON export** — download `routing-events.json` with all learning data
2. **JSON import** — upload and merge into existing dataset
3. **Benchmark mode** — flag data as "benchmark" vs "production" for A/B comparison

---

## Quick Reference

```typescript
// Key server endpoints
GET  /api/router/state          — Auto-router configuration + cache state
GET  /api/router/learning       — Cross-session routing summary
GET  /api/router/learning/events — Raw routing decision events
GET  /api/router/learning/success-rates — Per-model success rates
POST /api/router/learning/outcome  — Record outcome signal (success/failure/ambiguous)
POST /api/router/learning/suggest-threshold — Ask for threshold adjustment suggestion
GET  /api/providers             — List configured providers
POST /api/providers/:id/health/probe — Live health test for a provider
GET  /api/mcp/curated/validate  — Validate curated MCP prerequisites
GET  /api/mcp/watchdog          — MCP connection status
GET  /api/cost/estimate         — Estimate USD cost for a model + token count

// Key source files
server/autoRouter.ts            — Classifier-based per-task model routing
server/router.ts                — Heuristic router (role/mode/complexity regex)
server/orchestrator.ts          — Multi-agent pipelines
server/agentRuntime.ts          — Sub-agent execution
server/routerLearning.ts        — Cross-session routing learning
server/evals.ts                 — Eval harness with recommendations
server/modelProfiles.ts         — Model configs, pricing, isReasoningModel()
server/providerHealth.ts        — Health probe + capability tracking
server/config.ts                — Config schema including auto-router, context config
```

## Immediate Commands
```bash
# Kill server & frontend when done
screen -S oh-server -X quit
screen -S oh-vite -X quit

# Re-launch
screen -dmS oh-server bash -c 'cd /Users/kevink/Projects/OpenHarness && npx tsx server/index.ts'
screen -dmS oh-vite bash -c 'cd /Users/kevink/Projects/OpenHarness && npx vite --port 5173 --host'
```
