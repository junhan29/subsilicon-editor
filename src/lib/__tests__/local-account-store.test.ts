/** local-account-store 单元测试 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { webcrypto } from 'node:crypto'
import {
  register,
  login,
  getAccount,
  logout,
  isLoggedIn,
  updateDisplayName,
} from '../local-account-store'

if (typeof globalThis.crypto === 'undefined') {
  ;(globalThis as any).crypto = webcrypto
}

class MockIDBRequest {
  result: any = undefined
  error: any = null
  onsuccess: (() => void) | null = null
  onerror: (() => void) | null = null
  onupgradeneeded: ((event: any) => void) | null = null
}

class MockIDBObjectStore {
  private data: Map<string, any> = new Map()
  private keyPath: string

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

  createIndex(_name: string, _keyPath: string, _options?: any): void {
  }

  _getData(): Map<string, any> {
    return this.data
  }
}

class MockIDBTransaction {
  private storeMap: Map<string, MockIDBObjectStore>

  constructor(stores: Map<string, MockIDBObjectStore>) {
    this.storeMap = stores
  }

  objectStore(name: string): MockIDBObjectStore {
    return this.storeMap.get(name)!
  }
}

class MockIDBDatabase {
  private stores: Map<string, MockIDBObjectStore> = new Map()
  private storeNames: Set<string> = new Set()
  objectStoreNames: { contains: (name: string) => boolean }

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

  _clearData(): void {
    for (const store of this.stores.values()) {
      store._getData().clear()
    }
  }
}

class MockIndexedDB {
  private db: MockIDBDatabase | null = null

  open(_name: string, _version?: number): MockIDBRequest {
    const req = new MockIDBRequest()
    const isNew = !this.db
    if (isNew) {
      this.db = new MockIDBDatabase()
    }
    setTimeout(() => {
      req.result = this.db!
      if (isNew && req.onupgradeneeded) {
        req.onupgradeneeded({ target: req })
      }
      if (req.onsuccess) {
        req.onsuccess()
      }
    }, 0)
    return req
  }

  _reset(): void {
    if (this.db) {
      this.db._clearData()
    }
  }
}

const mockIndexedDB = new MockIndexedDB()
const originalIndexedDB = (globalThis as any).indexedDB

function setupMockDB(): void {
  ;(globalThis as any).indexedDB = mockIndexedDB
  mockIndexedDB._reset()
  logout()
}

function teardownMockDB(): void {
  ;(globalThis as any).indexedDB = originalIndexedDB
}

describe('register 账号注册 - 输入验证', () => {
  beforeEach(() => {
    setupMockDB()
  })

  afterEach(() => {
    teardownMockDB()
  })

  it('无效邮箱返回错误', async () => {
    const result = await register('invalid-email', 'password123', '用户')
    expect(!result.success).toBe(true)
    expect(!!result.error).toBe(true)
    expect(result.error!.includes('邮箱')).toBe(true)
  })

  it('密码少于 8 位返回错误', async () => {
    const result = await register('test@example.com', 'short1', '用户')
    expect(!result.success).toBe(true)
    expect(result.error!.includes('8')).toBe(true)
  })

  it('密码不含字母返回错误', async () => {
    const result = await register('test@example.com', '12345678', '用户')
    expect(!result.success).toBe(true)
    expect(result.error!.includes('字母')).toBe(true)
  })

  it('密码不含数字返回错误', async () => {
    const result = await register('test@example.com', 'password', '用户')
    expect(!result.success).toBe(true)
    expect(result.error!.includes('数字')).toBe(true)
  })

  it('空显示名称返回错误', async () => {
    const result = await register('test@example.com', 'password123', '   ')
    expect(!result.success).toBe(true)
    expect(result.error!.includes('名称')).toBe(true)
  })

  it('邮箱前后空格被 trim 并转为小写', async () => {
    mockIndexedDB._reset()
    const result = await register('  Test@Example.COM ', 'password123', '用户A')
    expect(result.success).toBe(true)
    const loginResult = await login('test@example.com', 'password123')
    expect(loginResult.success).toBe(true)
  })
})

describe('register 账号注册 - 正常流程', () => {
  beforeEach(() => {
    setupMockDB()
  })

  afterEach(() => {
    teardownMockDB()
  })

  it('有效输入注册成功', async () => {
    mockIndexedDB._reset()
    const result = await register('user1@test.com', 'pass1234', '用户一')
    expect(result.success).toBe(true)
  })

  it('注册后自动登录（isLoggedIn 为 true）', async () => {
    mockIndexedDB._reset()
    await register('user2@test.com', 'pass1234', '用户二')
    expect(isLoggedIn()).toBe(true)
  })

  it('注册后 getAccount 返回账号信息（不含密码哈希）', async () => {
    mockIndexedDB._reset()
    await register('user3@test.com', 'pass1234', '用户三')
    const account = getAccount()
    expect(account !== null).toBe(true)
    expect(account!.email).toEqual('user3@test.com')
    expect(account!.displayName).toEqual('用户三')
    expect(!('passwordHash' in account!)).toBe(true)
  })

  it('重复邮箱注册返回错误', async () => {
    mockIndexedDB._reset()
    await register('dup@test.com', 'pass1234', '用户A')
    const result = await register('dup@test.com', 'different1', '用户B')
    expect(!result.success).toBe(true)
    expect(result.error!.includes('已注册')).toBe(true)
  })

  it('带 bio 参数注册时 bio 被保存', async () => {
    mockIndexedDB._reset()
    await register('bio@test.com', 'pass1234', '用户', '这是我的简介')
    const account = getAccount()
    expect(account!.bio).toEqual('这是我的简介')
  })
})

describe('login 账号登录', () => {
  beforeEach(() => {
    setupMockDB()
  })

  afterEach(() => {
    teardownMockDB()
  })

  it('未注册邮箱登录返回错误', async () => {
    mockIndexedDB._reset()
    const result = await login('nobody@test.com', 'pass1234')
    expect(!result.success).toBe(true)
    expect(result.error!.includes('未注册')).toBe(true)
  })

  it('空邮箱或空密码返回错误', async () => {
    mockIndexedDB._reset()
    const r1 = await login('', 'pass1234')
    expect(!r1.success).toBe(true)
    const r2 = await login('test@test.com', '')
    expect(!r2.success).toBe(true)
  })

  it('错误密码登录返回错误', async () => {
    mockIndexedDB._reset()
    await register('login@test.com', 'pass1234', '登录用户')
    logout()
    const result = await login('login@test.com', 'wrongpassword')
    expect(!result.success).toBe(true)
    expect(result.error!.includes('密码错误')).toBe(true)
  })

  it('正确凭据登录成功', async () => {
    mockIndexedDB._reset()
    await register('ok@test.com', 'pass1234', '正确用户')
    logout()
    expect(!isLoggedIn()).toBe(true)
    const result = await login('ok@test.com', 'pass1234')
    expect(result.success).toBe(true)
    expect(!!result.account).toBe(true)
    expect(result.account!.email).toEqual('ok@test.com')
    expect(result.account!.displayName).toEqual('正确用户')
  })

  it('登录后 isLoggedIn 为 true', async () => {
    mockIndexedDB._reset()
    await register('logged@test.com', 'pass1234', '已登录用户')
    logout()
    expect(!isLoggedIn()).toBe(true)
    await login('logged@test.com', 'pass1234')
    expect(isLoggedIn()).toBe(true)
  })

  it('邮箱大小写不敏感（自动转小写）', async () => {
    mockIndexedDB._reset()
    await register('case@test.com', 'pass1234', '用户')
    logout()
    const result = await login('CASE@TEST.COM', 'pass1234')
    expect(result.success).toBe(true)
  })
})

describe('logout 登出', () => {
  beforeEach(() => {
    setupMockDB()
  })

  afterEach(() => {
    teardownMockDB()
  })

  it('登出后 isLoggedIn 为 false', async () => {
    mockIndexedDB._reset()
    await register('logout@test.com', 'pass1234', '用户')
    expect(isLoggedIn()).toBe(true)
    logout()
    expect(!isLoggedIn()).toBe(true)
  })

  it('登出后 getAccount 返回 null', async () => {
    mockIndexedDB._reset()
    await register('logout2@test.com', 'pass1234', '用户')
    expect(getAccount() !== null).toBe(true)
    logout()
    expect(getAccount()).toEqual(null)
  })
})

describe('updateDisplayName 更新显示名称', () => {
  beforeEach(() => {
    setupMockDB()
  })

  afterEach(() => {
    teardownMockDB()
  })

  it('空名称返回错误', async () => {
    mockIndexedDB._reset()
    await register('update@test.com', 'pass1234', '原名')
    const result = await updateDisplayName('update@test.com', '   ')
    expect(!result.success).toBe(true)
    expect(result.error!.includes('名称')).toBe(true)
  })

  it('不存在的账号返回错误', async () => {
    mockIndexedDB._reset()
    const result = await updateDisplayName('ghost@test.com', '新名')
    expect(!result.success).toBe(true)
    expect(result.error!.includes('不存在')).toBe(true)
  })

  it('与原名相同返回错误', async () => {
    mockIndexedDB._reset()
    await register('same@test.com', 'pass1234', '同名')
    const result = await updateDisplayName('same@test.com', '同名')
    expect(!result.success).toBe(true)
    expect(result.error!.includes('相同')).toBe(true)
  })

  it('成功更新显示名称', async () => {
    mockIndexedDB._reset()
    await register('success@test.com', 'pass1234', '旧名')
    const result = await updateDisplayName('success@test.com', '新名')
    expect(result.success).toBe(true)
    const account = getAccount()
    expect(account!.displayName).toEqual('新名')
  })

  it('每年只能修改一次昵称', async () => {
    mockIndexedDB._reset()
    await register('limit@test.com', 'pass1234', '初始名')
    const r1 = await updateDisplayName('limit@test.com', '第一次修改')
    expect(r1.success).toBe(true)
    const r2 = await updateDisplayName('limit@test.com', '第二次修改')
    expect(!r2.success).toBe(true)
    expect(r2.error!.includes('每年')).toBe(true)
  })
})
