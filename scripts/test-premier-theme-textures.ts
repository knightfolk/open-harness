import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const themeTokens = readFileSync('src/theme/themeTokens.ts', 'utf-8');
const builtins = readFileSync('src/theme/builtins.ts', 'utf-8');
const manifest = readFileSync('src/theme/themePluginManifest.ts', 'utf-8');
const schema = readFileSync('docs/theme-plugin.schema.json', 'utf-8');
const globalCss = readFileSync('src/styles/global.css', 'utf-8');
const css = readFileSync('src/styles/components.css', 'utf-8');
const settings = readFileSync('src/components/SettingsModal.tsx', 'utf-8');

for (const expected of [
  "export type ThemeTextureRecipe =",
  "'none'",
  "'paper-grain'",
  "'fine-grid'",
  "'blueprint-grid'",
  "'low-noise-matte'",
  "'soft-glass'",
  "'terminal-scanline'",
  'textureOpacity?: number',
  'reducedTransparencyFallback?:',
]) {
  assert.ok(
    themeTokens.includes(expected),
    `Theme tokens should preserve bounded texture recipe and fallback fields: ${expected}`,
  );
}

for (const expected of [
  "textureRecipe: 'none' as const",
  'textureOpacity: 0',
  "textureRecipe: 'low-noise-matte'",
  "textureRecipe: 'paper-grain'",
  "'--theme-texture-recipe': theme.tokens.effects?.textureRecipe || DEFAULT_EFFECTS.textureRecipe",
  "'--theme-texture-opacity': String(theme.tokens.effects?.textureOpacity ?? DEFAULT_EFFECTS.textureOpacity)",
  "'--theme-reduced-transparency-surface': theme.tokens.effects?.reducedTransparencyFallback?.surfaceColor",
  "document.documentElement.setAttribute('data-theme-texture-recipe'",
]) {
  assert.ok(
    builtins.includes(expected),
    `Built-in themes should expose texture CSS vars and safe defaults: ${expected}`,
  );
}

for (const expected of [
  "const TEXTURE_RECIPE_VALUES = ['none', 'paper-grain', 'fine-grid', 'blueprint-grid', 'low-noise-matte', 'soft-glass', 'terminal-scanline'] as const",
  'if (key === \'textureRecipe\')',
  'if (!isTextureRecipe(value))',
  'ensureNonNegativeNumber(value, `${path}.effects.textureOpacity`, 0, 0.18, result)',
]) {
  assert.ok(
    manifest.includes(expected),
    `Theme manifest validator should reject unknown recipes and over-strong opacity: ${expected}`,
  );
}

for (const expected of [
  '"textureRecipe"',
  '"enum": ["none", "paper-grain", "fine-grid", "blueprint-grid", "low-noise-matte", "soft-glass", "terminal-scanline"]',
  '"textureOpacity": { "type": "number", "minimum": 0, "maximum": 0.18 }',
  '"reducedTransparencyFallback"',
  '"kind": { "type": "string", "enum": ["preview", "background", "texture"] }',
]) {
  assert.ok(
    schema.includes(expected),
    `Theme plugin schema should preserve texture recipe and opacity limits: ${expected}`,
  );
}

for (const expected of [
  '--theme-texture-recipe: none;',
  '--theme-texture-opacity: 0;',
  'Default theme variables are now sourced from the runtime theme registry',
]) {
  assert.ok(
    globalCss.includes(expected),
    `Global startup CSS should default to no texture before theme hydration: ${expected}`,
  );
}

for (const expected of [
  '.app-layout::before',
  'pointer-events: none',
  'opacity: var(--theme-texture-opacity, 0)',
  ':root[data-theme-texture-recipe="paper-grain"] .app-layout::before',
  ':root[data-theme-texture-recipe="fine-grid"] .app-layout::before',
  ':root[data-theme-texture-recipe="blueprint-grid"] .app-layout::before',
  ':root[data-theme-texture-recipe="low-noise-matte"] .app-layout::before',
  ':root[data-theme-texture-recipe="soft-glass"] .app-layout::before',
  ':root[data-theme-texture-recipe="terminal-scanline"] .app-layout::before',
  '@media (prefers-reduced-transparency: reduce)',
  '--theme-texture-opacity: 0',
  '--theme-backdrop-blur: 0px',
  'backdrop-filter: none',
]) {
  assert.ok(
    css.includes(expected),
    `Theme texture CSS should stay shell-only and disable texture/blur for reduced transparency: ${expected}`,
  );
}

for (const expected of [
  'function textureLabel(recipe?: string, opacity?: number): string',
  'Texture: none',
  'Texture opacity',
  'const effectiveTextureOpacity = textureOpacityOverride ?? baseTextureOpacity',
  'const effectiveTexturePercent = Math.round(effectiveTextureOpacity * 100)',
  'min={0}',
  'max={18}',
  'step={1}',
  'aria-label="Theme texture opacity"',
  'aria-valuetext={`${effectiveTexturePercent}% shell texture opacity`}',
  'aria-describedby={textureGuidanceId}',
  "const textureGuidanceId = 'theme-texture-opacity-guidance'",
  '<div id={textureGuidanceId}',
  'Textures are shell-only. When reduced transparency is requested, textures and blur are disabled and glass surfaces use each theme\\'s solid fallback colors.',
]) {
  assert.ok(
    settings.includes(expected),
    `Settings should preserve shell texture intensity controls and accessibility guidance: ${expected}`,
  );
}

console.log('Premier theme-texture checks passed.');
