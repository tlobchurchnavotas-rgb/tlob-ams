// Keep preload minimal. Add secure IPC APIs here if/when needed.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tlob", {
  platform: process.platform,
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  onUpdateAvailable: (callback) => ipcRenderer.on("update-available", (event, info) => callback(info)),
  onUpdateDownloaded: (callback) => ipcRenderer.on("update-downloaded", (event, info) => callback(info)),
  onUpdateError: (callback) => ipcRenderer.on("update-error", (event, error) => callback(error)),
  installUpdate: () => ipcRenderer.send("install-update"),
});

