/** story-encrypt 单元测试 */
import { describe, it, expect } from 'vitest'
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

describe('generateEncryptionKey 密钥生成', () => {
  it('返回 32 字节密钥和 12 字节 IV', () => {
    const { key, iv } = generateEncryptionKey()
    expect(key.length).toEqual(32)
    expect(iv.length).toEqual(12)
  })

  it('每次调用生成不同的密钥和 IV', () => {
    const { key: key1, iv: iv1 } = generateEncryptionKey()
    const { key: key2, iv: iv2 } = generateEncryptionKey()
    expect(key1 !== key2).toBe(true)
    expect(iv1 !== iv2).toBe(true)
  })

  it('生成的密钥为 Uint8Array 类型', () => {
    const { key, iv } = generateEncryptionKey()
    expect(key instanceof Uint8Array).toBe(true)
    expect(iv instanceof Uint8Array).toBe(true)
  })
})

describe('encryptWithAES 加密功能', () => {
  it('返回 Base64 字符串', async () => {
    const { key, iv } = generateEncryptionKey()
    const ciphertext = await encryptWithAES('hello world', key, iv)
    expect(typeof ciphertext === 'string').toBe(true)
    expect(/^[A-Za-z0-9+/]*={0,2}$/.test(ciphertext)).toBe(true)
  })

  it('相同明文+密钥+IV 加密结果相同（确定性）', async () => {
    const { key, iv } = generateEncryptionKey()
    const ct1 = await encryptWithAES('test', key, iv)
    const ct2 = await encryptWithAES('test', key, iv)
    expect(ct1).toEqual(ct2)
  })

  it('不同密钥产生不同密文', async () => {
    const { key: key1, iv } = generateEncryptionKey()
    const { key: key2 } = generateEncryptionKey()
    const ct1 = await encryptWithAES('test', key1, iv)
    const ct2 = await encryptWithAES('test', key2, iv)
    expect(ct1 !== ct2).toBe(true)
  })

  it('支持中文文本加密', async () => {
    const { key, iv } = generateEncryptionKey()
    const plaintext = '你好世界，硅基之下'
    const ciphertext = await encryptWithAES(plaintext, key, iv)
    expect(typeof ciphertext === 'string' && ciphertext.length > 0).toBe(true)
  })

  it('空字符串也能正常加密', async () => {
    const { key, iv } = generateEncryptionKey()
    const ciphertext = await encryptWithAES('', key, iv)
    expect(typeof ciphertext === 'string' && ciphertext.length > 0).toBe(true)
  })
})

describe('encryptWithAES → decryptWithAES 往返测试', () => {
  it('英文文本往返一致', async () => {
    const { key, iv } = generateEncryptionKey()
    const plaintext = 'The quick brown fox jumps over the lazy dog'
    const ciphertext = await encryptWithAES(plaintext, key, iv)
    const keyBase64 = btoa(String.fromCharCode(...key))
    const ivBase64 = btoa(String.fromCharCode(...iv))
    const decrypted = await decryptWithAES(ciphertext, keyBase64, ivBase64)
    expect(decrypted).toEqual(plaintext)
  })

  it('中文文本往返一致', async () => {
    const { key, iv } = generateEncryptionKey()
    const plaintext = '硅基之下，互动叙事的未来'
    const ciphertext = await encryptWithAES(plaintext, key, iv)
    const keyBase64 = btoa(String.fromCharCode(...key))
    const ivBase64 = btoa(String.fromCharCode(...iv))
    const decrypted = await decryptWithAES(ciphertext, keyBase64, ivBase64)
    expect(decrypted).toEqual(plaintext)
  })

  it('长文本往返一致', async () => {
    const { key, iv } = generateEncryptionKey()
    const plaintext = 'A'.repeat(10000)
    const ciphertext = await encryptWithAES(plaintext, key, iv)
    const keyBase64 = btoa(String.fromCharCode(...key))
    const ivBase64 = btoa(String.fromCharCode(...iv))
    const decrypted = await decryptWithAES(ciphertext, keyBase64, ivBase64)
    expect(decrypted).toEqual(plaintext)
  })

  it('空字符串往返一致', async () => {
    const { key, iv } = generateEncryptionKey()
    const ciphertext = await encryptWithAES('', key, iv)
    const keyBase64 = btoa(String.fromCharCode(...key))
    const ivBase64 = btoa(String.fromCharCode(...iv))
    const decrypted = await decryptWithAES(ciphertext, keyBase64, ivBase64)
    expect(decrypted).toEqual('')
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
    expect(threw).toBe(true)
  })
})

describe('encryptStoryData 故事数据加密', () => {
  it('返回带 AES_ENC_PREFIX 前缀的加密数据', async () => {
    const graphJSON = JSON.stringify({ title: '测试故事', nodes: [] })
    const result = await encryptStoryData(graphJSON)
    expect(result.encryptedData.startsWith(AES_ENC_PREFIX)).toBe(true)
  })

  it('返回 keyBase64 和 ivBase64', async () => {
    const result = await encryptStoryData('{"test":true}')
    expect(typeof result.keyBase64 === 'string' && result.keyBase64.length > 0).toBe(true)
    expect(typeof result.ivBase64 === 'string' && result.ivBase64.length > 0).toBe(true)
  })

  it('每次调用生成不同的密钥', async () => {
    const r1 = await encryptStoryData('{"a":1}')
    const r2 = await encryptStoryData('{"a":1}')
    expect(r1.keyBase64 !== r2.keyBase64).toBe(true)
    expect(r1.ivBase64 !== r2.ivBase64).toBe(true)
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
    expect(decrypted).toEqual(graphJSON)
  })

  it('简单字符串往返一致', async () => {
    const plaintext = 'simple string data'
    const encrypted = await encryptStoryData(plaintext)
    const decrypted = await decryptStoryData(
      encrypted.encryptedData,
      encrypted.keyBase64,
      encrypted.ivBase64
    )
    expect(decrypted).toEqual(plaintext)
  })
})

describe('decryptStoryData 错误处理', () => {
  it('非加密数据（无前缀）抛出异常', async () => {
    let threw = false
    try {
      await decryptStoryData('not-encrypted-data', 'key', 'iv')
    } catch (e) {
      threw = true
      expect(e instanceof Error).toBe(true)
      expect((e as Error).message.includes('加密格式')).toBe(true)
    }
    expect(threw).toBe(true)
  })

  it('空字符串抛出异常', async () => {
    let threw = false
    try {
      await decryptStoryData('', 'key', 'iv')
    } catch {
      threw = true
    }
    expect(threw).toBe(true)
  })
})

describe('encodeKeyInfo / decodeKeyInfo 密钥信息编解码', () => {
  it('编码后为 JSON 字符串', () => {
    const json = encodeKeyInfo('key123', 'iv456')
    expect(typeof json === 'string').toBe(true)
    const parsed = JSON.parse(json)
    expect(parsed.key).toEqual('key123')
    expect(parsed.iv).toEqual('iv456')
  })

  it('编码→解码往返一致', () => {
    const keyBase64 = 'dGVzdC1rZXk='
    const ivBase64 = 'dGVzdC1pdg=='
    const json = encodeKeyInfo(keyBase64, ivBase64)
    const decoded = decodeKeyInfo(json)
    expect(decoded.key).toEqual(keyBase64)
    expect(decoded.iv).toEqual(ivBase64)
  })

  it('解码返回包含 key 和 iv 字段的对象', () => {
    const json = JSON.stringify({ key: 'k', iv: 'i' })
    const decoded = decodeKeyInfo(json)
    expect('key' in decoded).toBe(true)
    expect('iv' in decoded).toBe(true)
  })
})
