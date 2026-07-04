'use client'

import { useState, useRef } from 'react'
import { Label } from '@editor/components/ui/label'
import { Input } from '@editor/components/ui/input'
import { Button } from '@editor/components/ui/button'
import { Image, Loader2, AlertCircle, Upload, Check } from 'lucide-react'
import type { BasePanelProps } from './shared-props'
import { TRANSITION_TYPES } from './shared-props'

// 本地文件上传组件
function LocalFileInput({
  accept,
  maxSize,
  value,
  onChange,
  placeholder,
}: {
  accept: string
  maxSize: number
  value: string
  onChange: (base64: string) => void
  placeholder: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = async (file: File) => {
    setError(null)
    if (file.size > maxSize) {
      setError(`文件过大，最大支持 ${(maxSize / 1024 / 1024).toFixed(0)}MB`)
      return
    }
    setLoading(true)
    try {
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      onChange(base64)
      setLoading(false)
    } catch {
      setError('文件读取失败')
      setLoading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleClear = () => {
    onChange('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-1.5">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-all ${
          dragOver
            ? 'border-primary bg-primary/5'
            : value
            ? 'border-green-300 bg-green-50/30'
            : 'border-border hover:border-primary/50 hover:bg-muted/30'
        }`}
      >
        <input ref={inputRef} type="file" accept={accept} onChange={handleInputChange} className="hidden" />
        {loading ? (
          <div className="flex flex-col items-center gap-1 py-1">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
            <span className="text-[10px] text-muted-foreground">读取中...</span>
          </div>
        ) : value ? (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-green-600 flex items-center gap-1">
              <Check className="w-3 h-3" /> 已上传
            </span>
            <button onClick={(e) => { e.stopPropagation(); handleClear() }} className="text-[10px] text-red-400 hover:text-red-600">
              清除
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 py-1">
            <Upload className="w-4 h-4 text-muted-foreground/60" />
            <span className="text-[10px] text-muted-foreground">{placeholder}</span>
          </div>
        )}
      </div>
      {error && (
        <div className="flex items-center gap-1 text-[10px] text-red-500">
          <AlertCircle className="w-3 h-3" />
          {error}
        </div>
      )}
    </div>
  )
}

export function CGPanel({ node, onOpenAssets, onUpdateNode }: BasePanelProps) {
  const { data, id } = node
  const mediaType = (data as any).mediaType || 'image'

  return (
    <>
      <div className="space-y-2">
        <Label className="text-xs">媒体类型</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onUpdateNode(id, { ...data, mediaType: 'image' })}
            className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
              mediaType === 'image' ? 'bg-purple-500 text-white' : 'bg-muted hover:bg-muted/80'
            }`}
          >
            图片 CG
          </button>
          <button
            onClick={() => onUpdateNode(id, { ...data, mediaType: 'video' })}
            className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
              mediaType === 'video' ? 'bg-purple-500 text-white' : 'bg-muted hover:bg-muted/80'
            }`}
          >
            视频 CG
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">资源上传</Label>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={() => onOpenAssets?.(mediaType === 'video' ? 'audios' : 'images')}>
            <Image className="w-3 h-3 mr-1" />从素材库选择
          </Button>
        </div>
        <LocalFileInput
          accept={mediaType === 'video' ? 'video/*' : 'image/*'}
          maxSize={mediaType === 'video' ? 200 * 1024 * 1024 : 20 * 1024 * 1024}
          value={(data as any).localFile || ''}
          onChange={(base64) => onUpdateNode(id, { ...data, localFile: base64 })}
          placeholder={mediaType === 'video' ? '点击或拖拽上传视频文件 (MP4/WebM, ≤200MB)' : '点击或拖拽上传图片 (JPG/PNG/WebP, ≤20MB)'}
        />
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[10px] text-muted-foreground">或使用 URL</span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <Input
          value={(data as any).url || ''}
          onChange={(e) => onUpdateNode(id, { ...data, url: e.target.value })}
          placeholder="输入资源URL，如 https://..."
          className="text-sm"
        />
        {(data as any).localFile && mediaType === 'image' && (
          <div className="relative rounded-lg overflow-hidden border border-border">
            <img src={(data as any).localFile} alt="CG 预览" className="w-full h-32 object-cover" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-xs">CG 标题（可选）</Label>
        <Input
          value={(data as any).title || ''}
          onChange={(e) => onUpdateNode(id, { ...data, title: e.target.value })}
          placeholder="输入标题..."
          className="text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">副标题（可选）</Label>
        <Input
          value={(data as any).subtitle || ''}
          onChange={(e) => onUpdateNode(id, { ...data, subtitle: e.target.value })}
          placeholder="输入副标题..."
          className="text-sm"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">自动播放时长</Label>
          <span className="text-[10px] text-muted-foreground">
            {(data as any).duration === 0 ? '点击继续' : `${Math.round(((data as any).duration || 0) / 1000)} 秒`}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="10000"
          step="500"
          value={(data as any).duration || 0}
          onChange={(e) => onUpdateNode(id, { ...data, duration: Number(e.target.value) })}
          className="w-full accent-purple-500"
        />
        <p className="text-[10px] text-muted-foreground">设为 0 则需要玩家点击继续</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">允许跳过</Label>
          <button
            onClick={() => onUpdateNode(id, { ...data, canSkip: !(data as any).canSkip })}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              (data as any).canSkip !== false ? 'bg-purple-500' : 'bg-muted'
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                (data as any).canSkip !== false ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">电影感黑边</Label>
          <button
            onClick={() => onUpdateNode(id, { ...data, letterbox: !(data as any).letterbox })}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              (data as any).letterbox ? 'bg-purple-500' : 'bg-muted'
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                (data as any).letterbox ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-border/40">
        <Label className="text-xs">入场转场</Label>
        <select
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={(data as any).transitionIn || 'fade'}
          onChange={(e) => onUpdateNode(id, { ...data, transitionIn: e.target.value })}
        >
          {TRANSITION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">出场转场</Label>
        <select
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={(data as any).transitionOut || 'fade'}
          onChange={(e) => onUpdateNode(id, { ...data, transitionOut: e.target.value })}
        >
          {TRANSITION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">转场时长（毫秒）</Label>
        <input
          type="number"
          min="0"
          max="5000"
          step="100"
          value={(data as any).transitionDuration || 1000}
          onChange={(e) => onUpdateNode(id, { ...data, transitionDuration: Number(e.target.value) })}
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
        />
      </div>
    </>
  )
}