import { describe, it, expect } from 'vitest'
import {
  ENCRYPTED_PREFIX,
  isEncryptedAiKey,
  encryptAiKey,
  decryptAiKey,
  encryptApiKeyField,
  decryptApiKeyField,
  encryptAiConfig,
  decryptAiConfig,
} from '../ai/ai-key-vault'

describe('isEncryptedAiKey', () => {
  it('识别加密前缀', () => {
    expect(isEncryptedAiKey(`${ENCRYPTED_PREFIX}abc`)).toBe(true)
    expect(isEncryptedAiKey('sk-plain')).toBe(false)
    expect(isEncryptedAiKey('')).toBe(false)
    expect(isEncryptedAiKey(undefined)).toBe(false)
    expect(isEncryptedAiKey(null)).toBe(false)
  })
})

describe('encryptAiKey / decryptAiKey', () => {
  it('加密后带前缀且不包含明文', async () => {
    const enc = await encryptAiKey('sk-secret-123')
    expect(enc.startsWith(ENCRYPTED_PREFIX)).toBe(true)
    expect(enc).not.toContain('sk-secret-123')
  })

  it('解密往返一致', async () => {
    const plain = 'sk-roundtrip-key'
    expect(await decryptAiKey(await encryptAiKey(plain))).toBe(plain)
  })

  it('空值直接返回', async () => {
    expect(await encryptAiKey('')).toBe('')
    expect(await decryptAiKey('')).toBe('')
  })

  it('旧明文兼容：无前缀原样返回', async () => {
    expect(await decryptAiKey('sk-legacy-plain')).toBe('sk-legacy-plain')
  })

  it('已加密值重复加密幂等', async () => {
    const enc = await encryptAiKey('sk-x')
    expect(await encryptAiKey(enc)).toBe(enc)
  })

  it('损坏格式解密失败返回空串', async () => {
    expect(await decryptAiKey(`${ENCRYPTED_PREFIX}bad`)).toBe('')
  })

  it('篡改密文解密失败返回空串', async () => {
    const enc = await encryptAiKey('sk-original')
    const tampered = enc.slice(0, -4) + 'AAAA'
    expect(await decryptAiKey(tampered)).toBe('')
  })
})

describe('字段级加解密', () => {
  it('encryptApiKeyField 加密明文、跳过已加密', async () => {
    const plain = { apiKey: 'sk-1' }
    const enc = await encryptApiKeyField(plain)
    expect(isEncryptedAiKey(enc.apiKey)).toBe(true)
    expect(await decryptApiKeyField(enc)).toEqual({ apiKey: 'sk-1' })
    // 幂等
    expect(await encryptApiKeyField(enc)).toEqual(enc)
  })

  it('空 apiKey 不处理', async () => {
    expect(await encryptApiKeyField({ apiKey: '' })).toEqual({ apiKey: '' })
    expect(await decryptApiKeyField({ apiKey: '' })).toEqual({ apiKey: '' })
  })
})

describe('AiConfig 级加解密', () => {
  it('flat 顶层 apiKey 加密', async () => {
    const enc = await encryptAiConfig({ enabled: true, apiKey: 'sk-flat', provider: 'openai', model: 'gpt-4o-mini' })
    expect(isEncryptedAiKey(enc.apiKey as string)).toBe(true)
    const dec = await decryptAiConfig(enc)
    expect(dec.apiKey).toBe('sk-flat')
  })

  it('providers 数组逐项加密，已加密跳过', async () => {
    const providers = [
      { id: 'a', name: 'A', provider: 'openai' as const, apiKey: 'sk-a', model: 'm1', enabled: true },
      { id: 'b', name: 'B', provider: 'deepseek' as const, apiKey: 'sk-b', model: 'm2', enabled: true },
    ]
    const enc = await encryptAiConfig({ enabled: true, providers })
    const arr = enc.providers as Array<{ apiKey: string }>
    expect(arr.every((p) => isEncryptedAiKey(p.apiKey))).toBe(true)
    // 幂等
    const enc2 = await encryptAiConfig(enc)
    expect(enc2.providers).toEqual(enc.providers)
    const dec = await decryptAiConfig(enc2)
    expect((dec.providers as Array<{ apiKey: string }>).map((p) => p.apiKey)).toEqual(['sk-a', 'sk-b'])
  })
})
