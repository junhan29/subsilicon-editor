'use client'

import { ArrowLeft, Download, Focus, MessageSquare, Play, Redo2, Save, Sparkles, Undo2, Wand2, Pencil, Feather } from 'lucide-react'
import clsx from 'clsx'

interface TopToolbarProps {
  title: string
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onSave: () => void
  onPreview: () => void
  onExport: () => void
  onToggleAiPanel: () => void
  aiPanelVisible: boolean
  onToggleFocusMode?: () => void
  focusMode?: boolean
  onBack?: () => void
  /** AI 生成互动故事大纲并铺节点（Ctrl+Shift+O） */
  onAiOutline?: () => void
  /** AI 续写后续节点（Ctrl+Shift+L 已被专注模式占用，此处默认无全局快捷键，仅按钮入口） */
  onAiContinue?: () => void
  /** 润色选中节点文案 */
  onAiPolish?: () => void
  /** AI 创作是否在进行中：影响三个 AI 按钮的 aria-busy 与禁用态 */
  isAiBusy?: boolean
}

export function TopToolbar({
  title,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  onPreview,
  onExport,
  onToggleAiPanel,
  aiPanelVisible,
  onToggleFocusMode,
  focusMode,
  onBack,
  onAiOutline,
  onAiContinue,
  onAiPolish,
  isAiBusy = false,
}: TopToolbarProps) {
  const hasAiTools = Boolean(onAiOutline || onAiContinue || onAiPolish)
  const aiBusyAttr = isAiBusy ? 'true' : 'false'

  return (
    <div className="relative flex h-11 items-center bg-card/80 backdrop-blur-md px-3 gap-1 shrink-0 border-b-2 border-primary/30 shadow-[0_2px_0_hsl(var(--primary)/0.12)]">
      {/* 左上角半调网点装饰（P5 剪贴风） */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-10 halftone-bg opacity-40" aria-hidden />
      {/* 右上角红色斜切装饰（P5 风格标识） */}
      <div className="pointer-events-none absolute top-0 right-0 w-16 h-full overflow-hidden" aria-hidden>
        <div
          className="absolute top-0 right-0 w-8 h-8 -rotate-12 translate-y-[-40%] translate-x-[20%]"
          style={{
            background:
              'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--gold)) 100%)',
          }}
        />
      </div>

      {/* Back button */}
      {onBack && (
        <>
          <button
            onClick={onBack}
            className="relative z-10 flex items-center gap-1 rounded-md border border-border/50 bg-muted/40 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary hover:border-border transition-all"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline font-medium">项目</span>
          </button>
          <div className="relative z-10 mx-1 h-5 w-px bg-gradient-to-b from-transparent via-border to-transparent" />
        </>
      )}

      {/* Title — 金色斜切标签 */}
      <div className="relative z-10 flex items-center gap-2 min-w-0">
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-gradient-to-r from-gold-400 to-primary text-white text-[11px] font-bold tracking-wide"
          style={{
            clipPath:
              'polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white/90 shadow-sm" />
          <span className="truncate max-w-[180px]">{title}</span>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Undo / Redo */}
      <div className="relative z-10 flex items-center p-0.5 rounded-md border border-border/40 bg-muted/40">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="rounded-sm p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
          title="撤销 (Ctrl+Z)"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="rounded-sm p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
          title="重做 (Ctrl+Y)"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="relative z-10 mx-1 h-5 w-px bg-gradient-to-b from-transparent via-border to-transparent" />

      {/* AI Panel Toggle — 带印章感的按钮（激活时霓虹描边） */}
      <button
        onClick={onToggleAiPanel}
        className={clsx(
          'relative z-10 p-1.5 rounded-md border transition-all outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60 focus-visible:ring-offset-1',
          aiPanelVisible
            ? 'text-primary bg-primary/10 border-primary/50 shadow-[0_0_0_1px_hsl(var(--primary)/0.15),0_0_10px_hsl(var(--primary)/0.2)]'
            : 'text-muted-foreground hover:text-gold-400 hover:bg-gold-400/5 border-border/40'
        )}
        title="AI 面板 (Ctrl+K)"
        aria-label="切换 AI 创作助理面板 (Ctrl+K)"
        aria-pressed={aiPanelVisible}
      >
        <MessageSquare className="h-3.5 w-3.5" />
      </button>

      {/* ── Phase 2: AI 创作工具 gold 语义色组容器 ── */}
      {hasAiTools && (
        <div
          role="group"
          aria-label="AI 创作工具"
          className="relative z-10 hidden md:flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-gold-400/40 bg-gold-400/5 mr-1 focus-within:ring-2 focus-within:ring-gold-400/50"
        >
          <span className="hidden lg:inline-flex items-center gap-1 px-1 text-[10px] text-gold-500 font-medium whitespace-nowrap">
            <Sparkles className="w-3 h-3" aria-hidden />
            AI
          </span>
          {onAiOutline && (
            <button
              onClick={onAiOutline}
              disabled={isAiBusy}
              aria-label="AI 生成互动故事大纲并铺节点（Ctrl+Shift+O）"
              aria-busy={aiBusyAttr}
              title="AI 生成互动故事大纲并铺节点（Ctrl+Shift+O）"
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded-md bg-gold-400/10 text-gold-600 dark:text-gold-400 hover:bg-gold-400/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60"
            >
              <Wand2 className="w-3 h-3" aria-hidden />
              生成大纲
            </button>
          )}
          {onAiContinue && (
            <button
              onClick={onAiContinue}
              disabled={isAiBusy}
              aria-label="AI 续写后续节点"
              aria-busy={aiBusyAttr}
              title="AI 续写后续节点"
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded-md bg-gold-400/10 text-gold-600 dark:text-gold-400 hover:bg-gold-400/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60"
            >
              <Pencil className="w-3 h-3" aria-hidden />
              续写
            </button>
          )}
          {onAiPolish && (
            <button
              onClick={onAiPolish}
              disabled={isAiBusy}
              aria-label="润色选中节点文案"
              aria-busy={aiBusyAttr}
              title="润色选中节点文案"
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded-md bg-gold-400/10 text-gold-600 dark:text-gold-400 hover:bg-gold-400/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60"
            >
              <Feather className="w-3 h-3" aria-hidden />
              润色
            </button>
          )}
        </div>
      )}

      <div className="relative z-10 mx-1 h-5 w-px bg-gradient-to-b from-transparent via-border to-transparent" aria-hidden={!hasAiTools} />

      {/* 专注模式：小印章风 */}
      {onToggleFocusMode && (
        <button
          onClick={onToggleFocusMode}
          className={clsx(
            'relative z-10 p-1.5 rounded-md border transition-all',
            focusMode
              ? 'text-cyber-cyan-500 bg-cyber-cyan-500/10 border-cyber-cyan-500/40 shadow-[0_0_0_1px_hsl(var(--cyber-cyan-500)/0.15),0_0_10px_hsl(var(--cyber-cyan-500)/0.2)]'
              : 'text-muted-foreground hover:text-cyber-cyan-500 hover:bg-cyber-cyan-500/5 border-border/40'
          )}
          title={focusMode ? '退出专注模式 (Ctrl+Shift+L)' : '专注模式：隐藏所有面板 (Ctrl+Shift+L)'}
          aria-pressed={focusMode}
        >
          <Focus className="h-3.5 w-3.5" />
        </button>
      )}

      {/* 保存 */}
      <button
        onClick={onSave}
        className="relative z-10 p-1.5 rounded-md text-muted-foreground hover:text-gold-400 hover:bg-gold-400/10 border border-transparent hover:border-gold-400/30 transition-all"
        title="保存作品 (Ctrl+S)"
      >
        <Save className="h-3.5 w-3.5" />
      </button>

      <div className="relative z-10 mx-1 h-5 w-px bg-gradient-to-b from-transparent via-border to-transparent" />

      {/* Preview / Export — 紧凑组 */}
      <div className="relative z-10 flex items-center p-0.5 rounded-md border border-border/40 bg-muted/40">
        <button
          onClick={onPreview}
          className="rounded-sm p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          title="预览 (Ctrl+P)"
        >
          <Play className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onExport}
          className="rounded-sm p-1.5 text-muted-foreground hover:text-cyber-magenta-500 hover:bg-cyber-magenta-500/10 transition-colors"
          title="导出"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
