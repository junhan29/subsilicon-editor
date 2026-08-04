/**
 * SubSilicon 作品独立桌面壳 - preload
 *
 * 只暴露最小必需的 bridge：存档 + 窗口控制 + 外部链接打开。
 * 不暴露任何 Node 能力（fs、process、child_process 等）。
 */
const { contextBridge, ipcRenderer } = require('electron')

const bridge = {
  // 存档：list / load / write / delete
  saveList: () => ipcRenderer.invoke('save:list'),
  saveLoad: (slot) => ipcRenderer.invoke('save:load', slot),
  saveWrite: (slot, data) => ipcRenderer.invoke('save:write', slot, data),
  saveDelete: (slot) => ipcRenderer.invoke('save:delete', slot),
  // 窗口
  toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  // App
  resetSaves: () => ipcRenderer.invoke('app:resetSave'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  // 壳标识（作品运行时可据此禁用浏览器-only 流程，如 <a download> 走 app.openExternal）
  isDesktopShell: true,
  platform: process.platform,
  versions: process.versions && { electron: process.versions.electron },
}

try {
  contextBridge.exposeInMainWorld('SubSiliconDesktop', bridge)
} catch {
  // fallback（非 contextIsolation 的环境兜底）
  window.SubSiliconDesktop = bridge
}
