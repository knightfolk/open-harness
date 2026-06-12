# OpenHarness Harness Work Roadmap

Purpose: turn OpenHarness from a model chat interface into a local coding harness control plane that can inspect, plan, execute, verify, compare models, and explain what happened.

Use this document for work assignment, issue creation, milestone planning, and progress tracking.

## Current Top Priority - Prompt, Routing, and Output

Use `docs/PROMPT_ROUTING_OUTPUT_ROADMAP.md` as the current implementation roadmap for refining prompt processing, routing decisions, Planning Room model-team output, single-model responses, eval feedback, and native-app presentation.

## Source of Truth — Planning Room First

OpenHarness's next product center is **Planning Room + Project Companion**:

- Planning Room is the primary killer feature: for planning, roadmap, strategy, design, and architecture requests, multiple selected models draft independently, read each other's output, cross-check disagreements, and synthesize one final team plan.
- Planning Room is read-only by design. It produces a source-of-truth plan before code execution, which keeps risk and cost controlled.
- Project Companion is the follow-on cheap/local assistant. It should answer quick project questions from plans, run traces, repo maps, and summaries so users do not need to spend expensive main-model tokens for single-line questions.

This direction supersedes older single-agent planning language. Future orchestration work should preserve the dedicated `plan` mode and build execution, review, and companion workflows around the Planning Room artifact.

## Correctness Review — 2026-06-01

This revision reconciles the roadmap with the current repo state after the Phase 1–12 implementation push, the Assignment 0 onboarding/MCP work, the native-adapter follow-up, and the final documentation reconciliation on 2026-06-01.

### Confirmed complete from code inspection

- Milestones 1–3 and 7 are reflected by dedicated modules, API wiring, UI state, and persistence code.
- Milestone 4 is mostly implemented: real terminal sessions, git status/diff/stage/unstage/commit routes, diff actions, browser screenshots, browser health checks, and screenshot-to-chat actions exist.
- Milestone 5 is mounted in the layout and eval reports already persist under `~/.openharness/evals/reports`; deterministic validation score plumbing, weighted score breakdowns, weakest-signal callouts, and bench previous-run deltas exist. Saved-run replay and broader report export polish remain open.
- Milestone 6 has trust modes, policy checks, command-risk reasons, and a visible trust-mode badge.
- Milestone 8 has the universal provider adapter shape, registry, native Anthropic/Gemini adapters, OpenAI-compatible support, and local provider discovery.
- Milestone 10 has task-suite, benchmark-run, validation-result, export, and reporting support in code, but saved-run replay and previous-run comparison remain open.
- Milestone 11 is materially implemented: `server/repoMap.ts` exists, repo maps are injected into prompts, run traces include repo-map/context-pack steps, and `FilesPanel.tsx` shows a Project Cortex repo-map preview.
- Milestone 12 is partially implemented: `server/checkpoints.ts`, checkpoint APIs, process-ledger APIs, and `SafetyPanel.tsx` exist. Isolated git worktrees and promotion/discard UX are still open.
- Milestone 15 is more advanced than the old roadmap stated: `server/patchProposals.ts`, proposal APIs, `PatchReviewPanel.tsx`, and client API/types exist for file/hunk review and post-apply validation. Remaining work is integration polish, inline comments, and release workflow.
- Current onboarding in `src/components/OnboardingWizard.tsx` now supports multi-provider setup, local-provider detection, default agent personality, trust mode, Docker readiness, and a final review page. Remaining onboarding work is optimization preference selection, role override before finish, partial-setup resume, and sharper failure recovery copy.

### Remaining correctness gaps before calling Phase 1–8 fully closed

- Patch proposal review now has server and UI foundations, but the workflow still needs smoother proposal creation from chat, clearer empty states, run-trace links, and visual verification of hunk toggles.
- Eval scoring now has weighted structural/runtime/style breakdowns and Model Lab UI support. Remaining eval work is saved-run replay, export/report polish, and making token/cost estimates real instead of placeholders.
- Existing MiniMax compatibility should be verified with a credential-backed live smoke test before marking the provider acceptance item complete.
- Docker MCP auto-start, readiness checks, Settings lifecycle controls, and curated MCP suggestions exist. Remaining MCP work is profile creation/validation depth, gateway-death recovery, PID/log tail surfacing, smoke-test actions, and clearer install failure text.
- Provider/model IDs still need a decision on fully migrating to `providerId:modelId` to avoid collisions across providers.

## External Baselines Reviewed

These roadmap additions are based on current coding-agent patterns from:

- [OpenAI Codex CLI approval modes and sandboxed execution](https://help.openai.com/en/articles/11096431)
- [Claude Code subagents, background work, permissions, hooks, memory, and worktree isolation](https://code.claude.com/docs/en/sub-agents)
- [Claude Code hooks](https://code.claude.com/docs/en/hooks)
- [Aider repository map](https://aider.chat/docs/repomap.html)
- [Aider linting and testing workflow](https://aider.chat/docs/usage/lint-test.html)
- [SWE-bench leaderboards and resolved/cost/step comparison signals](https://www.swebench.com/)
- [Model Context Protocol overview](https://modelcontextprotocol.io/docs/getting-started/intro)
- [Official MCP Registry](https://registry.modelcontextprotocol.io/)
- [MCP reference servers](https://github.com/modelcontextprotocol/servers)
- [Docker MCP Catalog and Toolkit](https://docs.docker.com/ai/mcp-catalog-and-toolkit/)

## North Star

OpenHarness should be the local AI workbench where models, tools, repo state, plans, diffs, tests, browser sessions, and evaluations are all first-class objects.

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

- [x] Create `/Users/kevink/Projects/OpenHarness/server/runTrace.ts`
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
- [x] Update `/Users/kevink/Projects/OpenHarness/server/index.ts`
- [x] Update `/Users/kevink/Projects/OpenHarness/src/utils/api.ts`
- [x] Add callback types for run events

### P1 — Store run traces on assistant messages

- [x] Extend `MessageRow` in `/Users/kevink/Projects/OpenHarness/server/index.ts`
- [x] Extend `MessageInfo` in `/Users/kevink/Projects/OpenHarness/src/utils/api.ts`
- [x] Extend `Message` in `/Users/kevink/Projects/OpenHarness/src/types/index.ts`
- [x] Persist trace summary with assistant response

### P1 — Replace fake/partial activity with real timeline

- [x] Update `/Users/kevink/Projects/OpenHarness/src/App.tsx`
- [x] Update `/Users/kevink/Projects/OpenHarness/src/components/SubAgentTracker.tsx`
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

When a user opens a folder, OpenHarness should automatically understand the project and use that understanding in prompts and UI.

## Work Items

### P1 — Add project profile endpoint

- [x] Create `/Users/kevink/Projects/OpenHarness/server/projectProfile.ts`
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

- [x] Update `/Users/kevink/Projects/OpenHarness/src/App.tsx`
- [x] Update `/Users/kevink/Projects/OpenHarness/src/utils/api.ts`
- [x] Load project profile when `workingDir` changes
- [x] Cache profile in app state
- [x] Surface project profile in welcome state

### P1 — Inject project profile into prompts

- [x] Update `/Users/kevink/Projects/OpenHarness/server/promptBuilder.ts`
- [x] Update `/Users/kevink/Projects/OpenHarness/server/index.ts`
- [x] Add compact project profile summary to system prompt
- [x] Include validation commands
- [x] Include AGENTS.md rules
- [x] Include important files

### P2 — Upgrade FilesPanel into Project Cortex panel

- [x] Update `/Users/kevink/Projects/OpenHarness/src/components/FilesPanel.tsx`
- [x] Show important files
- [x] Show changed files
- [x] Show validation scripts
- [x] Show TODO/FIXME count
- [x] Show repo instructions
- [x] Keep basic file browsing

## Acceptance Criteria

- [x] Opening `/Users/kevink/Projects/OpenHarness` shows project profile data.
- [x] Chat prompts reference the correct project profile.
- [x] Validation commands are discoverable.
- [x] The file panel is useful before any model response.
- [x] `npm run lint` passes.
- [x] `npm run build` passes.

---

# Milestone 3 — Real Agent Orchestration

## Goal

Replace one-size-fits-all model calls with a practical orchestration layer.

## UX Note

Orchestrated runs should be visible in the main chat, not only in the sub-agent side panel. The chat stream now renders transient team-room bubbles for router decisions, orchestration phases, model requests, model output summaries, and tool work while the final answer is being prepared. These bubbles are live progress UI and are intentionally not persisted into the saved transcript.

## Modes

### Direct Mode

For simple questions.

```text
User → selected role model → answer
```

### Planning Room Mode

For planning, roadmap, strategy, design, and architecture requests.

```text
User → planner model A
     → planner model B
     → planner model C
     → peer cross-checks
     → final synthesis
     → source-of-truth team plan
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

- [x] Create `/Users/kevink/Projects/OpenHarness/server/router.ts`
- [x] Replace regex-only `classifyRole()` with structured route decisions
- [x] Keep heuristic router first
- [x] Allow optional model-router later

Suggested type:

```ts
interface RouteDecision {
  mode: 'direct' | 'plan' | 'investigate' | 'execute' | 'compare';
  role: 'coder' | 'planner' | 'reviewer' | 'summarizer' | 'worker' | 'reasoner';
  complexity: 'simple' | 'medium' | 'deep';
  needsTools: boolean;
  needsValidation: boolean;
  suggestedModels: string[];
  reason: string;
}
```

### P1 — Add orchestrator module

- [x] Create `/Users/kevink/Projects/OpenHarness/server/orchestrator.ts`
- [x] Move streaming loop out of `/Users/kevink/Projects/OpenHarness/server/index.ts`
- [x] Support direct mode
- [x] Support Planning Room mode
- [x] Support investigate mode
- [x] Preserve existing SSE behavior
- [x] Emit run trace steps

### P1 — Add Planning Room mode

- [x] Route planning/roadmap/design/strategy requests to `mode: 'plan'`
- [x] Run up to 3 configured participant models in parallel for independent plans
- [x] Have participants read peer output and cross-check disagreements, missing steps, and risks
- [x] Synthesize one final team plan as the source-of-truth artifact
- [x] Keep planning mode read-only; execution remains a separate mode

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
- [x] Planning prompts use Planning Room.
- [x] Review/debug prompts use investigate mode.
- [x] Run trace shows each orchestration step.
- [x] Main chat shows live orchestration/team-room progress while waiting.
- [x] Existing chat behavior is not regressed.
- [x] `npm run lint` passes.
- [x] `npm run build` passes.

---

# Milestone 4 — Execution Workspace

## Goal

Show real work products: terminal commands, diffs, validation results, browser previews, and proposed patches.

## Work Items

### P1 — Real terminal panel

- [x] Update `/Users/kevink/Projects/OpenHarness/src/components/TerminalPanel.tsx`
- [x] Create `/Users/kevink/Projects/OpenHarness/server/terminalSessions.ts`
- [x] Add command input
- [x] Add working directory selector
- [x] Add run history
- [x] Add cancel command
- [x] Add copy output
- [x] Add “send output to chat”

### P1 — Git and diff tracking

- [x] Create `/Users/kevink/Projects/OpenHarness/server/git.ts`
- [x] Add `GET /api/git/status`
- [x] Add `GET /api/git/diff`
- [x] Add `POST /api/git/stage`
- [x] Add `POST /api/git/commit`
- [x] Update `/Users/kevink/Projects/OpenHarness/src/components/DiffViewer.tsx`
- [x] Show changed files
- [x] Show inline diff
- [x] Add “review this diff”
- [x] Add “explain this change”

### P2 — Real browser preview panel

- [x] Update `/Users/kevink/Projects/OpenHarness/src/components/BrowserPanel.tsx`
- [x] Create `/Users/kevink/Projects/OpenHarness/server/browserPreview.ts`
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

- [x] Create `/Users/kevink/Projects/OpenHarness/src/components/ModelLabPanel.tsx`
- [x] Update `/Users/kevink/Projects/OpenHarness/src/types/layout.ts`
- [x] Update `/Users/kevink/Projects/OpenHarness/src/components/layout/panelRegistry.tsx`
- [x] Update `/Users/kevink/Projects/OpenHarness/src/components/layout/PanelContent.tsx`

### P1 — Add eval server module

- [x] Create `/Users/kevink/Projects/OpenHarness/server/evals.ts`
- [x] Move test harness logic out of `/Users/kevink/Projects/OpenHarness/server/index.ts`
- [x] Add prompt suite CRUD
- [x] Add model matrix runs
- [x] Add run status endpoint
- [x] Save reports under `~/.openharness/evals`

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
- [x] Suggest agent role assignments
- [x] Show best model per task class
- [ ] Export model recommendation report

## Acceptance Criteria

- [x] User can run model comparisons from UI.
- [x] Eval output is saved and viewable.
- [x] Reports include model quality, speed, and tool-use signals.
- [x] Eval results can inform agent role settings.
- [x] `npm run lint` passes.
- [x] `npm run build` passes.

---

# Milestone 6 — Trust and Safety Layer

## Goal

Make local agent actions powerful but understandable and controllable.

## Work Items

### P0 — Add trust modes

- [x] Update `/Users/kevink/Projects/OpenHarness/server/config.ts`
- [x] Add trust mode to persisted config
- [x] Update `/Users/kevink/Projects/OpenHarness/src/components/SettingsModal.tsx`

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

- [x] Create `/Users/kevink/Projects/OpenHarness/server/toolPolicy.ts`
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

- [x] Update `/Users/kevink/Projects/OpenHarness/src/components/StatusBar.tsx`
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

Make OpenHarness durable across restarts and able to remember project-specific facts.

## Work Items

### P1 — Persist sessions to disk

- [x] Create `/Users/kevink/Projects/OpenHarness/server/sessionStore.ts`
- [x] Store sessions under `~/.openharness/sessions`
- [x] Load sessions on server startup
- [x] Persist messages and run traces
- [x] Add migration support

Suggested session path:

```text
~/.openharness/sessions/<session-id>.json
```

### P1 — Add project-scoped memory

- [x] Create `/Users/kevink/Projects/OpenHarness/server/projectMemory.ts`
- [x] Store project profiles by path hash
- [x] Store memory markdown per project
- [x] Load project memory on folder open
- [x] Inject compact project memory into prompts

Suggested paths:

```text
~/.openharness/projects/<project-hash>/profile.json
~/.openharness/projects/<project-hash>/memory.md
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

- [x] Create `/Users/kevink/Projects/OpenHarness/server/providers/types.ts`
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

- [x] Create `/Users/kevink/Projects/OpenHarness/server/providers/openai.ts`
- [x] Move current OpenAI-compatible streaming logic into adapter
- [x] Support MiniMax, DeepSeek, xAI, Mistral, Z.AI, OpenRouter, Ollama, LM Studio

### P1 — Add registry

- [x] Create `/Users/kevink/Projects/OpenHarness/server/providers/registry.ts`
- [x] Resolve provider by `{ providerId, modelId }`
- [x] Return correct adapter
- [x] Normalize model list output

### P2 — Add Anthropic adapter

- [x] Create `/Users/kevink/Projects/OpenHarness/server/providers/anthropic.ts`
- [x] Support Messages API
- [x] Normalize content blocks
- [x] Normalize tool calls
- [x] Add provider preset back after working

### P2 — Add Gemini adapter

- [x] Create `/Users/kevink/Projects/OpenHarness/server/providers/gemini.ts`
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

Add features that make OpenHarness feel better than a normal agent UI.

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

- `/Users/kevink/Projects/OpenHarness/src/components/MessageBubble.tsx`
- `/Users/kevink/Projects/OpenHarness/src/App.tsx`

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

Make OpenHarness's harness measurable against real coding-agent tasks, not only ad hoc prompt tests.

This is the bridge from “model comparison UI” to “repeatable agent benchmark runner.” It should support local golden tasks, repo-grounded regression tasks, and later SWE-bench-style task imports.

## Work Items

### P0 — Define a durable harness task format

- [x] Create `server/harnessTasks.ts`
- [x] Define `HarnessTask` with prompt, repo path, setup commands, allowed trust mode, verification commands, expected changed files, expected no-touch files, scoring rubric, timeout, and tags
- [x] Store task suites under `~/.openharness/tasks`
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

- [x] Create `HarnessBenchRun` records under `~/.openharness/bench-runs`
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

- [x] Create `server/repoMap.ts`
- [x] Index files, exports, imports, symbols, scripts, routes, components, and server endpoints
- [x] Rank files by centrality, recent changes, imports, and prompt relevance
- [x] Generate a token-budgeted repo map for prompts
- [x] Show repo-map preview in Project Cortex

### P1 — Add symbol and dependency search

- [x] Add symbol search endpoint
- [ ] Add “where is this defined?” UI action
- [~] Add reverse dependency lookup
- [x] Add change-impact summary for changed files

### P1 — Add context pack builder

- [x] Build named context packs for bugfix, feature, review, docs, and UI-smoke tasks
- [x] Show exactly which files and symbols were inserted into prompt context
- [x] Record context pack in run trace

## Acceptance Criteria

- [x] “Review this repo” starts with a useful repo map before reading large files.
- [x] The prompt builder can explain why each file was included.
- [~] Symbol lookup works for TypeScript server and React UI files; UI action still needed.
- [x] Run traces include repo-map/context-pack decisions.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.

---

# Milestone 12 — Sandboxed Worktrees, Checkpoints, and Rollback

## Goal

Let agents work aggressively without risking the user's current working tree.

## Work Items

### P0 — Add checkpoint snapshots

- [x] Create `server/checkpoints.ts`
- [x] Save pre-run git status, current branch, HEAD, dirty diff, and untracked-file list
- [x] Add checkpoint restore for tracked-file changes
- [x] Warn when untracked files cannot be safely restored

### P0 — Add isolated worktree execution

- [ ] Create temporary git worktrees for high-risk or benchmark runs
- [ ] Run implementation and validation inside the worktree
- [ ] Show “promote changes back to main workspace” action
- [ ] Auto-clean worktrees with no changes

### P1 — Add protected-path and secret safeguards

- [~] Protect `.env`, key files, credentials, build artifacts, and configured no-touch paths
- [ ] Add secret scanning before patch apply, commit, or report export
- [ ] Add redacted artifact export

### P1 — Add process ledger

- [x] Track app/server processes launched by OpenHarness
- [x] Kill or reuse owned processes before relaunching
- [~] Store logs per process and link them from run traces

## Acceptance Criteria

- [~] A failed code run can be rolled back from the UI with checkpoints; worktree rollback remains open.
- [ ] High-risk tasks can run in an isolated worktree.
- [ ] Dirty user work is never silently overwritten.
- [x] Runtime processes have visible ownership, logs, and cleanup controls.
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
- [ ] Add built-in smoke checks for OpenHarness: open app, open folder, send prompt, inspect diff, run terminal command, open Model Lab
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

- [x] Parse model patches into file and hunk proposals
- [x] Show proposed changes file-by-file
- [x] Allow accept/reject per hunk
- [~] Allow accept/reject per file
- [x] Support “apply all safe changes” and “discard all”
- [x] Run configured validation after applying
- [ ] Link chat-created proposals, run traces, apply results, and validation output in one obvious workflow
- [ ] Add manual UI smoke checks for hunk toggles, empty proposals, rejected-all proposals, failed apply, and failed validation

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

- [x] Model-generated edits can be reviewed before touching disk.
- [x] Validation runs automatically after patch application.
- [ ] Review findings are line-specific and resolvable.
- [ ] User can go from accepted patch to commit/PR without leaving OpenHarness.
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

# Milestone 18 — Guided Onboarding and Default Agent Setup

## Goal

Make first launch feel like a guided setup assistant instead of a settings scavenger hunt. A new user should be able to select every provider they already have, paste all needed keys once, choose a default agent style, pick sane model-role defaults, and open their first project without understanding provider plumbing.

## Current Code State

- `src/components/OnboardingWizard.tsx` exists and now configures multiple selected providers in one pass.
- `src/components/SettingsModal.tsx` already has provider presets, agent roles, and personality presets that onboarding can reuse.
- `server/config.ts` persists providers, `activeModel`, `roleAssignments`, `personality`, theme, trust mode, and MCP server settings.
- `src/App.tsx` shows onboarding only when no provider has a key, but the final folder path from onboarding is not currently opened as a session.

## Work Items

### P0 — Multi-provider setup flow

- [x] Replace single-provider selection with “check all providers you have” cards.
- [x] Next step renders one compact credential form per selected provider.
- [x] Support local no-key providers separately: Ollama and LM Studio should be auto-detected and optionally enabled.
- [x] Add “test all” and “save all working providers” actions.
- [x] Fetch model lists for all saved providers and summarize failures without blocking successful providers.
- [x] Preserve secrets only through existing server config paths; never echo full keys back to the client.

### P0 — Default agent and role setup

- [x] Ask the user how the default agent should behave: business-only, concise, chatty, helpful/teacher, creative, or custom.
- [x] Write the selected personality into `config.personality`.
- [ ] Ask whether OpenHarness should optimize for low cost, best quality, local/private, or balanced defaults.
- [~] Assign agent roles from enabled models: planner, coder, reviewer, reasoner, summarizer, worker.
- [ ] Let users override role assignments before finishing.

### P1 — First project and trust setup

- [x] Make the onboarding folder picker actually create/open a session with that working directory.
- [x] Ask for an initial trust mode in plain language: chat only, read only, ask before writing, workspace write.
- [~] Show a final review page: providers, active model, agent roles, personality, trust mode, MCP status, project folder.
- [~] Add “restart onboarding” and “rerun setup check” from Settings.

### P2 — Friendly recovery and migration

- [ ] Detect partial setup and resume at the right step.
- [ ] Add key-missing, model-list-empty, and provider-test-failed copy that tells users exactly what to try next.
- [ ] Migrate old one-provider setups into the new checklist flow without losing existing config.

## Acceptance Criteria

- [x] A new user can configure multiple providers in one pass.
- [x] A local-only user can choose Ollama/LM Studio without entering a key.
- [x] The selected default agent personality is used by chat immediately.
- [~] Agent roles are filled with enabled models and can be changed before finish.
- [x] Finishing onboarding opens the selected folder/session.
- [x] `npm run lint` passes.
- [x] `npm run build` passes.

---

# Milestone 19 — Docker MCP Setup Assistant and Safe Tool Catalog

## Goal

Make MCP power approachable. OpenHarness should help users install or start Docker MCP, understand what tools are available, and add useful free MCP servers through curated, safe profiles instead of asking them to paste opaque endpoints.

## Research Baseline — 2026-06-01

- Docker now documents an MCP Catalog and Toolkit that can run MCP servers/gateways through Docker Desktop.
- The official MCP ecosystem includes a registry and reference servers, which are better defaults than random community lists.
- The safest first-run experience is curated profiles, not an unbounded marketplace: show what each server can access, its transport, its permissions, and why it is useful.

## Current Code State

- `server/mcp.ts` supports stdio, HTTP transport, tool discovery, resource discovery, and tool invocation.
- `server/index.ts` auto-starts `docker mcp gateway run --transport stdio --profile ai_coding` when Docker is present.
- `src/components/SettingsModal.tsx` has a Docker MCP pane that displays readiness, running status, tools, start/stop/restart actions, and curated server recommendations. It still does not create Docker MCP profiles, show gateway PID/log tails, or run harmless server smoke tests.
- `src/App.tsx` polls MCP status every 15 seconds, while the older plan said 30 seconds.

## Work Items

### P0 — Docker readiness check

- [x] Add a setup check for Docker Desktop installed, Docker daemon running, `docker mcp` available, and configured MCP profiles.
- [x] If Docker is missing, show a friendly install path and explain why Docker is optional.
- [x] If Docker is installed but stopped, show “Open Docker Desktop” / “Retry” guidance.
- [x] If `docker mcp` is unavailable, show a Docker MCP Toolkit update hint.
- [~] Store readiness results so Settings and onboarding share one truth.

### P0 — Docker MCP lifecycle controls

- [x] Add start/stop/restart buttons in Docker MCP settings.
- [ ] Show gateway PID/log tail through the process ledger.
- [~] Surface tool count, server count, last error, and last successful discovery time.
- [ ] Add recovery when the gateway dies mid-session: mark tools unavailable, keep the chat alive, and offer restart.

### P1 — Curated free MCP server suggestions

- [x] Add a curated “recommended free tools” screen with explicit permission labels.
- [x] Suggested local-first servers: filesystem/read-only workspace, git, browser automation, fetch/web, SQLite, memory/notes, sequential-thinking, Playwright/browser, and Docker/container tools.
- [x] For each suggestion, show “why add this,” required access, expected tools, and whether it is local-only or networked.
- [x] Add one-click profile enablement for safe defaults and keep risky tools behind trust-mode warnings.
- [x] Add “advanced custom MCP server” for users who already have an endpoint or stdio command.

### P1 — Tool catalog UX

- [ ] Group tools by server and capability: files, shell, browser, web, database, memory, containers.
- [ ] Add search/filter and collapse by server.
- [ ] Show tool schema preview in friendly language.
- [ ] Add “available to current model?” status based on trust mode and model tool-call quality.

### P2 — MCP validation and docs

- [ ] Add an MCP smoke-test action that calls a harmless tool from each server.
- [ ] Save server health history and recent errors.
- [ ] Export MCP setup diagnostics with secrets redacted.
- [ ] Add a short “MCP is optional” explainer to onboarding and Settings.

## Acceptance Criteria

- [x] A user without Docker understands the next step and can continue without MCP.
- [x] A user with Docker can start/stop/restart Docker MCP from OpenHarness.
- [x] Recommended MCP servers can be added from a curated list without hand-writing endpoints.
- [~] Tool availability is clear before the user starts a chat.
- [ ] Docker/MCP failures never break normal provider chat.
- [x] `npm run lint` passes.
- [x] `npm run build` passes.

---

# Recommended Assignment Order

This section now tracks the active post-Phase-12 backlog. Older assignments for Milestones 1–12 are represented by the milestone checklists above.

## Assignment 0 — Guided Onboarding and Docker MCP Setup (mostly complete)

Owner: TBD
Priority: P0
Files:

- `/Users/kevink/Projects/OpenHarness/src/components/OnboardingWizard.tsx`
- `/Users/kevink/Projects/OpenHarness/src/components/SettingsModal.tsx`
- `/Users/kevink/Projects/OpenHarness/src/App.tsx`
- `/Users/kevink/Projects/OpenHarness/src/utils/api.ts`
- `/Users/kevink/Projects/OpenHarness/server/config.ts`
- `/Users/kevink/Projects/OpenHarness/server/index.ts`
- `/Users/kevink/Projects/OpenHarness/server/mcp.ts`

Definition of done:

- [x] Onboarding asks which providers the user already has and saves multiple providers in one pass.
- [~] Onboarding sets personality, trust mode, active model, and agent roles from enabled models.
- [x] Onboarding can enable local Ollama/LM Studio without API keys.
- [x] Docker readiness is shown in onboarding and Settings.
- [~] Docker MCP start/stop/restart and tool catalog UX work from Settings.
- [x] Suggested free MCP servers are curated, permission-labeled, and safe by default.
- [x] Lint/build pass.

Remaining Assignment 0 polish:

- [ ] Add low-cost / best-quality / local-private / balanced default selection.
- [ ] Let users override agent roles before finishing onboarding.
- [ ] Add partial-setup resume and clearer provider failure recovery copy.
- [ ] Add MCP server smoke tests, gateway-death recovery, PID/log tails, and profile creation/validation depth.

## Assignment 1 — Close Phase 4 Patch Proposal Gap

Owner: TBD  
Priority: P0  
Files:

- `/Users/kevink/Projects/OpenHarness/server/patchApply.ts`
- `/Users/kevink/Projects/OpenHarness/server/index.ts`
- `/Users/kevink/Projects/OpenHarness/src/types/index.ts`
- `/Users/kevink/Projects/OpenHarness/src/utils/api.ts`
- `/Users/kevink/Projects/OpenHarness/src/components/PatchReviewPanel.tsx`
- `/Users/kevink/Projects/OpenHarness/src/components/DiffViewer.tsx`

Definition of done:

- [x] Model-proposed patches render file-by-file and hunk-by-hunk.
- [~] User can accept/reject individual files and hunks.
- [x] Applying a patch triggers configured validation.
- [ ] Chat-created proposals, run trace, apply result, and validation result are linked in one obvious workflow.
- [ ] Patch-review panel has manual smoke coverage for empty/error/reject-all/validation-failed states.
- [ ] Lint/build pass.

## Assignment 2 — Close Phase 5/6/8 Correctness Gaps

Owner: TBD  
Priority: P0  
Files:

- `/Users/kevink/Projects/OpenHarness/server/evals.ts`
- `/Users/kevink/Projects/OpenHarness/server/toolPolicy.ts`
- `/Users/kevink/Projects/OpenHarness/src/App.tsx`
- `/Users/kevink/Projects/OpenHarness/src/components/StatusBar.tsx`
- `/Users/kevink/Projects/OpenHarness/server/providers/registry.ts`

Definition of done:

- [x] Eval scores include validation pass/fail.
- [x] Status bar receives and displays the actual enabled tool count.
- [x] MiniMax provider path passes a live smoke test.
- [x] Provider smoke result is recorded in the roadmap or release notes.
- [x] Lint/build pass.

Smoke result:
- 2026-06-12: `npm run smoke:minimax` passed against `MiniMax-M3` after env-hydrated provider credentials were loaded by the server. The streamed `/api/test/run` response returned exactly `PONG`.

## Assignment 3 — Agent Bench MVP

Owner: TBD  
Priority: P0  
Files:

- `/Users/kevink/Projects/OpenHarness/server/harnessTasks.ts`
- `/Users/kevink/Projects/OpenHarness/server/evals.ts`
- `/Users/kevink/Projects/OpenHarness/src/components/ModelLabPanel.tsx`
- `/Users/kevink/Projects/OpenHarness/src/utils/api.ts`

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

- `/Users/kevink/Projects/OpenHarness/server/checkpoints.ts`
- `/Users/kevink/Projects/OpenHarness/server/orchestrator.ts`
- `/Users/kevink/Projects/OpenHarness/server/git.ts`
- `/Users/kevink/Projects/OpenHarness/src/components/DiffViewer.tsx`

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

- `/Users/kevink/Projects/OpenHarness/server/repoMap.ts`
- `/Users/kevink/Projects/OpenHarness/server/projectProfile.ts`
- `/Users/kevink/Projects/OpenHarness/server/promptBuilder.ts`
- `/Users/kevink/Projects/OpenHarness/src/components/FilesPanel.tsx`

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

- `/Users/kevink/Projects/OpenHarness/server/browserPreview.ts`
- `/Users/kevink/Projects/OpenHarness/src/components/BrowserPanel.tsx`
- `/Users/kevink/Projects/OpenHarness/server/evals.ts`

Definition of done:

- [ ] Browser artifacts include screenshot, DOM, console, network failures, and accessibility summary.
- [ ] Scripted smoke checks can run from UI and eval suites.
- [ ] Browser failures are linked to run traces.
- [ ] Lint/build pass.

## Assignment 7 — Multi-Agent Team Runtime

Owner: TBD  
Priority: P1  
Files:

- `/Users/kevink/Projects/OpenHarness/server/agentProfiles.ts`
- `/Users/kevink/Projects/OpenHarness/server/orchestrator.ts`
- `/Users/kevink/Projects/OpenHarness/src/components/SubAgentTracker.tsx`
- `/Users/kevink/Projects/OpenHarness/src/components/PlanTracker.tsx`

Definition of done:

- [ ] Built-in agent profiles exist.
- [ ] Read-only agents can run in parallel.
- [ ] Each agent has its own trace and output artifact.
- [ ] User can cancel and inspect agent work.
- [ ] Lint/build pass.


## Assignment 8 — MiniMax M3 Long-Running Research Spike

Owner: MiniMax M3 / MiniMax 3.0  
Priority: P0 research before implementation  
Mode: read-only investigation and planning; no code changes unless a human explicitly promotes a follow-up implementation task

Why this is a good fit for MiniMax M3:

- MiniMax's current M3 page positions M3 as a coding and agentic model with autonomous task decomposition, tool invocation, and multi-step reasoning.
- MiniMax says the M3 API supports up to a 1M-token context window, with a guaranteed minimum of 512K tokens, which is well suited to reading this repo, the roadmap, and relevant implementation files in one long-horizon pass.
- MiniMax's API example uses model id `MiniMax-M3` at `https://api.minimax.io/v1/text/chatcompletion_v2`; use that exact model id for the smoke test and for this research run.
- Source checked 2026-06-01: [MiniMax M3 model page](https://www.minimax.io/models/text/m3).

Research objective:

Create a repo-grounded implementation brief that decides the safest next execution order across M13, M14, and M15, with special attention to whether M15 Patch Review UI should come first because it also closes the remaining M4 patch-proposal gap.

Files and areas to inspect:

- `/Users/kevink/Projects/OpenHarness/docs/HARNESS_WORK_ROADMAP.md`
- `/Users/kevink/Projects/OpenHarness/server/orchestrator.ts`
- `/Users/kevink/Projects/OpenHarness/server/runTrace.ts`
- `/Users/kevink/Projects/OpenHarness/server/patchApply.ts`
- `/Users/kevink/Projects/OpenHarness/server/browserPreview.ts`
- `/Users/kevink/Projects/OpenHarness/server/evals.ts`
- `/Users/kevink/Projects/OpenHarness/src/components/DiffViewer.tsx`
- `/Users/kevink/Projects/OpenHarness/src/components/SubAgentTracker.tsx`
- `/Users/kevink/Projects/OpenHarness/src/components/PlanTracker.tsx`
- `/Users/kevink/Projects/OpenHarness/src/components/InlineComment.tsx`
- `/Users/kevink/Projects/OpenHarness/src/components/BrowserPanel.tsx`
- `/Users/kevink/Projects/OpenHarness/src/components/ModelLabPanel.tsx`
- `/Users/kevink/Projects/OpenHarness/src/utils/api.ts`
- `/Users/kevink/Projects/OpenHarness/src/types/index.ts`

Required deliverable:

Write a single markdown report, preferably `docs/MINIMAX_M3_LONG_RUNNING_RESEARCH.md`, with these sections:

1. **Executive recommendation** — pick one next implementation target and explain why.
2. **Repo evidence** — cite exact files, existing functions/components, and missing seams.
3. **Dependency graph** — show which M13/M14/M15 pieces unblock or depend on each other.
4. **Implementation plan** — break the recommended target into small commits or phases.
5. **Data contracts** — propose TypeScript shapes for any new server/client objects.
6. **UI flow** — describe the user-visible flow and edge cases.
7. **Validation plan** — list lint/build, unit/manual checks, and app relaunch checks.
8. **Risks and rollback** — identify where user work, git state, or runtime processes could be harmed.
9. **Follow-up prompts** — include one implementation prompt for the next agent after the research is accepted.

Non-negotiable constraints:

- Do not modify application code during this research spike.
- Do not start implementation of M13, M14, or M15.
- Do not overwrite unrelated working-tree changes.
- If documentation is updated, keep it limited to the research report and this roadmap.
- This older research spike is no longer the only safe next move; Assignment 0 is now the recommended implementation start unless the user reprioritizes M13/M14/M15.

Copy/paste prompt for MiniMax M3:

```text
You are MiniMax M3 running inside /Users/kevink/Projects/OpenHarness. Use your long-context coding-agent strengths for a read-only, repo-grounded research spike.

Goal: decide the safest next implementation target across Milestone 13 Multi-Agent Team Runtime, Milestone 14 Deep Browser and UI Verification, and Milestone 15 Patch Review / Inline Comments / Release Workflow. Pay special attention to whether M15 Patch Review UI should happen first because it also closes the existing M4 patch-proposal gap.

Rules:
- Read files and inspect the repo deeply, but do not modify application code.
- Do not start implementation.
- Do not launch or kill app processes unless a command is purely needed to inspect static repo state.
- Preserve unrelated working-tree changes.
- Ground every recommendation in exact files and existing code seams.

Inspect at minimum:
- docs/HARNESS_WORK_ROADMAP.md
- server/orchestrator.ts
- server/runTrace.ts
- server/patchApply.ts
- server/browserPreview.ts
- server/evals.ts
- src/components/DiffViewer.tsx
- src/components/SubAgentTracker.tsx
- src/components/PlanTracker.tsx
- src/components/InlineComment.tsx
- src/components/BrowserPanel.tsx
- src/components/ModelLabPanel.tsx
- src/utils/api.ts
- src/types/index.ts

Deliverable: create docs/MINIMAX_M3_LONG_RUNNING_RESEARCH.md with these sections:
1. Executive recommendation — pick exactly one next implementation target and explain why.
2. Repo evidence — cite exact files, functions/components, and missing seams.
3. Dependency graph — explain what M13/M14/M15 pieces unblock or depend on.
4. Implementation plan — small phases suitable for separate commits.
5. Data contracts — TypeScript interface sketches for new server/client objects.
6. UI flow — user-visible behavior, empty states, errors, and edge cases.
7. Validation plan — lint/build/manual/app-relaunch checks.
8. Risks and rollback — especially git state, patch application, user changes, and runtime processes.
9. Follow-up implementation prompt — one clear prompt another agent can execute after human approval.

Success criteria:
- The report makes the next choice obvious.
- The report is specific enough that an implementation agent can work surgically without redoing discovery.
- The report does not claim code is complete unless verified from disk.
```

Definition of done:

- [ ] MiniMax M3 credential-backed smoke test passes with model id `MiniMax-M3`.
- [ ] `docs/MINIMAX_M3_LONG_RUNNING_RESEARCH.md` exists.
- [ ] Report picks exactly one next implementation target.
- [ ] Report cites exact repo files and implementation seams.
- [ ] Report includes a copy/paste follow-up implementation prompt.
- [ ] No application code is modified by the research spike.

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

# Currently Pending Question — Superseded 2026-06-01

The 2026-05-31 blocker about choosing among M13, M14, and M15 is no longer the active planning question. On 2026-06-01 the user asked for a repo/document reconciliation plus new user-friendly milestones for onboarding, default agent setup, Docker MCP setup, free MCP suggestions, and other UX gaps.

No M13/M14/M15 implementation work was started by this documentation update. The current recommended next implementation assignment is **Assignment 0 — Guided Onboarding and Docker MCP Setup**.

Next-work options on the table:

- [ ] **M15 P0 — Patch Review UI**: build on `server/patchApply.ts` and `DiffViewer.tsx` to add file-by-file / hunk-by-hunk accept-reject plus post-apply validation. Also closes the M4 patch-proposal gap.
- [ ] **M14 P0 — Upgraded Browser Capture**: replace the curl+screencapture hack in `server/browserPreview.ts` with real DOM, a11y tree, console, and network-failure capture.
- [ ] **M13 P0 — Agent Profiles**: create `server/agentProfiles.ts` with built-in profiles (explorer, planner, implementer, reviewer, debugger, browser-tester, eval-judge) and add per-agent traces.
- [ ] **Assignment 1 (Recommended Assignment Order)**: close the M4 patch-proposal gap from the assignment backlog. Effectively M15 P0.
- [ ] **Assignment 8 — MiniMax M3 Long-Running Research Spike**: use MiniMax M3 / MiniMax 3.0 for a read-only repo-grounded implementation brief before choosing M13, M14, or M15. Recommended next step.
- [ ] Something else from Assignments 2–7: eval validation scoring, MiniMax smoke test, worktree execution, repo map MVP, browser verification MVP, or multi-agent MVP.

Status of M13/14/15 on disk (recorded for context, not action):

- M13: nothing built. `server/agentProfiles.ts` does not exist. `SubAgentTracker.tsx` and `PlanTracker.tsx` are basic display shells.
- M14: minimal. `server/browserPreview.ts` is a 4.7 KB curl+screencapture hack from M4. No DOM, a11y, console, network, or scripted steps.
- M15: partially built. `server/patchProposals.ts`, hunk-level proposal APIs, `PatchReviewPanel.tsx`, and client patch-proposal types/API calls exist. `InlineComment.tsx` is still a read-only display with no creation, severity workflow, resolution, or persistence.

M13/M14/M15 remain valid later milestones, but they are behind the new onboarding/MCP usability work unless the user reprioritizes.

---

# Open Decisions

- [ ] Should session storage use one JSON file per session or a small SQLite database?
- [ ] Should write operations be model-generated patch proposals only, or direct write tools under trust mode?
- [ ] Should browser automation be built into OpenHarness or delegated through MCP only?
- [ ] Should eval scoring use deterministic heuristics first or model-based judging first?
- [ ] Should provider/model IDs be migrated fully to `providerId:modelId`?
- [ ] Should project memory be editable by the user in UI?
- [ ] Which curated MCP servers should ship as default recommendations versus optional advanced tools?
- [ ] Should onboarding write to the existing `config.json` directly through current endpoints or introduce an explicit setup-session API?

---

# Product Principle

Every feature should make at least one of these things more visible:

1. What the model knew.
2. What the model did.
3. What changed on disk.
4. What was verified.
5. What remains risky.

If a feature cannot improve one of those, defer it.
