const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const fs = require('fs')

const isDev = process.env.NODE_ENV === 'development'
const isMac = process.platform === 'darwin'
const isWin = process.platform === 'win32'

// 官网下载页地址：Mac 应用未签名，无法使用 electron-updater 自动安装，
// 检测到新版本时引导用户到浏览器下载 DMG 手动安装。
const DOWNLOAD_PAGE_URL = 'https://subsilicon.cn/download'

// 全局异常兜底，防止未捕获异常导致主进程崩溃
process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught Exception:', error)
})
process.on('unhandledRejection', (reason) => {
  console.error('[Main] Unhandled Rejection:', reason)
})

let mainWindow = null

function createWindow() {
  const windowOptions = {
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    title: 'SubSilicon Editor',
    icon: isWin ? path.join(__dirname, '../build/icon.ico') : path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: !isDev,
    },
    frame: true,
    titleBarStyle: isMac ? 'default' : 'default',
    trafficLightPosition: isMac ? { x: 12, y: 12 } : undefined,
  }

  if (isMac) {
    windowOptions.titleBarOverlay = {
      color: '#111827',
      symbolColor: '#E5E7EB',
      height: 28,
    }
  }

  mainWindow = new BrowserWindow(windowOptions)

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  createWindow()
  setupAutoUpdate()

  if (!isDev) {
    setupStartupUpdateCheck()
    setupPeriodicUpdateCheck()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

function setupStartupUpdateCheck() {
  let retries = 0
  const attempt = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      autoUpdater.checkForUpdates().catch(() => {})
    } else if (retries < 10) {
      retries++
      setTimeout(attempt, 1000)
    }
  }
  setTimeout(attempt, 3000)
}

function setupPeriodicUpdateCheck() {
  setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      autoUpdater.checkForUpdates().catch(() => {})
    }
  }, 1000 * 60 * 60 * 6)
}

app.on('window-all-closed', () => {
  if (!isMac) {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (mainWindow) {
    mainWindow.webContents.send('app-quit')
  }
})

/**
 * 独立游戏软件导出：在指定壳目录执行 electron-builder 打包。
 * 由 Renderer 进程生成壳目录后调用，结果通过 event channel 流式返回进度。
 */
ipcMain.handle('desktop:build', async (event, payload) => {
  const { shellDir, platforms = ['current'], workTitle = 'SubSilicon 作品', logChannel } = payload || {}
  const log = (level, msg) => {
    if (logChannel) event.sender.send(logChannel, { level, msg })
  }
  log('info', `[desktop:build] 开始打包：${shellDir} (${platforms.join(',')})`)

  try {
    // 动态查找 electron-builder
    let builderCli
    const candidates = [
      path.join(__dirname, '..', 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js'),
      path.join(__dirname, '..', 'node_modules', '.bin', 'electron-builder'),
    ]
    for (const c of candidates) {
      try {
        if (fs.existsSync(c)) { builderCli = c; break }
      } catch { /* ignore */ }
    }
    if (!builderCli) {
      return { success: false, error: '未找到 electron-builder，编辑器损坏或缺少 node_modules' }
    }

    // 解析目标平台（electron-builder --mac --win --linux 语法）
    const flags = []
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
    if (flags.length === 0) flags.push('--dir') // no flags = 仅生成目录，不打包
    flags.push('--publish', 'never')

    log('info', `[desktop:build] electron-builder 命令：node ${builderCli} ${flags.join(' ')}  (cwd=${shellDir})`)

    const { spawn } = require('node:child_process')
    return await new Promise((resolve) => {
      const child = spawn(
        process.execPath,
        [builderCli, ...flags],
        { cwd: shellDir, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] }
      )
      child.stdout.on('data', (buf) => log('info', String(buf).replace(/\n$/, '')))
      child.stderr.on('data', (buf) => log('warn', String(buf).replace(/\n$/, '')))
      child.on('error', (err) => {
        log('error', `子进程错误：${err.message}`)
        resolve({ success: false, error: err.message })
      })
      child.on('close', (code) => {
        log('info', `[desktop:build] electron-builder 退出码 ${code}`)
        const outputDir = path.join(shellDir, 'dist')
        const outputs = []
        try {
          if (fs.existsSync(outputDir)) {
            for (const f of fs.readdirSync(outputDir)) {
              const fp = path.join(outputDir, f)
              const st = fs.statSync(fp)
              if (st.isFile()) {
                outputs.push({
                  name: f,
                  path: fp,
                  size: st.size,
                  type: (path.extname(f) || '').slice(1).toLowerCase(),
                })
              }
            }
          }
        } catch (e) { /* ignore */ }

        if (code === 0) {
          resolve({ success: true, outputDir, outputs })
        } else {
          resolve({ success: false, error: `electron-builder 退出码 ${code}`, outputDir, outputs })
        }
      })
    })
  } catch (e) {
    return { success: false, error: e && e.message ? e.message : String(e) }
  }
})

ipcMain.handle('readFile', async (event, filePath) => {
  try {
    const data = fs.readFileSync(filePath)
    return { success: true, data: Array.from(data) }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('readFileAsText', async (event, filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf-8')
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('writeFile', async (event, filePath, data) => {
  try {
    fs.writeFileSync(filePath, Buffer.from(data))
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('getFileInfo', async (event, filePath) => {
  try {
    const stats = fs.statSync(filePath)
    return {
      success: true,
      name: path.basename(filePath),
      size: stats.size,
      type: path.extname(filePath).slice(1),
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('openFileDialog', async (event, options = {}) => {
  try {
    const properties = options.properties || ['openFile']
    const result = await dialog.showOpenDialog(mainWindow, {
      properties,
      filters: options.filters || [],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false }
    }

    return { success: true, path: result.filePaths[0], filePaths: result.filePaths }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('saveFileDialog', async (event, options = {}) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: options.defaultPath || undefined,
      filters: options.filters || [],
    })

    if (result.canceled || !result.filePath) {
      return { success: false }
    }

    return { success: true, path: result.filePath }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('openFolderDialog', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false }
    }

    return { success: true, path: result.filePaths[0] }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('getProjectPath', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false }
    }

    return { success: true, path: result.filePaths[0] }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('copyToProject', async (event, sourcePath, fileName) => {
  try {
    const projectPath = await getProjectPath()
    if (!projectPath.success || !projectPath.path) {
      return { success: false, error: '未选择项目目录' }
    }

    const destPath = path.join(projectPath.path, fileName)
    fs.copyFileSync(sourcePath, destPath)
    return { success: true, path: destPath }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('getRecentFiles', async () => {
  try {
    const recentFilesPath = path.join(app.getPath('userData'), 'recent-files.json')
    if (fs.existsSync(recentFilesPath)) {
      const data = JSON.parse(fs.readFileSync(recentFilesPath, 'utf-8'))
      return { success: true, files: data || [] }
    }
    return { success: true, files: [] }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('getVersion', async () => {
  return { success: true, version: app.getVersion() }
})

ipcMain.on('minimizeWindow', () => {
  if (mainWindow) {
    mainWindow.minimize()
  }
})

ipcMain.on('maximizeWindow', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }
})

ipcMain.on('closeWindow', () => {
  if (mainWindow) {
    mainWindow.close()
  }
})

function setupAutoUpdate() {
  if (isDev) return

  autoUpdater.setFeedURL({
    provider: 'generic',
    url: 'https://subsilicon.cn/releases',
  })

  // 仅用于版本检测，不自动下载安装：
  // Mac 应用未签名，Squirrel.Mac 无法替换 .app bundle，
  // quitAndInstall 会失败；改为检测到新版本后引导用户手动下载 DMG。
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('update-checking')
  })

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
      downloadUrl: DOWNLOAD_PAGE_URL,
    })
  })

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('update-not-available')
  })

  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('update-error', err.message)
  })
}

ipcMain.on('checkForUpdates', () => {
  if (isDev) {
    mainWindow.webContents.send('update-checking')
    setTimeout(() => {
      mainWindow.webContents.send('update-not-available')
    }, 2000)
    return
  }
  autoUpdater.checkForUpdates().catch(err => {
    mainWindow?.webContents.send('update-error', err.message)
  })
})

// 引导用户到浏览器下载最新版本 DMG 手动安装。
// 保留 downloadUpdate / installUpdate IPC 以兼容旧前端调用，统一重定向到下载页。
ipcMain.on('downloadUpdate', () => {
  shell.openExternal(DOWNLOAD_PAGE_URL)
})

ipcMain.on('installUpdate', () => {
  shell.openExternal(DOWNLOAD_PAGE_URL)
})

ipcMain.on('openDownloadPage', () => {
  shell.openExternal(DOWNLOAD_PAGE_URL)
})

ipcMain.handle('getAppPath', () => {
  return app.getAppPath()
})

ipcMain.on('openExternal', (event, url) => {
  shell.openExternal(url)
})