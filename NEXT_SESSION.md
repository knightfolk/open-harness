# Next Session — CMDui Universal AI Harness

## Context: What Was Just Shipped

### Model-Aware Prompt Adaptation Engine (just committed)

We just built the intelligence layer that adapts prompting behavior per-model. Here's exactly what exists now:

### New files (committed):
- `docs/MODEL_PROMPTING_GUIDE.md` — 920-line research doc covering 37 open-source models, 11 families, role recommendations, harness integration guide
- `server/modelProfiles.ts` — Model family detection (`detectModelFamily()`) + 14 family configs with prompt style, tool quality, temperature, max tokens, stop sequences, quirks
- `server/promptBuilder.ts` — Runtime prompt adaptation: `buildPromptForModel()` generates model-aware system prompts (4 styles), adapts tool definitions (native vs JSON fallback), sets generation params

### Modified files:
- `server/index.ts` — `streamMiniMax()` now calls `buildPromptForModel()` instead of hardcoded prompts. Adapts temperature, max_tokens, stop sequences, tool strategy, reasoning support per model.
- `server/config.ts` — Added role assignment defaults (coder, reasoner, summarizer, title, planner, reviewer, worker)

### Key architecture:
- **14 model families**: deepseek, llama, qwen, mistral, devstral, codestral, gemma, grok, cohere, nemotron, glm, jamba, phi, minimax (+ unknown fallback)
- **4 prompt styles**: xml-tagged (Qwen), structured (DeepSeek/Mistral/etc), concise (Gemma/GLM), minimal (Phi)
- **Tool adaptation**: models with excellent/good tool quality get native tool calls; basic/none get tools-as-text fallback
- **Reasoning models**: DeepSeek R1, Qwen Thinking, Grok 4.3 capture separate `reasoning_content` stream
- **Role system**: 7 agent roles (coder, reasoner, summarizer, title, planner, reviewer, worker) each get tailored prompts

### Current config:
- 3 providers: MiniMax (7 models), Z.AI GLM (7 models), OpenCode Go (16 models = 30 total)
- Active model: MiniMax-M2.7
- Docker MCP: context7 + playwright + sequentialthinking (26 tools)

---

# Next Steps — Pick Up Here

## Priority 1: Universal Provider Streaming (not just MiniMax)
Right now `streamMiniMax()` only streams to the MiniMax API endpoint. It needs to route to the correct provider based on the active model.

- [ ] **Resolve provider for active model** — when the model is `glm-5.1`, find that it belongs to the `z-ai` provider, get that provider's `baseURL` and `apiKey`
- [ ] **Replace `MINIMAX_API_URL` with dynamic URL** — build the chat completions URL from the provider's `baseURL` (e.g., `https://api.z.ai/api/coding/paas/v4/chat/completions`)
- [ ] **Rename `streamMiniMax()` → `streamModel()`** — it's no longer MiniMax-specific
- [ ] **Test with Z.AI GLM models** — switch active model to `glm-5.1`, verify streaming works through the Z.AI endpoint
- [ ] **Test with OpenCode Go models** — switch to `deepseek-v4-flash` via OpenCode Go, verify streaming
- [ ] **Add provider resolution helper** in `server/config.ts`: `getProviderForModel(modelId)` → returns the StoredProvider + credentials

This is the biggest single unlock. Once streaming works for any provider, the model switcher in the UI becomes fully functional.

## Priority 2: Anthropic Messages API Adapter
When users add Anthropic as a provider, the streaming format is different (SSE with `content_block_delta` events).

- [ ] **Create `server/anthropicAdapter.ts`** — convert `messages` array to Anthropic format, handle streaming response parsing
- [ ] **Detect provider type** in the stream function and route to the appropriate adapter
- [ ] The provider type is already stored as `type: 'anthropic'` in config

## Priority 3: Frontend Model Switcher Enhancement
The model selector exists but needs to surface the new prompt profiles:

- [ ] **Show model family info** — display detected family, prompt style, tool quality badge in the model dropdown
- [ ] **Show recommended role** — highlight which models are best for coding vs reasoning vs summarization
- [ ] **Visual indicator for reasoning models** — badge or icon for models that have native thinking
- [ ] **Show prompt profile summary** — when hovering a model, show "Structured | 16K output | Excellent tools"

## Priority 4: Subagent System (uses model profiles)
The types exist (`SubAgent` in `src/types/index.ts`) but the runtime doesn't yet:

- [ ] **Server-side subagent spawning** — `POST /api/sessions/:id/subagents` that creates a child chat session with a different model
- [ ] **Role-based model selection** — when spawning a subagent, use `getRoleModelRecommendation(role)` to pick the best model from available providers
- [ ] **Subagent streaming** — child agents stream their results back to the parent session
- [ ] **Role assignment config** — `roleAssignments` in config maps role → modelId (defaults already set, needs server logic to read them)
- [ ] **Subagent prompt isolation** — each subagent gets its own `buildPromptForModel()` call with its role-specific prompt

## Priority 5: Tool Result Formatting & UX
- [ ] Better tool result formatting (currently raw JSON, should be summarized)
- [ ] Handle tool call errors with retry logic
- [ ] Support parallel tool calls from a single assistant turn
- [ ] Add tool call progress indicators in the UI
- [ ] Streaming tool results for long-running operations

## Priority 6: Model Profile Auto-Tuning
The profiles are static right now. They should learn from usage:
- [ ] Track per-model success rates on tool calls, code generation quality, etc.
- [ ] Adjust temperature/strategy based on observed performance
- [ ] Surface "model performance" stats in the settings UI

## Future (from PLAN.md)
- Google Gemini adapter (native `generateContent` format)
- Auto-discovery for Ollama/LM Studio on startup
- Provider health checks
- Token usage tracking per-provider
- Cost estimation display
- Role bucket auto-suggestions from MODEL_LANDSCAPE.md

---

# Quick Start for Next Session
1. Read this file and `docs/MODEL_PROMPTING_GUIDE.md` for full context
2. Pick up **Priority 1** (universal provider streaming) — it's the highest-impact single change
3. The model profiles (`server/modelProfiles.ts`) and prompt builder (`server/promptBuilder.ts`) are already wired and working — they just need the provider routing layer to shine

The commit is: `feat: add model-aware prompt adaptation engine` (5f833ed)

# File Map
```
server/
  index.ts          — Express server, streaming chat, all API routes
  config.ts         — Config loading/saving, provider/MCP helpers
  providers.ts      — Provider connection testing, model fetching
  modelProfiles.ts  — Model family detection + per-family prompt configs (NEW)
  promptBuilder.ts   — Runtime prompt adaptation engine (NEW)
  mcp.ts            — MCP client manager (Docker MCP, stdio transport)
docs/
  MODEL_PROMPTING_GUIDE.md  — 920-line research doc (NEW)
  MODEL_LANDSCAPE.md        — Older high-level model overview
```
