'use client'

import { useState, useCallback, useMemo } from 'react'
import { GitBranch, Plus, RotateCcw, GitCompare, Trash2, Clock, AlertTriangle } from 'lucide-react'
import { VersionDiffView } from './version-diff'
import {
  compareVersions,
  type VersionSnapshot,
  type VersionDiff,
} from '@editor/lib/version-store'
import type { StoryGraphSnapshot } from '@editor/lib/history-store'

interface VersionPanelProps {
  versions: VersionSnapshot[]
  currentGraph: StoryGraphSnapshot
  onSaveVersion: (name: string, description: string) => void
  onRestoreVersion: (id: string) => void
  onDeleteVersion: (id: string) => void
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`
  const date = new Date(timestamp)
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${m}-${d} ${hh}:${mm}`
}

export function VersionPanel({
  versions,
  currentGraph,
  onSaveVersion,
  onRestoreVersion,
  onDeleteVersion,
}: VersionPanelProps) {
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null)
  const [diffView, setDiffView] = useState<{
    diff: VersionDiff
    v1Name: string
    v2Name: string
  } | null>(null)

  // 按时间倒序
  const sortedVersions = useMemo(
    () => [...versions].sort((a, b) => b.createdAt - a.createdAt),
    [versions]
  )

  const handleSave = useCallback(() => {
    if (!name.trim()) return
    onSaveVersion(name, description)
    setName('')
    setDescription('')
    setShowSaveForm(false)
  }, [name, description, onSaveVersion])

  const handleCancelSave = useCallback(() => {
    setName('')
    setDescription('')
    setShowSaveForm(false)
  }, [])

  const handleConfirmRestore = useCallback(() => {
    if (confirmRestoreId) {
      onRestoreVersion(confirmRestoreId)
      setConfirmRestoreId(null)
    }
  }, [confirmRestoreId, onRestoreVersion])

  const handleCompare = useCallback(
    (version: VersionSnapshot) => {
      // 对比：版本（旧） → 当前（新）
      const currentSnapshot: VersionSnapshot = {
        id: 'current',
        name: '当前版本',
        createdAt: Date.now(),
        graph: currentGraph,
      }
      const diff = compareVersions(version, currentSnapshot)
      setDiffView({ diff, v1Name: version.name, v2Name: '当前版本' })
    },
    [currentGraph]
  )

  const pendingRestoreVersion = useMemo(
    () => sortedVersions.find((v) => v.id === confirmRestoreId) || null,
    [sortedVersions, confirmRestoreId]
  )

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
          <GitBranch className="w-4 h-4 text-pink-400" />
          版本管理
        </h3>
        <button
          onClick={() => setShowSaveForm(true)}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-pink-500 hover:bg-pink-600 text-white rounded-md transition-colors"
        >
          <Plus className="w-3 h-3" />
          保存当前版本
        </button>
      </div>

      {/* 保存表单弹窗 */}
      {showSaveForm && (
        <div className="rounded-lg border border-pink-500/30 bg-slate-900/60 p-3 space-y-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="版本名称（如：第一章完成v1）"
            autoFocus
            className="w-full px-2.5 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-md text-white placeholder:text-slate-500 focus:outline-none focus:border-pink-500/60"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') handleCancelSave()
            }}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="版本描述（可选）"
            rows={2}
            className="w-full px-2.5 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-md text-white placeholder:text-slate-500 focus:outline-none focus:border-pink-500/60 resize-none"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={handleCancelSave}
              className="px-2.5 py-1 text-xs text-slate-400 hover:text-white transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="px-2.5 py-1 text-xs bg-pink-500 hover:bg-pink-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-md transition-colors"
            >
              保存
            </button>
          </div>
        </div>
      )}

      {/* 恢复确认对话框 */}
      {pendingRestoreVersion && (
        <div
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2"
          role="alertdialog"
          aria-label="恢复版本确认"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="text-amber-200 font-medium">确认恢复版本？</p>
              <p className="text-slate-300">
                将把画布恢复为「{pendingRestoreVersion.name}」，当前未保存的改动会被覆盖。
              </p>
              <p className="text-slate-500 text-[11px]">该操作支持撤销（Ctrl+Z）。</p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setConfirmRestoreId(null)}
              className="px-2.5 py-1 text-xs text-slate-400 hover:text-white transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleConfirmRestore}
              className="px-2.5 py-1 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-md transition-colors"
            >
              确认恢复
            </button>
          </div>
        </div>
      )}

      {/* 版本列表 */}
      <div className="space-y-2">
        {sortedVersions.length === 0 && !showSaveForm && (
          <div className="text-center py-10 text-slate-500 text-sm">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>暂无版本快照</p>
            <p className="text-xs text-slate-600 mt-1">点击「保存当前版本」创建第一个版本</p>
          </div>
        )}

        {sortedVersions.map((version) => {
          const graph = version.graph
          const nodeCount = graph?.nodes?.length ?? 0
          const edgeCount = graph?.edges?.length ?? 0
          const charCount = graph?.characters?.length ?? 0

          return (
            <div
              key={version.id}
              className="group rounded-lg border border-slate-700 bg-slate-800/40 hover:border-pink-500/40 transition-colors overflow-hidden"
            >
              <div className="p-2.5">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{version.name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {formatRelativeTime(version.createdAt)}
                    </p>
                  </div>
                  <div className="text-[10px] text-slate-600 shrink-0 text-right">
                    <span>{nodeCount} 节点</span>
                    <span className="mx-1">·</span>
                    <span>{edgeCount} 连线</span>
                  </div>
                </div>
                {version.description && (
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    {version.description}
                  </p>
                )}
                <div className="text-[10px] text-slate-600 mt-1">
                  {charCount} 角色
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center gap-1 px-2 pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setConfirmRestoreId(version.id)}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] bg-slate-700/60 hover:bg-amber-500/20 hover:text-amber-300 text-slate-300 rounded transition-colors"
                  title="恢复此版本"
                >
                  <RotateCcw className="w-3 h-3" />
                  恢复
                </button>
                <button
                  onClick={() => handleCompare(version)}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] bg-slate-700/60 hover:bg-blue-500/20 hover:text-blue-300 text-slate-300 rounded transition-colors"
                  title="与当前版本对比"
                >
                  <GitCompare className="w-3 h-3" />
                  对比
                </button>
                <button
                  onClick={() => onDeleteVersion(version.id)}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] bg-slate-700/60 hover:bg-red-500/20 hover:text-red-300 text-slate-300 rounded transition-colors ml-auto"
                  title="删除版本"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* 对比结果弹窗 */}
      {diffView && (
        <VersionDiffView
          diff={diffView.diff}
          v1Name={diffView.v1Name}
          v2Name={diffView.v2Name}
          onClose={() => setDiffView(null)}
        />
      )}
    </div>
  )
}
