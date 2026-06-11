import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runShipReadiness } from '../server/shipReadiness';

const gameReport = runShipReadiness('neon-decade-descent');
assert.equal(gameReport.status, 'pass', gameReport.summary);
assert.equal(gameReport.checks.find((check) => check.id === 'entry-html')?.status, 'pass');
assert.equal(gameReport.checks.find((check) => check.id === 'local-assets')?.status, 'pass');
assert.equal(gameReport.checks.find((check) => check.id === 'javascript-syntax')?.status, 'pass');
assert.equal(gameReport.checks.find((check) => check.id === 'browser-smoke')?.status, 'pass');
assert.match(
  gameReport.checks.find((check) => check.id === 'browser-smoke')?.detail || '',
  /keyboard input/i,
);

const browserSmoke = spawnSync(process.execPath, ['scripts/smoke-standalone-game-browser.mjs', 'neon-decade-descent', '--json'], {
  cwd: process.cwd(),
  encoding: 'utf8',
  timeout: 60_000,
});
assert.equal(browserSmoke.status, 0, `${browserSmoke.stderr}\n${browserSmoke.stdout}`);
const browserSmokeReport = JSON.parse(browserSmoke.stdout);
assert.equal(browserSmokeReport.status, 'pass', 'browser smoke should pass for the shippable game artifact');
assert.equal(
  browserSmokeReport.checks.find((check: any) => check.id === 'keyboard-input')?.status,
  'pass',
  'browser smoke should prove keyboard input/state evidence',
);
assert.ok(
  browserSmokeReport.screenshotPath && existsSync(browserSmokeReport.screenshotPath),
  'browser smoke should write screenshot evidence',
);

const fixtureDir = mkdtempSync(join(tmpdir(), 'openharness-ship-readiness-'));
try {
  mkdirSync(join(fixtureDir, 'broken'), { recursive: true });
  writeFileSync(join(fixtureDir, 'broken', 'index.html'), [
    '<!doctype html>',
    '<html><head><title>Broken</title><meta name="viewport" content="width=device-width"></head>',
    '<body><script src="./missing.js"></script></body></html>',
  ].join('\n'));
  writeFileSync(join(fixtureDir, 'broken', 'game.js'), 'function broken( {');

  const brokenReport = runShipReadiness(join(fixtureDir, 'broken'));
  assert.equal(brokenReport.status, 'fail', 'missing linked assets and syntax errors should block shipping');
  assert.equal(brokenReport.checks.find((check) => check.id === 'local-assets')?.status, 'fail');
  assert.equal(brokenReport.checks.find((check) => check.id === 'javascript-syntax')?.status, 'fail');
  assert.equal(brokenReport.checks.find((check) => check.id === 'browser-smoke')?.status, 'fail');
} finally {
  rmSync(fixtureDir, { recursive: true, force: true });
}

const standaloneFixtureDir = mkdtempSync(join(tmpdir(), 'openharness-standalone-artifact-'));
function runStandaloneVerifier(targetDir: string) {
  return spawnSync(process.execPath, ['scripts/verify-standalone-artifact-fixture.mjs', targetDir], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 30_000,
  });
}

try {
  rmSync(standaloneFixtureDir, { recursive: true, force: true });
  mkdirSync(standaloneFixtureDir, { recursive: true });
  writeFileSync(join(standaloneFixtureDir, 'index.html'), '<!doctype html><title>Keyword Game</title><script src="game.js"></script><link rel="stylesheet" href="styles.css">');
  writeFileSync(join(standaloneFixtureDir, 'styles.css'), 'body { color: cyan; background: black; }');
  writeFileSync(join(standaloneFixtureDir, 'game.js'), 'console.log("loaded");\n');
  writeFileSync(join(standaloneFixtureDir, 'README.md'), [
    '# Keyword Game',
    '1980s roguelike dungeon floor level room grid tile player enemy hazard item collect inventory score hp health turn depth keydown arrow wasd restart.',
    'Tester controls objective expected verify movement restart arcade VHS cassette neon.',
    'This file intentionally contains many words but the JavaScript does not implement the game loop.',
  ].join('\n'));
  const keywordOnly = runStandaloneVerifier(standaloneFixtureDir);
  assert.notEqual(keywordOnly.status, 0, 'keyword-only artifact should not pass standalone verifier');
  assert.match(`${keywordOnly.stderr}${keywordOnly.stdout}`, /JavaScript must wire real player input|JavaScript must own player state/);

  rmSync(standaloneFixtureDir, { recursive: true, force: true });
  mkdirSync(standaloneFixtureDir, { recursive: true });
  writeFileSync(join(standaloneFixtureDir, 'index.html'), [
    '<!doctype html>',
    '<html><head><title>Neon Descent</title><meta name="viewport" content="width=device-width">',
    '<link rel="stylesheet" href="styles.css"></head>',
    '<body><main id="game"><span id="hp">HP 10</span><span id="score">Score 0</span><span id="depth">Depth 1</span></main>',
    '<script src="game.js"></script></body></html>',
  ].join('\n'));
  writeFileSync(join(standaloneFixtureDir, 'styles.css'), 'body { background: #050505; color: #00ffff; display: grid; font-family: monospace; } canvas { border: 1px solid #ff00ff; }');
  writeFileSync(join(standaloneFixtureDir, 'game.js'), [
    'const player = { x: 1, y: 1, hp: 10 };',
    'const enemies = [{ x: 3, y: 2, hp: 2, name: "VHS Sentry" }];',
    'const items = [{ x: 2, y: 2, name: "mixtape powerup" }];',
    'let score = 0;',
    'function render() { document.getElementById("score").textContent = `Score ${score}`; document.getElementById("hp").textContent = `HP ${player.hp}`; }',
    'function restart() { player.x = 1; player.y = 1; player.hp = 10; score = 0; render(); }',
    'document.addEventListener("keydown", (event) => { if (event.key === "ArrowRight" || event.key === "d") player.x += 1; score += 1; render(); });',
    'render();',
  ].join('\n'));
  writeFileSync(join(standaloneFixtureDir, 'README.md'), [
    '# Neon Descent',
    '',
    'Neon Descent is a standalone 1980s roguelike test artifact about an arcade mall dungeon with VHS sentries, mixtape powerups, floppy-disk relics, grid movement, score, HP, depth, and replay.',
    '',
    'Controls: open index.html, use ArrowRight or WASD-style keyboard input to move the player, and use restart to reset a run. The game is direct-open and requires no build step or external package.',
    '',
    'Tester objective: verify that the page loads, visible HP and score appear, keyboard input changes state, enemies and items are represented in code, the neon arcade theme is obvious, and replay behavior is present. Expected result: the artifact is ready for a human to judge balance and readability rather than basic functionality.',
  ].join('\n'));
  const playable = runStandaloneVerifier(standaloneFixtureDir);
  assert.equal(playable.status, 0, `${playable.stderr}\n${playable.stdout}`);
} finally {
  rmSync(standaloneFixtureDir, { recursive: true, force: true });
}

console.log('ship readiness checks passed.');
