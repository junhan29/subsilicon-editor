'use client'

import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Star, X, Circle, Lock, Flag } from 'lucide-react'
import { areNodesEqual } from '@editor/lib/utils'

type EndingType = 'good' | 'bad' | 'neutral' | 'secret'

interface EndingMeta {
  label: string
  color: string
  iconBg: string
  iconColor: string
  Icon: React.ComponentType<{ className?: string }>
}

const endingTypeMeta: Record<EndingType, EndingMeta> = {
  good: {
    label: '好结局',
    color: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
    iconBg: 'bg-green-100 dark:bg-green-900/50',
    iconColor: 'text-green-600 dark:text-green-400',
    Icon: Star,
  },
  bad: {
    label: '坏结局',
    color: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',
    iconBg: 'bg-red-100 dark:bg-red-900/50',
    iconColor: 'text-red-600 dark:text-red-400',
    Icon: X,
  },
  neutral: {
    label: '普通结局',
    color: 'bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300',
    iconBg: 'bg-gray-100 dark:bg-gray-800/50',
    iconColor: 'text-gray-600 dark:text-gray-400',
    Icon: Circle,
  },
  secret: {
    label: '隐藏结局',
    color: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300',
    iconBg: 'bg-purple-100 dark:bg-purple-900/50',
    iconColor: 'text-purple-600 dark:text-purple-400',
    Icon: Lock,
  },
}

function EndingNodeComponent({ data, selected }: any) {
  const endingType = (data.endingType || 'neutral') as EndingType
  const meta = endingTypeMeta[endingType] || endingTypeMeta.neutral
  const TypeIcon = meta.Icon

  return (
    <div
      className={`min-w-[200px] max-w-[280px] rounded-lg border-2 bg-green-50 dark:bg-green-950/30 shadow-sm transition-all relative hover:shadow-md hover:border-slate-600 ${
        selected
          ? 'border-green-400 ring-2 ring-green-400/50 shadow-lg shadow-green-500/20 dark:border-green-400'
          : 'border-green-200 dark:border-green-800'
      }`}
    >
      {/* 左侧绿色类型标识条 */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500 dark:bg-green-400 z-10 rounded-l-md" />

      <Handle
        type="target"
        position={Position.Top}
        className="!w-4 !h-4 !bg-card !border-2 !border-green-500 !-top-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-green-500/30 dark:!bg-slate-900 dark:!border-green-400"
      />

      <div className="pl-3.5 pr-3 pt-3 pb-3">
        {/* 顶部：类型图标 + 标题 + 类型 badge */}
        <div className="flex items-center gap-1.5 mb-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${meta.iconBg}`}>
            <TypeIcon className={`w-3.5 h-3.5 ${meta.iconColor}`} />
          </div>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate flex-1">
            {data.title || '未命名结局'}
          </p>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium shrink-0 ${meta.color}`}>
            {meta.label}
          </span>
        </div>

        {/* 结局描述 */}
        <div className="bg-white/60 dark:bg-slate-900/60 rounded-md p-2">
          <p className="text-xs text-green-900 dark:text-green-100 line-clamp-3 leading-relaxed">
            {data.text || '点击编辑结局描述...'}
          </p>
        </div>

        {/* 类型标识小图标 */}
        <div className="flex items-center justify-end mt-1.5">
          <Flag className="w-3 h-3 text-green-400 dark:text-green-500" />
        </div>
      </div>
    </div>
  )
}

export const EndingNode = memo(EndingNodeComponent, areNodesEqual)
