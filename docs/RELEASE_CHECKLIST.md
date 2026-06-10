# OpenHarness Release Checklist

Use this checklist before every release, patch release, or milestone handoff that changes behavior.

## 1) Scope and release target

- [ ] Identify the release type (major/minor/patch, app/runtime vs. UI-only).
- [ ] Confirm branch includes only intended changes and is based on current `main`.
- [ ] Confirm runtime impact:
  - [ ] Client/UI-only changes
  - [ ] Server/runtime changes
  - [ ] OpenHarness desktop (`OpenHarnessApp`) changes
  - [ ] Data migration/storage/config schema changes
- [ ] Confirm rollout owner and target version.

## 2) Pre-release environment checks

- [ ] Install/update dependencies if lockfiles changed.
- [ ] Verify local environment can run all required commands from `README.md`/project scripts.
- [ ] Capture baseline from repo status before release:
  - `git status`
  - `git log -1 --oneline`

## 3) Core quality gates (required for every code release)

- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run test:hardening`
- [ ] `npm run smoke:tool-boundaries`
- [ ] `npm run smoke:docker-ui`
- [ ] `npm run smoke:ui-clicks`
- [ ] Targeted checks added by the release milestone are complete (if applicable).

## 4) Additional gating by area changed

- If `server/` or runtime orchestration files changed:
  - [ ] Restart server/runtime during local validation after changes, then verify:
    - API is reachable (`http://127.0.0.1:3001`)
    - App/web UI is reachable (as configured, typically `http://localhost:5173`)
- If `OpenHarnessApp` / native bridge files changed:
  - [ ] `npm run test:webbridge-runtime-regression`
  - [ ] One manual runtime pass using stable installed app artifact (no temporary regenerated `/tmp/*.app` bundles)
- If `electron/`, packaging, or release scripts changed:
  - [ ] `npm run pack`
  - [ ] `npm run dist`
  - [ ] Verify `release/` contains expected installer artifacts.

## 5) Feature and UX sanity

- [ ] Manual smoke path in UI:
  - start new project/session
  - run a direct prompt
  - run at least one `execute` and one `investigate` (or comparable) workflow
  - open a review/patch surface and confirm no obvious regressions
- [ ] Confirm settings, provider, and routing-critical flows still function after release build.
- [ ] If release includes security-related surface changes, run any plan-specific security checks referenced in `docs/security/*`.

## 6) Versioning and artifact capture

- [ ] Update release version in `package.json` (and matching app-facing version text if present).
- [ ] Record release build timestamp and git ref.
- [ ] Verify package outputs:
  - `dist/` for web output
  - `release/` for desktop artifacts
- [ ] If shipping a binary, capture hash/signature artifacts as required by your release destination.

## 7) Notes and handoff

- [ ] Draft release notes summarizing user-visible changes and migration notes.
- [ ] Capture known caveats and follow-ups.
- [ ] Attach test output, checksums, and validation commands to release PR/notes.
- [ ] Confirm post-release rollback path and communication plan.

## 8) Final release signoff

- [ ] Reviewer confirms all required and area-specific checklist items are complete.
- [ ] Release PR/branch is approved.
- [ ] Tag and publish according to release destination process.
