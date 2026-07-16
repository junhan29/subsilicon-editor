const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const fs = require('fs')

const isDev = process.env.NODE_ENV === 'development'
const isMac = process.platform === 'darwin'
const isWin = process.platform === 'win32'

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

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('before-quit-for-update', () => {
    console.log('[AutoUpdater] 即将退出以安装更新')
  })

  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('update-checking')
  })

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    })
  })

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('update-not-available')
  })

  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('update-error', err.message)
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update-progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      total: progress.total,
      transferred: progress.transferred,
    })
  })

  autoUpdater.on('update-downloaded', () => {
    console.log('[AutoUpdater] 更新下载完成，等待用户安装')
    mainWindow?.webContents.send('update-downloaded')
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

ipcMain.on('downloadUpdate', () => {
  if (isDev) return
  autoUpdater.downloadUpdate().catch(err => {
    mainWindow?.webContents.send('update-error', err.message)
  })
})

ipcMain.handle('getAppPath', () => {
  return app.getAppPath()
})

ipcMain.on('installUpdate', () => {
  if (isDev) return
  console.log('[AutoUpdater] 用户触发安装，准备退出并安装')
  try {
    autoUpdater.quitAndInstall(true, true)
  } catch (err) {
    console.error('[AutoUpdater] 安装失败:', err)
    mainWindow?.webContents.send('update-error', err.message)
  }
})

ipcMain.on('openExternal', (event, url) => {
  shell.openExternal(url)
})