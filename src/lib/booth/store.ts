/**
 * 摊位存储（IndexedDB booths 表）
 *
 * 单摊位模型：一个创作者一个摊位（主摊位 id 固定），
 * 读取时若无摊位则按需创建空摊位（幂等），保证 UI 永远有容器可编辑。
 */

import { openDB } from '@editor/lib/local-db/db'
import { type Booth, createEmptyBooth, PRIMARY_BOOTH_ID } from './types'

/** 保存摊位（自动更新 updatedAt） */
export async function saveBooth(booth: Booth): Promise<void> {
  const db = await openDB()
  const toSave: Booth = {
    ...booth,
    id: PRIMARY_BOOTH_ID,
    updatedAt: Date.now(),
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction('booths', 'readwrite')
    tx.objectStore('booths').put(toSave)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** 读取主摊位；不存在时返回 null */
export async function loadBooth(): Promise<Booth | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const request = db
      .transaction('booths', 'readonly')
      .objectStore('booths')
      .get(PRIMARY_BOOTH_ID)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

/** 读取主摊位；不存在时创建空摊位并落库（幂等） */
export async function ensureBooth(name?: string): Promise<Booth> {
  const existing = await loadBooth()
  if (existing) return existing
  const booth = createEmptyBooth(name)
  await saveBooth(booth)
  return booth
}

/** 删除主摊位 */
export async function deleteBooth(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const request = db
      .transaction('booths', 'readwrite')
      .objectStore('booths')
      .delete(PRIMARY_BOOTH_ID)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}
