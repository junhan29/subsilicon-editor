/**
 * 漫画编辑器（ComicEditor）
 *
 * 分镜画格创作：素材导入 → 画格列表 → 画格属性（背景图/台词/旁白/付费）→
 * 付费设置（试读前 N 格/整本价）→ 导出（翻页 HTML / 长条 HTML / ZIP / 试看）。
 *
 * 数据存放于 WorkDocument.extra.comic，保存走 saveWork。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Download,
  Eye,
  GripVertical,
  Image as ImageIcon,
  Lock,
  MessageSquare,
  Plus,
  Quote,
  Send,
  Smartphone,
  Trash2,
  Unlock,
  Upload,
  X,
} from 'lucide-react'
import type { StoredWork } from '@editor/lib/local-db/work-store'
import type { WorkDocument } from '@editor/types/work'
import { getGraphFromWork, saveWork } from '@editor/lib/local-db/work-store'
import { getAsset, saveAsset } from '@editor/lib/local-db/asset-store'
import {
  type ComicAssetRef,
  type ComicData,
  type ComicDialogue,
  type ComicPanel,
  countComicPages,
  countComicPanels,
  countPaidPanels,
  createEmptyComicData,
  generateDialogueId,
  generatePanelId,
  getComicData,
  withComicData,
} from '@editor/lib/work-types/comic'
import {
  exportComicPreviewHTML,
  exportComicToFlipHTML,
  exportComicToScrollHTML,
  exportComicToZip,
} from '@editor/lib/export-comic'
import { detectMediaType, generateHash, validateFileSize } from '@editor/lib/media-processor'
import { CreatorCenterDialog } from './creator-center-dialog'
import { showToast } from './toast'

interface ComicEditorProps {
  work: StoredWork
  onBack: () => void
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || '未命名漫画'
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** 画格内容预览（选中画格渲染） */
function PanelPreview({ panel, assetSrc }: { panel: ComicPanel | null; assetSrc: string | null }) {
  if (!panel) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <ImageIcon className="w-8 h-8 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium mb-1">从左侧素材库开始创作漫画</p>
          <p className="text-xs text-muted-foreground">导入图片作为画格背景，添加台词与旁白</p>
        </div>
      </div>
    )
  }
  return (
    <div className="max-w-md mx-auto">
      <div className="relative rounded-xl overflow-hidden border border-border bg-white shadow-lg">
        <img
          src={assetSrc || 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="100%" height="100%" fill="#f0f0f0"/><text x="50%" y="50%" fill="#bbb" font-size="20" text-anchor="middle">未选择素材</text></svg>')}
          alt=""
          className="w-full max-h-[52vh] object-contain"
        />
        {panel.narration && (
          <div className="absolute left-3 right-3 bottom-2.5 bg-[#fff8e6]/95 rounded-lg px-3 py-2 text-xs text-amber-900 leading-relaxed">
            {panel.narration}
          </div>
        )}
      </div>
      <div className="mt-2 space-y-1.5">
        {(panel.dialogues || []).filter((d) => d.text).map((d) => (
          <div key={d.id} className="inline-block max-w-[85%] bg-background border-2 border-foreground/80 rounded-xl px-3 py-1.5 text-sm leading-snug">
            {d.speaker && <span className="block text-[10px] font-bold text-amber-700 mb-0.5">{d.speaker}</span>}
            {d.text}
          </div>
        ))}
      </div>
    </div>
  )
}

export function ComicEditor({ work, onBack }: ComicEditorProps) {
  const initialData = useMemo<ComicData>(() => {
    const doc = work.editorData as WorkDocument
    return getComicData(doc)
  }, [work])

  const [data, setData] = useState<ComicData>(() => ({
    ...createEmptyComicData(),
    ...initialData,
    panels: [...(initialData.panels || [])].sort((a, b) => a.page - b.page || a.order - b.order),
    assets: [...(initialData.assets || [])],
  }))
  const [title, setTitle] = useState(() => {
    const doc = work.editorData as WorkDocument
    return doc.meta?.title || work.name || '未命名漫画'
  })
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(
    () => (initialData.panels?.[0]?.id || null)
  )
  const [saving, setSaving] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [exportDone, setExportDone] = useState<string | null>(null)
  const [showCreatorCenter, setShowCreatorCenter] = useState(false)
  const [unlockCode, setUnlockCode] = useState('')
  const [assetSrc, setAssetSrc] = useState<string | null>(null)
  const saveTimer = useRef<number | null>(null)
  const pendingRef = useRef<{ data: ComicData; title: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const doc = useMemo(() => work.editorData as WorkDocument, [work])

  const selectedPanel = useMemo(
    () => data.panels.find((p) => p.id === selectedPanelId) || null,
    [data.panels, selectedPanelId]
  )

  const panelCount = useMemo(() => countComicPanels(data), [data])
  const pageCount = useMemo(() => countComicPages(data), [data])
  const paidCount = useMemo(() => countPaidPanels(data), [data])

  // 保存（防抖）
  const persist = useCallback(
    (next: ComicData, nextTitle: string) => {
      const updatedDoc: WorkDocument = withComicData(doc, next)
      updatedDoc.meta = { ...updatedDoc.meta, title: nextTitle, updatedAt: Date.now() }
      updatedDoc.graph.title = nextTitle
      const updated: StoredWork = {
        ...work,
        name: nextTitle,
        updatedAt: Date.now(),
        lastOpened: Date.now(),
        nodeCount: next.panels.length,
        edgeCount: 0,
        workType: 'comic',
        editorData: updatedDoc,
      }
      void saveWork(updated)
    },
    [doc, work]
  )

  const scheduleSave = useCallback(
    (next: ComicData, nextTitle: string) => {
      pendingRef.current = { data: next, title: nextTitle }
      setSaving(true)
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => {
        pendingRef.current = null
        persist(next, nextTitle)
        setSaving(false)
      }, 600)
    },
    [persist]
  )

  useEffect(() => {
    const flushPending = () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      // 卸载/关窗前 flush 未保存的编辑：防抖窗口内的修改必须落盘，
      // 否则用户返回列表即丢数据（React 卸载清理在窗口关闭时不会运行）
      if (pendingRef.current) {
        persist(pendingRef.current.data, pendingRef.current.title)
      }
    }
    window.addEventListener('beforeunload', flushPending)
    return () => {
      window.removeEventListener('beforeunload', flushPending)
      flushPending()
    }
  }, [persist])

  // 选中画格素材预览
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!selectedPanel?.assetHash) {
        setAssetSrc(null)
        return
      }
      const asset = await getAsset(selectedPanel.assetHash)
      if (cancelled) return
      setAssetSrc(asset ? URL.createObjectURL(asset.blob) : null)
    })()
    return () => { cancelled = true }
  }, [selectedPanel?.assetHash, selectedPanelId])

  // 素材导入（仅图片）
  const handleImportFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const refs: ComicAssetRef[] = []
    let skipped = 0
    for (const file of Array.from(files)) {
      const mediaType = detectMediaType(file)
      if (mediaType !== 'image') {
        skipped++
        continue
      }
      const check = validateFileSize(file, 'image')
      if (!check.valid) {
        showToast('error', check.message || '文件过大')
        skipped++
        continue
      }
      const hash = generateHash(file)
      try {
        await saveAsset(file, hash, { name: file.name, type: file.type, size: file.size })
      } catch (err) {
        // 单个素材存储失败（如超出配额）不中断整体导入，已导入素材不受影响
        showToast('error', `素材「${file.name}」保存失败：${err instanceof Error ? err.message : String(err)}`)
        skipped++
        continue
      }
      refs.push({
        hash,
        name: file.name,
        type: 'image',
        mime: file.type,
        thumbnail: URL.createObjectURL(file),
        size: file.size,
      })
    }
    if (refs.length > 0) {
      setData((prev) => {
        const assets = [...prev.assets]
        for (const r of refs) {
          const i = assets.findIndex((a) => a.hash === r.hash)
          if (i >= 0) assets[i] = r
          else assets.push(r)
        }
        const next: ComicData = { ...prev, assets }
        scheduleSave(next, title)
        return next
      })
      showToast('success', `已导入 ${refs.length} 个图片素材${skipped > 0 ? `，跳过 ${skipped} 个非图片` : ''}`)
    } else if (skipped > 0) {
      showToast('error', '漫画画格仅支持图片素材')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // 新增画格（默认追加到最后一页或新页）
  const addPanel = () => {
    const lastPage = data.panels.reduce((max, p) => Math.max(max, p.page), 0)
    const samePageCount = data.panels.filter((p) => p.page === lastPage).length
    const page = lastPage > 0 && samePageCount < 4 ? lastPage : lastPage + 1
    const order = data.panels.filter((p) => p.page === page).length
    const panel: ComicPanel = {
      id: generatePanelId(),
      page,
      order,
      dialogues: [],
      narration: '',
      paid: false,
    }
    const next: ComicData = { ...data, panels: [...data.panels, panel] }
    setData(next)
    scheduleSave(next, title)
    setSelectedPanelId(panel.id)
  }

  const deletePanel = (id: string) => {
    // 删除后按 (page, order) 语义重建：order 是页内顺序，每页内从 0 重编号，
    // 保证编辑器显示与导出排序一致（此前全局重编号导致同页 order 空洞/重复）
    const nextPanels = data.panels.filter((p) => p.id !== id)
    const pageOrder = new Map<number, number>()
    const panels = nextPanels.map((p) => {
      const o = pageOrder.get(p.page) || 0
      pageOrder.set(p.page, o + 1)
      return { ...p, order: o }
    })
    const next: ComicData = { ...data, panels }
    setData(next)
    scheduleSave(next, title)
    if (selectedPanelId === id) setSelectedPanelId(panels[0]?.id || null)
  }

  const movePanel = (id: string, dir: -1 | 1) => {
    // 在 (page, order) 排序列表上移动，再按页重建 order。
    // 此前在扁平数组上相邻交换并全局重编号，跨页移动后数组顺序
    // 与导出端 (page, order) 排序不一致，编辑器显示 ≠ 读者所见。
    const sorted = [...data.panels].sort((a, b) => a.page - b.page || a.order - b.order)
    const sIdx = sorted.findIndex((p) => p.id === id)
    const target = sIdx + dir
    if (sIdx < 0 || target < 0 || target >= sorted.length) return
    ;[sorted[sIdx], sorted[target]] = [sorted[target], sorted[sIdx]]
    const pageOrder = new Map<number, number>()
    const panels = sorted.map((p) => {
      const o = pageOrder.get(p.page) || 0
      pageOrder.set(p.page, o + 1)
      return { ...p, order: o }
    })
    const next: ComicData = { ...data, panels }
    setData(next)
    scheduleSave(next, title)
  }

  const updatePanel = (id: string, patch: Partial<ComicPanel>) => {
    const patched = data.panels.map((p) => (p.id === id ? { ...p, ...patch } : p))
    // 页码变更后按 (page, order) 语义重建：保证页内 order 从 0 连续编号、
    // 不因挪动/合并产生重复或空洞，编辑器显示与导出排序一致。
    let panels = patched
    if (patch.page !== undefined) {
      const pageOrder = new Map<number, number>()
      panels = [...patched].sort((a, b) => a.page - b.page || a.order - b.order).map((p) => {
        const o = pageOrder.get(p.page) || 0
        pageOrder.set(p.page, o + 1)
        return { ...p, order: o }
      })
    }
    const next: ComicData = { ...data, panels }
    setData(next)
    scheduleSave(next, title)
  }

  const addDialogue = () => {
    if (!selectedPanel) return
    const d: ComicDialogue = { id: generateDialogueId(), speaker: '', text: '' }
    updatePanel(selectedPanel.id, { dialogues: [...(selectedPanel.dialogues || []), d] })
  }

  const updateDialogue = (did: string, patch: Partial<ComicDialogue>) => {
    if (!selectedPanel) return
    updatePanel(selectedPanel.id, {
      dialogues: (selectedPanel.dialogues || []).map((d) => (d.id === did ? { ...d, ...patch } : d)),
    })
  }

  const removeDialogue = (did: string) => {
    if (!selectedPanel) return
    updatePanel(selectedPanel.id, {
      dialogues: (selectedPanel.dialogues || []).filter((d) => d.id !== did),
    })
  }

  const updateData = (patch: Partial<ComicData>) => {
    const next: ComicData = { ...data, ...patch }
    setData(next)
    scheduleSave(next, title)
  }

  // 导出
  const resolveAssetForExport = useCallback(async (hash: string): Promise<string | null> => {
    const asset = await getAsset(hash)
    if (!asset) return null
    try {
      return await blobToDataURL(asset.blob)
    } catch {
      return null
    }
  }, [])

  const handleExport = async (format: 'flip' | 'scroll' | 'zip' | 'preview') => {
    const safeTitle = sanitizeFilename(title)
    try {
      let filename = ''
      if (format === 'flip') {
        const html = await exportComicToFlipHTML(data, title, resolveAssetForExport, {
          author: data.author,
          unlockCode: unlockCode.trim() || undefined,
        })
        filename = `${safeTitle}.html`
        triggerDownload(new Blob([html], { type: 'text/html;charset=utf-8' }), filename)
        showToast('success', '已生成「左右翻页」阅读文件')
      } else if (format === 'scroll') {
        const html = await exportComicToScrollHTML(data, title, resolveAssetForExport, {
          author: data.author,
          unlockCode: unlockCode.trim() || undefined,
        })
        filename = `${safeTitle}-长条.html`
        triggerDownload(new Blob([html], { type: 'text/html;charset=utf-8' }), filename)
        showToast('success', '已生成「上下滑动」阅读文件')
      } else if (format === 'zip') {
        const blob = await exportComicToZip(data, title, resolveAssetForExport, {
          author: data.author,
          unlockCode: unlockCode.trim() || undefined,
        })
        filename = `${safeTitle}.zip`
        triggerDownload(blob, filename)
        showToast('success', '已生成素材包 ZIP')
      } else {
        const html = await exportComicPreviewHTML(data, title, resolveAssetForExport)
        filename = `${safeTitle}-试看.html`
        triggerDownload(new Blob([html], { type: 'text/html;charset=utf-8' }), filename)
        showToast('success', '已生成试看效果')
      }
      setShowExport(false)
      setExportDone(filename)
    } catch (err) {
      showToast('error', `导出失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* 顶部工具栏 */}
      <header className="flex items-center gap-3 px-4 h-14 border-b border-border shrink-0 bg-card/80 backdrop-blur">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            scheduleSave(data, e.target.value)
          }}
          className="flex-1 max-w-md px-2.5 py-1.5 text-sm font-medium bg-transparent border border-transparent hover:border-border focus:border-primary focus:bg-background rounded-lg outline-none transition-colors"
          placeholder="漫画标题"
        />
        <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {panelCount} 格 · {pageCount} 页
          {paidCount > 0 && <span className="text-amber-600">· {paidCount} 付费</span>}
          {saving && <span className="text-muted-foreground/60">（保存中…）</span>}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowCreatorCenter(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            title="把作品提交到自由集市"
          >
            <Send className="w-3.5 h-3.5" />
            发布作品
          </button>
          <button
            onClick={() => setShowExport((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
          >
            <Download className="w-3.5 h-3.5" />
            导出
          </button>
        </div>
      </header>

      {/* 导出完成引导 */}
      {exportDone && (
        <div className="px-4 py-2.5 border-b border-emerald-500/30 bg-emerald-500/10 flex items-start gap-2 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="text-emerald-700 font-medium">已生成「{exportDone}」</span>
            <span className="text-muted-foreground">，文件保存在浏览器的「下载」目录里。把这个文件上传到你常发布作品的地方，读者就能直接阅读。</span>
          </div>
          <button
            onClick={() => setExportDone(null)}
            className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 导出面板 */}
      {showExport && (
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground">导出为哪种形式？</span>
            <button
              onClick={() => setShowExport(false)}
              className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <button
              onClick={() => handleExport('flip')}
              className="flex flex-col items-start gap-1 px-3 py-2.5 text-left bg-background border border-border rounded-lg hover:border-primary/50 hover:bg-background transition-colors"
            >
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <BookOpen className="w-3.5 h-3.5 text-primary" />
                左右翻页阅读
                <span className="text-[10px] text-primary bg-primary/10 rounded-full px-1.5 py-0.5">推荐</span>
              </span>
              <span className="text-[11px] text-muted-foreground leading-snug">一页一页翻，适合电脑上阅读</span>
            </button>
            <button
              onClick={() => handleExport('scroll')}
              className="flex flex-col items-start gap-1 px-3 py-2.5 text-left bg-background border border-border rounded-lg hover:border-primary/50 hover:bg-background transition-colors"
            >
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <Smartphone className="w-3.5 h-3.5 text-primary" />
                上下滑动阅读
              </span>
              <span className="text-[11px] text-muted-foreground leading-snug">一直往下滑，适合手机上看</span>
            </button>
            <button
              onClick={() => handleExport('zip')}
              className="flex flex-col items-start gap-1 px-3 py-2.5 text-left bg-background border border-border rounded-lg hover:border-primary/50 hover:bg-background transition-colors"
            >
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <Archive className="w-3.5 h-3.5 text-muted-foreground" />
                素材包 ZIP
              </span>
              <span className="text-[11px] text-muted-foreground leading-snug">页面和图片打包，方便自己保存</span>
            </button>
            <button
              onClick={() => handleExport('preview')}
              className="flex flex-col items-start gap-1 px-3 py-2.5 text-left bg-background border border-border rounded-lg hover:border-primary/50 hover:bg-background transition-colors"
            >
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                试看效果
              </span>
              <span className="text-[11px] text-muted-foreground leading-snug">先看看读者能免费看到什么</span>
            </button>
          </div>
          <div className="mt-2.5 flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              付费解锁码
              <input
                value={unlockCode}
                onChange={(e) => setUnlockCode(e.target.value)}
                placeholder="可选"
                className="w-28 px-2 py-1 text-[11px] rounded border border-border bg-background"
              />
            </label>
            <span className="text-[11px] text-muted-foreground/70">付费画格的读者需要输入这个码才能解锁；留空则付费画格自动隐藏。</span>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* 素材库 */}
        <aside className="w-56 border-r border-border flex flex-col shrink-0 bg-card/40">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
            <span className="text-xs font-semibold text-muted-foreground">素材库</span>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2 py-1 text-[11px] bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors"
            >
              <Upload className="w-3 h-3" />
              导入
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => handleImportFiles(e.target.files)}
          />
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {data.assets.length === 0 ? (
              <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                导入图片素材
                <br />
                作为画格背景
              </div>
            ) : (
              data.assets.map((asset) => (
                <div
                  key={asset.hash}
                  onClick={() => {
                    if (selectedPanel) {
                      updatePanel(selectedPanel.id, { assetHash: asset.hash, assetName: asset.name })
                      showToast('success', `已将「${asset.name}」设为画格背景`)
                    } else {
                      showToast('info', '先新增或选择一个画格，再点素材即可设为背景')
                    }
                  }}
                  className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg border border-border bg-background hover:border-primary/40 transition-colors ${
                    selectedPanel ? 'cursor-pointer' : 'cursor-default opacity-80'
                  }`}
                  title={selectedPanel ? '设为当前画格背景' : '先选择一个画格'}
                >
                  <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {asset.thumbnail ? (
                      <img src={asset.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium truncate">{asset.name}</div>
                    <div className="text-[10px] text-muted-foreground/60">图片</div>
                  </div>
                  <span className="opacity-0 group-hover:opacity-100 text-[10px] text-primary shrink-0 transition-opacity">
                    {selectedPanel ? '设为背景' : ''}
                  </span>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-border p-2.5 shrink-0">
            <button
              onClick={addPanel}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-2 text-xs bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              新增画格
            </button>
          </div>
        </aside>

        {/* 画格预览 + 列表 */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5">
            <div className="max-w-3xl mx-auto h-full">
              <PanelPreview panel={selectedPanel} assetSrc={assetSrc} />
            </div>
          </div>

          {/* 画格列表 */}
          <div className="border-t border-border shrink-0 max-h-44 overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-xs font-semibold text-muted-foreground">画格</span>
              <span className="text-[10px] text-muted-foreground/60">共 {panelCount} 格 · {pageCount} 页</span>
            </div>
            {data.panels.length === 0 ? (
              <div className="px-4 pb-4 text-center text-xs text-muted-foreground">
                点击左侧「新增画格」开始创作
              </div>
            ) : (
              <div className="px-3 pb-3 space-y-1.5">
                {[...data.panels]
                  .sort((a, b) => a.page - b.page || a.order - b.order)
                  .map((panel, i) => (
                  <div
                    key={panel.id}
                    onClick={() => setSelectedPanelId(panel.id)}
                    className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer border transition-colors ${
                      selectedPanelId === panel.id
                        ? 'bg-primary/10 border-primary/25'
                        : 'border-transparent hover:bg-muted/60'
                    }`}
                  >
                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                    <span className="text-[10px] text-muted-foreground/50 w-6 shrink-0">P{panel.page}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium truncate">
                        {panel.assetName || panel.narration || `画格 ${i + 1}`}
                      </span>
                      <span className="ml-2 text-[10px] text-muted-foreground/50">
                        {panel.dialogues.filter((d) => d.text).length} 句台词
                      </span>
                    </div>
                    {panel.paid && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600">
                        <Lock className="w-2.5 h-2.5" />¥{panel.price || 0}
                      </span>
                    )}
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); movePanel(panel.id, -1) }}
                        disabled={i === 0}
                        className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 rounded"
                        title="左移"
                      >
                        ←
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); movePanel(panel.id, 1) }}
                        disabled={i === data.panels.length - 1}
                        className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 rounded"
                        title="右移"
                      >
                        →
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deletePanel(panel.id) }}
                        className="p-1 text-muted-foreground hover:text-primary rounded"
                        title="删除画格"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* 画格属性 + 付费设置 */}
        <aside className="w-64 border-l border-border flex flex-col shrink-0 bg-card/40 overflow-y-auto">
          <div className="px-3 py-2.5 border-b border-border text-xs font-semibold text-muted-foreground shrink-0">
            画格属性
          </div>
          {selectedPanel ? (
            <div className="p-3 space-y-3">
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">页码</label>
                <input
                  type="number"
                  min={1}
                  value={selectedPanel.page}
                  onChange={(e) => updatePanel(selectedPanel.id, { page: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-background"
                />
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">背景素材</label>
                <select
                  value={selectedPanel.assetHash || ''}
                  onChange={(e) => {
                    const asset = data.assets.find((a) => a.hash === e.target.value)
                    updatePanel(selectedPanel.id, { assetHash: asset?.hash, assetName: asset?.name })
                  }}
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-background"
                >
                  <option value="">（未选择素材）</option>
                  {data.assets.map((a) => (
                    <option key={a.hash} value={a.hash}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> 台词
                  </label>
                  <button
                    onClick={addDialogue}
                    className="p-0.5 text-primary hover:bg-primary/10 rounded"
                    title="添加台词"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  {(selectedPanel.dialogues || []).map((d) => (
                    <div key={d.id} className="flex items-center gap-1">
                      <input
                        value={d.speaker || ''}
                        onChange={(e) => updateDialogue(d.id, { speaker: e.target.value })}
                        placeholder="说话人"
                        className="w-16 px-1.5 py-1 text-[10px] rounded border border-border bg-background"
                      />
                      <input
                        value={d.text}
                        onChange={(e) => updateDialogue(d.id, { text: e.target.value })}
                        placeholder="台词内容"
                        className="flex-1 min-w-0 px-1.5 py-1 text-[10px] rounded border border-border bg-background"
                      />
                      <button
                        onClick={() => removeDialogue(d.id)}
                        className="p-1 text-muted-foreground hover:text-primary rounded shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {(selectedPanel.dialogues || []).length === 0 && (
                    <div className="text-[10px] text-muted-foreground/60 px-1">暂无台词，点击 + 添加</div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
                  <Quote className="w-3 h-3" /> 旁白
                </label>
                <textarea
                  value={selectedPanel.narration || ''}
                  onChange={(e) => updatePanel(selectedPanel.id, { narration: e.target.value })}
                  placeholder="画格旁白文本"
                  rows={2}
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-background resize-none"
                />
              </div>

              <div className="pt-2 border-t border-border">
                <label className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    {selectedPanel.paid ? <Lock className="w-3 h-3 text-amber-600" /> : <Unlock className="w-3 h-3" />}
                    画格付费
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={selectedPanel.price ?? 0}
                    onChange={(e) => {
                      const price = Number(e.target.value) || 0
                      updatePanel(selectedPanel.id, { price, paid: price > 0 })
                    }}
                    className="w-20 px-1.5 py-1 text-xs rounded border border-border bg-background text-right"
                    placeholder="价格"
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              选择画格<br />编辑属性
            </div>
          )}

          <div className="border-t border-border p-3 space-y-2.5 mt-auto">
            <div className="text-[11px] font-semibold text-muted-foreground">付费设置</div>
            <label className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">试读前 N 格</span>
              <input
                type="number"
                min={0}
                value={data.freePreviewPanels || 0}
                onChange={(e) => updateData({ freePreviewPanels: Math.max(0, Number(e.target.value) || 0) })}
                className="w-14 px-1.5 py-1 text-xs rounded border border-border bg-background text-right"
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">整本价格</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={data.wholePrice ?? 0}
                onChange={(e) => updateData({ wholePrice: Math.max(0, Number(e.target.value) || 0) })}
                className="w-16 px-1.5 py-1 text-xs rounded border border-border bg-background text-right"
              />
            </label>
            <input
              value={data.author || ''}
              onChange={(e) => updateData({ author: e.target.value })}
              placeholder="作者名（导出显示）"
              className="w-full px-2 py-1.5 text-xs rounded border border-border bg-background"
            />
          </div>
        </aside>
      </div>

      <CreatorCenterDialog
        open={showCreatorCenter}
        onClose={() => setShowCreatorCenter(false)}
        graph={getGraphFromWork(work)}
        workId={work.id}
        initialTab="publish"
        initialTitle={work.name}
        initialSummary={doc.meta?.description || ''}
      />
    </div>
  )
}
