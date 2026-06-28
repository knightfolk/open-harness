# Model Prompt Plugins, Skills, and Routing Eval Phase Plan

Date: 2026-06-06

## Why This Phase Exists

A simple review prompt from the main screen timed out. The current router treats even `review` as an `investigate` request, which moves it onto the multi-agent orchestration path instead of a bounded single-pass review. That may be correct for a deep repository review, but it is too coarse for short, ambiguous prompts where the user may expect quick feedback.

This phase should turn that failure mode into durable product data: prompt adherence, robustness, timeout behavior, routing quality, and model-specific prompt quality should be captured in a form that can improve routing, model assignment, prompt construction, and community prompt sharing.

## Evidence From Current Repo

- `server/router.ts` classifies review/debug/explain prompts into `investigate`, `execute`, `compare`, `plan`, or `direct`.
- `server/autoRouter.ts` uses a classifier model to score configured candidates, then applies cost after score thresholding.
- `server/evals.ts` has built-in prompt cases, including `review-project`, `debug-empty-response`, and `compare-route-decisions`.
- `server/harnessTasks.ts` has a read-only `Review repo` task with rubric items for reading files, structure, hallucination avoidance, and actionable suggestions.
- Historical 2026-06-06 `GET /api/router/state` output reported auto-router enabled with 14 candidates, threshold `0.7`, classifier `minimax:MiniMax-M2.5-highspeed`, and cache size `0`; current MiniMax-backed routing work should prefer `minimax:MiniMax-M3`.
- `GET /api/router/health` succeeded with `ok: true` and classifier latency around `4481ms`.
- Existing eval reports under `~/.openharness/evals/reports` are not yet useful for routing: the summaries found have empty `byModel` data.

Heuristic route checks:

| Prompt | Mode | Role | Complexity | Concern |
| --- | --- | --- | --- | --- |
| `Review this project. What is it? What does it do? What are its strengths and weaknesses?` | `investigate` | `reviewer` | `medium` | Reasonable, but should have a bounded timeout profile. |
| `review` | `investigate` | `reviewer` | `medium` | Too little intent to justify full investigation by default. |
| `Please review the current diff for correctness and bugs.` | `investigate` | `reviewer` | `medium` | Needs git diff context and a review-specific tool budget. |
| `Do a deep review of this repo and compare model adherence.` | `compare` | `reviewer` | `deep` | Correctly escalates, but should fan out as an eval/compare run. |
| `Wire in OpenCode skills and prompt plugins.` | `execute` | `planner` | `medium` | Correctly implies implementation, but should become a planned feature phase first. |

## Baseline: What Friday Would Do

For the prompt `Review this project. What is it? What does it do? What are its strengths and weaknesses?`, my baseline workflow is:

1. Read project instructions and handoff docs.
2. Inspect `package.json`, entry points, server/router/prompt/eval files, and major UI components.
3. Check git status before edits.
4. Avoid writing files unless the user asked for a change.
5. Summarize findings with concrete file references, strengths, weaknesses, and next actions.
6. If the request asks for validation, run the narrow validation gates and report exact results.

That baseline should become a scored reference trace. A model does not need to match my wording, but it should match the core behavior: orient first, use real files, stay read-only for review, avoid hallucinated paths, distinguish shallow vs deep review, and produce actionable findings.

## Prompt Adherence and Robustness Eval Design

Add a new eval family: `routing-prompt-adherence`.

Each run should capture:

- Prompt text, selected route, selected model, candidate scores, classifier latency, route latency, total wall time.
- Whether routing used heuristic, auto-router, deterministic cheap path, deterministic strong path, cache, or fallback.
- Tool plan: expected tools, actual tools, denied tools, failed tools, retries.
- Prompt adherence score: followed task scope, respected read-only/write mode, used requested format, avoided planning monologue when not useful.
- Robustness score: survived provider timeout, classifier timeout, tool timeout, empty response, malformed JSON, and streamed reasoning tags.
- Grounding score: read relevant files, referenced real paths, did not invent files, separated evidence from inference.
- Baseline delta: what Friday would have done, what the model skipped, what it did better, what it overdid.

Initial test cases should cover:

- `review`
- `Review this project.`
- `Review this project. What is it? What does it do? What are its strengths and weaknesses?`
- `Please review the current diff for correctness and bugs.`
- `Do a deep review of this repo and compare model adherence.`
- `When I send a message, sometimes I get an empty response. Help me debug this.`
- `Wire in OpenCode skills and prompt plugins.`

Pass/fail gates:

- A one-word `review` must not spend the same budget as a deep repository review unless the user confirms scope.
- A read-only review must not write files.
- A diff review must inspect git status or diff before making claims.
- A deep review must inspect multiple key files and should record why it selected the chosen model(s).
- A timeout must be recorded as structured data with the phase that timed out: router classifier, provider call, tool call, agent phase, or SSE/client disconnect.

## Skills and OpenCode Compatibility

This is possible, but OpenHarness should not directly assume every other harness has the same concepts.

Use an adapter model:

- `Skill`: a lazy-loadable instruction bundle with optional scripts, references, examples, and allowed tool hints.
- `Plugin`: executable extension code that can add tools, hooks, importers, renderers, or telemetry processors.
- `Agent Profile`: model/permission/task defaults for a role or sub-agent.
- `Prompt Plugin`: a non-executable prompt artifact that can target models, tasks, routes, and output formats.

OpenCode compatibility notes from current public docs:

- OpenCode agents can be defined as markdown files in global or project agent directories, with frontmatter such as `description`, `mode`, `model`, `temperature`, and permissions.
- OpenCode permissions can gate reads, edits, shell, web fetch/search, skills, LSP, and task tools.
- OpenCode plugins can be local JavaScript/TypeScript files or npm packages, and can expose custom tools or hook events such as compaction.
- A community OpenCode skill plugin demonstrates lazy skill discovery, `skill_find`, `skill_use`, `skill_resource`, scripts, and per-model prompt renderers.

OpenHarness should support importers for OpenCode-like agents and skills, but convert them into OpenHarness-native manifests before use. That lets OpenHarness preserve trust mode, provenance, eval scoring, prompt microscope visibility, and model-family renderers.

Sources:

- [OpenCode agents documentation](https://opencode.ai/docs/agents/)
- [OpenCode plugin documentation](https://opencode-tutorial.com/en/docs/plugins)
- [opencode-skillful README](https://github.com/zenobi-us/opencode-skillful)

## Model Prompt Plugin Concept

A model prompt plugin is a signed or local prompt package that can add or override prompt sections for a specific model, model family, task type, route mode, role, or output contract. It is not executable by default.

Use cases:

- A single-use prompt generated by a user for one task.
- A personal reusable prompt for code review on Qwen or DeepSeek.
- A community prompt pack for open-source project maintenance.
- A model-family prompt pack that renders the same intent as XML for Claude/Qwen, structured markdown for DeepSeek/Mistral, concise text for Gemma, or JSON-contract instructions for weaker tool models.
- Task packs such as `design-review`, `security-audit`, `bugfix`, `frontend-ui`, `docs-writer`, or `patch-review`.

Prompt plugins should be evaluated before they can become default routing inputs. The important product move is to treat prompts like dependencies: versioned, inspectable, scored, revocable, and scoped.

## Prompt Plugin Schema Requirements

The JSON schema lives in `docs/model-prompt-plugin.schema.json`.

Core requirements:

- Stable `id`, `name`, `version`, `description`, `author`, and `license`.
- `provenance` for local/community/imported/generated source.
- `targets` for models, families, providers, roles, routes, task tags, context ranges, and image/tool requirements.
- `renderers` for model-specific output formats.
- `sections` that can be appended, prepended, replaced, or conditionally injected.
- `packs` for grouping compatible prompt plugins.
- `evals` that declare expected behavior, baseline prompts, rubrics, and minimum passing scores.
- `safety` for permissions, untrusted-context rules, prompt-injection hardening, and allowed tool classes.
- `telemetry` for adherence, latency, timeout, cost, grounding, and user override outcomes.

## Runtime Integration Plan

1. Add prompt plugin registry and loader.
   - Read from project `.openharness/prompt-plugins/`, user `~/.openharness/prompt-plugins/`, and imported pack directories.
   - Validate every manifest against `docs/model-prompt-plugin.schema.json`.
   - Mark untrusted community prompts as disabled until reviewed.

2. Add prompt plugin selection.
   - Inputs: route mode, role, task tags, active model, model family, trust mode, tool count, image presence, context estimate.
   - Output: ordered list of prompt sections and renderer choice.
   - Do not silently replace project/AGENTS instructions.

3. Extend `buildPromptForModel()`.
   - Keep model-family defaults in `server/promptBuilder.ts`.
   - Add an optional `promptPlugins` argument that contributes rendered sections.
   - Include prompt plugin provenance in the Prompt Microscope.

4. Extend eval and router learning.
   - Store prompt plugin IDs in eval results and routing learning events.
   - Compare base prompt vs plugin prompt vs Friday baseline.
   - Record timeout phase, malformed output, and adherence deltas.

5. Add UI.
   - Prompt Plugin Library: installed, enabled, source, version, target model/task, score.
   - Prompt Pack detail: included prompts, supported models, eval pass rate, safety notes.
   - Run trace: prompt plugin IDs used and links to rendered prompt sections.

## Timeout Debugging Plan

Capture the failure at phase granularity:

- Router classifier timeout: `server/autoRouter.ts` classifier calls currently use `AbortSignal.timeout(12_000)`.
- Agent request timeout: `server/agentRuntime.ts` wraps agent requests with `AGENT_REQUEST_TIMEOUT_MS`.
- Provider stream timeout: `server/index.ts` provider streaming path should record the active model, provider, phase, and last SSE event.
- Tool timeout: shell, MCP, browser, and web fetch tools already have their own timeout surfaces; normalize them into one event shape.
- Client disconnect: SSE `close` currently aborts the request controller; record whether the client closed first or backend aborted first.

Recommended event shape:

```ts
interface TimeoutEvent {
  id: string;
  sessionId: string;
  runId: string;
  phase: 'router-classifier' | 'agent-request' | 'provider-stream' | 'tool-call' | 'client-sse' | 'orchestrator-phase';
  modelId?: string;
  providerId?: string;
  routeMode?: string;
  role?: string;
  promptPluginIds?: string[];
  timeoutMs: number;
  elapsedMs: number;
  lastEvent?: string;
  retryable: boolean;
  fallbackAttempted: boolean;
  fallbackModelId?: string;
  createdAt: string;
}
```

## Recommended Next Implementation Order

1. Add structured timeout and prompt-adherence data capture without changing model behavior.
2. Add the `routing-prompt-adherence` eval suite and a Friday baseline evaluator.
3. Add model prompt plugin manifest validation and read-only registry APIs.
4. Add prompt plugin rendering into `buildPromptForModel()` behind a disabled-by-default feature flag.
5. Add OpenCode skill/agent importers into OpenHarness-native manifests.
6. Add UI for prompt packs, model-specific variants, eval scores, and provenance.

## Success Criteria

- A future `review` timeout can be diagnosed from persisted data without reading logs.
- The same prompt can be run across models and compared against a Friday baseline.
- Prompt plugins can be installed, inspected, evaluated, enabled, disabled, and attributed.
- Community prompt packs cannot silently override project rules or trust mode.
- Router decisions can include prompt-pack performance data.

## Follow-Up Implementation Prompt

```text
You are Friday, the AI assistant for OpenHarness. Work in /Users/kevink/Projects/OpenHarness and follow AGENTS.md exactly.

Read:
- AGENTS.md
- docs/MODEL_PROMPT_PLUGIN_PHASE_PLAN.md
- docs/model-prompt-plugin.schema.json
- server/router.ts
- server/autoRouter.ts
- server/evals.ts
- server/promptBuilder.ts
- server/index.ts

Goal: implement Phase 1 only: structured timeout and prompt-adherence data capture for routing/model runs, without changing routing behavior.

Requirements:
1. Add a typed timeout/adherence event module under server/ that can persist redacted JSON events under ~/.openharness/routing-adherence/.
2. Record phase-specific timeout/error events for router classifier failures, provider stream failures, agent runtime failures, and client SSE aborts where the current code already catches or observes those states.
3. Include route mode, role, complexity, selected model, classifier model, candidate scores when available, prompt id or prompt hash, and elapsed time.
4. Add a read-only API endpoint to list recent adherence/timeout events.
5. Add focused tests or a script that exercises the event writer and redaction behavior.
6. Run npm run lint and npm run build.

Do not add prompt plugin rendering yet. Do not restart the app unless server/runtime code changes; if you do change server code, kill existing OpenHarness server/app processes, relaunch, and verify http://127.0.0.1:3001 and http://127.0.0.1:5173.
Commit changes when done.
```
