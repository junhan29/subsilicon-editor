const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('__electronAPI', {
  readFile: (path) => ipcRenderer.invoke('readFile', path),
  writeFile: (path, data) => ipcRenderer.invoke('writeFile', path, data),
  getFileInfo: (path) => ipcRenderer.invoke('getFileInfo', path),
  openFileDialog: (options) => ipcRenderer.invoke('openFileDialog', options),
  saveFileDialog: (options) => ipcRenderer.invoke('saveFileDialog', options),
  openFolderDialog: () => ipcRenderer.invoke('openFolderDialog'),
  getProjectPath: () => ipcRenderer.invoke('getProjectPath'),
  copyToProject: (sourcePath, fileName) => ipcRenderer.invoke('copyToProject', sourcePath, fileName),
  getRecentFiles: () => ipcRenderer.invoke('getRecentFiles'),
  getVersion: () => ipcRenderer.invoke('getVersion'),
  minimizeWindow: () => ipcRenderer.send('minimizeWindow'),
  maximizeWindow: () => ipcRenderer.send('maximizeWindow'),
  closeWindow: () => ipcRenderer.send('closeWindow'),
  checkForUpdates: () => ipcRenderer.send('checkForUpdates'),
  downloadUpdate: () => ipcRenderer.send('downloadUpdate'),
  installUpdate: () => ipcRenderer.send('installUpdate'),
  onUpdateChecking: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('update-checking', listener)
    return () => ipcRenderer.removeListener('update-checking', listener)
  },
  onUpdateAvailable: (callback) => {
    const listener = (event, info) => callback(info)
    ipcRenderer.on('update-available', listener)
    return () => ipcRenderer.removeListener('update-available', listener)
  },
  onUpdateNotAvailable: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('update-not-available', listener)
    return () => ipcRenderer.removeListener('update-not-available', listener)
  },
  onUpdateError: (callback) => {
    const listener = (event, message) => callback(message)
    ipcRenderer.on('update-error', listener)
    return () => ipcRenderer.removeListener('update-error', listener)
  },
  onUpdateProgress: (callback) => {
    const listener = (event, progress) => callback(progress)
    ipcRenderer.on('update-progress', listener)
    return () => ipcRenderer.removeListener('update-progress', listener)
  },
  onUpdateDownloaded: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('update-downloaded', listener)
    return () => ipcRenderer.removeListener('update-downloaded', listener)
  },
  onNewFile: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('new-file', listener)
    return () => ipcRenderer.removeListener('new-file', listener)
  },
  onOpenFile: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('open-file', listener)
    return () => ipcRenderer.removeListener('open-file', listener)
  },
  onSaveFile: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('save-file', listener)
    return () => ipcRenderer.removeListener('save-file', listener)
  },
  onSaveAs: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('save-as', listener)
    return () => ipcRenderer.removeListener('save-as', listener)
  },
  onOpenRecent: (callback) => {
    const listener = (event, filePath) => callback(filePath)
    ipcRenderer.on('open-recent', listener)
    return () => ipcRenderer.removeListener('open-recent', listener)
  },
  onOpenFileWithPath: (callback) => {
    const listener = (event, filePath) => callback(filePath)
    ipcRenderer.on('open-file-with-path', listener)
    return () => ipcRenderer.removeListener('open-file-with-path', listener)
  },
  onAbout: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('about', listener)
    return () => ipcRenderer.removeListener('about', listener)
  },
  platform: process.platform,
  isElectron: true,
})