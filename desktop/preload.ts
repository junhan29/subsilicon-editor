import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

// ============================================================
// SubSilicon Editor · Preload
// IPC 通道名统一使用「短名」：readFile / writeFile / minimizeWindow / update-available …
// 与 src/electron-api.d.ts 签名 100% 对齐
// ============================================================

contextBridge.exposeInMainWorld('__electronAPI', {
  // ---- File ----
  readFile: (path: string): Promise<{ success: boolean; data?: number[]; error?: string }> =>
    ipcRenderer.invoke('readFile', path),

  readFileAsText: (path: string): Promise<{ success: boolean; data?: string; error?: string }> =>
    ipcRenderer.invoke('readFileAsText', path),

  writeFile: (path: string, data: number[]): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('writeFile', path, data),

  getFileInfo: (path: string): Promise<{
    success: boolean;
    name?: string;
    size?: number;
    type?: string;
    error?: string;
  }> =>
    ipcRenderer.invoke('getFileInfo', path),

  getAppPath: (): Promise<string> =>
    ipcRenderer.invoke('getAppPath'),

  // ---- Dialogs ----
  openFileDialog: (options?: {
    title?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
    properties?: string[];
  }): Promise<{ success: boolean; path?: string; filePaths?: string[]; error?: string }> =>
    ipcRenderer.invoke('openFileDialog', options),

  saveFileDialog: (options?: {
    title?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<{ success: boolean; path?: string; error?: string }> =>
    ipcRenderer.invoke('saveFileDialog', options),

  openFolderDialog: (): Promise<{ success: boolean; path?: string; error?: string }> =>
    ipcRenderer.invoke('openFolderDialog'),

  // ---- Project ----
  getProjectPath: (): Promise<{ success: boolean; path?: string }> =>
    ipcRenderer.invoke('getProjectPath'),

  copyToProject: (sourcePath: string, fileName: string): Promise<{ success: boolean; path?: string; error?: string }> =>
    ipcRenderer.invoke('copyToProject', sourcePath, fileName),

  // ---- App meta ----
  getRecentFiles: (): Promise<{ success: boolean; files?: string[] }> =>
    ipcRenderer.invoke('getRecentFiles'),

  getVersion: (): Promise<{ success: boolean; version?: string }> =>
    ipcRenderer.invoke('getVersion'),

  // ---- Window control ----
  minimizeWindow: (): void => ipcRenderer.send('minimizeWindow'),
  maximizeWindow: (): void => ipcRenderer.send('maximizeWindow'),
  closeWindow: (): void => ipcRenderer.send('closeWindow'),

  // ---- Update (统一改为打开下载页：Mac 未签名，无法自动安装) ----
  checkForUpdates: (): void => ipcRenderer.send('checkForUpdates'),
  downloadUpdate: (): void => ipcRenderer.send('openDownloadPage'),
  installUpdate: (): void => ipcRenderer.send('openDownloadPage'),
  openDownloadPage: (): void => ipcRenderer.send('openDownloadPage'),

  onUpdateChecking: (callback: () => void): () => void => {
    const listener = () => callback()
    ipcRenderer.on('update-checking', listener)
    return () => ipcRenderer.removeListener('update-checking', listener)
  },

  onUpdateAvailable: (callback: (info: {
    version: string
    releaseDate?: string
    releaseNotes?: string
    downloadUrl?: string
  }) => void): () => void => {
    const handler = (_e: IpcRendererEvent, info: {
      version: string; releaseDate?: string; releaseNotes?: string; downloadUrl?: string
    }) => callback(info)
    ipcRenderer.on('update-available', handler)
    return () => ipcRenderer.removeListener('update-available', handler)
  },

  onUpdateNotAvailable: (callback: () => void): () => void => {
    const listener = () => callback()
    ipcRenderer.on('update-not-available', listener)
    return () => ipcRenderer.removeListener('update-not-available', listener)
  },

  onUpdateError: (callback: (message: string) => void): () => void => {
    const handler = (_e: IpcRendererEvent, message: string) => callback(message)
    ipcRenderer.on('update-error', handler)
    return () => ipcRenderer.removeListener('update-error', handler)
  },

  // ---- Menu → Renderer events ----
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
    const handler = (_e: IpcRendererEvent, filePath: string) => callback(filePath)
    ipcRenderer.on('app:open-recent', handler)
    return () => ipcRenderer.removeListener('app:open-recent', handler)
  },
  onOpenFileWithPath: (callback: (filePath: string) => void): () => void => {
    const handler = (_e: IpcRendererEvent, filePath: string) => callback(filePath)
    ipcRenderer.on('app:open-file-with-path', handler)
    return () => ipcRenderer.removeListener('app:open-file-with-path', handler)
  },
  onAbout: (callback: () => void): () => void => {
    ipcRenderer.on('app:about', callback)
    return () => ipcRenderer.removeListener('app:about', callback)
  },

  // ---- Panel / Main 跨窗口通信 ----
  openPanelWindow: (): void => ipcRenderer.send('panel:open'),
  closePanelWindow: (): void => ipcRenderer.send('panel:close'),
  sendPanelMessage: (message: unknown): void => ipcRenderer.send('panel:sendMessage', message),
  sendMainMessage: (message: unknown): void => ipcRenderer.send('main:sendMessage', message),

  onPanelClosed: (callback: () => void): () => void => {
    const listener = () => callback()
    ipcRenderer.on('panel:closed', listener)
    return () => ipcRenderer.removeListener('panel:closed', listener)
  },
  onPanelMessage: (callback: (message: unknown) => void): () => void => {
    const handler = (_e: IpcRendererEvent, message: unknown) => callback(message)
    ipcRenderer.on('panel:message', handler)
    return () => ipcRenderer.removeListener('panel:message', handler)
  },
  onMainMessage: (callback: (message: unknown) => void): () => void => {
    const handler = (_e: IpcRendererEvent, message: unknown) => callback(message)
    ipcRenderer.on('main:message', handler)
    return () => ipcRenderer.removeListener('main:message', handler)
  },

  // ---- 独立作品桌面打包 ----
  desktopBuild: (payload: {
    shellDir: string
    platforms?: Array<'win' | 'mac' | 'linux' | 'current'>
    workTitle?: string
    logChannel?: string
  }): Promise<{
    success: boolean
    error?: string
    outputDir?: string
    outputs?: Array<{ name: string; path: string; size: number; type: string }>
  }> => ipcRenderer.invoke('desktop:build', payload),

  onDesktopBuildLog: (
    logChannel: string,
    callback: (payload: { level: 'info' | 'warn' | 'error'; msg: string }) => void
  ): () => void => {
    const listener = (_e: IpcRendererEvent, payload: { level: 'info' | 'warn' | 'error'; msg: string }) =>
      callback(payload)
    ipcRenderer.on(logChannel, listener)
    return () => ipcRenderer.removeListener(logChannel, listener)
  },

  // ---- Platform flags ----
  platform: process.platform,
  isElectron: true,
})

// 与 src/electron-api.d.ts 双写保持一致
declare global {
  interface Window {
    __electronAPI?: {
      readFile: (path: string) => Promise<{ success: boolean; data?: number[]; error?: string }>
      readFileAsText: (path: string) => Promise<{ success: boolean; data?: string; error?: string }>
      writeFile: (path: string, data: number[]) => Promise<{ success: boolean; error?: string }>
      getFileInfo: (path: string) => Promise<{
        success: boolean; name?: string; size?: number; type?: string; error?: string
      }>
      openFileDialog: (options?: {
        title?: string
        filters?: Array<{ name: string; extensions: string[] }>
        properties?: string[]
      }) => Promise<{ success: boolean; path?: string; filePaths?: string[]; error?: string }>
      saveFileDialog: (options?: {
        title?: string
        defaultPath?: string
        filters?: Array<{ name: string; extensions: string[] }>
      }) => Promise<{ success: boolean; path?: string; error?: string }>
      openFolderDialog: () => Promise<{ success: boolean; path?: string; error?: string }>
      getProjectPath: () => Promise<{ success: boolean; path?: string }>
      getAppPath: () => Promise<string>
      copyToProject: (sourcePath: string, fileName: string) => Promise<{ success: boolean; path?: string; error?: string }>
      getRecentFiles: () => Promise<{ success: boolean; files?: string[] }>
      getVersion: () => Promise<{ success: boolean; version?: string }>
      minimizeWindow: () => void
      maximizeWindow: () => void
      closeWindow: () => void
      checkForUpdates: () => void
      downloadUpdate: () => void
      installUpdate: () => void
      openDownloadPage: () => void
      onUpdateChecking: (callback: () => void) => () => void
      onUpdateAvailable: (callback: (info: {
        version: string
        releaseDate?: string
        releaseNotes?: string
        downloadUrl?: string
      }) => void) => () => void
      onUpdateNotAvailable: (callback: () => void) => () => void
      onUpdateError: (callback: (message: string) => void) => () => void
      onNewFile: (callback: () => void) => () => void
      onOpenFile: (callback: () => void) => () => void
      onSaveFile: (callback: () => void) => () => void
      onSaveAs: (callback: () => void) => () => void
      onOpenRecent: (callback: (filePath: string) => void) => () => void
      onOpenFileWithPath: (callback: (filePath: string) => void) => () => void
      onAbout: (callback: () => void) => () => void
      platform: string
      isElectron: boolean
      openPanelWindow: () => void
      closePanelWindow: () => void
      sendPanelMessage: (message: unknown) => void
      sendMainMessage: (message: unknown) => void
      onPanelClosed: (callback: () => void) => () => void
      onPanelMessage: (callback: (message: unknown) => void) => () => void
      onMainMessage: (callback: (message: unknown) => void) => () => void
      desktopBuild: (payload: {
        shellDir: string
        platforms?: Array<'win' | 'mac' | 'linux' | 'current'>
        workTitle?: string
        logChannel?: string
      }) => Promise<{
        success: boolean
        error?: string
        outputDir?: string
        outputs?: Array<{ name: string; path: string; size: number; type: string }>
      }>
      onDesktopBuildLog: (
        logChannel: string,
        callback: (payload: { level: 'info' | 'warn' | 'error'; msg: string }) => void,
      ) => () => void
    }
  }
}

export {}
