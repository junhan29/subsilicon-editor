'use client'

import { useCallback, useRef, useState } from 'react'
import { Image, Link2, Loader2, Upload, Video } from 'lucide-react'
import { showToast } from './toast'

interface EnhancedAssetImportProps {
  onImageGenerated?: (url: string, name: string) => void
}

export function EnhancedAssetImport({ onImageGenerated }: EnhancedAssetImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [importing, setImporting] = useState(false)

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    if (fileArray.length === 0) return

    setImporting(true)
    try {
      for (const file of fileArray) {
        if (file.size > 20 * 1024 * 1024) {
          showToast('error', `${file.name} 超过 20MB，已跳过`)
          continue
        }
        const base64 = await fileToBase64(file)
        const name = file.name.replace(/\.[^.]+$/, '')
        onImageGenerated?.(base64, name)
      }
      showToast('success', `已导入 ${fileArray.length} 个素材`)
    } catch {
      showToast('error', '导入失败')
    } finally {
      setImporting(false)
    }
  }, [onImageGenerated])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }, [handleFiles])

  const handleUrlImport = useCallback(async () => {
    const url = urlInput.trim()
    if (!url) return

    setImporting(true)
    try {
      const name = url.split('/').pop()?.split('?')[0]?.replace(/\.[^.]+$/, '') || '导入素材'
      onImageGenerated?.(url, name)
      setUrlInput('')
      showToast('success', '已添加到场景库')
    } catch {
      showToast('error', 'URL 导入失败')
    } finally {
      setImporting(false)
    }
  }, [urlInput, onImageGenerated])

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    const imageItems = Array.from(items).filter(item => item.type.startsWith('image/'))
    if (imageItems.length > 0) {
      e.preventDefault()
      const files = imageItems.map(item => item.getAsFile()).filter(Boolean) as File[]
      if (files.length > 0) {
        handleFiles(files)
      }
    }
  }, [handleFiles])

  return (
    <div
      className="space-y-3"
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onPaste={handlePaste}
    >
      <div className="flex items-center gap-2">
        <Image className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-medium text-foreground">素材导入</h3>
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer relative ${
          dragging
            ? 'border-primary bg-primary/10'
            : 'border-border hover:border-primary/50'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
        {importing ? (
          <Loader2 className="w-6 h-6 text-primary mx-auto mb-1 animate-spin" />
        ) : (
          <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
        )}
        <p className="text-xs text-muted-foreground">拖拽 / 点击 / 粘贴导入素材</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">JPG / PNG / WebP / MP4，支持批量</p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Link2 className="w-3 h-3 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">从 URL 导入</span>
        </div>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleUrlImport() }}
            placeholder="粘贴图片或视频 URL..."
            className="flex-1 h-8 text-xs rounded-[2px] border border-border bg-secondary px-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold-400/50 focus:border-gold-400/60"
          />
          <button
            onClick={handleUrlImport}
            disabled={!urlInput.trim() || importing}
            className="px-3 py-1.5 text-[11px] bg-gold-400/15 text-gold-500 border border-gold-400/40 hover:bg-gold-400/25 rounded-[2px] transition-colors disabled:opacity-50"
          >
            添加
          </button>
        </div>
      </div>

      <div className="p-2 rounded-[2px] border border-border/50 bg-muted/20">
        <div className="flex items-start gap-1.5">
          <Video className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            推荐使用 Midjourney、ComfyUI、Runway 等专业工具生成素材后导入
          </p>
        </div>
      </div>
    </div>
  )
}
