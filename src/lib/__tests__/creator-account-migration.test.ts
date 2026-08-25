/**
 * creator-account-migration 单元测试
 *
 * 覆盖：
 * - 迁移幂等（重复执行不重复创建）；
 * - 同 email 已存在本地账号时合并不重复创建；
 * - 迁移后平台密码配置仍为 password-crypto 加密格式；
 * - 迁移后平台配置/发布记录归属本地账号邮箱；
 * - 迁移创建的本地账号副本可用原密码登录；
 * - 发布记录按本地账号邮箱过滤。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { webcrypto } from 'node:crypto'
import { migrateLegacyCreatorAccounts } from '../creator-account-migration'
import { openDB } from '../local-db/db'
import { login, logout } from '../local-account-store'
import { isEncrypted } from '../password-crypto'
import { getPublishRecords } from '../creator-service'

if (typeof globalThis.crypto === 'undefined') {
  ;(globalThis as any).crypto = webcrypto
}

// ---------- 最小内存 IndexedDB mock（open/transaction/objectStore/get/getAll/put/delete/createObjectStore/createIndex） ----------

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

  getAll(): MockIDBRequest {
    const req = new MockIDBRequest()
    setTimeout(() => {
      req.result = Array.from(this.data.values())
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

  createIndex(_name: string, _keyPath: string, _options?: any): void {
  }

  _getData(): Map<string, any> {
    return this.data
  }
}

class MockIDBTransaction {
  private storeMap: Map<string, MockIDBObjectStore>
  oncomplete: (() => void) | null = null
  onerror: ((err: any) => void) | null = null
  error: any = null

  constructor(stores: Map<string, MockIDBObjectStore>) {
    this.storeMap = stores
    // 模拟事务异步完成：store 写入为同步操作，数据已落库，仅触发回调
    setTimeout(() => {
      if (this.oncomplete) this.oncomplete()
    }, 0)
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
    if (!this.db) {
      this.db = new MockIDBDatabase()
    }
    const req = new MockIDBRequest()
    setTimeout(() => {
      req.result = this.db!
      // 每次都触发 onupgradeneeded；db.ts 内部以 objectStoreNames.contains 防护，不会重复建表
      if (req.onupgradeneeded) {
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

// ---------- localStorage mock（node 环境无 window/localStorage） ----------

function createLocalStorageMock(): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => { store.delete(key) },
    setItem: (key: string, value: string) => { store.set(key, String(value)) },
  } as Storage
}

const localStorageMock = createLocalStorageMock()
const originalWindow = (globalThis as any).window
const originalLocalStorage = (globalThis as any).localStorage

function setupEnv(): void {
  ;(globalThis as any).indexedDB = mockIndexedDB
  ;(globalThis as any).window = { localStorage: localStorageMock }
  ;(globalThis as any).localStorage = localStorageMock
  mockIndexedDB._reset()
  localStorageMock.clear()
  logout()
}

function teardownEnv(): void {
  ;(globalThis as any).indexedDB = originalIndexedDB
  ;(globalThis as any).window = originalWindow
  ;(globalThis as any).localStorage = originalLocalStorage
}

// ---------- 测试辅助：直接读写 IndexedDB stores ----------

async function seed(storeName: string, value: unknown): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    tx.objectStore(storeName).put(value)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function readAll<T>(storeName: string): Promise<T[]> {
  const db = await openDB()
  return new Promise<T[]>((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll()
    request.onsuccess = () => resolve((request.result || []) as T[])
    request.onerror = () => reject(request.error)
  })
}

async function sha256Hex(message: string): Promise<string> {
  const data = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

const LEGACY_HASH = 'legacy-password-hash-abcdef'

function legacyAccount(email: string, displayName = '旧创作者'): Record<string, unknown> {
  return {
    id: 'id_legacy',
    email,
    displayName,
    passwordHash: LEGACY_HASH,
    bio: '旧简介',
    createdAt: 1700000000000,
    nameChangeCount: 0,
    nameLastChangedAt: 1700000000000,
  }
}

function localAccount(email: string, passwordHash: string, displayName = '本地创作者'): Record<string, unknown> {
  return {
    id: 'id_local',
    email,
    displayName,
    passwordHash,
    bio: '',
    createdAt: 1690000000000,
    nameChangeCount: 0,
    nameLastChangedAt: 1690000000000,
  }
}

function platformConfig(id: string, email?: string): Record<string, unknown> {
  return {
    id,
    platformId: 'subsilicon',
    name: 'SubSilicon 自由集市',
    config: {
      apiUrl: 'https://subsilicon.cn/api/creator/preview/submit',
      // 模拟 password-crypto 加密格式（不要求真实可解密）
      platformPassword: '__ENC__:c2FsdA==:aXZ2dnY==:Y2lwaGVydGV4dA==',
      platformUsername: 'creator',
    },
    enabled: true,
    createdAt: 1690000000000,
    updatedAt: 1690000000000,
    ownerEmail: email,
  }
}

function publishRecord(id: string, email?: string): Record<string, unknown> {
  return {
    id,
    workId: 'work-1',
    platformId: 'subsilicon',
    platformConfigId: 'pc-1',
    title: '测试作品',
    status: 'pending',
    platformResponse: {},
    publishedAt: 1690000000000,
    updatedAt: 1690000000000,
    creatorEmail: email,
  }
}

describe('migrateLegacyCreatorAccounts 账号双轨迁移', () => {
  beforeEach(() => {
    setupEnv()
  })

  afterEach(() => {
    teardownEnv()
  })

  it('无旧 creatorAccounts 时返回 migrated=0 并标记已迁移', async () => {
    const first = await migrateLegacyCreatorAccounts()
    expect(first.migrated).toBe(0)
    expect(localStorageMock.getItem('subsilicon_creator_account_migrated')).toBe('true')
    // 已标记后再次调用走幂等分支
    const second = await migrateLegacyCreatorAccounts()
    expect(second.migrated).toBe(0)
  })

  it('幂等：重复执行只迁移一次', async () => {
    await seed('creatorAccounts', legacyAccount('creator@test.com'))
    const first = await migrateLegacyCreatorAccounts()
    expect(first.migrated).toBe(1)
    const accounts = await readAll<Record<string, unknown>>('accounts')
    expect(accounts).toHaveLength(1)
    expect(accounts[0].email).toBe('creator@test.com')
    // 原密码哈希原样复制（不重哈希、不明文化）
    expect(accounts[0].passwordHash).toBe(LEGACY_HASH)

    const second = await migrateLegacyCreatorAccounts()
    expect(second.migrated).toBe(0)
    expect(await readAll('accounts')).toHaveLength(1)
  })

  it('同 email 已存在本地账号 → 合并不重复创建', async () => {
    await seed('accounts', localAccount('dup@test.com', 'local-hash'))
    await seed('creatorAccounts', legacyAccount('dup@test.com'))
    const result = await migrateLegacyCreatorAccounts()
    expect(result.migrated).toBe(0)
    const accounts = await readAll<Record<string, unknown>>('accounts')
    expect(accounts).toHaveLength(1)
    // 已存在的本地账号不被覆盖
    expect(accounts[0].passwordHash).toBe('local-hash')
  })

  it('迁移后平台密码配置仍为 password-crypto 加密格式，且挂到本地账号名下', async () => {
    await seed('creatorAccounts', legacyAccount('enc@test.com'))
    await seed('platformConfigs', platformConfig('pc-enc'))
    await migrateLegacyCreatorAccounts()
    const configs = await readAll<Record<string, any>>('platformConfigs')
    expect(configs).toHaveLength(1)
    expect(configs[0].ownerEmail).toBe('enc@test.com')
    expect(isEncrypted(configs[0].config.platformPassword)).toBe(true)
  })

  it('发布记录归属指向本地账号 email', async () => {
    await seed('creatorAccounts', legacyAccount('pub@test.com'))
    await seed('publishRecords', publishRecord('rec-1'))
    await migrateLegacyCreatorAccounts()
    const records = await readAll<Record<string, any>>('publishRecords')
    expect(records).toHaveLength(1)
    expect(records[0].creatorEmail).toBe('pub@test.com')
  })

  it('迁移创建的本地账号副本可用原密码登录', async () => {
    const password = 'pass1234'
    const hash = await sha256Hex(password)
    await seed('creatorAccounts', { ...legacyAccount('login@test.com'), passwordHash: hash })
    const result = await migrateLegacyCreatorAccounts()
    expect(result.migrated).toBe(1)
    const loginResult = await login('login@test.com', password)
    expect(loginResult.success).toBe(true)
    expect(loginResult.account?.email).toBe('login@test.com')
  })

  it('已有归属的旧平台配置/发布记录不被覆盖，无归属的才补挂', async () => {
    await seed('creatorAccounts', legacyAccount('own@test.com'))
    await seed('platformConfigs', platformConfig('pc-owned', 'other@test.com'))
    await seed('publishRecords', publishRecord('rec-owned', 'other@test.com'))
    await migrateLegacyCreatorAccounts()
    const configs = await readAll<Record<string, any>>('platformConfigs')
    expect(configs[0].ownerEmail).toBe('other@test.com')
    const records = await readAll<Record<string, any>>('publishRecords')
    expect(records[0].creatorEmail).toBe('other@test.com')
  })

  it('发布记录读取按本地账号邮箱过滤（兼容无归属旧记录）', async () => {
    await seed('publishRecords', publishRecord('rec-a', 'a@test.com'))
    await seed('publishRecords', publishRecord('rec-b', 'b@test.com'))
    await seed('publishRecords', publishRecord('rec-none'))
    const list = await getPublishRecords(undefined, 'a@test.com')
    const ids = list.map((r) => r.id).sort()
    expect(ids).toEqual(['rec-a', 'rec-none'])
  })
})
