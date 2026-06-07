# Long-Running Agent Stress Test Plan

Last updated: 2026-06-07

## Purpose

This plan turns the current active-session failure into a repeatable long-running stress test for OpenHarness. The goal is to prove that high-effort reasoning prompts, multi-agent orchestration, streaming, tool policy, session persistence, and UI visibility all survive a 50-agent open-source test run.

The test is intentionally aggressive. It should catch blank assistant sessions, quiet streams, hidden subagents, invented tool calls, router fallback loops, trust-policy crashes, and persistence gaps.

## Current Active-Session Review

The latest active session file is:

`/Users/kevink/Library/Application Support/Parall/Codex Stock/.openharness/sessions/5b61294f-2c77-42c3-8e1c-cfaa57910f85.json`

Observed state:

- The session contains the user's deep-dive request, but no persisted assistant response.
- The user asked for four subagents, but the model attempted Docker MCP `mcp-exec` calls named `subagent-security`, `subagent-backend`, `subagent-model-intelligence`, and `subagent-frontend`.
- Those calls completed almost immediately in the server log, so they were not real long-running OpenHarness subagents.
- The routing-adherence event store recorded the latest hard error as an `agent-request` failure for `minimax:MiniMax-M3`:
  - Run: `089d4b80-328c-42b3-9068-6973d356c4e3`
  - Role: `planner`
  - Error: `Blocked (Writing to device files) — switch to full-local mode to allow`
  - Elapsed: `21612ms`
  - Created: `2026-06-07T04:49:03.099Z`

Primary failure interpretation:

- OpenHarness did not convert the user's "use 4 subagents" instruction into first-class app-visible agents.
- The model improvised tool names through `mcp-exec`, which should not be treated as agent orchestration.
- A trust-policy block ended the active run.
- The session store did not preserve a final assistant error bubble or partial run summary, leaving the active session looking empty or stalled after reload.

## Release-Critical Findings

### P1: Failed Runs Can Persist As User-Only Sessions

A failed or blocked agent request can leave the session with only the user message. This makes the UI look like it lost the assistant, even though the backend recorded an error.

Pass condition:

- Every submitted user message must eventually persist one of these records:
  - final assistant response
  - user-visible assistant error bubble
  - canceled run marker
  - resumable interrupted-run marker

Fail condition:

- Any session file older than two minutes contains a latest user message with no later assistant, error, cancellation, or run marker.

### P1: User-Requested Subagents Are Not First-Class Orchestration

The active session shows the model trying to create subagents by calling invented `subagent-*` names through Docker MCP. That is not the same as app-visible OpenHarness agents with independent bubbles, icons, progress, and final summaries.

Pass condition:

- A prompt asking for `N` subagents creates `N` visible OpenHarness agent runs or a clear assistant explanation that the current mode cannot spawn that shape.
- Agent bubbles appear in the main chat and the subagent pane.
- Each visible agent has a role, model, status, live progress, and final contribution.

Fail condition:

- The model calls `mcp-exec` with invented names such as `subagent-security`.
- Work happens only in server logs or hidden tool calls.
- The UI shows one assistant bubble while multiple background phases are running.

### P1: Trust-Policy Blocks Must Degrade Gracefully

The latest active run ended with `Blocked (Writing to device files) — switch to full-local mode to allow`. The user should never be left with a silent or empty session when trust mode blocks a tool path.

Pass condition:

- Trust-policy failures stream an immediate visible status update.
- The final saved assistant message explains which action was blocked and how to proceed.
- The runTrace records the denied tool name, policy reason, role, model, and phase.

Fail condition:

- The SSE closes without a saved assistant message.
- The only evidence is in server logs or routing-adherence JSONL.

### P2: Router Classifier Empty-Score Fallbacks Are Too Common

Recent routing events show repeated `Fallback: classifier returned empty scores` entries. Fallback itself is acceptable, but repeated empty-score fallback makes model choice and complexity selection unstable during long runs.

Pass condition:

- Empty classifier-score fallback rate stays below 5% during the swarm run.
- Fallback events include the classifier model, prompt hash, selected fallback model, and whether the fallback changed the final route.

Fail condition:

- More than 5% of routed prompts use empty-score fallback.
- Fallback silently routes everything to one model without clear UI or telemetry.

### P2: Client-SSE Aborts Need Clear Classification

Some `client-sse` abort events are expected when tests intentionally disconnect, refresh, or use short timeouts. They should be labeled separately from backend failures.

Pass condition:

- Intentional disconnects are classified as client disconnects.
- Backend/provider errors are classified separately.
- The UI can resume, retry, or display the saved partial state.

Fail condition:

- A user refresh creates the same visible state as a provider crash.
- The event store cannot distinguish test harness aborts from real failures.

## Test Environment

Run the test against a normal OpenHarness development setup first, then repeat against the stable installed app artifact when release-runtime behavior matters.

Required services:

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:3001`
- Router state: `GET http://127.0.0.1:3001/api/router/state`
- Session store: `~/.openharness/sessions/`
- Routing event store: `~/.openharness/routing-adherence/events.jsonl`
- Server logs from `npm run dev:all` or the stable app runtime

Required configuration:

- At least one reasoning model with streaming enabled, preferably MiniMax M3.
- At least one fast fallback model.
- At least one code-capable model.
- Docker MCP enabled only if testing tool gateway behavior.
- Trust mode explicitly recorded for every run.

## Telemetry To Capture

Capture these artifacts at the start, every 10 minutes, and at the end:

- `GET /api/router/state`
- `GET /api/mcp/status`
- `GET /api/mcp/docker/readiness`
- Latest 200 lines of server log
- Last 200 events from `~/.openharness/routing-adherence/events.jsonl`
- List of sessions updated during the run
- Browser console errors and warnings
- Network trace for `/api/chat/stream` or equivalent SSE endpoint
- Process CPU and memory snapshots for frontend, backend, and Docker MCP gateway

Derived counters:

- Total prompts submitted
- Total assistant finals persisted
- Total visible assistant errors persisted
- Total sessions with latest user-only state older than two minutes
- Total client disconnects
- Total provider errors
- Total trust-policy denials
- Total classifier empty-score fallbacks
- Total user-visible subagent bubbles created
- Total invented `mcp-exec` or `subagent-*` tool calls
- Median time to first visible progress
- Median time to first answer text
- Median time to final response

## Long-Running Schedule

### Phase 0: Baseline Health, 15 Minutes

Purpose:

- Prove the app is reachable and telemetry is recording before load starts.

Steps:

1. Start OpenHarness.
2. Verify frontend and backend are reachable.
3. Fetch `/api/router/state`.
4. Fetch Docker MCP readiness and runtime status.
5. Send one simple direct prompt.
6. Send one MiniMax M3 reasoning prompt.
7. Confirm the session store has final assistant messages for both prompts.

Pass criteria:

- First visible progress appears within two seconds for the reasoning prompt.
- Final response persists to the session file.
- No unhandled server errors.

### Phase 1: Known Regression Reproduction, 30 Minutes

Purpose:

- Reproduce the active-session failure path with controlled prompts.

Seed prompt:

```text
Perform a deep dive of this code base looking at all areas of the project. Use 4 subagents to assist because this is a large code base. When each agent is done, they should review each other's work and as a group produce a single document and plan.
```

Expected UI behavior:

- The main chat shows a coordinator bubble.
- Four agent bubbles appear with distinct roles and icons.
- Each agent streams concise progress.
- Tool calls are collapsed or summarized; thinking/progress remains visible.
- The final coordinator response includes a merged plan.

Hard failures:

- Session persists only the user prompt.
- Any `mcp-exec` call uses invented names like `subagent-security`.
- Trust-policy denial ends the run without a saved assistant error.
- The main chat stays quiet for more than five seconds while agents run.

### Phase 2: Streaming Soak, 60 Minutes

Purpose:

- Verify that reasoning-heavy models stream useful progress immediately and clear it into the final response without saving raw private thinking.

Run 20 prompts:

- 5 architecture analysis prompts
- 5 code review prompts
- 5 planning prompts
- 5 failure-debugging prompts

Per-prompt assertions:

- A live progress indicator appears within two seconds.
- Progress changes at least every 10 seconds during long model silence.
- The final transcript does not persist raw thinking.
- The final transcript does persist useful assistant text or an explicit error.

Hard failures:

- Entire answer appears all at once with no live progress.
- Raw model thinking is saved into the transcript.
- The live progress area remains stuck after final answer text starts.

### Phase 3: Multi-Agent Visibility, 90 Minutes

Purpose:

- Prove that OpenHarness can show concurrent or staged agent work in the main chat.

Run these prompts repeatedly:

```text
Plan and implement a small bug fix. Use a planner, implementer, and reviewer. Show each agent's progress in the main chat.
```

```text
Compare three approaches to improving streaming reliability. Use separate agents and then produce one merged recommendation.
```

```text
Investigate why failed sessions sometimes do not persist assistant output. Use separate frontend, backend, and persistence agents.
```

Per-run assertions:

- Each agent has a stable visible identity.
- Agent order is understandable.
- Most recent progress is visible without losing the overall progress bar.
- Tool calls are bundled or collapsed.
- The user can still tell which agent is thinking, acting, blocked, or done.

Hard failures:

- Only one agent appears when multiple agents are active.
- Agents complete in logs but never appear in the UI.
- The progress bar scrolls out of view during active work.

### Phase 4: Trust Boundary And Tool Gateway, 90 Minutes

Purpose:

- Make sure model tool behavior cannot silently break the session.

Test cases:

- Ask for read-only repository analysis.
- Ask for file edits in workspace-write trust mode.
- Ask for an action that should be blocked.
- Ask for Docker MCP tool usage.
- Ask for fake tools and fake subagents.

Per-run assertions:

- Allowed tools execute normally.
- Blocked tools produce immediate visible errors.
- Denied tool attempts are persisted in runTrace.
- Fake tool names are rejected or ignored safely.
- Tool-management capabilities are hidden unless explicitly enabled.

Hard failures:

- A fake `subagent-*` tool call is treated as real orchestration.
- A blocked action closes the SSE without a user-visible saved result.
- A denial message recommends unsafe mode without context.

### Phase 5: 50-Agent Swarm, 4 Hours

Purpose:

- Simulate open-source community load and adversarial review.

Agent lanes:

- 8 frontend agents: chat stream rendering, subagent pane, settings, responsive layout, accessibility, browser errors, performance, visual regressions.
- 8 backend agents: router, orchestrator, stream endpoint, provider adapters, MCP gateway, session API, config API, error handling.
- 6 provider agents: MiniMax, Qwen, DeepSeek, Mistral, OpenAI-compatible routing, fallback behavior.
- 6 persistence agents: sessions, runTrace, routing-adherence JSONL, config writes, recovery after refresh, restart durability.
- 6 security agents: trust modes, prompt injection, tool allowlists, Docker MCP exposure, secrets redaction, filesystem boundaries.
- 6 model-intelligence agents: model catalog, role assignments, auto-router candidates, thinking-level defaults, eval feedback, recommendations.
- 5 documentation agents: setup docs, troubleshooting, release notes, user-facing settings copy, contributor test instructions.
- 5 performance agents: CPU, memory, SSE throughput, concurrent sessions, long context payloads.

Rules for each agent:

- Start read-only.
- Record every issue with reproduction steps.
- Do not make broad refactors.
- If patching, use one branch per agent lane.
- Every claimed bug must include local evidence.
- Every fix must include a regression test or a clear manual verification step.

Coordinator assertions every 10 minutes:

- No more than 2% of sessions are stuck in latest-user-only state.
- Median time to first visible progress is under two seconds.
- 95th percentile time to first visible progress is under five seconds.
- No hidden background agent work without corresponding UI events.
- No unclassified provider or trust-policy errors.
- No unbounded memory growth.

Hard stop conditions:

- Backend process crashes.
- Session writes become corrupt.
- Trust-policy blocks become invisible to users.
- More than 10 latest-user-only sessions accumulate.
- The app can no longer submit a normal direct prompt.

### Phase 6: Overnight Soak, 8 Hours

Purpose:

- Catch leaks, timer drift, stale streams, and persistence rot.

Run pattern:

- Submit one prompt every two minutes.
- Every fifth prompt asks for multi-agent orchestration.
- Every tenth prompt refreshes the browser mid-stream.
- Every twentieth prompt cancels or disconnects mid-stream.
- Every thirtieth prompt triggers a blocked-tool scenario.

Pass criteria:

- App remains reachable.
- No session JSON corruption.
- No latest-user-only sessions older than two minutes unless explicitly canceled.
- Memory stays within a stable envelope after warm-up.
- Router fallback rate remains below 5%.
- All user-visible errors are understandable and persisted.

## Automation Assertions

Implement these as scripts or test harness checks before the swarm run.

### Session Persistence Check

Scan `~/.openharness/sessions/*.json`:

- Find sessions updated during the test window.
- Sort messages by created time.
- Flag sessions where the latest message is from the user and is older than two minutes.
- Exempt sessions with explicit canceled/interrupted markers.

### Routing Event Check

Scan `~/.openharness/routing-adherence/events.jsonl`:

- Count events by `kind`, `phase`, `role`, `selectedModel`, and `error`.
- Flag `router-classifier` empty-score fallback above 5%.
- Flag `agent-request` errors without a matching visible session error.
- Flag `client-sse` aborts not caused by intentional test disconnects.

### Tool Call Check

Scan server logs and run traces:

- Flag tool names matching `subagent-*` unless they are registered OpenHarness agent tools.
- Flag `mcp-exec` use during normal user-agent orchestration unless explicitly enabled.
- Flag tool denial events with no user-visible assistant error.

### Streaming Check

Capture SSE events:

- First event arrives within one second.
- First visible progress arrives within two seconds.
- Long-running streams emit progress or keepalive updates at least every 10 seconds.
- Final response event clears transient thinking.
- Persisted transcript excludes raw thinking.

### UI Check

Browser automation should verify:

- Main assistant bubble appears before final text.
- Agent bubbles appear in the main chat for multi-agent runs.
- Subagent pane keeps the progress bar visible.
- Tool calls are collapsed by default.
- Error bubbles are visually distinct and actionable.
- Refreshing during a run does not make the session look blank.

## Coordinator Prompt For 50 Agents

Use this prompt to start the open-source swarm:

```text
You are one of 50 OpenHarness stress-test agents. Your job is to break the app constructively and leave evidence.

Scope:
- Test streaming, subagent visibility, tool policy, session persistence, routing, provider fallback, settings defaults, and long-running stability.
- Begin read-only. Do not edit files until you have a confirmed reproduction.
- If you patch, keep the change surgical and include validation.

Required evidence for every issue:
- Exact prompt or action
- Expected behavior
- Actual behavior
- Timestamp
- Session id
- Run id when available
- Relevant routing-adherence event
- Screenshot or server-log excerpt when useful
- Whether the issue survives refresh or restart

Hard regressions to hunt:
- Main chat stays quiet while reasoning or agents are running
- More than one agent is active but only one appears to the user
- Session persists only the user message after a failure
- Tool-policy denial kills a run without a visible saved assistant error
- MiniMax M3 thinking/progress does not stream live
- Fake subagent tool calls are treated as real work
- Router classifier repeatedly returns empty scores
- Provider or auth errors do not explain what the user should fix

Output:
- One concise issue report per confirmed bug
- One final ranked list of the top risks
- One recommendation for the next fix to implement
```

## Exit Report Template

Use this structure for the final long-run report:

```text
Run window:
Build/commit:
Trust mode:
Configured providers:
Models used:
Total prompts:
Total sessions:
Total multi-agent runs:
Total successful finals:
Total visible assistant errors:
Latest-user-only session count:
Classifier empty-score fallback rate:
Agent-request error count:
Client-SSE abort count:
Median time to first progress:
P95 time to first progress:
Median time to final:
Memory start/end:
CPU peak:

Top P1 findings:
Top P2 findings:
Top P3 findings:

Artifacts:
- Server log:
- Routing events:
- Session sample:
- Screenshots:
- Network traces:

Recommended next fix:
```

## Next Fix Candidates

The active-session review points to these likely implementation tasks:

1. Persist failed/interrupted assistant runs as visible assistant error messages, not user-only sessions.
2. Add first-class user-requested agent orchestration instead of letting models invent `subagent-*` tool names.
3. Restrict dynamic MCP execution tools during normal assistant orchestration unless explicitly enabled.
4. Add a tool-policy error adapter that converts trust denials into helpful streamed and persisted UI states.
5. Add an automated session-store regression test for latest-user-only failed runs.
6. Add an SSE regression test that proves live progress appears before final answer text.
