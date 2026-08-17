'use client'

import { useCallback, useMemo } from 'react'
import { AlertCircle, AlertTriangle, RotateCcw, ShieldCheck, X } from 'lucide-react'
import { useA11yAnnouncer } from './a11y-announcer'
import { type QualityIssue, runQualityCheck } from '@editor/lib/quality-check'
import type { StoryEdge, StoryNode } from '@editor/types/editor'
import type { MonetizationConfig } from '@editor/lib/work-monetization'

interface QualityCheckPanelProps {
  nodes: StoryNode[]
  edges: StoryEdge[]
  monetization: MonetizationConfig | null
  onLocateNode: (nodeId: string) => void
  onClose: () => void
}

/**
 * 作品体检面板（ADHD 适配）：主动列出会让读者卡住或体验不完整的结构问题，
 * 点击问题可定位到对应节点。结果同时播报给无障碍读屏。
 */
export function QualityCheckPanel({ nodes, edges, monetization, onLocateNode, onClose }: QualityCheckPanelProps) {
  const { announce } = useA11yAnnouncer()
  const issues = useMemo(
    () => runQualityCheck({ nodes, edges, monetization }),
    [nodes, edges, monetization]
  )
  const errorCount = issues.filter((i) => i.severity === 'error').length
  const warningCount = issues.length - errorCount

  const rerun = useCallback(() => {
    announce(`作品体检：共 ${issues.length} 个问题，其中 ${errorCount} 个需要处理，${warningCount} 个可优化`)
  }, [issues.length, errorCount, warningCount, announce])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2 shrink-0">
        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          作品体检
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={rerun}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            title="重新检查"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onClose}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            title="关闭"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 摘要 */}
      <div className="px-3 py-2 border-b border-border shrink-0">
        {issues.length === 0 ? (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">一切正常，作品结构完整，可以放心导出。</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            发现 <span className="text-primary font-medium">{errorCount}</span> 个需要处理的问题，{' '}
            <span className="text-gold-400 font-medium">{warningCount}</span> 个可优化项。点击条目定位到节点。
          </p>
        )}
      </div>

      {/* 问题列表 */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
        {issues.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <ShieldCheck className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-xs">没有发现问题</p>
          </div>
        )}
        {issues.map((issue: QualityIssue) => (
          <button
            key={issue.id}
            onClick={() => {
              if (issue.nodeId) onLocateNode(issue.nodeId)
            }}
            className={`w-full text-left rounded-lg px-2.5 py-2 text-xs transition-colors flex items-start gap-2 border ${
              issue.severity === 'error'
                ? 'bg-primary/5 border-primary/20 hover:bg-primary/10'
                : 'bg-gold-400/5 border-gold-400/20 hover:bg-gold-400/10'
            }`}
          >
            {issue.severity === 'error' ? (
              <AlertCircle className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-gold-400 shrink-0 mt-0.5" />
            )}
            <span className="text-foreground/90 leading-snug">{issue.message}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
