import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf-8')) as { scripts: Record<string, string> };
const kickoff = readFileSync('docs/PREMIER_HARNESS_KICKOFF.md', 'utf-8');
const checklist = readFileSync('docs/PREMIER_HARNESS_PROOF_CHECKLIST.md', 'utf-8');
const proof = readFileSync('docs/proof/2026-06-16-premier-harness-closeout.md', 'utf-8');
const nextSession = readFileSync('NEXT_SESSION.md', 'utf-8');
const startScript = readFileSync('scripts/start.mjs', 'utf-8');
const electronMain = readFileSync('electron/main.cjs', 'utf-8');

assert.ok(
  pkg.scripts['test:premier-no-spend']?.includes('npm run test:premier-restart-scope'),
  'Premier no-spend bundle should include the restart-scope guard',
);

for (const expected of [
  'Client-only changes: do not restart the server. A browser refresh is enough.',
  'Docs-only changes: do not restart anything.',
  'Server/runtime changes: kill existing OpenHarness server/app processes,',
  'server on `3001`',
  'Vite UI on `5173`',
  '`/api/config`',
  'Runtime relaunch does not leave duplicate OpenHarness/Electron windows.',
]) {
  assert.ok(
    kickoff.includes(expected),
    `Kickoff should preserve restart-scope rule: ${expected}`,
  );
}

for (const expected of [
  'stopExistingDesktopShell',
  'stopChildrenAndExit',
  'tell application "OpenHarness" to quit',
  'node_modules/.bin/electron',
  "process.on('SIGTERM', stopChildrenAndExit)",
]) {
  assert.ok(
    startScript.includes(expected),
    `Start script should prevent duplicate Electron shells before launch: ${expected}`,
  );
}

for (const expected of [
  'app.requestSingleInstanceLock()',
  "app.on('second-instance'",
  'mainWindow.focus()',
]) {
  assert.ok(
    electronMain.includes(expected),
    `Electron main process should enforce a single OpenHarness instance: ${expected}`,
  );
}

for (const expected of [
  'Server/runtime changes have been relaunched and reachability verified.',
  'Duplicate Electron/process-shape check:',
  'Runtime Scenario Proof',
  'Final Gates',
  'Direct evidence is required for closeout',
]) {
  assert.ok(
    checklist.includes(expected),
    `Proof checklist should preserve restart/reachability proof boundary: ${expected}`,
  );
}

for (const expected of [
  'Restart proof after server prompt-strategy provenance metadata changes',
  'confirmed `http://127.0.0.1:3001/api/config` responded',
  'confirmed `http://127.0.0.1:5173/` returned HTTP 200',
  'process shape showed one OpenHarness Electron main process plus normal helper processes',
  'No server/runtime restart was required',
]) {
  assert.ok(
    proof.includes(expected),
    `Closeout proof should preserve restart/no-restart evidence language: ${expected}`,
  );
}

for (const expected of [
  'server/runtime changes',
  'relaunch OpenHarness and verify the app is reachable',
  'Final closeout gates need approval before running local validation.',
]) {
  assert.ok(
    nextSession.includes(expected),
    `NEXT_SESSION should preserve restart/final-gate handoff guard: ${expected}`,
  );
}

console.log('Premier restart-scope checks passed.');
