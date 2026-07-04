'use client'

import { memo, useState, useEffect } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
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
      relative bg-gradient-to-br from-violet-500/20 to-purple-500/20
      border-2 rounded-xl px-4 py-3 min-w-[200px]
      ${selected ? 'border-violet-400 shadow-lg shadow-violet-500/30' : 'border-violet-500/50'}
    `}>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-4 !h-4 !bg-white !border-2 !border-violet-400 !-top-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-violet-400/30"
      />

      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-violet-500/30 flex items-center justify-center">
          <Zap className="w-4 h-4 text-violet-400" />
        </div>
        <span className="text-xs font-medium text-violet-400">
          跳转节点
        </span>
      </div>

      <div className="space-y-2">
        <input
          type="text"
          value={label}
          placeholder="跳转标签 (knot name)"
          className="w-full bg-black/30 border border-violet-500/30 rounded px-2 py-1.5 text-sm text-white placeholder:text-violet-300/50 focus:outline-none focus:border-violet-400"
          onChange={(e) => {
            const newValue = e.target.value
            setLabel(newValue)
            const currentData = data as Record<string, unknown>
            currentData.label = newValue
          }}
        />

        {d.expression && (
          <div className="bg-black/30 rounded px-2 py-1.5">
            <p className="text-[10px] text-violet-300/70 mb-1">条件表达式</p>
            <p className="text-xs text-violet-200 font-mono">{d.expression}</p>
          </div>
        )}

        {d.targetNodeId ? (
          <div className="flex items-center gap-2 bg-black/30 rounded px-2 py-1.5">
            <ArrowRight className="w-3 h-3 text-violet-400" />
            <span className="text-xs text-violet-200">
              {d.targetLabel || d.targetNodeId}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-black/30 rounded px-2 py-1.5">
            <Hash className="w-3 h-3 text-violet-400/50" />
            <span className="text-xs text-violet-300/50">未选择目标节点</span>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-4 !h-4 !bg-violet-400 !border-2 !border-white !-bottom-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-violet-400/30"
      />
    </div>
  )
}

export const JumpNode = memo(JumpNodeComponent, areNodesEqual)