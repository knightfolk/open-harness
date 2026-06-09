# Technical Specification: Long-Running Agent Stress Test Fixes

## Technical Context

- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js via tsx, Express 5
- **Dependencies**: `fs`, `uuid`, `express` — no new deps needed
- **Build**: `tsc -b && vite build`, lint via `eslint .`
- **Test**: `tsx scripts/test-*.ts` — ad-hoc test scripts in `scripts/`

## Key Files

| File | Role |
|------|------|
| `server/index.ts` | Main Express server (~5200 lines). Contains SSE stream handlers, tool invocation, session persistence |
| `server/sessionStore.ts` | Session CRUD with JSON file persistence |
| `server/routingAdherence.ts` | Append-only JSONL event store for routing diagnostics |
| `server/runTrace.ts` | HarnessRun trace builder with step tracking |
| `server/toolPolicy.ts` | Trust mode tool filtering and command risk classification |
| `server/toolCallMarkup.ts` | Tool call parsing from model text output |

## Implementation Approach

### S1: Persist assistant error messages on all failure paths (R1)

**Problem**: Three error paths in `server/index.ts` emit SSE errors but never save an assistant message:

1. **`streamModel` catch block** (line ~3398): Provider stream fails → emits `event: error` → returns without saving
2. **`streamModel` API error early return** (line ~3204-3229): Non-OK HTTP response → emits error → returns without saving
3. **`streamModelWithFallback` total failure** (line ~4997-5005): All providers fail → emits error text and SSE error → does not call `saveSession`

**Solution**: Add a helper function `persistAssistantError(session, assistantId, errorContent, run?)` that:
1. Pushes an assistant message with `content` = error description to `session.messages`
2. Sets `session.updatedAt`
3. Sets `runTrace` on the message if a run is provided
4. Calls `sessionStore.saveSession(session)`

Call this helper from:
- The catch block in the `/api/sessions/:id/messages` POST handler (the outer orchestration catch, line ~2488)
- The catch block inside `streamModel` (line ~3398)
- The early return for API errors in `streamModel` (line ~3204)
- The total failure path in `streamModelWithFallback` (line ~4997)
- The native adapter catch (line ~3140)

The outer POST handler (lines 2300-2504) must also save the session in its `finally`-like path after `streamFinished = true`, to handle the case where a sub-call already saved an error message but the handler needs to finalize.

### S2: Reject fake subagent tool calls (R2)

**Problem**: Models sometimes call tools with invented names like `subagent-security`, `subagent-backend` through MCP. These get passed to `invokeMCPTool` which either returns a no-op or throws.

**Solution**: Add a guard in the tool invocation loop (inside `streamModel`, the tool calls processing section) and also in `invokeMCPTool`:

1. In the tool round loop, before calling `invokeMCPTool`, check if the tool name matches `/^subagent-/i` or is otherwise not in the known tool list
2. If matched, return a rejection message: `"Tool '${name}' is not a registered tool. Use the built-in orchestration system for multi-agent tasks instead of inventing tool names."`
3. Log it in the runTrace as an error step
4. The model sees the rejection in the tool result and can adjust

Also add the same guard in `gatherMCPToolsForAPI()` to filter out any MCP tools with `subagent-` prefix from the advertised tool list.

### S3: Trust-policy denial persistence (R3)

**Problem**: When `checkToolActionPolicy` blocks a tool call, the error is returned as an MCP tool result but the overall stream may subsequently fail, leaving no persisted error.

**Solution**: This is largely solved by S1 (persistent error messages on all failure paths). Additionally:
1. In the tool invocation section of `streamModel`, when `checkToolActionPolicy` returns `allowed: false`, ensure the denial message is descriptive
2. Record the trust denial as a runTrace step with the denied tool name, args, and reason
3. The persisted error message (from S1) will include the trust context

### S4: Session-store regression test (R4)

**New file**: `scripts/test-session-persistence-regression.ts`

Approach:
1. Read all JSON files from `~/.openharness/sessions/`
2. For each session, sort messages by timestamp
3. If the latest message has `role: 'user'` and its timestamp is older than a configurable threshold (default 2 minutes), flag it
4. Exempt sessions where the session file was modified very recently (could still be streaming)
5. Print summary and exit with code 1 if any flagged sessions found

Uses existing imports: `fs`, `path`, `os` — no new deps.

### S5: SSE regression test for live progress (R5)

**New file**: `scripts/test-sse-progress-regression.ts`

Approach:
1. Start a temporary Express server or test against a running instance at `localhost:3001`
2. Create a session via `POST /api/sessions`
3. Send a message via `POST /api/sessions/:id/messages` and capture SSE events
4. Assert that at least one event type in `['thinking', 'run_start', 'auto_router', 'route']` arrives before any `text` event
5. Report timing metrics
6. Clean up the test session

For testability without a running provider, provide a mock mode that validates the SSE event ordering logic against captured event logs.

## Data Model Changes

No schema changes to `PersistedSession` or `PersistedMessage`. Error messages use the existing `role: 'assistant'` with descriptive content.

## Verification

```bash
npm run lint
npm run build
npm run test:hardening
tsx scripts/test-session-persistence-regression.ts
tsx scripts/test-sse-progress-regression.ts
```
