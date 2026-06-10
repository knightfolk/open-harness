# Release Checklist Execution Log — 2026-06-09

- Timestamp (UTC): 2026-06-09T22:08:11Z
- Git ref: 0ea32b76e76955f7db21df51a6953fb93aef31bc
- Baseline branch: main

## Commands run
- `npm run lint`
- `npm run build`
- `npm run test:hardening`
- `npm run smoke:tool-boundaries`
- `npm run smoke:docker-ui`
- `npm run smoke:ui-clicks`
- `npm run test:auto-router-trace-ui`
- `npm run test:side-chat-main-session-isolation`
- `npm run test:routing-adherence`
- `npm run test:router-learning-debug-loop`
- `npm run test:router-learning-outcomes`
- `npm run test:session-persistence`
- `npm run test:sse-progress`

## Known outcomes
- Core gates passed: lint, build, hardening, router/side-chat/routing tests, session persistence, SSE progress.
- Smoke gates:
  - `smoke:tool-boundaries` **passed** after updating `scripts/smoke-tool-boundaries.mjs` to match current endpoint contracts.
  - `smoke:docker-ui` failed: Docker daemon is not running.
  - `smoke:ui-clicks` failed: docker-mcp is not running.
- Docker smoke rerun attempts (2026-06-10T08:26:40Z):
  - `smoke:docker-ui` failed: Docker daemon is not running.
  - `smoke:ui-clicks` failed: docker-mcp is not running.
- Docker smoke rerun attempts (2026-06-09T18:49:25Z, Docker engine reportedly running):
  - `smoke:docker-ui` failed: docker-mcp is not running.
  - `smoke:ui-clicks` failed: docker-mcp is not running.
- Docker smoke rerun attempts (2026-06-10T01:50:41Z, user-reported MCP running):
  - `smoke:docker-ui` failed: docker-mcp is not running.
  - `smoke:ui-clicks` failed: docker-mcp is not running.
- Docker smoke rerun attempts (2026-06-10T01:58:59Z, mcp container reachable):
  - `OPENHARNESS_UI_URL=http://host.docker.internal:5173 npm run smoke:docker-ui` failed: browser network validation hit `net::ERR_ABORTED` for `http://host.docker.internal:5173/src/components/SettingsModal.tsx`.
  - `OPENHARNESS_UI_URL=http://host.docker.internal:5173 npm run smoke:ui-clicks` failed: same `net::ERR_ABORTED` on `SettingsModal.tsx`.
  - Follow-up direct checks show the container path is resolving correctly (`docker exec` of MCP container returns `192.168.65.254 host.docker.internal`) and `npm`-level fetch to the same URL from container returns HTTP 200 for that module.
  - Manual verification of `browser_navigate` to `http://host.docker.internal:5173/?smoke=diag` succeeds and returns expected title `OpenHarness — Universal AI Harness`, so this is currently a browser-tool/runtime network request flake in the smoke validation path, not Docker engine or MCP unavailability.
- Manual endpoint checks:
  - `GET /api/router/state` 200
  - `GET /api/router/candidates` 200
  - `GET /api/router/health` 200
  - `GET /api/router/learning` 200
  - `GET /api/router/adherence/events` 200
  - `GET /api/patch-proposals` 200
  - `GET /api/providers` 200 (4 providers)
  - `GET /api/config` reachable
  - `GET /api/providers/health` 200
- Manual smoke session flow executed via API:
  - created and deleted session successfully
  - direct prompt returned text
  - execute-style prompt with command intent produced tool calls
  - route state events observed in SSE (`run_start`)

## Validation artifacts
- Runtime reachability during execution:
  - `http://127.0.0.1:3001` listening
  - `http://localhost:5173` listening
- Manual API smoke run completed via session/message flow:
  - created session
  - direct request succeeded
  - execute request succeeded with tool call (`exec_command`)
  - investigate request returned orchestration output

## Packaging / artifacts
- `dist/` exists and was produced by build.
- `release/` not present; no electron packaging/release script change detected.

## Notes
- Current run is blocked for Docker-dependent UI smoke checks until Docker daemon and docker-mcp are available.
- Current run is currently blocked for Docker-dependent UI smoke checks until `docker-mcp` is running and discoverable by both smoke scripts.
- `package.json` version remains `1.0.0`; no version bump or release-note/signoff PR items were updated in this run.

## Release hygiene completion
- Release type: patch (behavior + routing reliability + test harness hardening).
- Runtime impact: server/runtime and script/tooling changes, no Electron/app packaging changes.
- Version bump notes:
  - Current codebase version: `1.0.0` (in `package.json`).
  - Recommended release target: `1.0.1` (patch), pending approval/signoff.
  - Not yet applied in source to avoid mixed release semantics before branch approval.
  - Blocker for immediate bump in this run: Docker UI smoke scripts still fail on browser-side `SettingsModal.tsx` request aborts; hold version cut until this is resolved.
- Owner/signoff checklist:
  - Rollout owner: Friday
  - Technical reviewer: pending
  - QA signoff: pending
  - Release approver: pending
  - PR approval: pending
  - Tag/publish: pending
  - Rollback plan owner: pending
  - Communication plan owner: pending

## PR-ready release-note draft
### OpenHarness (Proposed patch notes)
- Improved routing and orchestration resilience in the server paths used by tool execution and session workflows.
- Added/updated server-side hardening and stability checks for:
  - tool boundary conformance
  - session persistence behavior
  - SSE progress stream behavior
- Updated smoke and regression test coverage to align with current API surface for browser/UI automation and persistence assertions.
- Expanded runtime verification coverage so future release checks explicitly capture:
  - `/api/router/*` endpoint health and states
  - patch proposal and provider discovery behavior
  - session lifecycle and execution flow with direct/execute paths
- Known caveats:
  - `smoke:docker-ui` and `smoke:ui-clicks` remain blocked by docker browser-tool network stability in this environment (aborted `SettingsModal.tsx` fetch from `host.docker.internal:5173`) despite the MCP container and daemon being up.
- Migration/rollback notes:
  - No schema or migration changes in this release.
  - Revert by checking out the previous commit and rerunning the validation checklist.
