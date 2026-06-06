# Security Review: OpenHarness

## Scope
- Scan mode: repository-wide Codex Security scan of `/Users/kevink/Projects/OpenHarness`.
- Public exposure evidence: anonymous `git ls-remote https://github.com/knightfolk/open-harness.git HEAD` returned remote HEAD `9334806ce37cb49a4f6109eb71013a339d5183b0`. GitHub CLI metadata was unavailable because `gh` is unauthenticated.
- Local scan commit: `606b4a85c4af7ce4621c3b91a3bf0c0ffcd497b6`.
- Worklist: 170 Git-tracked source-like rows. Ignored/untracked `OpenHarnessApp/.build`, `node_modules`, `dist`, generated fixture eval dirs, docs/archive, and lockfiles were excluded from deep review except where relevant to exposure evidence.
- Validation: static source-to-sink tracing, targeted markdown renderer reproduction, tracked secret grep, `npm audit --json`, `npm audit --omit=dev --json`, and subagent-owned review slices.
- Artifacts: `/tmp/codex-security-scans/OpenHarness/606b4a85c4af_20260606T091939Z`.

### Scan Summary

| Field | Value |
|---|---|
| Reportable findings | 9 |
| Severity mix | high: 5, medium: 3, low: 1 |
| Confidence mix | high: 9 |
| Coverage | 170 Git-tracked source/config/runtime rows closed in work ledger; coverage ledger includes reported, rejected, and no-issue surfaces |
| Validation mode | Static trace plus targeted command output; no target code modified |

## Threat Model

# OpenHarness Repository Threat Model

## Overview
OpenHarness is a local-first AI workbench with a React/Vite UI, Express API server, Electron shell, and a Swift WKWebView spike. It coordinates model providers, agent roles, MCP tools, terminal commands, Git/worktree operations, browser previews, evals, and local project sessions. The most security-sensitive runtime code is in `server/`, `src/components/MarkdownContent.tsx`, `electron/`, and `OpenHarnessApp/Sources/OpenHarnessApp`.

## Threat Model, Trust Boundaries, and Assumptions
- Assets: provider API keys, local project files, terminal execution authority, MCP/tool credentials, session history, patch/worktree state, and user machine integrity.
- Trust boundaries: browser/renderer text and model output to privileged local APIs; HTTP clients to Express routes; configured workspaces to the rest of the filesystem; custom MCP endpoints to local process execution; WKWebView JavaScript to native Swift bridge.
- Attacker-controlled inputs include chat/model/tool output, HTTP request bodies to the local API when reachable, markdown content, file paths, URLs passed to preview/fetch features, MCP endpoint strings, terminal commands, and session working directories.
- Operator-controlled inputs include trusted provider config, selected folders, intentional terminal commands, curated MCP installs, and model/provider choices.
- The app is intended local-first, but local-first is not a complete security boundary unless the server binds loopback-only and renderer/native bridges are locked down.

## Attack Surface, Mitigations, and Attacker Stories
- Express API: exposes filesystem, terminal, Git, patch, MCP, worktree, process, browser-capture, provider, and session routes. Existing mitigations include CORS allowlists, trust modes, path checks, redaction helpers, and protected path scanners, but these only help when all entrypoints use them correctly.
- Renderer: chat markdown renders untrusted model/user content. Any DOM XSS is high impact because same-origin local APIs and native bridge capabilities are nearby.
- MCP/agent tools: intended to cross from AI output into local actions. High-risk commands, path checks, and tool filtering must be consistent at every registration/start/call boundary.
- Swift shell: WKWebView and NativeBridge are privileged. Any loaded script must be treated as untrusted unless origin and capability checks are enforced.
- GitHub public release: tracked secrets, generated eval artifacts, local paths, and canaries can become public. Test canaries are acceptable only when clearly fake and intentional.

## Severity Calibration (Critical, High, Medium, Low)
- Critical/High: unauthenticated or renderer-reachable command execution, arbitrary file read of sensitive files, workspace escape into credentials, native bridge command execution, or MCP command spawning.
- Medium: SSRF/local network probing with bounded artifacts, read-only workspace escape without proven sensitive file access, cleartext local secret persistence, or XSS that lacks a privileged bridge/API chain.
- Low: local path metadata, test canaries that are clearly fake, generated model prose, and hygiene issues that do not expose secrets or enable a privileged action.


## Findings

| # | Finding | Severity | Confidence | Category |
|---|---|---|---|---|
| 1 | [Unauthenticated network-bound API exposes shell execution](#1-unauthenticated-network-bound-api-exposes-shell-execution) | high | high | Unauthenticated local API command execution |
| 2 | [Session workingDir poisoning expands trusted filesystem roots](#2-session-workingdir-poisoning-expands-trusted-filesystem-roots) | high | high | Path trust boundary bypass / arbitrary file access |
| 3 | [Custom MCP stdio registration can spawn arbitrary local commands](#3-custom-mcp-stdio-registration-can-spawn-arbitrary-local-commands) | high | high | Arbitrary process execution via plugin registration |
| 4 | [Swift WKWebView bridge exposes file read and shell execution to renderer script](#4-swift-wkwebview-bridge-exposes-file-read-and-shell-execution-to-renderer-script) | high | high | Native bridge privilege exposure |
| 5 | [Model/chat markdown renderer allows DOM XSS](#5-modelchat-markdown-renderer-allows-dom-xss) | high | high | Cross-site scripting in local app renderer |
| 6 | [Localhost-only browser capture check accepts localhost-prefixed attacker hosts](#6-localhost-only-browser-capture-check-accepts-localhost-prefixed-attacker-hosts) | medium | high | SSRF / local network probing |
| 7 | [Background agent read-only path check allows sibling-prefix traversal](#7-background-agent-read-only-path-check-allows-sibling-prefix-traversal) | medium | high | Path traversal / workspace escape |
| 8 | [Swift provider API keys are persisted back to plaintext config](#8-swift-provider-api-keys-are-persisted-back-to-plaintext-config) | medium | high | Local secret storage exposure |
| 9 | [Tracked test-results expose local project paths and model prose](#9-tracked-test-results-expose-local-project-paths-and-model-prose) | low | high | Low-sensitivity metadata exposure |


### Confidence Scale

| Label | Meaning |
|---|---|
| high | Direct source, configuration, or runtime evidence supports the finding, with no material unresolved reachability or exploitability blocker. |
| medium | Source evidence supports a plausible issue, but runtime behavior, deployment configuration, role reachability, type constraints, or exploit reliability still need proof. |
| low | Weak or incomplete evidence; included only when useful for follow-up triage. |

### [1] Unauthenticated network-bound API exposes shell execution

| Field | Value |
|---|---|
| Severity | high |
| Confidence | high |
| Confidence rationale | Direct code evidence shows the source, missing control, and sink; runtime reproduction would mainly improve demonstration, not reportability. |
| Category | Unauthenticated local API command execution |
| CWE | CWE-306 Missing Authentication for Critical Function; CWE-78 OS Command Injection sink exposure |
| Affected lines | server/index.ts:123, server/index.ts:135-141, server/index.ts:1161-1171, server/index.ts:4710 |

#### Summary
The Express app creates unauthenticated local-control APIs and starts with app.listen(PORT) without an explicit loopback host. The terminal endpoint accepts caller-supplied commands and executes them through zsh. If the process is reachable from a LAN interface, any network peer can run commands as the OpenHarness user.

#### Validation
- [x] Attacker-controlled source identified.
- [x] Missing or incomplete root control identified.
- [x] Sensitive sink/effect identified.
- [x] Existing controls checked against this exact tuple.

Method: focused static trace against the checked-out source. Evidence: HTTP POST /api/terminal/exec -> command body -> checkToolActionPolicy for cwd -> runShellCommand -> spawn /bin/zsh -lc command.

Remaining uncertainty: live end-to-end reproduction was not run during this urgent scan; no repository evidence was found that defeats the source-to-sink path.

#### Dataflow
HTTP POST /api/terminal/exec -> command body -> checkToolActionPolicy for cwd -> runShellCommand -> spawn /bin/zsh -lc command.

#### Reachability
Local-network attacker if port 3001 is bound beyond loopback. No route authentication is present; CORS is not an authentication boundary for non-browser clients.

#### Severity
Final severity is **high**. The impact is calibrated from the concrete local runtime, filesystem, renderer, network, or public-repository effect shown above. Local-first deployment assumptions lower broad internet likelihood, but do not defeat the reachable local API, renderer, or GitHub exposure boundary. Additional live runtime proof would mainly adjust confidence around deployment reach, not the root bug.

#### Remediation
Bind server to 127.0.0.1 by default, add an explicit host allowlist if remote use is needed, and require a local session token/origin proof for mutation and execution routes.

### [2] Session workingDir poisoning expands trusted filesystem roots

| Field | Value |
|---|---|
| Severity | high |
| Confidence | high |
| Confidence rationale | Direct code evidence shows the source, missing control, and sink; runtime reproduction would mainly improve demonstration, not reportability. |
| Category | Path trust boundary bypass / arbitrary file access |
| CWE | CWE-22 Improper Limitation of a Pathname to a Restricted Directory |
| Affected lines | server/index.ts:558-569, server/index.ts:471-489, server/index.ts:1093-1145, server/index.ts:1161-1171 |

#### Summary
Session creation persists caller-supplied workingDir without validation. knownWorkspaceRoots then treats every session workingDir as trusted, so an attacker can create a session rooted at / and pass its session id to filesystem or terminal routes.

#### Validation
- [x] Attacker-controlled source identified.
- [x] Missing or incomplete root control identified.
- [x] Sensitive sink/effect identified.
- [x] Existing controls checked against this exact tuple.

Method: focused static trace against the checked-out source. Evidence: POST /api/sessions workingDir=/ -> sessions map/session store -> trustedWorkspaceFromRequest(sessionId) -> isReadPathAllowed or isKnownWorkspacePath -> file read/list or command cwd outside project.

Remaining uncertainty: live end-to-end reproduction was not run during this urgent scan; no repository evidence was found that defeats the source-to-sink path.

#### Dataflow
POST /api/sessions workingDir=/ -> sessions map/session store -> trustedWorkspaceFromRequest(sessionId) -> isReadPathAllowed or isKnownWorkspacePath -> file read/list or command cwd outside project.

#### Reachability
Any caller able to reach the local API can expand the trusted root. This is independently exploitable even if server binding is later limited to localhost, because malicious renderer code can call the same API.

#### Severity
Final severity is **high**. The impact is calibrated from the concrete local runtime, filesystem, renderer, network, or public-repository effect shown above. Local-first deployment assumptions lower broad internet likelihood, but do not defeat the reachable local API, renderer, or GitHub exposure boundary. Additional live runtime proof would mainly adjust confidence around deployment reach, not the root bug.

#### Remediation
Validate workingDir at session creation and load time with the same known-workspace policy, reject root/home/system paths by default, and migrate or quarantine persisted sessions with invalid roots.

### [3] Custom MCP stdio registration can spawn arbitrary local commands

| Field | Value |
|---|---|
| Severity | high |
| Confidence | high |
| Confidence rationale | Direct code evidence shows the source, missing control, and sink; runtime reproduction would mainly improve demonstration, not reportability. |
| Category | Arbitrary process execution via plugin registration |
| CWE | CWE-78 OS Command Injection sink exposure; CWE-94 Code Injection through extension boundary |
| Affected lines | server/index.ts:884-899, server/index.ts:948-955, server/mcp.ts:123-129 |

#### Summary
The custom MCP server API persists arbitrary endpoint strings. Starting that server passes the stdio endpoint command to spawn without trust-mode gating or curated-server restrictions.

#### Validation
- [x] Attacker-controlled source identified.
- [x] Missing or incomplete root control identified.
- [x] Sensitive sink/effect identified.
- [x] Existing controls checked against this exact tuple.

Method: focused static trace against the checked-out source. Evidence: POST /api/mcp-servers endpoint=stdio://... -> saveConfig -> POST /api/mcp/:id/start -> mcpManager.startServer -> StdioMCPClient.connect -> spawn(command,args).

Remaining uncertainty: live end-to-end reproduction was not run during this urgent scan; no repository evidence was found that defeats the source-to-sink path.

#### Dataflow
POST /api/mcp-servers endpoint=stdio://... -> saveConfig -> POST /api/mcp/:id/start -> mcpManager.startServer -> StdioMCPClient.connect -> spawn(command,args).

#### Reachability
Any API caller can register and start a local process. The no-auth server surface makes this a direct RCE primitive; even localhost-only, renderer XSS can reach it.

#### Severity
Final severity is **high**. The impact is calibrated from the concrete local runtime, filesystem, renderer, network, or public-repository effect shown above. Local-first deployment assumptions lower broad internet likelihood, but do not defeat the reachable local API, renderer, or GitHub exposure boundary. Additional live runtime proof would mainly adjust confidence around deployment reach, not the root bug.

#### Remediation
Gate custom stdio registration/start behind full-local explicit approval, prefer curated allowlisted commands, parse command/args structurally, and store disabled-by-default until user confirms.

### [4] Swift WKWebView bridge exposes file read and shell execution to renderer script

| Field | Value |
|---|---|
| Severity | high |
| Confidence | high |
| Confidence rationale | Direct code evidence shows the source, missing control, and sink; runtime reproduction would mainly improve demonstration, not reportability. |
| Category | Native bridge privilege exposure |
| CWE | CWE-94 Code Injection; CWE-200 Sensitive Information Exposure |
| Affected lines | OpenHarnessApp/Sources/OpenHarnessApp/Views/ContentView.swift:18-24, OpenHarnessApp/Sources/OpenHarnessApp/Views/ContentView.swift:60-67, OpenHarnessApp/Sources/OpenHarnessApp/Views/ContentView.swift:190-193, OpenHarnessApp/Sources/OpenHarnessApp/Bridge/WebBridge.swift:22-38, OpenHarnessApp/Sources/OpenHarnessApp/Bridge/WebBridge.swift:203-218 |

#### Summary
The Swift shell injects window.NativeBridge into the main frame and the message handler exposes listDirectory, readFile, and execCommand. Navigation allows the dev URL and lacks a strict main-frame origin/capability gate before privileged actions.

#### Validation
- [x] Attacker-controlled source identified.
- [x] Missing or incomplete root control identified.
- [x] Sensitive sink/effect identified.
- [x] Existing controls checked against this exact tuple.

Method: focused static trace against the checked-out source. Evidence: Renderer script -> window.NativeBridge.send(action,payload) -> WKScriptMessageHandler -> WebBridge switch -> FileSystemService.readFile/listDirectory or ProcessRunner.run.

Remaining uncertainty: live end-to-end reproduction was not run during this urgent scan; no repository evidence was found that defeats the source-to-sink path.

#### Dataflow
Renderer script -> window.NativeBridge.send(action,payload) -> WKScriptMessageHandler -> WebBridge switch -> FileSystemService.readFile/listDirectory or ProcessRunner.run.

#### Reachability
Any script that executes in the WKWebView main frame can invoke native actions. The markdown XSS finding provides one plausible route; a compromised localhost dev server is another.

#### Severity
Final severity is **high**. The impact is calibrated from the concrete local runtime, filesystem, renderer, network, or public-repository effect shown above. Local-first deployment assumptions lower broad internet likelihood, but do not defeat the reachable local API, renderer, or GitHub exposure boundary. Additional live runtime proof would mainly adjust confidence around deployment reach, not the root bug.

#### Remediation
Restrict bridge calls to an exact trusted origin, remove execCommand from renderer-accessible actions or require explicit user approval, scope file access to selected workspaces, and deny unexpected navigations.

### [5] Model/chat markdown renderer allows DOM XSS

| Field | Value |
|---|---|
| Severity | high |
| Confidence | high |
| Confidence rationale | Direct code evidence shows the source, missing control, and sink; runtime reproduction would mainly improve demonstration, not reportability. |
| Category | Cross-site scripting in local app renderer |
| CWE | CWE-79 Improper Neutralization of Input During Web Page Generation |
| Affected lines | src/components/MarkdownContent.tsx:32, src/components/MarkdownContent.tsx:45, src/components/MarkdownContent.tsx:51-68, src/components/MessageBubble.tsx:150-151, src/components/SideChatPanel.tsx:350-352 |

#### Summary
MarkdownContent builds HTML strings and injects them with dangerouslySetInnerHTML. It escapes <, >, and &, but not quotes in markdown link URLs, and it does not enforce safe URL schemes.

#### Validation
- [x] Attacker-controlled source identified.
- [x] Missing or incomplete root control identified.
- [x] Sensitive sink/effect identified.
- [x] Existing controls checked against this exact tuple.

Method: focused static trace against the checked-out source. Evidence: Assistant/user/tool text -> MarkdownContent.simpleMarkdown -> link regex inserts raw URL into href -> dangerouslySetInnerHTML -> active DOM attribute or javascript URL.

Remaining uncertainty: live end-to-end reproduction was not run during this urgent scan; no repository evidence was found that defeats the source-to-sink path.

#### Dataflow
Assistant/user/tool text -> MarkdownContent.simpleMarkdown -> link regex inserts raw URL into href -> dangerouslySetInnerHTML -> active DOM attribute or javascript URL.

#### Reachability
A malicious model/tool response or copied user content can render in chat and side chat. In the Swift shell it can chain into NativeBridge; in the browser/Electron shell it can call same-origin local APIs.

#### Severity
Final severity is **high**. The impact is calibrated from the concrete local runtime, filesystem, renderer, network, or public-repository effect shown above. Local-first deployment assumptions lower broad internet likelihood, but do not defeat the reachable local API, renderer, or GitHub exposure boundary. Additional live runtime proof would mainly adjust confidence around deployment reach, not the root bug.

#### Remediation
Replace string-built markdown with React elements or a sanitizer; escape attributes; allow only http, https, mailto, and safe relative URLs; add regression tests for javascript: links and quote attribute injection.

### [6] Localhost-only browser capture check accepts localhost-prefixed attacker hosts

| Field | Value |
|---|---|
| Severity | medium |
| Confidence | high |
| Confidence rationale | Direct code evidence shows the source, missing control, and sink; runtime reproduction would mainly improve demonstration, not reportability. |
| Category | SSRF / local network probing |
| CWE | CWE-918 Server-Side Request Forgery |
| Affected lines | server/browserPreview.ts:45-60, server/browserCapture.ts:132-135, server/index.ts:4423-4441 |

#### Summary
Browser preview/deep capture use a regex that accepts strings beginning with localhost, 127.0.0.1, or ::1. A hostname such as localhost.attacker.example matches the check but is not loopback.

#### Validation
- [x] Attacker-controlled source identified.
- [x] Missing or incomplete root control identified.
- [x] Sensitive sink/effect identified.
- [x] Existing controls checked against this exact tuple.

Method: focused static trace against the checked-out source. Evidence: POST /api/browser/preview or /api/browser/deep URL -> regex prefix check -> curl/fetch target URL -> response metadata or resource checks returned.

Remaining uncertainty: live end-to-end reproduction was not run during this urgent scan; no repository evidence was found that defeats the source-to-sink path.

#### Dataflow
POST /api/browser/preview or /api/browser/deep URL -> regex prefix check -> curl/fetch target URL -> response metadata or resource checks returned.

#### Reachability
Any API caller can cause the server to fetch an attacker-controlled hostname that looks localhost-prefixed. Impact is network probing/data fetch bounded by returned artifacts and timeouts.

#### Severity
Final severity is **medium**. The impact is calibrated from the concrete local runtime, filesystem, renderer, network, or public-repository effect shown above. Local-first deployment assumptions lower broad internet likelihood, but do not defeat the reachable local API, renderer, or GitHub exposure boundary. Additional live runtime proof would mainly adjust confidence around deployment reach, not the root bug.

#### Remediation
Parse with URL, require hostname exactly localhost, 127.0.0.1, or ::1, reject credentials/ambiguous forms, and optionally reuse the stronger DNS/IP validation from webFetch for redirects/resources.

### [7] Background agent read-only path check allows sibling-prefix traversal

| Field | Value |
|---|---|
| Severity | medium |
| Confidence | high |
| Confidence rationale | Direct code evidence shows the source, missing control, and sink; runtime reproduction would mainly improve demonstration, not reportability. |
| Category | Path traversal / workspace escape |
| CWE | CWE-22 Improper Limitation of a Pathname to a Restricted Directory |
| Affected lines | server/agentRuntime.ts:652-657 |

#### Summary
The background agent read-only tool checks target.startsWith(base). Sibling paths with the workspace prefix, such as OpenHarness-private, pass the string check while living outside the intended root.

#### Validation
- [x] Attacker-controlled source identified.
- [x] Missing or incomplete root control identified.
- [x] Sensitive sink/effect identified.
- [x] Existing controls checked against this exact tuple.

Method: focused static trace against the checked-out source. Evidence: Agent tool args.path -> resolve(base,path) -> target.startsWith(base) -> read/list outside sibling workspace.

Remaining uncertainty: live end-to-end reproduction was not run during this urgent scan; no repository evidence was found that defeats the source-to-sink path.

#### Dataflow
Agent tool args.path -> resolve(base,path) -> target.startsWith(base) -> read/list outside sibling workspace.

#### Reachability
Requires a background agent/tool invocation with a malicious path. Impact is read-only file exposure outside the configured workspace.

#### Severity
Final severity is **medium**. The impact is calibrated from the concrete local runtime, filesystem, renderer, network, or public-repository effect shown above. Local-first deployment assumptions lower broad internet likelihood, but do not defeat the reachable local API, renderer, or GitHub exposure boundary. Additional live runtime proof would mainly adjust confidence around deployment reach, not the root bug.

#### Remediation
Use the existing isPathWithin/path.relative implementation instead of startsWith and add sibling-prefix regression tests.

### [8] Swift provider API keys are persisted back to plaintext config

| Field | Value |
|---|---|
| Severity | medium |
| Confidence | high |
| Confidence rationale | Direct code evidence shows the source, missing control, and sink; runtime reproduction would mainly improve demonstration, not reportability. |
| Category | Local secret storage exposure |
| CWE | CWE-312 Cleartext Storage of Sensitive Information |
| Affected lines | OpenHarnessApp/Sources/OpenHarnessApp/Backend/ConfigManager.swift:118, OpenHarnessApp/Sources/OpenHarnessApp/Backend/ConfigManager.swift:155-161, OpenHarnessApp/Sources/OpenHarnessApp/Backend/ConfigManager.swift:190-198 |

#### Summary
ConfigManager writes keys to Keychain, then also stores them in config.providers[providerID]?.apiKey and saves config.json with apiKey populated.

#### Validation
- [x] Attacker-controlled source identified.
- [x] Missing or incomplete root control identified.
- [x] Sensitive sink/effect identified.
- [x] Existing controls checked against this exact tuple.

Method: focused static trace against the checked-out source. Evidence: setAPIKey -> setKeychain -> config.providers[providerID]?.apiKey = key -> save -> JSON contains apiKey.

Remaining uncertainty: live end-to-end reproduction was not run during this urgent scan; no repository evidence was found that defeats the source-to-sink path.

#### Dataflow
setAPIKey -> setKeychain -> config.providers[providerID]?.apiKey = key -> save -> JSON contains apiKey.

#### Reachability
Local file readers, backups, logs, or sync tools can expose provider keys. This is lower than RCE but important before public release and wider testing.

#### Severity
Final severity is **medium**. The impact is calibrated from the concrete local runtime, filesystem, renderer, network, or public-repository effect shown above. Local-first deployment assumptions lower broad internet likelihood, but do not defeat the reachable local API, renderer, or GitHub exposure boundary. Additional live runtime proof would mainly adjust confidence around deployment reach, not the root bug.

#### Remediation
Persist only Keychain references or empty apiKey placeholders, migrate existing config values into Keychain, and scrub plaintext apiKey on save.

### [9] Tracked test-results expose local project paths and model prose

| Field | Value |
|---|---|
| Severity | low |
| Confidence | high |
| Confidence rationale | Direct code evidence shows the source, missing control, and sink; runtime reproduction would mainly improve demonstration, not reportability. |
| Category | Low-sensitivity metadata exposure |
| CWE | none |
| Affected lines | test-results/summary-2026-05-30T20-19-36-925Z.md:4, test-results/summary-2026-05-30T20-19-36-925Z.md:33, test-results/test-2026-05-30T20-19-36-925Z.json:3 |

#### Summary
Tracked test result artifacts contain local paths such as /Users/kevink/Projects/Chains and raw model output. No live credentials were found, but this is unnecessary public metadata.

#### Validation
- [x] Attacker-controlled source identified.
- [x] Missing or incomplete root control identified.
- [x] Sensitive sink/effect identified.
- [x] Existing controls checked against this exact tuple.

Method: focused static trace against the checked-out source. Evidence: Generated eval output -> committed test-results files -> public GitHub clone.

Remaining uncertainty: live end-to-end reproduction was not run during this urgent scan; no repository evidence was found that defeats the source-to-sink path.

#### Dataflow
Generated eval output -> committed test-results files -> public GitHub clone.

#### Reachability
Anyone who can clone the repo can read local path/project metadata.

#### Severity
Final severity is **low**. The impact is calibrated from the concrete local runtime, filesystem, renderer, network, or public-repository effect shown above. Local-first deployment assumptions lower broad internet likelihood, but do not defeat the reachable local API, renderer, or GitHub exposure boundary. Additional live runtime proof would mainly adjust confidence around deployment reach, not the root bug.

#### Remediation
Stop tracking generated test-results, remove or sanitize existing artifacts, and keep only intentional fixture samples if needed.

## Reviewed Surfaces

| Surface | Risk Area | Outcome | Notes |
|---|---|---|---|
| Express API server | command execution/auth boundary | Reported | OH-SEC-001 and OH-SEC-002 cover unauthenticated command execution and trusted-root poisoning. |
| MCP runtime | agent/tool execution | Reported | OH-SEC-003 covers arbitrary custom stdio spawn. |
| Renderer markdown | XSS/template rendering | Reported | OH-SEC-005 covers unsafe string-built markdown and dangerousSetInnerHTML. |
| Swift WKWebView shell | native bridge boundary | Reported | OH-SEC-004 covers renderer-to-native file read and command execution. |
| Browser capture | SSRF/callback fetch | Reported | OH-SEC-006 covers localhost prefix bypass; webFetch public fetch was rejected due to stronger DNS/IP checks. |
| Background agent read tool | path traversal | Reported | OH-SEC-007 covers startsWith sibling-prefix escape. |
| Swift ConfigManager | secret storage | Reported | OH-SEC-008 covers plaintext apiKey persistence. |
| Tracked test outputs | public metadata | Reported | OH-SEC-009 covers local path/model prose leakage. |
| Dependencies | known vulnerable packages | No issue found | npm audit --json and npm audit --omit=dev --json reported zero vulnerabilities. |
| Prompt-injection fixture | tracked fake secret/canary | Rejected | OH_CANARY_SECRET and sk-* strings are intentional test sentinels with verification scripts. |
| Electron preload | native desktop exposure | Rejected | contextIsolation true and nodeIntegration false; exposed methods are folder dialog/platform/snap only. |

## Open Questions And Follow Up
- Fix the server/runtime findings first: `server/index.ts`, `server/mcp.ts`, `server/browserPreview.ts`, `server/browserCapture.ts`, and `server/agentRuntime.ts`.
- Fix renderer/native bridge findings next: `src/components/MarkdownContent.tsx`, `OpenHarnessApp/Sources/OpenHarnessApp/Views/ContentView.swift`, `OpenHarnessApp/Sources/OpenHarnessApp/Bridge/WebBridge.swift`, and `OpenHarnessApp/Sources/OpenHarnessApp/Backend/ConfigManager.swift`.
- Remove or sanitize tracked `test-results/` artifacts before relying on the repository as public-safe.

Final markdown report: `/tmp/codex-security-scans/OpenHarness/606b4a85c4af_20260606T091939Z/report.md`
Final HTML report: `/tmp/codex-security-scans/OpenHarness/606b4a85c4af_20260606T091939Z/report.html`
