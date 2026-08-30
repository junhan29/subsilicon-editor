/** B3a. 作品网格卡 */
import React from 'react'
import { Star, Package, Edit3, UploadCloud, Copy, Check } from 'lucide-react'
import type { StoredWork } from '@editor/lib/local-db/work-store'
import type { Booth, BoothWorkEntry } from '@editor/lib/booth/types'
import { EmptyBoothSvg } from '../../shared/svg-illustrations'

export type WorkStatus = 'published' | 'draft' | 'review'

export interface WorkGridItem {
  work: StoredWork
  entry: BoothWorkEntry
  status: WorkStatus
  tags: string[]
  author: string
  title: string
  cover?: string | null
  price?: string
  createdAt: number
  isFeatured: boolean
}

export interface WorkGridProps {
  items: WorkGridItem[]
  selectedId: string | null
  onSelect: (workId: string) => void
  onAction: (action: 'pack' | 'edit' | 'upload' | 'copyId', workId: string) => void
  onCreateFirst: () => void
}

const WORK_TYPE_NAMES: Record<string, string> = {
  'interactive-narrative': '互动叙事',
  novel: '小说',
  video: '视频',
  comic: '漫画',
}

const STATUS_META: Record<WorkStatus, { label: string; cls: string }> = {
  published: { label: '已发布', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  draft: { label: '草稿', cls: 'bg-muted-foreground/15 text-muted-foreground border-border' },
  review: { label: '未审核', cls: 'bg-gold-400/15 text-gold-400 border-gold-400/30' },
}

export function WorkGrid({
  items,
  selectedId,
  onSelect,
  onAction,
  onCreateFirst,
}: WorkGridProps) {
  if (items.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center">
        <EmptyBoothSvg className="w-64 h-44 mb-5 opacity-90" />
        <h4 className="text-sm font-medium text-white mb-1">摊位上还没有陈列作品</h4>
        <p className="text-xs text-muted-foreground max-w-sm text-center mb-5 leading-relaxed">
          你的摊位正空空如也。点击下方「新建第一个作品」按钮，把已有作品上架到陈列，
          或先前往编辑器创作一个作品。
        </p>
        <button
          onClick={onCreateFirst}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <Star className="w-3.5 h-3.5" />
          新建第一个作品
        </button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
      {items.map((it) => {
        const sel = it.work.id === selectedId
        const st = STATUS_META[it.status]
        return (
          <div
            key={it.work.id}
            onClick={() => onSelect(it.work.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(it.work.id)
              }
            }}
            className={
              'group relative rounded-xl overflow-hidden border cursor-pointer transition-all duration-150 bg-muted/30 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/40 ' +
              (sel
                ? 'border-primary/60 ring-2 ring-primary/25 -translate-y-0.5'
                : 'border-border hover:border-primary/40 hover:-translate-y-0.5')
            }
          >
            {/* 封面 */}
            <div className="relative aspect-[16/10] bg-gradient-to-br from-secondary via-muted to-card overflow-hidden">
              {it.cover ? (
                <img
                  src={it.cover}
                  alt={it.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center opacity-40">
                  <span className="text-3xl font-black text-muted-foreground/40">
                    {it.title.slice(0, 1) || '?'}
                  </span>
                </div>
              )}
              {it.isFeatured && (
                <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-gold-400 text-black shadow-sm">
                  <Star className="w-3 h-3" fill="currentColor" />
                  主推
                </span>
              )}
              <span
                className={
                  'absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full border ' +
                  st.cls
                }
              >
                {st.label}
              </span>
              {it.price && (
                <span className="absolute bottom-2 right-2 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-black/50 backdrop-blur-sm text-white">
                  {it.price}
                </span>
              )}
            </div>

            <div className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h5
                  className="text-sm font-medium text-white truncate"
                  title={it.title}
                >
                  {it.title}
                </h5>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {WORK_TYPE_NAMES[it.entry.workType] || it.entry.workType}
                </span>
              </div>

              {it.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {it.tags.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className="text-[9px] px-1.5 py-px rounded-full bg-muted-foreground/10 text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                  {it.tags.length > 3 && (
                    <span className="text-[9px] px-1 py-px text-muted-foreground">
                      +{String(it.tags.length - 3)}
                    </span>
                  )}
                </div>
              )}

              <div className="pt-1 flex items-center justify-between border-t border-border/60">
                <span className="text-[10px] text-muted-foreground">
                  {new Date(it.createdAt).toLocaleDateString('zh-CN')}
                </span>
                {/* 动作条 */}
                <div
                  className="flex items-center gap-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  {([
                    ['pack', Package, '打包'],
                    ['edit', Edit3, '编辑'],
                    ['upload', UploadCloud, '上传'],
                    ['copyId', Copy, '复制 ID'],
                  ] as const).map(([k, Icon, tip]) => (
                    <button
                      key={k}
                      title={tip}
                      onClick={() => onAction(k, it.work.id)}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <span title={tip}><Icon className="w-3.5 h-3.5" /></span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
