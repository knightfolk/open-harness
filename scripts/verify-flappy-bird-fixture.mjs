#!/usr/bin/env node
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const fixtureDir = join(root, 'test-fixtures', 'flappy-bird-eval');
const appPath = join(fixtureDir, 'src', 'App.tsx');
const stylesPath = join(fixtureDir, 'src', 'styles.css');
const viteConfigPath = join(fixtureDir, 'vite.config.ts');
const viteBin = join(root, 'node_modules', '.bin', 'vite');

const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function readRequired(path) {
  assert(existsSync(path), `Missing required file: ${path}`);
  return existsSync(path) ? readFileSync(path, 'utf-8') : '';
}

const app = readRequired(appPath);
const styles = readRequired(stylesPath);
readRequired(join(fixtureDir, 'index.html'));
readRequired(join(fixtureDir, 'package.json'));
readRequired(join(fixtureDir, 'src', 'main.tsx'));
readRequired(viteConfigPath);

const appLower = app.toLowerCase();
const stylesLower = styles.toLowerCase();
const combinedLower = `${appLower}\n${stylesLower}`;

const requiredFeatureChecks = [
  [/gravity|gravitation/, 'Uses a named gravity concept'],
  [/velocity|velY|verticalVelocity/i, 'Tracks vertical velocity'],
  [/flap|jump/, 'Implements flap/jump behavior'],
  [/pipe|obstacle/, 'Implements pipe or obstacle behavior'],
  [/collision|intersect|hit/, 'Implements collision detection'],
  [/score/, 'Tracks and displays score'],
  [/gameover|game over|status.*over/i, 'Handles game-over state'],
  [/restart|resetgame|reset game/i, 'Implements restart/reset behavior'],
  [/requestAnimationFrame|setInterval/, 'Runs a continuous game loop'],
  [/keydown|keyup|keyboard|space/i, 'Supports keyboard input'],
  [/pointer|touch|click|mousedown/i, 'Supports pointer/touch/click input'],
];

for (const [pattern, message] of requiredFeatureChecks) {
  assert(pattern.test(app), message);
}

assert(/<button|role=["']button|onClick=/.test(app), 'Includes clickable controls');
assert(/start|play/.test(appLower), 'Includes start/play affordance text or state');
assert(/restart|try again|play again/.test(appLower), 'Includes restart/play-again affordance text or state');
assert(/aria-|ariaLabel|aria-label|title=/.test(app), 'Adds basic accessibility labels or titles for controls');
assert(!/todo|lorem ipsum|placeholder/.test(combinedLower), 'Does not leave TODO/placeholder/debug text in the UI');

assert(styles.length > 800, 'Provides non-trivial styling for visual polish');
assert(/@media|max-width|min-height|clamp\(/.test(styles), 'Includes responsive styling');
assert(/button/.test(stylesLower), 'Styles clickable controls');
assert(/score|hud|panel|overlay|game/.test(stylesLower), 'Styles game UI sections');
assert(/border-radius|box-shadow|gradient|transition/.test(stylesLower), 'Uses polished visual treatments');
assert(!/font-size:\s*(?:[4-8]px|[3-8]rem)/.test(stylesLower), 'Avoids obviously unusable text sizing');

if (existsSync(viteBin)) {
  const build = spawnSync(viteBin, ['build', '--config', viteConfigPath], {
    cwd: root,
    encoding: 'utf-8',
    timeout: 60_000,
  });
  assert(build.status === 0, `Vite production build failed:\n${build.stdout}\n${build.stderr}`.trim());
} else {
  failures.push(`Missing Vite binary at ${viteBin}`);
}

if (failures.length > 0) {
  console.error('Flappy Bird fixture verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Flappy Bird fixture verification passed.');
