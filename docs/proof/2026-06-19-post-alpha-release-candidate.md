# Post-Alpha Release Candidate Proof - 2026-06-19

Status: release candidate ready for post-alpha publishing
Reviewer: Friday
Base revision: `573efa95`
Version: `1.0.0-alpha.update.2`

## Scope

Source of truth: `docs/POST_ALPHA_RELEASE_PLAN_2026-06-19.md`.

This pass completed the Day 1 through Day 10 post-alpha release-candidate work
that did not require provider-backed spend. Provider-backed proof remains
approval-gated and is not claimed by this release candidate.

## Shipped Changes

- Fixed the narrow Environment overlay reservation so phone-width chat remains
  readable while Environment is open.
- Flattened the default shell by lowering global shadows and removing the
  Environment card's heavy floating treatment.
- Added calmer built-in texture defaults, safer opacity, larger Settings texture
  previews, and a "Calm matte" option.
- Replaced ordinary first-launch patch-note modal behavior with a quiet
  release-note banner. Full notes remain available in Settings.
- Marked user-visible Settings sample skills, plugins, and memory entries as
  demo content.
- Added model catalog source freshness metadata, verified-at dates, confidence
  labels, and stale/advisory UI states for model cards and Auto-Router
  candidates.
- Added optional Attention Inbox and Workflows panels for background work and
  safe reusable local workflow templates.
- Reconciled stale docs so Review Changes, Agent detail, and the current layout
  shell are the canonical surfaces.

## Removed Or Reduced

- Removed the blocking modal-first path for ordinary patch notes.
- Reduced default heavy shadows, passive elevation, and floating-card contrast.
- Removed current-target references to superseded `DiffViewer.tsx`,
  `RightPanel.tsx`, and `RunningAgentsStrip.tsx` names. Remaining mentions are
  historical/superseded notes or the source plan's findings.
- Removed ambiguous user-visible mock-data naming from Settings by labeling the
  sample content as demo data.

## Deferred

- Provider-backed routing/model proof: deferred because provider-spend proof is
  approval-gated.
- Server control-plane extraction from `server/index.ts`: deferred because the
  post-alpha plan treats it as a release risk to inventory, not a week-one
  rewrite.
- Broader BrowserPanel preview feedback loop and MCP auth polish: deferred
  follow-up features after the UI/proof blockers stabilized.

## Validation

- `npm run test:premier-no-spend`: passed as part of
  `npm run check:premier-no-spend`.
- `npm run check:premier-no-spend`: passed at `2026-06-19T13:25:07Z`
  during final publish validation.
- `npm run lint`: passed as part of `npm run check:premier-no-spend`.
- `npm run build`: passed as part of `npm run check:premier-no-spend`.
- `npm run test:premier-narrow-layout`: passed during focused Day 1 validation
  and again inside the no-spend suite.
- `npm run test:premier-theme-textures`: passed during focused texture
  validation and again inside the no-spend suite.
- `npm run test:premier-layout-shell`: passed after adding Attention Inbox and
  Workflows.
- `npm run test:premier-model-harness`: passed after adding source freshness UI.
- `npm run test:release-notes`: passed after packaged release-note root fix.
- `npm run test:auto-update-packaging`: passed after artifact generation and
  after adding packaged `CHANGELOG.md` coverage; reran cleanly during final
  publish validation at `2026-06-19T13:25:28Z`.
- `npm run check:premier-closeout-readiness`: passed with `closeoutReady: true`,
  no blocking checks, and live tool-error recovery status `available`; reran
  cleanly during final publish validation at `2026-06-19T13:25:28Z`.
- `APPLE_KEYCHAIN_PROFILE=openharness-notary npm run dist:mac:notarized`:
  passed.

Expected test noise: `scripts/test-execute-proof-hygiene.ts` emits several
`fatal: not a git repository` lines while checking isolated worktree hygiene;
the test completed successfully.

## Runtime And Restart Proof

Server/runtime files changed late in this pass to fix packaged release-note
version resolution. The old OpenHarness processes were stopped, the app was
relaunched, and runtime reachability was verified before rebuilding artifacts.

Live reachability before packaging:

- `http://127.0.0.1:3001/api/config`: HTTP 200
- `http://127.0.0.1:5173/`: HTTP 200
- Listening processes observed:
  - `node` PID `50986` on `127.0.0.1:3001`
  - `node` PID `50985` on `127.0.0.1:5173`

Post-runtime-fix relaunch proof:

- `http://127.0.0.1:3001/api/config`: HTTP 200
- `http://127.0.0.1:5173/`: HTTP 200
- Listening processes observed:
  - `node` PID `89761` on `127.0.0.1:3001`
  - `node` PID `89760` on `127.0.0.1:5173`

Stable installed app validation:

- After notarized packaging completed, the dev OpenHarness/Electron processes
  were stopped for release-runtime validation so the stable installed app could
  own its packaged runtime ports without collision.
- Installed freshly built notarized `release/mac-arm64/OpenHarness.app` to
  `/Applications/OpenHarness.app`.
- Installed bundle version:
  - `CFBundleIdentifier`: `com.openharness.desktop`
  - `CFBundleShortVersionString`: `1.0.0-alpha.update.2`
  - `CFBundleVersion`: `1.0.0-alpha.update.2`
- Installed app processes observed from `/Applications/OpenHarness.app`,
  including the bundled `dist-server/index.js` process.
- Packaged app HTTP proof:
  - `http://127.0.0.1:3001/api/config`: HTTP 200
  - `http://127.0.0.1:3001/`: HTTP 200 and served the packaged
    `dist/index.html` with `index-Cb8fb3Df.js`.
  - `http://127.0.0.1:3001/api/release-notes`: HTTP 200 and returned
    `currentVersion: 1.0.0-alpha.update.2`.
- Packaged renderer DOM proof through `http://127.0.0.1:3001/`:
  - page title: `OpenHarness — Universal AI Harness`
  - loaded script: `./assets/index-Cb8fb3Df.js`
  - loaded stylesheet: `./assets/index-DUO8xmGo.css`
  - `#root`: present
  - `Open settings` button: present
  - `Chat message` input: present
  - body text included the current chat/project shell.
- `5173`: HTTP 000 in packaged mode. This is expected for the stable installed
  app because `electron/main.cjs` loads packaged builds through
  `http://localhost:3001`, while `5173` is the Vite dev server path.
- Native visible-window proof:
  - System Events returned `frontmost: true`, `count of windows: 1`, and window
    title `OpenHarness — Universal AI Harness`.
  - Screenshot `installed-notarized-app-window-visible.png` shows the installed
    app with Environment open and release-note banner version
    `1.0.0-alpha.update.2`.
  - Gatekeeper assessment: `/Applications/OpenHarness.app: accepted`,
    `source=Notarized Developer ID`.

## Browser Proof

Artifact directory:

- `docs/proof/artifacts/2026-06-19-post-alpha-rc/`

Screenshots:

- `desktop-env-closed.png`
- `desktop-env-open.png`
- `mobile-390-env-open.png`
- `mobile-390-env-closed.png`
- `desktop-settings-texture-previews.png`
- `installed-notarized-app-window-visible.png` (local final installed
  notarized app proof with correct release-note version)

Measured desktop Environment-open state:

- viewport: `1422x800`
- chat class: `chat-panel-root has-floating-super`
- chat reservation: `calc(334px + 96px)`
- chat input width: `597.47px`
- Environment card width: `333.99px`

Measured narrow Environment-open state:

- effective viewport: `433x866`
- chat class: `chat-panel-root has-floating-super`
- chat reservation: `12px`
- user message margin-right: `12px`
- chat input width: `372.24px`
- Environment card width: `409.33px`

Measured texture preview state:

- preview tile size: `75.99px x 53.99px`
- visible options included `None`, `Calm matte`, `Soft marble`,
  `Brushed plaster`, `Paper fiber`, `Frosted noise`, `Paper grain`, and
  `Fine grid`.

## Model Metadata Sources

Official documentation checked before release-routing freshness claims:

- OpenAI model docs: `https://developers.openai.com/api/docs/models/all`
- Anthropic model overview:
  `https://platform.claude.com/docs/en/about-claude/models/overview`
- Gemini API models: `https://ai.google.dev/gemini-api/docs/models`
- Mistral model overview: `https://docs.mistral.ai/models/overview`

Model cards now expose official, advisory, stale, and unverified freshness
states before the UI presents them as routing guidance.

## Release Artifact Status

Packaging command:

- `npm run dist:all`
- `APPLE_KEYCHAIN_PROFILE=openharness-notary npm run dist:mac:notarized`

Result: passed.

`release/` contains matching `1.0.0-alpha.update.2` macOS, Windows, Linux
artifacts and updater metadata:

- `latest-mac.yml`
- `latest.yml`
- `latest-linux.yml`
- `latest-linux-arm64.yml`

Artifacts built:

- macOS x64: `.dmg`, `.zip`, and blockmaps
- macOS arm64: `.dmg`, `.zip`, and blockmaps
- Windows x64: NSIS `.exe`, `.zip`, and `.exe.blockmap`
- Windows arm64: NSIS `.exe`, `.zip`, and `.exe.blockmap`
- Windows combined installer: NSIS `.exe` and `.exe.blockmap`
- Linux x64: AppImage and `.tar.gz`
- Linux arm64: AppImage and `.tar.gz`

Checksums:

- `release/SHA256SUMS.txt`
- `shasum -a 256 -c release/SHA256SUMS.txt`: passed for all 20 release
  artifacts during final publish validation.

Packaging notes:

- Windows binaries and installers were signed by Electron Builder.
- macOS app bundles were signed with Developer ID Application and notarized via
  the `openharness-notary` keychain profile.
- `notarize:verify` passed for both `release/mac/OpenHarness.app` and
  `release/mac-arm64/OpenHarness.app`: codesign deep verification, stapled
  ticket validation, and Gatekeeper assessment all passed.
- `release/SHA256SUMS.txt` was regenerated after the notarized mac rebuild.

## Closeout Decision

Current status: no-spend proof, lint, build, artifact packaging, updater
metadata, checksums, packaged HTTP runtime proof, visible installed-app proof,
and macOS notarization proof are clean. This post-alpha release candidate is
ready for publishing.
