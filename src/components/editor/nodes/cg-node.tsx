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
      className={`min-w-[200px] max-w-[280px] rounded-[2px] border-2 bg-card p-3 transition-all relative clip-path-polygon-[0_0,calc(100%-12px)_0,100%_12px,100%_100%,0_100%] ${
        selected
          ? 'border-cyber-magenta-500/60 shadow-[6px_6px_0_hsl(var(--cyber-magenta-500)/0.18)]'
          : 'border-border shadow-[4px_4px_0_hsl(var(--cyber-magenta-500)/0.1)]'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-4 !h-4 !rounded-full !z-20 !bg-card !border-2 !border-cyber-magenta-500/60 !-top-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-cyber-magenta-500/25 dark:!bg-card dark:!border-cyber-magenta-500/70"
      />

      {/* 拍立得相纸风格：白色宽边 + 图片区（P5 CG 特色） */}
      {hasMedia ? (
        <div className="mb-2 -mx-1 -mt-1 overflow-hidden rounded-[2px] bg-card border border-border/40 p-2 pb-6 shadow-[2px_2px_0_hsl(var(--muted-foreground)/0.12)]">
          <div className="relative h-24 bg-muted overflow-hidden rounded-[2px]">
            {isVideo ? (
              <div className="w-full h-full flex items-center justify-center">
                <video
                  src={mediaUrl}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center border border-white/30">
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
        <div className="mb-2 -mx-1 -mt-1 overflow-hidden rounded-[2px] bg-card border border-dashed border-cyber-magenta-500/30 p-2 pb-6">
          <div className="relative h-20 bg-muted/50 rounded-[2px] flex items-center justify-center">
            <div className="text-center">
              <Upload className="w-5 h-5 text-cyber-magenta-500/70 mx-auto mb-1" />
              <p className="text-[10px] text-foreground/70">点击上传资源</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-8 h-8 rounded-full bg-cyber-magenta-500/10 flex items-center justify-center border border-cyber-magenta-500/25">
          {isVideo ? (
            <Film className="w-4 h-4 text-cyber-magenta-500" />
          ) : (
            <ImageIcon className="w-4 h-4 text-cyber-magenta-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-foreground">CG过场</p>
          <p className="text-[10px] text-muted-foreground truncate">{title}</p>
        </div>
        {data.duration ? (
          <span className="text-[9px] bg-cyber-magenta-500/10 text-cyber-magenta-500 px-1.5 py-0.5 rounded-[2px] border border-cyber-magenta-500/25 font-semibold">
            {Math.round(data.duration / 1000)}s
          </span>
        ) : (
          <span className="text-[9px] bg-gold-400/10 text-gold-400 px-1.5 py-0.5 rounded-[2px] border border-gold-400/25 font-semibold">
            点击继续
          </span>
        )}
      </div>

      <div className="bg-muted/30 dark:bg-muted/20 rounded-[2px] px-2 py-1.5 border border-border/30">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-foreground/70">
            {isVideo ? '视频CG' : '图片CG'}
          </span>
          <span className="text-[10px] text-foreground/70">
            {canSkip ? '可跳过' : '不可跳过'}
          </span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-4 !h-4 !rounded-full !z-20 !bg-cyber-magenta-500/70 !border-2 !border-card !-bottom-2 !transition-all hover:!scale-125 hover:!shadow-lg hover:!shadow-cyber-magenta-500/25 dark:!border-card"
      />
    </div>
  )
}

export const CgNode = memo(CgNodeComponent, areNodesEqual)