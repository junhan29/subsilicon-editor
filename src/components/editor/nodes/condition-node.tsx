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
      className={`min-w-[180px] max-w-[240px] rounded-xl border-2 bg-purple-50 dark:bg-purple-950/30 p-3.5 shadow-sm transition-all relative ${
        selected ? 'border-purple-400 dark:border-purple-500 ring-2 ring-purple-200 dark:ring-purple-800' : 'border-purple-200 dark:border-purple-700'
      }`}
      style={{ borderRadius: '16px 14px 18px 16px / 14px 16px 16px 18px' }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-4 !h-4 !rounded-full !z-20 !bg-card !border-2 !border-purple-500 !-top-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-purple-500/30 dark:!bg-card dark:!border-purple-400"
      />

      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
          <GitBranch className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
        </div>
        <span className="text-xs font-medium text-purple-700 dark:text-purple-300">条件判断</span>
      </div>

      <div className="bg-white/70 dark:bg-card/70 rounded-lg px-2.5 py-2 mb-3">
        <p className="text-xs text-purple-700 dark:text-purple-300 font-mono truncate">{expression}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="relative">
          <div className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded-md px-2 py-1 text-center font-medium border border-green-200 dark:border-green-800">
            ✓ {trueLabel}
          </div>
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            className="!w-4 !h-4 !rounded-full !z-20 !bg-green-500 !border-2 !border-card !-bottom-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-green-500/30 dark:!bg-green-400 dark:!border-card"
            style={{ left: '25%' }}
          />
        </div>
        <div className="relative">
          <div className="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-md px-2 py-1 text-center font-medium border border-red-200 dark:border-red-800">
            ✗ {falseLabel}
          </div>
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            className="!w-4 !h-4 !rounded-full !z-20 !bg-red-500 !border-2 !border-card !-bottom-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-red-500/30 dark:!bg-red-400 dark:!border-card"
            style={{ left: '75%' }}
          />
        </div>
      </div>
    </div>
  )
}

export const ConditionNode = memo(ConditionNodeComponent)