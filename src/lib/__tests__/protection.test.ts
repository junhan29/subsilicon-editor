/** protection 单元测试 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  checkDomainBinding,
  injectWatermark,
  setupAntiCopy,
  initProtection,
  stopDevToolsDetection,
} from '../protection'

interface MockState {
  window: any
  document: any
  navigator: any
  originalWindow: any
  originalDocument: any
  originalNavigator: any
  eventListeners: Map<string, (e: any) => void>
  commentNodes: string[]
  metaTags: Array<{ name: string; content: string }>
  globalVars: Record<string, any>
}

let mockState: MockState | null = null

function setupBrowserMock(hostname: string = 'localhost'): void {
  const eventListeners = new Map<string, (e: any) => void>()
  const commentNodes: string[] = []
  const metaTags: Array<{ name: string; content: string }> = []
  const globalVars: Record<string, any> = {}

  const mockDocument = {
    createComment: (text: string) => {
      commentNodes.push(text)
      return { type: 'comment', text }
    },
    documentElement: {
      insertBefore: (node: any, _ref: any) => node,
      firstChild: null,
    },
    createElement: (tag: string) => {
      const el: any = {
        tagName: tag.toUpperCase(),
        _attributes: {},
        style: {},
        setAttribute(name: string, value: string) {
          this._attributes[name] = value
          if (name === 'name') this._metaName = value
          if (name === 'content') this._metaContent = value
        },
        getAttribute(name: string) {
          return this._attributes[name]
        },
        appendChild: (child: any) => child,
      }
      if (tag === 'meta') {
        const origSetAttr = el.setAttribute.bind(el)
        el.setAttribute = (name: string, value: string) => {
          origSetAttr(name, value)
          if (name === 'content') {
            metaTags.push({ name: el._attributes.name || '', content: value })
          }
        }
      }
      return el
    },
    head: {
      appendChild: (child: any) => child,
    },
    body: {
      appendChild: (child: any) => child,
      parentNode: { removeChild: (child: any) => child },
    },
    addEventListener: (event: string, handler: (e: any) => void) => {
      eventListeners.set(event, handler)
    },
    querySelectorAll: () => [],
  }

  const mockWindow = {
    location: {
      hostname,
      href: `https://${hostname}/`,
      origin: `https://${hostname}`,
    },
    __SUBSILICON__: undefined as any,
  }

  const mockNavigator = {
    sendBeacon: () => true,
    userAgent: 'Mozilla/5.0 (Mock)',
    language: 'zh-CN',
    hardwareConcurrency: 4,
  }

  const originalWindow = (globalThis as any).window
  const originalDocument = (globalThis as any).document
  const originalNavigator = (globalThis as any).navigator

  Object.defineProperty(globalThis, 'window', {
    value: mockWindow,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(globalThis, 'document', {
    value: mockDocument,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(globalThis, 'navigator', {
    value: mockNavigator,
    writable: true,
    configurable: true,
  })

  mockState = {
    window: mockWindow,
    document: mockDocument,
    navigator: mockNavigator,
    originalWindow,
    originalDocument,
    originalNavigator,
    eventListeners,
    commentNodes,
    metaTags,
    globalVars,
  }
}

function teardownBrowserMock(): void {
  if (!mockState) return
  ;(globalThis as any).window = mockState.originalWindow
  ;(globalThis as any).document = mockState.originalDocument
  ;(globalThis as any).navigator = mockState.originalNavigator
  mockState = null
}

describe('checkDomainBinding 域名绑定检测', () => {
  it('window 未定义时返回 true（SSR 环境）', () => {
    teardownBrowserMock()
    const originalWindow = (globalThis as any).window
    delete (globalThis as any).window
    const result = checkDomainBinding()
    expect(result).toEqual(true)
    ;(globalThis as any).window = originalWindow
  })

  it('localhost 返回 true', () => {
    setupBrowserMock('localhost')
    const result = checkDomainBinding()
    expect(result).toEqual(true)
    teardownBrowserMock()
  })

  it('127.0.0.1 返回 true', () => {
    setupBrowserMock('127.0.0.1')
    const result = checkDomainBinding()
    expect(result).toEqual(true)
    teardownBrowserMock()
  })

  it('subsilicon.cn 返回 true', () => {
    setupBrowserMock('subsilicon.cn')
    const result = checkDomainBinding()
    expect(result).toEqual(true)
    teardownBrowserMock()
  })

  it('www.subsilicon.com 返回 true', () => {
    setupBrowserMock('www.subsilicon.com')
    const result = checkDomainBinding()
    expect(result).toEqual(true)
    teardownBrowserMock()
  })

  it('*.aiforce.cloud 子域名返回 true', () => {
    setupBrowserMock('editor.aiforce.cloud')
    const result = checkDomainBinding()
    expect(result).toEqual(true)
    teardownBrowserMock()
  })

  it('aiforce.cloud 主域返回 true', () => {
    setupBrowserMock('aiforce.cloud')
    const result = checkDomainBinding()
    expect(result).toEqual(true)
    teardownBrowserMock()
  })

  it('未知域名返回 false', () => {
    setupBrowserMock('evil-piracy-site.com')
    const originalWarn = console.warn
    console.warn = () => {}
    const result = checkDomainBinding()
    console.warn = originalWarn
    expect(result).toEqual(false)
    teardownBrowserMock()
  })

  it('editor.subsilicon.cn 返回 true', () => {
    setupBrowserMock('editor.subsilicon.cn')
    const result = checkDomainBinding()
    expect(result).toEqual(true)
    teardownBrowserMock()
  })
})

describe('injectWatermark 水印注入', () => {
  it('document 未定义时不报错（SSR 环境）', () => {
    teardownBrowserMock()
    const originalDocument = (globalThis as any).document
    delete (globalThis as any).document
    injectWatermark()
    ;(globalThis as any).document = originalDocument
  })

  it('注入 HTML 注释水印', () => {
    setupBrowserMock('localhost')
    injectWatermark()
    expect(mockState!.commentNodes.length > 0).toBe(true)
    const comment = mockState!.commentNodes[0]
    expect(comment.includes('__SUBSILICON_PROTECT__')).toBe(true)
    expect(comment.includes('ss-2026')).toBe(true)
    teardownBrowserMock()
  })

  it('注入隐藏 meta 标签', () => {
    setupBrowserMock('localhost')
    injectWatermark()
    expect(mockState!.metaTags.length > 0).toBe(true)
    const meta = mockState!.metaTags[0]
    expect(meta.name).toEqual('subsilicon-watermark')
    expect(meta.content.includes('__SUBSILICON_PROTECT__')).toBe(true)
    teardownBrowserMock()
  })

  it('设置全局变量 __SUBSILICON__', () => {
    setupBrowserMock('localhost')
    injectWatermark()
    expect(typeof mockState!.window.__SUBSILICON__ === 'string').toBe(true)
    expect(mockState!.window.__SUBSILICON__.includes('__SUBSILICON_PROTECT__')).toBe(true)
    teardownBrowserMock()
  })

  it('多次调用不报错', () => {
    setupBrowserMock('localhost')
    injectWatermark()
    injectWatermark()
    injectWatermark()
    expect(mockState!.commentNodes.length >= 3).toBe(true)
    teardownBrowserMock()
  })
})

describe('setupAntiCopy 防复制设置', () => {
  it('window 未定义时不报错（SSR 环境）', () => {
    teardownBrowserMock()
    const originalWindow = (globalThis as any).window
    delete (globalThis as any).window
    setupAntiCopy()
    ;(globalThis as any).window = originalWindow
  })

  it('localhost 开发环境不添加事件监听', () => {
    setupBrowserMock('localhost')
    setupAntiCopy()
    expect(mockState!.eventListeners.size === 0).toBe(true)
    teardownBrowserMock()
  })

  it('127.0.0.1 开发环境不添加事件监听', () => {
    setupBrowserMock('127.0.0.1')
    setupAntiCopy()
    expect(mockState!.eventListeners.size === 0).toBe(true)
    teardownBrowserMock()
  })

  it('生产环境添加 contextmenu 事件监听', () => {
    setupBrowserMock('subsilicon.cn')
    setupAntiCopy()
    expect(mockState!.eventListeners.has('contextmenu')).toBe(true)
    teardownBrowserMock()
  })

  it('生产环境添加 selectstart 事件监听', () => {
    setupBrowserMock('subsilicon.cn')
    setupAntiCopy()
    expect(mockState!.eventListeners.has('selectstart')).toBe(true)
    teardownBrowserMock()
  })

  it('生产环境添加 dragstart 事件监听', () => {
    setupBrowserMock('subsilicon.cn')
    setupAntiCopy()
    expect(mockState!.eventListeners.has('dragstart')).toBe(true)
    teardownBrowserMock()
  })

  it('contextmenu 在 INPUT 元素上不阻止默认行为', () => {
    setupBrowserMock('subsilicon.cn')
    setupAntiCopy()
    const handler = mockState!.eventListeners.get('contextmenu')
    expect(typeof handler === 'function').toBe(true)
    let preventDefaultCalled = false
    const event = {
      target: { tagName: 'INPUT', closest: () => null, isContentEditable: false },
      preventDefault: () => { preventDefaultCalled = true },
    }
    handler!(event)
    expect(!preventDefaultCalled).toBe(true)
    teardownBrowserMock()
  })

  it('contextmenu 在普通元素上阻止默认行为', () => {
    setupBrowserMock('subsilicon.cn')
    setupAntiCopy()
    const handler = mockState!.eventListeners.get('contextmenu')
    let preventDefaultCalled = false
    const event = {
      target: { tagName: 'DIV', closest: () => null, isContentEditable: false },
      preventDefault: () => { preventDefaultCalled = true },
    }
    handler!(event)
    expect(preventDefaultCalled).toBe(true)
    teardownBrowserMock()
  })
})

describe('initProtection 综合初始化', () => {
  it('SSR 环境不报错', () => {
    teardownBrowserMock()
    const originalWindow = (globalThis as any).window
    delete (globalThis as any).window
    initProtection()
    ;(globalThis as any).window = originalWindow
  })

  it('localhost 环境初始化后注入水印但不添加防复制', () => {
    setupBrowserMock('localhost')
    initProtection()
    expect(mockState!.commentNodes.length > 0).toBe(true)
    expect(mockState!.eventListeners.size === 0).toBe(true)
    teardownBrowserMock()
  })

  it('生产环境初始化后注入水印和防复制', () => {
    setupBrowserMock('subsilicon.cn')
    initProtection()
    expect(mockState!.commentNodes.length > 0).toBe(true)
    expect(mockState!.eventListeners.has('contextmenu')).toBe(true)
    teardownBrowserMock()
  })
})

describe('stopDevToolsDetection 停止检测', () => {
  it('调用不报错', () => {
    stopDevToolsDetection()
  })

  it('多次调用不报错', () => {
    stopDevToolsDetection()
    stopDevToolsDetection()
    stopDevToolsDetection()
  })
})
