# OpenHarness Universal Provider Harness — Implementation Plan

## Status Snapshot — 2026-06-01

This plan now reflects the current `OpenHarness` checkout after the CMDui rename. The provider abstraction, config persistence, settings UI, local-provider discovery, MCP manager, Docker MCP auto-start attempt, repo-map prompt injection, checkpoint APIs, process ledger, and patch-proposal foundations exist in code.

The biggest remaining user-facing gaps are not raw provider plumbing. They are:

1. Guided onboarding that configures multiple providers in one pass.
2. Default agent personality and role-bucket setup during onboarding.
3. Docker MCP readiness/setup help for users who do not already have Docker working.
4. Curated free MCP server suggestions with permission labels.
5. Provider health, cost/token ledger, and fallback policy.
6. Final workflow polish for patch review, validation, and release.

## Review Follow-up — 2026-06-01 Morning Changes

These items came out of the review of the current uncommitted morning patch.

### P0 — Config Safety and Migration
- [x] Preserve saved `trustMode` during `loadConfig()` instead of forcing `workspace-write` on every server restart.
- [x] Add a one-time migration from `~/.open-harness` to `~/.openharness` for config, task suites, and worktree metadata so existing users do not lose providers or history after the rename.
- [x] Reconcile the Swift app and Express server config schemas before both write `~/.openharness/config.json`; the server stores `providers` as an array while the Swift app expects a provider dictionary.

### P0 — Guided Onboarding Runtime Bugs
- [x] Convert onboarding `roleAssignments` back into the `CodingRoleAssignment[]` UI shape before calling `setRoleAssignments`; the Settings role-bucket pane expects an array.
- [x] Make `POST /api/providers/batch` merge with existing providers instead of overwriting fetched model lists and existing API keys with empty `models` or blank keys.
- [x] Avoid double-saving providers during onboarding: `Test all` should validate/fetch, and `Finish` should preserve the validated provider state rather than resetting it.

### P1 — MCP Lifecycle and UX Polish
- [ ] Refresh MCP status immediately after Docker MCP start/stop/restart actions so Settings does not wait up to the polling interval to show the new state.
- [ ] Validate curated MCP stdio endpoints against real server startup for filesystem, git, fetch, SQLite, memory, sequential-thinking, and Playwright entries.
- [ ] Replace generic curated install failures with server-provided error text so missing `npx`, `uvx`, or Docker setup produces actionable feedback.

### P1 — Native App Packaging
- [x] Remove or restore the missing Swift package `Resources` directory referenced by `OpenHarnessApp/Package.swift`; `swift build` currently succeeds but warns about an invalid resource.
- [ ] Decide whether the Electron app or Swift app is the canonical desktop shell for V1, then keep names, config paths, and launch instructions aligned around that shell.

## Goal
Turn OpenHarness into a truly open AI harness that supports **every major provider** — closed source (OpenAI, Anthropic, Google, Azure, Bedrock) and open source (Ollama, LM Studio, local endpoints) — through a unified provider abstraction ported from OpenCode's architecture.

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
// ~/.openharness/config.json
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
1. `~/.openharness/config.json` (primary)
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
| `~/.openharness/config.json` | User's provider keys and model preferences |
| `~/.openharness/config.example.json` | Example config with all provider templates |

## Implementation Order

### Phase 1: Provider Abstraction
1. Define provider types (`server/providers/types.ts`)
2. Build model catalog (`server/providers/models.ts`) — port OpenCode's model list
3. Build config loader (`shared/config.ts`) — reads `~/.openharness/config.json` + env vars
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

**Users bring their own keys.** OpenHarness doesn't host models — it's a harness. Configure what you have, use what you want. Free local models via Ollama work out of the box with zero config.

**OpenCode proven patterns.** The provider abstraction, model catalog, and config structure are battle-tested from the OpenCode project. We're porting the architecture, not reinventing it.

---

## Future Tasks

### AI Model Landscape Research (Top 30)

**Goal:** Produce a research artifact covering the top ~30 AI models relevant to OpenHarness's provider harness — summarizing each model's strengths, known weaknesses/boundaries, and a suggested coding-role bucket (e.g., coder, summarizer, planner, reviewer, title-generator, lightweight-chat) to inform sensible defaults and agent-role mappings.

**Scope:**
- Cover models across all configured providers: OpenAI (GPT-4.1, o3, o4-mini, …), Anthropic (Claude 4 / Sonnet / Haiku), Google (Gemini 2.5 Pro/Flash), MiniMax (M2), xAI (Grok 3), Groq-hosted (Llama, Mixtral), OpenRouter meta-models, and popular local models (Llama 3, Qwen, DeepSeek).
- For each model: context window, speed tier, cost tier, reasoning support, tool-use quality, and known failure modes or context limits.
- Map each to a coding-role bucket so the `agents` config in `~/.openharness/config.json` can ship informed defaults.

**Deliverable:** A standalone markdown doc (e.g., `docs/MODEL_LANDSCAPE.md`) plus a condensed summary table wired back into `server/providers/models.ts` metadata.

**Priority:** Post-Phase 3. Useful for defaults but not blocking the core provider harness.

---

## Phase 3.5: Native Provider Adapter Chat Path

Date: 2026-06-01

The main chat path in `server/index.ts` now branches by provider type:

- **OpenAI-compatible / local / custom** keep the existing `/v1/chat/completions`
  path with the full tool loop, monologues buffer, MCP tool round-trips, and
  forced-answer fallback.
- **Anthropic** and **Google Gemini** use the existing
  `streamWithAdapter` (from `server/providers/registry.ts`) through a new helper
  `streamWithNativeAdapter`. The prompt builder, repo map, and context pack
  are still applied — only the HTTP request, stream parser, and tool loop are
  swapped.

**What works today (direct chat only):**

- `streamModel` resolves Anthropic and Google providers, builds the same
  system prompt + context pack, and forwards `text_delta` events as the
  existing SSE `text` events so the UI sees a normal streaming answer.
- Run traces record `model_request`, `model_text`, and `final_answer` steps
  the same way as the OpenAI path. Tool-call intent is logged as
  `tool_call` run steps with status `complete` and an explanatory output.
- `/api/models` now includes Anthropic and Google models (still requires an
  API key for those two types — local stays key-less).

**What is still TODO:**

- Anthropic tool round-trip: `streamWithNativeAdapter` does not execute
  Anthropic `tool_use` blocks. The chat loop would need content-block
  bookkeeping (each `content_block` must be echoed back) and
  `tool_result` content blocks. For now, model-intended tool calls are
  surfaced to the user as informational `tool_call` events with the
  message *"Tool calls are not yet supported for this provider in the
  chat loop."*
- Gemini tool round-trip: function calls are emitted as `tool_call_done`
  but not executed, and Gemini's `systemInstruction` is not wired.
- Gemini streaming: the adapter uses the non-streaming `:generateContent`
  endpoint and chunks the JSON response so the UI still sees incremental
  text. The streaming `:streamGenerateContent?alt=sse` endpoint is not
  parsed in this adapter.
- Eval validation and MiniMax credential-backed smoke test for the new
  branch are still pending.

**How to test:**

1. Add an Anthropic provider in Settings, fetch models, pick one, and
   send any message — the chat UI will stream the response through the
   Anthropic adapter.
2. Add a Google Gemini provider the same way.
3. Open a chat that has Anthropic / Gemini as the active model and
   confirm the `Sub-Agent Tracker` shows the expected run-step shape.

## Phase 4: Chat-MCP Integration & UI Polish

### 4.1 Wire MCP Tool Calls Into Chat Loop
- [x] `server/index.ts` detects OpenAI-compatible streaming `tool_calls`
- [x] Tool calls are invoked through built-in tools or `mcpManager.callTool(serverId, toolName, args)`
- [x] Tool results are fed back as tool messages for another model round
- [x] The loop continues until the model stops requesting tools or hits the max round limit
- [x] Tool-call SSE events are emitted to the client for real-time UI feedback
- [x] Built-in tools and Docker/external MCP tools share the same tool list
- [ ] Add recovery UX when an MCP tool call fails because the gateway died mid-session

### 4.2 Fetch Models UI Refresh (MEDIUM)
- [x] After `handleFetchModels` completes, providers state refreshes from the server
- [ ] Show loading state during fetch
- [ ] Show success/error toast after fetch completes
- [ ] Auto-scroll to the newly fetched models in the provider card

### 4.3 Docker MCP Lifecycle in UI (MEDIUM)
- [x] Poll `GET /api/mcp/status` on mount and periodically
- [x] Show live tool count badge on Docker MCP card
- [x] Add collapsible tool list under the Docker MCP card
- [ ] Add start/stop buttons calling the appropriate endpoints
- [ ] Show running/stopped status with visual indicator
- [ ] Add Docker readiness checks: installed, daemon running, `docker mcp` available, gateway profile available

### 4.4 Role Bucket Auto-Suggestions (LOW)
- [~] Role bucket dropdowns have a static recommendation map
- [x] Highlight recommended models with a "✓ Recommended" badge in role bucket dropdowns
- [x] Only suggest models from enabled providers
- [ ] Parse `docs/MODEL_LANDSCAPE.md` into the recommendation map instead of hard-coding it
- [ ] Show a tooltip explaining why a model is recommended for a role

### 4.5 Polish & Stability
- [ ] Filter noisy Docker MCP stderr logs (credential helper messages)
- [ ] Add error recovery if Docker MCP gateway dies mid-session
- [x] Persist theme and personality to config immediately on change
- [ ] Add "Reset to defaults" button in settings

---

## Phase 5: Guided Onboarding and MCP Setup

### 5.1 Multi-provider onboarding (HIGH)
- [ ] First step asks users to check every provider they already have: OpenAI, Anthropic, Google, MiniMax, DeepSeek, xAI, Mistral, Z.AI, OpenRouter, Ollama, LM Studio, custom.
- [ ] Second step collects all selected provider keys/endpoints in one form.
- [ ] “Test all” validates providers and saves the working ones without blocking on failed providers.
- [ ] Local providers are no-key paths and should be detected before asking for credentials.

### 5.2 Default agent setup (HIGH)
- [ ] Ask whether the default agent should be business-only, concise, chatty, helpful/teacher, creative, or custom.
- [ ] Ask whether model defaults should optimize for best quality, low cost, local/private, or balanced behavior.
- [ ] Fill role buckets from enabled models and let the user override before finishing.
- [ ] Persist `personality`, `activeModel`, `roleAssignments`, and `trustMode`.

### 5.3 Docker MCP setup assistant (HIGH)
- [ ] Detect Docker Desktop installed/running and whether `docker mcp` is available.
- [ ] Help users install/start Docker when missing, while making clear MCP is optional.
- [ ] Add start/stop/restart controls for Docker MCP.
- [ ] Show gateway logs, last error, tool count, and recovery actions.

### 5.4 Curated MCP recommendations (MEDIUM)
- [ ] Suggest safe free MCP servers with permission labels: filesystem/read-only workspace, git, browser automation, fetch/web, SQLite, memory/notes, sequential-thinking, Playwright/browser, Docker/container tools.
- [ ] Explain “why add this,” whether it is local-only or networked, and what it can access.
- [ ] Keep risky servers behind trust-mode warnings.
- [ ] Preserve advanced custom server setup for users who know their endpoint or stdio command.
