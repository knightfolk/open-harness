# Runtime relaunch and process-shape proof - 2026-06-17

Purpose: capture live evidence for the Premier Harness restart rule and the kickoff stop condition that runtime relaunch must not leave duplicate OpenHarness/Electron windows.

## Starting state

Before relaunch, OpenHarness was in a partial runtime state:

- `127.0.0.1:3001` was occupied by a stale `npm run server` chain.
- `127.0.0.1:5173` was not listening.
- No OpenHarness Electron shell was present in the OpenHarness process check.
- Other Electron helper processes belonged to non-OpenHarness apps such as LM Studio and Discord.

## Relaunch path

The stale OpenHarness server-only process chain was stopped, then OpenHarness was relaunched with the repo-native launcher:

```text
npm start
```

Launcher evidence:

```text
✓ Express ready on port 3001
✓ Vite ready on port 5173
Launching Electron...
[main] Loading http://localhost:5173
✓ Docker MCP connected — tools: 50
✓ MCP watchdog started (30s interval)
```

## Reachability proof

After relaunch:

```text
http://127.0.0.1:3001/api/config -> HTTP 200
http://127.0.0.1:5173/ -> HTTP 200
```

Listening process proof:

```text
node 9784 -> TCP 127.0.0.1:5173 (LISTEN)
node 9785 -> TCP 127.0.0.1:3001 (LISTEN)
```

## Duplicate Electron/process-shape check

OpenHarness process shape after relaunch:

```text
node 9779  node_modules/.bin/tsx server/index.ts
node 9784  node_modules/.bin/vite --port 5173 --host 127.0.0.1 --strictPort
node 9785  server/index.ts runtime child
node 9957  node_modules/.bin/electron .
Electron 9958  Electron .
Electron Helper 9977  gpu-process
Electron Helper 9978  network service
Electron Helper Renderer 10000
Electron Helper Renderer 10001
```

Result: one managed OpenHarness server, one Vite UI process, and one OpenHarness Electron main process were present. The additional Electron Helper rows are normal helper processes for that single shell, not duplicate OpenHarness app instances.

## Boundary

This proof covers runtime relaunch, reachability, Docker MCP startup, and process-shape evidence. It does not close the remaining Premier Harness provider-backed/manual proof gaps, including genuine live tool-error recovery rows and provider-approved Model Lab or execute scenarios.
