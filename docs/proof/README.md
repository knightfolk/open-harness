# Proof Artifacts

Use this folder for durable Premier Harness readiness evidence when the proof
is too important to leave only in `NEXT_SESSION.md`.

Recommended file naming:

- `YYYY-MM-DD-premier-harness-closeout.md`
- `YYYY-MM-DD-model-lab-eval-proof.md`
- `YYYY-MM-DD-model-lab-eval-proof-template.md`
- `YYYY-MM-DD-model-lab-bench-proof.md`
- `YYYY-MM-DD-model-lab-bench-proof-template.md`
- `YYYY-MM-DD-model-lab-same-model-strategy-comparison.md`
- `YYYY-MM-DD-same-model-strategy-comparison-template.md`
- `YYYY-MM-DD-routing-learning-evidence-template.md`
- `YYYY-MM-DD-auto-router-candidate-evidence-template.md`
- `YYYY-MM-DD-worktree-isolation-evidence-template.md`
- `YYYY-MM-DD-theme-texture-evidence-template.md`
- `YYYY-MM-DD-agent-detail-steering-evidence-template.md`
- `YYYY-MM-DD-calm-chat-artifact-review-evidence-template.md`
- `YYYY-MM-DD-manual-ui-desktop-dom-notes.md`
- `YYYY-MM-DD-manual-ui-narrow-dom-notes.md`
- `YYYY-MM-DD-manual-ui-dom-notes-template.md`
- `YYYY-MM-DD-runtime-scenario-trace.md`
- `YYYY-MM-DD-runtime-scenario-trace-template.md`
- `YYYY-MM-DD-final-gate-log.md`
- `YYYY-MM-DD-final-gate-log-template.md`

Template files are not proof. Before filling one in, copy or rename it to a
dated artifact path for the actual review pass, keep `Status: template, not
proof` out of completed evidence, and link the completed artifact from the
closeout log.

The closeout log remains the index of record. Whenever a completed proof
artifact is created, add its path and short status back to
`docs/proof/2026-06-16-premier-harness-closeout.md` or the current dated
closeout file so reviewers can audit all evidence from one place.

Template lane map:

- Model Lab Eval Proof: use `YYYY-MM-DD-model-lab-eval-proof-template.md`.
- Model Lab Bench Proof: use `YYYY-MM-DD-model-lab-bench-proof-template.md`.
- Same-model prompt strategy comparison: use
  `YYYY-MM-DD-same-model-strategy-comparison-template.md`.
- Routing Learning proof: use `YYYY-MM-DD-routing-learning-evidence-template.md`.
- Auto-Router candidate proof: use
  `YYYY-MM-DD-auto-router-candidate-evidence-template.md`.
- Agent Detail and steering proof: use
  `YYYY-MM-DD-agent-detail-steering-evidence-template.md`.
- Calm Chat and Artifact Review proof: use
  `YYYY-MM-DD-calm-chat-artifact-review-evidence-template.md`.
- Theme Texture proof: use `YYYY-MM-DD-theme-texture-evidence-template.md`.
- Manual UI Review: use `YYYY-MM-DD-manual-ui-dom-notes-template.md`.
- Runtime Scenario Proof: use `YYYY-MM-DD-runtime-scenario-trace-template.md`.
- Worktree isolation proof: use
  `YYYY-MM-DD-worktree-isolation-evidence-template.md`.
- Final Gates: use `YYYY-MM-DD-final-gate-log-template.md`.

Each proof note should include:

- Date and reviewer.
- Related report or run ids.
- Exported proof artifact filenames.
- Same-model prompt strategy ids, variant ids, and comparison artifact paths
  when provider-approved strategy comparisons are run.
- Manual UI review notes or screenshot references.
- Manual UI screenshot or DOM-note artifact paths for desktop and narrow-width
  checks.
- Runtime scenario trace/export paths for Planning Room, execute/investigate,
  and steering-event evidence.
- Validation command results plus gate log/artifact paths.
- Restart/reachability proof for `3001`, `5173`, `/api/config`, and duplicate
  Electron/process-shape checks when server/runtime code changed.
- Remaining risks.

Before saving logs, traces, screenshots, or DOM notes here, redact:

- Provider keys, API tokens, cookies, OAuth codes, and local auth headers.
- Raw private prompts, customer data, private file contents, or absolute paths
  that are not needed to reproduce the evidence.
- Large generated artifacts; link or name exported files instead.

Prefer short excerpts and stable artifact paths over full raw logs. If a proof
artifact was redacted, say what kind of data was removed without including the
secret value.
