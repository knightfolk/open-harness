const { app, BrowserWindow, dialog, Menu, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

// ── Config ─────────────────────────────────────────────
const SERVER_PORT = process.env.OPENHARNESS_SERVER_PORT || 3001;
const VITE_PORT = process.env.OPENHARNESS_VITE_PORT || 5173;
const isDev = !app.isPackaged;

let mainWindow = null;
let packagedServer = null;
let updaterInitialized = false;
let lastUpdateCheckWasManual = false;
let updateReadyToInstall = false;

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.exit(0);
}

// ── Menu ───────────────────────────────────────────────
function send(channel, ...args) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
  }
}

function emitUpdateStatus(status, detail = {}) {
  send('update-status', {
    status,
    at: new Date().toISOString(),
    ...detail,
  });
}

async function promptToDownloadUpdate(info) {
  const version = info?.version ? ` ${info.version}` : '';
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    buttons: ['Download Update', 'Later'],
    defaultId: 0,
    cancelId: 1,
    title: 'OpenHarness update available',
    message: `OpenHarness${version} is available.`,
    detail: 'Download it in the background now? You can keep working while it downloads.',
  });
  if (result.response === 0) {
    emitUpdateStatus('downloading', { version: info?.version });
    await autoUpdater.downloadUpdate();
  }
}

async function promptToInstallUpdate(info) {
  updateReadyToInstall = true;
  const version = info?.version ? ` ${info.version}` : '';
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    buttons: ['Restart and Install', 'Later'],
    defaultId: 0,
    cancelId: 1,
    title: 'OpenHarness update ready',
    message: `OpenHarness${version} has been downloaded.`,
    detail: 'Restart OpenHarness now to finish installing the update.',
  });
  if (result.response === 0) {
    autoUpdater.quitAndInstall(false, true);
  }
}

function initAutoUpdater() {
  if (updaterInitialized) return;
  updaterInitialized = true;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = true;
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'knightfolk',
    repo: 'open-harness',
  });

  autoUpdater.on('checking-for-update', () => {
    emitUpdateStatus('checking');
  });

  autoUpdater.on('update-available', (info) => {
    emitUpdateStatus('available', { version: info?.version });
    lastUpdateCheckWasManual = false;
    promptToDownloadUpdate(info).catch((error) => {
      emitUpdateStatus('error', { message: error?.message || 'Failed to download update.' });
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    emitUpdateStatus('current', { version: info?.version || app.getVersion() });
    if (lastUpdateCheckWasManual) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        buttons: ['OK'],
        title: 'OpenHarness is up to date',
        message: 'OpenHarness is up to date.',
        detail: `Current version: ${app.getVersion()}`,
      });
    }
    lastUpdateCheckWasManual = false;
  });

  autoUpdater.on('download-progress', (progress) => {
    emitUpdateStatus('downloading', {
      percent: Math.round(progress.percent || 0),
      bytesPerSecond: progress.bytesPerSecond,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    emitUpdateStatus('downloaded', { version: info?.version });
    promptToInstallUpdate(info).catch((error) => {
      emitUpdateStatus('error', { message: error?.message || 'Failed to install update.' });
    });
  });

  autoUpdater.on('error', (error) => {
    const message = error?.message || 'Update check failed.';
    emitUpdateStatus('error', { message });
    if (lastUpdateCheckWasManual) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        buttons: ['OK'],
        title: 'Update check failed',
        message: 'OpenHarness could not check for updates.',
        detail: message,
      });
    }
    lastUpdateCheckWasManual = false;
  });
}

async function checkForUpdates(manual = false) {
  if (isDev) {
    emitUpdateStatus('disabled', { reason: 'Updates are checked only in packaged builds.' });
    if (manual) {
      await dialog.showMessageBox(mainWindow, {
        type: 'info',
        buttons: ['OK'],
        title: 'Updates disabled in development',
        message: 'Auto-update checks run only in packaged OpenHarness builds.',
      });
    }
    return { ok: false, reason: 'development' };
  }

  initAutoUpdater();
  lastUpdateCheckWasManual = manual;
  await autoUpdater.checkForUpdates();
  return { ok: true };
}

const template = [
  {
    label: app.name,
    submenu: [
      { role: 'about', label: 'About OpenHarness' },
      { type: 'separator' },
      { label: 'Preferences...', accelerator: 'Cmd+,', click: () => send('open-preferences') },
      { label: 'Check for Updates...', accelerator: 'CmdOrCtrl+Shift+U', click: () => checkForUpdates(true) },
      { type: 'separator' },
      { role: 'quit' },
    ],
  },
  {
    label: 'File',
    submenu: [
      {
        label: 'Open Folder...',
        accelerator: 'Cmd+O',
        click: async () => {
          const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory'],
            title: 'Open Project Folder',
          });
          if (!result.canceled && result.filePaths.length > 0) {
            send('open-folder', result.filePaths[0]);
          }
        },
      },
      { type: 'separator' },
      { label: 'New Session', accelerator: 'Cmd+N', click: () => send('new-session') },
    ],
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
    ],
  },
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  },
];

// ── Create Window ──────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'OpenHarness — Universal AI Harness',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0d0f11',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const url = isDev
    ? `http://localhost:${VITE_PORT}`
    : `http://localhost:${SERVER_PORT}`;

  console.log(`[main] Loading ${url}`);
  mainWindow.loadURL(url);

  mainWindow.on('closed', () => { mainWindow = null; });

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

function checkServer() {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${SERVER_PORT}/api/config`, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForPackagedServer(timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await checkServer()) return true;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return false;
}

async function startPackagedServer() {
  if (isDev) return;
  if (await checkServer()) {
    console.log(`[main] Reusing OpenHarness server on port ${SERVER_PORT}`);
    return;
  }

  const appPath = app.getAppPath();
  const serverEntry = path.join(appPath, 'dist-server', 'index.js');
  const staticDir = path.join(appPath, 'dist');
  console.log(`[main] Starting bundled server ${serverEntry}`);

  packagedServer = spawn(process.execPath, [serverEntry], {
    cwd: app.getPath('userData'),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(SERVER_PORT),
      OPENHARNESS_STATIC_DIR: staticDir,
      OPENHARNESS_UI_URL: `http://localhost:${SERVER_PORT}`,
      OPENHARNESS_LISTEN_HOST: '127.0.0.1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  packagedServer.stdout.on('data', (data) => process.stdout.write(`[server] ${data}`));
  packagedServer.stderr.on('data', (data) => process.stderr.write(`[server:err] ${data}`));
  packagedServer.on('exit', (code) => {
    console.log(`[main] Bundled server exited (${code})`);
    packagedServer = null;
  });

  if (!(await waitForPackagedServer())) {
    dialog.showErrorBox('OpenHarness could not start', `The bundled server did not become ready on port ${SERVER_PORT}.`);
  }
}

// ── Window Snap Zones (FancyZones-style) ───────────────
const { globalShortcut, screen } = require('electron');

function getSnapZones() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workArea;
  const { x: wx, y: wy } = display.workArea;
  const halfW = Math.floor(width / 2);
  const halfH = Math.floor(height / 2);
  return {
    'left-half':   { x: wx, y: wy, width: halfW, height },
    'right-half':  { x: wx + halfW, y: wy, width: halfW, height },
    'top-half':    { x: wx, y: wy, width, height: halfH },
    'bottom-half': { x: wx, y: wy + halfH, width, height: halfH },
    'top-left':    { x: wx, y: wy, width: halfW, height: halfH },
    'top-right':   { x: wx + halfW, y: wy, width: halfW, height: halfH },
    'bottom-left': { x: wx, y: wy + halfH, width: halfW, height: halfH },
    'bottom-right':{ x: wx + halfW, y: wy + halfH, width: halfW, height: halfH },
    'maximize':    { x: wx, y: wy, width, height },
  };
}

function snapToZone(zoneName) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const zones = getSnapZones();
  const zone = zones[zoneName];
  if (!zone) return;
  if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false);
  mainWindow.setBounds(zone);
}

function showSnapOverlay() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('show-snap-zones');
}

// Register keyboard shortcuts for snap zones
function registerSnapShortcuts() {
  // Cmd+Shift+Arrow keys for quick snap
  globalShortcut.register('CmdOrCtrl+Shift+Left', () => snapToZone('left-half'));
  globalShortcut.register('CmdOrCtrl+Shift+Right', () => snapToZone('right-half'));
  globalShortcut.register('CmdOrCtrl+Shift+Up', () => snapToZone('maximize'));
  globalShortcut.register('CmdOrCtrl+Shift+Down', () => snapToZone('bottom-half'));

  // Avoid Cmd+Shift+3/4/5 because macOS reserves them for screenshots.
  // Use Cmd+Option+Shift+1-9 for explicit zone shortcuts instead.
  globalShortcut.register('CmdOrCtrl+Alt+Shift+1', () => snapToZone('top-left'));
  globalShortcut.register('CmdOrCtrl+Alt+Shift+2', () => snapToZone('top-half'));
  globalShortcut.register('CmdOrCtrl+Alt+Shift+3', () => snapToZone('top-right'));
  globalShortcut.register('CmdOrCtrl+Alt+Shift+4', () => snapToZone('left-half'));
  globalShortcut.register('CmdOrCtrl+Alt+Shift+5', () => snapToZone('maximize'));
  globalShortcut.register('CmdOrCtrl+Alt+Shift+6', () => snapToZone('right-half'));
  globalShortcut.register('CmdOrCtrl+Alt+Shift+7', () => snapToZone('bottom-left'));
  globalShortcut.register('CmdOrCtrl+Alt+Shift+8', () => snapToZone('bottom-half'));
  globalShortcut.register('CmdOrCtrl+Alt+Shift+9', () => snapToZone('bottom-right'));
}

// ── IPC Handlers ───────────────────────────────────────
ipcMain.handle('open-folder-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Open Project Folder',
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('get-platform', () => process.platform);

ipcMain.handle('snap-to-zone', (_event, zoneName) => {
  snapToZone(zoneName);
});

ipcMain.handle('get-snap-zones', () => {
  return getSnapZones();
});

ipcMain.handle('check-for-updates', () => checkForUpdates(true));

ipcMain.handle('install-update', () => {
  if (!updateReadyToInstall || isDev) return { ok: false };
  autoUpdater.quitAndInstall(false, true);
  return { ok: true };
});

// ── App Lifecycle ──────────────────────────────────────
app.whenReady().then(async () => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  await startPackagedServer();
  registerSnapShortcuts();
  createWindow();
  setTimeout(() => {
    checkForUpdates(false).catch((error) => {
      emitUpdateStatus('error', { message: error?.message || 'Update check failed.' });
    });
  }, 3000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('second-instance', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (packagedServer && !packagedServer.killed) {
    packagedServer.kill();
  }
});
