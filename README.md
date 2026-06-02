# OpenHarness — Agent Desktop

A polished, modern agent interface inspired by [Codex Desktop](https://codex.ai). Built with React, TypeScript, and Vite.

![OpenHarness](public/vite.svg)

## Features

- **💬 Chat Interface** — Real-time conversation with syntax-highlighted code blocks, markdown rendering, and tool call display
- **🤖 Sub-Agent Tracking** — Collapsible right panel showing active sub-agents with status, progress bars, model info, and token usage
- **📋 Plan Progress** — Visual plan tracker with step-by-step progress indicators
- **💻 Terminal Output** — Display command execution with output, exit codes, and timing
- **📁 File Changes** — Track additions, modifications, and deletions with line counts
- **🧠 Memory Panel** — Visualize active memory entries, skills, and context
- **⚡ Skills & Plugins** — Browse and manage available agent skills and plugin integrations
- **⚙️ Settings** — Configure model selection, streaming, auto-scroll, and more
- **🌙 Dark Theme** — Carefully crafted dark mode matching Codex Desktop aesthetics
- **🎯 Inline Code Comments** — Priority-tagged feedback rendered inline
- **📊 Status Bar** — Bottom status bar showing connection state, model, and agent activity
- **💾 Multi-Session** — Create and switch between multiple conversation sessions

## Layout

```
┌──────────┬──────────────────────────┬──────────────┐
│          │      Top Bar             │              │
│          ├──────────────────────────┤              │
│ Sidebar  │                          │  Sub-Agent   │
│          │     Chat Messages        │   Tracker    │
│ - Chat   │                          │  (hideable)  │
│ - Skills │                          │              │
│ - Memory │                          ├──────────────┤
│ - Config │     Input Area           │              │
│          ├──────────────────────────┴──────────────┤
│          │          Status Bar                      │
└──────────┴─────────────────────────────────────────┘
```

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to view it in the browser.

## Build

```bash
npm run build
```

Output is in the `dist/` directory.

## Tech Stack

- **React 19** + **TypeScript**
- **Vite** for build tooling
- **Lucide React** for icons
- **JetBrains Mono** + **Inter** typography

## License

MIT
