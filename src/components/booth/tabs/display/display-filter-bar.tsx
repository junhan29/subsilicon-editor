/** B3a. 陈列筛选条（状态 Chip + 搜索框 + 新建按钮） */
import React from 'react'
import { Search, Plus } from 'lucide-react'

export type WorkStatusFilter = 'all' | 'published' | 'draft' | 'review'

export interface DisplayFilterBarProps {
  statusCounts: Record<WorkStatusFilter, number>
  status: WorkStatusFilter
  onStatusChange: (s: WorkStatusFilter) => void
  search: string
  onSearchChange: (v: string) => void
  onCreateWork: () => void
  /** 未上架可新增作品数（用于新建按钮 badge 可选） */
  pendingCount?: number
}

const STATUS_OPTIONS: { key: WorkStatusFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'published', label: '已发布' },
  { key: 'draft', label: '草稿' },
  { key: 'review', label: '未审核' },
]

export function DisplayFilterBar({
  statusCounts,
  status,
  onStatusChange,
  search,
  onSearchChange,
  onCreateWork,
}: DisplayFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {STATUS_OPTIONS.map((o) => {
          const active = status === o.key
          const n = statusCounts[o.key] ?? 0
          return (
            <button
              key={o.key}
              onClick={() => onStatusChange(o.key)}
              className={
                'inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 ' +
                (active
                  ? 'bg-primary/15 text-primary border-primary/40'
                  : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground hover:border-muted-foreground/40')
              }
            >
              {o.label}
              <span
                className={
                  'min-w-[16px] h-4 px-1 text-[9px] rounded-full inline-flex items-center justify-center ' +
                  (active ? 'bg-primary/25 text-primary' : 'bg-muted-foreground/15 text-muted-foreground')
                }
              >
                {String(n)}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex-1 min-w-[180px] max-w-sm ml-auto relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="按标题 / 作者 / tag 搜索"
          className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-border bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      <button
        onClick={onCreateWork}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        <Plus className="w-3.5 h-3.5" />
        新建陈列
      </button>
    </div>
  )
}
