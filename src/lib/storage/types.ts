export interface StorageAdapter {
  get<T = unknown>(key: string): Promise<T | null>
  set<T = unknown>(key: string, value: T): Promise<void>
  remove(key: string): Promise<void>
  clear(): Promise<void>
  keys(prefix?: string): Promise<string[]>
  has(key: string): Promise<boolean>
}

export type StorageType = 'local' | 'session' | 'memory'
