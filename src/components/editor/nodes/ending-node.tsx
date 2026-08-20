'use client'

import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Circle, Flag, Lock, Star, X } from 'lucide-react'
import { areNodesEqual } from '@editor/lib/utils'

type EndingType = 'good' | 'bad' | 'neutral' | 'secret'

interface EndingMeta {
  label: string
  color: string
  iconBg: string
  iconColor: string
  Icon: React.ComponentType<{ className?: string }>
}

const endingTypeMeta: Record<EndingType, EndingMeta> = {
  good: {
    label: '好结局',
    color: 'bg-gold-400/10 text-gold-400 border border-gold-400/30',
    iconBg: 'bg-gold-400/15 border border-gold-400/30',
    iconColor: 'text-gold-400',
    Icon: Star,
  },
  bad: {
    label: '坏结局',
    color: 'bg-primary/10 text-primary border border-primary/30',
    iconBg: 'bg-primary/15 border border-primary/30',
    iconColor: 'text-primary',
    Icon: X,
  },
  neutral: {
    label: '普通结局',
    color: 'bg-muted/50 text-muted-foreground border border-border/50',
    iconBg: 'bg-muted/60 border border-border/50',
    iconColor: 'text-foreground/70',
    Icon: Circle,
  },
  secret: {
    label: '隐藏结局',
    color: 'bg-cyber-magenta-500/10 text-cyber-magenta-500 border border-cyber-magenta-500/30',
    iconBg: 'bg-cyber-magenta-500/15 border border-cyber-magenta-500/30',
    iconColor: 'text-cyber-magenta-500',
    Icon: Lock,
  },
}

function EndingNodeComponent({ data, selected }: any) {
  const endingType = (data.endingType || 'neutral') as EndingType
  const meta = endingTypeMeta[endingType] || endingTypeMeta.neutral
  const TypeIcon = meta.Icon

  return (
    <div
      className={`min-w-[200px] max-w-[280px] rounded-[2px] border-2 bg-card transition-all relative hover:border-border clip-path-polygon-[0_0,calc(100%-12px)_0,100%_12px,100%_100%,0_100%] ${
        selected
          ? endingType === 'good'
            ? 'border-gold-400 shadow-[6px_6px_0_hsl(var(--gold)/0.28)]'
            : endingType === 'bad'
              ? 'border-primary shadow-[6px_6px_0_hsl(var(--primary)/0.28)]'
              : endingType === 'secret'
                ? 'border-cyber-magenta-500/60 shadow-[6px_6px_0_hsl(var(--cyber-magenta-500)/0.2)]'
                : 'border-border shadow-[6px_6px_0_hsl(var(--muted-foreground)/0.15)]'
          : endingType === 'good'
            ? 'border-border shadow-[4px_4px_0_hsl(var(--gold)/0.18)]'
            : endingType === 'bad'
              ? 'border-border shadow-[4px_4px_0_hsl(var(--primary)/0.18)]'
              : endingType === 'secret'
                ? 'border-border shadow-[4px_4px_0_hsl(var(--cyber-magenta-500)/0.12)]'
                : 'border-border shadow-[4px_4px_0_hsl(var(--muted-foreground)/0.1)]'
      }`}
    >
      {/* 左上印章装饰（旋转小角度的 P5 印章标签） */}
      <div className="absolute top-2 left-2 z-10 pointer-events-none">
        <div className={`text-[9px] px-1.5 py-0.5 rounded-[2px] rotate-[-4deg] font-semibold ${meta.color}`}>
          {meta.label}
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Top}
        className={`!w-4 !h-4 !rounded-full !z-20 !bg-card !border-2 !-top-2 !transition-all hover:!scale-125 hover:!shadow-lg dark:!bg-card ${
          endingType === 'good'
            ? '!border-gold-400 hover:!shadow-gold-400/30'
            : endingType === 'bad'
              ? '!border-primary hover:!shadow-primary/30'
              : endingType === 'secret'
                ? '!border-cyber-magenta-500/70 hover:!shadow-cyber-magenta-500/30'
                : '!border-muted-foreground/50 hover:!shadow-muted-foreground/30'
        }`}
      />

      <div className="pl-3.5 pr-3 pt-3 pb-3">
        {/* 顶部：类型图标 + 标题（去掉 badge，已改为印章装饰） */}
        <div className="flex items-center gap-1.5 mb-2 mt-4">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${meta.iconBg}`}>
            <TypeIcon className={`w-3.5 h-3.5 ${meta.iconColor}`} />
          </div>
          <p className="text-sm font-bold text-foreground truncate flex-1">
            {data.title || '未命名结局'}
          </p>
        </div>

        {/* 结局描述 */}
        <div className="bg-card/90 rounded-[2px] p-2 border border-border/40 shadow-[2px_2px_0_hsl(var(--muted-foreground)/0.1)]">
          <p className="text-xs text-foreground line-clamp-3 leading-relaxed">
            {data.text || '点击编辑结局描述...'}
          </p>
        </div>

        {/* 类型标识小图标 */}
        <div className="flex items-center justify-end mt-1.5">
          <Flag className={`w-3 h-3 ${meta.iconColor}`} />
        </div>
      </div>
    </div>
  )
}

export const EndingNode = memo(EndingNodeComponent, areNodesEqual)
