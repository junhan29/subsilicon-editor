/** work-monetization 单元测试 */
import { describe, it, expect } from 'vitest'
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

describe('常量 THIRD_PARTY_PLATFORMS 第三方平台', () => {
  it('包含 afdian/mianbaoduo/zsxq/custom 四个平台', () => {
    const keys = Object.keys(THIRD_PARTY_PLATFORMS)
    expect(keys.includes('afdian')).toBe(true)
    expect(keys.includes('mianbaoduo')).toBe(true)
    expect(keys.includes('zsxq')).toBe(true)
    expect(keys.includes('custom')).toBe(true)
    expect(keys.length).toEqual(4)
  })

  it('每个平台包含 name/url/fee 字段', () => {
    for (const key of Object.keys(THIRD_PARTY_PLATFORMS)) {
      const platform = THIRD_PARTY_PLATFORMS[key as keyof typeof THIRD_PARTY_PLATFORMS]
      expect(typeof platform.name === 'string' && platform.name.length > 0).toBe(true)
      expect(typeof platform.url === 'string').toBe(true)
      expect(typeof platform.fee === 'string').toBe(true)
    }
  })

  it('afdian 名称为"爱发电"，费率为"6%"', () => {
    expect(THIRD_PARTY_PLATFORMS.afdian.name).toEqual('爱发电')
    expect(THIRD_PARTY_PLATFORMS.afdian.fee).toEqual('6%')
  })

  it('custom 平台 url 为空字符串', () => {
    expect(THIRD_PARTY_PLATFORMS.custom.url).toEqual('')
  })
})

describe('常量 DEFAULT_PRICE_OPTIONS 和 COMPLIANCE_THRESHOLDS', () => {
  it('DEFAULT_PRICE_OPTIONS 包含默认价格选项', () => {
    expect(DEFAULT_PRICE_OPTIONS.length > 0).toBe(true)
    expect(DEFAULT_PRICE_OPTIONS.includes(9.9)).toBe(true)
    expect(DEFAULT_PRICE_OPTIONS.includes(6.6)).toBe(true)
  })

  it('COMPLIANCE_THRESHOLDS 包含关键阈值', () => {
    expect(typeof COMPLIANCE_THRESHOLDS.YEAR_INCOME_TAX_NOTICE === 'number').toBe(true)
    expect(typeof COMPLIANCE_THRESHOLDS.MONTHLY_AVERAGE_WARNING === 'number').toBe(true)
    expect(COMPLIANCE_THRESHOLDS.YEAR_INCOME_TAX_NOTICE > 0).toBe(true)
  })
})

describe('前缀常量', () => {
  it('SEED_KEY_PREFIX 为 SUBSL-SEED-', () => {
    expect(SEED_KEY_PREFIX).toEqual('SUBSL-SEED-')
  })

  it('UNLOCK_CODE_PREFIX 为 SUBSL-UNLOCK-', () => {
    expect(UNLOCK_CODE_PREFIX).toEqual('SUBSL-UNLOCK-')
  })

  it('UNLOCK_REQUEST_PREFIX 为 SUBSL-REQ-', () => {
    expect(UNLOCK_REQUEST_PREFIX).toEqual('SUBSL-REQ-')
  })
})

describe('generateSeedKey 种子密钥生成', () => {
  it('返回以 SEED_KEY_PREFIX 开头的字符串', async () => {
    const seedKey = await generateSeedKey()
    expect(seedKey.startsWith(SEED_KEY_PREFIX)).toBe(true)
  })

  it('前缀后为 64 位十六进制（32 字节）', async () => {
    const seedKey = await generateSeedKey()
    const hex = seedKey.slice(SEED_KEY_PREFIX.length)
    expect(/^[0-9A-F]{64}$/.test(hex)).toBe(true)
  })

  it('每次调用生成不同的密钥', async () => {
    const key1 = await generateSeedKey()
    const key2 = await generateSeedKey()
    expect(key1 !== key2).toBe(true)
  })
})

describe('hashSeedKey 种子密钥哈希', () => {
  it('返回 64 位大写十六进制字符串（SHA-256）', async () => {
    const hash = await hashSeedKey('test-seed-key')
    expect(/^[0-9A-F]{64}$/.test(hash)).toBe(true)
  })

  it('相同输入产生相同输出（确定性）', async () => {
    const hash1 = await hashSeedKey('SUBSL-SEED-ABCDEF')
    const hash2 = await hashSeedKey('SUBSL-SEED-ABCDEF')
    expect(hash1).toEqual(hash2)
  })

  it('不同输入产生不同输出', async () => {
    const hash1 = await hashSeedKey('SUBSL-SEED-AAA')
    const hash2 = await hashSeedKey('SUBSL-SEED-BBB')
    expect(hash1 !== hash2).toBe(true)
  })

  it('对真实种子密钥格式可正确哈希', async () => {
    const seedKey = await generateSeedKey()
    const hash = await hashSeedKey(seedKey)
    expect(/^[0-9A-F]{64}$/.test(hash)).toBe(true)
  })
})

describe('generateUnlockCode 解锁码生成', () => {
  it('返回以 UNLOCK_CODE_PREFIX 开头的解锁码', async () => {
    const seedKey = await generateSeedKey()
    const requestCode = UNLOCK_REQUEST_PREFIX + 'ABCD1234'
    const code = await generateUnlockCode(seedKey, requestCode, 'work_test')
    expect(code.code.startsWith(UNLOCK_CODE_PREFIX)).toBe(true)
  })

  it('解锁码前缀后为 16 位十六进制', async () => {
    const seedKey = await generateSeedKey()
    const requestCode = UNLOCK_REQUEST_PREFIX + 'ABCD1234'
    const code = await generateUnlockCode(seedKey, requestCode, 'work_test')
    const hex = code.code.slice(UNLOCK_CODE_PREFIX.length)
    expect(/^[0-9A-F]{16}$/.test(hex)).toBe(true)
  })

  it('不传 validHours 时 validUntil 为 0', async () => {
    const seedKey = await generateSeedKey()
    const requestCode = UNLOCK_REQUEST_PREFIX + 'ABCD1234'
    const code = await generateUnlockCode(seedKey, requestCode, 'work_test')
    expect(code.validUntil).toEqual(0)
  })

  it('传入 validHours 时 validUntil 为 timestamp + validHours * 3600000', async () => {
    const seedKey = await generateSeedKey()
    const requestCode = UNLOCK_REQUEST_PREFIX + 'ABCD1234'
    const code = await generateUnlockCode(seedKey, requestCode, 'work_test', undefined, 24)
    expect(code.validUntil! > 0).toBe(true)
    expect(code.validUntil! >= code.timestamp).toBe(true)
    const diff = code.validUntil! - code.timestamp
    expect(diff === 24 * 3600000).toBe(true)
  })

  it('返回的 UnlockCode 包含正确的 workId 和 requestCode', async () => {
    const seedKey = await generateSeedKey()
    const requestCode = UNLOCK_REQUEST_PREFIX + 'ABCD1234'
    const code = await generateUnlockCode(seedKey, requestCode, 'work_abc')
    expect(code.workId).toEqual('work_abc')
    expect(code.requestCode).toEqual(requestCode)
    expect(code.type).toEqual('unlock')
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
    expect(result.valid).toBe(true)
  })

  it('格式错误的解锁码返回 invalid', async () => {
    const result = await verifyUnlockCode(
      'INVALID-CODE',
      'work_test',
      UNLOCK_REQUEST_PREFIX + 'ABCD1234'
    )
    expect(!result.valid).toBe(true)
    expect(!!result.reason).toBe(true)
  })

  it('解锁码后缀非 16 位十六进制返回 invalid', async () => {
    const result = await verifyUnlockCode(
      UNLOCK_CODE_PREFIX + 'SHORT',
      'work_test',
      UNLOCK_REQUEST_PREFIX + 'ABCD1234'
    )
    expect(!result.valid).toBe(true)
  })

  it('无效的 requestCode 返回 invalid', async () => {
    const result = await verifyUnlockCode(
      UNLOCK_CODE_PREFIX + 'ABCD1234ABCD1234',
      'work_test',
      'invalid-request-code'
    )
    expect(!result.valid).toBe(true)
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
    expect(!result.valid).toBe(true)
  })
})

describe('generateWorkId 作品 ID 生成', () => {
  it('返回以 work_ 开头的字符串', () => {
    const id = generateWorkId()
    expect(id.startsWith('work_')).toBe(true)
  })

  it('每次调用生成不同的 ID', () => {
    const id1 = generateWorkId()
    const id2 = generateWorkId()
    expect(id1 !== id2).toBe(true)
  })
})

describe('alignTimestamp 时间戳对齐', () => {
  it('对齐到分钟（去掉毫秒级余数）', () => {
    const ts = 1700000000123
    const aligned = alignTimestamp(ts)
    expect(aligned % 60000).toEqual(0)
  })

  it('已是整分钟的时间戳不变', () => {
    const ts = 1700000040000
    const aligned = alignTimestamp(ts)
    expect(aligned).toEqual(ts)
  })
})

describe('formatPrice 价格格式化', () => {
  it('价格 >= 1 时显示 ¥ 前缀和两位小数', () => {
    expect(formatPrice(9.9)).toEqual('¥9.90')
    expect(formatPrice(10)).toEqual('¥10.00')
  })

  it('价格 < 1 时显示积分', () => {
    expect(formatPrice(0.5)).toEqual('50积分')
    expect(formatPrice(0.01)).toEqual('1积分')
  })
})

describe('isNodePaid 节点付费检查', () => {
  it('付费开启且节点在 paidNodes 中返回 true', () => {
    const config = makeMonetizationConfig()
    expect(isNodePaid('node-1', config)).toBe(true)
  })

  it('节点不在 paidNodes 中返回 false', () => {
    const config = makeMonetizationConfig()
    expect(!isNodePaid('node-free', config)).toBe(true)
  })

  it('付费关闭时返回 false', () => {
    const config = makeMonetizationConfig({ enabled: false })
    expect(!isNodePaid('node-1', config)).toBe(true)
  })

  it('节点在 freePreviewNodes 中返回 false', () => {
    const config = makeMonetizationConfig({ freePreviewNodes: ['node-1'] })
    expect(!isNodePaid('node-1', config)).toBe(true)
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
    expect(stats.totalPaidNodes).toEqual(3)
    expect(stats.totalFreeNodes).toEqual(1)
    expect(stats.priceRange.min).toEqual(6.6)
    expect(stats.priceRange.max).toEqual(18.8)
  })

  it('空配置返回零值', () => {
    const stats = getMonetizationStats({})
    expect(stats.totalPaidNodes).toEqual(0)
    expect(stats.totalFreeNodes).toEqual(0)
    expect(stats.priceRange.min).toEqual(0)
    expect(stats.priceRange.max).toEqual(0)
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
    expect(stats.priceRange.min).toEqual(5.0)
    expect(stats.priceRange.max).toEqual(15.0)
    expect(stats.totalPaidChapters).toEqual(2)
  })
})
