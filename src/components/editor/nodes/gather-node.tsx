'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { areNodesEqual } from '@editor/lib/utils'

function GatherNodeComponent({ data, selected }: NodeProps) {
  const label = (data as any).label || '汇聚'

  return (
    <div
      className={`
        relative rounded-lg border-2 px-3 py-1.5
        transition-all duration-150
        ${selected
          ? 'border-primary dark:border-primary bg-primary/5 dark:bg-primary/10 shadow-md'
          : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 hover:border-slate-400 dark:hover:border-slate-500'
        }
      `}
      style={{ minWidth: 72 }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-4 !h-4 !rounded-full !z-20 !bg-card !border-2 !border-slate-400 dark:!border-slate-500 !-top-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-slate-400/30 dark:!bg-card"
      />

      <div className="flex items-center justify-center gap-1.5">
        <div className="flex items-center gap-0.5">
          <div className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500" />
          <div className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500" />
          <div className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500" />
        </div>
        <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">{label}</span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-4 !h-4 !rounded-full !z-20 !bg-slate-400 dark:!bg-slate-500 !border-2 !border-card !-bottom-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-slate-400/30 dark:!border-card"
      />
    </div>
  )
}

export const GatherNode = memo(GatherNodeComponent, areNodesEqual)