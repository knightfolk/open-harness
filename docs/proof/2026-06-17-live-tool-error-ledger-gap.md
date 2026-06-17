# Live tool-error ledger evidence gap - 2026-06-17

Purpose: preserve the current Phase 7 live-evidence boundary for tool-error recovery memory.

## Current live state

Checked local routing-learning storage before this slice:

```text
~/.openharness/router-learning/tool-error-ledger.jsonl -> missing
/api/router/learning/tool-errors -> no events
```

This means OpenHarness currently has regression-tested and staged proof for tool-error recovery, but does not yet have a genuine live saved-session tool-error recovery row from normal runtime use.

## Runtime contract added

`server/toolErrorLedger.ts` now reports explicit live-evidence status metadata in the tool-error ledger summary:

```text
persistedLedgerExists: boolean
persistedEventCount: number
logTraceEventCount: number
liveEvidenceStatus: missing_ledger | empty | available
```

This prevents a missing live ledger from being mistaken for completed evidence. `missing_ledger` means no persisted live tool-error ledger exists yet; `empty` means the ledger exists but no matching rows are available; `available` means matching tool-error evidence rows are present.

## Validation

```text
npm run test:tool-reliability -> passed
```

The focused guard now checks that live evidence status metadata is present and that a missing persisted ledger is reported as `missing_ledger`.

## Remaining gap

A real provider-approved or local runtime scenario still needs to produce a genuine tool-error recovery row with:

- evidence source
- failed model/provider/tool path
- later working model/provider/tool path
- retry distance
- session id
- run id
- final-answer capture state

Until then, Phase 7 tool-error recovery is not fully closed.

## Post-restart endpoint proof

After relaunching with the server/runtime change, the live endpoint returned:

```json
{
  "totalErrorEvents": 0,
  "persistedLedgerExists": false,
  "persistedEventCount": 0,
  "logTraceEventCount": 0,
  "liveEvidenceStatus": "missing_ledger",
  "byModel": {},
  "byModelProvider": {},
  "byTool": {},
  "topUnrecoveredPaths": [],
  "recentEvents": []
}
```

Reachability and process proof after restart:

```text
http://127.0.0.1:3001/api/config -> HTTP 200
http://127.0.0.1:5173/ -> HTTP 200
OpenHarness process shape -> one server, one Vite process, one Electron main process, normal Electron helpers
```

## Routing Learning visibility

Routing Learning now surfaces the raw live ledger state in two review paths:

- A trust metric labelled `Live tool-error ledger` shows whether live recovery evidence is `missing_ledger`, `empty`, or `available`.
- The Tool Reliability section shows a `Live ledger status` card with persisted-row and log-derived-row counts.
- The Markdown evidence brief includes `Live tool-error ledger status`, persisted ledger existence, persisted rows, log-derived rows, and the same closeout warning when no live ledger exists.

Focused validation:

```text
npm run test:premier-model-harness -> passed
npm run test:tool-reliability -> passed
```

## No-spend closeout probe

Added `npm run check:live-tool-error-evidence` as the reusable no-spend probe for this proof lane. It queries `/api/router/learning/tool-errors?summaryOnly=true` and emits JSON with:

- `closeoutReady`
- `status`
- `totalErrorEvents`
- `persistedLedgerExists`
- `persistedEventCount`
- `logTraceEventCount`
- required closeout fields for a genuine recovery row

The probe must report `closeoutReady: true` before Phase 7 tool-error recovery evidence can be treated as complete. If it reports `missing_ledger`, `empty`, or `closeoutReady: false`, the next required action is still a real provider-approved or local runtime tool-error recovery scenario.

Probe run result:

```text
npm run check:live-tool-error-evidence -> passed
closeoutReady: false
status: missing_ledger
totalErrorEvents: 0
persistedLedgerExists: false
persistedEventCount: 0
logTraceEventCount: 0
```

Guard result:

```text
npm run test:premier-live-evidence-guard -> passed
```

## Approval-gated live recovery scenario

Added `npm run run:live-tool-error-recovery` as the repeatable command for creating the genuine closeout row when a provider-approved or local tool-capable runtime is available.

Default behavior is no-spend/no-mutation:

```text
npm run run:live-tool-error-recovery
```

Without approval, the command exits successfully with `skipped: true` and explains that `OPENHARNESS_APPROVE_LIVE_TOOL_ERROR=1` is required.

Approved run shape:

```text
OPENHARNESS_APPROVE_LIVE_TOOL_ERROR=1 \
OPENHARNESS_LIVE_TOOL_ERROR_MODEL=<configured tool-capable model> \
npm run run:live-tool-error-recovery
```

The scenario creates a temporary OpenHarness session, asks the selected model to intentionally fail `read_file` for `./__openharness_missing_tool_error_probe__.txt`, then recover with `list_directory` for `.`. It reports before/after ledger status, observed tool calls, failed tool, later working tool, session id, run id, and `closeoutReady`.

Only an approved run that returns `closeoutReady: true`, followed by `npm run check:live-tool-error-evidence` returning `closeoutReady: true`, should be used to close Phase 7 tool-error recovery evidence.

Default no-approval scenario result:

```text
npm run run:live-tool-error-recovery -> passed
approved: false
skipped: true
currentStatus: missing_ledger
closeoutReady: false
```

Guard result after adding the scenario:

```text
npm run test:premier-live-evidence-guard -> passed
```

## Scenario preflight metadata

The approval-gated scenario runner now performs a no-spend preflight before any model call. The default skipped output includes:

- active model
- Auto-Router enabled state
- Auto-Router default model
- configured enabled model count
- active candidate count
- candidate examples
- explicitly requested model, if provided
- recommended model for the approved run
- current live tool-error evidence status and total event count

Use this preflight to choose `OPENHARNESS_LIVE_TOOL_ERROR_MODEL` before approving a provider-backed run. Preflight metadata does not close the evidence gap; it only prepares the approved scenario.

Latest preflight run:

```text
npm run run:live-tool-error-recovery -> passed
approved: false
skipped: true
activeModel: Auto
autoRouterEnabled: true
autoRouterDefaultModel: minimax:MiniMax-M3
configuredEnabledModelCount: 18
activeCandidateCount: 10
candidateExamples: minimax:MiniMax-M3, minimax:MiniMax-M2.7, z-ai-zhipu:glm-4.7, opencode-go:mimo-v2.5-pro, opencode-go:deepseek-v4-pro
recommendedModel: minimax:MiniMax-M3
currentEvidenceStatus: missing_ledger
currentTotalErrorEvents: 0
closeoutReady: false
```

Guard result:

```text
npm run test:premier-live-evidence-guard -> passed
```

## Provider-approved live recovery row - 2026-06-17

Approval: user confirmed all configured OpenHarness providers were fair game for live testing.

Approved command:

```text
OPENHARNESS_APPROVE_LIVE_TOOL_ERROR=1 OPENHARNESS_LIVE_TOOL_ERROR_MODEL=minimax:MiniMax-M3 npm run run:live-tool-error-recovery
```

First approved attempt used tools but did not create a ledger row because `read_file` returned structured error JSON while the transport marked the call complete. This exposed a real classification bug in tool reliability status normalization.

Fix applied:

- `server/toolReliability.ts` now treats structured `{ "error": ... }` tool outputs as tool errors even when the transport status is `complete`.
- `scripts/test-tool-reliability.ts` covers pretty-printed structured tool-error payloads.
- `scripts/run-live-tool-error-recovery-scenario.ts` now uses the same structured-error interpretation when reporting `failedTool` and `laterWorkingTool`.

Focused validation:

```text
npm run test:tool-reliability -> passed
```

Restart proof after server/runtime fix:

```text
npm start
✓ Express ready on port 3001
✓ Vite ready on port 5173
Launching Electron...
✓ Docker MCP connected — tools: 50
✓ MCP watchdog started
```

Second approved scenario result:

```text
sessionId: 962eafda-076f-4fae-8257-78b6919f8db6
runId: 58c6cd58-1e6f-49f9-860b-f9d7aaab4bc8
requestedModel: minimax:MiniMax-M3
before.status: missing_ledger
before.totalErrorEvents: 0
after.status: available
after.totalErrorEvents: 1
after.persistedEventCount: 1
failedTool: read_file
failedTool.error: { "error": "Invalid path" }
laterWorkingTool: list_directory
closeoutReady: true
```

Independent evidence probe:

```text
npm run check:live-tool-error-evidence -> passed
closeoutReady: true
status: available
totalErrorEvents: 1
persistedLedgerExists: true
persistedEventCount: 1
logTraceEventCount: 0
```

Ledger row proof:

```text
evidenceSource: saved_session_trace
sessionId: 962eafda-076f-4fae-8257-78b6919f8db6
runId: 58c6cd58-1e6f-49f9-860b-f9d7aaab4bc8
failedModel: minimax:MiniMax-M3
failedProviderId: minimax
failedTool: read_file
error: { "error": "Invalid path" }
runRecovered: true
finalStatus: complete
finalAnswerCaptured: true
recoveryModel: minimax:MiniMax-M3
recoveryProviderId: minimax
recoveryTool: list_directory
retryDistance: 0
```

Strict readiness result:

```text
OPENHARNESS_REQUIRE_CLOSEOUT_READY=1 npm run check:premier-closeout-readiness -> passed
closeoutReady: true
blockingChecks: []
live-tool-error-recovery-ready.status: available
live-tool-error-recovery-ready.totalErrorEvents: 1
```

Reachability after proof:

```text
http://127.0.0.1:3001/api/config -> HTTP 200
http://127.0.0.1:5173/ -> HTTP 200
```
