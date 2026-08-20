'use client'

import { memo, useEffect, useState } from 'react'
import { Handle, type NodeProps, Position } from '@xyflow/react'
import { ArrowRight, Hash, Zap } from 'lucide-react'
import { areNodesEqual } from '@editor/lib/utils'

type JumpNodeData = {
  label?: string
  targetNodeId?: string
  targetLabel?: string
  expression?: string
}

function JumpNodeComponent({ data, selected }: NodeProps) {
  const d = data as unknown as JumpNodeData
  const [label, setLabel] = useState(d.label || '')

  useEffect(() => {
    if (d.label !== label) {
      setLabel(d.label || '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.label])

  return (
    <div className={`
      relative bg-card px-3 py-2.5 min-w-[200px] rounded-[2px] border-2
      clip-path-polygon-[0_0,calc(100%-12px)_0,100%_12px,100%_100%,0_100%]
      ${selected
        ? 'border-gold-400 shadow-[6px_6px_0_hsl(var(--p5-red)/0.28)]'
        : 'border-border shadow-[4px_4px_0_hsl(var(--p5-red)/0.18)]'
      }
    `}>
      {/* 闪电贴纸装饰 */}
      <div className="absolute -top-2.5 -left-2 w-6 h-6 rounded-[1px] bg-p5-red rotate-[-8deg] flex items-center justify-center shadow-[2px_2px_0_hsl(var(--p5-red)/0.35)] z-10 border border-gold-400">
        <Zap className="w-3.5 h-3.5 text-gold-400" strokeWidth={2.8} />
      </div>
      <div className="absolute top-1 right-2 w-1 h-1 rounded-full bg-p5-red/50" />
      <div className="absolute top-2.5 right-3 w-0.5 h-0.5 rounded-full bg-p5-red/40" />

      <Handle
        type="target"
        position={Position.Top}
        className="!w-4 !h-4 !rounded-full !z-20 !bg-white !border-2 !border-p5-red !-top-2 !transition-all hover:!scale-125"
      />

      <div className="flex items-center gap-2 mb-2 pl-5">
        <div className="w-8 h-8 rounded-[2px] bg-p5-red/15 border border-p5-red/30 flex items-center justify-center shadow-[2px_2px_0_hsl(var(--p5-red)/0.15)]">
          <Zap className="w-4 h-4 text-p5-red" />
        </div>
        <span className="text-xs font-bold text-p5-red tracking-wider uppercase">
          跳转节点
        </span>
      </div>

      <div className="space-y-1.5">
        <input
          type="text"
          value={label}
          placeholder="跳转标签 (knot name)"
          className="w-full bg-card border border-border rounded-[2px] px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-p5-red shadow-[2px_2px_0_hsl(var(--p5-red)/0.08)]"
          onChange={(e) => {
            const newValue = e.target.value
            setLabel(newValue)
            const currentData = data as Record<string, unknown>
            currentData.label = newValue
          }}
        />

        {d.expression && (
          <div className="bg-p5-red/8 rounded-[2px] px-2 py-1.5 border border-p5-red/20 shadow-[2px_2px_0_hsl(var(--p5-red)/0.08)]">
            <p className="text-[10px] text-p5-red/70 mb-1 tracking-wide">条件表达式</p>
            <p className="text-xs text-foreground font-mono bg-card/60 rounded-[1px] px-1.5 py-0.5">{d.expression}</p>
          </div>
        )}

        {d.targetNodeId ? (
          <div className="flex items-center gap-2 bg-card rounded-[2px] px-2 py-1.5 border border-gold-400/30 shadow-[2px_2px_0_hsl(var(--gold)/0.12)]">
            <ArrowRight className="w-3 h-3 text-gold-500" strokeWidth={2.5} />
            <span className="text-xs text-foreground truncate font-medium">
              {d.targetLabel || d.targetNodeId}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-card rounded-[2px] px-2 py-1.5 border border-dashed border-p5-red/30 shadow-[2px_2px_0_hsl(var(--p5-red)/0.05)]">
            <Hash className="w-3 h-3 text-p5-red/50" />
            <span className="text-xs text-muted-foreground">未选择目标节点</span>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-4 !h-4 !rounded-full !z-20 !bg-p5-red !border-2 !border-white !-bottom-2 !transition-all hover:!scale-125"
      />
    </div>
  )
}

export const JumpNode = memo(JumpNodeComponent, areNodesEqual)