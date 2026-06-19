#!/usr/bin/env node

import { execFile, spawn } from 'child_process';
import { createRequire } from 'module';
import http from 'http';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const require = createRequire(import.meta.url);
const { getRuntimeConfig } = require('../shared/runtimeConfig.cjs');

const runtimeConfig = getRuntimeConfig(process.env);
const SERVER_PORT = runtimeConfig.serverPort;
const VITE_PORT = runtimeConfig.vitePort;

function checkPort(port) {
  return new Promise(resolve => {
    const req = http.get(`http://127.0.0.1:${port}/`, res => { res.resume(); resolve(true); });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => { req.destroy(); resolve(false); });
  });
}

function runQuiet(command, args) {
  return new Promise(resolve => {
    execFile(command, args, { cwd: root }, () => resolve());
  });
}

async function stopExistingDesktopShell() {
  if (process.platform !== 'darwin') return;
  await runQuiet('osascript', ['-e', 'tell application "OpenHarness" to quit']);
  await runQuiet('pkill', ['-f', `${root}.*node_modules/.bin/electron`]);
  await runQuiet('pkill', ['-f', `${root}.*node_modules/electron`]);
}

async function waitForPort(port, label, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await checkPort(port)) {
      console.log(`✓ ${label} ready on port ${port}`);
      return true;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  console.error(`✗ ${label} not ready after ${timeout}ms`);
  return false;
}

const serverAlreadyRunning = await checkPort(SERVER_PORT);
const viteAlreadyRunning = await checkPort(VITE_PORT);

if (serverAlreadyRunning && viteAlreadyRunning) {
  console.log(`OpenHarness already appears to be running on ports ${SERVER_PORT} and ${VITE_PORT}; not launching duplicate processes.`);
  process.exit(0);
}

if (serverAlreadyRunning || viteAlreadyRunning) {
  const occupied = [
    serverAlreadyRunning ? SERVER_PORT : null,
    viteAlreadyRunning ? VITE_PORT : null,
  ].filter(Boolean).join(', ');
  console.error(`OpenHarness cannot start cleanly because port(s) ${occupied} are already in use. Stop the stale process and run npm run start again.`);
  process.exit(1);
}

// Start server
const server = spawn('npx', ['tsx', 'server/index.ts'], {
  cwd: root,
  stdio: 'pipe',
  env: {
    ...process.env,
    PORT: String(SERVER_PORT),
    OPENHARNESS_SERVER_PORT: String(SERVER_PORT),
    OPENHARNESS_VITE_PORT: String(VITE_PORT),
  },
});
server.stdout.on('data', d => process.stdout.write('[server] ' + d));
server.stderr.on('data', d => process.stderr.write('[server:err] ' + d));

// Start Vite
const vite = spawn('npx', ['vite', '--port', String(VITE_PORT), '--host', '127.0.0.1', '--strictPort'], {
  cwd: root,
  stdio: 'pipe',
  env: {
    ...process.env,
    OPENHARNESS_SERVER_PORT: String(SERVER_PORT),
    OPENHARNESS_VITE_PORT: String(VITE_PORT),
    VITE_OPENHARNESS_SERVER_PORT: String(SERVER_PORT),
    VITE_OPENHARNESS_VITE_PORT: String(VITE_PORT),
  },
});
vite.stdout.on('data', d => process.stdout.write('[vite] ' + d));
vite.stderr.on('data', d => process.stderr.write('[vite] ' + d));

// Wait for both
await waitForPort(SERVER_PORT, 'Express');
await waitForPort(VITE_PORT, 'Vite');

// Launch Electron
console.log('Launching Electron...');
await stopExistingDesktopShell();
const electron = spawn('npx', ['electron', '.'], {
  cwd: root,
  stdio: 'inherit',
});

electron.on('exit', code => {
  console.log(`Electron exited (${code})`);
  server.kill();
  vite.kill();
  process.exit(code || 0);
});

function stopChildrenAndExit() {
  electron.kill();
  server.kill();
  vite.kill();
  process.exit(0);
}

process.on('SIGINT', stopChildrenAndExit);
process.on('SIGTERM', stopChildrenAndExit);
