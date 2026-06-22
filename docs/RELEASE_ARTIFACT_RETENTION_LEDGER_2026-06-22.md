# Release Artifact Retention Ledger

Date: 2026-06-22
Reviewer: Friday
Baseline: `56eb7220` (`Document safe artifact cleanup ledger`)
Status: local retention policy documented; safe unpacked-output cleanup completed

This ledger narrows the `release/` decision from the file/artifact cleanup
ledger. The retention rule is preservation first for packages, updater
metadata, and checksums. Local disk cleanup is allowed only for ignored,
reproducible unpacked Electron Builder output that is not a release package,
not uploaded updater metadata, and not the only proof of a historical release.

## Inventory Summary

All files under `release/` are ignored by git via `.gitignore`.

| Version or path | Local inventory | External preservation | SHA256 coverage | Disposition |
| --- | --- | --- | --- | --- |
| `1.0.0-alpha.update.1` | 13 packages and 7 blockmaps: mac arm64/x64 DMG + zip with blockmaps, Windows arm64/x64/universal installers or zips with installer blockmaps, Linux arm64/x64 tarballs, and Linux arm64/x86_64 AppImages. No unpacked folder specific to this version remains. | GitHub prerelease `v1.0.0-alpha.update.1` exists with 25 uploaded assets: 20 versioned artifacts, 4 updater metadata files, and `SHA256SUMS.txt`. | Local `SHA256SUMS.txt` does not cover update 1 artifacts. | Historical archive. Keep local packages unless a future pass confirms matching remote checksums or another durable archive. |
| `1.0.0-alpha.update.2` | Same package/platform shape as update 1: 13 packages and 7 blockmaps. No unpacked folder specific to this version remains. | GitHub prerelease `v1.0.0-alpha.update.2` exists with 25 uploaded assets. | Local `SHA256SUMS.txt` does not cover update 2 artifacts. | Historical archive. Keep local packages unless a future pass confirms matching remote checksums or another durable archive. |
| `1.0.0-alpha.update.3` | Same package/platform shape as update 1, plus the current updater metadata files: `latest.yml`, `latest-mac.yml`, `latest-linux.yml`, and `latest-linux-arm64.yml`. | GitHub prerelease `v1.0.0-alpha.update.3` exists with 25 uploaded assets. | `SHA256SUMS.txt` names the 20 update 3 artifacts plus 4 updater metadata files, but `shasum -a 256 -c SHA256SUMS.txt` fails against the current local files. The local update 3 file sizes also differ from the published GitHub asset sizes, which indicates the local files were rebuilt after the published release assets. | Current local release-output proof, but checksum-ambiguous. Keep packages, blockmaps, updater metadata, and `SHA256SUMS.txt` until a release-refresh pass either regenerates matching checksums or replaces the local output with verified published assets. |
| `release/mac`, `release/mac-arm64`, `release/linux-unpacked`, `release/linux-arm64-unpacked`, `release/win-unpacked`, `release/win-arm64-unpacked` | Ignored Electron Builder unpacked app folders from the most recent local build; total size was about 2.1 GB. | Not GitHub release assets. Reproducible from source with the packaging workflow. Stable runtime validation should use installed `/Applications/OpenHarness.app`, not these transient folders. | Not covered by `SHA256SUMS.txt`, and not expected to be. | Safe removal candidates. Removed in this pass. |
| `builder-debug.yml`, `builder-effective-config.yaml` | Ignored Electron Builder diagnostics/config output. | Not release assets. Reproducible. | Not covered by `SHA256SUMS.txt`. | Keep for now because tiny and useful for diagnosing the checksum-ambiguous local update 3 output. |

## Retention Policy

- Keep every versioned package and blockmap in `release/` until there is explicit
  evidence that the exact bytes are duplicated, superseded, and preserved
  elsewhere or can be regenerated with the intended checksum record.
- Keep updater metadata (`latest*.yml`) and `SHA256SUMS.txt` with the package set
  they describe, even when the current local package bytes need follow-up.
- Treat update 1 and update 2 as historical archive, not current proof.
- Treat update 3 as current local release output, but do not call it
  checksum-verified until the checksum mismatch is resolved.
- Remove unpacked Electron Builder folders after package/proof preservation is
  documented. They are generated local build output, not release packages.

## Cleanup Performed

Removed only these ignored unpacked generated folders:

- `release/mac/`
- `release/mac-arm64/`
- `release/linux-unpacked/`
- `release/linux-arm64-unpacked/`
- `release/win-unpacked/`
- `release/win-arm64-unpacked/`

No release packages, blockmaps, updater metadata, checksum file, or builder
diagnostic files were deleted.

## Follow-Up

Before deleting any update 1, update 2, or update 3 packages, run a dedicated
release verification pass that compares local SHA256/SHA512 values with a
trusted published manifest or redownloaded GitHub assets. The current local
update 3 package bytes differ from both the preserved `SHA256SUMS.txt` and the
published asset sizes, so package cleanup should remain blocked until that is
resolved.
