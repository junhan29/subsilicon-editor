"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// desktop/preload.ts
var preload_exports = {};
module.exports = __toCommonJS(preload_exports);
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("__electronAPI", {
  // ---- File ----
  readFile: /* @__PURE__ */ __name((path) => import_electron.ipcRenderer.invoke("readFile", path), "readFile"),
  readFileAsText: /* @__PURE__ */ __name((path) => import_electron.ipcRenderer.invoke("readFileAsText", path), "readFileAsText"),
  writeFile: /* @__PURE__ */ __name((path, data) => import_electron.ipcRenderer.invoke("writeFile", path, data), "writeFile"),
  getFileInfo: /* @__PURE__ */ __name((path) => import_electron.ipcRenderer.invoke("getFileInfo", path), "getFileInfo"),
  getAppPath: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.invoke("getAppPath"), "getAppPath"),
  // ---- Dialogs ----
  openFileDialog: /* @__PURE__ */ __name((options) => import_electron.ipcRenderer.invoke("openFileDialog", options), "openFileDialog"),
  saveFileDialog: /* @__PURE__ */ __name((options) => import_electron.ipcRenderer.invoke("saveFileDialog", options), "saveFileDialog"),
  openFolderDialog: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.invoke("openFolderDialog"), "openFolderDialog"),
  // ---- Project ----
  getProjectPath: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.invoke("getProjectPath"), "getProjectPath"),
  copyToProject: /* @__PURE__ */ __name((sourcePath, fileName) => import_electron.ipcRenderer.invoke("copyToProject", sourcePath, fileName), "copyToProject"),
  // ---- App meta ----
  getRecentFiles: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.invoke("getRecentFiles"), "getRecentFiles"),
  getVersion: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.invoke("getVersion"), "getVersion"),
  // ---- Window control ----
  minimizeWindow: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.send("minimizeWindow"), "minimizeWindow"),
  maximizeWindow: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.send("maximizeWindow"), "maximizeWindow"),
  closeWindow: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.send("closeWindow"), "closeWindow"),
  // ---- Update (统一改为打开下载页：Mac 未签名，无法自动安装) ----
  checkForUpdates: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.send("checkForUpdates"), "checkForUpdates"),
  downloadUpdate: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.send("openDownloadPage"), "downloadUpdate"),
  installUpdate: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.send("openDownloadPage"), "installUpdate"),
  openDownloadPage: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.send("openDownloadPage"), "openDownloadPage"),
  onUpdateChecking: /* @__PURE__ */ __name((callback) => {
    const listener = /* @__PURE__ */ __name(() => callback(), "listener");
    import_electron.ipcRenderer.on("update-checking", listener);
    return () => import_electron.ipcRenderer.removeListener("update-checking", listener);
  }, "onUpdateChecking"),
  onUpdateAvailable: /* @__PURE__ */ __name((callback) => {
    const handler = /* @__PURE__ */ __name((_e, info) => callback(info), "handler");
    import_electron.ipcRenderer.on("update-available", handler);
    return () => import_electron.ipcRenderer.removeListener("update-available", handler);
  }, "onUpdateAvailable"),
  onUpdateNotAvailable: /* @__PURE__ */ __name((callback) => {
    const listener = /* @__PURE__ */ __name(() => callback(), "listener");
    import_electron.ipcRenderer.on("update-not-available", listener);
    return () => import_electron.ipcRenderer.removeListener("update-not-available", listener);
  }, "onUpdateNotAvailable"),
  onUpdateError: /* @__PURE__ */ __name((callback) => {
    const handler = /* @__PURE__ */ __name((_e, message) => callback(message), "handler");
    import_electron.ipcRenderer.on("update-error", handler);
    return () => import_electron.ipcRenderer.removeListener("update-error", handler);
  }, "onUpdateError"),
  // ---- Menu → Renderer events ----
  onNewFile: /* @__PURE__ */ __name((callback) => {
    import_electron.ipcRenderer.on("app:new-file", callback);
    return () => import_electron.ipcRenderer.removeListener("app:new-file", callback);
  }, "onNewFile"),
  onOpenFile: /* @__PURE__ */ __name((callback) => {
    import_electron.ipcRenderer.on("app:open-file", callback);
    return () => import_electron.ipcRenderer.removeListener("app:open-file", callback);
  }, "onOpenFile"),
  onSaveFile: /* @__PURE__ */ __name((callback) => {
    import_electron.ipcRenderer.on("app:save-file", callback);
    return () => import_electron.ipcRenderer.removeListener("app:save-file", callback);
  }, "onSaveFile"),
  onSaveAs: /* @__PURE__ */ __name((callback) => {
    import_electron.ipcRenderer.on("app:save-as", callback);
    return () => import_electron.ipcRenderer.removeListener("app:save-as", callback);
  }, "onSaveAs"),
  onOpenRecent: /* @__PURE__ */ __name((callback) => {
    const handler = /* @__PURE__ */ __name((_e, filePath) => callback(filePath), "handler");
    import_electron.ipcRenderer.on("app:open-recent", handler);
    return () => import_electron.ipcRenderer.removeListener("app:open-recent", handler);
  }, "onOpenRecent"),
  onOpenFileWithPath: /* @__PURE__ */ __name((callback) => {
    const handler = /* @__PURE__ */ __name((_e, filePath) => callback(filePath), "handler");
    import_electron.ipcRenderer.on("app:open-file-with-path", handler);
    return () => import_electron.ipcRenderer.removeListener("app:open-file-with-path", handler);
  }, "onOpenFileWithPath"),
  onAbout: /* @__PURE__ */ __name((callback) => {
    import_electron.ipcRenderer.on("app:about", callback);
    return () => import_electron.ipcRenderer.removeListener("app:about", callback);
  }, "onAbout"),
  // ---- Panel / Main 跨窗口通信 ----
  openPanelWindow: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.send("panel:open"), "openPanelWindow"),
  closePanelWindow: /* @__PURE__ */ __name(() => import_electron.ipcRenderer.send("panel:close"), "closePanelWindow"),
  sendPanelMessage: /* @__PURE__ */ __name((message) => import_electron.ipcRenderer.send("panel:sendMessage", message), "sendPanelMessage"),
  sendMainMessage: /* @__PURE__ */ __name((message) => import_electron.ipcRenderer.send("main:sendMessage", message), "sendMainMessage"),
  onPanelClosed: /* @__PURE__ */ __name((callback) => {
    const listener = /* @__PURE__ */ __name(() => callback(), "listener");
    import_electron.ipcRenderer.on("panel:closed", listener);
    return () => import_electron.ipcRenderer.removeListener("panel:closed", listener);
  }, "onPanelClosed"),
  onPanelMessage: /* @__PURE__ */ __name((callback) => {
    const handler = /* @__PURE__ */ __name((_e, message) => callback(message), "handler");
    import_electron.ipcRenderer.on("panel:message", handler);
    return () => import_electron.ipcRenderer.removeListener("panel:message", handler);
  }, "onPanelMessage"),
  onMainMessage: /* @__PURE__ */ __name((callback) => {
    const handler = /* @__PURE__ */ __name((_e, message) => callback(message), "handler");
    import_electron.ipcRenderer.on("main:message", handler);
    return () => import_electron.ipcRenderer.removeListener("main:message", handler);
  }, "onMainMessage"),
  // ---- 独立作品桌面打包 ----
  desktopBuild: /* @__PURE__ */ __name((payload) => import_electron.ipcRenderer.invoke("desktop:build", payload), "desktopBuild"),
  onDesktopBuildLog: /* @__PURE__ */ __name((logChannel, callback) => {
    const listener = /* @__PURE__ */ __name((_e, payload) => callback(payload), "listener");
    import_electron.ipcRenderer.on(logChannel, listener);
    return () => import_electron.ipcRenderer.removeListener(logChannel, listener);
  }, "onDesktopBuildLog"),
  // ---- Platform flags ----
  platform: process.platform,
  isElectron: true
});
