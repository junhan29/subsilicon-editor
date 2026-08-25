/** B3. 陈列 Tab（内部双子 Tab：陈列 / 上传到自由集市） */
import React, { useMemo, useState } from 'react'
import type { Booth, BoothWorkEntry } from '@editor/lib/booth/types'
import type { StoredWork } from '@editor/lib/local-db/work-store'
import type { LocalAccount } from '@editor/lib/local-account-store'
import { DisplayFilterBar, type WorkStatusFilter } from './display/display-filter-bar'
import { WorkGrid, type WorkGridItem, type WorkStatus } from './display/work-grid'
import { DisplayPreviewPanel } from './display/display-preview-panel'
import { UploadToMarketplaceTab } from './display/upload-to-marketplace-tab'
import { showToast } from '@editor/components/editor/toast'
import type { WorkDocument } from '@editor/types/work'

export type DisplaySubTab = 'list' | 'upload'

export interface DisplayTabProps {
  booth: Booth
  works: StoredWork[]
  account: Omit<LocalAccount, 'passwordHash'> | null
  highlightDownloadLinks?: boolean
  onActionGlobal: (act: 'pack' | 'edit' | 'upload' | 'copyId', workId: string) => void
  onCreateWork: () => void
}

type WorkEntryMap = Record<string, BoothWorkEntry>

const isDoc = (d: any): d is WorkDocument => !!d && typeof d === 'object' && 'meta' in d

const statusOf = (work: StoredWork, booth: Booth): WorkStatus => {
  // 摊位已发布到某墙且作品在 order 中 => published
  if (booth.sync?.walls && booth.sync.walls.length > 0) {
    return 'published'
  }
  return 'draft'
}

export function DisplayTab({
  booth,
  works,
  account,
  highlightDownloadLinks,
  onActionGlobal,
  onCreateWork,
}: DisplayTabProps) {
  const [sub, setSub] = useState<DisplaySubTab>(highlightDownloadLinks ? 'upload' : 'list')
  const [status, setStatus] = useState<WorkStatusFilter>('all')
  const [search, setSearch] = useState('')
  const [selId, setSelId] = useState<string | null>(null)

  const entryMap: WorkEntryMap = useMemo(() => {
    const m: WorkEntryMap = {}
    for (const e of booth.works) m[e.workId] = e
    return m
  }, [booth.works])

  const orderIndex: Record<string, number> = useMemo(() => {
    const r: Record<string, number> = {}
    booth.display.order.forEach((id, i) => (r[id] = i))
    return r
  }, [booth.display.order])

  const gridItems: WorkGridItem[] = useMemo(() => {
    const items = works
      .filter((w) => entryMap[w.id])
      .map((w): WorkGridItem | null => {
        const entry = entryMap[w.id]
        const st = statusOf(w, booth)
        if (status !== 'all' && st !== status) return null

        const docMetaTags: string[] = []
        const docMetaDesc = ''
        let coverMaybe: string | null = w.thumbnail || null
        let authorMaybe: string = booth.creator.handle || '未署名作者'
        let priceMaybe: string | undefined
        const titleRaw = w.name || '（未命名）'

        const ed = w.editorData
        if (isDoc(ed)) {
          const mt = ed.meta
          if (mt?.tags && Array.isArray(mt.tags)) {
            for (const t of mt.tags) if (typeof t === 'string') docMetaTags.push(t)
          }
          if (mt?.coverImage && !coverMaybe) coverMaybe = mt.coverImage
          if (mt?.creatorName) authorMaybe = mt.creatorName
          // 整本书售价
          const pr = entry.pricing
          if (pr.override && typeof pr.whole === 'number') {
            priceMaybe = '¥' + String(pr.whole)
          }
        }

        const q = search.trim().toLowerCase()
        if (q) {
          const hay = (
            titleRaw + ' ' + authorMaybe + ' ' + docMetaTags.join(' ') + ' ' + docMetaDesc
          ).toLowerCase()
          if (!hay.includes(q)) return null
        }

        return {
          work: w,
          entry,
          status: st,
          tags: docMetaTags.slice(0, 5),
          author: authorMaybe,
          title: titleRaw,
          cover: coverMaybe,
          price: priceMaybe,
          createdAt: Number(w.updatedAt || w.createdAt || 0),
          isFeatured: booth.display.featuredId === w.id,
        }
      })
      .filter((x): x is WorkGridItem => !!x)
    items.sort((a, b) => {
      const ai = orderIndex[a.work.id] ?? 99999
      const bi = orderIndex[b.work.id] ?? 99999
      if (ai !== bi) return ai - bi
      return b.createdAt - a.createdAt
    })
    return items
  }, [works, entryMap, status, search, booth, orderIndex])

  const statusCounts = useMemo(() => {
    const base: Record<WorkStatusFilter, number> = {
      all: works.filter((w) => entryMap[w.id]).length,
      published: 0,
      draft: 0,
      review: 0,
    }
    for (const w of works) {
      if (!entryMap[w.id]) continue
      base[statusOf(w, booth)] += 1
    }
    return base
  }, [works, entryMap, booth])

  const selected = useMemo(
    () => gridItems.find((it) => it.work.id === selId) || null,
    [gridItems, selId]
  )

  const onAction = (a: 'pack' | 'edit' | 'upload' | 'copyId', workId: string) => {
    if (a === 'copyId') {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          void navigator.clipboard.writeText(workId)
        }
        showToast('success', '作品 ID 已复制')
        return
      } catch { /* ignore */ }
    }
    if (a === 'upload') { setSub('upload'); return }
    onActionGlobal(a, workId)
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-5 pt-5 pb-3">
        <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5 mb-4">
          {(
            [
              ['list', '陈列'],
              ['upload', '上传到自由集市'],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setSub(k)}
              className={
                'px-4 py-1.5 text-xs rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 ' +
                (sub === k
                  ? 'bg-card text-white shadow-sm'
                  : 'text-muted-foreground hover:text-white')
              }
            >
              {l}
            </button>
          ))}
        </div>

        {sub === 'list' && (
          <DisplayFilterBar
            statusCounts={statusCounts}
            status={status}
            onStatusChange={setStatus}
            search={search}
            onSearchChange={setSearch}
            onCreateWork={onCreateWork}
          />
        )}
      </div>

      {sub === 'list' && (
        <div className="flex flex-1 min-h-0 gap-0">
          <div className="flex-1 min-w-0 overflow-y-auto px-5 pb-6">
            <WorkGrid
              items={gridItems}
              selectedId={selId}
              onSelect={setSelId}
              onAction={onAction}
              onCreateFirst={onCreateWork}
            />
          </div>
          <DisplayPreviewPanel item={selected} onAction={onAction} />
        </div>
      )}

      {sub === 'upload' && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <UploadToMarketplaceTab
            booth={booth}
            works={works.filter((w) => entryMap[w.id])}
            account={account}
            highlightDownloadLinks={highlightDownloadLinks}
          />
        </div>
      )}
    </div>
  )
}
