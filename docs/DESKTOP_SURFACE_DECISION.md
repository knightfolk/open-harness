# Desktop Surface Decision

Electron is the canonical OpenHarness desktop shell for V1 releases.

The production desktop path is:

- React/Vite renderer in `src/`
- Express runtime in `server/`
- Electron shell and packaging in `electron/`
- Electron Builder artifacts from the `package.json` `dist:*` scripts

`OpenHarnessApp/` is retained as a Swift/WKWebView native-shell prototype and native-bridge regression fixture. It is not a shipping desktop surface for normal OpenHarness releases, and release artifacts must not be produced from `OpenHarnessApp/` unless a future plan explicitly reactivates the Swift shell.

If `OpenHarnessApp/` changes for research or regression coverage, run `npm run test:webbridge-runtime-regression` and record the result. Those checks do not replace Electron packaging, signing, notarization, or updater validation.
