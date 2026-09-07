const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");

const DASHBOARD_URL = "http://127.0.0.1:3000";
let backend = null;
let mainWindow = null;

function appRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "app");
  }
  return path.join(__dirname, "..");
}

function resolvePython(root) {
  const portableWin = path.join(root, ".portable", "venv", "Scripts", "python.exe");
  const portableUnix = path.join(root, ".portable", "venv", "bin", "python");
  if (fs.existsSync(portableWin)) return portableWin;
  if (fs.existsSync(portableUnix)) return portableUnix;
  return process.platform === "win32" ? "python" : "python3";
}

function waitForUrl(url, timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const probe = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) resolve();
        else retry();
      });
      req.on("error", retry);
      req.setTimeout(4000, () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(probe, 1500);
    };
    probe();
  });
}

function startBackend(root) {
  const py = resolvePython(root);
  const script = path.join(root, "run_all.py");
  const env = {
    ...process.env,
    OFFLINE_DESKTOP: "1",
    NEXT_PUBLIC_OFFLINE_DESKTOP: "1",
    NEXT_PUBLIC_DEFAULT_DATA_URL: "http://127.0.0.1:3000/api/default-data",
    API_PROXY_TARGET: "http://127.0.0.1:8810",
  };
  backend = spawn(py, [script, "--no-browser", "--desktop"], {
    cwd: root,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  backend.on("error", (err) => {
    dialog.showErrorBox(
      "ATE Intelligence — startup failed",
      `Could not start the local server.\n\n${err.message}\n\nRun "Setup ATE Intelligence" once on this PC first.`,
    );
    app.quit();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    title: "ATE Intelligence",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadURL(DASHBOARD_URL);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function stopBackend() {
  if (!backend) return;
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(backend.pid), "/f", "/t"], { shell: true });
    } else {
      backend.kill("SIGTERM");
    }
  } catch {
    /* ignore */
  }
  backend = null;
}

app.whenReady().then(async () => {
  const root = appRoot();
  const windowOnly = process.env.ATE_WINDOW_ONLY === "1";
  if (!windowOnly) {
    const readyMarker = path.join(root, ".portable", "ready");
    if (!fs.existsSync(readyMarker) && !app.isPackaged) {
      const { response } = await dialog.showMessageBox({
        type: "warning",
        buttons: ["Quit", "Continue anyway"],
        defaultId: 0,
        title: "Setup required",
        message: "Portable setup has not been run on this copy yet.",
        detail:
          'For offline use on a new PC, copy the whole folder from USB and run "Setup ATE Intelligence" once (internet needed only for that step).',
      });
      if (response === 0) {
        app.quit();
        return;
      }
    }
    startBackend(root);
  }
  try {
    await waitForUrl(DASHBOARD_URL);
    createWindow();
  } catch (err) {
    dialog.showErrorBox("ATE Intelligence", err.message);
    stopBackend();
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.env.ATE_WINDOW_ONLY !== "1") {
    stopBackend();
  }
  app.quit();
});

app.on("before-quit", () => {
  if (process.env.ATE_WINDOW_ONLY !== "1") {
    stopBackend();
  }
});
