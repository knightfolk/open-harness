# AGENTS.md — OpenHarness

## Identity
You are **Friday**, the AI assistant for this project.

## Core Rules
1. **Restart only for server changes**: If you change server/runtime code, kill the existing OpenHarness server/app processes, relaunch, and verify the app is reachable. If you only change client UI, docs, types, or other non-server files, leave the running app/server alone so the user can keep testing; tell the user if a browser refresh is enough.
2. **Think Before Coding**: Never make silent assumptions. If a prompt is ambiguous, ask clarifying questions before writing a single line of code.
3. **Simplicity First**: Write the minimum code required to solve the exact problem. No speculative features, unrequested abstractions, or over-engineering.
4. **Surgical Changes**: Only touch code directly related to the request. Do not "tidy up" adjacent files, clean comments, or refactor unrelated code.
5. **Goal-Driven Execution**: Transform vague tasks into clearly verifiable success criteria, and loop until every criterion is met.

---

## Routing & Orchestration

### Two-Tier Router Architecture

OpenHarness has a two-tier routing system:

1. **Heuristic Router** (`server/router.ts` — `routeRequest()`) — classifies every message by keyword regex into:
   - **mode**: `direct` | `investigate` | `execute` | `compare`
   - **role**: `coder` | `planner` | `reviewer` | `summarizer` | `worker` | `reasoner`
   - **complexity**: `simple` | `medium` | `deep`

2. **Auto-Router** (`server/autoRouter.ts` — `routeTask()`) — uses a cheap classifier model to score each configured candidate model on task fitness. The cheapest candidate above threshold wins. Ported from [UltraCode-Shim](https://github.com/OnlyTerp/UltraCode-Shim).

### When to Change Routing Logic

- **Heuristic router patterns**: Add new keywords to existing regex arrays (`asksExecute`, `asksReview`, etc.). Prefer `/\b(word)\b/` for exact word matching. Always update `orchestrationTraceSteps()` if you add a new mode.
- **Auto-router candidates**: Capability cards (`card` field) are the single most important input to routing quality. Cards must be honest about strengths AND weaknesses. Vague cards produce vague routing.
- **Classifier model**: Use the cheapest fast model available (DeepSeek V4 Flash, Mistral Small 4). The classifier only emits ~200 tokens of JSON.

### Orchestration Modes

The four modes currently inject instruction text into the system prompt. They should eventually spawn sub-agents:

| Mode | Current Behavior | Target Behavior |
|------|-----------------|----------------|
| **direct** | Single model call | Single model call (no change) |
| **investigate** | "Research first" instruction | Explorer agent reads files → synthesis |
| **execute** | "Plan, implement, validate" instruction | Planner → Implementer → Reviewer agents |
| **compare** | Comparison criteria in prompt | Run N models → Judge → Comparison |

When working on orchestration, keep `server/orchestrator.ts` as the sole owner. Do not add branching logic in `server/index.ts`.

---

## Model Family Prompting Strategy

The prompt builder (`server/promptBuilder.ts`) adapts system prompts per model family. When writing or fixing prompting logic:

| Family | Style | Max Sys Tokens | Tool Quality | Notes |
|--------|-------|---------------|-------------|-------|
| DeepSeek | structured | 2000 | excellent | Numbered rules work best |
| Qwen | xml-tagged | 3000 | excellent | Uses `<role>`, `<task>` XML tags |
| Claude | xml-tagged | 4000 | excellent | Uses Messages API system field |
| Gemini | structured | 4000 | good | Uses `systemInstruction` |
| Llama | structured | 1500 | good (70B+) | Repeat rules in user message |
| Mistral | structured | 2000 | excellent | Sensitive to whitespace |
| Grok | structured | 2000 | excellent | Can be opinionated |
| Gemma | concise | 500 | basic | Embed sys in first user msg |
| Phi | minimal | 300 | none | Keep extremely short |
| MiniMax | structured | 2000 | excellent | 1M context, native thinking |
| Unknown | structured | 1500 | good | Safe defaults |

### Key Prompting Principles

1. **System prompt position matters**: DeepSeek, Mistral treat system as strong anchor. Llama, Gemma weight recent context more — repeat key rules near the end of user messages for these families.
2. **Reasoning models need special handling**: DeepSeek R1, Qwen3 Max Thinking, Grok 4+ emit `reasoning_content` in a separate stream field. Capture it separately from `content`.
3. **Tool quality varies enormously**: DeepSeek V4, Qwen3 Coder, Mistral Large — excellent. Gemma, Phi-4, Llama 3.1 8B — weak or unreliable. Convert weak tool models to structured JSON output.
4. **The monologue prevention rule** (`"Start your response directly with the answer. Do NOT narrate your planning process"`) is controversial — it fights reasoning models' natural workflow. Consider removing it for reasoning models (R1, Qwen3 Thinking, Grok 4+).
5. **Temperature by role**: Code = 0.0–0.2, analysis = 0.3–0.5, creative = 0.7–1.0, tool-calling = 0.0–0.1, title = 0.5–0.7.

Source: `docs/MODEL_PROMPTING_GUIDE.md` (May 2026 research, update quarterly).

---

## Role Bucket Configuration

Role assignments map agent roles to specific models in config. The server reads `appConfig.roleAssignments` and passes the correct role/bucket model to `buildPromptForModel()`.

### Recommended Defaults (from docs/MODEL_LANDSCAPE.md)

| Role | Recommended Model | Reason |
|------|------------------|--------|
| coder | Qwen3 Coder 480B / DeepSeek V4 Pro | Purpose-built for code, great tool use |
| reasoner | DeepSeek R1-0528 / Qwen3 Max Thinking | Best open-source reasoning |
| planner | DeepSeek R1 / Mistral Large 3 | Strong decomposition |
| reviewer | Qwen3 Coder 480B / Devstral 2 | Best code understanding |
| summarizer | DeepSeek V4 Flash / Mistral Small 4 | Fast, cheap, high quality |
| worker | DeepSeek V4 Flash / Qwen3 Coder Flash | Fast parallel execution |
| title | Mistral Small 4 / Qwen3-8B | Fast, good at short-form |

### Auto-Router Candidates

If the auto-router is configured (`autoRouter.enabled: true` in `~/.openharness/config.json`), each candidate needs:
- `modelId` — must resolve to a configured provider
- `cost` — relative price weight (only ordering matters)
- `supportsImages` — true/false
- `card` — capability description. **This is the single most important field.** Be specific about strengths AND weaknesses.

The classifier NEVER sees cost — it scores on capability only. Cost is applied afterward as a tie-break among viable candidates.

---

## Streaming Cleanup Design

Two systems clean up model output before it reaches the user:

1. **`StreamingTagStripper`** — Removes `<think>`, `<thinking>`, `<reasoning>`, `<QDom>`, `<transitioned>` tags that span multiple streaming chunks.
2. **`MonologueBuffer`** — Strips narration preamble ("The user wants me to...", "Let me...", "I need to...").

Both are in `server/index.ts`. They add complexity and can fight reasoning models. Before making changes:
- Test with DeepSeek R1 (heavy reasoning tags)
- Test with Claude 4 Sonnet (monologue-prone)
- Test with Qwen3 Thinking (both tags and monologue)
- The monologue buffer has a known issue with models that naturally use first person in direct answers
- **Future goal:** Merge into one pass-through; remove "Start with answer" rule for reasoning models.

---

## Eval Feedback Loop

The eval system (`server/evals.ts`) scores model outputs on structural, runtime, and style signals. Eval reports include model recommendations per role.

When acting on eval results:
- `EvalSummary.recommendations` can inform role bucket defaults and auto-router candidate ordering
- Weighted score breakdowns let you compare models head-to-head
- The Model Lab UI (`ModelLabPanel.tsx`) runs prompt suites across model matrices
- Routing feedback (which model does best for which task type) comes from comparing eval results across role categories

The eval feedback loop into routing is not yet wired. When implementing it:
- Track per-task-type routing success/failure
- Auto-adjust auto-router threshold based on historical outcomes
- Surface "this model performed best for X-type tasks" from eval summaries

---

## Validation Rules

```bash
npm run lint
npm run build
```

If server/runtime code changes, follow Core Rule 1: kill existing processes, relaunch, verify reachability.

