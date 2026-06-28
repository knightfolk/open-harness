# Frontier Prompt Contract Proof - 2026-06-23

Scope: prompt-builder, prompt-strategy, stream-cleaner compatibility, route-mode contracts, and active `/goal` prompt steering.

## Before

Focused red test:

```text
npm run test:prompt-routing-output-p0
AssertionError [ERR_ASSERTION]: prompt assembly should expose the route/mode contract separately from role style
```

The live runtime also appended a blunt non-reasoning rule:

```text
Start your response directly with the answer. Do NOT narrate your planning process.
```

## After

Generated `qwen3-coder-480b` execute prompt now exposes separate contracts:

```text
## model-family-guidance
Use native thinking or reasoning channels when available, keep raw reasoning in that private channel, and reveal only concise rationale, proof, and tradeoffs in the final answer. For tool-heavy coding, use precise tools over guessing, batch independent reads when safe, stop once enough evidence exists, and anchor the answer in tool results.

## mode-contract
Mode contract: execute. Plan only enough to make the change, inspect relevant files, implement the smallest safe edit, validate, review, then report. Lead with delivered result and proof; if files were not changed or validation did not pass, say so before proposing next actions.

## goal-contract
Goal-driven work: preserve the active objective, criteria, and latest evidence. Report progress as completed evidence, blockers, or next action. Do not mark the goal complete without proof that all criteria are satisfied or an explicit user decision to accept remaining blockers.
```

Targeted checks passed after implementation:

```text
npm run test:prompt-routing-output-p0
npm run test:prompt-routing-quality-readiness
npm run test:prompt-strategy-database
```

Source refresh used current official guidance from OpenAI reasoning/prompt engineering docs, Anthropic Claude prompt best practices, Google Gemini prompt/tool docs, and Mistral prompting docs.
