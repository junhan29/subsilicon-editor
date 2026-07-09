'use client'

import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Film, ImageIcon, Play, Upload } from 'lucide-react'
import { areNodesEqual } from '@editor/lib/utils'

function CgNodeComponent({ data, selected }: any) {
  const isVideo = data.mediaType === 'video'
  const hasMedia = !!data.url || !!data.localFile
  const title = data.title || (isVideo ? '视频CG' : '图片CG')
  const canSkip = data.canSkip !== false
  const mediaUrl = data.localFile || data.url

  return (
    <div
      className={`min-w-[200px] max-w-[280px] rounded-xl border-2 bg-card dark:bg-card p-3 shadow-sm transition-all relative ${
        selected ? 'border-purple-500 dark:border-purple-400 ring-2 ring-purple-200 dark:ring-purple-800' : 'border-gray-200 dark:border-border'
      }`}
      style={{ borderRadius: '12px 16px 14px 18px / 14px 12px 18px 16px' }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-4 !h-4 !rounded-full !z-20 !bg-card !border-2 !border-purple-500 !-top-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-purple-500/30 dark:!bg-card dark:!border-purple-400"
      />

      {hasMedia ? (
        <div className="mb-2 -mx-1 -mt-1 overflow-hidden rounded-lg">
          <div className="relative h-24 bg-purple-900 dark:bg-purple-950">
            {isVideo ? (
              <div className="w-full h-full flex items-center justify-center">
                <video
                  src={mediaUrl}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
                    <Play className="w-5 h-5 text-white ml-0.5" />
                  </div>
                </div>
              </div>
            ) : (
              <img
                src={mediaUrl}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            )}
            {data.letterbox && (
              <>
                <div className="absolute top-0 left-0 right-0 h-3 bg-black" />
                <div className="absolute bottom-0 left-0 right-0 h-3 bg-black" />
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="mb-2 -mx-1 -mt-1 overflow-hidden rounded-lg">
          <div className="relative h-20 bg-purple-50 dark:bg-purple-950/30 border-2 border-dashed border-purple-200 dark:border-purple-700 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <Upload className="w-5 h-5 text-purple-300 dark:text-purple-500 mx-auto mb-1" />
              <p className="text-[10px] text-purple-400 dark:text-purple-400">点击上传资源</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
          {isVideo ? (
            <Film className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          ) : (
            <ImageIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-purple-700 dark:text-purple-300">CG过场</p>
          <p className="text-[10px] text-muted-foreground truncate">{title}</p>
        </div>
        {data.duration ? (
          <span className="text-[9px] bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 px-1.5 py-0.5 rounded-full">
            {Math.round(data.duration / 1000)}s
          </span>
        ) : (
          <span className="text-[9px] bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300 px-1.5 py-0.5 rounded-full">
            点击继续
          </span>
        )}
      </div>

      <div className="bg-purple-50/50 dark:bg-purple-950/30 rounded-lg px-2 py-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-purple-600/70 dark:text-purple-400/70">
            {isVideo ? '视频CG' : '图片CG'}
          </span>
          <span className="text-[10px] text-purple-600/70 dark:text-purple-400/70">
            {canSkip ? '可跳过' : '不可跳过'}
          </span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-4 !h-4 !rounded-full !z-20 !bg-purple-500 !border-2 !border-card !-bottom-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-purple-500/30 dark:!bg-purple-400 dark:!border-card"
      />
    </div>
  )
}

export const CgNode = memo(CgNodeComponent, areNodesEqual)