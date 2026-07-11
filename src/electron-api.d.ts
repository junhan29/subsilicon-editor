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
      addRecentFile: (filePath: string) => Promise<{ success: boolean; files?: string[] }>
      removeRecentFile: (filePath: string) => Promise<{ success: boolean; files?: string[] }>
      getDefaultProjectsDir: () => Promise<{ success: boolean; path?: string; error?: string }>
      getVersion: () => Promise<{ success: boolean; version?: string }>
      minimizeWindow: () => void
      maximizeWindow: () => void
      closeWindow: () => void
      checkForUpdates: () => void
      downloadUpdate: () => void
      installUpdate: () => void
      openPanelWindow: () => Promise<{ success: boolean; alreadyOpen?: boolean }>
      closePanelWindow: () => void
      sendPanelMessage: (message: { action: string; payload: unknown }) => void
      sendMainMessage: (message: { action: string; payload: unknown }) => void
      onPanelClosed: (callback: () => void) => () => void
      onPanelMessage: (callback: (message: { action: string; payload: unknown }) => void) => () => void
      onMainMessage: (callback: (message: { action: string; payload: unknown }) => void) => () => void
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

export {}