# Next Session — Open Issues Handoff

## Identity
You are **Friday**, the AI assistant for OpenHarness. Follow all rules in `AGENTS.md`.

## Repository State

`/Users/kevink/Projects/OpenHarness` on `main`. Latest local work begins the Premier Harness UI and agent-control overhaul from `docs/PREMIER_HARNESS_KICKOFF.md`; check `git status -sb` before assuming remote push state.
- `npm run lint` — not rerun after the current client-side cleanup work
- `npm run build` — not rerun after the current client-side cleanup work

## Current Top Priority

Use `docs/PREMIER_HARNESS_KICKOFF.md` as the source of truth for the current overhaul. The product direction is chat-first by default, active agent work visible where users already look, right-hand detail only when selected, one Review Changes flow, quiet message chrome, and steering controls that write structured run-trace events.

Keep `docs/UI_CLEANUP_PLAN.md` as the detailed declutter reference, `docs/HARNESS_WORK_ROADMAP.md` as the broader capability roadmap, and `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` as the reusable closeout checklist for proof runs, manual UI review, runtime scenario proof, and final validation gates.

## Latest Completed Slice — 2026-06-16

Current client-side cleanup work moved the UI toward the Premier Harness kickoff direction:
- Default layout and tool menus are chat-first; the permanent `sub-agents` split is force-hidden.
- Assistant message diagnostics now sit behind a `Details` affordance: tool traces, confidence, artifacts, Prompt Microscope, and next actions.
- Reviewable artifacts now get their own collapsed `Review artifact(s)` row outside hidden diagnostics, so artifacts stay visible without cluttering chat.
- Structured comparison artifacts and quick `Model comparison artifact` markdown now appear as first-class reviewable comparison artifacts in the artifact drawer.
- Completed assistant messages with run traces now expose a visible `Export replay` action that downloads the existing run debug bundle with prompts, routing, artifacts, and proof data.
- Completed assistant messages also show a compact `Run replay` summary with trace event, tool, artifact, steering, and final-answer counts.
- Review Changes validation results now expose copyable and downloadable `Validation Proof` markdown after commands run, including workspace, session id, timestamp, command statuses, exits, durations, and output tails.
- Active work appears in the chat strip, left project/session tree, Environment rail progress section, and right-hand `AgentFocusPanel` inspector.
- Left project/session run rows now expose latest artifact/proof cues and a steerable marker for active runs.
- The right-hand agent inspector forwards structured steering controls through the existing run-steering path.
- Steering actions are gated by run status and artifact availability.
- The right-hand agent inspector now includes a `Run replay` summary with trace event counts, tool calls, steering events, model requests, final-answer state, and latest proof.
- The expanded agent replay event list now has filters for all events, proof, tools, routing, steering, and errors.
- Fake agent percentage bars were removed in favor of trace-backed current-step and workflow state.
- User-facing copy now says `Agent Work` / `Agent detail` instead of `Sub-Agents`.
- The old `LatestUpdatesPanel`, standalone `DiffViewer`, legacy `RightPanel`, and legacy `RunningAgentsStrip` surfaces were removed.
- Theme texture recipes are tokenized, schema-validated, rendered as bounded app-shell overlays, shown in Settings, and adjustable with a persisted texture opacity control.
- Model Library cards now include a transparent `Harness fit` scorecard derived from existing catalog metadata such as tools, thinking, context, vision, router cost, strengths, and weaknesses.
- Active Model settings now show premium/luxury spend cautions for fixed high-cost models and recommend Auto/lower-cost workers for routine or background work.
- Agent Roles now surface enabled-model eval recommendations from the latest eval report directly on matching role cards with manual `Apply` actions.
- Auto-Router candidate rows now show `Eval-backed` cues when an active candidate matches the latest eval recommendations, including the recommended role and reason.
- Model Lab eval/bench launchers now show background-run cautions based on selected prompt/task x model matrix size, including rate-limit and metered-billing guidance.
- Model Lab Packs now explains the intended calibration/comparison flow: calibrate cheaper open candidates first, run tight frontier comparisons second, then use pack evidence to decide whether router or role changes are justified.
- Review Changes can now save generated Validation Proof markdown as a replayable session artifact message, so command evidence is preserved in session history instead of only being copied or downloaded.
- Model Lab run cautions now include tracked provider-health signal when available: failing/stale provider count, latest check, slowest latency, and recent provider errors.
- Model budgets are now config-backed and honored by the central model-call preflight: `modelBudgets` can block or warn on estimated input tokens, output tokens, or cost before provider requests are sent.
- Settings → Active Model now includes a compact Model Budgets editor for global (`*`) and model-specific warn/block/allow limits across daily, weekly, or monthly periods.
- Provider rate limits are now config-backed and honored by the central model-call preflight: `providerRateLimits` can warn or block on estimated requests-per-minute or tokens-per-minute before provider requests are sent, with rate-limit headers exposed on streamed responses.
- Settings → Active Model now includes a compact Provider Rate Limits editor for global (`*`) and provider-specific warn/block/allow limits across requests-per-minute and tokens-per-minute.
- Settings → Active Model now shows provider rate-limit rolling status and recent warn/block events from `/api/providers/rate-limits/status`.
- Provider rate-limit warn/block events are now persisted as bounded telemetry under `~/.openharness/provider-rate-limits/events.json`, so recent events survive server restarts.
- The bottom status bar now surfaces recent provider rate-limit warn/block events and exhausted configured provider windows, so active users see limits before launching another large run.
- Model Lab results now expose downloadable proof briefs for eval and bench runs, and bench results expose the existing full JSON export from the results header.
- Model Lab Packs now surfaces declared eval prompt coverage per pack and can prepare the Eval tab by selecting matching installed eval prompts from a pack.
- Model Lab Packs now exports pack evidence briefs covering trust, sources, plugin manifests, declared eval IDs, installed eval coverage, manifest health, risks, and the next proof action.
- Pack-prepared Eval runs now get a pack-specific run name, and exported eval proof briefs include pack execution context when the run was prepared from a pack.
- Pack-prepared Eval runs now persist `packContext` into saved eval reports, so exported proof briefs keep pack provenance after reload.
- Server-generated Eval Recommendation Report markdown now includes saved pack context when an eval report was prepared from a pack.
- Model Lab eval and bench result pages now show proof-review callouts that summarize completion, failures, weakest signals, validation issues, trace warnings, regressions, pack provenance, and required exports before trusting a result.
- Model Lab eval and bench result pages now let reviewers save durable proof-review decisions (`approved`, `needs-attention`, or `unreviewed`) with optional notes, and proof briefs include the saved review state.
- Server-generated Eval Recommendation Report markdown now includes saved proof-review status, timestamp, and note.
- Model Lab now includes small proof-run presets: `Prepare smallest eval proof` and `Prepare proof run` select a 1x1 prompt/task by model matrix and name the run without starting provider calls automatically.
- Settings → Routing Learning now exports a routing evidence JSON bundle with summary stats, threshold advice, available/unavailable eval recommendations, recent routing events, and reviewed/unrated/fallback counts for offline review.
- Settings → Routing Learning recent route rows now summarize candidate margins in plain language, including the closest rejected alternative or fallback top-scored alternative.
- Settings → Routing Learning now also exports a human-readable Markdown evidence brief with review state, confidence, threshold advice, best task-type signals, eval recommendations, and recent route margin summaries.
- Settings → Routing Learning recent route rows now accept optional reviewer notes when marking Worked/Failed/Unclear, and those notes flow into the JSON evidence and Markdown brief exports.
- Settings → Routing Learning marked rows now include a `Save note` action, so reviewers can update or clear the outcome note without changing the existing Worked/Failed/Unclear label.
- Settings → Routing Learning now shows a `Notes attached` metric, making reviewer-context coverage visible before trusting or exporting learning data.
- Settings → Routing Learning recent decisions now include a `Needs notes` filter, so reviewers can jump directly to routes that lack explanatory context before exporting evidence.
- Settings → Routing Learning metric/debug grids now collapse at narrower widths, keeping the routing proof surface readable in compact settings layouts.
- Settings → Routing Learning recent route rows and Markdown evidence briefs now include decision recency cues, so stale routing outcomes are easier to spot before trusting learning data.
- Settings → Routing Learning recency chips now expose exact ISO timestamps on hover, and Markdown evidence briefs include exact plus relative route times for audit trails.
- Settings → Routing Learning now shows a `Data age` metric, warning when loaded routing evidence is missing or older than seven days before trusting trends.
- Routing Learning Markdown evidence briefs now include latest-route evidence time and the same freshness warning as the on-screen `Data age` metric.
- Routing Learning JSON evidence bundles now include latest evidence time, relative age, stale flag, and freshness warning alongside reviewed/unrated/fallback counts.
- Settings → Routing Learning recent decisions now include a `Stale only` filter, so reviewers can isolate old or unknown-time route evidence before trusting/exporting learning data.
- Settings → Routing Learning recent decisions now include a `Fallbacks` filter, so reviewers can isolate fallback route decisions for model-failure memory and outcome notes.
- Settings → Routing Learning filter buttons now show an active state for `Needs notes`, `Stale only`, and `Fallbacks`, so filtered review context is visible before marking or exporting evidence.
- Settings → Routing Learning filter buttons now show counts for routes needing notes, stale/unknown-time routes, and fallback routes, making the review queue visible before filtering.
- Routing Learning JSON and Markdown exports now record the active review filter (`All recent decisions`, `Needs notes`, `Stale only`, or `Fallbacks`) so exported evidence preserves the reviewer context.
- Routing Learning JSON and Markdown exports now include the active filter match count, so exported evidence captures how many loaded recent decisions matched the reviewer context.
- Settings → Routing Learning recent decisions now state the active list scope (`showing X of Y loaded decisions`) beside the feedback guidance, so marking/exporting context stays visible in the review list.
- Settings → Routing Learning now shows `Clear filters` whenever a recent-decision filter is active, making it obvious how to return to the full loaded evidence set.
- Routing Learning JSON evidence bundles now include both the full loaded `recentEvents` list and the active-filter `filteredRecentEvents` subset, preserving complete evidence plus reviewer context.
- Routing Learning Markdown evidence briefs now list the active-filter route subset instead of always listing unfiltered recent decisions, keeping the human-readable proof aligned with reviewer context.
- Settings → Routing Learning now loads the latest 100 routing decisions instead of 25, giving filters and evidence exports a broader recent history without adding a new backend route.
- The server now exposes `GET /api/router/learning/export` with every persisted routing event plus summary stats, and Settings → Routing Learning JSON export includes that full server export alongside the loaded review window and active filtered subset.
- The server now exposes `POST /api/router/learning/import` to merge routing-learning events by ID without overwriting local records, and Settings → Routing Learning has an `Import evidence` JSON picker that refreshes the pane after import.
- Routing Learning JSON exports now include `schemaVersion: 1` at both the server full-export level and Settings evidence-bundle level, giving future import/export tooling a stable format marker.
- Routing Learning import now supports `dryRun`, and Settings previews new/skipped/rejected event counts before asking for confirmation and writing imported evidence.
- Settings → Routing Learning import confirmation now includes the selected file name and detected `schemaVersion`, so reviewers can sanity-check the evidence bundle identity before merging.
- Settings → Routing Learning import now normalizes raw JSON arrays into `{ events: [...] }`, so bare event-list exports can be previewed/imported as well as wrapped evidence bundles.
- `POST /api/router/learning/import` now also accepts a raw JSON event array directly, so scripts and external tools do not need to wrap event-list imports.
- `POST /api/router/learning/import` now returns server-detected `importSource` and `schemaVersion`, and Settings uses those values in the dry-run confirmation.
- Routing Learning import dry runs now warn when a bundle declares an unsupported schema version, while still previewing any recognized event fields.
- Routing Learning imports now support `datasetKind: "benchmark"` and Settings includes a `Benchmark import` toggle; benchmark events are preserved but excluded from production success summaries.
- `GET /api/router/learning/export` now includes production and benchmark event counts, and Settings JSON evidence bundles mirror those dataset counts for review.
- Settings → Routing Learning now shows a `Dataset mix` metric for the loaded review window, surfacing benchmark-event count and production count before reviewers trust or export learning data.
- Routing Learning Markdown evidence briefs now include loaded production and benchmark event counts, matching the on-screen `Dataset mix` proof context.
- Settings → Routing Learning recent decisions now include a `Benchmarks` filter, so reviewers can isolate benchmark-imported routing evidence from production learning records.
- Settings → Routing Learning recent route rows now show production/benchmark dataset labels, so benchmark imports remain visible while reviewing individual decisions.
- Saved Validation Proof artifacts now appear as `validation proof` rather than generic artifacts in the left work queue and right-hand Agent detail/replay surfaces.
- Eval recommendations now carry Model Lab proof-review status into Agent Roles and Auto-Router cues; attention-needed recommendations are visibly gated before role apply, and router candidate annotations include proof status instead of silently treating every eval as approved evidence.
- Settings → Routing Learning recommendation cards and JSON/Markdown evidence exports now include eval proof-review status/counts; attention-needed recommendations are skipped by bulk apply, and benchmark-filter exports now record the correct active filter label.
- Settings → Routing Learning now shows an `Eval proof review` metric and recommendation debug mix, making approved/unreviewed/attention-needed recommendation evidence visible before export or Apply.
- Eval recommendation payloads now include `proofTrusted`, and Auto-Router candidate card annotations only say eval-backed for approved proof while unreviewed/attention-needed proof is framed as cautionary evidence.
- Settings bulk recommendation apply now uses only approved-proof (`proofTrusted`) recommendations; unreviewed recommendations show `Apply manually`, while attention-needed recommendations stay blocked.
- Settings → Routing Learning now labels the bulk action as `Apply trusted (N)`, explains when no approved-proof recommendations are available, and Agent Roles tooltips distinguish approved-proof apply from manual unapproved-proof apply.
- Model Lab Eval and Tasks tabs now show compact proof-gate guidance beside the small proof-run preparation buttons, pointing reviewers from 1x1 proof runs to proof review, exports, and trusted recommendation application.
- Model Lab Eval Results now shows recommendation trust state near report exports, and eval proof briefs include whether recommendations have approved proof or still require review before role/router changes.
- Model Lab Bench Results now shows ranking trust state near proof/JSON exports, and bench proof briefs include whether model rankings have approved proof or still require review before role/router changes.
- Server-generated Eval Recommendation Report markdown now includes a recommendation trust line and proof-status column, so exported role suggestions do not lose their proof-review state.
- Auto-Router eval recommendation annotations now match provider-prefixed model ids as well as bare ids, so proof trust/caution text is less likely to disappear when candidates use `provider:model` references.
- Model Lab History now shows proof-review status for eval reports and bench runs, and the eval report list endpoint includes saved proof-review state.
- Added `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` as the concrete closeout checklist for eval proof, bench proof, manual UI review, runtime scenario proof, and final gates.
- `docs/PREMIER_HARNESS_KICKOFF.md` now points its Stop Condition at `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md`, so checklist evidence is part of the source-of-truth closeout rule.
- `docs/PREMIER_HARNESS_KICKOFF.md` Phase 0 and paste-ready prompt now list `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md`, keeping future `/goal` runs aligned with the proof checklist before implementation starts.
- `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now defines evidence quality rules: current direct evidence is required, stale/indirect/partial evidence keeps items open.
- `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now includes a copyable closeout evidence log template for report IDs, exports, manual UI notes, runtime scenario proof, gates, and remaining risks.
- `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now includes evidence storage guidance: paste short-lived closeout logs into `NEXT_SESSION.md`, use dated `docs/proof/` files for durable readiness records, and link/name exported proof files.
- Added `docs/proof/README.md` with durable proof artifact naming/content rules and a reminder not to store secrets or large generated artifacts there.
- Added `docs/proof/2026-06-16-premier-harness-closeout.md` as a pending starter evidence file for the final acceptance pass.
- `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now includes a provider-spend guard: proof-run selection and manual review are safe prep, but Eval, Bench, Planning Room, execute, and investigate live proof runs require explicit provider-budget approval before starting.
- `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now includes a copyable provider-backed proof-run approval prompt with options for smallest proof runs, eval-only, bench-only, or no provider run.
- `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now includes a phase-mapped manual UI review matrix tying each kickoff area to the exact surface and evidence needed for no-spend acceptance review.
- `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now includes final-gate decision rules for lint/build, hardening scope, server/runtime restart proof, provider-backed proof runs, and manual UI evidence.
- Model Lab Eval and Bench launch areas now show provider-spend guard copy beside the run buttons, separating safe preparation from budget-sensitive provider calls.
- Prepared provider-backed proof-run approval draft in `docs/proof/2026-06-16-premier-harness-closeout.md` with local no-spend inventory: 7 eval prompts, 14 bench tasks, 18 enabled models, active model `Auto`.
- Added phase-mapped pending manual UI evidence fields to `docs/proof/2026-06-16-premier-harness-closeout.md`, matching the checklist's Phase 1-6 acceptance review areas.
- Added a kickoff stop-condition audit table to `docs/proof/2026-06-16-premier-harness-closeout.md`, mapping every closeout condition to the direct evidence still required.
- Collected partial no-spend live UI evidence in `docs/proof/2026-06-16-premier-harness-closeout.md`: desktop and narrow DOM notes show the chat-first shell, no inspected drag/reorder-like DOM affordances, and no narrow page-level horizontal overflow; screenshot capture timed out, so visual overlap/readability still needs follow-up.
- Collected partial no-spend Phase 6 evidence in `docs/proof/2026-06-16-premier-harness-closeout.md`: Model Lab opens from Tools, Eval shows proof-gate guidance and provider-spend guard copy, Run Eval is disabled with no selections, and History rows show `proof unreviewed`; proof exports, Routing Learning, Agent Roles, and Auto-Router trust evidence remain pending.
- Checked live Routing Learning discoverability without provider calls: Tools did not expose a Routing Learning panel, and clicking the top-bar `Router` label did not open a routing trust/detail surface; this is recorded as a remaining Phase 6 closeout gap.
- Added a client-only Routing Learning Tools panel entry point by registering `routing-learning` in `src/types/layout.ts`, `src/components/layout/panelRegistry.tsx`, `src/components/layout/PanelContent.tsx`, `src/components/layout/LayoutEngine.tsx`, and `src/App.tsx`; browser-refresh proof is still pending.
- Browser refresh confirmed the new Routing Learning Tools panel: Tools now shows `Routing Learning Add Routing Learning to sidebar`, and the panel shows export/import actions, eval recommendation proof-state counts, disabled `Apply trusted (0)`, observed outcome summaries, route feedback controls, and recent routing decisions.
- Collected additional no-spend Model Lab evidence: Tools opens Model Lab; Eval still shows `Prepare smallest eval proof`, proof-gate copy, provider-spend guard copy, and disabled `Run Eval (0 × 0 = 0)` with no selections. Results currently shows `No results yet. Configure and run an eval.` when no report is selected, Bench shows `No bench results yet. Select tasks and run a bench.`, and History shows saved eval/bench rows labeled `proof unreviewed` including `Eval 6/6/2026`, `manual-alt`, `manual`, `test recommendations`, and many `assisted export regression` bench rows. Selected-report exports/proof-review decisions remain pending.
- Improved and verified Model Lab History selection: `src/components/ModelLabPanel.tsx` now renders saved eval/bench History rows as real keyboard-accessible buttons with labels like `Open eval report manual-alt` and `Open bench run assisted export regression`. Browser refresh found 116 saved history buttons; selecting `manual-alt` opened Results with `Export proof brief`, `Export report`, recommendation trust copy, `Review state: unreviewed`, and Mark approved/Needs attention/Clear review controls. Selecting a saved `assisted export regression` bench row opened Bench with `Export proof brief`, `Export JSON`, `Bench proof needs review`, review controls, task/model evidence, trace proof, and validation status. No provider runs or proof-review decisions were launched.
- Capped Model Lab History render weight in `src/components/ModelLabPanel.tsx`: the History tab now shows the latest 20 eval reports and latest 20 bench runs, with copy noting the total count when older rows are hidden. This should keep saved proof history inspectable without flooding the DOM; live browser verification is still pending because the current browser driver timed out before clicking Tools in the heavy app state.
- Generated durable no-provider Model Lab export artifacts under `docs/proof/` because the Codex in-app browser cannot save downloads directly: `2026-06-16-model-lab-eval-manual-alt-proof-brief.md`, `2026-06-16-model-lab-eval-manual-alt-recommendation-report.md`, `2026-06-16-model-lab-bench-4e08ec13-87a0-43d2-a1d9-c92cbd8615df-proof-brief.md`, and `2026-06-16-model-lab-bench-4e08ec13-87a0-43d2-a1d9-c92cbd8615df.json`. These are exported evidence artifacts only; proof-review approval/needs-attention decisions remain pending.
- Added a client-only Settings pane error boundary in `src/components/SettingsModal.tsx` after live Agent Roles inspection blanked the app body; browser refresh confirmed Settings now shows a pane-level fallback for Agent Roles instead of collapsing the whole app, so the underlying Agent Roles render bug remains open.
- Fixed the underlying Agent Roles render bug by adding the missing `useMemo` import in `src/components/SettingsModal.tsx`; browser refresh confirmed Agent Roles renders role assignments, `Auto configure roles`, role effort buckets, enabled model choices, and best-available model suggestions.
- Strengthened Agent Roles proof-trust guidance in `src/components/SettingsModal.tsx`: the pane now always shows `Eval proof trust` copy explaining that approved proof can be applied directly, unreviewed proof is manual-only and needs human review before changing defaults, and needs-attention proof stays blocked until resolved. Existing recommendation buttons already render approved proof as `Apply`, unreviewed proof as `Apply manually`, and disable needs-attention recommendations. Live browser verification of the new callout is still pending because Settings clicks timed out in the current heavy browser state.
- Collected partial no-spend Auto-Router evidence: Settings > Auto-Router shows classifier/default model selectors, threshold copy, catalog/configured/routed counts, synced configured candidates, effective-cost guidance, capability badges, and add-candidate controls; proof-review trust copy was not visible in that pass.
- Added always-visible Auto-Router `Eval proof trust` guidance in `src/components/SettingsModal.tsx`; browser refresh confirmed Settings > Auto-Router explains approved proof, unreviewed proof, and needs-attention proof behavior even when no candidate-specific eval recommendation is visible.
- Collected partial no-spend Theme texture evidence: Settings > Theme exposes bounded texture opacity from 0 to 18, current active theme is `Glasshouse High Contrast` with texture `none` at 0%, and computed contrast for visible settings/sidebar/top-bar/environment/main surfaces was high; non-current texture recipes plus code/terminal/diff surfaces remain pending.
- Collected additional no-spend Terminal readability evidence: opening the Terminal panel without running commands showed terminal panel contrast 15.93, terminal input contrast 15.04, and texture opacity still 0; Files was not reachable in that panel state because the Tools locator became ambiguous after Terminal opened.
- Collected Files readability evidence and fixed one contrast issue: Files empty-state text measured 3.97, so `.empty-state-text` in `src/styles/components.css` now uses `--text-secondary`; browser refresh confirmed Files panel contrast 15.93 and empty-state text contrast 7.29.
- Collected non-current texture readability evidence and fixed Theme-card metadata contrast: representative textured themes `System Classic High Contrast` and `System Classic Dark` used `Low Noise Matte · 4%`, while `Glasshouse Day` used `Paper Grain · 3%`; tiny `Texture: ...` and `Active` labels now use `--text-secondary` in `src/components/SettingsModal.tsx`, measuring 6.41 contrast on System Classic textured cards and 6.35 on Glasshouse Day. The app was restored to `Glasshouse High Contrast`, `Texture: none`, opacity 0%.
- Strengthened narrow-width evidence: at roughly 433px viewport there was no document-level horizontal overflow, no environment/composer overlap, no topbar/composer overlap, and sidebar/main geometric overlap was confirmed as an opaque topmost sidebar overlay rather than visible text collision.
- Fixed and verified narrow Settings overflow: `src/styles/components.css` now stacks Settings nav/content under 640px; browser refresh confirmed Settings modal, nav, and content all report no horizontal overflow at narrow width.
- Verified narrow Model Lab and Routing Learning panels: both opened at narrow width with no document-level or panel-level horizontal overflow.
- Strengthened active-work visibility in `src/utils/agentWorkState.ts`, `src/components/ChatPanel.tsx`, `src/components/EnvironmentRail.tsx`, and `src/styles/components.css`: the shared active-work state now carries current task, model/provider, and latest artifact/proof cue, and the existing chat strip plus Environment progress area render those cues quietly beside the workflow steps. Browser proof on a live provider-backed active run remains pending.
- Reduced Environment rail assistive-tech noise in `src/components/EnvironmentRail.tsx`: section, row, trust, hide-panel, spinner, and progress-dot icons are now decorative because visible row/section labels and button labels carry the meaning. Browser proof remains pending.
- Improved Environment rail section disclosure accessibility in `src/components/EnvironmentRail.tsx`: each section toggle now controls a labelled detail region for its expanded body. Browser proof remains pending.
- Hardened Environment rail section disclosure ids in `src/components/EnvironmentRail.tsx`: controlled detail-region ids are now scoped by rail variant to avoid duplicate ids if rail/panel/floating surfaces coexist. Browser proof remains pending.
- Hardened the active-work strip for narrow screens in `src/styles/components.css`: the extra task/model/proof metadata hides below 640px so the workflow steps stay visible without crowding the composer. Browser proof remains pending.
- Improved active-work strip accessibility in `src/components/ChatPanel.tsx`: the strip button's accessible label now includes workflow, current task, model/provider, and latest artifact/proof context before the detail action. Browser proof remains pending.
- Reduced active-work strip assistive-tech noise in `src/components/ChatPanel.tsx`: decorative progress dots and separators are now hidden while the strip keeps its richer accessible label. Browser proof remains pending.
- Improved composer button semantics in `src/components/ChatPanel.tsx`: send and attachment/action buttons now have explicit button type and accessible labels. Browser proof remains pending.
- Reduced composer assistive-tech noise in `src/components/ChatPanel.tsx`: send, attachment, image, skill mention, and run-command icons are now decorative because the buttons have explicit labels. Browser proof remains pending.
- Improved composer textarea accessibility in `src/components/ChatPanel.tsx`: the chat input now has a stable accessible label instead of relying only on placeholder text. Browser proof remains pending.
- Improved new-message scroll control semantics in `src/components/ChatPanel.tsx`: the scroll-to-bottom pill now has explicit button type and accessible label. Browser proof remains pending.
- Reduced new-message scroll-control assistive-tech noise in `src/components/ChatPanel.tsx`: the visible down arrow is now decorative because the button has an explicit label. Browser proof remains pending.
- Tightened left work queue keyboard access in `src/components/Sidebar.tsx`: phase rows that open Agent detail now respond to Enter/Space as well as click. This supports the kickoff detail-inspector requirement, but browser proof on a live active run remains pending.
- Reduced Sidebar assistive-tech noise in `src/components/Sidebar.tsx`: tab, settings, Clicky, project, session, run, and phase-row icons/glyphs are now decorative where text labels or button labels carry the meaning; touched Sidebar buttons also have explicit button type. Browser proof remains pending.
- Improved Sidebar project-group disclosure accessibility in `src/components/Sidebar.tsx`: project group headers now expose expanded state and control labelled chat-list regions. Browser proof remains pending.
- Clarified Sidebar project-group labels in `src/components/Sidebar.tsx`: project group headers now include the expand/collapse action and chat count in their accessible label. Browser proof remains pending.
- Improved Sidebar run-row accessible labels in `src/components/Sidebar.tsx`: rows that focus Agent detail now describe the run, status, task, and latest proof/artifact cue in the button label. Browser proof remains pending.
- Improved Sidebar phase-row accessible labels in `src/components/Sidebar.tsx`: phase rows that focus Agent detail now describe phase, status, task, provider/model, and latest artifact cue in the row label. Browser proof remains pending.
- Improved Sidebar phase-row detail disclosure in `src/components/Sidebar.tsx`: the inline phase detail chevron is now a real button with expanded state and a targeted label. Browser proof remains pending.
- Clarified steering target copy in `src/components/SubAgentTracker.tsx` and `src/styles/components.css`: active steering controls now explain whether notes target the orchestrator or the selected agent for the next safe phase. This supports the steering/intervention requirement, but live run-trace proof of a recorded steering event remains pending.
- Reduced Agent detail workflow-strip assistive-tech noise in `src/components/SubAgentTracker.tsx`: decorative active-flow dots and separators are now hidden while the visible workflow step labels remain. Browser proof remains pending.
- Improved Agent detail workflow-strip structure in `src/components/SubAgentTracker.tsx`: the active-flow strip is now a labelled workflow progress group. Browser proof remains pending.
- Reduced Agent detail replay-summary assistive-tech noise in `src/components/SubAgentTracker.tsx`: replay summary icons for artifacts, tools, steering, requests, and final-answer state are now decorative. Browser proof remains pending.
- Improved Agent detail replay-summary structure in `src/components/SubAgentTracker.tsx`: the replay summary is now a labelled group. Browser proof remains pending.
- Reduced Agent detail replay-event assistive-tech noise in `src/components/SubAgentTracker.tsx`: per-event replay icons are now decorative because event titles/details carry the meaning. Browser proof remains pending.
- Improved Agent detail replay empty-state semantics in `src/components/SubAgentTracker.tsx`: waiting-for-events and filter-empty replay messages now render as polite statuses. Browser proof remains pending.
- Improved Agent detail replay-filter accessibility in `src/components/SubAgentTracker.tsx`: replay filters are now a labelled group, and each filter exposes selected state plus a targeted label. Browser proof remains pending.
- Improved Agent detail steering-control labels in `src/components/SubAgentTracker.tsx`: steering actions, note input, and Add note now include the target run or phase context in accessible labels. Browser proof remains pending.
- Improved Agent detail card accessibility in `src/components/SubAgentTracker.tsx`: card focus labels now include role/name, status, task, model/provider, and latest artifact cue, while header/meta icons are decorative. Browser proof remains pending.
- Clarified Agent detail steering behavior in `src/components/SubAgentTracker.tsx`: active controls now explain replay persistence, artifact-feedback availability, and purpose-specific action labels for flag, redirect, pause, cancel, proof request, approval, and revision. Browser/live steering proof remains pending.
- Strengthened theme reduced-transparency behavior in `src/styles/components.css` and `src/components/SettingsModal.tsx`: reduced transparency now disables textures/blur, forces solid surface opacity, applies theme fallback surface/border/shadow values to primary shell/panel surfaces, and the Theme pane explains the behavior. Browser/manual reduced-transparency proof remains pending.
- Strengthened Model Lab spend guards in `src/components/ModelLabPanel.tsx`: Eval and Bench launch buttons now visibly say `after approval`, include selected matrix size, and expose provider-budget approval requirements in title/accessibility labels. Provider-backed proof remains pending.
- Cleaned up advanced panel chrome in `src/components/layout/PanelWrapper.tsx` and `src/components/layout/panelRegistry.tsx`: source inspection confirmed chat-only default layout and no panel drag/drop handlers in the layout wrapper/engine; panel title icons are decorative and close buttons now have explicit type and `Close {panel} panel` labels. Browser/manual screenshot proof remains pending.
- Tightened Agent detail redirect steering in `src/components/SubAgentTracker.tsx`: Redirect now sends the current note draft as the correction reason when present, and the note placeholder/copy clarify it can be used for steering notes or redirect reasons. Live steering replay proof remains pending.
- Improved artifact feedback status accessibility in `src/components/ArtifactDrawer.tsx`: approval/revision buttons now reference saved/error/local feedback status when present, and the review-note icon is decorative. Browser proof on replay-backed artifact feedback remains pending.
- Improved Model Lab model-selection clarity in `src/components/ModelLabPanel.tsx`: model selection is now a labelled provider-call candidate group, Select all says how many candidates it selects, and each checkbox exposes select/deselect semantics for provider-call runs. Browser/provider proof remains pending.
- Improved Model Lab prompt/task selection clarity in `src/components/ModelLabPanel.tsx`: eval prompts and bench tasks are now labelled provider-call matrix groups, Select all controls say how many items they select, and each checkbox exposes select/deselect semantics for provider-call runs. Browser/provider proof remains pending.
- Improved Model Lab advisory semantics in `src/components/ModelLabPanel.tsx`: matrix caution boxes now announce selected run count plus provider-rate-limit/metered-billing risk with status/alert semantics, diagnostics are live regions, and dismiss buttons are typed/labelled. Browser/provider proof remains pending.
- Improved Model Lab tab semantics in `src/components/ModelLabPanel.tsx`: header navigation is now a labelled tablist, and Eval/Tasks/Bench/Packs/Results/History controls are typed tabs with selected-state semantics, specific labels, matching focusable tabpanels, ArrowLeft/ArrowRight/Home/End keyboard navigation, and roving tabindex. Browser/provider proof remains pending.
- Hardened Model Lab action button semantics in `src/components/ModelLabPanel.tsx`: proof-prep, task seeding, Eval launch, and Bench launch controls are now explicit non-submit buttons. Browser/provider proof remains pending.
- Hardened Model Lab prompt-pack action semantics in `src/components/ModelLabPanel.tsx`: folder prep, skill import, pack eval-run prep, and pack evidence export controls are explicit non-submit buttons with targeted labels. Browser/provider proof remains pending.
- Improved Model Lab Prompt Packs feedback semantics in `src/components/ModelLabPanel.tsx`: import path has a direct label, import errors are alerts, and missing registry/manifests states are polite statuses. Browser/provider proof remains pending.
- Improved Model Lab Prompt Packs trust/status labels in `src/components/ModelLabPanel.tsx`: trust and manifest status pills now expose explicit prompt-pack trust/manifest-status labels instead of relying only on short colored text. Browser/provider proof remains pending.
- Improved Model Lab Prompt Packs registry-root labels in `src/components/ModelLabPanel.tsx`: ready/missing status labels now include root location and path context. Browser/provider proof remains pending.
- Improved Agent Roles proof-control accessibility in `src/components/SettingsModal.tsx`: auto-configure is an explicit labelled button, eval recommendation apply buttons expose approved/manual/blocked proof state, and role/effort icons are decorative. Browser/provider proof remains pending.
- Improved Agent Roles recommendation accessibility in `src/components/SettingsModal.tsx`: recommendation cards now expose role/model labels, and empty effort buckets announce as polite statuses. Browser/provider proof remains pending.
- Improved Agent Roles recommendation-grid accessibility in `src/components/SettingsModal.tsx`: the recommended-model grid is now a labelled group. Browser/provider proof remains pending.
- Improved Agent Roles effort-section accessibility in `src/components/SettingsModal.tsx`: effort buckets now expose labelled/described section relationships for their effort title and intent copy. Browser/provider proof remains pending.
- Improved Agent Roles role-card accessibility in `src/components/SettingsModal.tsx`: role cards now expose role, description, current model, and thinking effort labels. Browser/provider proof remains pending.
- Improved Agent Roles effort-count accessibility in `src/components/SettingsModal.tsx`: effort-count badges now expose how many roles use each thinking-effort bucket. Browser/provider proof remains pending.
- Improved Agent Roles eval recommendation-card accessibility in `src/components/SettingsModal.tsx`: recommendation cards now expose role, recommended model, proof status, and reason as a grouped label. Browser/provider proof remains pending.
- Improved model ability icon accessibility in `src/components/SettingsModal.tsx`: capability icons now expose available/unavailable labels while their SVG glyphs are decorative. Browser/provider proof remains pending.
- Improved Auto-Router candidate accessibility in `src/components/SettingsModal.tsx`: candidate rows now expose candidate/source/cost/capability labels, capability/cost controls are model-specific, and remove controls are explicit labelled buttons with decorative trash icons. Browser/provider proof remains pending.
- Improved Auto-Router summary count accessibility in `src/components/SettingsModal.tsx`: catalog/configured/routed counts now expose explicit status labels. Browser/provider proof remains pending.
- Hardened Auto-Router sync/add button semantics in `src/components/SettingsModal.tsx`: sync configured and add configured candidate controls are explicit typed buttons with targeted labels. Browser/provider proof remains pending.
- Improved Auto-Router add-candidate form accessibility in `src/components/SettingsModal.tsx`: new candidate model id, effective cost, capability card, image/thinking toggles, and Add action now have direct labels; the Add control is an explicit typed button with decorative plus icon. Browser/provider proof remains pending.
- Improved Auto-Router empty-state semantics in `src/components/SettingsModal.tsx`: the no-candidates state now announces as a polite status. Browser/provider proof remains pending.
- Improved Auto-Router eval recommendation accessibility in `src/components/SettingsModal.tsx`: candidate eval recommendation blocks now expose model, role, proof status, and reason as grouped labels. Browser/provider proof remains pending.
- Improved Auto-Router routing-control accessibility in `src/components/SettingsModal.tsx`: classifier model, default fallback model, and routing threshold controls now have direct labels. Browser/provider proof remains pending.
- Tightened calm-chat action clutter in `src/components/NextBestActions.tsx` and `src/components/MessageBubble.tsx`: suggested next actions now default to a compact `Actions` affordance even inside Details, with clearer button semantics. Browser proof remains pending.
- Improved suggested-action dismiss controls in `src/components/NextBestActions.tsx`: both compact and expanded dismiss buttons now expose an accessible label. Browser proof remains pending.
- Improved suggested-action chip accessibility in `src/components/NextBestActions.tsx`: each expanded action now has an explicit suggested-action label, and decorative action icons are hidden from assistive tech. Browser proof remains pending.
- Refined suggested-action disclosure accessibility in `src/components/NextBestActions.tsx`: the collapsed action count badge is visual-only because the button label already includes the count, and the expanded chip strip is now a labelled group. Browser proof remains pending.
- Improved the calm-chat Details toggle in `src/components/MessageBubble.tsx`: the diagnostics gateway now has explicit button type and accessible label while keeping diagnostics hidden by default. Browser proof remains pending.
- Refined the calm-chat Details disclosure in `src/components/MessageBubble.tsx`: the toggle now controls a labelled message-details region, making the hidden diagnostics relationship explicit. Browser proof remains pending.
- Reduced Details-toggle assistive-tech noise in `src/components/MessageBubble.tsx`: the disclosure chevron is now decorative because the button label and expanded state carry the meaning. Browser proof remains pending.
- Improved live thinking status semantics in `src/components/MessageBubble.tsx`: streaming thinking remains a small status line and now uses polite status announcements. Browser proof remains pending.
- Improved typing indicator semantics in `src/components/ChatPanel.tsx` and `src/components/MessageBubble.tsx`: typing remains visually quiet and now uses polite status announcements with labels. Browser proof remains pending.
- Improved browser preview loading semantics in `src/components/BrowserPanel.tsx`: loading dots now use a polite status label while staying visually quiet. Browser proof remains pending.
- Improved Browser panel action semantics in `src/components/BrowserPanel.tsx`: health check, preview, deep capture, quick URL, and screenshot-question controls now have explicit button type and accessible labels. Browser proof remains pending.
- Reduced Browser panel health-check assistive-tech noise in `src/components/BrowserPanel.tsx`: the visual health glyphs are now decorative because the button has an explicit label. Browser proof remains pending.
- Improved Browser panel URL input accessibility in `src/components/BrowserPanel.tsx`: the URL field now has a stable accessible label. Browser proof remains pending.
- Improved Browser quick URL accessibility in `src/components/BrowserPanel.tsx`: quick preview presets are now a labelled group and expose selected state. Browser proof remains pending.
- Improved Browser panel screenshot alt text in `src/components/BrowserPanel.tsx`: preview images now identify the current URL instead of using generic alt text. Browser proof remains pending.
- Improved Browser preview viewport accessibility in `src/components/BrowserPanel.tsx`: the preview area is now a URL-labelled region covering loading, empty, screenshot, reachable, and error states. Browser proof remains pending.
- Improved Browser preview error semantics in `src/components/BrowserPanel.tsx`: preview errors now render in an alert container, with warning glyphs kept decorative. Browser proof remains pending.
- Improved Browser reachable-without-screenshot semantics in `src/components/BrowserPanel.tsx`: the non-error reachable state now renders as a polite status. Browser proof remains pending.
- Improved Browser empty-state semantics in `src/components/BrowserPanel.tsx`: the no-preview-yet state now renders as a polite status while keeping the preview action available. Browser proof remains pending.
- Improved Review Changes button semantics in `src/components/ReviewChangesFlyout.tsx`: refresh/close/tabs/diff actions/validation proof controls now have explicit button type and targeted accessible labels. Browser proof remains pending.
- Improved Review Changes file-row accessibility in `src/components/ReviewChangesFlyout.tsx`: summary and file-list diff rows are now real buttons with targeted labels and selected-state exposure. Browser proof remains pending.
- Preserved flat Review Changes row styling in `src/styles/components.css` after the file rows became buttons, including focus-visible hover parity. Browser proof remains pending.
- Improved Review Changes modal semantics in `src/components/ReviewChangesFlyout.tsx`: flyout containers now expose dialog role, modal state, and a Review changes label. Browser proof remains pending.
- Improved Review Changes dialog labelling in `src/components/ReviewChangesFlyout.tsx`: both no-project and project-backed dialogs now use `aria-labelledby` tied to the visible title, and the no-project close button has explicit button semantics. Browser proof remains pending.
- Improved Review Changes keyboard modal behavior in `src/components/ReviewChangesFlyout.tsx`: the flyout now closes on Escape. Browser proof remains pending.
- Improved Review Changes tab semantics in `src/components/ReviewChangesFlyout.tsx`: the tab strip now exposes `tablist` / `tab` roles, selected state, `aria-controls`, matching `tabpanel` regions, and roving keyboard focus with ArrowLeft, ArrowRight, Home, and End. Browser proof remains pending.
- Marked typing/loading dots decorative in `src/components/ChatPanel.tsx`, `src/components/MessageBubble.tsx`, and `src/components/BrowserPanel.tsx`, so assistive tech receives the labeled status instead of the visual dot elements. Browser proof remains pending.
- Improved the tool-summary toggle in `src/components/MessageBubble.tsx`: tool diagnostics now expose explicit button type, expanded state, and accessible label while remaining behind Details. Browser proof remains pending.
- Reduced tool-summary assistive-tech noise in `src/components/MessageBubble.tsx`: the tool-summary chevron and wrench icons are now decorative because the button label and visible text carry the meaning. Browser proof remains pending.
- Refined tool-summary disclosure accessibility in `src/components/MessageBubble.tsx`: the toggle now controls a labelled tool-details region with a unique generated id. Browser proof remains pending.
- Improved the Confidence meter toggle in `src/components/ConfidenceMeter.tsx`: the diagnostic badge now has explicit button type, expanded state, and accessible label while staying behind Details. Browser proof remains pending.
- Refined Confidence meter accessibility in `src/components/ConfidenceMeter.tsx`: the toggle now controls a labelled confidence-details region, and confidence icons are decorative because row text carries the meaning. Browser proof remains pending.
- Improved message-level patch/replay actions in `src/components/MessageBubble.tsx`: `Review patch` and `Export replay` now have explicit button type and accessible labels while staying quiet inline affordances. Browser proof remains pending.
- Reduced message-level patch/replay action assistive-tech noise in `src/components/MessageBubble.tsx`: the patch emoji and replay download icon are now decorative because the buttons have explicit labels. Browser proof remains pending.
- Improved Team Plan artifact actions in `src/components/MessageBubble.tsx`: `Revise` and `Execute` now have explicit button type and artifact-specific accessible labels. Browser proof on a saved/team-plan artifact remains pending.
- Reduced Team Plan artifact assistive-tech noise in `src/components/MessageBubble.tsx`: the card title icon plus `Revise` and `Execute` action icons are now decorative because the artifact title and button labels carry the meaning. Browser proof on a saved/team-plan artifact remains pending.
- Clarified texture accessibility copy in `src/components/SettingsModal.tsx`: the Theme texture slider now states that textures are shell-only and automatically disabled when reduced transparency is requested by the system. Browser proof of the updated copy and reduced-transparency behavior remains pending.
- Added reduced-motion protection in `src/styles/components.css`: small chat/work/status pulsing animations now stop under `prefers-reduced-motion: reduce`. Browser proof remains pending.
- Extended reduced-motion protection in `src/styles/components.css` to the Environment active-agents spinner. Browser proof remains pending.
- Extended reduced-motion protection in `src/styles/components.css` to shared `.spin` loaders used across settings, patch/review, and refresh surfaces. Browser proof remains pending.
- Reconciled stale closeout wording in `docs/proof/2026-06-16-premier-harness-closeout.md`: the stop-condition audit no longer says Agent Roles is stuck on the earlier error-card fallback; it now matches the later evidence that Agent Roles renders, while keeping proof-trust callout verification and approved/trusted apply proof pending.
- Reconciled the manual UI `Left work queue` row in `docs/proof/2026-06-16-premier-harness-closeout.md`: it now records the existing saved-run grouping/proof/model/status evidence instead of saying `pending`, while keeping live provider-backed active-run grouping proof pending.
- Collected partial calm-chat/artifact evidence from existing `Color Clash (GPT)` session `launch this game for testubg`: default chat showed clean prose plus compact `Export replay`, `Review 2 artifacts 2 cmds`, and `Details` affordances; Details and artifact review opened on demand without raw tool-event dumps.
- Broadened Artifact Drawer coverage in `src/components/ArtifactDrawer.tsx`: plain markdown `Plan`, `Execution Plan`, `Implementation Plan`, `Team Plan`, `Review Findings`, `Findings`, and `Code Review Findings` sections now become first-class reviewable artifacts, alongside the existing code/diff/command/evidence/comparison/validation-proof/structured artifact extraction. A session API scan found 4 saved sessions and no message-level structured work-product artifacts, so direct saved-session proof for team-plan/comparison/evidence/review-findings artifacts remains pending.
- Added inline expansion for long Artifact Drawer items in `src/components/ArtifactDrawer.tsx` and `src/styles/components.css`: long artifacts remain quiet previews by default, with per-artifact `Show full` / `Collapse` controls for reviewing the complete content. Browser proof remains pending.
- Improved the Artifact Drawer toggle in `src/components/ArtifactDrawer.tsx`: the review affordance now exposes expanded/collapsed state, artifact count, and ownership of the expanded artifact region through its accessible metadata. Browser proof remains pending.
- Refined Artifact Drawer toggle accessibility in `src/components/ArtifactDrawer.tsx`: the toggle accessible label now includes the artifact-type summary, while its package and chevron icons are decorative. Browser proof remains pending.
- Reduced Artifact Drawer action assistive-tech noise in `src/components/ArtifactDrawer.tsx`: Needs revision, Approve, Revise, and Copy action icons are now decorative because the buttons have explicit labels. Browser proof remains pending.
- Reduced Artifact Drawer type-icon assistive-tech noise in `src/components/ArtifactDrawer.tsx`: code, diff, command, plan, evidence, review finding, comparison, validation proof, and file-reference type icons are now decorative because artifact labels carry the meaning. Browser proof remains pending.
- Improved Artifact Drawer item structure in `src/components/ArtifactDrawer.tsx`: each reviewable artifact item is now exposed as a labelled region using its artifact label. Browser proof remains pending.
- Improved Artifact Drawer referenced-file structure in `src/components/ArtifactDrawer.tsx`: referenced-file chips now sit inside a labelled group tied to the visible `Referenced files:` label. Browser proof remains pending.
- Improved Artifact Drawer content labeling in `src/components/ArtifactDrawer.tsx`: each artifact preview block now has an explicit `Content for ...` label tied to the artifact label. Browser proof remains pending.
- Refined Artifact Drawer expansion controls in `src/components/ArtifactDrawer.tsx`: each long-artifact `Show full` / `Collapse` button now controls the exact preview block it expands. Browser proof remains pending.
- Improved Artifact Drawer copy-state accessibility in `src/components/ArtifactDrawer.tsx`: artifact copy buttons now change title and accessible label to `Copied ...` while the copied state is active. Browser proof remains pending.
- Collected partial left-pane/right-detail evidence from the same saved `Color Clash (GPT)` session: a completed `coder run` is nested under the owning project/session with status, proof, model/provider, and elapsed age; clicking it opens the right-side Agent detail overlay with proof, grouped trace, replay counts, model/provider, token/time summary, and steering controls. Live active-run steering proof remains pending.
- Fixed hidden Environment/Super panel horizontal overflow: `src/styles/components.css` no longer translates the hidden floating panel outside the chat root; browser measurement confirmed `.chat-panel-root` `clientWidth` 1150 equals `scrollWidth` 1150 and document `clientWidth` 1422 equals `scrollWidth` 1422 while the panel is hidden.
- Probed Review Changes with the current clean state: a visible `button[aria-label="Review changes"]` showed `ChangesClean`, and a forced browser-driver click succeeded, but no visible review/diff/proof surface opened; keep Review Changes/diff readability as pending until there are actual changes or a non-clean fixture to inspect.
- Improved and verified the no-project Review Changes path: `src/components/EnvironmentRail.tsx` now keeps the Review Changes row enabled and distinguishes `No project` from `Clean`; browser refresh showed `ChangesNo project`, title `Open a project to review changes`, and clicking it opened the `Review Changes` flyout with `Open a project to review changes` and no horizontal overflow.
- Improved and verified the clean-project Review Changes path: selecting `launch this game for testubg` under `/Users/kevink/Projects/Color Clash (GPT)` showed `ChangesClean`, title `Review clean working tree`, and clicking opened the `Review Changes` flyout with `No changes — working tree is clean`, tabs for Summary/Files/Patches/Validate/Commit, branch stats reduced to `main` with no fake `+0/-0/0 files` noise, and no horizontal overflow.
- Improved and verified the changed-file Review Changes path: a local app session `OpenHarness Review Changes Proof` opened `/Users/kevink/Projects/OpenHarness`; Environment showed `52 files` and `Changes+5743-1550`, Review Changes grouped changes by Docs/Other/Server/Source, and the Files tab rendered `src/components/ReviewChangesFlyout.tsx` with `+111-5`, actions for Stage/Review/Explain/Propose patch, 188 diff lines with meta/added/removed styling, and no horizontal overflow. `src/components/ReviewChangesFlyout.tsx` now also shows a visible `Could not load a diff for ...` fallback instead of a blank pane when a selected file has no loadable diff.
- `docs/HARNESS_WORK_ROADMAP.md` and `docs/UI_CLEANUP_PLAN.md` now reference `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md`, keeping companion roadmap/declutter docs aligned with closeout evidence requirements.

Next best slice:
- Continue auditing against `docs/PREMIER_HARNESS_KICKOFF.md`.
- Focus next on `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md`: use the phase-mapped manual UI review matrix for a no-spend acceptance pass, prepare smallest Eval/Bench proof selections, and use the approval prompt template before provider-backed runs.
- Use the checklist's `Premier Harness Closeout Evidence` template to collect proof before considering the goal complete.
- Continue filling `docs/proof/2026-06-16-premier-harness-closeout.md` from the remaining gaps in the kickoff stop-condition audit and phase-mapped manual UI evidence table; several no-spend fields now have partial evidence, but live provider-backed runs, proof-review decisions, browser checks, and final gates remain open.
- Continue manual UI review from the remaining gaps: live Model Lab History cap verification, remaining narrow modal/panel checks outside Settings/Model Lab/Routing Learning, live Agent Roles proof-trust callout verification, live active-work and steering-event proof, direct saved-session proof for structured team-plan/comparison/evidence/review-findings artifacts, remaining code-oriented panel readability beyond Review Changes, and remaining Phase 6 proof-review decisions plus approved/trusted apply behavior.
- The evidence file now contains a draft provider-backed proof-run approval request; ask the reviewer before launching any Eval, Bench, Planning Room, execute, or investigate proof run.
- Paste-ready approval prompt:
  `Provider-backed proof run approval needed. Planned calls: Eval proof yes, 1 prompt x 1 model; Bench proof yes, 1 task x 1 model; Runtime scenarios: Planning Room plus one execute or investigate run. Purpose: capture closeout evidence for docs/PREMIER_HARNESS_PROOF_CHECKLIST.md. Please choose: 1. Approve smallest proof runs only. 2. Approve eval proof only. 3. Approve bench proof only. 4. Do not run provider-backed proof yet.`
- Paste-ready final-gate approval prompt:
  `Final closeout gates need approval before running local validation. Planned commands: npm run lint and npm run build. Optional hardening command only if we decide touched routing/provider/budget/import-export/security-sensitive paths require it. Purpose: capture final gate evidence for docs/PREMIER_HARNESS_PROOF_CHECKLIST.md. Please approve: 1. Run lint/build only. 2. Run lint/build plus scoped hardening. 3. Do not run final gates yet.`
- Paste-ready browser/manual proof approval prompt:
  `Browser/manual proof pass approval needed. Planned checks: refreshed desktop/narrow chat-first shell; Model Lab History cap; Agent Roles proof-trust callout; Theme reduced-transparency copy; artifact drawer Show full/Collapse; Review Changes proof-save-to-chat if a safe validation result is available. Purpose: refresh direct UI evidence in docs/proof/2026-06-16-premier-harness-closeout.md. Please approve: 1. Run browser/manual proof pass. 2. Limit to no-provider UI checks only. 3. Do not run browser/manual proof yet.`
- Treat stale, indirect, ambiguous, or partial evidence as not complete; refresh or continue from the missing checklist item.
- Use the checklist's final-gate decision rules before running `npm run lint`, `npm run build`, `npm run test:hardening`, or a documented scoped substitute.

Proof execution checklist:
- Model Lab Eval: use `Prepare smallest eval proof`, run the prepared 1x1 eval, open Results, save a proof review decision, export proof brief and recommendation report, and confirm Routing Learning treats only approved proof as trusted.
- Model Lab Bench: use `Prepare proof run` only if provider budget allows, run the prepared 1x1 bench, open Bench results, save a proof review decision, export proof brief and JSON, and confirm rankings are not trusted until approved.
- Manual UI: check desktop and narrow widths for chat-first layout, left work queue, right Agent detail, Settings → Routing Learning, Model Lab Results/Bench/History, and theme texture readability.
- Runtime scenarios: run one Planning Room request and one execute/investigate request to prove active phases appear under the owning thread, detail remains inspectable, and steering notes are recorded.
- Final gates: after proof/manual checks are captured, run `npm run lint`, `npm run build`, and any scoped hardening test needed for touched server/runtime code.

## Premier Harness Kickoff Acceptance Audit — Current State

This is the current evidence-backed status against `docs/PREMIER_HARNESS_KICKOFF.md`. Treat this as a working audit, not a completion claim.

| Area | Current status | Remaining proof or work |
| --- | --- | --- |
| Phase 0 source of truth | Mostly implemented. `NEXT_SESSION.md`, `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md`, `docs/UI_CLEANUP_PLAN.md`, and `docs/HARNESS_WORK_ROADMAP.md` point at the Premier Harness kickoff direction. | No validation needed beyond doc review. |
| Phase 1 chat-first / remove layout bloat | Mostly implemented. Default layout and tool menus are chat-first and the permanent `sub-agents` split is hidden. Legacy novelty surfaces were removed. Targeted search found no panel/rail drag-drop handlers in `src/types/layout.ts`, `LayoutEngine`, `PanelWrapper`, `EnvironmentRail`, or `TopBar`; remaining `drag` CSS hits are native window-drag regions. | Browser desktop/narrow visual check still needed before calling this done. |
| Phase 2 agent work model | Partially implemented. Active work appears in chat, left project/session tree, Environment rail, and `AgentFocusPanel`; left rows show artifact/proof and steering cues. | Needs live Planning Room and execute/investigate runs to prove phases appear under the owning thread and remain inspectable after completion. |
| Phase 3 right-hand detail and steering | Partially implemented. Agent detail exists, structured steering calls flow through the existing run-steering API, and steering controls are gated by state/artifact availability. | Needs live multi-phase run proof that steering notes are recorded and consumed by the next safe phase. Pause/cancel runtime semantics still need careful server-side audit before claiming complete. |
| Phase 4 calm chat and artifact review | Mostly implemented. Diagnostics are hidden behind `Details`; artifacts, comparison artifacts, replay export, replay summary, and validation proof are visible without flooding chat. Review Changes can save validation proof as a replayable session artifact message, and saved validation proof now carries explicit proof labeling in work/detail surfaces. | Needs manual readable-response checks, team-plan promote/revise checks, patch review checks, and narrow-width layout pass. |
| Phase 5 theme texture layer | Mostly implemented. Texture tokens, schema validation, bounded recipes, built-in subtle examples, settings metadata, and opacity override are in place. | Needs built-in theme validation, reduced-transparency check, and readability pass across chat/sidebar/settings/code/terminal/diff surfaces. |
| Phase 6 premier model harness | Started, not complete. Replay export, replay summaries, replay filtering, comparison artifacts, Prompt Microscope, routing/learning surfaces, responsive Routing Learning proof layout, versioned server-backed full Routing Learning JSON export/import with dry-run confirmation, benchmark import mode and dataset counts, loaded-window dataset mix metric, Markdown dataset-mix proof, benchmark-route filter, per-row dataset labels, unsupported-schema warnings, server-detected file/source/schema preview, client/server raw-array support, freshness/filter summary, and filtered subset, Routing Learning Markdown evidence brief aligned to active filter context, broader 100-decision routing evidence window, exact/relative route recency cues, Routing Learning data-age warning in UI and brief exports, plain-language route margin summaries, routing outcome reviewer notes with save/update flow, routing note coverage metric, unexplained-route, stale-route, fallback-route, and benchmark-route filters with active state/counts/export context/list scope plus clear-filters affordance, Routing Learning eval proof-review status/counts in cards, metrics, debug summary, and exports, Model Library `Harness fit` scorecards, fixed-model spend cautions, role-card eval recommendations, eval proof-review trust cues in Agent Roles and Auto-Router, trusted-only bulk recommendation apply with explicit approved-proof counts and tooltips, proofTrusted recommendation metadata, status-specific Auto-Router eval evidence annotations with provider-prefix matching, Auto-Router eval-backed candidate cues, Model Lab matrix run cautions, provider-health signal in run cautions, provider-spend guard copy beside Eval/Bench launch buttons, config-backed model-budget preflight enforcement, Model Budget settings UI, config-backed provider-rate-limit enforcement, Provider Rate Limit settings UI, visible rolling rate-limit status/events, global status-bar rate-limit warnings, persisted rate-limit telemetry, Model Lab proof brief exports with recommendation/ranking trust state, Model Lab History proof-review labels, server recommendation-report trust/proof columns, proof-review callouts, durable proof-review decisions/notes, proof-review state in recommendation exports, small proof-run presets with proof-gate guidance, pack eval coverage, pack-to-eval prompt selection, pack evidence brief exports, pack-prepared eval naming, durable pack context in eval reports/proof briefs/recommendation reports, and calibration/comparison pack guidance provide visibility/control. | Still needs actual Model Lab proof runs and human review of exported proof. |
| Stop condition | Not met. | Lint/build have not been rerun; manual UI and runtime scenario checks remain; server/runtime restart is only needed after server changes. |

## Current Runtime Status
- ✅ **Server**: Running on `http://127.0.0.1:3001` (via `screen -S oh-server`)
- ✅ **Frontend**: Running on `http://127.0.0.1:5173` (via `screen -S oh-vite`)
- ✅ `GET /api/providers` — returns MiniMax provider
- ✅ `GET /api/router/state` — auto-router enabled with 2 candidates, threshold 0.7
- ✅ `GET /api/prompt-plugins` — returns read-only prompt plugin registry data
- ✅ `GET /` on server returns Express 404, which is expected because no root API route is defined

### Restart if killed
```bash
screen -dmS oh-server bash -c 'cd /Users/kevink/Projects/OpenHarness && npx tsx server/index.ts'
screen -dmS oh-vite bash -c 'cd /Users/kevink/Projects/OpenHarness && npx vite --port 5173 --host'
```

---

## What's Truly Implemented vs. Still Open

After auditing the source code against the 6 Critical Gaps from PLAN.md and adding Planning Room:

### ✅ Fully Addressed (5 of 6)
1. **Orchestrator spawns agents** — Execute/investigate/compare modes use `agentRuntime.ts` with sub-agents
2. **Auto-router (classifier-based)** — `server/autoRouter.ts` scores candidates on capability
3. **Agent Roles + Planning Room** — Different models per role, and planning requests now run multiple planner participants when configured
4. **Cost-aware/complexity-aware selection** — Simple low-risk tasks use cheap-direct, medium tasks use classifier routing, and deep/tool-heavy/image work escalates through policy gates
6. **"Start with answer" rule gated** — `isReasoningModel()` check at line 2203 of `server/index.ts`

### ✅ New Source of Truth
- **Planning Room is the core product direction** — planning/roadmap/design/strategy requests route to `mode: 'plan'`
- **Planning Room v1** — independent model plans, peer cross-checks, and final team-plan synthesis are implemented in `server/orchestrator.ts`
- **Project Companion is next** — cheap/local side assistant that answers quick questions from plans, run traces, repo maps, and summaries

### ◐ Still Open / Partial (1 of 6)
5. **Eval feedback loop into routing is partial** — candidate cards and threshold adjustment consume some eval/history data, but user-facing dashboards, per-task recommendations, and role-assignment suggestions remain open.

### From NEXT_SESSION.md "What Could Be Next" — Also Open
- **Project Companion** — cheap/local side assistant for quick project questions and token savings
- **Rate limiting / token budget enforcement** in provider adapter layer
- **Electron app polish** — packaging, auto-update, native window chrome
- **Decision tree visualization** for routing decisions in Settings
- **Per-model success dashboard** in Settings → Routing Learning
- **Export/import** routing learning data for benchmarking

---

## Consolidated Todo — Critical Gaps #4 & #5 + Related Items

### Gap #4: Cost-Aware & Complexity-Aware Selection

This is implemented in the current code. Future work should preserve and improve visibility, not rebuild it:
- Simple low-risk tasks use `cheap-direct` and skip classifier overhead.
- Medium tasks use classifier routing.
- Deep, tool-heavy, and image tasks escalate to stronger suitable candidates.
- Route trace separates workflow routing from model-selection policy.

### Gap #5: Eval Feedback Loop into Routing

Do not start this until the remaining higher-priority prompt/routing/output presentation items above are clearly complete.
**Files to touch:** `server/evals.ts`, `server/autoRouter.ts`, `server/router.ts`, `server/index.ts`

1. **Expose `EvalSummary.recommendations`** as an API endpoint
2. **Wire recommendations into auto-router candidates** — update candidate cards based on eval results per role
3. **Track per-task-type routing success/failure** — use `routerLearning.ts` outcome recording with task type metadata
4. **Surface "best model for X tasks"** in a Settings dashboard panel
5. **Auto-adjust role assignments** from eval data — if eval says Qwen3 Coder is best for code, update the "coder" agent role

### P2: Rate Limiting / Token Budget Enforcement
**Files to touch:** `server/providerHealth.ts`, `server/config.ts`

1. **Harden distributed/runtime semantics** — current live rate window is in-memory per server process, though warn/block events persist
2. **Audit runtime semantics** — status-bar warnings now expose recent/exhausted windows; remaining work is multi-process/shared-window enforcement if OpenHarness runs more than one server process

### P2: Electron App Polish
**Files to touch:** `electron/main.cjs`, `package.json`

1. **Fix `electron .` startup** — add error handling for missing Vite server
2. **Auto-update wiring** — add `electron-updater` with GitHub releases
3. **Native window chrome polish** — custom titlebar, traffic light insets, min size
4. **Packaging config** — update electron-builder config for macOS .dmg signing

### P3: Routing Decision Visualization
**Files to touch:** `src/components/Settings/RoutingLearning.tsx` (new)

1. **Decision tree component** — visual flow of "input → heuristic router → auto-router → model selection"
2. **Show per-decision details** — task text, classification result, selected model, score, cache hit
3. **Filter by date/model/task-type**

### P3: Per-Model Success Dashboard
**Files to touch:** `src/components/Settings/ModelSuccess.tsx` (new), `server/routerLearning.ts`

1. **Success rate table** — model, total tasks, success rate, avg cost, top task types
2. **Historical trend chart** — success rate over time per model
3. **Recommendation panel** — "Qwen3 Coder shows 94% success on coding tasks"

### P3: Export/Import Routing Learning Data
**Files to touch:** `server/routerLearning.ts`, `src/components/Settings/`

1. **JSON/Markdown export** — Settings → Routing Learning now downloads a full server-backed JSON evidence bundle and a human-readable brief
2. **JSON import** — Settings → Routing Learning now previews JSON imports with dry-run counts, then merges new events by ID without overwriting local records after confirmation
3. **Benchmark mode** — imports can now flag events as benchmark data, preserving them while excluding them from production success summaries

---

## Quick Reference

```typescript
// Key server endpoints
GET  /api/router/state          — Auto-router configuration + cache state
GET  /api/router/learning       — Cross-session routing summary
GET  /api/router/learning/events — Raw routing decision events
GET  /api/router/learning/success-rates — Per-model success rates
POST /api/router/learning/outcome  — Record outcome signal (success/failure/ambiguous)
POST /api/router/learning/suggest-threshold — Ask for threshold adjustment suggestion
GET  /api/providers             — List configured providers
POST /api/providers/:id/health/probe — Live health test for a provider
GET  /api/mcp/curated/validate  — Validate curated MCP prerequisites
GET  /api/mcp/watchdog          — MCP connection status
GET  /api/cost/estimate         — Estimate USD cost for a model + token count

// Key source files
server/autoRouter.ts            — Classifier-based per-task model routing
server/router.ts                — Heuristic router (role/mode/complexity regex)
server/orchestrator.ts          — Multi-agent pipelines
server/agentRuntime.ts          — Sub-agent execution
server/routerLearning.ts        — Cross-session routing learning
server/evals.ts                 — Eval harness with recommendations
server/modelProfiles.ts         — Model configs, pricing, isReasoningModel()
server/providerHealth.ts        — Health probe + capability tracking
server/config.ts                — Config schema including auto-router, context config
```

## Immediate Commands
```bash
# Kill server & frontend when done
screen -S oh-server -X quit
screen -S oh-vite -X quit

# Re-launch
screen -dmS oh-server bash -c 'cd /Users/kevink/Projects/OpenHarness && npx tsx server/index.ts'
screen -dmS oh-vite bash -c 'cd /Users/kevink/Projects/OpenHarness && npx vite --port 5173 --host'
```

## 2026-06-16 update — agent steering safety

- `src/components/SubAgentTracker.tsx` now gates steering controls to active runs only. Completed/failed runs show a history-only explanation and keep replay filters available.
- `src/styles/components.css` adds the matching history-copy styling.
- Still pending: approved provider-backed live active-run proof that a steering action records in the run replay.

## 2026-06-16 update — artifact review feedback

- `src/components/ArtifactDrawer.tsx` now supports per-artifact flags, review notes, and `Revise` prompts that reuse the existing chat-send flow.
- `src/components/MessageBubble.tsx` passes `onSendMessage` into the drawer, and `src/styles/components.css` styles the new quiet artifact feedback controls.
- Still pending: persisted artifact comments/flags as structured records, plus saved-session proof for generated team-plan/comparison/evidence/review-finding artifacts.

## 2026-06-16 update — durable artifact feedback via run trace

- `src/components/ArtifactDrawer.tsx` now persists generated-artifact `Approve` and `Needs revision` actions through the existing `sendRunSteering` API when `message.runTrace` exists.
- Persisted feedback becomes structured run-trace steering evidence (`approve-artifact` / `needs-revision`) with artifact label/type/id and reviewer note.
- Still pending: browser proof on a saved provider-backed artifact session and any future dedicated artifact-comment store if comments need to live outside run replay.

## 2026-06-16 update — validation proof artifact typing

- `src/utils/api.ts` now models `validation_proof` work-product artifacts and reuses `ValidationProofCommand[]` for saved Review Changes proof artifacts.
- This aligns API client types with `src/types/index.ts` and `server/runTrace.ts` so validation-proof artifacts do not drift between UI surfaces.

## 2026-06-16 update — artifact feedback replay acknowledgement

- `src/utils/api.ts` now returns the saved `HarnessRun` from `sendRunSteering`.
- `src/components/ArtifactDrawer.tsx` shows `Saved to replay` with the returned event count after persisted artifact approval/revision feedback.
- Still pending: app-wide message-state refresh from that returned run, plus browser proof in a saved provider-backed artifact session.

## 2026-06-16 update — artifact feedback refreshes app run state

- `App.handleRunSteer` now returns the persisted run from `sendRunSteering` and replaces matching message/Agent Work run traces when the server confirms the save.
- `ChatPanel`, `MessageBubble`, and `ArtifactDrawer` now pass artifact approval/revision through that shared steering path.
- Still pending: browser proof on a saved provider-backed artifact session, plus final validation gates.

## 2026-06-16 update — steering callback type alignment

- Steering callback props now share the persisted-run return contract across chat artifacts, layout plumbing, and agent-detail steering surfaces.
- This supports replay-state refresh after artifact feedback or agent steering without treating the returned run as an accidental implementation detail.

## 2026-06-16 update — artifact feedback save confirmation

- `ArtifactDrawer` now requires a returned persisted run before showing artifact feedback as saved to replay.
- If confirmation is missing, it surfaces `Could not confirm replay save` rather than overclaiming durable feedback.

## 2026-06-16 update — artifact feedback local-only copy

- `ArtifactDrawer` now separates local-only artifact feedback from replay-saved feedback in the UI.
- Non-run-trace artifacts say `Approval noted` / `Revision noted` and `Local note only`; replay persistence still requires a returned run.

## 2026-06-16 update — Review Changes proof artifact refresh

- `ReviewChangesFlyout` now sends the saved validation proof message back to `App` after `saveValidationProofArtifact` succeeds.
- `App` maps that message into the current chat and restores the proof run as an Agent Work entry, so saved validation proof artifacts do not require a session reload to become inspectable.
- Still pending: browser proof of the save-and-render flow plus final validation gates.

## 2026-06-16 update — steering replay persistence hardening

- `App.handleRunSteer` now waits for the server-returned persisted run before updating message and Agent Work replay state.
- Steering status messages are added only after persistence succeeds, keeping visible replay state aligned with saved session state.

## 2026-06-16 update — Review Changes proof save copy

- Review Changes validation proof save now confirms `Saved to chat`, matching the behavior where the returned validation proof artifact message is appended to the current chat.

## 2026-06-16 update — Review Changes proof save reset

- Review Changes now clears the `Saved to chat` confirmation when validation command results change, so the confirmation stays tied to the current proof payload.
- The reset also reacts to session id and working-directory changes because those fields are part of the saved proof artifact.

## 2026-06-16 update — Review Changes proof append cleanup

- `App.handleProofArtifactSaved` now appends saved validation proof messages without nesting router-state updates inside the message-state updater.

## 2026-06-16 update — Review Changes proof session summary

- Saving a validation proof artifact now updates the active session summary preview, timestamp, and message count so the sidebar matches the proof message added to chat.

## 2026-06-16 update — Review Changes proof save dedupe

- `App.handleProofArtifactSaved` now tracks saved proof message ids so duplicate callbacks do not append duplicate proof messages or overcount the sidebar session summary.
- The handler also exits when the saved proof message is already present in chat, keeping session message counts tied to actual chat contents.

## 2026-06-16 update — Review Changes proof session preview

- Saved validation proof artifacts now update the sidebar session preview from the proof artifact title and summary instead of raw markdown.

## 2026-06-16 update — validation proof artifact drawer dedupe

- `ArtifactDrawer` now skips markdown `Validation Proof` extraction when a structured `validation_proof` artifact already exists on the run trace, avoiding duplicate proof entries for saved Review Changes artifacts.

## 2026-06-16 update — structured artifact drawer dedupe

- `ArtifactDrawer` now suppresses markdown evidence, review-finding, comparison, and validation-proof extraction when the run trace already has the corresponding structured artifact.
- Markdown section extraction still works as a fallback for plain assistant messages without structured artifacts.

## 2026-06-16 update — team plan artifact drawer support

- Structured `team_plan` run-trace artifacts now appear in `ArtifactDrawer` as plan artifacts, while markdown plan extraction is suppressed when that structured plan exists.
- `ArtifactDrawer` now receives the shared `onRunSteer` callback prop, so artifact approval/revision controls can use persisted steering.

## 2026-06-16 update — structured artifact feedback ids

- `ArtifactDrawer` now preserves source run-trace artifact ids for structured team plans, evidence, review findings, comparisons, and validation proof.
- Artifact approval/revision notes use the source artifact id when available instead of the drawer-local display id.
- Artifact `Revise` prompts now include the source artifact id when available, matching persisted approval/revision feedback notes.

## 2026-06-16 update — structured artifact drawer type hardening

- `ArtifactDrawer` now uses explicit type guards for structured artifact filters, avoiding reliance on compiler-specific inferred filter narrowing.

## 2026-06-16 update — artifact feedback state cleanup

- Artifact feedback state now clears stale local-only and replay-saved markers when switching between local notes, confirmed replay saves, and failed replay saves.

## 2026-06-16 update — artifact feedback in-flight guard

- Artifact approval/revision controls now track a per-artifact saving state, disable repeat clicks, and show `Saving...` while replay persistence is pending.
- Artifact review-note inputs and `Revise` actions also disable during that artifact's pending feedback save.
- The drawer tracks which verdict is saving, so only the clicked approve/revision control shows `Saving...` while the other stays disabled with its normal label.
- Artifact rows now expose `aria-busy` during feedback saves, and disabled controls use saving-specific titles.
- Artifact feedback success/local-only messages now use polite status live regions, while save errors use alert semantics.
- Artifact feedback, revise, and copy controls now include artifact-specific `aria-label`s.
- Artifact review-note inputs now describe the current feedback status via `aria-describedby` when a status is visible.
- Artifact feedback status ids are sanitized before being used as DOM ids.
- Artifact feedback status ids include both message id and artifact id so references stay unique across repeated assistant messages.
- Artifact drawer command buttons now explicitly use `type="button"`.

## 2026-06-16 update — Review Changes proof save retry state

- Review Changes clears the previous `Saved to chat` state before each validation proof save attempt, so a failed retry cannot display stale success copy.
- Improved left work queue navigation in `src/components/Sidebar.tsx`: Chat/Projects panel toggles now expose controlled panel state, session rows support keyboard selection with current-chat and active-work labels, and phase detail disclosure buttons own their detail region. Browser/live active-run proof remains pending.
- Improved active-work checklist semantics in `src/components/ChatPanel.tsx`, `src/components/SubAgentTracker.tsx`, and `src/components/EnvironmentRail.tsx`: chat, Agent detail, and Environment progress steps now expose labelled step-status lists instead of relying on visual dots alone. Browser/live active-run proof remains pending.
- Improved left work queue run-phase relationships in `src/components/Sidebar.tsx`: run rows now point to their labelled phase group with `aria-controls`, preserving the run-to-phase hierarchy for assistive navigation. Browser/live active-run proof remains pending.
- Improved active-work current-step semantics in `src/components/ChatPanel.tsx`, `src/components/SubAgentTracker.tsx`, and `src/components/EnvironmentRail.tsx`: running checklist steps now expose `aria-current="step"` so current phase is explicit beyond color/spinner motion. Browser/live active-run proof remains pending.
- Improved Agent detail inspector shell accessibility in `src/components/AgentFocusPanel.tsx`, `src/components/SubAgentTracker.tsx`, and `src/styles/components.css`: back controls are typed/labelled, agent-list rows expose current detail state, decorative inspector icons are hidden, and the card disclosure is now a real controlled button. Browser/live steering proof remains pending.
- Cleaned up Agent detail nested controls in `src/components/SubAgentTracker.tsx` and `src/styles/components.css`: agent cards are labelled groups rather than card-sized buttons, and advanced-panel focus behavior uses an explicit `Focus` button. Browser/live steering proof remains pending.
- Improved Agent detail region labelling in `src/components/AgentFocusPanel.tsx` and `src/components/SubAgentTracker.tsx`: the inspector list/detail split and run-summary counts now expose direct labels/status summaries. Browser/live steering proof remains pending.
- Cleaned up left project group nested controls in `src/components/Sidebar.tsx` and `src/styles/components.css`: project headers are no longer card-sized buttons around New/Delete controls; the collapse affordance is now an explicit typed button with expanded state and controlled chat-list relationship. Browser/live proof remains pending.
- Cleaned up left session row nested controls in `src/components/Sidebar.tsx` and `src/styles/components.css`: opening a chat is now an explicit typed row button, and deleting a chat remains a separate labelled control. Browser/live proof remains pending.
- Followed up the left session row split in `src/styles/components.css`: the delete-chat action is anchored independently, and the explicit open-chat button reserves space so row text and controls do not collide. Browser/live proof remains pending.
- Improved left pane shell-control labels in `src/components/Sidebar.tsx`: Chat/Projects toggles now expose direct hide/show panel labels, and New Project has a direct project-folder action label. Browser/live proof remains pending.
- Corrected the explicit open-chat row button markup in `src/components/Sidebar.tsx` and `src/styles/components.css`: title/preview/timestamp wrappers are inline-safe inside the button while preserving the same stacked row layout. Browser/live proof remains pending.
- Corrected the session running indicator markup in `src/components/Sidebar.tsx`: the active-running cue inside the explicit open-chat row button now uses an inline-safe element. Browser/live proof remains pending.
- Improved left pane hierarchy status labels in `src/components/Sidebar.tsx`: project chat counts now expose project-specific count context, and empty run phase groups announce as polite statuses. Browser/live proof remains pending.
- Cleaned up left phase row nested controls in `src/components/Sidebar.tsx` and `src/styles/components.css`: phase rows are labelled groups, phase focus is an explicit `Focus` button, and disclosure remains a separate expanded-state control. Browser/live proof remains pending.
- Improved Agent Work empty-state semantics in `src/components/SubAgentTracker.tsx` and `src/components/AgentFocusPanel.tsx`: no-run empty states now announce politely, and decorative icons are hidden from assistive tech. Browser/live proof remains pending.
- Improved active-work detail-opening semantics in `src/components/ChatPanel.tsx`, `src/components/Sidebar.tsx`, and `src/components/SubAgentTracker.tsx`: controls that open Agent detail now describe opening or focusing the right-hand inspector without claiming ownership of cross-component inspector DOM. Browser/live proof remains pending.
- Improved right-hand inspector region semantics in `src/components/AgentFocusPanel.tsx` and `src/components/SubAgentTracker.tsx`: Agent detail now identifies as a complementary inspector region, and embedded Agent Work identifies as run-detail content. Browser/live proof remains pending.
- Improved Agent detail current-step semantics in `src/components/SubAgentTracker.tsx`: running/blocked cards now expose the current run step as a polite labelled status. Browser/live proof remains pending.
- Improved Agent detail metadata semantics in `src/components/SubAgentTracker.tsx`: metadata chips now expose a grouped label for model/provider/artifact/duration/token/context trust signals. Browser/live proof remains pending.
- Improved Agent detail replay event semantics in `src/components/SubAgentTracker.tsx`: replay events now expose as a labelled list, and event rows expose title/detail labels as list items. Browser/live proof remains pending.
- Improved Agent detail steering group semantics in `src/components/SubAgentTracker.tsx`: steering sections and available steering actions now expose labelled groups for the selected run/phase. Live steering proof remains pending.
- Improved Agent detail steering-note grouping in `src/components/SubAgentTracker.tsx`: note input and Add note control now expose as one labelled intervention group. Live steering proof remains pending.
- Improved inactive-steering explanations in `src/components/SubAgentTracker.tsx`: completed/failed run steering guidance now announces as a polite status while pointing users to replay/proof filters. Live steering proof remains pending.
- Improved Agent detail replay filter current-state semantics in `src/components/SubAgentTracker.tsx`: selected replay filters now expose current state in addition to pressed state. Browser/live proof remains pending.
- Improved agent work status badge labelling in `src/components/SubAgentTracker.tsx` and `src/components/Sidebar.tsx`: inspector and left run statuses now expose direct run/phase status context. Browser/live proof remains pending.
- Improved Agent detail list metadata semantics in `src/components/AgentFocusPanel.tsx`: list-row token and duration chips now expose a grouped label. Browser/live proof remains pending.
- Improved Agent detail list status glyph semantics in `src/components/AgentFocusPanel.tsx`: status glyphs now expose direct status labels while pulse/icon visuals remain decorative. Browser/live proof remains pending.
- Improved left run metadata semantics in `src/components/Sidebar.tsx`: run rows now expose model/provider/elapsed time as a grouped metadata label. Browser/live proof remains pending.
- Improved left run proof cue semantics in `src/components/Sidebar.tsx`: run proof/artifact cues now expose as grouped labels using the proof label and value. Browser/live proof remains pending.
- Improved left run current-task labelling in `src/components/Sidebar.tsx`: run task lines now expose direct `Current task` labels. Browser/live proof remains pending.
- Improved left run intervention cue labels in `src/components/Sidebar.tsx`: attention and steerable markers now expose run-specific labels. Browser/live steering proof remains pending.
- Improved left phase metadata semantics in `src/components/Sidebar.tsx`: compact phase rows now expose provider/model/proof/status/time/task context as a grouped label. Browser/live proof remains pending.
- Corrected left run row control semantics in `src/components/Sidebar.tsx`: run rows no longer claim `aria-controls` ownership over phase groups because they open Agent detail rather than expanding/collapsing the phase list. Browser/live proof remains pending.
- Improved left active-work group labelling in `src/components/Sidebar.tsx`: active run trees now expose as `Active work for {chat title}` groups under the owning chat. Browser/live proof remains pending.
- Improved left active-work list semantics in `src/components/Sidebar.tsx`: active work under the selected chat now exposes as a labelled list, with each run group as a list item. Browser/live proof remains pending.
- Improved left run phase-list semantics in `src/components/Sidebar.tsx`: phase containers now expose as labelled lists, and individual phase rows expose as list items. Browser/live proof remains pending.
- Improved left phase detail region labelling in `src/components/Sidebar.tsx`: expanded phase detail panels now expose as labelled regions tied to the phase name. Browser/live proof remains pending.
- Corrected Agent detail card labels in `src/components/SubAgentTracker.tsx`: passive card groups now describe the run/phase instead of saying `Focus`; explicit focus controls remain separate. Browser/live proof remains pending.
- Improved left project chat-list semantics in `src/components/Sidebar.tsx`: project chat containers now expose as labelled lists, with each chat/session row as a list item. Browser/live proof remains pending.
- Improved left pane navigation landmark semantics in `src/components/Sidebar.tsx`: the sidebar now identifies as project/chat navigation, and its panel controls sit in a labelled Sidebar panels group. Browser/live proof remains pending.
- Improved left pane content-region semantics in `src/components/Sidebar.tsx`: sidebar panel content now exposes as a labelled region beneath the Sidebar panels controls. Browser/live proof remains pending.
- Corrected active-work detail-opening semantics in `src/components/ChatPanel.tsx`, `src/components/Sidebar.tsx`, and `src/components/SubAgentTracker.tsx`: controls no longer claim `aria-haspopup="dialog"` because they open/focus the right-hand inspector rather than an ARIA dialog. Browser/live proof remains pending.
- Improved chat active-work detail labelling in `src/components/ChatPanel.tsx`: the active-work strip now says `Agent detail`, and its title/accessibility label match the right-hand inspector destination. Browser/live proof remains pending.
- Improved Agent detail picker list semantics in `src/components/AgentFocusPanel.tsx`: the picker now exposes as a labelled list, with each selectable agent row inside a list item while preserving explicit selection buttons. Browser/live proof remains pending.
- Improved Agent detail replay empty-scope copy in `src/components/SubAgentTracker.tsx`: filtered-empty replay states now name the selected replay scope. Browser/live proof remains pending.
- Improved Agent detail replay filter labels in `src/components/SubAgentTracker.tsx`: each replay filter now includes the number of matching events it would show. Browser/live proof remains pending.
- Improved Agent detail replay filter visible counts in `src/components/SubAgentTracker.tsx` and `src/styles/components.css`: replay filters now show compact event-count chips while preserving count-aware accessible labels. Browser/live proof remains pending.
- Improved active replay filter count styling in `src/styles/components.css`: selected filter count chips now inherit active styling for readability. Browser/live proof remains pending.
- Improved replay count-chip titles in `src/components/SubAgentTracker.tsx`: visible replay filter counts now expose pointer titles while remaining hidden from assistive tech because parent labels already include counts. Browser/live proof remains pending.
- Improved replay filter label/count alignment in `src/styles/components.css`: replay filter buttons now use inline-flex alignment so labels and count chips read as one compact control. Browser/live proof remains pending.
- Improved Environment active-work metadata semantics in `src/components/EnvironmentRail.tsx`: current task, model/provider, and latest artifact/proof cue now expose as a grouped label. Browser/live proof remains pending.
- Improved Environment active-work title semantics in `src/components/EnvironmentRail.tsx`: the progress title remains a plain visible workflow label while the surrounding active-work container owns the polite progress status. Browser/live proof remains pending.
- Improved chat active-work metadata semantics in `src/components/ChatPanel.tsx`: current task, model/provider, and latest artifact/proof cue now expose as a grouped label. Browser/live proof remains pending.
- Improved chat active-work title semantics in `src/components/ChatPanel.tsx`: the strip title remains a plain visible workflow label while the surrounding strip host owns the polite progress status. Browser/live proof remains pending.
- Improved chat active-work progress semantics in `src/components/ChatPanel.tsx`: the strip host now announces as a polite active-work progress status surface. Browser/live proof remains pending.
- Improved Environment active-work progress semantics in `src/components/EnvironmentRail.tsx`: the active-work card now announces as a polite active-work progress status surface. Browser/live proof remains pending.
- Improved Agent detail objective labelling in `src/components/SubAgentTracker.tsx`: task text now exposes as an `Agent objective` label with a no-objective fallback. Browser/live proof remains pending.
- Improved Agent detail status summary in `src/components/AgentFocusPanel.tsx`: header stats now include waiting agents visibly and in the summary label, matching the kickoff status model. Browser/live proof remains pending.
- Aligned Agent detail failed-status wording in `src/components/AgentFocusPanel.tsx`: header stats now say `failed` instead of `errored`, matching the kickoff status model. Browser/live proof remains pending.
- Aligned Agent detail picker status wording in `src/components/AgentFocusPanel.tsx`: row labels and status glyph labels now map raw `idle`/`error` states to `waiting`/`failed`. Browser/live proof remains pending.
- Improved Agent detail picker objective labelling in `src/components/AgentFocusPanel.tsx`: picker row task text now exposes as an `Agent objective` label, matching the selected detail card. Browser/live proof remains pending.
- Added Agent detail picker provider/model visibility in `src/components/AgentFocusPanel.tsx` and `src/styles/components.css`: picker rows now show a compact provider/model line below the objective with direct labels. Browser/live proof remains pending.
- Reconciled stale active-work inspector wording in `docs/proof/2026-06-16-premier-harness-closeout.md` and `NEXT_SESSION.md`: older `dialog-style` text now matches the current right-hand inspector semantics. Browser/live proof remains pending.
- Reconciled stale Agent detail status wording in `docs/proof/2026-06-16-premier-harness-closeout.md`: older `errored` summary text now matches the current `failed` status vocabulary. Browser/live proof remains pending.
- Cleaned up duplicate active-work status semantics in `src/components/ChatPanel.tsx` and `src/components/EnvironmentRail.tsx`: outer progress containers remain polite status surfaces while inner workflow titles are plain visible labels. Browser/live proof remains pending.
- Improved calm-chat details affordance in `src/components/MessageBubble.tsx`: assistant message details stay collapsed behind the quiet `Details` control, and the control now summarizes hidden surfaces such as tool details, confidence, team plan, prompt microscope, or next actions for assistive navigation. Browser/live proof remains pending.
- Improved calm streaming-thinking behavior in `src/components/MessageBubble.tsx` and `src/styles/components.css`: streaming thinking now stays as a compact status line, and inline thinking preview text no longer appears in the main chat body by default. Browser/live proof remains pending.
- Improved Agent detail replay proof summary in `src/components/SubAgentTracker.tsx`: replay summaries now distinguish validation-proof artifacts from general artifacts and show context-file counts from repo map/context pack events. Browser/live proof remains pending.
- Improved Agent detail file-evidence wording in `src/components/SubAgentTracker.tsx`: repo-map and context-pack replay events now read as `Repo files surfaced` and `Files in context`, with short surfaced/context file lists in the event detail. Browser/live proof remains pending.
- Improved Agent detail replay navigation in `src/components/SubAgentTracker.tsx`: replay filters now include a `Files` scope covering repo-map, context-pack, and artifact events so file/context/proof evidence is directly inspectable. Browser/live proof remains pending.
- Improved calm suggested-action behavior in `src/components/NextBestActions.tsx`: expanded next actions now include a `Collapse` control so users can return to the compact `Actions` affordance without dismissing actions entirely. Browser/live proof remains pending.
- Refined calm suggested-action styling in `src/components/NextBestActions.tsx` and `src/styles/components.css`: the expanded `Collapse` control now has dedicated quiet text-button styling, keeping it visually distinct from the dismiss control. Browser/live proof remains pending.
- Improved onboarding theme texture transparency in `src/components/OnboardingWizard.tsx` and `src/styles/components.css`: first-run theme cards now show texture recipe/default opacity, and theme selection labels include texture metadata before setup completes. Browser proof remains pending.
- Improved onboarding theme-card accessibility in `src/components/OnboardingWizard.tsx`: trailing theme icons are decorative while the button label carries theme name, texture metadata, and active state. Browser proof remains pending.
- Improved onboarding theme-heading accessibility in `src/components/OnboardingWizard.tsx`: the `Pick a theme` heading icon is decorative while the text remains the accessible step label. Browser proof remains pending.
- Improved onboarding theme-group semantics in `src/components/OnboardingWizard.tsx`: dark and light theme sections now expose as labelled groups around their texture-aware theme buttons. Browser proof remains pending.
- Improved Model Lab tab proof labels in `src/components/ModelLabPanel.tsx`: visible tab names remain short, while tab labels now point to provider-call proof prep, proof review/exports, pack evidence exports, rankings, and saved proof history. Browser/provider proof remains pending.
- Improved Model Lab proof-review controls in `src/components/ModelLabPanel.tsx`: review-note fields now have direct labels, and proof-review buttons explain approved/needs-attention/unreviewed trust consequences with explicit non-submit button semantics. Browser/provider proof remains pending.
- Improved Model Lab proof-review structure in `src/components/ModelLabPanel.tsx`: proof-review callouts now expose as labelled groups, and their readiness checklist exposes as a labelled list. Browser/provider proof remains pending.
- Simplified Model Lab proof-review group labelling in `src/components/ModelLabPanel.tsx`: proof-review groups now use a direct label instead of relying on a title-derived DOM id/helper. Browser/provider proof remains pending.
- Improved Model Lab proof-review state announcements in `src/components/ModelLabPanel.tsx`: review state now exposes as a polite status so approved/needs-attention/unreviewed changes can be announced. Browser/provider proof remains pending.
- Improved Model Lab proof-review action grouping in `src/components/ModelLabPanel.tsx`: approved, needs-attention, and clear-review buttons now expose as one `Proof review actions` group. Browser/provider proof remains pending.
- Improved Model Lab proof-review note clarity in `src/components/ModelLabPanel.tsx`: proof-review note fields now show a visible `Proof review note` label instead of relying on placeholder text alone. Browser/provider proof remains pending.
- Improved Model Lab proof-review note label association in `src/components/ModelLabPanel.tsx`: the visible `Proof review note` label now wraps the textarea, avoiding placeholder-only labelling and generated-id helper dependencies. Browser/provider proof remains pending.
- Improved Routing Learning trusted-apply labels in `src/components/RoutingLearningPane.tsx`: bulk apply now states it applies approved-proof recommendations only and skips unapproved recommendations, while individual recommendation apply buttons expose approved/manual/blocked proof state. Browser/provider proof remains pending.
- Improved Routing Learning evidence action labels in `src/components/RoutingLearningPane.tsx`: export/import/refresh controls are explicit non-submit buttons, Markdown vs JSON exports are distinguished, and benchmark import exposes pressed state plus benchmark-mode context. Browser/provider proof remains pending.
- Improved Routing Learning evidence action icon semantics in `src/components/RoutingLearningPane.tsx`: export/import/refresh icons are decorative while explicit button labels carry the evidence-action meaning. Browser/provider proof remains pending.
- Improved Routing Learning recent-decision filter controls in `src/components/RoutingLearningPane.tsx`: needs-notes, stale-only, fallback, and benchmark filters now expose pressed state plus count-aware enable/disable labels, and Clear filters has a direct Routing Learning label. Browser/provider proof remains pending.
- Improved Routing Learning route-note labels in `src/components/RoutingLearningPane.tsx`: recent-decision note inputs now expose direct labels tied to the selected route model instead of relying on placeholder text alone. Browser/provider proof remains pending.
- Improved Routing Learning route-note control grouping in `src/components/RoutingLearningPane.tsx`: recent-decision note inputs and `Save note` controls now expose as one note-control group per selected route model, while outcome marking remains separate. Browser/provider proof remains pending.
- Improved Routing Learning route-review button semantics in `src/components/RoutingLearningPane.tsx`: note-save and outcome-marking controls are explicit non-submit buttons, and Save note controls include route-model-specific labels. Browser/provider proof remains pending.
- Improved Routing Learning route-outcome action grouping in `src/components/RoutingLearningPane.tsx`: worked, failed, and unclear outcome buttons now expose as one route-model-specific action group separate from note persistence. Browser/provider proof remains pending.
- Improved Routing Learning decorative icon semantics in `src/components/RoutingLearningPane.tsx`: explanatory and route-status icons are decorative while text/status labels carry the evidence-review meaning. Browser/provider proof remains pending.
- Improved Routing Learning route-outcome button labels in `src/components/RoutingLearningPane.tsx`: worked, failed, and unclear actions now include the selected route model in their accessible labels. Browser/provider proof remains pending.
- Improved Routing Learning candidate-score semantics in `src/components/RoutingLearningPane.tsx`: latest and per-route candidate score chips now expose as labelled lists with individual score items, strengthening `why this model` evidence. Browser/provider proof remains pending.
- Improved Routing Learning route-margin labelling in `src/components/RoutingLearningPane.tsx`: selected-vs-alternative margin summaries now expose model-specific comparison labels. Browser/provider proof remains pending.
- Improved Routing Learning route-trace context grouping in `src/components/RoutingLearningPane.tsx`: decision type, classifier, cache/fallback, dataset kind, and timestamp metadata now expose as one route-model-specific context group. Browser/provider proof remains pending.
- Improved Routing Learning route-decision row grouping in `src/components/RoutingLearningPane.tsx`: recent route rows now expose as route-decision groups naming the selected model and current outcome state. Browser/provider proof remains pending.
- Improved Routing Learning route-summary context in `src/components/RoutingLearningPane.tsx`: selected model, task type, role, complexity, and score now expose as one route summary group before trace/margin/score/note controls. Browser/provider proof remains pending.
- Improved Routing Learning trust metric strip labelling in `src/components/RoutingLearningPane.tsx`: reviewed outcomes, observed success, note coverage, evidence age, and approved eval-proof recommendation counts now expose as one trust snapshot. Browser/provider proof remains pending.
- Improved Phase 6 budget/rate-limit warning semantics in `src/components/SettingsModal.tsx`: Model Budgets and Provider Rate Limits now expose missing-rule/loading/save status, labelled rule lists, direct threshold/action labels, unknown model/provider alerts, and labelled rolling usage/event status before expensive provider work. Browser/provider proof remains pending.
- Improved provider health badge trust labels in `src/components/SettingsModal.tsx`: never-probed, probing, stale, failed, and healthy states now expose direct labels with probe count, latency/capability pass count, or latest error context, while probe/loading icons are decorative. Browser/provider proof remains pending.
- Improved Model Library capability scorecard semantics in `src/components/SettingsModal.tsx`: search/category/My Models filters now expose direct labels and pressed states, the library summary announces catalog/provider counts, and each model card exposes provider/category/access, harness-fit, cost/context/tool/vision metrics, fit reasons, strengths, weaknesses, comparisons, and benchmark evidence as structured trust context. Browser/provider proof remains pending.
- Improved Auto-Router candidate capability card semantics in `src/components/SettingsModal.tsx`: candidates now expose as a labelled list with model-specific source/cost/capability/classifier/default/eval-proof context, badge evidence items, grouped capability controls, and capability-card prompts for strengths, weaknesses, and safest task fit. Browser/provider proof remains pending.
- Improved Prompt Microscope router-decision explanation semantics in `src/components/PromptMicroscope.tsx`: Auto-Router and heuristic route evidence now expose as labelled decision groups, candidate scores expose as a ranked selected-vs-rejected alternatives list, the microscope toggle exposes expanded state, and debug export is run-specific. Browser/provider proof remains pending.
- Improved Patch Review validation proof gate labels in `src/components/PatchReviewPanel.tsx`: release workflow now exposes proposal id, validation-command count, commit availability, state-specific generate/validate/commit action labels, passed/bypassed/failed validation status or alert semantics, and a direct generated-message label. Browser/live validation proof remains pending.
- Improved Artifact Drawer proof review unit semantics in `src/components/ArtifactDrawer.tsx`: expanded artifacts now expose as a labelled review list, each item announces type/review state/content length, review actions are grouped per artifact, approve/revision/revise/copy labels describe persistence and note use, and truncated previews are labelled. Browser/live artifact proof remains pending.
- Improved Team Plan artifact proof handoff semantics in `src/components/MessageBubble.tsx`: team-plan cards now announce participant/completion/phase/validation counts, Revise/Execute labels explain preservation and validation-proof expectations, and recommendation, participants, phases, validation, risks, and deltas expose as labelled proof-handoff groups. Browser/live Planning Room proof remains pending.
- Recorded post-commit server/runtime relaunch proof in `docs/proof/2026-06-16-premier-harness-closeout.md`: `npm start` relaunched OpenHarness and `3001`, `5173`, and `/api/config` each returned `200`; Docker MCP noted Docker Desktop was not running. Lint/build/browser/provider proof remains pending.
