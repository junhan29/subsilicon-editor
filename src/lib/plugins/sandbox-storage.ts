import type { PluginStorage } from './types'
import { MemoryStorageAdapter } from '../storage/memory-storage-adapter'
import type { StorageAdapter } from '../storage/types'

export class SandboxStorage implements PluginStorage {
  private storage: StorageAdapter
  private namespace: string

  constructor(namespace: string, storage?: StorageAdapter) {
    this.namespace = `plugin:${namespace}:`
    this.storage = storage || new MemoryStorageAdapter()
  }

  private prefixed(key: string): string {
    return `${this.namespace}${key}`
  }

  private unprefixed(key: string): string {
    return key.slice(this.namespace.length)
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    return this.storage.get<T>(this.prefixed(key))
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    await this.storage.set(this.prefixed(key), value)
  }

  async remove(key: string): Promise<void> {
    await this.storage.remove(this.prefixed(key))
  }

  async clear(): Promise<void> {
    const keys = await this.storage.keys(this.namespace)
    for (const key of keys) {
      await this.storage.remove(key)
    }
  }

  async keys(): Promise<string[]> {
    const allKeys = await this.storage.keys(this.namespace)
    return allKeys.map((k) => this.unprefixed(k))
  }
}
