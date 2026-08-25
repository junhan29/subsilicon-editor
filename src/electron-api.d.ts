declare global {
  const __APP_VERSION__: string
  const __APP_NAME__: string

  interface Window {
    __electronAPI?: {
      readFile: (path: string) => Promise<{ success: boolean; data?: number[]; error?: string }>
      readFileAsText: (path: string) => Promise<{ success: boolean; data?: string; error?: string }>
      writeFile: (path: string, data: number[]) => Promise<{ success: boolean; error?: string }>
      getFileInfo: (path: string) => Promise<{
        success: boolean;
        name?: string;
        size?: number;
        type?: string;
        error?: string;
      }>
      openFileDialog: (options?: {
        title?: string;
        filters?: Array<{ name: string; extensions: string[] }>;
        properties?: string[];
      }) => Promise<{ success: boolean; path?: string; filePaths?: string[]; error?: string }>
      saveFileDialog: (options?: {
        title?: string;
        defaultPath?: string;
        filters?: Array<{ name: string; extensions: string[] }>;
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
      // Mac 应用未签名，无法自动下载安装；以下三个方法统一打开官网下载页
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
      /** 独立游戏软件打包：在壳目录执行 electron-builder */
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
      /** 监听桌面打包进度日志；返回 remove listener */
      onDesktopBuildLog: (
        logChannel: string,
        callback: (payload: { level: 'info' | 'warn' | 'error'; msg: string }) => void
      ) => () => void
    }
  }
}

export {}

declare module '*.json' {
  const value: any
  export default value
}
