#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import electron from 'electron';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const projectDir = resolve(args.find((arg) => !arg.startsWith('--')) || 'neon-decade-descent');
const json = args.includes('--json');
const screenshotsDirArg = args.find((arg) => arg.startsWith('--screenshots-dir='));
const screenshotsDir = screenshotsDirArg ? resolve(screenshotsDirArg.split('=').slice(1).join('=')) : join(projectDir, '.openharness-smoke');

if (!existsSync(projectDir)) {
  console.error(`Project directory does not exist: ${projectDir}`);
  process.exit(1);
}

const tempDir = mkdtempSync(join(tmpdir(), 'openharness-browser-smoke-'));
const runnerPath = join(tempDir, 'electron-smoke-main.cjs');
writeFileSync(runnerPath, `
const { app, BrowserWindow } = require('electron');
const { existsSync, mkdirSync, writeFileSync } = require('fs');
const { join, resolve } = require('path');
const { pathToFileURL } = require('url');

const projectDir = resolve(process.argv[2]);
const screenshotsDir = resolve(process.argv[3]);
const result = {
  projectDir,
  loaded: false,
  title: '',
  consoleErrors: [],
  pageErrors: [],
  checks: [],
  screenshotPath: '',
};

function pass(id, detail, evidence = []) {
  result.checks.push({ id, status: 'pass', detail, evidence });
}

function fail(id, detail, evidence = []) {
  result.checks.push({ id, status: 'fail', detail, evidence });
}

function summarizeDom() {
  const text = document.body ? document.body.innerText || document.body.textContent || '' : '';
  const canvas = document.querySelector('canvas');
  const buttons = [...document.querySelectorAll('button')].map((button) => button.textContent || button.id || button.className).slice(0, 8);
  return {
    title: document.title || '',
    text: text.slice(0, 1000),
    canvas: canvas ? { width: canvas.width, height: canvas.height } : null,
    buttons,
    ids: [...document.querySelectorAll('[id]')].map((element) => element.id).slice(0, 30),
  };
}

function summarizeGameState() {
  const api = window.neonDecadeDescent;
  if (api && typeof api.getState === 'function') {
    try {
      return api.getState();
    } catch {
      return null;
    }
  }
  return null;
}

async function wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function run() {
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-dev-shm-usage');
  await app.whenReady();

  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    show: false,
    webPreferences: {
      offscreen: true,
      sandbox: false,
      contextIsolation: false,
    },
  });

  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) result.consoleErrors.push(message);
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    result.pageErrors.push('render-process-gone: ' + details.reason);
  });
  win.webContents.on('unresponsive', () => {
    result.pageErrors.push('window became unresponsive');
  });

  try {
    const indexPath = join(projectDir, 'index.html');
    if (!existsSync(indexPath)) throw new Error('Missing index.html');
    await win.loadURL(pathToFileURL(indexPath).toString());
    await wait(500);
    result.loaded = true;
    result.title = await win.webContents.executeJavaScript('document.title || ""');
    const before = await win.webContents.executeJavaScript('(' + summarizeDom.toString() + ')()');
    if (before.title) pass('document-title', 'Document title is available.', [before.title]);
    else fail('document-title', 'Document title is missing.');
    if (before.canvas && before.canvas.width > 0 && before.canvas.height > 0) {
      pass('canvas-present', 'Playable canvas is present with non-zero dimensions.', [JSON.stringify(before.canvas)]);
    } else {
      fail('canvas-present', 'No non-zero canvas was found.');
    }
    if (/hp|score|signal|depth|floor|turn|restart|controls/i.test(before.text)) {
      pass('hud-text', 'Page exposes game HUD/control text.', [before.text.slice(0, 240)]);
    } else {
      fail('hud-text', 'Could not find basic HUD or control text in the page.');
    }

    const stateBeforeMove = await win.webContents.executeJavaScript('(' + summarizeGameState.toString() + ')()');
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'D' });
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'D' });
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'S' });
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'S' });
    await wait(300);
    const afterMove = await win.webContents.executeJavaScript('(' + summarizeDom.toString() + ')()');
    const stateAfterMove = await win.webContents.executeJavaScript('(' + summarizeGameState.toString() + ')()');
    const stateChanged = JSON.stringify(stateAfterMove) !== JSON.stringify(stateBeforeMove);
    if (stateChanged || afterMove.text !== before.text || /score\\s+[1-9]|turn\\s+[1-9]|moved/i.test(afterMove.text)) {
      pass('keyboard-input', 'Keyboard input produced game-state or visible HUD changes.', [
        stateChanged ? 'state-api-changed' : 'visible-text-changed',
        afterMove.text.slice(0, 240),
      ]);
    } else {
      fail('keyboard-input', 'Keyboard input did not produce visible game-state evidence.', [afterMove.text.slice(0, 240)]);
    }

    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'R' });
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'R' });
    await wait(250);
    const afterRestart = await win.webContents.executeJavaScript('(' + summarizeDom.toString() + ')()');
    if (/restart|floor|depth|hp|score|signal|turn/i.test(afterRestart.text)) {
      pass('restart-path', 'Restart/replay path appears available after input.', [afterRestart.text.slice(0, 240)]);
    } else {
      fail('restart-path', 'Restart/replay path was not visible after pressing R.', [afterRestart.text.slice(0, 240)]);
    }

    mkdirSync(screenshotsDir, { recursive: true });
    const screenshot = await win.webContents.capturePage();
    const png = screenshot.toPNG();
    result.screenshotPath = join(screenshotsDir, 'browser-smoke.png');
    writeFileSync(result.screenshotPath, png);
    const uniqueBytes = new Set(png).size;
    if (png.length > 1000 && uniqueBytes > 16) pass('screenshot', 'Browser screenshot captured and appears non-empty.', [result.screenshotPath, String(png.length)]);
    else fail('screenshot', 'Browser screenshot looked empty or too small.', [result.screenshotPath, String(png.length)]);

    if (result.consoleErrors.length === 0 && result.pageErrors.length === 0) pass('runtime-errors', 'No console/page errors were captured.');
    else fail('runtime-errors', 'Console or page errors were captured.', [...result.consoleErrors, ...result.pageErrors].slice(0, 8));
  } catch (error) {
    fail('browser-load', error && error.message ? error.message : String(error));
  } finally {
    await win.destroy();
    const failed = result.checks.some((check) => check.status === 'fail');
    console.log(JSON.stringify({ ...result, status: failed ? 'fail' : 'pass' }, null, 2));
    app.exit(failed ? 1 : 0);
  }
}

run();
`);

try {
  const run = spawnSync(electron, [runnerPath, projectDir, screenshotsDir], {
    cwd: resolve(__dirname, '..'),
    encoding: 'utf8',
    timeout: 60_000,
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    },
  });

  const output = `${run.stdout || ''}${run.stderr || ''}`.trim();
  let report;
  try {
    report = JSON.parse(run.stdout || '{}');
  } catch {
    report = {
      status: 'fail',
      projectDir,
      checks: [{ id: 'electron-runner', status: 'fail', detail: output || 'Electron smoke runner produced no JSON.', evidence: [] }],
      screenshotPath: '',
    };
  }

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const status = String(report.status || (run.status === 0 ? 'pass' : 'fail')).toUpperCase();
    console.log(`${status}: Browser game smoke check ${String(status).toLowerCase()}.`);
    console.log(`Project: ${report.projectDir || projectDir}`);
    for (const check of report.checks || []) {
      console.log(`- ${String(check.status || 'fail').toUpperCase()} ${check.id}: ${check.detail}`);
    }
    if (report.screenshotPath) console.log(`Screenshot: ${report.screenshotPath}`);
    if (run.stderr && !json) console.error(run.stderr.trim());
  }

  if (run.error) {
    console.error(run.error.message);
    process.exit(1);
  }
  process.exit(run.status === 0 && report.status === 'pass' ? 0 : 1);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
