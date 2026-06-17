const { app, BrowserWindow, dialog, Menu, ipcMain } = require('electron');
const path = require('path');

// ── Config ─────────────────────────────────────────────
const SERVER_PORT = process.env.OPENHARNESS_SERVER_PORT || 3001;
const VITE_PORT = process.env.OPENHARNESS_VITE_PORT || 5173;
const isDev = !app.isPackaged;

let mainWindow = null;

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

const template = [
  {
    label: app.name,
    submenu: [
      { role: 'about', label: 'About OpenHarness' },
      { type: 'separator' },
      { label: 'Preferences...', accelerator: 'Cmd+,', click: () => send('open-preferences') },
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

  // Cmd+Shift+1-9 for specific zones
  globalShortcut.register('CmdOrCtrl+Shift+1', () => snapToZone('top-left'));
  globalShortcut.register('CmdOrCtrl+Shift+2', () => snapToZone('top-half'));
  globalShortcut.register('CmdOrCtrl+Shift+3', () => snapToZone('top-right'));
  globalShortcut.register('CmdOrCtrl+Shift+4', () => snapToZone('left-half'));
  globalShortcut.register('CmdOrCtrl+Shift+5', () => snapToZone('maximize'));
  globalShortcut.register('CmdOrCtrl+Shift+6', () => snapToZone('right-half'));
  globalShortcut.register('CmdOrCtrl+Shift+7', () => snapToZone('bottom-left'));
  globalShortcut.register('CmdOrCtrl+Shift+8', () => snapToZone('bottom-half'));
  globalShortcut.register('CmdOrCtrl+Shift+9', () => snapToZone('bottom-right'));
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

// ── App Lifecycle ──────────────────────────────────────
app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  registerSnapShortcuts();
  createWindow();

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
