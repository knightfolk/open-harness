# Open-Harness — Next Session Handoff

> Start a **new Codex session** in `/Users/kevink/Projects/CMDui` and paste the prompt at the bottom of this file.

## What This App Is
An **Electron + React + Express** desktop app — a universal AI provider harness (like Codex Desktop). Users chat with AI models through a dark-themed UI with tiling panels, file browser, terminal, sub-agent tracker, coding role buckets, personality settings, theme picker, and MCP server integration.

## Architecture
| Layer | Tech | Port |
|-------|------|------|
| Desktop shell | Electron (`electron/main.cjs`) | — |
| Frontend | React 19 + Vite + TypeScript (`src/`) | 5173 |
| Backend API | Express 5.2 (`server/index.ts`) | 3001 |
| Docker MCP | Docker MCP gateway (`docker mcp gateway run --transport stdio`) | stdio child process |

**Launch:** `node scripts/start.mjs` (starts Express → Vite → Electron)

## Key Files
| File | Purpose |
|------|---------|
| `src/App.tsx` | Main React app — all state (providers, models, theme, personality, MCP servers, role assignments) |
| `src/components/Sidebar.tsx` | Settings tab with providers, role buckets, MCP servers, personality, themes, chat settings |
| `src/utils/api.ts` | Client API for all server endpoints (providers, models, MCP, config) |
| `src/types/index.ts` | TypeScript types (ProviderConfig, CodingRoleAssignment, MCPServerItem, etc.) |
| `server/index.ts` | Express server — all REST endpoints + Docker MCP gateway child process |
| `server/config.ts` | Config persistence at `~/.open-harness/config.json` |
| `server/providers.ts` | Test provider connections, fetch model lists from any endpoint |
| `server/mcp.ts` | MCP stdio client (MCPClient), stdio gateway client (StdioMCPClient), HTTP transport (MCPHttpTransport), MCP manager singleton |
| `src/styles/global.css` | 8 theme colorways via `[data-theme="..."]` CSS variables |
| `docs/MODEL_LANDSCAPE.md` | Research doc: top 30 coding models, role bucket recommendations, provider compatibility matrix |

## What's Working Now
- ✅ Provider persistence (`~/.open-harness/config.json`) — add/remove/test/fetch models
- ✅ 8 themes (4 dark + 4 light) with instant switching
- ✅ Personality presets → system prompt injection
- ✅ 7 coding role buckets (only show models from enabled providers)
- ✅ Docker MCP auto-starts as stdio child — **34 tools live** (Context7, Sequential Thinking, Playwright + 8 internal)
- ✅ MCP tool invocation via `POST /api/mcp/:serverId/tools/:toolName` — verified working
- ✅ Model research doc with recommendations per role
- ✅ All builds clean (tsc, vite, tsx server modules)

## Remaining Work (Priority Order)

### 1. Wire MCP Tool Calls Into Chat Response (HIGH)
**Problem:** Right now the streaming chat goes directly to MiniMax API. The agent can't use MCP tools during a conversation.
**What to build:**
- When the AI response includes a tool call request (function calling format), route it through MCP
- Add a tool-calling loop: AI decides to call a tool → server invokes via MCP → result feeds back to AI → AI continues
- Start with the server side: modify `streamMiniMax()` in `server/index.ts` to detect tool-call responses, invoke MCP tools, and continue the conversation
- The Docker MCP gateway already has `mcpManager.callTool(serverId, toolName, args)` ready to use
- Client-side: `src/utils/api.ts` already handles `tool_call` SSE events

### 2. Wire "Fetch Models" Results Into Provider Cards (MEDIUM)
**Problem:** `POST /api/providers/:id/models` fetches the model list from the provider's endpoint, but the UI doesn't update the provider card's model list after fetching.
**What to build:**
- After `handleFetchModels` in `Sidebar.tsx`, the `providers` state needs to refresh with the new model list
- The server-side fetch already updates the config and persists it
- Just need to re-fetch providers from the server after the fetch completes
- The `handleFetchModels` handler in `App.tsx` already calls `api.getProviders()` and updates state — verify this is working correctly

### 3. Docker MCP Server Lifecycle in the UI (MEDIUM)
**Problem:** The MCP Servers section shows Docker MCP as "Built-in" but doesn't show the live tool count or start/stop controls.
**What to build:**
- On app mount (or on a polling interval), fetch `GET /api/mcp/status` to get live tool counts
- Show tool count badges on each MCP server card
- Add start/stop buttons that call `POST /api/mcp/:serverId/start` and `POST /api/mcp/:serverId/stop`
- Show the list of available tools (collapsible under each server card)

### 4. Auto-Suggest Models for Role Buckets (LOW)
**Problem:** Role buckets just show all enabled models in a flat dropdown. No guidance on which model fits which role.
**What to build:**
- Parse `docs/MODEL_LANDSCAPE.md` into a structured format (or hardcode a recommendation map)
- When a user has providers configured, highlight recommended models for each role bucket
- Show a "✓ Recommended" badge next to the suggested model in the dropdown
- Only suggest models the user actually has configured (never suggest unavailable models)

## Known Issues
- `import type { ... }` in `server/index.ts` causes tsx to fail silently — use `as any` casts instead
- The server's `stdio: ['pipe', 'pipe', 'pipe']` for Docker MCP works but stderr logs are noisy (credential helper messages) — consider filtering in production
- Express 5.2 route ordering: static paths must be registered before parameterized paths (already correct in current code)

## Config State Shape (`~/.open-harness/config.json`)
```json
{
  "version": 1,
  "providers": [{ "id": "minimax", "name": "MiniMax", "type": "openai-compatible", "apiKey": "...", "baseURL": "https://api.minimax.io/v1", "models": [{ "id": "MiniMax-M2.7", "name": "MiniMax M2.7", "enabled": true }] }],
  "mcpServers": [],
  "personality": "",
  "activeModel": "MiniMax-M2.7",
  "activeTheme": "midnight",
  "roleAssignments": { "planning": "MiniMax-M2.7", "implementation": "MiniMax-M2.7", ... }
}
```

---

## 📋 COPY THIS PROMPT FOR THE NEXT SESSION:

```
You're working on Open-Harness, an Electron + React + Express desktop app at /Users/kevink/Projects/CMDui.

Read NEXT_SESSION.md in the project root for the full handoff. Here's the priority list for this session:

1. Wire MCP tool calls into the chat response loop. Right now the streaming chat goes straight to MiniMax. When the AI wants to call a tool, route it through Docker MCP (34 tools already live via stdio). The mcpManager.callTool() method is ready. Modify the streamMiniMax flow in server/index.ts to detect tool-call responses, invoke MCP, feed results back, and continue.

2. Fix the "Fetch Models" button — after fetching models from a provider's API, the provider card in the Settings UI should refresh and show the new model list.

3. Add Docker MCP lifecycle to the Settings UI — show live tool count, list available tools (collapsible), and add start/stop controls.

4. Add model auto-suggestions for role buckets based on docs/MODEL_LANDSCAPE.md. Only suggest models the user has actually configured.

The app launches with `node scripts/start.mjs`. Docker MCP is running on this host. The only configured provider is MiniMax. Build checks: `npx tsc --noEmit && npx vite build`.
```
