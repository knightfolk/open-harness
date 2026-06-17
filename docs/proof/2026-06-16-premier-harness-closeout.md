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
| Theme textures are subtle, bounded, and accessible. | Manual review notes across chat, sidebar, settings, code, terminal, and diff surfaces. | partial: current Theme settings and visible shell contrast inspected; `test:theme-accessibility` now regression-tests built-in contrast, reduced-transparency fallback behavior, and reduced-motion behavior; the texture setting states that textures are shell-only and that reduced transparency disables textures/blur while using solid theme fallback colors; reduced-transparency CSS consumes theme fallback surface, border, and shadow variables for primary shell/panel surfaces and overlays; reduced-motion CSS disables shell/chat/work/status motion; live reduced-transparency/reduced-motion browser proof remains pending |
| Model routing and evaluation are visible enough to trust. | Model Lab eval/bench proof review exports plus Routing Learning/Agent Role/Auto-Router trust-state notes. | partial: no-spend Model Lab, Routing Learning, Agent Roles, and Auto-Router transparency surfaces inspected; Model Lab sections now expose a labelled tablist with selected-state tabs for Eval, Tasks, Bench, Packs, Results, and History, each tab controls a matching focusable tabpanel, ArrowLeft/ArrowRight/Home/End move between tabs, and roving tabindex keeps the selected tab in the normal tab order; Model Lab prompt, task, and model selections are now labelled provider-call matrix groups, with explicit per-item select/deselect labels and Select all labels that state how many prompts/tasks/candidates will be selected; Model Lab proof-prep, task seeding, Eval launch, Bench launch, prompt-pack folder prep/import/pack-run/export controls are explicit non-submit buttons with targeted labels; Prompt Packs import path has a direct label, import errors are alerts, missing registry/manifests states are polite statuses, trust/status pills now expose explicit prompt-pack trust/manifest-status labels, and registry-root ready/missing status labels include location/path context; Model Lab matrix caution boxes now announce selected run count plus provider-rate-limit/metered-billing risk with status/alert semantics based on matrix size; Model Lab diagnostics now announce proof-prep/error messages as status/alert regions; Model Lab Eval/Bench launch buttons now repeat the provider-budget approval condition and selected matrix size at the action point; Agent Roles renders role assignments and auto-configure suggestions; model ability icons now expose available/unavailable capability labels, Agent Roles recommended-model grid is a labelled group, role cards now expose role/description/model/thinking labels, effort sections expose labelled/described section relationships, effort counts expose role-count labels, recommendation cards expose role/model labels, eval recommendation cards expose role/model/proof/reason labels, empty effort buckets are polite statuses, auto-configure and eval-recommendation apply buttons have explicit button semantics/labels, and decorative role/effort icons are hidden from assistive tech; Auto-Router summary counts now expose catalog/configured/routed status labels, classifier/default/threshold controls have direct labels, sync/add candidate controls are explicit typed buttons with targeted labels, no-candidate empty state is a polite status, candidate rows expose candidate/source/cost/capability labels, candidate eval recommendations expose model/role/proof/reason labels, candidate capability/cost controls are labelled, add-candidate model/cost/capability/toggle controls have direct labels, and remove controls are explicit typed buttons with decorative trash icons; live proof of the newer proof-trust callout plus proof exports, proof-review decisions, and approved/trusted apply evidence remains pending |
| Prompt response strategy is model-specific, traceable, testable, and backed by a prompt strategy database. | Prompt Microscope run-trace evidence, prompt strategy database tests, Model Lab same-model strategy comparison, and Routing Learning strategy outcome/export proof. | partial: `server/promptStrategies.ts` defines versioned model-family prompt profiles and role/task variants; prompt assembly traces record strategy id/family/style/output contract and variant metadata; Prompt Microscope, Model Lab, Routing Learning, proof briefs, exports, and no-spend prompt/routing tests expose prompt strategy metadata; tool reliability and routing outcome summaries now preserve prompt strategy and variant context; provider-approved prompt trace and same-model prompt-strategy comparison remain pending |
| OpenHarness can explain which model/tool/prompt-strategy combinations failed, which later path worked, and how routing or prompt contracts should change to reduce first-call errors and retry loops. | Routing Learning tool reliability, session outcomes, recovery patterns, failure memory, normalized signatures, Auto-Router candidate-card annotations, and saved session/run breadcrumbs. | partial: regression coverage and UI/export/candidate-card evidence preserve failed model/provider/tool paths, prompt strategy/variant context, retry distance, later working path, and session/run breadcrumbs; real populated live failure-memory/recovery rows remain pending |
| Auto-Router candidate-card evidence includes saved session/run breadcrumbs for recovery patterns, failure memory, session outcomes, and normalized signatures that inform tool-heavy route scoring. | Auto-Router candidate-card annotations, `test:tool-reliability`, `test:premier-model-harness`, and `test:premier-baseline-manifest`. | partial: classifier-side candidate-card annotations include compact session/run breadcrumbs and guards preserve them; provider/live evidence with real populated failure rows remains pending |
| Lint/build pass. | Current `npm run lint` and `npm run build` command results. | passed via `npm run check:premier-no-spend` on 2026-06-17; command ran no-provider automated proof, lint, and build |
| Server/runtime changes have been relaunched and reachability verified. | Current restart proof for `3001`, `5173`, and `/api/config` if server/runtime changes are included in the closeout pass. | pending |
| Runtime relaunch does not leave duplicate OpenHarness/Electron windows. | Restart-scope proof that stale Electron shells are cleaned up before launch and the desktop app enforces single-instance behavior. | pending |

## Provider-Backed Proof Run Approval Draft

Status: approval not requested yet

Planned calls:

- Eval proof: proposed smallest 1 prompt x 1 model run.
- Same-model prompt strategy comparison: proposed smallest 1 prompt x 1 model x
  2 strategy run after provider-spend approval.
- Bench proof: proposed smallest 1 task x 1 model run.
- Runtime scenarios: proposed Planning Room plus one execute or investigate run,
  with durable runtime trace/export paths for Planning Room, execute/investigate,
  and steering-event evidence.

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
2. Approve eval proof plus same-model prompt strategy comparison.
3. Approve eval proof only.
4. Approve bench proof only.
5. Do not run provider-backed proof yet.

## Browser/Manual Proof Approval Draft

Status: approval not requested yet

Planned checks:

- Refreshed desktop/narrow chat-first shell.
- Durable screenshot or DOM-note artifact path recorded for desktop and
  narrow-width checks.
- Model Lab History cap.
- Agent Roles proof-trust callout.
- Theme reduced-transparency copy.
- Artifact drawer `Show full` / `Collapse`.
- Review Changes proof-save-to-chat if a safe validation result is available.

Approval options to ask reviewer:

1. Run browser/manual proof pass.
2. Run browser/manual proof pass and save durable screenshot/DOM-note artifacts.
3. Limit to no-provider UI checks only.
4. Do not run browser/manual proof yet.

## Final Gate Approval Draft

Status: approval not requested yet

Planned commands:

- `npm run check:premier-no-spend`
- Optional full hardening only if server/runtime, provider, security, routing,
  import/export, or budget logic changes again.
- Save durable gate log/artifact paths for each command that runs.
- If server/runtime code changed, save restart/reachability proof for `3001`,
  `5173`, `/api/config`, and the duplicate Electron/process-shape check.

Approval options to ask reviewer:

1. Run premier no-spend check only.
2. Run premier no-spend check and save durable gate logs.
3. Run premier no-spend check plus full hardening and save durable gate logs.
4. Do not run final gates yet.

## Model Lab Eval Proof

- Report id: pending
- Proof review status: pending
- Proof brief: `docs/proof/2026-06-16-model-lab-eval-manual-alt-proof-brief.md`
- Proof artifact path(s): `docs/proof/2026-06-16-model-lab-eval-manual-alt-proof-brief.md`
- Same-model prompt strategy id(s): pending provider-approved comparison
- Same-model prompt strategy variant id(s): pending provider-approved comparison
- Same-model comparison artifact path(s): pending provider-approved comparison
- Recommendation report: `docs/proof/2026-06-16-model-lab-eval-manual-alt-recommendation-report.md`
- Routing Learning trust state: partial no-spend proof. Routing Learning is reachable from Tools, exposes export/import actions and proof-state recommendation counts, and keeps `Apply trusted (0)` disabled when no approved applicable recommendations are available.
- Notes: partial no-spend UI evidence collected 2026-06-16. Model Lab opens from Tools as an addable panel. Eval tab showed `Prepare smallest eval proof`, proof-gate guidance, 7 eval prompts, enabled model choices, provider-spend guard copy, and disabled `Run Eval (0 x 0 = 0)` before selections. Results currently shows `No results yet. Configure and run an eval.` when no report is selected in the current panel state. History shows existing eval report rows including `Eval 6/6/2026`, `manual-alt`, `manual`, and `test recommendations`, each labeled `proof unreviewed`. A client-only follow-up made History rows real keyboard-accessible buttons with labels such as `Open eval report manual-alt`; browser refresh confirmed 116 saved eval/bench history buttons. Selecting `manual-alt` opened Results with `Export proof brief`, `Export report`, `Recommendation trust: proof not approved yet`, `Review state: unreviewed`, `Mark approved`, `Needs attention`, and `Clear review`, with no document or chat-root horizontal overflow. Because the Codex in-app browser cannot save downloads, durable local export artifacts were generated from the same saved report data and recommendation-report endpoint under `docs/proof/`: `2026-06-16-model-lab-eval-manual-alt-proof-brief.md` and `2026-06-16-model-lab-eval-manual-alt-recommendation-report.md`. A later client-only responsiveness follow-up capped visible Model Lab History rows to the latest 20 eval reports and latest 20 bench runs, with count copy when older rows are hidden; live browser verification of the cap is still pending because the current browser driver timed out before clicking Tools in the heavy app state. A client-only follow-up added Routing Learning as an optional Tools panel, reusing `RoutingLearningPane`; browser refresh confirmed Tools now shows `Routing Learning Add Routing Learning to sidebar`, and opening it showed export/import actions, eval recommendation proof-state counts, `Apply trusted (0)` disabled, observed outcome summaries, route feedback controls, and recent routing decisions. This does not replace a provider-approved proof run, proof review decision, or approved recommendation apply proof.

## Model Lab Bench Proof

- Bench run id: pending
- Proof review status: pending
- Proof brief: `docs/proof/2026-06-16-model-lab-bench-4e08ec13-87a0-43d2-a1d9-c92cbd8615df-proof-brief.md`
- JSON artifact: `docs/proof/2026-06-16-model-lab-bench-4e08ec13-87a0-43d2-a1d9-c92cbd8615df.json`
- Proof artifact path(s): `docs/proof/2026-06-16-model-lab-bench-4e08ec13-87a0-43d2-a1d9-c92cbd8615df-proof-brief.md`, `docs/proof/2026-06-16-model-lab-bench-4e08ec13-87a0-43d2-a1d9-c92cbd8615df.json`
- Same-model prompt strategy id(s): pending provider-approved comparison
- Same-model prompt strategy variant id(s): pending provider-approved comparison
- Same-model comparison artifact path(s): pending provider-approved comparison
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

- `npm run lint`: passed via `npm run check:premier-no-spend` on 2026-06-17
- `npm run build`: passed via `npm run check:premier-no-spend` on 2026-06-17
- `npm run test:hardening` or scoped substitute: current scoped substitute is `npm run check:premier-no-spend`; full hardening remains optional if server/runtime, provider, security, routing, import/export, or budget logic changes again
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

## Validation gates and no-provider browser proof — 2026-06-17

- `npm run lint` initially failed on an unused `clean` state value in `src/components/EnvironmentRail.tsx`; the dead state/update was removed and the rerun passed.
- `npm run build` initially failed on TypeScript issues in artifact feedback defaults, active-work status comparisons, panel icon props, and bench history proof-review summary typing; the narrow type fixes were applied and the rerun passed.
- Final gate results:
  - `npm run lint` passed.
  - `npm run build` passed (`tsc -b && vite build`).
- No-provider browser/manual reachability proof against the running app:
  - `http://127.0.0.1:3001/` returned `200`.
  - `http://127.0.0.1:5173/` returned `200`.
  - `http://127.0.0.1:3001/api/config` returned `200`.
  - UI HTML included `<title>OpenHarness — Universal AI Harness</title>` and `id="root"`.
  - Config sample returned 5 providers with active model `Auto`.
- Provider-backed eval/bench proof remains pending unless explicitly approved separately.

## Phase 7 prompt strategy database start — 2026-06-17

- Added `docs/PROMPT_STRATEGY_DATABASE_PLAN.md` with current provider-doc synthesis for model-specific prompt response strategy.
- Added `server/promptStrategies.ts` with versioned prompt strategy profiles for OpenAI, Anthropic/Claude, Gemini, Mistral-family, DeepSeek, Qwen, MiniMax, Llama, Gemma, Phi, and unknown/default.
- `server/promptBuilder.ts` now records the selected prompt strategy in prompt assembly trace metadata.
- `server/runTrace.ts` and `src/types/index.ts` type the prompt strategy trace for persisted run data and UI consumption.
- Prompt Microscope now shows strategy id, style, context order, examples policy, reasoning policy, and output contract when prompt assembly metadata is present.
- Validation and relaunch proof:
  - `npm run lint` passed.
  - `npm run build` passed.
  - OpenHarness was relaunched with `npm start`.
  - `http://127.0.0.1:3001/` returned `200`.
  - `http://127.0.0.1:5173/` returned `200`.
  - `http://127.0.0.1:3001/api/config` returned `200`.
- Docker MCP still reports Docker Desktop is not running. Remaining Phase 7 work: make prompt strategies actively shape prompt construction, persist strategy ids into Routing Learning outcomes, and add `test:prompt-strategy-database`.

## Docker MCP relaunch proof after Docker Desktop start — 2026-06-17

- After Docker Desktop was started, OpenHarness was relaunched with `npm start`.
- Docker MCP gateway loaded the Docker MCP catalog, enabled `context7`, `sequentialthinking`, `playwright`, `memory`, and `puppeteer`, listed 42 gateway tools plus internal dynamic tools, and connected to OpenHarness with 50 tools available.
- MCP watchdog started on a 30-second interval.
- Reachability after relaunch:
  - `http://127.0.0.1:3001/` returned `200`.
  - `http://127.0.0.1:5173/` returned `200`.
  - `http://127.0.0.1:3001/api/config` returned `200`.
- Vite console still reports existing theme contrast warnings for charcoal, silver, sage, blush, and system classic high contrast.

## Phase 7 strategy-driven prompt directives — 2026-06-17

- `server/promptBuilder.ts` now translates the selected prompt strategy into small runtime directives for outcome-first prompting, XML/structured boundaries, context ordering, example policy, reasoning policy, tool simplicity, and output contract.
- The directives are intentionally narrow and additive: they preserve existing role prompts and output contracts while letting model-family strategy influence prompt shape.
- Validation and relaunch proof:
  - `npm run lint` passed.
  - `npm run build` passed.
  - OpenHarness was relaunched with `npm start`.
  - `http://127.0.0.1:3001/` returned `200`.
  - `http://127.0.0.1:5173/` returned `200`.
  - `http://127.0.0.1:3001/api/config` returned `200`.
  - Docker MCP connected with 50 tools and watchdog started.
- Vite still reports the existing theme contrast warnings for charcoal, silver, sage, blush, and system classic high contrast.

## Phase 7 routing-learning prompt strategy outcomes — 2026-06-17

- Routing Learning events now support prompt strategy id, strategy family, and strategy style metadata.
- New auto-router decisions record the selected model's prompt strategy metadata without changing routing behavior.
- Learning summaries now include prompt-strategy and strategy-family breakdowns so reviewers can separate weak model choice from weak prompt strategy.
- Settings > Routing Learning now shows prompt strategy and strategy family breakdown columns beside task type, role, and complexity.
- Validation and relaunch proof:
  - `npm run lint` passed.
  - `npm run build` passed.
  - OpenHarness was relaunched with `npm start`.
  - `http://127.0.0.1:3001/` returned `200`.
  - `http://127.0.0.1:5173/` returned `200`.
  - `http://127.0.0.1:3001/api/config` returned `200`.
  - Docker MCP connected with 50 tools and watchdog started.
- Vite still reports the existing theme contrast warnings for charcoal, silver, sage, blush, and system classic high contrast.

## Phase 7 tool-call reliability trace metadata — 2026-06-17

- Run traces now preserve tool-call status as structured data: `running`,
  `complete`, `skipped`, or `error`.
- Tool-call trace steps now include model, provider id, tool round, duration,
  and redacted error text when invocation fails.
- Fake `subagent-*` tool calls now appear as failed tool-call trace steps in
  addition to the generic error step, so model-specific tool hallucinations can
  be counted later.
- MCP invocation exceptions now stream and persist as `error` tool-call status
  instead of appearing as successful completed calls with an `Error:` output.
- This creates the session/log evidence needed to compare which models make
  reliable first tool calls, which recover after failures, and which spend extra
  retry rounds before a useful final answer.
- Validation and relaunch proof:
  - `npm run lint` passed.
  - `npm run build` passed.
  - OpenHarness was relaunched with `npm start`.
  - `http://127.0.0.1:3001/` returned `200`.
  - `http://127.0.0.1:5173/` returned `200`.
  - `http://127.0.0.1:3001/api/config` returned `200`.
  - Docker MCP connected with 50 tools.
- Vite still reports the existing theme contrast warnings for charcoal, silver,
  sage, blush, and system classic high contrast.

## Phase 7 Auto-Router candidate tool reliability cues — 2026-06-17

- Settings > Auto-Router candidate rows now load Routing Learning summary data
  and show a `Tool errors/total` badge when the candidate has persisted
  per-model tool-call traces.
- Candidate details now include tool-call error rate and recovered tool-error
  run counts, making tool-heavy route tuning visible beside eval-backed router
  cues and capability cards.
- This keeps the behavior advisory: it does not silently change routing, but it
  gives reviewers evidence before adjusting candidate cards or effective costs.
- Because this slice only changes client UI and docs, the running server does
  not need to be restarted; a browser refresh is enough after build output is
  refreshed.
- Validation proof:
  - `npm run lint` passed.
  - `npm run build` passed.
  - Server restart intentionally skipped because no server/runtime files changed
    in this slice.

## Phase 7 prompt strategy database regression gate — 2026-06-17

- Added `scripts/test-prompt-strategy-database.ts`.
- Added package script `test:prompt-strategy-database`.
- The test verifies required prompt strategy profiles for OpenAI, Anthropic,
  Gemini, Mistral, DeepSeek, Qwen, MiniMax, Llama, Gemma, Phi, and unknown.
- The test verifies source registry coverage for the researched provider docs,
  representative model-family mapping, prompt strategy trace shape, and
  prompt-builder directive inclusion for representative models.
- This closes the previously documented implementation gap where the prompt
  strategy database existed but did not have its own focused regression gate.
- The new gate caught and fixed two prompt strategy integration issues:
  OpenAI-style `gpt-*` ids now resolve through strategy `appliesTo` hints before
  falling back to generic model-family detection, and minimal prompts now include
  the selected strategy id in the emitted prompt text.
- Validation and relaunch proof:
  - `npm run test:prompt-strategy-database` passed.
  - `npm run lint` passed.
  - `npm run build` passed.
  - OpenHarness was relaunched with `npm start`.
  - `http://127.0.0.1:3001/` returned `200`.
  - `http://127.0.0.1:5173/` returned `200`.
  - `http://127.0.0.1:3001/api/config` returned `200`.
  - Docker MCP connected with 50 tools.
- Vite still reports the existing theme contrast warnings for charcoal, silver,
  sage, blush, and system classic high contrast.

## Phase 7 tool-call reliability Routing Learning aggregation — 2026-06-17

- Routing Learning now derives tool reliability from persisted session run
  traces rather than requiring a separate manual log.
- The `/api/router/learning` summary now includes total traced tool calls,
  completed/error/skipped/running counts, runs with tool errors, recovered
  tool-error runs, recent error examples, and breakdowns by model, provider,
  and tool.
- Settings > Routing Learning now shows tool-call errors, tool recovery,
  per-model/per-provider/per-tool error rows, average duration, and recent
  error examples.
- Routing Learning JSON and Markdown evidence exports now include tool
  reliability evidence so reviewers can identify models that make unreliable
  first tool calls or recover only after extra retries.
- This advances the model failure memory requirement from the kickoff doc:
  "what failed, whether fallback was used, and what fixed it."
- Validation and relaunch proof:
  - `npm run lint` passed.
  - `npm run build` passed.
  - OpenHarness was relaunched with `npm start`.
  - `http://127.0.0.1:3001/` returned `200`.
  - `http://127.0.0.1:5173/` returned `200`.
  - `http://127.0.0.1:3001/api/config` returned `200`.
  - `http://127.0.0.1:3001/api/router/learning` returned `200`.
  - The routing-learning response included `toolReliability=true`,
    `totalToolCalls=10`, and `errorToolCalls=0` from persisted session traces.
  - Docker MCP connected with 50 tools.
- Vite still reports the existing theme contrast warnings for charcoal, silver,
  sage, blush, and system classic high contrast.

## Phase 7 tool reliability regression gate — 2026-06-17

- Extracted tool reliability aggregation into `server/toolReliability.ts` so the
  runtime summary can be tested without booting the server or reading real
  persisted sessions.
- Added `scripts/test-tool-reliability.ts`.
- Added package script `test:tool-reliability`.
- The test covers explicit tool failures, recovered tool-error runs, unrecovered
  tool-error runs, skipped calls, legacy complete/running inference, recent
  error ordering, and model/provider/tool breakdowns.
- The `/api/router/learning` endpoint and routing evidence export still include
  the same `toolReliability` summary, now produced by the shared helper.
- Validation and relaunch proof:
  - `npm run test:tool-reliability` passed.
  - `npm run test:prompt-strategy-database` passed.
  - `npm run lint` passed.
  - `npm run build` passed.
  - OpenHarness was relaunched with `npm start`.
  - `http://127.0.0.1:3001/` returned `200`.
  - `http://127.0.0.1:5173/` returned `200`.
  - `http://127.0.0.1:3001/api/config` returned `200`.
  - `http://127.0.0.1:3001/api/router/learning` returned `200`.
  - The routing-learning response included `toolReliability=true`,
    `totalToolCalls=10`, and `errorToolCalls=0` from persisted session traces.
  - Docker MCP connected with 50 tools.
- Vite still reports the existing theme contrast warnings for charcoal, silver,
  sage, blush, and system classic high contrast.

## Phase 7 tool-heavy routing advice — 2026-06-17

- Tool reliability summaries now include derived `toolHeavyAdvice` rows.
- Advice rows are advisory only: they can flag a model as clean, caution-worthy,
  or risky for tool-heavy work, or flag a recurring tool failure point, but they
  do not silently change thresholds, candidate costs, or capability cards.
- Settings > Routing Learning now shows tool-heavy routing advice beside raw
  tool reliability buckets.
- Routing Learning Markdown evidence briefs now include the same advice so
  exported proof carries the interpretation as well as the raw counts.
- `test:tool-reliability` now verifies advice ordering and content for risky
  models, recurring tool failures, and clean tool traces.
- Validation and relaunch proof:
  - `npm run test:tool-reliability` passed.
  - `npm run test:prompt-strategy-database` passed.
  - `npm run lint` passed.
  - `npm run build` passed.
  - OpenHarness was relaunched with `npm start`.
  - `http://127.0.0.1:3001/` returned `200`.
  - `http://127.0.0.1:5173/` returned `200`.
  - `http://127.0.0.1:3001/api/config` returned `200`.
  - `http://127.0.0.1:3001/api/router/learning` returned `200`.
  - The routing-learning response included `toolReliability=true`,
    `totalToolCalls=10`, and `toolHeavyAdvice.length=1` from persisted session
    traces.
  - Docker MCP connected with 50 tools.
- Vite still reports the existing theme contrast warnings for charcoal, silver,
  sage, blush, and system classic high contrast.

## Phase 7 first-call and retry-round tool reliability signals — 2026-06-17

- Tool reliability buckets now track tool-using run count, first-call failures,
  first-call failure rate, and average recovery rounds after the first tool
  error.
- The overall Routing Learning tool reliability summary now includes
  `runsWithToolCalls`, `firstCallErrorRuns`, and `avgRecoveryRounds`.
- Tool-heavy routing advice now carries first-call failure rate and average
  recovery rounds, so reviewers can distinguish clean first tool choices from
  models that only recover after extra retries.
- Settings > Routing Learning and Markdown evidence briefs now expose
  first-call failures and recovery rounds beside raw tool-call error counts.
- `test:tool-reliability` now verifies first-call failure counts/rates and
  recovery-round calculations.
- Validation and relaunch proof:
  - `npm run test:tool-reliability` passed.
  - `npm run test:prompt-strategy-database` passed.
  - `npm run lint` passed.
  - `npm run build` passed.
  - OpenHarness was relaunched with `npm start`.
  - `http://127.0.0.1:3001/` returned `200`.
  - `http://127.0.0.1:5173/` returned `200`.
  - `http://127.0.0.1:3001/api/config` returned `200`.
  - `http://127.0.0.1:3001/api/router/learning` returned `200`.
  - The routing-learning response included `toolReliability=true`,
    `totalToolCalls=10`, `runsWithToolCalls=1`, `firstCallErrorRuns=0`,
    `avgRecoveryRounds=0`, and `toolHeavyAdvice.length=1` from persisted
    session traces.
  - Docker MCP connected with 50 tools.
- Vite still reports the existing theme contrast warnings for charcoal, silver,
  sage, blush, and system classic high contrast.

## Phase 7 Model Lab prompt strategy evidence - 2026-06-17

- Added prompt strategy trace persistence to Model Lab eval and bench result rows.
- Added proof brief summaries and row-level evidence panels for prompt strategy id, family, style, reasoning policy, tool policy, output contract, and review date.
- Extended `test:prompt-strategy-database` to cover Model Lab strategy metadata shape.

## Phase 7 same-model strategy comparison - 2026-06-17

- Added optional prompt strategy id overrides to prompt building while preserving default model-family strategy selection.
- Added opt-in Model Lab eval strategy selection so the same prompt/model can be compared across multiple prompt contracts.
- Extended `test:prompt-strategy-database` to verify same-model strategy overrides and distinct prompt contracts.

## Phase 7 prompt strategy outcome summaries - 2026-06-17

- Eval summaries now aggregate by prompt strategy id beside model id.
- Model Lab proof briefs and recommendation exports expose best prompt strategy, family/style, average score, latency, tool count, run count, and best model for each strategy.
- Extended `test:prompt-strategy-database` to verify strategy outcome aggregation from same-model eval rows.

## Phase 7 role/task prompt strategy variants - 2026-06-17

- Added role/task variants to prompt strategy profiles for coder/tool-proof, reviewer/findings, planner/artifact, summarizer/direct, and reasoner/tradeoff behavior.
- Prompt assembly traces now record variant id, role, task type, and selection reason when a variant is selected.
- Prompt directives now include the selected role/task variant so the emitted prompt contract changes with role/task type, not just model family.
- Eval prompt strategy summaries use variant-aware keys when variant metadata exists.
- Extended `test:prompt-strategy-database` to verify variant coverage, same-model override variants, reviewer/planner variant selection, and variant-aware eval summaries.

## Phase 7 Routing Learning prompt strategy variants - 2026-06-17

- Auto-router learning events now persist prompt strategy variant id, inferred task type, and variant selection reason beside base strategy id/family/style.
- Routing Learning summaries now include a strategy-variant breakdown for reviewed outcomes.
- Extended `test:router-learning-outcomes` to verify variant metadata persistence, hydration, and summary aggregation.

## Phase 7 Routing Learning variant export evidence - 2026-06-17

- Routing Learning Markdown briefs now include prompt strategy variant outcome summaries.
- Recent routing decision lines in the Markdown brief include the variant-aware prompt strategy key.
- Extended `test:router-learning-outcomes` to verify imported routing evidence preserves prompt strategy variant metadata and selected dataset kind.

## Phase 7 Prompt Microscope strategy variant visibility - 2026-06-17

- Prompt Microscope now shows prompt strategy variant id, inferred task type, route role, tool policy, and variant selection reason beside base strategy fields.
- Extended `test:prompt-strategy-database` to verify prompt assembly traces and prompt-strategy section previews carry variant metadata for microscope/debug-bundle visibility.

## Phase 7 best prompt strategy variant signals - 2026-06-17

- Routing Learning summaries now expose `bestPromptStrategyVariants`, a ranked prompt-contract signal derived from reviewed outcomes.
- Routing Learning UI and Markdown briefs now show the strongest variant-aware prompt contract beside task-type model winners.
- Extended `test:router-learning-outcomes` to verify the best strategy variant signal and best model evidence.

## Phase 7 Model Lab variant-aware proof summaries - 2026-06-17

- Model Lab proof briefs now summarize observed prompt strategies with variant-aware keys when role/task variants are present.
- Observed strategy summary lines now include task type and role context so proof exports do not collapse different prompt contracts under the same base family strategy.
- Extended `test:prompt-strategy-database` to verify variant-aware strategy evidence key construction.

## Phase 7 session outcome mining for tool-call errors - 2026-06-17

- Tool reliability now captures recent recovery examples from saved run traces, including first failed model/provider/tool, later completed tool calls, final-answer capture, and recovery-round distance.
- Routing Learning and its export brief surface these paths so model/tool errors can be reduced at the source instead of merely retried.
- Tool reliability summaries now also include session outcome examples for each tool-error run: recovered tool path, fallback tool path, final-answer-only recovery, unrecovered error, or running/unknown.
- Routing Learning Markdown/JSON evidence and UI rows expose these outcome examples, including prompt strategy context, worked-by model/tool, final status, and retry distance.
- Auto-router candidate cards include compact session-outcome evidence so classifier scoring can avoid brittle first-tool choices and prefer known short recovery paths for similar tool-heavy tasks.
- Validation and relaunch proof:
  - `npm run test:prompt-routing-memory` passed.
  - `npm run lint` passed.
  - `npm run build` passed.
  - Follow-up export proof: `npm run test:router-learning-export` passed after adding an explicit `toolReliability.outcomeExamples` fixture, and `npm run test:prompt-routing-memory` plus `npm run lint` passed again.
  - Follow-up kickoff gate alignment: `test:prompt-routing-memory` now runs the kickoff's named `test:prompt-routing-quality-readiness` and `test:prompt-routing-output-p0` gates before the Phase 7 prompt-strategy/outcome-persistence/tool-reliability/export/import/auto-router tests. The expanded bundle passed with `test:router-learning-outcomes` included, and `npm run lint` passed.
  - Relaunched OpenHarness after server/runtime changes.
  - `http://127.0.0.1:3001/api/config` returned a non-empty response.
  - `http://127.0.0.1:5173/` returned the Vite HTML shell.
  - `http://127.0.0.1:3001/api/router/learning` exposes top-level `toolReliability.outcomeExamples`.
  - Docker MCP connected with 50 tools.

## Phase 5 built-in theme contrast cleanup - 2026-06-17

- Adjusted built-in theme contrast tokens that were repeatedly warning during runtime proof:
  - Charcoal/System Classic high contrast now checks readable secondary text on elevated surface instead of dark-on-dark bubble/surface.
  - Silver, Sage, and Blush light themes now use darker accessible accent/user-bubble colors while preserving their visual families.
- Added `test:theme-contrast` to assert built-in themes have no contrast regressions.
- Added the theme contrast gate to `test:hardening`.
- Validation proof:
  - `npm run test:theme-contrast` passed.
  - `npm run lint` passed.
  - `npm run build` passed.
  - Follow-up Phase 3 cleanup removed the remaining `SubAgentTracker` ineffective dynamic-import warning.

## Phase 5 reduced-transparency regression gate - 2026-06-17

- Extended the reduced-transparency CSS fallback to cover overlay backdrops that still declared blur:
  - Settings modal overlay.
  - Review Changes overlay.
- Added `test:theme-reduced-transparency` to assert the media query disables texture opacity, backdrop blur, and surface opacity while routing primary panels and overlays through theme fallback surface, border, and shadow variables.
- Added the reduced-transparency gate to `test:hardening`.
- Validation proof:
  - `npm run test:theme-reduced-transparency` passed.
  - `npm run lint` passed.
  - `npm run build` passed.

## Phase 5 reduced-motion regression gate - 2026-06-17

- Corrected the reduced-transparency overlay selector to cover the actual Review Changes overlay class.
- Extended reduced-motion protection to newer motion surfaces:
  - Chat message entrance animation.
  - Settings modal entrance animation.
  - Review Changes overlay/flyout entrance animation.
  - Agent detail active-row pulse.
- Added `test:theme-reduced-motion` to assert the reduced-motion media query covers the major shell/chat/work/status motion selectors.
- Added the reduced-motion gate to `test:hardening`.
- Validation proof:
  - `npm run test:theme-contrast` passed.
  - `npm run test:theme-reduced-transparency` passed.
  - `npm run test:theme-reduced-motion` passed.
  - `npm run lint` passed.
  - `npm run build` passed.

## Phase 5 grouped theme accessibility proof command - 2026-06-17

- Added `test:theme-accessibility` as the focused no-spend Phase 5 proof bundle.
- The grouped command runs built-in theme contrast, reduced-transparency, and reduced-motion regression gates.
- `test:hardening` now calls the grouped theme accessibility command instead of duplicating the three individual theme gates inline.
- Validation proof:
  - `npm run test:theme-accessibility` passed.
  - `npm run lint` passed.

## Premier no-spend automated proof command - 2026-06-17

- Added `test:premier-no-spend` as the current no-provider automated proof baseline.
- The baseline now includes Phase 5 theme accessibility, Phase 7 prompt/routing
  memory, and Phase 4 execute/proof hygiene.
- The command runs `test:theme-accessibility` and `test:prompt-routing-memory`.
- Added `check:premier-no-spend` for the same no-provider baseline plus `lint`
  and `build`.
- This does not replace manual/browser proof or provider-backed Model Lab proof, but gives future sessions one safe command before those heavier checks.
- Validation proof:
  - `npm run test:premier-no-spend` passed.
  - `npm run lint` passed.
  - `npm run check:premier-no-spend` passed after adding the combined no-provider test/lint/build command.

## Phase 7 normalized tool-error signatures - 2026-06-17

- Added normalized per-model/provider/tool error signatures to
  `server/toolReliability.ts`.
- Each signature captures runs, recovered/unrecovered counts, fallback recovery
  count, prompt strategy/variant context, sample error text, example run ids,
  and the later model/tool path that worked with average retry distance.
- Auto-router candidate cards now include matching signature evidence so the
  classifier can avoid repeating the same failed first tool or choose a known
  recovery path earlier.
- Regression coverage:
  - `scripts/test-tool-reliability.ts` now asserts signature grouping,
    recovered/unrecovered counts, strategy variant context, worked-by paths, and
    candidate-card signature annotations.
  - `npm run test:tool-reliability` passed.
  - `npm run test:execute-proof-hygiene` passed.
  - `npm run check:premier-no-spend` passed with Phase 5 theme accessibility,
    Phase 7 prompt/routing memory, Phase 4 execute/proof hygiene, lint, and
    build.
  - Runtime was restarted after the server/routing change; `3001`, `5173`,
    server root, `/api/config`, and `/api/router/learning` responded, and the
    Routing Learning payload exposed `toolReliability.errorSignatures`.

## Phase 7 tool-error learning contract alignment - 2026-06-17

- Confirmed the current implementation tracks tool-call errors per model,
  provider, tool, prompt strategy, and prompt variant through saved run traces.
- Confirmed session outcome mining connects first failed tool calls to later
  completed tool calls, final-answer-only recovery, unrecovered errors, and
  retry distance so routing can learn what ultimately worked instead of only
  counting failures.
- Added the missing client API type for `toolReliability.errorSignatures`, so
  normalized model/provider/tool/signature groups remain part of the visible
  Routing Learning/export contract.
- Strengthened the Premier model-harness guard to protect normalized
  tool-error signatures, session-outcome rows, and retry-distance fields.
- Prompt Microscope now reads the latest `worktree_isolation` lifecycle event,
  so preserved or auto-discarded worktree state overrides the initial ready
  event when users inspect a run.
- This slice changed client/types/tests/docs only. The running server does not
  need to be restarted; a browser refresh is enough for the Prompt Microscope
  display change.

## Phase 7 normalized tool-error signature visibility - 2026-06-17

- Routing Learning now renders a dedicated `Normalized tool-error signatures`
  evidence section when saved traces contain signature rows.
- Each row shows the failed model/tool, normalized signature, recovered and
  unrecovered run counts, fallback recovery count, prompt strategy or variant
  context, later model/tool path that worked, average retry distance, and
  example run ids.
- Routing Learning Markdown evidence exports now include the same normalized
  signature rows, so offline evidence carries the exact model/provider/tool
  failure memory used to reduce first-call errors and retry loops.
- The Premier model-harness guard now protects both the in-app normalized
  signature section and the Markdown export signature heading, including
  worked-by retry distance and example run-id fields.
- Session outcome rows, recovery-path rows, and recent tool-error rows now
  surface session/run ids directly in Routing Learning and Markdown evidence,
  making it easier to inspect the saved session or logs that prove what
  ultimately worked.
- Tool failure memory and normalized signature summaries now carry bounded
  `exampleSessionIds` beside `exampleRunIds`, so compact model/tool failure
  rows can point directly to both the saved session and run trace that produced
  the evidence.
- This is client/docs/test-only visibility work. Browser/manual proof and real
  saved-session signature rows remain pending before final closeout.

## Phase 7 tool-error session lookup restart proof - 2026-06-17

- Runtime tool-reliability summary shape changed to include example session ids
  for model/tool failure memory and normalized tool-error signatures.
- Restarted with the repo-native `npm start` launcher after stopping stale
  `3001`/`5173` listeners.
- Reachability proof:
  - `3001` listener: PID `19023`.
  - `5173` listener: PID `19020`.
  - `http://127.0.0.1:3001/api/config` returned `200`.
  - `http://127.0.0.1:5173/` returned `200`.

## Phase 7 recovery-pattern session lookup - 2026-06-17

- Recurring tool-call recovery patterns now carry bounded `exampleSessionIds`
  beside `exampleRunIds`.
- Recovery-pattern session ids are also merged into compact model failure memory
  rows, so the failure-memory view preserves the saved-session breadcrumb even
  when read apart from the recovery-pattern list.
- Routing Learning recovery-pattern rows and Markdown evidence now show both
  session ids and run ids, so repeated failure-to-working-path patterns can be
  traced back to saved session evidence.
- Premier model-harness guards now cover the recovery-pattern session-id
  breadcrumb.
- Restarted with the repo-native `npm start` launcher after stopping stale
  `3001`/`5173` listeners.
- Reachability proof:
  - `3001` listener: PID `44467`.
  - `5173` listener: PID `44462`.
  - `http://127.0.0.1:3001/api/config` returned `200`.
  - `http://127.0.0.1:5173/` returned `200`.
- Follow-up propagation: recovery-pattern session ids are now merged into
  model failure-memory rows.
- Follow-up restart/reachability proof:
  - `3001` listener: PID `63872`.
  - `5173` listener: PID `63871`.
  - `http://127.0.0.1:3001/api/config` returned `200`.
  - `http://127.0.0.1:5173/` returned `200`.

## Phase 7 routing-learning export session breadcrumbs - 2026-06-17

- `scripts/test-router-learning-export.ts` now fixtures recovery patterns,
  failure memory, and normalized error signatures with `exampleSessionIds` and
  `exampleRunIds`.
- The export guard now asserts that Routing Learning exports preserve
  recovery-pattern, failure-memory, and normalized-signature session
  breadcrumbs, plus normalized-signature retry-distance evidence.
- `scripts/test-router-learning-import.ts` now confirms full Routing Learning
  exports that carry enriched `summary.toolReliability` breadcrumb evidence
  still preview/import their routing events cleanly.
- This protects the offline evidence bundle used to inspect what failed, which
  saved session/run proves it, and what model/tool path eventually worked.

## Phase 7 auto-router candidate breadcrumb evidence - 2026-06-17

- Auto-Router tool-reliability candidate-card annotations now include compact
  example session/run breadcrumbs for repeated recovery patterns, model failure
  memory, session outcomes, and normalized error signatures.
- Settings > Auto-Router candidate rows now also include session/run
  breadcrumbs in the visible recent recovery path and accessibility text.
- Settings Auto-Router candidate rows expose the same saved session/run
  breadcrumb expected by the kickoff stop condition, but populated live recovery
  rows still require a real provider-approved or local runtime tool-error run.
- This same proof lane remains responsible for tool, prompt strategy, saved session/run id, retry distance, and later working path requirements for routing/model-harness evidence.
- Settings > Auto-Router candidate rows now label the saved-session breadcrumb
  separately as `Recovery proof: session ..., run ...`.
- The visible Recovery proof label now also exposes a model-specific
  accessibility label with the same session/run ids and Auto-Router context.
- The Phase 7 checklist now requires that visible `Recovery proof: session ...,
  run ...` label during manual Settings > Auto-Router proof, plus its
  model-specific accessibility label.
- `scripts/test-premier-baseline-manifest.ts` now preserves both the visible
  Recovery proof label and accessibility-label requirement in the checklist and
  handoff.
- `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now requires both
  classifier-side candidate-card breadcrumbs and Settings-side candidate-row
  recovery breadcrumbs before Phase 7 routing-memory proof can close.
- `scripts/test-premier-baseline-manifest.ts` now keeps both breadcrumb
  requirements visible in the Premier no-spend baseline handoff.
- `scripts/test-premier-baseline-manifest.ts` now also preserves the exact
  Settings-side `Recovery proof: session ..., run ...` label requirement across
  the checklist and handoff.
- `docs/PREMIER_HARNESS_KICKOFF.md` now also names Settings Auto-Router
  candidate-row saved-session breadcrumbs in the Phase 7 stop condition, and
  the stop-condition audit guard preserves that source-of-truth wording.
- `docs/PREMIER_HARNESS_KICKOFF.md` Stop Condition and paste-ready goal prompt
  now explicitly carry the tool-error memory, saved session/run breadcrumb,
  retry-distance, and later-working-path requirements.
- `scripts/test-premier-stop-condition-audit.ts` now preserves those expanded
  kickoff Stop Condition and paste-ready goal prompt requirements.
- `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now has a phase-mapped row for
  Phase 7 tool-error breadcrumb evidence across Routing Learning, Auto-Router
  Settings, and classifier-side candidate-card annotations.
- The checklist's Premier no-spend command-scope list now also names Phase 7
  tool-error breadcrumb evidence beside prompt/routing memory.
- `NEXT_SESSION.md` now mirrors that Premier no-spend command-scope wording.
- `scripts/test-premier-baseline-manifest.ts` now guards that quick-handoff
  command-scope wording too.
- `scripts/test-premier-stop-condition-audit.ts` now requires that phase-mapped
  breadcrumb row to stay in the proof checklist.
- `scripts/test-premier-baseline-manifest.ts` now also keeps the phase-mapped
  breadcrumb row tied to the Premier no-spend manifest.
- This gives the classifier-side routing evidence the same saved-session lookup
  trail as Routing Learning UI/export, so repeated tool failures can be traced
  back to concrete run evidence while reducing future first-call retries.
- `scripts/test-tool-reliability.ts` now guards those candidate-card
  breadcrumbs.
- `scripts/test-premier-model-harness.ts` now also guards the Auto-Router
  candidate-card breadcrumb strings so the Premier no-spend model-harness gate
  covers classifier-side tool-error evidence.
- `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now explicitly requires
  Auto-Router candidate-card breadcrumb examples for the saved session/run ids
  behind tool-error recovery evidence, and the closeout-matrix guard preserves
  that requirement.
- `scripts/test-premier-baseline-manifest.ts` now also keeps that
  candidate-card breadcrumb requirement tied to the official Premier no-spend
  baseline manifest across the checklist, proof file, and next-session handoff.
- `scripts/test-premier-stop-condition-audit.ts` now also requires the
  checklist and next-session handoff to preserve the candidate-card breadcrumb
  closeout requirement.
- Restarted with the repo-native `npm start` launcher after stopping stale
  `3001`/`5173` listeners.
- Reachability proof:
  - `3001` listener: PID `40553`.
  - `5173` listener: PID `40550`.
  - `http://127.0.0.1:3001/api/config` returned `200`.
  - `http://127.0.0.1:5173/` returned `200`.

## Phase 3 agent detail lazy chunk cleanup - 2026-06-17

## Narrow chat-first layout browser proof - 2026-06-17

- Live no-provider browser inspection at a narrow viewport found a closeout risk:
  the sidebar and main chat region both reported visible overlapping bounds when
  the sidebar was default-open under the responsive breakpoint.
- Fixed the narrow default by auto-closing the sidebar at widths at or below
  640px while keeping the top-bar sidebar toggle available for intentional
  navigation.
- The first post-fix narrow pass removed sidebar/main overlap but exposed a
  squeezed composer text area at 28px wide.
- Fixed the narrow composer layout so the input area uses the available chat
  width and the textarea can shrink/grow within the row.
- Final live browser proof:
  - viewport: 433px by 889px
  - visible sidebar: none by default
  - main area: x=0, width=433px
  - input area: x=10, width=413px
  - chat textarea: x=15, width=360px, `aria-label="Chat message"`
  - sidebar/main overlap: false
  - horizontal overflow: false
  - visible drag/reorder affordances: none
  - visible alerts: none
- Validation:
  - `npm run lint` passed.
  - `npm run build` passed.
- This is client-only Phase 1/manual UI proof progress. No server restart was
  required; a browser refresh was enough.

## Premier narrow-layout regression gate - 2026-06-17

- Added `scripts/test-premier-narrow-layout.ts` to lock down the narrow
  chat-first behavior found during live manual proof:
  - `src/App.tsx` keeps the 640px narrow sidebar auto-close breakpoint.
  - the sidebar closes automatically at narrow width and on resize.
  - the resize listener is cleaned up.
  - `src/styles/components.css` keeps the narrow composer width override.
  - the textarea keeps `min-width: 0`, `flex: 1 1 auto`, and `width: 100%`
    so it cannot collapse to the 28px failure observed in the browser pass.
  - Settings keeps its narrow modal contract: `94vw`, no min-width, stacked
    modal body, full-width nav, bounded nav height, bottom nav divider, and
    hidden horizontal content overflow.
  - Routing Learning keeps its narrow evidence contract: explanation, metrics,
    debug, breakdown, and mini grids collapse to one column; headers stack; and
    actions align from the start.
  - Model Library/Model Lab-adjacent grid rules keep toolbar, summary, and
    model-card columns at one column under the narrow breakpoint.
  - Model Lab and Routing Learning panel registry entries keep narrow-safe
    minimum panel sizes.
- Added `test:premier-narrow-layout`.
- `test:premier-no-spend` now runs:
  - Phase 5 theme accessibility
  - Phase 7 prompt/routing memory
  - Phase 4 execute/proof hygiene
  - Premier narrow-layout regression
- Validation:
  - `npm run test:premier-narrow-layout` passed.
  - `npm run lint` passed.
  - `npm run check:premier-no-spend` passed with the new narrow-layout gate
    included.
  - Follow-up `npm run check:premier-no-spend` passed again after expanding the
    narrow-layout gate to Settings, Routing Learning, Model Library/Model
    Lab-adjacent grids, and proof-panel minimum sizes.
- Browser limitation note: the in-app browser viewport override stopped honoring
  the requested narrow width during follow-up Settings proof, so the new
  regression gate records the narrow layout contract, while broader narrow
  Settings/Model Lab/Routing Learning live proof remains pending.
- This is client/test/docs/package wiring only. No server restart was required.

## Premier proof-trust regression gate - 2026-06-17

- Added `scripts/test-premier-proof-trust.ts` to lock down the Phase 6
  proof-review and trusted-apply contracts without provider spend.
- The gate asserts that Model Lab keeps:
  - labelled proof-review groups and checklists
  - visible review state
  - visible proof-review note labels
  - grouped proof-review actions
  - approve / needs-attention / clear-review labels with trust consequences
  - eval and bench export trust wording
  - proof brief exports preserving proof-review state and notes
  - unapproved eval recommendations/rankings framed as review-only evidence
- The gate asserts that Routing Learning keeps:
  - bulk apply filtered to `proofTrusted` recommendations only
  - skipped unapproved recommendations called out after bulk apply
  - disabled bulk apply when no approved proof exists
  - individual recommendation labels for approved, unreviewed/manual, and
    needs-attention/blocked states
  - export counts for approved, unreviewed, and needs-attention proof
  - Markdown export guidance that unreviewed or attention-needed proof must not
    be treated as approved evidence
- The gate asserts that Settings keeps proof-trust copy and Agent Roles /
  Auto-Router action labels that distinguish approved, manual-after-review, and
  blocked proof states.
- Added `test:premier-proof-trust`.
- `test:premier-no-spend` now includes the proof-trust gate.
- Validation:
  - `npm run test:premier-proof-trust` passed.
  - `npm run lint` passed.
  - `npm run check:premier-no-spend` passed with Phase 5 theme accessibility,
    Phase 7 prompt/routing memory, Phase 4 execute/proof hygiene, Premier
    narrow-layout regression, Premier proof-trust regression, lint, and build.
- This is test/docs/package wiring only. No server restart was required.

## Premier steering-contract regression gate - 2026-06-17

- Added `scripts/test-premier-steering-contract.ts` to lock down the no-spend
  steering contract that supports the kickoff's "steer incorrect work before it
  goes too far" requirement.
- The gate asserts that:
  - all steering actions are accepted by the API and typed in run traces
  - invalid steering actions return `400`
  - missing sessions/runs return `404`
  - steering writes structured `type: 'steering'`, `source: 'user'`,
    `target`, `note`, and `createdAt` run-trace events
  - steering events pass through `appendRunStep()` so trace redaction still
    applies
  - active-run orchestrator and agent steering notes are queued, drained, and
    injected into orchestration or direct-model prompt context
  - pause, cancel, and redirect update active-run control state
  - the client API posts action/note/target to the steering endpoint and raises
    useful errors
  - `App` rejects empty `add-note`, updates message run traces, and refreshes
    the agent detail state after steering saves
  - Agent detail routes run-level steering to the orchestrator, phase-level
    steering to the agent, uses redirect note text when present, explains replay
    persistence, and exposes steering history/replay filters after completion
- Added `test:premier-steering-contract`.
- `test:premier-no-spend` now includes the steering-contract gate.
- Validation:
  - `npm run test:premier-steering-contract` passed.
  - `npm run lint` passed.
  - `npm run check:premier-no-spend` passed with Phase 5 theme accessibility,
    Phase 7 prompt/routing memory, Phase 4 execute/proof hygiene, Premier
    narrow-layout regression, Premier proof-trust regression, Premier
    steering-contract regression, lint, and build.
- This is test/docs/package wiring only. No server restart was required.
- Remaining gap: live provider-approved active-run proof still needs to show a
  real steering action recorded in replay history during a safe phase.

## Premier artifact-review regression gate - 2026-06-17

- Added `scripts/test-premier-artifact-review.ts` to lock down the kickoff's
  artifact-first verification contract without provider spend.
- The gate asserts that generated artifacts keep:
  - a quiet collapsed `Review artifact(s)` entry outside hidden diagnostics
  - review notes/comments
  - flag / needs-revision state
  - approval state
  - structured `approve-artifact` and `needs-revision` steering persistence
  - saved replay event feedback when a run trace is present
  - local-only feedback when no replay persistence path exists
  - `Revise` prompts that include artifact type, label, id, content, and the
    current reviewer note
  - accessible labels, busy state, review state, and feedback status text
- Added `test:premier-artifact-review`.
- `test:premier-no-spend` now includes the artifact-review gate.
- Validation:
  - `npm run test:premier-artifact-review` passed.
  - Full `npm run check:premier-no-spend` was not rerun after adding this gate;
    run it when final local gates are in scope.
- This is test/docs/package wiring only. No server restart was required.

## Premier calm-chat regression gate - 2026-06-17

- Added `scripts/test-premier-calm-chat.ts` to lock down the kickoff's calm-chat
  contract without provider spend.
- The gate asserts that:
  - message diagnostics start collapsed behind `Details`
  - the Details control exposes an accessible summary of hidden surfaces
  - tool calls, confidence, team-plan artifacts, Prompt Microscope, and next
    actions render only inside the opened details region
  - suggested next actions default to a compact `Actions` affordance before
    showing chips
  - confidence stays opt-in and self-contained inside Details
  - Details and confidence affordances keep quiet visual styling
- Added `test:premier-calm-chat`.
- `test:premier-no-spend` now includes the calm-chat gate.
- Validation was not rerun in this slice; run `npm run test:premier-calm-chat`
  or `npm run check:premier-no-spend` when final local gates are in scope.
- This is test/docs/package wiring only. No server restart was required.

## Premier active-work regression gate - 2026-06-17

- Added `scripts/test-premier-active-work.ts` to lock down the kickoff's Phase 2
  active-work model without provider spend.
- The gate asserts that:
  - `buildRunTree()` nests phase agents under the owning run using the phase id
    prefix
  - `buildActiveWorkState()` uses real run-trace orchestration mode and phase
    agents to produce workflow steps
  - running, blocked, error, completed, and pending states remain explicit
    status labels rather than fake percentage progress
  - the chat active-work strip stays a compact status entry point with
    accessible workflow, step, metadata, and `Agent detail` labels
  - the sidebar run/phase rows expose status, task, model/provider, attention,
    artifact, and focus cues for the right-hand inspector
- Added `test:premier-active-work`.
- `test:premier-no-spend` now includes the active-work gate.
- Validation was not rerun in this slice; run `npm run test:premier-active-work`
  or `npm run check:premier-no-spend` when final local gates are in scope.
- This is test/docs/package wiring only. No server restart was required.

## Premier layout-shell regression gate - 2026-06-17

- Added `scripts/test-premier-layout-shell.ts` to lock down the kickoff's Phase
  1 chat-first/non-draggable shell contract without provider spend.
- The gate asserts that:
  - `DEFAULT_LAYOUT` remains chat-only
  - default Tools panels exclude the permanent `sub-agents` split
  - saved layouts prune all default-hidden panels plus forced-hidden
    `sub-agents`
  - advanced panels stay reachable from the top-bar `Tools` menu
  - reset returns to the default layout
  - `LayoutEngine` and `PanelWrapper` do not expose default drag/drop or reorder
    handlers
  - panel headers keep close buttons labelled without adding drag handles
- Added `test:premier-layout-shell`.
- `test:premier-no-spend` now includes the layout-shell gate.
- Validation was not rerun in this slice; run `npm run test:premier-layout-shell`
  or `npm run check:premier-no-spend` when final local gates are in scope.
- This is test/docs/package wiring only. No server restart was required.

## Premier agent-detail regression gate - 2026-06-17

- Added `scripts/test-premier-agent-detail.ts` to lock down the kickoff's Phase
  3 right-hand inspector contract without provider spend.
- The gate asserts that:
  - `AgentFocusPanel` remains a complementary `Agent detail inspector`
  - the detail panel lazy-loads `SubAgentTracker` instead of keeping permanent
    split chrome
  - selected agents expose status, objective, model/provider, token/time, and
    focus labels
  - `SubAgentTracker` keeps workflow progress, compact tool bundles, replay
    summary, latest proof, replay filters, and replay event list semantics
  - steering controls preserve flag, redirect, pause, cancel, request-proof,
    approve-artifact, needs-revision, note, target, and history behavior
  - replay filters preserve proof/files/tools/routing/steering/error views
- Added `test:premier-agent-detail`.
- `test:premier-no-spend` now includes the agent-detail gate.
- Validation was not rerun in this slice; run `npm run test:premier-agent-detail`
  or `npm run check:premier-no-spend` when final local gates are in scope.
- This is test/docs/package wiring only. No server restart was required.

## Premier model-harness regression gate - 2026-06-17

- Added `scripts/test-premier-model-harness.ts` to lock down the kickoff's
  Phase 6 model-harness trust contract without provider spend.
- The gate asserts that:
  - model ability utilities expose thinking, vision, tools, and long-context
    support with honest available/unavailable labels
  - Settings keeps model capability scorecards and role/effort scoring inputs
  - premium/luxury model warnings, model budget controls, and provider
    rate-limit controls remain visible before expensive work
  - Auto-Router explains classifier, default fallback, threshold, effective
    cost, eval-proof trust, and candidate evidence freshness
  - Auto-Router candidate rows show eval-backed cues, tool reliability,
    risky tool pairs, prompt-strategy reliability, capability flags, effective
    cost, and editable capability cards
  - Routing Learning shows tool reliability by model, provider, tool,
    model/tool pair, prompt strategy, and strategy variant with first-call and
    recovery-round evidence
  - Model Lab proof briefs preserve best model, prompt strategy results,
    recommendation trust, and inspectable output evidence wording
- Added `test:premier-model-harness`.
- `test:premier-no-spend` now includes the model-harness gate.
- Validation was not rerun in this slice; run
  `npm run test:premier-model-harness` or `npm run check:premier-no-spend`
  when final local gates are in scope.
- This is test/docs/package wiring only. No server restart was required.

## Premier theme-texture regression gate - 2026-06-17

- Added `scripts/test-premier-theme-textures.ts` to lock down the kickoff's
  Phase 5 texture-layer contract without provider spend.
- The gate asserts that:
  - theme tokens enumerate the approved texture recipes
  - built-in themes expose texture CSS variables and safe `none` defaults
  - theme plugin validation and schema cap `textureOpacity` at `0.18`
  - app-shell texture recipes render through `.app-layout::before`, not dense
    text surfaces
  - texture overlays ignore pointer events
  - reduced transparency disables texture opacity, blur, and backdrop filters
  - Settings exposes a shell-wide texture opacity slider with `0..18%` bounds
    and explains the reduced-transparency fallback
- Added `test:premier-theme-textures`.
- `test:premier-no-spend` now includes the theme-texture gate.
- Validation was not rerun in this slice; run
  `npm run test:premier-theme-textures` or `npm run check:premier-no-spend`
  when final local gates are in scope.
- This is test/docs/package wiring only. No server restart was required.

## Premier Review Changes regression gate - 2026-06-17

- Added `scripts/test-premier-review-changes.ts` to lock down the kickoff's
  one-path diff/patch/review contract without provider spend.
- The gate asserts that:
  - permanent `Diffs` / `Patches` layout panels are not reintroduced
  - `ReviewChangesFlyout` remains the single accessible dialog for Summary,
    Files, Patches, Validate, and Commit
  - the flyout preserves keyboardable tab semantics
  - file rows keep stage, unstage, review, explain, and propose-patch actions
  - patch proposals stay hosted inside the Review Changes flow
  - validation proof can be copied, downloaded, and saved back to chat as an
    artifact
  - Environment rail `Changes` is the primary review entry point for no-project,
    clean-tree, and changed-tree states
  - assistant message patch actions route into the patch proposal/review flow
- Added `test:premier-review-changes`.
- `test:premier-no-spend` now includes the Review Changes gate.
- Validation was not rerun in this slice; run
  `npm run test:premier-review-changes` or `npm run check:premier-no-spend`
  when final local gates are in scope.
- This is test/docs/package wiring only. No server restart was required.

## Premier baseline-manifest regression gate - 2026-06-17

- Added `scripts/test-premier-baseline-manifest.ts` to lock down the Phase 0
  source-of-truth contract for the Premier no-spend baseline.
- The gate asserts that:
  - `test:premier-no-spend` includes every current no-spend gate
  - `check:premier-no-spend` still runs the no-spend baseline plus lint/build
  - `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` names every current gate scope
  - this closeout proof document keeps a section for every Premier gate
  - `NEXT_SESSION.md` lists every current Premier regression in the handoff
- Added `test:premier-baseline-manifest`.
- `test:premier-no-spend` now includes the baseline-manifest gate.
- Validation was not rerun in this slice; run
  `npm run test:premier-baseline-manifest` or
  `npm run check:premier-no-spend` when final local gates are in scope.
- This is test/docs/package wiring only. No server restart was required.

## Premier stop-condition audit regression gate - 2026-06-17

- Added `scripts/test-premier-stop-condition-audit.ts` to lock down the
  kickoff stop-condition audit before the goal can be treated as complete.
- The gate asserts that:
  - every kickoff stop condition remains present in the kickoff source and the
    closeout evidence table
  - the proof checklist keeps the phase-mapped review matrix, runtime scenario
    proof template, and final-gate template
  - the closeout proof preserves explicit remaining-gap language for live
    active-run proof, steering proof, reduced-motion/transparency proof,
    proof-review decisions, provider-approved prompt strategy proof, and
    restart/reachability
  - `NEXT_SESSION.md` keeps the source-of-truth, approval, and
    stale-evidence-not-complete handoff guards
- Added `test:premier-stop-condition-audit`.
- `test:premier-no-spend` now includes the stop-condition audit gate.
- Validation was not rerun in this slice; run
  `npm run test:premier-stop-condition-audit` or
  `npm run check:premier-no-spend` when final local gates are in scope.
- This is test/docs/package wiring only. No server restart was required.

## Premier prompt-source provenance regression gate - 2026-06-17

- Refreshed the Phase 7 prompt strategy source list against official provider
  docs for OpenAI, Anthropic, Google Gemini, and Mistral.
- Updated `server/promptStrategies.ts` source refs from older OpenAI/Claude URLs
  to current official `platform.openai.com` and `docs.anthropic.com` docs.
- Added `scripts/test-premier-prompt-source-provenance.ts` to lock down the
  provider-source contract.
- The gate asserts that:
  - prompt strategy source refs use official provider documentation
  - `docs/PROMPT_STRATEGY_DATABASE_PLAN.md` cites the same official URLs
  - every prompt strategy profile source ref comes from the central registry
  - the plan preserves source refresh and primary-source guidance
- Added `test:premier-prompt-source-provenance`.
- `test:premier-no-spend` now includes the prompt-source provenance gate.
- Validation was not rerun in this slice; run
  `npm run test:premier-prompt-source-provenance` or
  `npm run check:premier-no-spend` when final local gates are in scope.
- This touched server prompt-strategy metadata only. Restart/reachability proof
  follows in the active session notes.

- Removed the duplicate static import that made the `SubAgentTracker` dynamic import ineffective.
- `AgentFocusPanel` now lazy-loads `SubAgentTracker` behind a local suspense boundary, matching the pinned-panel lazy loading path.
- Validation proof:
  - `npm run lint` passed.
  - `npm run build` passed.
  - Build output now emits a separate `SubAgentTracker` chunk and no longer reports the ineffective dynamic-import warning.

## Phase 7 tool-call outcome learning goal alignment - 2026-06-17

- Updated `docs/PREMIER_HARNESS_KICKOFF.md` so tool-call error memory is part of the Premier goal: model/provider/tool failure, prompt strategy context, later working path, and retry cost.
- Updated `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` so the Phase 7 routing-memory proof explicitly includes tool-reliability outcome mining evidence.
- Existing implementation evidence remains centered on `server/toolReliability.ts`, `test:tool-reliability`, Routing Learning exports, and Auto-Router candidate-card annotations.
- Restart proof after server prompt-strategy provenance metadata changes: killed previous `3001`/`5173` listeners, relaunched with `npm start`, confirmed `http://127.0.0.1:3001/api/config` responded, confirmed `http://127.0.0.1:5173/` returned HTTP 200, and confirmed fresh listeners on PIDs 59642 (`3001`) and 59640 (`5173`).

## Premier manifest and stop-condition audit tightening - 2026-06-17

- Tightened `scripts/test-premier-baseline-manifest.ts` so the Premier no-spend manifest must keep `test:premier-stop-condition-audit` and `test:premier-prompt-source-provenance` in the bundle, checklist, proof doc, and next-session handoff.
- Tightened `scripts/test-premier-stop-condition-audit.ts` so the closeout audit must preserve the newer Phase 7 stop condition: OpenHarness can explain which model/tool/prompt-strategy combinations failed, which later path worked, and how routing or prompt contracts should change to reduce first-call errors and retry loops.
- Remaining gap before final closeout: saved local sessions currently do not contain populated real-world failure-memory/recovery-pattern rows, so `test:tool-reliability` proves the session/log-mining contract but live Routing Learning evidence still needs a future real tool-error run or approved proof scenario.
- This was docs/test-only audit tightening. No server/runtime restart was required.

## Premier live-evidence guard regression gate - 2026-06-17

- Added `scripts/test-premier-live-evidence-guard.ts` to prevent static regression coverage from being mistaken for final live/provider/manual proof.
- The gate asserts that:
  - the kickoff keeps the rule that missing or indirect checklist evidence leaves the overhaul open
  - the proof checklist preserves direct-evidence, stale-evidence, provider-spend approval, runtime scenario, and final-gate boundaries
  - this closeout proof keeps explicit remaining live-evidence gaps for provider-approved prompt traces, real-world tool failure-memory/recovery rows, active-run proof, steering proof, and reduced-motion/transparency browser proof
  - `NEXT_SESSION.md` keeps the Phase 7 proof gap, provider-budget approval guard, stale-evidence guard, browser/manual proof approval, and final-gate approval language
- Added `test:premier-live-evidence-guard`.
- `test:premier-no-spend` now includes the live-evidence-guard gate.
- Validation was not rerun in this slice; run `npm run test:premier-live-evidence-guard` or `npm run check:premier-no-spend` when final local gates are in scope.
- This is docs/test/package wiring only. No server restart was required.

## Premier approval-boundaries regression gate - 2026-06-17

- Added `scripts/test-premier-approval-boundaries.ts` to keep provider-spend, browser/manual proof, and final local validation approval boundaries explicit while the Premier overhaul remains open.
- The gate asserts that:
  - the proof checklist preserves the provider-backed proof approval prompt and options
  - provider-spend proof remains marked as approval-gated
  - `NEXT_SESSION.md` keeps browser/manual proof approval, final-gate approval, provider-budget approval, and stale-evidence-not-complete language
  - this closeout proof keeps explicit incomplete-proof language for provider-approved prompt strategy proof, live active-run proof, skipped validation, and restart scope
- Added `test:premier-approval-boundaries`.
- `test:premier-no-spend` now includes the approval-boundaries gate.
- Validation was not rerun in this slice; run `npm run test:premier-approval-boundaries` or `npm run check:premier-no-spend` when final local gates are in scope.
- This is docs/test/package wiring only. No server restart was required.

## Premier closeout-matrix regression gate - 2026-06-17

- Added `scripts/test-premier-closeout-matrix.ts` to keep final Premier completion tied to a phase-mapped and stop-condition-mapped evidence matrix instead of loose regression notes.
- The gate asserts that:
  - the proof checklist preserves the phase-mapped review matrix for Phases 1 through 7
  - the checklist preserves the `Premier Harness Closeout Evidence`, `Runtime Scenario Proof`, `Final Gates`, and remaining-risks template sections
  - this closeout proof preserves the kickoff stop-condition evidence matrix with required evidence and status/notes columns
  - `NEXT_SESSION.md` tells future sessions to keep filling the durable proof file from remaining stop-condition gaps instead of treating partial evidence as completion
- Added `test:premier-closeout-matrix`.
- `test:premier-no-spend` now includes the closeout-matrix gate.
- Validation was not rerun in this slice; run `npm run test:premier-closeout-matrix` or `npm run check:premier-no-spend` when final local gates are in scope.
- This is docs/test/package wiring only. No server restart was required.

## Premier no-spend gate wording alignment - 2026-06-17

- Cleaned up `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` so the current no-spend gate list clearly names baseline-manifest, stop-condition-audit, prompt-source-provenance, live-evidence-guard, approval-boundaries, and closeout-matrix regression gates as separate requirements.
- Updated the top-level `NEXT_SESSION.md` repository-state note so the current `test:premier-no-spend` bundle names all newer guard gates instead of stopping at prompt-source provenance.
- Follow-up alignment: the same top-level handoff now also names the
  restart-scope and worktree-isolation contract gates.
- Current aligned gate tail: baseline-manifest, stop-condition-audit,
  prompt-source-provenance, live-evidence-guard, approval-boundaries,
  closeout-matrix, restart-scope, and worktree-isolation.
- This was docs-only handoff/checklist alignment. It did not rerun validation and does not close the remaining live/manual/provider-backed proof gaps.
- No server/runtime restart was required.

## Premier restart-scope regression gate - 2026-06-17

- Added `scripts/test-premier-restart-scope.ts` to keep the kickoff restart rules tied to the Premier no-spend baseline.
- The gate asserts that:
  - client-only changes do not require a server restart
  - docs-only changes do not require any restart
  - server/runtime changes require killing existing OpenHarness processes, relaunching, and verifying `3001`, `5173`, and `/api/config`
  - the proof checklist preserves restart/reachability as direct closeout evidence
  - this closeout proof keeps both restart-proof and no-restart-required language
  - `NEXT_SESSION.md` keeps the server/runtime relaunch handoff guard
- Added `test:premier-restart-scope`.
- `test:premier-no-spend` now includes the restart-scope gate.
- Validation was not rerun in this slice; run `npm run test:premier-restart-scope` or `npm run check:premier-no-spend` when final local gates are in scope.
- This is docs/test/package wiring only. No server restart was required.

## Premier worktree-isolation regression gate - 2026-06-17

- Added `scripts/test-premier-worktree-isolation.ts` to keep the kickoff requirement for worktree isolation per implementation agent visible in the Premier no-spend baseline.
- The gate asserts that:
  - `docs/PREMIER_HARNESS_KICKOFF.md` preserves the product requirement for worktree isolation before multi-agent write flow
  - the proof checklist keeps worktree isolation in Phase 6/model-harness closeout coverage
  - this closeout proof keeps worktree isolation and multi-agent write flow language visible as remaining safety evidence
  - `NEXT_SESSION.md` keeps the worktree-isolation handoff and current no-spend gate name
- Added `test:premier-worktree-isolation`.
- `test:premier-no-spend` now includes the worktree-isolation gate.
- Remaining gap: this guard preserves the requirement and closeout boundary; it does not by itself implement or prove isolated worktrees for live multi-agent write flow.
- Validation was not rerun in this slice; run `npm run test:premier-worktree-isolation` or `npm run check:premier-no-spend` when final local gates are in scope.
- This is docs/test/package wiring only. No server restart was required.

## Premier execute worktree isolation implementation - 2026-06-17

- Advanced the kickoff worktree-isolation requirement from documentation guard toward runtime behavior.
- `server/orchestrator.ts` now attempts to create an OpenHarness git worktree before execute-mode implementer work when a project folder is open.
- When worktree creation succeeds, implementer, implementer retry, deterministic artifact fallback, validation repair, apply/validation proof, and reviewer phases use the isolated worktree path instead of the base checkout path.
- Run traces now include a `worktree_isolation` step with `ready`, `failed`, or `unavailable` status plus worktree id, path, branch, base ref, and error metadata when available.
- Final execute output now includes a worktree isolation proof section telling the user which isolated worktree was used and that promotion/discard should happen from Safety.
- `scripts/test-premier-worktree-isolation.ts` now checks the real orchestrator isolation hooks and shared run-trace typing, not only docs/handoff wording.
- Remaining gap: live execute proof still needs to show a real implementation run creating an isolated worktree and then promoting or discarding through Safety before this requirement can be marked fully closed.
- Server/runtime code changed; restart/reachability proof follows in active session notes.

## Premier execute worktree isolation restart proof - 2026-06-17

- Restarted after server/runtime execute-orchestration changes for worktree isolation.
- Targeted existing LISTEN sockets on `3001` and `5173`, relaunched with `npm start`, and confirmed fresh listener PIDs: `99752` on `3001` and `99738` on `5173`.
- Confirmed `http://127.0.0.1:3001/api/config` responded.
- Confirmed `http://127.0.0.1:5173/` returned HTTP 200.
- No full validation suite was run in this slice; `test:premier-worktree-isolation`, `test:premier-no-spend`, lint, and build remain available for the final approved local gate pass.

## Premier worktree isolation Agent detail visibility - 2026-06-17

- `src/components/SubAgentTracker.tsx` now renders `worktree_isolation` run-trace steps in Agent detail replay instead of leaving them as unhandled/unknown events.
- Replay filtering treats worktree isolation as proof and routing evidence, so the event is visible in the places users check for safety and execution context.
- Run replay summaries now count ready isolated worktrees, and latest proof can report whether worktree isolation is ready, failed, or unavailable.
- `scripts/test-premier-agent-detail.ts` now locks the Agent detail worktree-isolation replay surface.
- `scripts/test-premier-worktree-isolation.ts` now checks that the UI exposes the isolation evidence emitted by the orchestrator.
- This was client/test/docs work. Browser refresh is enough; no server restart was required.

## Premier worktree isolation active-work cue - 2026-06-17

- `src/utils/agentWorkState.ts` now surfaces the latest `worktree_isolation` run-trace event as compact active-work metadata before artifact proof.
- When isolation is ready, active work can show `isolated worktree: <id/branch/path>`; failed or unavailable isolation is surfaced as `worktree isolation <status>` with the error or reason.
- `scripts/test-premier-active-work.ts` now includes a synthetic ready worktree event and asserts the active-work state exposes `isolated worktree: wt-123`.
- `scripts/test-premier-worktree-isolation.ts` now checks the active-work cue path in addition to orchestrator, trace typing, and Agent detail replay visibility.
- This was client/test/docs work. Browser refresh is enough; no server restart was required.

## Premier worktree isolation replay/export coverage - 2026-06-17

- `src/App.tsx` now describes `worktree_isolation` run steps in live run activity instead of falling through as an unknown event.
- `server/index.ts` now includes `worktreeIsolation` in exported run debug bundles and emits visible thinking/status text for isolation readiness/failure.
- `src/components/PromptMicroscope.tsx` now shows a compact Worktree isolation metadata row when a run trace includes the isolation event.
- `scripts/test-premier-worktree-isolation.ts` now locks live activity text, debug export preservation, Prompt Microscope metadata, Agent detail replay visibility, active-work metadata, shared trace typing, and orchestrator isolation hooks.
- Server/runtime code changed; restart/reachability proof follows in active session notes.

## Premier worktree isolation replay/export restart proof - 2026-06-17

- Restarted after server/runtime replay-export changes for worktree isolation evidence.
- Targeted existing LISTEN sockets on `3001` and `5173`, relaunched with `npm start`, and confirmed fresh listener PIDs: `57393` on `3001` and `57391` on `5173`.
- Confirmed `http://127.0.0.1:3001/api/config` responded.
- Confirmed `http://127.0.0.1:5173/` returned HTTP 200.
- No full validation suite was run in this slice; `test:premier-worktree-isolation`, `test:premier-no-spend`, lint, and build remain available for the final approved local gate pass.

## Premier worktree isolation Safety discoverability - 2026-06-17

- Agent detail replay worktree-isolation details now tell users: `Open Safety > Worktrees to validate, promote, or discard this isolated worktree.`
- Prompt Microscope worktree-isolation metadata now includes `Safety > Worktrees` when isolation is ready.
- This connects runtime isolation proof to the existing Safety worktree controls without adding new chrome or duplicating the promote/discard flow.
- `scripts/test-premier-worktree-isolation.ts` now locks the Safety breadcrumb in both Agent detail replay and Prompt Microscope metadata.
- This was client/test/docs work. Browser refresh is enough; no server restart was required.

## Premier worktree Safety action clarity - 2026-06-17

- `src/components/SafetyPanel.tsx` Worktrees copy now says users can validate, promote, or discard isolated changes from Safety.
- Worktree validation title now names the isolated worktree, and the destructive worktree action is visibly labelled `Discard` instead of being icon-only.
- Clean and dirty removal titles now say `Discard isolated worktree` / `Force-discard isolated worktree with uncommitted changes`, matching the Agent detail and Prompt Microscope breadcrumb language.
- `scripts/test-premier-worktree-isolation.ts` now locks the Safety validate/promote/discard wording.
- This was client/test/docs work. Browser refresh is enough; no server restart was required.

## Premier worktree trace-to-Safety matching - 2026-06-17

- `src/components/SafetyPanel.tsx` now shows the short worktree id in each Safety > Worktrees row.
- This lets users match `worktree_isolation` run-trace proof to the exact Safety row before choosing Validate, Promote, or Discard.
- `scripts/test-premier-worktree-isolation.ts` now locks the visible worktree id cue in the Safety panel.
- This was client/test/docs work. Browser refresh is enough; no server restart was required.

## Premier worktree Safety action accessibility - 2026-06-17

- `src/components/SafetyPanel.tsx` now gives Safety > Worktrees actions accessible labels that include the short worktree id and row label.
- Show diff, Validate, Promote, and Discard controls can now be distinguished by the same id surfaced in `worktree_isolation` trace evidence.
- `scripts/test-premier-worktree-isolation.ts` now locks these trace-to-action accessible labels.
- This was client/test/docs work. Browser refresh is enough; no server restart was required.

## Premier worktree exact-id cue - 2026-06-17

- `src/components/SafetyPanel.tsx` now exposes the full worktree id on the visible short id in Safety > Worktrees.
- This lets users reconcile exact exported/debug `worktree_isolation` evidence with the visible Safety row without adding noisy chrome.
- `scripts/test-premier-worktree-isolation.ts` now locks the exact-id cue.
- This was client/test/docs work. Browser refresh is enough; no server restart was required.

## Premier execute worktree cleanup lifecycle - 2026-06-17

- `server/orchestrator.ts` now refreshes the execute isolation worktree after implementer/validation/review work.
- Clean isolated worktrees with no changes are auto-discarded so empty execute sandboxes do not accumulate.
- Dirty isolated worktrees remain available in Safety > Worktrees for Validate, Promote, or Discard.
- The execute isolation proof text now records whether the worktree was auto-discarded, preserved for Safety review, or had a cleanup-check failure.
- `scripts/test-premier-worktree-isolation.ts` now locks clean auto-discard and dirty worktree preservation behavior.
- Remaining live proof: run an approved execute scenario that creates an isolated worktree and demonstrates the preserved dirty path or clean auto-discard path.
- Server/runtime code changed; restart/reachability proof follows in active session notes.

## Premier execute worktree cleanup restart proof - 2026-06-17

- Restarted after server/runtime execute worktree cleanup changes.
- Targeted existing LISTEN sockets on `3001` and `5173`, relaunched with `npm start`, and confirmed fresh listener PIDs: `36251` on `3001` and `36250` on `5173`.
- Confirmed `http://127.0.0.1:3001/api/config` responded.
- Confirmed `http://127.0.0.1:5173/` returned HTTP 200.
- No full validation suite was run in this slice; `test:premier-worktree-isolation`, `test:premier-no-spend`, lint, and build remain available for the final approved local gate pass.

## Premier worktree lifecycle trace statuses - 2026-06-17

- `worktree_isolation` run-trace steps now distinguish `ready`, `preserved`, `auto_discarded`, `unavailable`, and `failed` states.
- Execute cleanup now emits a structured `auto_discarded` step when a clean isolated worktree is removed, a `preserved` step when a dirty isolated worktree remains in Safety, and a `failed` step if cleanup cannot be checked or completed.
- Agent detail replay, active-work metadata, live run activity, Prompt Microscope metadata, server visible status, and debug exports now have explicit wording for preserved and auto-discarded worktrees.
- `scripts/test-premier-worktree-isolation.ts` now locks the lifecycle statuses and the corresponding UI/export surfaces.
- Server/runtime code changed; restart/reachability proof follows in active session notes.

## Premier worktree lifecycle trace restart proof - 2026-06-17

- Restarted after server/runtime lifecycle trace status changes.
- Targeted existing LISTEN sockets on `3001` and `5173`, relaunched with `npm start`, and confirmed fresh listener PIDs: `62863` on `3001` and `62861` on `5173`.
- Confirmed `http://127.0.0.1:3001/api/config` responded.
- Confirmed `http://127.0.0.1:5173/` returned HTTP 200.
- No full validation suite was run in this slice; `test:premier-worktree-isolation`, `test:premier-no-spend`, lint, and build remain available for the final approved local gate pass.

## Phase 7 routing-adherence gate alignment - 2026-06-17

- Added `npm run test:routing-adherence` to the `test:prompt-routing-memory` bundle so the automated Phase 7 no-spend proof matches the kickoff validation list.
- Updated `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` to name routing adherence in the no-spend baseline and Phase 7 prompt/routing evidence capture rows.
- Updated `scripts/test-premier-baseline-manifest.ts` to guard the package-script inclusion and the `NEXT_SESSION.md` handoff breadcrumb.
- This is package/docs/test-manifest alignment only. No server/runtime restart was required. The gate has not been run in this continuation; final validation remains pending approval.

## Restart duplicate-window stop-condition audit alignment - 2026-06-17

- Added the kickoff stop condition `Runtime relaunch does not leave duplicate OpenHarness/Electron windows.` to the closeout proof matrix.
- Updated `scripts/test-premier-stop-condition-audit.ts` so the stop-condition audit preserves the duplicate-window restart requirement alongside reachability proof.
- This is docs/test-manifest alignment only. No server/runtime restart was required. The audit has not been rerun in this continuation; final validation remains pending approval.

## Phase 6 calibration/comparison pack guard alignment - 2026-06-17

- Added regression coverage in `scripts/test-premier-model-harness.ts` for Model Lab Prompt Packs calibration/comparison guidance: cheaper open candidates first, tight frontier comparisons second, export pack evidence, and apply role/router changes only when the evidence supports them.
- Updated `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` so the Phase 6 proof checklist names the kickoff calibration/comparison flow explicitly.
- This is docs/test-manifest alignment only. No server/runtime restart was required. The model-harness gate has not been rerun in this continuation; final validation remains pending approval.

## Phase 6 provider-health and rate-limit guard alignment - 2026-06-17

- Added regression coverage in `scripts/test-premier-model-harness.ts` for Settings provider-health badge states and Model Lab warnings for provider rate limits, metered billing, provider health, and provider-budget approval before expensive runs.
- Updated `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` so Phase 6 proof explicitly requires provider health and rate-limit warnings before Model Lab work or provider/model configuration changes.
- This is docs/test-manifest alignment only. No server/runtime restart was required. The model-harness gate has not been rerun in this continuation; final validation remains pending approval.

## Worktree isolation diff-review guard alignment - 2026-06-17

- Added regression coverage in `scripts/test-premier-worktree-isolation.ts` for Safety > Worktrees diff inspection before Validate/Promote/Discard decisions.
- Updated `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` so worktree-isolation proof requires the ability to inspect diffs, validate, promote, or discard isolated worktrees before multi-agent write flows are treated as safe.
- This is docs/test-manifest alignment only. No server/runtime restart was required. The worktree-isolation gate has not been rerun in this continuation; final validation remains pending approval.

## Review Changes patch-action language alignment - 2026-06-17

- Updated `src/components/MessageBubble.tsx` so assistant message diff actions title themselves as sending the diff to `Review Changes`, not a separate `Patch Review panel`.
- Updated `scripts/test-premier-review-changes.ts` to guard that Review Changes wording and the no-project Review Changes dialog label.
- This is client/test-manifest alignment only. Browser refresh is enough; no server/runtime restart was required. The Review Changes gate has not been rerun in this continuation; final validation remains pending approval.

## Calm-chat replay proof affordance guard alignment - 2026-06-17

- Added regression coverage in `scripts/test-premier-calm-chat.ts` for the quiet replay-export button and compact `Run replay` summary in assistant messages.
- This preserves replayable proof as an artifact-first affordance without moving tool traces, Prompt Microscope, confidence, or next actions back into default message chrome.
- This is test-manifest alignment for existing client UI. Browser refresh is enough; no server/runtime restart was required. The calm-chat gate has not been rerun in this continuation; final validation remains pending approval.

## Artifact drawer copy and expansion guard alignment - 2026-06-17

- Added regression coverage in `scripts/test-premier-artifact-review.ts` for artifact copy labels and long-artifact preview/full-content controls.
- This preserves the kickoff artifact-first trust requirement by keeping generated artifacts inspectable, copyable, and reviewable without exposing raw diagnostic clutter by default.
- This is test-manifest alignment for existing client UI. Browser refresh is enough; no server/runtime restart was required. The artifact-review gate has not been rerun in this continuation; final validation remains pending approval.

## Active-work Environment rail guard alignment - 2026-06-17

- Added regression coverage in `scripts/test-premier-active-work.ts` for the Environment rail active-work summary: workflow label, current task, model/provider, latest proof/artifact cue, compact step list, current-step marker, and Agent detail entry point.
- This supports the kickoff requirement that left/environment context explains active work while staying compact and trace-backed, not becoming a second chat.
- This is test-manifest alignment for existing client UI. Browser refresh is enough; no server/runtime restart was required. The active-work gate has not been rerun in this continuation; final validation remains pending approval.

## Quiet bottom status chrome alignment - 2026-06-17

- Updated `src/components/StatusBar.tsx` so the permanent bottom status strip is hidden during quiet chat and appears only for active warnings, background model/routing activity, or an already-open status surface such as model/trust/terminal controls.
- Added regression coverage in `scripts/test-premier-layout-shell.ts` for quiet-status behavior and fixed Environment rail context sections.
- Updated `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` so closeout proof must confirm bottom status chrome is not permanent in quiet chat.
- This is client/test/docs work. Browser refresh is enough; no server/runtime restart was required. The layout-shell gate has not been rerun in this continuation; final validation remains pending approval.

## Quiet status chrome shell-gate refinement - 2026-06-17

- Refined the quiet-status change so `src/App.tsx` owns the bottom chrome mount decision and includes Auto-Router activity as an active reason to show it.
- Removed the duplicate inner hide gate from `src/components/StatusBar.tsx`, preserving model/trust/terminal controls whenever the shell renders the status bar.
- Updated `scripts/test-premier-layout-shell.ts` to guard App-level quiet-status mount conditions plus StatusBar warning/terminal surfaces.
- This is client/test/docs work. Browser refresh is enough; no server/runtime restart was required. The layout-shell gate has not been rerun in this continuation; final validation remains pending approval.

## Top-bar model/router evidence entry alignment - 2026-06-17

- Updated `src/components/TopBar.tsx` so the model/router badge opens the relevant evidence surface: Routing Learning for `Router`, Model Lab for concrete models.
- Updated `src/styles/components.css` so the badge remains quiet but behaves like an actionable control.
- Added regression coverage in `scripts/test-premier-layout-shell.ts` for the model/router evidence entry point.
- This addresses the earlier recorded gap where the top-bar `Router` label did not open routing trust/detail. Browser refresh is enough; no server/runtime restart was required. The layout-shell gate has not been rerun in this continuation; final validation remains pending approval.

## Top-bar model/router focus guard alignment - 2026-06-17

- Added explicit keyboard focus styling for the top-bar model/router evidence button in `src/styles/components.css`.
- Updated `scripts/test-premier-layout-shell.ts` so the evidence badge remains a typed button with hover/focus affordances.
- This is client/test/docs work. Browser refresh is enough; no server/runtime restart was required. The layout-shell gate has not been rerun in this continuation; final validation remains pending approval.

## Top-bar evidence entry checklist alignment - 2026-06-17

- Updated `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` so closeout proof includes the top-bar model/router evidence entry: `Router` opens Routing Learning and concrete models open Model Lab.
- Updated `scripts/test-premier-layout-shell.ts` to preserve that checklist wording.
- This is docs/test alignment only. No server/runtime restart was required. The layout-shell gate has not been rerun in this continuation; final validation remains pending approval.

## Top-bar evidence entry open-not-toggle refinement - 2026-06-17

- Updated `src/components/TopBar.tsx` so the model/router evidence badge opens the relevant panel instead of toggling it closed if already visible.
- Updated `src/App.tsx` to pass `addPanel` as `onOpenPanel` while preserving Tools menu toggle behavior.
- Updated `scripts/test-premier-layout-shell.ts` to guard the open-not-toggle contract.
- This is client/test work. Browser refresh is enough; no server/runtime restart was required. The layout-shell gate has not been rerun in this continuation; final validation remains pending approval.

## Top-bar mock snippet contract alignment - 2026-06-17

- Updated `src/utils/mockData.ts` so the demo/mock assistant snippet reflects the current top-bar model/router evidence-entry contract instead of showing a passive/minimal `TopBar` call.
- Updated `scripts/test-premier-layout-shell.ts` to guard the mock snippet alignment.
- This is client/test alignment only. Browser refresh is enough; no server/runtime restart was required. The layout-shell gate has not been rerun in this continuation; final validation remains pending approval.

## Top-bar quiet-control semantics alignment - 2026-06-17

- Updated `src/components/TopBar.tsx` so the sidebar toggle and Tools menu expose direct button labels while decorative top-bar icons are hidden from assistive tech.
- Updated `scripts/test-premier-layout-shell.ts` to preserve those top-bar quiet-control semantics.
- This is client/test alignment only. Browser refresh is enough; no server/runtime restart was required. The layout-shell gate has not been rerun in this continuation; final validation remains pending approval.

## Agent detail inactive-run steering boundary alignment - 2026-06-17

- Updated `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` so Agent detail proof must confirm inactive/completed/blocked runs do not show unsafe live steering controls, while replay filters remain available for proof/routing/artifact-feedback/past-steering inspection.
- Updated `scripts/test-premier-agent-detail.ts` to guard that inactive-run steering boundary and checklist wording.
- This is docs/test alignment only. No server/runtime restart was required. The agent-detail gate has not been rerun in this continuation; final validation remains pending approval.

## Steering next-safe-phase proof alignment - 2026-06-17

- Updated `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` so runtime scenario proof must confirm steering notes are recorded as structured replay evidence and injected into the next safe orchestrator or agent phase.
- Updated `scripts/test-premier-steering-contract.ts` to preserve the next-safe-phase instruction copy and checklist wording.
- This is docs/test alignment only. No server/runtime restart was required. The steering-contract gate has not been rerun in this continuation; final validation remains pending approval.

## Pause/cancel steering semantics alignment - 2026-06-17

- Updated `src/components/SubAgentTracker.tsx` so Pause/Cancel descriptions match the current runtime behavior: safe stop/cancel plus replay evidence, not a resumable pause workflow.
- Updated `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` so runtime proof must not treat Pause as resumable unless a dedicated resume path is implemented and proven.
- Updated `scripts/test-premier-steering-contract.ts` to guard that boundary.
- This is client/docs/test alignment only. No server/runtime restart was required. The steering-contract gate has not been rerun in this continuation; final validation remains pending approval.

## Artifact feedback replay-evidence checklist alignment - 2026-06-17

- Updated `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` so artifact approval/revision proof must show structured replay steering evidence with artifact label, type, id, and reviewer note.
- Updated `scripts/test-premier-artifact-review.ts` to preserve that checklist requirement.
- This is docs/test alignment only. No server/runtime restart was required. The artifact-review gate has not been rerun in this continuation; final validation remains pending approval.

## Tool-reliability evidence-source tuning guard alignment - 2026-06-17

- Updated `scripts/test-tool-reliability.ts` to directly protect source-aware tuning actions for `log_trace` and `imported_trace` retry-reduction recommendations.
- Added coverage that identical avoid/prefer recommendations from different evidence sources remain separate rows so imported/log evidence cannot silently become local router tuning evidence.
- This is test-only alignment. No server/runtime restart was required. The tool-reliability gate has not been rerun in this continuation; final validation remains pending approval.

## Tool-reliability provider-qualified retry-reduction alignment - 2026-06-17

- Added provider-qualified retry-reduction paths to `server/toolReliability.ts` while retaining the existing short model/tool paths for compatibility.
- Surfaced provider-qualified avoid/prefer paths in Routing Learning evidence text, Settings candidate rows, and Auto-Router classifier candidate-card annotations so retry-reduction proof stays tied to model, provider, tool, session, and run.
- Updated focused guards and export/import fixtures to preserve `avoidProviderPath` and `preferProviderPath` and to prevent same-model recommendations from different providers collapsing into one row.
- Server/runtime files changed in this slice, so OpenHarness was restarted and reachability proof was required. Full prompt/routing-memory validation remains pending approval.

## Source-backed prompt best-practice database alignment - 2026-06-17

- Added structured best-practice notes to prompt strategy profiles so each family can carry source-backed guidance, rationale, and an eval cue for prompt-response improvement.
- Added Mistral function-calling guidance to the prompt source registry to support tool-heavy prompt contracts with primary vendor documentation.
- Updated API type mirrors and provenance guards so source-backed notes remain part of the prompt strategy database instead of living only in docs.
- Server/profile data changed in this slice, so OpenHarness restart/reachability proof was required. Full prompt/routing-memory validation remains pending approval.

## Model Lab prompt best-practice visibility alignment - 2026-06-17

- Surfaced source-backed prompt strategy best-practice guidance in `src/components/ModelLabPanel.tsx`, including eval cues for same-model prompt strategy comparisons.
- Added accessibility-label coverage so prompt strategy cards expose guidance and eval cues to assistive technologies and static proof guards.
- Updated `scripts/test-premier-model-harness.ts` to guard that Model Lab no longer hides prompt best-practice metadata inside the raw strategy database.
- This was client/test/docs alignment only. No server/runtime restart was required; browser refresh is enough. Full validation remains pending approval.

## Auto-Router prompt best-practice advisory alignment - 2026-06-17

- Added source-backed prompt strategy best-practice guidance and eval cues to Auto-Router classifier candidate-card annotations.
- Kept the signal advisory only: prompt guidance can inform classifier scoring and human review, but does not automatically rewrite router thresholds, candidate costs, or defaults.
- Updated focused guards to preserve the classifier-visible guidance and advisory boundary.
- Server routing code changed in this slice, so OpenHarness restart/reachability proof was required. Full validation remains pending approval.

## Prompt Microscope best-practice trace evidence alignment - 2026-06-17

- Added source-backed best-practice evidence to prompt strategy traces so each prompt build can carry guidance, rationale, eval cue, and source reference.
- Surfaced that trace evidence in Prompt Microscope beside strategy id, model match, variant, task type, role, context, examples, reasoning, tools, output, and selection reason.
- Updated focused guards to preserve the replay/debug evidence path for prompt-response quality improvements.
- Server trace data changed in this slice, so OpenHarness restart/reachability proof was required. Full validation remains pending approval.

## Model Lab prompt best-practice proof-summary alignment - 2026-06-17

- Updated Model Lab prompt-strategy proof summary text so observed strategies can include the source-backed eval cue and source reference from their trace evidence.
- This keeps exported proof briefs tied to the prompt-response hypothesis behind each selected strategy, rather than only listing family/style metadata.
- Added focused static coverage in `scripts/test-premier-model-harness.ts`.
- This was client/test/docs alignment only. No server/runtime restart was required; browser refresh is enough. Full validation remains pending approval.

## Routing Learning prompt best-practice export alignment - 2026-06-17

- Added source-backed prompt eval cue/source annotations to Routing Learning Markdown evidence exports for recent routing decisions when a selected prompt strategy resolves to a known profile.
- Kept the catalog lookup best-effort so Routing Learning evidence still exports even if prompt strategy metadata is unavailable.
- Added focused static coverage in `scripts/test-premier-model-harness.ts`.
- This was client/test/docs alignment only. No server/runtime restart was required; browser refresh is enough. Full validation remains pending approval.

## Server Routing Learning prompt best-practice export alignment - 2026-06-17

- Added `promptStrategyBestPractices` to server Routing Learning JSON exports, scoped to strategies referenced by exported events.
- Preserved source-backed prompt guidance, rationale, eval cue, and source references in exported learning bundles so prompt-response context survives import/export handoff.
- Updated API and export guards to protect the server export shape.
- Server export code changed in this slice, so OpenHarness restart/reachability proof was required. Full validation remains pending approval.

## Routing Learning prompt best-practice import-preview alignment - 2026-06-17

- Added import-preview support for `promptStrategyBestPractices` metadata so imported/shared learning bundles disclose prompt strategy rows, note counts, and source refs before import.
- Kept imported prompt best-practice metadata context-only: it is previewed for reviewers but not merged into local prompt strategy profiles by event import.
- Updated API, UI messaging, import regression coverage, and Premier static guards.
- Server import code changed in this slice, so OpenHarness restart/reachability proof was required. Full validation remains pending approval.

## Routing Learning import response prompt-preview passthrough - 2026-06-17

- Updated the `/api/router/learning/import` response to include `promptBestPracticePreview` from the import preview helper.
- This ensures dry-run import confirmation and real import completion can both disclose prompt best-practice metadata as context-only, non-merged evidence.
- Added focused static coverage in `scripts/test-premier-model-harness.ts`.
- Server import response code changed in this slice, so OpenHarness restart/reachability proof was required. Full validation remains pending approval.

## Premier closeout prompt best-practice proof coverage alignment - 2026-06-17

- Updated `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` so Phase 7 prompt strategy and routing-memory proof explicitly requires source-backed prompt best-practice metadata across Prompt Microscope, Model Lab summaries, Routing Learning exports/import previews, and Auto-Router candidate cards.
- Updated `scripts/test-premier-baseline-manifest.ts` and `scripts/test-premier-closeout-matrix.ts` so the no-spend closeout guards preserve the new best-practice metadata/export/import-preview expectations.
- Status: static coverage aligned; not a substitute for final no-spend command output, browser/manual proof, provider-approved proof runs, or final lint/build gates.

## Premier model scorecard breadth alignment - 2026-06-17

- Expanded Model Library scorecards so open-source and frontier models are compared across the kickoff's named trust dimensions: coding, reasoning, review, planning, tool use, vision, long context, speed, cost, privacy, and local availability.
- Updated the Premier model-harness static guard and proof checklist so future no-spend proof cannot regress back to shallow context/tools/vision-only scorecards.
- Status: client/test/docs alignment only. Browser refresh is enough; no server/runtime restart was required. Full model-harness validation, browser/manual proof, provider-approved proof runs, and final gates remain pending.

## Artifact feedback save-without-refresh hardening - 2026-06-17

- Hardened artifact approval/needs-revision persistence so a steering callback that succeeds without returning a refreshed run is treated as saved feedback with refresh pending, not as a failed replay save.
- Updated the Premier artifact-review static guard to preserve the saved-without-refresh path.
- Status: client/test work only. Browser refresh is enough; no server/runtime restart was required. Full artifact-review validation, live replay proof, and final gates remain pending.

## Calm replay validation-proof summary alignment - 2026-06-17

- Updated the compact message `Run replay` summary so validation proof artifacts are counted separately from generic artifacts.
- Updated the Premier calm-chat static guard and proof checklist to preserve validation-proof visibility without reintroducing noisy message-level diagnostics.
- Status: client/test/docs work only. Browser refresh is enough; no server/runtime restart was required. Full calm-chat validation, browser/manual proof, and final gates remain pending.

## Layout shell pinned-tool legacy pruning - 2026-06-17

- Hardened the flat shell against stale persisted Tools state by pruning forced-hidden `sub-agents` entries from pinned-tool localStorage and blocking forced-hidden panels from being pinned again.
- Updated the Premier layout-shell static guard so chat-first defaults cannot be undermined by legacy pinned panel state.
- Status: client/test work only. Browser refresh is enough; no server/runtime restart was required. Full layout-shell validation, browser/manual proof, and final gates remain pending.

## Theme texture startup-default guard alignment - 2026-06-17

- Added Premier theme-texture guard coverage for startup/global CSS defaults so OpenHarness begins with no texture recipe and zero texture opacity before runtime theme hydration.
- Updated the proof checklist to require this no-texture startup invariant alongside shell-only overlays, opacity bounds, schema validation, user adjustment, and reduced-transparency fallback behavior.
- Status: docs/test alignment only. No server/runtime restart was required. Full theme-texture validation, browser/manual reduced-transparency proof, and final gates remain pending.

## Left-pane active-work row label alignment - 2026-06-17

- Strengthened the left-pane active-work run row so one focusable label exposes status, current task, model, provider, elapsed time, and latest proof/artifact.
- Updated the Premier active-work static guard and proof checklist to preserve the kickoff row contract while keeping phase rows nested under the owning run.
- Status: client/test/docs work only. Browser refresh is enough; no server/runtime restart was required. Full active-work validation, live active-run proof, and final gates remain pending.

## Review Changes validation-proof save feedback alignment - 2026-06-17

- Strengthened Review Changes validation-proof persistence feedback: saved proof artifacts now announce success as a status, and save failures announce as alerts.
- Updated the Premier Review Changes static guard and proof checklist so proof persistence remains reviewable inside the single consolidated Review Changes flow.
- Status: client/test/docs work only. Browser refresh is enough; no server/runtime restart was required. Full Review Changes validation, browser/manual proof, and final gates remain pending.

## Agent Detail live-summary accessibility alignment - 2026-06-17

- Strengthened the right-hand Agent Detail inspector so both the top run-count summary and detailed harness run summary use polite live status announcements.
- Updated the Premier Agent Detail static guard and proof checklist so future Phase 3 proof preserves live summary announcements alongside workflow progress, replay summaries, replay filters, latest proof, and structured steering controls.
- Status: client/test/docs work only. Browser refresh is enough; no server/runtime restart was required. Full Agent Detail validation, live steering proof, browser/manual proof, and final gates remain pending.

## Agent Detail right-hand region landmark alignment - 2026-06-17

- Strengthened the Agent Detail shell integration so the overlay is a named right-hand region, with the existing AgentFocusPanel still owning the detailed complementary inspector semantics inside it.
- Updated the Premier Agent Detail static guard and proof checklist so future Phase 3 work preserves the named right-hand pane, AgentFocusPanel mount, and structured steering callback wiring.
- Status: client/test/docs work only. Browser refresh is enough; no server/runtime restart was required. Full Agent Detail validation, live steering proof, browser/manual proof, and final gates remain pending.

## Agent Detail steering description association alignment - 2026-06-17

- Strengthened Agent Detail steering controls so action buttons and note submission are programmatically associated with the visible target and replay-persistence guidance.
- Updated Premier steering/Agent Detail static guards and the proof checklist so target/persistence guidance remains attached to controls, not merely displayed nearby.
- Status: client/test/docs work only. Browser refresh is enough; no server/runtime restart was required. Live steering replay proof and final gates remain pending.

## Calm chat replay export details alignment - 2026-06-17

- Moved the replay/debug bundle export action behind message Details while preserving the compact `Run replay` summary in the quiet chat stream.
- Updated the Premier calm-chat static guard and proof checklist so replay export remains an opt-in diagnostic action alongside tool details, confidence, Prompt Microscope, team plan, and next actions.
- Status: client/test/docs work only. Browser refresh is enough; no server/runtime restart was required. Full calm-chat validation, browser/manual proof, and final gates remain pending.

## Artifact drawer review-region labelling alignment - 2026-06-17

- Strengthened the artifact review surface so the drawer is a labelled review group with artifact count/summary while keeping detailed artifact actions inside the quiet drawer.
- Updated the Premier artifact-review static guard and proof checklist so comments, approval, needs-revision, saved replay feedback, copy, expand, and revise-from-here remain discoverable without noisy message-detail clutter.
- Status: client/test/docs work only. Browser refresh is enough; no server/runtime restart was required. Full artifact-review validation, browser/manual proof, and final gates remain pending.

## Theme texture opacity control accessibility alignment - 2026-06-17

- Strengthened the Theme texture opacity control so assistive technologies receive both the current shell texture percentage and the reduced-transparency fallback guidance.
- Updated the Premier theme-texture static guard and proof checklist so user-adjustable texture opacity remains tied to the shell-only/reduced-transparency safety contract.
- Status: client/test/docs work only. Browser refresh is enough; no server/runtime restart was required. Full theme-texture validation, reduced-transparency browser proof, and final gates remain pending.

## Routing Learning recommendation trust-label alignment - 2026-06-17

- Strengthened Routing Learning role recommendation rows so each row exposes its proof status and trusted/untrusted evidence state, not only the apply button label.
- Updated the Premier model-harness static guard and proof checklist so recommendation rows remain reviewable before role/router changes are trusted.
- Status: client/test/docs work only. Browser refresh is enough; no server/runtime restart was required. Full model-harness validation, Model Lab proof review, browser/manual proof, and final gates remain pending.

## Prompt Microscope provenance advisory alignment - 2026-06-17

- Strengthened Prompt Microscope prompt-strategy provenance so source-backed best-practice guidance, eval cues, and source refs are explicitly labelled as advisory prompt-contract evidence rather than automatic routing overrides.
- Updated Premier model-harness/prompt-source static guards and the proof checklist so future Phase 7 proof preserves the provenance/trust boundary.
- Status: client/test/docs work only. Browser refresh is enough; no server/runtime restart was required. Full prompt/routing memory validation, live saved-run proof, provider-approved prompt strategy comparisons, and final gates remain pending.

## Routing Learning imported selected-model identity guard - 2026-06-17

- Added a guard that imported Routing Learning events preserve selected model identity along with prompt strategy variant and dataset kind.
- Updated the Premier proof checklist so imported evidence cannot blur which model path routed or recovered a run.
- Status: test/docs alignment only. No server/runtime code changed, so no restart was required. Full prompt/routing memory validation, imported evidence proof, and final gates remain pending.

## Tool reliability recovery prompt-strategy context alignment - 2026-06-17

- Added prompt strategy id and variant context to tool-reliability recovery examples, so recovered tool-error paths can be traced to the prompt contract active during the run.
- Updated the tool-reliability guard and Premier proof checklist so recovery examples preserve prompt-contract context alongside failed model/provider/tool and later working path evidence.
- Server/runtime code changed, so OpenHarness was restarted. Reachability proof after restart: `/api/config` on port `3001` responded, the UI on port `5173` responded, and process shape showed one OpenHarness Electron main process plus normal helper processes.
- Full prompt/routing memory validation, imported evidence proof, provider-approved proof runs, and final gates remain pending.

## Routing Learning recovery-example prompt-strategy passthrough - 2026-06-17

- Added client/UI/export passthrough for prompt strategy id and variant on tool-reliability recovery examples.
- Routing Learning now exposes that strategy context in recovery-path rows and Markdown evidence exports, so reviewers can separate prompt-contract failures from model/tool failures.
- Status: client/test/docs alignment only. No server/runtime code changed in this slice, so no restart was required. Full prompt/routing memory validation, imported evidence proof, provider-approved proof runs, and final gates remain pending.

## Top-bar model/router evidence target alignment - 2026-06-17

- Added stable evidence-target metadata to the top-bar model/router badge so Router -> Routing Learning and concrete model -> Model Lab destinations remain auditable while keeping the top bar quiet.
- Updated the Premier layout-shell static guard and proof checklist for this quiet evidence entry point.
- Status: client/test/docs work only. Browser refresh is enough; no server/runtime restart was required. Full browser/manual proof and final gates remain pending.

## Review Changes consolidated-surface marker alignment - 2026-06-17

- Added a stable consolidated-surface marker to Review Changes so diffs, patch proposals, validation proof, and commit prep are provably routed through one flyout.
- Updated the Premier Review Changes static guard and proof checklist to prevent duplicated permanent Diffs/Patches panels from creeping back in.
- Status: client/test/docs work only. Browser refresh is enough; no server/runtime restart was required. Full Review Changes validation, browser/manual proof, and final gates remain pending.

## No-provider baseline closeout-boundary alignment - 2026-06-17

- Strengthened the closeout checklist so the no-provider baseline cannot be mistaken for final acceptance by itself.
- Updated the live-evidence guard to require current manual/browser evidence, runtime scenario proof, approved provider-backed proof where applicable, and final gates before completion.
- Status: docs/test alignment only. No server/runtime restart was required. Full browser/manual proof, runtime scenario proof, provider-approved proof runs, and final gates remain pending.

## Duplicate Electron final-gate evidence alignment - 2026-06-17

- Added `Duplicate Electron/process-shape check` to the final evidence template so restart closeout records whether relaunch left one OpenHarness desktop shell plus normal helper processes.
- Updated `scripts/test-premier-restart-scope.ts` to guard the kickoff duplicate-window stop condition, the closeout template field, and existing process-shape proof language.
- Status: docs/test alignment only. No server/runtime restart was required. Full restart-scope validation and final gates remain pending approval.

## Same-model prompt strategy comparison evidence alignment - 2026-06-17

- Added same-model prompt strategy id, variant id, and comparison artifact path fields to the Model Lab Eval Proof template.
- Updated Phase 7 evidence capture and static guards so provider-approved strategy comparisons must record the compared strategy contracts and durable artifact path, not only the winning model summary.
- Updated Model Lab Eval proof briefs to explicitly list same-model prompt strategy comparisons when one model has results under multiple prompt strategy contracts.
- Extended the same comparison evidence fields and proof-brief summary to Model Lab Bench proof so eval and bench artifacts preserve the same strategy-contract comparison trail.
- Tightened the proof-brief comparison summary so a same-model strategy comparison is only listed when the same model has multiple strategy contracts on the same prompt/task, not merely somewhere in the same report.
- Updated the provider-backed approval draft so same-model prompt strategy comparison requires explicit approval instead of being implied by the smallest proof runs.
- Status: client/docs/test alignment only. Browser refresh is enough; no server/runtime restart was required. Provider-approved prompt strategy comparison proof remains pending.

## Browser/manual durable artifact approval alignment - 2026-06-17

- Updated the browser/manual proof approval draft so the reviewer can approve a pass that saves durable screenshot or DOM-note artifact paths for desktop and narrow-width UI checks.
- This keeps manual proof aligned with the closeout template's `Screenshot/artifact path(s)` field instead of leaving UI evidence only in chat.
- Status: docs/test alignment only. No server/runtime restart was required. Browser/manual proof remains pending approval.

## Runtime scenario durable trace approval alignment - 2026-06-17

- Updated the provider-backed proof approval draft so runtime scenarios explicitly require durable runtime trace/export paths for Planning Room, execute/investigate, and steering-event evidence.
- This keeps runtime proof aligned with the closeout template's `Runtime trace/export path(s)` field instead of relying on unfindable chat-only scenario notes.
- Status: docs/test alignment only. No server/runtime restart was required. Runtime scenario proof remains pending approval.

## Final-gate durable artifact approval alignment - 2026-06-17

- Updated the final-gate approval draft so validation approval includes saving durable gate log/artifact paths for commands that run.
- Added explicit restart/reachability plus duplicate Electron/process-shape artifact expectations when server/runtime code changed.
- Status: docs/test alignment only. No server/runtime restart was required. Final gates remain pending approval.

## Approval-boundary durable evidence guard alignment - 2026-06-17

- Aligned the reusable proof checklist provider approval prompt with the closeout draft so same-model strategy comparison, runtime trace/export artifacts, and durable proof artifact paths are explicit before provider-spend work starts.
- Updated `scripts/test-premier-approval-boundaries.ts` to guard provider approval choices plus durable browser/manual, runtime trace, and final-gate artifact expectations.
- Updated stale paste-ready approval prompts in `NEXT_SESSION.md` so future sessions ask for same-model strategy comparison approval, durable browser/manual artifacts, runtime trace exports, and final-gate logs consistently.
- Status: docs/test alignment only. No server/runtime restart was required. Approval-boundary validation remains pending.

## Durable proof artifact naming alignment - 2026-06-17

- Updated `docs/proof/README.md` with naming examples for same-model strategy comparisons, manual UI DOM notes, runtime scenario traces, and final gate logs.
- Added content guidance for strategy ids/variants, screenshot or DOM-note paths, runtime trace/export paths, gate logs, and restart/process-shape proof.
- Updated `scripts/test-premier-closeout-matrix.ts` so the closeout guard preserves the artifact naming guidance.
- Added redaction guidance for logs, traces, screenshots, and DOM notes so durable proof artifacts do not store provider keys, cookies, raw private prompts, customer data, or unnecessary private file contents.
- Mirrored the redaction reminder in the reusable proof checklist's evidence-storage guidance so reviewers see it before copying the final evidence template.
- Added `docs/proof/2026-06-17-manual-ui-dom-notes-template.md` as a redaction-aware starter artifact for the approved browser/manual proof pass.
- Added `docs/proof/2026-06-17-runtime-scenario-trace-template.md` as a redaction-aware starter artifact for approved Planning Room, execute/investigate, and steering-event runtime proof.
- Added `docs/proof/2026-06-17-final-gate-log-template.md` as a redaction-aware starter artifact for approved final validation gates and restart/process-shape proof.
- Added `docs/proof/2026-06-17-same-model-strategy-comparison-template.md` as a redaction-aware starter artifact for approved same-model prompt strategy comparison proof.
- Added `docs/proof/2026-06-17-model-lab-eval-proof-template.md` and `docs/proof/2026-06-17-model-lab-bench-proof-template.md` as redaction-aware starter artifacts for approved Model Lab proof runs.
- Added `docs/proof/2026-06-17-routing-learning-evidence-template.md` as a redaction-aware starter artifact for Routing Learning export/import, prompt-strategy outcome, and tool-error memory proof.
- Added `docs/proof/2026-06-17-auto-router-candidate-evidence-template.md` as a redaction-aware starter artifact for Auto-Router candidate-card, Settings candidate-row, and classifier-side breadcrumb proof.
- Added `docs/proof/2026-06-17-worktree-isolation-evidence-template.md` as a redaction-aware starter artifact for implementation-agent worktree isolation proof before multi-agent write flows.
- Added `docs/proof/2026-06-17-theme-texture-evidence-template.md` as a redaction-aware starter artifact for Theme Texture accessibility proof.
- Added `docs/proof/2026-06-17-calm-chat-artifact-review-evidence-template.md` as a redaction-aware starter artifact for Calm Chat, Artifact Review, and Review Changes proof.
- Clarified in `docs/proof/README.md` that templates are not proof and should be copied or renamed into dated completed evidence artifacts before use.
- Clarified that the closeout log remains the index of record, so completed proof artifacts must be linked back from the closeout file with a short status.
- Mirrored the template-not-proof and closeout-log backlink rule in the reusable proof checklist before the final evidence template.
- Strengthened `scripts/test-premier-closeout-matrix.ts` so every starter proof template must keep `Status: template, not proof`, artifact-path fields, redaction checklist fields, and remaining-gap fields.
- Added the Routing Learning evidence template to that per-template safety audit so routing-memory proof follows the same template-not-proof and redaction contract as Model Lab, manual UI, runtime, and final-gate proof.
- Extended the Routing Learning evidence template with Phase 7 source/tuning fields for saved-session/imported/log-derived evidence, tuning actions, repeated/single trace confidence, and imported evidence preview boundaries.
- Added the Auto-Router candidate evidence template to the generic per-template safety audit so classifier-side breadcrumb proof follows the same template-not-proof and redaction contract.
- Added the worktree isolation evidence template to the generic per-template safety audit so implementation-agent isolation proof follows the same template-not-proof and redaction contract.
- Added worktree-isolation-specific closeout guard coverage for lifecycle trace artifacts, dirty-state preservation, diff review before promotion, validation before promotion, promote/discard decisions, and main-checkout protection.
- Added provider preflight fields to the Model Lab eval and bench proof templates so approved runs capture provider health, rate-limit warnings, budget warnings, matrix size, and approval-gated launch labels before provider spend.
- Added the same provider preflight fields to the same-model prompt strategy comparison template because it also spends provider calls.
- Added provider preflight fields to the runtime scenario trace template because Planning Room and execute/investigate proof can also call configured models.
- Added provider context fields to the Auto-Router candidate evidence template so manual tuning proof captures provider health, rate-limit warnings, budget warnings, configuration-change approval, and approved/trusted evidence basis.
- Added recommendation trust and provider-context fields to the Routing Learning evidence template so proof distinguishes trusted applied recommendations from unreviewed/manual-only and needs-attention blocked recommendations before tuning.
- Added provider context fields to the worktree isolation evidence template so provider-backed execute proof captures provider health, rate-limit warnings, budget warnings, approval-gated launch state, and manual approval before proving isolated write flows.
- Added a template lane map to `docs/proof/README.md` so future proof passes can choose the correct starter artifact for Model Lab Eval, Model Lab Bench, same-model strategy comparison, Routing Learning, Auto-Router, manual UI, runtime scenario, worktree isolation, and final gates.
- Updated the reusable proof checklist to point readers to the README's naming rules and template lane map before copying the closeout evidence block.
- Added Theme Texture template guard coverage for opacity bounds, shell-only textures, dense text readability, contrast sampling, reduced transparency, and reduced motion proof fields.
- Added the Theme Texture evidence template to the generic per-template safety audit so accessibility proof follows the same template-not-proof and redaction contract.
- Added `docs/proof/2026-06-17-agent-detail-steering-evidence-template.md` as a redaction-aware starter artifact for right-hand Agent Detail and structured steering proof.
- Added Agent Detail steering template guard coverage for right-hand inspector state, model/provider/role visibility, grouped tool calls, steering controls, persisted run-trace events, next-safe-phase evidence, and accessibility labels.
- Confirmed the Agent Detail steering evidence template is included in the generic per-template safety audit.
- Added Calm Chat artifact-review template guard coverage for collapsed diagnostics, Prompt Microscope/detail affordances, artifact drawer review controls, Review Changes consolidation, validation proof save status, and labelled details regions.
- Status: docs/test alignment only. No server/runtime restart was required. Closeout-matrix validation remains pending.

## Routing Learning staged tool-error endpoint proof - 2026-06-17

- Added completed staged no-provider proof artifact: `docs/proof/2026-06-17-routing-learning-staged-tool-error-proof.md`.
- The proof temporarily staged one `saved_session_trace` ledger row, queried the real running `/api/router/learning/tool-errors` endpoint, captured failed `proof-provider:proof-primary-model/read_file`, later working `proof-provider:proof-primary-model/list_directory`, retry distance `1`, final-answer capture, session id, and run id, then restored the ledger.
- Cleanup proof confirmed the staged row was removed and the endpoint returned zero rows for `proof-primary-model` afterward.
- Status: no-provider endpoint proof only. Real provider-approved or local runtime tool-error rows, browser/UI proof, exports, and final gates remain pending.

## Runtime relaunch and duplicate-shell proof - 2026-06-17

- Added `docs/proof/2026-06-17-runtime-relaunch-process-shape-proof.md` after a live repo-native relaunch.
- Starting state had only the server on `3001`; Vite `5173` was absent and no OpenHarness Electron shell was present.
- Stopped the stale OpenHarness server-only chain and relaunched with `npm start`.
- Relaunch output showed `✓ Express ready on port 3001`, `✓ Vite ready on port 5173`, `Launching Electron...`, Docker MCP connected with 50 tools, and the MCP watchdog started.
- Reachability proof returned HTTP 200 for `http://127.0.0.1:3001/api/config` and `http://127.0.0.1:5173/`.
- Duplicate Electron/process-shape check showed one managed OpenHarness server, one Vite UI process, one OpenHarness Electron main process, and normal Electron helper processes rather than duplicate OpenHarness shells.
- Remaining gaps: this is runtime/process proof only; provider-backed/manual proof, genuine live tool-error recovery rows, and final closeout gates remain open.

## Live tool-error ledger gap status - 2026-06-17

- Added `docs/proof/2026-06-17-live-tool-error-ledger-gap.md` after checking current local routing-learning storage.
- Current live state: `~/.openharness/router-learning/tool-error-ledger.jsonl` is missing and `/api/router/learning/tool-errors` has no genuine live rows.
- `server/toolErrorLedger.ts` now exposes `persistedLedgerExists`, `persistedEventCount`, `logTraceEventCount`, and `liveEvidenceStatus` so `missing_ledger`, `empty`, and `available` states are not conflated.
- `npm run test:tool-reliability` passed with coverage for the new live-evidence status metadata.
- Remaining gap: a real provider-approved or local runtime tool-error recovery scenario must still create genuine saved-session/log evidence with failed path, later working path, retry distance, session/run ids, and final-answer capture state.
- Post-restart endpoint proof returned `liveEvidenceStatus: "missing_ledger"`, `persistedLedgerExists: false`, `persistedEventCount: 0`, and `logTraceEventCount: 0` from `/api/router/learning/tool-errors?summaryOnly=true`.
- Restart reachability after the runtime change returned HTTP 200 for `/api/config` on `3001` and `/` on `5173`, with one OpenHarness Electron main process plus normal helper processes.

## Live tool-error ledger Routing Learning visibility - 2026-06-17

- Routing Learning now shows the live tool-error ledger state as a top-level trust metric and as a Tool Reliability detail card.
- Markdown evidence briefs now include `Live tool-error ledger status`, persisted ledger existence, persisted row count, log-derived row count, and the same warning when no persisted live ledger exists.
- `src/utils/api.ts` now types `toolErrorLedger` on `RouterLearningSummary` with `liveEvidenceStatus`, `persistedLedgerExists`, `persistedEventCount`, and `logTraceEventCount`.
- `npm run test:premier-model-harness` and `npm run test:tool-reliability` passed.
- Browser refresh is enough because this slice only changed client UI/types and proof docs.

## Live tool-error evidence no-spend probe - 2026-06-17

- Added `scripts/check-live-tool-error-evidence.ts` and package script `check:live-tool-error-evidence`.
- The probe queries `/api/router/learning/tool-errors?summaryOnly=true` and emits strict JSON containing `closeoutReady`, live status, persisted/log-derived row counts, and the fields required for a genuine closeout row.
- `closeoutReady: false` means Phase 7 tool-error recovery remains open even if static/staged tests pass.
- Probe result on 2026-06-17: `npm run check:live-tool-error-evidence` passed and reported `closeoutReady: false`, `status: missing_ledger`, `totalErrorEvents: 0`, `persistedLedgerExists: false`, `persistedEventCount: 0`, and `logTraceEventCount: 0`.
- `npm run test:premier-live-evidence-guard` passed after adding the probe guard.

## Approval-gated live tool-error recovery scenario - 2026-06-17

- Added `scripts/run-live-tool-error-recovery-scenario.ts` and package script `run:live-tool-error-recovery`.
- The scenario is no-spend by default: without `OPENHARNESS_APPROVE_LIVE_TOOL_ERROR=1`, it exits with `skipped: true` and does not send a model request.
- Approved usage requires `OPENHARNESS_APPROVE_LIVE_TOOL_ERROR=1` and should set `OPENHARNESS_LIVE_TOOL_ERROR_MODEL` to a configured tool-capable model.
- The approved scenario asks the model to fail `read_file` on a missing probe file, recover with `list_directory`, then reports before/after ledger status, observed tool calls, failed tool, later working tool, session id, run id, and `closeoutReady`.
- Remaining gap: this scenario has not been run with approval yet, so genuine live tool-error recovery evidence remains pending.
- Default no-approval run of `npm run run:live-tool-error-recovery` passed with `approved: false`, `skipped: true`, `currentStatus: missing_ledger`, and `closeoutReady: false`.
- `npm run test:premier-live-evidence-guard` passed after adding the scenario guard.
