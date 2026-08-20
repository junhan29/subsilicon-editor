'use client'

import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Lock, MessageCircle, QrCode, Wallet } from 'lucide-react'
import { areNodesEqual } from '@editor/lib/utils'

function UnlockNodeComponent({ data, selected }: any) {
  const hasPayment = data.paymentMethod || data.price || data.amount
  const hasQR = data.qrCodeUrl
  const hasContact = data.contactInfo
  const price = data.price || data.amount || 0
  const freePreview: number = Number(data.freePreview) || 0
  const hasFreePreview = freePreview > 0

  return (
    <div
      className={`min-w-[200px] max-w-[280px] rounded-[2px] border-2 bg-card px-3 py-2.5 transition-all relative
        clip-path-polygon-[0_0,calc(100%-12px)_0,100%_12px,100%_100%,0_100%]
        hover:border-border
        ${selected
          ? 'border-gold-400 shadow-[6px_6px_0_hsl(var(--gold)/0.28)]'
          : 'border-border shadow-[4px_4px_0_hsl(var(--gold)/0.18)]'
        }`}
    >
      {/* 挂锁印章装饰 - 左上旋转印章 */}
      <div className="absolute -top-2 -left-2 w-9 h-9 rounded-[1px] bg-p5-red rotate-[-10deg] flex items-center justify-center shadow-[2px_2px_0_hsl(var(--p5-red)/0.35)] z-10 border-2 border-gold-400">
        <Lock className="w-4 h-4 text-gold-400" strokeWidth={2.6} />
      </div>
      <div className="absolute top-0.5 right-2 w-1 h-1 rounded-full bg-gold-500/50" />
      <div className="absolute top-2 right-3.5 w-1 h-1 rounded-full bg-p5-red/40" />

      <Handle
        type="target"
        position={Position.Top}
        className="!w-4 !h-4 !rounded-full !z-20 !bg-card !border-2 !border-gold-400 !-top-2 !transition-all hover:!scale-125"
      />

      <div className="pl-7 pr-0 pt-0.5">
        {/* 顶部：标题 + 价格 badge */}
        <div className="flex items-center gap-1.5 mb-2">
          <p className="text-xs font-bold text-foreground truncate flex-1 tracking-wide">
            {data.title || '付费解锁内容'}
          </p>
          {price > 0 && (
            <span className="text-[11px] font-black text-p5-red bg-gold-400/25 px-1.5 py-0.5 rounded-[2px] shrink-0 border border-gold-400/40 shadow-[1px_1px_0_hsl(var(--gold)/0.2)]">
              ¥{price}
            </span>
          )}
        </div>

        {/* 解锁描述 */}
        <div className="bg-muted/50 rounded-[2px] p-2 mb-2 border border-border shadow-[2px_2px_0_hsl(var(--gold)/0.08)]">
          <p className="text-xs text-foreground/80 line-clamp-2 leading-relaxed">
            {data.description || '点击编辑解锁描述...'}
          </p>
        </div>

        {/* 免费预览标签 */}
        {hasFreePreview && (
          <div className="inline-flex items-center gap-1 text-[10px] font-bold text-p5-red bg-p5-red/10 px-1.5 py-0.5 rounded-[2px] mb-1.5 border border-p5-red/25 tracking-wide">
            前 {freePreview} 页免费
          </div>
        )}

        {/* 付款方式指示器 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {hasQR && (
            <div className="flex items-center gap-1 text-[10px] font-medium text-gold-600 dark:text-gold-500 bg-gold-400/15 px-1.5 py-0.5 rounded-[2px] border border-gold-400/25">
              <QrCode className="w-3 h-3" />
              收款码
            </div>
          )}
          {hasContact && (
            <div className="flex items-center gap-1 text-[10px] font-medium text-cyber-cyan-500 bg-cyber-cyan-400/12 px-1.5 py-0.5 rounded-[2px] border border-cyber-cyan-400/25">
              <MessageCircle className="w-3 h-3" />
              联系方式
            </div>
          )}
          {!hasQR && !hasContact && !hasPayment && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-[2px] border border-dashed border-border">
              <Wallet className="w-3 h-3" />
              设置收款方式
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-4 !h-4 !rounded-full !z-20 !bg-gold-500 !border-2 !border-card !-bottom-2 !transition-all hover:!scale-125"
      />
    </div>
  )
}

export const UnlockNode = memo(UnlockNodeComponent, areNodesEqual)
