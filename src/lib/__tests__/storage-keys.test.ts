import { describe, it, expect } from 'vitest'
import {
  STORAGE_KEYS,
  getStorageKey,
  getAllStorageKeys,
  getLocalStorageKeys,
  getSessionStorageKeys,
  validateStorageKey,
} from '../storage-keys'

describe('storage-keys', () => {
  describe('STORAGE_KEYS', () => {
    it('所有键都有正确的结构', () => {
      for (const [name, config] of Object.entries(STORAGE_KEYS)) {
        expect(config.key).toBeTypeOf('string')
        expect(config.key.length).toBeGreaterThan(0)
        expect(config.version).toBeTypeOf('number')
        expect(config.version).toBeGreaterThan(0)
        expect(['local', 'session', 'indexed-db']).toContain(config.type)
        expect(config.description).toBeTypeOf('string')
        expect(config.description.length).toBeGreaterThan(0)
      }
    })

    it('所有键都有 subsilicon_ 前缀', () => {
      for (const config of Object.values(STORAGE_KEYS)) {
        expect(config.key.startsWith('subsilicon_')).toBe(true)
      }
    })
  })

  describe('getStorageKey', () => {
    it('返回带版本号的键名', () => {
      const key = getStorageKey('AI_CONFIG')
      expect(key).toBe('subsilicon_ai_config_v2')
    })

    it('不同版本号生成不同的键', () => {
      const key1 = getStorageKey('AI_CONFIG')
      const key2 = getStorageKey('THEME')
      expect(key1).not.toBe(key2)
    })
  })

  describe('getAllStorageKeys', () => {
    it('返回所有存储键', () => {
      const keys = getAllStorageKeys()
      const keyCount = Object.keys(STORAGE_KEYS).length
      expect(Object.keys(keys).length).toBe(keyCount)
    })

    it('所有值都是字符串', () => {
      const keys = getAllStorageKeys()
      for (const value of Object.values(keys)) {
        expect(value).toBeTypeOf('string')
      }
    })
  })

  describe('getLocalStorageKeys', () => {
    it('只返回 local 类型的键', () => {
      const localKeys = getLocalStorageKeys()
      for (const key of localKeys) {
        expect(STORAGE_KEYS[key].type).toBe('local')
      }
    })

    it('不包含 session 类型的键', () => {
      const localKeys = getLocalStorageKeys()
      const sessionKeys = getSessionStorageKeys()
      for (const key of sessionKeys) {
        expect(localKeys).not.toContain(key)
      }
    })
  })

  describe('getSessionStorageKeys', () => {
    it('只返回 session 类型的键', () => {
      const sessionKeys = getSessionStorageKeys()
      for (const key of sessionKeys) {
        expect(STORAGE_KEYS[key].type).toBe('session')
      }
    })
  })

  describe('validateStorageKey', () => {
    it('验证有效的存储键', () => {
      expect(validateStorageKey('subsilicon_ai_config_v2')).toBe(true)
      expect(validateStorageKey('subsilicon_theme_v1')).toBe(true)
    })

    it('拒绝无效的存储键', () => {
      expect(validateStorageKey('invalid_key')).toBe(false)
      expect(validateStorageKey('some_other_key')).toBe(false)
    })

    it('验证带版本和不带版本的键都能通过', () => {
      expect(validateStorageKey('subsilicon_ai_config')).toBe(true)
      expect(validateStorageKey('subsilicon_ai_config_v1')).toBe(true)
      expect(validateStorageKey('subsilicon_ai_config_v2')).toBe(true)
    })
  })
})
