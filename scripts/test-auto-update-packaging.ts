import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf-8')) as {
  dependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  build?: {
    publish?: Array<Record<string, string>>;
    mac?: { target?: string[] };
    win?: { target?: string[] };
    linux?: { target?: string[] };
  };
};
const electronMain = readFileSync('electron/main.cjs', 'utf-8');
const electronPreload = readFileSync('electron/preload.cjs', 'utf-8');
const releaseChecklist = readFileSync('docs/RELEASE_CHECKLIST.md', 'utf-8');

assert.ok(
  pkg.dependencies?.['electron-updater'],
  'electron-updater must be a runtime dependency because electron/main.cjs requires it in packaged builds',
);

assert.deepEqual(
  pkg.build?.publish,
  [{ provider: 'github', owner: 'knightfolk', repo: 'open-harness' }],
  'electron-builder publish metadata should target the OpenHarness GitHub releases feed',
);

assert.ok(
  pkg.build?.mac?.target?.includes('zip'),
  'macOS builds must include a zip target so electron-updater can publish latest-mac.yml metadata',
);
assert.ok(
  pkg.build?.win?.target?.includes('nsis'),
  'Windows builds must include an NSIS installer target for electron-updater support',
);
assert.ok(
  pkg.build?.linux?.target?.includes('AppImage'),
  'Linux builds must include AppImage for electron-updater support',
);
assert.ok(
  pkg.scripts?.['dist:win']?.includes('--win nsis zip'),
  'dist:win should build both NSIS and zip Windows artifacts',
);
assert.ok(
  pkg.scripts?.['dist:all']?.includes('--win nsis zip'),
  'dist:all should build both NSIS and zip Windows artifacts',
);

for (const expected of [
  "const { autoUpdater } = require('electron-updater')",
  'autoUpdater.autoDownload = false',
  'autoUpdater.autoInstallOnAppQuit = true',
  'autoUpdater.allowPrerelease = true',
  'autoUpdater.setFeedURL',
  "provider: 'github'",
  "owner: 'knightfolk'",
  "repo: 'open-harness'",
  "autoUpdater.on('checking-for-update'",
  "autoUpdater.on('update-available'",
  "autoUpdater.on('download-progress'",
  "autoUpdater.on('update-downloaded'",
  "autoUpdater.on('error'",
  "ipcMain.handle('check-for-updates'",
  "ipcMain.handle('install-update'",
  'Check for Updates...',
  'checkForUpdates(false)',
  'Updates are checked only in packaged builds.',
]) {
  assert.ok(electronMain.includes(expected), `electron/main.cjs should preserve updater wiring: ${expected}`);
}

for (const expected of [
  'onUpdateStatus',
  'checkForUpdates',
  'installUpdate',
  "ipcRenderer.on('update-status'",
]) {
  assert.ok(electronPreload.includes(expected), `electron/preload.cjs should expose updater bridge: ${expected}`);
}

for (const expected of [
  'Auto-update release checks',
  'latest-mac.yml',
  'latest.yml',
  'latest-linux.yml',
  'Check for Updates',
  'stable installed app artifact',
]) {
  assert.ok(releaseChecklist.includes(expected), `release checklist should preserve auto-update release guidance: ${expected}`);
}

console.log('Auto-update packaging checks passed.');
