// 数据库名和结构
const DB_NAME = 'subsilicon-editor'
const DB_VERSION = 4

// 表定义
const STORES = {
  works: { keyPath: 'id' },           // 作品完整数据（StoryGraph JSON + 元数据）
  assets: { keyPath: 'hash' },        // 媒体资源二进制数据（blob）
  settings: { keyPath: 'key' },       // 编辑器设置、AI Key 等小数据
  platformConfigs: { keyPath: 'id' }, // 发布平台配置
  creatorAccounts: { keyPath: 'email' }, // 创作者账号
  publishRecords: { keyPath: 'id' },  // 发布记录
  booths: { keyPath: 'id' },          // 摊位容器（v4）
}

// 单例连接缓存：IndexedDB 连接数有浏览器上限（Chromium 约 20 个/源），
// 若每次操作都新建连接且不关闭，编辑会话稍长即耗尽上限，
// 后续所有 openDB 调用会永久排队（blocked），导致列表加载/保存/导出静默挂起。
// 此处缓存并复用同一连接，仅当连接被意外关闭（versionchange）时重建。
let dbPromise: Promise<IDBDatabase> | null = null

export function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
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
        // v3：合并本地账号库（旧 local-account-store 曾以版本 1 打开同一数据库，
        // 与 v2 主库冲突导致注册/登录必然失败；现统一由本连接承载）
        if (!db.objectStoreNames.contains('accounts')) {
          const accStore = db.createObjectStore('accounts', { keyPath: 'email' })
          accStore.createIndex('email', 'email', { unique: true })
        }
        // v4：摊位容器（摊位工作台一级容器，单摊位模型）
        if (!db.objectStoreNames.contains('booths')) {
          db.createObjectStore('booths', { keyPath: 'id' })
        }
      }
      request.onsuccess = () => {
        const db = request.result
        // 其他标签页升级数据库版本时，浏览器会请求本连接关闭；
        // 关闭后重置缓存，下次 openDB 重新建立连接。
        db.onversionchange = () => {
          db.close()
          dbPromise = null
        }
        resolve(db)
      }
      request.onerror = () => {
        dbPromise = null
        reject(request.error)
      }
    })
  }
  return dbPromise
}

// 降级到 localStorage 当 IndexedDB 不可用（如隐私模式）
export function isIndexedDBAvailable(): boolean {
  try {
    return 'indexedDB' in window && !!window.indexedDB
  } catch {
    return false
  }
}
