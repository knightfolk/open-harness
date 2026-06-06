# OpenHarnessApp WebBridge Runtime Regression Plan

## Purpose

Keep a tiny, reproducible pre-release gate for the Swift/WKWebView native bridge.
This should run before each release that includes `OpenHarnessApp` changes.

## Scope

1. Trusted localhost bridge calls are still allowed and path-gated:
   - `createSession` with `workingDir`
   - `listDirectory`
   - `readFile`
2. Non-trusted `file://` origins still cannot use native bridge or trigger in-app navigation.

## Automated check (run every time)

Run:

```bash
npm run test:webbridge-runtime-regression
```

This script validates the local WebBridge contract by checking the Swift source for:

- origin gate behavior in `WebBridge.isTrustedBridgeOrigin`
- main-frame bridge gate in `userContentController(_:didReceive:)`
- runtime probe debug-only opt-in gating via `OPENHARNESS_WEBBRIDGE_RUNTIME_PROBE=1` or `--webbridge-runtime-probe`
- runtime probe implementation isolation in `Diagnostics/WebBridgeRuntimeDiagnostics.swift`
- runtime trace call sites are wrapped by `WebBridgeRuntimeDiagnostics` helper methods
- trusted action registration/dispatch for `createSession`, `listDirectory`, `readFile`
- path allowlist checks for `createSession` (`workingDir` normalization + workspace registration)
- path allowlist checks for `listDirectory`/`readFile`
- `WKNavigationDelegate` origin/reject behavior for `file://` and untrusted URLs.

The script exits non-zero if any of these invariants drift, so it can be used as a release gate.

## No-launch validation

For normal development passes, do not launch, rebuild, re-sign, or replace `/Applications/OpenHarness.app`.
Use the automated source check above, plus optional source inspection, to confirm the bridge contract without touching the installed app identity.
The embedded runtime probe is debug-only; release builds ignore its environment variable and launch argument.

## Manual runtime confirmation (one operator-in-the-loop pass)

After running the script above, perform one manual app pass only when runtime proof is explicitly approved:

1. Use a stable installed debug app artifact if the embedded runtime probe is needed. Do not rebuild, re-sign, replace, or regenerate temporary `/tmp/*.app` bundles for this check.
2. Launch once with either `OPENHARNESS_WEBBRIDGE_RUNTIME_PROBE=1` or `--webbridge-runtime-probe`.
3. Tail `/tmp/webbridge-runtime-probe-trace.log` or `~/Library/Logs/OpenHarness/webbridge-runtime-probe-trace.log`.
4. Stop after the first complete probe result set. Do not relaunch repeatedly if macOS requests authorization.
5. Confirm dev-mode baseline navigation still lands on `http://localhost:5173` when expected.
6. Open a trusted localhost page and verify:
   - `createSession` with a valid temp workspace registers session root.
   - `listDirectory`/`readFile` return data for a file under that session root.
7. Open any non-trusted local HTML file (for example, `/tmp/webbridge-neg-test.html`).
8. From the trusted app page attempt `window.location.href` navigation to that file URL:
   - app window should not switch into the untrusted renderer context
   - bridge callbacks from that untrusted page should fail with `Bridge access denied` (or no callback if origin isn't `nativeBridge`-eligible).

Any drift against these behaviors means do not ship the runtime without investigation.

## Files tracked by the check

- `OpenHarnessApp/Sources/OpenHarnessApp/App.swift`
- `OpenHarnessApp/Sources/OpenHarnessApp/Bridge/WebBridge.swift`
- `OpenHarnessApp/Sources/OpenHarnessApp/Views/ContentView.swift`
- `OpenHarnessApp/Sources/OpenHarnessApp/Diagnostics/WebBridgeRuntimeDiagnostics.swift`
- `scripts/test-webbridge-runtime-regression.ts`
