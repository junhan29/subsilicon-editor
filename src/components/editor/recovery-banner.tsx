'use client'

import { History } from 'lucide-react'
import { formatRecoveryTime } from '@editor/lib/auto-save'

interface RecoveryBannerProps {
  time: number
  onRestore: () => void
  onDiscard: () => void
}

/**
 * 崩溃恢复横幅（ADHD 适配）：检测到上次非正常退出留下的未保存编辑时显示，
 * 提供「恢复 / 放弃」两个明确选项，消除「怕丢进度」的焦虑。
 */
export function RecoveryBanner({ time, onRestore, onDiscard }: RecoveryBannerProps) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-1.5 border-b border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs shrink-0">
      <span className="flex items-center gap-1.5 min-w-0 truncate">
        <History className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">检测到上次未保存的编辑（{formatRecoveryTime(time)}），是否恢复？</span>
      </span>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onRestore}
          className="rounded px-2 py-0.5 text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors"
        >
          恢复
        </button>
        <button
          onClick={onDiscard}
          className="rounded px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-500/15 transition-colors"
        >
          放弃
        </button>
      </div>
    </div>
  )
}
