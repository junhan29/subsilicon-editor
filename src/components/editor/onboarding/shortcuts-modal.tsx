'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import {
  X,
  Keyboard,
  MousePointer2,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Save,
  Eye,
  Play,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Focus,
  Undo,
  Redo,
  MessageCircle,
  GitBranch,
  Flag,
  SplitSquareVertical,
  Merge,
  Zap,
  Shuffle,
  Film,
  Lock,
  FileText,
  CheckSquare,
  CircleSlash,
  Copy,
  Clipboard,
  Layers,
  Ungroup,
  PanelLeft,
  PanelRight,
  Map as MapIcon,
  ShieldCheck,
  HelpCircle,
  Search,
  Replace,
  Download,
} from 'lucide-react'
import {
  getAllActiveBindings,
  SHORTCUT_CATEGORY_LABELS,
  SHORTCUT_CATEGORY_ORDER,
  type ActiveBinding,
} from '@editor/lib/shortcut-manager'
import { getCurrentTheme, subscribeTheme, type Theme } from '@editor/lib/theme-manager'
import { ShortcutSettings } from './shortcut-settings'
import { trapFocus, focusFirstInteractive, restoreFocus } from '@editor/lib/focus-manager'

interface ShortcutsModalProps {
  open: boolean
  onClose: () => void
  /** 当用户点击「自定义快捷键」时调用（由父组件管理设置面板状态） */
  onOpenSettings?: () => void
}

// 图标名 -> 组件映射（与 ShortcutBinding.icon 对应）
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Save,
  Download,
  Search,
  Replace,
  Keyboard,
  ZoomIn,
  ZoomOut,
  Maximize: Maximize2,
  Focus,
  Move: MousePointer2,
  Undo: Undo2Icon,
  Redo: Redo2Icon,
  MessageCircle,
  GitBranch,
  Flag,
  SplitSquareVertical,
  Merge,
  Zap,
  Shuffle,
  Film,
  Lock,
  FileText,
  Trash: Trash2,
  CheckSquare,
  CircleSlash,
  Copy,
  Clipboard,
  Layers,
  Ungroup,
  PanelLeft,
  PanelRight,
  Eye,
  Map: MapIcon,
  ShieldCheck,
  Sun,
  HelpCircle,
  Play,
}

// 兼容旧图标名
function Undo2Icon({ className }: { className?: string }) {
  return <Undo className={className} />
}
function Redo2Icon({ className }: { className?: string }) {
  return <Redo className={className} />
}

export function ShortcutsModal({ open, onClose, onOpenSettings }: ShortcutsModalProps) {
  const [bindings, setBindings] = useState<ActiveBinding[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [theme, setTheme] = useState<Theme>('dark')
  const dialogRef = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef<(() => void) | null>(null)
  const titleId = 'shortcuts-modal-title'
  const descId = 'shortcuts-modal-description'

  // 当父组件接管设置面板时，本地不再独立渲染
  const handleOpenSettings = () => {
    if (onOpenSettings) {
      onOpenSettings()
    } else {
      setShowSettings(true)
    }
  }

  useEffect(() => {
    if (open) {
      setBindings(getAllActiveBindings())
      setTheme(getCurrentTheme())
    }
  }, [open, showSettings])

  // 订阅主题变化（面板打开期间实时更新显示）
  useEffect(() => {
    if (!open) return
    const unsub = subscribeTheme((t) => setTheme(t))
    return unsub
  }, [open])

  useEffect(() => {
    if (!open) return
    if (dialogRef.current) {
      restoreFocusRef.current = restoreFocus(dialogRef.current)
      focusFirstInteractive(dialogRef.current)
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showSettings) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (restoreFocusRef.current) {
        restoreFocusRef.current()
      }
    }
  }, [open, onClose, showSettings])

  useEffect(() => {
    if (!open || !dialogRef.current || showSettings) return
    const cleanup = trapFocus(dialogRef.current)
    return cleanup
  }, [open, showSettings])

  // 按分类分组
  const grouped = useMemo(() => {
    const map = new Map<string, ActiveBinding[]>()
    for (const b of bindings) {
      const list = map.get(b.category) || []
      list.push(b)
      map.set(b.category, list)
    }
    return SHORTCUT_CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({
      category: c,
      label: SHORTCUT_CATEGORY_LABELS[c],
      items: map.get(c) || [],
    }))
  }, [bindings])

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          className="w-full max-w-md bg-background rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* 头部 */}
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Keyboard className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 id={titleId} className="font-semibold text-sm">键盘快捷键</h3>
                <p id={descId} className="text-[10px] text-muted-foreground">提升你的创作效率</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* 快捷键列表 */}
          <div className="max-h-[55vh] overflow-y-auto p-5 space-y-5">
            {grouped.map((group) => (
              <div key={group.category}>
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
                  {group.label}
                </h4>
                <div className="space-y-1.5">
                  {group.items.map((b) => {
                    const IconComp = b.icon ? ICON_MAP[b.icon] : null
                    return (
                      <div
                        key={b.id}
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {IconComp && (
                            <span className="text-muted-foreground shrink-0">
                              <IconComp className="w-3.5 h-3.5" />
                            </span>
                          )}
                          <span className="text-sm truncate">{b.action}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {b.keys.map((key, ki) => (
                            <span key={ki} className="flex items-center gap-1">
                              {ki > 0 && (
                                <span className="text-[10px] text-muted-foreground mx-0.5">+</span>
                              )}
                              <kbd className="min-w-[24px] h-6 px-1.5 inline-flex items-center justify-center text-[10px] font-mono font-medium rounded-md bg-muted border border-border">
                                {key}
                              </kbd>
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* 主题切换提示 */}
          <div className="px-5 py-2.5 border-t bg-muted/20 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              {theme === 'dark' ? (
                <Moon className="w-3.5 h-3.5" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-amber-500" />
              )}
              <span>
                当前主题：{theme === 'dark' ? '深色' : '浅色'}
                <span className="ml-1.5 text-muted-foreground/70">
                  （Ctrl+Shift+T 切换）
                </span>
              </span>
            </div>
          </div>

          {/* 底部操作 */}
          <div className="px-5 py-3 border-t bg-muted/20 flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              按 <kbd className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px] font-mono">Esc</kbd> 关闭
            </p>
            <button
              onClick={handleOpenSettings}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors"
            >
              <SettingsIcon className="w-3.5 h-3.5" />
              自定义快捷键
            </button>
          </div>
        </div>
      </div>

      {/* 自定义快捷键面板（仅在父组件未接管时本地渲染） */}
      {!onOpenSettings && (
        <ShortcutSettings
          open={showSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  )
}
