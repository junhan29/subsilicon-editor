'use client'

import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { GitBranch, GripVertical } from 'lucide-react'
import { areNodesEqual } from '@editor/lib/utils'

const MAX_VISIBLE_OPTIONS = 2

function ChoiceNodeComponent({ data, selected, id: nodeId }: any) {
  const options = data.options || []
  const visibleOptions = options.slice(0, MAX_VISIBLE_OPTIONS)
  const hiddenCount = Math.max(0, options.length - MAX_VISIBLE_OPTIONS)

  return (
    <div
      className={`min-w-[200px] max-w-[280px] rounded-lg border-2 bg-amber-50 dark:bg-amber-950/30 shadow-sm transition-all relative hover:shadow-md hover:border-slate-600 ${
        selected
          ? 'border-amber-400 ring-2 ring-amber-400/50 shadow-lg shadow-amber-500/20 dark:border-amber-400'
          : 'border-amber-200 dark:border-amber-800'
      }`}
    >
      {/* 左侧琥珀色类型标识条 */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 dark:bg-amber-400 z-10 rounded-l-md" />

      {/* 上方连接点 */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-4 !h-4 !bg-card !border-2 !border-amber-500 !-top-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-amber-500/30 dark:!bg-slate-900 dark:!border-amber-400"
      />

      <div className="pl-3.5 pr-3 pt-3 pb-3">
        {/* 顶部：标题 + 选项数量 badge */}
        <div className="flex items-center gap-1.5 mb-2.5">
          <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
            <GitBranch className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <span className="text-xs font-medium text-amber-700 dark:text-amber-300 flex-1">
            玩家选择
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-200/70 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 shrink-0 font-medium">
            {options.length} 个选项
          </span>
        </div>

        {/* 选项预览 */}
        <div className="space-y-1.5">
          {options.length === 0 ? (
            <div className="text-xs text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-900/60 rounded-md px-2.5 py-1.5">
              添加选项，每个选项会生成独立分支
            </div>
          ) : (
            <>
              {visibleOptions.map((opt: any, i: number) => (
                <div
                  key={opt.id || i}
                  className="relative bg-white/80 dark:bg-slate-900/80 rounded-md px-2.5 py-1.5 text-sm border border-amber-100 dark:border-amber-800/50"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-[10px] flex items-center justify-center font-medium shrink-0">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="truncate flex-1 text-slate-700 dark:text-slate-200 text-xs">
                      {opt.text || `选项 ${i + 1}`}
                    </span>
                  </div>
                </div>
              ))}

              {/* 超出部分提示 */}
              {hiddenCount > 0 && (
                <div className="text-[10px] text-amber-600 dark:text-amber-400 px-2.5 py-1 italic">
                  +{hiddenCount} more
                </div>
              )}
            </>
          )}
        </div>

        {/* 拖出分支提示 */}
        <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-amber-500 dark:text-amber-500">
          <GripVertical className="w-3 h-3" />
          拖出分支
        </div>
      </div>

      {/* 每个选项独立的连接点（保留全部以维持连线完整性） */}
      {options.length > 0 ? (
        options.map((opt: any, i: number) => (
          <Handle
            key={opt.id || `opt-${i}`}
            type="source"
            position={Position.Bottom}
            id={opt.id || `opt-${i}`}
            className="!w-4 !h-4 !bg-amber-500 !border-2 !border-card !-bottom-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-amber-500/30 dark:!bg-amber-400 dark:!border-slate-900"
            style={{ left: `${((i + 0.5) / options.length) * 100}%` }}
          />
        ))
      ) : (
        /* 如果没有选项，显示一个默认连接点 */
        <Handle
          type="source"
          position={Position.Bottom}
          id="out"
          className="!w-4 !h-4 !bg-amber-500 !border-2 !border-card !-bottom-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-amber-500/30 dark:!bg-amber-400 dark:!border-slate-900"
        />
      )}
    </div>
  )
}

export const ChoiceNode = memo(ChoiceNodeComponent, areNodesEqual)
