'use client'

import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { X, Search, RotateCcw, AlertTriangle, Check, Pencil } from 'lucide-react'
import {
  getAllActiveBindings,
  loadCustomBindings,
  saveCustomBindings,
  resetBindings,
  detectConflicts,
  eventToKeys,
  formatKeys,
  SHORTCUT_CATEGORY_LABELS,
  SHORTCUT_CATEGORY_ORDER,
  type ActiveBinding,
} from '@editor/lib/shortcut-manager'
import { trapFocus, focusFirstInteractive, restoreFocus } from '@editor/lib/focus-manager'

interface ShortcutSettingsProps {
  open: boolean
  onClose: () => void
}

export function ShortcutSettings({ open, onClose }: ShortcutSettingsProps) {
  const [bindings, setBindings] = useState<ActiveBinding[]>([])
  const [customIds, setCustomIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [conflictMap, setConflictMap] = useState<Record<string, string[]>>({})
  const dialogRef = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef<(() => void) | null>(null)
  const titleId = 'shortcut-settings-title'
  const descId = 'shortcut-settings-description'

  const refresh = useCallback(() => {
    setBindings(getAllActiveBindings())
    setCustomIds(new Set(Object.keys(loadCustomBindings())))
  }, [])

  useEffect(() => {
    if (open) refresh()
  }, [open, refresh])

  // 重新计算冲突
  useEffect(() => {
    const map: Record<string, string[]> = {}
    for (const b of bindings) {
      const c = detectConflicts(b.id, b.keys)
      if (c.length > 0) map[b.id] = c
    }
    setConflictMap(map)
  }, [bindings])

  // 录制模式：监听按键
  useEffect(() => {
    if (!recordingId) return
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      // Esc 取消录制
      if (e.key === 'Escape') {
        setRecordingId(null)
        return
      }
      const keys = eventToKeys(e)
      if (keys.length === 0) return
      // 仅修饰键（Ctrl/Shift/Alt）不保存，继续录制等待主键
      const lastKey = keys[keys.length - 1]
      if (lastKey === 'Ctrl' || lastKey === 'Shift' || lastKey === 'Alt') {
        return
      }

      // 保存
      const custom = loadCustomBindings()
      custom[recordingId] = keys
      saveCustomBindings(custom)
      setBindings(getAllActiveBindings())
      setCustomIds(new Set(Object.keys(custom)))
      setRecordingId(null)
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [recordingId])

  // Esc 关闭面板 + 焦点管理
  useEffect(() => {
    if (!open) return
    if (dialogRef.current) {
      restoreFocusRef.current = restoreFocus(dialogRef.current)
      focusFirstInteractive(dialogRef.current)
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !recordingId) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (restoreFocusRef.current) {
        restoreFocusRef.current()
      }
    }
  }, [open, onClose, recordingId])

  useEffect(() => {
    if (!open || !dialogRef.current || recordingId) return
    const cleanup = trapFocus(dialogRef.current)
    return cleanup
  }, [open, recordingId])

  const handleResetAll = useCallback(() => {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-alert
      if (!window.confirm('确定要将所有快捷键重置为默认值吗？')) return
    }
    resetBindings()
    refresh()
  }, [refresh])

  const handleResetOne = useCallback((id: string) => {
    const custom = loadCustomBindings()
    delete custom[id]
    saveCustomBindings(custom)
    refresh()
  }, [refresh])

  const filteredBindings = useMemo(() => {
    if (!search.trim()) return bindings
    const q = search.trim().toLowerCase()
    return bindings.filter(
      (b) =>
        b.action.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q) ||
        formatKeys(b.keys).toLowerCase().includes(q)
    )
  }, [bindings, search])

  // 按分类分组
  const grouped = useMemo(() => {
    const map = new Map<string, ActiveBinding[]>()
    for (const b of filteredBindings) {
      const list = map.get(b.category) || []
      list.push(b)
      map.set(b.category, list)
    }
    return SHORTCUT_CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({
      category: c,
      label: SHORTCUT_CATEGORY_LABELS[c],
      items: map.get(c) || [],
    }))
  }, [filteredBindings])

  // 通过 id 查找 action 名（用于显示冲突提示）
  const actionLabel = useCallback(
    (id: string): string => {
      const b = bindings.find((x) => x.id === id)
      return b ? b.action : id
    },
    [bindings]
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-2xl bg-background rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Pencil className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 id={titleId} className="font-semibold text-sm">自定义快捷键</h3>
              <p id={descId} className="text-[10px] text-muted-foreground">点击「修改」录制新的按键组合</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* 搜索框 */}
        <div className="px-5 py-3 border-b shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索快捷键..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:border-primary focus:bg-background transition-colors"
            />
          </div>
        </div>

        {/* 快捷键列表 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {grouped.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              未找到匹配的快捷键
            </div>
          )}
          {grouped.map((group) => (
            <div key={group.category}>
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
                {group.label}
              </h4>
              <div className="space-y-1.5">
                {group.items.map((b) => {
                  const isRecording = recordingId === b.id
                  const conflicts = conflictMap[b.id]
                  const hasConflict = conflicts && conflicts.length > 0
                  const isCustom = customIds.has(b.id)

                  return (
                    <div
                      key={b.id}
                      className={`flex items-center justify-between py-2 px-3 rounded-lg transition-colors ${
                        isRecording ? 'bg-primary/10 ring-1 ring-primary/40' : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{b.action}</span>
                          {isCustom && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                              自定义
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground truncate">{b.description}</span>
                        {hasConflict && (
                          <span className="flex items-center gap-1 text-[10px] text-amber-500 mt-1">
                            <AlertTriangle className="w-3 h-3" />
                            与「{conflicts.map(actionLabel).join('、')}」冲突
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        {isRecording ? (
                          <span className="text-[11px] text-primary animate-pulse">请按下快捷键...</span>
                        ) : (
                          <div className="flex items-center gap-1">
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
                        )}
                        <button
                          onClick={() => setRecordingId(isRecording ? null : b.id)}
                          className={`text-[10px] px-2 py-1 rounded transition-colors ${
                            isRecording
                              ? 'bg-muted text-muted-foreground hover:bg-muted/80'
                              : 'bg-primary/10 text-primary hover:bg-primary/20'
                          }`}
                        >
                          {isRecording ? '取消' : '修改'}
                        </button>
                        {isCustom && !isRecording && (
                          <button
                            onClick={() => handleResetOne(b.id)}
                            className="text-[10px] px-1.5 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="恢复默认"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* 底部操作 */}
        <div className="px-5 py-3 border-t bg-muted/20 flex items-center justify-between shrink-0">
          <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
            <Check className="w-3 h-3 text-green-500" />
            <span>修改后自动保存到本地</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 text-foreground rounded-md transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              重置全部
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground rounded-md transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              完成
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
