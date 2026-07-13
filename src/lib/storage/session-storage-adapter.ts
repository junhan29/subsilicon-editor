import type { StorageAdapter } from './types'

export class SessionStorageAdapter implements StorageAdapter {
  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const value = sessionStorage.getItem(key)
      return value ? (JSON.parse(value) as T) : null
    } catch {
      return null
    }
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    sessionStorage.setItem(key, JSON.stringify(value))
  }

  async remove(key: string): Promise<void> {
    sessionStorage.removeItem(key)
  }

  async clear(): Promise<void> {
    sessionStorage.clear()
  }

  async keys(prefix?: string): Promise<string[]> {
    const allKeys: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key && (!prefix || key.startsWith(prefix))) {
        allKeys.push(key)
      }
    }
    return allKeys
  }

  async has(key: string): Promise<boolean> {
    return sessionStorage.getItem(key) !== null
  }
}

export const sessionStorageAdapter = new SessionStorageAdapter()
