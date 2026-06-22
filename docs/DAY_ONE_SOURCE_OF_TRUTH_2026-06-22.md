# OpenHarness Day-One Source of Truth

Date: 2026-06-22
Owner: OpenHarness project
Status: active cleanup and hardening anchor; day-one repair items remediated in working tree with validation/runtime proof captured

This file is the current day-one coordination point for the repo review, cleanup, routing UX, security hardening, and documentation reset. Older plans can remain useful as evidence, but they should not outrank this file unless this file explicitly points to them.

## Product Principle

OpenHarness should feel like a calm, agent-first harness. The main chat is for the user-visible answer and the smallest useful amount of orchestration context. Deep diagnostics belong in detail panes, exports, proof artifacts, and replay surfaces.

Routing decisions should be surfaced in the main chat as one or two high-level lines:

- Good: `Routing: using Qwen3 Coder for code-heavy implementation. Details are in Routing Learning.`
- Good: `Routing: using a planner first because this touches server, UI, and release docs.`
- Avoid in main chat: raw model scores, thresholds, candidate tables, cost tie-break math, classifier JSON, and long router rationales.

Think "ohmyopenagent": clear, high-signal, and human-readable first. Let power users open the detailed trace when they want it.

## Current Canonical Surfaces

- Desktop app: Electron/Vite/Express is the active release surface.
- Runtime server: `server/` is the control plane and highest-risk security boundary.
- UI shell: `src/` is the active product UI. Large panels should be split only when the split directly improves maintainability or performance.
- Swift app: `OpenHarnessApp/` is historical/prototype/regression material unless explicitly reactivated. It should not drive release claims.
- Release proof: `docs/proof/2026-06-19-post-alpha-release-candidate.md` remains the strongest recent release evidence until replaced by a newer proof artifact.
- Security report: the 2026-06-22 Codex Security scan is complete with 311 reviewed rows and 8 reportable medium findings.

## Day-One Security Queue

Repair these before treating the local control plane as hardened:

1. Local mutation guard consistency
   - Fixed: browser-origin mutation checks now run before loopback shortcuts, so cross-site simple POSTs are refused.
   - Fixed: personalization PUT/DELETE use the local mutation/control gate.
   - Fixed: patch proposal validate/commit now use workspace mutation control before running stored validation or git commands.

2. Safe JSON store IDs
   - Fixed: bench runs, checkpoints, task suites, patch proposals, and proposal comments use one safe JSON-store ID/path containment helper.
   - Fixed: checkpoint restore/reapply now refuses checkpoint file paths that escape the project root.

3. Prompt-plugin import boundary
   - Fixed: prompt-plugin root creation and skill import require local mutation control.
   - Fixed: skill import can read without extra approval only from inside the active workspace; out-of-workspace skill imports require an explicit read approval transaction.

4. Dependency refresh
   - Fixed: `npm audit fix` updated Vite/esbuild and vulnerable transitive packages within compatible ranges.
   - Current audit status: `npm audit --json` reports 0 vulnerabilities.

## Routing UX Source of Truth

The routing layer can keep rich detail internally, but product surfaces should be split by audience:

- Main chat: one or two lines, high-level route decision only.
- Status bar: compact current mode/model signal.
- Routing Learning: model scores, margins, classifier rationale, thresholds, historical outcomes.
- Prompt Microscope/proof exports: full trace, prompt assembly, route metadata, replay evidence.

Acceptance criteria:

- Main chat never shows raw scores, thresholds, candidate tables, or JSON classifier output by default.
- Route explanations are written as product copy, not debug logs.
- Every detailed route fact visible in main chat has a discoverable deeper trace elsewhere.

Day-one repair status:

- Fixed: default Auto-Router summary copy no longer includes raw scores or candidate counts and points users to Routing Learning.
- Fixed: router classifier rationale stays in run trace/Prompt Microscope, but the visible thinking stream only reports that routing details were saved.

## UI And Codebase Queue

The repo is functional, but several files are carrying too much responsibility:

- `src/components/SettingsModal.tsx`
- `src/components/ModelLabPanel.tsx`
- `src/components/RoutingLearningPane.tsx`
- `src/components/PatchReviewPanel.tsx`
- `server/index.ts`
- `server/orchestrator.ts`
- `server/autoRouter.ts`

Split only around real ownership boundaries:

- Settings panes and data hooks by domain.
- Model Lab runner, results, and comparison views.
- Routing Learning summary versus detailed diagnostics.
- Server route registration, streaming cleanup, local-control helpers, and orchestration ownership.
- Auto-router scoring, candidate filtering, and user-facing summary formatting.

## Documentation Reset

Keep these as active anchors:

- `README.md`
- `docs/DAY_ONE_SOURCE_OF_TRUTH_2026-06-22.md`
- `docs/POST_ALPHA_RELEASE_PLAN_2026-06-19.md`
- `docs/PREMIER_HARNESS_KICKOFF.md`
- `docs/MODEL_PROMPTING_GUIDE.md`
- `docs/RELEASE_CHECKLIST.md`
- `docs/security/OPENHARNESS_REVIEW_REMEDIATION_LEDGER_2026-06-19.md`

Demote or archive once their evidence has been copied into active anchors:

- `NEXT_SESSION.md`
- Older closeout and one-off proof files under `docs/proof/`
- Superseded roadmap sections in `docs/HARNESS_WORK_ROADMAP.md`
- Old implementation plans that now describe shipped or abandoned surfaces

Do not delete historical proof until each artifact has an explicit disposition:

- keep as current proof
- archive as historical evidence
- replace with newer proof
- remove because it is generated, duplicated, or expired

Day-one cleanup disposition:

- No historical proof, release output, generated artifacts, or `.commandcode/taste/` files were deleted during this repair pass.
- Existing `release/`, `dist/`, `dist-server/`, `node_modules/`, Swift build output, and older proof files remain candidates for a separate cleanup pass only after explicit artifact-by-artifact disposition.
- Follow-up cleanup ledger: `docs/FILE_ARTIFACT_CLEANUP_LEDGER_2026-06-22.md` records explicit keep/archive/remove dispositions for the File And Artifact Cleanup Queue. Only expired ignored `.openharness-*` scratch folders were removed in that pass.

## File And Artifact Cleanup Queue

High-value cleanup candidates:

- `release/` is very large and should be treated as generated release output unless a specific artifact must be retained.
- `dist/` and `dist-server/` are generated build output.
- `node_modules/` is install output.
- `OpenHarnessApp/.build` and other Swift build artifacts should not be part of active review scope.
- Temporary `.openharness-*` smoke or test directories should be removed after proof is captured.
- Proof screenshots and generated data should be consolidated around the release or security report they support.

## Verification Status

Completed during this review:

- Codex Security scan complete in the workbench.
- 311 source/doc rows reviewed after generated and release-output exclusions.
- 8 reportable medium findings validated with static evidence and isolated live proofs where appropriate.
- `npm run lint` passed.
- `npm run build` passed.

Runtime proof captured:

- Stable installed app runtime proof was captured by launching `/Applications/OpenHarness.app` and verifying `http://127.0.0.1:3001/api/config` plus the packaged root page.
- Fresh workspace runtime proof was captured on `http://127.0.0.1:3301` after `npm run build`; `/api/ready`, `/api/config`, `/`, and a live cross-site personalization PUT refusal were verified, then the temporary server was stopped.

Not claimed:

- No destructive file cleanup was performed in this pass. This document defines the cleanup queue before any future artifact removal.

Day-one repair validation captured so far:

- `npm run test:hardening` passed with new regressions for cross-site mutation refusal and JSON-store traversal refusal.
- `npm run test:review-remediation-static` passed with route guard/import approval assertions.
- `npm run test:auto-router-trace-ui` passed with concise default Auto-Router summary assertions.
- `npm run lint` passed.
- `npm run build` passed.
- `npm audit --json` reports 0 vulnerabilities after conservative dependency updates.
