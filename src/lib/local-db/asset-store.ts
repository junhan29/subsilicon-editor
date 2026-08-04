import { openDB } from './db'

export interface AssetMetadata {
  name: string
  type: string     // 'image/png' | 'audio/mp3' | 'video/mp4'
  size: number
}

/** 素材标注 —— 用户为素材打上的语义标签，供 AI 调度时匹配 */
export interface AssetAnnotation {
  /** 关联角色 ID（素材属于哪个角色的立绘/表情） */
  characterId?: string
  /** 情绪/表情标签：happy / sad / angry / surprised / normal 等 */
  emotion?: string
  /** 场景标签：教室 / 森林 / 夜晚街道 等 */
  sceneTag?: string
  /** 用途分类：character_sprite / background / cg / video / audio_bgm / audio_se */
  usageType?: string
  /** 自由描述：用户用自然语言描述这个素材的内容 */
  description?: string
  /** 自定义标签 */
  tags?: string[]
}

export interface StoredAsset extends AssetMetadata {
  hash: string
  blob: Blob
  createdAt: number
  /** 素材标注（可选，用户手动编辑） */
  annotation?: AssetAnnotation
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

/** 计算 Blob 的 SHA-256 hash（hex） */
async function computeBlobHash(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * 将 Blob 入库为素材：自动计算 SHA-256 hash，已存在则跳过。
 * 返回素材 hash（可用于后续标注 / 绑定）。
 */
export async function saveBlobAsAsset(blob: Blob, name: string): Promise<string> {
  const hash = await computeBlobHash(blob)
  const existing = await getAsset(hash)
  if (!existing) {
    await saveAsset(blob, hash, {
      name,
      type: blob.type || 'application/octet-stream',
      size: blob.size,
    })
  }
  return hash
}

/** 更新素材标注（只更新 annotation 字段，不动 blob） */
export async function updateAssetAnnotation(hash: string, annotation: AssetAnnotation): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('assets', 'readwrite')
    const store = tx.objectStore('assets')
    const req = store.get(hash)
    req.onsuccess = () => {
      const asset = req.result as StoredAsset | null
      if (!asset) {
        reject(new Error(`Asset not found: ${hash}`))
        return
      }
      asset.annotation = annotation
      store.put(asset)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** 按标注条件筛选素材（供 AI 调度时使用） */
export async function findAssetsByAnnotation(query: Partial<AssetAnnotation>): Promise<StoredAsset[]> {
  const all = await getAllAssets()
  return all.filter((a) => {
    if (!a.annotation) return false
    for (const [key, val] of Object.entries(query)) {
      if (val == null || val === '') continue
      const av = (a.annotation as Record<string, unknown>)[key]
      if (av !== val) return false
    }
    return true
  })
}
