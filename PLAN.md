# OpenHarness — Roadmap & Implementation Plan

## Status Snapshot — 2026-06-02

This plan incorporates findings from the comprehensive codebase review on 2026-06-02 and the integration of an auto-router ported from [UltraCode-Shim](https://github.com/OnlyTerp/UltraCode-Shim).

### What's Built Well

| Area | Status | Details |
|------|--------|---------|
| Provider abstraction | ✅ Done | OpenAI-compatible, Anthropic, Gemini adapters |
| Per-family model profiles | ✅ Done | `server/modelProfiles.ts` — 15+ model families with prompting configs |
| Prompt builder | ✅ Done | `server/promptBuilder.ts` — model-aware system prompts with tool adaptation |
| Project Cortex | ✅ Done | Auto-profiling of opened folder (git, languages, scripts, AGENTS.md) |
| Run traces | ✅ Done | Real SSE event stream with route, prompt, tool, and model steps |
| Trust/safety | ✅ Done | 5 trust modes, command risk classifier, tool policy |
| MCP integration | ✅ Done | Docker lifecycle, curated server suggestions, polling |
| Session persistence | ✅ Done | Disk persistence under `~/.openharness/sessions` |
| Project memory | ✅ Done | Per-project markdown memory, injected into prompts |
| Repo map + context pack | ✅ Done | Token-budgeted file indexing with contextual file suggestions |
| Patch proposals | ✅ Done | Server-side unified diff creation, accept/reject hunks |
| Eval harness | ✅ Done | Model Lab with weighted scoring, signal analysis |
| Background agents | ✅ Done | `server/agentRuntime.ts` with profiles, cancellation |
| Heuristic router | ✅ Done | `server/router.ts` — classifies role/mode/complexity via regex |
| Auto-router | ✅ NEW | `server/autoRouter.ts` — classifier-based per-task model selection |

### Critical Gaps Revealed by Review

1. **Orchestrator is documentation, not execution.** Investigate/execute/compare modes only inject instruction text into the system prompt. They do NOT spawn multiple agents, make sequential model calls, or pass context between phases.

2. **Router is heuristic-only.** No model-based classifier step. Static keyword regexes can't detect subtle distinctions, ambiguous requests, or novel task types.

3. **Single-model bottleneck.** Even though role buckets select different models, only ONE model call happens per user message. A task classified as "execute" should call planner, implementer, and reviewer with different models.

4. **No cost-aware or complexity-aware selection.** Simple questions use the same model as complex ones. No automatic de-escalation to cheap models for trivial tasks.

5. **No eval feedback loop into routing.** The eval harness produces recommendations but nothing consumes them to update routing defaults or role assignments.

6. **"Start with answer" rule fights reasoning models.** The monologue prevention instruction (`"Start your response directly with the answer"`) actively harms DeepSeek R1, Qwen3 Thinking, and Grok 4+.

7. **Two overlapping streaming cleanup systems.** `StreamingTagStripper` + `MonologueBuffer` add complexity, latency, and can drop legitimate content.

---

## Review Follow-up — 2026-06-02 Morning Changes (Auto-Router Integration)

### Phase 6 — Auto-Router (NEW — 2026-06-02)

The auto-router (`server/autoRouter.ts`) adds classifier-based per-task model selection to OpenHarness, ported from [UltraCode-Shim's](https://github.com/OnlyTerp/UltraCode-Shim) proven design.

**How it works:**
1. A cheap classifier model (configured by user) scores each candidate model 0–1 on task fitness
2. The cheapest candidate above a quality threshold wins the task
3. Decisions are cached per-task to avoid re-classifying tool-call round-trips
4. Falls back gracefully to the cheapest candidate if classifier errors or is unavailable

**Deliverables:**
- [x] `server/autoRouter.ts` — full classifier-based routing engine (647 lines)
- [x] `AutoRouterConfig` / `AutoRouterCandidate` types in `server/config.ts`
- [x] `configureAutoRouter()` called on startup and config change
- [x] `routeWithAutoRouter()` in `server/router.ts` — enhanced routing with auto-router model selection
- [x] `GET /api/router/state` endpoint for UI
- [x] `POST /api/router/configure` endpoint
- [x] `POST /api/router/clear-cache` endpoint
- [x] `autoRouter` section in `~/.openharness/config.json` schema
- [x] Expanded `AGENTS.md` with routing/orchestration/model-family guidance

**Pending auto-router items:**
- [ ] UI toggle and configuration in Settings
- [ ] Client-side API methods in `src/utils/api.ts`
- [ ] Per-task caching TTL enforcement in decision loop
- [ ] Integration with `server/index.ts` chat loop (currently the helper function exists but is not yet called from `streamModel`)
- [ ] Auto-router decision shown as a run trace step
- [ ] Classifier model health check
- [ ] Router decision logging (`UC_ROUTER_LOG=1` equivalent)

### Config Schema (Auto-Router)

```jsonc
// ~/.openharness/config.json
{
  "autoRouter": {
    "enabled": false,                     // Off by default — user opts in
    "classifierModel": "minimax:MiniMax-M3",  // Cheap model that scores candidates
    "threshold": 0.7,                     // 0–1 quality bar
    "defaultModel": "minimax:MiniMax-M3", // Fallback when classifier can't run
    "cacheTTLMs": 300000,                 // 5 min per-task cache
    "candidates": [
      {
        "modelId": "minimax:MiniMax-M3",
        "cost": 0.3,
        "supportsImages": false,
        "card": "Cheap, ~1M context. Strong on single-file edits, boilerplate, simple refactors. Weak on multi-file refactors, subtle debugging."
      },
      {
        "modelId": "anthropic:claude-sonnet-4-6",
        "cost": 1.0,
        "supportsImages": true,
        "card": "Mid-cost frontier. Strong on multi-file edits, architecture, images. Reserve for hard tasks."
      }
    ]
  }
}
```

---

## Phase 6 (Continued) — Real Orchestration

### 6.4 — Orchestrator Actually Orchestrates

**Current:** `server/orchestrator.ts` returns instruction text + trace steps only.
**Target:** Orchestrator spawns real sub-agent calls for multi-phase workflows.

**Execute mode pipeline (target):**
```
Heuristic router → Auto-router selects model
  → Planner agent (reasoning model) produces plan
  → Implementer agent (coder model) applies changes as patch proposal
  → Reviewer agent (reviewer model) checks quality
  → Merge results into final report
```

**Investigate mode pipeline (target):**
```
Heuristic router → Auto-router selects model
  → Explorer agent (read-only) inspects files
  → Synthesizer produces grounded answer
```

**Compare mode pipeline (target):**
```
Heuristic router identifies comparison intent
  → Auto-router selects candidate models
  → Each model runs the prompt independently
  → Judge agent scores and compares outputs
  → Comparison artifact
```

**Implementation order:**
1. Wire background agent runtime (`agentRuntime.ts`) into orchestrator
2. Add context passing between phases (planner's plan → implementer's context)
3. Handle phase failures (if implementer fails → fall back to single model call)
4. Emit per-phase run trace steps with agent ID, model, duration

### 6.5 — Complexity- and Cost-Aware Selection

- Detect task complexity from message length, structural clues, and optionally the classifier score
- Simple tasks → cheapest candidate directly, no classifier call
- Medium tasks → normal auto-router flow
- Complex tasks → escalate to strongest model, no threshold
- Surface cost estimate in UI (status bar or tooltip)

### 6.6 — Eval Feedback Loop into Routing

- Compare eval results across role categories to inform auto-router candidate cards
- Surface "this model performed best for X-type tasks" from eval summaries
- Allow auto-router candidates to be derived from eval results
- Track per-task-type routing success/failure to auto-adjust threshold
- Eval feedback loop integration with `EvalSummary.recommendations`

---

## Consolidated Pending Items (by Priority)

### P0 — Must Complete
- [ ] Wire auto-router into `server/index.ts` chat loop (call `routeWithAutoRouter` from message handler)
- [ ] Create client API methods in `src/utils/api.ts` for router config/state
- [ ] UI toggle for auto-router in Settings
- [ ] Auto-router decision as run trace step
- [ ] Wire orchestrator to actually spawn agents for execute/investigate/compare modes
- [ ] Fix "Start with answer" rule: gate behind reasoning model detection

### P1 — High Impact
- [ ] Provider health probes with real token/cost/latency data
- [ ] MiniMax credential-backed live smoke test
- [ ] Failed provider fallback without losing run trace context
- [ ] Validate curated MCP endpoints against real servers
- [ ] MCP gateway-death recovery mid-session
- [ ] Patch review workflow polish (smooth proposal from chat, empty states)
- [ ] Inline comment creation from reviewer agents
- [ ] Commit message generation + validation gate + branch/PR creation
- [ ] Context budget controls (include/never-include, omitted-context display)

### P2 — Polish & Scale
- [ ] Worktree isolation for patch proposals
- [ ] Browser verification depth (DOM, a11y, console, network capture)
- [ ] Multi-agent team runtime with parallel agents
- [ ] Secret redaction in prompt microscope
- [ ] Token estimates per prompt section
- [ ] Project memory UI (view/edit/pin/archive/delete/export)
- [ ] Cost estimation display in status bar

### P3 — Future
- [ ] Merge `StreamingTagStripper` + `MonologueBuffer` into one pass-through
- [ ] Decide Electron vs. Swift for V1 desktop shell
- [ ] Onboarding polish (optimization preference, partial-setup resume)
- [ ] Cross-session routing learning (track outcomes over time)
- [ ] Auto-adjust auto-router threshold from historical data

---

## Legacy Content (Phases 1–5)

*Preserved for reference. These items are either complete or superseded by Phase 6 above.*

### Goal (original)
Turn OpenHarness into a truly open AI harness that supports **every major provider** — closed source (OpenAI, Anthropic, Google, Azure, Bedrock) and open source (Ollama, LM Studio, local endpoints) — through a unified provider abstraction.

### Architecture Summary
- **Provider Registry** — unified `streamChat()` interface with OpenAI-compatible, Anthropic, Gemini adapters
- **Model Registry** — static catalog with context window, max tokens, cost, capabilities
- **Configuration** — `~/.openharness/config.json` with providers, MCP, personality, themes, role assignments

### Legacy Phase 1–3: Provider Abstraction (COMPLETE)
- [x] Provider types, adapters, registry, config loader
- [x] `server/index.ts` uses provider registry
- [x] `GET /api/providers`, `GET /api/providers/discover`
- [x] Model selector in top bar with provider grouping

### Legacy Phase 4: Chat-MCP Integration (MOSTLY COMPLETE)
- [x] MCP tool calls in chat loop with round-trips
- [x] Docker MCP lifecycle in Settings (start/stop/restart, readiness, polling)
- [x] Curated MCP suggestions with permission labels
- [ ] MCP recovery when gateway dies mid-session
- [ ] MCP smoke test actions
- [ ] Fetch models success/error toasts

### Legacy Phase 5: Guided Onboarding (MOSTLY COMPLETE)
- [x] Multi-provider onboarding with "Test all"
- [x] Default personality, trust mode, active model
- [x] Docker readiness check
- [ ] Optimization preference selector (best quality / low cost / local-private / balanced)
- [ ] Role bucket override before finishing onboarding
- [ ] Partial-setup resume on server restart

---

## Implementation Order (Recommended Next Steps)

1. **Wire auto-router into chat loop** — call `routeWithAutoRouter()` from the message handler in `server/index.ts` and emit decision as run trace step
2. **Add auto-router UI** — Settings toggle + client API methods
3. **Fix "Start with answer" rule** — gate behind `isReasoningModel()` detection
4. **Orchestrator multi-agent execute mode** — wire `agentRuntime.ts` into orchestrator's execute pipeline
5. **Provider health + cost tracking** — real token/cost/latency data from provider responses
6. **Eval feedback loop** — wire `EvalSummary.recommendations` into role assignments and auto-router candidates
7. **Remaining MCP + patch review polish** from consolidated pending items

## Validation

Every implementation pass must end with:
```bash
npm run lint
npm run build
```
If server/runtime code changes, kill existing processes, relaunch (`npm start`), and verify reachability at `http://127.0.0.1:3001`.
