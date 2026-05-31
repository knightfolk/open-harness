# CMDui Vibe-Coder Research & Roadmap

> Goal: Make CMDui the most inviting AI coding tool for newcomers while keeping full power for experts.
> Date: May 2026

## What "Vibe Coders" Want (Research)

Vibe coders are people who code by describing what they want in natural language. They may not know git, terminal commands, or project structure. They're drawn to tools like Bolt, Lovable, v0, and Replit Agent because those tools *just work* — type a sentence, get an app.

### Key Patterns from Market Leaders

**Bolt.new / StackBlitz**
- Zero setup. Open browser → start building.
- Instant preview. See your app render live as the AI writes code.
- "What do you want to build?" is the only prompt. No config.
- One-click deploy to production.
- Templates: "Build a React todo app", "Create a landing page", etc.

**Lovable (lovable.dev)**
- Conversational UI that feels like chatting with a senior dev.
- Shows a live preview alongside the chat.
- Edit-by-clicking: click any element in the preview → edit it in chat.
- Auto-deploys. Ships to a URL automatically.
- Visual editing mode where you can drag-and-drop components.

**v0 (Vercel)**
- Type a description → get a rendered component instantly.
- Iterative: "Make it darker", "Add a sidebar", etc.
- Copy-paste ready code. One click to add to your project.
- Component gallery of community-made UIs you can fork.

**Cursor / Windsurf**
- Full IDE — intimidating for beginners but powerful.
- Cursor's "Composer" mode (Cmd+I) is the friendliest feature: highlight code, describe what you want.
- Tab completion makes you feel like a wizard.
- .cursorrules for project context.

**Claude Code / Codex CLI**
- Terminal-based. Powerful but scary for non-devs.
- "Just tell me what to do" mode is missing.
- No visual preview.

**Replit Agent**
- "Build me a..." → full project scaffolded.
- Runs in browser. No local setup.
- Shows terminal, editor, and preview side by side.
- Auto-fixes errors. Self-healing.

### What All Winners Share

1. **Zero-config first run** — The first 30 seconds determine if someone stays.
2. **Immediate visual feedback** — See results, don't just read text.
3. **Suggested prompts** — Don't make people think of what to ask.
4. **Error recovery** — When something breaks, fix it automatically.
5. **Progressive disclosure** — Simple by default, power features on demand.
6. **Ship it** — One path from idea to deployed URL.

---

## CMDui's Current State

### Strengths (keep these)
- ✅ Multi-provider support (13+ providers, BYOK)
- ✅ Model-aware prompt adaptation (per-family configs)
- ✅ MCP tool calling (Docker-based, built-in filesystem + terminal)
- ✅ Multi-panel layout (chat, files, terminal, plan tracker)
- ✅ Dark themes (midnight, charcoal, forest)
- ✅ Session management with history
- ✅ Streaming responses with tool-call visualization
- ✅ Role bucket system (assign models to coding roles)
- ✅ Settings modal with provider presets

### Gaps (what's missing for vibe coders)
- ❌ No onboarding flow — first run is a blank chat with "Ask anything..."
- ❌ No templates / quick-starts — user has to know what to ask
- ❌ No live preview — can't see rendered output
- ❌ No one-click deploy
- ❌ Chat input has buttons (📎 🖼 @) that don't do anything yet
- ❌ No slash commands (/fix, /review, /deploy, etc.)
- ❌ No file tree integration — sidebar shows sessions, not project files
- ❌ No undo/redo for AI changes
- ❌ No token cost tracking
- ❌ Welcome screen suggestions are generic ("Explore codebase")
- ❌ No "How do I...?" help system
- ❌ Error messages are raw JSON strings
- ❌ No keyboard shortcuts displayed

---

## Recommended Changes (Prioritized)

### 🔴 P0 — First Run Experience (Make them stay)

**1. Guided Onboarding Wizard**
- First launch: 3-step setup wizard
  - Step 1: "Connect your first AI" — pick from presets (OpenAI, Anthropic, MiniMax, Ollama). Show estimated cost per 1K tokens.
  - Step 2: "Open a project" — file picker or drag-drop a folder. Auto-detect framework (React, Next, vanilla).
  - Step 3: "You're ready!" — show 3 tailored starter prompts based on the detected project.
- If Ollama is detected locally: "You have free local models available!" — one-click enable.
- Skip button for experts.

**2. Smart Welcome Screen**
- Replace generic suggestions with project-aware ones:
  - React project: "Add a dark mode toggle", "Refactor the sidebar into smaller components"
  - New folder: "Scaffold a React app with Vite", "Build a REST API with Express"
  - Python project: "Set up a virtual environment and add FastAPI"
- Show recently opened projects with one-click resume.

**3. Status Indicator Bar**
- Bottom bar showing: model name, provider, connection status (green/yellow/red), estimated token usage.
- Click model name → quick model switcher dropdown.
- Shows "Ollama available" badge if local models are running.

### 🟠 P1 — Vibe Coding Core

**4. Slash Commands**
- `/fix <error>` — paste an error, get a fix
- `/review` — review the current file or selected code
- `/explain` — explain what this code does in plain English
- `/test` — generate tests for the current file
- `/deploy` — trigger deploy (if configured)
- `/refactor` — clean up without changing behavior
- `/security` — security audit
- `/doc` — generate documentation
- Typing `/` shows command palette with fuzzy search.

**5. Live Preview Panel**
- New panel type: "Preview"
- For web projects: embedded browser that hot-reloads on file changes.
- Detects Vite/Next dev server on localhost and embeds it.
- Click-to-edit: click an element in preview → highlight in chat → "Edit this section".
- Start button: "Start dev server" if none is running.

**6. File Tree + Code Editor (Read-Only)**
- Replace FilesPanel stub with real file tree:
  - Reads from the session's workingDir
  - Expandable folders, syntax-highlighted file previews
  - Click a file → show contents in a code panel
  - AI can reference files by line numbers
- Not a full editor — just enough to see what the AI is doing.
- "Open in VS Code" button for experts who want full editing.

**7. Action Cards in Chat**
- When the AI suggests changes, show them as visual cards:
  - "📝 Create `src/components/Header.tsx`" — with a diff preview
  - "🔧 Edit `package.json`" — with old → new comparison
  - "🗑️ Delete `src/old-component.tsx`"
- Each card has: [Apply] [Apply All] [Skip] [Edit First]
- This replaces raw code blocks for file operations.

### 🟡 P2 — Power User Features

**8. Token Budget Display**
- Show token usage per message and cumulative for session.
- Color-coded: 🟢 plenty left, 🟡 getting tight, 🔳 almost full.
- Show cost estimate: "~$0.03 for this response".
- Configurable budget per session.

**9. Context Window Visualization**
- Visual bar showing how much of the model's context window is used.
- Shows what's included: system prompt, recent messages, tool outputs, compressed history.
- "Context full" warning with suggestion to start a new session.

**10. Agent Personality Presets**
- Instead of freeform personality text, offer presets:
  - 🎓 Teacher: "Explains every decision, includes comments, patient."
  - ⚡ Speed Runner: "Minimal explanation, just the code. Fast."
  - 🔍 Reviewer: "Points out issues, suggests improvements, cautious."
  - 🎨 Designer: "Focuses on visual quality, UX patterns, accessibility."
  - 🛡️ Security Expert: "Security-first, checks for vulnerabilities."
  - Custom (freeform text)
- Each preset adjusts system prompt + temperature + max_tokens.

**11. Prompt Library**
- Save and reuse prompts.
- Community prompt library (sync from a GitHub repo).
- Per-project prompt templates.
- Auto-suggest based on context (e.g., "You're editing a test file → suggest 'Generate more tests'").

**12. Session Branching**
- Fork a conversation at any point.
- "What if we used Tailwind instead?" → branches from current state.
- Compare branches side-by-side.
- Merge changes back.

### 🟢 P3 — Polish & Delight

**13. Keyboard Shortcuts**
- `Cmd+K` — command palette (slash commands + navigation)
- `Cmd+N` — new session
- `Cmd+Shift+P` — model switcher
- `Cmd+/` — toggle sidebar
- `Cmd+Enter` — send (when multiline)
- Show shortcuts in tooltips and a `?` help panel.

**14. Toast Notifications**
- Success: "✅ Provider connected — 47 models available"
- Warning: "⚠️ Context window 80% full — consider starting a new session"
- Error: "❌ API key invalid — check settings" (with [Fix] button)
- Progress: "🔄 Analyzing 23 files..."

**15. Onboarding Tooltips**
- First time seeing a feature → brief tooltip explaining it.
- "This is the model switcher — click to change which AI powers your session."
- Dismissible, never shown again.
- Toggle in settings: "Show beginner tips"

**16. Ambient Status**
- Show what the AI is doing in real-time:
  - "Reading `src/App.tsx`..." (with file path as link)
  - "Analyzing 3 dependencies..."
  - "Generating response..."
  - "Running `npm test`..."
- Each status has a tiny spinner or progress indicator.

**17. Error Recovery**
- When a tool call fails, show a friendly card:
  - "⚠️ File not found: `src/missing.tsx`"
  - [Create file] [Try different path] [Skip]
- When the model gives an empty response, auto-retry with a rephrased prompt.
- When the API rate-limits, show "Rate limited — retrying in 5s..." with countdown.

---

## Implementation Priority

| Phase | Items | Impact | Effort |
|-------|-------|--------|--------|
| **Phase A: First Run** | #1 Onboarding, #2 Smart Welcome, #3 Status Bar | 🔴 Critical | ~1 week |
| **Phase B: Vibe Core** | #4 Slash Commands, #7 Action Cards, #6 File Tree | 🟠 High | ~2 weeks |
| **Phase C: Live Preview** | #5 Live Preview Panel | 🟠 High | ~1 week |
| **Phase D: Power Features** | #8 Tokens, #9 Context Viz, #10 Personality Presets, #11 Prompt Library | 🟡 Medium | ~2 weeks |
| **Phase E: Polish** | #12 Branching, #13 Shortcuts, #14 Toasts, #15 Tooltips, #16 Status, #17 Recovery | 🟢 Low | ~2 weeks |

## Competitive Positioning

| Feature | CMDui | Cursor | Bolt | Lovable | Claude Code |
|---------|-------|--------|------|---------|-------------|
| Multi-provider BYOK | ✅ Best | ❌ Closed | ❌ Closed | ❌ Closed | ❌ Closed |
| Local models (Ollama) | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No |
| Desktop app | ✅ Electron | ✅ Fork of VS Code | ❌ Web only | ❌ Web only | ❌ CLI only |
| Live preview | 🔜 Phase C | ✅ Built-in | ✅ Best | ✅ Best | ❌ No |
| Open source | ✅ Core | ❌ No | ❌ No | ❌ No | ✅ Yes |
| MCP tools | ✅ Docker MCP | ✅ Native | ❌ Limited | ❌ Limited | ❌ No |
| Vibe coder UX | 🔜 Phase A-B | ❌ IDE-first | ✅ Best | ✅ Best | ❌ CLI-first |
| Token cost tracking | 🔜 Phase D | ❌ No | ❌ No | ❌ No | ❌ No |
| Zero-config start | 🔜 Phase A | ❌ Complex | ✅ Yes | ✅ Yes | ❌ CLI setup |

**CMDui's unique edge:** The only tool that combines multi-provider BYOK + local models + MCP tools + desktop app. Adding vibe-coder UX makes it the **"VS Code for people who don't want VS Code"** — a friendly desktop AI coding tool that works with ANY model.

---

## Starter Prompt Templates (for Smart Welcome)

### For new projects
```
"Build me a {react|vue|vanilla} app that {does X}. Use {tailwind|css modules} for styling."
"Scaffold a {express|fastify|hono} REST API with {sqlite|postgres} and basic CRUD."
"Create a CLI tool in {typescript|python|go} that {does X}."
```

### For existing projects
```
"Review the codebase and suggest the top 3 improvements."
"Add {authentication|testing|CI} to this project."
"Explain the architecture of this project like I'm 5."
"Find and fix any bugs in the {src/api|src/components} directory."
"Add a {dark mode|search|pagination} feature."
```

### Debugging
```
"Here's the error: {paste}. Fix it."
"The tests are failing. Here's the output: {paste}. Make them pass."
"This function is slow. Profile it and make it faster."
```

