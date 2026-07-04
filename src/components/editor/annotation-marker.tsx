'use client'

// ---
// 节点批注标记组件
// - 作为节点装饰层渲染在右上角
// - 不同类型用不同颜色：comment=蓝、todo=黄、warning=红、idea=紫
// - 已解决用灰色
// - 通过 Context 获取每个节点的批注数据，避免修改节点 data
// ---

import { createContext, useContext, memo } from 'react'
import { MessageSquare, CheckCircle2, AlertTriangle, Lightbulb, ListTodo } from 'lucide-react'
import type { NodeAnnotation, AnnotationType } from '@editor/types/editor'
import { ANNOTATION_TYPE_META } from '@editor/types/editor'

// ---
// Context：节点 -> 批注列表
// ---

export interface AnnotationMarkerContextValue {
  /** nodeId -> annotations */
  map: Map<string, NodeAnnotation[]>
  /** 当前高亮的节点 id（用于选中节点时强调） */
  highlightedNodeId?: string | null
  /** 点击 marker 的回调 */
  onMarkerClick?: (nodeId: string) => void
}

const AnnotationMarkerContext = createContext<AnnotationMarkerContextValue>({
  map: new Map(),
  highlightedNodeId: null,
  onMarkerClick: undefined,
})

export const AnnotationMarkerProvider = AnnotationMarkerContext.Provider

export function useAnnotationMarkerContext(): AnnotationMarkerContextValue {
  return useContext(AnnotationMarkerContext)
}

// ---
// 节点级摘要
// ---

export interface NodeAnnotationSummary {
  total: number
  unresolved: number
  /** 出现过的类型集合（用于决定颜色，优先级：warning > todo > idea > comment） */
  types: Set<AnnotationType>
  allResolved: boolean
}

export function summarizeAnnotations(list: NodeAnnotation[] | undefined): NodeAnnotationSummary | null {
  if (!list || list.length === 0) return null
  const types = new Set<AnnotationType>()
  let unresolved = 0
  for (const a of list) {
    types.add(a.type)
    if (!a.resolved) unresolved++
  }
  return {
    total: list.length,
    unresolved,
    types,
    allResolved: unresolved === 0,
  }
}

/** 选择主显示类型，优先级：warning > todo > idea > comment */
function pickPrimaryType(types: Set<AnnotationType>): AnnotationType {
  if (types.has('warning')) return 'warning'
  if (types.has('todo')) return 'todo'
  if (types.has('idea')) return 'idea'
  return 'comment'
}

// ---
// Marker 组件
// ---

interface AnnotationMarkerProps {
  nodeId: string
}

function AnnotationMarkerComponent({ nodeId }: AnnotationMarkerProps) {
  const { map, highlightedNodeId, onMarkerClick } = useAnnotationMarkerContext()
  const list = map.get(nodeId)
  const summary = summarizeAnnotations(list)

  if (!summary) return null

  const primaryType = pickPrimaryType(summary.types)
  const meta = ANNOTATION_TYPE_META[primaryType]
  const isHighlighted = highlightedNodeId === nodeId

  // 已解决全部 → 灰色
  const color = summary.allResolved ? '#6b7280' : meta.color
  const bg = summary.allResolved ? 'rgba(107, 114, 128, 0.15)' : meta.bg
  const border = summary.allResolved ? 'rgba(107, 114, 128, 0.45)' : meta.border

  const Icon = summary.allResolved
    ? CheckCircle2
    : primaryType === 'warning'
      ? AlertTriangle
      : primaryType === 'todo'
        ? ListTodo
        : primaryType === 'idea'
          ? Lightbulb
          : MessageSquare

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onMarkerClick?.(nodeId)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`${summary.total} 条批注${summary.unresolved > 0 ? `（${summary.unresolved} 未解决）` : '（全部已解决）'}`}
      className="absolute -top-2 -right-2 z-10 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold shadow-md transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-card"
      style={{
        backgroundColor: bg,
        color,
        border: `1px solid ${border}`,
        outline: isHighlighted ? `2px solid ${color}` : undefined,
        outlineOffset: '1px',
      }}
    >
      <Icon className="w-3 h-3" />
      <span>{summary.total}</span>
    </button>
  )
}

export const AnnotationMarker = memo(AnnotationMarkerComponent)

// ---
// HOC：为节点组件包裹批注标记
// 节点容器需要是 relative 定位（已是）
// ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withAnnotationMarker<T extends React.ComponentType<any>>(Wrapped: T): T {
  const Enhanced = memo(function WithAnnotationMarkerWrapper(props: React.ComponentProps<T> & { id?: string }) {
    const { id, ...rest } = props as { id?: string } & Record<string, unknown>
    return (
      <div className="relative">
        <Wrapped {...(rest as React.ComponentProps<T>)} />
        {id && <AnnotationMarker nodeId={id} />}
      </div>
    )
  })
  // 通过 unknown 中转，规避 T 与具体 memo 返回类型的双向协变限制
  return Enhanced as unknown as T
}

// 默认导出：用于直接渲染（若需要在节点内部手动放置）
export default function AnnotationMarkerDefault({ nodeId }: { nodeId: string }) {
  return <AnnotationMarker nodeId={nodeId} />
}

// 导出图标渲染工具（供面板使用）
export function AnnotationTypeIcon({ type, resolved, className }: { type: AnnotationType; resolved?: boolean; className?: string }) {
  const Icon = resolved
    ? CheckCircle2
    : type === 'warning'
      ? AlertTriangle
      : type === 'todo'
        ? ListTodo
        : type === 'idea'
          ? Lightbulb
          : MessageSquare
  const meta = ANNOTATION_TYPE_META[type]
  const color = resolved ? '#6b7280' : meta.color
  return <Icon className={className} style={{ color }} />
}
