import { openDB } from './local-db/db'
import type { PlatformConfig, CreatorAccount, PublishRecord } from '@editor/types/creator'

export async function savePlatformConfig(config: PlatformConfig): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('platformConfigs', 'readwrite')
    tx.objectStore('platformConfigs').put(config)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getPlatformConfig(id: string): Promise<PlatformConfig | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const request = db.transaction('platformConfigs', 'readonly')
      .objectStore('platformConfigs')
      .get(id)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

export async function getAllPlatformConfigs(): Promise<PlatformConfig[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const request = db.transaction('platformConfigs', 'readonly')
      .objectStore('platformConfigs')
      .getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

export async function deletePlatformConfig(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const request = db.transaction('platformConfigs', 'readwrite')
      .objectStore('platformConfigs')
      .delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function saveCreatorAccount(account: CreatorAccount): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('creatorAccounts', 'readwrite')
    tx.objectStore('creatorAccounts').put(account)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getCreatorAccount(email: string): Promise<CreatorAccount | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const request = db.transaction('creatorAccounts', 'readonly')
      .objectStore('creatorAccounts')
      .get(email.toLowerCase())
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

export async function getAllCreatorAccounts(): Promise<CreatorAccount[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const request = db.transaction('creatorAccounts', 'readonly')
      .objectStore('creatorAccounts')
      .getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

export async function deleteCreatorAccount(email: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const request = db.transaction('creatorAccounts', 'readwrite')
      .objectStore('creatorAccounts')
      .delete(email.toLowerCase())
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function savePublishRecord(record: PublishRecord): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('publishRecords', 'readwrite')
    tx.objectStore('publishRecords').put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getPublishRecord(id: string): Promise<PublishRecord | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const request = db.transaction('publishRecords', 'readonly')
      .objectStore('publishRecords')
      .get(id)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

export async function getPublishRecordsByWork(workId: string): Promise<PublishRecord[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const request = db.transaction('publishRecords', 'readonly')
      .objectStore('publishRecords')
      .getAll()
    request.onsuccess = () => {
      const all = request.result || []
      resolve(all.filter((r: PublishRecord) => r.workId === workId))
    }
    request.onerror = () => reject(request.error)
  })
}

export async function getAllPublishRecords(): Promise<PublishRecord[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const request = db.transaction('publishRecords', 'readonly')
      .objectStore('publishRecords')
      .getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

export async function deletePublishRecord(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const request = db.transaction('publishRecords', 'readwrite')
      .objectStore('publishRecords')
      .delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}
