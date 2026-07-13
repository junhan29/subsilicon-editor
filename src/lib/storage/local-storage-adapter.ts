import type { StorageAdapter } from './types'

export class LocalStorageAdapter implements StorageAdapter {
  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const value = localStorage.getItem(key)
      return value ? (JSON.parse(value) as T) : null
    } catch {
      return null
    }
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    localStorage.setItem(key, JSON.stringify(value))
  }

  async remove(key: string): Promise<void> {
    localStorage.removeItem(key)
  }

  async clear(): Promise<void> {
    localStorage.clear()
  }

  async keys(prefix?: string): Promise<string[]> {
    const allKeys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (!prefix || key.startsWith(prefix))) {
        allKeys.push(key)
      }
    }
    return allKeys
  }

  async has(key: string): Promise<boolean> {
    return localStorage.getItem(key) !== null
  }
}

export const localStorageAdapter = new LocalStorageAdapter()
