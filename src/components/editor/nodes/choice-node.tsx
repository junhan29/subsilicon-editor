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
      className={`min-w-[200px] max-w-[280px] rounded-[2px] border-2 bg-card transition-all relative hover:border-border clip-path-polygon-[0_0,calc(100%-12px)_0,100%_12px,100%_100%,0_100%] ${
        selected
          ? 'border-gold-400 shadow-[6px_6px_0_hsl(var(--gold)/0.28)]'
          : 'border-border shadow-[4px_4px_0_hsl(var(--gold)/0.18)]'
      }`}
    >
      {/* 左侧金色类型标识条（分叉胶带风） */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gold-400 dark:bg-gold-400 z-10 rounded-l-[2px]" />

      {/* 上方连接点 */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-4 !h-4 !rounded-full !z-20 !bg-card !border-2 !border-gold-400 !-top-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-gold-400/30 dark:!bg-card dark:!border-gold-400"
      />

      <div className="pl-3.5 pr-3 pt-3 pb-3">
        {/* 顶部：标题 + 选项数量 badge */}
        <div className="flex items-center gap-1.5 mb-2.5">
          <div className="w-6 h-6 rounded-full bg-gold-400/15 dark:bg-gold-400/10 flex items-center justify-center shrink-0 border border-gold-400/25">
            <GitBranch className="w-3.5 h-3.5 text-gold-400" />
          </div>
          <span className="text-xs font-semibold text-foreground flex-1">
            玩家选择
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-[2px] bg-gold-400/15 text-gold-400 dark:bg-gold-400/10 shrink-0 border border-gold-400/25 font-semibold">
            {options.length} 个选项
          </span>
        </div>

        {/* 选项预览 */}
        <div className="space-y-1.5">
          {options.length === 0 ? (
            <div className="text-xs text-muted-foreground bg-card/80 rounded-[2px] px-2.5 py-1.5 border border-dashed border-border/50">
              添加选项，每个选项会生成独立分支
            </div>
          ) : (
            <>
              {visibleOptions.map((opt: any, i: number) => (
                <div
                  key={opt.id || i}
                  className="relative bg-card/90 rounded-[2px] px-2.5 py-1.5 text-sm border border-gold-400/20 shadow-[2px_2px_0_hsl(var(--gold)/0.15)]"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-gold-400/15 text-gold-400 text-[10px] flex items-center justify-center font-semibold shrink-0 border border-gold-400/25">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="truncate flex-1 text-foreground text-xs">
                      {opt.text || `选项 ${i + 1}`}
                    </span>
                  </div>
                </div>
              ))}

              {/* 超出部分提示 */}
              {hiddenCount > 0 && (
                <div className="text-[10px] text-gold-400 px-2.5 py-1 italic">
                  +{hiddenCount} more
                </div>
              )}
            </>
          )}
        </div>

        {/* 拖出分支提示 */}
        <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-gold-400/80">
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
            className="!w-4 !h-4 !rounded-full !z-20 !bg-gold-400 !border-2 !border-card !-bottom-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-gold-400/30 dark:!bg-gold-400 dark:!border-card"
            style={{ left: `${((i + 0.5) / options.length) * 100}%` }}
          />
        ))
      ) : (
        /* 如果没有选项，显示一个默认连接点 */
        <Handle
          type="source"
          position={Position.Bottom}
          id="out"
          className="!w-4 !h-4 !rounded-full !z-20 !bg-gold-400 !border-2 !border-card !-bottom-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-gold-400/30 dark:!bg-gold-400 dark:!border-card"
        />
      )}
    </div>
  )
}

export const ChoiceNode = memo(ChoiceNodeComponent, areNodesEqual)
