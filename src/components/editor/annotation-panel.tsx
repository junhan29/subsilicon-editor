'use client'

// ---
// 批注面板（右侧面板 Tab 内容）
// - 顶部过滤：全部 / 未解决 / TODO / 警告
// - 列表按节点分组
// - 每条批注：类型图标、作者、时间、文本
// - 操作：回复、标记已解决、删除
// - memo 化优化性能
// ---

import { memo, useMemo, useState, useCallback } from 'react'
import { Plus, Trash2, CheckCircle2, RotateCcw, CornerDownRight, MessageSquare, Send } from 'lucide-react'
import type { NodeAnnotation, AnnotationType, StoryNode } from '@editor/types/editor'
import { ANNOTATION_TYPE_META } from '@editor/types/editor'
import { AnnotationTypeIcon } from './annotation-marker'

// ---
// 过滤类型
// ---

type FilterType = 'all' | 'unresolved' | 'todo' | 'warning'

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'unresolved', label: '未解决' },
  { value: 'todo', label: 'TODO' },
  { value: 'warning', label: '警告' },
]

// ---
// 工具函数
// ---

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60 * 1000) return '刚刚'
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60 / 1000)} 分钟前`
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 60 / 60 / 1000)} 小时前`
  if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / 24 / 60 / 60 / 1000)} 天前`
  return new Date(ts).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

function getNodeLabel(node: StoryNode | undefined, fallbackId: string): string {
  if (!node) return fallbackId.slice(0, 12)
  const typeLabels: Record<string, string> = {
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
  const typeLabel = typeLabels[node.type] || node.type
  const data = node.data as Record<string, unknown> | undefined
  let textSnippet = ''
  if (data) {
    if (typeof data.text === 'string') textSnippet = data.text
    else if (typeof data.title === 'string') textSnippet = data.title
    else if (typeof data.label === 'string') textSnippet = data.label
    else if (typeof data.prompt === 'string') textSnippet = data.prompt
  }
  const snippet = textSnippet ? textSnippet.slice(0, 18) : ''
  return snippet ? `${typeLabel} · ${snippet}${snippet.length >= 18 ? '…' : ''}` : `${typeLabel} · ${fallbackId.slice(0, 8)}`
}

// ---
// 单条批注项
// ---

interface AnnotationItemProps {
  annotation: NodeAnnotation
  onResolve: (id: string) => void
  onReply: (id: string, text: string) => void
  onDelete: (id: string) => void
}

const AnnotationItem = memo(function AnnotationItem({
  annotation,
  onResolve,
  onReply,
  onDelete,
}: AnnotationItemProps) {
  const [showReply, setShowReply] = useState(false)
  const [replyText, setReplyText] = useState('')

  const meta = ANNOTATION_TYPE_META[annotation.type]

  const handleReplySubmit = useCallback(() => {
    const text = replyText.trim()
    if (!text) return
    onReply(annotation.id, text)
    setReplyText('')
    setShowReply(false)
  }, [replyText, annotation.id, onReply])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleReplySubmit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setShowReply(false)
      setReplyText('')
    }
  }, [handleReplySubmit])

  return (
    <div
      className="rounded-lg border p-2.5 transition-colors"
      style={{
        backgroundColor: annotation.resolved ? 'rgba(107, 114, 128, 0.06)' : meta.bg,
        borderColor: annotation.resolved ? 'rgba(107, 114, 128, 0.3)' : meta.border,
      }}
    >
      {/* 头部 */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <AnnotationTypeIcon type={annotation.type} resolved={annotation.resolved} className="w-3.5 h-3.5 shrink-0" />
        <span className="text-[11px] font-medium text-slate-200 truncate">{annotation.author}</span>
        <span className="text-[10px] text-slate-500 ml-auto shrink-0">{formatRelativeTime(annotation.createdAt)}</span>
      </div>

      {/* 文本 */}
      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap break-words">{annotation.text}</p>

      {/* 回复列表 */}
      {annotation.replies && annotation.replies.length > 0 && (
        <div className="mt-2 space-y-1.5 pl-3 border-l border-slate-700/60">
          {annotation.replies.map((reply) => (
            <div key={reply.id} className="text-xs">
              <div className="flex items-center gap-1.5">
                <CornerDownRight className="w-3 h-3 text-slate-500 shrink-0" />
                <span className="text-[11px] font-medium text-slate-300">{reply.author}</span>
                <span className="text-[10px] text-slate-600 ml-auto">{formatRelativeTime(reply.createdAt)}</span>
              </div>
              <p className="text-slate-400 mt-0.5 ml-4 whitespace-pre-wrap break-words">{reply.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* 回复输入框 */}
      {showReply && (
        <div className="mt-2">
          <textarea
            autoFocus
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="回复（Enter 发送，Esc 取消）"
            className="w-full min-h-[50px] max-h-[100px] resize-none text-xs bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-slate-500"
          />
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex items-center gap-1 mt-2">
        <button
          onClick={() => setShowReply((v) => !v)}
          className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded transition-colors"
          title="回复"
        >
          <MessageSquare className="w-3 h-3" />
          回复
        </button>
        <button
          onClick={() => onResolve(annotation.id)}
          className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors"
          title={annotation.resolved ? '重新打开' : '标记已解决'}
        >
          {annotation.resolved ? <RotateCcw className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
          {annotation.resolved ? '重新打开' : '已解决'}
        </button>
        {showReply && replyText.trim() && (
          <button
            onClick={handleReplySubmit}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-blue-500/80 hover:bg-blue-500 text-white rounded transition-colors"
            title="发送回复"
          >
            <Send className="w-3 h-3" />
            发送
          </button>
        )}
        <button
          onClick={() => onDelete(annotation.id)}
          className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors ml-auto"
          title="删除批注"
        >
          <Trash2 className="w-3 h-3" />
          删除
        </button>
      </div>
    </div>
  )
})

// ---
// 添加批注表单
// ---

interface AddAnnotationFormProps {
  nodeId: string
  defaultAuthor: string
  onAdd: (input: { nodeId: string; type: AnnotationType; text: string; author: string }) => void
  onCancel: () => void
}

const AddAnnotationForm = memo(function AddAnnotationForm({
  nodeId,
  defaultAuthor,
  onAdd,
  onCancel,
}: AddAnnotationFormProps) {
  const [type, setType] = useState<AnnotationType>('comment')
  const [text, setText] = useState('')
  const [author, setAuthor] = useState(defaultAuthor)

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed) return
    onAdd({ nodeId, type, text: trimmed, author: author.trim() || '匿名创作者' })
    setText('')
    onCancel()
  }, [text, type, author, nodeId, onAdd, onCancel])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }, [handleSubmit, onCancel])

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-2.5 space-y-2">
      <div className="flex items-center gap-1">
        {(['comment', 'todo', 'warning', 'idea'] as AnnotationType[]).map((t) => {
          const m = ANNOTATION_TYPE_META[t]
          const active = type === t
          return (
            <button
              key={t}
              onClick={() => setType(t)}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded transition-colors"
              style={{
                backgroundColor: active ? m.bg : 'transparent',
                color: active ? m.color : '#94a3b8',
                border: `1px solid ${active ? m.border : 'rgba(100, 116, 139, 0.3)'}`,
              }}
            >
              <AnnotationTypeIcon type={t} className="w-3 h-3" />
              {m.label}
            </button>
          )
        })}
      </div>

      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入批注内容... (Ctrl+Enter 提交)"
        className="w-full min-h-[60px] max-h-[120px] resize-none text-xs bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-slate-500"
      />

      <input
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        placeholder="作者名（保存到本地）"
        className="w-full text-[11px] bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-slate-500"
      />

      <div className="flex items-center gap-2">
        <button
          onClick={handleSubmit}
          disabled={!text.trim()}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[11px] bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded transition-colors"
        >
          <Plus className="w-3 h-3" />
          添加批注
        </button>
        <button
          onClick={onCancel}
          className="px-2 py-1 text-[11px] bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  )
})

// ---
// 批注面板主体
// ---

export interface AnnotationPanelProps {
  annotations: NodeAnnotation[]
  nodes: StoryNode[]
  defaultAuthor?: string
  selectedNodeId?: string | null
  onAddAnnotation?: (input: { nodeId: string; type: AnnotationType; text: string; author: string }) => void
  onResolveAnnotation?: (id: string) => void
  onReplyAnnotation?: (id: string, text: string) => void
  onDeleteAnnotation?: (id: string) => void
  onNodeSelect?: (nodeId: string) => void
}

function AnnotationPanelImpl({
  annotations,
  nodes,
  defaultAuthor = '匿名创作者',
  selectedNodeId,
  onAddAnnotation,
  onResolveAnnotation,
  onReplyAnnotation,
  onDeleteAnnotation,
  onNodeSelect,
}: AnnotationPanelProps) {
  const [filter, setFilter] = useState<FilterType>('all')
  const [addingForNodeId, setAddingForNodeId] = useState<string | null>(null)

  const nodeMap = useMemo(() => {
    const map = new Map<string, StoryNode>()
    for (const n of nodes) map.set(n.id, n)
    return map
  }, [nodes])

  // 过滤后的批注
  const filteredAnnotations = useMemo(() => {
    let list = annotations
    if (filter === 'unresolved') list = list.filter((a) => !a.resolved)
    else if (filter === 'todo') list = list.filter((a) => a.type === 'todo')
    else if (filter === 'warning') list = list.filter((a) => a.type === 'warning')
    return list
  }, [annotations, filter])

  // 按 nodeId 分组
  const groupedByNode = useMemo(() => {
    const map = new Map<string, NodeAnnotation[]>()
    for (const a of filteredAnnotations) {
      const list = map.get(a.nodeId)
      if (list) list.push(a)
      else map.set(a.nodeId, [a])
    }
    // 选中节点的批注排到最前面
    const entries = Array.from(map.entries())
    entries.sort((a, b) => {
      if (a[0] === selectedNodeId) return -1
      if (b[0] === selectedNodeId) return 1
      return 0
    })
    return entries
  }, [filteredAnnotations, selectedNodeId])

  const unresolvedCount = useMemo(() => annotations.filter((a) => !a.resolved).length, [annotations])
  const todoCount = useMemo(() => annotations.filter((a) => a.type === 'todo' && !a.resolved).length, [annotations])
  const warningCount = useMemo(() => annotations.filter((a) => a.type === 'warning' && !a.resolved).length, [annotations])

  const handleAddHere = useCallback((nodeId: string) => {
    setAddingForNodeId(nodeId)
  }, [])

  const handleAddForSelected = useCallback(() => {
    if (selectedNodeId) setAddingForNodeId(selectedNodeId)
  }, [selectedNodeId])

  const handleAddSubmit = useCallback((input: { nodeId: string; type: AnnotationType; text: string; author: string }) => {
    onAddAnnotation?.(input)
    setAddingForNodeId(null)
  }, [onAddAnnotation])

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* 头部 */}
      <div className="px-3 py-2.5 border-b border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
            批注
          </h3>
          <span className="text-[10px] text-slate-500">
            共 {annotations.length} 条 · {unresolvedCount} 未解决
          </span>
        </div>

        {/* 过滤按钮 */}
        <div className="flex items-center gap-1 flex-wrap">
          {FILTER_OPTIONS.map((opt) => {
            const count = opt.value === 'all'
              ? annotations.length
              : opt.value === 'unresolved'
                ? unresolvedCount
                : opt.value === 'todo'
                  ? todoCount
                  : warningCount
            const active = filter === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                {opt.label}
                {count > 0 && <span className="ml-1 opacity-80">({count})</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* 添加按钮 */}
      {selectedNodeId && (
        <div className="px-3 py-2 border-b border-slate-800">
          <button
            onClick={handleAddForSelected}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            为当前选中节点添加批注
          </button>
        </div>
      )}

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {groupedByNode.length === 0 && (
          <div className="text-center py-10 text-slate-600">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">
              {annotations.length === 0 ? '暂无批注' : '当前过滤下无批注'}
            </p>
            <p className="text-[10px] mt-1 text-slate-700">
              {annotations.length === 0
                ? '右键节点或在属性面板底部添加批注'
                : '尝试切换过滤条件'}
            </p>
          </div>
        )}

        {groupedByNode.map(([nodeId, list]) => {
          const node = nodeMap.get(nodeId)
          const isSelected = nodeId === selectedNodeId
          return (
            <div key={nodeId} className="space-y-1.5">
              {/* 节点标题 */}
              <button
                onClick={() => onNodeSelect?.(nodeId)}
                className={`w-full flex items-center gap-1.5 px-2 py-1 text-[11px] rounded transition-colors ${
                  isSelected
                    ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
                }`}
              >
                <span className="font-mono opacity-60">#{nodeId.slice(0, 8)}</span>
                <span className="truncate flex-1 text-left">{getNodeLabel(node, nodeId)}</span>
                <Plus
                  className="w-3 h-3 opacity-50 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleAddHere(nodeId)
                  }}
                />
              </button>

              {/* 该节点的批注列表 */}
              <div className="space-y-1.5 pl-1">
                {list.map((annotation) => (
                  <AnnotationItem
                    key={annotation.id}
                    annotation={annotation}
                    onResolve={onResolveAnnotation || (() => {})}
                    onReply={onReplyAnnotation || (() => {})}
                    onDelete={onDeleteAnnotation || (() => {})}
                  />
                ))}
              </div>

              {/* 行内添加表单 */}
              {addingForNodeId === nodeId && (
                <AddAnnotationForm
                  nodeId={nodeId}
                  defaultAuthor={defaultAuthor}
                  onAdd={handleAddSubmit}
                  onCancel={() => setAddingForNodeId(null)}
                />
              )}
            </div>
          )
        })}

        {/* 添加表单（无选中节点时的全局入口） */}
        {!selectedNodeId && addingForNodeId === null && annotations.length === 0 && (
          <div className="px-2 py-3 text-center">
            <p className="text-[11px] text-slate-600">
              提示：右键画布节点选择「添加批注」
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ---
// memo 比较函数
// ---

function areAnnotationPanelPropsEqual(
  prev: AnnotationPanelProps,
  next: AnnotationPanelProps
): boolean {
  if (prev.annotations.length !== next.annotations.length) return false
  if (prev.selectedNodeId !== next.selectedNodeId) return false
  if (prev.defaultAuthor !== next.defaultAuthor) return false
  // 浅比较 annotations 数组（引用变化即重渲染）
  if (prev.annotations !== next.annotations) {
    // 通过 id+resolved+replies.length 比较关键变化
    if (prev.annotations.length !== next.annotations.length) return false
    const prevMap = new Map(prev.annotations.map((a) => [a.id, a]))
    for (const nextA of next.annotations) {
      const prevA = prevMap.get(nextA.id)
      if (!prevA) return false
      if (prevA.resolved !== nextA.resolved) return false
      if (prevA.text !== nextA.text) return false
      if ((prevA.replies?.length || 0) !== (nextA.replies?.length || 0)) return false
    }
  }
  if (prev.nodes.length !== next.nodes.length) return false
  return true
}

export const AnnotationPanel = memo(AnnotationPanelImpl, areAnnotationPanelPropsEqual)
export default AnnotationPanel
