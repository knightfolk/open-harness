# Model Call Learning Import - 2026-06-19

This proof bundle captures the Void Lanes real-world model-call sweeps that were imported into local OpenHarness router-learning as benchmark evidence.

## Source Project

- External project: `/Users/kevink/Projects/void-lanes`
- Game: original Vite/canvas space trading and combat game
- Validation used before sweeps: `npm test`, `npm run build`, browser smoke with nonblank canvas

## Imported Evidence

- `void-lanes-all-configured-models.json`: corrected `/api/test/run` sweep across 19 enabled configured model references.
- `void-lanes-router-learning-import.json`: 19 benchmark routing events imported from that sweep.
- `opencode-all-models-sweep.json`: direct OpenCode Go sweep across all 18 OpenCode model records with 2 prompts each.
- `opencode-router-learning-import.json`: 36 benchmark routing events imported from the OpenCode sweep.

## Learning Database Verification

After import, `/api/router/learning/export` reported:

- `eventCount`: 296
- `productionEventCount`: 241
- `benchmarkEventCount`: 55
- `benchmark:void-lanes:*` events: 19
- `benchmark:opencode-void-lanes:*` events: 36

The imported events use `datasetKind: "benchmark"`, so they are reviewable/exportable evidence without silently changing production routing success rates.
