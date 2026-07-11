// 生成缩略图
export async function generateThumbnail(
  file: File,
  maxWidth: number = 200
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ratio = maxWidth / img.width
      canvas.width = maxWidth
      canvas.height = img.height * ratio
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('无法创建 Canvas 上下文'))
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(blob => {
        if (blob) resolve(blob)
        else reject(new Error('缩略图生成失败'))
      }, 'image/webp', 0.8)
    }
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = URL.createObjectURL(file)
  })
}

// 将 Blob 转为 data URL
function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

// 压缩图片为 WebP
async function compressToWebP(blob: Blob, quality: number = 0.6): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('无法创建 Canvas 上下文'))
        return
      }
      ctx.drawImage(img, 0, 0)
      canvas.toBlob(
        (compressed) => {
          if (compressed) resolve(compressed)
          else reject(new Error('压缩失败'))
        },
        'image/webp',
        quality
      )
    }
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = URL.createObjectURL(blob)
  })
}

// 优化图片用于内联嵌入
export async function optimizeImageForEmbed(
  blob: Blob,
  maxSizeKB: number = 500
): Promise<{ dataUrl: string; exceeded: boolean }> {
  if (blob.size < maxSizeKB * 1024) {
    const dataUrl = await blobToDataURL(blob)
    return { dataUrl, exceeded: false }
  }
  // 压缩为 WebP
  const compressed = await compressToWebP(blob, 0.6)
  const dataUrl = await blobToDataURL(compressed)
  return { dataUrl, exceeded: true }
}

// 生成视频缩略图（第一帧）
export async function generateVideoThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    video.onloadeddata = () => {
      video.currentTime = 1
    }

    video.onseeked = () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('无法创建 Canvas 上下文'))
        return
      }
      ctx.drawImage(video, 0, 0)
      const dataUrl = canvas.toDataURL('image/webp', 0.7)
      URL.revokeObjectURL(video.src)
      resolve(dataUrl)
    }

    video.onerror = () => {
      URL.revokeObjectURL(video.src)
      reject(new Error('视频加载失败'))
    }

    video.src = URL.createObjectURL(file)
  })
}

// 获取文件扩展名
function getExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || ''
}

// 简单的文件哈希（用于去重）
export function generateHash(file: File): string {
  const str = `${file.name}-${file.size}-${file.lastModified}`
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16)
}

// 视频导入处理
export async function handleVideoImport(file: File): Promise<{
  type: 'stored' | 'referenced'
  thumbnail: string
  name: string
  path?: string
}> {
  const maxVideoSize = 50 * 1024 * 1024 // 50MB

  if (file.size < maxVideoSize) {
    const thumb = await generateVideoThumbnail(file)
    return { type: 'stored', thumbnail: thumb, name: file.name }
  }

  // 桌面版——引用文件路径
  if ((window as any).__electronAPI) {
    return {
      type: 'referenced',
      thumbnail: await generateVideoThumbnail(file),
      name: file.name,
      path: (file as any).path,
    }
  }

  throw new Error('文件过大，请下载桌面版编辑器后导入')
}

// 检测文件类型
export function detectMediaType(file: File): 'image' | 'video' | 'audio' | 'unknown' {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  return 'unknown'
}

// 验证文件大小
export function validateFileSize(file: File, type: 'image' | 'video' | 'audio'): { valid: boolean; message?: string } {
  const limits: Record<string, number> = {
    image: 20 * 1024 * 1024,   // 20MB
    video: 200 * 1024 * 1024,  // 200MB
    audio: 20 * 1024 * 1024,   // 20MB
  }
  const limit = limits[type] || 10 * 1024 * 1024
  if (file.size > limit) {
    return {
      valid: false,
      message: `文件大小 ${(file.size / 1024 / 1024).toFixed(1)}MB 超过 ${type === 'image' ? '20MB' : type === 'video' ? '200MB' : '20MB'} 限制`,
    }
  }
  return { valid: true }
}