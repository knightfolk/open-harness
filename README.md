# OpenHarness

<p align="center">
  <img src="public/openharness-icon.png" alt="OpenHarness icon" width="96" height="96">
</p>

<p align="center">
  <strong>A local-first AI workbench for routing models, running agents, inspecting proof, and learning which providers perform best.</strong>
</p>

OpenHarness is a desktop control plane for people who work across multiple AI models, providers, tools, and coding agents. It keeps the chat surface, model routing, provider health, MCP tools, agent traces, eval feedback, and review evidence in one dense workspace so the harness is visible while it works.

> **Source-available public preview:** OpenHarness is being built in public for feedback, discussion, and evaluation. It is not open-source licensed yet. Please do not fork for redistribution, repackage, offer as a hosted service, or use the code commercially without written permission. See [LICENSE](LICENSE) and [CONTRIBUTING.md](CONTRIBUTING.md).

![OpenHarness workspace showing chat, environment context, agent activity, and runtime status](docs/screenshots/openharness-workspace.png)

<p align="center">
  <em>Workspace view: chat, environment context, agent activity, routing state, tools, and project status in one local window.</em>
</p>

## Why It Exists

Most AI coding tools make the model choice feel invisible: one prompt goes in, one answer comes out, and the routing, fallback, tool behavior, and proof trail are hidden. OpenHarness turns that hidden layer into the product.

OpenHarness is built for:

- Comparing models and providers without constantly rewriting your workflow.
- Assigning different models to different jobs, such as planner, coder, reviewer, reasoner, summarizer, worker, and title generation.
- Watching agent work as structured runs rather than loose chat messages.
- Debugging provider failures, tool failures, retries, and fallback decisions.
- Capturing evidence so routing can improve from real outcomes instead of guesswork.
- Keeping everything local-first while still making the project visible for public feedback.

## What Makes It Different

| Difference | What it gives you |
| --- | --- |
| **Transparent routing** | Auto-Router scores configured candidates for each task, applies cost and capability gates, and records why a model was selected. |
| **Role-aware agents** | Planner, coder, reviewer, reasoner, summarizer, worker, and title roles can each use different models and model-family prompt strategies. |
| **Visible run traces** | Active work exposes phase state, selected model, provider, tool calls, final-answer proof, replay artifacts, and recovery paths. |
| **Provider failure handling** | Transient overloads, auth problems, missing models, and rate-limit-style failures are treated as runtime events that can be surfaced, retried, or routed around. |
| **Vision fallback evidence** | Browser screenshots can be converted into bounded text evidence for models that do not accept native image input. |
| **Tool reliability memory** | Tool-error recovery evidence is recorded so the harness can learn which model/tool/provider combinations recover cleanly. |
| **Model trust surfaces** | Model Lab, Routing Learning, eval proof, prompt strategies, tool reliability, budgets, and provider rate limits are first-class UI surfaces. |
| **Local-first desktop state** | Provider config, sessions, routing ledgers, and runtime state live locally rather than in a hosted control plane. |

## Screenshots

### Agent Detail

Agent detail turns a run into an inspectable work object. You can review role, model, provider, status, final-answer proof, tool calls, context files, isolated worktrees, steering events, and replay artifacts without losing the main conversation.

![OpenHarness agent detail view](docs/screenshots/openharness-agent-detail.png)

### Auto-Router Evidence

Auto-Router uses a classifier model to choose from active candidates, then layers in candidate cards, eval proof trust, tool-error evidence, freshness checks, thresholds, and effective-cost preferences.

![OpenHarness Auto-Router settings](docs/screenshots/openharness-model-routing.png)

## Core Capabilities

| Capability | Why it matters |
| --- | --- |
| **Auto-Router** | Chooses a model per task from configured candidates instead of forcing every request through one default model. |
| **Agent Roles** | Assigns specialized models to coder, reviewer, planner, reasoner, summarizer, worker, and title generation roles. |
| **Provider Hub** | Manages hosted and local providers, model fetching, enabled models, active model selection, health checks, budgets, and rate limits. |
| **Live Orchestration** | Surfaces route decisions, agent phases, model requests, tool calls, recovery, and final-answer proof while work is happening. |
| **Browser Visual Evidence** | Captures browser screenshot context as DOM text, headings, controls, image alt text, resource issues, and capture notes so non-vision models still receive usable evidence. |
| **MCP Tooling** | Connects Docker MCP tools, curated tools, custom servers, trust-mode filtering, and tool readiness checks. |
| **Model Library** | Presents model cards with strengths, weaknesses, context limits, provider availability, role fit, and routing hints. |
| **Model Lab** | Runs prompt suites across model sets and produces recommendations that can inform role defaults and router candidates. |
| **Routing Learning** | Tracks prompt strategy evidence, tool reliability, recovery paths, eval proof status, and source-tagged routing recommendations. |
| **Review Surfaces** | Keeps artifacts, patch review, validation evidence, confidence signals, and next actions inspectable without crowding the main answer. |
| **Desktop Shell** | Runs as a Vite web app or an Electron desktop app for local workflows. |

## Typical Workflow

1. Add providers and test connectivity.
2. Fetch provider models and enable the ones you want available.
3. Assign defaults for chat and role-specific agent work.
4. Configure Auto-Router candidates, capability cards, thresholds, and cost preferences.
5. Ask for direct answers, investigation, execution, review, or comparison.
6. Watch active agents, traces, provider behavior, and proof as the answer is assembled.
7. Feed outcomes back through Model Lab, Routing Learning, and tool reliability evidence.

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

OpenHarness reads provider and runtime settings from `~/.openharness/config.json` and environment variables loaded through `dotenv`.

Provider presets currently cover OpenAI-compatible services and local runtimes, including OpenAI, Anthropic, Google, MiniMax, DeepSeek, xAI, Mistral, Z.AI, Moonshot, Alibaba Qwen, OpenRouter, Ollama, and LM Studio. Most hosted providers use the OpenAI-compatible chat completions shape; Anthropic and Google use dedicated adapters.

Recommended setup path:

1. Open Settings.
2. Add or test providers.
3. Fetch provider models and enable the models you want available.
4. Use **Active Model** for the default chat model.
5. Use **Agent Roles** for role-specific model assignments.
6. Use **Auto-Router** when you want task-level model selection.
7. Use **Routing Learning** and **Model Lab** to inspect evidence and tune candidates over time.

OpenAI note: ChatGPT subscription labels are planning metadata only. OpenAI API model calls still require OpenAI Platform API credentials.

## Routing Architecture

OpenHarness has two routing layers:

- **Heuristic Router**: classifies a message into `direct`, `investigate`, `execute`, or `compare` mode, plus an agent role and complexity.
- **Auto-Router**: scores configured candidate models against the task signal, then chooses the lowest-cost viable model above the quality threshold.

`server/orchestrator.ts` owns orchestration behavior. It coordinates research, execution, review, comparison, and synthesis paths while the server records trace events for the UI.

When a task includes browser screenshot context, the router treats it as image-aware. If the selected model does not support native vision input, OpenHarness appends a sanitized visual-evidence summary to the model-facing prompt instead of sending raw image data.

## Model Intelligence

The model knowledge base lives in [src/data/modelCatalog.ts](src/data/modelCatalog.ts). It powers the Model Library, hover descriptions, routing hints, model categories, provider availability, and model-card UI.

Related references:

- [docs/MODEL_PROMPTING_GUIDE.md](docs/MODEL_PROMPTING_GUIDE.md): model-family prompting behavior and system prompt strategy.
- [docs/MODEL_LANDSCAPE.md](docs/MODEL_LANDSCAPE.md): model catalog snapshot, role recommendations, providers, and pricing notes.
- [docs/PREMIER_HARNESS_KICKOFF.md](docs/PREMIER_HARNESS_KICKOFF.md): current product overhaul direction.
- [AGENTS.md](AGENTS.md): project rules, routing architecture, validation expectations, and engineering constraints.

## Project Layout

```text
OpenHarness
|-- src/                  React UI, panels, settings, model catalog, themes
|-- server/               Express API, provider adapters, orchestration, routing
|-- electron/             Desktop shell entry points
|-- docs/                 model, routing, planning, screenshots, proof notes
|-- scripts/              smoke tests, hardening checks, startup helpers
`-- public/               static assets, including the OpenHarness icon
```

## Validation

Run the standard checks before committing changes:

```bash
npm run lint
npm run build
```

Useful targeted checks:

```bash
npm run test:prompt-routing-memory
npm run test:tool-reliability
npm run test:theme-accessibility
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

## Build In Public

OpenHarness is public so people can follow the work, try it locally, open issues, and discuss direction. The repo is source-available rather than open-source licensed while the product is still taking shape.

Feedback is welcome through GitHub Issues and Discussions. Contributions are governed by [CONTRIBUTING.md](CONTRIBUTING.md).

## License

OpenHarness is currently source-available, not open-source licensed. All rights are reserved unless explicit written permission is granted. See [LICENSE](LICENSE).
