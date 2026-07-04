import { openDB } from './db'

export interface AssetMetadata {
  name: string
  type: string     // 'image/png' | 'audio/mp3' | 'video/mp4'
  size: number
}

export interface StoredAsset extends AssetMetadata {
  hash: string
  blob: Blob
  createdAt: number
}

export async function saveAsset(blob: Blob, hash: string, metadata: AssetMetadata): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('assets', 'readwrite')
    tx.objectStore('assets').put({
      hash,
      blob,
      name: metadata.name,
      type: metadata.type,
      size: metadata.size,
      createdAt: Date.now(),
    })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getAsset(hash: string): Promise<StoredAsset | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const request = db.transaction('assets', 'readonly')
      .objectStore('assets')
      .get(hash)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

export async function getAssetURL(hash: string): Promise<string | null> {
  const asset = await getAsset(hash)
  if (!asset) return null
  return URL.createObjectURL(asset.blob)
}

export async function deleteAsset(hash: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const request = db.transaction('assets', 'readwrite')
      .objectStore('assets')
      .delete(hash)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function getAllAssets(): Promise<StoredAsset[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const request = db.transaction('assets', 'readonly')
      .objectStore('assets')
      .getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

// 计算总存储用量
export async function getTotalAssetSize(): Promise<number> {
  const assets = await getAllAssets()
  return assets.reduce((sum, asset) => sum + asset.size, 0)
}
