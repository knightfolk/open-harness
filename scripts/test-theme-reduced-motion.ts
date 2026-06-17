import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/styles/components.css', 'utf-8');
const mediaMatch = css.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/);

assert.ok(mediaMatch, 'components.css should define a reduced-motion media query');

const reducedMotionBlock = mediaMatch[1];

for (const expected of [
  '.clicky-button',
  '.typing-dot',
  '.message',
  '.review-flyout-overlay',
  '.review-changes-flyout',
  '.settings-modal-overlay',
  '.settings-modal',
  '.agent-focus-pulse-dot',
  '.session-running-dot',
  '.active-work-strip-dot.in_progress',
  '.todo-step-circle.in-progress',
  '.env-agents-spin',
  '.spin',
  'animation: none !important',
]) {
  assert.ok(
    reducedMotionBlock.includes(expected),
    `reduced-motion media query should include ${expected}`
  );
}

console.log('Theme reduced-motion checks passed.');
