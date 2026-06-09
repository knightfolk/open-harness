# PRD: Long-Running Agent Stress Test Fixes

## Background

The active session analysis identified critical failures where:
- Failed/blocked runs leave sessions with only the user message (no assistant response or error)
- Models invent `subagent-*` tool names through `mcp-exec` instead of first-class orchestration
- Trust-policy blocks kill the SSE stream without persisting a user-visible error
- The router classifier returns empty scores too often

## Requirements

### R1: Every user message must eventually produce a persisted assistant record

**What**: When any model request fails (timeout, provider error, trust-policy block, abort), the session store must persist an assistant error message alongside the existing SSE error event.

**Why**: Currently, error paths in `streamModelWithFallback` (line ~2955) and `streamModel` (line ~3398) emit `event: error` SSE events but do not save an assistant message to the session. After SSE closes, reloading the session shows only the user message — making it look like the assistant disappeared.

**Success criteria**:
- Every failed run persists a visible assistant error message to the session JSON
- Error messages explain what went wrong and suggest next steps
- Session never ends in latest-user-only state (unless explicitly canceled mid-stream by the user)

### R2: Reject fake subagent tool calls

**What**: When a model attempts to call tools with invented `subagent-*` names through MCP (`mcp-exec`), the system must reject those calls and inform the model that subagent orchestration must use the built-in orchestrator.

**Why**: The model currently improvises tool names like `subagent-security`, `subagent-backend` through Docker MCP, which complete immediately as no-ops. The user sees no agent bubbles and the multi-agent request is silently ignored.

**Success criteria**:
- Tool calls matching `subagent-*` pattern are intercepted and rejected with a clear message
- The model receives feedback to use the built-in orchestration system instead
- These fake calls are logged in the runTrace for debugging

### R3: Trust-policy denials must produce persisted error messages

**What**: When a tool call is blocked by trust policy, the denial must result in a visible, persisted assistant error message — not just a silent SSE close.

**Why**: The active session shows a trust-policy block (`Blocked (Writing to device files)`) ending the run with no saved assistant output. The user only sees an empty session.

**Success criteria**:
- Trust-policy denials during tool execution produce a saved assistant error message
- The error explains which action was blocked, why, and how to resolve it
- The runTrace records the denied tool name and policy reason

### R4: Session-store regression test for latest-user-only detection

**What**: An automated test that scans session files and flags any session where the latest message is from the user and is older than two minutes, unless it has an explicit cancel/interrupt marker.

**Why**: This is the core regression detector. It catches all the failure modes above in one check.

**Success criteria**:
- Test scans `~/.openharness/sessions/*.json`
- Flags sessions with latest-user-only state older than a configurable threshold
- Exempts sessions with explicit canceled/interrupted markers
- Passes when no flagged sessions exist

### R5: SSE regression test for live progress before final answer

**What**: An automated test that verifies SSE streams emit visible progress events before the final answer text arrives.

**Why**: The stress test plan requires "first visible progress appears within two seconds." Without a regression test, streaming regressions go undetected.

**Success criteria**:
- Test sends a prompt and captures SSE events
- Asserts that at least one progress/thinking/status event arrives before `event: text`
- Reports timing metrics (time to first progress, time to first text)

## Out of scope

- Multi-agent UI visibility (separate feature effort)
- Router classifier empty-score fallback rate reduction (tuning, not a bug)
- 50-agent swarm execution (test execution, not implementation)
- Overnight soak automation
