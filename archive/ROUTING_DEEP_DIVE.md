# Routing & Subagent Deep Dive

## What's Actually Happening

### The Message Flow (Reality)

```
User types message
  → ChatPanel.onSend()
    → handleSendMessage() in App.tsx
      → SPAWNS FAKE SUBAGENTS (random names, random models, fake progress bars)
      → api.sendMessage() → single SSE stream
        → POST /api/sessions/:id/messages
          → streamModel() → ONE model, ONE request
            → tool call loop (up to 6 rounds)
            → returns text stream
          → res.end()
```

### The Problems

**1. Subagents are 100% fake theater**
```typescript
// App.tsx lines 389-407
const agentTasks = ['Analyzing request...', 'Searching for context...', 'Generating response...'];
const models = [activeModel, 'o4-mini', 'gpt-4.1'];  // ← HARDCODED, may not exist
const spawned: SubAgent[] = [];
const count = 1 + Math.floor(Math.random() * 2);  // ← RANDOM count
for (let i = 0; i < count; i++) {
  spawned.push({
    model: models[Math.floor(Math.random() * models.length)],  // ← RANDOM model
    task: agentTasks[i % agentTasks.length],  // ← STATIC labels
    progress: 0,  // ← Fake progress, incremented randomly
  });
}
```
These "agents" don't do anything. They're visual noise that makes the user think something complex is happening. The progress bar is `setInterval` with `Math.random() * 25`.

**2. Role Buckets are saved but NEVER used**
- The user configures role → model mappings (Planner → o3, Coder → Claude, etc.)
- These are saved to config as `roleAssignments: { planning: 'o3', ... }`
- **The server never reads them during streaming**
- `streamModel()` hardcodes `role: 'coder'` on line 912
- `buildPromptForModel()` always gets `'coder'` regardless of what the user asked
- There's no router that classifies the prompt and selects a role

**3. No prompt classification**
- Every message goes to the same model with the same 'coder' role prompt
- A "review this code" message gets the same system prompt as "build me a React app"
- The `ROLE_PROMPTS` map has: coder, reasoner, summarizer, title, planner, reviewer, worker, router
- Only 'coder' is ever used
- The 'router' role exists but is never called

**4. Single-model bottleneck**
- The entire conversation goes through ONE model
- No delegation to cheaper/faster models for simple tasks
- No reasoning model for complex tasks
- The model context window fills up with the full conversation, no summarization to a different model

**5. The chat-empty state still shows old UI**
- `ChatPanel` has the old `chat-empty-state` fallback
- The new `SmartWelcome` should render but the old code is also present

## What the Architecture SHOULD Be

### Real Subagent Router

```
User sends message
  → Router Agent (cheap/fast model like o4-mini)
    → Classifies: { role: 'coder'|'planner'|'reviewer'|..., complexity: 'simple'|'complex', needsTools: bool }
    → If simple → single model response using the mapped role model
    → If complex → spawn subagents:
      - Research agent (reads files, searches)
      - Implementation agent (writes code)
      - Review agent (checks quality)
    → Merge results into final answer
```

### Real Role Bucket Usage

```typescript
// In streamModel, instead of hardcoding 'coder':
const role = classifyRole(content); // 'planner' | 'coder' | 'reviewer' | etc.
const roleModel = appConfig.roleAssignments?.[role] || activeModel;
const promptResult = buildPromptForModel({
  modelId: roleModel,
  role,  // ← ACTUAL role, not hardcoded 'coder'
  ...
});
```

### Real Subagent Spawning

```typescript
// After the router classifies the task:
if (task.needsResearch) {
  const researcher = await spawnAgent('researcher', researchPrompt);
  context = researcher.result;
}
if (task.needsImplementation) {
  const coder = await spawnAgent('implementation', implPrompt, context);
  code = coder.result;
}
// Final synthesis with the main model
```

## Fix Priority

1. **Remove fake subagents** — They're misleading. Replace with real status of what's happening (reading files, calling tools, etc.)
2. **Wire role buckets to the router** — Use the existing `buildPromptForModel` role system
3. **Add a real router step** — First call classifies the task, then routes to the right role/model
4. **Show real activity** — "Reading src/App.tsx...", "Calling list_directory...", not fake agents

