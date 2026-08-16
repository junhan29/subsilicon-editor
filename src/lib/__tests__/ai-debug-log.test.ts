import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  appendDebugEntry,
  getDebugEntries,
  clearDebugEntries,
  removeDebugEntry,
  type AiDebugEntry,
} from '../ai/ai-debug-log'

function makeEntry(overrides: Partial<AiDebugEntry> = {}): AiDebugEntry {
  return {
    id: `e-${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
    userInput: '帮我写个开头',
    systemPrompt: 'system',
    graphContext: 'graph',
    rawResponse: 'raw',
    actions: [],
    previewMode: false,
    ...overrides,
  }
}

function stubLocalStorage() {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => { store.clear() },
  })
  return store
}

describe('ai-debug-log', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('append 后 get 往返一致（最新在头部）', () => {
    stubLocalStorage()
    appendDebugEntry(makeEntry({ id: 'a', userInput: '第一条' }))
    appendDebugEntry(makeEntry({ id: 'b', userInput: '第二条' }))
    const list = getDebugEntries()
    expect(list.map((e) => e.id)).toEqual(['b', 'a'])
    expect(list[0].userInput).toBe('第二条')
  })

  it('最多保留 50 条，超出丢弃最旧', () => {
    stubLocalStorage()
    for (let i = 0; i < 55; i++) {
      appendDebugEntry(makeEntry({ id: `e-${i}` }))
    }
    const list = getDebugEntries()
    expect(list).toHaveLength(50)
    expect(list[0].id).toBe('e-54')
    expect(list[49].id).toBe('e-5')
  })

  it('clear 清空', () => {
    stubLocalStorage()
    appendDebugEntry(makeEntry())
    clearDebugEntries()
    expect(getDebugEntries()).toEqual([])
  })

  it('removeDebugEntry 删除单条', () => {
    stubLocalStorage()
    appendDebugEntry(makeEntry({ id: 'keep' }))
    appendDebugEntry(makeEntry({ id: 'del' }))
    removeDebugEntry('del')
    expect(getDebugEntries().map((e) => e.id)).toEqual(['keep'])
  })

  it('损坏 JSON 返回空数组', () => {
    stubLocalStorage()
    localStorage.setItem('subsilicon.ai.debug.log.v1', '{broken')
    expect(getDebugEntries()).toEqual([])
  })

  it('localStorage 不可用时静默跳过', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(() => {
      appendDebugEntry(makeEntry())
      removeDebugEntry('x')
      clearDebugEntries()
    }).not.toThrow()
    expect(getDebugEntries()).toEqual([])
  })
})
