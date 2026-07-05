import { app, BrowserWindow, ipcMain, dialog, Menu, Tray, nativeImage, autoUpdater } from 'electron'
import { join, resolve } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, copyFileSync } from 'fs'

const isDev = !app.isPackaged
const isMac = process.platform === 'darwin'
const isWin = process.platform === 'win32'
const isLinux = process.platform === 'linux'

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null
let tray: Tray | null = null
let recentFiles: string[] = []

const APP_NAME = 'SubSilicon Editor'
const PROJECT_DIR_NAME = '.subsilicon'

function getProjectDir(): string {
  const userData = app.getPath('userData')
  const projectDir = join(userData, PROJECT_DIR_NAME)
  if (!existsSync(projectDir)) {
    mkdirSync(projectDir, { recursive: true })
  }
  return projectDir
}

function getRecentFilesPath(): string {
  return join(getProjectDir(), 'recent-files.json')
}

function loadRecentFiles(): void {
  const path = getRecentFilesPath()
  if (existsSync(path)) {
    try {
      recentFiles = JSON.parse(readFileSync(path, 'utf-8'))
    } catch {
      recentFiles = []
    }
  }
}

function saveRecentFiles(): void {
  const path = getRecentFilesPath()
  writeFileSync(path, JSON.stringify(recentFiles.slice(0, 10), null, 2), 'utf-8')
}

function addRecentFile(filePath: string): void {
  recentFiles = recentFiles.filter(f => f !== filePath)
  recentFiles.unshift(filePath)
  saveRecentFiles()
}

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
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  const splashHtml = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>SubSilicon Editor</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: #1a1410;
          background-image:
            radial-gradient(circle at 25% 25%, hsl(185 35% 55% / 0.12) 0%, transparent 45%),
            radial-gradient(circle at 75% 75%, hsl(25 65% 55% / 0.15) 0%, transparent 45%),
            linear-gradient(135deg, #1a1410 0%, #221a14 50%, #1a1410 100%);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          overflow: hidden;
          color: #fff;
        }
        .logo-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          position: relative;
          z-index: 2;
        }
        .logo {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #f59e0b, #ef4444);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 36px;
          font-weight: bold;
          color: white;
          box-shadow: 0 8px 32px rgba(245, 158, 11, 0.3), 0 0 0 1px rgba(255,255,255,0.08);
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 8px 32px rgba(245, 158, 11, 0.3), 0 0 0 1px rgba(255,255,255,0.08); }
          50% { transform: scale(1.05); box-shadow: 0 12px 48px rgba(245, 158, 11, 0.45), 0 0 0 1px rgba(255,255,255,0.12); }
        }
        .title {
          font-size: 24px;
          font-weight: 600;
          color: #ffffff;
          letter-spacing: 2px;
        }
        .subtitle {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.55);
          margin-top: 4px;
          letter-spacing: 1px;
        }
        .progress-container {
          width: 200px;
          height: 3px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 2px;
          margin-top: 30px;
          overflow: hidden;
        }
        .progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #f59e0b, #ef4444);
          width: 0%;
          transition: width 2s ease-out;
        }
        .loading-text {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          margin-top: 12px;
          transition: opacity 0.3s;
        }
        .error-msg {
          display: none;
          text-align: center;
          margin-top: 20px;
          padding: 12px 24px;
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 10px;
        }
        .error-msg.visible {
          display: block;
        }
        .error-msg p {
          color: #fca5a5;
          font-size: 13px;
          line-height: 1.5;
        }
        .retry-btn {
          margin-top: 12px;
          padding: 8px 20px;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .retry-btn:hover {
          background: #dc2626;
        }
      </style>
    </head>
    <body>
      <div class="logo-container">
        <div class="logo">S</div>
        <div class="title">SubSilicon</div>
        <div class="subtitle">Interactive Narrative Editor</div>
      </div>
      <div class="progress-container">
        <div class="progress-bar" id="progress-bar"></div>
      </div>
      <div class="loading-text" id="loading-text">正在加载编辑器引擎...</div>
      <div class="error-msg" id="error-msg">
        <p id="error-text"></p>
        <button class="retry-btn" onclick="window.__retryApp()">重试</button>
      </div>
      <script>
        setTimeout(function() {
          document.getElementById('progress-bar').style.width = '70%';
        }, 100);
        setTimeout(function() {
          document.getElementById('progress-bar').style.width = '90%';
          document.getElementById('loading-text').textContent = '即将启动...';
        }, 5000);
        setTimeout(function() {
          var bar = document.getElementById('progress-bar');
          if (bar.style.width !== '100%') {
            bar.style.width = '100%';
          }
        }, 25000);
      </script>
    </body>
    </html>
  `

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`)

  splashWindow.on('closed', () => {
    splashWindow = null
  })
}

function showSplashError(message: string): void {
  if (!splashWindow) return
  splashWindow.webContents.executeJavaScript(`
    document.getElementById('progress-bar').style.background = '#ef4444';
    document.getElementById('loading-text').textContent = '⚠️ ' + ${JSON.stringify(message)};
    document.getElementById('loading-text').style.color = '#fca5a5';
    var err = document.getElementById('error-msg');
    err.classList.add('visible');
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
  if (typeof mainWindow.setTitleBarOverlay === 'function') {
    try {
      mainWindow.setTitleBarOverlay({
        color: '#1a1410',
        symbolColor: '#ffffff',
      })
    } catch {}
  }

  let mainShown = false
  let readyTimeout: NodeJS.Timeout | null = null

  try {
    if (isDev) {
      const devUrl = process.env.ELECTRON_START_URL || 'http://localhost:5173'
      console.log(`[Main] Loading dev URL: ${devUrl}`)
      mainWindow.loadURL(devUrl)
    } else {
      const prodFile = resolve(__dirname, '../dist/index.html')
      console.log(`[Main] Loading production file: ${prodFile}`)
      mainWindow.loadFile(prodFile)
    }

    readyTimeout = setTimeout(() => {
      if (!mainShown && mainWindow && !mainWindow.isDestroyed()) {
        console.warn('[Main] ready-to-show 超时，强制显示主窗口')
        mainShown = true
        if (splashWindow) {
          try { splashWindow.close() } catch {}
        }
        mainWindow.show()
        mainWindow.focus()
      }
    }, 20000)

    mainWindow.once('ready-to-show', () => {
      if (mainShown) return
      mainShown = true
      if (readyTimeout) clearTimeout(readyTimeout)
      console.log('[Main] ready-to-show 触发，显示主窗口')
      if (splashWindow) {
        try { splashWindow.close() } catch {}
      }
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
            if (isDev) {
              mainWindow.loadURL(process.env.ELECTRON_START_URL || 'http://localhost:5173')
            } else {
              mainWindow.loadFile(resolve(__dirname, '../dist/index.html'))
            }
          }
        }, 1500)
      } else if (!mainShown && retryCount >= 3) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
            <html><body style="font-family:-apple-system,sans-serif;background:#1a1410;color:#fca5a5;padding:40px;text-align:center;">
            <h2>编辑器启动失败</h2>
            <p>无法加载本地资源，请重启应用或重新安装。</p>
            <p style="color:#94a3b8;font-size:12px;margin-top:20px;">错误代码: ${errorCode}</p>
            </body></html>
          `)}`)
          mainWindow.show()
          if (splashWindow) { try { splashWindow.close() } catch {} }
        }
      }
    })

    mainWindow.webContents.on('did-finish-load', () => {
      console.log('[Main] did-finish-load')
    })

    mainWindow.webContents.on('console-message', (_e, level, message) => {
      console.log(`[Renderer][${level}] ${message}`)
    })
  } catch (err) {
    if (readyTimeout) clearTimeout(readyTimeout)
    const errMsg = err instanceof Error ? err.message : '启动失败，请重新安装'
    if (splashWindow) {
      showSplashError(errMsg)
    } else if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
        <html><body style="font-family:-apple-system,sans-serif;background:#1a1410;color:#fca5a5;padding:40px;text-align:center;">
        <h2>编辑器启动失败</h2>
        <p>${errMsg}</p>
        </body></html>
      `)}`)
      mainWindow.show()
    }
  }

  mainWindow.on('close', (e) => {
    if (mainWindow) {
      saveWindowState(mainWindow)
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.on('will-navigate', (e) => {
    e.preventDefault()
  })

  setupAutoUpdate()
}

function loadWindowState(): { width?: number; height?: number; x?: number; y?: number } {
  const path = join(getProjectDir(), 'window-state.json')
  if (existsSync(path)) {
    try {
      return JSON.parse(readFileSync(path, 'utf-8'))
    } catch {
      return {}
    }
  }
  return {}
}

function saveWindowState(window: BrowserWindow): void {
  const path = join(getProjectDir(), 'window-state.json')
  const bounds = window.getBounds()
  writeFileSync(path, JSON.stringify(bounds, null, 2), 'utf-8')
}

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
        {
          label: '新建作品',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('app:new-file'),
        },
        {
          label: '打开作品',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow?.webContents.send('app:open-file'),
        },
        {
          label: '保存作品',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('app:save-file'),
        },
        {
          label: '另存为',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow?.webContents.send('app:save-as'),
        },
        { type: 'separator' },
        ...(recentFiles.length > 0 ? [{
          label: '最近打开',
          submenu: recentFiles.map(filePath => ({
            label: filePath,
            click: () => mainWindow?.webContents.send('app:open-recent', filePath),
          })),
        }] : []),
        { type: 'separator' },
        {
          label: '退出',
          accelerator: isMac ? 'Cmd+Q' : 'Ctrl+Q',
          role: 'quit',
        },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'toggleFullScreen' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => mainWindow?.webContents.send('app:about'),
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function setupTray(): void {
  const iconPath = resolve(__dirname, '../build/icon.png')
  const icon = nativeImage.createFromPath(iconPath)
    .resize({ width: isLinux ? 22 : 16, height: isLinux ? 22 : 16 })

  tray = new Tray(icon)
  tray.setToolTip(APP_NAME)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开编辑器',
      click: () => {
        if (!mainWindow) createMainWindow()
        else {
          mainWindow.show()
          mainWindow.focus()
        }
      },
    },
    { type: 'separator' },
    { role: 'quit' },
  ])

  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    if (!mainWindow) createMainWindow()
    else {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    }
  })
}

function setupAutoUpdate(): void {
  if (isDev) return

  const server = 'https://subsilicon.cn/updates'
  const feed = `${server}/update/${process.platform}/${app.getVersion()}`

  autoUpdater.setFeedURL({ url: feed })

  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('update:checking')
  })

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update:available', info)
  })

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('update:not-available')
  })

  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('update:error', err.message)
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update:progress', progress)
  })

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update:downloaded')
    autoUpdater.quitAndInstall()
  })

  setTimeout(() => {
    autoUpdater.checkForUpdates()
  }, 5000)
}

function setupIPC(): void {
  ipcMain.handle('fs:readFile', async (_, path: string) => {
    try {
      const data = readFileSync(path)
      return { success: true, data: Array.from(new Uint8Array(data)) }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('fs:writeFile', async (_, path: string, data: number[]) => {
    try {
      const buffer = Buffer.from(data)
      const dir = path.substring(0, path.lastIndexOf('/'))
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      writeFileSync(path, buffer)
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('fs:getFileInfo', async (_, path: string) => {
    try {
      const stat = statSync(path)
      return {
        success: true,
        name: path.substring(path.lastIndexOf('/') + 1),
        size: stat.size,
        type: stat.isDirectory() ? 'directory' : 'file',
      }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('dialog:openFile', async (_, options?: { filters?: Array<{ name: string; extensions: string[] }> }) => {
    try {
      const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openFile'],
        filters: options?.filters || [{ name: 'Story Files', extensions: ['story', 'json'] }],
      })
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, path: null }
      }
      const filePath = result.filePaths[0]
      addRecentFile(filePath)
      return { success: true, path: filePath }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('dialog:saveFile', async (_, options?: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow!, {
        defaultPath: options?.defaultPath,
        filters: options?.filters || [{ name: 'Story Files', extensions: ['story'] }],
      })
      if (result.canceled || !result.filePath) {
        return { success: false, path: null }
      }
      const filePath = result.filePath.endsWith('.story') ? result.filePath : `${result.filePath}.story`
      addRecentFile(filePath)
      return { success: true, path: filePath }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('dialog:openFolder', async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openDirectory'],
      })
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, path: null }
      }
      return { success: true, path: result.filePaths[0] }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('project:getPath', async () => {
    return { success: true, path: getProjectDir() }
  })

  ipcMain.handle('project:copyFile', async (_, sourcePath: string, fileName: string) => {
    try {
      const projectDir = getProjectDir()
      const targetPath = join(projectDir, fileName)
      copyFileSync(sourcePath, targetPath)
      return { success: true, path: targetPath }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('app:getRecentFiles', async () => {
    return { success: true, files: recentFiles }
  })

  ipcMain.handle('app:getVersion', async () => {
    return { success: true, version: app.getVersion() }
  })

  ipcMain.on('window:minimize', () => {
    mainWindow?.minimize()
  })

  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })

  ipcMain.on('window:close', () => {
    mainWindow?.close()
  })

  ipcMain.on('update:check', () => {
    autoUpdater.checkForUpdates()
  })
}

app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-gpu-sandbox')
app.commandLine.appendSwitch('disable-software-rasterizer')
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,MediaSessionService')
app.disableHardwareAcceleration()

app.whenReady().then(() => {
  loadRecentFiles()
  createSplashWindow()
  setTimeout(() => {
    createMainWindow()
    setupMenu()
    setupTray()
    setupIPC()
  }, 1500)
})

app.on('window-all-closed', () => {
  if (!isMac) {
    app.quit()
  }
})

app.on('activate', () => {
  if (!mainWindow) {
    createMainWindow()
  }
})

app.on('open-file', (_, filePath) => {
  if (!mainWindow) {
    createMainWindow()
  }
  setTimeout(() => {
    mainWindow?.webContents.send('app:open-file-with-path', filePath)
  }, 500)
})
