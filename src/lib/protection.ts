/**
 * 前端防护模块
 *
 * 包含：域名绑定检测、代码水印、防右键、F12 检测
 * 目的：增加盗用成本，不是绝对防止
 */

// 合法域名白名单。subsilicon.cn 为官方域名；如需部署到自有域名，请在此添加。
const ALLOWED_DOMAINS = [
  'localhost',
  '127.0.0.1',
  'subsilicon.cn',
  'www.subsilicon.cn',
  'subsilicon.com',
  'www.subsilicon.com',
  'editor.subsilicon.cn',
  'aiforce.cloud',
  '*.aiforce.cloud',
]

// 代码水印（用于追踪盗用来源）
const BUILD_ID = 'ss-2026-07-02'
const BUILD_TIME = '20260702'
const WATERMARK = `__SUBSILICON_PROTECT__|${BUILD_ID}|${BUILD_TIME}`

/**
 * 域名绑定检测
 *
 * 当前域名不在白名单中时，会在控制台输出警告并延迟跳转到官方地址。
 * 不需要此检测可直接删除调用，或修改 ALLOWED_DOMAINS。
 */
export function checkDomainBinding(): boolean {
  if (typeof window === 'undefined') return true

  const hostname = window.location.hostname

  // 开发环境跳过
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true

  // 检查白名单
  const isAllowed = ALLOWED_DOMAINS.some(domain => {
    if (domain.startsWith('*.')) {
      const suffix = domain.slice(1)
      return hostname.endsWith(suffix)
    }
    return hostname === domain
  })

  if (!isAllowed) {
    // 仅在控制台输出警告，不进行任何远程上报
    console.warn('%c⚠️ 版权警告', 'color: red; font-size: 16px; font-weight: bold;')
    console.warn('本编辑器由 SubSilicon（硅基之下）开发，未经授权部署。')
    console.warn('官方地址：https://subsilicon.cn')
    console.warn('如需授权使用，请联系：example@subsilicon.cn')

    // 延迟跳转（让盗用者有时间看到警告）
    setTimeout(() => {
      window.location.href = 'https://subsilicon.cn'
    }, 3000)

    return false
  }

  return true
}

/**
 * 上报盗用信息（已禁用）
 *
 * 出于隐私和合规考虑，开源版本不再向服务器上报任何信息。
 * 保留函数签名以兼容调用方，但函数体为空，不会发送任何网络请求。
 */
async function reportPiracy(_hostname: string, _url: string) {
  // 开源版本已禁用远程上报，不发送任何数据
}

/**
 * 注入代码水印
 * 在 DOM 中插入不可见水印，用于追踪盗用来源
 */
export function injectWatermark() {
  if (typeof document === 'undefined') return

  // 1. HTML 注释水印
  const comment = document.createComment(` ${WATERMARK} `)
  document.documentElement.insertBefore(comment, document.documentElement.firstChild)

  // 2. 隐藏 meta 标签
  const meta = document.createElement('meta')
  meta.setAttribute('name', 'subsilicon-watermark')
  meta.setAttribute('content', WATERMARK)
  meta.style.display = 'none'
  document.head.appendChild(meta)

  // 3. 全局变量水印（生产环境混淆后可作为指纹）
  try {
    ;(window as any).__SUBSILICON__ = WATERMARK
  } catch {}
}

/**
 * 防右键和选择（仅增加门槛，无法完全防止）
 */
export function setupAntiCopy() {
  if (typeof window === 'undefined') return

  // 开发环境不启用
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return

  // 防右键（编辑器区域除外）
  document.addEventListener('contextmenu', (e) => {
    const target = e.target as HTMLElement
    // 允许在输入框、文本域、编辑器内使用右键
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable ||
      target.closest('[data-editor-content]') ||
      target.closest('.react-flow') ||
      target.closest('[role="textbox"]')
    ) {
      return
    }
    e.preventDefault()
  })

  // 防选择（导航栏、工具栏等非内容区域）
  document.addEventListener('selectstart', (e) => {
    const target = e.target as HTMLElement
    // 允许在输入框、文本域、编辑器内选择
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable ||
      target.closest('[data-editor-content]') ||
      target.closest('.react-flow') ||
      target.closest('[role="textbox"]') ||
      target.closest('[data-selectable]')
    ) {
      return
    }
    // 允许在主内容区选择
    if (target.closest('main') || target.closest('article')) {
      return
    }
    e.preventDefault()
  })

  // 防拖拽
  document.addEventListener('dragstart', (e) => {
    const target = e.target as HTMLElement
    if (
      target.tagName === 'IMG' ||
      target.tagName === 'VIDEO' ||
      target.tagName === 'AUDIO'
    ) {
      // 允许编辑器内拖拽
      if (target.closest('[data-editor-content]') || target.closest('.react-flow')) {
        return
      }
      e.preventDefault()
    }
  })
}

/**
 * F12 / 开发者工具检测（基于 debugger 时间差，仅生产环境启用）
 */
let devToolsCheckInterval: ReturnType<typeof setInterval> | null = null
let devToolsWarningShown = false

export function setupDevToolsDetection() {
  if (typeof window === 'undefined') return

  // 开发环境不启用
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return

  const threshold = 160 // 毫秒

  const check = () => {
    const start = performance.now()
    // eslint-disable-next-line no-debugger
    debugger
    const end = performance.now()

    if (end - start > threshold) {
      if (!devToolsWarningShown) {
        devToolsWarningShown = true
        showDevToolsWarning()
      }
    } else {
      devToolsWarningShown = false
    }
  }

  // 每 10 秒检测一次（不要太频繁）
  devToolsCheckInterval = setInterval(check, 10000)
}

function showDevToolsWarning() {
  // 不用 alert，用 toast
  const toast = document.createElement('div')
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(239, 68, 68, 0.95);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 99999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    pointer-events: none;
    backdrop-filter: blur(4px);
  `
  toast.textContent = '⚠️ 检测到开发者工具已打开，请勿调试或复制代码'
  document.body.appendChild(toast)

  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast)
    }
  }, 3000)
}

/**
 * 停止开发者工具检测
 */
export function stopDevToolsDetection() {
  if (devToolsCheckInterval) {
    clearInterval(devToolsCheckInterval)
    devToolsCheckInterval = null
  }
}

/**
 * 初始化所有防护措施
 */
export function initProtection() {
  if (typeof window === 'undefined') return

  // 1. 注入水印
  injectWatermark()

  // 2. 域名检测（延迟执行，避免阻塞渲染）
  setTimeout(() => {
    checkDomainBinding()
  }, 500)

  // 3. 防右键和选择
  setupAntiCopy()

  // 4. 开发者工具检测
  setupDevToolsDetection()
}