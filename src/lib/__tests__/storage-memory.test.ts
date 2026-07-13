import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryStorageAdapter } from '../storage/memory-storage-adapter'
import type { StorageAdapter } from '../storage/types'

describe('MemoryStorageAdapter', () => {
  let storage: StorageAdapter

  beforeEach(() => {
    storage = new MemoryStorageAdapter()
  })

  describe('get / set', () => {
    it('能存储和读取字符串', async () => {
      await storage.set('key', 'value')
      expect(await storage.get('key')).toBe('value')
    })

    it('能存储和读取对象', async () => {
      const obj = { name: 'test', count: 42 }
      await storage.set('obj', obj)
      expect(await storage.get('obj')).toEqual(obj)
    })

    it('能存储和读取数组', async () => {
      const arr = [1, 2, 3]
      await storage.set('arr', arr)
      expect(await storage.get('arr')).toEqual(arr)
    })

    it('读取不存在的键返回 null', async () => {
      expect(await storage.get('nonexistent')).toBeNull()
    })

    it('覆盖已有的值', async () => {
      await storage.set('key', 'old')
      await storage.set('key', 'new')
      expect(await storage.get('key')).toBe('new')
    })

    it('能存储 null 值', async () => {
      await storage.set('nullKey', null)
      expect(await storage.get('nullKey')).toBeNull()
    })

    it('能存储 0 值', async () => {
      await storage.set('zero', 0)
      expect(await storage.get('zero')).toBe(0)
    })

    it('能存储 false 值', async () => {
      await storage.set('falseKey', false)
      expect(await storage.get('falseKey')).toBe(false)
    })
  })

  describe('remove', () => {
    it('能删除已有的键', async () => {
      await storage.set('key', 'value')
      await storage.remove('key')
      expect(await storage.get('key')).toBeNull()
    })

    it('删除不存在的键不会报错', async () => {
      await expect(storage.remove('nonexistent')).resolves.not.toThrow()
    })
  })

  describe('clear', () => {
    it('能清空所有数据', async () => {
      await storage.set('a', 1)
      await storage.set('b', 2)
      await storage.clear()
      expect(await storage.get('a')).toBeNull()
      expect(await storage.get('b')).toBeNull()
    })
  })

  describe('keys', () => {
    it('返回所有键', async () => {
      await storage.set('a', 1)
      await storage.set('b', 2)
      await storage.set('c', 3)
      const keys = await storage.keys()
      expect(keys).toHaveLength(3)
      expect(keys).toContain('a')
      expect(keys).toContain('b')
      expect(keys).toContain('c')
    })

    it('按前缀过滤键', async () => {
      await storage.set('user_1', 'a')
      await storage.set('user_2', 'b')
      await storage.set('post_1', 'c')
      const keys = await storage.keys('user_')
      expect(keys).toHaveLength(2)
      expect(keys).toContain('user_1')
      expect(keys).toContain('user_2')
      expect(keys).not.toContain('post_1')
    })

    it('空存储返回空数组', async () => {
      expect(await storage.keys()).toEqual([])
    })
  })

  describe('has', () => {
    it('存在的键返回 true', async () => {
      await storage.set('key', 'value')
      expect(await storage.has('key')).toBe(true)
    })

    it('不存在的键返回 false', async () => {
      expect(await storage.has('nonexistent')).toBe(false)
    })

    it('值为 null 的键也返回 true', async () => {
      await storage.set('nullKey', null)
      expect(await storage.has('nullKey')).toBe(true)
    })
  })
})
