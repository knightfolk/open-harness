# OpenHarness

<p align="center">
  <img src="public/openharness-icon.png" alt="OpenHarness icon" width="96" height="96">
</p>

OpenHarness is a local-first AI workbench for running, routing, evaluating, and coordinating coding agents across model providers. It keeps chat, models, provider health, MCP tools, routing signals, and review surfaces in one dense workspace so you can see what the harness is doing while you work.

![OpenHarness workspace](docs/screenshots/openharness-workspace.png)

## Why It Exists

Most AI coding setups treat model choice, provider setup, tools, evals, and project context as separate chores. OpenHarness pulls those controls into the work surface:

- Pick the right model for the task, or let Auto-Router choose from configured candidates.
- Assign different models to planner, coder, reviewer, reasoner, summarizer, worker, and title roles.
- Watch orchestration unfold in the main chat through transient router, model, phase, and tool bubbles while the final answer is being prepared.
- Keep provider setup, model cards, MCP tools, patch review, files, terminal state, and project memory nearby.
- Run evals and routing checks without leaving the harness.

## Core Surfaces

| Surface | What it is for |
| --- | --- |
| **Chat workspace** | Project-aware sessions, markdown/code rendering, live team-room bubbles, tool output, patch surfaces, memory context, and a compact composer. |
| **Model Library** | Dense model cards with strengths, weaknesses, comparable models, context, category, cost, and routing hints. |
| **Agent Roles** | Role-specific model assignments so every task does not use the same generic chat model. |
| **Auto-Router** | Task-fit scoring across configured candidates, with relative cost used as a tie-break among viable options. |
| **Provider setup** | Hosted and local model providers, model fetch, enablement, testing, active model selection, and plan-aware access settings. |
| **MCP tools** | Docker MCP status, curated tools, custom server registration, readiness checks, and tool policy hardening. |
| **Model Lab** | Prompt-suite runs, output comparison, and recommendations that can feed better defaults. |
| **Desktop shell** | Electron packaging for people who want OpenHarness as a local app instead of only a browser tab. |

## Quick Start

```bash
npm install
npm run dev:all
```

Open [http://localhost:5173](http://localhost:5173). The API server runs on [http://localhost:3001](http://localhost:3001).

You can also run the two processes separately:

```bash
npm run server
npm run dev
```

For the Electron shell:

```bash
npm run electron
```

## Configuration

OpenHarness reads provider and runtime settings from the app configuration, commonly `~/.openharness/config.json`, and environment variables loaded through `dotenv`.

Provider presets currently cover OpenAI-compatible services and local runtimes, including OpenAI, Anthropic, Google, MiniMax, DeepSeek, xAI, Mistral, Z.AI, Moonshot, Alibaba Qwen, OpenRouter, Ollama, and LM Studio. Most hosted providers use the OpenAI-compatible chat completions shape; Anthropic and Google use dedicated adapters.

Useful setup flow:

1. Open Settings.
2. Add or test providers.
3. Fetch provider models and enable the models you want available.
4. Use **My Models** to choose the active chat model.
5. Use **Agent Roles** to assign role-specific models.
6. Enable Auto-Router when you want task-level model selection.

## Model Intelligence

The model knowledge base lives in [src/data/modelCatalog.ts](src/data/modelCatalog.ts). It powers the Model Library, hover descriptions, routing hints, color-coded model categories, and model-card UI.

When adding providers, role defaults, router candidates, or model-specific prompting behavior, update the catalog as part of the same change. The maintenance guide and external refresh anchors are documented in [docs/MODEL_LANDSCAPE.md](docs/MODEL_LANDSCAPE.md).

Related references:

- [docs/MODEL_PROMPTING_GUIDE.md](docs/MODEL_PROMPTING_GUIDE.md): model-family prompting behavior and system prompt strategy.
- [docs/MODEL_LANDSCAPE.md](docs/MODEL_LANDSCAPE.md): model catalog snapshot, role recommendations, providers, and pricing notes.
- [AGENTS.md](AGENTS.md): project rules, routing architecture, validation expectations, and current engineering constraints.

## Live Orchestration UX

When Auto-Router selects an orchestration mode, OpenHarness now fills the main chat with transient activity bubbles instead of leaving the user staring at an empty assistant response. Router choices, planning-room phases, model requests, model output summaries, and tool activity each get their own compact bubble with a label and icon. These updates are client-only progress UI; they are not written into the saved session transcript.

The durable assistant message still stores only the final answer. Reasoning-capable providers may also emit live thinking progress before answer text begins; that indicator clears when final answer text starts streaming.

Review and investigation runs can also attach structured artifacts to the final answer. Evidence and review findings stay collapsed by default, while file, line, severity, evidence, and suggested action metadata remain available for inspection in the artifact drawer when the model output includes those signals.

Execute-mode reports lead with delivery status, changed-file proof, concise phase summaries, review outcome, and residual risk so raw planner or patch transcripts do not crowd the final answer.

Compare-mode reports lead with a verdict and compact model snapshot, then disclose residual risk when the judge phase or one of the candidate models fails.

Direct single-model answers also get a final cleanup pass that removes transcript labels, leading process sections, and internal preamble while preserving normal first-person answers.

## Premier Harness Work

The current premier-harness pass is tracked in [docs/PREMIER_HARNESS_KICKOFF.md](docs/PREMIER_HARNESS_KICKOFF.md) with closeout evidence under [docs/proof/](docs/proof/). The work emphasizes a flatter chat-first default UI, clearer agent work ownership, calmer artifact review, accessible theme texture handling, and model-harness trust surfaces.

### Current active slice (2026-06-17)

- Chat layout is now flat by default:
  - `sub-agents` has been removed as a fixed default panel and is no longer force-hidden list-driven in layout config.
  - Right side context remains on demand and can still be opened from the standard tools flow.
  - Environment rail starts hidden by default until user opens it or active work warrants visibility.
- Message chrome is quieter by default:
  - Confidence, run replay, prompt microscope, artifacts, and next actions are behind a single Details toggle.
  - The default assistant stream remains readable prose unless the user asks for depth.
- Tool/retry evidence is already wired into the routing loop via prompt strategy IDs, per-model/tool stats, and retry-reduction rows in auto-router candidate enrichment.

This slice maps to Phase 1 and Phase 4 in [docs/PREMIER_HARNESS_KICKOFF.md](docs/PREMIER_HARNESS_KICKOFF.md) and is currently represented in the working tree as client-only changes.

Recent trust-surface improvements include:

- Model Library capability scorecards with strengths, weaknesses, fit reasons, cost/context signals, and provider availability.
- Auto-Router candidate cards and Prompt Microscope route explanations that distinguish selected models from rejected alternatives.
- Model Lab, Routing Learning, Agent Roles, provider health, budget, and rate-limit controls with clearer proof/review states.
- Artifact Drawer, Team Plan, and Patch Review validation gates that make plans, artifacts, validation proof, and replay feedback easier to inspect.
- Phase 7 routing-memory work adds versioned model-family prompt strategies plus role/task variants, and records strategy id/family/style/variant in run traces for same-model strategy comparisons.
- The same layer now also supports model-id based prompt-strategy overrides (for example OpenAI reasoning IDs like `o1`/`o3`, including provider-prefixed forms like `openai/o1-mini` and `provider:o3-mini-high`) so routing can keep a common family base while selecting dedicated contracts for selected model families.
- Tool-call reliability now aggregates per-model/provider/tool outcomes with retry distance and first-call failure signals so routing can prefer lower-friction recovery paths.
- Auto-Router and Routing Learning now expose evidence-source-tagged avoid/prefer recommendations (`saved_session_trace`, `log_trace`, `imported_trace`) with supporting session/run ids for audit.
- Model Lab added frontier vs open-source source filtering for enabled model sets so prompt strategy and routing comparisons can isolate local/open models from hosted frontier providers in the same run.

Use [docs/PREMIER_HARNESS_PROOF_CHECKLIST.md](docs/PREMIER_HARNESS_PROOF_CHECKLIST.md) and the closeout proof notes before calling the overhaul done. Final release proof still requires the relevant browser/manual proof plus the validation commands listed below.

If you are validating the Phase 7 prompt/routing memory loop specifically, run:

```bash
npm run test:prompt-strategy-database
npm run test:prompt-routing-memory
npm run test:tool-reliability
```

## Architecture

```text
OpenHarness
├── src/                  React UI, panels, settings, model catalog, themes
├── server/               Express API, provider adapters, orchestration, routing
├── electron/             Desktop shell entry points
├── docs/                 model, routing, planning, and implementation notes
├── scripts/              smoke tests, hardening checks, startup helpers
└── public/               static assets, including the OpenHarness icon
```

Core routing has two layers:

- **Heuristic Router**: classifies a message into direct, investigate, execute, or compare mode plus an agent role and complexity.
- **Auto-Router**: scores configured candidate models against the task signal and chooses the lowest-cost viable model.

`server/orchestrator.ts` owns orchestration behavior. Keep mode-specific branching there instead of spreading orchestration decisions through request handlers.

## Validation

Run the standard checks before committing changes:

```bash
npm run lint
npm run build
```

Additional targeted checks:

```bash
npm run test:hardening
npm run smoke:tool-boundaries
npm run smoke:docker-ui
npm run smoke:ui-clicks
```

The standalone Neon Decade Descent browser game used for human-facing artifact checks lives outside this repository at `../neon-decade-descent` by default, so it is not uploaded with OpenHarness. To run its checks from this repo, keep the folder beside `OpenHarness` or set `OPENHARNESS_NEON_DECADE_DIR` to its absolute path, then run:

```bash
npm run ship:check:neon-decade
```

For runtime sanity:

```bash
curl http://127.0.0.1:3001/api/router/state
```

If server/runtime code changes, restart the running OpenHarness server before validating. For README, asset, client-only, and documentation changes, a browser refresh is enough.

## Packaging

```bash
npm run pack
npm run dist
```

Build output is written to `release/`. The web build output is written to `dist/`.

## Tech Stack

- React 19 and TypeScript
- Vite
- Express
- Electron
- Lucide React
- Markdown rendering with syntax highlighting
- MCP server integrations

## License

MIT
