'use client'

import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Image, MessageCircle, Music, User } from 'lucide-react'
import { areNodesEqual } from '@editor/lib/utils'

function DialogueNodeComponent({ data, selected }: any) {
  const hasBg = !!data.backgroundImage
  const hasBgm = !!data.bgm
  const hasCharacter = !!data.characterId
  const emotion = data.emotion

  return (
    <div
      className={`min-w-[200px] max-w-[280px] rounded-[2px] border-2 bg-card transition-all relative hover:border-border dark:bg-card/80 clip-path-polygon-[0_0,calc(100%-12px)_0,100%_12px,100%_100%,0_100%] ${
        selected
          ? 'border-gold-400 shadow-[6px_6px_0_hsl(var(--gold)/0.28)]'
          : 'border-border shadow-[4px_4px_0_hsl(var(--gold)/0.18)]'
      }`}
    >
      {/* 左侧金色类型标识条（P5 剪贴风） */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gold-400 dark:bg-gold-400 z-10 rounded-l-[2px]" />

      {/* 上方连接点（接收连线） */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-4 !h-4 !rounded-full !z-20 !bg-card !border-2 !border-gold-400 !-top-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-gold-400/30 dark:!bg-card dark:!border-gold-400"
      />

      <div className="pl-3.5 pr-3 pt-3 pb-3">
        {/* 背景图预览 */}
        {hasBg && (
          <div className="mb-2 -mx-1 overflow-hidden rounded-md">
            <div className="relative h-14 bg-muted">
              <img
                src={data.backgroundImage}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
              <div className="absolute top-1 right-1 w-5 h-5 rounded bg-black/40 flex items-center justify-center">
                <Image className="w-3 h-3 text-white" />
              </div>
            </div>
          </div>
        )}

        {/* 顶部：角色名 + 表情标签 */}
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-6 h-6 rounded-full bg-gold-400/15 dark:bg-gold-400/10 flex items-center justify-center shrink-0 border border-gold-400/25">
            <User className="w-3.5 h-3.5 text-gold-400 dark:text-gold-300" />
          </div>
          <span className="text-xs font-medium text-foreground truncate flex-1">
            {hasCharacter ? '角色对话' : '未指定角色'}
          </span>
          {emotion && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-[2px] bg-gold-400/15 text-gold-400 dark:bg-gold-400/10 dark:text-gold-300 shrink-0 border border-gold-400/25 font-semibold">
              {emotion}
            </span>
          )}
          {hasBgm && (
            <div className="w-5 h-5 rounded-[2px] bg-gold-400/10 flex items-center justify-center shrink-0 dark:bg-gold-400/10 border border-gold-400/20">
              <Music className="w-3 h-3 text-gold-400" />
            </div>
          )}
        </div>

        {/* 底部：台词预览（2行截断，灰色小字） */}
        <div className="bg-muted/40 dark:bg-muted/30 rounded-[2px] px-2 py-1.5 border border-border/40">
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {data.text || '点击编辑台词...'}
          </p>
        </div>

        {/* 类型标识小图标 */}
        <div className="flex items-center justify-end mt-1.5">
          <MessageCircle className="w-3 h-3 text-gold-400/70 dark:text-gold-400" />
        </div>
      </div>

      {/* 下方连接点（拖出连线） */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-4 !h-4 !rounded-full !z-20 !bg-gold-400 !border-2 !border-card !-bottom-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-gold-400/30 dark:!bg-gold-400 dark:!border-card"
      />
    </div>
  )
}

export const DialogueNode = memo(DialogueNodeComponent, areNodesEqual)
