/** work-monetization 单元测试 */
import {
  generateSeedKey,
  hashSeedKey,
  generateUnlockCode,
  verifyUnlockCode,
  generateWorkId,
  alignTimestamp,
  formatPrice,
  isNodePaid,
  getNodeChapter,
  getMonetizationStats,
  THIRD_PARTY_PLATFORMS,
  DEFAULT_PRICE_OPTIONS,
  COMPLIANCE_THRESHOLDS,
  SEED_KEY_PREFIX,
  UNLOCK_CODE_PREFIX,
  UNLOCK_REQUEST_PREFIX,
} from '../work-monetization'
import type { MonetizationConfig } from '../work-monetization'

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

function makeMonetizationConfig(
  overrides: Partial<MonetizationConfig> = {}
): MonetizationConfig {
  return {
    enabled: true,
    granularity: 'whole',
    paymentMethod: 'wechat_manual',
    paidNodes: ['node-1', 'node-2', 'node-3'],
    price: 9.9,
    workId: 'work_test_123',
    ...overrides,
  }
}

export async function runTests(): Promise<void> {
  passed = 0
  failed = 0
  failures.length = 0

  describe('常量 THIRD_PARTY_PLATFORMS 第三方平台', () => {
    it('包含 afdian/mianbaoduo/zsxq/custom 四个平台', () => {
      const keys = Object.keys(THIRD_PARTY_PLATFORMS)
      assert(keys.includes('afdian'), '应包含 afdian')
      assert(keys.includes('mianbaoduo'), '应包含 mianbaoduo')
      assert(keys.includes('zsxq'), '应包含 zsxq')
      assert(keys.includes('custom'), '应包含 custom')
      assertEqual(keys.length, 4, '应有 4 个平台')
    })

    it('每个平台包含 name/url/fee 字段', () => {
      for (const key of Object.keys(THIRD_PARTY_PLATFORMS)) {
        const platform = THIRD_PARTY_PLATFORMS[key as keyof typeof THIRD_PARTY_PLATFORMS]
        assert(typeof platform.name === 'string' && platform.name.length > 0, `${key} 应有 name`)
        assert(typeof platform.url === 'string', `${key} 应有 url`)
        assert(typeof platform.fee === 'string', `${key} 应有 fee`)
      }
    })

    it('afdian 名称为"爱发电"，费率为"6%"', () => {
      assertEqual(THIRD_PARTY_PLATFORMS.afdian.name, '爱发电', 'afdian 名称')
      assertEqual(THIRD_PARTY_PLATFORMS.afdian.fee, '6%', 'afdian 费率')
    })

    it('custom 平台 url 为空字符串', () => {
      assertEqual(THIRD_PARTY_PLATFORMS.custom.url, '', 'custom url 应为空')
    })
  })

  describe('常量 DEFAULT_PRICE_OPTIONS 和 COMPLIANCE_THRESHOLDS', () => {
    it('DEFAULT_PRICE_OPTIONS 包含默认价格选项', () => {
      assert(DEFAULT_PRICE_OPTIONS.length > 0, '应有默认价格选项')
      assert(DEFAULT_PRICE_OPTIONS.includes(9.9), '应包含 9.9')
      assert(DEFAULT_PRICE_OPTIONS.includes(6.6), '应包含 6.6')
    })

    it('COMPLIANCE_THRESHOLDS 包含关键阈值', () => {
      assert(typeof COMPLIANCE_THRESHOLDS.YEAR_INCOME_TAX_NOTICE === 'number', '应有 YEAR_INCOME_TAX_NOTICE')
      assert(typeof COMPLIANCE_THRESHOLDS.MONTHLY_AVERAGE_WARNING === 'number', '应有 MONTHLY_AVERAGE_WARNING')
      assert(COMPLIANCE_THRESHOLDS.YEAR_INCOME_TAX_NOTICE > 0, '阈值应大于 0')
    })
  })

  describe('前缀常量', () => {
    it('SEED_KEY_PREFIX 为 SUBSL-SEED-', () => {
      assertEqual(SEED_KEY_PREFIX, 'SUBSL-SEED-', 'SEED_KEY_PREFIX')
    })

    it('UNLOCK_CODE_PREFIX 为 SUBSL-UNLOCK-', () => {
      assertEqual(UNLOCK_CODE_PREFIX, 'SUBSL-UNLOCK-', 'UNLOCK_CODE_PREFIX')
    })

    it('UNLOCK_REQUEST_PREFIX 为 SUBSL-REQ-', () => {
      assertEqual(UNLOCK_REQUEST_PREFIX, 'SUBSL-REQ-', 'UNLOCK_REQUEST_PREFIX')
    })
  })

  describe('generateSeedKey 种子密钥生成', () => {
    it('返回以 SEED_KEY_PREFIX 开头的字符串', async () => {
      const seedKey = await generateSeedKey()
      assert(seedKey.startsWith(SEED_KEY_PREFIX), `应以 ${SEED_KEY_PREFIX} 开头`)
    })

    it('前缀后为 64 位十六进制（32 字节）', async () => {
      const seedKey = await generateSeedKey()
      const hex = seedKey.slice(SEED_KEY_PREFIX.length)
      assert(/^[0-9A-F]{64}$/.test(hex), `应为 64 位大写十六进制，实际: ${hex}`)
    })

    it('每次调用生成不同的密钥', async () => {
      const key1 = await generateSeedKey()
      const key2 = await generateSeedKey()
      assert(key1 !== key2, '两次生成的密钥应不同')
    })
  })

  describe('hashSeedKey 种子密钥哈希', () => {
    it('返回 64 位大写十六进制字符串（SHA-256）', async () => {
      const hash = await hashSeedKey('test-seed-key')
      assert(/^[0-9A-F]{64}$/.test(hash), `应为 64 位大写十六进制，实际: ${hash}`)
    })

    it('相同输入产生相同输出（确定性）', async () => {
      const hash1 = await hashSeedKey('SUBSL-SEED-ABCDEF')
      const hash2 = await hashSeedKey('SUBSL-SEED-ABCDEF')
      assertEqual(hash1, hash2, '相同输入应产生相同哈希')
    })

    it('不同输入产生不同输出', async () => {
      const hash1 = await hashSeedKey('SUBSL-SEED-AAA')
      const hash2 = await hashSeedKey('SUBSL-SEED-BBB')
      assert(hash1 !== hash2, '不同输入应产生不同哈希')
    })

    it('对真实种子密钥格式可正确哈希', async () => {
      const seedKey = await generateSeedKey()
      const hash = await hashSeedKey(seedKey)
      assert(/^[0-9A-F]{64}$/.test(hash), '真实种子密钥的哈希格式应正确')
    })
  })

  describe('generateUnlockCode 解锁码生成', () => {
    it('返回以 UNLOCK_CODE_PREFIX 开头的解锁码', async () => {
      const seedKey = await generateSeedKey()
      const requestCode = UNLOCK_REQUEST_PREFIX + 'ABCD1234'
      const code = await generateUnlockCode(seedKey, requestCode, 'work_test')
      assert(code.code.startsWith(UNLOCK_CODE_PREFIX), '应以 UNLOCK_CODE_PREFIX 开头')
    })

    it('解锁码前缀后为 16 位十六进制', async () => {
      const seedKey = await generateSeedKey()
      const requestCode = UNLOCK_REQUEST_PREFIX + 'ABCD1234'
      const code = await generateUnlockCode(seedKey, requestCode, 'work_test')
      const hex = code.code.slice(UNLOCK_CODE_PREFIX.length)
      assert(/^[0-9A-F]{16}$/.test(hex), `应为 16 位十六进制，实际: ${hex}`)
    })

    it('不传 validHours 时 validUntil 为 0', async () => {
      const seedKey = await generateSeedKey()
      const requestCode = UNLOCK_REQUEST_PREFIX + 'ABCD1234'
      const code = await generateUnlockCode(seedKey, requestCode, 'work_test')
      assertEqual(code.validUntil, 0, 'validUntil 应为 0')
    })

    it('传入 validHours 时 validUntil 为 timestamp + validHours * 3600000', async () => {
      const seedKey = await generateSeedKey()
      const requestCode = UNLOCK_REQUEST_PREFIX + 'ABCD1234'
      const code = await generateUnlockCode(seedKey, requestCode, 'work_test', undefined, 24)
      assert(code.validUntil! > 0, 'validUntil 应大于 0')
      assert(code.validUntil! >= code.timestamp, 'validUntil 应 >= timestamp')
      // 验证差值约为 24 小时
      const diff = code.validUntil! - code.timestamp
      assert(diff === 24 * 3600000, `差值应为 24 小时毫秒数，实际: ${diff}`)
    })

    it('返回的 UnlockCode 包含正确的 workId 和 requestCode', async () => {
      const seedKey = await generateSeedKey()
      const requestCode = UNLOCK_REQUEST_PREFIX + 'ABCD1234'
      const code = await generateUnlockCode(seedKey, requestCode, 'work_abc')
      assertEqual(code.workId, 'work_abc', 'workId 应正确')
      assertEqual(code.requestCode, requestCode, 'requestCode 应正确')
      assertEqual(code.type, 'unlock', 'type 应为 unlock')
    })
  })

  describe('verifyUnlockCode 解锁码验证', () => {
    it('正确生成的解锁码验证通过', async () => {
      const seedKey = await generateSeedKey()
      const workId = 'work_verify_test'
      const requestCode = UNLOCK_REQUEST_PREFIX + 'DEAD5678'
      const unlockCode = await generateUnlockCode(seedKey, requestCode, workId)
      const result = await verifyUnlockCode(
        unlockCode.code,
        workId,
        requestCode
      )
      assert(result.valid, `正确解锁码应验证通过，reason: ${result.reason}`)
    })

    it('格式错误的解锁码返回 invalid', async () => {
      const result = await verifyUnlockCode(
        'INVALID-CODE',
        'work_test',
        UNLOCK_REQUEST_PREFIX + 'ABCD1234'
      )
      assert(!result.valid, '格式错误应返回 invalid')
      assert(!!result.reason, '应包含 reason')
    })

    it('解锁码后缀非 16 位十六进制返回 invalid', async () => {
      const result = await verifyUnlockCode(
        UNLOCK_CODE_PREFIX + 'SHORT',
        'work_test',
        UNLOCK_REQUEST_PREFIX + 'ABCD1234'
      )
      assert(!result.valid, '非 16 位十六进制应返回 invalid')
    })

    it('无效的 requestCode 返回 invalid', async () => {
      const result = await verifyUnlockCode(
        UNLOCK_CODE_PREFIX + 'ABCD1234ABCD1234',
        'work_test',
        'invalid-request-code'
      )
      assert(!result.valid, '无效 requestCode 应返回 invalid')
    })

    it('workId 不匹配时返回 invalid', async () => {
      const seedKey = await generateSeedKey()
      const requestCode = UNLOCK_REQUEST_PREFIX + 'DEAD5678'
      const unlockCode = await generateUnlockCode(seedKey, requestCode, 'work_original')
      const result = await verifyUnlockCode(
        unlockCode.code,
        'work_different',
        requestCode
      )
      assert(!result.valid, 'workId 不匹配应返回 invalid')
    })
  })

  describe('generateWorkId 作品 ID 生成', () => {
    it('返回以 work_ 开头的字符串', () => {
      const id = generateWorkId()
      assert(id.startsWith('work_'), '应以 work_ 开头')
    })

    it('每次调用生成不同的 ID', () => {
      const id1 = generateWorkId()
      const id2 = generateWorkId()
      assert(id1 !== id2, '两次生成的 ID 应不同')
    })
  })

  describe('alignTimestamp 时间戳对齐', () => {
    it('对齐到分钟（去掉毫秒级余数）', () => {
      const ts = 1700000000123 // 非整分钟
      const aligned = alignTimestamp(ts)
      assertEqual(aligned % 60000, 0, '对齐后应为 60000 的整数倍')
    })

    it('已是整分钟的时间戳不变', () => {
      const ts = 1700000040000 // 整分钟
      const aligned = alignTimestamp(ts)
      assertEqual(aligned, ts, '整分钟时间戳应对齐后不变')
    })
  })

  describe('formatPrice 价格格式化', () => {
    it('价格 >= 1 时显示 ¥ 前缀和两位小数', () => {
      assertEqual(formatPrice(9.9), '¥9.90', '9.9 应显示为 ¥9.90')
      assertEqual(formatPrice(10), '¥10.00', '10 应显示为 ¥10.00')
    })

    it('价格 < 1 时显示积分', () => {
      assertEqual(formatPrice(0.5), '50积分', '0.5 应显示为 50积分')
      assertEqual(formatPrice(0.01), '1积分', '0.01 应显示为 1积分')
    })
  })

  describe('isNodePaid 节点付费检查', () => {
    it('付费开启且节点在 paidNodes 中返回 true', () => {
      const config = makeMonetizationConfig()
      assert(isNodePaid('node-1', config), 'node-1 应为付费')
    })

    it('节点不在 paidNodes 中返回 false', () => {
      const config = makeMonetizationConfig()
      assert(!isNodePaid('node-free', config), 'node-free 不应为付费')
    })

    it('付费关闭时返回 false', () => {
      const config = makeMonetizationConfig({ enabled: false })
      assert(!isNodePaid('node-1', config), '付费关闭时应返回 false')
    })

    it('节点在 freePreviewNodes 中返回 false', () => {
      const config = makeMonetizationConfig({ freePreviewNodes: ['node-1'] })
      assert(!isNodePaid('node-1', config), '免费预览节点应返回 false')
    })
  })

  describe('getMonetizationStats 付费统计', () => {
    it('正确统计付费/免费节点数和价格范围', () => {
      const config = makeMonetizationConfig({
        paidNodes: ['n1', 'n2', 'n3'],
        freePreviewNodes: ['n0'],
        price: 9.9,
        priceOptions: [6.6, 9.9, 18.8],
      })
      const stats = getMonetizationStats(config)
      assertEqual(stats.totalPaidNodes, 3, '付费节点数')
      assertEqual(stats.totalFreeNodes, 1, '免费节点数')
      assertEqual(stats.priceRange.min, 6.6, '最低价')
      assertEqual(stats.priceRange.max, 18.8, '最高价')
    })

    it('空配置返回零值', () => {
      const stats = getMonetizationStats({})
      assertEqual(stats.totalPaidNodes, 0, '空配置付费节点为 0')
      assertEqual(stats.totalFreeNodes, 0, '空配置免费节点为 0')
      assertEqual(stats.priceRange.min, 0, '空配置最低价为 0')
      assertEqual(stats.priceRange.max, 0, '空配置最高价为 0')
    })

    it('包含 paidChapters 时价格范围涵盖章节价格', () => {
      const config = makeMonetizationConfig({
        paidNodes: ['n1'],
        price: 9.9,
        paidChapters: [
          { id: 'ch1', name: '第一章', nodeIds: ['n1'], price: 5.0 },
          { id: 'ch2', name: '第二章', nodeIds: ['n2'], price: 15.0 },
        ],
      })
      const stats = getMonetizationStats(config)
      assertEqual(stats.priceRange.min, 5.0, '最低价应包含章节价格')
      assertEqual(stats.priceRange.max, 15.0, '最高价应包含章节价格')
      assertEqual(stats.totalPaidChapters, 2, '付费章节数')
    })
  })

  await runTestQueue()

  console.log(
    `\n=== work-monetization 测试结果: ${passed} 通过, ${failed} 失败 ===`
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
      !!process.argv[1]?.includes('work-monetization.test')
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
