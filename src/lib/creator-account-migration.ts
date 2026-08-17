/**
 * 创作者账号双轨统一迁移
 *
 * 背景：历史上存在两套账户体系——本地创作者身份（accounts 表，local-account-store）
 * 与创作者中心账号（creatorAccounts 表，creator-service）。spec 要求以本地账户为唯一
 * 创作者身份，废弃 creatorAccounts 承载登录身份，平台密码配置改挂到本地账户。
 *
 * 本模块把旧 creatorAccounts 记录一次性迁移到 accounts 表：
 * - 同 email 已存在本地账号 → 不重复创建，仅把平台配置/发布记录归属补挂到该账号；
 * - 否则用旧记录的原密码哈希（格式不变，不重哈希、不解密）创建本地账号副本并挂载。
 *
 * 幂等：以 localStorage 标记 subsilicon_creator_account_migrated 保证只执行一次；
 * 迁移后保留旧 creatorAccounts 原始数据（避免误删用户数据），仅做归属补挂。
 *
 * 注意：旧 platformConfigs / publishRecords 没有归属字段，无法区分多账号间的归属；
 * 迁移按 creatorAccounts 遍历顺序，把无归属数据挂到首个被迁移的账号名下
 * （单账号场景下语义完全正确，多账号属于旧数据边界情况）。
 */
import { openDB } from './local-db/db'
import { generateId } from './utils'
import type { LocalAccount } from './local-account-store'
import type { CreatorAccount, PlatformConfig, PublishRecord } from '@editor/types/creator'

const MIGRATION_FLAG_KEY = 'subsilicon_creator_account_migrated'

/** 读取表中全部记录 */
function getAllFromStore<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll()
    request.onsuccess = () => resolve((request.result || []) as T[])
    request.onerror = () => reject(request.error)
  })
}

/** 按主键读取单条记录 */
function getFromStore<T>(db: IDBDatabase, storeName: string, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).get(key)
    request.onsuccess = () => resolve(request.result as T | undefined)
    request.onerror = () => reject(request.error)
  })
}

/** 写入单条记录 */
function putToStore(db: IDBDatabase, storeName: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    tx.objectStore(storeName).put(value)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * 把「尚无归属」的平台配置与发布记录补挂到指定本地账号邮箱下
 * （旧数据无归属信息，仅对 ownerEmail/creatorEmail 缺失的记录做归属，不覆盖已有归属）
 */
async function attachOrphanData(db: IDBDatabase, email: string): Promise<void> {
  const configs = await getAllFromStore<PlatformConfig>(db, 'platformConfigs')
  for (const config of configs) {
    if (!config.ownerEmail) {
      await putToStore(db, 'platformConfigs', { ...config, ownerEmail: email })
    }
  }
  const records = await getAllFromStore<PublishRecord>(db, 'publishRecords')
  for (const record of records) {
    if (!record.creatorEmail) {
      await putToStore(db, 'publishRecords', { ...record, creatorEmail: email })
    }
  }
}

/**
 * 迁移旧创作者账号到本地账户（幂等，只执行一次）
 *
 * @returns { migrated } 本次实际新建的本地账号数量
 */
export async function migrateLegacyCreatorAccounts(): Promise<{ migrated: number }> {
  // 幂等标记：已迁移过则直接返回
  if (typeof window !== 'undefined') {
    try {
      if (localStorage.getItem(MIGRATION_FLAG_KEY) === 'true') {
        return { migrated: 0 }
      }
    } catch {
      // localStorage 不可用（隐私模式等）时继续执行迁移，函数本身可重复运行
    }
  }

  const db = await openDB()
  const legacyAccounts = await getAllFromStore<CreatorAccount>(db, 'creatorAccounts')
  if (legacyAccounts.length === 0) {
    // 无旧数据也标记已迁移，避免每次启动重复扫描
    markMigrated()
    return { migrated: 0 }
  }

  let migrated = 0
  for (const legacy of legacyAccounts) {
    const email = (legacy.email || '').trim().toLowerCase()
    if (!email) continue

    const existing = await getFromStore<LocalAccount>(db, 'accounts', email)
    if (existing) {
      // 本地账号已存在：跳过重复创建，仅补挂平台配置/发布记录归属
      await attachOrphanData(db, email)
      continue
    }

    const now = Date.now()
    const account: LocalAccount = {
      id: generateId('acc'),
      email,
      displayName: legacy.displayName || email,
      // 原密码哈希原样复制：保持哈希格式不变，不重哈希、不明文化
      passwordHash: legacy.passwordHash || '',
      bio: legacy.bio || '',
      createdAt: legacy.createdAt || now,
      nameChangeCount: legacy.nameChangeCount || 0,
      nameLastChangedAt: legacy.nameLastChangedAt || legacy.createdAt || now,
    }
    await putToStore(db, 'accounts', account)
    migrated++
    await attachOrphanData(db, email)
  }

  markMigrated()
  return { migrated }
}

/** 标记迁移完成（localStorage 不可用时静默忽略） */
function markMigrated(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(MIGRATION_FLAG_KEY, 'true')
    } catch {
      // ignore
    }
  }
}
