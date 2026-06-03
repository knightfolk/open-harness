# Next Session — Open Issues Handoff

## Identity
You are **Friday**, the AI assistant for OpenHarness. Follow all rules in `AGENTS.md`.

## Repository State

`/Users/kevink/Projects/OpenHarness` on `main`. All commits pushed.
- `npm run lint` — PASSED
- `npx tsc --noEmit --project tsconfig.server.json` — PASSED
- `npx tsc --noEmit --project tsconfig.json` — PASSED

## What's Been Done (Last Session)

### P0 — Multi-Agent Orchestrator
- Execute mode: **planner → implementer → reviewer** sequential sub-agents with context passing
- Investigate mode: **explorer** single-pass research agent
- Compare mode: **N models run independently → judge** with scoring
- Message handler redirects non-direct modes to `runOrchestratorPipeline()`
- Per-phase trace steps emitted with model, status, duration

### P1/P2 — Cleanup Items
- **Cost estimation** in StatusBar: pricing table in `modelProfiles.ts`, client-side `estimateModelCost()`, `POST /api/cost/estimate` endpoint, DollarSign badge in status bar
- **StreamCleaner**: Merged `StreamingTagStripper` + `MonologueBuffer` into single `StreamCleaner` class (less code, same behavior)
- **Onboarding optimization preference**: New step 5 in wizard — Best Quality / Balanced / Low Cost / Local & Private
- **PLAN.md checklist updated** to reflect actual state

### P3 — Housekeeping
- **Plan.md checkboxes**: All completed items marked [x]
- **Stale docs archived**: Moved `MINIMAX_M3_LONG_RUNNING_RESEARCH.md`, `VIBE_CODER_RESEARCH.md`, `ROUTING_DEEP_DIVE.md` to `archive/`

## Remaining Open Items

### P1 — Still Open
- Provider health live smoke test (MiniMax credential test)
- Failed provider fallback without losing run trace context
- Validate curated MCP endpoints against real servers
- MCP gateway-death recovery mid-session
- Patch review workflow polish (smooth proposal from chat, empty states)
- Context budget controls UI (include/never-include patterns)

### P3 — Still Open
- Decide Electron vs Swift for V1 desktop shell
- Cross-session routing learning (track outcomes over time)
- Auto-adjust auto-router threshold from historical data

### Housekeeping
- The `NEXT_SESSION.md` in `archive/` may have useful context

## Quick Reference

```
// Key files
server/orchestrator.ts     — Multi-agent pipelines (527 lines)
server/agentRuntime.ts     — runAgentPhase() for sub-agent execution
server/autoRouter.ts       — Classifier-based per-task model routing
server/providerHealth.ts   — Health probe + capability tracking
server/reviewComments.ts   — File/line review comments on patches
server/commitMessage.ts    — Commit generation + validation gate
server/browserCapture.ts   — DOM/console/network capture
server/sectionRedaction.ts — Secret redaction + token estimation

// All endpoints
grep "app\.(get|post|put|patch|delete)" server/index.ts
```
