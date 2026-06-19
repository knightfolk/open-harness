import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveThemeId, SYSTEM_THEME_ID } from '../src/theme/builtins';

const config = readFileSync('server/config.ts', 'utf-8');
const app = readFileSync('src/App.tsx', 'utf-8');
const onboarding = readFileSync('src/components/OnboardingWizard.tsx', 'utf-8');
const settings = readFileSync('src/components/SettingsModal.tsx', 'utf-8');

assert.equal(SYSTEM_THEME_ID, 'system');
assert.equal(resolveThemeId('not-a-theme'), 'midnight');
assert.equal(resolveThemeId('system'), 'midnight');
assert.ok(config.includes("activeTheme: 'system'"), 'default config should use system appearance');
assert.ok(app.includes('applyTheme(SYSTEM_THEME_ID)'), 'app should apply system theme on startup');
assert.ok(app.includes("api.updateConfig({ onboardingStep: 0 })"), 'rerun wizard should start from the beginning');
assert.ok(onboarding.includes('OpenHarness follows your system appearance by default'), 'wizard should explain system default');
assert.ok(onboarding.includes('System appearance'), 'wizard review should label system appearance');
assert.ok(settings.includes("label: 'Setup Wizard'"), 'settings nav should expose setup wizard');

console.log('system theme default checks passed');
