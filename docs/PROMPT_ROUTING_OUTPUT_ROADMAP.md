# Prompt, Routing, and Output Roadmap

Date: 2026-06-10
Status: Top-priority planning roadmap

## Purpose

This roadmap defines the next refinement pass for OpenHarness prompt processing, routing, model-team workflows, single-model responses, and response presentation.

The goal is to make OpenHarness feel less like a chat wrapper and more like a native coding-agent control plane:

- The right workflow is chosen from intent, risk, cost, context, and model capability.
- Planning Room model teams produce better source-of-truth plans than one model alone.
- Single-model answers remain fast, direct, cheap when appropriate, and well-presented.
- Prompt construction is inspectable, testable, and model-family aware.
- Output is rendered as useful work products: plans, findings, diffs, decisions, validations, artifacts, and next actions.

## Current OpenHarness Baseline

OpenHarness already has the important foundation:

- `server/router.ts` classifies requests into `direct`, `plan`, `investigate`, `execute`, and `compare`, with role and complexity metadata.
- `server/autoRouter.ts` can score configured model candidates, apply cost-aware selection, cache decisions, annotate candidate cards with eval recommendations, and adjust threshold from historical routing outcomes.
- `server/orchestrator.ts` runs Planning Room, investigate, execute, and compare pipelines through `agentRuntime.ts`.
- `server/promptBuilder.ts` adapts system prompts by model family and captures native thinking fields when supported.
- `server/index.ts` emits run traces, uses a unified stream cleaner, records routing-adherence events, and gates the "start directly" monologue rule away from reasoning models.
- `src/components/MessageBubble.tsx`, `PromptMicroscope`, `ArtifactDrawer`, `NextBestActions`, and trace UI already expose parts of the answer lifecycle.
- `docs/MODEL_PROMPT_PLUGIN_PHASE_PLAN.md` defines prompt plugin, adherence, timeout, and eval concepts that should become part of this roadmap instead of living as a separate branch of product thinking.

## External Baselines Reviewed

These sources informed the target behavior:

- [Cursor Plan Mode](https://cursor.com/docs/agent/plan-mode) and [Cursor Plan Mode launch notes](https://cursor.com/blog/plan-mode): planning should research the codebase, ask clarifying questions, create editable plans, and support longer agent runs.
- [Warp agent planning](https://docs.warp.dev/agent-platform/capabilities/planning/): plans should be persistent, editable, versioned, selectively executable, and linked to workspace context.
- [Claude Code subagents](https://code.claude.com/docs/en/sub-agents), [hooks](https://code.claude.com/docs/en/hooks), [output styles](https://code.claude.com/docs/en/output-styles), and [best practices](https://code.claude.com/docs/en/best-practices): strong agent systems separate roles, permissions, hooks, memory, and output style from the main chat loop.
- [Codex CLI features](https://developers.openai.com/codex/cli/features), [sandboxing](https://developers.openai.com/codex/concepts/sandboxing), and [skills](https://developers.openai.com/codex/skills): review mode should be read-only by default; trust boundaries and reusable skills should be explicit product objects.
- [Aider repo map](https://aider.chat/docs/repomap.html) and [lint/test workflow](https://aider.chat/docs/usage/lint-test.html): repository maps and validation commands should be first-class context and proof signals.
- [OpenCode agents](https://opencode.ai/docs/agents/) and [skills](https://opencode.ai/docs/skills/): agents, skills, and permissions should be reusable and lazily loaded.
- [Anthropic multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) and [effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents): multi-agent quality depends on context isolation, careful prompts, observability, testing, and operational controls.
- [LangGraph workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents) and [LangGraph supervisor](https://reference.langchain.com/python/langgraph-supervisor): deterministic workflows and dynamic agent handoffs should be modeled separately.
- [AutoGen multi-agent framework](https://microsoft.github.io/autogen/0.2/docs/Use-Cases/agent_chat/): multi-agent systems need persisted conversations, tool/human integration, and configurable interaction patterns.
- [MCP sampling](https://modelcontextprotocol.io/specification/2025-06-18/client/sampling): nested model calls and tool-server initiated agent behavior need human-in-the-loop controls.

## Product Principles

1. Route workflow before routing model.
   A `review`, `plan`, `fix`, `compare`, or `quick answer` should first map to the right workflow contract, then to the right model or model team.

2. Treat model-team output as a work product.
   Planning Room should not look like several chat messages glued together. It should produce a team artifact with participants, disagreements, final decision, validation plan, and execution readiness.

3. Keep single-model output excellent.
   Direct answers should be fast, clear, cheap when possible, and free of agent-progress ceremony unless it helps the user.

4. Make prompt processing observable.
   Prompt sections, model-family renderer, selected prompt plugins, tools, untrusted context, token budget, and output contract should be visible through Prompt Microscope and run trace.

5. Use evidence, not vibes, to improve routing.
   Eval reports, user outcome signals, adherence events, cost, latency, tool success, validation pass/fail, and model-team deltas should feed the router.

6. Native-app presentation beats transcript sprawl.
   The UI should show plans, findings, diffs, validations, artifacts, and decisions in structured surfaces while keeping chat calm.

## Target Workflow Contracts

### Direct

Use for quick questions, one-file explanations, short summaries, and casual follow-ups.

Contract:
- Skip model-team orchestration.
- Prefer cheapest viable model when quality risk is low.
- Answer directly with no planning monologue.
- Show model/cost/routing detail as collapsed metadata.

### Plan

Use for roadmaps, architecture, strategy, feature design, implementation plans, and ambiguous high-impact work.

Contract:
- Planning Room runs multiple participants when configured.
- Participants plan independently before seeing peers.
- Peer cross-checks call out disagreements, omissions, risks, and best ideas.
- Final synthesis becomes a named, reusable plan artifact.
- No code edits in Planning Room.

### Investigate

Use for reviews, debugging, project understanding, root-cause analysis, and "what is going on?" work.

Contract:
- Read-only explorer phase first.
- Synthesis separates evidence from inference.
- Shallow review and deep review have different budgets.
- One-word or ambiguous `review` should ask scope or use a bounded default.

### Execute

Use for implementation and file changes.

Contract:
- Plan, implement, validate, review.
- Write operations honor trust mode.
- Patch proposals, diffs, and validation results are first-class UI artifacts.
- Failed validation routes back into correction or produces a clear blocker.

### Compare

Use for comparing models, strategies, patches, prompts, or outputs.

Contract:
- Run candidates independently.
- Judge with explicit criteria.
- Present winner, tradeoffs, failure modes, cost/latency, and "use this when" guidance.

## Phase 0 - Reconcile Roadmap Truth

Priority: P0

Goal: Make this roadmap the working umbrella for prompt/routing/output work.

Work:
- Link this document from `PLAN.md`, `NEXT_SESSION.md`, and `docs/HARNESS_WORK_ROADMAP.md`.
- Fold still-relevant `docs/MODEL_PROMPT_PLUGIN_PHASE_PLAN.md` items into this roadmap.
- Mark stale items in older docs where code has already moved on.

Acceptance:
- A future agent can find the prompt/routing/output source of truth in under one minute.
- Older roadmap docs point here instead of contradicting current code.

## Phase 1 - Prompt Processing Contract

Priority: P0

Goal: Make prompt construction deterministic, inspectable, and testable.

Work:
- Define a `PromptAssembly` object with ordered sections: identity, project rules, task contract, route contract, model-family renderer, tools, context pack, memory, prompt plugins, output style, and safety rules.
- Extend `buildPromptForModel()` to return section metadata, token estimates, provenance, and redaction status.
- Add model-family output contracts for direct answer, plan artifact, review findings, execute report, and compare result.
- Move prompt-plugin rendering behind a feature flag using the schema already in `docs/model-prompt-plugin.schema.json`.
- Ensure project/AGENTS instructions cannot be silently replaced by plugins or output styles.

Acceptance:
- Prompt Microscope shows every prompt section with source, token estimate, and inclusion reason.
- Tests can snapshot prompt assembly for at least DeepSeek/Qwen, Claude, Gemini, Llama, and a weak-tool model.
- A prompt plugin can add a section, but cannot override trust mode or project rules.

## Phase 2 - Routing Decision Quality

Priority: P0

Goal: Route by workflow, model capability, cost, quality, risk, and context fit.

Work:
- Pass real session signals into `routeWithAutoRouter()`: image presence, turn count, tool count, context estimate, attached artifacts, dirty git state, and user-selected thinking level.
- Split deterministic workflow routing from model selection in the trace: heuristic route, complexity, policy gates, auto-router candidate scoring, final model choice.
- Add bounded behavior for tiny ambiguous prompts like `review`.
- Add explicit escalation/de-escalation policy:
  - Simple low-risk tasks: cheapest viable model, no classifier.
  - Medium tasks: classifier route.
  - Deep/high-risk tasks: strongest suitable model or Planning Room.
  - Image tasks: image-capable candidate only.
  - Tool-heavy tasks: high tool-quality candidate only.
- Persist route input features and outcome events in one consistent routing-adherence schema.

Acceptance:
- `hello` and simple single-line questions do not pay classifier overhead.
- `review` does not trigger the same budget as `do a deep repo review`.
- Route trace explains why the workflow and model were selected.
- Router decisions include enough stored data to replay/evaluate later.

## Phase 3 - Planning Room Team Output

Priority: P0

Goal: Make model-team planning visibly better than one model and presentation-grade.

Work:
- Persist Planning Room artifacts as named objects attached to the session.
- Add a structured team-plan schema: recommendation, success criteria, execution phases, open questions, risks, validation, participant deltas, final decision log.
- Show participants, model names, phase status, and disagreements in a compact Planning Room artifact view.
- Add "promote to execution" action that passes the plan artifact into execute mode.
- Add "revise plan" action that keeps prior plan and asks participants to update only changed sections.
- Add single-model baseline comparison in Model Lab: one model plan vs team plan.

Acceptance:
- A planning run produces a reusable artifact, not only message text.
- The UI shows what the team improved over the independent plans.
- Execution can consume the plan without the user restating it.
- Model-team quality is measurable against single-model baseline runs.

## Phase 4 - Single-Model Output Refinement

Priority: P1

Goal: Make direct and single-agent outputs feel concise, useful, and native.

Progress:
- [x] Output style contracts are defined in `server/promptBuilder.ts` and exposed as structured per-run metadata on `prompt_built` trace steps.
- [x] Prompt Microscope shows Output Style as a dedicated inspector section instead of burying it in generic prompt text.
- [x] Investigation and review answers can expose collapsed Evidence/Sources artifacts through the artifact drawer without cluttering normal chat.
- [x] Focused regression coverage pins output-style trace metadata and investigation/review response normalization.
- [x] Structured evidence and review-finding artifacts are attached to run traces, with markdown Evidence/Sources extraction retained as a fallback.
- [x] Execute, compare, investigation/review, and direct-answer normalization have focused regression coverage.
- [x] Stream cleaning preserves legitimate first-person direct answers while still filtering internal planning preamble.

Work:
- Define output styles for direct answer, code review, investigation, implementation report, learning/explainer, and terse terminal-style output. **Done for route/role-derived contracts; explicit user-selectable styles are deferred until there is a product need.**
- Make output style a visible per-run setting with model-family rendering support. **Done for run trace and Prompt Microscope; user controls remain a deferred product decision.**
- Improve stream cleaning so legitimate first-person answers are not stripped while monologue preamble still disappears for non-reasoning models. **Done with regression coverage.**
- Add response section normalization after orchestration: findings first for reviews, final answer first for direct, phases and proof for execute. **Done with focused tests for execute, compare, investigation/review, and direct answers.**
- Add "sources used" and "evidence" affordances for investigation responses without cluttering normal chat. **Done through structured run-trace artifacts plus markdown fallback extraction.**

Acceptance:
- Direct answers do not look like orchestration transcripts.
- Review outputs are consistently actionable and severity-ordered.
- Investigation outputs distinguish evidence from inference.
- Reasoning-model output can show live thinking status without leaking raw reasoning into final answers.

## Phase 5 - Native Presentation Layer

Priority: P1

Goal: Present AI work like a polished native coding app, not a wall of markdown.

Progress:
- [x] Structured team-plan, evidence, and review-finding artifacts are attached to run traces and surfaced from chat through compact artifact views.
- [x] Prompt Microscope is the combined run-inspector surface for prompt assembly, output style, route decision, auto-router scores, orchestration, model requests, tools, errors, and run metadata.
- [x] Model Lab exposes eval/bench summaries as scannable tables with validation, weakest-signal, trace-proof, and evidence panels.
- [x] Run debug bundle export is available from the run inspector for one-click support/replay handoff.

Work:
- Convert model-team output into structured views: plan artifact, review findings, compare table, validation summary, patch proposal, and decision log. **Done for team-plan/evidence/review artifacts, compare/eval/bench tables, and patch review; broader decision-log polish remains a later UX pass.**
- Keep chat as the home surface; show details in flyouts or collapsible artifact views. **Done through chat-attached artifacts, Patch Review, Model Lab, and Prompt Microscope.**
- Add compact live progress rows for route, model, tools, and orchestration phases. **Done in run traces, active-agent surfaces, and the run inspector.**
- Merge prompt details, route details, and cost details into one run-inspector surface. **Done for prompt/route/model/tool/error metadata; exact cost accounting remains tied to provider estimates.**
- Make "next actions" contextual: execute plan, review patch, run validation, compare model, save as prompt plugin, create companion note. **Partially done:** review/validation/compare/debug actions exist; save-as-prompt-plugin and companion-note flows remain deferred.
- Align with `docs/UI_CLEANUP_PLAN.md`: calm default screen, flat surfaces, progressive disclosure, one path for diffs.

Acceptance:
- A team-plan response is readable in 30 seconds.
- A compare run is scannable without reading every raw model response first.
- A review run exposes findings as structured items with file/line/action metadata when available.
- Advanced telemetry is present but quiet by default.

## Phase 6 - Eval and Feedback Loop

Priority: P1

Goal: Use evaluation data to improve prompts, routing, and model assignments over time.

Progress:
- [x] Eval scoring includes weighted structural/runtime/style breakdowns, validation proof, weakest-signal reporting, and persisted recommendations.
- [x] Latest eval recommendations are exposed through the Routing Learning UI and annotate auto-router candidate cards.
- [x] Model Lab can compare prompt suites, task benches, Planning Room baseline runs, validation results, and previous-run deltas.
- [x] Prompt pack manifests can carry eval metadata and are visible in Model Lab before they influence routing.

Work:
- Add `routing-prompt-output` eval suite that scores route choice, prompt adherence, grounding, output structure, cost, latency, tool success, and validation proof. **Mostly done through prompt-routing tests, eval scoring, routing-adherence events, and bench trace proof; exact token/cost scoring remains an estimate.**
- Store baseline outputs for Friday, cheapest viable model, strongest model, and Planning Room team.
- Compare prompt plugin variants against base prompt. **Ready at registry/eval metadata level; actual plugin rendering remains feature-flagged/deferred.**
- Feed high-confidence eval recommendations into auto-router candidate cards and role assignment suggestions. **Done for auto-router card annotation and manual routing-learning recommendations; automatic role reassignment stays manual-by-design.**
- Add per-task-type model dashboard: coding, review, planning, summarization, debugging, compare, image, tool-heavy. **Done for current eval/bench categories; image-specific dashboards remain future work.**

Acceptance:
- Model Lab can answer: "Which model is best for this route and why?"
- Router candidate cards are informed by recent evals, not hand-written forever.
- Output style and prompt plugin changes can be A/B tested.
- User outcome feedback changes future routing recommendations only when enough evidence exists.

## Phase 7 - Skills, Prompt Plugins, and Importers

Priority: P2

Goal: Make reusable workflow knowledge safe, inspectable, and shareable.

Progress:
- [x] Added a read-only prompt plugin registry for project, user, and imported manifests.
- [x] Prompt pack UI in Model Lab shows roots, packs, manifests, trust/provenance, targets, sections, evals, safety, and issues before anything is enabled.
- [x] Registry flags invalid manifests and blocks project-instruction override attempts.
- [x] Prompt plugin folders can be prepared on demand without changing routing behavior.

Work:
- Implement read-only prompt plugin registry first. **Done.**
- Add OpenCode/Codex-style skill importers into OpenHarness-native manifests. **Deferred:** registry supports imported manifest locations, but importer conversion is not enabled yet.
- Add trust/provenance state: local, project, imported, community, disabled, verified. **Done for schema-backed source/trust display; verified signatures remain future work.**
- Add prompt pack UI with target route/model, eval status, safety notes, and last-used runs. **Done for targets/evals/safety; last-used run attribution remains future work.**
- Allow a Planning Room artifact to become a project-scoped prompt/plan template.

Acceptance:
- Users can inspect a prompt pack before enabling it.
- Imported skills cannot bypass OpenHarness trust modes.
- Prompt packs show eval health before they influence routing.

## Phase 8 - Operational Hardening

Priority: P2

Goal: Keep long-running workflows reliable.

Progress:
- [x] Routing-adherence events capture timeout/error/abort phase, model/provider/classifier context, retryability, fallback, and elapsed timing.
- [x] Session persistence writes atomically and stores run traces on assistant messages for recovery/replay.
- [x] Shell execution now resolves the active shell with safe fallbacks instead of assuming `/bin/zsh`.
- [x] No-provider handling now produces an explicit error instead of a fake local model response.
- [x] Run debug bundles export prompt assembly, route decision, model output markers, artifacts, errors, and retryability from persisted runs.

Work:
- Normalize timeout events across router classifier, agent phase, provider stream, tool call, and client SSE. **Done through routing-adherence event shape and existing phase hooks.**
- Add retry/fallback policies by workflow and model family. **Partially done:** orchestrator/agent fallback and retry surfaces exist; provider-family retry policy tuning remains future work.
- Store enough state to recover or explain partial Planning Room and execute runs. **Done through persisted run traces, artifacts, errors, and atomic session writes.**
- Add run replay for prompt assembly, route decision, model outputs, and artifact generation. **Done as exportable replay/debug data; full in-app rerun is deferred.**
- Add exportable debug bundle for one run. **Done.**

Acceptance:
- A timeout report identifies phase, model, provider, elapsed time, retryability, and fallback.
- A failed model-team run still produces useful partial output when possible.
- Support/debug can inspect one bundle without reading raw server logs.

## Implementation Order

1. Phase 0: Link roadmap and remove contradictions.
2. Phase 1: Prompt assembly metadata and prompt microscope.
3. Phase 2: Better route signals and bounded ambiguous-review behavior.
4. Phase 3: Planning Room artifact object and UI.
5. Phase 4: Single-model output style contracts.
6. Phase 5: Native presentation layer.
7. Phase 6: Eval feedback loop.
8. Phase 7: Skills/prompt plugins/importers.
9. Phase 8: Operational hardening.

## First Implementation Slice

Start with a narrow P0 slice:

1. Add `PromptAssembly` metadata without changing emitted prompt text.
2. Pass real router signals into `routeWithAutoRouter()`.
3. Add a bounded route for `review` and `review this`.
4. Add tests for prompt assembly metadata, route decisions, and no-regression direct answers.
5. Update Prompt Microscope to show prompt sections and route decision stages.

Validation:

```bash
npm run lint
npm run build
```

If this first slice changes server/runtime code, kill existing OpenHarness processes, relaunch, and verify `http://127.0.0.1:3001` and `http://127.0.0.1:5173`.

## Success Metrics

- Route accuracy: fewer user corrections like "I wanted a quick answer" or "why did it pick that model?"
- Cost control: fewer classifier calls for trivial direct tasks.
- Team quality: Planning Room artifacts score higher than single-model baselines on planning evals.
- Prompt transparency: every run can explain which prompt sections were used and why.
- Output usability: users can act on plans, findings, diffs, validations, and comparisons without reading raw transcripts.
- Runtime reliability: timeout/failure reports identify exact phase and recovery path.
