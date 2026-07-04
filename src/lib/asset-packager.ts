import JSZip from 'jszip'
import { getAllAssets, saveAsset, getAsset, type StoredAsset } from './local-db'

export interface AssetManifest {
  version: 1
  createdAt: number
  totalAssets: number
  totalSize: number
  assets: Array<{
    hash: string
    name: string
    type: string
    size: number
    createdAt: number
  }>
}

export interface ImportResult {
  imported: number
  skipped: number
  total: number
}

export interface ExportProgress {
  current: number
  total: number
  assetName: string
}

export interface ImportProgress {
  current: number
  total: number
  assetName: string
}

const MANIFEST_FILE = 'manifest.json'
const ASSETS_DIR = 'assets/'
const SUPPORTED_VERSION = 1

export async function exportAssetPack(
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  const assets = await getAllAssets()
  const zip = new JSZip()
  const totalSize = assets.reduce((sum, a) => sum + a.size, 0)

  const manifest: AssetManifest = {
    version: 1,
    createdAt: Date.now(),
    totalAssets: assets.length,
    totalSize,
    assets: assets.map((a) => ({
      hash: a.hash,
      name: a.name,
      type: a.type,
      size: a.size,
      createdAt: a.createdAt,
    })),
  }

  zip.file(MANIFEST_FILE, JSON.stringify(manifest, null, 2))

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i]
    const ext = getExtensionFromType(asset.type)
    zip.file(`${ASSETS_DIR}${asset.hash}.${ext}`, asset.blob)

    if (onProgress) {
      onProgress({
        current: i + 1,
        total: assets.length,
        assetName: asset.name,
      })
    }

    if (i % 10 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  return await zip.generateAsync({ type: 'blob' })
}

export async function importAssetPack(
  file: Blob,
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportResult> {
  const zip = new JSZip()
  let loadedZip: JSZip

  try {
    loadedZip = await zip.loadAsync(file)
  } catch {
    throw new Error('无法解压文件，文件可能已损坏')
  }

  const manifestFile = loadedZip.file(MANIFEST_FILE)
  if (!manifestFile) {
    throw new Error('素材包缺少 manifest.json，格式不正确')
  }

  let manifest: AssetManifest
  try {
    manifest = JSON.parse(await manifestFile.async('string'))
  } catch {
    throw new Error('manifest.json 解析失败，文件可能已损坏')
  }

  if (manifest.version !== SUPPORTED_VERSION) {
    throw new Error(`不支持的素材包版本: ${manifest.version}，当前支持版本: ${SUPPORTED_VERSION}`)
  }

  if (!Array.isArray(manifest.assets)) {
    throw new Error('manifest.json 格式错误：assets 字段不是数组')
  }

  const result: ImportResult = {
    imported: 0,
    skipped: 0,
    total: manifest.assets.length,
  }

  for (let i = 0; i < manifest.assets.length; i++) {
    const assetInfo = manifest.assets[i]
    const ext = getExtensionFromType(assetInfo.type)
    const filePath = `${ASSETS_DIR}${assetInfo.hash}.${ext}`
    const zipFile = loadedZip.file(filePath)

    if (onProgress) {
      onProgress({
        current: i + 1,
        total: manifest.assets.length,
        assetName: assetInfo.name,
      })
    }

    if (!zipFile) {
      result.skipped++
      continue
    }

    const existing = await getAsset(assetInfo.hash)
    if (existing) {
      result.skipped++
      continue
    }

    try {
      const blob = await zipFile.async('blob')
      const typedBlob = new Blob([blob], { type: assetInfo.type })

      await saveAsset(typedBlob, assetInfo.hash, {
        name: assetInfo.name,
        type: assetInfo.type,
        size: assetInfo.size,
      })

      result.imported++
    } catch {
      result.skipped++
    }

    if (i % 10 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  return result
}

function getExtensionFromType(mimeType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/webm': 'webm',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
  }
  return map[mimeType] || 'bin'
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`
}

export function generateThumbnail(
  blob: Blob,
  maxWidth = 200,
  maxHeight = 200
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!blob.type.startsWith('image/')) {
      reject(new Error('Only images can generate thumbnails'))
      return
    }

    const url = URL.createObjectURL(blob)
    const img = new Image()

    img.onload = () => {
      const canvas = document.createElement('canvas')
      let { width, height } = img

      if (width > maxWidth) {
        height = (maxWidth / width) * height
        width = maxWidth
      }
      if (height > maxHeight) {
        width = (maxHeight / height) * width
        height = maxHeight
      }

      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('Canvas context not available'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)

      try {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        resolve(dataUrl)
      } catch (e) {
        reject(e)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}
