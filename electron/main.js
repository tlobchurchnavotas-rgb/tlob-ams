const path = require("path");
const https = require("https");
const fs = require("fs");
const express = require("express");
const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const dotenv = require('dotenv');
const { ensureCertificates } = require("./certificate-utils");

// Load environment variables from .env file in the app directory
dotenv.config({ path: path.join(app.getAppPath(), '.env') });

const isDev = !app.isPackaged;
let mainWindow = null;
let webServer = null;
/** True when the packaged app’s Express server is listening with TLS (for iPad / remote browsers). */
let embeddedRemoteHttpsListening = false;

if (isDev) {
  // CRA `HTTPS=true` uses a self-signed cert; allow the Electron shell to load https://localhost:3000.
  app.commandLine.appendSwitch("ignore-certificate-errors");
}

// Configure auto-updater
autoUpdater.checkForUpdatesAndNotify = false; // We'll handle notifications manually
autoUpdater.autoDownload = false; // Don't auto-download, let user decide
autoUpdater.autoInstallOnAppQuit = true; // Install update when app quits

const GITHUB_PUBLISH_INFO = {
  provider: "github",
  owner: "tlobchurchnavotas-rgb",
  repo: "tlob-ams",
  channel: "latest",
};

// Configure GitHub token for private repository access
const githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (githubToken) {
  console.log("Using GitHub token for private release access.");
  autoUpdater.requestHeaders = {
    Authorization: `token ${githubToken}`,
  };
  autoUpdater.setFeedURL({
    ...GITHUB_PUBLISH_INFO,
    private: true,
    token: githubToken,
  });
} else {
  console.log("No GitHub token found for autoUpdater. Private releases will be inaccessible.");
  autoUpdater.setFeedURL(GITHUB_PUBLISH_INFO);
}

function resolveAssetPath(...parts) {
  // In dev, assets live in project root. In production, Electron loads from the installed app resources.
  return path.join(app.getAppPath(), ...parts);
}

function startWebServer() {
  if (isDev) return; // Web server not needed in dev mode (React dev server is used)
  
  const expressApp = express();
  const buildPath = resolveAssetPath("build");
  // Packaged apps live inside app.asar (read-only); write certs under userData.
  const certDir = app.isPackaged
    ? path.join(app.getPath("userData"), "tlob-ams-remote-certs")
    : resolveAssetPath("electron", "certs");
  
  // Serve static files from build directory
  expressApp.use(express.static(buildPath));
  
  // Handle SPA routing - serve index.html for all non-static requests
  expressApp.get("*", (req, res) => {
    res.sendFile(path.join(buildPath, "index.html"));
  });
  
  return new Promise((resolve) => {
    try {
      console.log("🔐 Starting HTTPS server...");
      
      // Ensure certificates exist
      let certs;
      try {
        certs = ensureCertificates(certDir);
        console.log("✓ Certificates loaded successfully");
      } catch (certError) {
        console.error("❌ Certificate error:", certError.message);
        throw certError;
      }
      
      // Verify certificate and key are valid
      if (!certs.cert || typeof certs.cert !== "string") {
        throw new Error("Invalid certificate format");
      }
      if (!certs.key || typeof certs.key !== "string") {
        throw new Error("Invalid key format");
      }
      
      console.log("✓ Certificate validation passed");
      
      // Create HTTPS server with certificates
      const httpsServer = https.createServer(
        {
          key: certs.key,
          cert: certs.cert,
        },
        expressApp
      );
      
      webServer = httpsServer;

      // Add error handler for HTTPS server
      httpsServer.on("error", (err) => {
        embeddedRemoteHttpsListening = false;
        console.error("❌ HTTPS Server Error:", err.message);
      });

      webServer.listen(3000, "0.0.0.0", () => {
        embeddedRemoteHttpsListening = true;
        console.log("✓✓✓ HTTPS Web server running on https://0.0.0.0:3000");
        console.log("    Certificate: Self-signed (valid for local network)");
        console.log("    Ready for remote access!");
        resolve();
      });
    } catch (error) {
      console.error("❌ HTTPS initialization failed:", error.message);
      console.error("Stack:", error.stack);
      embeddedRemoteHttpsListening = false;
      webServer = null;
      try {
        dialog.showErrorBox(
          "TLOB AMS — Remote access (HTTPS) unavailable",
          "The app could not start the secure web server on port 3000 (needed for iPad / phone camera scanning over Wi‑Fi).\n\n" +
            "Common causes: another program is already using port 3000, or certificate files could not be created.\n\n" +
            "You can still use TLOB AMS on this PC. Check the console log for details."
        );
      } catch {}
      resolve();
    }
  });
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
    autoHideMenuBar: true,
    webPreferences: {
      preload: resolveAssetPath("electron", "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  Menu.setApplicationMenu(null);
  win.setMenuBarVisibility(false);
  mainWindow = win;

  win.once("ready-to-show", () => win.show());

  // Keep app-created print/export popups inside Electron, and only open real external links in browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url === "about:blank" || url.startsWith("data:") || url.startsWith("blob:")) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (e, url) => {
    const current = win.webContents.getURL();
    if (!current || url === current) return;
    if (
      url.startsWith("file://") ||
      url.startsWith("http://localhost") ||
      url.startsWith("https://localhost") ||
      url.startsWith("http://127.0.0.1") ||
      url.startsWith("https://127.0.0.1")
    ) {
      return;
    }
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
    console.log("Current App Version:", app.getVersion());
    const result = await autoUpdater.checkForUpdates();
    console.log("Update check result:", result);
    return result;
  } catch (error) {
    console.error("Update check error:", error);
    const message = String(error?.message || error);
    const needsToken = !githubToken && /Unable to find latest version on GitHub|404/.test(message);
    const friendlyError = needsToken
      ? "Auto-update requires a valid GitHub token (GITHUB_TOKEN or GH_TOKEN) for private repos, or a public GitHub release tagged as latest."
      : message;
    return { updateAvailable: false, error: friendlyError };
  }
});

ipcMain.handle("download-update", async () => {
  try {
    console.log("Starting update download...");
    const result = await autoUpdater.downloadUpdate();
    console.log("Update downloaded:", result);
    return { success: true };
  } catch (error) {
    console.error("Update download error:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.on("install-update", () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle("tlob-app-info", () => ({
  isPackaged: app.isPackaged,
  embeddedRemoteHttpsListening,
}));

app.whenReady().then(async () => {
  await startWebServer();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  // On macOS, apps stay active until Cmd+Q. For Windows (your target), quit when all windows close.
  if (webServer) webServer.close();
  if (process.platform !== "darwin") app.quit();
});

