# Next Session — Fix Model Response Quality

## Identity
You are **Friday**, the AI assistant for CMDui. Follow all rules in AGENTS.md.

## The Problem

MiniMax-M2.7 (and likely other models) produce broken/incomplete responses in the chat UI. Here's a real example of a failed interaction:

```
User: "please do a full review of the project folder and give a detailed description"

Model response:
"The user wants a full review of their project folder. I'll start by listing the directory contents to understand the project structure.
This is a monorepo using pnpm workspaces with Turbo. Let me explore deeper into the apps and packages directories.
This is a monorepo using pnpm workspaces and Turbo. Let me explore deeper into each package.
Let me dive deeper into each package to understand the source code and structure better.
Let me dive deeper into the source files to understand the codebase better.
Let me read some key files to understand the project better."
[RESPONSE ENDS HERE — no actual summary, no review, just narration]
```

Another example:
```
User: "what should be done next? are there any open items or are we ready for testing?"
Model: <transitioned></transitioned>
[EMPTY RESPONSE]

User: "are you broken, or Brokeback?"
Model: [EMPTY RESPONSE]
```

## Root Causes (as best we can tell)

1. **Monologue narration instead of answers** — The model narrates "Let me explore... Now I have... Let me read..." as plain text between tool rounds, but never actually produces the final summary. The MonologueBuffer in `server/index.ts` tries to strip these, but the model still wastes all its output tokens on narration.

2. **Empty responses after tool rounds** — The model returns `<transitioned></transitioned>` or empty content, especially on follow-up messages. This suggests the model is hitting the MAX_TOOL_ROUNDS limit without ever generating a final answer, OR the streaming parser is not capturing the final response correctly.

3. **Tool-round narration leaks** — Between tool calls, the model outputs sentences like "This is a monorepo using pnpm workspaces with Turbo. Let me explore deeper..." as regular text content. These appear to be mid-investigation monologue that the model doesn't distinguish from its final answer.

## What We've Already Done

- `stripThinkingTags()` — strips `<think/>`, `<QDom/>`, `<transitioned/>` tags from output
- `MonologueBuffer` class — buffers initial text, drops monologue preamble once structured content starts
- Anti-monologue system prompt rule — tells model to start directly with the answer
- Tool dedup tracker — skips redundant `list_directory`/`read_file` calls

These helped but **did NOT fully fix the problem**. The model still:
- Narrates between tool rounds as plain text
- Sometimes ends without producing a final answer
- Sometimes responds with only `<transitioned>` tags

## Key Files

- `server/index.ts` (~1280 lines) — Express server, streaming, tool invocation, MonologueBuffer, test endpoints
- `server/contextManager.ts` — token budgeting, sliding window
- `server/promptBuilder.ts` — model-aware system prompt generation
- `server/modelProfiles.ts` — per-model-family configs (context window, tool quality, prompt style)
- `AGENTS.md` — project rules

## Your Mission

**Fix the model response quality so users get real answers, not narration or empties.**

### Approach

1. **Read the actual streaming logic carefully** — trace exactly what happens when the model produces text between tool calls vs after the last tool round. The issue may be in how we distinguish "intermediate narration" from "final answer".

2. **Check if the model is running out of rounds** — MAX_TOOL_ROUNDS is 6. If the model uses all 6 rounds doing tool calls and narration, it may never reach the final answer round. Consider: increasing rounds, or detecting when the model is narrating instead of calling tools.

3. **Test with the actual app** — start the server (`npx tsx server/index.ts`), start Vite (`npx vite --port 5173 --host`), open Safari, and send the exact failing prompts. Watch the server logs. See what actually comes back from the API.

4. **Consider a two-pass approach** — after tool rounds complete, if the final content is too short or looks like narration (no headings, no lists, no structured content), send one more request asking for the actual summary based on gathered context.

5. **Look at the raw API response** — add temporary debug logging to see exactly what the model returns in each streaming chunk. The issue might be that we're discarding valid content or not handling the stream correctly.

### Success Criteria

1. Sending "review this project folder and give me a detailed description" produces a real structured answer (headings, tables, bullet points) — not narration
2. Follow-up messages like "what should be done next?" get real answers, not `<transitioned>` empties
3. The app is live in Safari and these work verified with real sends
