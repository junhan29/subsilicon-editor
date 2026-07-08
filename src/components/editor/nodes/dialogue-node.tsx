'use client'

import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { MessageCircle, User, Image, Music } from 'lucide-react'
import { areNodesEqual } from '@editor/lib/utils'

function DialogueNodeComponent({ data, selected }: any) {
  const hasBg = !!data.backgroundImage
  const hasBgm = !!data.bgm
  const hasCharacter = !!data.characterId
  const emotion = data.emotion

  return (
    <div
      className={`min-w-[200px] max-w-[280px] rounded-lg border-2 bg-card shadow-sm transition-all relative hover:shadow-md hover:border-slate-600 dark:bg-slate-900/80 ${
        selected
          ? 'border-amber-400 ring-2 ring-amber-400/50 shadow-lg shadow-amber-500/20'
          : 'border-slate-300 dark:border-slate-700'
      }`}
    >
      {/* 左侧紫色类型标识条 */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500 dark:bg-violet-400 z-10 rounded-l-md" />

      {/* 上方连接点（接收连线） */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-4 !h-4 !bg-card !border-2 !border-violet-500 !-top-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-violet-500/30 dark:!bg-slate-900 dark:!border-violet-400"
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
          <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
            <User className="w-3.5 h-3.5 text-violet-600 dark:text-violet-300" />
          </div>
          <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate flex-1">
            {hasCharacter ? '角色对话' : '未指定角色'}
          </span>
          {emotion && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 shrink-0">
              {emotion}
            </span>
          )}
          {hasBgm && (
            <div className="w-5 h-5 rounded bg-amber-50 flex items-center justify-center shrink-0 dark:bg-amber-900/30">
              <Music className="w-3 h-3 text-amber-500 dark:text-amber-300" />
            </div>
          )}
        </div>

        {/* 底部：台词预览（2行截断，灰色小字） */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-md px-2 py-1.5">
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
            {data.text || '点击编辑台词...'}
          </p>
        </div>

        {/* 类型标识小图标 */}
        <div className="flex items-center justify-end mt-1.5">
          <MessageCircle className="w-3 h-3 text-violet-400 dark:text-violet-500" />
        </div>
      </div>

      {/* 下方连接点（拖出连线） */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-4 !h-4 !bg-violet-500 !border-2 !border-card !-bottom-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-violet-500/30 dark:!bg-violet-400 dark:!border-slate-900"
      />
    </div>
  )
}

export const DialogueNode = memo(DialogueNodeComponent, areNodesEqual)
