import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/styles/components.css', 'utf-8');
const mediaMatch = css.match(/@media \(prefers-reduced-transparency: reduce\) \{([\s\S]*?)\n\}/);

assert.ok(mediaMatch, 'components.css should define a reduced-transparency media query');

const reducedTransparencyBlock = mediaMatch[1];

for (const expected of [
  '--theme-texture-opacity: 0',
  '--theme-backdrop-blur: 0px',
  '--theme-surface-opacity: 1',
  '.app-layout::before',
  '.settings-modal',
  '.settings-modal-overlay',
  '.review-changes-flyout',
  '.review-flyout-overlay',
  'backdrop-filter: none',
  'var(--theme-reduced-transparency-surface',
  'var(--theme-reduced-transparency-border',
  'var(--theme-reduced-transparency-shadow',
]) {
  assert.ok(
    reducedTransparencyBlock.includes(expected),
    `reduced-transparency media query should include ${expected}`
  );
}

console.log('Theme reduced-transparency checks passed.');
