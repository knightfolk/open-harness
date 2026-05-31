# CMDui Harness Work Roadmap

Purpose: turn CMDui from a model chat interface into a local coding harness control plane that can inspect, plan, execute, verify, compare models, and explain what happened.

Use this document for work assignment, issue creation, milestone planning, and progress tracking.

## North Star

CMDui should be the local AI workbench where models, tools, repo state, plans, diffs, tests, browser sessions, and evaluations are all first-class objects.

Not just:

> Ask an AI a question.

But:

> Open a repo, understand it, pick the right model/tool strategy, execute safely, show diffs/tests/logs, learn from outcomes, and improve routing over time.

## Tracking Legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete
- Priority:
  - `P0` Critical foundation or safety issue
  - `P1` High-impact product capability
  - `P2` Polish, scale, or advanced capability

---

# Milestone 1 — Harness Kernel and Real Activity Timeline

## Goal

Make every AI run observable, inspectable, and replayable.

The app should show what happened during a response:

1. Which role/model/provider was selected.
2. What prompt/context was built.
3. What tools were available.
4. Which tool calls ran.
5. What outputs came back.
6. Whether context was compressed.
7. Whether the final answer was produced through a fallback path.

## Why This Comes First

This creates the backbone for debugging, trust, evaluations, routing, model comparison, and safety controls.

## Work Items

### P0 — Add structured run trace model

- [x] Create `/Users/kevink/Projects/CMDui/server/runTrace.ts`
- [x] Define `HarnessRun`
- [x] Define `HarnessRunStep`
- [x] Create helpers for appending run steps safely
- [x] Add redaction helper for API keys and sensitive values

Suggested types:

```ts
interface HarnessRun {
  id: string;
  sessionId: string;
  userMessageId: string;
  role: 'coder' | 'planner' | 'reviewer' | 'summarizer' | 'worker' | 'reasoner';
  requestedModel: string;
  effectiveModel: string;
  providerId: string;
  status: 'running' | 'complete' | 'error';
  startedAt: string;
  completedAt?: string;
  context: {
    tokensUsed: number;
    budget: number;
    compressedCount: number;
    summarized: boolean;
  };
  steps: HarnessRunStep[];
}

type HarnessRunStep =
  | { type: 'route'; role: string; model: string; reason?: string }
  | { type: 'prompt_built'; promptPreview: string; toolCount: number }
  | { type: 'model_request'; round: number; model: string }
  | { type: 'tool_call'; id: string; name: string; input: unknown; outputPreview?: string; durationMs?: number }
  | { type: 'model_text'; chars: number }
  | { type: 'final_answer'; chars: number }
  | { type: 'error'; message: string };
```

### P0 — Emit run trace over SSE

- [x] Add SSE event `run_start`
- [x] Add SSE event `run_step`
- [x] Add SSE event `run_complete`
- [x] Update `/Users/kevink/Projects/CMDui/server/index.ts`
- [x] Update `/Users/kevink/Projects/CMDui/src/utils/api.ts`
- [x] Add callback types for run events

### P1 — Store run traces on assistant messages

- [x] Extend `MessageRow` in `/Users/kevink/Projects/CMDui/server/index.ts`
- [x] Extend `MessageInfo` in `/Users/kevink/Projects/CMDui/src/utils/api.ts`
- [x] Extend `Message` in `/Users/kevink/Projects/CMDui/src/types/index.ts`
- [x] Persist trace summary with assistant response

### P1 — Replace fake/partial activity with real timeline

- [x] Update `/Users/kevink/Projects/CMDui/src/App.tsx`
- [x] Update `/Users/kevink/Projects/CMDui/src/components/SubAgentTracker.tsx`
- [x] Render route, prompt, model, tool, and final-answer steps
- [x] Show durations where available
- [x] Show errors inline

## Acceptance Criteria

- [x] Sending “review this repo” shows a real activity timeline.
- [x] Tool calls are visible as timeline steps.
- [x] Final answer still streams normally.
- [x] No fake progress or fake sub-agent names are shown.
- [x] `npm run lint` passes.
- [x] `npm run build` passes.
- [x] App is relaunched and manually smoke-tested.

---

# Milestone 2 — Project Cortex

## Goal

When a user opens a folder, CMDui should automatically understand the project and use that understanding in prompts and UI.

## Work Items

### P1 — Add project profile endpoint

- [x] Create `/Users/kevink/Projects/CMDui/server/projectProfile.ts`
- [x] Add `GET /api/project/profile?path=...`
- [x] Detect git root
- [x] Detect current branch
- [x] Detect dirty files
- [x] Detect package manager
- [x] Detect languages and frameworks
- [x] Detect build/test/lint/typecheck scripts
- [x] Read root `AGENTS.md`
- [x] Read root `README.md`
- [x] Identify important files
- [x] Exclude ignored/generated folders

Suggested type:

```ts
interface ProjectProfile {
  root: string;
  name: string;
  git: {
    branch: string;
    dirty: boolean;
    changedFiles: string[];
  };
  packageManager?: 'npm' | 'pnpm' | 'yarn' | 'bun';
  languages: string[];
  frameworks: string[];
  scripts: Record<string, string>;
  validation: {
    build?: string;
    test?: string;
    lint?: string;
    typecheck?: string;
  };
  instructions: {
    agentsMd?: string;
    readme?: string;
  };
  importantFiles: string[];
}
```

### P1 — Auto-profile project on folder open

- [x] Update `/Users/kevink/Projects/CMDui/src/App.tsx`
- [x] Update `/Users/kevink/Projects/CMDui/src/utils/api.ts`
- [x] Load project profile when `workingDir` changes
- [x] Cache profile in app state
- [x] Surface project profile in welcome state

### P1 — Inject project profile into prompts

- [x] Update `/Users/kevink/Projects/CMDui/server/promptBuilder.ts`
- [x] Update `/Users/kevink/Projects/CMDui/server/index.ts`
- [x] Add compact project profile summary to system prompt
- [x] Include validation commands
- [x] Include AGENTS.md rules
- [x] Include important files

### P2 — Upgrade FilesPanel into Project Cortex panel

- [x] Update `/Users/kevink/Projects/CMDui/src/components/FilesPanel.tsx`
- [x] Show important files
- [x] Show changed files
- [x] Show validation scripts
- [x] Show TODO/FIXME count
- [x] Show repo instructions
- [x] Keep basic file browsing

## Acceptance Criteria

- [x] Opening `/Users/kevink/Projects/CMDui` shows project profile data.
- [x] Chat prompts reference the correct project profile.
- [x] Validation commands are discoverable.
- [x] The file panel is useful before any model response.
- [x] `npm run lint` passes.
- [x] `npm run build` passes.

---

# Milestone 3 — Real Agent Orchestration

## Goal

Replace one-size-fits-all model calls with a practical orchestration layer.

## Modes

### Direct Mode

For simple questions.

```text
User → selected role model → answer
```

### Investigate Mode

For review/debug/explain tasks.

```text
User → router
     → research pass
     → final synthesis
```

### Execute Mode

For code changes.

```text
User → planner
     → implementer
     → validation
     → reviewer
     → final report
```

### Compare Mode

For model evaluation.

```text
Prompt → model A
       → model B
       → model C
       → judge/reviewer
       → comparison
```

## Work Items

### P1 — Add router module

- [x] Create `/Users/kevink/Projects/CMDui/server/router.ts`
- [x] Replace regex-only `classifyRole()` with structured route decisions
- [x] Keep heuristic router first
- [x] Allow optional model-router later

Suggested type:

```ts
interface RouteDecision {
  mode: 'direct' | 'investigate' | 'execute' | 'compare';
  role: 'coder' | 'planner' | 'reviewer' | 'summarizer' | 'worker' | 'reasoner';
  complexity: 'simple' | 'medium' | 'deep';
  needsTools: boolean;
  needsValidation: boolean;
  suggestedModels: string[];
  reason: string;
}
```

### P1 — Add orchestrator module

- [x] Create `/Users/kevink/Projects/CMDui/server/orchestrator.ts`
- [x] Move streaming loop out of `/Users/kevink/Projects/CMDui/server/index.ts`
- [x] Support direct mode
- [x] Support investigate mode
- [x] Preserve existing SSE behavior
- [x] Emit run trace steps

### P2 — Add execute mode

- [x] Add planner pass
- [x] Add implementation pass
- [x] Add validation command pass
- [x] Add reviewer pass
- [x] Add final synthesis
- [x] Require trust mode support before write operations

### P2 — Add compare mode

- [x] Run same prompt through selected models
- [x] Collect outputs
- [x] Judge or summarize differences
- [x] Show comparison artifact

## Acceptance Criteria

- [x] Simple prompts still use one model.
- [x] Review/debug prompts use investigate mode.
- [x] Run trace shows each orchestration step.
- [x] Existing chat behavior is not regressed.
- [x] `npm run lint` passes.
- [x] `npm run build` passes.

---

# Milestone 4 — Execution Workspace

## Goal

Show real work products: terminal commands, diffs, validation results, browser previews, and proposed patches.

## Work Items

### P1 — Real terminal panel

- [x] Update `/Users/kevink/Projects/CMDui/src/components/TerminalPanel.tsx`
- [x] Create `/Users/kevink/Projects/CMDui/server/terminalSessions.ts`
- [x] Add command input
- [x] Add working directory selector
- [x] Add run history
- [x] Add cancel command
- [x] Add copy output
- [x] Add “send output to chat”

### P1 — Git and diff tracking

- [x] Create `/Users/kevink/Projects/CMDui/server/git.ts`
- [x] Add `GET /api/git/status`
- [x] Add `GET /api/git/diff`
- [x] Add `POST /api/git/stage`
- [x] Add `POST /api/git/commit`
- [ ] Update `/Users/kevink/Projects/CMDui/src/components/DiffViewer.tsx`
- [x] Show changed files
- [x] Show inline diff
- [x] Add “review this diff”
- [ ] Add “explain this change”

### P2 — Real browser preview panel

- [x] Update `/Users/kevink/Projects/CMDui/src/components/BrowserPanel.tsx`
- [x] Create `/Users/kevink/Projects/CMDui/server/browserPreview.ts`
- [x] Load local dev URL
- [x] Show screenshot
- [x] Show console errors
- [ ] Add “ask model about this screenshot”
- [ ] Add “run smoke check”

### P1 — Patch proposal flow

- [x] Define `ProposedPatch`
- [x] Add patch parser
- [ ] Show proposed changes file-by-file
- [ ] Allow accept/reject per file
- [ ] Run validation after applying

Suggested type:

```ts
interface ProposedPatch {
  file: string;
  action: 'create' | 'update' | 'delete';
  diff: string;
  explanation: string;
}
```

## Acceptance Criteria

- [ ] User can run commands from the UI.
- [ ] User can see actual git diff.
- [ ] User can review model-proposed patches before applying.
- [ ] Browser panel is no longer a placeholder.
- [x] `npm run lint` passes.
- [x] `npm run build` passes.

---

# Milestone 5 — Model Lab and Evaluation Harness

## Goal

Turn the existing test-results and prompt-test harness into a first-class product feature.

## Work Items

### P1 — Add Model Lab panel

- [x] Create `/Users/kevink/Projects/CMDui/src/components/ModelLabPanel.tsx`
- [x] Update `/Users/kevink/Projects/CMDui/src/types/layout.ts`
- [x] Update `/Users/kevink/Projects/CMDui/src/components/layout/panelRegistry.tsx`
- [ ] Update `/Users/kevink/Projects/CMDui/src/components/layout/PanelContent.tsx`

### P1 — Add eval server module

- [x] Create `/Users/kevink/Projects/CMDui/server/evals.ts`
- [x] Move test harness logic out of `/Users/kevink/Projects/CMDui/server/index.ts`
- [x] Add prompt suite CRUD
- [x] Add model matrix runs
- [x] Add run status endpoint
- [ ] Save reports under `~/.open-harness/evals`

### P1 — Add built-in prompt suites

- [x] Review this project
- [x] What changed?
- [x] Fix failing build
- [x] Summarize README
- [x] Inspect package.json
- [x] Debug empty response
- [ ] Compare route decisions

### P2 — Add scoring

- [x] Used tools
- [x] Answered user
- [x] Referenced real files
- [x] Avoided hallucinated paths
- [x] Produced final summary
- [x] Followed style rules
- [x] Latency
- [x] Cost estimate
- [x] Tool count
- [ ] Validation pass/fail

### P2 — Routing feedback loop

- [x] Compare eval results by role
- [x] Suggest role bucket assignments
- [x] Show best model per task class
- [ ] Export model recommendation report

## Acceptance Criteria

- [x] User can run model comparisons from UI.
- [x] Eval output is saved and viewable.
- [x] Reports include model quality, speed, and tool-use signals.
- [x] Eval results can inform role bucket settings.
- [x] `npm run lint` passes.
- [x] `npm run build` passes.

---

# Milestone 6 — Trust and Safety Layer

## Goal

Make local agent actions powerful but understandable and controllable.

## Work Items

### P0 — Add trust modes

- [x] Update `/Users/kevink/Projects/CMDui/server/config.ts`
- [x] Add trust mode to persisted config
- [x] Update `/Users/kevink/Projects/CMDui/src/components/SettingsModal.tsx`

Suggested type:

```ts
type TrustMode =
  | 'chat-only'
  | 'read-only'
  | 'ask-before-write'
  | 'workspace-write'
  | 'full-local';
```

### P0 — Add tool permission policy

- [x] Create `/Users/kevink/Projects/CMDui/server/toolPolicy.ts`
- [x] Filter model tools by trust mode
- [x] Block write/terminal tools in read-only mode
- [x] Restrict workspace-write mode to `workingDir`
- [x] Add policy checks to built-in tools

### P1 — Add command risk classifier

- [x] Classify safe commands
- [x] Classify risky commands
- [x] Confirm or block destructive commands
- [ ] Add clear error messages

Risky command examples:

- `rm`
- `sudo`
- `chmod`
- `chown`
- `launchctl`
- `curl | sh`
- commands writing outside workspace

### P1 — Add trust badge to status bar

- [x] Update `/Users/kevink/Projects/CMDui/src/components/StatusBar.tsx`
- [x] Show current trust mode
- [ ] Show enabled tool count
- [ ] Show active workspace

## Acceptance Criteria

- [x] Read-only mode exposes no write/terminal tools.
- [x] Workspace-write mode cannot write outside project.
- [x] Dangerous shell commands are blocked or require confirmation.
- [ ] Status bar clearly shows current trust mode.
- [x] `npm run lint` passes.
- [x] `npm run build` passes.

---

# Milestone 7 — Persistent Sessions and Project Memory

## Goal

Make CMDui durable across restarts and able to remember project-specific facts.

## Work Items

### P1 — Persist sessions to disk

- [x] Create `/Users/kevink/Projects/CMDui/server/sessionStore.ts`
- [x] Store sessions under `~/.open-harness/sessions`
- [x] Load sessions on server startup
- [x] Persist messages and run traces
- [x] Add migration support

Suggested session path:

```text
~/.open-harness/sessions/<session-id>.json
```

### P1 — Add project-scoped memory

- [x] Create `/Users/kevink/Projects/CMDui/server/projectMemory.ts`
- [x] Store project profiles by path hash
- [x] Store memory markdown per project
- [x] Load project memory on folder open
- [x] Inject compact project memory into prompts

Suggested paths:

```text
~/.open-harness/projects/<project-hash>/profile.json
~/.open-harness/projects/<project-hash>/memory.md
```

### P2 — Add “What did we learn?” action

- [x] Summarize decisions from current session
- [x] Summarize repo facts
- [x] Summarize commands that worked
- [x] Save to project memory

## Acceptance Criteria

- [x] Sessions survive server restart.
- [x] Project memory survives server restart.
- [x] Reopening a repo restores useful context.
- [x] `npm run lint` passes.
- [x] `npm run build` passes.

---

# Milestone 8 — Universal Provider Architecture

## Goal

Finish the universal provider harness architecture.

## Work Items

### P1 — Add provider adapter interface

- [x] Create `/Users/kevink/Projects/CMDui/server/providers/types.ts`
- [x] Define `ProviderAdapter`
- [x] Define `ProviderChatRequest`
- [x] Define `ProviderEvent`

Suggested event type:

```ts
type ProviderEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'thinking_delta'; text: string }
  | { type: 'tool_call_delta'; id: string; name?: string; argumentsDelta?: string }
  | { type: 'tool_call_done'; id: string; name: string; arguments: string }
  | { type: 'done' }
  | { type: 'error'; error: string };
```

### P1 — Add OpenAI-compatible adapter

- [x] Create `/Users/kevink/Projects/CMDui/server/providers/openai.ts`
- [x] Move current OpenAI-compatible streaming logic into adapter
- [x] Support MiniMax, DeepSeek, xAI, Mistral, Z.AI, OpenRouter, Ollama, LM Studio

### P1 — Add registry

- [x] Create `/Users/kevink/Projects/CMDui/server/providers/registry.ts`
- [x] Resolve provider by `{ providerId, modelId }`
- [x] Return correct adapter
- [x] Normalize model list output

### P2 — Add Anthropic adapter

- [x] Create `/Users/kevink/Projects/CMDui/server/providers/anthropic.ts`
- [x] Support Messages API
- [x] Normalize content blocks
- [x] Normalize tool calls
- [x] Add provider preset back after working

### P2 — Add Gemini adapter

- [x] Create `/Users/kevink/Projects/CMDui/server/providers/gemini.ts`
- [x] Support streaming generate content
- [x] Normalize tool calls
- [x] Add provider preset back after working

### P2 — Add local discovery

- [x] Auto-detect Ollama on port `11434`
- [x] Auto-detect LM Studio on port `1234`
- [x] Offer one-click local provider setup

## Acceptance Criteria

- [ ] Existing MiniMax path still works.
- [x] OpenAI-compatible providers use common adapter.
- [x] Anthropic works only after native adapter is implemented.
- [x] Gemini works only after native adapter is implemented.
- [x] Provider settings show accurate capability badges.
- [x] `npm run lint` passes.
- [x] `npm run build` passes.

---

# Milestone 9 — Delight Features

## Goal

Add features that make CMDui feel better than a normal agent UI.

## Work Items

### P2 — Next Best Action strip

- [ ] Add suggested actions below assistant responses
- [ ] Actions derived from run trace and project profile
- [ ] Examples:
  - Run build
  - Review diff
  - Open changed file
  - Ask follow-up
  - Create commit
  - Compare another model

Files:

- `/Users/kevink/Projects/CMDui/src/components/MessageBubble.tsx`
- `/Users/kevink/Projects/CMDui/src/App.tsx`

### P2 — Observable confidence meter

- [ ] Add answer quality badge
- [ ] Base it on observable signals, not model self-confidence
- [ ] Signals:
  - files read
  - tools used
  - validation passed
  - errors encountered
  - final answer length

Example:

```text
Answer quality: High
Grounding: 5 files read
Validation: lint passed
Risk: low
```

### P2 — Ask another model

- [ ] Add response action: ask reviewer model
- [ ] Add response action: ask planner model
- [ ] Add response action: ask cheaper model
- [ ] Add response action: ask stronger model
- [ ] Store comparison as artifact

### P2 — Prompt microscope

- [ ] Show system prompt
- [ ] Show model request with keys redacted
- [ ] Show context messages
- [ ] Show context trimming decisions
- [ ] Show raw provider errors
- [ ] Link from run trace

### P2 — Artifact drawer

- [ ] Extract plans
- [ ] Extract diffs
- [ ] Extract commands
- [ ] Extract reports
- [ ] Extract generated files
- [ ] Extract eval summaries

## Acceptance Criteria

- [ ] Assistant responses have useful next actions.
- [ ] User can inspect why a model answered a certain way.
- [ ] User can compare another model from an existing answer.
- [ ] Important outputs are not buried in chat.

---

# Recommended Assignment Order

## Assignment 1 — Harness Run Trace

Owner: TBD  
Priority: P0  
Files:

- `/Users/kevink/Projects/CMDui/server/runTrace.ts`
- `/Users/kevink/Projects/CMDui/server/index.ts`
- `/Users/kevink/Projects/CMDui/src/utils/api.ts`
- `/Users/kevink/Projects/CMDui/src/App.tsx`
- `/Users/kevink/Projects/CMDui/src/components/SubAgentTracker.tsx`

Definition of done:

- [ ] Real route/model/tool/final-answer timeline appears during chat.
- [ ] Timeline persists with assistant message.
- [ ] No fake progress indicators remain.
- [ ] Lint/build pass.
- [ ] App relaunched and smoke-tested.

## Assignment 2 — Project Cortex Endpoint

Owner: TBD  
Priority: P1  
Files:

- `/Users/kevink/Projects/CMDui/server/projectProfile.ts`
- `/Users/kevink/Projects/CMDui/server/index.ts`
- `/Users/kevink/Projects/CMDui/src/utils/api.ts`
- `/Users/kevink/Projects/CMDui/src/App.tsx`
- `/Users/kevink/Projects/CMDui/src/components/FilesPanel.tsx`
- `/Users/kevink/Projects/CMDui/src/components/SmartWelcome.tsx`

Definition of done:

- [ ] Opening a folder creates a project profile.
- [ ] Profile is visible in UI.
- [ ] Profile is injected into prompts.
- [ ] Lint/build pass.

## Assignment 3 — Trust Modes and Tool Policy

Owner: TBD  
Priority: P0  
Files:

- `/Users/kevink/Projects/CMDui/server/toolPolicy.ts`
- `/Users/kevink/Projects/CMDui/server/config.ts`
- `/Users/kevink/Projects/CMDui/server/index.ts`
- `/Users/kevink/Projects/CMDui/src/components/SettingsModal.tsx`
- `/Users/kevink/Projects/CMDui/src/components/StatusBar.tsx`

Definition of done:

- [ ] Trust mode is persisted.
- [ ] Tools are filtered by trust mode.
- [ ] Risky commands are blocked or require confirmation.
- [ ] Trust badge appears in status bar.
- [ ] Lint/build pass.

## Assignment 4 — Persistent Sessions

Owner: TBD  
Priority: P1  
Files:

- `/Users/kevink/Projects/CMDui/server/sessionStore.ts`
- `/Users/kevink/Projects/CMDui/server/index.ts`
- `/Users/kevink/Projects/CMDui/src/components/Sidebar.tsx`

Definition of done:

- [ ] Sessions survive server restart.
- [ ] Messages survive server restart.
- [ ] Run traces survive server restart.
- [ ] Lint/build pass.

## Assignment 5 — Real Diff and Terminal Workspace

Owner: TBD  
Priority: P1  
Files:

- `/Users/kevink/Projects/CMDui/server/git.ts`
- `/Users/kevink/Projects/CMDui/server/terminalSessions.ts`
- `/Users/kevink/Projects/CMDui/server/index.ts`
- `/Users/kevink/Projects/CMDui/src/components/DiffViewer.tsx`
- `/Users/kevink/Projects/CMDui/src/components/TerminalPanel.tsx`
- `/Users/kevink/Projects/CMDui/src/utils/api.ts`

Definition of done:

- [ ] UI shows real git diff.
- [ ] UI can run and cancel commands.
- [ ] User can stage selected files.
- [ ] User can ask model to review current diff.
- [ ] Lint/build pass.

## Assignment 6 — Model Lab

Owner: TBD  
Priority: P1  
Files:

- `/Users/kevink/Projects/CMDui/server/evals.ts`
- `/Users/kevink/Projects/CMDui/scripts/test-prompts.mjs`
- `/Users/kevink/Projects/CMDui/src/components/ModelLabPanel.tsx`
- `/Users/kevink/Projects/CMDui/src/components/layout/panelRegistry.tsx`
- `/Users/kevink/Projects/CMDui/src/types/layout.ts`

Definition of done:

- [ ] User can run prompt suites from UI.
- [ ] User can compare models.
- [ ] Results are saved.
- [ ] Reports show quality and speed signals.
- [ ] Lint/build pass.

---

# Global Verification Checklist

Every implementation assignment should end with:

- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Kill existing app/server processes if code affects runtime.
- [ ] Relaunch app with `npm start`.
- [ ] Verify server is reachable at `http://127.0.0.1:3001`.
- [ ] Verify UI is reachable at `http://127.0.0.1:5173`.
- [ ] Smoke-test at least one real prompt.
- [ ] Confirm no unrelated files were modified.

---

# Open Decisions

- [ ] Should session storage use one JSON file per session or a small SQLite database?
- [ ] Should write operations be model-generated patch proposals only, or direct write tools under trust mode?
- [ ] Should browser automation be built into CMDui or delegated through MCP only?
- [ ] Should eval scoring use deterministic heuristics first or model-based judging first?
- [ ] Should provider/model IDs be migrated fully to `providerId:modelId`?
- [ ] Should project memory be editable by the user in UI?

---

# Product Principle

Every feature should make at least one of these things more visible:

1. What the model knew.
2. What the model did.
3. What changed on disk.
4. What was verified.
5. What remains risky.

If a feature cannot improve one of those, defer it.
