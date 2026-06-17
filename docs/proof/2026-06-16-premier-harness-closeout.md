# Premier Harness Closeout Evidence

Status: pending evidence collection
Date: 2026-06-16
Reviewer: pending

This file tracks closeout evidence for `docs/PREMIER_HARNESS_KICKOFF.md` using
`docs/PREMIER_HARNESS_PROOF_CHECKLIST.md`. Do not treat this file as completion
proof until every section below is filled with current direct evidence.

## Kickoff Stop-Condition Audit

Current status: not complete. Every item below still needs current direct
evidence before the kickoff goal can close.

| Stop condition | Required direct evidence | Current evidence status |
| --- | --- | --- |
| Default UI is chat-first, flat, and non-draggable. | Desktop and narrow-width manual UI notes or screenshots showing no default drag/reorder affordances. | partial: live DOM notes collected for desktop and narrow widths; source inspection confirms `DEFAULT_LAYOUT` is chat-only and layout wrapper/engine contain no panel drag/drop handlers or reorder affordances, with remaining `col-resize` limited to useful resize affordances; advanced panel chrome now keeps panel title icons decorative and close buttons explicitly labelled/typed; composer textarea, action buttons, and the new-message scroll control now have explicit accessibility labels/button semantics, with composer action icons and the new-message scroll arrow marked decorative; visual screenshot capture timed out |
| Active agents are visible under the owning thread. | Planning Room or multi-agent run evidence showing active work grouped under the thread. | partial: existing completed `coder run` history is grouped under the owning `Color Clash (GPT)` project/session with status, proof, model/provider, and elapsed age; the active-work strip, Agent detail workflow strip, and Environment progress area now expose workflow, current task, model/provider, latest artifact/proof cue, and labelled step-status lists from shared run state, with matching accessible label context, Agent detail workflow progress grouped under a labelled summary, Sidebar session rows exposing keyboard selection, current-chat state, and active-work counts, with run and phase rows exposing focus labels with status/task/model/proof context, Environment rail section toggles owning labelled variant-scoped detail regions, decorative Sidebar work-queue glyphs plus progress dots/separators and Environment rail icons hidden from assistive tech, and narrow-screen CSS hiding extra metadata before it can crowd the composer; live active-run proof remains pending |
| Clicking an agent opens right-hand detail. | Manual UI notes or screenshot showing selected agent detail inspector. | partial: clicking the saved `coder run` row opened the right-side Agent detail overlay; phase rows in the left queue now support keyboard activation with Enter/Space as well as click, and their inline detail chevrons are real disclosure buttons; Agent detail cards now expose focus labels with role/name, status, task, model/provider, latest artifact cue, explicit selected-agent state, and controlled detail disclosure; Agent detail shell back controls are typed and labelled, agent-list rows expose current detail state, Agent detail replay filters are a labelled group with selected state; Agent detail replay empty/filter-empty states are polite statuses; Agent detail replay summary is a labelled group with decorative summary/event/header/meta icons; live active-agent detail proof remains pending |
| The user can flag or steer bad agent direction. | Runtime scenario trace with a steering note recorded during a safe phase. | partial: saved run detail exposes steering controls (`Flag assumption`, `Add note`, `Proof`, `Steering`); active steering controls now explain whether notes target the orchestrator or the selected agent for the next safe phase, whether actions persist as replay steering events, and when artifact approval/revision controls appear; redirect now sends the current note draft as the correction reason when present; steering action/note controls expose the target run or phase plus action purpose in their accessible labels; recording and next-phase use of a steering note remain pending |
| Chat no longer shows every diagnostic surface by default. | Manual UI notes showing diagnostics collapsed behind Details/Actions and artifacts still reviewable. | partial: existing saved session showed clean prose by default with replay/artifact/details affordances; Details and artifact review opened on demand without raw tool-event dump; live thinking, typing, and browser preview loading indicators remain small polite status lines with decorative dots hidden from assistive tech; the Details toggle, tool-summary toggle, confidence details toggle, patch review action, replay export action, team-plan artifact actions, artifact drawer actions, Browser panel actions, and suggested-action controls now have explicit button semantics/accessibility labels, with Browser quick URL presets exposed as a labelled group with selected state, Browser preview exposed as a URL-labelled region, Browser empty and reachable-without-screenshot states exposed as polite statuses, Browser preview errors exposed as alerts, Artifact Drawer copy buttons exposing copied state, artifact approval/revision buttons associated with saved/error feedback status, the Details toggle owning a labelled details region, the tool-summary toggle owning a labelled tool details region, the confidence toggle owning a labelled confidence details region, Artifact Drawer items exposed as labelled regions, artifact content previews labelled by artifact, long-artifact expansion controls owning their preview content, referenced-file chips exposed as a labelled group, and decorative Browser health/warning glyphs plus Details/tool-summary/confidence/message-action/team-plan/artifact-drawer type/action/toggle/note icons/count badges hidden from assistive tech; the expanded suggested-action strip is a labelled group; the artifact drawer toggle now exposes expanded/collapsed state, artifact count, artifact-type summary, and ownership of the expanded artifact region to assistive tech; suggested next actions now default to a compact `Actions` affordance even inside Details |
| Theme textures are subtle, bounded, and accessible. | Manual review notes across chat, sidebar, settings, code, terminal, and diff surfaces. | partial: current Theme settings and visible shell contrast inspected; the texture setting now states that textures are shell-only and that reduced transparency disables textures/blur while using solid theme fallback colors; reduced-transparency CSS now consumes the theme fallback surface, border, and shadow variables for primary shell/panel surfaces; reduced-motion CSS now disables small chat/work/status pulsing animations plus shared `.spin` loaders; live reduced-transparency browser proof remains pending |
| Model routing and evaluation are visible enough to trust. | Model Lab eval/bench proof review exports plus Routing Learning/Agent Role/Auto-Router trust-state notes. | partial: no-spend Model Lab, Routing Learning, Agent Roles, and Auto-Router transparency surfaces inspected; Model Lab sections now expose a labelled tablist with selected-state tabs for Eval, Tasks, Bench, Packs, Results, and History, each tab controls a matching focusable tabpanel, ArrowLeft/ArrowRight/Home/End move between tabs, and roving tabindex keeps the selected tab in the normal tab order; Model Lab prompt, task, and model selections are now labelled provider-call matrix groups, with explicit per-item select/deselect labels and Select all labels that state how many prompts/tasks/candidates will be selected; Model Lab proof-prep, task seeding, Eval launch, Bench launch, prompt-pack folder prep/import/pack-run/export controls are explicit non-submit buttons with targeted labels; Prompt Packs import path has a direct label, import errors are alerts, missing registry/manifests states are polite statuses, trust/status pills now expose explicit prompt-pack trust/manifest-status labels, and registry-root ready/missing status labels include location/path context; Model Lab matrix caution boxes now announce selected run count plus provider-rate-limit/metered-billing risk with status/alert semantics based on matrix size; Model Lab diagnostics now announce proof-prep/error messages as status/alert regions; Model Lab Eval/Bench launch buttons now repeat the provider-budget approval condition and selected matrix size at the action point; Agent Roles renders role assignments and auto-configure suggestions; model ability icons now expose available/unavailable capability labels, Agent Roles recommended-model grid is a labelled group, role cards now expose role/description/model/thinking labels, effort sections expose labelled/described section relationships, effort counts expose role-count labels, recommendation cards expose role/model labels, eval recommendation cards expose role/model/proof/reason labels, empty effort buckets are polite statuses, auto-configure and eval-recommendation apply buttons have explicit button semantics/labels, and decorative role/effort icons are hidden from assistive tech; Auto-Router summary counts now expose catalog/configured/routed status labels, classifier/default/threshold controls have direct labels, sync/add candidate controls are explicit typed buttons with targeted labels, no-candidate empty state is a polite status, candidate rows expose candidate/source/cost/capability labels, candidate eval recommendations expose model/role/proof/reason labels, candidate capability/cost controls are labelled, add-candidate model/cost/capability/toggle controls have direct labels, and remove controls are explicit typed buttons with decorative trash icons; live proof of the newer proof-trust callout plus proof exports, proof-review decisions, and approved/trusted apply evidence remains pending |
| Lint/build pass. | Current `npm run lint` and `npm run build` command results. | pending |
| Server/runtime changes have been relaunched and reachability verified. | Current restart proof for `3001`, `5173`, and `/api/config` if server/runtime changes are included in the closeout pass. | pending |

## Provider-Backed Proof Run Approval Draft

Status: approval not requested yet

Planned calls:

- Eval proof: proposed smallest 1 prompt x 1 model run.
- Bench proof: proposed smallest 1 task x 1 model run.
- Runtime scenarios: proposed Planning Room plus one execute or investigate run.

Current local inventory snapshot from 2026-06-16 no-spend inspection:

- Eval prompts available: 7.
- Bench tasks available: 14.
- Enabled models available: 18.
- Active model setting: Auto.
- Example eval prompt: `review-project` / `Review this project`.
- Example bench task: `81234b62-fbd5-4c0d-910f-2d4f9ee8849b` / `Setup failure live regression`.
- Example enabled model: `minimax` / `MiniMax-M3`.

Approval options to ask reviewer:

1. Approve smallest proof runs only.
2. Approve eval proof only.
3. Approve bench proof only.
4. Do not run provider-backed proof yet.

## Browser/Manual Proof Approval Draft

Status: approval not requested yet

Planned checks:

- Refreshed desktop/narrow chat-first shell.
- Model Lab History cap.
- Agent Roles proof-trust callout.
- Theme reduced-transparency copy.
- Artifact drawer `Show full` / `Collapse`.
- Review Changes proof-save-to-chat if a safe validation result is available.

Approval options to ask reviewer:

1. Run browser/manual proof pass.
2. Limit to no-provider UI checks only.
3. Do not run browser/manual proof yet.

## Final Gate Approval Draft

Status: approval not requested yet

Planned commands:

- `npm run lint`
- `npm run build`
- Optional scoped hardening only if touched routing/provider/budget/import-export/security-sensitive paths require it.

Approval options to ask reviewer:

1. Run lint/build only.
2. Run lint/build plus scoped hardening.
3. Do not run final gates yet.

## Model Lab Eval Proof

- Report id: pending
- Proof review status: pending
- Proof brief: `docs/proof/2026-06-16-model-lab-eval-manual-alt-proof-brief.md`
- Recommendation report: `docs/proof/2026-06-16-model-lab-eval-manual-alt-recommendation-report.md`
- Routing Learning trust state: partial no-spend proof. Routing Learning is reachable from Tools, exposes export/import actions and proof-state recommendation counts, and keeps `Apply trusted (0)` disabled when no approved applicable recommendations are available.
- Notes: partial no-spend UI evidence collected 2026-06-16. Model Lab opens from Tools as an addable panel. Eval tab showed `Prepare smallest eval proof`, proof-gate guidance, 7 eval prompts, enabled model choices, provider-spend guard copy, and disabled `Run Eval (0 x 0 = 0)` before selections. Results currently shows `No results yet. Configure and run an eval.` when no report is selected in the current panel state. History shows existing eval report rows including `Eval 6/6/2026`, `manual-alt`, `manual`, and `test recommendations`, each labeled `proof unreviewed`. A client-only follow-up made History rows real keyboard-accessible buttons with labels such as `Open eval report manual-alt`; browser refresh confirmed 116 saved eval/bench history buttons. Selecting `manual-alt` opened Results with `Export proof brief`, `Export report`, `Recommendation trust: proof not approved yet`, `Review state: unreviewed`, `Mark approved`, `Needs attention`, and `Clear review`, with no document or chat-root horizontal overflow. Because the Codex in-app browser cannot save downloads, durable local export artifacts were generated from the same saved report data and recommendation-report endpoint under `docs/proof/`: `2026-06-16-model-lab-eval-manual-alt-proof-brief.md` and `2026-06-16-model-lab-eval-manual-alt-recommendation-report.md`. A later client-only responsiveness follow-up capped visible Model Lab History rows to the latest 20 eval reports and latest 20 bench runs, with count copy when older rows are hidden; live browser verification of the cap is still pending because the current browser driver timed out before clicking Tools in the heavy app state. A client-only follow-up added Routing Learning as an optional Tools panel, reusing `RoutingLearningPane`; browser refresh confirmed Tools now shows `Routing Learning Add Routing Learning to sidebar`, and opening it showed export/import actions, eval recommendation proof-state counts, `Apply trusted (0)` disabled, observed outcome summaries, route feedback controls, and recent routing decisions. This does not replace a provider-approved proof run, proof review decision, or approved recommendation apply proof.

## Model Lab Bench Proof

- Bench run id: pending
- Proof review status: pending
- Proof brief: `docs/proof/2026-06-16-model-lab-bench-4e08ec13-87a0-43d2-a1d9-c92cbd8615df-proof-brief.md`
- JSON artifact: `docs/proof/2026-06-16-model-lab-bench-4e08ec13-87a0-43d2-a1d9-c92cbd8615df.json`
- Validation summary: pending
- Notes: partial no-spend UI evidence collected 2026-06-16. Model Lab Bench tab currently shows `No bench results yet. Select tasks and run a bench.` when no bench run is selected in the current panel state. Model Lab History showed many bench entries labeled `proof unreviewed`, including `assisted export regression` rows with `running`, `1 tasks`, and dates from 2026-06-12 and 2026-06-16. A client-only follow-up made History rows real keyboard-accessible buttons with labels such as `Open bench run assisted export regression`; selecting a saved bench row opened Bench with `Export proof brief`, `Export JSON`, `Bench proof needs review`, `Review state: unreviewed`, `Mark approved`, `Needs attention`, `Clear review`, task/model evidence, trace proof, and validation status, with no document or chat-root horizontal overflow. Because the Codex in-app browser cannot save downloads, durable local export artifacts were generated from saved bench run `4e08ec13-87a0-43d2-a1d9-c92cbd8615df` under `docs/proof/`: `2026-06-16-model-lab-bench-4e08ec13-87a0-43d2-a1d9-c92cbd8615df-proof-brief.md` and `2026-06-16-model-lab-bench-4e08ec13-87a0-43d2-a1d9-c92cbd8615df.json`. Bench proof run and proof review decision remain pending.

## Settings Trust Surface Review

- Agent Roles: partial no-spend evidence collected 2026-06-16. Opening Settings > Agent Roles initially blanked the app body during live browser inspection. A client-only Settings pane error boundary now prevents whole-app blanking, and the underlying render failure was traced to a missing `useMemo` import in `src/components/SettingsModal.tsx`. Browser refresh confirmed Agent Roles now renders role assignments, `Auto configure roles`, role effort buckets, enabled model choices, and best-available model suggestions. Source inspection confirmed eval recommendation cards distinguish approved proof (`Apply`), unreviewed proof (`Apply manually` with manual-review title), and needs-attention proof (disabled until resolved). A client-only follow-up added an always-visible Agent Roles `Eval proof trust` callout: approved proof can be applied directly, unreviewed proof is manual-only and needs human review before changing defaults, and needs-attention proof stays blocked until resolved. Live browser verification of this new callout is still pending because the browser driver timed out while opening Settings in the current heavy app state.
- Auto-Router: partial no-spend evidence collected 2026-06-16. Settings > Auto-Router remained stable and showed classifier/default model selectors, threshold copy, catalog/configured/routed counts, synced configured candidates, candidate cards, effective-cost guidance, image/thinking capability badges, and add-candidate controls. A client-only follow-up added always-visible `Eval proof trust` guidance; browser refresh confirmed the pane now explains that approved proof is trusted, unreviewed proof requires manual review, and needs-attention proof must not be trusted until resolved. Candidate-specific approved/unreviewed apply proof remains pending.

## Manual UI Review

- Desktop check: partial direct evidence collected 2026-06-16. Live app at `http://127.0.0.1:5173/` loaded with title `OpenHarness - Universal AI Harness`; DOM landmarks showed sidebar, main chat area, and Environment rail; top bar exposed Router, Tools, and Environment controls; inspected drag/reorder selectors returned no matches. A follow-up check found the hidden Environment/Super panel could still widen the chat shell because its hidden transform moved it outside the root bounds; `src/styles/components.css` now keeps the hidden panel inside the chat bounds with `visibility: hidden`, and browser measurement confirmed `.chat-panel-root` `clientWidth` 1150 equals `scrollWidth` 1150 with document `scrollWidth` 1422 equal to `clientWidth` 1422.
- Narrow-width check: partial direct evidence collected 2026-06-16 at temporary narrow viewport. DOM landmarks showed sidebar and main area; inspected drag/reorder selectors returned no matches; document width did not exceed viewport width. A follow-up narrow pass at roughly 433px viewport found no document-level horizontal overflow, no environment/composer overlap, and no topbar/composer overlap. Sidebar and main rectangles overlap because the narrow sidebar is an intentional absolute overlay; an `elementsFromPoint` check inside the overlap showed sidebar/session elements as topmost over the main area with an opaque sidebar background, so this is overlay behavior rather than visible text-on-text collision. Settings initially had internal content overflow at narrow width, so `src/styles/components.css` now stacks Settings nav/content under 640px; browser refresh confirmed Settings modal, nav, and content all report no horizontal overflow. Narrow Model Lab and Routing Learning panel checks also reported no document or panel horizontal overflow. Other narrow modal/panel checks remain pending.
- Left work queue: partial no-spend evidence collected 2026-06-16 from existing `Color Clash (GPT)` session `launch this game for testubg`. The left pane shows a completed `coder run` nested under the owning project/session with `complete`, `Proof`, `Final answer ready (1217 chars)`, `minimax:MiniMax-M3 / minimax`, and elapsed age. This proves saved-run grouping and compact proof/model/status cues under the owning thread; live active-run grouping during a provider-backed Planning Room or execute/investigate scenario remains pending.
- Right Agent detail: partial no-spend evidence collected 2026-06-16 from the same saved session. Clicking that saved run row opened a right-side `Agent detail` overlay with `Back to chat`, run status counts, selected `coder run`, model/provider, duration, token/context summary, `Steering controls`, `Flag assumption`, `Add note`, run replay counts, latest proof, filters for Proof/Tools/Routing/Steering/Errors, and grouped trace entries. This proves completed-run history and inspector access; live active-run detail and steering-event recording remain pending.
- Chat/details/artifacts: partial no-spend evidence collected 2026-06-16 from existing `Color Clash (GPT)` session `launch this game for testubg`. The chat default view showed readable prose, headings, code snippets, copy buttons, compact `Export replay`, `Review 2 artifacts 2 cmds`, and `Details` affordances, plus Environment `Review changes` without dumping raw trace text into the message. Opening `Details` changed the affordance to `Hide details` and showed compact metadata (`Run replay`, `35 events`, `10 tools`, `final answer captured`, `Used 5 tools`, `High confidence`, `4 files read`, `10 tools`, `Prompt microscope`, `Actions`) without exposing raw `tool_call`, `model_request`, or `prompt_built` text. Opening `Review 2 artifacts 2 cmds` revealed command artifacts (`npm run relay`, `lsof -ti tcp:5174 | xargs kill`) inline. A later refresh still showed the artifact drawer toggle as `Review 2 artifacts 2 cmds` with no document or chat-root horizontal overflow, though the browser driver timed out while trying to expand it in the heavy saved session. A session API scan found 4 saved sessions and no message-level structured work-product artifacts, so team-plan/comparison/evidence/review-findings structured artifact rendering still lacks a saved-session UI proof. A client-only follow-up broadened `src/components/ArtifactDrawer.tsx` so plain markdown `Plan`, `Execution Plan`, `Implementation Plan`, `Team Plan`, `Review Findings`, `Findings`, and `Code Review Findings` sections become first-class reviewable artifacts in addition to existing code, diff, command, evidence, comparison, validation-proof, structured evidence, structured review-findings, structured comparison, structured validation-proof, and file-reference extraction. A later client-only follow-up keeps long artifact previews quiet by default and adds an inline `Show full` / `Collapse` control per long artifact, so large plans, evidence, diffs, and review findings stay reviewable without flooding the chat surface; browser proof remains pending. A later Review Changes/diff-surface proof attempt found a visible `button[aria-label="Review changes"]` with text `ChangesClean`; force-clicking it succeeded at the driver level, but the clean state did not open a visible review/diff surface or expose diff/proof cues. A client-only follow-up removed the inert clean-state disable path and clarified the no-project state: when no working directory is active, the visible Environment row now says `ChangesNo project`, has title `Open a project to review changes`, opens the `Review Changes` flyout, and the flyout shows `Open a project to review changes` with no chat-root or document horizontal overflow. A project-backed clean-state proof then selected `launch this game for testubg` under `/Users/kevink/Projects/Color Clash (GPT)`; the visible Environment row showed `ChangesClean`, title `Review clean working tree`, and opened the `Review Changes` flyout with `No changes — working tree is clean`, tabs `Summary`, `Files`, `Patches`, `Validate`, `Commit`, stats text `main`, no `+0/-0/0 files` noise, and no chat-root or document horizontal overflow. A changed-file proof created local app session `OpenHarness Review Changes Proof` for `/Users/kevink/Projects/OpenHarness`; Environment showed `52 files`, `Changes+5743-1550`, title `Review changed files`, and the flyout grouped changes by `Docs`, `Other`, `Server`, and `Source`. In the Files tab, selecting `src/components/ReviewChangesFlyout.tsx` rendered path `src/components/ReviewChangesFlyout.tsx`, stats `+111-5`, actions `Stage`, `Review`, `Explain`, `Propose patch`, 188 diff lines with `meta`, `added`, and `removed` classes, and no diff, chat-root, or document horizontal overflow. A client-only fallback now also shows `Could not load a diff for {selectedFile}` instead of leaving the diff pane blank if a selected file has no loadable diff.
- Theme texture readability: partial no-spend evidence collected 2026-06-16. Settings > Theme shows `Texture opacity` bounded from 0 to 18 with current value 0%, active theme `Glasshouse High Contrast`, active texture recipe `none`, and built-in texture choices including Paper Grain and Low Noise Matte. Computed visible contrast for current surfaces was high: settings modal 15.93, sidebar 15.04, settings card 14.02, top bar 15.04, environment rail 15.93, and main area 15.93. A follow-up Tools pass opened Terminal without running commands; terminal panel contrast measured 15.93, terminal input contrast measured 15.04, and texture opacity remained 0. A Files panel pass found the empty-state text at 3.97 contrast, so `src/styles/components.css` now uses `--text-secondary` for `.empty-state-text`; browser refresh confirmed Files panel contrast 15.93 and Files empty-state text contrast 7.29. A non-current texture pass applied representative built-in textured themes, then restored `Glasshouse High Contrast`: `System Classic High Contrast` and `System Classic Dark` used `Low Noise Matte · 4%`, while `Glasshouse Day` used `Paper Grain · 3%`. Before the pass, tiny Theme card texture metadata and `Active` labels were below normal-text contrast on dark cards, so `src/components/SettingsModal.tsx` now uses `--text-secondary` for those specific labels. Browser refresh confirmed `Texture: Low Noise Matte · 4%` and `Active` measure 6.41 contrast on the System Classic textured cards, `Texture: Paper Grain · 3%` and `Active` measure 6.35 on Glasshouse Day, Settings content contrast remains 14.86 to 16.03, and there is no document or Settings horizontal overflow. The active theme was restored to `Glasshouse High Contrast`, `Texture: none`, opacity 0%, with metadata/Active labels at 6.41 contrast. The Theme pane now states that textures are shell-only and automatically disabled when system reduced transparency is requested; browser proof of that copy and reduced-transparency behavior remains pending. Broader code-surface readability remains partially covered by Review Changes diff proof, but additional code-oriented panels can still be sampled.
- Issues found: browser screenshot capture timed out during this pass, so this file records DOM-backed notes instead of screenshot artifacts. Hidden Environment/Super panel horizontal overflow was found and fixed in `src/styles/components.css`; browser measurement now reports no chat-root or document horizontal overflow with the panel hidden. The Review Changes no-project, clean-project, and changed-file states now open readable flyout states instead of looking inert, noisy, or blank. Tiny Theme card texture metadata and `Active` labels were low-contrast on dark cards and were fixed with `--text-secondary`. Existing saved sessions do not currently contain structured work-product artifacts for direct team-plan/comparison/evidence/review-findings drawer proof. Narrow-width visual overlap/readability and broader artifact-type coverage still need manual confirmation.

Phase-mapped manual UI evidence:

| Kickoff area | Evidence status |
| --- | --- |
| Phase 1 chat-first shell | partial: desktop/narrow DOM notes show chat-first shell and no drag/reorder-like DOM affordances in default use; source inspection confirms `DEFAULT_LAYOUT` is chat-only and layout wrapper/engine contain no panel drag/drop handlers or reorder affordances; advanced panel chrome keeps title icons decorative and close buttons explicitly labelled/typed; composer textarea, action buttons, new-message scroll control, Sidebar shell controls, and active-work strip now have explicit accessibility labels/button semantics, with Sidebar project groups exposing expanded state, action/count labels, and labelled chat-list regions, decorative composer action icons, new-message scroll arrow, Sidebar control/work-queue icons, and active-work glyphs hidden from assistive tech; narrow sidebar/main geometric overlap is an opaque sidebar overlay, not visible text collision; hidden Environment/Super panel overflow was fixed and measured with no chat-root/document horizontal overflow |

## Advanced panel chrome cleanup — 2026-06-17

- Source inspection confirmed the active layout code keeps `DEFAULT_LAYOUT` as chat-only and does not expose panel drag/drop or reorder handlers in `PanelWrapper` or `LayoutEngine`.
- Advanced panel title icons are now decorative, and panel close controls are explicit typed buttons with `Close {panel} panel` labels.
- This is client-only Phase 1 polish. Browser/manual screenshot proof remains pending.
| Phase 2 agent work model | partial: completed `coder run` history appears under the owning `Color Clash (GPT)` session with status, proof, model/provider, and age; the chat active-work strip and Environment progress area now surface workflow, current task, model/provider, latest artifact/proof metadata, and labelled step-status lists from `agentWorkState`, the strip accessible label includes the same context, Sidebar project groups expose expanded state, action/count labels, and labelled chat-list regions, Sidebar session rows expose keyboard selection, current-chat state, and active-work counts, while run and phase rows expose focus labels with status/task/model/proof context, Environment rail section toggles own labelled variant-scoped detail regions, Environment rail and Sidebar decorative section/row/progress icons are hidden from assistive tech, and narrow screens hide the extra strip metadata to preserve the composer; live Planning Room or active multi-agent run proof remains pending |
| Phase 3 detail and steering | partial: clicking the completed run opens right-side Agent detail with proof, grouped trace, replay counts, model/provider, token/time summary, and steering controls; phase rows in the left queue now expose button keyboard activation for opening detail, and their inline detail chevrons expose disclosure button semantics; Agent detail cards now expose focus labels with role/name, status, task, model/provider, latest artifact cue, explicit selected-agent state, and controlled detail disclosure; Agent detail workflow strip is a labelled workflow progress group with decorative progress glyphs hidden from assistive tech; Agent detail shell back controls are typed and labelled, agent-list rows expose current detail state, Agent detail replay filters are a labelled group with selected state; Agent detail replay empty/filter-empty states are polite statuses; Agent detail replay summary is a labelled group with decorative summary/event/header/meta icons; active steering controls now show whether a note targets the orchestrator or selected agent for the next safe phase, whether controls save replay steering events, when artifact approval/revision is available, and that redirect can use the note draft as correction context; steering action/note controls include the target run or phase plus action purpose in accessible labels; recording a steering note during a live safe phase remains pending |

## Steering control explanation update — 2026-06-17

- Active Agent detail steering controls now explain that actions persist as replay steering events and clarify when artifact approval/revision controls appear.
- Steering action buttons now include purpose-specific labels for assumption flags, redirect, pause, cancel, proof requests, artifact approval, and revision feedback.
- Redirect now sends the current note draft as the correction reason when one is present, so users can redirect bad direction with context instead of firing a bare control.
- Completed/failed run copy now points reviewers to proof, routing, artifact feedback, and past steering replay filters without implying archived runs can still be steered.
- This is client-only explanation and accessibility hardening. It does not replace the remaining provider-approved live steering proof gate.
| Phase 4 calm chat and artifacts | partial: existing saved session showed calm prose by default, diagnostics behind Details, replay/artifact affordances, and command artifacts reviewable on demand without raw tool-event dumps; live thinking, typing, and browser preview loading indicators remain small polite status lines with decorative dots hidden from assistive tech; the Details toggle, tool-summary toggle, confidence details toggle, patch review action, replay export action, team-plan artifact actions, artifact drawer actions, Browser panel screenshot/input/actions, Review Changes dialog/buttons/tabs/tab panels/file rows, and suggested-action controls now have explicit accessibility labels/button semantics; Browser health-check glyphs are decorative, Browser quick URL presets are a labelled group with selected state, the Browser preview viewport is a URL-labelled region, Browser empty and reachable-without-screenshot states are polite statuses, and Browser preview errors are alerts with decorative warning glyphs; Artifact Drawer copy buttons expose copied state, and artifact approval/revision buttons now reference saved/error feedback status so replay-save confirmation is associated with the triggering controls; the Details toggle owns a labelled details region and hides its decorative chevron from assistive tech; the tool-summary toggle owns a labelled tool details region; the confidence toggle owns a labelled confidence details region, with confidence icons marked decorative; Artifact Drawer items are labelled regions, artifact content previews are labelled by artifact, long-artifact expansion controls own their preview content, and referenced-file chips are a labelled group; tool-summary, team-plan, artifact-drawer type/action/toggle/note, and patch/replay message-action icons are decorative; suggested-action decorative icons and duplicate count badges are hidden from assistive tech, and the expanded chip strip is a labelled group; Review Changes tabs now also support roving focus with ArrowLeft, ArrowRight, Home, and End; Review Changes dialogs are labelled by their visible title and close on Escape; Review Changes button-backed file rows keep flat row styling with focus-visible hover parity; the artifact drawer toggle now exposes expanded/collapsed state, artifact count, artifact-type summary, and ownership of the expanded artifact region to assistive tech; suggested next actions now default to a compact `Actions` affordance inside Details; ArtifactDrawer now extracts plain markdown plan and review-finding sections as first-class artifacts, but saved sessions do not currently contain structured work-product artifact examples; Review Changes no-project and clean-project flyouts now open with clear empty-state copy; changed-file Review Changes proof rendered grouped summary, tabs, actions, and actual diff lines without horizontal overflow |

## Artifact feedback status accessibility update — 2026-06-17

- Artifact approval and revision buttons now reference the saved/error/local feedback status region when one exists.
- The artifact review-note icon is decorative, so assistive tech receives the labelled input and status text instead of redundant icon noise.
- This is client-only artifact-review accessibility hardening. Browser proof on replay-backed artifact feedback remains pending.
| Phase 5 texture accessibility | partial: Theme settings expose bounded texture opacity; current active theme has texture `none` at 0% with high computed contrast across visible shell/settings/sidebar/terminal/files surfaces; representative non-current `Low Noise Matte · 4%` and `Paper Grain · 3%` textured themes were sampled, metadata contrast was fixed, the active theme was restored, the Theme pane now explains shell-only reduced-transparency behavior, reduced-transparency CSS now disables textures/blur and applies theme-provided solid fallback surface/border/shadow values to primary shell/panel surfaces, and reduced-motion CSS disables small chat/work/status pulsing animations plus shared `.spin` loaders; live reduced-transparency/browser proof remains pending |

## Reduced-transparency fallback update — 2026-06-17

- Reduced-transparency CSS now forces texture opacity to 0, disables backdrop blur, and sets surface opacity to solid when the system requests reduced transparency.
- Primary shell and panel surfaces now consume each theme's reduced-transparency fallback surface, border, and shadow variables instead of only hiding the texture overlay.
- Theme settings copy now explains that reduced transparency disables textures/blur and uses solid theme fallback colors.
- This is client-only accessibility hardening. Browser/manual proof with a reduced-transparency environment remains pending.
| Phase 6 model harness trust | partial: Model Lab showed eval proof-gate guidance, provider-spend guard copy, disabled run button with no selections, empty Results/Bench states when no current report is selected, History rows for eval and bench labeled `proof unreviewed`, saved eval/bench rows now open to proof/export/review screens, and local proof/export artifacts exist under `docs/proof/`; Model Lab sections now expose a labelled tablist with selected-state tabs, matching focusable tabpanels, ArrowLeft/ArrowRight/Home/End keyboard navigation, and roving tabindex; Model Lab prompt, task, and model selection now label selected items as provider-call matrix inputs and expose select/deselect semantics per item; Model Lab matrix caution boxes now announce selected run count plus provider-rate-limit/metered-billing risk with status/alert semantics based on matrix size, and Model Lab diagnostics announce proof-prep/error messages as live regions; Model Lab Eval/Bench launch buttons now surface provider-budget approval and selected matrix size directly in their visible label plus accessible title; Routing Learning is now reachable from Tools and shows export/import, proof-state counts, disabled trusted apply with no approved applicable recommendations, and route feedback controls; Auto-Router shows candidate/cost/threshold transparency plus always-visible eval proof trust guidance; Agent Roles renders role assignments and auto-configure suggestions, with labelled auto-configure/apply controls and decorative role/effort icons hidden from assistive tech; provider-approved proof runs, proof-review decisions, and approved/trusted apply behavior remain pending |

## Agent Roles proof-control accessibility update — 2026-06-17

- Agent Roles auto-configure is now an explicit typed button with a targeted label.
- Eval recommendation apply controls now expose whether the action is approved, manual-after-review, or blocked for needs-attention proof.
- Agent Roles recommendation cards now expose role/model labels, and empty effort buckets announce as polite statuses.
- Agent Roles recommended-model grid is now a labelled group.
- Agent Roles effort sections now expose labelled/described section relationships for their effort title and intent copy.
- Agent Roles role cards now expose role, description, current model, and thinking effort labels.
- Agent Roles effort-count badges now expose how many roles use each thinking-effort bucket.
- Agent Roles eval recommendation cards now expose role, recommended model, proof status, and recommendation reason as a grouped label.
- Model ability icons now expose available/unavailable capability labels while the SVG glyphs stay decorative.
- Role, effort, and thinking icons in Agent Roles are decorative, so the role text and proof-state labels carry the meaning.
- This is client-only trust/accessibility hardening. Browser/provider proof remains pending.

## Auto-Router candidate accessibility update — 2026-06-17

- Auto-Router classifier model, default fallback model, and routing threshold controls now have direct labels.
- Auto-Router catalog/configured/routed summary counts now expose explicit status labels.
- Auto-Router sync configured and add configured candidate controls are explicit typed buttons with targeted labels.
- Auto-Router candidate rows now expose candidate, source, effective cost, image support, and thinking support as grouped labels.
- Auto-Router candidate eval recommendation blocks now expose model, role, proof status, and reason as grouped labels.
- Candidate image/thinking toggles and effective-cost inputs now have model-specific labels.
- Auto-Router add-candidate model id, effective-cost, capability-card, image-support, and thinking-support controls now have direct labels instead of relying only on placeholders or visible text proximity.
- Auto-Router add-candidate action is an explicit typed button with a targeted label and decorative plus icon.
- Auto-Router no-candidates empty state now announces as a polite status.
- Candidate remove controls are explicit typed buttons with targeted labels and decorative trash icons.
- This is client-only trust/accessibility hardening. Browser/provider proof remains pending.

## Model Lab tab semantics update — 2026-06-17

- Model Lab header navigation now exposes a labelled `Model Lab sections` tablist.
- Eval, Tasks, Bench, Packs, Results, and History controls are typed tab buttons with selected-state semantics, specific labels, and matching controlled tabpanels.
- Model Lab tabs now support ArrowLeft, ArrowRight, Home, and End keyboard navigation.
- Model Lab tabs now use roving tabindex so the selected tab stays in the normal tab order and inactive tabs are reached by arrow-key navigation.
- Model Lab tabpanels are focusable so keyboard users can move from the selected tab into the active section predictably.
- This is client-only trust/accessibility hardening. Browser/provider proof remains pending.

## Model Lab advisory semantics update — 2026-06-17

- Model Lab matrix caution boxes now expose status/alert semantics and labels that include selected run count plus provider-rate-limit/metered-billing risk.
- Large matrix cautions use assertive alert semantics; small and moderate cautions use polite status semantics.
- Model Lab diagnostics now announce proof-prep/info/warning messages politely and errors assertively; dismiss controls are typed buttons with targeted labels.
- Model Lab proof-prep, task seeding, Eval launch, and Bench launch controls are explicit non-submit buttons.
- Model Lab prompt-pack folder prep, skill import, pack eval-run prep, and pack evidence export controls are explicit non-submit buttons with targeted labels.
- Prompt Packs import path has a direct label, import errors are alerts, and missing registry/manifests states are polite statuses.
- Prompt Pack trust/status pills now expose explicit prompt-pack trust and manifest-status labels instead of relying only on short colored text.
- Prompt Pack registry-root ready/missing status labels now include root location and path context.
- This is client-only trust/accessibility hardening. Browser/provider proof remains pending.

## Model Lab model selection clarity update — 2026-06-17

- Model Lab model selection is now a labelled group that states how many provider-call candidates are selected.
- The `Select all` control now says how many candidates it will select.
- Each model checkbox now exposes whether it will select or deselect that model for Model Lab provider-call runs.
- This is client-only trust/accessibility hardening. Provider-backed proof and browser verification remain pending.

## Model Lab prompt/task selection clarity update — 2026-06-17

- Model Lab eval prompt and bench task selections are now labelled groups that state how many matrix inputs are selected for provider-call runs.
- Prompt and task `Select all` controls now say how many items they will select.
- Each prompt/task checkbox now exposes whether it will select or deselect that item for Model Lab provider-call runs.
- This is client-only trust/accessibility hardening. Provider-backed proof and browser verification remain pending.

## Model Lab launch guard update — 2026-06-17

- Model Lab Eval and Bench launch buttons now say `after approval` when a runnable matrix is selected.
- The same controls expose provider-budget approval requirements and exact matrix size in button titles and accessible labels.
- Planning Room baseline additions are counted in the Bench launch guard when enabled.
- This is client-only trust-surface hardening. It does not replace provider-approved proof runs or final validation gates.

## Runtime Scenario Proof

- Planning Room session/run id: pending
- Planning Room evidence: pending
- Execute/investigate session/run id: pending
- Execute/investigate evidence: pending
- Steering event evidence: pending
- Notes: pending

## Final Gates

- `npm run lint`: pending
- `npm run build`: pending
- `npm run test:hardening` or scoped substitute: pending
- Runtime restart/reachability: pending
- Remaining risks: pending

## Agent steering safety update — 2026-06-16

- Tightened the Agent detail tracker so steering actions only render for active runs (`idle`, `running`, or `blocked`).
- Completed and failed runs now show a "Steering history" explanation instead of action buttons or note inputs, keeping replay/proof/routing inspection available without implying archived runs can still be steered.
- This is client-only hardening. It does not satisfy the remaining live active-run steering proof gate; that still needs an approved provider-backed run that records a real steering event in replay history.

## Artifact review feedback update — 2026-06-16

- `ArtifactDrawer` now gives reviewable artifacts lightweight feedback affordances: per-artifact flag toggles, review-note inputs, copy, and a `Revise` action that sends the selected artifact plus reviewer note back through the existing chat-send path.
- The drawer now uses the same calm collapsed entry point, but expanded artifacts can carry reviewer intent instead of being read-only snippets.
- This is client-only artifact-review progress toward Phase 4. It does not yet persist artifact comments as structured backend records, and it does not replace runtime proof that generated planning/comparison/evidence/review artifacts render in a saved provider-backed session.

## Durable artifact feedback update — 2026-06-16

- Artifact review controls now reuse the existing run steering persistence path when a message has `runTrace`: `Approve` records an `approve-artifact` steering event, and `Needs revision` records a `needs-revision` steering event with artifact label, type, id, and reviewer note.
- This means artifact approval/revision feedback can survive as replayable run-trace evidence in saved sessions without adding a separate backend comment store.
- If a message has no run trace, the controls remain local review helpers. A dedicated artifact-comment data model and direct UI proof of saved artifact feedback in a provider-backed session remain pending.

## API artifact type alignment — 2026-06-16

- `src/utils/api.ts` now includes the same `validation_proof` work-product artifact data shape already used by `src/types/index.ts` and `server/runTrace.ts`.
- `saveValidationProofArtifact` now accepts `ValidationProofCommand[]`, matching the persisted Review Changes proof artifact returned by the server.
- This is client type hardening only; it supports replayable validation-proof artifacts but does not count as lint/build proof because those gates have not been run.

## Artifact feedback replay acknowledgement — 2026-06-16

- `sendRunSteering` now returns the persisted `HarnessRun` returned by the existing server steering endpoint instead of discarding it.
- Artifact approval/revision controls now show `Saved to replay` with the returned run event count when the feedback save succeeds.
- This improves client acknowledgement of durable replay feedback. App-wide replacement of the in-memory message run trace and browser proof on a saved provider-backed artifact session remain pending.

## Artifact feedback app-state refresh — 2026-06-16

- Artifact approval/revision now flows through the same app-owned `handleRunSteer` path used by agent-detail steering instead of calling the API directly from the drawer.
- When the server returns a persisted run, `App` replaces matching message and Agent Work run traces with that saved run, so replay counts can stay aligned with the durable session state after artifact feedback.
- `ArtifactDrawer` still shows the returned event count when available and falls back to local-only feedback for messages without a run trace or steering callback.
- Browser proof on a saved provider-backed artifact session and final lint/build gates remain pending.

## Steering callback type alignment — 2026-06-16

- Steering callback props now consistently allow returning the persisted `HarnessRun` across `LayoutEngine`, `PanelContent`, `ChatPanel`, `MessageBubble`, `ArtifactDrawer`, `AgentFocusPanel`, and `SubAgentTracker`.
- `App` now imports `HarnessRun` for the parent-owned `handleRunSteer` return type, keeping artifact feedback and agent-detail steering on the same replay-refresh contract.
- This is client type hardening only; lint/build and browser proof remain pending.

## Artifact feedback save confirmation hardening — 2026-06-16

- `ArtifactDrawer` now treats artifact approval/revision as replay-saved only when the shared steering callback returns a persisted `HarnessRun`.
- If a run trace exists but the save cannot be confirmed, the drawer shows `Could not confirm replay save` instead of marking the artifact feedback as saved.
- Messages without a run trace still support local-only review feedback, but replay persistence is no longer implied without returned-run evidence.

## Artifact feedback local-only copy hardening — 2026-06-16

- Artifact feedback now distinguishes local-only review state from replay-saved state.
- Messages without a run trace show `Approval noted`, `Revision noted`, and `Local note only` instead of implying durable replay persistence.
- Replay-backed feedback still requires a returned persisted run before showing `Saved to replay`.

## Review Changes proof artifact chat refresh — 2026-06-16

- `ReviewChangesFlyout` now emits the returned message from `saveValidationProofArtifact` after a successful proof save.
- `App` maps that saved proof message into the current chat stream and restores its run-trace-backed Agent Work entry, so validation proof artifacts can become visible immediately after saving instead of waiting for a session reload.
- Browser proof of this flow remains pending, and lint/build gates have not been run.

## Steering replay persistence hardening — 2026-06-16

- `App.handleRunSteer` no longer appends an optimistic steering event to message or Agent Work run traces before persistence succeeds.
- The UI now updates steering replay state from the persisted `HarnessRun` returned by the server, and only then adds the steering status message to the matching Agent Work entry.
- This keeps visible replay state aligned with saved session state; live browser proof and final validation gates remain pending.

## Review Changes proof save copy — 2026-06-16

- The Review Changes validation proof save button now confirms `Saved to chat` after a successful save, matching the current behavior where the returned proof artifact message is appended to the active chat.
- The button tooltip now explains that proof is saved into the session and shown in chat as a review artifact.

## Review Changes proof save reset — 2026-06-16

- The Review Changes validation proof save confirmation now resets when the underlying validation command results change.
- The reset key is based on command id, command text, status, exit code, duration, and output, so the `Saved to chat` confirmation stays tied to the proof payload rather than a previous save.
- The reset also runs when session id or working directory changes, matching the proof payload fields shown in the saved artifact.

## Review Changes proof append state cleanup — 2026-06-16

- `App.handleProofArtifactSaved` now appends the saved proof message without calling `setLastAutoRouterStep` from inside the `setMessages` updater.
- If the saved proof message itself carries an auto-router step, that router marker is updated separately from the message append.

## Review Changes proof save session summary — 2026-06-16

- After a validation proof artifact is saved, `App.handleProofArtifactSaved` now updates the matching session summary preview, updated timestamp, and message count.
- This keeps the sidebar/session list aligned with the proof message that was appended to the active chat. It does not add a dedicated artifact-count field to session summaries.

## Review Changes proof save dedupe — 2026-06-16

- `App.handleProofArtifactSaved` now tracks saved proof message ids before mutating chat or session summary state.
- Duplicate proof-save callbacks for the same message id no longer append duplicate chat messages or inflate the sidebar message count.
- The handler now also exits if the saved proof message is already present in the current chat, keeping sidebar message counts aligned with actual chat messages.

## Review Changes proof session preview — 2026-06-16

- Saved validation proof messages now update the session preview from the validation proof artifact title and summary when available.
- This keeps the sidebar preview readable as proof status, rather than showing the first characters of the raw markdown proof body.

## Validation proof artifact drawer dedupe — 2026-06-16

- `ArtifactDrawer` now skips markdown `Validation Proof` section extraction when the message run trace already contains a structured `validation_proof` artifact.
- Saved Review Changes proof messages should therefore show one proof artifact in the drawer instead of duplicate structured and markdown proof entries.

## Structured artifact drawer dedupe — 2026-06-16

- `ArtifactDrawer` now builds one shared structured-artifact list from the run trace and uses it to suppress duplicate markdown extraction for evidence, review findings, comparisons, and validation proof.
- Markdown sections remain supported as a fallback when no structured equivalent exists, but structured run-trace artifacts are preferred when present.

## Team plan artifact drawer support — 2026-06-16

- Structured `team_plan` run-trace artifacts now appear in `ArtifactDrawer` as plan artifacts using their raw markdown or summary.
- Markdown plan section extraction is skipped when a structured team plan exists, so Planning Room outputs do not show duplicate plan artifacts.
- The drawer now correctly receives the shared `onRunSteer` callback prop, allowing artifact approval/revision controls to use the persisted steering path.

## Structured artifact feedback ids — 2026-06-16

- Drawer artifacts now preserve the source run-trace artifact id for structured team plans, evidence, review findings, comparisons, and validation proof.
- Artifact approval/revision notes now use that source artifact id when available, falling back to the drawer-local artifact id only for markdown/code-derived artifacts.
- Artifact `Revise` prompts now include the same source artifact id when available, so follow-up revision requests can point back to the original structured artifact.

## Structured artifact drawer type hardening — 2026-06-16

- `ArtifactDrawer` now uses explicit type guards for structured team plan, evidence, review findings, comparison, and validation proof artifacts.
- This keeps structured artifact rendering independent of compiler-specific inferred `filter` narrowing.

## Artifact feedback state cleanup — 2026-06-16

- Artifact feedback state now clears stale local-only markers after a replay-confirmed save.
- Failed replay saves now clear stale saved/local-only success markers and show only the current error state.
- Local-only feedback still clears replay-save state, keeping `Local note only` separate from `Saved to replay`.

## Artifact feedback in-flight guard — 2026-06-16

- Artifact approval/revision feedback now tracks a per-artifact saving state.
- Approve and needs-revision buttons are disabled while a replay save is in flight, and show `Saving...` until the save resolves.
- This prevents duplicate steering submissions from repeated clicks during a pending save.
- The artifact note input and `Revise` action now also disable while that artifact's feedback save is pending, keeping the row state consistent during persistence.
- The drawer now tracks which verdict is saving, so only the clicked approve/revision control shows `Saving...` while the sibling control remains disabled with its normal label.
- Artifact rows now expose `aria-busy` while feedback is saving, and disabled feedback controls use saving-specific titles.
- Artifact feedback success/local-only messages now use polite status live regions, while save errors use alert semantics.
- Artifact feedback, revise, and copy controls now include artifact-specific `aria-label`s so repeated artifact rows have distinguishable commands.
- Artifact review-note inputs now use `aria-describedby` to reference the current feedback status message when one is present.
- Artifact feedback status ids are now sanitized before being used as DOM ids for `aria-describedby`.
- Artifact feedback status ids now include both message id and artifact id, keeping status references unique across multiple assistant messages.
- Artifact drawer command buttons now explicitly use `type="button"` so they cannot accidentally submit parent forms if the drawer is reused in a form-like surface.

## Review Changes proof save retry state — 2026-06-16

- The validation proof save flow now clears the previous `Saved to chat` success state before each new save attempt.
- If a retry fails, the UI shows the current error without keeping stale success copy from an earlier save.

## Left work queue navigation accessibility update — 2026-06-17

- Sidebar Chat/Projects panel toggles now expose button type, expanded state, and controlled panel relationships.
- Project session rows now support keyboard activation with Enter/Space, expose the current chat state, and include preview/update/active-work context in their labels.
- Phase detail disclosure buttons now own their expanded detail region through `aria-controls`.
- This is client-only Phase 2 navigation/accessibility hardening. Live active-run proof remains pending.

## Active-work checklist semantics update — 2026-06-17

- Chat active-work strip steps now expose a labelled list with each step's visible label and status.
- Agent detail workflow progress steps now expose the same labelled step-status list semantics.
- Environment rail progress steps now expose labelled list items instead of relying on visual status dots alone.
- This is client-only Phase 2 accessibility hardening. Live active-run proof remains pending.

## Left work queue run-phase relationship update — 2026-06-17

- Sidebar run rows now expose the controlled phase group for that run through `aria-controls`.
- Run child phase lists now expose a labelled group using the run label, so the left work queue preserves the run-to-phase relationship for assistive navigation.
- This is client-only Phase 2 navigation/accessibility hardening. Live active-run proof remains pending.

## Active-work current-step semantics update — 2026-06-17

- Chat active-work, Agent detail workflow, and Environment progress steps now mark the running item with `aria-current="step"`.
- This keeps the current run phase explicit instead of relying on color or spinner motion alone.
- This is client-only Phase 2 accessibility hardening. Live active-run proof remains pending.

## Agent detail inspector shell accessibility update — 2026-06-17

- Agent detail back controls now use explicit button type and accessible labels, with decorative header/empty-state icons hidden from assistive tech.
- Agent detail list rows now expose current selected detail state plus status, task, provider, and model context.
- Agent detail card disclosure is now a real typed button with expanded state and controlled expanded-detail region, instead of an interactive chevron icon.
- This is client-only Phase 3 inspector/accessibility hardening. Live steering proof remains pending.

## Agent detail nested-control cleanup — 2026-06-17

- Agent detail cards now expose as labelled groups instead of clickable card-sized buttons, avoiding nested interactive controls around steering inputs and replay filters.
- Advanced Agent Work panel focus behavior remains available through an explicit `Focus` button instead of relying on the whole card as a control.
- The explicit focus and disclosure controls keep the inspector flat while preserving keyboard-operable navigation.
- This is client-only Phase 3 inspector/accessibility hardening. Browser/live steering proof remains pending.

## Agent detail region labelling update — 2026-06-17

- Agent detail shell now labels the agent list and selected-agent detail region, so the right-hand inspector exposes its list/detail structure directly.
- Agent detail header stats now announce a run summary with running, waiting, blocked, complete, and failed counts.
- Embedded Agent Work summaries now announce working, blocked, waiting, failed, complete, and token counts as a status summary.
- This is client-only Phase 3 inspector/accessibility hardening. Browser/live steering proof remains pending.

## Left project group nested-control cleanup — 2026-06-17

- Project group headers no longer expose the whole header as a button while also containing New/Delete controls.
- The project collapse affordance is now an explicit typed button with expanded state and controlled chat-list relationship.
- This keeps the left pane's project/thread hierarchy keyboard-operable without nested interactive controls.
- This is client-only Phase 2 navigation/accessibility hardening. Browser/live active-run proof remains pending.

## Left session row nested-control cleanup — 2026-06-17

- Session rows no longer expose the whole row as a button while also containing a delete-chat button.
- Opening a chat is now an explicit typed `session-select-button` with current-chat and active-work context; deleting a chat remains a separate labelled button.
- This keeps the project/thread tree keyboard-operable without nested interactive controls.
- This is client-only Phase 2 navigation/accessibility hardening. Browser/live active-run proof remains pending.

## Left session row action layout follow-up — 2026-06-17

- After splitting open-chat and delete-chat controls, the delete action is anchored as an independent quiet row action.
- The explicit session-select button reserves space for that delete action so row text and controls do not collide.
- This is client-only Phase 2 layout/accessibility hardening. Browser/live proof remains pending.

## Left pane shell-control labels update — 2026-06-17

- Sidebar Chat and Projects toggles now expose direct hide/show panel labels in addition to expanded state and controlled panel relationships.
- The New Project action now has a direct label for opening a project folder.
- This is client-only Phase 2 navigation/accessibility hardening. Browser/live proof remains pending.

## Left session row button content correction — 2026-06-17

- The explicit open-chat row button now uses inline-safe wrappers for title, preview, and timestamp content instead of nesting block containers inside the button.
- CSS preserves the same stacked row layout for those wrappers.
- This is client-only Phase 2 markup/layout hardening after the session-row nested-control split. Browser/live proof remains pending.

## Left session running indicator markup correction — 2026-06-17

- The active-running indicator inside the explicit open-chat row button now uses an inline-safe element.
- This completes the session row button markup cleanup after splitting open-chat and delete-chat controls.
- This is client-only Phase 2 markup hardening. Browser/live proof remains pending.

## Left pane hierarchy status labels update — 2026-06-17

- Project chat counts now expose labelled project-specific count context instead of relying on a bare number.
- Empty run phase groups now announce `No phase updates yet` as a polite status.
- This is client-only Phase 2 hierarchy/accessibility hardening. Browser/live active-run proof remains pending.

## Left phase row nested-control cleanup — 2026-06-17

- Phase rows in the left work queue now expose as labelled groups instead of clickable wrappers around disclosure controls.
- Focusing a phase is now an explicit typed `Focus` button, while the phase disclosure remains a separate expanded-state control.
- This keeps the run/phase tree keyboard-operable without nested interactive controls.
- This is client-only Phase 2 navigation/accessibility hardening. Browser/live active-run proof remains pending.

## Agent work empty-state semantics update — 2026-06-17

- Agent Work and Agent detail no-run empty states now announce as polite status regions.
- Decorative empty-state icons are hidden from assistive tech, keeping the quiet no-run state focused on the useful message.
- This is client-only Phase 2/3 accessibility hardening. Browser/live active-run proof remains pending.

## Active-work detail-opening semantics update — 2026-06-17

- Chat active-work details control, left run focus controls, left phase focus controls, and advanced Agent Work focus controls now explicitly describe opening or focusing the right-hand Agent detail inspector.
- This keeps detail-opening behavior explicit without claiming ownership of inspector DOM rendered by another component.
- This is client-only Phase 2/3 navigation/accessibility hardening. Browser/live active-run proof remains pending.

## Right-hand inspector region semantics update — 2026-06-17

- The Agent detail pane now identifies as an `Agent detail inspector` complementary region.
- The embedded Agent Work tracker now identifies as an `Agent work run details` region.
- This aligns the right-hand detail pane with the kickoff requirement that selected work opens a clear inspector, not an unlabeled layout mode.
- This is client-only Phase 3 inspector/accessibility hardening. Browser/live steering proof remains pending.

## Agent detail current-step status update — 2026-06-17

- Running or blocked Agent detail cards now expose the current run step as a polite status with a direct `Current run step` label.
- This makes live progress in the right-hand inspector explicit instead of relying on a styled text line.
- This is client-only Phase 3 inspector/accessibility hardening. Browser/live active-run proof remains pending.

## Agent detail metadata group update — 2026-06-17

- Agent detail metadata chips now expose a grouped label covering model, provider, latest artifact cue, duration, token budget, summarized context, and compressed context counts when present.
- This keeps the right-hand inspector's trust signals readable beyond the visual chip row.
- This is client-only Phase 3 inspector/accessibility hardening. Browser/live steering proof remains pending.

## Agent detail replay event list update — 2026-06-17

- Agent detail replay events now expose as a labelled list tied to the selected run or phase.
- Individual replay event rows now expose labelled list items using the event title and detail text.
- This makes the inspector's proof trail explicit instead of relying only on visual event rows.
- This is client-only Phase 3 replay/proof accessibility hardening. Browser/live steering proof remains pending.

## Agent detail steering group semantics update — 2026-06-17

- Agent detail steering sections now expose as labelled groups for the selected run or phase.
- Available steering actions now expose a grouped intervention surface instead of relying only on individual button labels.
- This strengthens the right-hand inspector path for correcting work without treating steering as ordinary chat.
- This is client-only Phase 3 steering/accessibility hardening. Live steering proof remains pending.

## Agent detail steering note group update — 2026-06-17

- Agent detail steering note input and submit control now expose as one labelled steering-note group for the selected run or phase.
- This keeps correction notes grouped as intervention controls instead of incidental form fields.
- This is client-only Phase 3 steering/accessibility hardening. Live steering proof remains pending.

## Agent detail inactive-steering status update — 2026-06-17

- Agent detail inactive-steering explanations now announce as polite status messages when steering actions are unavailable.
- This keeps completed/failed run detail clear about why intervention controls are not shown while preserving replay/proof inspection guidance.
- This is client-only Phase 3 steering/accessibility hardening. Live steering proof remains pending.

## Agent detail replay filter current-state update — 2026-06-17

- Agent detail replay filter buttons now expose the selected replay scope as current in addition to pressed state.
- This makes proof/replay scope explicit while inspecting filtered run events.
- This is client-only Phase 3 replay/proof accessibility hardening. Browser/live proof remains pending.

## Agent work status badge labelling update — 2026-06-17

- Agent detail status badges now expose direct run/phase status labels.
- Left work queue run status badges now include run-specific status context instead of relying on the visible badge text alone.
- This is client-only Phase 2/3 work-visibility accessibility hardening. Browser/live proof remains pending.

## Agent detail list metadata group update — 2026-06-17

- Agent detail list-row metadata now exposes token count and duration as a grouped label.
- This keeps the inspector list's quick trust signals available beyond compact visual chips.
- This is client-only Phase 3 inspector/accessibility hardening. Browser/live proof remains pending.

## Agent detail list status glyph update — 2026-06-17

- Agent detail list-row status glyphs now expose direct status labels while keeping pulse/icon visuals decorative.
- This keeps the selected-agent list readable when status is represented by color, icon, or motion.
- This is client-only Phase 3 inspector/accessibility hardening. Browser/live proof remains pending.

## Left run metadata group update — 2026-06-17

- Left work queue run metadata now exposes model, provider, and elapsed time as a grouped label.
- This keeps run trust signals available beyond the compact visual metadata column.
- This is client-only Phase 2 work-visibility/accessibility hardening. Browser/live proof remains pending.

## Left run proof cue group update — 2026-06-17

- Left work queue run proof/artifact cues now expose as grouped labels using the proof label and value.
- This makes the latest proof or artifact cue explicit in the run row instead of relying only on adjacent visual text.
- This is client-only Phase 2 work-visibility/accessibility hardening. Browser/live proof remains pending.

## Left run current-task label update — 2026-06-17

- Left work queue run task lines now expose direct `Current task` labels.
- This strengthens the run row's explanation of what the selected work is doing now.
- This is client-only Phase 2 work-visibility/accessibility hardening. Browser/live proof remains pending.

## Left run intervention cue labels update — 2026-06-17

- Left work queue attention markers now expose run-specific `needs attention` labels.
- Steering-available markers now expose run-specific labels so users can identify when intervention is possible.
- This supports the kickoff requirement that users can see when incorrect work can be steered without stopping the whole run.
- This is client-only Phase 2/3 work-visibility/accessibility hardening. Browser/live steering proof remains pending.

## Left phase metadata group update — 2026-06-17

- Left work queue phase metadata now exposes provider, model, latest artifact/proof cue, status, elapsed time, and task as a grouped label.
- This keeps dense phase-row trust signals available beyond compact visual text.
- This is client-only Phase 2 work-visibility/accessibility hardening. Browser/live proof remains pending.

## Left run row control-relationship correction — 2026-06-17

- Left work queue run rows no longer claim `aria-controls` ownership over the child phase group because they open Agent detail rather than expanding/collapsing that group.
- The child phase group remains separately labelled, and run rows continue to indicate that they open a detail surface.
- This corrects an earlier client-only Phase 2 navigation semantic overreach. Browser/live proof remains pending.

## Left active-work group label update — 2026-06-17

- The active run tree under the selected chat now exposes as a labelled `Active work for {chat title}` group.
- This makes the project/thread/run hierarchy explicit at the point where active work is nested under the owning chat.
- This is client-only Phase 2 work-visibility/accessibility hardening. Browser/live proof remains pending.

## Left active-work list semantics update — 2026-06-17

- The active work block under the selected chat now exposes as a labelled list.
- Each run group in that block now exposes as a list item, making the chat-to-run hierarchy clearer while navigating the left pane.
- This is client-only Phase 2 work-visibility/accessibility hardening. Browser/live proof remains pending.

## Left run phase-list semantics update — 2026-06-17

- Phase containers under each left work queue run now expose as labelled phase lists.
- Individual phase rows now expose as list items, preserving the run-to-phase hierarchy for assistive navigation.
- This is client-only Phase 2 work-visibility/accessibility hardening. Browser/live proof remains pending.

## Left phase detail region label update — 2026-06-17

- Expanded phase detail panels now expose as labelled regions tied to the phase name.
- This completes the phase-row disclosure relationship with a named detail target.
- This is client-only Phase 2 work-visibility/accessibility hardening. Browser/live proof remains pending.

## Agent detail card label correction — 2026-06-17

- Agent detail card group labels now describe the run or phase directly instead of saying `Focus`, because focus behavior is handled by explicit controls.
- This keeps the passive inspector card semantics aligned with the earlier nested-control cleanup.
- This is client-only Phase 3 inspector/accessibility hardening. Browser/live proof remains pending.

## Left project chat-list semantics update — 2026-06-17

- Project chat containers now expose as labelled chat lists.
- Individual chat/session rows now expose as list items under their owning project group.
- This makes the project-to-thread hierarchy explicit in the left pane while preserving the flat visual layout.
- This is client-only Phase 2 navigation/accessibility hardening. Browser/live proof remains pending.

## Left pane navigation landmark update — 2026-06-17

- The left sidebar now identifies as `Project and chat navigation`.
- Sidebar Chat/Projects/settings controls now sit in a labelled `Sidebar panels` control group.
- This supports the kickoff requirement that the left pane explain project, thread, run, and agent placement without adding visual chrome.
- This is client-only Phase 2 navigation/accessibility hardening. Browser/live proof remains pending.

## Left pane content-region label update — 2026-06-17

- Sidebar panel content now exposes as a labelled region under the sidebar panel controls.
- This completes the outer left-pane structure: navigation landmark, panel controls, and panel content region.
- This is client-only Phase 2 navigation/accessibility hardening. Browser/live proof remains pending.

## Active-work detail-opening semantic correction — 2026-06-17

- Active-work and run/phase focus controls no longer expose `aria-haspopup="dialog"` because they open or focus the right-hand inspector, not an ARIA dialog.
- Explicit labels still describe opening/focusing Agent detail, while the inspector itself is labelled as a complementary region.
- This corrects an earlier client-only Phase 2/3 navigation semantic overreach. Browser/live proof remains pending.

## Chat active-work detail label update — 2026-06-17

- Chat active-work strip now labels its detail-opening action as `Agent detail` instead of generic `Details`.
- The action title and accessible label now match the right-hand inspector destination.
- This is client-only Phase 2/3 navigation clarity hardening. Browser/live proof remains pending.

## Agent detail picker list semantics update — 2026-06-17

- Agent detail picker now exposes as a labelled list of agents.
- Each selectable agent row now sits in a list item while preserving the explicit button control for selecting that agent's detail.
- This keeps the right-hand inspector list/detail structure explicit without turning buttons into list roles.
- This is client-only Phase 3 inspector/accessibility hardening. Browser/live proof remains pending.

## Agent detail replay empty-scope update — 2026-06-17

- Agent detail replay empty states now name the selected replay scope when no events match the active filter.
- This keeps proof inspection clear when a filtered replay view is empty.
- This is client-only Phase 3 replay/proof accessibility hardening. Browser/live proof remains pending.

## Agent detail replay filter count labels update — 2026-06-17

- Agent detail replay filter controls now include the number of matching events in their labels before switching scope.
- This makes proof/replay navigation clearer when deciding whether to inspect all events, proof, tools, routing, steering, or errors.
- This is client-only Phase 3 replay/proof accessibility hardening. Browser/live proof remains pending.

## Agent detail replay filter visible-count update — 2026-06-17

- Agent detail replay filters now show compact visible event-count chips while preserving count-aware accessible labels.
- This keeps replay/proof scope easier to scan without adding another panel or noisy detail surface.
- This is client-only Phase 3 replay/proof clarity hardening. Browser/live proof remains pending.

## Agent detail replay active-count styling update — 2026-06-17

- Active replay filter count chips now inherit active filter styling instead of remaining muted.
- This keeps the selected proof/replay scope count readable in the inspector.
- This is client-only Phase 3 replay/proof clarity hardening. Browser/live proof remains pending.

## Agent detail replay count-chip title update — 2026-06-17

- Visible replay filter count chips now expose pointer titles explaining the matching-event count.
- The chips remain hidden from assistive tech because the parent filter labels already include the same counts.
- This is client-only Phase 3 replay/proof clarity hardening. Browser/live proof remains pending.

## Agent detail replay filter alignment update — 2026-06-17

- Replay filter buttons now use inline-flex alignment so filter labels and count chips read as one compact control.
- This keeps the proof-scope count chips visually intentional after adding visible event counts.
- This is client-only Phase 3 replay/proof clarity hardening. Browser/live proof remains pending.

## Environment active-work metadata group update — 2026-06-17

- Environment rail active-work metadata now exposes current task, model/provider, and latest artifact/proof cue as a grouped label.
- This keeps the secondary progress surface aligned with the chat strip and left work queue trust-signal semantics.
- This is client-only Phase 2 work-visibility/accessibility hardening. Browser/live proof remains pending.

## Environment active-work title label update — 2026-06-17

- Environment rail active-work title remains a plain visible workflow label.
- The surrounding active-work container owns the polite progress status so the workflow label is announced once.
- This is client-only Phase 2 work-visibility/accessibility hardening. Browser/live proof remains pending.

## Chat active-work metadata group update — 2026-06-17

- Chat active-work strip metadata now exposes current task, model/provider, and latest artifact/proof cue as a grouped label.
- This keeps the primary active-work strip aligned with the Environment progress metadata semantics.
- This is client-only Phase 2 work-visibility/accessibility hardening. Browser/live proof remains pending.

## Chat active-work title label update — 2026-06-17

- Chat active-work strip title remains a plain visible workflow label.
- The surrounding strip host owns the polite progress status so the workflow label is announced once.
- This is client-only Phase 2 work-visibility/accessibility hardening. Browser/live proof remains pending.

## Chat active-work progress status update — 2026-06-17

- Chat active-work strip host now announces as a polite active-work progress status surface.
- This makes the primary todo strip identifiable as current run progress rather than ordinary chat content.
- This is client-only Phase 2 work-visibility/accessibility hardening. Browser/live proof remains pending.

## Environment active-work progress status update — 2026-06-17

- Environment rail active-work card now announces as a polite active-work progress status surface.
- This keeps the secondary progress surface aligned with the chat active-work strip semantics.
- This is client-only Phase 2 work-visibility/accessibility hardening. Browser/live proof remains pending.

## Agent detail objective label update — 2026-06-17

- Agent detail task text now exposes as an `Agent objective` label, with a fallback when no objective is recorded.
- This aligns the right-hand inspector with the kickoff requirement to show the selected agent's current objective.
- This is client-only Phase 3 inspector/accessibility hardening. Browser/live proof remains pending.

## Agent detail waiting-status summary update — 2026-06-17

- Agent detail header summary now includes waiting agents alongside running, blocked, complete, and failed counts.
- The status summary label now includes waiting count too, aligning the inspector with the kickoff status model.
- This is client-only Phase 3 inspector/status visibility hardening. Browser/live proof remains pending.

## Agent detail failed-status wording update — 2026-06-17

- Agent detail header summary now uses `failed` instead of `errored` for error-state agents.
- The visible summary pill and accessible status label now match the kickoff status vocabulary: waiting, running, blocked, complete, failed.
- This is client-only Phase 3 inspector/status visibility hardening. Browser/live proof remains pending.

## Agent detail picker status wording update — 2026-06-17

- Agent detail picker row labels now map raw `idle` and `error` states to kickoff vocabulary: `waiting` and `failed`.
- Status glyph labels now use the same vocabulary as the Agent detail header summary.
- This is client-only Phase 3 inspector/status visibility hardening. Browser/live proof remains pending.

## Agent detail picker objective label update — 2026-06-17

- Agent detail picker row task text now exposes as an `Agent objective` label, matching the selected detail card objective wording.
- This keeps list/detail objective language consistent in the right-hand inspector.
- This is client-only Phase 3 inspector/accessibility hardening. Browser/live proof remains pending.

## Agent detail picker model-provider line update — 2026-06-17

- Agent detail picker rows now show a compact provider/model line below the objective when available.
- The provider/model line carries a direct label, keeping visible trust signals aligned with the picker row's accessible context.
- This is client-only Phase 3 inspector/model visibility hardening. Browser/live proof remains pending.

## Active-work inspector wording reconciliation — 2026-06-17

- Older proof/handoff wording that said Agent detail controls opened a dialog-style surface was reconciled to the current right-hand inspector semantics.
- This keeps the closeout evidence aligned with the code, where Agent detail is labelled as a complementary inspector region rather than an ARIA dialog.
- This is docs-only evidence hygiene after the app restart. Browser/live proof remains pending.

## Agent detail status wording reconciliation — 2026-06-17

- Older proof wording that still said Agent detail announced `errored` counts was reconciled to the current `failed` status vocabulary.
- This keeps the evidence aligned with the kickoff status model and the current Agent detail implementation.
- This is docs-only evidence hygiene after the app restart. Browser/live proof remains pending.

## Active-work duplicate status cleanup — 2026-06-17

- Chat and Environment active-work containers remain polite status surfaces for current workflow progress.
- Duplicate status roles were removed from the inner workflow titles so the same active workflow label does not announce twice.
- This is client-only Phase 2 work-visibility/accessibility hardening. Browser/live proof remains pending.

## Calm chat details affordance update — 2026-06-17

- Assistant message details remain collapsed behind the quiet `Details` control.
- The collapsed details control now exposes an accessible summary of the hidden surfaces, such as tool details, confidence, team plan, prompt microscope, or next actions.
- This improves discoverability without adding visible message-level clutter. Browser/live proof remains pending.

## Calm streaming thinking update — 2026-06-17

- Streaming assistant thinking now stays as a compact status line in the chat stream.
- Inline thinking preview text was removed from the main message body so raw reasoning does not become default chat clutter.
- This is client-only Phase 4 calm-chat hardening. Browser/live proof remains pending.

## Agent detail replay proof summary update — 2026-06-17

- Agent detail replay summaries now distinguish validation-proof artifacts from general artifacts.
- Replay summaries also surface context-file counts from repo map and context pack events.
- This strengthens the right-hand inspector's proof and context visibility without adding another panel. Browser/live proof remains pending.

## Agent detail file-evidence replay wording update — 2026-06-17

- Agent detail replay events now label repo-map and context-pack events as file evidence: `Repo files surfaced` and `Files in context`.
- Replay event details now include a short surfaced/context file list when available.
- This makes existing run-trace file evidence clearer in the right-hand inspector without adding new backend trace data. Browser/live proof remains pending.

## Agent detail file replay filter update — 2026-06-17

- Agent detail replay filters now include a `Files` scope.
- The `Files` replay scope includes repo-map, context-pack, and artifact events so users can jump directly to file/context/proof evidence without scanning the full replay.
- This is client-only Phase 3 inspector/proof navigation hardening. Browser/live proof remains pending.

## Calm suggested-actions recollapse update — 2026-06-17

- Expanded suggested next actions now include a `Collapse` control.
- Users can inspect suggested actions and return them to the compact `Actions` affordance without dismissing the actions entirely.
- This is client-only Phase 4 calm-chat hardening. Browser/live proof remains pending.

## Calm suggested-actions collapse styling update — 2026-06-17

- The expanded suggested-action `Collapse` control now uses dedicated quiet text-button styling instead of reusing the dismiss-button style.
- Expanded action headers keep the dismiss control separate from the recollapse affordance.
- This keeps the calm action surface reversible without making the header feel like a mini toolbar. Browser/live proof remains pending.

## Onboarding theme texture metadata update — 2026-06-17

- First-run theme cards now show each theme's texture recipe and default texture opacity.
- Theme-card selection labels also include texture metadata, so textured themes are disclosed before setup completes.
- This extends Phase 5 texture transparency from Settings into onboarding without changing theme tokens. Browser proof remains pending.

## Onboarding theme-card decorative icon update — 2026-06-17

- First-run theme-card trailing icons are now decorative for assistive tech.
- Theme selection buttons already expose the theme name, texture recipe, texture opacity, and active state through their labels.
- This keeps onboarding theme choice readable without duplicate icon noise. Browser proof remains pending.

## Onboarding theme heading icon update — 2026-06-17

- The first-run `Pick a theme` heading icon is now decorative for assistive tech.
- The heading text remains the accessible step label, while theme cards carry the detailed theme and texture metadata.
- This keeps onboarding theme selection readable without duplicate icon noise. Browser proof remains pending.

## Onboarding theme group semantics update — 2026-06-17

- First-run dark and light theme sections now expose as labelled groups.
- Each group references its visible `Dark themes` or `Light themes` label, while individual theme buttons carry texture metadata.
- This keeps texture-aware theme selection navigable as grouped choices. Browser proof remains pending.

## Model Lab tab proof-label update — 2026-06-17

- Model Lab tab labels now describe the proof/trust work available in each section.
- Eval and Tasks point to provider-call proof preparation, Bench and Results point to proof review/exports, Packs points to pack evidence exports, and History points to saved eval/bench proof history.
- Visible tab names stay short while assistive labels carry the trust workflow context. Browser/provider proof remains pending.

## Model Lab proof-review control label update — 2026-06-17

- Model Lab proof-review note fields now expose a direct review-note label.
- Proof-review action buttons now explicitly describe the trust consequence: approved proof can be trusted for routing/role evidence, needs-attention proof blocks trusted use, and clear review returns proof to unreviewed.
- Buttons are explicit non-submit controls. Browser/provider proof remains pending.

## Model Lab proof-review structure update — 2026-06-17

- Model Lab proof-review callouts now expose as labelled proof-review groups.
- The proof-review checklist now exposes as a labelled list with individual checklist items.
- This keeps proof readiness, review state, notes, and trust-decision controls grouped as one inspectable trust surface. Browser/provider proof remains pending.

## Model Lab proof-review label simplification — 2026-06-17

- Model Lab proof-review groups now use a direct group label instead of an id generated from the callout title.
- This preserves the proof-review grouping semantics while avoiding a brittle helper dependency in the component.
- Browser/provider proof and validation gates remain pending.

## Model Lab proof-review state status update — 2026-06-17

- Model Lab proof-review state now exposes as a polite status.
- Saved review state changes such as `approved`, `needs-attention`, or `unreviewed` can be announced without changing the proof-review workflow.
- This is client-only proof-trust accessibility hardening. Browser/provider proof remains pending.

## Model Lab proof-review action group update — 2026-06-17

- Model Lab proof-review decision buttons now expose as one `Proof review actions` group.
- Approved, needs-attention, and clear-review controls remain separate actions, but they are discoverable as one trust-decision set.
- This is client-only proof-trust accessibility hardening. Browser/provider proof remains pending.

## Model Lab proof-review visible note label update — 2026-06-17

- Model Lab proof-review note fields now have a visible `Proof review note` label in addition to the direct field label.
- This avoids relying on placeholder text alone when reviewers record why proof is approved, needs attention, or remains unreviewed.
- This is client-only proof-trust clarity hardening. Browser/provider proof remains pending.

## Model Lab proof-review note label association update — 2026-06-17

- Model Lab proof-review note fields are now wrapped by their visible `Proof review note` label.
- This keeps the visible label and textarea programmatically associated without adding generated DOM ids or helper dependencies.
- This is client-only proof-trust accessibility hardening. Browser/provider proof remains pending.

## Routing Learning trusted-apply label update — 2026-06-17

- Routing Learning bulk apply now labels itself as applying trusted approved-proof recommendations and states how many unapproved recommendations will be skipped.
- Individual recommendation apply controls now expose whether they apply approved proof, require manual review of unapproved proof, or are blocked by needs-attention proof.
- This strengthens routing-trust action clarity without changing recommendation application behavior. Browser/provider proof remains pending.

## Routing Learning evidence action label update — 2026-06-17

- Routing Learning export/import/refresh controls are now explicit non-submit buttons with targeted labels.
- Export actions distinguish Markdown evidence brief from JSON evidence bundle.
- Import evidence now describes JSON evidence import, and benchmark import exposes pressed state plus benchmark-mode enable/disable context.
- This is client-only routing evidence clarity hardening. Browser/provider proof remains pending.

## Routing Learning evidence action icon update — 2026-06-17

- Routing Learning evidence-action icons are now decorative for assistive tech.
- Export/import/refresh buttons keep their visible icons, while their explicit labels carry the evidence-action meaning.
- This is client-only routing evidence accessibility hardening. Browser/provider proof remains pending.

## Routing Learning recent-filter control update — 2026-06-17

- Routing Learning recent-decision filters now expose explicit button semantics, pressed state, and count-aware labels.
- Needs-notes, stale-only, fallback, and benchmark filters now announce whether they enable or disable the filter and how many loaded decisions match.
- Clear filters now has a direct Routing Learning filter label.
- This is client-only routing evidence review accessibility hardening. Browser/provider proof remains pending.

## Routing Learning route-note label update — 2026-06-17

- Routing Learning recent-decision note inputs now expose direct labels tied to the selected route model.
- Reviewer notes no longer rely on placeholder text alone to explain where route outcome context should be entered.
- This is client-only routing evidence review accessibility hardening. Browser/provider proof remains pending.

## Routing Learning route-note control group update — 2026-06-17

- Routing Learning recent-decision note inputs and `Save note` controls now expose as one note-control group per selected route model.
- Outcome marking controls remain separate from note persistence controls.
- This keeps reviewer context entry grouped with its save action while preserving existing outcome behavior. Browser/provider proof remains pending.

## Routing Learning route-review button semantics update — 2026-06-17

- Routing Learning route-note save controls and outcome marking controls are now explicit non-submit buttons.
- `Save note` controls now expose route-model-specific labels.
- This keeps reviewer-note persistence and route outcome marking clear without changing routing-learning behavior. Browser/provider proof remains pending.

## Routing Learning route-outcome action group update — 2026-06-17

- Routing Learning outcome marking buttons now expose as one route-model-specific action group.
- Worked, failed, and unclear outcome controls remain separate from note persistence controls.
- This keeps route outcome marking distinct from reviewer-note saving in the routing evidence loop. Browser/provider proof remains pending.

## Routing Learning decorative icon update — 2026-06-17

- Routing Learning explanatory and route-status icons are now decorative for assistive tech.
- The visible text, status labels, and explicit action labels carry the evidence-review meaning.
- This is client-only routing evidence accessibility hardening. Browser/provider proof remains pending.

## Routing Learning route-outcome button label update — 2026-06-17

- Routing Learning route outcome buttons now include the selected route model in their labels.
- Worked, failed, and unclear actions remain visually compact while exposing model-specific outcome intent.
- This is client-only routing evidence review accessibility hardening. Browser/provider proof remains pending.

## Routing Learning candidate-score list update — 2026-06-17

- Routing Learning candidate score chips now expose as labelled lists.
- Latest route scores and per-route candidate alternatives remain visually compact while each score is inspectable as an individual list item.
- This strengthens the `why this model` evidence surface without changing routing behavior. Browser/provider proof remains pending.

## Routing Learning route-margin label update — 2026-06-17

- Routing Learning route-margin summaries now expose model-specific comparison labels.
- The selected-vs-alternative explanation remains visually compact while becoming easier to identify as route-choice evidence.
- This strengthens the `why this model` evidence surface without changing routing behavior. Browser/provider proof remains pending.

## Routing Learning route-trace context group update — 2026-06-17

- Routing Learning route trace metadata now exposes as a route-model-specific context group.
- Decision type, classifier, cache/fallback, dataset kind, and timestamp remain visually compact while grouped as route-trace evidence.
- This strengthens routing transparency without changing routing behavior. Browser/provider proof remains pending.

## Routing Learning route-decision row group update — 2026-06-17

- Routing Learning recent route rows now expose as route-decision groups.
- Each route-decision group names the selected model and current outcome state, while nested trace, score, margin, note, and outcome controls remain inspectable.
- This keeps recent routing evidence navigable as complete decisions instead of loose fragments. Browser/provider proof remains pending.

## Routing Learning route-summary context update — 2026-06-17

- Routing Learning route summary blocks now expose selected model, task type, role, complexity, and route score as one context group.
- This keeps the primary route decision context available before inspecting trace, margin, score, note, or outcome controls.
- This is client-only routing transparency hardening. Browser/provider proof remains pending.

## Routing Learning trust metric strip label update — 2026-06-17

- Routing Learning trust metrics now expose as one labelled trust snapshot.
- The metric strip label summarizes reviewed outcomes, observed success, reviewer-note coverage, evidence age, and approved eval-proof recommendations.
- This keeps the routing trust summary understandable before reviewers inspect individual routes or exports. Browser/provider proof remains pending.

## Model budget and provider rate-limit warning semantics — 2026-06-17

- Model Budgets now expose warning/status surfaces for premium-model selection, missing rules, loading, save state, and unknown model ids.
- Budget rows now expose as labelled rule list items with model id, reset period, exceeded action, token/cost thresholds, and remove/save actions named directly.
- Provider Rate Limits now expose missing-rule/loading/save status, labelled rule list items, threshold groups, unknown-provider alerts, rolling usage as a labelled region, and recent warning/block events as a list.
- This strengthens the Phase 6 requirement that budget and rate-limit warnings appear before expensive background work. Browser/provider proof remains pending.

## Provider health badge trust labels — 2026-06-17

- Provider health probe controls now expose explicit button semantics and decorative probe/loading icons.
- Never-probed, probing, stale, failed, and healthy states now include direct labels that name the health state, probe count, latest latency/capability pass count, or latest error snippet.
- This strengthens the Phase 6 requirement that provider health and rate-limit visibility be understandable before relying on a model/provider. Browser/provider proof remains pending.

## Model Library capability scorecard semantics — 2026-06-17

- Model Library search, category filters, and `My Models` filter now expose direct labels and pressed states.
- Model Library summary now announces catalog-card count, enabled-provider-model count, and catalog update date.
- Each model capability card now exposes as a labelled list item with provider, category, access state, harness-fit score, cost, context, tool support, and vision support.
- Scorecard metrics, fit reasons, strengths, weaknesses, comparable models, and benchmark highlights now expose as structured evidence rather than visual-only card text.
- This strengthens the Phase 6 requirement for model capability scorecards and calm model/router trust explanation. Browser/provider proof remains pending.

## Auto-Router candidate capability card semantics — 2026-06-17

- Auto-Router candidate rows now expose as a labelled candidate list rather than loose visual groups.
- Each candidate label names source, effective cost, image/thinking support, classifier/default role, and eval-proof recommendation state when present.
- Candidate badges now expose as model-specific evidence items, and candidate capability/cost controls are grouped by model.
- Capability-card text fields now explicitly ask for strengths, weaknesses, and safest task fit for classifier routing.
- This strengthens the Phase 6 requirement that router alternatives be understandable before trusting selected/rejected models. Browser/provider proof remains pending.

## Prompt Microscope router-decision explanation semantics — 2026-06-17

- Prompt Microscope toggle now exposes expanded/collapsed state and identifies the evidence surfaces it reveals.
- Auto-Router evidence now exposes as one labelled decision group naming the selected model, score, fallback/cache state, classifier, reason, heuristic route, policy gate, route-input features, and feedback guidance.
- Candidate scores now expose as a ranked list of selected model plus rejected alternatives, with each row labelling the classifier score and whether it was selected or rejected.
- Heuristic Route Decision evidence now exposes as a labelled decision group with role, model, reason, heuristic route, policy gate, and route-input features.
- Debug bundle export now exposes a run-specific export label, and route/decision icons are decorative. Browser/provider proof remains pending.

## Patch Review validation proof gate labels — 2026-06-17

- Patch Review release workflow now exposes as one labelled proof/commit group with proposal id, validation-command count, and commit availability.
- Generate-message, validation, and commit actions now expose explicit button semantics and state-specific labels for running, blocked, or available actions.
- Validation gate results now announce as status for passed/bypassed gates and alert for failed gates, including command count or blocker count.
- Generated commit messages now expose a direct label. Browser/live validation proof remains pending.

## Artifact Drawer proof review unit semantics — 2026-06-17

- Artifact Drawer expanded artifacts now expose as a labelled list of reviewable artifacts rather than a generic region.
- Each artifact item now announces artifact type, review state, and content length before the user inspects or approves it.
- Artifact review actions are grouped per artifact, and approve/needs-revision/revise/copy controls now describe saved feedback, revision-note use, and copied content explicitly.
- Artifact content labels now identify truncated previews, and review-note controls explain that notes feed approval, revision marking, and revise prompts.
- This strengthens the kickoff proof-review requirement that artifacts and validation proof be inspectable without relying on raw logs. Browser/live artifact proof remains pending.

## Team Plan artifact proof handoff semantics — 2026-06-17

- Team Plan cards now expose as labelled plan artifacts with participant count, completion count, execution-phase count, and validation-expectation count.
- Revise and Execute controls now explain that revision preserves accepted plan structure and execution requires validation proof.
- Recommendation, participant status, summary metadata, phases, validation expectations, risks, and participant deltas now expose as labelled plan/proof groups.
- This strengthens the Planning Room handoff requirement that plans, validation expectations, and execution proof be inspectable before work begins. Browser/live Planning Room proof remains pending.

## Post-commit server/runtime relaunch proof — 2026-06-17

- Because the committed tree included server/runtime changes, OpenHarness was relaunched with the repo-native `npm start` launcher.
- Reachability proof after relaunch:
  - `http://127.0.0.1:3001/` returned `200`.
  - `http://127.0.0.1:5173/` returned `200`.
  - `http://127.0.0.1:3001/api/config` returned `200`.
- Startup reported Docker MCP gateway could not start because Docker Desktop is not running, but the OpenHarness server, Vite UI, and config endpoint were reachable.
- This satisfies the restart/reachability portion for the pushed server/runtime changes. Lint/build/browser/provider proof remains pending.
