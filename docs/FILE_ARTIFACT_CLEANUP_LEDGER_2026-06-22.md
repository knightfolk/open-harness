# File And Artifact Cleanup Ledger

Date: 2026-06-22
Reviewer: Friday
Baseline: `2782aedd` (`Harden day-one cleanup surfaces`)
Status: safe cleanup slice completed

This ledger turns the day-one File And Artifact Cleanup Queue into explicit
dispositions. The rule for this pass is preservation first: generated folders
can be cleaned only when they are ignored, reproducible, and not carrying the
current proof record.

## Disposition Summary

| Path | Observed state | Disposition | Action |
| --- | --- | --- | --- |
| `release/` | Ignored generated Electron release output, about 7.0 GB. Contains alpha update 1, 2, and 3 packages plus unpacked app directories. Update 3 artifacts were generated on 2026-06-22. | Keep as current release output. Older update generations remain archive candidates, but need release-by-release evidence review before deletion. | No deletion in this pass. |
| `dist/` | Ignored Vite build output, about 3.3 MB, generated on 2026-06-22. | Remove only as part of a deliberate rebuild/reset. It is reproducible but useful for current validation. | Kept. |
| `dist-server/` | Ignored server bundle output, about 2.2 MB, generated on 2026-06-22. | Remove only as part of a deliberate rebuild/reset. It is reproducible but useful for current validation. | Kept. |
| `node_modules/` | Ignored install output, about 779 MB. | Remove only if dependency reinstall is desired. It is generated, but deleting it would slow validation and does not reduce repo confusion in git. | Kept. |
| `OpenHarnessApp/.build/` | Ignored SwiftPM build output, about 308 MB, last updated 2026-06-06. | Archive as historical/prototype build output by leaving ignored and out of review scope. Remove only when Swift prototype validation is not needed locally. | Kept. |
| `.openharness-bench/` | Ignored generated benchmark response scratch files, about 120 KB, last updated 2026-06-11. | Remove because generated and expired. Durable bench proof remains in `docs/proof/` where applicable. | Removed in this pass. |
| `.openharness-smoke/` | Ignored generated smoke screenshot folder, about 20 KB, last updated 2026-06-19. | Remove because generated and expired. Current release screenshots are preserved under `docs/proof/artifacts/2026-06-19-post-alpha-rc/`. | Removed in this pass. |
| `docs/proof/2026-06-19-post-alpha-release-candidate.md` | Tracked release proof named by the day-one source-of-truth as the strongest recent release evidence. | Keep as current proof until replaced by newer proof. | Kept. |
| `docs/proof/artifacts/2026-06-19-post-alpha-rc/` | Tracked screenshots referenced by the post-alpha release proof. | Keep as current proof artifacts. | Kept. |
| Older completed proof files under `docs/proof/` | Tracked evidence from 2026-06-16 and 2026-06-17, including Model Lab, runtime relaunch, routing-learning, and tool-error evidence. | Archive as historical evidence. | Kept. |
| Proof templates under `docs/proof/` | Tracked reusable templates marked `Status: template, not proof`. | Keep as reusable proof templates. | Kept. |
| `docs/proof/model-call-learning-2026-06-19/` | Tracked model-call learning exports and README from 2026-06-19. | Archive as historical evidence unless superseded by a new model-learning import/export pass. | Kept. |
| `docs/screenshots/` | Tracked README screenshots referenced by `README.md`. | Keep as current README assets. | Kept. |
| `src/data/` | Tracked product data modules, including model catalog and provider plans. | Keep as source code, not generated cleanup output. | Kept. |
| `test-fixtures/standalone-artifact-eval/` | Tracked standalone artifact fixture referenced by tests and reset/verification scripts. | Keep as test fixture source. | Kept. |

## Cleanup Performed

- Removed `.openharness-bench/`.
- Removed `.openharness-smoke/`.

No tracked proof artifact, release package, generated release output, README
screenshot, source data file, or test fixture was deleted.

## Next Safe Cleanup Step

The next cleanup pass should decide whether `release/` needs a local retention
policy after confirming which alpha update packages are already published or
otherwise preserved outside the working tree. Until then, `release/` remains
large but intentionally preserved.
