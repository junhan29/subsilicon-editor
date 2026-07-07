const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const { Readable } = require('stream')

const isDev = process.env.NODE_ENV === 'development'
const isMac = process.platform === 'darwin'
const isWin = process.platform === 'win32'

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
  try {
    const data = fs.readFileSync(filePath)
    return { success: true, data: Array.from(data) }
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

ipcMain.on('checkForUpdates', () => {
  mainWindow.webContents.send('update-checking')
  setTimeout(() => {
    mainWindow.webContents.send('update-not-available')
  }, 2000)
})

ipcMain.on('openExternal', (event, url) => {
  shell.openExternal(url)
})