# MiniMax M3 Long-Running Research — M13 vs M14 vs M15

Date: 2026-05-31
Author: MiniMax M3 (read-only research spike)
Scope: `/Users/kevink/Projects/CMDui`
Working tree at start: 1 unstaged change — `docs/HARNESS_WORK_ROADMAP.md` (Assignment 8 + Currently Pending Question sections). Preserved untouched.
Process state at start: no app/server processes inspected or killed. Static repo read only.

---

## 1. Executive recommendation

**Pick: M15 P0 — Patch Review UI (P0 from the "Currently Pending Question" list, which is also Assignment 1 in the Recommended Assignment Order).**

Recommendation rationale, in one line: it is the only one of the three options that (a) closes a real, already-known P0 gap with concrete existing seams to extend, (b) is a prerequisite both M13 and M14 will need in order to land their headline features, and (c) can be implemented in surgical, independently committable phases without redoing discovery.

Why M15 wins over the other two:

- **Closes the longest-standing gap.** The "Patch proposal flow" section in Milestone 4 (P1 in the roadmap) and Assignment 1 in the Recommended Assignment Order are still open. The roadmap's own Correctness Review says: "Patch proposal review is still incomplete: the type and patch-apply endpoint exist, but there is no first-class UI for file-by-file / hunk-by-hunk accept-reject plus post-apply validation."
- **Has the most existing code to extend.** The repo already has a `ProposedPatch` type, a `PatchProposalInfo` mirror in `src/utils/api.ts`, a working `/api/patches/apply` route, a populated `DiffViewer` panel, project-profile `validation` commands, and a battle-tested `benchRuns.runValidation()` runner. M13 has *zero* of those seams; M14 has only a 4.7 KB screencapture hack.
- **Unblocks M13 and M14.** Once patch review is real, the multi-agent runtime (M13) can deliver implementer/reviewer handoffs as `ProposedPatch` records, and the browser verification path (M14) can use the same review UI for visual diffs and "browser-tester" agent output. M13 and M14 as currently scoped have nothing in the repo they can plug into.
- **Closes a real safety bug, not just a UX gap.** The existing `/api/patches/apply` route shells out to the system `patch` binary from the server's working directory, with no `workingDir` scoping and no trust-mode check (see `server/index.ts:839-845` and `server/patchApply.ts:16-65`). M15 P0 forces the workingDir-aware rewrite that must happen before any model-driven patch is acceptable.

M14 (Browser Capture) is a worthy P1 but a much bigger scope rebuild: it requires swapping the curl+screencapture hack in `server/browserPreview.ts` for a real headless browser (DOM, a11y, console, network, scripted journeys). That is more like a "mini project" than a single milestone. Defer to right after M15 P0 lands.

M13 (Agent Profiles) is the greenest field: `server/agentProfiles.ts` does not exist anywhere in the repo, `SubAgentTracker.tsx` and `PlanTracker.tsx` are display shells with no children-rendering or handoff, and there is no multi-agent plumbing in `server/orchestrator.ts` (it returns a prompt instruction string, not a multi-step dispatcher — see `server/orchestrator.ts:5-48`). It is real work and worth doing, but M15 is a strictly better first step.

---

## 2. Repo evidence

All paths verified by reading the file on disk during this spike.

### 2.1 What is already on disk for M15

- `src/types/index.ts:270-277` — `ProposedPatch` interface:

  ```ts
  interface ProposedPatch {
    id: string;
    file: string;
    action: 'create' | 'update' | 'delete';
    diff: string;
    explanation: string;
    status: 'pending' | 'accepted' | 'rejected' | 'applied';
  }
  ```

- `src/utils/api.ts:756-774` — `PatchProposalInfo` mirror type and the only existing client function `applyPatch(patch: string)` that hits `POST /api/patches/apply`. There are **no** `listProposals`, `createProposal`, `acceptProposal`, `rejectProposal`, or `applyProposal` functions in `api.ts`.
- `server/index.ts:36, 837-846` — server imports `applyPatch as nodeApplyPatch` and exposes exactly one route:

  ```ts
  app.post('/api/patches/apply', (req, res) => {
    const { patch } = req.body as { patch?: string };
    if (!patch?.trim()) return res.status(400).json({ error: 'patch is required' });
    try {
      const result = nodeApplyPatch(patch);
      res.json(result);
    } catch (err: any) { res.status(502).json({ error: err.message }); }
  });
  ```

  The route takes raw unified-diff text, not a `ProposedPatch`, and has **no `workingDir` argument and no trust-mode gate**.
- `server/patchApply.ts:1-65` — `applyPatch(patchText: string)` shells out to `patch -p1 --no-backup-if-mismatch` from the server's CWD via `execSync`. Parses only `diff --git a/X b/X` headers. No hunk-level parsing, no per-file state, no rollback, no test run.
- `src/components/DiffViewer.tsx:1-290` — fully rendered file-list + per-file unified diff panel. Loads `api.getGitStatus` / `api.getGitDiff`. Buttons per file: `Stage`, `Unstage`, `Review`, `Explain`. **No per-hunk or per-file accept/reject of a proposed patch.** Mounted via `src/components/layout/PanelContent.tsx:41` with the `diffs` panel id.
- `src/components/InlineComment.tsx:1-18` — 18 lines. Pure read-only display of `{ title, body, file, startLine, endLine?, priority }`. No creation, no severity beyond the existing 0-3 priority field, no resolved state, no persistence, no link to a real diff context. Mounted only by `src/components/MessageBubble.tsx:44-58` which parses a `::code-comment{...}` directive out of assistant message text — so comments only appear when the model literally prints the directive syntax.
- `src/components/layout/PanelContent.tsx:35-58` — the panel registry dispatcher. Adding a new `patches` panel slot is a one-line `case`.
- `src/components/layout/panelRegistry.tsx:30-40` — `panelConfigs` has 10 slots already; no `patches` slot yet.
- `src/utils/api.ts` (1362 lines total) — sufficient to confirm no client patch-proposal endpoints are wired.

### 2.2 Validation-after-apply seams that already exist

- `server/benchRuns.ts:11-20` — `ValidationCommandResult` interface is already shaped correctly.
- `server/benchRuns.ts:91-145` — `runValidation(commands: string[], workingDir: string)` spawns `/bin/zsh -lc <cmd>` per command, captures stdout/stderr, returns `{ command, exitCode, passed, durationMs, ... }`. This is the exact primitive needed for "run configured validation after applying a patch." Already in production use by the bench tab.
- `server/harnessTasks.ts:14-18` — `HarnessTask` already carries `verificationCommands: string[]`. Built-in fixtures (`server/harnessTasks.ts:208, 223`) include `'git diff --stat'`, `'npm run lint'`, `'test -f README.md'`. M15 P0 can either borrow this shape or invent a parallel `ProjectPatch.verificationCommands[]`.
- `server/projectProfile.ts:17-18, 72-78, 163-180` — `ProjectProfile.validation` already surfaces `build`/`test`/`lint`/`typecheck` commands. M15 P0 should default the post-apply validation list to `ProjectProfile.validation.lint` + `npm run typecheck` (or `tsc --noEmit`) when the project has them, before falling back to user-supplied commands.

### 2.3 What is missing for M15 (the seams that need to be added)

- **Server side** (`server/index.ts` + new `server/patchProposals.ts`):
  - In-memory or disk-backed `PatchProposalStore` keyed by proposal id, holding an array of `ProposedPatch` plus proposal-level metadata (session id, originating run id, workingDir, verificationCommands, createdAt).
  - `POST /api/patch-proposals` — accept a single patch text, parse it into per-file `ProposedPatch` records, return the proposal id.
  - `POST /api/patch-proposals/:id/hunks/:fileId/accept` and `…/reject` — per-hunk/per-file accept-reject that marks a sub-record as accepted.
  - `POST /api/patch-proposals/:id/apply` — apply **only** the accepted sub-records, with `workingDir` scoping and trust-mode gating, then run `runValidation(verificationCommands, workingDir)`, return `{ appliedFiles, validationResults, patchResult }`.
  - `GET /api/patch-proposals/:id` — fetch the current proposal state.
  - **Hardening for the existing apply route**: add `workingDir` body argument, refuse if outside workspace, gate by `filterToolsForTrustMode` from `server/toolPolicy.ts:7` (it already has a `workspace-write` policy at line 68 that scopes paths to `workingDir`).
- **Parser seam** (`server/patchParse.ts`, new):
  - A small unified-diff parser that splits a `diff --git` blob into `{ filePath, oldPath?, action, hunks: { header, lines: { kind: 'context' | 'add' | 'del', text, oldLine, newLine }[] }[] }[]`. Avoid pulling a full library; the format is well-defined and the existing 65-line `patchApply.ts` shows the rest of the team can write the surface.
- **Run-trace seam** (`server/runTrace.ts`):
  - Add two new `HarnessRunStep` variants: `patch_proposed` and `patch_applied`. The orchestrator already calls `appendRunStep` for tool calls (see `server/index.ts:1476, 1491, 1575, 1578`); the new steps fit the same shape.
- **Client side**:
  - `src/utils/api.ts` — add `listPatchProposals`, `createPatchProposal`, `acceptHunk`, `rejectHunk`, `applyPatchProposal`, plus a `PatchProposal` interface (one proposal containing many `ProposedPatch` hunks).
  - New `src/components/PatchReviewPanel.tsx` mounted in `PanelContent.tsx` and registered in `panelRegistry.tsx` with id `patches`.
  - `src/components/DiffViewer.tsx` — wire a "Propose patch from this diff" action that, when the user clicks it, takes the current diff and posts it to `createPatchProposal` then opens the new panel.
  - `src/components/InlineComment.tsx` — add a "severity" label derived from `priority` and a "resolved" checkbox; persist `resolved` via a small `PATCH /api/inline-comments/:id` (or local store keyed by `file:startLine`).

### 2.4 Evidence for the other options (so the choice is not made in a vacuum)

- **M13 (Multi-Agent Team Runtime)**: `grep -rn "agentProfiles" server/ src/` returns zero matches. `server/orchestrator.ts` is 48 lines and only produces a prompt instruction string. `SubAgentTracker.tsx:65-194` is a display shell: it does not render `agent.children` (the type allows nested agents at `src/types/index.ts:128`, but the UI never reads it). `PlanTracker.tsx:1-45` is a 45-line progress bar. There is no in-flight agent dispatcher and no per-agent tool-policy override; building all of that is a much larger surface than the patch review UI.
- **M14 (Deep Browser and UI Verification)**: `server/browserPreview.ts` is 146 lines and uses `execSync('curl ...')` plus `osascript` to drive `screencapture`. It returns `{ url, screenshotPath, screenshotBase64?, title?, timestamp, errors[] }` — no DOM, no a11y tree, no console, no network. `src/components/BrowserPanel.tsx` is a single-URL viewer with a "smoke check" button that calls `checkServerHealth` (just a curl ping). Replacing the headless capture is essentially a Playwright/Puppeteer integration project on top of which the rest of M14 can land.

---

## 3. Dependency graph

```
                ┌──────────────────────────────────────────┐
                │  M4 patch-proposal gap (P0, open since   │
                │  Phase 4, also Assignment 1)             │
                └────────────────┬─────────────────────────┘
                                 │ closes
                                 ▼
                ┌──────────────────────────────────────────┐
                │  M15 P0 — Patch Review UI                │ ◀── recommended next
                │  (propose, accept/reject, validate)      │
                └────┬─────────────────────────────┬───────┘
                     │                             │
        unblocks     │                             │    reuses
                     ▼                             ▼
   ┌────────────────────────────┐   ┌─────────────────────────────┐
   │  M13 — Multi-Agent Team    │   │  M14 — Browser & UI         │
   │  (implementer/reviewer/    │   │  Verification (browser-     │
   │  debugger hand off via     │   │  tester agent output flows  │
   │  ProposedPatch records)    │   │  through the same review UI)│
   └────────────────────────────┘   └─────────────────────────────┘
```

Key observations:

- M15 P0 is a **prereq** for the agent handoff piece of M13 (an "implementer" agent in M13 has nothing to deliver without `ProposedPatch` records the UI knows how to review).
- M15 P0 is **not** a hard prereq for M14, but reusing the same Patch Review UI for visual diffs in M14 keeps the user model consistent ("any model change, whether code or visual, goes through the same review").
- M15 P1 (inline comments) and M15 P1 (commit/PR) can be sequenced in either order once P0 lands, but PR work depends on GitHub auth wiring that is out of scope here.
- M13 P0 (agent profiles) does not require M15 to land first, but shipping M13 before M15 would mean implementer agents can write to disk without any review, which contradicts the trust/safety posture of `server/toolPolicy.ts:7-90`.

---

## 4. Implementation plan

Each phase is one branch, one PR, and ships behind a feature flag (`VITE_PATCH_REVIEW=1`) until the next phase lands. Do **not** skip the feature flag in phase 1.

### Phase 1 — Server-side proposal resource and parser

- Create `server/patchParse.ts` with a pure `parseUnifiedDiff(text): ParsedFile[]` and a `serializeHunks(files): string` inverse.
- Create `server/patchProposals.ts` with an in-memory `Map<id, PatchProposal>` (disk-backed JSONL under `~/.open-harness/patch-proposals/` for durability).
- Add 5 routes to `server/index.ts` (placeholder bodies OK in this phase).
- **Hardening**: rework the existing `/api/patches/apply` route to require `workingDir` and refuse when outside the project workspace; gate by trust mode via `filterToolsForTrustMode`.
- **Validation**: `npm run lint && npm run build` and a curl smoke against `/api/patch-proposals` with a hand-crafted unified diff.

### Phase 2 — Client types and API client

- Add `PatchProposal`, `PatchHunk`, `PatchValidationResult` interfaces in `src/types/index.ts`.
- Add `createPatchProposal`, `getPatchProposal`, `acceptHunk`, `rejectHunk`, `applyPatchProposal` to `src/utils/api.ts`.
- Mirror the new shapes in the existing `PatchProposalInfo` interface so the legacy type does not drift.
- **Validation**: `npm run lint && npm run build`.

### Phase 3 — Patch Review Panel UI (read-only)

- Register `patches` panel in `src/components/layout/panelRegistry.tsx:30-40`.
- Create `src/components/PatchReviewPanel.tsx` that lists proposals, opens one, and shows a file-by-file hunk list with `Accept` / `Reject` buttons (state held in React until "Apply" is clicked; do not call the network on every toggle).
- Mount in `src/components/layout/PanelContent.tsx`.
- **Validation**: manual smoke. Open the new panel, paste a diff, accept one hunk, reject another, confirm the "Apply" button shows the right preview.

> **Stop here for human review.** This is the smallest end-to-end loop.

### Phase 4 — Wire validation after apply

- On `applyPatchProposal`, call `benchRuns.runValidation(proposal.verificationCommands, proposal.workingDir)` (reuse the existing function).
- Render the result inline in `PatchReviewPanel.tsx`. Color-code pass/fail per command.
- Default `verificationCommands` from `ProjectProfile.validation.lint` + `'tsc --noEmit'` (if the project is TypeScript) when the proposal did not specify its own.
- **Validation**: `npm run lint && npm run build`, then manual: apply a small change that breaks lint, confirm the UI shows the failure without rolling the patch back.

### Phase 5 — Wire DiffViewer into the proposal flow

- In `src/components/DiffViewer.tsx`, replace the current "Review" button's behavior: when the diff originates from a model message (new prop), route to `createPatchProposal(diff)` and open the new panel.
- Add an "Apply" button to `DiffViewer.tsx` that shows only when the file is part of an active proposal.
- **Validation**: manual: in CMDui, run an "implement a function" task, watch the proposal appear in the new panel, accept, validate, see the file change in the diff panel.

### Phase 6 (optional, in this milestone) — Inline comment severities + resolve state

- Extend `InlineComment` with `severity: 'info' | 'warn' | 'error'` (alias from `priority`) and `resolved: boolean`.
- Persist via a tiny in-memory store keyed by `file:startLine` (disk persistence deferred).
- `src/components/InlineComment.tsx`: add a checkbox; the existing `priority-0..3` CSS in `src/styles/components.css:1181-1196` is sufficient for the visual variant.
- **Validation**: `npm run lint && npm run build`, manual: load a message that contains a `::code-comment{...}` directive, mark resolved, confirm UI persists during the session.

Phases 1-5 close M15 P0 ("Finish patch proposal UI"). Phase 6 starts M15 P1 ("inline review comments"). Commit and PR work is the third M15 P1 item and is intentionally out of scope for this plan — it needs GitHub auth wiring.

---

## 5. Data contracts

Sketch only. Implementation agent should keep these shapes stable for at least one minor version.

```ts
// server/patchParse.ts
export type HunkLine = {
  kind: 'context' | 'add' | 'del';
  text: string;
  oldLine?: number;
  newLine?: number;
};

export type ParsedHunk = {
  header: string;          // "@@ -a,b +c,d @@"
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: HunkLine[];
};

export type ParsedFile = {
  filePath: string;
  oldPath?: string;
  action: 'create' | 'update' | 'delete';
  binary: boolean;
  hunks: ParsedHunk[];
};

// server/patchProposals.ts
export type HunkStatus = 'pending' | 'accepted' | 'rejected';

export interface PatchHunk {
  id: string;            // stable within a proposal
  fileId: string;
  status: HunkStatus;
  parsed: ParsedHunk;
}

export interface PatchFile {
  id: string;            // stable within a proposal
  filePath: string;
  action: 'create' | 'update' | 'delete';
  diff: string;          // full per-file diff text
  status: HunkStatus;    // rollup: 'accepted' if all hunks accepted, 'rejected' if all rejected, else 'pending'
  hunks: PatchHunk[];
}

export interface PatchProposal {
  id: string;
  sessionId: string;
  runId?: string;        // ties to a HarnessRun.id from server/runTrace.ts
  workingDir: string;
  explanation: string;
  source: 'model-message' | 'diff-viewer' | 'manual';
  files: PatchFile[];
  verificationCommands: string[];
  createdAt: string;
  updatedAt: string;
}

// Wire responses
export interface ApplyPatchProposalResult {
  proposalId: string;
  appliedFiles: string[];
  skippedFiles: string[];
  errors: string[];
  validation: Array<{
    command: string;
    passed: boolean;
    exitCode: number;
    stdout: string;
    stderr: string;
    durationMs: number;
  }>;
  validationPassed: boolean;
}

// Extend HarnessRunStep in server/runTrace.ts
//   | { type: 'patch_proposed'; proposalId: string; fileCount: number; hunkCount: number }
//   | { type: 'patch_applied'; proposalId: string; appliedFiles: string[]; validationPassed: boolean }
```

---

## 6. UI flow

### 6.1 Happy path

1. User runs an "implement X" task in the chat panel.
2. The model returns a message containing (or attached as a tool-call artifact) a unified diff.
3. The chat panel detects the diff, posts it to `POST /api/patch-proposals`, gets back `{ id }`, and shows a "Review patch" button next to the message.
4. Clicking the button switches the layout to the new `patches` panel and opens the proposal.
5. The panel renders, per file, the unified diff with a checkbox next to each hunk. By default all are accepted (green check); the user can flip to rejected (red X).
6. The "Apply" button is enabled whenever at least one hunk is accepted. Clicking it:
   - Pre-flight: confirms trust mode is at least `ask-before-write`.
   - Posts `POST /api/patch-proposals/:id/apply` with the current hunk set.
   - On success, the panel shows a per-command validation result list (pass/fail, exit code, 1-line stderr preview) and a "Close" button.
7. Switching to the `diffs` panel shows the newly staged/unstaged file list reflecting the applied changes.

### 6.2 Empty / error states

- **Empty proposal**: "No patch proposals yet. Run an 'implement X' task or paste a diff to start."
- **No accepted hunks**: "Apply" button is disabled with helper text "Accept at least one hunk to apply."
- **Patch fails to apply** (system `patch` rejects): show the captured `errors[]` from `PatchResult` and offer "Discard proposal" / "Show raw diff" / "Copy diff to clipboard."
- **Validation fails**: show a yellow banner with the failing command(s) and a "Show stderr" expander. Do **not** auto-rollback the patch (out of scope; the user can use `git checkout -- <file>` from the terminal panel).
- **WorkingDir is outside workspace** (only reachable by a buggy client): server returns 400 and the panel shows "This patch targets a path outside the project. Apply refused."
- **Trust mode is `read-only`**: pre-flight refuses; panel shows "Switch to 'ask-before-write' or higher to apply."

### 6.3 Edge cases

- **Multiple proposals open at once**: each proposal is independent; the panel lists them in reverse-chronological order with a small badge showing file count.
- **Proposal is huge** (say, > 5 MB of diff): the parser should reject with a 413 and a helpful error; the client should show a truncation warning.
- **Binary files** in the diff: parser marks `binary: true`; UI hides the diff body and shows "Binary change — apply will replace the file in full."
- **Hunk header mismatch** (line counts off): the parser still produces the parsed shape, but the panel shows a red warning "Hunk header does not match the current file. Apply may fail." Apply still proceeds and the existing `patch --dry-run` gate catches the failure.
- **User navigates away mid-apply**: the server is the source of truth; reopening the proposal shows the latest status. There is no client-side optimistic state to lose.

---

## 7. Validation plan

### 7.1 Static checks

- `npm run lint` — must pass.
- `npm run build` — must pass; the new `server/patchParse.ts` and `server/patchProposals.ts` must compile under the `tsconfig.server.json` config that already includes the rest of the server.

### 7.2 Unit/manual checks (per phase)

- **Phase 1**: hand-craft a 3-file unified diff (1 create, 1 update, 1 delete), POST to `/api/patch-proposals`, GET it back, confirm the parsed shape round-trips.
- **Phase 2**: type-check only.
- **Phase 3**: open the new panel, paste the same diff, flip a hunk to rejected, confirm the "Apply" button is disabled and shows the right count.
- **Phase 4**: apply a one-line change to a real file in the working tree, confirm `runValidation` runs the project's `lint` and `tsc --noEmit` (when present), confirm the result renders.
- **Phase 5**: full loop in the actual CMDui app: chat -> model returns diff -> "Review patch" button appears -> panel opens -> accept one hunk, reject another -> apply -> validation runs -> file appears in `DiffViewer`.
- **Phase 6**: load a model message that contains a `::code-comment{...}` directive (the parser is in `src/components/MessageBubble.tsx:44`), mark resolved, confirm persistence for the session.

### 7.3 App relaunch

Per AGENTS.md rule 1, after any server change the agent must kill the existing app and relaunch with `npm start`. Per the Global Verification Checklist in the roadmap: confirm `http://127.0.0.1:3001` is reachable, confirm `http://127.0.0.1:5173` is reachable, smoke-test one real prompt, confirm `git status` shows no unrelated modifications.

### 7.4 Credential / provider smoke

The roadmap also calls out: "Existing MiniMax compatibility should be verified with a credential-backed live smoke test before marking the provider acceptance item complete." This is **out of scope for M15 P0**, but the implementation agent should not regress it; the existing eval pipeline (`server/evals.ts` + the Bench tab) is the place to confirm it. Note that Assignment 2 in the Recommended Assignment Order is the owner of that smoke test.

---

## 8. Risks and rollback

### 8.1 Git state and user work

- The working tree at the start of this spike has 1 unstaged modification: `docs/HARNESS_WORK_ROADMAP.md` (the new Assignment 8 + Currently Pending Question sections). **Do not touch this file in the implementation phase.** `git status --short` should still show exactly that one line after the implementation PR is staged.
- The implementation will create new files only (`server/patchParse.ts`, `server/patchProposals.ts`, `src/components/PatchReviewPanel.tsx`) and edit a small set of seams listed in section 2.3. No `git mv`, no broad `prettier` runs, no dependency upgrades.

### 8.2 Patch application safety

- The current `/api/patches/apply` route is a real safety bug: it accepts arbitrary unified-diff text and applies it in the server's CWD with no `workingDir` scoping. Phase 1 must close this. A safe rollout is: keep the old route working for one release behind the feature flag, but add a server log warning when it is hit, and have the new `applyPatchProposal` route be the supported path going forward. The feature flag gives us a one-PR window to detect and revert if a regression appears.
- A failed apply must never leave the working tree half-patched. The `patch --dry-run` gate in `server/patchApply.ts:33-39` is the right safety net, but the implementation agent should add a smoke test that proves it (a diff that applies to `foo.txt` but not `bar.txt` must be rejected before any disk write).

### 8.3 User changes

- The new flow should never silently discard user edits. If a hunk's old-side text does not match the current file, the apply must fail loudly (per the section 6.3 edge case). The `PatchReviewPanel` must always be reachable from a banner on the `DiffViewer` so the user can compare their unsaved work against the proposed patch.

### 8.4 Runtime processes

- The `start.mjs` script (`scripts/start.mjs`) launches both the server (`tsx server/index.ts`) and Vite. Per AGENTS.md rule 1 and the Global Verification Checklist, after any server change the implementation agent must kill the prior `tsx`/`vite` processes and relaunch. The patch-proposal endpoints are pure HTTP and do not introduce new long-running child processes, so the only new spawns are the short-lived `/bin/zsh -lc <validation-cmd>` ones inside `runValidation` (already capped at 60 s in `server/benchRuns.ts:108`).

### 8.5 Rollback plan

- Each phase is its own PR. Reverting the PR is the rollback. No migration scripts touch user data; the on-disk store under `~/.open-harness/patch-proposals/` is additive (Phase 1 only writes; the rest only reads). If Phase 4 validation behavior surprises us, feature-flag it off in `App.tsx` and the user is back to the old M4 patch-proposal status quo.

---

## 9. Follow-up implementation prompt

One prompt the next agent can paste after human approval. It assumes the user said "go" on M15 P0.

```text
You are implementing Milestone 15 P0 — Patch Review UI — inside /Users/kevink/Projects/CMDui.
The full research brief is in docs/MINIMAX_M3_LONG_RUNNING_RESEARCH.md and must be followed.

Hard rules (from project AGENTS.md and the research brief):
- Follow the 6 phases in section 4 of the brief, in order. Do not start phase N+1 until phase N builds, lints, and is manually smoke-tested.
- Never modify the existing unstaged change to docs/HARNESS_WORK_ROADMAP.md. After each commit, run `git status --short` and confirm the only modified line is your new files.
- Do not kill or relaunch the app unless you actually changed server code; when you do, follow the Global Verification Checklist (kill prior tsx/vite, npm start, confirm :3001 and :5173 reachable, one real prompt, `git status` clean except for your files).
- The feature flag `VITE_PATCH_REVIEW=1` must gate the new `patches` panel until phase 3 is complete; remove the flag in phase 3's PR.

Phase 1 must, before any UI work:
1. Add a workingDir argument to /api/patches/apply and refuse paths outside the workspace (use filterToolsForTrustMode from server/toolPolicy.ts).
2. Create server/patchParse.ts with a pure unified-diff parser.
3. Create server/patchProposals.ts with an in-memory + disk-backed store.
4. Add the 5 routes listed in section 2.3 of the brief.
5. Extend HarnessRunStep in server/runTrace.ts with patch_proposed and patch_applied variants.
6. Lint + build pass.
7. Hand-craft a 3-file diff and round-trip it through /api/patch-proposals via curl.

Report a one-paragraph summary of what you did, which phases are complete, and which one is next. Do not start phase 2 until phase 1 is reviewed and merged.
```

---

## 10. Out of scope (explicit)

- M13 (Multi-Agent Team Runtime) — not picked. Defer until M15 P0 lands and at least one implementer-agent handoff is end-to-end.
- M14 (Deep Browser and UI Verification) — not picked. Defer until M15 P0 lands; the new Patch Review UI is reusable for visual diffs in M14.
- M15 P1 items (commit/PR assistant, GitHub auth) — not picked. Need separate scoping.
- MiniMax M3 credential smoke test — not picked; owned by Assignment 2 in the Recommended Assignment Order.
- The remaining M4/M5/M6/M8 correctness gaps in the roadmap's "Remaining correctness gaps" section — not picked. Owned by Assignment 2.
