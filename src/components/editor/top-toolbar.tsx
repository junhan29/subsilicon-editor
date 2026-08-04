'use client'

import { Undo2, Redo2, Play, Download, MessageSquare, ArrowLeft } from 'lucide-react'
import clsx from 'clsx'

interface TopToolbarProps {
  title: string
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onPreview: () => void
  onExport: () => void
  onToggleAiPanel: () => void
  aiPanelVisible: boolean
  onBack?: () => void
}

export function TopToolbar({
  title,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onPreview,
  onExport,
  onToggleAiPanel,
  aiPanelVisible,
  onBack,
}: TopToolbarProps) {
  return (
    <div className="flex h-10 items-center border-b border-border bg-background/80 backdrop-blur-sm px-3 gap-1 shrink-0">
      {/* Back button */}
      {onBack && (
        <>
          <button
            onClick={onBack}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">项目</span>
          </button>
          <div className="mx-1 h-4 w-px bg-border" />
        </>
      )}

      {/* Title */}
      <span className="text-xs font-medium text-foreground truncate max-w-[160px]">
        {title}
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Undo / Redo */}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/50 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
        title="撤销 (Ctrl+Z)"
      >
        <Undo2 className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/50 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
        title="重做 (Ctrl+Y)"
      >
        <Redo2 className="h-3.5 w-3.5" />
      </button>

      <div className="mx-1 h-4 w-px bg-border" />

      {/* AI Panel Toggle */}
      <button
        onClick={onToggleAiPanel}
        className={clsx(
          'rounded p-1.5 transition-colors',
          aiPanelVisible
            ? 'text-primary bg-primary/10'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
        )}
        title="AI 面板 (Ctrl+K)"
      >
        <MessageSquare className="h-3.5 w-3.5" />
      </button>

      <div className="mx-1 h-4 w-px bg-border" />

      {/* Preview / Export */}
      <button
        onClick={onPreview}
        className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        title="预览 (Ctrl+P)"
      >
        <Play className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onExport}
        className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        title="导出"
      >
        <Download className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
