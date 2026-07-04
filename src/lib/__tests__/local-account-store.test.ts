/**
 * local-account-store.ts 单元测试
 *
 * 由于项目未安装 vitest，本测试为纯函数验证脚本：
 *   - 导出 runTests() 函数
 *   - 内部使用自定义 describe/it + 手动断言
 *   - 可通过 `npx tsx local-account-store.test.ts` 直接执行
 *
 * 注意：local-account-store 依赖 IndexedDB（Node 中不存在），
 * 本测试通过在 globalThis 上设置最小化 IndexedDB mock 来模拟。
 * runTests 为 async 函数。
 */
import { webcrypto } from 'node:crypto'
import {
  register,
  login,
  getAccount,
  logout,
  isLoggedIn,
  updateDisplayName,
} from '../local-account-store'

// 确保 crypto.subtle 可用（Node 18+ 通常已全局可用）
if (typeof globalThis.crypto === 'undefined') {
  ;(globalThis as any).crypto = webcrypto
}

// ============================================
// 简易测试工具
// ============================================

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

// ============================================
// IndexedDB Mock
// ============================================

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
    // No-op
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
    // No-op（mock 中 close 不影响后续操作）
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

// ============================================
// 环境设置
// ============================================

const mockIndexedDB = new MockIndexedDB()
const originalIndexedDB = (globalThis as any).indexedDB

function setupMockDB(): void {
  ;(globalThis as any).indexedDB = mockIndexedDB
  mockIndexedDB._reset()
  // 重置模块级 currentAccount
  logout()
}

function teardownMockDB(): void {
  ;(globalThis as any).indexedDB = originalIndexedDB
}

// ============================================
// 测试用例
// ============================================

export async function runTests(): Promise<void> {
  passed = 0
  failed = 0
  failures.length = 0

  // 设置 mock
  setupMockDB()

  describe('register 账号注册 - 输入验证', () => {
    it('无效邮箱返回错误', async () => {
      const result = await register('invalid-email', 'password123', '用户')
      assert(!result.success, '无效邮箱应返回 success: false')
      assert(!!result.error, '应包含 error 信息')
      assert(result.error!.includes('邮箱'), '错误信息应提及邮箱')
    })

    it('密码少于 8 位返回错误', async () => {
      const result = await register('test@example.com', 'short1', '用户')
      assert(!result.success, '短密码应返回 success: false')
      assert(result.error!.includes('8'), '错误信息应提及 8 位')
    })

    it('密码不含字母返回错误', async () => {
      const result = await register('test@example.com', '12345678', '用户')
      assert(!result.success, '纯数字密码应返回 success: false')
      assert(result.error!.includes('字母'), '错误信息应提及字母')
    })

    it('密码不含数字返回错误', async () => {
      const result = await register('test@example.com', 'password', '用户')
      assert(!result.success, '纯字母密码应返回 success: false')
      assert(result.error!.includes('数字'), '错误信息应提及数字')
    })

    it('空显示名称返回错误', async () => {
      const result = await register('test@example.com', 'password123', '   ')
      assert(!result.success, '空显示名称应返回 success: false')
      assert(result.error!.includes('名称'), '错误信息应提及名称')
    })

    it('邮箱前后空格被 trim 并转为小写', async () => {
      mockIndexedDB._reset()
      const result = await register('  Test@Example.COM ', 'password123', '用户A')
      assert(result.success, '邮箱 trim 后应注册成功')
      // 用小写邮箱登录应能成功
      const loginResult = await login('test@example.com', 'password123')
      assert(loginResult.success, '用规范化后的邮箱应能登录')
    })
  })

  describe('register 账号注册 - 正常流程', () => {
    it('有效输入注册成功', async () => {
      mockIndexedDB._reset()
      const result = await register('user1@test.com', 'pass1234', '用户一')
      assert(result.success, `有效输入应注册成功，error: ${result.error}`)
    })

    it('注册后自动登录（isLoggedIn 为 true）', async () => {
      mockIndexedDB._reset()
      await register('user2@test.com', 'pass1234', '用户二')
      assert(isLoggedIn(), '注册后应自动登录')
    })

    it('注册后 getAccount 返回账号信息（不含密码哈希）', async () => {
      mockIndexedDB._reset()
      await register('user3@test.com', 'pass1234', '用户三')
      const account = getAccount()
      assert(account !== null, 'getAccount 不应返回 null')
      assertEqual(account!.email, 'user3@test.com', 'email 应正确')
      assertEqual(account!.displayName, '用户三', 'displayName 应正确')
      assert(!('passwordHash' in account!), '账号信息不应包含 passwordHash')
    })

    it('重复邮箱注册返回错误', async () => {
      mockIndexedDB._reset()
      await register('dup@test.com', 'pass1234', '用户A')
      const result = await register('dup@test.com', 'different1', '用户B')
      assert(!result.success, '重复邮箱应返回 success: false')
      assert(result.error!.includes('已注册'), '错误信息应提及已注册')
    })

    it('带 bio 参数注册时 bio 被保存', async () => {
      mockIndexedDB._reset()
      await register('bio@test.com', 'pass1234', '用户', '这是我的简介')
      const account = getAccount()
      assertEqual(account!.bio, '这是我的简介', 'bio 应被保存')
    })
  })

  describe('login 账号登录', () => {
    it('未注册邮箱登录返回错误', async () => {
      mockIndexedDB._reset()
      const result = await login('nobody@test.com', 'pass1234')
      assert(!result.success, '未注册邮箱应返回 success: false')
      assert(result.error!.includes('未注册'), '错误信息应提及未注册')
    })

    it('空邮箱或空密码返回错误', async () => {
      mockIndexedDB._reset()
      const r1 = await login('', 'pass1234')
      assert(!r1.success, '空邮箱应返回 false')
      const r2 = await login('test@test.com', '')
      assert(!r2.success, '空密码应返回 false')
    })

    it('错误密码登录返回错误', async () => {
      mockIndexedDB._reset()
      await register('login@test.com', 'pass1234', '登录用户')
      logout()
      const result = await login('login@test.com', 'wrongpassword')
      assert(!result.success, '错误密码应返回 success: false')
      assert(result.error!.includes('密码错误'), '错误信息应提及密码错误')
    })

    it('正确凭据登录成功', async () => {
      mockIndexedDB._reset()
      await register('ok@test.com', 'pass1234', '正确用户')
      logout()
      assert(!isLoggedIn(), 'logout 后应未登录')
      const result = await login('ok@test.com', 'pass1234')
      assert(result.success, `正确凭据应登录成功，error: ${result.error}`)
      assert(!!result.account, '应返回 account 信息')
      assertEqual(result.account!.email, 'ok@test.com', 'account.email 应正确')
      assertEqual(result.account!.displayName, '正确用户', 'account.displayName 应正确')
    })

    it('登录后 isLoggedIn 为 true', async () => {
      mockIndexedDB._reset()
      await register('logged@test.com', 'pass1234', '已登录用户')
      logout()
      assert(!isLoggedIn(), 'logout 后应未登录')
      await login('logged@test.com', 'pass1234')
      assert(isLoggedIn(), '登录后 isLoggedIn 应为 true')
    })

    it('邮箱大小写不敏感（自动转小写）', async () => {
      mockIndexedDB._reset()
      await register('case@test.com', 'pass1234', '用户')
      logout()
      const result = await login('CASE@TEST.COM', 'pass1234')
      assert(result.success, '大写邮箱应能登录')
    })
  })

  describe('logout 登出', () => {
    it('登出后 isLoggedIn 为 false', async () => {
      mockIndexedDB._reset()
      await register('logout@test.com', 'pass1234', '用户')
      assert(isLoggedIn(), '注册后应已登录')
      logout()
      assert(!isLoggedIn(), 'logout 后应未登录')
    })

    it('登出后 getAccount 返回 null', async () => {
      mockIndexedDB._reset()
      await register('logout2@test.com', 'pass1234', '用户')
      assert(getAccount() !== null, '注册后 getAccount 不应为 null')
      logout()
      assertEqual(getAccount(), null, 'logout 后 getAccount 应为 null')
    })
  })

  describe('updateDisplayName 更新显示名称', () => {
    it('空名称返回错误', async () => {
      mockIndexedDB._reset()
      await register('update@test.com', 'pass1234', '原名')
      const result = await updateDisplayName('update@test.com', '   ')
      assert(!result.success, '空名称应返回 false')
      assert(result.error!.includes('名称'), '错误信息应提及名称')
    })

    it('不存在的账号返回错误', async () => {
      mockIndexedDB._reset()
      const result = await updateDisplayName('ghost@test.com', '新名')
      assert(!result.success, '不存在的账号应返回 false')
      assert(result.error!.includes('不存在'), '错误信息应提及不存在')
    })

    it('与原名相同返回错误', async () => {
      mockIndexedDB._reset()
      await register('same@test.com', 'pass1234', '同名')
      const result = await updateDisplayName('same@test.com', '同名')
      assert(!result.success, '与原名相同应返回 false')
      assert(result.error!.includes('相同'), '错误信息应提及相同')
    })

    it('成功更新显示名称', async () => {
      mockIndexedDB._reset()
      await register('success@test.com', 'pass1234', '旧名')
      const result = await updateDisplayName('success@test.com', '新名')
      assert(result.success, `更新应成功，error: ${result.error}`)
      const account = getAccount()
      assertEqual(account!.displayName, '新名', 'displayName 应更新为新名')
    })

    it('每年只能修改一次昵称', async () => {
      mockIndexedDB._reset()
      await register('limit@test.com', 'pass1234', '初始名')
      // 第一次修改：成功
      const r1 = await updateDisplayName('limit@test.com', '第一次修改')
      assert(r1.success, '第一次修改应成功')
      // 第二次修改：应被限制
      const r2 = await updateDisplayName('limit@test.com', '第二次修改')
      assert(!r2.success, '第二次修改应被限制')
      assert(r2.error!.includes('每年'), '错误信息应提及每年限制')
    })
  })

  await runTestQueue()

  // 清理
  teardownMockDB()

  console.log(
    `\n=== local-account-store 测试结果: ${passed} 通过, ${failed} 失败 ===`
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
      !!process.argv[1]?.includes('local-account-store.test')
    )
  } catch {
    return false
  }
})()

if (isMainModule) {
  runTests().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
