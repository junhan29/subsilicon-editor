'use client'

import { useState, useRef } from 'react'
import { Label } from '@editor/components/ui/label'
import { Input } from '@editor/components/ui/input'
import { Textarea } from '@editor/components/ui/textarea'
import { Button } from '@editor/components/ui/button'
import { Loader2, AlertCircle, Upload, Check } from 'lucide-react'
import type { BasePanelProps } from './shared-props'

// 本地文件上传组件（从 property-panel.tsx 移动过来）
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
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          className="hidden"
        />
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
            <button
              onClick={(e) => { e.stopPropagation(); handleClear() }}
              className="text-[10px] text-red-400 hover:text-red-600"
            >
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

export function UnlockPanel({ node, onUpdateNode }: BasePanelProps) {
  const { data, id } = node

  return (
    <>
      <div className="space-y-2">
        <Label className="text-xs">解锁标题</Label>
        <Input
          value={(data as any).title || (data as any).nodeTitle || ''}
          onChange={(e) => onUpdateNode(id, { ...data, title: e.target.value })}
          placeholder="解锁内容"
          className="text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">解锁价格（元）</Label>
        <Input
          type="number"
          value={(data as any).price || (data as any).amount || 1}
          onChange={(e) => onUpdateNode(id, { ...data, price: Number(e.target.value) })}
          className="text-sm"
          min={1}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">解锁描述</Label>
        <Textarea
          value={(data as any).description || ''}
          onChange={(e) => onUpdateNode(id, { ...data, description: e.target.value })}
          placeholder="描述解锁后可获得的内容..."
          className="min-h-[60px] resize-none text-sm"
        />
      </div>

      {/* 付款方式 */}
      <div className="flex items-center gap-2 pt-1">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[10px] text-muted-foreground">读者付款方式</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">收款方式</Label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'wechat_qr', label: '微信收款码', icon: '💬' },
            { id: 'alipay_qr', label: '支付宝收款码', icon: '📱' },
            { id: 'wechat_contact', label: '微信联系', icon: '👤' },
            { id: 'other_contact', label: '其他方式', icon: '📧' },
          ].map((method) => {
            const isActive = (data as any).paymentMethod === method.id
            return (
              <button
                key={method.id}
                onClick={() => onUpdateNode(id, { ...data, paymentMethod: isActive ? '' : method.id })}
                className={`py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                  isActive ? 'bg-amber-500 text-white' : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {method.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 收款码上传 */}
      {(data as any).paymentMethod === 'wechat_qr' || (data as any).paymentMethod === 'alipay_qr' ? (
        <div className="space-y-2">
          <Label className="text-xs">
            {(data as any).paymentMethod === 'wechat_qr' ? '微信收款码' : '支付宝收款码'}
          </Label>
          <LocalFileInput
            accept="image/*"
            maxSize={10 * 1024 * 1024}
            value={(data as any).qrCodeUrl || ''}
            onChange={(base64) => onUpdateNode(id, { ...data, qrCodeUrl: base64 })}
            placeholder="上传收款码图片"
          />
          {(data as any).qrCodeUrl && (
            <div className="relative rounded-lg overflow-hidden border border-border w-32 h-32 mx-auto">
              <img
                src={(data as any).qrCodeUrl}
                alt="收款码"
                className="w-full h-full object-contain"
              />
            </div>
          )}
        </div>
      ) : null}

      {/* 联系方式 */}
      {(data as any).paymentMethod === 'wechat_contact' || (data as any).paymentMethod === 'other_contact' ? (
        <div className="space-y-2">
          <Label className="text-xs">
            {(data as any).paymentMethod === 'wechat_contact' ? '微信号' : '联系方式'}
          </Label>
          <Input
            value={(data as any).contactInfo || ''}
            onChange={(e) => onUpdateNode(id, { ...data, contactInfo: e.target.value })}
            placeholder={
              (data as any).paymentMethod === 'wechat_contact'
                ? '输入微信号或手机号'
                : '输入联系方式（如邮箱、QQ等）'
            }
            className="text-sm"
          />
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground">联系说明（可选）</Label>
            <Input
              value={(data as any).contactMessage || ''}
              onChange={(e) => onUpdateNode(id, { ...data, contactMessage: e.target.value })}
              placeholder={'如：添加时请备注"作品名+解锁"'}
              className="text-sm"
            />
          </div>
        </div>
      ) : null}

      <p className="text-[10px] text-amber-600 bg-amber-50 rounded-lg px-2.5 py-2">
        提示：读者将通过上述方式联系创作者完成付费解锁，平台不参与交易。
      </p>
    </>
  )
}