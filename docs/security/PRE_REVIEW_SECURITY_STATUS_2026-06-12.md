# Pre-Review Security Status - 2026-06-12

This note updates the context around `docs/security/SECURITY_SCAN_2026-06-06.md` before third-party review.
The June 6 scan remains useful as a historical threat-model and surface checklist, but several reported findings are now stale against the current checkout.

## Current Validation Snapshot

- `npm run lint` passed.
- `npm run build` passed.
- `npm run test:hardening` passed.
- `npm run test:prompt-routing-output-p0` passed.
- `npm run test:auto-router-context` passed.
- `npm run test:routing-adherence` passed.
- `npm audit --omit=dev --json` reported zero vulnerabilities.
- `npm audit --json` reported zero vulnerabilities.
- Runtime was relaunched from `/Users/kevink/Projects/OpenHarness`.
- Backend `http://127.0.0.1:3001/` returned `200 OK`.
- UI `http://127.0.0.1:5173/` returned `200 OK`.

Docker MCP gateway still reports that Docker Desktop is not running. That is an optional integration availability issue, not a main-app startup failure.

## Historical Finding Status

| June 6 finding | Current status | Current evidence |
|---|---|---|
| Unauthenticated network-bound API exposes shell execution | Mitigated in current server defaults | `server/index.ts` binds to `127.0.0.1` by default and mutation/execution routes use local-control checks. |
| Session `workingDir` poisoning expands trusted filesystem roots | Mitigated | Session creation validates working directories, rejects restricted roots, and persisted working dirs are normalized before trust decisions. |
| Custom MCP stdio registration can spawn arbitrary local commands | Partially mitigated, still worth reviewer attention | MCP registration/start endpoints are local-control gated and endpoints are parsed/validated. Custom stdio remains intentionally powerful and should stay tied to trust-mode/product approval. |
| Swift WKWebView bridge exposes file read and shell execution | Needs separate native-app review when `OpenHarnessApp` changes | This pass did not change Swift native bridge files. Keep `docs/security/WEBBRIDGE_RUNTIME_REGRESSION_PLAN.md` as the release gate for native changes. |
| Model/chat markdown renderer allows DOM XSS | Mitigated for known URL-scheme vector | The renderer escapes text before applying simple markdown and blocks arbitrary URI schemes in links. Continue to review any future `dangerouslySetInnerHTML` changes carefully. |
| Localhost-only browser capture check accepts localhost-prefixed attacker hosts | Mitigated in deep browser capture | `server/browserCapture.ts` parses URLs and accepts only loopback hostnames. Keep `server/browserPreview.ts` in scope for future browser-capture refactors. |
| Background agent read-only path check allows sibling-prefix traversal | Mitigated by shared path policy | Workspace checks use `isPathWithin()` with resolved paths instead of simple string prefixes. |
| Swift provider API keys are persisted back to plaintext config | Native-app scoped follow-up | The Node server masks provider keys in API responses and redacts persisted session/run artifacts. Swift config storage should be reviewed before native release work. |
| Tracked test-results expose local project paths and model prose | Mitigated in current tracked files | Generated test results are ignored; no tracked `test-results/` files are present in the current index. |

## Pre-Review Recommendation

Do not add new feature surface before third-party review. Package the current behavioral changes intentionally, keep this addendum with the historical scan, and ask reviewers to focus on:

- session-goal persistence and prompt injection into orchestration/direct model paths
- compare-mode artifact generation and judge-model routing
- local-control and trust-mode consistency across privileged server routes
- native Swift bridge security only if `OpenHarnessApp` is part of the review scope
