import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('__electronAPI', {
  readFile: (path: string): Promise<{ success: boolean; data?: number[]; error?: string }> =>
    ipcRenderer.invoke('fs:readFile', path),

  writeFile: (path: string, data: number[]): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('fs:writeFile', path, data),

  getFileInfo: (path: string): Promise<{
    success: boolean;
    name?: string;
    size?: number;
    type?: string;
    error?: string;
  }> =>
    ipcRenderer.invoke('fs:getFileInfo', path),

  openFileDialog: (options?: {
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<{ success: boolean; path?: string; error?: string }> =>
    ipcRenderer.invoke('dialog:openFile', options),

  saveFileDialog: (options?: {
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<{ success: boolean; path?: string; error?: string }> =>
    ipcRenderer.invoke('dialog:saveFile', options),

  openFolderDialog: (): Promise<{ success: boolean; path?: string; error?: string }> =>
    ipcRenderer.invoke('dialog:openFolder'),

  getProjectPath: (): Promise<{ success: boolean; path?: string }> =>
    ipcRenderer.invoke('project:getPath'),

  copyToProject: (sourcePath: string, fileName: string): Promise<{ success: boolean; path?: string; error?: string }> =>
    ipcRenderer.invoke('project:copyFile', sourcePath, fileName),

  getRecentFiles: (): Promise<{ success: boolean; files?: string[] }> =>
    ipcRenderer.invoke('app:getRecentFiles'),

  getVersion: (): Promise<{ success: boolean; version?: string }> =>
    ipcRenderer.invoke('app:getVersion'),

  minimizeWindow: (): void =>
    ipcRenderer.send('window:minimize'),

  maximizeWindow: (): void =>
    ipcRenderer.send('window:maximize'),

  closeWindow: (): void =>
    ipcRenderer.send('window:close'),

  checkForUpdates: (): void =>
    ipcRenderer.send('update:check'),

  onUpdateChecking: (callback: () => void): () => void => {
    ipcRenderer.on('update:checking', callback)
    return () => ipcRenderer.removeListener('update:checking', callback)
  },

  onUpdateAvailable: (callback: (info: { version: string }) => void): () => void => {
    ipcRenderer.on('update:available', (_e, info) => callback(info))
    return () => ipcRenderer.removeListener('update:available', callback)
  },

  onUpdateNotAvailable: (callback: () => void): () => void => {
    ipcRenderer.on('update:not-available', callback)
    return () => ipcRenderer.removeListener('update:not-available', callback)
  },

  onUpdateError: (callback: (message: string) => void): () => void => {
    ipcRenderer.on('update:error', (_e, message) => callback(message))
    return () => ipcRenderer.removeListener('update:error', callback)
  },

  onUpdateProgress: (callback: (progress: { percent: number }) => void): () => void => {
    ipcRenderer.on('update:progress', (_e, progress) => callback(progress))
    return () => ipcRenderer.removeListener('update:progress', callback)
  },

  onUpdateDownloaded: (callback: () => void): () => void => {
    ipcRenderer.on('update:downloaded', callback)
    return () => ipcRenderer.removeListener('update:downloaded', callback)
  },

  onNewFile: (callback: () => void): () => void => {
    ipcRenderer.on('app:new-file', callback)
    return () => ipcRenderer.removeListener('app:new-file', callback)
  },

  onOpenFile: (callback: () => void): () => void => {
    ipcRenderer.on('app:open-file', callback)
    return () => ipcRenderer.removeListener('app:open-file', callback)
  },

  onSaveFile: (callback: () => void): () => void => {
    ipcRenderer.on('app:save-file', callback)
    return () => ipcRenderer.removeListener('app:save-file', callback)
  },

  onSaveAs: (callback: () => void): () => void => {
    ipcRenderer.on('app:save-as', callback)
    return () => ipcRenderer.removeListener('app:save-as', callback)
  },

  onOpenRecent: (callback: (filePath: string) => void): () => void => {
    ipcRenderer.on('app:open-recent', (_e, filePath) => callback(filePath))
    return () => ipcRenderer.removeListener('app:open-recent', callback)
  },

  onOpenFileWithPath: (callback: (filePath: string) => void): () => void => {
    ipcRenderer.on('app:open-file-with-path', (_e, filePath) => callback(filePath))
    return () => ipcRenderer.removeListener('app:open-file-with-path', callback)
  },

  onAbout: (callback: () => void): () => void => {
    ipcRenderer.on('app:about', callback)
    return () => ipcRenderer.removeListener('app:about', callback)
  },

  platform: process.platform,
  isElectron: true,
})

declare global {
  interface Window {
    __electronAPI?: {
      readFile: (path: string) => Promise<{ success: boolean; data?: number[]; error?: string }>
      writeFile: (path: string, data: number[]) => Promise<{ success: boolean; error?: string }>
      getFileInfo: (path: string) => Promise<{
        success: boolean;
        name?: string;
        size?: number;
        type?: string;
        error?: string;
      }>
      openFileDialog: (options?: {
        filters?: Array<{ name: string; extensions: string[] }>;
      }) => Promise<{ success: boolean; path?: string; error?: string }>
      saveFileDialog: (options?: {
        defaultPath?: string;
        filters?: Array<{ name: string; extensions: string[] }>;
      }) => Promise<{ success: boolean; path?: string; error?: string }>
      openFolderDialog: () => Promise<{ success: boolean; path?: string; error?: string }>
      getProjectPath: () => Promise<{ success: boolean; path?: string }>
      copyToProject: (sourcePath: string, fileName: string) => Promise<{ success: boolean; path?: string; error?: string }>
      getRecentFiles: () => Promise<{ success: boolean; files?: string[] }>
      getVersion: () => Promise<{ success: boolean; version?: string }>
      minimizeWindow: () => void
      maximizeWindow: () => void
      closeWindow: () => void
      checkForUpdates: () => void
      onUpdateChecking: (callback: () => void) => () => void
      onUpdateAvailable: (callback: (info: { version: string }) => void) => () => void
      onUpdateNotAvailable: (callback: () => void) => () => void
      onUpdateError: (callback: (message: string) => void) => () => void
      onUpdateProgress: (callback: (progress: { percent: number }) => void) => () => void
      onUpdateDownloaded: (callback: () => void) => () => void
      onNewFile: (callback: () => void) => () => void
      onOpenFile: (callback: () => void) => () => void
      onSaveFile: (callback: () => void) => () => void
      onSaveAs: (callback: () => void) => () => void
      onOpenRecent: (callback: (filePath: string) => void) => () => void
      onOpenFileWithPath: (callback: (filePath: string) => void) => () => void
      onAbout: (callback: () => void) => () => void
      platform: string
      isElectron: boolean
    }
  }
}