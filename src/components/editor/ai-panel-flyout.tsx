'use client'

import { Pin, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useAssistantName } from '@editor/lib/assistant-name'

interface AiPanelFlyoutProps {
  open: boolean
  pinned: boolean
  onClose: () => void
  onPin: () => void
  children?: ReactNode
}

export function AiPanelFlyout({ open, pinned, onClose, onPin, children }: AiPanelFlyoutProps) {
  const assistantName = useAssistantName()
  if (!open) return null

  return (
    <div
      className={`
        fixed z-50 flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl
        transition-all duration-300 ease-out
        ${pinned
          ? 'inset-y-2 left-2 right-[314px] min-w-[320px] max-w-[640px]'
          : 'bottom-16 right-6 w-[384px] max-w-[90vw] max-h-[calc(100vh-5rem)] min-h-[400px]'
        }
      `}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2 shrink-0">
        <span className="text-xs font-semibold text-foreground">AI {assistantName}</span>
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
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {children || (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            AI Chat Panel 将在后续集成
          </div>
        )}
      </div>
    </div>
  )
}
