'use client'

import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { AlignLeft, Image } from 'lucide-react'
import { areNodesEqual } from '@editor/lib/utils'

function NarrationNodeComponent({ data, selected }: any) {
  const hasBg = !!data.backgroundColor

  return (
    <div
      className={`min-w-[200px] max-w-[280px] rounded-[2px] border-2 bg-card transition-all relative hover:border-border dark:bg-card/80 clip-path-polygon-[0_0,calc(100%-12px)_0,100%_12px,100%_100%,0_100%] ${
        selected
          ? 'border-gold-400/80 shadow-[6px_6px_0_hsl(var(--muted-foreground)/0.15)]'
          : 'border-border shadow-[4px_4px_0_hsl(var(--muted-foreground)/0.1)]'
      }`}
    >
      {/* 左侧灰色类型标识条（白纸条风） */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-muted-foreground/40 dark:bg-muted-foreground/50 z-10 rounded-l-[2px]" />

      <Handle
        type="target"
        position={Position.Top}
        className="!w-4 !h-4 !rounded-full !z-20 !bg-card !border-2 !border-muted-foreground/50 !-top-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-muted-foreground/30 dark:!bg-card dark:!border-muted-foreground/60"
      />

      <div className="pl-3.5 pr-3 pt-3 pb-3">
        {hasBg && (
          <div className="mb-2 -mx-1 overflow-hidden rounded-[2px]">
            <div
              className="relative h-14 bg-muted"
              style={{ backgroundColor: data.backgroundColor }}
            >
              <div className="absolute top-1 right-1 w-5 h-5 rounded-[2px] bg-black/40 flex items-center justify-center">
                <Image className="w-3 h-3 text-white" />
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-6 h-6 rounded-full bg-muted/60 flex items-center justify-center shrink-0 border border-border/50">
            <AlignLeft className="w-3.5 h-3.5 text-foreground/80" />
          </div>
          <span className="text-xs font-semibold text-foreground truncate flex-1 font-hand tracking-wider">
            旁白
          </span>
        </div>

        <div className="bg-muted/30 dark:bg-muted/20 rounded-[2px] px-2 py-1.5 border border-border/30">
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed italic">
            {data.text || '点击编辑旁白文本...'}
          </p>
        </div>

        <div className="flex items-center justify-end mt-1.5">
          <AlignLeft className="w-3 h-3 text-muted-foreground/70" />
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-4 !h-4 !rounded-full !z-20 !bg-muted-foreground/50 !border-2 !border-card !-bottom-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-muted-foreground/30 dark:!bg-muted-foreground/60 dark:!border-card"
      />
    </div>
  )
}

export const NarrationNode = memo(NarrationNodeComponent, areNodesEqual)
