'use client'

import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Lock, Wallet, QrCode, MessageCircle } from 'lucide-react'
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
      className={`min-w-[200px] max-w-[280px] rounded-lg border-2 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 shadow-sm transition-all relative overflow-hidden hover:shadow-md hover:border-slate-600 ${
        selected
          ? 'border-orange-400 ring-2 ring-orange-400/50 shadow-lg shadow-orange-500/20 dark:border-orange-400'
          : 'border-orange-200 dark:border-orange-800'
      }`}
    >
      {/* 左侧橙色类型标识条 */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500 dark:bg-orange-400 z-10" />

      <Handle
        type="target"
        position={Position.Top}
        className="!w-4 !h-4 !bg-card !border-2 !border-orange-500 !-top-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-orange-500/30 dark:!bg-slate-900 dark:!border-orange-400"
      />

      <div className="pl-3.5 pr-3 pt-3 pb-3">
        {/* 顶部：锁图标 + 标题 + 价格 badge */}
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center shrink-0">
            <Lock className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
          </div>
          <p className="text-xs font-medium text-orange-800 dark:text-orange-200 truncate flex-1">
            {data.title || '付费解锁内容'}
          </p>
          {price > 0 && (
            <span className="text-xs font-bold text-orange-700 dark:text-orange-300 bg-orange-200 dark:bg-orange-900/60 px-1.5 py-0.5 rounded-md shrink-0">
              ¥{price}
            </span>
          )}
        </div>

        {/* 解锁描述 */}
        <div className="bg-white/60 dark:bg-slate-900/60 rounded-md p-2 mb-2">
          <p className="text-xs text-orange-900 dark:text-orange-100 line-clamp-2 leading-relaxed">
            {data.description || '点击编辑解锁描述...'}
          </p>
        </div>

        {/* 免费预览标签 */}
        {hasFreePreview && (
          <div className="inline-flex items-center gap-1 text-[10px] text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/50 px-1.5 py-0.5 rounded-md mb-1.5 font-medium">
            前 {freePreview} 页免费
          </div>
        )}

        {/* 付款方式指示器 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {hasQR && (
            <div className="flex items-center gap-1 text-[10px] text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/50 px-1.5 py-0.5 rounded">
              <QrCode className="w-3 h-3" />
              收款码
            </div>
          )}
          {hasContact && (
            <div className="flex items-center gap-1 text-[10px] text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/50 px-1.5 py-0.5 rounded">
              <MessageCircle className="w-3 h-3" />
              联系方式
            </div>
          )}
          {!hasQR && !hasContact && !hasPayment && (
            <div className="flex items-center gap-1 text-[10px] text-orange-400 dark:text-orange-500 bg-orange-50 dark:bg-orange-900/30 px-1.5 py-0.5 rounded">
              <Wallet className="w-3 h-3" />
              设置收款方式
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-4 !h-4 !bg-orange-500 !border-2 !border-card !-bottom-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-orange-500/30 dark:!bg-orange-400 dark:!border-slate-900"
      />
    </div>
  )
}

export const UnlockNode = memo(UnlockNodeComponent, areNodesEqual)
