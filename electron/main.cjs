const { app, BrowserWindow, dialog, Menu, ipcMain } = require('electron');
const path = require('path');

// ── Config ─────────────────────────────────────────────
const SERVER_PORT = process.env.CMDUI_SERVER_PORT || 3001;
const VITE_PORT = process.env.CMDUI_VITE_PORT || 5173;
const isDev = !app.isPackaged;

let mainWindow = null;

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
      { role: 'about', label: 'About CMDui' },
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
    title: 'CMDui — Agent Desktop',
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

// ── IPC Handlers ───────────────────────────────────────
ipcMain.handle('open-folder-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Open Project Folder',
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('get-platform', () => process.platform);

// ── App Lifecycle ──────────────────────────────────────
app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
