'use client'

import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { AlignLeft, Image } from 'lucide-react'
import { areNodesEqual } from '@editor/lib/utils'

function NarrationNodeComponent({ data, selected }: any) {
  const hasBg = !!data.backgroundColor

  return (
    <div
      className={`min-w-[200px] max-w-[280px] rounded-lg border-2 bg-card shadow-sm transition-all relative hover:shadow-md hover:border-slate-600 dark:bg-slate-900/80 ${
        selected
          ? 'border-amber-400 ring-2 ring-amber-400/50 shadow-lg shadow-amber-500/20'
          : 'border-slate-300 dark:border-slate-700'
      }`}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-500 dark:bg-slate-400 z-10 rounded-l-md" />

      <Handle
        type="target"
        position={Position.Top}
        className="!w-4 !h-4 !bg-card !border-2 !border-slate-500 !-top-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-slate-500/30 dark:!bg-slate-900 dark:!border-slate-400"
      />

      <div className="pl-3.5 pr-3 pt-3 pb-3">
        {hasBg && (
          <div className="mb-2 -mx-1 overflow-hidden rounded-md">
            <div
              className="relative h-14 bg-muted"
              style={{ backgroundColor: data.backgroundColor }}
            >
              <div className="absolute top-1 right-1 w-5 h-5 rounded bg-black/40 flex items-center justify-center">
                <Image className="w-3 h-3 text-white" />
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
            <AlignLeft className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
          </div>
          <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate flex-1">
            旁白
          </span>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-md px-2 py-1.5">
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed italic">
            {data.text || '点击编辑旁白文本...'}
          </p>
        </div>

        <div className="flex items-center justify-end mt-1.5">
          <AlignLeft className="w-3 h-3 text-slate-400 dark:text-slate-500" />
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-4 !h-4 !bg-slate-500 !border-2 !border-card !-bottom-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-slate-500/30 dark:!bg-slate-400 dark:!border-slate-900"
      />
    </div>
  )
}

export const NarrationNode = memo(NarrationNodeComponent, areNodesEqual)
