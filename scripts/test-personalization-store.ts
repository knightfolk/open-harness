import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const tempDir = mkdtempSync(join(tmpdir(), 'openharness-personalization-'));
process.env.OPENHARNESS_PERSONALIZATION_DIR = tempDir;
process.env.OPENHARNESS_PERSONALIZATION_TEST_KEY = 'test-only-personalization-key';

const personalization = await import('../server/personalization');

const plaintextPreference = 'Prefers concise implementation-first answers with validation proof';
const saved = personalization.savePersonalizationProfile({
  enabled: true,
  compactSummary: plaintextPreference,
  responseStyle: 'Short, direct, proof-backed.',
  likes: ['runtime verification', 'exact file references'],
  dislikes: ['vague done claims'],
  workflowStyle: 'Implement, validate, then summarize.',
  promptingStyle: 'Turn loose goals into criteria.',
  modelPreferences: 'Use fast models for summaries and strong coders for implementation.',
  toolPreferences: 'Use targeted checks before broad scans.',
  projectPreferences: 'Keep OpenHarness changes surgical.',
  neverDo: ['store raw prompts', 'store secrets'],
});

assert.equal(saved.enabled, true, 'saved profile should preserve enabled flag');
assert.equal(saved.compactSummary, plaintextPreference, 'saved profile should preserve compact summary after decrypt');

const profilePath = personalization.getPersonalizationProfilePath();
const encryptedFile = readFileSync(profilePath, 'utf-8');
assert.match(encryptedFile, /"ciphertext"/, 'profile file should be an encrypted envelope');
assert.doesNotMatch(encryptedFile, new RegExp(plaintextPreference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'encrypted file should not contain plaintext compact summary');
assert.doesNotMatch(encryptedFile, /runtime verification|raw prompts|OpenHarness changes surgical/, 'encrypted file should not contain plaintext list values');

const loaded = personalization.loadPersonalizationProfile();
assert.deepEqual(loaded.likes, ['runtime verification', 'exact file references'], 'loaded profile should decrypt list fields');
assert.deepEqual(loaded.neverDo, ['store raw prompts', 'store secrets'], 'loaded profile should decrypt never-do fields');

const promptSummary = personalization.formatPersonalizationForPrompt();
assert.match(promptSummary, /User personalization profile:/, 'enabled profile should format prompt section');
assert.match(promptSummary, /validation proof/, 'enabled profile should include compact preference summary');
assert.match(promptSummary, /Do not treat them as task facts/, 'prompt section should limit personalization scope');

personalization.savePersonalizationProfile({ enabled: false });
assert.equal(personalization.formatPersonalizationForPrompt(), '', 'disabled profile should not be injected into prompts');

personalization.deletePersonalizationProfile();
assert.equal(personalization.loadPersonalizationProfile().enabled, false, 'deleted profile should return empty disabled profile');

const fallbackDir = mkdtempSync(join(tmpdir(), 'openharness-personalization-fallback-'));
const fallbackEnv = {
  ...process.env,
  OPENHARNESS_PERSONALIZATION_DIR: fallbackDir,
  OPENHARNESS_PERSONALIZATION_DISABLE_KEYCHAIN: '1',
  OPENHARNESS_PERSONALIZATION_TEST_KEY: '',
  OPENHARNESS_PERSONALIZATION_KEY: '',
};
execFileSync('npx', ['tsx', '-e', `
  (async () => {
    const personalization = await import('./server/personalization.ts');
    personalization.savePersonalizationProfile({
      enabled: true,
      compactSummary: 'Fallback profile survives restart',
      likes: ['fallback encryption']
    });
  })();
`], { cwd: process.cwd(), env: fallbackEnv, stdio: 'pipe' });
const fallbackOutput = execFileSync('npx', ['tsx', '-e', `
  (async () => {
    const personalization = await import('./server/personalization.ts');
    const profile = personalization.loadPersonalizationProfile();
    console.log(JSON.stringify({ profile, error: personalization.getPersonalizationLoadError() }));
  })();
`], { cwd: process.cwd(), env: fallbackEnv, encoding: 'utf-8' });
const fallbackLoaded = JSON.parse(fallbackOutput);
assert.equal(fallbackLoaded.error, null, 'fallback profile should decrypt without a load error in a later process');
assert.equal(fallbackLoaded.profile.compactSummary, 'Fallback profile survives restart', 'fallback key should be stable across processes');
assert.deepEqual(fallbackLoaded.profile.likes, ['fallback encryption'], 'fallback process should decrypt list fields');

rmSync(tempDir, { recursive: true, force: true });
rmSync(fallbackDir, { recursive: true, force: true });

console.log('Personalization store tests passed.');
