/**
 * SubSilicon 作品独立桌面壳 - 主进程
 *
 * 功能：加载 index.html（由 SubSilicon Editor 导出的作品），提供：
 *   - 单窗口，禁用 DevTools（打包后）
 *   - 存档读写（本地 userData/saves/）
 *   - 窗口控制（全屏/最小化/关闭）
 *   - 自定义菜单（游戏名 / 重置存档 / 退出）
 *
 * 安全：
 *   - contextIsolation: true, nodeIntegration: false
 *   - preload 只暴露有限 bridge，防止用户通过剧情 JS 拿到 Node 能力
 */
const { app, BrowserWindow, Menu, ipcMain, shell, dialog, nativeImage } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const crypto = require('node:crypto')

// --- 读取作品元数据（壳打包时由编辑器生成 work-manifest.json）---
let manifest = { id: 'subsilicon-work', title: 'SubSilicon 作品', version: '1.0.0' }
try {
  const raw = fs.readFileSync(path.join(__dirname, 'work-manifest.json'), 'utf8')
  manifest = { ...manifest, ...JSON.parse(raw) }
} catch { /* ignore */ }

const SAVE_DIR = () => path.join(app.getPath('userData'), 'saves', manifest.id || 'default')

function ensureSaveDir() {
  try { fs.mkdirSync(SAVE_DIR(), { recursive: true }) } catch { /* ignore */ }
}

// --- 存档：以作品 ID 分区，按 slot 名存 JSON，并加一份校验和防篡改（非加密，仅防随手改）---
function slotFile(slot) { return path.join(SAVE_DIR(), `${slot}.json`) }

function checksum(obj) {
  return crypto.createHash('sha1').update(JSON.stringify(obj)).digest('hex').slice(0, 16)
}

ipcMain.handle('save:list', () => {
  ensureSaveDir()
  try {
    return fs.readdirSync(SAVE_DIR()).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5))
  } catch { return [] }
})

ipcMain.handle('save:load', (_e, slot) => {
  ensureSaveDir()
  try {
    const raw = fs.readFileSync(slotFile(String(slot)), 'utf8')
    const parsed = JSON.parse(raw)
    const expected = parsed.__ck
    delete parsed.__ck
    if (expected && expected !== checksum(parsed)) {
      throw new Error('存档校验失败')
    }
    return { ok: true, data: parsed }
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) }
  }
})

ipcMain.handle('save:write', (_e, slot, data) => {
  ensureSaveDir()
  try {
    const payload = { ...data, __ck: checksum(data) }
    fs.writeFileSync(slotFile(String(slot)), JSON.stringify(payload))
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) }
  }
})

ipcMain.handle('save:delete', (_e, slot) => {
  ensureSaveDir()
  try { fs.unlinkSync(slotFile(String(slot))); return { ok: true } } catch { return { ok: false } }
})

// --- 窗口控制 ---
ipcMain.handle('window:toggleFullscreen', () => {
  const w = BrowserWindow.getFocusedWindow()
  if (!w) return false
  w.setFullScreen(!w.isFullScreen())
  return w.isFullScreen()
})
ipcMain.handle('window:minimize', () => { const w = BrowserWindow.getFocusedWindow(); w && w.minimize() })
ipcMain.handle('app:resetSave', async () => {
  const btn = await dialog.showMessageBox({
    type: 'warning',
    title: manifest.title,
    message: '确认重置全部存档？此操作不可恢复。',
    buttons: ['取消', '重置全部'],
    defaultId: 0,
  })
  if (btn.response !== 1) return false
  ensureSaveDir()
  try {
    for (const f of fs.readdirSync(SAVE_DIR()).filter((x) => x.endsWith('.json'))) {
      fs.unlinkSync(path.join(SAVE_DIR(), f))
    }
    return true
  } catch { return false }
})
ipcMain.handle('app:openExternal', (_e, url) => {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return false
  shell.openExternal(url)
  return true
})

let win = null

function buildMenu() {
  const isMac = process.platform === 'darwin'
  const template = [
    ...(isMac ? [{
      label: manifest.title,
      submenu: [
        { label: `关于 ${manifest.title}`, role: 'about' },
        { type: 'separator' },
        { label: '重置存档...', click: async () => {
          const r = await dialog.showMessageBox({ type: 'warning', buttons: ['取消', '重置'], message: '确认重置全部存档？' })
          if (r.response === 1) {
            ensureSaveDir()
            for (const f of fs.readdirSync(SAVE_DIR()).filter((x) => x.endsWith('.json'))) {
              try { fs.unlinkSync(path.join(SAVE_DIR(), f)) } catch { /* ignore */ }
            }
          }
        } },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { label: '退出', role: 'quit' },
      ],
    }] : []),
    {
      label: '故事',
      submenu: [
        { label: '重置存档...', accelerator: isMac ? 'Cmd+Shift+R' : 'Ctrl+Shift+R', click: async () => {
          const r = await dialog.showMessageBox({ type: 'warning', buttons: ['取消', '重置'], message: '确认重置全部存档？' })
          if (r.response === 1) {
            ensureSaveDir()
            for (const f of fs.readdirSync(SAVE_DIR()).filter((x) => x.endsWith('.json'))) {
              try { fs.unlinkSync(path.join(SAVE_DIR(), f)) } catch { /* ignore */ }
            }
          }
        } },
        { type: 'separator' },
        { label: '切换全屏', accelerator: isMac ? 'Cmd+Ctrl+F' : 'F11', click: () => { const w = BrowserWindow.getFocusedWindow(); if (w) w.setFullScreen(!w.isFullScreen()) } },
        ...(!isMac ? [
          { type: 'separator' },
          { label: '退出', role: 'quit', accelerator: 'Alt+F4' },
        ] : []),
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载故事' },
        { type: 'separator' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
      ],
    },
    ...(!isMac ? [{
      label: '关于',
      submenu: [
        { label: `SubSilicon 作品壳 v${manifest.version}` , enabled: false },
        { label: `作品 ID: ${manifest.id}`, enabled: false },
      ],
    }] : []),
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow() {
  // 优先读取 userData/窗口持久化
  let bounds = null
  try {
    const p = path.join(app.getPath('userData'), 'window-state.json')
    bounds = JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch { /* ignore */ }

  const icon = (() => {
    try {
      const p = path.join(__dirname, 'work-icon.png')
      if (fs.existsSync(p)) return nativeImage.createFromPath(p)
    } catch { /* ignore */ }
    return null
  })()

  win = new BrowserWindow({
    width: bounds && bounds.width || 1200,
    height: bounds && bounds.height || 800,
    x: bounds && bounds.x,
    y: bounds && bounds.y,
    minWidth: 640,
    minHeight: 480,
    title: manifest.title,
    icon: icon || undefined,
    backgroundColor: '#f5f1e8',
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: !app.isPackaged, // 打包后禁用 DevTools
      spellcheck: false,
    },
  })

  win.once('ready-to-show', () => win && win.show())

  win.on('close', () => {
    if (!win) return
    try {
      const p = path.join(app.getPath('userData'), 'window-state.json')
      fs.writeFileSync(p, JSON.stringify(win.getBounds()))
    } catch { /* ignore */ }
  })

  buildMenu()
  win.loadFile(path.join(__dirname, 'index.html'))
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
