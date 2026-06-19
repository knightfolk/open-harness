# macOS Notarization

OpenHarness uses Electron Builder for macOS signing and notarization. The app is signed with a Developer ID Application certificate, hardened runtime is enabled, and Electron Builder notarizes automatically when notarization credentials are present in the environment.

## Recommended credential setup

Use an App Store Connect API key for repeatable local and CI builds:

1. Open Apple's API key setup page: https://developer.apple.com/documentation/appstoreconnectapi/creating-api-keys-for-app-store-connect-api
2. In App Store Connect, go to Users and Access, then Integrations.
3. Create an App Store Connect API key and download the `.p8` file.
4. Store the `.p8` file outside this repository.
5. Export the credential variables before building:

```bash
export APPLE_API_KEY="/absolute/path/AuthKey_XXXXXXXXXX.p8"
export APPLE_API_KEY_ID="XXXXXXXXXX"
export APPLE_API_ISSUER="00000000-0000-0000-0000-000000000000"
```

Then run:

```bash
npm run dist:mac:notarized
```

## Local keychain alternative

For a single local machine, you can store credentials in the macOS keychain instead:

```bash
xcrun notarytool store-credentials openharness-notary \
  --apple-id "you@example.com" \
  --team-id "5P2LWPPWRN" \
  --password "app-specific-password"

export APPLE_KEYCHAIN_PROFILE="openharness-notary"
npm run dist:mac:notarized
```

Apple's app-specific password page is here: https://support.apple.com/en-us/102654

On Kevin's local machine, this profile is already stored as `openharness-notary`.
Use:

```bash
npm run dist:mac:notarized:local
```

## Verification

The notarized build command runs these checks after packaging:

```bash
npm run notarize:check
npm run notarize:verify
```

`notarize:verify` checks the built app bundles with `codesign`, `xcrun stapler validate`, and `spctl`.

Expected successful Gatekeeper output should not include `Unnotarized Developer ID`.
