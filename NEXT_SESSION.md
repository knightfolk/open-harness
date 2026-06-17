# Next Session — Open Issues Handoff

## Identity
You are **Friday**, the AI assistant for OpenHarness. Follow all rules in `AGENTS.md`.

## Repository State

`/Users/kevink/Projects/OpenHarness` on `main`. Latest local work begins the Premier Harness UI and agent-control overhaul from `docs/PREMIER_HARNESS_KICKOFF.md`; check `git status -sb` before assuming remote push state.
- `npm run check:premier-no-spend` — previously passed before the newest artifact-review, calm-chat, active-work, layout-shell, agent-detail, model-harness, theme-texture, review-changes, baseline-manifest, stop-condition-audit, prompt-source-provenance, live-evidence-guard, approval-boundaries, closeout-matrix, restart-scope, and worktree-isolation contract gates were added. The no-spend bundle now includes Phase 5 theme accessibility, Phase 7 prompt/routing memory, Phase 4 execute/proof hygiene, Premier narrow-layout regression, Premier proof-trust regression, Premier steering-contract regression, Premier artifact-review regression, Premier calm-chat regression, Premier active-work regression, Premier layout-shell regression, Premier agent-detail regression, Premier model-harness regression, Premier theme-texture regression, Premier Review Changes regression, Premier baseline-manifest regression, Premier stop-condition-audit regression, Premier prompt-source-provenance regression, Premier live-evidence-guard regression, Premier approval-boundaries regression, Premier closeout-matrix regression, Premier restart-scope regression, and Premier worktree-isolation regression. Rerun `npm run check:premier-no-spend` when final local gates are in scope.
- Runtime restart hygiene now includes duplicate Electron-window prevention:
  `scripts/start.mjs` quits stale OpenHarness desktop shells before launch, and
  `electron/main.cjs` enforces a single-instance lock. The launcher also cleans
  up Electron, server, and Vite on both interrupt and terminate signals.

## Current Top Priority

Use `docs/PREMIER_HARNESS_KICKOFF.md` as the source of truth for the current overhaul. The product direction is chat-first by default, active agent work visible where users already look, right-hand detail only when selected, one Review Changes flow, quiet message chrome, and steering controls that write structured run-trace events.

Keep `docs/UI_CLEANUP_PLAN.md` as the detailed declutter reference, `docs/HARNESS_WORK_ROADMAP.md` as the broader capability roadmap, and `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` as the reusable closeout checklist for proof runs, manual UI review, runtime scenario proof, and final validation gates.

Closeout evidence should name durable proof artifacts directly. The `Premier Harness Closeout Evidence` template now asks for proof artifact paths, screenshot/artifact paths, runtime trace/export paths, and gate log/artifact paths so final acceptance evidence is findable outside chat.

## Active run start (from this handoff)

- Objective for this turn: continue from `docs/PREMIER_HARNESS_KICKOFF.md` by moving into the first unresolved Phase 7 closeout action and collecting evidence-backed status updates.
- Next minimal action: execute the proof-readiness suite for prompt/routing memory and then update closeout evidence with real routing-learning outcomes and any real session-based recovery examples.
- If no new tool-error sessions exist yet, record that gap explicitly and proceed to the next slice without marking routing-memory claims as complete.
- Keep runtime/process restart actions to runtime-required paths only; this slice is currently docs/tests aligned.

## Last executed proof status (2026-06-17)

- Executed: `npm run test:prompt-routing-memory`
- Result: all included checks passed.
- Latest refreshed after commit `a40f0a1 Track log-derived tool error recovery`, including the new log-derived tool-error ledger regression coverage.
- Session evidence gap: no live `tool-error-ledger.jsonl` entries exist yet under `~/.openharness/router-learning`, so Recovery evidence is still proof-backed by fixtures/synthetic traces and the new reconstructed `log_trace` ledger test until a real run produces live rows.
- Follow-up action: run one provider-backed or staged live tool-error scenario, then record the resulting session/run breadcrumbs and retry-distance rows in closeout evidence.

## Latest Phase 7 Add-on — Prompt Strategy And Routing Memory

Phase 7 now treats prompt strategy and tool reliability as first-class routing
evidence instead of static prompt prose. Current implemented state:

- `server/promptStrategies.ts` defines versioned prompt profiles for major model
  families plus role/task variants.
- Prompt assembly traces record selected strategy id, family/style, output
  contract, role/task variant, and selection reason.
- Prompt Microscope, Model Lab, Routing Learning, and proof exports expose
  prompt strategy metadata.
- Model Lab supports same-model/same-task prompt strategy comparisons behind
  the existing provider-spend guard.
- Tool-call run traces preserve model, provider, tool, round, status, duration,
  and error text.
- `server/toolReliability.ts` aggregates tool reliability by model, provider,
  tool, model/tool pair, prompt strategy, and strategy variant.
- Routing Learning shows/export tool reliability, first-call failure rates,
  recovery rounds, recovery patterns, failure memory, and prompt-strategy
  failure context.
- Session outcome mining now connects tool-call errors to the later working
  model/tool/prompt path, final-answer-only recovery, unrecovered abort, or
  unknown running state so routing can reduce first-call mistakes and retry
  loops.
- Saved sessions and log-derived traces should be treated as retry-reduction
  evidence: compare the failing first tool call with the model/tool/prompt path
  that ultimately worked, keep the retry distance, and feed that back into
  candidate cards and prompt contracts before adding more retries.
- Tool-error outcome examples, recovery examples, recent errors, recovery
  patterns, failure memory, and normalized signatures now preserve an explicit
  evidence source (`saved_session_trace`, future `log_trace`, or
  `imported_trace`) so Routing Learning exports and Auto-Router candidate cards
  can distinguish saved-session proof from future log-derived proof.
- Tool reliability now derives retry-reduction recommendations from saved
  outcomes: each row names the failed first model/tool path to avoid, the later
  working model/tool path to prefer when present, retry distance, evidence
  source, and session/run breadcrumbs. Routing Learning UI/Markdown exports and
  Auto-Router candidate-card annotations expose those avoid/prefer rows.
- Retry-reduction recommendations now carry source-aware tuning guidance:
  `saved_session_trace` maps to `tune_local_router`, `log_trace` maps to
  `review_before_tuning`, and `imported_trace` maps to `context_only`.
- Retry-reduction recommendations now also carry support run count and
  confidence (`single_trace` or `repeated_trace`) so one-off recoveries do not
  look as strong as repeated avoid/prefer patterns.
- Retry-reduction recommendations now preserve supporting session/run id arrays
  so repeated recommendations can be traced back to the saved runs that support
  the collapsed avoid/prefer row.
- Deduplicated retry-reduction recommendations now also carry average retry
  distance across supporting runs, so repeated recommendations show the typical
  recovery cost rather than only the latest example.
- Matching retry-reduction outcomes are de-duplicated by evidence source,
  failed first path, and preferred later path; repeated runs strengthen one
  recommendation instead of creating duplicate recommendation rows.
- Settings > Auto-Router candidate rows now expose the same avoid/prefer
  retry-reduction recommendation, with evidence source, session/run breadcrumbs,
  and a model-specific accessibility label, so manual router tuning sees the
  same proof the classifier sees.
- Settings > Auto-Router also shows a tool-error evidence-source summary before
  the candidate list, so manual candidate-card/cost tuning starts from the
  saved-session, imported, or future log-derived source mix.
- Routing Learning now also summarizes tool-error evidence by source, counting
  outcome runs, recovered/unrecovered runs, retry-reduction recommendations, and
  average retry distance for saved-session traces, imported traces, and future
  log-derived traces.
- Routing Learning import preview now detects tool-reliability summaries inside
  imported evidence bundles, labels them as `imported_trace`, shows their counts
  before approval, and keeps them preview-only rather than silently merging them
  into local routing state.
- After import, Routing Learning status now repeats when a tool-reliability
  summary was preview-only `imported_trace` evidence and was not merged, so the
  safety boundary remains visible after approval.
- Tool-call errors are now grouped into normalized per-model/provider/tool error
  signatures, with recovered/unrecovered counts and the later model/tool path
  that actually worked. This gives routing a sharper signal than broad error
  counts when reducing retries.
- Client API types now preserve `toolReliability.errorSignatures`, and the
  Premier model-harness guard protects normalized signature rows, session
  outcome rows, retry distance, and example run ids so future UI/export work
  does not accidentally drop the failure-memory contract.
- Routing Learning now has a dedicated normalized tool-error signature section
  and matching Markdown export lines, showing failed model/tool/signature,
  recovered and unrecovered counts, prompt variant context, later working path,
  retry distance, and example run ids when saved traces contain them.
- `scripts/test-premier-model-harness.ts` now guards the normalized signature
  UI section, Markdown export heading, worked-by average retry distance, and
  example run-id evidence so this retry-reduction loop stays visible.
- Routing Learning session outcome, recovery-path, and recent tool-error rows
  now surface session/run ids directly, including in Markdown evidence, so
  future reviewers can inspect the saved session/log trail for what ultimately
  worked.
- Tool failure memory and normalized tool-error signatures now include bounded
  `exampleSessionIds` beside `exampleRunIds`, giving compact failure rows a
  direct saved-session lookup path.
- Recurring tool-call recovery patterns also include bounded
  `exampleSessionIds`, and Routing Learning rows/Markdown exports show those
  session ids beside run ids for repeated failure-to-working-path evidence.
- Recovery-pattern session ids are merged into compact model failure-memory
  rows too, so either view keeps a saved-session breadcrumb for log/session
  inspection.
- Routing Learning export regression fixtures now include recovery patterns,
  failure memory, and normalized error signatures with `exampleSessionIds`,
  `exampleRunIds`, and retry-distance evidence, so offline evidence bundles
  preserve the same lookup trail as the UI.
- Routing Learning import regression coverage now confirms a full export with
  enriched `summary.toolReliability` breadcrumb evidence still previews/imports
  routing events cleanly.
- Auto-Router tool-reliability candidate-card annotations now include compact
  example session/run breadcrumbs for recovery patterns, failure memory,
  session outcomes, and normalized signatures, giving classifier-side routing
  evidence the same saved-session lookup trail as Routing Learning.
- Settings > Auto-Router candidate rows also include session/run breadcrumbs in
  recent recovery path text, so manual candidate tuning and classifier evidence
  point to the same saved run proof.
- Settings > Auto-Router also labels those breadcrumbs as `Recovery proof:
  session ..., run ...` for quick visual inspection.
- That Recovery proof text also has a model-specific accessibility label with
  the same session/run ids and Auto-Router context for manual assistive-tech
  proof.
- The Phase 7 checklist requires manual proof of both the visible Recovery
  proof text and its model-specific accessibility label.
- The Phase 7 checklist asks the manual Settings > Auto-Router proof pass to
  confirm that exact `Recovery proof: session ..., run ...` label when recovery
  evidence exists.
- The phase-mapped checklist now includes `Phase 7 tool-error breadcrumb
  evidence`, covering Routing Learning UI/exports, Auto-Router Settings, and
  classifier-side candidate-card annotations.
- The Phase 7 closeout checklist now requires both classifier-side
  candidate-card breadcrumbs and Settings-side candidate-row recovery
  breadcrumbs before routing-memory proof can close.
- `docs/PREMIER_HARNESS_KICKOFF.md` now includes Settings Auto-Router
  candidate-row saved-session breadcrumbs in the Phase 7 stop condition, and
  `test:premier-stop-condition-audit` preserves that source-of-truth wording.
- The kickoff Stop Condition and paste-ready goal prompt now explicitly include
  tool-error memory, saved session/run breadcrumbs, retry distance, and later
  working path requirements for routing/model-harness evidence.
- The Premier model-harness guard now reads `server/autoRouter.ts` and checks
  that classifier candidate-card annotations keep those session/run breadcrumb
  strings.
- Prompt Microscope now shows the latest worktree isolation lifecycle event,
  so preserved or auto-discarded state is visible instead of the initial ready
  event when inspecting a run.
- Auto-Router candidate cards are rebuilt from normalized baseline candidates at
  route time, adding current eval and tool-reliability evidence without stacking
  duplicate annotations.
- Auto-Router state, Settings, Routing Learning, and exports show candidate
  evidence refresh time/count so reviewers can tell whether classifier evidence
  is fresh.

Remaining Phase 7 proof gap: saved local sessions currently do not contain
populated real-world failure-memory/recovery-pattern rows, so the code paths are
regression-tested but live evidence remains empty until future tool-error runs
are persisted. Provider-backed Model Lab strategy comparisons still require
explicit budget approval before they can be used as closeout evidence.
When live tool-error rows appear, use the saved session/log trail to confirm
which route actually recovered and whether the first error can be avoided on the
next comparable task.
Check that the evidence-source tag matches the trail being inspected before
using a row to tune candidate cards or prompt contracts.
Use retry-reduction recommendations as the first tuning surface, then inspect
the raw outcome/signature/failure-memory row if the avoid/prefer advice needs
more context.
Use the evidence-source summary before acting on recommendations so it is clear
whether the advice is based on current saved sessions, imported bundles, or
future log-derived traces.

Use `npm run test:prompt-routing-memory` for the no-spend Phase 7 proof bundle.
It covers kickoff prompt/routing readiness, P0 output normalization, prompt
strategy profiles, Routing Learning prompt-strategy outcome persistence, tool
reliability, Routing Learning export/import schema proof, and Auto-Router
context/candidate evidence behavior.

Use `npm run test:premier-no-spend` for the current no-provider automated
baseline. It runs the Phase 5 theme accessibility bundle, the Phase 7
prompt/routing-memory bundle, Phase 7 tool-error breadcrumb evidence, Phase 4
execute/proof hygiene, and the Premier narrow-layout, proof-trust,
steering-contract, artifact-review, calm-chat, and active-work, layout-shell,
agent-detail, model-harness, and theme-texture regressions, plus Review
Changes, baseline-manifest, and stop-condition audit, plus prompt-source
provenance, before any manual/browser or provider-backed proof.
Use `npm run check:premier-no-spend` when the no-provider baseline should also
include lint and build.

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
- Strengthened theme accessibility gates in `src/styles/components.css`, theme tests, and `package.json`: `test:theme-accessibility` covers built-in contrast, reduced transparency, and reduced motion; `check:premier-no-spend` includes that bundle plus Phase 7 routing-memory, lint, and build. Browser/manual reduced-transparency and reduced-motion confirmation remain pending.
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
  `Provider-backed proof run approval needed. Planned calls: Eval proof yes, 1 prompt x 1 model; Same-model prompt strategy comparison optional, 1 prompt x 1 model x 2 strategies; Bench proof yes, 1 task x 1 model; Runtime scenarios: Planning Room plus one execute or investigate run with durable runtime trace/export paths for Planning Room, execute-or-investigate, and steering-event evidence. Purpose: capture closeout evidence for docs/PREMIER_HARNESS_PROOF_CHECKLIST.md. Please choose: 1. Approve smallest proof runs only. 2. Approve eval proof plus same-model prompt strategy comparison. 3. Approve eval proof only. 4. Approve bench proof only. 5. Do not run provider-backed proof yet.`
- Paste-ready final-gate approval prompt:
  `Final closeout gates need approval before running local validation. Planned command: npm run check:premier-no-spend. Optional full hardening only if server/runtime, provider, security, routing, import/export, or budget logic changed again. Save durable gate log/artifact paths for each command that runs. If server/runtime code changed, also save restart/reachability proof for 3001, 5173, /api/config, and the duplicate Electron/process-shape check. Purpose: capture final gate evidence for docs/PREMIER_HARNESS_PROOF_CHECKLIST.md. Please approve: 1. Run premier no-spend check only. 2. Run premier no-spend check and save durable gate logs. 3. Run premier no-spend check plus full hardening and save durable gate logs. 4. Do not run final gates yet.`
- Paste-ready browser/manual proof approval prompt:
  `Browser/manual proof pass approval needed. Planned checks: refreshed desktop/narrow chat-first shell with durable screenshot or DOM-note artifact paths; Model Lab History cap; Agent Roles proof-trust callout; Theme reduced-transparency copy; artifact drawer Show full/Collapse; Review Changes proof-save-to-chat if a safe validation result is available. Purpose: refresh direct UI evidence in docs/proof/2026-06-16-premier-harness-closeout.md. Please approve: 1. Run browser/manual proof pass. 2. Run browser/manual proof pass and save durable screenshot/DOM-note artifacts. 3. Limit to no-provider UI checks only. 4. Do not run browser/manual proof yet.`
- Treat stale, indirect, ambiguous, or partial evidence as not complete; refresh or continue from the missing checklist item.
- Use the checklist's final-gate decision rules before running `npm run check:premier-no-spend`, `npm run test:hardening`, or another documented scoped substitute.

Proof execution checklist:
- Model Lab Eval: use `Prepare smallest eval proof`, run the prepared 1x1 eval, open Results, save a proof review decision, export proof brief and recommendation report, and confirm Routing Learning treats only approved proof as trusted.
- Model Lab Bench: use `Prepare proof run` only if provider budget allows, run the prepared 1x1 bench, open Bench results, save a proof review decision, export proof brief and JSON, and confirm rankings are not trusted until approved.
- Manual UI: check desktop and narrow widths for chat-first layout, left work queue, right Agent detail, Settings → Routing Learning, Model Lab Results/Bench/History, and theme texture readability.
- Runtime scenarios: run one Planning Room request and one execute/investigate request to prove active phases appear under the owning thread, detail remains inspectable, and steering notes are recorded.
- Final gates: after proof/manual checks are captured, run `npm run check:premier-no-spend` and any additional hardening needed for touched server/runtime code.

## Premier Harness Kickoff Acceptance Audit — Current State

This is the current evidence-backed status against `docs/PREMIER_HARNESS_KICKOFF.md`. Treat this as a working audit, not a completion claim.

| Area | Current status | Remaining proof or work |
| --- | --- | --- |
| Phase 0 source of truth | Mostly implemented. `NEXT_SESSION.md`, `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md`, `docs/UI_CLEANUP_PLAN.md`, and `docs/HARNESS_WORK_ROADMAP.md` point at the Premier Harness kickoff direction. | No validation needed beyond doc review. |
| Phase 1 chat-first / remove layout bloat | Mostly implemented. Default layout and tool menus are chat-first and the permanent `sub-agents` split is hidden. Legacy novelty surfaces were removed. Targeted search found no panel/rail drag-drop handlers in `src/types/layout.ts`, `LayoutEngine`, `PanelWrapper`, `EnvironmentRail`, or `TopBar`; remaining `drag` CSS hits are native window-drag regions. | Browser desktop/narrow visual check still needed before calling this done. |
| Phase 2 agent work model | Partially implemented. Active work appears in chat, left project/session tree, Environment rail, and `AgentFocusPanel`; left rows show artifact/proof and steering cues. | Needs live Planning Room and execute/investigate runs to prove phases appear under the owning thread and remain inspectable after completion. |
| Phase 3 right-hand detail and steering | Partially implemented. Agent detail exists, structured steering calls flow through the existing run-steering API, and steering controls are gated by state/artifact availability. | Needs live multi-phase run proof that steering notes are recorded and consumed by the next safe phase. Pause/cancel runtime semantics still need careful server-side audit before claiming complete. |
| Phase 4 calm chat and artifact review | Mostly implemented. Diagnostics are hidden behind `Details`; artifacts, comparison artifacts, replay export, replay summary, and validation proof are visible without flooding chat. Review Changes can save validation proof as a replayable session artifact message, and saved validation proof now carries explicit proof labeling in work/detail surfaces. | Needs manual readable-response checks, team-plan promote/revise checks, patch review checks, and narrow-width layout pass. |
| Phase 5 theme texture layer | Mostly implemented. Texture tokens, schema validation, bounded recipes, built-in subtle examples, settings metadata, opacity override, and grouped `test:theme-accessibility` proof are in place. | Still needs live/browser reduced-transparency/reduced-motion confirmation and broader readability pass across remaining chat/sidebar/settings/code/terminal/diff surfaces. |
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
- Completed approved validation gates and no-provider browser proof: fixed narrow lint/build blockers in `src/components/EnvironmentRail.tsx`, `src/components/ArtifactDrawer.tsx`, `src/components/ChatPanel.tsx`, `src/components/SubAgentTracker.tsx`, `src/components/layout/PanelWrapper.tsx`, and `src/components/ModelLabPanel.tsx`; `npm run lint` passed, `npm run build` passed, and running app checks for `3001`, `5173`, `/api/config`, UI title/root, and config sample passed. Provider-backed eval/bench proof remains pending unless separately approved.
- Added the user-requested prompt-response/routing expansion to the Premier Harness goal: `docs/PROMPT_STRATEGY_DATABASE_PLAN.md` captures current OpenAI, Anthropic, Google Gemini, and Mistral prompt best-practice synthesis; `docs/PREMIER_HARNESS_KICKOFF.md` now includes Phase 7 for prompt response and a versioned prompt strategy database; `docs/MODEL_PROMPTING_GUIDE.md` now calls out the database split between model capability and prompt strategy. Implementation remains pending.
- Started Phase 7 implementation: added `server/promptStrategies.ts` with versioned prompt strategy profiles for OpenAI, Claude, Gemini, Mistral-family, DeepSeek, Qwen, MiniMax, Llama, Gemma, Phi, and unknown/default; `server/promptBuilder.ts` now records the selected strategy in prompt assembly trace data; `server/runTrace.ts` and `src/types/index.ts` type the strategy trace; Prompt Microscope now displays strategy id/style/context/examples/reasoning/output contract when prompt assembly metadata is present. Remaining: strategy-driven prompt construction, routing-learning strategy outcomes, and `test:prompt-strategy-database`.
- Validated and relaunched Phase 7 prompt strategy database start: `npm run lint` passed, `npm run build` passed, `npm start` relaunched OpenHarness, and `3001`, `5173`, and `/api/config` each returned `200`; Docker MCP still notes Docker Desktop is not running.
- Relaunched again after Docker Desktop started: Docker MCP gateway connected successfully with 50 tools, MCP watchdog started, and `3001`, `5173`, and `/api/config` each returned `200`. Later cleanup added `test:theme-contrast`, fixed the built-in theme contrast warnings for charcoal, silver, sage, blush, and system classic high contrast, and removed the `SubAgentTracker` ineffective dynamic-import build warning.
- Advanced Phase 7 prompt strategy behavior: `server/promptBuilder.ts` now translates the selected prompt strategy into small runtime prompt directives for outcome-first prompting, XML/structured boundaries, context ordering, example policy, reasoning policy, tool simplicity, and output contract. Remaining: persist strategy ids into Routing Learning outcomes and add `test:prompt-strategy-database`.
- Added Phase 7 Routing Learning strategy outcome metadata: new auto-router decisions now persist prompt strategy id, strategy family, and strategy style; summary data includes prompt-strategy and strategy-family breakdowns; Routing Learning shows those breakdowns beside task/role/complexity. Remaining: add `test:prompt-strategy-database`.

## Latest prompt/routing evidence handoff - 2026-06-17

- Model Lab eval and bench artifacts now persist per-row prompt strategy traces and proof briefs summarize observed strategies, so prompt-response experiments can separate model behavior from prompt-shape behavior.
- Model Lab eval setup now supports opt-in same-model prompt strategy comparisons: leave strategy selection empty for defaults, or select strategy ids to expand the eval matrix across prompt contracts.
- Eval summaries now aggregate by prompt strategy id, exposing best strategy, score, latency, tool count, run count, family/style, and best model in proof briefs and recommendation exports.
- Prompt strategy profiles now include role/task variants, and prompt assembly traces record variant id, role, task type, and selection reason for coder/tool-proof, reviewer/findings, planner/artifact, summarizer/direct, and reasoner/tradeoff contracts.
- Routing Learning now persists and summarizes prompt strategy variants on auto-router decisions, so reviewed outcomes can distinguish base strategy quality from role/task prompt-contract quality.
- Routing Learning Markdown exports now include prompt strategy variant outcomes and recent decisions include variant-aware strategy keys; import coverage verifies variant metadata survives imported evidence bundles.
- Prompt Microscope now shows prompt strategy variant id, task type, role, tool policy, and selection reason directly in run-trace inspection.
- Routing Learning now exposes best prompt strategy variant signals, ranking variant-aware prompt contracts by reviewed outcome rate and best model evidence.
- Model Lab proof briefs now use variant-aware prompt strategy keys and include task/role context in observed strategy summaries.

- 2026-06-17 Phase 7 continuation: tool reliability includes recovery-path examples from saved run traces, linking first tool-call errors per model to later successful tool calls and final-answer recovery. Use this when tuning auto-router candidates for fewer retries on tool-heavy execute tasks.
- 2026-06-17 Phase 7 continuation: Auto-router candidate cards now ingest saved tool reliability evidence before classifier scoring, including error rate, first-call failures, recovery rate, average recovery rounds, and recent recovery paths. This should reduce repeated tool-call retries by making model/tool failure memory visible to the classifier without silently disabling candidates.
- 2026-06-17 Phase 7 continuation: Auto-Router candidate rows now surface the same tool reliability evidence the classifier receives, including first-call failures and recent recovery paths, so users can tune capability cards/costs from the model/tool path that actually recovered.
- 2026-06-17 Phase 7 continuation: Routing Learning now includes per-model/per-tool reliability buckets, making exact `model / tool` failure patterns visible alongside broad model, provider, and tool aggregates.
- 2026-06-17 Phase 7 continuation: Auto-router classifier candidate cards now include the highest-risk model/tool pairs for each model, so model scoring can account for tool-specific failure patterns instead of only broad model reliability.
- 2026-06-17 Phase 7 continuation: Auto-Router candidate rows now show top risky model/tool pairs beside broad tool reliability and recovery paths, matching the classifier-side model/tool evidence users need when tuning candidate cards.
- 2026-06-17 Phase 7 continuation: Tool reliability now aggregates by prompt strategy and prompt strategy variant when prompt assembly metadata is present, helping separate weak models from weak role/task prompt contracts.
- 2026-06-17 Phase 7 continuation: Auto-router classifier candidate cards now include default prompt-strategy and risky strategy-variant tool reliability for each candidate, so scoring can separate model/tool weakness from prompt-contract weakness.
- 2026-06-17 Phase 7 continuation: Auto-Router candidate rows now display prompt-strategy and risky strategy-variant tool reliability beside model/tool reliability, matching the classifier-side prompt-contract evidence users need when tuning routing.
- 2026-06-17 Phase 7 continuation: Auto-router classifier candidate cards now include provisional prompt-strategy reliability even for newly added models with no exact model-specific tool traces yet, so shared prompt-contract risk can influence scoring early.
- 2026-06-17 Phase 7 continuation: Tool-call errors are now normalized into per-model/provider/tool error signatures, and Auto-router candidate cards include matching signature evidence plus what later worked, so repeated first-tool failures can be avoided or routed to the known recovery path earlier.
- 2026-06-17 Phase 7 continuation: Treat tool-call retries as learnable routing evidence. `test:tool-reliability` now locks saved session/run ids, failed model/provider/tool paths, normalized error signatures, retry distance, and the later model/tool path that worked, so logs and saved sessions can be mined to reduce repeated tool-call errors instead of just retrying harder.
- 2026-06-17 Phase 1/manual UI continuation: live narrow-browser proof found and fixed sidebar/main overlap plus a squeezed 28px composer. Narrow view now auto-closes the sidebar by default at <=640px, leaves the top-bar toggle available, and verifies no overlap, no horizontal overflow, no visible drag/reorder affordances, and a 360px labelled chat textarea in a 433px viewport. `npm run lint` and `npm run build` passed; no server restart was needed because this was client-only.
- 2026-06-17 Phase 1/manual UI continuation: added `test:premier-narrow-layout` and wired it into `test:premier-no-spend`; `npm run check:premier-no-spend` passed with the new gate. The gate now covers chat sidebar/composer behavior, Settings narrow modal stacking, Routing Learning one-column proof grids, Model Library/Model Lab-adjacent one-column grids, and Model Lab/Routing Learning panel minimum sizes. The in-app browser viewport override stopped honoring requested narrow widths during follow-up Settings proof, so broader narrow Settings/Model Lab/Routing Learning live proof remains pending.
- 2026-06-17 Phase 6 trust continuation: added `test:premier-proof-trust` and wired it into `test:premier-no-spend`; `npm run check:premier-no-spend` passed with the new gate. The gate locks Model Lab proof-review controls/exports, Routing Learning trusted-only bulk apply and proof-state exports, and Settings proof-trust labels for approved/manual/blocked recommendation actions.
- 2026-06-17 Phase 3 steering continuation: added `test:premier-steering-contract` and wired it into `test:premier-no-spend`; `npm run check:premier-no-spend` passed with the new gate. The gate locks steering action validation, structured run-trace events, active-run steering note queues/injection, client API/app state updates, and Agent detail steering/replay affordances. Live provider-approved steering proof remains pending.

- 2026-06-17 Premier proof guard continuation: added the Premier live-evidence-guard regression to the no-spend bundle. This keeps direct evidence, stale evidence, provider-budget approval, browser/manual proof, and final local gate approval boundaries explicit so static tests cannot be mistaken for final live/provider closeout proof.

- 2026-06-17 Premier proof guard continuation: added the Premier approval-boundaries regression to the no-spend bundle. This keeps provider-spend proof, browser/manual proof, and final local validation approval-gated while the overhaul remains open.

- 2026-06-17 Premier proof guard continuation: added the Premier closeout-matrix regression to the no-spend bundle. This keeps final completion tied to a phase-mapped and stop-condition-mapped evidence matrix, with remaining risks/gaps explicit until direct proof exists.

- 2026-06-17 Premier proof guard continuation: added the Premier restart-scope regression to the no-spend bundle. This keeps the kickoff restart rules explicit: server/runtime edits require relaunch plus `3001`/`5173`/`/api/config` proof, while docs-only and non-server edits should not churn the running app unnecessarily.

- 2026-06-17 Premier proof guard continuation: added the Premier worktree-isolation regression to the no-spend bundle. This preserves the kickoff requirement that implementation agents need worktree isolation before any multi-agent write flow is considered safe; the guard does not itself implement live isolated worktrees, so that remains a product/safety gap before full closeout.

- 2026-06-17 Premier implementation continuation: execute-mode implementer work now attempts to create an isolated OpenHarness git worktree and uses that path for implementer writes, retry/repair, validation, and review when available. Run traces include `worktree_isolation` status. Remaining live proof: run an approved execute scenario that creates the worktree and then promote/discard it through Safety.

- 2026-06-17 Premier implementation continuation: Agent detail replay now displays `worktree_isolation` events, counts ready isolated worktrees in the replay summary, and treats isolation as proof/routing evidence. Browser refresh is enough for this client-side visibility change.

- 2026-06-17 Premier implementation continuation: active-work metadata now surfaces `worktree_isolation` events as compact proof cues, so users can see isolated worktree status before digging into Agent detail replay. Browser refresh is enough for this client-side visibility change.

- 2026-06-17 Premier implementation continuation: worktree isolation evidence now appears in live run activity text, Prompt Microscope metadata, Agent detail replay, active-work metadata, and exported run debug bundles. Remaining live proof is still an approved execute run that creates a worktree and then promotes/discards it through Safety.

- 2026-06-17 Premier implementation continuation: worktree isolation evidence now points users to Safety > Worktrees from Agent detail replay and Prompt Microscope, so validate/promote/discard controls are discoverable from the proof surface. Browser refresh is enough for this client-side visibility change.

- 2026-06-17 Premier implementation continuation: Safety > Worktrees now explicitly says users can validate, promote, or discard isolated changes, and the destructive action is visibly labelled `Discard`. Browser refresh is enough for this client-side clarity change.

- 2026-06-17 Premier implementation continuation: Safety > Worktrees now shows the short worktree id in each row, so users can match `worktree_isolation` trace evidence to the exact Validate/Promote/Discard controls. Browser refresh is enough for this client-side clarity change.

- 2026-06-17 Premier implementation continuation: Safety > Worktrees action buttons now include the short worktree id and row label in accessible labels, so Validate/Promote/Discard can be matched to `worktree_isolation` trace evidence even with multiple isolated worktrees. Browser refresh is enough.

- 2026-06-17 Premier implementation continuation: Safety > Worktrees now exposes the full worktree id on the visible short id, helping users reconcile exact exported/debug `worktree_isolation` evidence with the Validate/Promote/Discard row. Browser refresh is enough.

- 2026-06-17 Premier implementation continuation: execute isolation now refreshes the worktree after review. Clean isolated worktrees are auto-discarded; dirty isolated worktrees remain in Safety > Worktrees for Validate, Promote, or Discard. Remaining live proof: approved execute scenario showing dirty preservation or clean auto-discard.

- 2026-06-17 Premier implementation continuation: `worktree_isolation` trace steps now include lifecycle states for `preserved` and `auto_discarded`, and UI/export surfaces distinguish ready, preserved-for-Safety, auto-discarded, unavailable, and failed isolation states. Remaining proof is still an approved live execute run that exercises one of those lifecycle paths.

## Phase 7 routing-adherence gate alignment - 2026-06-17

- The kickoff Phase 7 validation list names `npm run test:routing-adherence`; `test:prompt-routing-memory` now runs that gate between the output-shape checks and prompt-strategy database checks so the no-spend Phase 7 bundle matches the kickoff.
- The Premier proof checklist now calls out routing adherence in both the no-spend baseline and Phase 7 evidence capture rows.
- `scripts/test-premier-baseline-manifest.ts` now guards both the package-script inclusion and this handoff breadcrumb so routing-adherence cannot silently drift out of the Premier baseline again.
- This was package/docs/test-manifest alignment only. No server/runtime restart was required, and validation remains pending until explicitly approved.

## Restart duplicate-window stop-condition audit alignment - 2026-06-17

- The kickoff stop condition `Runtime relaunch does not leave duplicate OpenHarness/Electron windows.` is now represented in the closeout proof matrix instead of only in the restart-scope regression notes.
- `scripts/test-premier-stop-condition-audit.ts` now preserves that duplicate-window stop condition against the kickoff and closeout proof doc.
- This was docs/test-manifest alignment only. No server/runtime restart was required, and validation remains pending until explicitly approved.

## Phase 6 calibration/comparison pack guard alignment - 2026-06-17

- The kickoff requires open-source calibration packs and frontier comparison packs; `scripts/test-premier-model-harness.ts` now preserves the Model Lab Prompt Packs guidance for calibrating cheaper open candidates first, running tight frontier comparisons second, exporting pack evidence, and only then applying role/router changes.
- `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now names that calibration/comparison flow as Phase 6 proof evidence.
- This was docs/test-manifest alignment only. No server/runtime restart was required, and validation remains pending until explicitly approved.

## Phase 6 provider-health and rate-limit guard alignment - 2026-06-17

- The kickoff requires provider health and rate-limit visibility before expensive model work; `scripts/test-premier-model-harness.ts` now preserves Settings provider-health badge labels plus Model Lab rate-limit, metered-billing, provider-health, and provider-budget approval cautions.
- `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now names provider health and rate-limit warnings as explicit Phase 6 proof evidence before Model Lab work or provider/model configuration changes.
- This was docs/test-manifest alignment only. No server/runtime restart was required, and validation remains pending until explicitly approved.

## Worktree isolation diff-review guard alignment - 2026-06-17

- `scripts/test-premier-worktree-isolation.ts` now guards the Safety > Worktrees diff-review control (`Show diff vs base`) alongside Validate, Promote, and Discard so isolated implementation work can be inspected before a decision.
- `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now names diff inspection as part of the worktree-isolation closeout requirement before multi-agent write flows are treated as safe.
- This was docs/test-manifest alignment only. No server/runtime restart was required, and validation remains pending until explicitly approved.

## Review Changes patch-action language alignment - 2026-06-17

- Message-level diff actions now point users to `Review Changes` instead of saying `Patch Review panel`, keeping the kickoff's single Review Changes flow clear even when a patch starts from chat.
- `scripts/test-premier-review-changes.ts` now guards the chat patch action wording and the no-project Review Changes dialog labelling.
- This was client/test-manifest alignment only. Browser refresh is enough; no server/runtime restart was required, and validation remains pending until explicitly approved.

## Calm-chat replay proof affordance guard alignment - 2026-06-17

- `scripts/test-premier-calm-chat.ts` now guards the quiet replay-export action and compact `Run replay` summary beside the Details gateway, so replayable proof remains available without reintroducing noisy message-level diagnostics.
- This was test-manifest alignment for existing client UI. Browser refresh is enough if the UI is already open; no server/runtime restart was required, and validation remains pending until explicitly approved.

## Artifact drawer copy and expansion guard alignment - 2026-06-17

- `scripts/test-premier-artifact-review.ts` now guards artifact copy labels plus long-artifact preview/full-content controls, so reviewable artifacts remain inspectable and reusable without raw log clutter.
- This was test-manifest alignment for existing client UI. Browser refresh is enough if the UI is already open; no server/runtime restart was required, and validation remains pending until explicitly approved.

## Active-work Environment rail guard alignment - 2026-06-17

- `scripts/test-premier-active-work.ts` now guards the Environment rail active-work summary: workflow label, current task, model/provider, latest proof/artifact cue, compact step list, current-step marker, and Agent detail entry point.
- This keeps active work visible where project/environment context lives without turning the rail into another chat transcript.
- This was test-manifest alignment for existing client UI. Browser refresh is enough if the UI is already open; no server/runtime restart was required, and validation remains pending until explicitly approved.

## Quiet bottom status chrome alignment - 2026-06-17

- `src/components/StatusBar.tsx` now returns no bottom status bar during quiet chat unless there is an active warning, background model/routing activity, or an already-open status surface such as model/trust/terminal controls.
- `scripts/test-premier-layout-shell.ts` now guards that quiet-status behavior plus fixed Environment rail context sections, preserving the kickoff rule against permanent bottom chrome and reorderable environment cards.
- `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now names the bottom-status rule as Phase 1/4 closeout evidence.
- This was client/test/docs work. Browser refresh is enough; no server/runtime restart was required, and validation remains pending until explicitly approved.

## Quiet status chrome shell-gate refinement - 2026-06-17

- Moved the quiet bottom-status decision back to the app shell: `src/App.tsx` now mounts `StatusBar` only for context warnings, terminal panel use, running model activity, Auto-Router activity, provider rate-limit warnings, or running/blocked/error agent work.
- Removed the duplicate inner hide gate from `src/components/StatusBar.tsx` so model/trust/terminal controls still function whenever the shell intentionally mounts the status bar.
- `scripts/test-premier-layout-shell.ts` now guards the App-level status-bar mount conditions and the StatusBar warning/terminal surfaces.
- This was client/test/docs work. Browser refresh is enough; no server/runtime restart was required, and validation remains pending until explicitly approved.

## Top-bar model/router evidence entry alignment - 2026-06-17

- `src/components/TopBar.tsx` now makes the model/router badge actionable: `Router` opens Routing Learning evidence, while a concrete model opens Model Lab.
- `src/styles/components.css` keeps the badge visually quiet but keyboard/click friendly, and `scripts/test-premier-layout-shell.ts` guards the Router-to-Routing-Learning and model-to-Model-Lab entry points.
- This resolves the earlier no-spend UI gap where clicking the top-bar `Router` label did not open a routing trust/detail surface.
- This was client/test/docs work. Browser refresh is enough; no server/runtime restart was required, and validation remains pending until explicitly approved.

## Top-bar model/router focus guard alignment - 2026-06-17

- `src/styles/components.css` now gives the actionable top-bar model/router badge an explicit `focus-visible` outline in addition to hover styling.
- `scripts/test-premier-layout-shell.ts` now guards the badge as a typed button with hover/focus affordances, preserving the Routing Learning / Model Lab evidence entry point for keyboard users.
- This was client/test/docs work. Browser refresh is enough; no server/runtime restart was required, and validation remains pending until explicitly approved.

## Top-bar evidence entry checklist alignment - 2026-06-17

- `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now explicitly asks reviewers to confirm the top-bar model/router badge opens Routing Learning for `Router` and Model Lab for concrete models after quiet bottom status chrome is hidden.
- `scripts/test-premier-layout-shell.ts` now guards that checklist wording as part of the layout-shell contract.
- This was docs/test alignment only. No server/runtime restart was required, and validation remains pending until explicitly approved.

## Top-bar evidence entry open-not-toggle refinement - 2026-06-17

- `src/components/TopBar.tsx` now receives `onOpenPanel` for the model/router badge and uses it to open Routing Learning or Model Lab without toggling the panel closed when it is already visible.
- `src/App.tsx` passes the layout state's `addPanel` function as `onOpenPanel`, while the Tools menu keeps using toggle behavior.
- `scripts/test-premier-layout-shell.ts` now guards the open-not-toggle contract for the top-bar evidence entry.
- This was client/test work. Browser refresh is enough; no server/runtime restart was required, and validation remains pending until explicitly approved.

## Top-bar mock snippet contract alignment - 2026-06-17

- `src/utils/mockData.ts` no longer shows the old passive/minimal `TopBar` example; the mock snippet now includes `activeModel="Auto"` and an `onOpenPanel` evidence-entry callback so demos do not teach the obsolete contract.
- `scripts/test-premier-layout-shell.ts` now guards that mock snippet alignment alongside the real TopBar/App contract.
- This was client/test alignment only. Browser refresh is enough; no server/runtime restart was required, and validation remains pending until explicitly approved.

## Top-bar quiet-control semantics alignment - 2026-06-17

- `src/components/TopBar.tsx` now gives the sidebar toggle and Tools menu explicit button semantics/labels and marks decorative top-bar icons as hidden from assistive tech.
- `scripts/test-premier-layout-shell.ts` now guards those quiet-control semantics alongside the model/router evidence entry point.
- This was client/test alignment only. Browser refresh is enough; no server/runtime restart was required, and validation remains pending until explicitly approved.

## Agent detail inactive-run steering boundary alignment - 2026-06-17

- `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now explicitly requires completed, blocked, or inactive Agent detail runs to hide unsafe live steering controls while keeping replay filters available for proof, routing, artifact feedback, and past steering inspection.
- `scripts/test-premier-agent-detail.ts` now guards the inactive-run steering boundary copy and the checklist wording.
- This was docs/test alignment only. No server/runtime restart was required, and validation remains pending until explicitly approved.

## Steering next-safe-phase proof alignment - 2026-06-17

- `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now requires steering proof to show both structured replay steering evidence and injection into the next safe orchestrator or agent phase, not just local UI text or a saved row.
- `scripts/test-premier-steering-contract.ts` now guards the next-safe-phase instruction copy and the checklist proof wording.
- This was docs/test alignment only. No server/runtime restart was required, and validation remains pending until explicitly approved.

## Pause/cancel steering semantics alignment - 2026-06-17

- `src/components/SubAgentTracker.tsx` now describes Pause as a safe stop at the current model request with replay evidence, and Cancel as cancelling the current path with replay evidence, avoiding any implication that Pause is a resumable paused-state workflow.
- `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now requires Pause/Cancel proof to show the current path stops and replay evidence records the user request, and explicitly says not to treat Pause as resumable unless a dedicated resume path is added and proven.
- `scripts/test-premier-steering-contract.ts` now guards that pause/cancel semantics boundary.
- This was client/docs/test alignment only. No server/runtime restart was required, and validation remains pending until explicitly approved.

## Artifact feedback replay-evidence checklist alignment - 2026-06-17

- `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now requires artifact approval and needs-revision decisions to persist as structured replay steering evidence with artifact label, type, id, and reviewer note, not only local drawer state.
- `scripts/test-premier-artifact-review.ts` now guards that replay-evidence checklist requirement.
- This was docs/test alignment only. No server/runtime restart was required, and validation remains pending until explicitly approved.

## Tool-reliability evidence-source tuning guard alignment - 2026-06-17

- `scripts/test-tool-reliability.ts` now directly asserts that `log_trace` retry-reduction recommendations map to `review_before_tuning`, while `imported_trace` recommendations map to `context_only` and do not silently merge into local tuning behavior.
- The test also guards that identical avoid/prefer paths from different evidence sources remain separate rows, preserving source-aware review boundaries.
- This was test-only alignment. No server/runtime restart was required, and validation remains pending until explicitly approved.

## Tool-reliability provider-qualified retry-reduction alignment - 2026-06-17

- Retry-reduction recommendations now preserve `avoidProviderPath` and `preferProviderPath` beside the existing short model/tool paths, so same-model tool failures from different providers stay distinct.
- Routing Learning, Settings candidate rows, Markdown evidence export text, and Auto-Router classifier candidate-card annotations now surface provider-qualified avoid/prefer paths for tool-error recovery evidence.
- Regression guards were updated in `scripts/test-tool-reliability.ts`, `scripts/test-router-learning-export.ts`, `scripts/test-router-learning-import.ts`, and `scripts/test-premier-model-harness.ts`.
- This touched server/router and client evidence surfaces. Restart/reachability proof was required after the edit; full validation remains pending until explicitly approved.

## Source-backed prompt best-practice database alignment - 2026-06-17

- `server/promptStrategies.ts` now stores source-backed best-practice notes per prompt strategy profile, including guidance, rationale, and an eval cue for prompt-response quality comparisons.
- The source registry now includes Mistral function-calling guidance alongside OpenAI, Anthropic, Gemini, and Mistral prompt-engineering references, keeping tool-heavy prompt contracts tied to primary documentation.
- `src/utils/api.ts`, `scripts/test-prompt-strategy-database.ts`, and `scripts/test-premier-prompt-source-provenance.ts` were aligned to preserve and guard the new profile metadata.
- This touched server/profile data consumed by runtime API routes. Restart/reachability proof was required after the edit; full validation remains pending until explicitly approved.

## Model Lab prompt best-practice visibility alignment - 2026-06-17

- `src/components/ModelLabPanel.tsx` now surfaces each selected prompt strategy profile's first source-backed best-practice note directly in the strategy comparison selector.
- Strategy cards show the note's guidance and eval cue, and the checkbox accessibility label includes the same source-backed guidance so prompt-response comparison is not hidden in the raw profile database.
- `scripts/test-premier-model-harness.ts` now guards this Model Lab visibility so prompt best-practice metadata remains actionable during same-model prompt strategy comparisons.
- This was client/test/docs alignment only. Browser refresh is enough; no server/runtime restart was required.

## Auto-Router prompt best-practice advisory alignment - 2026-06-17

- `server/autoRouter.ts` now adds each candidate model family's source-backed prompt strategy best-practice guidance and eval cue to classifier candidate cards.
- The prompt-contract guidance is explicitly advisory and does not change candidate thresholds, effective costs, or routing defaults by itself.
- `scripts/test-tool-reliability.ts` and `scripts/test-premier-model-harness.ts` now guard that classifier-visible prompt guidance includes the eval cue and advisory boundary.
- This touched server routing code. Restart/reachability proof was required after the edit; full validation remains pending until explicitly approved.

## Prompt Microscope best-practice trace evidence alignment - 2026-06-17

- `server/promptStrategies.ts` now includes the selected profile's first source-backed best-practice note in `PromptStrategyTrace`, carrying guidance, rationale, eval cue, and source reference with each prompt build.
- `src/components/PromptMicroscope.tsx` now displays best-practice guidance, eval cue, and source in the prompt strategy evidence block so replay/debug surfaces explain why a prompt contract was selected.
- `src/utils/api.ts`, `scripts/test-prompt-strategy-database.ts`, `scripts/test-premier-prompt-source-provenance.ts`, and `scripts/test-premier-model-harness.ts` were updated to preserve this trace evidence.
- This touched server trace data and client UI. Restart/reachability proof was required after the edit; full validation remains pending until explicitly approved.

## Model Lab prompt best-practice proof-summary alignment - 2026-06-17

- Model Lab prompt-strategy proof summaries now include each observed strategy trace's source-backed eval cue and source reference when available.
- This lets exported proof briefs preserve what a prompt contract was meant to test, not only the selected family/style/variant.
- `scripts/test-premier-model-harness.ts` now guards the proof-summary eval cue/source text.
- This was client/test/docs alignment only. Browser refresh is enough; no server/runtime restart was required.

## Routing Learning prompt best-practice export alignment - 2026-06-17

- Routing Learning now loads prompt strategy profiles alongside routing events so its Markdown evidence export can annotate recent routing decisions with source-backed prompt eval cues and source references.
- The prompt strategy catalog fetch is best-effort; Routing Learning still loads if profile metadata is unavailable, but exported decisions include prompt eval cues whenever the selected `promptStrategyId` resolves.
- `scripts/test-premier-model-harness.ts` guards the Routing Learning export text path.
- This was client/test/docs alignment only. Browser refresh is enough; no server/runtime restart was required.

## Server Routing Learning prompt best-practice export alignment - 2026-06-17

- `server/routerLearningExport.ts` now includes a bounded `promptStrategyBestPractices` array for prompt strategy profiles referenced by exported routing events.
- The server JSON export preserves strategy id, family, style, source refs, and source-backed best-practice notes so imported/shared routing-learning bundles retain prompt-response eval cues.
- `src/utils/api.ts`, `scripts/test-router-learning-export.ts`, and `scripts/test-premier-model-harness.ts` were updated to guard the export shape.
- This touched server export code. Restart/reachability proof was required after the edit; full validation remains pending until explicitly approved.

## Routing Learning prompt best-practice import-preview alignment - 2026-06-17

- `server/routerLearningImport.ts` now previews imported `promptStrategyBestPractices` metadata, counting strategy rows, best-practice notes, and source refs.
- The import preview labels prompt best-practice metadata as context-only evidence and does not merge it into local prompt strategy profiles.
- `src/components/RoutingLearningPane.tsx`, `src/utils/api.ts`, `scripts/test-router-learning-import.ts`, and `scripts/test-premier-model-harness.ts` now guard the preview and user-facing import messaging.
- This touched server import code. Restart/reachability proof was required after the edit; full validation remains pending until explicitly approved.

## Routing Learning import response prompt-preview passthrough - 2026-06-17

- `/api/router/learning/import` now returns `promptBestPracticePreview` from `buildRouterLearningImportPreview()` in both dry-run and real import responses.
- This keeps the UI confirmation and post-import completion message aligned: prompt best-practice metadata is previewed as context-only evidence and is not merged into local prompt strategy profiles.
- `scripts/test-premier-model-harness.ts` now guards the endpoint passthrough.
- This touched server import response code. Restart/reachability proof was required after the edit; full validation remains pending until explicitly approved.

## Premier closeout prompt best-practice proof coverage alignment - 2026-06-17

- Updated the Premier proof checklist and closeout/static manifest guards so Phase 7 now explicitly covers source-backed prompt best-practice guidance, eval cues, source refs, Routing Learning export/import preview metadata, and the context-only import rule for prompt best-practice rows.
- This is no-spend documentation/static-guard alignment only. Remaining closeout still needs the approved no-spend gate run, browser/manual review, provider-backed proof where approved, final lint/build, and runtime reachability proof if server/runtime code changes again.

## Premier model scorecard breadth alignment - 2026-06-17

- Expanded the existing Model Library `Harness fit` cards in `src/components/SettingsModal.tsx` so their visible and accessible scorecard covers coding, reasoning, review, planning, tool use, vision, long context, speed, cost, privacy, and local availability, matching the Premier kickoff's open-source/frontier comparison promise.
- Updated `scripts/test-premier-model-harness.ts` and `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` so the no-spend model-harness guard preserves that broader scorecard contract.
- This is client/test/docs work. Browser refresh is enough; no server/runtime restart was required. The model-harness gate has not been rerun in this continuation; final validation remains pending approval.

## Artifact feedback save-without-refresh hardening - 2026-06-17

- `src/components/ArtifactDrawer.tsx` now treats a successful artifact steering save with no refreshed run payload as saved feedback with `Saved to replay; refresh pending` instead of surfacing a false `Could not confirm replay save` error.
- `scripts/test-premier-artifact-review.ts` now guards the saved-without-refresh status path so artifact approval/revision remains reliable across shared steering callback implementations.
- This is client/test work. Browser refresh is enough; no server/runtime restart was required. The artifact-review gate has not been rerun in this continuation; final validation remains pending approval.

## Calm replay validation-proof summary alignment - 2026-06-17

- `src/components/MessageBubble.tsx` now includes a validation-proof count in the compact `Run replay` summary when a run trace contains validation proof artifacts, so proof is visible without reopening raw trace details.
- `scripts/test-premier-calm-chat.ts` and `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now guard that validation proof remains distinguishable from generic artifacts in the quiet chat surface.
- This is client/test/docs work. Browser refresh is enough; no server/runtime restart was required. The calm-chat gate has not been rerun in this continuation; final validation remains pending approval.

## Layout shell pinned-tool legacy pruning - 2026-06-17

- `src/App.tsx` now sanitizes persisted pinned Tools panels against the forced-hidden shell policy and removes stale `sub-agents` entries from `openharness.pinned-tools.v1` on load.
- The pinned-tool toggle now refuses forced-hidden panels, so legacy localStorage cannot reintroduce the old permanent sub-agents split after restart.
- `scripts/test-premier-layout-shell.ts` now guards pinned-tool sanitization alongside the chat-first default layout, Tools menu, no drag/reorder handlers, and quiet bottom status chrome.
- This is client/test work. Browser refresh is enough; no server/runtime restart was required. The layout-shell gate has not been rerun in this continuation; final validation remains pending approval.

## Theme texture startup-default guard alignment - 2026-06-17

- `scripts/test-premier-theme-textures.ts` now guards the global startup CSS defaults for `--theme-texture-recipe: none` and `--theme-texture-opacity: 0`, so pre-hydration app startup cannot flash a texture before the runtime theme registry applies.
- `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now includes this startup/default no-texture requirement in Phase 5 texture accessibility proof.
- This is docs/test alignment only. No server/runtime restart was required. The theme-texture gate has not been rerun in this continuation; final validation remains pending approval.

## Left-pane active-work row label alignment - 2026-06-17

- `src/components/Sidebar.tsx` now includes model, provider, and elapsed time in the active-work run row's primary accessible label, alongside status, task, and latest proof/artifact.
- `scripts/test-premier-active-work.ts` and `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now guard the full left-pane row contract while keeping phase rows nested under the owning run.
- This is client/test/docs work. Browser refresh is enough; no server/runtime restart was required. The active-work gate has not been rerun in this continuation; final validation remains pending approval.

## Review Changes validation-proof save feedback alignment - 2026-06-17

- `src/components/ReviewChangesFlyout.tsx` now announces validation-proof save success as a polite status and save failure as an alert, with the Save artifact button describing the status region when feedback is visible.
- `scripts/test-premier-review-changes.ts` and `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now guard proof-save feedback inside the consolidated Review Changes flow.
- This is client/test/docs work. Browser refresh is enough; no server/runtime restart was required. The Review Changes gate has not been rerun in this continuation; final validation remains pending approval.

## Agent Detail live-summary accessibility alignment - 2026-06-17

- `src/components/AgentFocusPanel.tsx` now marks the right-hand Agent detail run-count summary as `aria-live="polite"` in addition to `role="status"`, so changing running/waiting/blocked/complete/failed counts are announced without interrupting the user.
- `src/components/SubAgentTracker.tsx` now applies the same polite live treatment to the detailed harness run summary inside the inspector.
- `scripts/test-premier-agent-detail.ts` and `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now guard polite live status summaries as part of the Phase 3 right-hand inspector contract.
- Status: client/test/docs work only. Browser refresh is enough; no server/runtime restart was required. Full Agent Detail validation, live steering proof, browser/manual proof, and final gates remain pending approval.

## Agent Detail right-hand region landmark alignment - 2026-06-17

- `src/App.tsx` now exposes the Agent Detail overlay wrapper as `role="region" aria-label="Right-hand Agent detail pane"`, so the selected-work inspector is discoverable as a right-hand pane and not only as anonymous overlay chrome.
- `src/styles/components.css` now labels this CSS section as the right-hand inspector instead of the old full-main-area wording.
- `scripts/test-premier-agent-detail.ts` now guards the App-shell wrapper, AgentFocusPanel mount, and steering callback wiring for the named right-hand inspector region.
- `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now requires the Agent Detail inspector region as part of Phase 3 closeout proof.
- Status: client/test/docs work only. Browser refresh is enough; no server/runtime restart was required. Full Agent Detail validation, live steering proof, browser/manual proof, and final gates remain pending approval.

## Agent Detail steering description association alignment - 2026-06-17

- `src/components/SubAgentTracker.tsx` now gives active steering target and replay-persistence guidance stable ids and attaches them to steering action buttons, the steering note input, and Add note via `aria-describedby`.
- This keeps the visible steering copy and assistive-tech control descriptions aligned: users can tell whether a correction targets the orchestrator or selected agent and that the action is saved as replay steering evidence.
- `scripts/test-premier-steering-contract.ts`, `scripts/test-premier-agent-detail.ts`, and `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now guard the association as part of the Phase 3 steering contract.
- Status: client/test/docs work only. Browser refresh is enough; no server/runtime restart was required. Live steering replay proof and final gates remain pending approval.

## Calm chat replay export details alignment - 2026-06-17

- `src/components/MessageBubble.tsx` now keeps the compact `Run replay` summary visible but moves the full replay/debug bundle export action behind the message `Details` region.
- This keeps prompts, routing, artifacts, proof bundle export, tool details, confidence, Prompt Microscope, team plan, and next actions on the same opt-in diagnostic path instead of adding another default chat button.
- `scripts/test-premier-calm-chat.ts` and `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now guard replay export as part of the Details/Actions path.
- Status: client/test/docs work only. Browser refresh is enough; no server/runtime restart was required. Full calm-chat validation, browser/manual proof, and final gates remain pending approval.

## Artifact drawer review-region labelling alignment - 2026-06-17

- `src/components/ArtifactDrawer.tsx` now exposes the collapsed/expanded artifact review affordance as a labelled group: `Message artifact review drawer`, including artifact count and summary.
- This keeps artifact comments, approval, needs-revision, copy, expand, and revise-from-here actions discoverable without turning the main chat message into raw diagnostic clutter.
- `scripts/test-premier-artifact-review.ts` and `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now guard the labelled quiet review drawer contract.
- Status: client/test/docs work only. Browser refresh is enough; no server/runtime restart was required. Full artifact-review validation, browser/manual proof, and final gates remain pending approval.

## Theme texture opacity control accessibility alignment - 2026-06-17

- `src/components/SettingsModal.tsx` now gives the Theme texture opacity slider an explicit `aria-valuetext` such as `3% shell texture opacity` and associates it with the reduced-transparency guidance text via `aria-describedby`.
- This keeps the Phase 5 texture control user-adjustable while making the safety rule discoverable: textures are shell-only and reduced transparency disables texture/blur in favor of solid fallback surfaces.
- `scripts/test-premier-theme-textures.ts` and `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now guard the accessible value/guidance contract for the texture opacity control.
- Status: client/test/docs work only. Browser refresh is enough; no server/runtime restart was required. Full theme-texture validation, reduced-transparency browser proof, and final gates remain pending approval.

## Routing Learning recommendation trust-label alignment - 2026-06-17

- `src/components/RoutingLearningPane.tsx` now labels each role recommendation row with role, model, source report, proof status, and whether the recommendation is trusted evidence or remains untrusted until Model Lab proof is approved.
- This strengthens the Phase 6 model-harness trust path: bulk apply already skips unapproved proof, and now one-by-one recommendation review exposes the same trust boundary at the row level.
- `scripts/test-premier-model-harness.ts` and `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now guard the labelled trusted/untrusted recommendation-row contract.
- Status: client/test/docs work only. Browser refresh is enough; no server/runtime restart was required. Full model-harness validation, Model Lab proof review, browser/manual proof, and final gates remain pending approval.

## Prompt Microscope provenance advisory alignment - 2026-06-17

- `src/components/PromptMicroscope.tsx` now labels prompt strategy source-backed metadata as advisory prompt-contract evidence, not an automatic routing override.
- When best-practice metadata is present, Prompt Microscope shows a `Provenance use` row before the guidance/eval cue/source fields, and the prompt strategy list label includes the same advisory boundary.
- `scripts/test-premier-model-harness.ts`, `scripts/test-premier-prompt-source-provenance.ts`, and `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now guard that provenance language.
- Status: client/test/docs work only. Browser refresh is enough; no server/runtime restart was required. Full prompt/routing memory validation, live saved-run proof, provider-approved prompt strategy comparisons, and final gates remain pending approval.

## Routing Learning imported selected-model identity guard - 2026-06-17

- Confirmed `server/routerLearning.ts` currently normalizes imported routing events with a single `selectedModel` field; the duplicate line seen in a long combined output was not present in the targeted current source.
- `scripts/test-router-learning-outcome-persistence.ts` now asserts imported routing events preserve selected model identity alongside prompt strategy variant and dataset kind.
- `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now requires imported routing evidence to keep the model path that routed or recovered a run traceable.
- Status: test/docs alignment only. No server/runtime code changed, so no restart was required. Full prompt/routing memory validation, imported evidence proof, and final gates remain pending approval.

## Tool reliability recovery prompt-strategy context alignment - 2026-06-17

- `server/toolReliability.ts` now includes `promptStrategyId` and `promptStrategyVariantId` on `ToolReliabilityRecoveryExample`, so recovered tool-error examples preserve the prompt contract active when the failure and later working path occurred.
- `scripts/test-tool-reliability.ts` now guards recovery-example prompt strategy and variant context alongside the failed model/provider/tool and later successful tool path.
- `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now requires recovery examples to distinguish prompt-contract problems from model/tool problems.
- Server/runtime code changed, so OpenHarness was restarted with the repo-native start path. Reachability proof after restart: `http://127.0.0.1:3001/api/config` responded, `http://127.0.0.1:5173/` responded, and process shape showed one OpenHarness Electron main process plus normal helper processes.
- Full prompt/routing memory validation, imported evidence proof, provider-approved proof runs, and final gates remain pending approval.

## Routing Learning recovery-example prompt-strategy passthrough - 2026-06-17

- `src/utils/api.ts` now includes `promptStrategyId` and `promptStrategyVariantId` on `ToolReliabilityRecoveryExample`, matching the server-side recovery-example shape.
- `src/components/RoutingLearningPane.tsx` now surfaces recovery-example strategy context in both the visible Tool Reliability recovery paths and the Markdown evidence brief.
- `scripts/test-router-learning-export.ts`, `scripts/test-premier-model-harness.ts`, and `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now guard that recovery-example prompt strategy context does not stay server-only.
- Status: client/test/docs alignment only. No server/runtime code changed in this slice, so no restart was required. Full prompt/routing memory validation, imported evidence proof, provider-approved proof runs, and final gates remain pending approval.

## Top-bar model/router evidence target alignment - 2026-06-17

- `src/components/TopBar.tsx` now marks the model/router badge as a stable quiet evidence entry point with `data-model-evidence-entry="true"` and `data-model-evidence-panel={modelDetailPanel}`.
- Router mode still opens Routing Learning and concrete models still open Model Lab, but the destination is now statically auditable instead of relying only on the click handler.
- `scripts/test-premier-layout-shell.ts` and `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now guard the evidence-panel target contract.
- Status: client/test/docs work only. Browser refresh is enough; no server/runtime restart was required. Full browser/manual proof and final gates remain pending approval.

## Review Changes consolidated-surface marker alignment - 2026-06-17

- `src/components/ReviewChangesFlyout.tsx` now marks the Review Changes dialog with `data-review-changes-surface="diffs-patches-validation-commit"` in both the empty-project and active-project states.
- This keeps the kickoff's single Review Changes flow statically auditable: diffs, patch proposals, validation proof, and commit prep stay consolidated instead of reintroducing permanent Diffs/Patches panels.
- `scripts/test-premier-review-changes.ts` and `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now guard the consolidated-surface marker.
- Status: client/test/docs work only. Browser refresh is enough; no server/runtime restart was required. Full Review Changes validation, browser/manual proof, and final gates remain pending approval.

## No-provider baseline closeout-boundary alignment - 2026-06-17

- `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now explicitly states that passing the no-provider baseline is not closeout by itself.
- The checklist now requires the baseline to be paired with current manual/browser evidence, runtime scenario proof, provider-backed proof where approved, and final gates before the kickoff can be treated as complete.
- `scripts/test-premier-live-evidence-guard.ts` now guards that no-spend/static proof cannot replace live/manual/provider evidence.
- Status: docs/test alignment only. No server/runtime restart was required. Full browser/manual proof, runtime scenario proof, provider-approved proof runs, and final gates remain pending approval.

## Duplicate Electron final-gate evidence alignment - 2026-06-17

- `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now asks final gate reviewers to record a `Duplicate Electron/process-shape check` after restart-scoped work.
- `scripts/test-premier-restart-scope.ts` now guards the kickoff duplicate-window stop condition, the final evidence template field, and the process-shape language used in closeout proof notes.
- Status: docs/test alignment only. No server/runtime restart was required. Full restart-scope validation and final gates remain pending approval.

## Same-model prompt strategy comparison evidence alignment - 2026-06-17

- `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now asks Model Lab Eval Proof reviewers to record same-model prompt strategy ids, variant ids, and comparison artifact paths.
- `scripts/test-premier-closeout-matrix.ts` and `scripts/test-premier-prompt-source-provenance.ts` guard that Phase 7 closeout captures what strategy contracts were compared, not just which model won.
- Model Lab Eval proof briefs now include `Same-model prompt strategy comparisons` when one model has results under multiple prompt strategy contracts.
- Model Lab Bench proof now uses the same comparison fields and proof-brief summary, so eval and bench artifacts preserve the compared prompt contracts consistently.
- Same-model comparison summaries now require the same model and same prompt/task before listing compared strategy contracts, avoiding false comparison evidence across unrelated prompts.
- The provider-backed approval draft now asks separately for `eval proof plus same-model prompt strategy comparison`, so strategy comparison spend is explicit rather than bundled into the smallest proof run.
- Status: client/docs/test alignment only. Browser refresh is enough; no server/runtime restart was required. Provider-approved prompt strategy comparison proof remains pending.

## Browser/manual durable artifact approval alignment - 2026-06-17

- The browser/manual proof approval draft now includes an option to save durable screenshot or DOM-note artifact paths for desktop and narrow-width UI checks.
- `scripts/test-premier-closeout-matrix.ts` guards that manual proof cannot remain only chat text when the final closeout needs findable artifacts.
- Status: docs/test alignment only. No server/runtime restart was required. Browser/manual proof remains pending approval.

## Runtime scenario durable trace approval alignment - 2026-06-17

- The provider-backed proof approval draft now says runtime scenarios should save durable runtime trace/export paths for Planning Room, execute/investigate, and steering-event evidence.
- `scripts/test-premier-closeout-matrix.ts` guards that runtime scenario proof maps to findable trace/export artifacts, not only chat notes.
- Status: docs/test alignment only. No server/runtime restart was required. Runtime scenario proof remains pending approval.

## Final-gate durable artifact approval alignment - 2026-06-17

- The final-gate approval draft now asks for durable gate log/artifact paths for commands that run.
- If server/runtime code changed, final evidence should also save restart/reachability proof for `3001`, `5173`, `/api/config`, and the duplicate Electron/process-shape check.
- `scripts/test-premier-closeout-matrix.ts` guards this final-gate artifact expectation.
- Status: docs/test alignment only. No server/runtime restart was required. Final gates remain pending approval.

## Approval-boundary durable evidence guard alignment - 2026-06-17

- `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now mirrors the closeout draft's stricter provider approval prompt: same-model strategy comparison, runtime trace/export artifacts, and durable artifact paths are explicit.
- `scripts/test-premier-approval-boundaries.ts` now guards durable browser/manual artifact paths, runtime trace/export paths, final gate logs, and provider approval choices.
- Status: docs/test alignment only. No server/runtime restart was required. Approval-boundary validation remains pending.

## Durable proof artifact naming alignment - 2026-06-17

- `docs/proof/README.md` now includes naming examples for same-model strategy comparisons, manual UI DOM notes, runtime scenario traces, and final gate logs.
- The README also asks proof notes to include strategy ids/variants, screenshot or DOM-note paths, runtime trace/export paths, gate log paths, and restart/process-shape proof when relevant.
- `scripts/test-premier-closeout-matrix.ts` guards this durable artifact naming guidance.
- The README now includes redaction guidance for logs, traces, screenshots, and DOM notes before saving durable proof artifacts under `docs/proof/`.
- `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now repeats the redaction reminder before the copyable closeout evidence template.
- `docs/proof/2026-06-17-manual-ui-dom-notes-template.md` is available as the redaction-aware starter artifact for an approved browser/manual proof pass.
- `docs/proof/2026-06-17-runtime-scenario-trace-template.md` is available as the redaction-aware starter artifact for approved Planning Room, execute/investigate, and steering-event runtime proof.
- `docs/proof/2026-06-17-final-gate-log-template.md` is available as the redaction-aware starter artifact for approved final validation gates and restart/process-shape proof.
- `docs/proof/2026-06-17-same-model-strategy-comparison-template.md` is available as the redaction-aware starter artifact for approved same-model prompt strategy comparison proof.
- `docs/proof/2026-06-17-model-lab-eval-proof-template.md` and `docs/proof/2026-06-17-model-lab-bench-proof-template.md` are available as redaction-aware starter artifacts for approved Model Lab proof runs.
- `docs/proof/2026-06-17-routing-learning-evidence-template.md` is available as the redaction-aware starter artifact for Routing Learning export/import, prompt-strategy outcome, and tool-error memory proof.
- `docs/proof/2026-06-17-auto-router-candidate-evidence-template.md` is available as the redaction-aware starter artifact for Auto-Router candidate-card, Settings candidate-row, and classifier-side breadcrumb proof.
- `docs/proof/2026-06-17-worktree-isolation-evidence-template.md` is available as the redaction-aware starter artifact for implementation-agent worktree isolation proof before multi-agent write flows.
- `docs/proof/2026-06-17-theme-texture-evidence-template.md` is available as the redaction-aware starter artifact for Theme Texture accessibility proof.
- `docs/proof/2026-06-17-calm-chat-artifact-review-evidence-template.md` is available as the redaction-aware starter artifact for Calm Chat, Artifact Review, and Review Changes proof.
- Template files are not proof; copy or rename them into dated completed evidence artifacts before filling them in, and link completed artifacts from the closeout log.
- The closeout log remains the index of record; whenever a completed proof artifact is created, link its path and status back from `docs/proof/2026-06-16-premier-harness-closeout.md` or the current dated closeout file.
- `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now repeats the template-not-proof and closeout-log backlink rule beside the starter template links.
- `scripts/test-premier-closeout-matrix.ts` now guards every starter proof template for template-not-proof status, artifact-path fields, redaction checklist fields, and remaining-gap fields.
- The Routing Learning evidence template is included in that per-template safety audit.
- The Routing Learning evidence template now captures evidence-source counts, tuning-action counts, repeated/single trace confidence, and imported evidence preview boundaries for Phase 7 retry-reduction proof.
- The Auto-Router candidate evidence template is included in the generic per-template safety audit.
- The worktree isolation evidence template is included in the generic per-template safety audit.
- `scripts/test-premier-closeout-matrix.ts` now also guards worktree-isolation-specific proof fields such as dirty-state preservation, diff review before promotion, validation before promotion, promote/discard decisions, and main-checkout protection.
- The Model Lab eval and bench proof templates now include provider preflight fields for provider health, rate-limit warnings, budget warnings, matrix size, and approval-gated launch labels.
- The same-model prompt strategy comparison template now includes the same provider preflight fields because it also spends provider calls.
- The runtime scenario trace template now includes provider preflight fields because Planning Room and execute/investigate proof can also call configured models.
- The Auto-Router candidate evidence template now includes provider context fields before manual tuning: provider health, rate-limit warnings, budget warnings, configuration-change approval, and approved/trusted evidence basis.
- The Routing Learning evidence template now captures recommendation trust state plus provider context before any recommendation apply/tuning decision.
- The worktree isolation evidence template now includes provider context before execute proof: provider health, rate-limit warnings, budget warnings, approval-gated launch state, and manual approval before provider-backed isolated writes.
- `docs/proof/README.md` now includes a template lane map that tells future proof passes which starter artifact to use for each closeout section.
- `docs/PREMIER_HARNESS_PROOF_CHECKLIST.md` now points to that template lane map in its evidence-storage guidance.
- The Theme Texture evidence template captures opacity bounds, shell-only textures, dense text readability, contrast sampling, reduced transparency, and reduced motion proof fields.
- The Theme Texture evidence template is included in the generic per-template safety audit.
- `docs/proof/2026-06-17-agent-detail-steering-evidence-template.md` is available as the redaction-aware starter artifact for right-hand Agent Detail and structured steering proof.
- The Agent Detail steering evidence template captures right-hand inspector state, model/provider/role visibility, grouped tool calls, steering controls, persisted run-trace events, next-safe-phase evidence, and accessibility labels.
- The Agent Detail steering evidence template is included in the generic per-template safety audit.
- The Calm Chat artifact-review evidence template captures collapsed diagnostics, Prompt Microscope/detail affordances, artifact drawer review controls, Review Changes consolidation, validation proof save status, and labelled details regions.
- Status: docs/test alignment only. No server/runtime restart was required. Closeout-matrix validation remains pending.
