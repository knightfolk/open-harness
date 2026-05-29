#!/usr/bin/env node

import { spawn } from 'child_process';
import http from 'http';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const SERVER_PORT = 3001;
const VITE_PORT = 5173;

function checkPort(port) {
  return new Promise(resolve => {
    const req = http.get(`http://127.0.0.1:${port}/`, res => { res.resume(); resolve(true); });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => { req.destroy(); resolve(false); });
  });
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

// Start server
const server = spawn('npx', ['tsx', 'server/index.ts'], {
  cwd: root,
  stdio: 'pipe',
  env: { ...process.env, PORT: String(SERVER_PORT) },
});
server.stdout.on('data', d => process.stdout.write('[server] ' + d));
server.stderr.on('data', d => process.stderr.write('[server:err] ' + d));

// Start Vite
const vite = spawn('npx', ['vite', '--port', String(VITE_PORT), '--host'], {
  cwd: root,
  stdio: 'pipe',
  env: { ...process.env },
});
vite.stdout.on('data', d => process.stdout.write('[vite] ' + d));
vite.stderr.on('data', d => process.stderr.write('[vite] ' + d));

// Wait for both
await waitForPort(SERVER_PORT, 'Express');
await waitForPort(VITE_PORT, 'Vite');

// Launch Electron
console.log('Launching Electron...');
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

process.on('SIGINT', () => {
  electron.kill();
  server.kill();
  vite.kill();
  process.exit(0);
});
