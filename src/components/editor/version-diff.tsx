'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { X, ChevronDown, ChevronRight, Plus, Minus, Edit3, ArrowRight, GitCompare } from 'lucide-react'
import type { VersionDiff, VersionModifiedNode } from '@editor/lib/version-store'
import { trapFocus, focusFirstInteractive, restoreFocus } from '@editor/lib/focus-manager'

interface VersionDiffViewProps {
  diff: VersionDiff
  v1Name: string
  v2Name: string
  onClose: () => void
}

interface DiffRow {
  id: string
  type: string
  label: string
}

const nodeTypeLabels: Record<string, string> = {
  dialogue: '对话',
  choice: '选择',
  gather: '汇聚',
  condition: '条件',
  unlock: '付费',
  ending: '结局',
  cg: 'CG过场',
  jump: '跳转',
  random: '随机',
  narration: '旁白',
}

function formatValue(value: unknown): string {
  if (value === undefined) return '∅'
  if (value === null) return 'null'
  if (typeof value === 'string') return value === '' ? '""' : value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function ModifiedNodeItem({ node }: { node: VersionModifiedNode }) {
  const [expanded, setExpanded] = useState(false)
  const typeLabel = nodeTypeLabels[node.type] || node.type
  const changeCount = node.changes.length

  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-amber-500/10 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        )}
        <Edit3 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="text-xs font-medium text-amber-200 truncate flex-1">{node.label}</span>
        <span className="text-[10px] text-amber-400/70 shrink-0">{typeLabel}</span>
        <span className="text-[10px] text-amber-400/70 shrink-0">{changeCount} 处变更</span>
      </button>
      {expanded && (
        <div className="px-3 pb-2 pt-1 space-y-1.5 border-t border-amber-500/20">
          {node.changes.map((change, idx) => (
            <div key={idx} className="flex flex-col gap-0.5 text-[11px] py-1">
              <span className="text-amber-300/80 font-mono">{change.field}</span>
              <div className="flex items-center gap-2 pl-3">
                <span className="text-red-400/70 line-through truncate max-w-[40%]">
                  {formatValue(change.before)}
                </span>
                <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                <span className="text-green-400 truncate">{formatValue(change.after)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DiffSection({
  title,
  added,
  removed,
  modified,
  emptyHint,
}: {
  title: string
  added: DiffRow[]
  removed: DiffRow[]
  modified?: VersionModifiedNode[]
  emptyHint: string
}) {
  const hasContent = added.length > 0 || removed.length > 0 || (modified && modified.length > 0)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="space-y-1.5">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex items-center gap-1.5 w-full text-left"
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        )}
        <h4 className="text-xs font-semibold text-slate-300">{title}</h4>
        {hasContent && (
          <span className="flex items-center gap-1.5 ml-auto text-[10px]">
            {added.length > 0 && <span className="text-green-400">+{added.length}</span>}
            {removed.length > 0 && <span className="text-red-400">-{removed.length}</span>}
            {modified && modified.length > 0 && (
              <span className="text-amber-400">~{modified.length}</span>
            )}
          </span>
        )}
      </button>
      {!collapsed && (
        <div className="space-y-1 pl-1">
          {!hasContent && (
            <p className="text-[11px] text-slate-600 italic pl-5 py-1">{emptyHint}</p>
          )}
          {added.map((item) => (
            <div
              key={`add-${item.id}`}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-green-500/10 border border-green-500/20"
            >
              <Plus className="w-3 h-3 text-green-400 shrink-0" />
              <span className="text-xs text-green-200 truncate flex-1">{item.label}</span>
              <span className="text-[10px] text-green-400/60 shrink-0">
                {nodeTypeLabels[item.type] || item.type}
              </span>
            </div>
          ))}
          {removed.map((item) => (
            <div
              key={`rm-${item.id}`}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-red-500/10 border border-red-500/20"
            >
              <Minus className="w-3 h-3 text-red-400 shrink-0" />
              <span className="text-xs text-red-200 truncate flex-1 line-through opacity-70">
                {item.label}
              </span>
              <span className="text-[10px] text-red-400/60 shrink-0">
                {nodeTypeLabels[item.type] || item.type}
              </span>
            </div>
          ))}
          {modified?.map((node) => (
            <ModifiedNodeItem key={`mod-${node.id}`} node={node} />
          ))}
        </div>
      )}
    </div>
  )
}

export function VersionDiffView({ diff, v1Name, v2Name, onClose }: VersionDiffViewProps) {
  const { summary } = diff
  const hasAnyChange = summary.totalChanges > 0
  const dialogRef = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef<(() => void) | null>(null)
  const titleId = 'version-diff-title'
  const descId = 'version-diff-description'

  useEffect(() => {
    if (dialogRef.current) {
      restoreFocusRef.current = restoreFocus(dialogRef.current)
      focusFirstInteractive(dialogRef.current)
    }
    return () => {
      if (restoreFocusRef.current) {
        restoreFocusRef.current()
      }
    }
  }, [])

  useEffect(() => {
    if (!dialogRef.current) return
    const cleanup = trapFocus(dialogRef.current)
    return cleanup
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <div
        ref={dialogRef}
        onKeyDown={handleKeyDown}
        className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-slate-800 rounded-xl border border-slate-700 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部：版本名 + 统计 */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-700 bg-slate-900/60">
          <GitCompare className="w-4 h-4 text-pink-400 shrink-0" />
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-medium text-white">版本对比</h2>
          </div>
          <div className="flex items-center gap-3 text-[11px] shrink-0">
            <span className="text-green-400">+{summary.addedCount}</span>
            <span className="text-red-400">-{summary.removedCount}</span>
            <span className="text-amber-400">~{summary.modifiedCount}</span>
            <button
              onClick={onClose}
              className="ml-1 p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
              title="关闭 (Esc)"
              aria-label="关闭版本对比对话框"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 统计栏 */}
        <div id={descId} className="flex items-center gap-4 px-5 py-2 border-b border-slate-700/50 bg-slate-900/30 text-[11px]">
          <span className="text-slate-400">
            共 <span className="text-white font-medium">{summary.totalChanges}</span> 处变更
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-green-400">新增 {summary.addedCount}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-red-400">删除 {summary.removedCount}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-amber-400">修改 {summary.modifiedCount}</span>
          </span>
        </div>

        {/* 差异列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!hasAnyChange && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <GitCompare className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">两个版本内容完全一致</p>
              <p className="text-xs text-slate-600 mt-1">没有检测到任何差异</p>
            </div>
          )}

          {hasAnyChange && (
            <>
              <DiffSection
                title="节点"
                added={diff.addedNodes}
                removed={diff.removedNodes}
                modified={diff.modifiedNodes}
                emptyHint="节点无变化"
              />
              <DiffSection
                title="连线"
                added={diff.addedEdges.map((e) => ({ id: e.id, type: 'edge', label: `${e.source} → ${e.target}` }))}
                removed={diff.removedEdges.map((e) => ({ id: e.id, type: 'edge', label: `${e.source} → ${e.target}` }))}
                emptyHint="连线无变化"
              />
              <DiffSection
                title="角色"
                added={diff.addedCharacters.map((c) => ({ id: c.id, type: 'character', label: c.name }))}
                removed={diff.removedCharacters.map((c) => ({ id: c.id, type: 'character', label: c.name }))}
                emptyHint="角色无变化"
              />
            </>
          )}
        </div>

        {/* 底部操作 */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-slate-700 bg-slate-900/40">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
