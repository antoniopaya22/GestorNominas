const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { runToCompletion, startPersistent, waitForHealth, stop } = require("./backend-manager");

const PORT = 4310;
const isDev = !app.isPackaged;

// En dev, "resources" es la raíz del monorepo (backend/ y frontend/ como hermanos).
// Empaquetado, electron-builder copia todo bajo process.resourcesPath (ver package.json > build.extraResources).
const resourcesPath = isDev ? path.join(__dirname, "..") : process.resourcesPath;
const backendDir = isDev ? path.join(resourcesPath, "backend") : path.join(resourcesPath, "app", "backend");
const tessdataDir = isDev
  ? path.join(backendDir, "resources", "tessdata")
  : path.join(resourcesPath, "tessdata");
const nodeBin = isDev
  ? "node"
  : path.join(resourcesPath, "node", process.platform === "win32" ? "node.exe" : path.join("bin", "node"));

const userDataDir = app.getPath("userData");
const dbPath = path.join(userDataDir, "nominas.db");
const uploadDir = path.join(userDataDir, "uploads");
const logFile = path.join(userDataDir, "backend.log");

function getOrCreateJwtSecret() {
  const secretFile = path.join(userDataDir, "secret.json");
  try {
    const parsed = JSON.parse(fs.readFileSync(secretFile, "utf8"));
    if (parsed.jwtSecret && parsed.jwtSecret.length >= 32) return parsed.jwtSecret;
  } catch {
    // primer arranque o archivo corrupto — se genera uno nuevo
  }
  const jwtSecret = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(secretFile, JSON.stringify({ jwtSecret }));
  return jwtSecret;
}

function buildBackendEnv() {
  const env = {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(PORT),
    DATABASE_PATH: dbPath,
    UPLOAD_DIR: uploadDir,
    CORS_ORIGIN: `http://localhost:${PORT}`,
    JWT_SECRET: getOrCreateJwtSecret(),
  };
  if (fs.existsSync(tessdataDir)) env.TESSDATA_PATH = tessdataDir;
  return env;
}

let backendProcess = null;
let splashWindow = null;
let mainWindow = null;

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 380,
    height: 220,
    frame: false,
    resizable: false,
    autoHideMenuBar: true,
  });
  splashWindow.loadFile(path.join(__dirname, "splash.html"));
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    show: false,
  });
  mainWindow.once("ready-to-show", () => {
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.loadURL(`http://localhost:${PORT}/`);
}

async function start() {
  fs.mkdirSync(userDataDir, { recursive: true });
  createSplash();

  const env = buildBackendEnv();

  try {
    await runToCompletion(nodeBin, path.join(backendDir, "dist", "db", "migrate.js"), {
      env,
      cwd: backendDir,
      logFile,
    });

    backendProcess = startPersistent(nodeBin, path.join(backendDir, "dist", "index.js"), {
      env,
      cwd: backendDir,
      logFile,
    });

    await waitForHealth(PORT);
    createMainWindow();
  } catch (err) {
    fs.appendFileSync(logFile, `\n[error de arranque] ${err.stack || err}\n`);
    dialog.showErrorBox(
      "No se pudo iniciar Gestor de Nóminas",
      `Ocurrió un error al arrancar la aplicación:\n${err.message}\n\nRevisa el registro en:\n${logFile}`
    );
    app.quit();
  }
}

function shutdownBackend() {
  stop(backendProcess);
  backendProcess = null;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(start);

  app.on("window-all-closed", () => {
    shutdownBackend();
    app.quit();
  });

  app.on("before-quit", shutdownBackend);
}
