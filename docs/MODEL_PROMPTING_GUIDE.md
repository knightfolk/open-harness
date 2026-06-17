# Open-Source Model Prompting Guide

> **Purpose:** Definitive reference for how to optimally prompt each of the top 30+ open-source/open-weights models as of May 2026. Designed for consumption by agents, subagents, workers, and harness code that adapts system prompts, formatting, and workflow strategies based on the active model.

> **Audience:** OpenHarness harness, agent orchestration layer, and any system that adapts prompting behavior per-model at runtime.

> **Research date:** 2026-06-17. Update quarterly or on major model releases.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Universal Prompting Principles](#universal-prompting-principles)
3. [Model Family Deep Dives](#model-family-deep-dives)
4. [Role-Based Model Recommendations](#role-based-model-recommendations)
5. [Agent/Harness Integration Guide](#agentharness-integration-guide)
6. [Model Comparison Matrix](#model-comparison-matrix)
7. [Appendices](#appendices)

---

## Executive Summary

### Key Findings

1. **No two model families prompt identically.** While most use OpenAI-compatible APIs, their internal chat templates, system prompt handling, tool-calling formats, and instruction-following behaviors differ significantly.

2. **Three prompting paradigms dominate:**
   - **ChatML-style** (DeepSeek, Qwen): `<|im_start|>` / special token delimited
   - **Llama-style** (Meta, many fine-tunes): `<|begin_of_text|>` + `<|start_header_id|>` headers
   - **Mistral-style** (Mistral): `<s>[INST]...[/INST]` blocks
   - **Native API format** (when served via API endpoints like OpenRouter, Ollama, LM Studio): Standard `{role, content}` messages — the API translates internally

3. **When using API endpoints (OpenRouter, Ollama, LM Studio), you rarely need to worry about raw chat templates.** The provider translates standard `messages` arrays. But system prompt structure, tool definitions, and instruction style still matter per-model.

4. **Reasoning models (DeepSeek R1, Qwen3 Max Thinking, Grok 4.3) need special handling:** They emit thinking tokens that must be captured separately, and they benefit from explicit reasoning directives.

5. **Tool/function calling quality varies enormously.** DeepSeek V4, Qwen3 Coder, Mistral Large, and Grok 4.3 have excellent native tool use. Smaller models (Gemma, Phi-4, Llama 3.1 8B) have weaker or unreliable tool following.

6. **System prompt position and length sensitivity matters.** Some models (DeepSeek, Mistral) treat the system message as a strong anchor. Others (Llama, Gemma) weight recent context more and benefit from key instructions repeated near the end of the user message.

---

## Universal Prompting Principles

These apply to ALL models. Model-specific overrides follow in each family section.

### System Prompt Structure (Universal Template)

```
1. Role/Identity (who you are)
2. Core Behavioral Rules (numbered, explicit)
3. Available Tools (brief descriptions, format expectations)
4. Output Format Requirements (markup, code blocks, structure)
5. Guardrails (what NOT to do)
6. [Optional] Examples (few-shot for complex tasks)
```

### Message Ordering Best Practices

- **System message first, always.** One system message at the start of the conversation.
- **For long conversations:** Some models (Llama, Gemma) benefit from key reminders in the latest user message rather than relying solely on the system message.
- **For tool-using agents:** Keep tool result messages compact. Verbose tool outputs degrade performance on smaller models.

### Temperature and Sampling

| Task Type | Recommended Temperature | Notes |
|-----------|------------------------|-------|
| Code generation | 0.0–0.2 | Deterministic, precise |
| Analysis/reasoning | 0.3–0.5 | Some creativity, mostly focused |
| Creative writing | 0.7–1.0 | Higher variance acceptable |
| Tool-calling agents | 0.0–0.1 | Must be precise for structured output |
| Title generation | 0.5–0.7 | Brief creative task |
| Summarization | 0.1–0.3 | Factual compression |

### When to Adapt Per-Model

The harness should adapt in these dimensions:

1. **System prompt wording** — Some models need explicit XML tags, others need plain language
2. **Tool definition format** — JSON Schema verbosity, whether to include examples
3. **Chain-of-thought triggers** — Which phrase activates reasoning
4. **Max output tokens** — Set appropriately per model to avoid truncation
5. **Stop sequences** — Model-specific tokens
6. **Streaming behavior** — Reasoning models emit separate fields

---

## Model Family Deep Dives

---

### 1. DeepSeek Family

**Models:** DeepSeek V3 (deepseek-chat), V3.1, V3.2, V4 Pro, V4 Flash, R1, R1-0528, R1 Distill variants

| Model | Context | Max Output | Cost (in/out per M tokens) | Speed |
|-------|---------|------------|---------------------------|-------|
| V4 Pro | 1M | 384K | $0.44 / $0.87 | Medium |
| V4 Flash | 1M | 131K | $0.10 / $0.20 | Fast |
| V3 (deepseek-chat) | 131K | 16K | $0.23 / $0.91 | Fast |
| V3.2 | 131K | 16K | $0.25 / $0.38 | Fast |
| R1 | 164K | 16K | $0.73 / $2.55 | Slow |
| R1-0528 | 164K | 16K | $0.55 / $2.15 | Slow |

#### Raw Chat Template

```
<｜begin▁of▁sentence｜>{system_prompt}<｜User｜>{user_message}<｜Assistant｜>{assistant_message}<｜end▁of▁sentence｜>
```

Tool calls use: `<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>function<｜tool▁sep｜>{name}\n```json\n{args}\n```<｜tool▁call▁end｜>`

#### System Prompt Best Practices

- **DeepSeek models respond extremely well to structured, numbered instructions.** Use numbered lists for behavioral rules.
- **DeepSeek V3/V4 are among the best open models for instruction following.** They handle complex multi-step prompts reliably.
- **Keep system prompts under 2000 tokens.** Longer prompts can cause earlier instructions to be "forgotten."
- **Use explicit section markers** like `## Rules`, `## Output Format`. DeepSeek respects markdown headers.
- **For tool calling:** DeepSeek V3 and V4 have native, high-quality function calling. Define tools with standard `tools` parameter + JSON Schema. No special prompting beyond clear tool descriptions.
- **Chinese and English mixed prompts work natively.** DeepSeek is bilingual out of the box.

#### Reasoning Models (R1, R1-0528)

- **R1 emits a `reasoning_content` field** in streaming responses. The harness must capture this separately from `content`.
- **R1 benefits from explicit "think" directives** — quality improves with `Think carefully about this problem step by step before answering.`
- **R1's reasoning tokens count toward output limits.** Set `max_tokens` higher (8192+) for complex tasks.
- **R1-0528 is significantly improved over original R1** — better tool use, less rambling, more focused reasoning.
- **R1 Distill variants** (Qwen-32B, Llama-70B) are weaker. Use only when full R1 is unavailable.

#### Known Quirks

- May generate redundant closing tokens if system prompt is too long — strip in post-processing.
- Sometimes produces "empty" assistant turns when tool calls are expected — check `tool_calls` before treating as content.
- R1's thinking can be excessively long for simple tasks — route to V3/V4 Flash for non-reasoning work.

#### Recommended Agent Prompt Template

```
You are {role_name}, {role_description}.

## Core Rules
1. {rule_1}
2. {rule_2}
3. Always respond with valid {output_format}
4. When using tools, wait for results before concluding

## Available Tools
{tool_descriptions}

## Output Format
{format_specification}
```

---

### 2. Meta Llama Family

**Models:** Llama 4 Scout (17B×16E MoE), Llama 4 Maverick (17B×128E MoE), Llama 3.3 70B, Llama 3.1 8B

| Model | Context | Max Output | Cost (in/out per M tokens) | Speed |
|-------|---------|------------|---------------------------|-------|
| Llama 4 Scout | 10M | 16K | $0.08 / $0.30 | Fast |
| Llama 4 Maverick | 1M | 16K | $0.15 / $0.60 | Medium |
| Llama 3.3 70B | 131K | 16K | $0.10 / $0.32 | Medium |
| Llama 3.1 8B | 131K | 16K | $0.02 / $0.05 | Very Fast |

#### Raw Chat Template

```
<|begin_of_text|><|start_header_id|>system<|end_header_id|>

{system_prompt}<|eot_id|><|start_header_id|>user<|end_header_id|>

{user_message}<|eot_id|><|start_header_id|>assistant<|end_header_id|>

{assistant_message}<|eot_id|>
```

#### System Prompt Best Practices

- **Llama models weight recent context more heavily than distant system instructions.** For long conversations, repeat critical instructions in the latest user message.
- **Llama 3.3 70B and Llama 4:** Use system message for role/rules, but repeat key constraints in the user message if conversation is long.
- **Llama 3.1 8B is a small model.** Keep system prompts under 500 tokens. Use simple, direct language.
- **Llama 4 Scout's 10M context is game-changing for RAG.** Use explicit retrieval instructions: `Based on the provided context below, answer the question. If the answer is not in the context, say so.`
- **Llama 4 MoE activates different expert subsets per prompt.** Be explicit about expected output format for consistency.

#### Tool Calling

- **Llama 3.3 70B:** Native tool calling via standard `tools` param. Good but not as reliable as DeepSeek V4.
- **Llama 4 Scout/Maverick:** Improved tool calling over 3.3. Handles multi-tool scenarios well.
- **Llama 3.1 8B:** Unreliable tool calling. For agent work, use 70B+. If only 8B, use structured JSON output instead.

#### Known Quirks

- **Verbose by default.** Add `Keep your response under N words.`
- **Llama 3.3 may refuse benign requests** due to aggressive safety training — work around with careful framing.
- **Llama 4 Scout loses track at extreme lengths** (>1M tokens). Add periodic reminders.
- **No native reasoning/thinking tokens.** Use explicit `Let's think step by step:` for chain-of-thought.

#### Recommended Agent Prompt Template

```
You are {role_name}. {brief_role_description}

CRITICAL RULES:
- {rule_1}
- {rule_2}
- {output_format_rule}

TOOLS: {tool_list}

When responding, follow this format:
{format_example}
```

---

### 3. Qwen Family

**Models:** Qwen3 Coder (480B A35B), Qwen3 Coder Flash, Qwen3 Coder Plus, Qwen3 Max, Qwen3 Max Thinking, Qwen3.5 (397B, 122B, 27B, 9B), Qwen3.6 (27B, 35B, Max), Qwen3-235B-A22B, Qwen3-32B, Qwen3-14B, Qwen3-8B

| Model | Context | Max Output | Cost (in/out per M tokens) | Speed |
|-------|---------|------------|---------------------------|-------|
| Qwen3 Coder 480B | 1M | 65K | $0.22 / $1.80 | Medium |
| Qwen3 Coder Flash | 1M | 65K | $0.20 / $0.98 | Fast |
| Qwen3 Coder Plus | 1M | 65K | $0.65 / $3.25 | Medium |
| Qwen3 Max | 262K | 32K | $0.78 / $3.90 | Medium-Slow |
| Qwen3 Max Thinking | 262K | 32K | $0.78 / $3.90 | Slow |
| Qwen3.5 397B | 262K | 65K | $0.39 / $2.34 | Medium |
| Qwen3.5 122B | 262K | — | $0.26 / $2.08 | Medium |
| Qwen3.5 27B | 262K | — | $0.20 / $1.56 | Fast |
| Qwen3.6 27B | 262K | 262K | $0.29 / $3.20 | Fast |
| Qwen3-235B-A22B | 262K | 16K | $0.07 / $0.10 | Fast |
| Qwen3-32B | 131K | — | $0.08 / $0.28 | Fast |
| Qwen3-14B | 132K | — | $0.10 / $0.24 | Very Fast |
| Qwen3-8B | 131K | — | $0.05 / $0.40 | Very Fast |

#### Raw Chat Template (ChatML)

```
<|im_start|>system
{system_prompt}<|im_end|>
<|im_start|>user
{user_message}<|im_end|>
<|im_start|>assistant
{assistant_message}<|im_end|>
```

#### System Prompt Best Practices

- **Among the most instruction-following open models.** Handle complex, multi-section system prompts exceptionally well.
- **Qwen3 Coder is purpose-built for code.** Responds well to detailed task descriptions with file context, error messages, and expected behavior.
- **Benefits from "plan then code" directives** for complex tasks: `First, analyze the problem and describe your approach. Then implement the solution.`
- **Qwen3 Max and Qwen3.5 are strong generalists.** Analysis, writing, structured output.
- **Smaller models (8B, 14B):** Shorter, focused prompts. One task per prompt.
- **Handle XML-tagged sections well.** Use `<context>`, `<task>`, `<output_format>` tags.

#### Tool Calling

- **Qwen3 Coder: Excellent.** Standard JSON Schema, follows reliably.
- **Qwen3 Max: Excellent.** On par with DeepSeek V4.
- **Qwen3.5 397B: Top-tier.** One of the best open-source options for agent workflows.
- **Smaller Qwen (8B–32B): Decent** but may produce malformed JSON in tool arguments. Validate and retry.

#### Reasoning (Thinking Variants)

- **Thinking variants emit `reasoning_content`** in a separate stream, like DeepSeek R1.
- **Qwen3.5 and Qwen3.6 toggle thinking** via `enable_thinking` parameter or `<think` tags.
- **Non-thinking variants:** Use `Let's think step by step:` to trigger in-output reasoning.

#### Known Quirks

- **1M context is real but degrades after ~300K** for complex reasoning. Use RAG for very long contexts.
- **May include Chinese characters** with bilingual context. Specify language explicitly.
- **Qwen3-8B can be overly compliant** — follows bad user-message instructions over system. Reinforce guardrails.
- **Qwen3.6 27B's 262K max output is exceptional** — ideal for full-file code generation.

#### Recommended Code Agent Template

```
<role>
You are an expert software engineer. You write clean, correct, well-tested code.
</role>

<task>
{task_description}
</task>

<context>
{relevant_files_or_context}
</context>

<constraints>
- {constraint_1}
- {constraint_2}
- Output only the modified code, no explanations unless asked
</constraints>

<output_format>
{format_specification}
</output_format>
```

---

### 4. Mistral Family

**Models:** Mistral Large 3 (2512), Mistral Medium 3.5/3.1, Mistral Small 4 (2603), Devstral 2, Devstral Medium/Small, Codestral 2508

| Model | Context | Max Output | Cost (in/out per M tokens) | Speed |
|-------|---------|------------|---------------------------|-------|
| Mistral Large 3 | 262K | — | $0.50 / $1.50 | Medium |
| Mistral Medium 3.5 | 262K | — | $0.50 / $2.00 | Medium-Fast |
| Mistral Small 4 | 262K | — | $0.15 / $0.60 | Fast |
| Devstral 2 | 262K | — | $0.40 / $2.00 | Medium |
| Devstral Small | 131K | — | $0.10 / $0.30 | Fast |
| Codestral 2508 | 256K | — | $0.30 / $0.90 | Fast |

#### Raw Chat Template

```
<s>[INST] {system_message}

{user_message} [/INST]{assistant_message}</s>[INST] {next_user_message} [/INST]
```

#### System Prompt Best Practices

- **Mistral has unique system prompt placement:** System instructions go inside the first `[INST]...[/INST]` block in the raw template. When using the API, standard `system` role works.
- **Mistral Large 3 excels at complex multi-step instructions.** One of the strongest open models for agent workflows.
- **Sensitive to prompt ordering.** Put most important instructions first AND last (recency bias).
- **Mistral Medium 3.5 punches above its weight class.** Strong mid-tier for coding and analysis.
- **Devstral is specifically trained for software development.** Strong code generation, debugging, refactoring. Use as dedicated code agent.
- **Codestral is code-specialized.** For pure code tasks (completion, generation, review), more efficient per-token than general models.

#### Tool Calling

- **Mistral Large 3:** Native, high-quality tool calling. Supports parallel tool calls.
- **Medium/Small:** Good tool calling but need more explicit tool descriptions.
- **Devstral:** Strong tool calling for development tools (file ops, shell, etc.).
- **Codestral:** Basic tool calling, optimized for code completion over agent workflows.

#### Known Quirks

- **Sensitive to whitespace** in prompts. Avoid trailing spaces, inconsistent indentation.
- **Mistral Large may over-explain.** Add `Be concise.` or `Provide only the answer, no preamble.`
- **Devstral may generate unescaped shell commands.** Validate before execution.
- **Mistral Small 4 is a good fast/cheap option** for title generation, routing, classification.

#### Recommended Agent Template

```
You are {role_name}. {role_description}

Behavior:
1. {behavior_rule_1}
2. {behavior_rule_2}
3. Use tools when needed, then synthesize results
4. Be precise and concise

Tools available:
{tool_descriptions_in_json_schema}

Important: Always call tools with exact parameter names. Never guess parameter values.
```

---

### 5. Google Gemma Family

**Models:** Gemma 4 31B, Gemma 4 26B A4B (MoE), Gemma 3 27B, Gemma 3 12B, Gemma 3 4B

| Model | Context | Max Output | Cost (in/out per M tokens) | Speed |
|-------|---------|------------|---------------------------|-------|
| Gemma 4 31B | 262K | 16K | $0.12 / $0.37 | Fast |
| Gemma 4 26B A4B | 262K | — | $0.06 / $0.33 | Fast |
| Gemma 3 27B | 131K | 16K | $0.08 / $0.16 | Fast |

#### Raw Chat Template

```
<start_of_turn>user
{user_message}<end_of_turn>
<start_of_turn>model
{assistant_message}<end_of_turn>
```

System instructions are injected into the first user turn or as a system prefix.

#### System Prompt Best Practices

- **Limited system prompt handling.** The `system` role is not natively supported in older Gemma. Prepend system instructions to first user message.
- **Gemma 4 has improved system prompt support** via API endpoints.
- **Keep system prompts short and direct — under 500 tokens.** Gemma doesn't handle complex multi-page prompts well.
- **Use simple, imperative language.** `Write a function that...` > `As an expert developer, please craft...`
- **Strong for their size but limited compared to 70B+ models.** Best for fast, focused tasks.

#### Tool Calling

- **Limited native tool calling.** Gemma 4 has some support but not as robust as DeepSeek/Qwen/Mistral.
- **For agent workflows, use structured JSON output** instead of native tool calls: `Respond with JSON: {field_spec}`
- **Gemma 3 4B/12B: Do NOT use for tool-calling agents.** Simple generation only.

#### Known Quirks

- **Overly cautious** — may refuse benign requests. Use neutral, task-focused framing.
- **Code generation is good for its size** but can produce outdated patterns. Specify language/framework version.
- **Gemma 4 26B A4B (MoE)** is a good cost/performance trade-off for high-volume low-complexity tasks.

---

### 6. xAI Grok Family

**Models:** Grok 4.3, Grok Build 0.1, Grok 4.20

| Model | Context | Max Output | Cost (in/out per M tokens) | Speed |
|-------|---------|------------|---------------------------|-------|
| Grok 4.3 | 1M | — | $1.25 / $2.50 | Medium |
| Grok Build 0.1 | 256K | — | $1.00 / $2.00 | Medium |
| Grok 4.20 | 2M | — | — | Medium |

#### System Prompt Best Practices

- **OpenAI-compatible API format.** Standard `messages` array with `system` role.
- **Grok 4.3 has reasoning capabilities** similar to DeepSeek R1 but integrated into main response. Benefits from `Think through this carefully before answering.`
- **Grok Build is optimized for code/development.** Use as code-focused agent.
- **Distinctive conversational style** — more informal and direct. Request formal output explicitly if needed: `Respond in a professional, technical tone.`
- **Handles long contexts well** but benefits from explicit structure: section headers, numbered lists, clear task delineation.

#### Tool Calling

- **Grok 4.3:** Native tool calling via standard `tools` param. Comparable to DeepSeek V4.
- **Grok Build:** Strong tool calling for development tools.
- **Grok 4.20:** Supports multi-agent tool calling patterns natively.

#### Known Quirks

- **Can be opinionated** and may editorialize. Add `Provide factual, neutral responses.`
- **Pricier than most open-source alternatives** — use when reasoning/long-context strengths matter.
- **Grok 4.3's reasoning is less transparent than R1's** — doesn't always expose the reasoning chain.

---

### 7. Cohere Command A

| Model | Context | Max Output | Cost (in/out per M tokens) | Speed |
|-------|---------|------------|---------------------------|-------|
| Command A | 256K | 8K | $2.50 / $10.00 | Medium |

#### System Prompt Best Practices

- **Flagship open-weights Cohere model.** OpenAI-compatible API.
- **Excels at RAG and retrieval-augmented tasks.** Specifically trained to ground in provided context.
- **Use explicit grounding instructions:** `Based only on the documents provided below, answer the question.`
- **Structure system prompts with clear sections.** Use `===` or `---` separators.
- **Multi-language capable** but strongest in English.

#### Tool Calling

- **Native tool calling** via standard `tools` param. Good quality but expensive per-token.
- **For tool-calling at scale, consider cheaper alternatives** (DeepSeek V4 Flash, Qwen3 Coder Flash) unless Command A's RAG strengths are needed.

#### Known Quirks

- **Expensive:** $2.50/M input, $10/M output. Reserve for high-value tasks.
- **8K max output limit.** Not suitable for long-form code generation.
- **Strong at structured data extraction and classification.**

---

### 8. NVIDIA Nemotron Family

**Models:** Nemotron 3 Super 120B A12B (MoE), Nemotron 3 Nano 30B A3B (MoE)

| Model | Context | Max Output | Cost (in/out per M tokens) | Speed |
|-------|---------|------------|---------------------------|-------|
| Super 120B | 1M | — | $0.09 / $0.45 | Medium-Fast |
| Nano 30B | 262K | 228K | $0.05 / $0.20 | Fast |

#### System Prompt Best Practices

- **OpenAI-compatible API.** Standard messages array.
- **Super 120B is a strong MoE model** competing with Llama 3.3 70B on quality at lower serving cost.
- **Trained for helpfulness and instruction following.** Responds well to direct, clear prompts.
- **Nano 30B's 228K max output is exceptional for its size.** Good for long-form generation.
- **Both benefit from explicit output format instructions.**

#### Tool Calling

- **Basic tool calling support.** Adequate but not at DeepSeek V4 / Qwen3 Coder level.
- **For agent workflows, prefer Super over Nano** for reliability.

#### Known Quirks

- **Can be overly verbose.** Add length constraints.
- **Nano's 228K output is useful but may lose coherence** at extreme lengths. Monitor quality.
- **Good cost/performance ratio for mid-tier tasks.**

---

### 9. Zhipu GLM Family

**Models:** GLM 5, GLM 5.1, GLM 5 Turbo, GLM 5V Turbo, GLM 4.7, GLM 4.7 Flash

| Model | Context | Max Output | Cost (in/out per M tokens) | Speed |
|-------|---------|------------|---------------------------|-------|
| GLM 5 | 203K | — | $0.60 / $1.92 | Medium |
| GLM 5 Turbo | 203K | — | — | Fast |
| GLM 5.1 | 203K | — | — | Medium |

#### System Prompt Best Practices

- **OpenAI-compatible API.** Standard `messages` array.
- **Bilingual (Chinese/English) with strong Chinese performance.**
- **GLM 5 is a strong generalist** competitive with Llama 3.3 70B and Mistral Medium.
- **Keep system prompts concise and direct.** Doesn't handle overly complex multi-section prompts as well as DeepSeek/Qwen.
- **Use explicit format instructions.** Sometimes mixes response formats (code blocks when prose expected).

#### Tool Calling

- **GLM 5 has native tool calling.** Adequate for standard agent workflows.
- **GLM 5V Turbo adds vision** for multimodal tasks.

#### Known Quirks

- **May default to Chinese** in ambiguous contexts. Add `Respond in English.` to system prompts.
- **203K context is adequate but smaller than Qwen/DeepSeek V4's 1M.**
- **GLM 5.1 is the latest and strongest** — prefer over GLM 5 when available.

---

### 10. AI21 Jamba Large 1.7

| Model | Context | Max Output | Cost (in/out per M tokens) | Speed |
|-------|---------|------------|---------------------------|-------|
| Jamba Large 1.7 | 256K | 4K | $2.00 / $8.00 | Medium |

#### System Prompt Best Practices

- **Hybrid SSM-Transformer architecture** (Mamba + attention). Efficient long-context handling.
- **OpenAI-compatible API.**
- **Strong at long-context understanding** — processes long documents efficiently via SSM component.
- **Handles multi-section system prompts well.**

#### Tool Calling

- **Native tool calling support.** Adequate quality.

#### Known Quirks

- **Expensive per-token.** Reserve for long-context understanding tasks.
- **4K max output is very limiting.** Most competitors offer 8K+.
- **Good for analysis and extraction from long documents.**

---

### 11. Microsoft Phi-4

| Model | Context | Max Output | Cost (in/out per M tokens) | Speed |
|-------|---------|------------|---------------------------|-------|
| Phi-4 | 16K | — | $0.065 / $0.14 | Very Fast |

#### System Prompt Best Practices

- **Small (14B) model optimized for efficiency.** Punches above parameter count on reasoning.
- **Keep system prompts very short — under 300 tokens.** Limited context capacity.
- **Direct, task-specific prompts only.** No elaborate role-playing or multi-section prompts.
- **Surprisingly strong at math and logic.** Good for classification, extraction, short-form tasks.
- **Handles structured output (JSON, tables) well** for its size.

#### Tool Calling

- **Limited tool calling capability.** Use structured JSON output instead of native tool calls.
- **Best for single-tool or simple workflows.** Don't expect multi-tool orchestration.

#### Known Quirks

- **16K context window is very small.** Cannot handle long conversations or large documents.
- **May hallucinate outside training distribution.** Validate factual outputs.
- **Excellent for edge deployment, classification, routing, lightweight tasks.** Not a primary coding agent.

---

## Role-Based Model Recommendations

### Primary Coding Agent (complex, multi-step code tasks)

| Priority | Model | Why |
|----------|-------|-----|
| 1st | **Qwen3 Coder 480B** | Purpose-built for code, 1M context, excellent tool use |
| 2nd | **DeepSeek V4 Pro** | Strong all-around with 1M context and great tool calling |
| 3rd | **Devstral 2** | Code-specialized, strong tool calling, efficient |
| 4th | **Qwen3 Coder Flash** | Faster/cheaper alternative to full Coder |
| 5th | **Codestral 2508** | Code-specialized, good quality per token |

### Reasoning Agent (complex analysis, debugging, planning)

| Priority | Model | Why |
|----------|-------|-----|
| 1st | **DeepSeek R1-0528** | Best open-source reasoning, transparent thinking |
| 2nd | **Qwen3 Max Thinking** | Strong reasoning with transparent thinking tokens |
| 3rd | **Grok 4.3** | Good reasoning with 1M context |
| 4th | **DeepSeek V4 Pro** | Strong reasoning without explicit thinking mode |

### Summarizer (text compression, key point extraction)

| Priority | Model | Why |
|----------|-------|-----|
| 1st | **DeepSeek V4 Flash** | Fast, cheap, high-quality summarization |
| 2nd | **Mistral Small 4** | Fast and efficient for summarization |
| 3rd | **Qwen3-235B-A22B** | Very cheap per-token, good quality |
| 4th | **Gemma 4 26B A4B** | Cheap MoE model, adequate quality |

### Title Generator (conversation/session naming)

| Priority | Model | Why |
|----------|-------|-----|
| 1st | **Mistral Small 4** | Fast, cheap, good at short-form tasks |
| 2nd | **DeepSeek V4 Flash** | Fast and cheap |
| 3rd | **Qwen3-8B** | Very cheap, adequate for 5-10 word titles |
| 4th | **Gemma 3 4B** | Smallest viable option |

### Planner (task decomposition, implementation planning)

| Priority | Model | Why |
|----------|-------|-----|
| 1st | **DeepSeek R1-0528** | Best reasoning for complex decomposition |
| 2nd | **Qwen3 Max Thinking** | Strong reasoning for planning |
| 3rd | **Mistral Large 3** | Strong instruction following for structured plans |
| 4th | **DeepSeek V4 Pro** | Good all-around planner |

### Reviewer (code review, security audit)

| Priority | Model | Why |
|----------|-------|-----|
| 1st | **Qwen3 Coder 480B** | Best code understanding for review |
| 2nd | **DeepSeek V4 Pro** | Strong code analysis with long context |
| 3rd | **Devstral 2** | Code-specialized review capabilities |
| 4th | **Mistral Large 3** | Good structured output for review findings |

### Subagent/Worker (fast, parallel task execution)

| Priority | Model | Why |
|----------|-------|-----|
| 1st | **Qwen3 Coder Flash** | Fast code model for parallel workers |
| 2nd | **DeepSeek V4 Flash** | Fast and cheap for bulk tasks |
| 3rd | **Qwen3-235B-A22B** | Very cheap, decent quality |
| 4th | **Nemotron Nano 30B** | Fast MoE with long output support |

### Long-Context / RAG Agent

| Priority | Model | Why |
|----------|-------|-----|
| 1st | **Llama 4 Scout** | 10M context — unmatched for long context |
| 2nd | **DeepSeek V4 Pro** | 1M context, strong retrieval and synthesis |
| 3rd | **Qwen3 Coder 480B** | 1M context for large codebase analysis |
| 4th | **Command A** | Strong RAG grounding (but expensive) |

---

## Agent/Harness Integration Guide

### How to Use This Document in OpenHarness

#### 1. Model Detection and Prompt Adaptation

The harness should detect the active model and adapt prompting in these dimensions:

```typescript
interface ModelPromptConfig {
  // How to structure the system prompt
  systemPromptStyle: 'structured' | 'concise' | 'xml-tagged' | 'minimal';

  // Maximum recommended system prompt tokens
  maxSystemPromptTokens: number;

  // Tool calling capability level
  toolCallQuality: 'excellent' | 'good' | 'basic' | 'none';

  // Whether to use native tool calls or structured JSON output
  preferNativeToolCalls: boolean;

  // Reasoning mode support
  reasoningSupport: 'native-thinking' | 'prompt-based-cot' | 'none';

  // Recommended temperature for coding tasks
  defaultCodingTemperature: number;

  // Whether to add "think step by step" for reasoning
  needsExplicitCotTrigger: boolean;

  // Stop sequences to handle
  stopSequences: string[];

  // Max output tokens recommendation
  recommendedMaxTokens: number;

  // Whether to repeat key instructions in user message
  repeatInstructionsInUserMsg: boolean;
}
```

#### Prompt Strategy Database

The family table below should become a versioned prompt strategy database, not
only static documentation. See `docs/PROMPT_STRATEGY_DATABASE_PLAN.md`.

The database should encode:

- model family and optional model-id overrides
- source references and last-reviewed date
- system prompt style and token budget
- instruction placement and context ordering
- example policy
- reasoning policy
- tool policy
- role/task output contract
- known strengths, risks, and recommended regression tests

This keeps prompt response optimization measurable. A bad answer should be
debuggable as one of three separate questions:

1. Was the wrong model routed?
2. Was the right model prompted with the wrong strategy?
3. Was the prompt strategy right, but the task needed stronger validation or a
   different role?

#### 2. Family Configurations

| Family | Style | Max Sys Tokens | Tool Quality | Reasoning | Temp | CoT Trigger | Repeat Rules | Stop Seqs | Max Out |
|--------|-------|---------------|-------------|-----------|------|-------------|-------------|-----------|---------|
| **DeepSeek** | structured | 2000 | excellent | native-thinking (R1) | 0.1 | No | No | `<｜end▁of▁sentence｜>` | 16K |
| **Llama** | structured | 1500 | good (70B+) | prompt-based-cot | 0.15 | Yes | **Yes** | `<\|eot_id\|>` | 16K |
| **Qwen** | xml-tagged | 3000 | excellent | native-thinking (Max) | 0.1 | No | No | `<\|im_end\|>` | 65K |
| **Mistral** | structured | 2000 | excellent | prompt-based-cot | 0.1 | No | No | `</s>` | 8K |
| **Gemma** | concise | 500 | basic | none | 0.2 | Yes | **Yes** | `<end_of_turn>` | 8K |
| **Grok** | structured | 2000 | excellent | native-thinking | 0.1 | No | No | — | 16K |
| **Cohere** | structured | 2000 | good | prompt-based-cot | 0.2 | No | No | — | 8K |
| **Nemotron** | structured | 1500 | basic | prompt-based-cot | 0.15 | Yes | No | — | 16K |
| **GLM** | concise | 1000 | good | prompt-based-cot | 0.1 | No | No | — | 8K |
| **Jamba** | structured | 2000 | basic | prompt-based-cot | 0.15 | No | No | — | 4K |
| **Phi** | minimal | 300 | none | none | 0.2 | Yes | **Yes** | — | 4K |

#### 3. Runtime Adaptation Strategy

When the harness selects a model, it should:

1. **Look up the model family** from the model ID (e.g., `deepseek/deepseek-v4-flash` → `deepseek`)
2. **Load the family's `ModelPromptConfig`**
3. **Adapt the system prompt:**
   - `xml-tagged` → Wrap sections in XML tags (`<role>`, `<task>`, `<constraints>`)
   - `concise` → Compress to essential instructions only
   - `minimal` → Strip to bare minimum
4. **Adapt tool definitions:**
   - `preferNativeToolCalls === false` → Convert to JSON output format instructions
   - `toolCallQuality === 'basic'` → Simplify schemas, add examples
5. **Set generation parameters:**
   - Use `defaultCodingTemperature` as base
   - Set `max_tokens` to `recommendedMaxTokens`
   - Add `stop` sequences
6. **Add CoT trigger if needed:**
   - If `needsExplicitCotTrigger` and task requires reasoning, append `Let's think step by step:`

#### 4. Subagent Model Selection Defaults

```
Main Agent (complex reasoning):  DeepSeek R1-0528 / Qwen3 Max Thinking
Code Agent (implementation):     Qwen3 Coder 480B / DeepSeek V4 Pro
Fast Worker (parallel tasks):    DeepSeek V4 Flash / Qwen3 Coder Flash
Title Generator:                 Mistral Small 4 / Qwen3-8B
Summarizer:                      DeepSeek V4 Flash / Qwen3-235B-A22B
Reviewer:                        Qwen3 Coder 480B / Devstral 2
Long-Context Agent:              Llama 4 Scout / DeepSeek V4 Pro
```

---

## Model Comparison Matrix

### All Models at a Glance

| # | Model | Family | Context | Max Out | In $/M | Out $/M | Tool Call | Reasoning | Best For |
|---|-------|--------|---------|---------|--------|---------|-----------|-----------|----------|
| 1 | DeepSeek V4 Pro | DeepSeek | 1M | 384K | $0.44 | $0.87 | ★★★★★ | ★★★★ | Primary coding, complex tasks |
| 2 | DeepSeek V4 Flash | DeepSeek | 1M | 131K | $0.10 | $0.20 | ★★★★★ | ★★★★ | Fast coding, summarization |
| 3 | DeepSeek R1-0528 | DeepSeek | 164K | 16K | $0.55 | $2.15 | ★★★★ | ★★★★★ | Complex reasoning, planning |
| 4 | DeepSeek V3 | DeepSeek | 131K | 16K | $0.23 | $0.91 | ★★★★ | ★★★★ | General purpose |
| 5 | DeepSeek V3.2 | DeepSeek | 131K | 16K | $0.25 | $0.38 | ★★★★ | ★★★★ | General purpose (latest V3) |
| 6 | Qwen3 Coder 480B | Qwen | 1M | 65K | $0.22 | $1.80 | ★★★★★ | ★★★★★ | Code generation, agents |
| 7 | Qwen3 Coder Flash | Qwen | 1M | 65K | $0.20 | $0.98 | ★★★★★ | ★★★★ | Fast code tasks |
| 8 | Qwen3 Max | Qwen | 262K | 32K | $0.78 | $3.90 | ★★★★★ | ★★★★★ | Complex reasoning |
| 9 | Qwen3 Max Thinking | Qwen | 262K | 32K | $0.78 | $3.90 | ★★★★★ | ★★★★★ | Transparent reasoning |
| 10 | Qwen3.5 397B | Qwen | 262K | 65K | $0.39 | $2.34 | ★★★★★ | ★★★★★ | General + reasoning |
| 11 | Qwen3.5 122B | Qwen | 262K | — | $0.26 | $2.08 | ★★★★ | ★★★★ | Balanced quality/cost |
| 12 | Qwen3.5 27B | Qwen | 262K | — | $0.20 | $1.56 | ★★★★ | ★★★★ | Fast general tasks |
| 13 | Qwen3.6 27B | Qwen | 262K | 262K | $0.29 | $3.20 | ★★★★ | ★★★★ | Long-output generation |
| 14 | Qwen3-235B-A22B | Qwen | 262K | 16K | $0.07 | $0.10 | ★★★★ | ★★★★ | Cheap bulk processing |
| 15 | Qwen3-32B | Qwen | 131K | — | $0.08 | $0.28 | ★★★ | ★★★ | Local/fast tasks |
| 16 | Qwen3-14B | Qwen | 132K | — | $0.10 | $0.24 | ★★★ | ★★★ | Very fast local |
| 17 | Qwen3-8B | Qwen | 131K | — | $0.05 | $0.40 | ★★★ | ★★★ | Edge, cheap routing |
| 18 | Llama 4 Scout | Meta | 10M | 16K | $0.08 | $0.30 | ★★★★ | ★★★ | Long-context RAG |
| 19 | Llama 4 Maverick | Meta | 1M | 16K | $0.15 | $0.60 | ★★★★ | ★★★ | General, balanced |
| 20 | Llama 3.3 70B | Meta | 131K | 16K | $0.10 | $0.32 | ★★★ | ★★★ | General purpose |
| 21 | Llama 3.1 8B | Meta | 131K | 16K | $0.02 | $0.05 | ★★ | ★★ | Edge/simple tasks |
| 22 | Mistral Large 3 | Mistral | 262K | — | $0.50 | $1.50 | ★★★★★ | ★★★★ | Agents, structured output |
| 23 | Mistral Medium 3.5 | Mistral | 262K | — | $0.50 | $2.00 | ★★★★ | ★★★★ | Balanced quality/cost |
| 24 | Mistral Small 4 | Mistral | 262K | — | $0.15 | $0.60 | ★★★★ | ★★★ | Fast tasks, titles |
| 25 | Devstral 2 | Mistral | 262K | — | $0.40 | $2.00 | ★★★★★ | ★★★★ | Code agents |
| 26 | Codestral 2508 | Mistral | 256K | — | $0.30 | $0.90 | ★★★ | ★★★★ | Code completion |
| 27 | Gemma 4 31B | Google | 262K | 16K | $0.12 | $0.37 | ★★ | ★★★ | Fast general tasks |
| 28 | Gemma 4 26B A4B | Google | 262K | — | $0.06 | $0.33 | ★★ | ★★★ | Cheap fast tasks |
| 29 | Gemma 3 27B | Google | 131K | 16K | $0.08 | $0.16 | ★★ | ★★★ | Lightweight tasks |
| 30 | Grok 4.3 | xAI | 1M | — | $1.25 | $2.50 | ★★★★★ | ★★★★★ | Reasoning, long context |
| 31 | Grok Build 0.1 | xAI | 256K | — | $1.00 | $2.00 | ★★★★ | ★★★★ | Code building |
| 32 | Command A | Cohere | 256K | 8K | $2.50 | $10.00 | ★★★★ | ★★★★ | RAG, retrieval |
| 33 | Nemotron Super 120B | NVIDIA | 1M | — | $0.09 | $0.45 | ★★★ | ★★★ | Balanced quality/cost |
| 34 | Nemotron Nano 30B | NVIDIA | 262K | 228K | $0.05 | $0.20 | ★★ | ★★ | Cheap long-form |
| 35 | GLM 5 | Zhipu | 203K | — | $0.60 | $1.92 | ★★★ | ★★★★ | Bilingual, general |
| 36 | Jamba Large 1.7 | AI21 | 256K | 4K | $2.00 | $8.00 | ★★★ | ★★★ | Long-context analysis |
| 37 | Phi-4 | Microsoft | 16K | — | $0.065 | $0.14 | ★ | ★★★ | Edge, classification |

### Cost-Efficiency Tiers

| Tier | Models | Typical Cost/M In | Use Case |
|------|--------|-------------------|----------|
| **Ultra-Cheap** | Llama 3.1 8B, Qwen3-8B, Gemma 3 4B | <$0.10 | Classification, routing |
| **Budget** | Qwen3-235B-A22B, Llama 4 Scout, Nemotron Nano, Gemma 4 A4B | $0.05–0.10 | Bulk processing, summarization |
| **Value** | DeepSeek V4 Flash, Qwen3 Coder Flash, Mistral Small 4 | $0.10–0.25 | Fast coding, general tasks |
| **Mid-Range** | DeepSeek V4 Pro, Qwen3 Coder, Devstral 2, Codestral | $0.20–0.50 | Primary coding agent |
| **Premium** | DeepSeek R1, Qwen3 Max, Mistral Large, Grok 4.3 | $0.50–1.30 | Complex reasoning, planning |
| **Expensive** | Command A, Jamba Large | $2.00+ | Specialized RAG/long-context |

---

## Appendices

### Appendix A: Chat Template Quick Reference (for local inference)

| Family | BOS | User Start | Assistant Start | EOS |
|--------|-----|-----------|----------------|-----|
| **DeepSeek** | `<｜begin▁of▁sentence｜>` | `<｜User｜>` | `<｜Assistant｜>` | `<｜end▁of▁sentence｜>` |
| **Llama 3/4** | `<\|begin_of_text\|>` | `<\|start_header_id\|>user<\|end_header_id\|>` | `<\|start_header_id\|>assistant<\|end_header_id\|>` | `<\|eot_id\|>` |
| **Qwen** | (none) | `<\|im_start\|>user` | `<\|im_start\|>assistant` | `<\|im_end\|>` |
| **Mistral** | `<s>` | `[INST]` | (after `[/INST]`) | `</s>` |
| **Gemma** | (none) | `<start_of_turn>user` | `<start_of_turn>model` | `<end_of_turn>` |
| **Grok/GLM** | (OpenAI-compatible) | `user` role | `assistant` role | (standard) |
| **Phi** | `<s>` | `user` turn | `<\|assistant\|>` | `<\|end\|>` |

> **Note:** When using API endpoints (OpenRouter, Ollama, LM Studio, vLLM), you send standard `{role, content}` messages and the server handles template application. Raw templates matter only for direct token-level inference.

### Appendix B: Reasoning Model Handling

| Model | Thinking Field | How to Activate | Streaming |
|-------|---------------|-----------------|-----------|
| DeepSeek R1 / R1-0528 | `reasoning_content` | Automatic on complex tasks | Separate stream field |
| Qwen3 Max Thinking | `reasoning_content` | Use `:thinking` variant | Separate stream field |
| Qwen3.5/3.6 (thinking) | `reasoning_content` | `enable_thinking: true` | Separate stream field |
| Grok 4.3 | Integrated in response | `Think step by step` | May be in main content |

### Harness Implementation for Reasoning Models

```typescript
// When processing streaming responses from reasoning models
if (modelConfig.reasoningSupport === 'native-thinking') {
  // Watch for BOTH content and reasoning_content in SSE chunks
  // reasoning_content → thinking tokens (don't show to user, log for debugging)
  // content → actual response (show to user)
  // Both fields may arrive interleaved in the stream
}
```

### Appendix C: Tool Calling Format Variations

**Native Tool Calling (preferred for DeepSeek, Qwen, Mistral Large, Grok):**

```json
{
  "tools": [{
    "type": "function",
    "function": {
      "name": "read_file",
      "description": "Read the contents of a file",
      "parameters": {
        "type": "object",
        "properties": {
          "path": { "type": "string", "description": "File path" }
        },
        "required": ["path"]
      }
    }
  }]
}
```

**Structured JSON Fallback (for Gemma, Phi-4, Llama 8B, Nemotron Nano, Jamba):**

```
When you need to perform an action, respond with a JSON object:
{
  "tool": "read_file",
  "arguments": { "path": "/path/to/file" }
}
After receiving the tool result, continue with your response.
```

**Tool Description Best Practices by Model:**

| Model Family | Recommendation |
|-------------|---------------|
| DeepSeek / Qwen / Mistral Large | Full JSON Schema with descriptions on every field. Include examples for complex tools. |
| Llama (70B+) | Concise descriptions. Avoid >10 tools (quality degrades). |
| Gemma / Phi | Minimal descriptions (1-2 sentences). Provide example invocations in system prompt. |
| Grok | Standard JSON Schema. Works well with detailed descriptions. |

### Appendix D: Common Failure Modes and Mitigations

| Family | Failure Mode | Mitigation |
|--------|-------------|------------|
| DeepSeek | Empty assistant turn before tool call | Check `tool_calls` before treating response as content |
| DeepSeek R1 | Excessive reasoning on simple tasks | Route to V3/V4 Flash for non-reasoning work |
| Llama | Verbosity | Add explicit `Keep response under N words.` |
| Llama 8B | Ignores system instructions in long conversations | Repeat key rules in user message |
| Llama 4 Scout | Loses instructions at extreme context (>1M tokens) | Add periodic reminders |
| Qwen | May include Chinese characters | Add `Respond in English.` |
| Qwen 8B | Overly compliant to user over system | Reinforce guardrails in system message |
| Mistral | Sensitive to whitespace | Normalize whitespace in prompt construction |
| Mistral Large | Over-explains | Add `Be concise.` |
| Devstral | Unescaped shell commands | Validate generated commands before execution |
| Gemma | Overly cautious refusals | Use neutral, task-focused framing |
| Gemma | Limited system role | Embed system instructions in first user message |
| Grok | Opinionated/editorial responses | Request `factual, neutral tone` |
| Command A | Expensive for simple tasks | Reserve for RAG-specific workflows |
| Jamba | 4K max output | Split long generation into chunks |
| Phi-4 | 16K context limit | Keep conversations short |
| GLM | May default to Chinese | Explicit `Respond in English.` |
| Nemotron | Verbose | Add length constraints |
| Nemotron Nano | Loses coherence at extreme output length | Monitor quality, chunk if needed |

---

*Document generated: June 17, 2026*
*Last reviewed: June 17, 2026*
*Next review: Quarterly or on major model releases*
*Sources: OpenRouter live model data, official model documentation, provider guidance, and repository-level benchmarking notes*

### Primary References (official family docs)

- OpenAI prompt guidance
  - https://platform.openai.com/docs/guides/prompt-engineering
  - https://platform.openai.com/docs/guides/prompt-guidance
  - https://platform.openai.com/docs/guides/reasoning-best-practices
- Anthropic Claude prompting
  - https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview
  - https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/multishot-prompting
- Google Gemini prompting
  - https://ai.google.dev/gemini-api/docs/prompting-strategies
- Mistral prompting guidance
  - https://docs.mistral.ai/models/best-practices/prompt-engineering
  - https://docs.mistral.ai/studio-api/conversations/function-calling
  - https://docs.mistral.ai/resources/cookbooks/mistral-prompting-prompting_capabilities
- DeepSeek official APIs and guides
  - https://api-docs.deepseek.com/api/create-chat-completion
  - https://api-docs.deepseek.com/guides/thinking_mode
  - https://api-docs.deepseek.com/guides/multi_round_chat
- Qwen guidance
  - https://qwen.readthedocs.io/en/stable/getting_started/quickstart.html
- xAI Grok function-calling
  - https://docs.x.ai/overview
  - https://docs.x.ai/guides/function-calling
- Llama prompt format
  - https://github.com/meta-llama/llama-models/blob/main/models/llama3_3/prompt_format.md
  - https://github.com/meta-llama/llama3
- Gemma prompt structure
  - https://ai.google.dev/gemma/docs/core/prompt-structure
  - https://ai.google.dev/gemma/docs
- Phi3 chat usage
  - https://huggingface.co/docs/transformers/model_doc/phi3
