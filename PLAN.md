# CMDui Universal Provider Harness — Implementation Plan

## Goal
Turn CMDui into a truly open AI harness that supports **every major provider** — closed source (OpenAI, Anthropic, Google, Azure, Bedrock) and open source (Ollama, LM Studio, local endpoints) — through a unified provider abstraction ported from OpenCode's architecture.

## Architecture

### 1. Provider Registry
A unified interface where every provider implements the same contract:

```typescript
interface Provider {
  id: string;                    // e.g., 'openai', 'anthropic', 'local'
  name: string;                  // e.g., 'OpenAI', 'Anthropic'
  models: ModelConfig[];         // available models
  streamResponse(messages, tools): AsyncGenerator<ProviderEvent>;
}
```

Every provider emits the same `ProviderEvent` stream:
- `content_delta` — text chunk
- `tool_use_start` — tool call beginning
- `tool_use_delta` — tool call input streaming
- `tool_use_stop` — tool call complete
- `thinking_delta` — reasoning tokens (for models that support it)
- `complete` — response finished
- `error` — something broke

### 2. Supported Providers

| Provider | Type | API Format | Auth |
|----------|------|-----------|------|
| **OpenAI** | Closed | OpenAI native | API key |
| **Anthropic** | Closed | Messages API | API key |
| **Google Gemini** | Closed | Gemini API | API key |
| **Azure OpenAI** | Closed | OpenAI-compatible | API key + endpoint |
| **AWS Bedrock** | Closed | Bedrock Converse | AWS credentials |
| **MiniMax** | Closed | OpenAI-compatible | API key |
| **xAI (Grok)** | Closed | OpenAI-compatible | API key |
| **Groq** | Closed | OpenAI-compatible | API key |
| **OpenRouter** | Aggregator | OpenAI-compatible | API key |
| **Copilot** | Closed | OpenAI-compatible | GitHub token |
| **Ollama** | Open | OpenAI-compatible | Local (no key) |
| **LM Studio** | Open | OpenAI-compatible | Local (no key) |
| **Custom** | Any | OpenAI-compatible | User-configured |

**Key insight:** Most providers use the OpenAI-compatible chat completions format with `stream: true`. Only Anthropic and Google need native adapters. Everything else routes through the OpenAI adapter with different base URLs.

### 3. Provider Adapters

Only **3 adapter implementations** needed:

1. **OpenAI adapter** — covers OpenAI, MiniMax, xAI, Groq, OpenRouter, Copilot, Azure, Ollama, LM Studio, and any custom endpoint. Just different `baseURL` + `apiKey`.

2. **Anthropic adapter** — native Messages API with `content` blocks, `tool_use` blocks, and streaming via SSE.

3. **Google Gemini adapter** — native `generateContent` with `streamGenerateContent` for streaming.

### 4. Model Registry

A static catalog of known models (ported from OpenCode's model definitions) with:
- Model ID, display name, provider
- Context window, max tokens
- Cost per million tokens (input/output/cached)
- Capabilities: reasoning, attachments, tool use

Plus dynamic discovery for local providers (Ollama, LM Studio) via their `/v1/models` endpoint.

### 5. Configuration

```jsonc
// ~/.cmdui/config.json
{
  "providers": {
    "openai":    { "apiKey": "sk-..." },
    "anthropic": { "apiKey": "sk-ant-..." },
    "google":    { "apiKey": "AIza..." },
    "minimax":   { "apiKey": "sk-cp-..." },
    "openrouter":{ "apiKey": "sk-or-..." },
    "local":     { "endpoint": "http://localhost:11434" }  // Ollama
  },
  "defaultModel": "minimax.MiniMax-M2.7",
  "agents": {
    "coder":      { "model": "minimax.MiniMax-M2.7" },
    "summarizer": { "model": "minimax.MiniMax-M2.7" },
    "title":      { "model": "minimax.MiniMax-M2.7" }
  }
}
```

Config discovery order:
1. `~/.cmdui/config.json` (primary)
2. Environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.)
3. Existing tool configs (`~/.mmx/config.json` for MiniMax, etc.)
4. Auto-detect local providers (Ollama on :11434, LM Studio on :1234)

### 6. Frontend Changes

- **Model selector** in top bar becomes a dropdown showing all configured providers + models
- Models grouped by provider with icons
- Shows "local" badge for Ollama/LM Studio models
- "Configure providers" link opens settings panel
- Status bar shows active model + provider

### 7. Server API Changes

New endpoints:
- `GET /api/providers` — list configured providers and available models
- `POST /api/providers/configure` — save provider config
- `GET /api/providers/discover` — auto-discover local providers
- Session model selection: `POST /api/sessions` accepts `modelId`

## File Changes

### New Files
| File | Purpose |
|------|---------|
| `server/providers/types.ts` | Provider, ModelConfig, ProviderEvent types |
| `server/providers/openai.ts` | OpenAI-compatible adapter (covers 10+ providers) |
| `server/providers/anthropic.ts` | Anthropic Messages API adapter |
| `server/providers/gemini.ts` | Google Gemini adapter |
| `server/providers/registry.ts` | Provider registry, config loading, model resolution |
| `server/providers/models.ts` | Static model catalog (ported from OpenCode) |
| `server/providers/discover.ts` | Auto-discover Ollama, LM Studio, etc. |
| `shared/config.ts` | Config loading + validation (shared between server/client) |

### Modified Files
| File | Change |
|------|---------|
| `server/index.ts` | Use provider registry instead of hardcoded MiniMax |
| `src/utils/api.ts` | Add provider/model API methods |
| `src/components/TopBar.tsx` | Model selector dropdown with provider grouping |
| `src/App.tsx` | Model selection state, pass to chat |
| `src/components/layout/PanelContent.tsx` | Settings panel for provider config |

### Config Files
| File | Purpose |
|------|---------|
| `~/.cmdui/config.json` | User's provider keys and model preferences |
| `~/.cmdui/config.example.json` | Example config with all provider templates |

## Implementation Order

### Phase 1: Provider Abstraction
1. Define provider types (`server/providers/types.ts`)
2. Build model catalog (`server/providers/models.ts`) — port OpenCode's model list
3. Build config loader (`shared/config.ts`) — reads `~/.cmdui/config.json` + env vars
4. Build OpenAI adapter — covers all OpenAI-compatible providers
5. Build Anthropic adapter
6. Build Gemini adapter
7. Build provider registry — resolves model IDs to provider + adapter

### Phase 2: Integration
8. Wire registry into `server/index.ts` — replace hardcoded MiniMax
9. Add `GET /api/providers` and `GET /api/providers/discover` endpoints
10. Add model selection to sessions
11. Frontend model selector in top bar
12. Frontend provider config settings panel

### Phase 3: Polish
13. Auto-discovery for Ollama/LM Studio on startup
14. Provider health checks
15. Token usage tracking per-provider
16. Cost estimation display

## Why This Works

**One adapter covers 80% of providers.** The OpenAI chat completions format with streaming has become the de facto standard. MiniMax, Groq, xAI, OpenRouter, Ollama, LM Studio, Azure OpenAI, and Copilot all use it. Only Anthropic and Google need their own adapters.

**Users bring their own keys.** CMDui doesn't host models — it's a harness. Configure what you have, use what you want. Free local models via Ollama work out of the box with zero config.

**OpenCode proven patterns.** The provider abstraction, model catalog, and config structure are battle-tested from the OpenCode project. We're porting the architecture, not reinventing it.

---

## Future Tasks

### AI Model Landscape Research (Top 30)

**Goal:** Produce a research artifact covering the top ~30 AI models relevant to CMDui's provider harness — summarizing each model's strengths, known weaknesses/boundaries, and a suggested coding-role bucket (e.g., coder, summarizer, planner, reviewer, title-generator, lightweight-chat) to inform sensible defaults and agent-role mappings.

**Scope:**
- Cover models across all configured providers: OpenAI (GPT-4.1, o3, o4-mini, …), Anthropic (Claude 4 / Sonnet / Haiku), Google (Gemini 2.5 Pro/Flash), MiniMax (M2), xAI (Grok 3), Groq-hosted (Llama, Mixtral), OpenRouter meta-models, and popular local models (Llama 3, Qwen, DeepSeek).
- For each model: context window, speed tier, cost tier, reasoning support, tool-use quality, and known failure modes or context limits.
- Map each to a coding-role bucket so the `agents` config in `~/.cmdui/config.json` can ship informed defaults.

**Deliverable:** A standalone markdown doc (e.g., `docs/MODEL_LANDSCAPE.md`) plus a condensed summary table wired back into `server/providers/models.ts` metadata.

**Priority:** Post-Phase 3. Useful for defaults but not blocking the core provider harness.
