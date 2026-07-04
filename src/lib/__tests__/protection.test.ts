/** protection 单元测试 */
import {
  checkDomainBinding,
  injectWatermark,
  setupAntiCopy,
  initProtection,
  stopDevToolsDetection,
} from '../protection'

let passed = 0
let failed = 0
const failures: string[] = []

const testQueue: Array<{ describeName: string; testName: string; fn: () => void | Promise<void> }> = []
let currentDescribe = ''

function describe(name: string, fn: () => void): void {
  currentDescribe = name
  fn()
  currentDescribe = ''
}

function it(name: string, fn: () => void | Promise<void>): void {
  testQueue.push({ describeName: currentDescribe, testName: name, fn })
}

async function runTestQueue(): Promise<void> {
  let lastDescribe = ''
  for (const test of testQueue) {
    if (test.describeName !== lastDescribe) {
      console.log(`\n▸ ${test.describeName}`)
      lastDescribe = test.describeName
    }
    try {
      await test.fn()
      passed++
      console.log(`  ✓ ${test.testName}`)
    } catch (e) {
      failed++
      const msg = e instanceof Error ? e.message : String(e)
      failures.push(`${test.testName}: ${msg}`)
      console.log(`  ✗ ${test.testName}`)
      console.log(`    ${msg.split('\n').join('\n    ')}`)
    }
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) {
    throw new Error(`${message}\n     expected: ${e}\n     actual:   ${a}`)
  }
}

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

  // Mock document
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
        // 在 setAttribute 后记录到 metaTags
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

  // Mock window
  const mockWindow = {
    location: {
      hostname,
      href: `https://${hostname}/`,
      origin: `https://${hostname}`,
    },
    __SUBSILICON__: undefined as any,
  }

  // Mock navigator
  const mockNavigator = {
    sendBeacon: () => true,
    userAgent: 'Mozilla/5.0 (Mock)',
    language: 'zh-CN',
    hardwareConcurrency: 4,
  }

  // 保存原始值
  const originalWindow = (globalThis as any).window
  const originalDocument = (globalThis as any).document
  const originalNavigator = (globalThis as any).navigator

  // 设置 mock（navigator 在 Node 中为只读 getter，需用 defineProperty 覆盖）
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
  // 恢复原始值
  ;(globalThis as any).window = mockState.originalWindow
  ;(globalThis as any).document = mockState.originalDocument
  ;(globalThis as any).navigator = mockState.originalNavigator
  mockState = null
}

export async function runTests(): Promise<void> {
  passed = 0
  failed = 0
  failures.length = 0

  describe('checkDomainBinding 域名绑定检测', () => {
    it('window 未定义时返回 true（SSR 环境）', () => {
      // 确保没有 mock
      teardownBrowserMock()
      const originalWindow = (globalThis as any).window
      delete (globalThis as any).window
      const result = checkDomainBinding()
      assertEqual(result, true, 'SSR 环境应返回 true')
      ;(globalThis as any).window = originalWindow
    })

    it('localhost 返回 true', () => {
      setupBrowserMock('localhost')
      const result = checkDomainBinding()
      assertEqual(result, true, 'localhost 应返回 true')
      teardownBrowserMock()
    })

    it('127.0.0.1 返回 true', () => {
      setupBrowserMock('127.0.0.1')
      const result = checkDomainBinding()
      assertEqual(result, true, '127.0.0.1 应返回 true')
      teardownBrowserMock()
    })

    it('subsilicon.cn 返回 true', () => {
      setupBrowserMock('subsilicon.cn')
      const result = checkDomainBinding()
      assertEqual(result, true, 'subsilicon.cn 应返回 true')
      teardownBrowserMock()
    })

    it('www.subsilicon.com 返回 true', () => {
      setupBrowserMock('www.subsilicon.com')
      const result = checkDomainBinding()
      assertEqual(result, true, 'www.subsilicon.com 应返回 true')
      teardownBrowserMock()
    })

    it('*.aiforce.cloud 子域名返回 true', () => {
      setupBrowserMock('editor.aiforce.cloud')
      const result = checkDomainBinding()
      assertEqual(result, true, 'editor.aiforce.cloud 应返回 true')
      teardownBrowserMock()
    })

    it('aiforce.cloud 主域返回 true', () => {
      setupBrowserMock('aiforce.cloud')
      const result = checkDomainBinding()
      assertEqual(result, true, 'aiforce.cloud 应返回 true')
      teardownBrowserMock()
    })

    it('未知域名返回 false', () => {
      setupBrowserMock('evil-piracy-site.com')
      // 抑制 console.warn 输出
      const originalWarn = console.warn
      console.warn = () => {}
      const result = checkDomainBinding()
      console.warn = originalWarn
      assertEqual(result, false, '未知域名应返回 false')
      teardownBrowserMock()
    })

    it('editor.subsilicon.cn 返回 true', () => {
      setupBrowserMock('editor.subsilicon.cn')
      const result = checkDomainBinding()
      assertEqual(result, true, 'editor.subsilicon.cn 应返回 true')
      teardownBrowserMock()
    })
  })

  describe('injectWatermark 水印注入', () => {
    it('document 未定义时不报错（SSR 环境）', () => {
      teardownBrowserMock()
      const originalDocument = (globalThis as any).document
      delete (globalThis as any).document
      // 不应抛出异常
      injectWatermark()
      ;(globalThis as any).document = originalDocument
    })

    it('注入 HTML 注释水印', () => {
      setupBrowserMock('localhost')
      injectWatermark()
      assert(mockState!.commentNodes.length > 0, '应创建注释节点')
      const comment = mockState!.commentNodes[0]
      assert(comment.includes('__SUBSILICON_PROTECT__'), '注释应包含水印标识')
      assert(comment.includes('ss-2026'), '注释应包含 BUILD_ID')
      teardownBrowserMock()
    })

    it('注入隐藏 meta 标签', () => {
      setupBrowserMock('localhost')
      injectWatermark()
      assert(mockState!.metaTags.length > 0, '应创建 meta 标签')
      const meta = mockState!.metaTags[0]
      assertEqual(meta.name, 'subsilicon-watermark', 'meta name 应为 subsilicon-watermark')
      assert(meta.content.includes('__SUBSILICON_PROTECT__'), 'meta content 应包含水印')
      teardownBrowserMock()
    })

    it('设置全局变量 __SUBSILICON__', () => {
      setupBrowserMock('localhost')
      injectWatermark()
      assert(
        typeof mockState!.window.__SUBSILICON__ === 'string',
        '应设置 __SUBSILICON__ 全局变量'
      )
      assert(
        mockState!.window.__SUBSILICON__.includes('__SUBSILICON_PROTECT__'),
        '全局变量应包含水印'
      )
      teardownBrowserMock()
    })

    it('多次调用不报错', () => {
      setupBrowserMock('localhost')
      injectWatermark()
      injectWatermark()
      injectWatermark()
      assert(mockState!.commentNodes.length >= 3, '多次调用应创建多个注释')
      teardownBrowserMock()
    })
  })

  describe('setupAntiCopy 防复制设置', () => {
    it('window 未定义时不报错（SSR 环境）', () => {
      teardownBrowserMock()
      const originalWindow = (globalThis as any).window
      delete (globalThis as any).window
      // 不应抛出异常
      setupAntiCopy()
      ;(globalThis as any).window = originalWindow
    })

    it('localhost 开发环境不添加事件监听', () => {
      setupBrowserMock('localhost')
      setupAntiCopy()
      assert(
        mockState!.eventListeners.size === 0,
        'localhost 不应添加事件监听'
      )
      teardownBrowserMock()
    })

    it('127.0.0.1 开发环境不添加事件监听', () => {
      setupBrowserMock('127.0.0.1')
      setupAntiCopy()
      assert(
        mockState!.eventListeners.size === 0,
        '127.0.0.1 不应添加事件监听'
      )
      teardownBrowserMock()
    })

    it('生产环境添加 contextmenu 事件监听', () => {
      setupBrowserMock('subsilicon.cn')
      setupAntiCopy()
      assert(
        mockState!.eventListeners.has('contextmenu'),
        '应添加 contextmenu 事件监听'
      )
      teardownBrowserMock()
    })

    it('生产环境添加 selectstart 事件监听', () => {
      setupBrowserMock('subsilicon.cn')
      setupAntiCopy()
      assert(
        mockState!.eventListeners.has('selectstart'),
        '应添加 selectstart 事件监听'
      )
      teardownBrowserMock()
    })

    it('生产环境添加 dragstart 事件监听', () => {
      setupBrowserMock('subsilicon.cn')
      setupAntiCopy()
      assert(
        mockState!.eventListeners.has('dragstart'),
        '应添加 dragstart 事件监听'
      )
      teardownBrowserMock()
    })

    it('contextmenu 在 INPUT 元素上不阻止默认行为', () => {
      setupBrowserMock('subsilicon.cn')
      setupAntiCopy()
      const handler = mockState!.eventListeners.get('contextmenu')
      assert(typeof handler === 'function', '应有 contextmenu handler')
      // 模拟 INPUT 元素的 contextmenu 事件
      let preventDefaultCalled = false
      const event = {
        target: { tagName: 'INPUT', closest: () => null, isContentEditable: false },
        preventDefault: () => { preventDefaultCalled = true },
      }
      handler!(event)
      assert(!preventDefaultCalled, 'INPUT 元素上不应阻止右键')
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
      assert(preventDefaultCalled, '普通元素上应阻止右键')
      teardownBrowserMock()
    })
  })

  describe('initProtection 综合初始化', () => {
    it('SSR 环境不报错', () => {
      teardownBrowserMock()
      const originalWindow = (globalThis as any).window
      delete (globalThis as any).window
      // 不应抛出异常
      initProtection()
      ;(globalThis as any).window = originalWindow
    })

    it('localhost 环境初始化后注入水印但不添加防复制', () => {
      setupBrowserMock('localhost')
      initProtection()
      // 水印应被注入
      assert(mockState!.commentNodes.length > 0, '应注入水印注释')
      // 防复制不应被添加（localhost 开发环境）
      assert(
        mockState!.eventListeners.size === 0,
        'localhost 不应添加防复制监听'
      )
      teardownBrowserMock()
    })

    it('生产环境初始化后注入水印和防复制', () => {
      setupBrowserMock('subsilicon.cn')
      // 抑制 checkDomainBinding 的 console.warn（如果有）
      initProtection()
      assert(mockState!.commentNodes.length > 0, '应注入水印')
      assert(
        mockState!.eventListeners.has('contextmenu'),
        '应添加防右键监听'
      )
      teardownBrowserMock()
    })
  })

  describe('stopDevToolsDetection 停止检测', () => {
    it('调用不报错', () => {
      // stopDevToolsDetection 应安全调用，即使未启动检测
      stopDevToolsDetection()
    })

    it('多次调用不报错', () => {
      stopDevToolsDetection()
      stopDevToolsDetection()
      stopDevToolsDetection()
    })
  })

  await runTestQueue()

  // 清理
  teardownBrowserMock()

  console.log(
    `\n=== protection 测试结果: ${passed} 通过, ${failed} 失败 ===`
  )
  if (failed > 0) {
    console.log('\n失败用例:')
    failures.forEach((f) => console.log(`  - ${f}`))
    throw new Error(`${failed} 个测试失败`)
  }
}

// 当作主模块运行时自动执行测试
const isMainModule = (() => {
  try {
    return (
      typeof process !== 'undefined' &&
      !!process.argv[1]?.includes('protection.test')
    )
  } catch {
    return false
  }
})()

if (isMainModule) {
  runTests()
    .then(() => {
      // 所有测试通过后立即退出，避免 checkDomainBinding 中 pending 的
      // setTimeout（3 秒后跳转）在 mock 被清理后触发导致进程崩溃
      process.exit(0)
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
