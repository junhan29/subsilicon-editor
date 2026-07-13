'use client'

import { useState, useRef } from 'react'
import { Loader2, AlertCircle, Upload, Check } from 'lucide-react'

export function LocalFileInput({
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
