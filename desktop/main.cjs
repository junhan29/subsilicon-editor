"use strict";
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// desktop/main.ts
var import_electron = require("electron");
var import_electron_updater = require("electron-updater");
var import_path = require("path");
var import_fs = require("fs");
var import_node_child_process = require("node:child_process");
var _buildInfoPath = (0, import_path.join)(__dirname, "..", "src", "build-info.json");
var __BUILD_INFO__ = { version: "0.0.0", appName: "SubSilicon Editor" };
try {
  if ((0, import_fs.existsSync)(_buildInfoPath)) {
    __BUILD_INFO__ = JSON.parse((0, import_fs.readFileSync)(_buildInfoPath, "utf-8"));
  } else {
    const alt = (0, import_path.join)(__dirname, "..", "dist", "build-info.json");
    if ((0, import_fs.existsSync)(alt)) __BUILD_INFO__ = JSON.parse((0, import_fs.readFileSync)(alt, "utf-8"));
  }
} catch {
}
var APP_NAME = String(__BUILD_INFO__.appName || "SubSilicon Editor");
var APP_VERSION = String(__BUILD_INFO__.version || "0.0.0");
var PROJECT_DIR_NAME = ".subsilicon";
var DOWNLOAD_PAGE_URL = "https://subsilicon.cn/download";
var isDev = !import_electron.app.isPackaged;
var isMac = process.platform === "darwin";
var isWin = process.platform === "win32";
var isLinux = process.platform === "linux";
var ALLOWED_PATHS = /* @__PURE__ */ new Set();
function normPath(p) {
  let resolved = (0, import_path.resolve)(String(p || ""));
  if (isWin && /^[a-z]:\\/.test(resolved)) {
    resolved = resolved.charAt(0).toUpperCase() + resolved.slice(1);
  }
  return resolved;
}
__name(normPath, "normPath");
function initAllowlist() {
  const grant = /* @__PURE__ */ __name((p) => {
    try {
      ALLOWED_PATHS.add(normPath(p));
    } catch {
    }
  }, "grant");
  try {
    grant(import_electron.app.getPath("userData"));
  } catch {
  }
  try {
    grant(import_electron.app.getPath("temp"));
  } catch {
  }
  try {
    grant(import_electron.app.getPath("documents"));
  } catch {
  }
  try {
    grant(import_electron.app.getPath("desktop"));
  } catch {
  }
  try {
    grant(import_electron.app.getPath("downloads"));
  } catch {
  }
  try {
    grant(import_electron.app.getAppPath());
  } catch {
  }
  try {
    grant(__dirname);
  } catch {
  }
  try {
    grant((0, import_path.join)(__dirname, ".."));
  } catch {
  }
  try {
    grant(getProjectDir());
  } catch {
  }
}
__name(initAllowlist, "initAllowlist");
function isPathAllowed(rawPath) {
  if (!rawPath) return false;
  const target = normPath(rawPath);
  if (ALLOWED_PATHS.has(target)) return true;
  for (const allowed of ALLOWED_PATHS) {
    const prefix = allowed.endsWith(import_path.sep) ? allowed : allowed + import_path.sep;
    if (target.startsWith(prefix)) return true;
  }
  return false;
}
__name(isPathAllowed, "isPathAllowed");
function guardPathAccess(filePath, operation) {
  if (!isPathAllowed(filePath)) {
    const err = new Error(`[Security] ${operation} \u8DEF\u5F84\u672A\u6388\u6743: ${filePath}`);
    console.error(err.message);
    throw err;
  }
}
__name(guardPathAccess, "guardPathAccess");
function grantUserChosen(chosenPath) {
  if (!chosenPath) return;
  const p = normPath(chosenPath);
  ALLOWED_PATHS.add(p);
  try {
    const st = (0, import_fs.statSync)(p);
    if (st.isFile()) ALLOWED_PATHS.add((0, import_path.dirname)(p));
  } catch {
    ALLOWED_PATHS.add((0, import_path.dirname)(p));
  }
}
__name(grantUserChosen, "grantUserChosen");
function migrateRecentFiles() {
  const sources = [
    (0, import_path.join)(getProjectDir(), "recent-files.json")
  ];
  try {
    const legacy = (0, import_path.join)(import_electron.app.getPath("userData"), "recent-files.json");
    if ((0, import_fs.existsSync)(legacy)) sources.push(legacy);
  } catch {
  }
  for (const recentFilesPath of sources) {
    try {
      if ((0, import_fs.existsSync)(recentFilesPath)) {
        const data = JSON.parse((0, import_fs.readFileSync)(recentFilesPath, "utf8"));
        const files = Array.isArray(data) ? data : [];
        for (const f of files) {
          const fp = typeof f === "string" ? f : f && f.path;
          if (fp) {
            try {
              ALLOWED_PATHS.add((0, import_path.dirname)(normPath(fp)));
            } catch {
            }
          }
        }
      }
    } catch (e) {
      console.warn("[Security] migrateRecentFiles \u5931\u8D25\uFF0C\u5FFD\u7565\uFF1A", e && e.message);
    }
  }
}
__name(migrateRecentFiles, "migrateRecentFiles");
var BUILD_PLATFORM_WHITELIST = /* @__PURE__ */ new Set(["current", "mac", "win", "linux"]);
var BUILD_ENV_WHITELIST = /* @__PURE__ */ new Set([
  "HOME",
  "PATH",
  "USER",
  "USERPROFILE",
  "TMPDIR",
  "TEMP",
  "TMP",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "APPDATA",
  "LOCALAPPDATA",
  "XDG_CACHE_HOME",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "SHELL",
  "npm_config_user_agent",
  "npm_node_execpath",
  "NPM_CLI_JS",
  "NODE",
  "NODE_ENV"
]);
var SHELL_SIGNATURE_KEY = "_subsiliconStandaloneShell";
var LOG_CHANNEL_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;
function verifyShellDir(shellDir) {
  const resolved = normPath(shellDir);
  if (!isPathAllowed(resolved)) {
    return { ok: false, error: `shellDir \u672A\u6388\u6743\uFF0C\u8BF7\u5148\u901A\u8FC7"\u9009\u62E9\u8F93\u51FA\u76EE\u5F55"\u5BF9\u8BDD\u6846\u9009\u62E9\uFF1A${shellDir}` };
  }
  const pkgPath = (0, import_path.join)(resolved, "package.json");
  if (!(0, import_fs.existsSync)(pkgPath)) {
    return { ok: false, error: `shellDir \u4E2D\u4E0D\u5B58\u5728 package.json\uFF1A${pkgPath}` };
  }
  let pkg;
  try {
    pkg = JSON.parse((0, import_fs.readFileSync)(pkgPath, "utf8"));
  } catch (e) {
    return { ok: false, error: `package.json \u89E3\u6790\u5931\u8D25\uFF1A${e.message}` };
  }
  if (pkg[SHELL_SIGNATURE_KEY] !== true) {
    return { ok: false, error: "shellDir \u4E0D\u662F\u5B98\u65B9\u58F3\u6A21\u677F\uFF08\u7F3A\u5C11 _subsiliconStandaloneShell \u7B7E\u540D\uFF09\uFF0C\u62D2\u7EDD\u6253\u5305" };
  }
  return { ok: true, resolved };
}
__name(verifyShellDir, "verifyShellDir");
function buildChildEnv() {
  const env = {};
  for (const k of BUILD_ENV_WHITELIST) {
    if (process.env[k] !== void 0) env[k] = process.env[k];
  }
  return env;
}
__name(buildChildEnv, "buildChildEnv");
var mainWindow = null;
var splashWindow = null;
var panelWindow = null;
var tray = null;
var recentFiles = [];
function getProjectDir() {
  const userData = import_electron.app.getPath("userData");
  const projectDir = (0, import_path.join)(userData, PROJECT_DIR_NAME);
  if (!(0, import_fs.existsSync)(projectDir)) (0, import_fs.mkdirSync)(projectDir, { recursive: true });
  return projectDir;
}
__name(getProjectDir, "getProjectDir");
function getRecentFilesPath() {
  return (0, import_path.join)(getProjectDir(), "recent-files.json");
}
__name(getRecentFilesPath, "getRecentFilesPath");
function loadRecentFiles() {
  const p = getRecentFilesPath();
  if ((0, import_fs.existsSync)(p)) {
    try {
      const data = JSON.parse((0, import_fs.readFileSync)(p, "utf8"));
      recentFiles = Array.isArray(data) ? data : [];
    } catch {
      recentFiles = [];
    }
  } else {
    try {
      const legacy = (0, import_path.join)(import_electron.app.getPath("userData"), "recent-files.json");
      if ((0, import_fs.existsSync)(legacy)) {
        const data = JSON.parse((0, import_fs.readFileSync)(legacy, "utf8"));
        recentFiles = Array.isArray(data) ? data : [];
        saveRecentFiles();
      }
    } catch {
      recentFiles = [];
    }
  }
}
__name(loadRecentFiles, "loadRecentFiles");
function saveRecentFiles() {
  const p = getRecentFilesPath();
  (0, import_fs.writeFileSync)(p, JSON.stringify(recentFiles.slice(0, 10), null, 2), "utf-8");
}
__name(saveRecentFiles, "saveRecentFiles");
function addRecentFile(filePath) {
  recentFiles = recentFiles.filter((f) => f !== filePath);
  recentFiles.unshift(filePath);
  recentFiles = recentFiles.slice(0, 10);
  saveRecentFiles();
  grantUserChosen(filePath);
}
__name(addRecentFile, "addRecentFile");
function loadWindowState() {
  const p = (0, import_path.join)(getProjectDir(), "window-state.json");
  if ((0, import_fs.existsSync)(p)) {
    try {
      return JSON.parse((0, import_fs.readFileSync)(p, "utf8"));
    } catch {
      return {};
    }
  }
  return {};
}
__name(loadWindowState, "loadWindowState");
function saveWindowState(win) {
  const p = (0, import_path.join)(getProjectDir(), "window-state.json");
  (0, import_fs.writeFileSync)(p, JSON.stringify(win.getBounds(), null, 2), "utf-8");
}
__name(saveWindowState, "saveWindowState");
function createSplashWindow() {
  splashWindow = new import_electron.BrowserWindow({
    width: 500,
    height: 380,
    frame: false,
    transparent: !isLinux,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: isLinux ? "#1a1410" : void 0,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  const splashHtml = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${APP_NAME}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;
  background:#1a1410;background-image:
    radial-gradient(circle at 25% 25%, hsl(185 35% 55% / 0.12) 0%, transparent 45%),
    radial-gradient(circle at 75% 75%, hsl(25 65% 55% / 0.15) 0%, transparent 45%),
    linear-gradient(135deg, #1a1410 0%, #221a14 50%, #1a1410 100%);
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  overflow:hidden;color:#fff;}
.logo-container{display:flex;flex-direction:column;align-items:center;gap:20px;position:relative;z-index:2;}
.logo{width:80px;height:80px;background:linear-gradient(135deg,#f59e0b,#ef4444);border-radius:20px;
  display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:bold;color:#fff;
  box-shadow:0 8px 32px rgba(245,158,11,0.3),0 0 0 1px rgba(255,255,255,0.08);
  animation:pulse 2s ease-in-out infinite;}
@keyframes pulse{0%,100%{transform:scale(1);}50%{transform:scale(1.05);box-shadow:0 12px 48px rgba(245,158,11,0.45),0 0 0 1px rgba(255,255,255,0.12);}}
.title{font-size:24px;font-weight:600;color:#fff;letter-spacing:2px;}
.subtitle{font-size:12px;color:rgba(255,255,255,0.55);margin-top:4px;letter-spacing:1px;}
.progress-container{width:200px;height:3px;background:rgba(255,255,255,0.08);border-radius:2px;margin-top:30px;overflow:hidden;}
.progress-bar{height:100%;background:linear-gradient(90deg,#f59e0b,#ef4444);width:0%;transition:width 2s ease-out;}
.loading-text{font-size:11px;color:rgba(255,255,255,0.4);margin-top:12px;transition:opacity 0.3s;}
.error-msg{display:none;text-align:center;margin-top:20px;padding:12px 24px;
  background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:10px;}
.error-msg.visible{display:block;}
.error-msg p{color:#fca5a5;font-size:13px;line-height:1.5;}
.retry-btn{margin-top:12px;padding:8px 20px;background:#ef4444;color:#fff;border:none;border-radius:8px;
  font-size:13px;cursor:pointer;transition:background 0.2s;}
.retry-btn:hover{background:#dc2626;}
</style></head><body>
<div class="logo-container">
  <div class="logo">S</div>
  <div class="title">SubSilicon</div>
  <div class="subtitle">Interactive Narrative Editor</div>
</div>
<div class="progress-container"><div class="progress-bar" id="progress-bar"></div></div>
<div class="loading-text" id="loading-text">\u6B63\u5728\u52A0\u8F7D\u7F16\u8F91\u5668\u5F15\u64CE...</div>
<div class="error-msg" id="error-msg"><p id="error-text"></p>
<button class="retry-btn" onclick="window.__retryApp()">\u91CD\u8BD5</button></div>
<script>
setTimeout(function(){document.getElementById('progress-bar').style.width='70%';},100);
setTimeout(function(){document.getElementById('progress-bar').style.width='90%';document.getElementById('loading-text').textContent='\u5373\u5C06\u542F\u52A8...';},5000);
setTimeout(function(){var b=document.getElementById('progress-bar');if(b.style.width!=='100%'){b.style.width='100%';}},25000);
</script></body></html>`;
  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);
  splashWindow.on("closed", () => {
    splashWindow = null;
  });
}
__name(createSplashWindow, "createSplashWindow");
function showSplashError(message) {
  if (!splashWindow) return;
  splashWindow.webContents.executeJavaScript(`
    document.getElementById('progress-bar').style.background = '#ef4444';
    document.getElementById('loading-text').textContent = '\u26A0\uFE0F ' + ${JSON.stringify(message)};
    document.getElementById('loading-text').style.color = '#fca5a5';
    document.getElementById('error-msg').classList.add('visible');
    document.getElementById('error-text').textContent = '\u542F\u52A8\u5F15\u64CE\u5931\u8D25\uFF0C\u8BF7\u5C1D\u8BD5\u91CD\u65B0\u5B89\u88C5\u6216\u67E5\u770B\u5E2E\u52A9\u6587\u6863\u3002';
    window.__retryApp = function() { window.location.href = 'app://retry'; };
  `);
  splashWindow.webContents.on("will-navigate", (e, url) => {
    if (url.startsWith("app://retry")) {
      e.preventDefault();
      import_electron.app.relaunch();
      import_electron.app.exit(0);
    }
  });
}
__name(showSplashError, "showSplashError");
async function createMainWindow() {
  const windowState = loadWindowState();
  mainWindow = new import_electron.BrowserWindow({
    title: `${APP_NAME} v${APP_VERSION}`,
    width: windowState.width || 1400,
    height: windowState.height || 800,
    x: windowState.x,
    y: windowState.y,
    frame: isLinux ? true : false,
    transparent: false,
    show: false,
    icon: import_electron.nativeImage.createFromPath((0, import_path.resolve)(__dirname, "../build/icon.png")),
    webPreferences: {
      preload: (0, import_path.resolve)(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    backgroundColor: "#1a1410",
    vibrancy: isMac ? "under-window" : void 0,
    visualEffectState: isMac ? "followWindow" : void 0,
    titleBarStyle: isMac ? "hiddenInset" : void 0
  });
  mainWindow.setMenuBarVisibility(false);
  if (typeof mainWindow.setTitleBarOverlay === "function") {
    try {
      mainWindow.setTitleBarOverlay({ color: "#1a1410", symbolColor: "#ffffff" });
    } catch {
    }
  }
  let mainShown = false;
  let readyTimeout = null;
  try {
    if (isDev) {
      const devUrl = process.env.ELECTRON_START_URL || "http://localhost:5173";
      console.log(`[Main] Loading dev URL: ${devUrl}`);
      mainWindow.loadURL(devUrl);
      if (isDev) mainWindow.webContents.openDevTools({ mode: "detach" });
    } else {
      const prodFile = (0, import_path.resolve)(__dirname, "../dist/index.html");
      console.log(`[Main] Loading production file: ${prodFile}`);
      mainWindow.loadFile(prodFile);
    }
    readyTimeout = setTimeout(() => {
      if (!mainShown && mainWindow && !mainWindow.isDestroyed()) {
        console.warn("[Main] ready-to-show \u8D85\u65F6\uFF0C\u5F3A\u5236\u663E\u793A\u4E3B\u7A97\u53E3");
        mainShown = true;
        if (splashWindow) {
          try {
            splashWindow.close();
          } catch {
          }
        }
        mainWindow.show();
        mainWindow.focus();
      }
    }, 2e4);
    mainWindow.once("ready-to-show", () => {
      if (mainShown) return;
      mainShown = true;
      if (readyTimeout) clearTimeout(readyTimeout);
      console.log("[Main] ready-to-show \u89E6\u53D1\uFF0C\u663E\u793A\u4E3B\u7A97\u53E3");
      if (splashWindow) {
        try {
          splashWindow.close();
        } catch {
        }
      }
      mainWindow?.show();
      mainWindow?.focus();
    });
    let retryCount = 0;
    mainWindow.webContents.on("did-fail-load", (_e, errorCode, errorDescription, validatedURL) => {
      console.error(`[Main] did-fail-load: code=${errorCode} desc=${errorDescription} url=${validatedURL}`);
      if (!mainShown && retryCount < 3) {
        retryCount++;
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed() && !mainShown) {
            console.log(`[Main] \u91CD\u8BD5\u52A0\u8F7D (\u7B2C ${retryCount} \u6B21)`);
            if (isDev) mainWindow.loadURL(process.env.ELECTRON_START_URL || "http://localhost:5173");
            else mainWindow.loadFile((0, import_path.resolve)(__dirname, "../dist/index.html"));
          }
        }, 1500);
      } else if (!mainShown && retryCount >= 3) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
            <html><body style="font-family:-apple-system,sans-serif;background:#1a1410;color:#fca5a5;padding:40px;text-align:center;">
            <h2>\u7F16\u8F91\u5668\u542F\u52A8\u5931\u8D25</h2>
            <p>\u65E0\u6CD5\u52A0\u8F7D\u672C\u5730\u8D44\u6E90\uFF0C\u8BF7\u91CD\u542F\u5E94\u7528\u6216\u91CD\u65B0\u5B89\u88C5\u3002</p>
            <p style="color:#94a3b8;font-size:12px;margin-top:20px;">\u9519\u8BEF\u4EE3\u7801: ${errorCode}</p>
            </body></html>`)}`);
          mainWindow.show();
          if (splashWindow) {
            try {
              splashWindow.close();
            } catch {
            }
          }
        }
      }
    });
    mainWindow.webContents.on("did-finish-load", () => console.log("[Main] did-finish-load"));
    mainWindow.webContents.on("console-message", (_e, level, message) => console.log(`[Renderer][${level}] ${message}`));
  } catch (err) {
    if (readyTimeout) clearTimeout(readyTimeout);
    const errMsg = err instanceof Error ? err.message : "\u542F\u52A8\u5931\u8D25\uFF0C\u8BF7\u91CD\u65B0\u5B89\u88C5";
    if (splashWindow) showSplashError(errMsg);
    else if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
        <html><body style="font-family:-apple-system,sans-serif;background:#1a1410;color:#fca5a5;padding:40px;text-align:center;">
        <h2>\u7F16\u8F91\u5668\u542F\u52A8\u5931\u8D25</h2><p>${errMsg}</p></body></html>`)}`);
      mainWindow.show();
    }
  }
  mainWindow.on("close", () => {
    if (mainWindow) saveWindowState(mainWindow);
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const cur = mainWindow?.webContents.getURL();
    if (cur) {
      try {
        const curO = new URL(cur);
        const newO = new URL(url);
        if (newO.origin === curO.origin) return;
        event.preventDefault();
        safeOpenExternal(url);
        return;
      } catch {
      }
    }
    if (url.startsWith("data:") || url.startsWith("file:") || url.startsWith("javascript:")) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    safeOpenExternal(url);
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    safeOpenExternal(url);
    return { action: "deny" };
  });
  setupAutoUpdate();
}
__name(createMainWindow, "createMainWindow");
function createPanelWindow() {
  if (!mainWindow) return;
  const mainBounds = mainWindow.getBounds();
  const panelWidth = 560;
  const panelHeight = Math.min(mainBounds.height, 800);
  panelWindow = new import_electron.BrowserWindow({
    title: `${APP_NAME} v${APP_VERSION} - \u7BA1\u7406\u9762\u677F`,
    width: panelWidth,
    height: panelHeight,
    x: mainBounds.x + mainBounds.width + 10,
    y: mainBounds.y,
    frame: isLinux ? true : false,
    transparent: false,
    show: false,
    icon: import_electron.nativeImage.createFromPath((0, import_path.resolve)(__dirname, "../build/icon.png")),
    webPreferences: {
      preload: (0, import_path.resolve)(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    backgroundColor: "#1a1410",
    titleBarStyle: isMac ? "hiddenInset" : void 0
  });
  panelWindow.setMenuBarVisibility(false);
  if (typeof panelWindow.setTitleBarOverlay === "function") {
    try {
      panelWindow.setTitleBarOverlay({ color: "#1a1410", symbolColor: "#ffffff" });
    } catch {
    }
  }
  try {
    if (isDev) {
      const devUrl = process.env.ELECTRON_START_URL || "http://localhost:5173";
      panelWindow.loadURL(`${devUrl}#panel`);
    } else {
      panelWindow.loadFile((0, import_path.resolve)(__dirname, "../dist/index.html"), { hash: "panel" });
    }
  } catch (err) {
    console.error("[Panel] \u52A0\u8F7D\u5931\u8D25:", err);
  }
  panelWindow.once("ready-to-show", () => {
    panelWindow?.show();
    panelWindow?.focus();
  });
  panelWindow.on("closed", () => {
    panelWindow = null;
    mainWindow?.webContents.send("panel:closed");
  });
  panelWindow.webContents.on("will-navigate", (e) => {
    e.preventDefault();
  });
  panelWindow.webContents.setWindowOpenHandler(({ url }) => {
    safeOpenExternal(url);
    return { action: "deny" };
  });
}
__name(createPanelWindow, "createPanelWindow");
function setupMenu() {
  const template = [
    ...isMac ? [{
      label: APP_NAME,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" }
      ]
    }] : [],
    {
      label: "\u6587\u4EF6",
      submenu: [
        { label: "\u65B0\u5EFA\u4F5C\u54C1", accelerator: "CmdOrCtrl+N", click: /* @__PURE__ */ __name(() => mainWindow?.webContents.send("app:new-file"), "click") },
        { label: "\u6253\u5F00\u4F5C\u54C1", accelerator: "CmdOrCtrl+O", click: /* @__PURE__ */ __name(() => mainWindow?.webContents.send("app:open-file"), "click") },
        { label: "\u4FDD\u5B58\u4F5C\u54C1", accelerator: "CmdOrCtrl+S", click: /* @__PURE__ */ __name(() => mainWindow?.webContents.send("app:save-file"), "click") },
        { label: "\u53E6\u5B58\u4E3A", accelerator: "CmdOrCtrl+Shift+S", click: /* @__PURE__ */ __name(() => mainWindow?.webContents.send("app:save-as"), "click") },
        { type: "separator" },
        ...recentFiles.length > 0 ? [{
          label: "\u6700\u8FD1\u6253\u5F00",
          submenu: recentFiles.map((filePath) => ({
            label: filePath,
            click: /* @__PURE__ */ __name(() => mainWindow?.webContents.send("app:open-recent", filePath), "click")
          }))
        }] : [],
        { type: "separator" },
        { label: "\u9000\u51FA", accelerator: isMac ? "Cmd+Q" : "Ctrl+Q", role: "quit" }
      ]
    },
    { label: "\u7F16\u8F91", submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "selectAll" }
    ] },
    { label: "\u89C6\u56FE", submenu: [
      { role: "reload" },
      { role: "forceReload" },
      { type: "separator" },
      { role: "toggleDevTools" },
      { type: "separator" },
      { role: "togglefullscreen" }
    ] },
    { label: "\u5E2E\u52A9", submenu: [
      { label: "\u5173\u4E8E", click: /* @__PURE__ */ __name(() => mainWindow?.webContents.send("app:about"), "click") }
    ] }
  ];
  import_electron.Menu.setApplicationMenu(import_electron.Menu.buildFromTemplate(template));
}
__name(setupMenu, "setupMenu");
function setupTray() {
  const iconPath = (0, import_path.resolve)(__dirname, "../build/icon.png");
  const icon = import_electron.nativeImage.createFromPath(iconPath).resize({ width: isLinux ? 22 : 16, height: isLinux ? 22 : 16 });
  tray = new import_electron.Tray(icon);
  tray.setToolTip(APP_NAME);
  tray.setContextMenu(import_electron.Menu.buildFromTemplate([
    { label: "\u6253\u5F00\u7F16\u8F91\u5668", click: /* @__PURE__ */ __name(() => {
      if (!mainWindow) createMainWindow();
      else {
        mainWindow.show();
        mainWindow.focus();
      }
    }, "click") },
    { type: "separator" },
    { role: "quit" }
  ]));
  tray.on("click", () => {
    if (!mainWindow) createMainWindow();
    else if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
__name(setupTray, "setupTray");
function setupAutoUpdate() {
  if (isDev) return;
  import_electron_updater.autoUpdater.setFeedURL({ provider: "generic", url: "https://subsilicon.cn/releases" });
  import_electron_updater.autoUpdater.autoDownload = false;
  import_electron_updater.autoUpdater.autoInstallOnAppQuit = false;
  import_electron_updater.autoUpdater.on("checking-for-update", () => mainWindow?.webContents.send("update-checking"));
  import_electron_updater.autoUpdater.on("update-available", (info) => mainWindow?.webContents.send("update-available", {
    version: info.version,
    releaseDate: info.releaseDate,
    releaseNotes: info.releaseNotes,
    downloadUrl: DOWNLOAD_PAGE_URL
  }));
  import_electron_updater.autoUpdater.on("update-not-available", () => mainWindow?.webContents.send("update-not-available"));
  import_electron_updater.autoUpdater.on("error", (err) => mainWindow?.webContents.send("update-error", err.message));
  setTimeout(() => {
    import_electron_updater.autoUpdater.checkForUpdates().catch((err) => console.error("[AutoUpdater] \u68C0\u67E5\u66F4\u65B0\u5931\u8D25:", err));
  }, 5e3);
}
__name(setupAutoUpdate, "setupAutoUpdate");
var EXTERNAL_URL_ALLOWED = /^https?:\/\//i;
function safeOpenExternal(url) {
  if (typeof url !== "string") return;
  if (!EXTERNAL_URL_ALLOWED.test(url)) {
    console.warn(`[Security] \u62D2\u7EDD\u6253\u5F00\u975E\u6CD5 URL: ${url}`);
    return;
  }
  import_electron.shell.openExternal(url);
}
__name(safeOpenExternal, "safeOpenExternal");
function setupIPC() {
  import_electron.ipcMain.handle("readFile", async (_, filePath) => {
    try {
      guardPathAccess(filePath, "readFile");
      const data = (0, import_fs.readFileSync)(normPath(filePath));
      return { success: true, data: Array.from(new Uint8Array(data)) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  import_electron.ipcMain.handle("readFileAsText", async (_, filePath) => {
    try {
      guardPathAccess(filePath, "readFileAsText");
      const data = (0, import_fs.readFileSync)(normPath(filePath), "utf-8");
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  import_electron.ipcMain.handle("writeFile", async (_, filePath, data) => {
    try {
      guardPathAccess(filePath, "writeFile");
      const realPath = normPath(filePath);
      const d = (0, import_path.dirname)(realPath);
      if (!(0, import_fs.existsSync)(d)) (0, import_fs.mkdirSync)(d, { recursive: true });
      (0, import_fs.writeFileSync)(realPath, Buffer.from(data));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  import_electron.ipcMain.handle("getFileInfo", async (_, filePath) => {
    try {
      guardPathAccess(filePath, "getFileInfo");
      const realPath = normPath(filePath);
      const stat = (0, import_fs.statSync)(realPath);
      return {
        success: true,
        name: (0, import_path.basename)(realPath),
        size: stat.size,
        type: (0, import_path.extname)(realPath).slice(1)
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  import_electron.ipcMain.handle("getAppPath", () => import_electron.app.getAppPath());
  import_electron.ipcMain.handle("openFileDialog", async (_, options) => {
    try {
      const result = await import_electron.dialog.showOpenDialog(mainWindow, {
        title: options?.title,
        properties: options?.properties || ["openFile"],
        filters: options?.filters || []
      });
      if (result.canceled || result.filePaths.length === 0) return { success: false };
      for (const p of result.filePaths) {
        grantUserChosen(p);
        addRecentFile(p);
      }
      return { success: true, path: result.filePaths[0], filePaths: result.filePaths };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  import_electron.ipcMain.handle("saveFileDialog", async (_, options) => {
    try {
      const result = await import_electron.dialog.showSaveDialog(mainWindow, {
        title: options?.title,
        defaultPath: options?.defaultPath,
        filters: options?.filters || []
      });
      if (result.canceled || !result.filePath) return { success: false };
      grantUserChosen(result.filePath);
      addRecentFile(result.filePath);
      return { success: true, path: result.filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  import_electron.ipcMain.handle("openFolderDialog", async () => {
    try {
      const result = await import_electron.dialog.showOpenDialog(mainWindow, { properties: ["openDirectory"] });
      if (result.canceled || result.filePaths.length === 0) return { success: false };
      grantUserChosen(result.filePaths[0]);
      return { success: true, path: result.filePaths[0] };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  import_electron.ipcMain.handle("getProjectPath", async () => {
    try {
      const result = await import_electron.dialog.showOpenDialog(mainWindow, { properties: ["openDirectory"] });
      if (result.canceled || result.filePaths.length === 0) return { success: false };
      grantUserChosen(result.filePaths[0]);
      return { success: true, path: result.filePaths[0] };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  import_electron.ipcMain.handle("copyToProject", async (_, sourcePath, fileName) => {
    try {
      guardPathAccess(sourcePath, "copyToProject(source)");
      if (!fileName || typeof fileName !== "string") return { success: false, error: "fileName \u4E0D\u80FD\u4E3A\u7A7A" };
      if (fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) {
        return { success: false, error: "fileName \u5305\u542B\u975E\u6CD5\u5B57\u7B26\uFF08\u8DEF\u5F84\u5206\u9694\u7B26\u6216 ..\uFF09\uFF0C\u62D2\u7EDD\u5199\u5165" };
      }
      if (fileName.startsWith(".")) return { success: false, error: "fileName \u4E0D\u5F97\u4E3A\u9690\u85CF\u6587\u4EF6" };
      const r = await import_electron.dialog.showOpenDialog(mainWindow, { properties: ["openDirectory"] });
      if (r.canceled || r.filePaths.length === 0) return { success: false, error: "\u672A\u9009\u62E9\u9879\u76EE\u76EE\u5F55" };
      const projectDir = r.filePaths[0];
      grantUserChosen(projectDir);
      const destPath = (0, import_path.join)(projectDir, fileName);
      guardPathAccess(destPath, "copyToProject(dest)");
      (0, import_fs.copyFileSync)(normPath(sourcePath), normPath(destPath));
      return { success: true, path: destPath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  import_electron.ipcMain.handle("getRecentFiles", async () => {
    try {
      guardPathAccess(getRecentFilesPath(), "getRecentFiles");
      loadRecentFiles();
      return { success: true, files: recentFiles };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  import_electron.ipcMain.handle("getVersion", async () => ({ success: true, version: APP_VERSION }));
  import_electron.ipcMain.handle("app:get-version", async () => ({ success: true, version: APP_VERSION, buildInfo: __BUILD_INFO__ }));
  import_electron.ipcMain.on("minimizeWindow", () => mainWindow?.minimize());
  import_electron.ipcMain.on("maximizeWindow", () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  import_electron.ipcMain.on("closeWindow", () => mainWindow?.close());
  import_electron.ipcMain.on("checkForUpdates", () => {
    if (isDev) {
      mainWindow?.webContents.send("update-checking");
      setTimeout(() => mainWindow?.webContents.send("update-not-available"), 2e3);
      return;
    }
    import_electron_updater.autoUpdater.checkForUpdates().catch((err) => mainWindow?.webContents.send("update-error", err.message));
  });
  import_electron.ipcMain.on("openDownloadPage", () => safeOpenExternal(DOWNLOAD_PAGE_URL));
  import_electron.ipcMain.on("panel:open", () => {
    if (!panelWindow) createPanelWindow();
    else {
      panelWindow.show();
      panelWindow.focus();
    }
  });
  import_electron.ipcMain.on("panel:close", () => panelWindow?.close());
  import_electron.ipcMain.on("panel:sendMessage", (_, message) => panelWindow?.webContents.send("panel:message", message));
  import_electron.ipcMain.on("main:sendMessage", (_, message) => mainWindow?.webContents.send("main:message", message));
  import_electron.ipcMain.on("openExternal", (_e, url) => safeOpenExternal(url));
  import_electron.ipcMain.handle("desktop:build", async (event, payload) => {
    const rawPayload = payload || {};
    const {
      shellDir: rawShellDir,
      platforms: rawPlatforms = ["current"],
      logChannel: rawLogChannel
    } = rawPayload;
    const platforms = Array.isArray(rawPlatforms) ? rawPlatforms : [rawPlatforms];
    for (const p of platforms) {
      if (!BUILD_PLATFORM_WHITELIST.has(p)) {
        return { success: false, error: `\u975E\u6CD5 platforms \u9879: ${p}` };
      }
    }
    let logChannel = null;
    if (rawLogChannel != null && rawLogChannel !== "") {
      if (!LOG_CHANNEL_REGEX.test(String(rawLogChannel))) {
        return { success: false, error: "logChannel \u683C\u5F0F\u975E\u6CD5\uFF0C\u4EC5\u5141\u8BB8\u5B57\u6BCD/\u6570\u5B57/_/- \u4E14\u957F\u5EA6 \u2264 64" };
      }
      logChannel = String(rawLogChannel);
    }
    const shellVerify = verifyShellDir(rawShellDir);
    if (!shellVerify.ok || !shellVerify.resolved) {
      return { success: false, error: shellVerify.error };
    }
    const shellDir = shellVerify.resolved;
    const log = /* @__PURE__ */ __name((level, msg) => {
      if (logChannel) event.sender.send(logChannel, { level, msg });
    }, "log");
    log("info", `[desktop:build] \u5F00\u59CB\u6253\u5305\uFF1A${shellDir} (${platforms.join(",")})`);
    try {
      let builderCli;
      const candidates = [
        (0, import_path.join)(__dirname, "..", "node_modules", "electron-builder", "out", "cli", "cli.js"),
        (0, import_path.join)(__dirname, "..", "node_modules", ".bin", "electron-builder")
      ];
      for (const c of candidates) {
        try {
          if ((0, import_fs.existsSync)(c)) {
            builderCli = c;
            break;
          }
        } catch {
        }
      }
      if (!builderCli) return { success: false, error: "\u672A\u627E\u5230 electron-builder\uFF0C\u7F16\u8F91\u5668\u635F\u574F\u6216\u7F3A\u5C11 node_modules" };
      const flags = [];
      const current = process.platform;
      if (platforms.includes("current")) {
        if (current === "darwin") flags.push("--mac");
        else if (current === "win32") flags.push("--win");
        else flags.push("--linux");
      } else {
        if (platforms.includes("mac")) flags.push("--mac");
        if (platforms.includes("win")) flags.push("--win");
        if (platforms.includes("linux")) flags.push("--linux");
      }
      if (flags.length === 0) flags.push("--dir");
      flags.push("--publish", "never");
      log("info", `[desktop:build] electron-builder \u547D\u4EE4\uFF1Anode ${builderCli} ${flags.join(" ")} (cwd=${shellDir})`);
      return await new Promise((resolve2) => {
        const child = (0, import_node_child_process.spawn)(
          process.execPath,
          [builderCli, ...flags],
          // 4) env 白名单
          { cwd: shellDir, env: buildChildEnv(), stdio: ["ignore", "pipe", "pipe"] }
        );
        child.stdout.on("data", (buf) => log("info", String(buf).replace(/\n$/, "")));
        child.stderr.on("data", (buf) => log("warn", String(buf).replace(/\n$/, "")));
        child.on("error", (err) => {
          log("error", `\u5B50\u8FDB\u7A0B\u9519\u8BEF\uFF1A${err.message}`);
          resolve2({ success: false, error: err.message });
        });
        child.on("close", (code) => {
          log("info", `[desktop:build] electron-builder \u9000\u51FA\u7801 ${code}`);
          const outputDir = (0, import_path.join)(shellDir, "dist");
          guardPathAccess(outputDir, "desktop:build outputDir");
          const outputs = [];
          try {
            if ((0, import_fs.existsSync)(outputDir)) {
              for (const f of (0, import_fs.readdirSync)(outputDir)) {
                const fp = (0, import_path.join)(outputDir, f);
                guardPathAccess(fp, "desktop:build enumerate output file");
                const st = (0, import_fs.statSync)(fp);
                if (st.isFile()) {
                  outputs.push({
                    name: f,
                    path: fp,
                    size: st.size,
                    type: ((0, import_path.extname)(f) || "").slice(1).toLowerCase()
                  });
                }
              }
            }
          } catch {
          }
          if (code === 0) resolve2({ success: true, outputDir, outputs });
          else resolve2({ success: false, error: `electron-builder \u9000\u51FA\u7801 ${code}`, outputDir, outputs });
        });
      });
    } catch (e) {
      return { success: false, error: e && e.message ? e.message : String(e) };
    }
  });
}
__name(setupIPC, "setupIPC");
process.on("uncaughtException", (error) => {
  console.error("[Main] Uncaught Exception:", error);
  if (!isDev) {
    import_electron.dialog.showErrorBox(
      "SubSilicon Editor \xB7 \u8FD0\u884C\u5F02\u5E38",
      `\u672A\u6355\u83B7\u5F02\u5E38: ${error && error.message ? error.message : String(error)}
\u8BF7\u63D0\u4EA4\u53CD\u9988\u4EE5\u4FBF\u4FEE\u590D\u3002`
    );
  }
});
process.on("unhandledRejection", (reason) => {
  console.error("[Main] Unhandled Rejection:", reason);
});
import_electron.app.commandLine.appendSwitch("no-sandbox");
import_electron.app.commandLine.appendSwitch("disable-gpu-sandbox");
import_electron.app.commandLine.appendSwitch("disable-software-rasterizer");
import_electron.app.commandLine.appendSwitch("disable-features", "HardwareMediaKeyHandling,MediaSessionService");
import_electron.app.disableHardwareAcceleration();
import_electron.app.whenReady().then(() => {
  import_electron.app.setName(APP_NAME);
  import_electron.app.setVersion(APP_VERSION);
  initAllowlist();
  migrateRecentFiles();
  loadRecentFiles();
  createSplashWindow();
  setTimeout(() => {
    createMainWindow();
    setupMenu();
    setupTray();
    setupIPC();
  }, 1500);
});
import_electron.app.on("before-quit", () => {
  mainWindow?.webContents.send("app-quit");
});
import_electron.app.on("window-all-closed", () => {
  if (!isMac) import_electron.app.quit();
});
import_electron.app.on("activate", () => {
  if (!mainWindow) createMainWindow();
});
import_electron.app.on("open-file", (_, filePath) => {
  if (!mainWindow) createMainWindow();
  setTimeout(() => {
    mainWindow?.webContents.send("app:open-file-with-path", filePath);
  }, 500);
});
