'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, ChevronDown, ChevronRight, Search, Trash2 } from 'lucide-react'
import {
  deleteCreatorInput,
  listCreatorInputs,
  updateCreatorInput,
  type CreatorInput,
  type CreatorInputType,
} from '@editor/lib/creator-input-store'

// 输入类型的中文标签与 badge 配色（与灵感库面板共用，供上下文注入格式化复用）
export const CREATOR_INPUT_TYPE_LABELS: Record<CreatorInputType, string> = {
  inspiration: '灵感',
  outline: '大纲',
  setting: '设定',
  correction: '纠错',
  chat: '对话',
}

const CREATOR_INPUT_TYPES: CreatorInputType[] = ['inspiration', 'outline', 'setting', 'correction', 'chat']

const TYPE_BADGE_COLORS: Record<CreatorInputType, string> = {
  inspiration: 'text-gold-400 bg-gold-400/15 border-gold-400/30',
  outline: 'text-cyan-300 bg-cyan-500/15 border-cyan-500/30',
  setting: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  correction: 'text-red-300 bg-primary/15 border-primary/30',
  chat: 'text-foreground bg-slate-500/15 border-slate-500/30',
}

interface CreatorInputPanelProps {
  /** 当前作品 ID；空字符串表示只列全局条目 */
  workId: string
  /** 注入回调：把条目内容插入聊天输入框 */
  onInject: (content: string) => void
  /** 外部变更（如新增采集）后自增，触发重新加载 */
  refreshKey?: number
  /** 「生成时引用输入库」开关状态 */
  useInContext: boolean
  /** 「生成时引用输入库」开关变更回调 */
  onToggleUseInContext: (next: boolean) => void
  /** 紧凑模式：用于右侧抽屉，默认展开、移除外层折叠头、填充整个容器 */
  compact?: boolean
}

/** 条目时间格式化（月/日 时:分） */
function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * 灵感库（创作者输入库）面板：
 * 按作品 + 全局查看/搜索输入条目，可改类型、删除，一键把内容注入当前对话。
 * 挂在 AI 对话面板输入区上方，折叠展示，避免挤占聊天区域。
 */
export function CreatorInputPanel({ workId, onInject, refreshKey = 0, useInContext, onToggleUseInContext, compact = false }: CreatorInputPanelProps) {
  const [expanded, setExpanded] = useState(compact)
  const [query, setQuery] = useState('')
  const [entries, setEntries] = useState<CreatorInput[]>([])

  // 加载与作品相关的输入条目（当前作品 + 全局；workId 为空时只列全局）
  const load = useCallback(async () => {
    try {
      const all = await listCreatorInputs()
      setEntries(all.filter((e) => e.workId === workId || e.workId === ''))
    } catch {
      setEntries([])
    }
  }, [workId])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  // 搜索过滤：按内容大小写不敏感匹配
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter((e) => e.content.toLowerCase().includes(q))
  }, [entries, query])

  // 改类型：先本地更新保持响应，再异步写库（store 内部容错，失败静默）
  const handleTypeChange = (id: string, type: CreatorInputType) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, type } : e)))
    void updateCreatorInput(id, { type })
  }

  // 删除：确认后删除并刷新列表
  const handleDelete = async (entry: CreatorInput) => {
    if (!window.confirm('确定删除这条输入记录吗？')) return
    await deleteCreatorInput(entry.id)
    await load()
  }

  // 注入：把条目内容交回给 AI 面板（插入聊天输入框）
  const handleInject = (entry: CreatorInput) => {
    onInject(entry.content)
  }

  return (
    <div className={`flex flex-col h-full ${compact ? 'border-0 bg-transparent px-3 py-2' : 'shrink-0 border-t border-border/40 bg-card/40'}`}>
      {/* 面板头部：折叠开关 + 标题 + 计数 + 「生成时引用」开关（紧凑模式移除外层折叠头） */}
      {!compact && (
        <div className="flex items-center gap-2 px-3 py-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            title={expanded ? '收起灵感库' : '展开灵感库（查看 AI 对话自动沉淀的输入记录）'}
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <BookOpen className="w-3.5 h-3.5 text-gold-400/80" />
            灵感库
            <span className="text-[9px] text-muted-foreground">({entries.length})</span>
          </button>
          <label
            className="ml-auto flex items-center gap-1 text-[9px] text-muted-foreground cursor-pointer select-none"
            title="开启后，AI 对话与生成时会自动把输入库中最近的灵感/设定等注入上下文，供 AI 复用"
          >
            <input
              type="checkbox"
              checked={useInContext}
              onChange={(e) => onToggleUseInContext(e.target.checked)}
              className="accent-amber-500 w-3 h-3"
            />
            生成时引用
          </label>
        </div>
      )}

      {/* 紧凑模式：头部紧凑，显示计数 + 开关 */}
      {compact && (
        <div className="flex items-center gap-2 mb-2 shrink-0">
          <span className="text-[10px] text-muted-foreground">
            共 {entries.length} 条记录
          </span>
          <label
            className="ml-auto flex items-center gap-1 text-[9px] text-muted-foreground cursor-pointer select-none"
            title="开启后，AI 对话与生成时会自动把灵感库中最近的内容注入上下文，供 AI 复用"
          >
            <input
              type="checkbox"
              checked={useInContext}
              onChange={(e) => onToggleUseInContext(e.target.checked)}
              className="accent-gold-400 w-3 h-3"
            />
            生成时引用
          </label>
        </div>
      )}

      {/* 面板主体：搜索 + 条目列表（紧凑模式下展开填充整列） */}
      {(expanded || compact) && (
        <div className={`${compact ? 'flex-1 overflow-hidden flex flex-col min-h-0 gap-2' : 'border-t border-border/40 max-h-56 overflow-y-auto px-3 py-2 space-y-2'}`}>
          <div className="relative shrink-0">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索灵感内容……"
              className={`w-full text-[11px] rounded border border-border bg-muted/60 pl-6 pr-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold-400/40 ${compact ? '' : ''}`}
            />
          </div>

          {filtered.length === 0 ? (
            <p className="text-[10px] text-muted-foreground leading-relaxed py-2 text-center">
              还没有记录。在 AI 对话中发送消息会自动沉淀到这里，用于后续生成参考。
            </p>
          ) : (
            <ul className={`space-y-1.5 ${compact ? 'flex-1 overflow-y-auto pr-0.5' : ''}`}>
              {filtered.map((e) => (
                <li key={e.id} className="rounded border border-border/50 bg-muted/40 p-2 hover:border-gold-400/20 transition-colors">
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border ${TYPE_BADGE_COLORS[e.type]}`}>
                      {CREATOR_INPUT_TYPE_LABELS[e.type]}
                    </span>
                    <span className="text-[9px] text-muted-foreground">{formatTime(e.createdAt)}</span>
                    <div className="ml-auto flex items-center gap-1">
                      <select
                        value={e.type}
                        onChange={(ev) => handleTypeChange(e.id, ev.target.value as CreatorInputType)}
                        className="text-[9px] rounded border border-border bg-secondary/50 text-foreground px-1 py-0.5 focus:outline-none"
                        title="修改类型"
                      >
                        {CREATOR_INPUT_TYPES.map((t) => (
                          <option key={t} value={t}>{CREATOR_INPUT_TYPE_LABELS[t]}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleInject(e)}
                        className="text-[9px] px-1.5 py-0.5 rounded border border-gold-400/30 text-gold-400/90 hover:bg-gold-400/15 transition-colors"
                        title="把这条内容注入当前对话输入框"
                      >
                        注入
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(e)}
                        className="p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="删除这条记录"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-foreground leading-snug whitespace-pre-wrap break-all">{e.content}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
