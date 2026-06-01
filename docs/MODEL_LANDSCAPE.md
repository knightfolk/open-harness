# Open-Harness — AI Model Landscape for Coding

> Research snapshot: May 2026. Prices and capabilities shift fast — update quarterly.

## Summary Table

| Model | Provider | Context | Best Role | Price Tier | Notes |
|-------|----------|---------|-----------|------------|-------|
| GPT-4.1 | OpenAI | 1M | Planner, Code Implementer | Premium | Strong instruction following, excellent at architecture |
| GPT-4.1-mini | OpenAI | 1M | Bug Fixer, Tool Runner | Mid | Fast, good enough for most coding tasks |
| GPT-4.1-nano | OpenAI | 1M | Tool Runner | Cheap | Ultra-fast, narrow tasks only |
| o3 | OpenAI | 200K | Planner, Code Reviewer | Premium | Best reasoning depth, slow but thorough |
| o4-mini | OpenAI | 200K | Code Reviewer, Bug Fixer | Mid | Good reasoning at lower cost |
| Claude Sonnet 4 | Anthropic | 200K | Code Implementer, Bug Fixer | Premium | Excellent code quality, strong tool use |
| Claude Opus 4 | Anthropic | 200K | Planner, Code Reviewer | Premium | Deepest analysis, best for complex refactors |
| Gemini 2.5 Pro | Google | 1M | Planner, Design Specialist | Premium | Massive context, great at large codebase analysis |
| Gemini 2.5 Flash | Google | 1M | Tool Runner, Bug Fixer | Mid | Fast with huge context window |
| MiniMax-M3 | MiniMax | 1M | Code Implementer, Planner | Mid | Frontier multimodal — SOTA coding & agent; image/video input, thinking blocks, Anthropic-compatible API |
| MiniMax-M2.7 | MiniMax | 1M | Code Implementer | Mid | Strong code generation, cost-effective |
| DeepSeek V4 | DeepSeek | 128K | Code Implementer, Planner | Cheap | Top-tier open-weight, exceptional code quality |
| DeepSeek V4 Flash | DeepSeek | 128K | Tool Runner, Bug Fixer | Cheap | Fast variant, great for iteration |
| DeepSeek V3 | DeepSeek | 128K | Bug Fixer | Free | Solid older model, still competitive |
| GLM-5.1 | Z.AI / Zhipu | 128K | Planner | Mid | Excellent at Chinese + English, good architecture sense |
| GLM-5 | Z.AI / Zhipu | 128K | Code Implementer | Mid | Strong code generation |
| GLM-4.7 | Z.AI / Zhipu | 128K | Tool Runner | Cheap | Fast, cost-effective for tool calls |
| Llama 4 Maverick | Meta | 1M | Code Implementer | Free (self-host) | Best open-weight for general coding |
| Llama 4 Scout | Meta | 10M | Planner | Free (self-host) | Massive context, good for large repo analysis |
| Mistral Large | Mistral | 128K | Code Reviewer | Mid | Strong at review and analysis |
| Codestral | Mistral | 256K | Code Implementer, Bug Fixer | Mid | Purpose-built for code, excellent completion |
| Grok 3 | xAI | 200K | Code Implementer, Design Specialist | Premium | Fast, creative, good at UI work |
| Grok 3 Mini | xAI | 200K | Tool Runner | Mid | Lightweight, good for quick tasks |
| Qwen 3 235B | Alibaba | 128K | Code Implementer, Planner | Free (self-host) | Top open-source reasoning model |
| Qwen 3 32B | Alibaba | 128K | Bug Fixer, Tool Runner | Free (self-host) | Fast open-source, great local option |
| Kimi K2.5 | Moonshot | 128K | Planner | Mid | Strong analytical capabilities |
| Kimi K2.6 | Moonshot | 128K | Code Implementer | Mid | Improved code generation over K2.5 |
| MiMo V2.5 Pro | Xiaomi | 128K | Code Reviewer | Cheap | Strong at code analysis |
| GPT-5.3 Codex | OpenAI | 200K | Code Implementer | Premium | Specialized coding variant |
| GPT-5.4 | OpenAI | 1M+ | Planner | Premium | Flagship, best overall reasoning |
| DeepSeek R2 | DeepSeek | 128K | Planner, Code Reviewer | Cheap | Chain-of-thought reasoning specialist |

## Role Bucket Recommendations

### Planner (architecture, research, task breakdown)
**Top picks:** o3, Claude Opus 4, Gemini 2.5 Pro, GLM-5.1, DeepSeek R2
- Need: deep reasoning, large context for codebase understanding, structured thinking
- Budget pick: DeepSeek V4 (strong reasoning at low cost)
- Local pick: Llama 4 Scout (10M context for massive repos)

### Code Implementer (writing, scaffolding, refactoring)
**Top picks:** Claude Sonnet 4, DeepSeek V4, GPT-4.1, Llama 4 Maverick
- Need: accurate code generation, follows patterns, understands context
- Budget pick: DeepSeek V4 Flash
- Local pick: Qwen 3 235B

### Bug Fixer (debugging, tracing, regression testing)
**Top picks:** Claude Sonnet 4, GPT-4.1-mini, o4-mini, DeepSeek V4 Flash
- Need: precise error analysis, systematic debugging, good at reading stack traces
- Budget pick: DeepSeek V3
- Local pick: Qwen 3 32B

### Design Specialist (UI/UX, styling, components)
**Top picks:** Grok 3, Gemini 2.5 Pro, GPT-4.1
- Need: understands layout/design, generates clean CSS/JSX, visual sense
- Budget pick: Grok 3 Mini

### Image Generator (diagrams, assets, visualizations)
**Top picks:** GPT-4.1 (DALL-E integration), Gemini 2.5 Pro (Imagen integration)
- Note: Most image generation happens via dedicated tools, not chat models
- Budget pick: Grok 3 (Aurora integration)

### Tool Runner (shell commands, file ops, git operations)
**Top picks:** GPT-4.1-nano, Gemini 2.5 Flash, GLM-4.7, DeepSeek V4 Flash
- Need: fast response time, correct parameter formatting, structured output
- Budget pick: GPT-4.1-nano
- Local pick: Qwen 3 32B

### Code Reviewer (PR review, security audit, suggestions)
**Top picks:** o3, Claude Opus 4, Mistral Large, o4-mini
- Need: thorough analysis, catches subtle bugs, security awareness
- Budget pick: DeepSeek R2
- Local pick: Qwen 3 235B

## Provider Compatibility Matrix

| Provider | API Format | Auth | Streaming | Tool Use | Base URL |
|----------|-----------|------|-----------|----------|----------|
| OpenAI | OpenAI-compatible | Bearer token | ✓ | ✓ | `https://api.openai.com/v1` |
| Anthropic | Custom | x-api-key | ✓ | ✓ | `https://api.anthropic.com/v1` |
| Google | Custom | API key param | ✓ | ✓ | `https://generativelanguage.googleapis.com/v1beta` |
| MiniMax | OpenAI-compatible + Anthropic-compatible | Bearer token | ✓ | ✓ | `https://api.minimax.io/v1` |
| DeepSeek | OpenAI-compatible | Bearer token | ✓ | ✓ | `https://api.deepseek.com/v1` |
| Z.AI | OpenAI-compatible | Bearer token | ✓ | ✓ | `https://api.z.ai/api/coding/paas/v4` |
| xAI | OpenAI-compatible | Bearer token | ✓ | ✓ | `https://api.x.ai/v1` |
| Mistral | OpenAI-compatible | Bearer token | ✓ | ✓ | `https://api.mistral.ai/v1` |
| Ollama | OpenAI-compatible | None | ✓ | ✓ | `http://localhost:11434/v1` |
| LM Studio | OpenAI-compatible | None | ✓ | ✓ | `http://localhost:1234/v1` |
| OpenRouter | OpenAI-compatible | Bearer token | ✓ | ✓ | `https://openrouter.ai/api/v1` |

## Notes
- **OpenAI-compatible** means the provider uses the `/v1/chat/completions` endpoint format
- Only Anthropic and Google need custom adapters — 80%+ of providers work with the same code
- MiniMax-M3 additionally supports Anthropic-compatible API via  (recommended for M3)
- Context window sizes are approximate and may vary by tier
- "Local" models require Ollama, LM Studio, or similar runtime
- Prices shift frequently — check provider websites for current rates
