import { app, BrowserWindow, ipcMain, dialog, Menu, Tray, nativeImage, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join, resolve, basename, dirname, extname, sep } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, copyFileSync, readdirSync } from 'fs'
import { spawn } from 'node:child_process'

// ============================================================
// 常量
// ============================================================
const APP_NAME = 'SubSilicon Editor'
const PROJECT_DIR_NAME = '.subsilicon'
const DOWNLOAD_PAGE_URL = 'https://subsilicon.cn/download'

const isDev = !app.isPackaged
const isMac = process.platform === 'darwin'
const isWin = process.platform === 'win32'
const isLinux = process.platform === 'linux'

// ============================================================
// P0-1 路径授权 Allowlist 机制
// ============================================================
const ALLOWED_PATHS = new Set<string>()

function normPath(p: string): string {
  let resolved = resolve(String(p || ''))
  if (isWin && /^[a-z]:\\/.test(resolved)) {
    resolved = resolved.charAt(0).toUpperCase() + resolved.slice(1)
  }
  return resolved
}

function initAllowlist(): void {
  const grant = (p: string) => { try { ALLOWED_PATHS.add(normPath(p)) } catch {} }
  try { grant(app.getPath('userData')) } catch {}
  try { grant(app.getPath('temp')) } catch {}
  try { grant(app.getPath('documents')) } catch {}
  try { grant(app.getPath('desktop')) } catch {}
  try { grant(app.getPath('downloads')) } catch {}
  try { grant(app.getAppPath()) } catch {}
  try { grant(__dirname) } catch {}
  try { grant(join(__dirname, '..')) } catch {}
  // 项目专属目录 .subsilicon
  try { grant(getProjectDir()) } catch {}
}

function isPathAllowed(rawPath: string): boolean {
  if (!rawPath) return false
  const target = normPath(rawPath)
  if (ALLOWED_PATHS.has(target)) return true
  for (const allowed of ALLOWED_PATHS) {
    const prefix = allowed.endsWith(sep) ? allowed : allowed + sep
    if (target.startsWith(prefix)) return true
  }
  return false
}

function guardPathAccess(filePath: string, operation: string): void {
  if (!isPathAllowed(filePath)) {
    const err = new Error(`[Security] ${operation} 路径未授权: ${filePath}`)
    console.error(err.message)
    throw err
  }
}

function grantUserChosen(chosenPath: string): void {
  if (!chosenPath) return
  const p = normPath(chosenPath)
  ALLOWED_PATHS.add(p)
  try {
    const st = statSync(p)
    if (st.isFile()) ALLOWED_PATHS.add(dirname(p))
  } catch {
    ALLOWED_PATHS.add(dirname(p))
  }
}

function migrateRecentFiles(): void {
  // 迁移两种可能的老路径：1) getProjectDir()/recent-files.json  2) userData/recent-files.json
  const sources = [
    join(getProjectDir(), 'recent-files.json'),
  ]
  try {
    const legacy = join(app.getPath('userData'), 'recent-files.json')
    if (existsSync(legacy)) sources.push(legacy)
  } catch {}
  for (const recentFilesPath of sources) {
    try {
      if (existsSync(recentFilesPath)) {
        const data = JSON.parse(readFileSync(recentFilesPath, 'utf8'))
        const files = Array.isArray(data) ? data : []
        for (const f of files) {
          const fp = typeof f === 'string' ? f : f && (f as any).path
          if (fp) {
            try { ALLOWED_PATHS.add(dirname(normPath(fp))) } catch {}
          }
        }
      }
    } catch (e: any) {
      console.warn('[Security] migrateRecentFiles 失败，忽略：', e && e.message)
    }
  }
}

// ============================================================
// P0-2 desktop:build 加固辅助
// ============================================================
const BUILD_PLATFORM_WHITELIST = new Set(['current', 'mac', 'win', 'linux'])
const BUILD_ENV_WHITELIST = new Set([
  'HOME', 'PATH', 'USER', 'USERPROFILE',
  'TMPDIR', 'TEMP', 'TMP',
  'LANG', 'LC_ALL', 'LC_CTYPE',
  'APPDATA', 'LOCALAPPDATA',
  'XDG_CACHE_HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME',
  'SHELL',
  'npm_config_user_agent', 'npm_node_execpath', 'NPM_CLI_JS',
  'NODE', 'NODE_ENV',
])
const SHELL_SIGNATURE_KEY = '_subsiliconStandaloneShell'
const LOG_CHANNEL_REGEX = /^[a-zA-Z0-9_-]{1,64}$/

function verifyShellDir(shellDir: string): { ok: boolean; error?: string; resolved?: string } {
  const resolved = normPath(shellDir)
  if (!isPathAllowed(resolved)) {
    return { ok: false, error: `shellDir 未授权，请先通过"选择输出目录"对话框选择：${shellDir}` }
  }
  const pkgPath = join(resolved, 'package.json')
  if (!existsSync(pkgPath)) {
    return { ok: false, error: `shellDir 中不存在 package.json：${pkgPath}` }
  }
  let pkg: any
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  } catch (e: any) {
    return { ok: false, error: `package.json 解析失败：${e.message}` }
  }
  if (pkg[SHELL_SIGNATURE_KEY] !== true) {
    return { ok: false, error: 'shellDir 不是官方壳模板（缺少 _subsiliconStandaloneShell 签名），拒绝打包' }
  }
  return { ok: true, resolved }
}

function buildChildEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  for (const k of BUILD_ENV_WHITELIST) {
    if (process.env[k] !== undefined) env[k] = process.env[k]
  }
  return env
}

// ============================================================
// 全局状态
// ============================================================
let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null
let panelWindow: BrowserWindow | null = null
let tray: Tray | null = null
let recentFiles: string[] = []

// ============================================================
// 项目 & 最近文件存储（统一走 getProjectDir() = userData/.subsilicon）
// ============================================================
function getProjectDir(): string {
  const userData = app.getPath('userData')
  const projectDir = join(userData, PROJECT_DIR_NAME)
  if (!existsSync(projectDir)) mkdirSync(projectDir, { recursive: true })
  return projectDir
}

function getRecentFilesPath(): string {
  return join(getProjectDir(), 'recent-files.json')
}

function loadRecentFiles(): void {
  const p = getRecentFilesPath()
  if (existsSync(p)) {
    try {
      const data = JSON.parse(readFileSync(p, 'utf8'))
      recentFiles = Array.isArray(data) ? (data as string[]) : []
    } catch {
      recentFiles = []
    }
  } else {
    // 兼容老路径：userData/recent-files.json（main.cjs 老版本存的地方）
    try {
      const legacy = join(app.getPath('userData'), 'recent-files.json')
      if (existsSync(legacy)) {
        const data = JSON.parse(readFileSync(legacy, 'utf8'))
        recentFiles = Array.isArray(data) ? (data as string[]) : []
        // 迁移到新路径
        saveRecentFiles()
      }
    } catch { recentFiles = [] }
  }
}

function saveRecentFiles(): void {
  const p = getRecentFilesPath()
  writeFileSync(p, JSON.stringify(recentFiles.slice(0, 10), null, 2), 'utf-8')
}

function addRecentFile(filePath: string): void {
  recentFiles = recentFiles.filter((f) => f !== filePath)
  recentFiles.unshift(filePath)
  recentFiles = recentFiles.slice(0, 10)
  saveRecentFiles()
  // 新建的项目立即授权，避免下次 write 被 guard 拦
  grantUserChosen(filePath)
}

// ============================================================
// 窗口状态持久化
// ============================================================
function loadWindowState(): { width?: number; height?: number; x?: number; y?: number } {
  const p = join(getProjectDir(), 'window-state.json')
  if (existsSync(p)) {
    try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return {} }
  }
  return {}
}

function saveWindowState(win: BrowserWindow): void {
  const p = join(getProjectDir(), 'window-state.json')
  writeFileSync(p, JSON.stringify(win.getBounds(), null, 2), 'utf-8')
}

// ============================================================
// Splash 启动图
// ============================================================
function createSplashWindow(): void {
  splashWindow = new BrowserWindow({
    width: 500,
    height: 380,
    frame: false,
    transparent: !isLinux,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: isLinux ? '#1a1410' : undefined,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })
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
<div class="loading-text" id="loading-text">正在加载编辑器引擎...</div>
<div class="error-msg" id="error-msg"><p id="error-text"></p>
<button class="retry-btn" onclick="window.__retryApp()">重试</button></div>
<script>
setTimeout(function(){document.getElementById('progress-bar').style.width='70%';},100);
setTimeout(function(){document.getElementById('progress-bar').style.width='90%';document.getElementById('loading-text').textContent='即将启动...';},5000);
setTimeout(function(){var b=document.getElementById('progress-bar');if(b.style.width!=='100%'){b.style.width='100%';}},25000);
</script></body></html>`
  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`)
  splashWindow.on('closed', () => { splashWindow = null })
}

function showSplashError(message: string): void {
  if (!splashWindow) return
  splashWindow.webContents.executeJavaScript(`
    document.getElementById('progress-bar').style.background = '#ef4444';
    document.getElementById('loading-text').textContent = '⚠️ ' + ${JSON.stringify(message)};
    document.getElementById('loading-text').style.color = '#fca5a5';
    document.getElementById('error-msg').classList.add('visible');
    document.getElementById('error-text').textContent = '启动引擎失败，请尝试重新安装或查看帮助文档。';
    window.__retryApp = function() { window.location.href = 'app://retry'; };
  `)
  splashWindow.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('app://retry')) {
      e.preventDefault()
      app.relaunch()
      app.exit(0)
    }
  })
}

// ============================================================
// 主窗口
// ============================================================
async function createMainWindow(): Promise<void> {
  const windowState = loadWindowState()
  mainWindow = new BrowserWindow({
    title: APP_NAME,
    width: windowState.width || 1400,
    height: windowState.height || 800,
    x: windowState.x,
    y: windowState.y,
    frame: isLinux ? true : false,
    transparent: false,
    show: false,
    icon: nativeImage.createFromPath(resolve(__dirname, '../build/icon.png')),
    webPreferences: {
      preload: resolve(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    backgroundColor: '#1a1410',
    vibrancy: isMac ? ('under-window' as const) : undefined,
    visualEffectState: isMac ? 'followWindow' : undefined,
    titleBarStyle: isMac ? 'hiddenInset' : undefined,
  })
  mainWindow.setMenuBarVisibility(false)
  if (typeof (mainWindow as any).setTitleBarOverlay === 'function') {
    try { (mainWindow as any).setTitleBarOverlay({ color: '#1a1410', symbolColor: '#ffffff' }) } catch {}
  }

  let mainShown = false
  let readyTimeout: NodeJS.Timeout | null = null

  try {
    if (isDev) {
      const devUrl = process.env.ELECTRON_START_URL || 'http://localhost:5173'
      console.log(`[Main] Loading dev URL: ${devUrl}`)
      mainWindow.loadURL(devUrl)
      if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' })
    } else {
      const prodFile = resolve(__dirname, '../dist/index.html')
      console.log(`[Main] Loading production file: ${prodFile}`)
      mainWindow.loadFile(prodFile)
    }
    readyTimeout = setTimeout(() => {
      if (!mainShown && mainWindow && !mainWindow.isDestroyed()) {
        console.warn('[Main] ready-to-show 超时，强制显示主窗口')
        mainShown = true
        if (splashWindow) { try { splashWindow.close() } catch {} }
        mainWindow.show()
        mainWindow.focus()
      }
    }, 20000)

    mainWindow.once('ready-to-show', () => {
      if (mainShown) return
      mainShown = true
      if (readyTimeout) clearTimeout(readyTimeout)
      console.log('[Main] ready-to-show 触发，显示主窗口')
      if (splashWindow) { try { splashWindow.close() } catch {} }
      mainWindow?.show()
      mainWindow?.focus()
    })

    let retryCount = 0
    mainWindow.webContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL) => {
      console.error(`[Main] did-fail-load: code=${errorCode} desc=${errorDescription} url=${validatedURL}`)
      if (!mainShown && retryCount < 3) {
        retryCount++
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed() && !mainShown) {
            console.log(`[Main] 重试加载 (第 ${retryCount} 次)`)
            if (isDev) mainWindow.loadURL(process.env.ELECTRON_START_URL || 'http://localhost:5173')
            else mainWindow.loadFile(resolve(__dirname, '../dist/index.html'))
          }
        }, 1500)
      } else if (!mainShown && retryCount >= 3) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
            <html><body style="font-family:-apple-system,sans-serif;background:#1a1410;color:#fca5a5;padding:40px;text-align:center;">
            <h2>编辑器启动失败</h2>
            <p>无法加载本地资源，请重启应用或重新安装。</p>
            <p style="color:#94a3b8;font-size:12px;margin-top:20px;">错误代码: ${errorCode}</p>
            </body></html>`)}`)
          mainWindow.show()
          if (splashWindow) { try { splashWindow.close() } catch {} }
        }
      }
    })
    mainWindow.webContents.on('did-finish-load', () => console.log('[Main] did-finish-load'))
    mainWindow.webContents.on('console-message', (_e, level, message) =>
      console.log(`[Renderer][${level}] ${message}`))
  } catch (err: any) {
    if (readyTimeout) clearTimeout(readyTimeout)
    const errMsg = err instanceof Error ? err.message : '启动失败，请重新安装'
    if (splashWindow) showSplashError(errMsg)
    else if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
        <html><body style="font-family:-apple-system,sans-serif;background:#1a1410;color:#fca5a5;padding:40px;text-align:center;">
        <h2>编辑器启动失败</h2><p>${errMsg}</p></body></html>`)}`)
      mainWindow.show()
    }
  }

  mainWindow.on('close', () => { if (mainWindow) saveWindowState(mainWindow) })
  mainWindow.on('closed', () => { mainWindow = null })

  // P0-1 will-navigate：双保险策略（仅允许同源，外链用 shell.openExternal 打开系统浏览器）
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const cur = mainWindow?.webContents.getURL()
    if (cur) {
      try {
        const curO = new URL(cur)
        const newO = new URL(url)
        if (newO.origin === curO.origin) return  // 同源放行
        // 非同源：拦截 + 系统浏览器打开
        event.preventDefault()
        safeOpenExternal(url)
        return
      } catch {}
    }
    // 无法判断同源时一律拒绝（data: 等特殊 URL）
    if (url.startsWith('data:') || url.startsWith('file:') || url.startsWith('javascript:')) {
      event.preventDefault()
      return
    }
    event.preventDefault()
    safeOpenExternal(url)
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    safeOpenExternal(url)
    return { action: 'deny' }
  })

  setupAutoUpdate()
}

// ============================================================
// Panel 管理窗口
// ============================================================
function createPanelWindow(): void {
  if (!mainWindow) return
  const mainBounds = mainWindow.getBounds()
  const panelWidth = 560
  const panelHeight = Math.min(mainBounds.height, 800)

  panelWindow = new BrowserWindow({
    title: `${APP_NAME} - 管理面板`,
    width: panelWidth,
    height: panelHeight,
    x: mainBounds.x + mainBounds.width + 10,
    y: mainBounds.y,
    frame: isLinux ? true : false,
    transparent: false,
    show: false,
    icon: nativeImage.createFromPath(resolve(__dirname, '../build/icon.png')),
    webPreferences: {
      preload: resolve(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    backgroundColor: '#1a1410',
    titleBarStyle: isMac ? 'hiddenInset' : undefined,
  })
  panelWindow.setMenuBarVisibility(false)
  if (typeof (panelWindow as any).setTitleBarOverlay === 'function') {
    try { (panelWindow as any).setTitleBarOverlay({ color: '#1a1410', symbolColor: '#ffffff' }) } catch {}
  }
  try {
    if (isDev) {
      const devUrl = process.env.ELECTRON_START_URL || 'http://localhost:5173'
      panelWindow.loadURL(`${devUrl}#panel`)
    } else {
      panelWindow.loadFile(resolve(__dirname, '../dist/index.html'), { hash: 'panel' })
    }
  } catch (err) { console.error('[Panel] 加载失败:', err) }

  panelWindow.once('ready-to-show', () => { panelWindow?.show(); panelWindow?.focus() })
  panelWindow.on('closed', () => { panelWindow = null; mainWindow?.webContents.send('panel:closed') })
  panelWindow.webContents.on('will-navigate', (e) => { e.preventDefault() })
  panelWindow.webContents.setWindowOpenHandler(({ url }) => {
    safeOpenExternal(url); return { action: 'deny' }
  })
}

// ============================================================
// Menu + Tray
// ============================================================
function setupMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: APP_NAME,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),
    {
      label: '文件',
      submenu: [
        { label: '新建作品', accelerator: 'CmdOrCtrl+N', click: () => mainWindow?.webContents.send('app:new-file') },
        { label: '打开作品', accelerator: 'CmdOrCtrl+O', click: () => mainWindow?.webContents.send('app:open-file') },
        { label: '保存作品', accelerator: 'CmdOrCtrl+S', click: () => mainWindow?.webContents.send('app:save-file') },
        { label: '另存为', accelerator: 'CmdOrCtrl+Shift+S', click: () => mainWindow?.webContents.send('app:save-as') },
        { type: 'separator' },
        ...(recentFiles.length > 0 ? [{
          label: '最近打开',
          submenu: recentFiles.map((filePath) => ({
            label: filePath,
            click: () => mainWindow?.webContents.send('app:open-recent', filePath),
          })),
        }] : []),
        { type: 'separator' },
        { label: '退出', accelerator: isMac ? 'Cmd+Q' : 'Ctrl+Q', role: 'quit' },
      ],
    },
    { label: '编辑', submenu: [
      { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
    ]},
    { label: '视图', submenu: [
      { role: 'reload' }, { role: 'forceReload' }, { type: 'separator' },
      { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'togglefullscreen' },
    ]},
    { label: '帮助', submenu: [
      { label: '关于', click: () => mainWindow?.webContents.send('app:about') },
    ]},
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function setupTray(): void {
  const iconPath = resolve(__dirname, '../build/icon.png')
  const icon = nativeImage.createFromPath(iconPath)
    .resize({ width: isLinux ? 22 : 16, height: isLinux ? 22 : 16 })
  tray = new Tray(icon)
  tray.setToolTip(APP_NAME)
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开编辑器', click: () => {
      if (!mainWindow) createMainWindow()
      else { mainWindow.show(); mainWindow.focus() }
    }},
    { type: 'separator' },
    { role: 'quit' },
  ]))
  tray.on('click', () => {
    if (!mainWindow) createMainWindow()
    else if (mainWindow.isVisible()) { mainWindow.hide() }
    else { mainWindow.show(); mainWindow.focus() }
  })
}

// ============================================================
// Auto Update（统一短名事件 + Mac 未签名走下载页）
// ============================================================
function setupAutoUpdate(): void {
  if (isDev) return
  autoUpdater.setFeedURL({ provider: 'generic', url: 'https://subsilicon.cn/releases' })
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('checking-for-update', () => mainWindow?.webContents.send('update-checking'))
  autoUpdater.on('update-available', (info) => mainWindow?.webContents.send('update-available', {
    version: info.version,
    releaseDate: info.releaseDate,
    releaseNotes: info.releaseNotes,
    downloadUrl: DOWNLOAD_PAGE_URL,
  }))
  autoUpdater.on('update-not-available', () => mainWindow?.webContents.send('update-not-available'))
  autoUpdater.on('error', (err) => mainWindow?.webContents.send('update-error', err.message))

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) =>
      console.error('[AutoUpdater] 检查更新失败:', err))
  }, 5000)
}

// ============================================================
// openExternal 协议白名单
// ============================================================
const EXTERNAL_URL_ALLOWED = /^https?:\/\//i
function safeOpenExternal(url: string): void {
  if (typeof url !== 'string') return
  if (!EXTERNAL_URL_ALLOWED.test(url)) {
    console.warn(`[Security] 拒绝打开非法 URL: ${url}`)
    return
  }
  shell.openExternal(url)
}

// ============================================================
// IPC Handlers（统一短名）
// ============================================================
function setupIPC(): void {
  // ---- File handlers ----
  ipcMain.handle('readFile', async (_, filePath: string) => {
    try {
      guardPathAccess(filePath, 'readFile')
      const data = readFileSync(normPath(filePath))
      return { success: true, data: Array.from(new Uint8Array(data)) }
    } catch (err: any) { return { success: false, error: (err as Error).message } }
  })
  ipcMain.handle('readFileAsText', async (_, filePath: string) => {
    try {
      guardPathAccess(filePath, 'readFileAsText')
      const data = readFileSync(normPath(filePath), 'utf-8')
      return { success: true, data }
    } catch (err: any) { return { success: false, error: (err as Error).message } }
  })
  ipcMain.handle('writeFile', async (_, filePath: string, data: number[]) => {
    try {
      guardPathAccess(filePath, 'writeFile')
      const realPath = normPath(filePath)
      const d = dirname(realPath)
      if (!existsSync(d)) mkdirSync(d, { recursive: true })
      writeFileSync(realPath, Buffer.from(data))
      return { success: true }
    } catch (err: any) { return { success: false, error: (err as Error).message } }
  })
  ipcMain.handle('getFileInfo', async (_, filePath: string) => {
    try {
      guardPathAccess(filePath, 'getFileInfo')
      const realPath = normPath(filePath)
      const stat = statSync(realPath)
      return {
        success: true,
        name: basename(realPath),
        size: stat.size,
        type: extname(realPath).slice(1),
      }
    } catch (err: any) { return { success: false, error: (err as Error).message } }
  })
  ipcMain.handle('getAppPath', () => app.getAppPath())

  // ---- Dialog handlers（用户显式选择后 grantUserChosen）----
  ipcMain.handle('openFileDialog', async (_, options?: {
    title?: string; filters?: Array<{ name: string; extensions: string[] }>; properties?: string[]
  }) => {
    try {
      const result = await dialog.showOpenDialog(mainWindow!, {
        title: options?.title,
        properties: (options?.properties as any) || ['openFile'],
        filters: options?.filters || [],
      })
      if (result.canceled || result.filePaths.length === 0) return { success: false }
      for (const p of result.filePaths) { grantUserChosen(p); addRecentFile(p) }
      return { success: true, path: result.filePaths[0], filePaths: result.filePaths }
    } catch (err: any) { return { success: false, error: (err as Error).message } }
  })
  ipcMain.handle('saveFileDialog', async (_, options?: {
    title?: string; defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }>
  }) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow!, {
        title: options?.title,
        defaultPath: options?.defaultPath,
        filters: options?.filters || [],
      })
      if (result.canceled || !result.filePath) return { success: false }
      grantUserChosen(result.filePath); addRecentFile(result.filePath)
      return { success: true, path: result.filePath }
    } catch (err: any) { return { success: false, error: (err as Error).message } }
  })
  ipcMain.handle('openFolderDialog', async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory'] })
      if (result.canceled || result.filePaths.length === 0) return { success: false }
      grantUserChosen(result.filePaths[0])
      return { success: true, path: result.filePaths[0] }
    } catch (err: any) { return { success: false, error: (err as Error).message } }
  })
  ipcMain.handle('getProjectPath', async () => {
    // DTS 语义：弹系统目录选择对话框，不是返回内部目录
    try {
      const result = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory'] })
      if (result.canceled || result.filePaths.length === 0) return { success: false }
      grantUserChosen(result.filePaths[0])
      return { success: true, path: result.filePaths[0] }
    } catch (err: any) { return { success: false, error: (err as Error).message } }
  })
  ipcMain.handle('copyToProject', async (_, sourcePath: string, fileName: string) => {
    try {
      guardPathAccess(sourcePath, 'copyToProject(source)')
      if (!fileName || typeof fileName !== 'string') return { success: false, error: 'fileName 不能为空' }
      if (fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) {
        return { success: false, error: 'fileName 包含非法字符（路径分隔符或 ..），拒绝写入' }
      }
      if (fileName.startsWith('.')) return { success: false, error: 'fileName 不得为隐藏文件' }
      const r = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory'] })
      if (r.canceled || r.filePaths.length === 0) return { success: false, error: '未选择项目目录' }
      const projectDir = r.filePaths[0]
      grantUserChosen(projectDir)
      const destPath = join(projectDir, fileName)
      guardPathAccess(destPath, 'copyToProject(dest)')
      copyFileSync(normPath(sourcePath), normPath(destPath))
      return { success: true, path: destPath }
    } catch (err: any) { return { success: false, error: (err as Error).message } }
  })
  ipcMain.handle('getRecentFiles', async () => {
    try {
      // recentFilesPath 在 getProjectDir() 内，默认已授权；guard 一次以防万一
      guardPathAccess(getRecentFilesPath(), 'getRecentFiles')
      loadRecentFiles()
      return { success: true, files: recentFiles }
    } catch (err: any) { return { success: false, error: (err as Error).message } }
  })
  ipcMain.handle('getVersion', async () => ({ success: true, version: app.getVersion() }))

  // ---- Window control ----
  ipcMain.on('minimizeWindow', () => mainWindow?.minimize())
  ipcMain.on('maximizeWindow', () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.on('closeWindow', () => mainWindow?.close())

  // ---- Update ----
  ipcMain.on('checkForUpdates', () => {
    if (isDev) {
      mainWindow?.webContents.send('update-checking')
      setTimeout(() => mainWindow?.webContents.send('update-not-available'), 2000)
      return
    }
    autoUpdater.checkForUpdates().catch((err) =>
      mainWindow?.webContents.send('update-error', err.message))
  })
  ipcMain.on('openDownloadPage', () => safeOpenExternal(DOWNLOAD_PAGE_URL))

  // ---- Panel ----
  ipcMain.on('panel:open', () => {
    if (!panelWindow) createPanelWindow()
    else { panelWindow.show(); panelWindow.focus() }
  })
  ipcMain.on('panel:close', () => panelWindow?.close())
  ipcMain.on('panel:sendMessage', (_, message) => panelWindow?.webContents.send('panel:message', message))
  ipcMain.on('main:sendMessage', (_, message) => mainWindow?.webContents.send('main:message', message))

  // ---- External URL（协议白名单守门）----
  ipcMain.on('openExternal', (_e, url) => safeOpenExternal(url))

  // ---- desktop:build（P0-2 全套 5 层加固）----
  ipcMain.handle('desktop:build', async (event, payload: any) => {
    const rawPayload = payload || {}
    const {
      shellDir: rawShellDir,
      platforms: rawPlatforms = ['current'],
      logChannel: rawLogChannel,
    } = rawPayload

    // 1) platforms 白名单
    const platforms = Array.isArray(rawPlatforms) ? rawPlatforms : [rawPlatforms]
    for (const p of platforms) {
      if (!BUILD_PLATFORM_WHITELIST.has(p)) {
        return { success: false, error: `非法 platforms 项: ${p}` }
      }
    }
    // 2) logChannel 字符集限制
    let logChannel: string | null = null
    if (rawLogChannel != null && rawLogChannel !== '') {
      if (!LOG_CHANNEL_REGEX.test(String(rawLogChannel))) {
        return { success: false, error: 'logChannel 格式非法，仅允许字母/数字/_/- 且长度 ≤ 64' }
      }
      logChannel = String(rawLogChannel)
    }
    // 3) shellDir 授权 + 签名双重校验
    const shellVerify = verifyShellDir(rawShellDir)
    if (!shellVerify.ok || !shellVerify.resolved) {
      return { success: false, error: shellVerify.error }
    }
    const shellDir = shellVerify.resolved
    const log = (level: 'info' | 'warn' | 'error', msg: string) => {
      if (logChannel) event.sender.send(logChannel, { level, msg })
    }
    log('info', `[desktop:build] 开始打包：${shellDir} (${platforms.join(',')})`)
    try {
      let builderCli: string | undefined
      const candidates = [
        join(__dirname, '..', 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js'),
        join(__dirname, '..', 'node_modules', '.bin', 'electron-builder'),
      ]
      for (const c of candidates) {
        try { if (existsSync(c)) { builderCli = c; break } } catch {}
      }
      if (!builderCli) return { success: false, error: '未找到 electron-builder，编辑器损坏或缺少 node_modules' }

      const flags: string[] = []
      const current = process.platform
      if (platforms.includes('current')) {
        if (current === 'darwin') flags.push('--mac')
        else if (current === 'win32') flags.push('--win')
        else flags.push('--linux')
      } else {
        if (platforms.includes('mac')) flags.push('--mac')
        if (platforms.includes('win')) flags.push('--win')
        if (platforms.includes('linux')) flags.push('--linux')
      }
      if (flags.length === 0) flags.push('--dir')
      flags.push('--publish', 'never')
      log('info', `[desktop:build] electron-builder 命令：node ${builderCli} ${flags.join(' ')} (cwd=${shellDir})`)

      return await new Promise<any>((resolve) => {
        const child = spawn(
          process.execPath,
          [builderCli!, ...flags],
          // 4) env 白名单
          { cwd: shellDir, env: buildChildEnv(), stdio: ['ignore', 'pipe', 'pipe'] }
        )
        child.stdout.on('data', (buf) => log('info', String(buf).replace(/\n$/, '')))
        child.stderr.on('data', (buf) => log('warn', String(buf).replace(/\n$/, '')))
        child.on('error', (err: Error) => {
          log('error', `子进程错误：${err.message}`)
          resolve({ success: false, error: err.message })
        })
                child.on('close', (code) => {
          log('info', `[desktop:build] electron-builder 退出码 ${code}`)
          const outputDir = join(shellDir, 'dist')
          // C1. 产物输出目录 guard（shellDir 已授权，显式 guard 增加一层安全）
          guardPathAccess(outputDir, 'desktop:build outputDir')
          const outputs: any[] = []
          try {
            if (existsSync(outputDir)) {
              for (const f of readdirSync(outputDir)) {
                const fp = join(outputDir, f)
                // C1. 每个产物文件访问前 guard（防止路径穿越 / 意外文件）
                guardPathAccess(fp, 'desktop:build enumerate output file')
                const st = statSync(fp)
                if (st.isFile()) {
                  outputs.push({
                    name: f, path: fp, size: st.size,
                    type: (extname(f) || '').slice(1).toLowerCase(),
                  })
                }
              }
            }
          } catch {}
          if (code === 0) resolve({ success: true, outputDir, outputs })
          else resolve({ success: false, error: `electron-builder 退出码 ${code}`, outputDir, outputs })
        })
      })
    } catch (e: any) {
      return { success: false, error: e && e.message ? e.message : String(e) }
    }
  })
}

// ============================================================
// 全局异常兜底
// ============================================================
process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught Exception:', error)
  if (!isDev) {
    dialog.showErrorBox('SubSilicon Editor · 运行异常',
      `未捕获异常: ${error && error.message ? error.message : String(error)}\n请提交反馈以便修复。`)
  }
})
process.on('unhandledRejection', (reason) => {
  console.error('[Main] Unhandled Rejection:', reason)
})

// ============================================================
// Electron launch flags（保持 TS 原版本：避免 Linux/部分 Mac GPU 崩溃）
// ============================================================
app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-gpu-sandbox')
app.commandLine.appendSwitch('disable-software-rasterizer')
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,MediaSessionService')
app.disableHardwareAcceleration()

// ============================================================
// App lifecycle
// ============================================================
app.whenReady().then(() => {
  initAllowlist()
  migrateRecentFiles()
  loadRecentFiles()
  createSplashWindow()
  setTimeout(() => {
    createMainWindow()
    setupMenu()
    setupTray()
    setupIPC()
  }, 1500)
})

app.on('before-quit', () => {
  mainWindow?.webContents.send('app-quit')
})
app.on('window-all-closed', () => { if (!isMac) app.quit() })
app.on('activate', () => { if (!mainWindow) createMainWindow() })
app.on('open-file', (_, filePath) => {
  if (!mainWindow) createMainWindow()
  setTimeout(() => {
    mainWindow?.webContents.send('app:open-file-with-path', filePath)
  }, 500)
})
