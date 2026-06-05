# OpenHarness

![OpenHarness icon](public/openharness-icon.png)

OpenHarness is a local-first AI workbench for running, routing, evaluating, and coordinating coding agents across model providers. It combines a dense desktop-style chat surface with provider management, Agent Roles, model intelligence, MCP tools, eval feedback, and an Electron wrapper for people who want the whole harness close at hand.

The project is built for experimentation without losing operational discipline: configure many providers, assign the right model to each agent role, let the Auto-Router choose when appropriate, and keep the surrounding tools visible enough to understand what the system is doing.

## What It Does

- **Chat workspace**: project-aware sessions, markdown/code rendering, tool output, patch surfaces, memory context, and a compact composer aligned to the message rail.
- **Model Library**: a built-in catalog of top models with dense cards for strengths, weaknesses, objective references, comparable models, context, category color, compact descriptions, and relative cost.
- **Agent Roles**: map planner, coder, reviewer, reasoner, summarizer, worker, and title roles to specific models instead of treating every task like one generic chat.
- **Auto-Router**: score configured candidate models by task fit, then use relative cost as the tie-breaker among viable options.
- **Provider setup**: OpenAI-compatible presets plus local runtimes such as Ollama and LM Studio, with model fetch, enablement, testing, and active model selection.
- **MCP tools**: Docker MCP status, curated tools, custom server registration, readiness checks, and tool policy hardening.
- **Model Lab and eval loop**: run prompt suites, compare outputs, and use recommendations to improve role defaults and routing decisions.
- **Settings and onboarding**: wide settings workspace, My Models access, provider setup, Agent Roles, model docs, routing learn pane, themes, personality, and onboarding reset.
- **Desktop wrapper**: Electron entry point for packaged desktop usage alongside the browser-based Vite workflow.

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
