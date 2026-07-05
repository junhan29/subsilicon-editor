const DB_NAME = 'subsilicon-editor'
const DB_VERSION = 1

const STORES = {
  works: { keyPath: 'id' },           // 作品完整数据（StoryGraph JSON + 元数据）
  assets: { keyPath: 'hash' },        // 媒体资源二进制数据（blob）
  settings: { keyPath: 'key' },       // 编辑器设置、AI Key 等小数据
}

export async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains('works')) {
        db.createObjectStore('works', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('assets')) {
        db.createObjectStore('assets', { keyPath: 'hash' })
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// 降级到 localStorage 当 IndexedDB 不可用（如隐私模式）
export function isIndexedDBAvailable(): boolean {
  try {
    return 'indexedDB' in window && !!window.indexedDB
  } catch {
    return false
  }
}
