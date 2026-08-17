/** creator-input-store 单元测试 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  MAX_CONTENT_LENGTH,
  addCreatorInput,
  deleteCreatorInput,
  getInputCaptureEnabled,
  listCreatorInputs,
  setInputCaptureEnabled,
  updateCreatorInput,
} from '../creator-input-store'

// ---------- localStorage mock（node 测试环境无 localStorage） ----------
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

// ---------- 最小内存版 IndexedDB mock（仅覆盖 creatorInputs 用到的 API） ----------
class MockIDBKeyRange {
  lower: any
  upper: any
  openLower: boolean
  openUpper: boolean
  constructor(lower: any, upper: any, openLower = false, openUpper = false) {
    this.lower = lower
    this.upper = upper
    this.openLower = openLower
    this.openUpper = openUpper
  }
  static only(value: any): MockIDBKeyRange {
    return new MockIDBKeyRange(value, value, false, false)
  }
  static lowerBound(value: any, open = false): MockIDBKeyRange {
    return new MockIDBKeyRange(value, undefined, open, false)
  }
  static upperBound(value: any, open = false): MockIDBKeyRange {
    return new MockIDBKeyRange(undefined, value, false, open)
  }
  static bound(lower: any, upper: any, openLower = false, openUpper = false): MockIDBKeyRange {
    return new MockIDBKeyRange(lower, upper, openLower, openUpper)
  }
}

/** 判断 key 是否命中查询：基本值精确匹配 / IDBKeyRange 范围匹配 */
function keyMatches(key: any, query: any): boolean {
  if (query instanceof MockIDBKeyRange) {
    if (query.lower !== undefined && key < query.lower) return false
    if (query.upper !== undefined && key > query.upper) return false
    if (query.openLower && key === query.lower) return false
    if (query.openUpper && key === query.upper) return false
    return true
  }
  return key === query
}

class MockIDBRequest {
  result: any = undefined
  error: any = null
  onsuccess: (() => void) | null = null
  onerror: (() => void) | null = null
  onupgradeneeded: ((event: any) => void) | null = null
}

interface MockIndexDef {
  name: string
  keyPath: string
  unique: boolean
}

class MockIDBObjectStore {
  private data = new Map<string, any>()
  private keyPath: string
  private indexes = new Map<string, MockIndexDef>()

  constructor(keyPath: string) {
    this.keyPath = keyPath
  }

  get(key: string): MockIDBRequest {
    const req = new MockIDBRequest()
    setTimeout(() => {
      req.result = this.data.get(key)
      if (req.onsuccess) req.onsuccess()
    }, 0)
    return req
  }

  getAll(query?: any): MockIDBRequest {
    const req = new MockIDBRequest()
    setTimeout(() => {
      let results = [...this.data.values()]
      if (query !== undefined) {
        results = results.filter((r) => keyMatches(r[this.keyPath], query))
      }
      req.result = results
      if (req.onsuccess) req.onsuccess()
    }, 0)
    return req
  }

  put(value: any): MockIDBRequest {
    const req = new MockIDBRequest()
    const key = value[this.keyPath]
    this.data.set(key, value)
    setTimeout(() => {
      req.result = value
      if (req.onsuccess) req.onsuccess()
    }, 0)
    return req
  }

  delete(key: string): MockIDBRequest {
    const req = new MockIDBRequest()
    this.data.delete(key)
    setTimeout(() => {
      if (req.onsuccess) req.onsuccess()
    }, 0)
    return req
  }

  createIndex(name: string, keyPath: string, options?: { unique?: boolean }): void {
    this.indexes.set(name, { name, keyPath, unique: options?.unique ?? false })
  }

  index(name: string): MockIDBIndex {
    const def = this.indexes.get(name)
    return new MockIDBIndex(this.data, def ? def.keyPath : name)
  }

  _clear(): void {
    this.data.clear()
  }
}

class MockIDBIndex {
  constructor(
    private data: Map<string, any>,
    private keyPath: string,
  ) {}

  getAll(query?: any): MockIDBRequest {
    const req = new MockIDBRequest()
    setTimeout(() => {
      let results = [...this.data.values()]
      if (query !== undefined) {
        results = results.filter((r) => keyMatches(r[this.keyPath], query))
      }
      req.result = results
      if (req.onsuccess) req.onsuccess()
    }, 0)
    return req
  }
}

class MockIDBTransaction {
  constructor(private stores: Map<string, MockIDBObjectStore>) {}

  objectStore(name: string): MockIDBObjectStore {
    return this.stores.get(name)!
  }
}

class MockIDBDatabase {
  private stores: Map<string, MockIDBObjectStore> = new Map()
  private storeNames: Set<string> = new Set()
  objectStoreNames: { contains: (name: string) => boolean }
  onversionchange: (() => void) | null = null

  constructor() {
    this.objectStoreNames = {
      contains: (name: string) => this.storeNames.has(name),
    }
  }

  createObjectStore(name: string, options: { keyPath: string }): MockIDBObjectStore {
    const store = new MockIDBObjectStore(options.keyPath)
    this.stores.set(name, store)
    this.storeNames.add(name)
    return store
  }

  transaction(storeName: string, _mode?: string): MockIDBTransaction {
    return new MockIDBTransaction(this.stores)
  }

  close(): void {
  }

  _clear(): void {
    for (const store of this.stores.values()) {
      store._clear()
    }
  }
}

class MockIndexedDB {
  private db: MockIDBDatabase | null = null
  /** 模拟 IndexedDB 不可用（open 失败） */
  failOpen = false

  open(_name: string, _version?: number): MockIDBRequest {
    const req = new MockIDBRequest()
    if (this.failOpen) {
      setTimeout(() => {
        req.error = new Error('indexedDB unavailable')
        if (req.onerror) req.onerror()
      }, 0)
      return req
    }
    const isNew = !this.db
    if (isNew) {
      this.db = new MockIDBDatabase()
    }
    setTimeout(() => {
      req.result = this.db!
      if (isNew && req.onupgradeneeded) {
        req.onupgradeneeded({ target: req })
      }
      if (req.onsuccess) req.onsuccess()
    }, 0)
    return req
  }

  _reset(): void {
    if (this.db) {
      this.db._clear()
    }
    this.failOpen = false
  }
}

const mockIndexedDB = new MockIndexedDB()

beforeEach(() => {
  mockIndexedDB._reset()
  ;(globalThis as any).indexedDB = mockIndexedDB
  localStorage.clear()
})

afterEach(() => {
  mockIndexedDB._reset()
})

describe('creator-input-store', () => {
  // 注意：此用例必须最先执行——首个 openDB 会真正走到 mock 的 failOpen 分支，
  // 且 db.ts 的 onerror 会重置连接缓存，不影响后续用例。
  it('IndexedDB 不可用时不抛错（静默失败返回记录/空列表）', async () => {
    mockIndexedDB.failOpen = true
    // addCreatorInput 内部全量容错、永不 reject；若意外 reject 本用例将自动失败
    const record = await addCreatorInput({ workId: '', type: 'chat', content: '离线内容', source: 'manual' })
    expect(record).toBeDefined()
    expect(record.content).toBe('离线内容')
    const list = await listCreatorInputs()
    expect(list).toEqual([])
    mockIndexedDB.failOpen = false
  })

  it('可以新增创作者输入', async () => {
    const record = await addCreatorInput({
      workId: 'work-1',
      type: 'inspiration',
      content: '灵感：雨夜咖啡馆',
      source: 'chat',
      notes: '待整理',
    })
    expect(record.id).toBeTruthy()
    expect(record.workId).toBe('work-1')
    expect(record.type).toBe('inspiration')
    expect(record.source).toBe('chat')
    expect(record.notes).toBe('待整理')
    expect(record.createdAt).toBeGreaterThan(0)

    const list = await listCreatorInputs('work-1')
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(record.id)
    expect(list[0].content).toBe('灵感：雨夜咖啡馆')
  })

  it('可以删除创作者输入', async () => {
    const a = await addCreatorInput({ workId: '', type: 'chat', content: '待删除', source: 'manual' })
    await addCreatorInput({ workId: '', type: 'chat', content: '保留', source: 'manual' })
    await deleteCreatorInput(a.id)
    const list = await listCreatorInputs()
    expect(list).toHaveLength(1)
    expect(list[0].content).toBe('保留')
  })

  it('可以更新创作者输入（type / notes 合并，其他字段不变）', async () => {
    const record = await addCreatorInput({ workId: 'work-1', type: 'setting', content: '世界观设定', source: 'panel' })
    await updateCreatorInput(record.id, { type: 'correction', notes: '补充：主角性格' })
    const list = await listCreatorInputs('work-1')
    expect(list[0].type).toBe('correction')
    expect(list[0].notes).toBe('补充：主角性格')
    expect(list[0].content).toBe('世界观设定')
    expect(list[0].source).toBe('panel')
  })

  it('更新不存在的 id 不抛错', async () => {
    await expect(updateCreatorInput('no-such-id', { type: 'chat' })).resolves.toBeUndefined()
  })

  it('workId 隔离：不同作品不串扰，空字符串表示全局', async () => {
    await addCreatorInput({ workId: 'work-a', type: 'inspiration', content: 'A 的灵感', source: 'chat' })
    await addCreatorInput({ workId: 'work-b', type: 'outline', content: 'B 的大纲', source: 'panel' })
    await addCreatorInput({ workId: '', type: 'chat', content: '全局对话', source: 'chat' })

    const a = await listCreatorInputs('work-a')
    expect(a).toHaveLength(1)
    expect(a[0].content).toBe('A 的灵感')

    const b = await listCreatorInputs('work-b')
    expect(b).toHaveLength(1)
    expect(b[0].content).toBe('B 的大纲')

    const all = await listCreatorInputs()
    expect(all).toHaveLength(3)
    expect(all.map((i) => i.content)).toEqual(expect.arrayContaining(['A 的灵感', 'B 的大纲', '全局对话']))
  })

  it('listCreatorInputs 按 createdAt 倒序返回', async () => {
    await addCreatorInput({ workId: 'work-1', type: 'chat', content: '第一条', source: 'manual' })
    // 保证两条记录 createdAt 不同（Date.now 同毫秒会导致排序不稳定）
    await new Promise((r) => setTimeout(r, 5))
    await addCreatorInput({ workId: 'work-1', type: 'chat', content: '第二条', source: 'manual' })
    const list = await listCreatorInputs('work-1')
    expect(list[0].content).toBe('第二条')
    expect(list[1].content).toBe('第一条')
  })

  it('content 超过最大长度被剪裁', async () => {
    const longContent = '长'.repeat(MAX_CONTENT_LENGTH + 1000)
    const record = await addCreatorInput({ workId: '', type: 'chat', content: longContent, source: 'manual' })
    expect(record.content.length).toBe(MAX_CONTENT_LENGTH)
    const list = await listCreatorInputs()
    expect(list[0].content.length).toBe(MAX_CONTENT_LENGTH)
    expect(list[0].content).toBe(longContent.slice(0, MAX_CONTENT_LENGTH))
  })

  it('采集开关默认开启（未设置过视为 true）', () => {
    localStorage.clear()
    expect(getInputCaptureEnabled()).toBe(true)
  })

  it('setInputCaptureEnabled 设置后立即生效', () => {
    setInputCaptureEnabled(false)
    expect(getInputCaptureEnabled()).toBe(false)
    setInputCaptureEnabled(true)
    expect(getInputCaptureEnabled()).toBe(true)
  })
})
