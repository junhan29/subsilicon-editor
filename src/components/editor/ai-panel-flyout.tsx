'use client'

import { Pin, X } from 'lucide-react'
import type { ReactNode } from 'react'

interface AiPanelFlyoutProps {
  open: boolean
  pinned: boolean
  onClose: () => void
  onPin: () => void
  children?: ReactNode
}

export function AiPanelFlyout({ open, pinned, onClose, onPin, children }: AiPanelFlyoutProps) {
  if (!open) return null

  return (
    <div
      className={`
        fixed z-40 flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl
        ${pinned
          ? 'inset-y-2 right-14 w-96'
          : 'bottom-20 right-6 h-[480px] w-96'
        }
      `}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold text-foreground">AI 创境</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onPin}
            className={`rounded p-1 transition-colors ${
              pinned
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title={pinned ? '取消固定' : '固定到侧边'}
          >
            <Pin className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
            title="关闭"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {children || (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            AI Chat Panel 将在后续集成
          </div>
        )}
      </div>
    </div>
  )
}
