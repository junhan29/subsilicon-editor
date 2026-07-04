/** story-encrypt 单元测试 */
import {
  generateEncryptionKey,
  encryptWithAES,
  decryptWithAES,
  encryptStoryData,
  decryptStoryData,
  encodeKeyInfo,
  decodeKeyInfo,
  AES_ENC_PREFIX,
} from '../story-encrypt'

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

export async function runTests(): Promise<void> {
  passed = 0
  failed = 0
  failures.length = 0

  describe('generateEncryptionKey 密钥生成', () => {
    it('返回 32 字节密钥和 12 字节 IV', () => {
      const { key, iv } = generateEncryptionKey()
      assertEqual(key.length, 32, '密钥应为 32 字节（256 位）')
      assertEqual(iv.length, 12, 'IV 应为 12 字节（96 位）')
    })

    it('每次调用生成不同的密钥和 IV', () => {
      const { key: key1, iv: iv1 } = generateEncryptionKey()
      const { key: key2, iv: iv2 } = generateEncryptionKey()
      assert(key1 !== key2, '密钥应不同')
      assert(iv1 !== iv2, 'IV 应不同')
    })

    it('生成的密钥为 Uint8Array 类型', () => {
      const { key, iv } = generateEncryptionKey()
      assert(key instanceof Uint8Array, 'key 应为 Uint8Array')
      assert(iv instanceof Uint8Array, 'iv 应为 Uint8Array')
    })
  })

  describe('encryptWithAES 加密功能', () => {
    it('返回 Base64 字符串', async () => {
      const { key, iv } = generateEncryptionKey()
      const ciphertext = await encryptWithAES('hello world', key, iv)
      assert(typeof ciphertext === 'string', '应返回字符串')
      // Base64 字符只包含 A-Z a-z 0-9 + / =
      assert(/^[A-Za-z0-9+/]*={0,2}$/.test(ciphertext), '应为合法 Base64')
    })

    it('相同明文+密钥+IV 加密结果相同（确定性）', async () => {
      const { key, iv } = generateEncryptionKey()
      const ct1 = await encryptWithAES('test', key, iv)
      const ct2 = await encryptWithAES('test', key, iv)
      assertEqual(ct1, ct2, '相同输入应产生相同密文')
    })

    it('不同密钥产生不同密文', async () => {
      const { key: key1, iv } = generateEncryptionKey()
      const { key: key2 } = generateEncryptionKey()
      const ct1 = await encryptWithAES('test', key1, iv)
      const ct2 = await encryptWithAES('test', key2, iv)
      assert(ct1 !== ct2, '不同密钥应产生不同密文')
    })

    it('支持中文文本加密', async () => {
      const { key, iv } = generateEncryptionKey()
      const plaintext = '你好世界，硅基之下'
      const ciphertext = await encryptWithAES(plaintext, key, iv)
      assert(typeof ciphertext === 'string' && ciphertext.length > 0, '中文加密应返回非空字符串')
    })

    it('空字符串也能正常加密', async () => {
      const { key, iv } = generateEncryptionKey()
      const ciphertext = await encryptWithAES('', key, iv)
      assert(typeof ciphertext === 'string' && ciphertext.length > 0, '空字符串加密应返回非空密文')
    })
  })

  describe('encryptWithAES → decryptWithAES 往返测试', () => {
    it('英文文本往返一致', async () => {
      const { key, iv } = generateEncryptionKey()
      const plaintext = 'The quick brown fox jumps over the lazy dog'
      const ciphertext = await encryptWithAES(plaintext, key, iv)
      // decryptWithAES 需要 base64 格式的 key 和 iv
      const keyBase64 = btoa(String.fromCharCode(...key))
      const ivBase64 = btoa(String.fromCharCode(...iv))
      const decrypted = await decryptWithAES(ciphertext, keyBase64, ivBase64)
      assertEqual(decrypted, plaintext, '英文往返应一致')
    })

    it('中文文本往返一致', async () => {
      const { key, iv } = generateEncryptionKey()
      const plaintext = '硅基之下，互动叙事的未来'
      const ciphertext = await encryptWithAES(plaintext, key, iv)
      const keyBase64 = btoa(String.fromCharCode(...key))
      const ivBase64 = btoa(String.fromCharCode(...iv))
      const decrypted = await decryptWithAES(ciphertext, keyBase64, ivBase64)
      assertEqual(decrypted, plaintext, '中文往返应一致')
    })

    it('长文本往返一致', async () => {
      const { key, iv } = generateEncryptionKey()
      const plaintext = 'A'.repeat(10000)
      const ciphertext = await encryptWithAES(plaintext, key, iv)
      const keyBase64 = btoa(String.fromCharCode(...key))
      const ivBase64 = btoa(String.fromCharCode(...iv))
      const decrypted = await decryptWithAES(ciphertext, keyBase64, ivBase64)
      assertEqual(decrypted, plaintext, '长文本往返应一致')
    })

    it('空字符串往返一致', async () => {
      const { key, iv } = generateEncryptionKey()
      const ciphertext = await encryptWithAES('', key, iv)
      const keyBase64 = btoa(String.fromCharCode(...key))
      const ivBase64 = btoa(String.fromCharCode(...iv))
      const decrypted = await decryptWithAES(ciphertext, keyBase64, ivBase64)
      assertEqual(decrypted, '', '空字符串往返应一致')
    })

    it('错误密钥解密应抛出异常（GCM 认证失败）', async () => {
      const { key: key1, iv } = generateEncryptionKey()
      const { key: key2 } = generateEncryptionKey()
      const ciphertext = await encryptWithAES('secret', key1, iv)
      const wrongKeyBase64 = btoa(String.fromCharCode(...key2))
      const ivBase64 = btoa(String.fromCharCode(...iv))
      let threw = false
      try {
        await decryptWithAES(ciphertext, wrongKeyBase64, ivBase64)
      } catch {
        threw = true
      }
      assert(threw, '错误密钥解密应抛出异常')
    })
  })

  describe('encryptStoryData 故事数据加密', () => {
    it('返回带 AES_ENC_PREFIX 前缀的加密数据', async () => {
      const graphJSON = JSON.stringify({ title: '测试故事', nodes: [] })
      const result = await encryptStoryData(graphJSON)
      assert(result.encryptedData.startsWith(AES_ENC_PREFIX), '加密数据应带前缀')
    })

    it('返回 keyBase64 和 ivBase64', async () => {
      const result = await encryptStoryData('{"test":true}')
      assert(typeof result.keyBase64 === 'string' && result.keyBase64.length > 0, 'keyBase64 应非空')
      assert(typeof result.ivBase64 === 'string' && result.ivBase64.length > 0, 'ivBase64 应非空')
    })

    it('每次调用生成不同的密钥', async () => {
      const r1 = await encryptStoryData('{"a":1}')
      const r2 = await encryptStoryData('{"a":1}')
      assert(r1.keyBase64 !== r2.keyBase64, '密钥应不同')
      assert(r1.ivBase64 !== r2.ivBase64, 'IV 应不同')
    })
  })

  describe('encryptStoryData → decryptStoryData 往返测试', () => {
    it('故事 JSON 往返一致', async () => {
      const graphJSON = JSON.stringify({
        title: '硅基之下',
        nodes: [
          { id: 'n1', type: 'dialogue', data: { text: '你好' } },
          { id: 'n2', type: 'choice', data: { options: [{ text: '选项A' }, { text: '选项B' }] } },
        ],
        edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
      })
      const encrypted = await encryptStoryData(graphJSON)
      const decrypted = await decryptStoryData(
        encrypted.encryptedData,
        encrypted.keyBase64,
        encrypted.ivBase64
      )
      assertEqual(decrypted, graphJSON, '故事 JSON 往返应一致')
    })

    it('简单字符串往返一致', async () => {
      const plaintext = 'simple string data'
      const encrypted = await encryptStoryData(plaintext)
      const decrypted = await decryptStoryData(
        encrypted.encryptedData,
        encrypted.keyBase64,
        encrypted.ivBase64
      )
      assertEqual(decrypted, plaintext, '简单字符串往返应一致')
    })
  })

  describe('decryptStoryData 错误处理', () => {
    it('非加密数据（无前缀）抛出异常', async () => {
      let threw = false
      try {
        await decryptStoryData('not-encrypted-data', 'key', 'iv')
      } catch (e) {
        threw = true
        assert(e instanceof Error, '应抛出 Error')
        assert((e as Error).message.includes('加密格式'), `错误信息应包含"加密格式"，实际: ${(e as Error).message}`)
      }
      assert(threw, '无前缀数据应抛出异常')
    })

    it('空字符串抛出异常', async () => {
      let threw = false
      try {
        await decryptStoryData('', 'key', 'iv')
      } catch {
        threw = true
      }
      assert(threw, '空字符串应抛出异常')
    })
  })

  describe('encodeKeyInfo / decodeKeyInfo 密钥信息编解码', () => {
    it('编码后为 JSON 字符串', () => {
      const json = encodeKeyInfo('key123', 'iv456')
      assert(typeof json === 'string', '应返回字符串')
      const parsed = JSON.parse(json)
      assertEqual(parsed.key, 'key123', 'key 应正确')
      assertEqual(parsed.iv, 'iv456', 'iv 应正确')
    })

    it('编码→解码往返一致', () => {
      const keyBase64 = 'dGVzdC1rZXk='
      const ivBase64 = 'dGVzdC1pdg=='
      const json = encodeKeyInfo(keyBase64, ivBase64)
      const decoded = decodeKeyInfo(json)
      assertEqual(decoded.key, keyBase64, 'key 往返应一致')
      assertEqual(decoded.iv, ivBase64, 'iv 往返应一致')
    })

    it('解码返回包含 key 和 iv 字段的对象', () => {
      const json = JSON.stringify({ key: 'k', iv: 'i' })
      const decoded = decodeKeyInfo(json)
      assert('key' in decoded, '应有 key 字段')
      assert('iv' in decoded, '应有 iv 字段')
    })
  })

  await runTestQueue()

  console.log(
    `\n=== story-encrypt 测试结果: ${passed} 通过, ${failed} 失败 ===`
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
      !!process.argv[1]?.includes('story-encrypt.test')
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
