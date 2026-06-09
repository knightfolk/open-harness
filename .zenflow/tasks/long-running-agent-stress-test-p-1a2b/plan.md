# Implementation Plan

## Step 1: Add `persistAssistantError` helper to `server/index.ts`
- [x] Create a helper function that pushes an assistant error message to the session and saves it
<!-- chat-id: 3829c3ce-5941-405a-9276-b392e288ce30 -->
- Verifies: every failed path can persist a visible error

## Step 2: Wire `persistAssistantError` into all failure paths in `server/index.ts`
- [x] `streamModel` catch block (~line 3398)
<!-- chat-id: 6ba35ce4-c03f-4213-ad32-92ace5b55865 -->
- [x] `streamModel` API error early return (~line 3204)
<!-- chat-id: 63eacb24-97e0-4d15-9969-35a6a8bb6ffa -->
- [x] `streamModel` native adapter catch (~line 3140)
<!-- chat-id: bab618dc-2ac4-462d-a137-0c97eb1d2aa3 -->
- [x] `streamModelWithFallback` total failure path (~line 4997)
<!-- chat-id: 73cad885-0e36-4e84-a634-c7f940dd7e8d -->
- [x] Outer `/api/sessions/:id/messages` handler — orchestration catch (~line 2488) and unhandled errors
<!-- chat-id: 8b9f0415-806d-4ed2-b593-b655cd1bdf40 -->
- Verifies: R1 — sessions never end user-only after failures

## Step 3: Add fake subagent tool call guard in `server/index.ts`
- [x] Add `/^subagent-/i` check before `invokeMCPTool` in the tool round loop
<!-- chat-id: 5ff061e3-1184-46a7-b49f-29541ef87035 -->
- [x] Return rejection message to model
<!-- chat-id: 361c26b2-d295-4923-9686-1d4a22b2974d -->
- [x] Log in runTrace
<!-- chat-id: 5a21f1c1-daf4-4687-816a-a78ea8f3b538 -->
- [x] Filter `subagent-*` from advertised tool list in `gatherMCPToolsForAPI`
<!-- chat-id: e57af97c-3ebf-42c3-bd92-f3a72ed8ca18 -->
- Verifies: R2 — fake subagent calls are rejected

## Step 4: Add trust-policy denial runTrace step in tool invocation
- [x] When `checkToolActionPolicy` returns `allowed: false`, add a runTrace error step with denied tool name and reason
<!-- chat-id: 74ae6bb2-7fd1-4822-b1e3-d58ae64c3803 -->
- [x] Ensure the persisted error message (from Step 2) includes trust context
<!-- chat-id: 9e4b5351-f83c-437f-8049-fa1220d5c21b -->
- Verifies: R3 — trust denials are visible and persisted

## Step 5: Create session-store regression test
- [x] New file `scripts/test-session-persistence-regression.ts`
<!-- chat-id: 6fa01eec-9224-4436-9e4f-ea408cc724c7 -->
- [x] Scans sessions, flags latest-user-only older than threshold
- [x] Run with `tsx scripts/test-session-persistence-regression.ts`
- Verifies: R4

## Step 6: Create SSE progress regression test
- [x] New file `scripts/test-sse-progress-regression.ts`
<!-- chat-id: 57412c27-f126-40b6-a17b-11386b88fc44 -->
- [x] Validates SSE event ordering (progress before text)
- [x] Supports mock mode without running provider
- [x] Run with `tsx scripts/test-sse-progress-regression.ts`
- Verifies: R5

## Step 7: Run lint, build, and existing test suite
- [x] `npm run lint`
<!-- chat-id: 4ecb2804-dc3c-436e-82b8-6704f2039a6c -->
- [x] `npm run build`
<!-- chat-id: f8553a9b-a4af-4a20-a733-2187a967ef6c -->
- [x] `npm run test:hardening`
<!-- chat-id: ba959141-afa2-4260-ba99-8f922e0108ad -->
- Verifies: no regressions
