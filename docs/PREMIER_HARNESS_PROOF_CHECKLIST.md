# Premier Harness Proof Checklist

Status: acceptance checklist for `docs/PREMIER_HARNESS_KICKOFF.md`
Last updated: 2026-06-17

Use this checklist to prove the Premier Harness kickoff is ready to close. Do
not mark the overhaul complete until each item has current evidence.

## Evidence Quality Rules

- Current evidence beats intent, memory, or older notes.
- Direct evidence is required for closeout: exported proof artifacts, command
  output, runtime reachability, run traces, screenshots, or concrete manual
  review notes.
- Indirect evidence does not close an item. For example, a visible UI control
  does not prove the runtime scenario works, and a saved report does not prove
  the proof was reviewed.
- Stale evidence must be refreshed if code or configuration changed afterward.
- Missing, ambiguous, or partial evidence keeps the item open.

## Provider-Spend Guard

Some proof steps call configured model providers. Do not start Eval, Bench,
Planning Room, execute, or investigate proof runs until the reviewer confirms
provider budget is acceptable for that pass. No-spend preparation is safe:

- Prepare proof-run selections.
- Review existing reports and exported artifacts.
- Inspect UI surfaces manually.
- Run local lint/build/static checks when requested.

Provider-spend steps require explicit approval:

- Running a Model Lab eval.
- Running a Model Lab bench.
- Running live Planning Room, execute, or investigate scenarios that call
  configured models.

Approval prompt template:

```text
Provider-backed proof run approval needed.

Planned calls:
- Eval proof: [yes/no], matrix: [prompts] x [models]
- Same-model prompt strategy comparison: [yes/no], matrix: [prompts] x [models] x [strategies]
- Bench proof: [yes/no], matrix: [tasks] x [models]
- Runtime scenarios: [Planning Room / execute / investigate]
- Runtime trace/export artifacts: [yes/no], paths: [Planning Room / execute-or-investigate / steering event]

Expected purpose:
- Capture closeout evidence for docs/PREMIER_HARNESS_PROOF_CHECKLIST.md.

Please approve one option:
1. Approve smallest proof runs only.
2. Approve eval proof plus same-model prompt strategy comparison.
3. Approve eval proof only.
4. Approve bench proof only.
5. Do not run provider-backed proof yet.
```

## 1. Model Lab Eval Proof

- Prepare the smallest eval proof run from Model Lab Eval.
- After provider budget is approved, run the prepared 1x1 eval.
- Open Model Lab Results for the completed report.
- Save a proof review decision.
- Export the eval proof brief.
- Export the eval recommendation report.
- Confirm any role/router recommendation is treated as trusted only when proof review is approved.

Evidence to capture:

- Report id.
- Proof review status.
- Exported proof brief artifact path.
- Same-model prompt strategy id(s), variant id(s), and comparison artifact path(s) when strategy comparison was approved.
- Exported recommendation report artifact path.
- Whether Routing Learning shows the recommendation as approved, unreviewed, or needs attention.

## 2. Model Lab Bench Proof

- Prepare the smallest bench proof run from Model Lab Tasks.
- After provider budget is approved, run the prepared 1x1 bench.
- Open Model Lab Bench for the completed run.
- Save a proof review decision.
- Export the bench proof brief.
- Export the bench JSON artifact.
- Confirm model rankings are not treated as trusted until proof review is approved.

Evidence to capture:

- Bench run id.
- Proof review status.
- Exported proof brief artifact path.
- Exported JSON artifact path.
- Same-model prompt strategy id(s), variant id(s), and comparison artifact path(s) when strategy comparison was approved.
- Validation pass/fail summary.

## 3. Manual UI Review

- Desktop width: confirm chat-first layout has no visible default drag/reorder affordances.
- Narrow width: confirm chat, settings, model lab, and routing learning do not overlap text.
- Left pane: confirm active work appears under the owning thread.
- Right pane: confirm selecting an agent opens the Agent detail inspector.
- Chat stream: confirm diagnostics remain behind Details and artifacts remain reviewable.
- Theme textures: confirm selected texture remains subtle and readable across chat, sidebar, settings, code, terminal, and diff surfaces.

Evidence to capture:

- Desktop screenshot or notes.
- Narrow-width screenshot or notes.
- Any readability or overlap issues found.

Phase-mapped review matrix:

| Kickoff area | Surface | Evidence needed |
| --- | --- | --- |
| Phase 1 chat-first shell | Main workspace, Tools menu, Environment rail | App opens to chat-first layout; no visible panel drag/reorder affordances in default use. |
| Phase 2 agent work model | Left pane, active-work strip, Environment rail progress | Active work is grouped under its owning thread and exposes status, model/provider, task, elapsed time, and latest proof/artifact. |
| Phase 3 detail and steering | Right Agent detail pane | Selecting active work opens detail; steering controls are visible only where safe; proof/artifact actions are state-gated. |
| Phase 4 calm chat and artifacts | Chat stream, Details, artifact drawer, Review Changes | Diagnostics are collapsed by default; artifacts and validation proof remain reviewable without flooding chat. |
| Phase 5 texture accessibility | Theme settings, chat, sidebar, code, terminal, diff surfaces | Texture remains subtle, bounded, readable, built-in theme contrast plus reduced-transparency and reduced-motion behavior are regression-tested, and live reduced motion/transparency expectations stay safe. |
| Phase 6 model harness trust | Model Lab, Routing Learning, Agent Roles, Auto-Router | Eval/bench/routing evidence shows proof-review state, spend guards, and trusted-only apply behavior. |
| Phase 7 prompt strategy and routing memory | Prompt Microscope, Model Lab, Routing Learning, Auto-Router Settings | Prompt strategy id/variant is traceable; same-model strategy comparisons are provider-spend guarded; source-backed best-practice guidance, eval cue, and source refs are visible in Prompt Microscope, Model Lab proof summaries, Routing Learning exports/import previews, and Auto-Router candidate cards; tool-call reliability, session outcome examples, recovery patterns, failure memory, normalized tool-error signatures, and candidate evidence freshness are visible/exportable. |
| Phase 7 tool-error breadcrumb evidence | Routing Learning, Auto-Router Settings, Auto-Router candidate-card annotations | Saved session/run breadcrumbs, retry distance, and later working path are visible in Routing Learning UI/exports, classifier-side candidate-card evidence, and Settings candidate-row recovery proof labels. |

## 2a. Phase 5 Theme Accessibility Proof

No-spend proof:

- Run `npm run test:theme-accessibility`.
- Confirm the grouped command covers built-in theme contrast,
  reduced-transparency fallback behavior, and reduced-motion behavior.
- Browser/manual confirmation should still sample representative chat, sidebar,
  settings, code, terminal, and diff surfaces when time allows.

Evidence to capture:

- `npm run test:theme-accessibility` command status.
- Any live/browser reduced-motion or reduced-transparency notes.
- Any readability issues found on code, terminal, or diff surfaces.

## 2b. Premier No-Spend Automated Proof

No-spend proof:

- Run `npm run test:premier-no-spend`.
- Confirm it runs the Phase 5 theme accessibility bundle, Phase 7 prompt
  strategy/routing-memory bundle, including routing adherence,
  tool-reliability outcome mining, Phase 7 tool-error breadcrumb evidence,
  Phase 4 execute/proof-hygiene bundle, narrow chat-first layout, proof-trust,
  steering-contract, artifact-review, calm-chat, active-work, layout-shell,
  agent-detail, model-harness, theme-texture, review-changes,
  baseline-manifest, stop-condition-audit, prompt-source-provenance,
  live-evidence-guard, approval-boundaries, closeout-matrix, and restart-scope
  regression gates, plus the worktree-isolation guard.
- Run `npm run check:premier-no-spend` when the automated no-provider baseline
  should also include lint and build.
- Use this command as the current automated baseline before manual/browser or
  provider-backed proof.
- Passing the no-provider baseline is not closeout by itself; it must be paired
  with current manual/browser evidence, runtime scenario proof, provider-backed
  proof where approved, and final gates.

Evidence to capture:

- `npm run test:premier-no-spend` command status.
- `npm run check:premier-no-spend` command status when final local gates are in
  scope.
- Tool-reliability evidence that saved session/run ids, first tool-call errors,
  normalized signatures, retry distance, and later working model/tool paths are
  still covered by the Phase 7 routing-memory bundle.
- Restart-scope evidence that server/runtime relaunch leaves a single
  OpenHarness desktop shell, with stale Electron windows cleaned up before a
  new launch.
- Evidence that saved logs or session traces can be compared from the original
  tool-call failure through the eventual successful model/tool/prompt path, so
  routing learns to avoid the repeated first error rather than only adding more
  retries.
- Evidence-source tags for tool-error outcome examples, recovery paths,
  failure memory, and normalized signatures, confirming whether each row came
  from a saved session trace, imported trace, or future log-derived trace.
- Distilled retry-reduction recommendation rows that name the failed first
  model/tool path, preferred later working path, retry distance, evidence
  source, and session/run proof.
- Tool-error evidence-source summary rows that count outcome runs,
  recovered/unrecovered runs, retry-reduction recommendations, and average retry
  distance by saved-session/imported/log-derived source.
- Source-aware tuning action for retry-reduction recommendations:
  `tune_local_router`, `review_before_tuning`, or `context_only`.
- Recommendation confidence for retry-reduction rows: `single_trace` versus
  `repeated_trace`, plus supporting run count.
- Supporting session/run breadcrumbs for retry-reduction recommendations,
  especially when a repeated recommendation collapses multiple runs into one
  row.
- Average retry distance for deduplicated retry-reduction recommendations,
  proving repeated recommendations preserve typical recovery cost.
- Confirmation that duplicate retry-reduction recommendations collapse by
  evidence source, failed first path, and preferred later path rather than
  appearing as repeated rows.
- Any skipped manual/browser/provider-backed proof items that still need direct
  evidence.
- Confirmation that generated artifacts keep comments, flags, approval,
  needs-revision, saved replay feedback, and revise-from-here actions available
  through a labelled, quiet review drawer instead of raw message-detail clutter.
- Confirmation that the compact chat replay summary distinguishes validation
  proof from generic artifacts, so proof remains visible without reopening raw
  trace details.
- Confirmation that artifact approval and needs-revision decisions persist as
  structured replay steering evidence with artifact label, type, id, and
  reviewer note, not only as local drawer state.
- Confirmation that tool details, confidence, team plan, Prompt Microscope,
  replay export, and next actions stay behind a single accessible
  Details/Actions path by default.
- Confirmation that active runs are trace-backed, phase-aware, visible near the
  chat composer, and inspectable from the left-pane run/phase rows without fake
  percentage progress.
- Confirmation that left-pane active-work run rows expose status, current task,
  model, provider, elapsed time, and latest proof/artifact in a single focusable
  row label, while phase rows stay nested under the owning run.
- Confirmation that the default shell starts chat-only, keeps the legacy
  sub-agents split forced out of the default layout, exposes advanced panels
  through Tools, and has no default drag/drop or reorder panel handlers.
- Confirmation that bottom status chrome stays hidden during quiet chat and
  appears only for active warnings, background routing/model activity, or a
  user-opened status surface such as terminal/model/trust controls.
- Confirmation that selecting agent work opens a right-hand Agent detail
  inspector region with workflow progress, replay summaries, replay filters,
  latest proof, polite live status summaries, and structured steering controls
  with programmatically associated target/persistence guidance instead of a
  permanent noisy split.
- Confirmation that completed, blocked, or inactive Agent detail runs do not
  show unsafe live steering controls; they keep replay filters available for
  proof, routing, artifact feedback, and past steering inspection.
- Confirmation that model capability cues, budget/rate-limit warnings,
  Auto-Router candidate evidence freshness, eval proof trust, tool reliability,
  prompt-strategy reliability, and Model Lab proof briefs remain visible enough
  to justify routing decisions, with role recommendation rows labelled by proof
  status and trusted/untrusted evidence state.
- Confirmation that Model Library scorecards visibly cover coding, reasoning,
  review, planning, tool use, vision, long context, speed, cost, privacy, and
  local availability so open-source and frontier models can be compared as
  first-class peers.
- Confirmation that the top-bar model/router badge opens Routing Learning for
  `Router` and Model Lab for concrete models, preserving a quiet evidence entry
  point after bottom status chrome is hidden, with a stable evidence-panel
  target on the badge for static proof.
- Confirmation that provider health and rate-limit warnings are visible before
  expensive Model Lab work or provider/model configuration changes.
- Confirmation that Model Lab prompt packs preserve the kickoff calibration
  flow: cheaper open candidates first, tight frontier comparisons second, and
  router or role changes only after pack evidence supports them.
- Confirmation that theme texture recipes remain shell-only, opacity-bounded,
  schema-validated, user-adjustable, and disabled by reduced-transparency
  fallbacks, with the Settings opacity control exposing its percentage and
  reduced-transparency guidance to assistive technologies.
- Confirmation that startup/global CSS defaults to no texture and zero texture
  opacity before runtime theme hydration, preventing a pre-theme texture flash.
- Confirmation that diffs, patch proposals, validation proof, and commit prep
  remain consolidated in one Review Changes flyout instead of duplicated
  permanent Diffs/Patches panels, with a stable consolidated-surface marker for
  static proof.
- Confirmation that Review Changes validation-proof save success is announced as
  a status and save failure is announced as an alert, so proof persistence is
  reviewable without relying on silent button text changes.
- Confirmation that `test:premier-no-spend`, this checklist, closeout proof,
  and `NEXT_SESSION.md` name the same Premier no-spend gate set.
- Confirmation that the kickoff stop-condition list remains represented in the
  closeout audit, including explicit remaining gaps before goal completion.
- Confirmation that prompt strategy profiles keep official provider source
  references for OpenAI, Anthropic, Gemini, and Mistral guidance.
- Confirmation that live/manual/provider-backed evidence gaps remain explicit
  and cannot be treated as closed by static regression coverage alone.
- Confirmation that provider-backed proof, browser/manual proof, and final
  closeout validation still require explicit approval before they run.
- Confirmation that the closeout evidence remains phase-mapped,
  stop-condition-mapped, and explicit about remaining risks/gaps before the goal
  can be treated as complete.
- Confirmation that server/runtime edits are paired with restart and
  reachability proof, while docs-only and non-server edits do not churn the
  running app unnecessarily.
- Confirmation that implementation-agent worktree isolation remains an explicit
  Phase 6 closeout requirement before any multi-agent write flow is treated as
  safe, with Safety controls to inspect diffs, validate, promote, or discard
  isolated worktrees.

## 3a. Phase 7 Prompt Strategy And Routing Memory Proof

No-spend proof:

- Run `npm run test:prompt-routing-memory`.
- Open a saved run trace with prompt assembly metadata.
- Confirm Prompt Microscope shows prompt strategy id, family, style, context
  ordering, reasoning policy, examples policy, output contract, and variant
  metadata when available, plus source-backed best-practice guidance, eval cue,
  and source ref when a prompt strategy profile provides them, while labelling
  source-backed metadata as advisory prompt-contract evidence rather than an
  automatic routing override.
- Open Routing Learning.
- Confirm tool reliability, model/tool-pair buckets, prompt strategy buckets,
  session outcome examples, recovery patterns, model failure memory, and
  normalized tool-error signatures are visible when saved traces contain those
  signals, with candidate evidence freshness available for route-time checks.
- Export Routing Learning JSON and Markdown evidence.
- Confirm exports include prompt strategy outcomes, tool reliability, session
  outcome examples, failure memory/recovery fields, normalized tool-error
  signatures, router candidate evidence freshness metadata, and source-backed
  prompt best-practice metadata for Routing Learning exports/import previews
  without silently merging imported metadata into local prompt strategy
  profiles.
- Open Auto-Router Settings.
- Confirm candidate rows show eval/tool reliability cues and candidate evidence
  freshness.
- Confirm Auto-Router candidate-card tool-reliability annotations include
  saved session/run breadcrumbs for recovery patterns, failure memory, session
  outcomes, and normalized signatures, so classifier-side routing evidence can
  be traced back to the saved run that proved what worked.
- Confirm Settings > Auto-Router candidate rows show the same saved session/run
  breadcrumbs in recent recovery-path text so manual tuning and classifier
  evidence point to the same proof run.
- Confirm Settings > Auto-Router candidate rows label the saved-session
  breadcrumb as `Recovery proof: session ..., run ...` when a recovery example
  exists, with a model-specific accessibility label carrying the same
  session/run ids and Auto-Router recovery proof context.

Provider-spend proof, after approval:

- Run the smallest same-model/same-task prompt strategy comparison in Model Lab.
- Review and save proof status for the report.
- Export the proof brief.
- Confirm strategy/variant outcomes can be distinguished from model outcomes.

Evidence to capture:

- Prompt trace run id.
- Prompt strategy id and variant id.
- Same-model comparison strategy id(s), variant id(s), proof review status, and
  comparison artifact path(s) when provider-approved Model Lab strategy
  comparisons are run.
- Source-backed prompt best-practice guidance, eval cue, source ref, and
  Routing Learning export/import preview note showing imported metadata is
  context-only unless a future migration explicitly promotes it.
- `npm run test:prompt-routing-memory` command status, including the kickoff
  `test:prompt-routing-quality-readiness`, `test:prompt-routing-output-p0`,
  and `test:routing-adherence` gates plus Routing Learning prompt-strategy
  outcome persistence.
- Routing Learning export filenames and confirmation that
  `toolReliability.outcomeExamples` is present.
- Confirmation that `toolReliability.errorSignatures`,
  `toolReliability.failureMemory`, and `toolReliability.recoveryPatterns`
  preserve saved session/run ids, failed model/provider/tool paths, retry
  distance, and the later tool/model path that actually worked. Use this to
  tune candidate cards, prompt variants, and model/tool routing before adding
  more retries.
- Confirmation that `toolReliability.recoveryExamples` preserve prompt strategy
  id and variant alongside the failed model/provider/tool and later working
  path, so recovery examples can distinguish prompt-contract problems from
  model/tool problems.
- Confirmation that Routing Learning UI and Markdown evidence export surface the
  recovery-example prompt strategy id or variant rather than keeping that
  context server-only.
- Confirmation that log/session-derived tool-call outcomes identify both the
  failed first path and the successful recovery path, including retry distance,
  so candidate cards and prompt contracts can be changed before future runs
  repeat the same failure.
- Confirmation that Routing Learning UI/exports and Auto-Router candidate-card
  annotations show the evidence source beside saved session/run breadcrumbs.
- Confirmation that Routing Learning UI/exports and Auto-Router candidate-card
  annotations show avoid/prefer retry-reduction recommendations derived from
  saved session or log-derived outcomes.
- Confirmation that imported routing events preserve selected model identity
  alongside prompt strategy variant and dataset kind, so imported evidence keeps
  the model path that routed or recovered the run traceable.
- Confirmation that Settings > Auto-Router candidate rows show the same
  avoid/prefer retry-reduction recommendation, including evidence source,
  confidence, tuning action, session/run proof, and a model-specific
  accessibility label.
- Confirmation that Settings > Auto-Router shows the tool-error evidence-source
  summary before candidate rows, so manual tuning starts from the saved-session,
  imported, or log-derived source mix.
- Confirmation that Routing Learning UI/exports show the source mix behind
  tool-error evidence before using recommendations to tune routing.
- Confirmation that Routing Learning import preview labels imported
  tool-reliability summary evidence as `imported_trace` and explains that those
  summary rows are preview-only, not silently merged into local routing state.
- Confirmation that the post-import status repeats when imported
  tool-reliability summaries were preview-only and not merged into local routing
  state.
- Candidate evidence refresh timestamp/count.
- Auto-Router candidate-card breadcrumb examples for the saved session/run ids
  behind tool-error recovery evidence.
- Settings > Auto-Router candidate-row recovery breadcrumb examples.
- Visible `Recovery proof: session ..., run ...` label in Settings >
  Auto-Router when recovery evidence exists.
- Model-specific accessibility label for the same Recovery proof session/run
  ids and Auto-Router context.
- Model Lab report id and proof-review state if provider-backed proof was run.

## 4. Runtime Scenario Proof

- After provider budget is approved, run one Planning Room request.
- Confirm planner participants appear under the active thread.
- Confirm the run remains inspectable after completion.
- After provider budget is approved, run one execute or investigate request.
- Confirm phases appear in order.
- Add a steering note during a safe phase.
- Confirm the note is recorded as structured replay steering evidence and is
  injected into the next safe orchestrator or agent phase, not merely kept as
  local UI text.
- If testing Pause or Cancel, confirm the current path stops and replay evidence
  records the user request; do not treat Pause as a resumable paused-state
  workflow unless a dedicated resume path is added and proven.

Evidence to capture:

- Session id.
- Run id.
- Agent/phase names shown in the left pane.
- Steering event timestamp or trace excerpt.

## 5. Final Gates

- Run `npm run lint`.
- Run `npm run build`.
- Current no-provider automated baseline: `npm run check:premier-no-spend`.
- Run `npm run test:hardening` if server/runtime or safety-sensitive routing code changed.
- If server/runtime code changed, restart OpenHarness and verify:
  - `http://127.0.0.1:3001/api/config`
  - `http://127.0.0.1:5173/`
- Server/runtime changes have been relaunched and reachability verified.

Gate decision rules:

- Client/docs-only changes: lint/build are enough for final static gates; browser refresh is enough for manual UI review.
- Server/runtime changes: lint/build plus restart/reachability proof are required.
- Routing, provider, budget, rate-limit, import/export, shell, patch, or security-sensitive changes: run `npm run test:hardening` unless a narrower checked command is documented with why it covers the touched path. The hardening gate includes Routing Learning import/export schema proof.
- Provider-backed proof runs do not replace lint/build/static gates.
- Manual UI screenshots or notes do not replace runtime scenario proof.

Evidence to capture:

- Command status for each gate.
- Runtime reachability status after any server/runtime restart.

## Closeout Rule

The kickoff is not complete until proof runs, manual UI review, runtime scenario
proof, and final gates all have current evidence. If any evidence is missing or
indirect, keep the goal active and continue from the missing item.

## Evidence Log Template

Copy this block into the session handoff or a release note when doing the final
acceptance pass.

Preferred storage:

- Short-lived continuation: paste the completed log into `NEXT_SESSION.md`.
- Release/readiness record: save the completed log as a dated file under
  `docs/proof/` if a durable artifact is needed. See `docs/proof/README.md`
  for naming, content rules, and the template lane map.
- Current starter evidence file: `docs/proof/2026-06-16-premier-harness-closeout.md`.
- Model Lab eval proof starter template:
  `docs/proof/2026-06-17-model-lab-eval-proof-template.md`.
- Model Lab bench proof starter template:
  `docs/proof/2026-06-17-model-lab-bench-proof-template.md`.
- Manual/browser DOM-notes starter template:
  `docs/proof/2026-06-17-manual-ui-dom-notes-template.md`.
- Runtime scenario trace starter template:
  `docs/proof/2026-06-17-runtime-scenario-trace-template.md`.
- Final-gate log starter template:
  `docs/proof/2026-06-17-final-gate-log-template.md`.
- Same-model strategy comparison starter template:
  `docs/proof/2026-06-17-same-model-strategy-comparison-template.md`.
- Routing Learning evidence starter template:
  `docs/proof/2026-06-17-routing-learning-evidence-template.md`.
- Auto-Router candidate evidence starter template:
  `docs/proof/2026-06-17-auto-router-candidate-evidence-template.md`.
- Worktree isolation evidence starter template:
  `docs/proof/2026-06-17-worktree-isolation-evidence-template.md`.
- Theme texture evidence starter template:
  `docs/proof/2026-06-17-theme-texture-evidence-template.md`.
- Agent Detail steering evidence starter template:
  `docs/proof/2026-06-17-agent-detail-steering-evidence-template.md`.
- Calm Chat artifact-review evidence starter template:
  `docs/proof/2026-06-17-calm-chat-artifact-review-evidence-template.md`.
- Template files are not proof; copy or rename them into dated completed
  evidence artifacts before filling them in, then link completed artifact paths
  back from the closeout log.
- Do not leave closeout evidence only in chat text; link or name exported proof
  files so another reviewer can find them.
- Before saving logs, traces, screenshots, or DOM notes as durable proof
  artifacts, redact provider keys, API tokens, cookies, raw private prompts,
  customer data, and unnecessary private file contents.

```markdown
## Premier Harness Closeout Evidence

Date:
Reviewer:

### Model Lab Eval Proof

- Report id:
- Proof review status:
- Proof brief:
- Proof artifact path(s):
- Same-model prompt strategy id(s):
- Same-model prompt strategy variant id(s):
- Same-model comparison artifact path(s):
- Recommendation report:
- Routing Learning trust state:
- Notes:

### Model Lab Bench Proof

- Bench run id:
- Proof review status:
- Proof brief:
- JSON artifact:
- Proof artifact path(s):
- Same-model prompt strategy id(s):
- Same-model prompt strategy variant id(s):
- Same-model comparison artifact path(s):
- Validation summary:
- Notes:

### Manual UI Review

- Desktop check:
- Narrow-width check:
- Left work queue:
- Right Agent detail:
- Chat/details/artifacts:
- Theme texture readability:
- Phase 7 prompt/routing evidence:
- Screenshot/artifact path(s):
- Issues found:

### Runtime Scenario Proof

- Planning Room session/run id:
- Planning Room evidence:
- Execute/investigate session/run id:
- Execute/investigate evidence:
- Steering event evidence:
- Runtime trace/export path(s):
- Notes:

### Final Gates

- `npm run check:premier-no-spend`:
- `npm run lint`:
- `npm run build`:
- `npm run test:hardening` or scoped substitute:
- Runtime restart/reachability:
- Duplicate Electron/process-shape check:
- Gate log/artifact path(s):
- Remaining risks:
```

## Final Readiness Audit Command

Use this no-spend audit before any final closeout claim:

```bash
npm run check:premier-closeout-readiness
```

The command emits JSON with `closeoutReady`, blocking check ids, runtime reachability, proof/checklist coverage, and live tool-error recovery status.

For final acceptance, run strict mode:

```bash
OPENHARNESS_REQUIRE_CLOSEOUT_READY=1 npm run check:premier-closeout-readiness
```

Strict mode exits nonzero while any blocking evidence item remains unresolved. Do not mark the Premier Harness kickoff goal complete unless strict mode passes and the evidence artifacts named above are durable and redacted.

Approval boundaries that must remain explicit:

- Browser/manual proof pass approval needed.
- Final closeout gates need approval before running local validation.
