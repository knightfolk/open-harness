const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('CMDuiNative', {
  platform: process.platform,
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),

  // Listen for menu events from main process
  onMenuAction: (callback) => {
    ipcRenderer.on('open-folder', (_, path) => callback('open-folder', path));
    ipcRenderer.on('new-session', () => callback('new-session'));
    ipcRenderer.on('open-preferences', () => callback('open-preferences'));
  },
});
