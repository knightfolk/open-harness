# Premier Harness Proof Checklist

Status: acceptance checklist for `docs/PREMIER_HARNESS_KICKOFF.md`
Last updated: 2026-06-16

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
- Bench proof: [yes/no], matrix: [tasks] x [models]
- Runtime scenarios: [Planning Room / execute / investigate]

Expected purpose:
- Capture closeout evidence for docs/PREMIER_HARNESS_PROOF_CHECKLIST.md.

Please approve one option:
1. Approve smallest proof runs only.
2. Approve eval proof only.
3. Approve bench proof only.
4. Do not run provider-backed proof yet.
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
- Exported proof brief filename.
- Exported recommendation report filename.
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
- Exported proof brief filename.
- Exported JSON filename.
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
| Phase 5 texture accessibility | Theme settings, chat, sidebar, code, terminal, diff surfaces | Texture remains subtle, bounded, readable, and safe under reduced motion/transparency expectations. |
| Phase 6 model harness trust | Model Lab, Routing Learning, Agent Roles, Auto-Router | Eval/bench/routing evidence shows proof-review state, spend guards, and trusted-only apply behavior. |

## 4. Runtime Scenario Proof

- After provider budget is approved, run one Planning Room request.
- Confirm planner participants appear under the active thread.
- Confirm the run remains inspectable after completion.
- After provider budget is approved, run one execute or investigate request.
- Confirm phases appear in order.
- Add a steering note during a safe phase.
- Confirm the note is recorded in the run trace.

Evidence to capture:

- Session id.
- Run id.
- Agent/phase names shown in the left pane.
- Steering event timestamp or trace excerpt.

## 5. Final Gates

- Run `npm run lint`.
- Run `npm run build`.
- Run `npm run test:hardening` if server/runtime or safety-sensitive routing code changed.
- If server/runtime code changed, restart OpenHarness and verify:
  - `http://127.0.0.1:3001/api/config`
  - `http://127.0.0.1:5173/`

Gate decision rules:

- Client/docs-only changes: lint/build are enough for final static gates; browser refresh is enough for manual UI review.
- Server/runtime changes: lint/build plus restart/reachability proof are required.
- Routing, provider, budget, rate-limit, import/export, shell, patch, or security-sensitive changes: run `npm run test:hardening` unless a narrower checked command is documented with why it covers the touched path.
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
  for naming and content rules.
- Current starter evidence file: `docs/proof/2026-06-16-premier-harness-closeout.md`.
- Do not leave closeout evidence only in chat text; link or name exported proof
  files so another reviewer can find them.

```markdown
## Premier Harness Closeout Evidence

Date:
Reviewer:

### Model Lab Eval Proof

- Report id:
- Proof review status:
- Proof brief:
- Recommendation report:
- Routing Learning trust state:
- Notes:

### Model Lab Bench Proof

- Bench run id:
- Proof review status:
- Proof brief:
- JSON artifact:
- Validation summary:
- Notes:

### Manual UI Review

- Desktop check:
- Narrow-width check:
- Left work queue:
- Right Agent detail:
- Chat/details/artifacts:
- Theme texture readability:
- Issues found:

### Runtime Scenario Proof

- Planning Room session/run id:
- Planning Room evidence:
- Execute/investigate session/run id:
- Execute/investigate evidence:
- Steering event evidence:
- Notes:

### Final Gates

- `npm run lint`:
- `npm run build`:
- `npm run test:hardening` or scoped substitute:
- Runtime restart/reachability:
- Remaining risks:
```
