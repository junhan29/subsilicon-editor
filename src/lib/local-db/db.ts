// 数据库名和结构
const DB_NAME = 'subsilicon-editor'
const DB_VERSION = 2

// 表定义
const STORES = {
  works: { keyPath: 'id' },           // 作品完整数据（StoryGraph JSON + 元数据）
  assets: { keyPath: 'hash' },        // 媒体资源二进制数据（blob）
  settings: { keyPath: 'key' },       // 编辑器设置、AI Key 等小数据
  platformConfigs: { keyPath: 'id' }, // 发布平台配置
  creatorAccounts: { keyPath: 'email' }, // 创作者账号
  publishRecords: { keyPath: 'id' },  // 发布记录
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
      if (!db.objectStoreNames.contains('platformConfigs')) {
        db.createObjectStore('platformConfigs', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('creatorAccounts')) {
        db.createObjectStore('creatorAccounts', { keyPath: 'email' })
      }
      if (!db.objectStoreNames.contains('publishRecords')) {
        db.createObjectStore('publishRecords', { keyPath: 'id' })
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
