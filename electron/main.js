const path = require("path");
const { app, BrowserWindow, shell, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");

const isDev = !app.isPackaged;
let mainWindow = null;

// Configure auto-updater
autoUpdater.checkForUpdatesAndNotify = false; // We'll handle notifications manually
autoUpdater.autoDownload = true; // Auto-download once update is found
autoUpdater.autoInstallOnAppQuit = true; // Install update when app quits

function resolveAssetPath(...parts) {
  // In dev, assets live in project root. In production, Electron loads from the installed app resources.
  return path.join(app.getAppPath(), ...parts);
}

function createMainWindow() {
  const iconPath = resolveAssetPath("build-resources", "icon.png");

  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: "#0b1220",
    show: false,
    icon: iconPath,
    webPreferences: {
      preload: resolveAssetPath("electron", "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow = win;

  win.once("ready-to-show", () => win.show());

  // Allow in-app print/popups (about:blank/data/blob/local files), but open true externals in browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    const isInternalPopup =
      url === "about:blank" ||
      url.startsWith("data:") ||
      url.startsWith("blob:") ||
      url.startsWith("file://") ||
      url.startsWith("http://localhost");

    if (isInternalPopup) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          show: true,
        },
      };
    }

    shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (e, url) => {
    const current = win.webContents.getURL();
    if (!current || url === current) return;
    if (url.startsWith("file://") || url.startsWith("http://localhost")) return;
    e.preventDefault();
    shell.openExternal(url);
  });

  const startUrl = process.env.ELECTRON_START_URL;
  if (startUrl) {
    win.loadURL(startUrl);
  } else {
    win.loadFile(resolveAssetPath("build", "index.html"));
  }

  return win;
}

// Setup auto-updater event listeners
autoUpdater.on("checking-for-update", () => {
  if (mainWindow) mainWindow.webContents.send("checking-for-update");
});

autoUpdater.on("update-available", (info) => {
  if (mainWindow) mainWindow.webContents.send("update-available", info);
});

autoUpdater.on("update-not-available", (info) => {
  if (mainWindow) mainWindow.webContents.send("update-not-available", info);
});

autoUpdater.on("error", (error) => {
  if (mainWindow) mainWindow.webContents.send("update-error", error.message);
});

autoUpdater.on("download-progress", (progressObj) => {
  if (mainWindow) mainWindow.webContents.send("download-progress", progressObj);
});

autoUpdater.on("update-downloaded", (info) => {
  if (mainWindow) mainWindow.webContents.send("update-downloaded", info);
});

// IPC handlers for update checking
ipcMain.handle("check-for-updates", async () => {
  try {
    console.log("Checking for updates...");
    const currentVersion = app.getVersion();
    console.log("Current App Version:", currentVersion);
    const result = await autoUpdater.checkForUpdates();
    console.log("Update check result:", result);
    const latestVersion = result?.updateInfo?.version || null;
    const updateAvailable = Boolean(latestVersion && latestVersion !== currentVersion);
    return {
      updateAvailable,
      currentVersion,
      updateInfo: result?.updateInfo || null,
    };
  } catch (error) {
    console.error("Update check error:", error);
    return { updateAvailable: false, error: error.message, currentVersion: app.getVersion() };
  }
});

ipcMain.on("install-update", () => {
  autoUpdater.quitAndInstall();
});

app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  // On macOS, apps stay active until Cmd+Q. For Windows (your target), quit when all windows close.
  if (process.platform !== "darwin") app.quit();
});

