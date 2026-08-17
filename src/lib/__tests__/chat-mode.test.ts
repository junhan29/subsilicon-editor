import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  getChatMode,
  setChatMode,
  subscribeChatMode,
} from '../ai/chat-mode'

const KEY = 'subsilicon_ai_chat_mode'

// —— localStorage mock（参考 custom-workflows.test.ts 的写法）——
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = String(v) },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { store = {} },
    // length / key 仅为实现 Storage 接口的最小 stub，本次测试不直接调用
    get length() { return Object.keys(store).length },
    key: (i: number) => Object.keys(store)[i] ?? null,
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, configurable: true })

// —— window mock：维护事件监听器并在 dispatchEvent 时触发（事件广播用）；
//    注意模块内部走 window.localStorage，因此 window 需暴露同一个 localStorage mock ——
const windowMock = (() => {
  const listeners: Record<string, Array<(e: { type: string }) => void>> = {}
  return {
    localStorage: localStorageMock,
    addEventListener: (type: string, handler: (e: { type: string }) => void) => {
      ;(listeners[type] ??= []).push(handler)
    },
    removeEventListener: (type: string, handler: (e: { type: string }) => void) => {
      listeners[type] = (listeners[type] ?? []).filter((h) => h !== handler)
    },
    dispatchEvent: (e: { type: string }) => {
      ;(listeners[e.type] ?? []).forEach((h) => h(e))
      return true
    },
  }
})()
if (typeof (globalThis as unknown as { window?: unknown }).window === 'undefined') {
  Object.defineProperty(globalThis, 'window', { value: windowMock, configurable: true })
}
// CustomEvent stub（事件广播用）
if (typeof (globalThis as unknown as { CustomEvent?: unknown }).CustomEvent === 'undefined') {
  Object.defineProperty(globalThis, 'CustomEvent', {
    value: class CustomEvent<T = unknown> {
      public type: string
      public detail: T | null
      constructor(type: string, options?: { detail?: T }) {
        this.type = type
        this.detail = options?.detail ?? null
      }
    },
    configurable: true,
  })
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('chat-mode', () => {
  it('无存储时默认返回 discuss-first', () => {
    expect(getChatMode()).toBe('discuss-first')
  })

  it('set 后 get 返回对应值', () => {
    setChatMode('act-along')
    expect(getChatMode()).toBe('act-along')
    expect(localStorage.getItem(KEY)).toBe('act-along')

    setChatMode('discuss-first')
    expect(getChatMode()).toBe('discuss-first')
    expect(localStorage.getItem(KEY)).toBe('discuss-first')
  })

  it('存储损坏 JSON / 非法值时回退默认', () => {
    // 损坏 JSON
    localStorage.setItem(KEY, '{ broken json')
    expect(getChatMode()).toBe('discuss-first')

    // JSON 结构但不匹配合法字符串
    localStorage.setItem(KEY, JSON.stringify({ mode: 'act-along' }))
    expect(getChatMode()).toBe('discuss-first')

    // 非法模式字符串
    localStorage.setItem(KEY, 'unknown-mode')
    expect(getChatMode()).toBe('discuss-first')

    // 无值（键被删除）
    localStorage.removeItem(KEY)
    expect(getChatMode()).toBe('discuss-first')
  })

  it('localStorage 抛错（getItem/setItem 抛异常）时 getChatMode 不抛错', () => {
    vi.spyOn(localStorageMock, 'getItem').mockImplementation(() => {
      throw new Error('storage boom')
    })
    vi.spyOn(localStorageMock, 'setItem').mockImplementation(() => {
      throw new Error('storage boom')
    })

    expect(() => getChatMode()).not.toThrow()
    expect(getChatMode()).toBe('discuss-first')
    // setChatMode 内部同样吞掉存储异常，不向上抛
    expect(() => setChatMode('act-along')).not.toThrow()
  })

  it('subscribeChatMode：set 后通过事件广播通知订阅者，取消订阅后不再通知', () => {
    const listener = vi.fn()
    const unsub = subscribeChatMode(listener)

    setChatMode('act-along')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith('act-along')

    unsub()
    setChatMode('discuss-first')
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
