# OpenHarness Review Remediation Ledger — 2026-06-19

Review baseline: `main` at `573efa95e9549c0af25b817abfcf0016fefeab8a`.

This ledger tracks the repository-wide review findings from `OPENHARNESS_REPOSITORY_REVIEW_AND_CODEX_GOAL.md`. A finding is closed only when the current tree has source changes and validation evidence that match the finding's scope.

## Closed or Locally Remediated

### OH-001 — Windows Workspace Containment

Status: locally remediated.

Changes:
- `server/toolPolicy.ts` now compares resolved containment with a path-module-aware helper that rejects `rel === '..'`, `rel.startsWith('..' + path.sep)`, and absolute relatives.
- `scripts/test-tool-policy.ts` covers POSIX child/traversal/sibling-prefix paths and Windows drive, sibling-prefix, traversal, different-drive, and UNC cases.

Evidence:
- `npx tsx scripts/test-tool-policy.ts`
- `npm run test:hardening`

Remaining release proof:
- Native Windows CI should run the same policy tests before this is considered release-proven.

### OH-003 — Personalization Fallback Encryption

Status: locally remediated.

Changes:
- `server/personalization.ts` now decodes the fallback key file's Base64 bytes before deriving the encryption key.
- Legacy fallback-key derivation is retained as a read candidate so profiles saved with the previous derivation can be recovered.
- Personalization load failures are exposed through `getPersonalizationLoadError()` and `/api/personalization`.
- `scripts/test-personalization-store.ts` verifies a fallback-key save in one process and decrypt in a second process with the macOS keychain disabled.

Evidence:
- `npx tsx scripts/test-personalization-store.ts`

Remaining release proof:
- Native Linux and Windows CI should exercise this fallback branch.

### OH-011 — Direct Build Dependency Declaration

Status: locally remediated.

Changes:
- `package.json` declares `esbuild` directly in `devDependencies`.
- `package.json` declares a Node engine of `>=24.0.0`.
- `package-lock.json` root metadata was refreshed.

Evidence:
- `npm install --package-lock-only`
- `npm ci`
- `npm run build`

Remaining release proof:
- Run `npm ci` in CI from a clean checkout before release.

### OH-007 — Session ID Filesystem Boundary

Status: locally remediated.

Changes:
- `server/sessionStore.ts` validates session IDs as UUIDs before save, load, and delete.
- Session paths are resolved under `~/.openharness/sessions` and rejected if they do not resolve to the expected UUID filename.
- Bulk session loading skips non-UUID JSON filenames.
- Existing session persistence/redaction test fixtures now use UUID IDs.
- `scripts/test-session-store-boundaries.ts` covers traversal markers, encoded and double-encoded separator text, absolute paths, Windows separators, malformed IDs, valid round trips, invalid deletes, and non-UUID bulk-load skipping.

Evidence:
- `npx tsx scripts/test-session-store-boundaries.ts`
- `npm test`

Remaining release proof:
- Route-level malformed-ID checks can be expanded to return explicit `400` responses instead of relying on storage-level null/false results.

### OH-013 — Source-Available Product Positioning

Status: locally remediated.

Changes:
- README tagline and banner alt text now say source-available rather than open-source.
- `public/openharness-readme-banner.svg` text and description now say source-available.
- Welcome, onboarding, and About UI copy now say source-available.
- `package.json` and `package-lock.json` use `SEE LICENSE IN LICENSE`.

Evidence:
- Wording scan across README, public banner, app copy, package metadata, LICENSE, and CONTRIBUTING.
- Package metadata check for manifest and lockfile license.

Remaining release proof:
- Release pages and external repository metadata should be checked before publication.

### OH-014 — Heuristic Router Precedence

Status: locally remediated.

Changes:
- `server/router.ts` gives explicit review/security/investigation intent precedence over architecture/planning nouns unless the user explicitly asks for a Planning Room/team plan.
- Advisory change language such as "suggest how to update" no longer routes to execute mode unless the user asks to apply/implement/edit.
- Routing tests cover security architecture review and advisory update suggestions.

Evidence:
- `npx tsx scripts/test-prompt-routing-quality-readiness.ts`
- `npx tsx scripts/test-prompt-routing-output-p0.ts`

### OH-017 — Docker MCP Opt-In Lifecycle

Status: locally remediated.

Changes:
- `server/index.ts` no longer auto-starts Docker MCP merely because Docker exists.
- Startup now requires `OPENHARNESS_AUTO_START_DOCKER_MCP=1`; otherwise users start Docker MCP from lifecycle controls.
- MCP watchdog startup remains enabled even when Docker MCP auto-start is disabled.
- Static remediation guard protects the opt-in check and watchdog behavior.

Evidence:
- `npx tsx scripts/test-review-remediation-static.ts`
- `npm test`

### OH-018 — Model Recommendation Matching Normalization

Status: locally remediated.

Changes:
- `server/autoRouter.ts` compares recommendation and candidate model IDs through normalized variants, including provider-qualified and unqualified forms.
- Routing Learning and Auto-Router Settings use symmetric model-key matching for recommendation availability and candidate annotations.
- Auto-Router regression coverage now exercises a provider-display recommendation (`Local Test Provider:Phi 4`) matching a provider-qualified candidate (`local:phi-4`).

Evidence:
- `npx tsx scripts/test-auto-router-context.ts`
- `npx tsx scripts/test-review-remediation-static.ts`
- `npm test`

### OH-019 — Desktop Snap Zones

Status: locally remediated.

Changes:
- `electron/main.cjs` now computes snap zones from the display containing the current OpenHarness window instead of always using the primary display.
- Static remediation guard protects `screen.getDisplayMatching(mainWindow.getBounds())`.

Evidence:
- `npx tsx scripts/test-review-remediation-static.ts`

### OH-020 — Electron Navigation and CSP Hardening

Status: locally remediated.

Changes:
- Electron now loads local app URLs through `127.0.0.1`.
- `will-navigate` blocks top-level navigation outside the allowed loopback app origins.
- `setWindowOpenHandler` denies popup windows and opens external URLs through the OS browser.
- A CSP is injected for app origins through `session.defaultSession.webRequest.onHeadersReceived()`.

Evidence:
- `npx tsx scripts/test-review-remediation-static.ts`
- `npm run build`

### OH-006 — Centralized Remote-Mode API Authentication

Status: locally remediated.

Changes:
- `server/index.ts` now refuses to bind the API to a non-loopback host unless `OPENHARNESS_ENABLE_REMOTE_API=1` and `OPENHARNESS_REMOTE_API_TOKEN` are both set.
- A centralized API middleware rejects non-loopback `/api/*` requests without the configured bearer token or `x-openharness-api-token`.
- Local loopback development remains allowed without a remote token.
- The global JSON body limit was reduced from `50mb` to `5mb`.
- Static remediation guard protects the remote opt-in, token requirement, and narrowed body limit.

Evidence:
- `npx tsx scripts/test-review-remediation-static.ts`
- `npm test`
- `npm run lint`
- `npm run build`

Remaining release proof:
- Add an integration smoke that binds a disposable non-loopback listener with and without remote env vars, and checks unauthorized and authorized remote requests.

### OH-008 — Custom Stdio MCP Full-Local Boundary

Status: locally remediated.

Changes:
- `server/routes/mcpRoutes.ts` now gates custom `stdio://` MCP registration, start, and restart behind `full-local` trust mode.
- Built-in Docker MCP lifecycle remains a separate explicit control path.
- `scripts/test-mcp-route-policy.ts` covers custom stdio denial in `workspace-write` and `ask-before-write`, allowance in `full-local`, and non-stdio URL handling.
- The hardening suite now includes the MCP route policy regression.

Evidence:
- `npx tsx scripts/test-mcp-route-policy.ts`
- `npm test`
- `npm run lint`
- `npm run build`

### OH-009 — Electron Packaged-Server Ownership and Authenticated Readiness

Status: locally remediated.

Changes:
- `server/index.ts` now exposes `/api/ready` as a dedicated readiness endpoint.
- When `OPENHARNESS_ELECTRON_HANDSHAKE` is set, `/api/ready` rejects missing or wrong handshakes with `401` and only returns the readiness acknowledgement header for the matching per-launch token.
- `electron/main.cjs` now checks `/api/ready` instead of `/api/config` before reusing or accepting a packaged server.
- Packaged Electron still starts the bundled server with a random per-launch `OPENHARNESS_ELECTRON_HANDSHAKE`.
- Static remediation guard protects the readiness endpoint and Electron handshake check.

Evidence:
- `npx tsx scripts/test-review-remediation-static.ts`
- `npm test`
- `npm run lint`
- `npm run build`

Remaining release proof:
- Run a packaged app smoke against the installed `/Applications/OpenHarness.app` and verify it does not reuse a listener that lacks the per-launch readiness acknowledgement.

### OH-010 — Centralized Port and Origin Configuration

Status: locally remediated.

Changes:
- `shared/runtimeConfig.cjs` centralizes server port, Vite port, listen host, loopback origins, UI origin, and allowed app origins.
- `server/index.ts`, `electron/main.cjs`, and `scripts/start.mjs` now consume the shared runtime config.
- `scripts/start.mjs` passes the resolved ports into both the server and Vite, including browser-visible `VITE_OPENHARNESS_*` vars.
- `src/utils/api.ts` now honors the configured server/Vite ports and uses the current page port for packaged same-origin runtime.
- `scripts/test-runtime-config.ts` covers port parsing, fallback behavior, origins, and allowed origins.

Evidence:
- `npx tsx scripts/test-runtime-config.ts`
- `npx tsx scripts/test-review-remediation-static.ts`
- `npm test`
- `npm run lint`
- `npm run build`

### OH-021 — ESLint Browser/Node Environment Split

Status: locally remediated.

Changes:
- `eslint.config.js` now scopes browser globals to `src/**/*.{ts,tsx}`.
- Server, scripts, and Vite TypeScript files now lint with Node globals only.
- Shared Node CommonJS config files lint under Node globals.
- Static remediation guard protects the browser/Node split.

Evidence:
- `npx tsx scripts/test-review-remediation-static.ts`
- `npm run lint`
- `npm test`
- `npm run build`

### OH-015 — Electron and Swift/WKWebView Duplicate Surface Decision

Status: locally remediated.

Changes:
- `docs/DESKTOP_SURFACE_DECISION.md` now records Electron as the canonical V1 desktop shell.
- The decision record states `OpenHarnessApp/` is retained only as a Swift/WKWebView native-shell prototype and native-bridge regression fixture unless a future plan explicitly reactivates it.
- README now links to the desktop decision and identifies Electron as the V1 desktop release surface.
- `docs/RELEASE_CHECKLIST.md` now separates Electron desktop/package changes from Swift prototype changes, and Swift changes require non-shipping confirmation or a reactivation plan.
- Static remediation guard protects the decision record, README language, and release checklist distinction.

Evidence:
- `npx tsx scripts/test-review-remediation-static.ts`
- `npm run lint`
- `npm test`
- `npm run build`

### OH-005 — Credential Vault Migration and Hardened Config Storage

Status: locally remediated.

Changes:
- `server/credentialVault.ts` stores provider API keys, OAuth access/refresh tokens, and MCP bearer tokens in encrypted `~/.openharness/credentials.enc.json`.
- The credential vault uses macOS Keychain when available, with environment/test keys and a local fallback key for non-keychain environments.
- `server/config.ts` hydrates runtime credentials from the vault, persists live credentials to the vault on save, and writes scrubbed `config.json` metadata with provider/MCP secrets removed.
- Loading a legacy config with inline credentials now triggers a scrubbed rewrite after vault persistence.
- `scripts/test-credential-vault.ts` covers encrypted envelope storage, config scrubbing, runtime hydration, OAuth metadata preservation, and stale-secret removal.
- The hardening suite now includes credential vault coverage.

Evidence:
- `npx tsx scripts/test-credential-vault.ts`
- `npx tsx scripts/test-review-remediation-static.ts`
- `npm test`
- `npm run lint`
- `npm run build`
- Live restart proof: `~/.openharness/config.json` reported `providerSecrets: 0`, `mcpSecrets: 0`, and `credentials.enc.json` exists.

### OH-012 — Canonical Delivery Gate

Status: locally remediated.

Changes:
- `package.json` now has a canonical local `npm test` entry that runs hardening plus personalization fallback coverage.
- The canonical hardening gate now includes MCP route policy, terminal session, session-store boundary, runtime config, and credential vault regressions.
- `.github/workflows/ci.yml` now runs clean install, lint, test, and build on Ubuntu, macOS, and Windows with Node 24.
- Static remediation guard protects the CI matrix and required command sequence.

Evidence:
- `npm test`
- `npm run lint`
- `npm run build`
- `npx tsx scripts/test-review-remediation-static.ts`

Remaining release proof:
- Remote GitHub Actions runs must complete successfully after this branch is pushed.

### OH-002 — Trust Mode Approval Transactions

Status: locally remediated.

Changes:
- `server/toolPolicy.ts` now exports `isTrustMode()` and `normalizeTrustMode()`.
- Unknown trust modes now fail closed for command, read, write, and MCP tool policy checks.
- `server/config.ts` normalizes persisted trust mode values when loading and saving config.
- `/api/config` rejects invalid `trustMode` updates with `400` instead of persisting them.
- `scripts/test-tool-policy.ts` covers trust-mode normalization and fail-closed command/write behavior for malformed values.
- `server/actionApprovals.ts` adds explicit approval transaction objects with action fingerprints, pending/approved/rejected/consumed states, expiry, redacted action metadata, and single-use consumption.
- `server/index.ts` exposes `/api/approvals`, `/api/approvals/:id/approve`, and `/api/approvals/:id/reject`.
- Terminal commands, terminal sessions, git stage/unstage/commit, patch apply, patch proposal isolate/apply, and worktree validation now require a matching approved transaction in `ask-before-write`.
- Automatic model write/command tool execution is blocked in `ask-before-write` unless routed through explicit approval-backed APIs.
- MCP write/command tool calls now require approval transactions in `ask-before-write`.
- `scripts/test-action-approvals.ts` covers transaction reuse, exact-action matching, rejection, and single-use consumption.

Evidence:
- `npx tsx scripts/test-tool-policy.ts`
- `npx tsx scripts/test-action-approvals.ts`
- Live approval smoke after terminal route extraction: setting `ask-before-write` caused `/api/terminal/exec` to return `409` with an approval object; approving it and rerunning with `approvalId` executed successfully with output `approval-smoke`; trust mode was restored to `workspace-write` afterward.
- `npm test`
- `npm run lint`
- `npm run build`

### OH-004 — Windows Command Execution

Status: locally remediated.

Changes:
- `server/shell.ts` now centralizes command invocation.
- POSIX uses the configured shell with `-lc`; Windows uses PowerShell with `-NoLogo`, `-NoProfile`, `-NonInteractive`, `-ExecutionPolicy Bypass`, and `-Command`.
- Terminal sessions, validation commands, and server shell commands use the shared runner.
- Timeouts and cancellations now go through `terminateProcessTree()`, which uses `taskkill.exe /t /f` on Windows.
- `scripts/test-terminal-sessions.ts` verifies clean terminal output, timeout status preservation, static Windows invocation flags, preservation of a quoted command string as one PowerShell argument, `OPENHARNESS_WINDOWS_SHELL` override behavior, and `taskkill.exe /t /f` process-tree cleanup wiring.

Evidence:
- `npx tsx scripts/test-terminal-sessions.ts`
- `npm test`
- `npm run lint`
- `npm run build`

Remaining release proof:
- Native Windows tests still need to cover success, failure, quoting, paths with spaces, timeout, cancellation, output redaction, and process-tree cleanup.

## Additional Locally Remediated

### OH-016 — Oversized Module Decomposition

Status: locally remediated.

Changes:
- `server/remoteApiAccess.ts` now owns loopback classification, listen-host classification, token comparison, bearer/header token parsing, and the remote API middleware.
- `server/index.ts` now uses `createRemoteApiGuard()` instead of carrying the remote-access middleware inline.
- Local-control bearer/header parsing now reuses the extracted helper.
- `server/routes/agentRoutes.ts` now owns agent profile lookup plus background-agent start/list/cancel/result routes.
- `server/routes/approvalRoutes.ts` now owns approval transaction listing, approval, and rejection routes.
- `server/routes/terminalRoutes.ts` now owns terminal exec, terminal sessions, command history, command lookup, and cancellation routes.
- `server/index.ts` now registers terminal routes through `registerTerminalRoutes()` instead of carrying that route family inline.
- `server/routes/appInfoRoutes.ts` now owns personalization, release notes, and crash report routes.
- `server/routes/benchRoutes.ts` now owns bench run list/read/proof-review/export routes.
- `server/routes/benchExecutionRoutes.ts` now owns the active `/api/bench/run` execution route while preserving background benchmark execution, Planning Room baseline selection, setup/verification commands, orchestrated and direct model execution, MCP tool invocation, trace proof generation, artifact capture, expected/forbidden path validation, scoring, and usage recording.
- `server/routes/routerRoutes.ts` now owns auto-router state/configuration/health and router-learning routes.
- `server/routes/browserRoutes.ts` now owns browser preview, deep capture, health, and console-log relay routes.
- `server/routes/configRoutes.ts` now owns safe config read/update routes, masking provider and MCP secrets while preserving trust-mode validation and auto-router update behavior.
- `server/routes/filesystemRoutes.ts` now owns filesystem list/read routes while preserving trust-mode read checks.
- `server/routes/providerRoutes.ts` now owns provider CRUD, OAuth, adapter discovery, local discovery, provider health, provider rate-limit status, model listing, metadata refresh, and model catalog audit routes.
- `server/routes/gitRoutes.ts` now owns git status/diff/file-diff/stage/unstage/commit/log, ship readiness, and hardened patch apply routes.
- `server/routes/labUtilityRoutes.ts` now owns eval prompt/report/recommendation routes, capability toggles, prompt plugin registry/import routes, debug bundle downloads, and prompt redaction/estimate helpers.
- `server/routes/evalRunRoutes.ts` now owns the active `/api/evals/run` execution route while preserving immediate report creation, background model streaming, prompt strategy variants, usage recording, result validation, and ephemeral-session cleanup.
- `server/routes/opsRoutes.ts` now owns checkpoint, worktree, protected-path, secret scan/export redaction, process ledger, and safety summary routes.
- `server/routes/patchProposalRoutes.ts` now owns patch proposal create/list/read, hunk selection, isolate/apply/discard, review comments, validation gate, commit, commit-message, and preview routes while preserving trust-mode path checks and ask-before-write approval checks.
- `server/routes/projectMemoryRoutes.ts` now owns project memory read/write/append plus archive/export routes.
- `server/routes/projectRepoRoutes.ts` now owns project profile, repo map, repo symbol, dependency, impact, and context-pack routes.
- `server/routes/sessionRoutes.ts` now owns session list/read/create/delete, run steering, and validation-proof artifact routes.
- `server/routes/chatMessageRoutes.ts` now owns the main chat message streaming route while preserving goal commands, session-title generation, routing, orchestration, visible run activity, provider fallback, abort handling, and persisted assistant error behavior.
- `server/routes/systemRoutes.ts` now owns readiness, native open-folder dialog, and cost-estimate routes while preserving packaged Electron handshake validation.
- `server/routes/taskRoutes.ts` now owns harness task and task-suite CRUD/import/export routes while preserving workspace containment and command-policy validation.
- `server/routes/testRoutes.ts` now owns the test harness run/status/batch routes, including ephemeral-session cleanup and workspace read validation.
- `server/routes/usageRoutes.ts` now owns usage summary, usage record, and usage budget-check routes.
- `server/routes/chatCompareRoutes.ts` now owns the side-by-side chat comparison route while preserving provider resolution, model streaming, response redaction, and comparison tool-call collection.
- `server/chatStreamSupport.ts` now owns the main-chat OpenHarness workspace guard, visible run-activity messages, trace preview compaction, SSE event writing, chunked text streaming, and throttled thinking events that were previously inline in `server/index.ts`.
- `src/components/settings/AssistantSettingsPanes.tsx` now owns Clicky, Skills, Plugins, and Memory panes that were previously inline in `SettingsModal.tsx`.
- `src/components/settings/InfoSettingsPanes.tsx` now owns the Chat Settings, Release Notes, Crash Reports, and About panes that were previously inline in `SettingsModal.tsx`.
- `src/components/settings/McpSettingsPanes.tsx` now owns Docker MCP, Curated MCP Tools, Custom MCP Servers, and Add MCP Server panes that were previously inline in `SettingsModal.tsx`.
- `src/components/settings/OnboardingSettingsPanes.tsx` now owns the Onboarding restart pane that was previously inline in `SettingsModal.tsx`.
- `src/components/settings/PreferenceSettingsPanes.tsx` now owns Personality, Personalization, and Theme panes that were previously inline in `SettingsModal.tsx`.
- `server/requestSchemas.ts` adds a lightweight runtime request-schema helper, now used by provider create/update/batch/probe payloads, session create/steering/validation-proof payloads, and the main chat streaming payload.
- Runtime schema coverage now also protects inline git stage/unstage/commit, patch apply, checkpoint create/restore, worktree create/promote/validate/auto-clean, protected-path, secret scan, export-redaction, chat comparison, eval execution, bench execution, and main chat message payloads.
- `server/routeSupport.ts` centralizes extracted-route error responses, 5xx audit logging, and mutation audit logging; browser, MCP, provider, and session routes now use it for repeated failure/mutation paths.
- `scripts/test-remote-api-access.ts` covers loopback classification and token comparison behavior.
- Static remediation guard protects the extracted remote-access module, runtime request-schema helper, centralized route support helper, chat stream support and SSE helper, agent, approval, terminal, app-info, bench-report, bench-execution, chat-compare, chat-message, eval-run, git/ship/patch, lab-utility, ops, patch-proposal, project-memory, project-repo, router, browser, config, filesystem, provider, session, system, task, test, and usage route extraction, plus the Settings assistant, informational, MCP, onboarding, and preference pane splits. It also rejects new inline `/api` route declarations in `server/index.ts`.

Evidence:
- `npx tsx scripts/test-remote-api-access.ts`
- `npx tsx scripts/test-review-remediation-static.ts`
- `npx tsc -p tsconfig.server.json --noEmit`
- `npm test`
- `npm run lint`
- `npm run build`
- Live restart proof: `/api/config`, `/api/ready`, `/api/mcp/watchdog`, `/api/personalization`, `/api/release-notes`, `/api/crash-reports`, `/api/router/state`, `/api/router/learning`, `/api/browser/health`, browser console-log relay, `/api/chat/compare` invalid-schema rejection, `/api/evals/run` invalid-schema rejection, `/api/bench/run` invalid-schema rejection, extracted main chat blank-content rejection, and the Vite UI returned successfully after relaunch.

Remaining follow-up:
- Continue opportunistic client settings decomposition when a future feature touches that surface. Current size checkpoint: `server/index.ts` is 2,858 lines with zero inline `/api` route declarations; agent, approval, terminal, app-info, bench-report, bench-execution, chat-compare, chat-message, chat-stream-support including SSE helpers, eval-run, git/ship/patch, lab-utility, ops, patch-proposal, project-memory, project-repo, router, browser, config, filesystem, provider, session, system, task, test, usage, MCP, and remote API access now live in focused modules. `SettingsModal.tsx` is 3,372 lines after the assistant, informational, MCP, onboarding, and preference pane splits.

## Still Open

No fully open findings remain in this ledger.

## Validation Log

Current local validation run for this wave:

- `npx tsx scripts/test-terminal-sessions.ts`
- `npx tsx scripts/test-tool-policy.ts`
- `npx tsx scripts/test-personalization-store.ts`
- `npx tsx scripts/test-session-store-boundaries.ts`
- `npx tsx scripts/test-mcp-route-policy.ts`
- `npx tsx scripts/test-runtime-config.ts`
- `npx tsx scripts/test-credential-vault.ts`
- `npx tsx scripts/test-remote-api-access.ts`
- `npx tsx scripts/test-action-approvals.ts`
- `npx tsx scripts/test-prompt-routing-quality-readiness.ts`
- `npx tsx scripts/test-prompt-routing-output-p0.ts`
- `npx tsx scripts/test-auto-router-context.ts`
- `npx tsx scripts/test-review-remediation-static.ts`
- `npx tsc -p tsconfig.server.json --noEmit`
- `npm test`
- `npm run lint`
- `npm run build`
- `npm run test:hardening`
- Relaunch proof after server/runtime changes:
  - `http://127.0.0.1:3001/api/config` returned `200`
  - `http://127.0.0.1:3001/api/ready` returned `200`
  - Extracted system routes returned `200` for `/api/ready` and `/api/cost/estimate`.
  - Extracted test routes returned `200` for `/api/test/status`.
  - Extracted chat comparison route returned `400` for invalid fractional `messageIndex`.
  - Extracted eval execution route returned `400` for invalid non-array `promptIds`.
  - Extracted bench execution route returned `400` for invalid non-array `taskIds`.
  - Main chat streaming route returned `400` for blank `content` before SSE setup.
  - `http://127.0.0.1:5173/` returned `200`
  - `http://127.0.0.1:3001/api/mcp/watchdog` returned `200`
  - Extracted app-info routes returned `200` for `/api/personalization`, `/api/release-notes`, and `/api/crash-reports`.
  - Extracted router routes returned `200` for `/api/router/state` and `/api/router/learning`.
  - Extracted browser routes returned `200` for `/api/browser/health`, and browser console-log POST/GET preserved a smoke entry.
  - Extracted session routes returned `200` for `/api/sessions`.
  - Extracted task routes returned `200` for `/api/tasks` and `/api/task-suites`.
  - Extracted bench report routes returned `200` for `/api/bench/runs`.
  - Extracted lab utility routes returned `200` for `/api/evals/prompts`, `/api/evals/reports`, `/api/capabilities`, `/api/prompt-plugins`, and prompt redaction/estimate helpers.
  - Extracted provider routes returned `200` for `/api/providers`, `/api/providers/rate-limits/status`, `/api/providers/health`, `/api/models`, and `/api/models/catalog/audit?openRouter=false`.
  - Extracted git/ship/patch routes returned `200` for `/api/git/status`, `/api/git/log`, and `/api/ship/readiness`; invalid extracted git-stage and patch-apply schema payloads returned `400`.
  - Extracted ops routes returned `200` for `/api/checkpoints`, `/api/worktrees`, `/api/protected/rules`, `/api/processes`, and `/api/safety/summary`; invalid extracted checkpoint, worktree, protected-path, and secret-scan payloads returned `400`.
  - Extracted patch-proposal routes returned `200` for `/api/patch-proposals?sessionId=route-smoke`.
  - Runtime request-schema smoke returned `400` for invalid session payload `{ title: 123 }` and invalid provider payload missing `baseURL`.
  - Centralized route-support follow-up smoke returned `200` for `/api/mcp/watchdog`, `/api/sessions`, `/api/providers`, `/api/models`, `/api/router/state`, `/api/browser/health?url=http://127.0.0.1:5173/`, and the Vite UI after relaunch.
  - Inline runtime-schema smoke returned `400` for invalid git-stage `paths`, patch-apply `patch`, worktree-create `reuseBranch`, and secret-scan-files `maxBytes` payloads.
  - Live config scan reported `providerSecrets: 0`, `mcpSecrets: 0`, `vaultExists: true`.
  - Live approval smoke after terminal route extraction returned `409` with approval object, then `200` with `approval-smoke` after approving and rerunning with `approvalId`; trust mode was restored to `workspace-write`.
  - Startup log showed Docker MCP auto-start disabled and MCP watchdog started.

Server/runtime files changed, and OpenHarness was relaunched after this wave. Current screen sessions after the latest restart: `36966.oh-server`, `36969.oh-vite`, and `37547.oh-electron`; `/api/ready`, extracted main chat blank-content rejection, and the Vite UI all responded after relaunch.
