# CMDui Harness Work Roadmap

Purpose: turn CMDui from a model chat interface into a local coding harness control plane that can inspect, plan, execute, verify, compare models, and explain what happened.

Use this document for work assignment, issue creation, milestone planning, and progress tracking.


## Correctness Review — 2026-05-31

This revision reconciles the roadmap with the current repo state after the Phase 1–8 implementation push.

### Confirmed complete from code inspection

- Milestones 1–3 and 7 are reflected by dedicated modules, API wiring, UI state, and persistence code.
- Milestone 4 is mostly implemented: real terminal sessions, git status/diff/stage/unstage/commit routes, diff actions, browser screenshots, browser health checks, and screenshot-to-chat actions exist.
- Milestone 5 is mounted in the layout and eval reports already persist under `~/.open-harness/evals/reports`.
- Milestone 6 has trust modes, policy checks, command-risk reasons, and a visible trust-mode badge.
- Milestone 8 has the universal provider adapter shape, registry, native Anthropic/Gemini adapters, OpenAI-compatible support, and local provider discovery.

### Remaining correctness gaps before calling Phase 1–8 fully closed

- Patch proposal review is still incomplete: the type and patch-apply endpoint exist, but there is no first-class UI for file-by-file / hunk-by-hunk accept-reject plus post-apply validation.
- Eval scoring does not yet record validation pass/fail as a first-class score dimension.
- The status bar component shows enabled tool count and `App.tsx` now passes the count (resolved in Phase 9).
- Existing MiniMax compatibility should be verified with a credential-backed live smoke test before marking the provider acceptance item complete.

## External Baselines Reviewed

These roadmap additions are based on current coding-agent patterns from:

- [OpenAI Codex CLI approval modes and sandboxed execution](https://help.openai.com/en/articles/11096431)
- [Claude Code subagents, background work, permissions, hooks, memory, and worktree isolation](https://code.claude.com/docs/en/sub-agents)
- [Claude Code hooks](https://code.claude.com/docs/en/hooks)
- [Aider repository map](https://aider.chat/docs/repomap.html)
- [Aider linting and testing workflow](https://aider.chat/docs/usage/lint-test.html)
- [SWE-bench leaderboards and resolved/cost/step comparison signals](https://www.swebench.com/)

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
- [x] Update `/Users/kevink/Projects/CMDui/src/components/DiffViewer.tsx`
- [x] Show changed files
- [x] Show inline diff
- [x] Add “review this diff”
- [x] Add “explain this change”

### P2 — Real browser preview panel

- [x] Update `/Users/kevink/Projects/CMDui/src/components/BrowserPanel.tsx`
- [x] Create `/Users/kevink/Projects/CMDui/server/browserPreview.ts`
- [x] Load local dev URL
- [x] Show screenshot
- [x] Show console errors
- [x] Add “ask model about this screenshot”
- [x] Add “run smoke check”

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

- [x] User can run commands from the UI.
- [x] User can see actual git diff.
- [ ] User can review model-proposed patches before applying.
- [x] Browser panel is no longer a placeholder.
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
- [x] Update `/Users/kevink/Projects/CMDui/src/components/layout/PanelContent.tsx`

### P1 — Add eval server module

- [x] Create `/Users/kevink/Projects/CMDui/server/evals.ts`
- [x] Move test harness logic out of `/Users/kevink/Projects/CMDui/server/index.ts`
- [x] Add prompt suite CRUD
- [x] Add model matrix runs
- [x] Add run status endpoint
- [x] Save reports under `~/.open-harness/evals`

### P1 — Add built-in prompt suites

- [x] Review this project
- [x] What changed?
- [x] Fix failing build
- [x] Summarize README
- [x] Inspect package.json
- [x] Debug empty response
- [x] Compare route decisions

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
- [x] Add clear error messages

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
- [x] Show enabled tool count in the badge component; pass the actual count from `App.tsx`
- [x] Show active workspace

## Acceptance Criteria

- [x] Read-only mode exposes no write/terminal tools.
- [x] Workspace-write mode cannot write outside project.
- [x] Dangerous shell commands are blocked or require confirmation.
- [x] Status bar clearly shows current trust mode.
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

- [~] Existing MiniMax path still works — needs credential-backed live smoke test.
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

- [x] Add suggested actions below assistant responses
- [x] Actions derived from run trace and project profile
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

- [x] Add answer quality badge
- [x] Base it on observable signals, not model self-confidence
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

- [x] Add response action: ask reviewer model
- [x] Add response action: ask planner model
- [x] Add response action: ask cheaper model
- [x] Add response action: ask stronger model
- [x] Store comparison as artifact

### P2 — Prompt microscope

- [x] Show system prompt
- [x] Show model request with keys redacted
- [x] Show context messages
- [x] Show context trimming decisions
- [x] Show raw provider errors
- [x] Link from run trace

### P2 — Artifact drawer

- [x] Extract plans
- [x] Extract diffs
- [x] Extract commands
- [x] Extract reports
- [x] Extract generated files
- [x] Extract eval summaries

## Acceptance Criteria

- [x] Assistant responses have useful next actions.
- [x] User can inspect why a model answered a certain way.
- [x] User can compare another model from an existing answer.
- [x] Important outputs are not buried in chat.


---

# Milestone 10 — Agent Bench and Regression Arena

## Goal

Make CMDui's harness measurable against real coding-agent tasks, not only ad hoc prompt tests.

This is the bridge from “model comparison UI” to “repeatable agent benchmark runner.” It should support local golden tasks, repo-grounded regression tasks, and later SWE-bench-style task imports.

## Work Items

### P0 — Define a durable harness task format

- [x] Create `server/harnessTasks.ts`
- [x] Define `HarnessTask` with prompt, repo path, setup commands, allowed trust mode, verification commands, expected changed files, expected no-touch files, scoring rubric, timeout, and tags
- [x] Store task suites under `~/.open-harness/tasks`
- [x] Add import/export for JSON task suites
- [x] Add task fixtures for this repo: review repo, explain diff, fix lint error, update doc, run browser smoke check

Suggested type:

```ts
interface HarnessTask {
  id: string;
  name: string;
  prompt: string;
  workingDir: string;
  setupCommands: string[];
  verificationCommands: string[];
  expectedChangedFiles?: string[];
  forbiddenChangedFiles?: string[];
  trustMode: 'read-only' | 'ask-before-write' | 'workspace-write';
  timeoutMs: number;
  rubric: Array<{ id: string; points: number; description: string }>;
  tags: string[];
}
```

### P0 — Add deterministic validation scoring

- [x] Record command exit code, duration, stdout/stderr preview, and retry count for every validation command
- [x] Add pass/fail validation score to `EvalScores`
- [ ] Weight “tests passed” above language-model style heuristics
- [x] Show failed validation as a first-class run failure, not only a low score

### P1 — Add replayable benchmark runs

- [x] Create `HarnessBenchRun` records under `~/.open-harness/bench-runs`
- [x] Save prompt, project profile, run trace, tool calls, diffs, validation output, model/provider settings, cost estimate, and final answer
- [ ] Add “Replay run” from saved trace
- [ ] Add “Compare against previous run” for regression testing

### P1 — Add SWE-bench-style adapter hooks

- [x] Support task setup from issue text, base commit, patch/diff, and verification command
- [x] Report resolved/unresolved, cost, latency, step count, token count, and validation status
- [x] Export results as JSON/CSV for leaderboard-style comparison

## Acceptance Criteria

- [x] A local suite can be run repeatedly and produce comparable pass/fail results.
- [x] Validation failures are visible without reading raw logs.
- [x] A saved run contains enough data to replay or audit later.
- [x] Reports include quality, speed, cost, steps, and verification signals.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.

---

# Milestone 11 — Repo Map and Semantic Code Intelligence

## Goal

Give models a compact, accurate map of the codebase so they inspect the right files faster and avoid hallucinated architecture.

## Work Items

### P0 — Build a repository map

- [ ] Create `server/repoMap.ts`
- [ ] Index files, exports, imports, symbols, scripts, routes, components, and server endpoints
- [ ] Rank files by centrality, recent changes, imports, and prompt relevance
- [ ] Generate a token-budgeted repo map for prompts
- [ ] Show repo-map preview in Project Cortex

### P1 — Add symbol and dependency search

- [ ] Add symbol search endpoint
- [ ] Add “where is this defined?” UI action
- [ ] Add reverse dependency lookup
- [ ] Add change-impact summary for changed files

### P1 — Add context pack builder

- [ ] Build named context packs for bugfix, feature, review, docs, and UI-smoke tasks
- [ ] Show exactly which files and symbols were inserted into prompt context
- [ ] Record context pack in run trace

## Acceptance Criteria

- [ ] “Review this repo” starts with a useful repo map before reading large files.
- [ ] The prompt builder can explain why each file was included.
- [ ] Symbol lookup works for TypeScript server and React UI files.
- [ ] Run traces include repo-map/context-pack decisions.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.

---

# Milestone 12 — Sandboxed Worktrees, Checkpoints, and Rollback

## Goal

Let agents work aggressively without risking the user's current working tree.

## Work Items

### P0 — Add checkpoint snapshots

- [ ] Create `server/checkpoints.ts`
- [ ] Save pre-run git status, current branch, HEAD, dirty diff, and untracked-file list
- [ ] Add checkpoint restore for tracked-file changes
- [ ] Warn when untracked files cannot be safely restored

### P0 — Add isolated worktree execution

- [ ] Create temporary git worktrees for high-risk or benchmark runs
- [ ] Run implementation and validation inside the worktree
- [ ] Show “promote changes back to main workspace” action
- [ ] Auto-clean worktrees with no changes

### P1 — Add protected-path and secret safeguards

- [ ] Protect `.env`, key files, credentials, build artifacts, and configured no-touch paths
- [ ] Add secret scanning before patch apply, commit, or report export
- [ ] Add redacted artifact export

### P1 — Add process ledger

- [ ] Track app/server processes launched by CMDui
- [ ] Kill or reuse owned processes before relaunching
- [ ] Store logs per process and link them from run traces

## Acceptance Criteria

- [ ] A failed code run can be rolled back from the UI.
- [ ] High-risk tasks can run in an isolated worktree.
- [ ] Dirty user work is never silently overwritten.
- [ ] Runtime processes have visible ownership, logs, and cleanup controls.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.

---

# Milestone 13 — Multi-Agent Team Runtime

## Goal

Move from a single orchestrated loop to visible, specialized agents that can run in parallel, share artifacts, and hand off work.

## Work Items

### P0 — Define agent profiles

- [ ] Create `server/agentProfiles.ts`
- [ ] Define profile name, purpose, model, tools, trust mode, max turns, memory scope, and output contract
- [ ] Add built-in profiles: explorer, planner, implementer, reviewer, debugger, browser-tester, eval-judge
- [ ] Add UI for enabling/disabling profiles per project

### P1 — Add background task queue

- [ ] Run read-only research agents in parallel
- [ ] Stream each agent timeline separately
- [ ] Support cancel, pause, resume, and promote-to-main
- [ ] Merge agent findings into an artifact instead of dumping raw logs into chat

### P1 — Add handoff contracts

- [ ] Planner emits implementation checklist
- [ ] Implementer emits patch summary
- [ ] Reviewer emits actionable findings with severity
- [ ] Browser-tester emits screenshot, console, network, and smoke-check result
- [ ] Judge emits pass/fail with rubric evidence

## Acceptance Criteria

- [ ] The UI can show multiple concurrent agents with independent traces.
- [ ] Read-only research does not pollute the main context.
- [ ] Handoffs are structured and reusable by later agents.
- [ ] User can cancel or inspect any agent run.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.

---

# Milestone 14 — Deep Browser and UI Verification

## Goal

Make browser verification a real product capability: DOM, accessibility, console, network, screenshots, and scripted user journeys.

## Work Items

### P0 — Upgrade browser capture artifacts

- [ ] Capture DOM snapshot, page title, URL, viewport size, console logs, failed requests, and accessibility tree
- [ ] Store browser artifacts with the run trace
- [ ] Add screenshot compare against previous capture
- [ ] Add visual-diff threshold and manual approval override

### P1 — Add scripted smoke checks

- [ ] Define `BrowserSmokeCheck` with URL, steps, assertions, timeout, and screenshot points
- [ ] Add built-in smoke checks for CMDui: open app, open folder, send prompt, inspect diff, run terminal command, open Model Lab
- [ ] Show smoke-check pass/fail in eval and run reports

### P1 — Add model-assisted UI triage

- [ ] Feed screenshot plus DOM/a11y facts into reviewer model
- [ ] Distinguish visual issue, accessibility issue, console error, and broken flow
- [ ] Create actionable follow-up tasks from findings

## Acceptance Criteria

- [ ] Browser smoke checks run from the UI and from eval suites.
- [ ] Console/network failures are linked to screenshots and traces.
- [ ] Visual regressions can be compared against a baseline.
- [ ] UI findings can become model tasks without copy-paste.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.

---

# Milestone 15 — Patch Review, Inline Comments, and Release Workflow

## Goal

Turn model changes into a controlled review flow: propose, inspect, accept, validate, commit, and optionally open a PR.

## Work Items

### P0 — Finish patch proposal UI

- [ ] Parse model patches into file and hunk proposals
- [ ] Show proposed changes file-by-file
- [ ] Allow accept/reject per file and per hunk
- [ ] Support “apply all safe changes” and “discard all”
- [ ] Run configured validation after applying

### P1 — Add inline review comments

- [ ] Let reviewer agents attach comments to exact files/lines
- [ ] Show severity, rationale, and suggested fix
- [ ] Track resolved/unresolved state
- [ ] Convert selected comments into follow-up tasks

### P1 — Add commit and PR assistant

- [ ] Generate commit message from run trace and diff
- [ ] Require validation gate before commit unless user overrides
- [ ] Add optional branch creation
- [ ] Add optional GitHub PR creation when GitHub is configured
- [ ] Attach run report to PR body

## Acceptance Criteria

- [ ] Model-generated edits can be reviewed before touching disk.
- [ ] Validation runs automatically after patch application.
- [ ] Review findings are line-specific and resolvable.
- [ ] User can go from accepted patch to commit/PR without leaving CMDui.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.

---

# Milestone 16 — Context, Prompt, and Memory Governance

## Goal

Make context engineering transparent and editable so users can understand and control what the harness tells models.

## Work Items

### P0 — Finish prompt microscope

- [x] Show system prompt, project instructions, model request, context files, tool schemas, memory, and route decision
- [ ] Redact secrets while preserving debuggability
- [ ] Show token estimate per prompt section
- [ ] Link every prompt section back to its source artifact

### P1 — Add context budget controls

- [ ] Let user set budget by mode and provider
- [ ] Show what was omitted due to budget
- [ ] Add “include this file next time” and “never include this path” controls
- [ ] Track compression/summarization decisions over time

### P1 — Add memory governance UI

- [ ] View project memory in the app
- [ ] Edit, pin, archive, and delete memory entries
- [ ] Show which memories were injected into each run
- [ ] Export/delete all local memory for a project

## Acceptance Criteria

- [ ] User can inspect exactly what was sent to the model.
- [ ] Prompt sections are explainable and source-linked.
- [ ] Memory use is visible, editable, and removable.
- [ ] Context trimming decisions are no longer opaque.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.

---

# Milestone 17 — Provider Quality, Cost, and Reliability Operations

## Goal

Make provider/model selection evidence-based, resilient, and cost-aware.

## Work Items

### P0 — Add provider health probes

- [ ] Test chat, streaming, tool calls, JSON mode, image input, context length, and error handling per provider
- [ ] Show stale/failed provider state in settings and status bar
- [ ] Save provider health history

### P1 — Add cost and token ledger

- [ ] Record input tokens, output tokens, cache reads/writes when available, estimated cost, and latency per run
- [ ] Show cost by session, project, provider, model, and task suite
- [ ] Add budget warning thresholds

### P1 — Add routing policies

- [ ] Route by task class, context need, trust mode, tool-call reliability, budget, and recent health
- [ ] Add fallback policy when a provider fails or streams malformed tool calls
- [ ] Let eval/bench results update model recommendations with user approval

## Acceptance Criteria

- [ ] Provider settings show live capability and health results.
- [ ] Run traces include token/cost/latency details when available.
- [ ] Routing decisions cite evidence, not only heuristics.
- [ ] Failed providers fall back cleanly without losing the run trace.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.

---

# Recommended Assignment Order

This section now tracks the active post-Phase-8 backlog. Older assignments for Milestones 1–8 are represented by the milestone checklists above.

## Assignment 1 — Close Phase 4 Patch Proposal Gap

Owner: TBD  
Priority: P0  
Files:

- `/Users/kevink/Projects/CMDui/server/patchApply.ts`
- `/Users/kevink/Projects/CMDui/server/index.ts`
- `/Users/kevink/Projects/CMDui/src/types/index.ts`
- `/Users/kevink/Projects/CMDui/src/utils/api.ts`
- `/Users/kevink/Projects/CMDui/src/components/DiffViewer.tsx`
- New patch review component if needed

Definition of done:

- [ ] Model-proposed patches render file-by-file and hunk-by-hunk.
- [ ] User can accept/reject individual files and hunks.
- [ ] Applying a patch triggers configured validation.
- [ ] Run trace links proposal, apply result, and validation result.
- [ ] Lint/build pass.

## Assignment 2 — Close Phase 5/6/8 Correctness Gaps

Owner: TBD  
Priority: P0  
Files:

- `/Users/kevink/Projects/CMDui/server/evals.ts`
- `/Users/kevink/Projects/CMDui/server/toolPolicy.ts`
- `/Users/kevink/Projects/CMDui/src/App.tsx`
- `/Users/kevink/Projects/CMDui/src/components/StatusBar.tsx`
- `/Users/kevink/Projects/CMDui/server/providers/registry.ts`

Definition of done:

- [ ] Eval scores include validation pass/fail.
- [x] Status bar receives and displays the actual enabled tool count.
- [ ] MiniMax provider path passes a live smoke test.
- [ ] Provider smoke result is recorded in the roadmap or release notes.
- [ ] Lint/build pass.

## Assignment 3 — Agent Bench MVP

Owner: TBD  
Priority: P0  
Files:

- `/Users/kevink/Projects/CMDui/server/harnessTasks.ts`
- `/Users/kevink/Projects/CMDui/server/evals.ts`
- `/Users/kevink/Projects/CMDui/src/components/ModelLabPanel.tsx`
- `/Users/kevink/Projects/CMDui/src/utils/api.ts`

Definition of done:

- [ ] Local task suites can be saved and run.
- [ ] Each task has deterministic validation commands.
- [ ] Reports include resolved/unresolved, cost, steps, and validation status.
- [ ] Runs can be replayed or compared against previous runs.
- [ ] Lint/build pass.

## Assignment 4 — Checkpointed Worktree Execution

Owner: TBD  
Priority: P0  
Files:

- `/Users/kevink/Projects/CMDui/server/checkpoints.ts`
- `/Users/kevink/Projects/CMDui/server/orchestrator.ts`
- `/Users/kevink/Projects/CMDui/server/git.ts`
- `/Users/kevink/Projects/CMDui/src/components/DiffViewer.tsx`

Definition of done:

- [ ] Pre-run checkpoints are recorded.
- [ ] High-risk agent runs can happen in a temporary worktree.
- [ ] User can promote or discard worktree changes.
- [ ] Rollback path is visible and tested.
- [ ] Lint/build pass.

## Assignment 5 — Repo Map MVP

Owner: TBD  
Priority: P1  
Files:

- `/Users/kevink/Projects/CMDui/server/repoMap.ts`
- `/Users/kevink/Projects/CMDui/server/projectProfile.ts`
- `/Users/kevink/Projects/CMDui/server/promptBuilder.ts`
- `/Users/kevink/Projects/CMDui/src/components/FilesPanel.tsx`

Definition of done:

- [ ] Repo map lists important symbols and relationships.
- [ ] Prompt builder uses token-budgeted repo-map context.
- [ ] User can inspect why files were included.
- [ ] Symbol search works from UI.
- [ ] Lint/build pass.

## Assignment 6 — Browser Verification MVP

Owner: TBD  
Priority: P1  
Files:

- `/Users/kevink/Projects/CMDui/server/browserPreview.ts`
- `/Users/kevink/Projects/CMDui/src/components/BrowserPanel.tsx`
- `/Users/kevink/Projects/CMDui/server/evals.ts`

Definition of done:

- [ ] Browser artifacts include screenshot, DOM, console, network failures, and accessibility summary.
- [ ] Scripted smoke checks can run from UI and eval suites.
- [ ] Browser failures are linked to run traces.
- [ ] Lint/build pass.

## Assignment 7 — Multi-Agent Team Runtime

Owner: TBD  
Priority: P1  
Files:

- `/Users/kevink/Projects/CMDui/server/agentProfiles.ts`
- `/Users/kevink/Projects/CMDui/server/orchestrator.ts`
- `/Users/kevink/Projects/CMDui/src/components/SubAgentTracker.tsx`
- `/Users/kevink/Projects/CMDui/src/components/PlanTracker.tsx`

Definition of done:

- [ ] Built-in agent profiles exist.
- [ ] Read-only agents can run in parallel.
- [ ] Each agent has its own trace and output artifact.
- [ ] User can cancel and inspect agent work.
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
