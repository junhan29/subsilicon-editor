'use client'

import { memo } from 'react'
import { Handle, type NodeProps, Position } from '@xyflow/react'
import { areNodesEqual } from '@editor/lib/utils'

function GatherNodeComponent({ data, selected }: NodeProps) {
  const label = (data as any).label || '汇聚'

  return (
    <div
      className={`
        relative rounded-[2px] border-2 px-3 py-1.5
        transition-all duration-150 clip-path-polygon-[0_0,calc(100%-8px)_0,100%_8px,100%_100%,0_100%]
        ${selected
          ? 'border-primary bg-primary/5 shadow-[6px_6px_0_hsl(var(--primary)/0.22)]'
          : 'border-border bg-card shadow-[3px_3px_0_hsl(var(--primary)/0.1)] hover:border-primary/50'
        }
      `}
      style={{ minWidth: 72 }}
    >
      {/* 订书钉装饰（两个小方块，P5 汇聚节点特色） */}
      <div className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 flex gap-1 z-20" aria-hidden>
        <div className="w-2 h-1.5 bg-slate-400/70 dark:bg-slate-500/70 rounded-sm" />
        <div className="w-2 h-1.5 bg-slate-400/70 dark:bg-slate-500/70 rounded-sm" />
      </div>

      <Handle
        type="target"
        position={Position.Top}
        className="!w-4 !h-4 !rounded-full !z-20 !bg-card !border-2 !border-primary !-top-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-primary/30 dark:!bg-card"
      />

      <div className="flex items-center justify-center gap-1.5">
        <div className="flex items-center gap-0.5">
          <div className="w-1 h-1 rounded-full bg-primary/70" />
          <div className="w-1 h-1 rounded-full bg-primary/70" />
          <div className="w-1 h-1 rounded-full bg-primary/70" />
        </div>
        <span className="text-[11px] font-semibold text-foreground">{label}</span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-4 !h-4 !rounded-full !z-20 !bg-primary !border-2 !border-card !-bottom-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-primary/30 dark:!border-card"
      />
    </div>
  )
}

export const GatherNode = memo(GatherNodeComponent, areNodesEqual)