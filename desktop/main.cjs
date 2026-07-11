const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const fs = require('fs')
const { Readable } = require('stream')

const isDev = process.env.NODE_ENV === 'development'
const isMac = process.platform === 'darwin'
const isWin = process.platform === 'win32'

let mainWindow = null
let panelWindow = null

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
    console.log('[auto-update] app ready, current version:', app.getVersion())
    autoUpdater.checkForUpdates().catch(err => {
      console.error('[auto-update] startup check failed:', err.message)
    })
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

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
  console.log('[main] readFile called:', filePath)
  try {
    const data = fs.readFileSync(filePath)
    console.log('[main] readFile success, size:', data.length)
    return { success: true, data: Array.from(data) }
  } catch (error) {
    console.error('[main] readFile error:', error.message)
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
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: options.filters || [],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false }
    }

    return { success: true, path: result.filePaths[0] }
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

ipcMain.handle('addRecentFile', async (event, filePath) => {
  try {
    const recentFilesPath = path.join(app.getPath('userData'), 'recent-files.json')
    let files = []
    if (fs.existsSync(recentFilesPath)) {
      files = JSON.parse(fs.readFileSync(recentFilesPath, 'utf-8')) || []
    }
    files = files.filter(f => f !== filePath)
    files.unshift(filePath)
    files = files.slice(0, 10)
    fs.writeFileSync(recentFilesPath, JSON.stringify(files, null, 2))
    return { success: true, files }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('removeRecentFile', async (event, filePath) => {
  try {
    const recentFilesPath = path.join(app.getPath('userData'), 'recent-files.json')
    let files = []
    if (fs.existsSync(recentFilesPath)) {
      files = JSON.parse(fs.readFileSync(recentFilesPath, 'utf-8')) || []
    }
    files = files.filter(f => f !== filePath)
    fs.writeFileSync(recentFilesPath, JSON.stringify(files, null, 2))
    return { success: true, files }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('getDefaultProjectsDir', async () => {
  try {
    const documentsDir = app.getPath('documents')
    const projectsDir = path.join(documentsDir, 'SubSilicon Projects')
    if (!fs.existsSync(projectsDir)) {
      fs.mkdirSync(projectsDir, { recursive: true })
    }
    return { success: true, path: projectsDir }
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
    url: 'https://subsilicon.cn/releases/',
    channel: 'latest',
  })

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    console.log('[auto-update] checking for update...')
    mainWindow?.webContents.send('update-checking')
  })

  autoUpdater.on('update-available', (info) => {
    console.log('[auto-update] update available:', info.version)
    mainWindow?.webContents.send('update-available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    })
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[auto-update] no update available')
    mainWindow?.webContents.send('update-not-available')
  })

  autoUpdater.on('error', (err) => {
    console.error('[auto-update] error:', err.message)
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
  console.log('[auto-update] manual check triggered')
  autoUpdater.checkForUpdates().catch(err => {
    console.error('[auto-update] check failed:', err.message)
    mainWindow?.webContents.send('update-error', err.message)
  })
})

ipcMain.on('downloadUpdate', () => {
  if (isDev) return
  // macOS 无代码签名，electron-updater 无法自动安装，直接打开下载页
  if (isMac) {
    shell.openExternal('https://subsilicon.cn/download')
    return
  }
  autoUpdater.downloadUpdate().catch(err => {
    mainWindow?.webContents.send('update-error', err.message)
  })
})

ipcMain.on('installUpdate', () => {
  if (isDev) return
  autoUpdater.quitAndInstall(false, true)
})

ipcMain.on('openExternal', (event, url) => {
  shell.openExternal(url)
})

ipcMain.handle('openPanelWindow', async () => {
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.focus()
    return { success: true, alreadyOpen: true }
  }

  const mainBounds = mainWindow?.getBounds() || { x: 0, y: 0, width: 1400 }
  
  panelWindow = new BrowserWindow({
    width: 420,
    height: 700,
    minWidth: 360,
    minHeight: 500,
    x: mainBounds.x + mainBounds.width,
    y: mainBounds.y + 40,
    title: 'SubSilicon - 管理面板',
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
  })

  if (isMac) {
    panelWindow.setTitleBarOverlay({
      color: '#1e293b',
      symbolColor: '#e2e8f0',
      height: 28,
    })
  }

  if (isDev) {
    panelWindow.loadURL('http://localhost:5173/panel')
  } else {
    panelWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      hash: 'panel',
    })
  }

  panelWindow.on('closed', () => {
    panelWindow = null
    mainWindow?.webContents.send('panel-closed')
  })

  panelWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== panelWindow.webContents.getURL()) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  panelWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  return { success: true, alreadyOpen: false }
})

ipcMain.on('closePanelWindow', () => {
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.close()
  }
})

ipcMain.on('panel-window-message', (event, message) => {
  mainWindow?.webContents.send('panel-window-message', message)
})

ipcMain.on('main-window-message', (event, message) => {
  panelWindow?.webContents.send('main-window-message', message)
})