/** B3a. 右侧预览联动面板（点击卡片后显示详情） */
import React, { useState } from 'react'
import {
  Package,
  Edit3,
  UploadCloud,
  Copy,
  Check,
  Star,
  Tag,
  Calendar,
} from 'lucide-react'
import type { WorkGridItem } from './work-grid'
import { EmptyPreviewSvg } from '../../shared/svg-illustrations'
import { showToast } from '@editor/components/editor/toast'

export interface DisplayPreviewPanelProps {
  item: WorkGridItem | null
  onAction: (action: 'pack' | 'edit' | 'upload' | 'copyId', workId: string) => void
}

const WORK_TYPE_NAMES: Record<string, string> = {
  'interactive-narrative': '互动叙事',
  novel: '小说',
  video: '视频',
  comic: '漫画',
}

export function DisplayPreviewPanel({
  item,
  onAction,
}: DisplayPreviewPanelProps) {
  const [copied, setCopied] = useState(false)

  if (!item) {
    return (
      <aside className="w-[280px] shrink-0 border-l border-border bg-card/40 p-5 flex flex-col items-center justify-center text-center">
        <EmptyPreviewSvg className="w-40 h-52 mb-4 opacity-80" />
        <h4 className="text-sm font-medium text-white mb-1">预览联动面板</h4>
        <p className="text-xs text-muted-foreground leading-relaxed">
          选择左侧任一作品，在此处查看封面、标题、简介、标签与快捷操作。
        </p>
      </aside>
    )
  }

  const onCopyId = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        void navigator.clipboard.writeText(item.work.id)
      }
      setCopied(true)
      showToast('success', '作品 ID 已复制')
      setTimeout(() => setCopied(false), 1400)
    } catch {
      /* ignore */
    }
  }

  return (
    <aside className="w-[280px] shrink-0 border-l border-border bg-card/40 p-4 flex flex-col overflow-y-auto">
      <div className="rounded-xl overflow-hidden border border-border bg-muted/30 aspect-[4/3] mb-3 shrink-0">
        {item.cover ? (
          <img src={item.cover} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary to-muted">
            <span className="text-4xl font-black text-muted-foreground/30">
              {item.title.slice(0, 1) || '?'}
            </span>
          </div>
        )}
      </div>

      <h3 className="text-sm font-semibold text-white mb-1 leading-snug break-words">
        {item.title}
      </h3>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-[10px] px-1.5 py-px rounded-full bg-muted-foreground/10 text-muted-foreground">
          {WORK_TYPE_NAMES[item.entry.workType] || item.entry.workType}
        </span>
        {item.isFeatured && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-gold-400">
            <Star className="w-3 h-3" fill="currentColor" />
            主推
          </span>
        )}
        {item.price && (
          <span className="text-[10px] text-emerald-400">{item.price}</span>
        )}
      </div>

      <div className="space-y-2 text-xs mb-4">
        <div className="flex items-start gap-1.5">
          <Calendar className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
          <span className="text-muted-foreground">
            创建：{new Date(item.createdAt).toLocaleString('zh-CN')}
          </span>
        </div>
        {item.tags.length > 0 && (
          <div className="flex items-start gap-1.5">
            <Tag className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex flex-wrap gap-1">
              {item.tags.map((t) => (
                <span
                  key={t}
                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted-foreground/10 text-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
        <div>
          <span className="text-[10px] text-muted-foreground">作者：</span>
          <span className="text-[11px] text-foreground">{item.author}</span>
        </div>
      </div>

      <div className="mt-auto space-y-1.5">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => onAction('pack', item.work.id)}
            className="flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] border border-border text-foreground hover:bg-muted rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <Package className="w-3 h-3" />
            打包
          </button>
          <button
            onClick={() => onAction('edit', item.work.id)}
            className="flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] border border-border text-foreground hover:bg-muted rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <Edit3 className="w-3 h-3" />
            编辑
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => onAction('upload', item.work.id)}
            className="flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] bg-primary hover:bg-primary/90 text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <UploadCloud className="w-3 h-3" />
            上传
          </button>
          <button
            onClick={onCopyId}
            className="flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] border border-border text-foreground hover:bg-muted rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                已复制
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                复制 ID
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  )
}
