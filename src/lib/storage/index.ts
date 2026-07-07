import type { StorageAdapter, StorageType } from './types'
import { localStorageAdapter } from './local-storage-adapter'
import { sessionStorageAdapter } from './session-storage-adapter'
import { memoryStorageAdapter } from './memory-storage-adapter'
import { STORAGE_KEYS, getStorageKey, type StorageKeyName } from './keys'

const adapters: Record<StorageType, StorageAdapter> = {
  local: localStorageAdapter,
  session: sessionStorageAdapter,
  memory: memoryStorageAdapter,
}

export function getStorageAdapter(type: StorageType): StorageAdapter {
  return adapters[type]
}

export function getLocalStorage(): StorageAdapter {
  return adapters.local
}

export function getSessionStorage(): StorageAdapter {
  return adapters.session
}

export function getMemoryStorage(): StorageAdapter {
  return adapters.memory
}

export async function getConfigValue<T = unknown>(name: StorageKeyName): Promise<T | null> {
  const keyConfig = STORAGE_KEYS[name]
  const adapter = getStorageAdapter(keyConfig.type)
  const key = getStorageKey(name)
  return adapter.get<T>(key)
}

export async function setConfigValue<T = unknown>(name: StorageKeyName, value: T): Promise<void> {
  const keyConfig = STORAGE_KEYS[name]
  const adapter = getStorageAdapter(keyConfig.type)
  const key = getStorageKey(name)
  await adapter.set(key, value)
}

export async function removeConfigValue(name: StorageKeyName): Promise<void> {
  const keyConfig = STORAGE_KEYS[name]
  const adapter = getStorageAdapter(keyConfig.type)
  const key = getStorageKey(name)
  await adapter.remove(key)
}

export async function hasConfigValue(name: StorageKeyName): Promise<boolean> {
  const keyConfig = STORAGE_KEYS[name]
  const adapter = getStorageAdapter(keyConfig.type)
  const key = getStorageKey(name)
  return adapter.has(key)
}
