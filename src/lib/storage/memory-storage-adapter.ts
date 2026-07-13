import type { StorageAdapter } from './types'

export class MemoryStorageAdapter implements StorageAdapter {
  private store = new Map<string, string>()

  async get<T = unknown>(key: string): Promise<T | null> {
    const value = this.store.get(key)
    if (!value) return null
    try {
      return JSON.parse(value) as T
    } catch {
      return null
    }
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    this.store.set(key, JSON.stringify(value))
  }

  async remove(key: string): Promise<void> {
    this.store.delete(key)
  }

  async clear(): Promise<void> {
    this.store.clear()
  }

  async keys(prefix?: string): Promise<string[]> {
    const allKeys = Array.from(this.store.keys())
    return prefix ? allKeys.filter((k) => k.startsWith(prefix)) : allKeys
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key)
  }
}

export const memoryStorageAdapter = new MemoryStorageAdapter()
