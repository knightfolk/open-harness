# OpenHarness Premier Harness Kickoff

Status: guiding document for Planning Room and /goal kickoff
Last reviewed: 2026-06-16

## Purpose

Use this document to kick off the next major OpenHarness overhaul. The goal is
to make OpenHarness the premier local harness for both open-source and frontier
models: calm enough to live in all day, transparent enough to trust, and strong
enough to coordinate multiple agents across planning, implementation, review,
verification, and model comparison.

This is not a request for more UI chrome. The target is an agent-native command
center: simple chat by default, visible work when agents are active, rich detail
only when the user asks for it.

## Product References

Use Codex and Antigravity as direction, not as skins to copy.

- Codex direction: command center for agentic coding, parallel work across
  projects/worktrees, background work, and high-signal review/ship flows.
- Antigravity direction: agents are not just chat messages in a sidebar; they
  get dedicated work surfaces, produce artifacts, and accept feedback on those
  artifacts while work continues.
- OpenHarness advantage: provider choice, open-source model support, local
  control, model labs, routing transparency, and configurable safety.

## Non-Negotiable Principles

1. Chat remains the home base.
2. Agent work is visible but not noisy.
3. The left pane explains where work belongs: project, thread, run, agent.
4. The right pane explains what selected work is doing in detail.
5. Users can steer incorrect work without stopping the whole run.
6. Artifacts beat raw logs for trust: plans, diffs, screenshots, test proof,
   browser recordings, summaries, and review notes.
7. Flat, restrained UI beats draggable cockpit layouts.
8. Power features stay available, but default UI stays quiet.
9. Open-source and frontier models should be first-class peers, with honest
   capability, cost, speed, context, privacy, and tool-use signals.

## Remove

These removals are part of the product direction, not optional cleanup.

- Remove panel drag/drop as a default interaction. No draggable panel headers,
  no reorder handles, and no drag-to-swap layout behavior in normal use.
- Remove reorderable Environment rail cards. Keep a fixed information order.
- Remove the permanent `sub-agents` split from the default layout.
- Remove permanent bottom status chrome unless there is an active warning,
  background job, or user-opened terminal.
- Remove duplicated Diffs/Patches surfaces in favor of one Review Changes flow.
- Remove message-level clutter from normal assistant responses:
  confidence, prompt microscope, artifacts, next actions, and tool traces should
  collapse behind quiet affordances unless they are actionable.
- Remove decorative shadows, nested cards, and floating panel islands from the
  default workspace.
- Remove novelty helpers and tips from the default experience unless the user
  explicitly enables them.
- Remove fake or optimistic agent progress where real run-trace events are
  available.

## Add

### 1. Flat Agent-Native Shell

Default layout:

- Left pane: projects, threads, current work, and active agents under the thread
  they belong to.
- Center: chat and composer.
- Right pane: hidden until the user selects an agent, artifact, file, diff, or
  environment detail.
- Top bar: project/title, model or router state, Tools, Environment.
- Bottom bar: terminal only when explicitly opened or when a task needs visible
  process output.

### 2. Work Queue In The Left Pane

The left pane should show active work where users already look for context.

Thread hierarchy:

```text
Project
  Thread
    Active run
      Planner agent
      Implementer agent
      Reviewer agent
      Browser verifier
```

Each row should show:

- status: waiting, running, needs attention, blocked, complete, failed
- model/provider
- current task
- elapsed time
- last artifact or proof produced
- a small attention marker when steering is possible

### 3. Todo Bar For Active Work

Add a compact active-work strip near the composer or top of the chat stream.
It should show the current run plan as a short checklist:

```text
Plan -> Implement -> Verify -> Review -> Report
```

For Planning Room:

```text
Draft independently -> Cross-check -> Synthesize -> Ready to execute
```

The todo bar is not a second chat. It is a state indicator and entry point into
details.

### 4. Right-Hand Agent Detail Pane

Clicking an agent opens a right-hand detail pane, not a full layout mode switch.

The pane should show:

- current objective
- phase and status
- model/provider and role
- live run steps
- visible reasoning summary when available
- tool calls grouped by purpose
- artifacts produced
- files read or changed
- validation proof
- cost/token/time summary
- related thread/run/plan

This should reuse the existing `AgentFocusPanel`, `SubAgentTracker`, and
run-trace data, but present it as a flatter inspector.

### 5. Steering And Intervention

Users need to correct agent work before it goes too far.

Minimum controls:

- Flag assumption
- Add steering note
- Ask orchestrator to redirect
- Send note directly to selected agent when the phase supports it
- Pause run
- Cancel run
- Request artifact/proof
- Mark artifact as approved or needs revision

Steering notes should become structured run-trace events and be injected into
the next safe phase. Do not make steering just another chat message unless the
user explicitly chooses that.

### 6. Artifact-First Verification

Agents should produce reviewable artifacts at natural checkpoints:

- plan
- file-change summary
- diff
- test result
- screenshot
- browser recording or replay notes
- failure diagnosis
- final proof report

Artifacts should support comments, flags, and "revise from here" actions.

### 7. Calm Chat

The chat stream should become flatter and quieter:

- Assistant messages read like clean prose, not dashboards.
- Tool details collapse by default.
- Prompt microscope moves behind a Details action.
- Confidence and next actions become one compact Actions menu.
- Team plan cards stay useful but visually flatten.
- Streaming thinking shows a small status line, not a large block, unless the
  user opens details.

### 8. Theme Textures

Themes may include subtle textures, but they must not reduce readability.

Add a texture recipe layer to the theme system:

- none
- paper grain
- fine grid
- blueprint grid
- low-noise matte
- soft glass
- terminal scanline

Rules:

- Text contrast remains the release gate.
- Texture opacity is bounded and user-adjustable.
- Reduced transparency and reduced motion fallbacks are required.
- Textures apply to app shell or chat background, not dense text surfaces by
  default.
- Do not use busy wallpaper-style imagery in the default themes.

### 9. Premier Model Harness Features

To lead for both open-source and frontier models, OpenHarness should add:

- model capability scorecards: coding, reasoning, review, planning, tool use,
  vision, long context, speed, cost, privacy, local availability
- per-role model recommendations backed by evals and recent run outcomes
- honest router explanations with "why this model" and "why not the others"
- budget controls per run, per agent, per provider, and per day
- local/open model calibration packs for tool use, code edits, context length,
  and instruction following
- frontier-model comparison packs for hard planning, review, and refactor tasks
- worktree isolation per implementation agent before any multi-agent write flow
- replayable runs with prompts, artifacts, tools, diffs, and validation proof
- provider health and rate-limit visibility
- model failure memory: what failed, whether fallback was used, and what fixed it
- import/export of routing learning and benchmark results

## Implementation Phases

### Phase 0: Align The Source Of Truth

Files:

- `docs/PREMIER_HARNESS_KICKOFF.md`
- `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md`
- `docs/UI_CLEANUP_PLAN.md`
- `docs/HARNESS_WORK_ROADMAP.md`
- `NEXT_SESSION.md`

Tasks:

- Treat this document as the kickoff source for the UI and agent-control
  overhaul.
- Keep `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` as the closeout evidence
  checklist for proof runs, manual UI review, runtime scenario proof, and final
  gates.
- Keep `docs/UI_CLEANUP_PLAN.md` as the detailed declutter reference.
- Keep `docs/HARNESS_WORK_ROADMAP.md` as the broader capability roadmap.

Done when:

- The next `/goal` or Planning Room run can point to this document and produce
  an implementation plan without re-explaining the product direction.

### Phase 1: Remove Drag And Default Layout Bloat

Files:

- `src/types/layout.ts`
- `src/components/layout/LayoutEngine.tsx`
- `src/components/layout/PanelWrapper.tsx`
- `src/components/EnvironmentRail.tsx`
- `src/components/TopBar.tsx`
- `src/styles/components.css`

Tasks:

- Change the default layout to chat-first.
- Remove draggable panel headers and drag/drop swapping.
- Remove Environment rail reorder drag/drop.
- Keep Tools as the way to open advanced panels.
- Keep panel resize only where it is plainly useful.

Validation:

- Browser refresh is enough for client-only changes.
- `npm run lint`
- `npm run build`
- Manual screenshot check at desktop and narrow widths.

Done when:

- The app opens to chat-first UI with no visible drag affordances.

### Phase 2: Agent Work Model

Files:

- `src/types/index.ts`
- `server/runTrace.ts`
- `server/orchestrator.ts`
- `server/agentRuntime.ts`
- `src/App.tsx`
- `src/components/Sidebar.tsx`
- `src/components/RunningAgentsStrip.tsx`
- `src/components/SubAgentTracker.tsx`

Tasks:

- Normalize agent/run/phase state around real run-trace events.
- Show active agents under the owning thread in the left pane.
- Add the active-work todo bar.
- Ensure completed agent history remains inspectable without cluttering chat.

Validation:

- Run a Planning Room request and confirm planner participants appear under the
  active thread.
- Run an execute/investigate request and confirm phases appear in order.
- `npm run lint`
- `npm run build`
- Relevant routing/session regression tests.

Done when:

- A user can glance at the left pane and understand what is working, waiting,
  blocked, or complete.

### Phase 3: Right-Hand Agent Detail And Steering

Files:

- `src/components/AgentFocusPanel.tsx`
- `src/components/SubAgentTracker.tsx`
- `src/components/RightPanel.tsx`
- `src/utils/api.ts`
- `server/index.ts`
- `server/orchestrator.ts`
- `server/agentRuntime.ts`
- `server/runTrace.ts`

Tasks:

- Convert agent focus into a right-hand inspector pane.
- Add structured steering events.
- Add pause/cancel where runtime support exists.
- Add flag/feedback controls for artifacts and wrong assumptions.
- Route steering to the orchestrator by default; allow direct agent steering
  only where the agent can safely consume it.

Validation:

- Start a multi-phase run.
- Click an agent in the left pane.
- Confirm the right pane opens with live detail.
- Add a steering note.
- Confirm the note is recorded in the run trace and used by the next phase.
- Server/runtime changes require restart and reachability verification.

Done when:

- The user can correct a bad direction without losing the whole run.

### Phase 4: Calm Chat And Artifact Review

Files:

- `src/components/MessageBubble.tsx`
- `src/components/ArtifactDrawer.tsx`
- `src/components/PromptMicroscope.tsx`
- `src/components/NextBestActions.tsx`
- `src/components/PatchReviewPanel.tsx`
- `src/components/EnvironmentRail.tsx`
- `src/styles/components.css`

Tasks:

- Collapse nonessential message chrome.
- Convert details into a single Details/Actions entry point.
- Flatten team plan and artifact cards.
- Keep Review Changes as the main diff/patch path.
- Make screenshots, test proof, and final reports easy to inspect.

Validation:

- Existing assistant responses remain readable.
- Team plan promote/revise actions still work.
- Patch review still works.
- No text overlap on desktop or narrow widths.

Done when:

- Chat feels like the main workspace again.

### Phase 5: Theme Texture Layer

Files:

- `src/theme/themeTokens.ts`
- `src/theme/builtins.ts`
- `src/theme/themePluginManifest.ts`
- `docs/theme-plugin.schema.json`
- `src/styles/global.css`
- `src/styles/components.css`
- `src/components/SettingsModal.tsx`

Tasks:

- Add bounded texture/background recipe tokens.
- Add built-in subtle texture choices.
- Expose simple theme controls in Settings.
- Validate contrast and reduced-transparency fallbacks.

Validation:

- Built-in theme validation passes.
- Text remains readable in chat, sidebar, settings, code blocks, terminal, and
  diff viewer.
- Reduced motion/transparency settings have safe fallbacks.

Done when:

- Users can choose subtle texture without sacrificing readability.

### Phase 6: Premier Model Harness Layer

Files:

- `server/evals.ts`
- `server/autoRouter.ts`
- `server/routerLearning.ts`
- `server/providerHealth.ts`
- `server/config.ts`
- `src/components/ModelLabPanel.tsx`
- `src/components/SettingsModal.tsx`
- `src/utils/api.ts`

Tasks:

- Add model capability scorecards.
- Make eval recommendations influence role and routing suggestions.
- Show model/router decisions in a calm inspector.
- Add budget and rate-limit warnings.
- Add open-source model calibration packs.
- Add frontier comparison packs.

Validation:

- Model Lab can compare open-source and frontier candidates for the same task.
- Router explains selected model and rejected alternatives.
- Budget warnings appear before expensive background work.
- `npm run lint`
- `npm run build`
- `npm run test:hardening`

Done when:

- OpenHarness can honestly explain which model should do which work and why.

## Restart Rules

- Client-only changes: do not restart the server. A browser refresh is enough.
- Docs-only changes: do not restart anything.
- Server/runtime changes: kill existing OpenHarness server/app processes,
  relaunch with the repo-native launcher, and verify:
  - server on `3001`
  - Vite UI on `5173`
  - `/api/config`

## Stop Condition

Stop the overhaul only when all of this is true:

- Default UI is chat-first, flat, and non-draggable.
- Active agents are visible under the owning thread.
- Clicking an agent opens right-hand detail.
- The user can flag or steer bad agent direction.
- Chat no longer shows every diagnostic surface by default.
- Theme textures are subtle, bounded, and accessible.
- Model routing and evaluation are visible enough to trust.
- Lint/build pass.
- Server/runtime changes have been relaunched and reachability verified.

Use `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` to collect closeout evidence for
proof runs, manual UI review, runtime scenario proof, and final validation
gates. If any checklist item is missing or only indirectly proven, keep the
overhaul open.

## Paste-Ready Goal Prompt

```text
/goal Use docs/PREMIER_HARNESS_KICKOFF.md as the source of truth for this session.

Plan and implement the next smallest safe phase of the OpenHarness UI and
agent-control overhaul.

Non-negotiables:
- Keep the default workspace chat-first and flat.
- Remove default drag/drop layout behavior instead of polishing it.
- Show active agents under the owning thread in the left pane.
- Clicking an agent should open a right-hand detail pane.
- Add a path for users to flag or steer incorrect agent work.
- Keep message chrome quiet by default.
- Theme textures must be subtle, bounded, and accessible.

Before changing files:
- Inspect docs/PREMIER_HARNESS_KICKOFF.md,
  docs/PREMIER_HARNESS_PROOF_CHECKLIST.md, docs/UI_CLEANUP_PLAN.md,
  src/types/layout.ts, src/components/layout/PanelWrapper.tsx,
  src/components/Sidebar.tsx, src/components/AgentFocusPanel.tsx,
  src/components/SubAgentTracker.tsx, src/components/MessageBubble.tsx,
  src/components/EnvironmentRail.tsx, server/runTrace.ts,
  server/orchestrator.ts, and server/agentRuntime.ts.

Work in one narrow phase only. Validate with lint/build, and if server/runtime
code changes, relaunch OpenHarness and verify the app is reachable.

Stop when the phase is implemented, verified, the next phase is obvious, and
any closeout claim is backed by docs/PREMIER_HARNESS_PROOF_CHECKLIST.md.
```
