# Post-Alpha Release Plan - 2026-06-19

## Purpose

This is the two-week post-alpha work queue for moving OpenHarness from the
current alpha update line into a calmer, more trustworthy local agent workbench.

The goal is not to add another layer of chrome. The goal is to remove anything
that makes the workspace feel busy, stale, speculative, or hard to trust, then
ship one release candidate with current model metadata, cleaner UI proof, and a
repeatable validation story.

## Review Scope

This plan is based on:

- Repo review of `README.md`, `NEXT_SESSION.md`, `docs/HARNESS_WORK_ROADMAP.md`,
  `docs/PREMIER_HARNESS_KICKOFF.md`, `docs/UI_CLEANUP_PLAN.md`, proof docs,
  model catalog files, theme files, layout files, and the agent-detail proof
  script.
- Live local reachability checks against the running app on ports 5173 and 3001.
- Browser visual review at desktop width and a narrow 390px viewport.
- Current external product research across Codex, Claude Code, Cursor, Devin
  Desktop/Cascade, Gemini, OpenAI, Anthropic, Google, and Mistral docs.

No provider-spend proof is assumed in this plan. Any provider-backed run remains
approval-gated.

## Current Verdict

OpenHarness is much further along than the older roadmaps imply. Chat-first
layout, active work visibility, right-hand Agent detail, steering, Review
Changes, prompt-strategy memory, theme-texture bounds, restart-scope guards, and
worktree-isolation guards now have no-spend proof coverage.

It is not post-alpha-ready yet. The remaining risk is mostly trust and polish:
some docs still describe removed surfaces, the default UI still has floating
islands and heavy shadow contrast, the texture feature is present but needs a
better product pass, model catalog confidence can drift faster than the static
cards, and narrow viewport behavior still needs visual hardening beyond the
static guard.

## Hard Findings

### P0 - Narrow Environment Overlay Can Squeeze Chat Too Far

Visual review at 390px wide showed the floating Environment panel open over the
chat while the chat content reservation still behaved like desktop. The visible
message content collapsed into a tiny vertical strip. The likely source is the
combination of the phone breakpoint for `.floating-super-panel` and the global
`.has-floating-super` rule that reserves `--chat-content-right`.

Relevant files:

- `src/styles/components.css` around `.floating-super-panel`
- `src/styles/components.css` around `.has-floating-super`
- `scripts/test-premier-narrow-layout.ts`

Fix target:

- On `max-width: 480px`, the floating Environment panel should become an
  overlay/drawer without reserving desktop chat width.
- Desktop chat should still reserve space when the right-side panel is open.
- Add/extend a regression that checks the actual mobile reservation rule, not
  just the presence of narrow-layout selectors.

### P0 - Proof Gates Must Stay Green

`npm run test:premier-no-spend` passed after aligning the Agent detail proof
script with current accessible UI semantics. The stale guard expected the old
`Back to chat` label, while the product now exposes `Close Agent detail`.

Relevant file:

- `scripts/test-premier-agent-detail.ts`

Keep this as a release blocker. If the no-spend suite fails, do not package.

### P1 - Default UI Still Reads More Elevated Than Flat

The UI cleanup direction is correct, but the live surface still has more
contrast than the product wants. The biggest offenders are global shadow tokens,
the floating Environment card, modal-style update notes, and rounded island
surfaces competing with the chat canvas.

Evidence points:

- `src/styles/global.css` defines `--shadow-md` and `--shadow-lg` with heavy dark
  opacity.
- `src/styles/components.css` gives `.env-rail-floating .env-card` a 14px
  radius and a large shadow.
- `docs/UI_CLEANUP_PLAN.md` already says shadows should be limited to modals and
  flyouts, with 6px or 8px radii.

Fix target:

- Reduce global shadows to quiet focus shadows and reserve large shadows for
  modals/flyouts.
- Bring Environment into the shell plane instead of a floating card plane.
- Keep accent color for actions and state, not passive card borders.
- Recheck desktop and narrow screenshots after every visual pass.

### P1 - Texture Feature Exists, But Needs A Product Pass

The texture system has good foundations: shell-only overlay, bounded opacity,
recipe list, Settings controls, plugin schema caps, and reduced-transparency
fallbacks. The next step is not "more textures"; it is better texture behavior.

Relevant files:

- `src/styles/components.css`
- `src/components/SettingsModal.tsx`
- `src/theme/builtins.ts`
- `src/theme/themePluginManifest.ts`
- `docs/proof/2026-06-17-theme-texture-evidence-template.md`

Fix target:

- Make texture previews larger and more representative of the actual shell.
- Pair each built-in theme with a sane default recipe and opacity.
- Add a "Calm Matte" or equivalent default that subtly reduces flat-background
  harshness without entering decorative/noisy territory.
- Keep dense reading surfaces, code, terminal, and diffs visually clean.
- Capture manual proof at desktop and narrow widths, plus reduced-transparency
  behavior.

### P1 - Roadmaps Still Contain Old Surface Names

Several docs still reference removed or superseded files and surfaces such as
`DiffViewer.tsx`, `RightPanel.tsx`, and `RunningAgentsStrip.tsx`. Some old
worktree and patch-review items are more advanced in code than the docs suggest.

Relevant docs:

- `docs/HARNESS_WORK_ROADMAP.md`
- `docs/UI_CLEANUP_PLAN.md`
- `docs/PREMIER_HARNESS_KICKOFF.md`

Fix target:

- Treat `ReviewChangesFlyout`, `PatchReviewPanel`, `AgentFocusPanel`, and the
  current layout shell as canonical.
- Move old file names into a short "superseded names" note only if needed for
  historical context.
- Remove old pending items that are now proven, or restate the real remaining
  polish gap.

### P1 - Release Labels Drift

`package.json` is on `1.0.0-alpha.update.2`; the README prerelease label was one
update behind. That mismatch is small, but it is exactly the sort of release
paper-cut that creates confusion during packaging.

Fix target:

- Keep package version, README packaging text, release notes, updater metadata,
  and built artifacts in sync before every alpha/post-alpha push.

### P1 - Patch Notes Modal Fights The Calm Workspace

Patch notes are useful, but the current first-launch modal interrupts the
default workspace. For ordinary updates, this should become a quiet release-note
banner/toast with "View notes" and a durable Settings entry. Reserve modal
treatment for breaking migrations or explicit setup decisions.

Relevant file:

- `src/App.tsx`

### P2 - Model Catalog Cards Need Freshness And Source Discipline

The current catalog is valuable, but static cards can outrun official provider
docs. Post-alpha should treat model cards as refreshable metadata with source
age and confidence, not permanent truth.

Relevant files:

- `src/data/modelCatalog.ts`
- `server/modelMetadata.ts`
- `docs/MODEL_LANDSCAPE.md`

Fix target:

- Add source freshness fields and "verified at" dates for curated cards.
- Keep official provider metadata and OpenRouter-style metadata separate from
  editorial review summaries.
- Show stale/unverified cards in the UI before the router uses them as strong
  recommendations.

### P2 - Control-Plane Concentration Remains A Release Risk

`server/index.ts` still owns too many routes and runtime concerns. This should
not become a week-one rewrite, but the post-alpha plan should inventory route
ownership and start extracting only obvious, low-risk seams after the release
candidate stabilizes.

Relevant file:

- `server/index.ts`

### P2 - Demo/Mock Data Must Be Audited

Settings still imports mock skills, plugins, and memory entries. Some mock data
is acceptable for empty-state design, but anything user-facing should either be
clearly demo-labeled, backed by real local data, or hidden until wired.

Relevant files:

- `src/components/SettingsModal.tsx`
- `src/utils/mockData.ts`

## Removal Candidates

Remove or stop investing in these unless a direct user need reopens them:

- Permanent drag/drop workspace layout as a default interaction.
- Permanent `sub-agents` split as a visible user concept.
- Duplicate diff/patch entry points now that Review Changes is canonical.
- Blocking patch-note modal for ordinary updates.
- Decorative shadows, nested cards, and floating panel islands in the default
  workspace.
- Fake or optimistic agent progress where run-trace events exist.
- Stale roadmap tasks that point to removed files.
- User-visible mock Skills/Memory/Plugin content that is not clearly marked as
  demo data.

## Missing Features From Current Agent Tools

These are the strongest external-product gaps worth turning into OpenHarness
work, based on current official docs:

- Background task supervision: Codex, Claude Code, and Cursor all emphasize
  background or parallel agent work. OpenHarness has active-work visibility, but
  needs a durable attention inbox for completed, blocked, failed, and waiting
  work.
- Reusable agent workflows: Claude Code and Devin/Cascade expose workflows,
  hooks, and agent/team patterns. OpenHarness should support saved workflow
  templates before adding more one-off orchestration branches.
- Permission and sandbox explainability: Codex documentation centers sandboxing,
  approvals, and instruction layering. OpenHarness has trust modes and restart
  hygiene, but needs a clearer "why this action is allowed" trail for tools,
  files, network, and worktrees.
- Preview feedback loop: Devin Desktop/Cascade previews can capture app context,
  errors, and selected elements back into the agent. OpenHarness BrowserPanel
  should grow a "send element/error/screenshot to run" loop.
- Review bot flow: Cursor BugBot and Codex-style PR/change review set the bar
  for automatic review of diffs. Review Changes should become the canonical
  route into review, patch proposal, validation, and release prep.
- MCP install/auth polish: Cursor and Devin/Cascade make MCP setup visible and
  OAuth-oriented. OpenHarness already has MCP surfaces, but post-alpha should
  make auth state, install errors, and smoke tests feel first-class.
- Model freshness: OpenAI, Anthropic, Google, and Mistral model pages change
  faster than static roadmap prose. OpenHarness needs a model metadata refresh
  ritual before model-routing release claims.

Research sources:

- [OpenAI Codex agent approvals and security](https://developers.openai.com/codex/agent-approvals-security)
- [OpenAI Codex sandboxing](https://developers.openai.com/codex/concepts/sandboxing)
- [OpenAI Codex AGENTS.md](https://developers.openai.com/codex/guides/agents-md)
- [OpenAI Codex subagents](https://developers.openai.com/codex/subagents)
- [OpenAI Codex skills](https://developers.openai.com/codex/skills)
- [Claude Code subagents](https://code.claude.com/docs/en/sub-agents)
- [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- [Claude Code hooks](https://code.claude.com/docs/en/hooks)
- [Cursor changelog 1.0](https://cursor.com/changelog/1-0)
- [Devin Desktop/Cascade overview](https://docs.devin.ai/desktop/cascade/cascade)
- [Devin Desktop previews](https://docs.devin.ai/desktop/previews)
- [Devin Desktop hooks](https://docs.devin.ai/desktop/cascade/hooks)
- [Gemini API models](https://ai.google.dev/gemini-api/docs/models)
- [OpenAI model docs](https://developers.openai.com/api/docs/models/all)
- [Anthropic model overview](https://platform.claude.com/docs/en/about-claude/models/overview)
- [Mistral model overview](https://docs.mistral.ai/models/overview)

## Two-Week Heavy Work Plan

### Week 1 - Trust, Flat UI, And Proof

Day 1: Fix release blockers and narrow layout.

- Keep `npm run test:premier-no-spend` green.
- Fix the narrow Environment overlay reservation bug.
- Sync README/package/release-note version labels.
- Inventory stale roadmap references to removed components.
- Acceptance: no-spend suite passes, desktop app remains reachable, and 390px
  browser proof shows readable chat with Environment open and closed.

Day 2: Flatten the shell.

- Reduce global shadow tokens and passive elevated-card styling.
- Bring Environment into the workspace plane.
- Normalize default radii around 6px/8px except true modals/flyouts.
- Quiet passive accents in status, cards, and badges.
- Acceptance: visual proof at desktop and narrow widths; no text overlap; no
  heavy floating island in the default workspace.

Day 3: Upgrade textures.

- Improve Settings texture previews.
- Add one calm default texture pass that reduces harsh canvas contrast without
  harming readability.
- Pair built-in themes with safer recipe/opacity defaults.
- Ensure code, terminal, diffs, and dense text stay texture-clean.
- Acceptance: theme-texture regression passes plus manual proof for dark, light,
  narrow, and reduced-transparency cases.

Day 4: Remove stale surfaces and calm release notes.

- Convert ordinary patch notes from modal-first to quiet banner/toast-first.
- Keep Settings release notes as the durable full history.
- Reconcile docs around Review Changes, Agent detail, and removed component
  names.
- Audit mock Settings data and either wire real data or mark/hide demo content.
- Acceptance: roadmap search no longer presents removed components as current
  implementation targets.

Day 5: Week-one proof closeout.

- Run no-spend gates, lint, and build.
- Capture desktop and narrow UI proof.
- Update proof docs with exact artifact paths.
- If server/runtime changed, relaunch and verify ports 3001 and 5173. If only UI
  changed, browser refresh is enough.
- Acceptance: a release-candidate checklist can start without first cleaning up
  known UI/doc debt.

### Week 2 - Model Freshness, Workflow Depth, And Release Candidate

Day 6: Refresh model metadata discipline.

- Add or improve a source-refresh report for model catalog cards.
- Separate official/provider metadata from editorial recommendations.
- Add "verified at" and stale-card UI behavior where appropriate.
- Acceptance: model-routing claims can name their source age and confidence.

Day 7: Improve router explanations.

- Show why a model won, why close alternatives lost, and whether a card is stale.
- Tie tool-error memory and prompt-strategy outcomes into candidate rows without
  making Settings noisy.
- Acceptance: Auto-Router decisions are explainable to a user tuning models.

Day 8: Add an attention inbox for background work.

- Summarize completed, blocked, failed, and waiting runs in one quiet place.
- Preserve links to run trace, proof, artifacts, and review actions.
- Acceptance: background work can finish without forcing the user to watch the
  chat stream.

Day 9: Add workflow and hook MVP.

- Start with safe local workflow templates: plan, implement, review, validate,
  release-prep.
- Add explicit pre/post-run hook boundaries and proof logging before any broad
  automation.
- Acceptance: workflows are reusable and inspectable without bypassing trust
  mode or approval boundaries.

Day 10: Release-candidate packaging and proof.

- Finalize release notes, version labels, updater metadata, and docs.
- Run `npm run test:premier-no-spend`, `npm run lint`, and `npm run build`.
- Ask for provider-backed proof approval only if live provider claims are in the
  release notes.
- Validate runtime with a stable installed OpenHarness.app path, not a temporary
  bundle.
- Build all platform artifacts with `npm run dist:all` only after the proof set
  is clean.
- Acceptance: post-alpha release candidate has matching docs, packages, release
  notes, updater metadata, and validation evidence.

## Final Gates

Do not ship the post-alpha release unless all of this is true:

- Desktop and narrow visual proof show no overlapping or squeezed text.
- Default UI is flatter, calmer, and still clearly scannable.
- Texture presets are subtle, bounded, and proven with reduced transparency.
- `npm run test:premier-no-spend` passes.
- `npm run lint` passes.
- `npm run build` passes.
- Any server/runtime changes were relaunched and app reachability was verified.
- Release notes, README, package version, updater metadata, and built artifacts
  agree on the same version.
- Provider-backed claims either have approved live proof or are explicitly marked
  as not yet provider-validated.

## Paste-Ready Next Session Prompt

```text
/goal Use docs/POST_ALPHA_RELEASE_PLAN_2026-06-19.md as the source of truth.

You are Friday in /Users/kevink/Projects/OpenHarness. Continue the post-alpha
release plan from the first unchecked Day 1 item.

Rules:
- Keep changes surgical and repo-grounded.
- If server/runtime code changes, kill old OpenHarness processes, relaunch, and
  verify reachability on ports 3001 and 5173.
- If only UI/docs/tests change, do not restart the app; tell me a browser refresh
  is enough.
- Keep provider-spend proof approval-gated.
- Preserve `npm run test:premier-no-spend` as a release blocker.

Start by fixing the narrow Environment overlay/chat squeeze, then capture desktop
and 390px proof before moving to flatter shell tokens.
```
