/**
 * 独立游戏软件导出器
 *
 * 两步导出：
 *   1. 生成壳目录：index.html + main.cjs + preload.cjs + package.json + work-manifest.json + README
 *   2. 可选：在 Electron 环境中调用 __electronAPI.desktopBuild(shellDir)
 *      触发 electron-builder 真正打包成 .dmg/.exe/.AppImage
 *
 * 浏览器/Web 环境下只能生成壳目录 zip；Electron 环境下能做完整打包。
 */
import JSZip from 'jszip'
import { exportToHTML } from './export-html'
import type { StoryGraph } from '@editor/types/editor'
import type { MonetizationConfig } from './work-monetization'

/** 壳模板（随编辑器发布在 src/lib/desktop-shell/）
 *  此处作为兜底内联，避免模板丢失。 */
const TEMPLATES = {
  // main.cjs 与 desktop-shell/main.cjs 等价。为避免两处维护，优先用远程读取；失败 fallback 此处
} as const

export interface DesktopAppOptions {
  /** 作品 ID（用于 appId / 存档分区） */
  workId: string
  /** 作品名称（窗口标题、文件名、菜单、安装包名） */
  workTitle: string
  /** 作品作者（about、版权页） */
  author?: string
  /** 版本号，如 "1.0.0" */
  version?: string
  /** 作品描述（About、DMG 说明） */
  description?: string
  /** 付费解锁配置（沿用 Editor 的 monetization） */
  monetization?: MonetizationConfig
  /** 打包目标平台（Electron 环境下生效） */
  platforms?: Array<'win' | 'mac' | 'linux' | 'current'>
  /** 封面图 PNG dataURL（用作 App 图标；缺省用默认 SubSilicon 图标） */
  coverDataURL?: string
  /** 打包进度回调 */
  onProgress?: (stage: 'shell' | 'zip' | 'build' | 'done', info?: string) => void
  /** 打包日志回调（仅 Electron build 阶段触发） */
  onBuildLog?: (level: 'info' | 'warn' | 'error', msg: string) => void
}

export interface DesktopAppResult {
  /** 生成类型 */
  type: 'shell-zip' | 'installer-files'
  /** zip Blob（浏览器/通用）或已写出的安装包文件元信息列表 */
  zip?: Blob
  /** 文件名 */
  fileName: string
  /** 安装包信息（Electron build 成功后） */
  outputs?: Array<{ name: string; path: string; size: number; type: string }>
  /** 壳目录绝对路径（Electron build 成功后） */
  shellDir?: string
  /** 构建结果文本 */
  messages: string[]
}

/** 判断是否运行在 SubSilicon Editor Electron 环境，具备 desktopBuild 能力 */
export function canBuildDesktopInstaller(): boolean {
  return !!(typeof window !== 'undefined' && window.__electronAPI && window.__electronAPI.desktopBuild)
}

function template(id: 'main.cjs' | 'preload.cjs' | 'package.json.tpl' | 'README.md.tpl'): Promise<string> {
  // 从打包后的静态资源加载 desktop-shell/ 模板（Vite 会将它拷到 assets/ 或保持 import.meta.glob）
  // 浏览器环境下不依赖 fetch，直接返回一个兜底实现。
  return Promise.resolve(INLINE_TEMPLATES[id])
}

const INLINE_TEMPLATES: Record<'main.cjs' | 'preload.cjs' | 'package.json.tpl' | 'README.md.tpl', string> = {
  'main.cjs': `const { app, BrowserWindow, Menu, ipcMain, shell, dialog, nativeImage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
let manifest = { id: 'subsilicon-work', title: 'SubSilicon 作品', version: '1.0.0' };
try { manifest = { ...manifest, ...JSON.parse(fs.readFileSync(path.join(__dirname, 'work-manifest.json'), 'utf8')) }; } catch {}
const SAVE_DIR = () => path.join(app.getPath('userData'), 'saves', manifest.id || 'default');
function ensureSaveDir(){ try { fs.mkdirSync(SAVE_DIR(), { recursive: true }); } catch {} }
const slotFile = (s) => path.join(SAVE_DIR(), s + '.json');
const ck = (o) => crypto.createHash('sha1').update(JSON.stringify(o)).digest('hex').slice(0, 16);
ipcMain.handle('save:list', () => { ensureSaveDir(); try { return fs.readdirSync(SAVE_DIR()).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)); } catch { return []; } });
ipcMain.handle('save:load', (_e, s) => { ensureSaveDir(); try { const raw = fs.readFileSync(slotFile(String(s)), 'utf8'); const p = JSON.parse(raw); const expected = p.__ck; delete p.__ck; if (expected && expected !== ck(p)) throw new Error('存档校验失败'); return { ok: true, data: p }; } catch (e) { return { ok: false, error: e && e.message ? e.message : String(e) }; } });
ipcMain.handle('save:write', (_e, s, d) => { ensureSaveDir(); try { const payload = { ...d, __ck: ck(d) }; fs.writeFileSync(slotFile(String(s)), JSON.stringify(payload)); return { ok: true }; } catch (e) { return { ok: false, error: e && e.message ? e.message : String(e) }; } });
ipcMain.handle('save:delete', (_e, s) => { ensureSaveDir(); try { fs.unlinkSync(slotFile(String(s))); return { ok: true }; } catch { return { ok: false }; } });
ipcMain.handle('window:toggleFullscreen', () => { const w = BrowserWindow.getFocusedWindow(); if (!w) return false; w.setFullScreen(!w.isFullScreen()); return w.isFullScreen(); });
ipcMain.handle('window:minimize', () => { const w = BrowserWindow.getFocusedWindow(); w && w.minimize(); });
ipcMain.handle('app:openExternal', (_e, u) => { if (typeof u !== 'string' || !/^https?:\\/\\//i.test(u)) return false; shell.openExternal(u); return true; });
let win = null;
function createWindow() {
  let bounds = null;
  try { bounds = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'window-state.json'), 'utf8')); } catch {}
  let icon = null;
  try { const p = path.join(__dirname, 'work-icon.png'); if (fs.existsSync(p)) icon = nativeImage.createFromPath(p); } catch {}
  win = new BrowserWindow({
    width: bounds && bounds.width || 1200, height: bounds && bounds.height || 800,
    x: bounds && bounds.x, y: bounds && bounds.y,
    minWidth: 640, minHeight: 480,
    title: manifest.title, icon: icon || undefined,
    backgroundColor: '#f5f1e8', show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false,
      sandbox: false, webSecurity: true, allowRunningInsecureContent: false,
      devTools: !app.isPackaged, spellcheck: false,
    },
  });
  win.once('ready-to-show', () => win && win.show());
  win.on('close', () => { if (!win) return; try { fs.writeFileSync(path.join(app.getPath('userData'), 'window-state.json'), JSON.stringify(win.getBounds())); } catch {} });
  const isMac = process.platform === 'darwin';
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(isMac ? [{ label: manifest.title, submenu: [ { role: 'about' }, { type: 'separator' }, { label: '重置存档...', click: async () => { const r = await dialog.showMessageBox({ type: 'warning', buttons: ['取消', '重置'], message: '确认重置全部存档？' }); if (r.response === 1) { ensureSaveDir(); for (const f of fs.readdirSync(SAVE_DIR()).filter(x => x.endsWith('.json'))) try { fs.unlinkSync(path.join(SAVE_DIR(), f)); } catch {} } }, { type: 'separator' }, { role: 'services' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' } ] }] : []),
    { label: '故事', submenu: [ { label: '重置存档...', accelerator: isMac ? 'Cmd+Shift+R' : 'Ctrl+Shift+R', click: async () => { const r = await dialog.showMessageBox({ type: 'warning', buttons: ['取消', '重置'], message: '确认重置全部存档？' }); if (r.response === 1) { ensureSaveDir(); for (const f of fs.readdirSync(SAVE_DIR()).filter(x => x.endsWith('.json'))) try { fs.unlinkSync(path.join(SAVE_DIR(), f)); } catch {} } }, { type: 'separator' }, { label: '切换全屏', accelerator: isMac ? 'Cmd+Ctrl+F' : 'F11', click: () => { const w = BrowserWindow.getFocusedWindow(); if (w) w.setFullScreen(!w.isFullScreen()); } }, ...(!isMac ? [ { type: 'separator' }, { label: '退出', role: 'quit', accelerator: 'Alt+F4' } ] : []) ] },
    { label: '视图', submenu: [ { role: 'reload', label: '重新加载故事' }, { type: 'separator' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' } ] },
  ]));
  win.loadFile(path.join(__dirname, 'index.html'));
}
app.whenReady().then(() => { createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
`,
  'preload.cjs': `const { contextBridge, ipcRenderer } = require('electron');
const bridge = {
  saveList: () => ipcRenderer.invoke('save:list'),
  saveLoad: (s) => ipcRenderer.invoke('save:load', s),
  saveWrite: (s, d) => ipcRenderer.invoke('save:write', s, d),
  saveDelete: (s) => ipcRenderer.invoke('save:delete', s),
  toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  openExternal: (u) => ipcRenderer.invoke('app:openExternal', u),
  isDesktopShell: true,
  platform: process.platform,
};
try { contextBridge.exposeInMainWorld('SubSiliconDesktop', bridge); } catch { window.SubSiliconDesktop = bridge; }
`,
  'package.json.tpl': `{
  "name": "subsilicon-work-shell",
  "version": "__VERSION__",
  "private": true,
  "_subsiliconStandaloneShell": true,
  "description": "__DESCRIPTION__",
  "main": "main.cjs",
  "author": "__AUTHOR__",
  "scripts": {
    "start": "electron .",
    "dist:mac": "electron-builder --mac --publish never",
    "dist:win": "electron-builder --win --publish never",
    "dist:linux": "electron-builder --linux --publish never",
    "dist:all": "electron-builder -mw --publish never"
  },
  "devDependencies": {
    "electron": "43.0.0",
    "electron-builder": "26.15.3"
  },
  "build": {
    "appId": "cn.subsilicon.work.__WORK_ID__",
    "productName": "__WORK_NAME__",
    "directories": { "output": "dist" },
    "asar": true,
    "asarUnpack": ["index.html", "work-manifest.json", "work-icon.png"],
    "files": ["main.cjs", "preload.cjs", "index.html", "work-manifest.json", "work-icon.png"],
    "mac": {
      "category": "public.app-category.games",
      "target": [ { "target": "dmg", "arch": ["x64", "arm64"] }, { "target": "zip", "arch": ["x64", "arm64"] } ],
      "icon": "build/icon.icns", "darkModeSupport": true, "hardenedRuntime": false, "gatekeeperAssess": false
    },
    "win": {
      "target": [ { "target": "nsis", "arch": ["x64"] }, { "target": "portable", "arch": ["x64"] } ],
      "icon": "build/icon.ico"
    },
    "linux": {
      "target": [ { "target": "AppImage", "arch": ["x64"] }, { "target": "deb", "arch": ["x64"] } ],
      "category": "Game", "icon": "build/icon.png"
    },
    "nsis": {
      "oneClick": false, "allowToChangeInstallationDirectory": true, "perMachine": false,
      "createDesktopShortcut": true, "createStartMenuShortcut": true, "shortcutName": "__WORK_NAME__"
    }
  }
}
`,
  'README.md.tpl': `# __WORK_NAME__ · SubSilicon 独立桌面作品

## 运行方式

1. **预览**：安装依赖后本地启动
   \`\`\`bash
   npm install
   npm start
   \`\`\`

2. **打包分发**
   - macOS：\`npm run dist:mac\`（.dmg + zip）
   - Windows：\`npm run dist:win\`（NSIS 安装包 + portable 免安装）
   - Linux：\`npm run dist:linux\`（AppImage + deb）
   - 一键 Win+Mac：\`npm run dist:all\`

3. **直接分发 dist/ 下的产物给用户**。

## 壳 API（作品 HTML 内可直接调用）

\`\`\`javascript
if (window.SubSiliconDesktop) {
  await SubSiliconDesktop.saveWrite('auto', { currentNodeId, variables });
  const s = await SubSiliconDesktop.saveLoad('auto'); // { ok, data }
  await SubSiliconDesktop.saveDelete('auto');
  const slots = await SubSiliconDesktop.saveList(); // string[]
  await SubSiliconDesktop.toggleFullscreen();
  await SubSiliconDesktop.openExternal('https://...');
}
\`\`\`

## 合规与签名

- Windows：未签名的安装包会被 SmartScreen 拦截，建议购买 EV 代码签名证书。
- macOS：未公证的 App 打开前需"右键 → 打开"，或执行 \`xattr -d com.apple.quarantine /Applications/你的App.app\`。
- Linux AppImage：\`chmod +x *.AppImage && ./xxx.AppImage\`。

**作品版权归创作者所有**：本壳只负责打包，不承担作品内容责任。
`,
}

/** dataURL -> { blob, ext } */
function parseDataURL(url: string): { blob: Blob; ext: string } | null {
  if (!url || !url.startsWith('data:')) return null
  try {
    const [mimeType, content] = url.split(',')
    const mime = mimeType.match(/:(.*?);/)?.[1] || 'application/octet-stream'
    const binary = atob(content)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const ext = (mime.split('/')[1] || 'bin').split(';')[0].toLowerCase()
    return { blob: new Blob([bytes], { type: mime }), ext }
  } catch {
    return null
  }
}

function safeWorkId(raw: string): string {
  return (raw || 'subsilicon-work')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
    || 'subsilicon-work'
}

function safeWorkTitle(raw: string): string {
  // eslint-disable-next-line no-control-regex
  return (raw || 'SubSilicon 作品').replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ').slice(0, 60) || 'SubSilicon 作品'
}

/** 填充模板占位符 */
function fillPackageTpl(opts: DesktopAppOptions): string {
  const workId = safeWorkId(opts.workId)
  const workName = safeWorkTitle(opts.workTitle)
  return INLINE_TEMPLATES['package.json.tpl']
    .replace(/__WORK_ID__/g, workId)
    .replace(/__WORK_NAME__/g, workName)
    .replace(/__VERSION__/g, opts.version || '1.0.0')
    .replace(/__DESCRIPTION__/g, JSON.stringify(opts.description || `SubSilicon 独立作品：${workName}`).replace(/^"|"$/g, ''))
    .replace(/__AUTHOR__/g, JSON.stringify(opts.author || 'Unknown Creator').replace(/^"|"$/g, ''))
}

function fillReadmeTpl(opts: DesktopAppOptions): string {
  return INLINE_TEMPLATES['README.md.tpl'].replace(/__WORK_NAME__/g, safeWorkTitle(opts.workTitle))
}

/** 写出壳目录（Electron 环境用绝对路径；纯前端返回 JSZip） */
async function assembleShell(
  graph: StoryGraph,
  opts: DesktopAppOptions,
): Promise<{ zip: JSZip; manifest: { id: string; title: string; author?: string; version?: string; exportedAt: string } }> {
  opts.onProgress?.('shell', '生成单文件 HTML')
  const html = await exportToHTML(graph, opts.monetization)

  const workId = safeWorkId(opts.workId)
  const workTitle = safeWorkTitle(opts.workTitle)

  const manifest = {
    id: workId,
    title: workTitle,
    author: opts.author,
    version: opts.version || '1.0.0',
    exportedAt: new Date().toISOString(),
  }

  const zip = new JSZip()
  zip.file('index.html', html)
  zip.file('main.cjs', INLINE_TEMPLATES['main.cjs'])
  zip.file('preload.cjs', INLINE_TEMPLATES['preload.cjs'])
  zip.file('package.json', fillPackageTpl(opts))
  zip.file('work-manifest.json', JSON.stringify(manifest, null, 2))
  zip.file('README.md', fillReadmeTpl(opts))

  if (opts.coverDataURL) {
    const parsed = parseDataURL(opts.coverDataURL)
    if (parsed) {
      // work-icon.png 作为壳默认图标；同时写 build/ 下的标准名
      zip.file('work-icon.png', parsed.blob)
    }
  }
  return { zip, manifest }
}

/** 通用：生成壳 zip（所有环境可用） */
export async function exportDesktopAppShell(
  graph: StoryGraph,
  opts: DesktopAppOptions
): Promise<Blob> {
  const { zip } = await assembleShell(graph, opts)
  opts.onProgress?.('zip', '压缩壳目录')
  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  }, (meta) => {
    opts.onProgress?.('zip', `压缩中 ${meta.percent.toFixed(0)}%`)
  })
}

/** Electron 环境专用：先写壳目录到磁盘 → 调用 electron-builder 打包 → 返回产物 */
export async function exportDesktopAppInstallers(
  graph: StoryGraph,
  opts: DesktopAppOptions
): Promise<DesktopAppResult> {
  const api = typeof window !== 'undefined' ? window.__electronAPI : undefined
  if (!api || !api.desktopBuild) {
    // Fallback 非 Electron：返回 zip
    opts.onProgress?.('shell', '当前环境非 Electron，回退到壳目录 zip 导出')
    const blob = await exportDesktopAppShell(graph, opts)
    return {
      type: 'shell-zip',
      zip: blob,
      fileName: `${safeWorkTitle(opts.workTitle)}-shell.zip`,
      messages: ['当前环境非 SubSilicon Editor Electron，无法直接打包安装包；已导出壳目录 zip，解压后执行 npm install && npm run dist:xxx 即可。'],
    }
  }

  const { zip, manifest } = await assembleShell(graph, opts)

  // 1) 选择壳输出目录
  opts.onProgress?.('shell', '选择壳输出目录')
  const dirRes = await api.openFolderDialog()
  if (!dirRes.success || !dirRes.path) {
    return { type: 'shell-zip', fileName: `${safeWorkTitle(opts.workTitle)}-cancelled.zip`, messages: ['已取消选择输出目录'] }
  }
  const shellDir = `${dirRes.path.replace(/\/+$/, '')}/${safeWorkTitle(opts.workTitle)}-shell`
  opts.onProgress?.('shell', `写出壳目录到 ${shellDir}`)

  // 2) 递归写文件
  const written: Array<{ path: string; data: number[] }> = []
  await new Promise<void>((resolve, reject) => {
    let pending = 0
    let settled = false
    zip.forEach((p, file) => {
      pending++
      file.async('uint8array')
        .then((buf) => {
          written.push({ path: `${shellDir}/${p}`, data: Array.from(buf) })
          if (--pending === 0 && !settled) { settled = true; resolve() }
        })
        .catch((e) => { if (!settled) { settled = true; reject(e) } })
    })
    if (pending === 0 && !settled) { settled = true; resolve() }
  })
  // 写所有文件
  for (const w of written) {
    const r = await api.writeFile(w.path, w.data)
    if (!r.success) {
      return { type: 'shell-zip', fileName: `${safeWorkTitle(opts.workTitle)}-write-failed.zip`, messages: [`写出失败：${w.path} — ${r.error || '未知错误'}`] }
    }
  }

  // 3) 调 electron-builder
  const messages: string[] = [`壳目录已写出到 ${shellDir}`]
  const logChannel = `desktop-build-log-${Date.now()}`
  let unsubscribe: (() => void) | undefined
  if (opts.onBuildLog && api.onDesktopBuildLog) {
    unsubscribe = api.onDesktopBuildLog(logChannel, (p) => opts.onBuildLog?.(p.level, p.msg))
  }

  opts.onProgress?.('build', `调用 electron-builder (${opts.platforms?.join(',') || 'current'})`)
  const build = await api.desktopBuild({
    shellDir,
    platforms: opts.platforms || ['current'],
    workTitle: manifest.title,
    logChannel,
  })
  if (unsubscribe) unsubscribe()

  if (build.success) {
    opts.onProgress?.('done', `完成，共 ${build.outputs?.length || 0} 个产物`)
  } else {
    opts.onProgress?.('done', `构建失败：${build.error}`)
    messages.push(`构建错误：${build.error || '未知错误'}`)
  }

  return {
    type: 'installer-files',
    fileName: `${safeWorkTitle(opts.workTitle)}-dist`,
    outputs: build.outputs || [],
    shellDir,
    messages,
  }
}

/** 统一入口：按环境自动选最佳方式 */
export async function exportDesktopApp(
  graph: StoryGraph,
  opts: DesktopAppOptions
): Promise<DesktopAppResult> {
  if (canBuildDesktopInstaller()) {
    return exportDesktopAppInstallers(graph, opts)
  }
  const blob = await exportDesktopAppShell(graph, opts)
  return {
    type: 'shell-zip',
    zip: blob,
    fileName: `${safeWorkTitle(opts.workTitle)}-shell.zip`,
    messages: ['纯前端环境仅能导出壳目录 zip。请在 SubSilicon Editor（Electron 版）中导出，或解压 zip 后本地执行 npm install && npm run dist:xxx 生成安装包。'],
  }
}

// 未使用的占位符避免 lint
void TEMPLATES; void template;
