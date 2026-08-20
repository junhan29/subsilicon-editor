'use client'

import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { GitBranch } from 'lucide-react'
import { areNodesEqual } from '@editor/lib/utils'

function ConditionNodeComponent({ data, selected }: any) {
  const expression = data.expression || '条件表达式'
  const trueLabel = data.trueLabel || '是'
  const falseLabel = data.falseLabel || '否'

  return (
    <div
      className={`min-w-[180px] max-w-[240px] rounded-[2px] border-2 bg-card p-3.5 transition-all relative clip-path-polygon-[0_0,calc(100%-12px)_0,100%_12px,100%_100%,0_100%] ${
        selected
          ? 'border-cyber-cyan-500/60 shadow-[6px_6px_0_hsl(var(--cyber-cyan-500)/0.18)]'
          : 'border-border shadow-[4px_4px_0_hsl(var(--cyber-cyan-500)/0.1)]'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-4 !h-4 !rounded-full !z-20 !bg-card !border-2 !border-cyber-cyan-500/60 !-top-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-cyber-cyan-500/25 dark:!bg-card dark:!border-cyber-cyan-500/70"
      />

      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-7 h-7 rounded-full bg-cyber-cyan-500/10 flex items-center justify-center border border-cyber-cyan-500/25">
          <GitBranch className="w-3.5 h-3.5 text-cyber-cyan-500" />
        </div>
        <span className="text-xs font-semibold text-foreground">条件判断</span>
      </div>

      <div className="bg-card/90 rounded-[2px] px-2.5 py-2 mb-3 border border-border/50 font-mono shadow-[2px_2px_0_hsl(var(--cyber-cyan-500)/0.12)]">
        <p className="text-xs text-foreground truncate">{expression}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="relative">
          {/* YES 出口：金印章风 */}
          <div className="bg-gold-400/10 text-gold-400 rounded-[2px] px-2 py-1 text-center font-semibold border border-gold-400/30 shadow-[2px_2px_0_hsl(var(--gold)/0.15)]">
            ✓ {trueLabel}
          </div>
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            className="!w-4 !h-4 !rounded-full !z-20 !bg-gold-400 !border-2 !border-card !-bottom-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-gold-400/30 dark:!bg-gold-400 dark:!border-card"
            style={{ left: '25%' }}
          />
        </div>
        <div className="relative">
          {/* NO 出口：红印章风 */}
          <div className="bg-primary/10 text-primary rounded-[2px] px-2 py-1 text-center font-semibold border border-primary/30 shadow-[2px_2px_0_hsl(var(--primary)/0.15)]">
            ✗ {falseLabel}
          </div>
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            className="!w-4 !h-4 !rounded-full !z-20 !bg-primary !border-2 !border-card !-bottom-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-primary/30 dark:!bg-primary dark:!border-card"
            style={{ left: '75%' }}
          />
        </div>
      </div>
    </div>
  )
}

export const ConditionNode = memo(ConditionNodeComponent)