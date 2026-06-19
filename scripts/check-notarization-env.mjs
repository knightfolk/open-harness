import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const appStoreConnectApiKeysUrl =
  'https://developer.apple.com/documentation/appstoreconnectapi/creating-api-keys-for-app-store-connect-api';
const appSpecificPasswordUrl = 'https://support.apple.com/en-us/102654';

function run(command, args) {
  return spawnSync(command, args, { encoding: 'utf8' });
}

function hasCommand(command, args = ['--version']) {
  const result = run(command, args);
  return result.status === 0;
}

function hasAll(names) {
  return names.every((name) => Boolean(process.env[name]));
}

function mask(name) {
  return process.env[name] ? 'set' : 'missing';
}

const failures = [];

if (!hasCommand('xcrun', ['--find', 'notarytool'])) {
  failures.push('Xcode command line tools with notarytool are not available.');
}

const identities = run('security', ['find-identity', '-v', '-p', 'codesigning']);
if (identities.status !== 0 || !identities.stdout.includes('Developer ID Application')) {
  failures.push('No Developer ID Application signing identity was found in the keychain.');
}

const apiKeyVars = ['APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER'];
const passwordVars = ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID'];
const keychainVars = ['APPLE_KEYCHAIN_PROFILE'];

const hasApiKeyAuth = hasAll(apiKeyVars);
const hasPasswordAuth = hasAll(passwordVars);
const hasKeychainAuth = hasAll(keychainVars);

if (process.env.APPLE_API_KEY && !existsSync(process.env.APPLE_API_KEY)) {
  failures.push(`APPLE_API_KEY points to a file that does not exist: ${process.env.APPLE_API_KEY}`);
}

const partialApiKey = apiKeyVars.some((name) => process.env[name]) && !hasApiKeyAuth;
const partialPassword = passwordVars.some((name) => process.env[name]) && !hasPasswordAuth;

if (partialApiKey) {
  failures.push(`Incomplete App Store Connect API key auth: ${apiKeyVars.map((name) => `${name}=${mask(name)}`).join(', ')}`);
}

if (partialPassword) {
  failures.push(`Incomplete Apple ID app-specific password auth: ${passwordVars.map((name) => `${name}=${mask(name)}`).join(', ')}`);
}

if (!hasApiKeyAuth && !hasPasswordAuth && !hasKeychainAuth) {
  failures.push('No notarization credentials found. Configure API key auth, app-specific password auth, or a notarytool keychain profile.');
}

console.log('OpenHarness macOS notarization preflight');
console.log('');
console.log('Credential options:');
console.log(`- App Store Connect API key: ${hasApiKeyAuth ? 'ready' : 'not ready'}`);
console.log(`- Apple ID app-specific password: ${hasPasswordAuth ? 'ready' : 'not ready'}`);
console.log(`- notarytool keychain profile: ${hasKeychainAuth ? 'ready' : 'not ready'}`);
console.log('');
console.log(`Create an App Store Connect API key: ${appStoreConnectApiKeysUrl}`);
console.log(`Create an app-specific password: ${appSpecificPasswordUrl}`);

if (failures.length > 0) {
  console.error('');
  console.error('Notarization is not ready yet:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('');
console.log('Notarization environment looks ready.');
