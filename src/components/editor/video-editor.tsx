/**
 * 视频编辑器（VideoEditor）
 *
 * 轻中度剪辑：素材库导入 → 时间线片段 → 片段属性（截取/音量/转场/字幕/配音）→
 * 付费设置（试看秒数/整片价/片段价）→ 导出（付费播放器 HTML / 试看 HTML / B 站脚本）。
 *
 * 数据存放于 WorkDocument.extra.video，保存走 saveWork。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  Film,
  GripVertical,
  Image as ImageIcon,
  Lock,
  Music,
  Plus,
  Save,
  Send,
  Trash2,
  Unlock,
  Upload,
  Volume2,
  X,
} from 'lucide-react'
import type { StoredWork } from '@editor/lib/local-db/work-store'
import type { WorkDocument } from '@editor/types/work'
import { getGraphFromWork, saveWork } from '@editor/lib/local-db/work-store'
import { getAsset, saveAsset } from '@editor/lib/local-db/asset-store'
import {
  VIDEO_TRANSITIONS,
  type VideoAssetRef,
  type VideoClip,
  type VideoClipType,
  type VideoData,
  countPaidClips,
  countVideoDuration,
  createEmptyVideoData,
  defaultClipDuration,
  generateClipId,
  getVideoData,
  withVideoData,
} from '@editor/lib/work-types/video'
import {
  exportVideoPreviewHTML,
  exportVideoToBiliScript,
  exportVideoToPlayerHTML,
} from '@editor/lib/export-video'
import {
  detectMediaType,
  generateHash,
  generateVideoThumbnail,
  validateFileSize,
} from '@editor/lib/media-processor'
import { type PlayerClip, TimelinePlayer } from './timeline-player'
import { CreatorCenterDialog } from './creator-center-dialog'
import { showToast } from './toast'

interface VideoEditorProps {
  work: StoredWork
  onBack: () => void
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || '未命名视频'
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

/** 探测素材时长（video/audio） */
function probeMediaDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const el = document.createElement(file.type.startsWith('video/') ? 'video' : 'audio')
    el.preload = 'metadata'
    el.muted = true
    el.onloadedmetadata = () => {
      const d = el.duration
      URL.revokeObjectURL(el.src)
      resolve(Number.isFinite(d) ? d : undefined)
    }
    el.onerror = () => {
      URL.revokeObjectURL(el.src)
      resolve(undefined)
    }
    el.src = URL.createObjectURL(file)
  })
}

const TYPE_ICONS: Record<VideoClipType, typeof Film> = {
  video: Film,
  image: ImageIcon,
  audio: Music,
}

const TYPE_LABELS: Record<VideoClipType, string> = {
  video: '视频',
  image: '图片',
  audio: '音频',
}

export function VideoEditor({ work, onBack }: VideoEditorProps) {
  const initialData = useMemo<VideoData>(() => {
    const doc = work.editorData as WorkDocument
    return getVideoData(doc)
  }, [work])

  const [data, setData] = useState<VideoData>(() => ({
    ...createEmptyVideoData(),
    ...initialData,
    clips: [...(initialData.clips || [])].sort((a, b) => a.order - b.order),
    assets: [...(initialData.assets || [])],
  }))
  const [title, setTitle] = useState(() => {
    const doc = work.editorData as WorkDocument
    return doc.meta?.title || work.name || '未命名视频'
  })
  const [selectedClipId, setSelectedClipId] = useState<string | null>(
    () => (initialData.clips?.[0]?.id || null)
  )
  const [saving, setSaving] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [exportDone, setExportDone] = useState<string | null>(null)
  const [showCreatorCenter, setShowCreatorCenter] = useState(false)
  const [unlockCode, setUnlockCode] = useState('')
  const [playerClips, setPlayerClips] = useState<PlayerClip[]>([])
  const saveTimer = useRef<number | null>(null)
  // 防抖窗口内最新待保存的数据（卸载时 flush 用）
  const pendingRef = useRef<{ data: VideoData; title: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const doc = useMemo(() => work.editorData as WorkDocument, [work])

  const selectedClip = useMemo(
    () => data.clips.find((c) => c.id === selectedClipId) || null,
    [data.clips, selectedClipId]
  )

  const totalDuration = useMemo(() => countVideoDuration(data), [data])
  const paidCount = useMemo(() => countPaidClips(data), [data])

  // 保存（防抖）
  const persist = useCallback(
    (next: VideoData, nextTitle: string) => {
      const updatedDoc: WorkDocument = withVideoData(doc, next)
      updatedDoc.meta = { ...updatedDoc.meta, title: nextTitle, updatedAt: Date.now() }
      updatedDoc.graph.title = nextTitle
      const updated: StoredWork = {
        ...work,
        name: nextTitle,
        updatedAt: Date.now(),
        lastOpened: Date.now(),
        nodeCount: next.clips.length,
        edgeCount: 0,
        workType: 'video',
        editorData: updatedDoc,
      }
      void saveWork(updated)
    },
    [doc, work]
  )

  const scheduleSave = useCallback(
    (next: VideoData, nextTitle: string) => {
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

  // 解析片段可播放 URL（供预览）
  useEffect(() => {
    let cancelled = false
    const createdUrls: string[] = []
    ;(async () => {
      const clips = [...data.clips].sort((a, b) => a.order - b.order)
      const resolved: PlayerClip[] = []
      for (const clip of clips) {
        let src = ''
        if (clip.assetHash) {
          const asset = await getAsset(clip.assetHash)
          if (asset) {
            src = URL.createObjectURL(asset.blob)
            createdUrls.push(src)
          }
        }
        if (cancelled) return
        resolved.push({
          id: clip.id,
          type: clip.type,
          src: src || 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="100%" height="100%" fill="#141414"/><text x="50%" y="50%" fill="#666" font-size="32" text-anchor="middle">缺素材</text></svg>'),
          dur: clip.duration || defaultClipDuration(clip.type),
          trimStart: clip.trimStart || 0,
          subtitle: clip.subtitle,
        })
      }
      if (!cancelled) setPlayerClips(resolved)
    })()
    return () => {
      cancelled = true
      // 释放本次生成的 Blob URL，避免预览资源泄漏
      createdUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [data.clips])

  // 素材导入
  const handleImportFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const refs: VideoAssetRef[] = []
    let skipped = 0
    for (const file of Array.from(files)) {
      const mediaType = detectMediaType(file)
      if (mediaType === 'unknown') {
        skipped++
        continue
      }
      const check = validateFileSize(file, mediaType)
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
      const duration = mediaType === 'image' ? undefined : await probeMediaDuration(file)
      let thumbnail: string | undefined
      if (mediaType === 'image') thumbnail = URL.createObjectURL(file)
      else if (mediaType === 'video') {
        try { thumbnail = await generateVideoThumbnail(file) } catch { /* ignore */ }
      }
      refs.push({
        hash,
        name: file.name,
        type: mediaType,
        mime: file.type,
        duration,
        thumbnail,
        size: file.size,
      })
    }
    if (refs.length > 0) {
      // 函数式更新避免连续导入时基于过期 state 互相覆盖
      setData((prev) => {
        const assets = [...prev.assets]
        for (const r of refs) {
          const i = assets.findIndex((a) => a.hash === r.hash)
          if (i >= 0) assets[i] = r
          else assets.push(r)
        }
        const next: VideoData = { ...prev, assets }
        scheduleSave(next, title)
        return next
      })
      showToast('success', `已导入 ${refs.length} 个素材${skipped > 0 ? `，跳过 ${skipped} 个` : ''}`)
    } else if (skipped > 0) {
      showToast('error', '没有可导入的媒体文件')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // 添加片段
  const addClip = (asset: VideoAssetRef) => {
    const order = data.clips.length
    const clip: VideoClip = {
      id: generateClipId(),
      type: asset.type,
      assetHash: asset.hash,
      assetName: asset.name,
      assetDuration: asset.duration,
      trimStart: 0,
      trimEnd: 0,
      duration: asset.duration && asset.duration > 0 ? Math.round(asset.duration * 10) / 10 : defaultClipDuration(asset.type),
      volume: 1,
      transition: 'none',
      subtitle: '',
      voiceover: '',
      paid: false,
      order,
    }
    const next: VideoData = { ...data, clips: [...data.clips, clip] }
    setData(next)
    scheduleSave(next, title)
    setSelectedClipId(clip.id)
  }

  // 添加空片段（无素材，可后续指定）
  const addEmptyClip = (type: VideoClipType) => {
    const order = data.clips.length
    const clip: VideoClip = {
      id: generateClipId(),
      type,
      trimStart: 0,
      trimEnd: 0,
      duration: defaultClipDuration(type),
      volume: 1,
      transition: 'none',
      subtitle: '',
      voiceover: '',
      paid: false,
      order,
    }
    const next: VideoData = { ...data, clips: [...data.clips, clip] }
    setData(next)
    scheduleSave(next, title)
    setSelectedClipId(clip.id)
  }

  const deleteClip = (id: string) => {
    const next: VideoData = {
      ...data,
      clips: data.clips.filter((c) => c.id !== id).map((c, i) => ({ ...c, order: i })),
    }
    setData(next)
    scheduleSave(next, title)
    if (selectedClipId === id) setSelectedClipId(next.clips[0]?.id || null)
  }

  const moveClip = (id: string, dir: -1 | 1) => {
    const idx = data.clips.findIndex((c) => c.id === id)
    const target = idx + dir
    if (idx < 0 || target < 0 || target >= data.clips.length) return
    const reordered = [...data.clips]
    ;[reordered[idx], reordered[target]] = [reordered[target], reordered[idx]]
    const next: VideoData = {
      ...data,
      clips: reordered.map((c, i) => ({ ...c, order: i })),
    }
    setData(next)
    scheduleSave(next, title)
  }

  const updateClip = (id: string, patch: Partial<VideoClip>) => {
    const next: VideoData = {
      ...data,
      clips: data.clips.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }
    setData(next)
    scheduleSave(next, title)
  }

  const updateData = (patch: Partial<VideoData>) => {
    const next: VideoData = { ...data, ...patch }
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

  const handleExport = async (format: 'player' | 'preview' | 'bili') => {
    const safeTitle = sanitizeFilename(title)
    try {
      let filename = ''
      if (format === 'player') {
        const html = await exportVideoToPlayerHTML(data, title, resolveAssetForExport, {
          author: data.author,
          unlockCode: unlockCode.trim() || undefined,
          paymentNote: data.wholePrice && data.wholePrice > 0
            ? `支付 ¥${data.wholePrice} 后观看完整内容`
            : '解锁后观看完整内容',
        })
        filename = `${safeTitle}.html`
        triggerDownload(new Blob([html], { type: 'text/html;charset=utf-8' }), filename)
        showToast('success', '已生成「付费播放器」文件')
      } else if (format === 'preview') {
        const html = await exportVideoPreviewHTML(data, title, resolveAssetForExport)
        filename = `${safeTitle}-试看.html`
        triggerDownload(new Blob([html], { type: 'text/html;charset=utf-8' }), filename)
        showToast('success', '已生成「试看预览」文件')
      } else {
        const csv = exportVideoToBiliScript(data, title)
        filename = `${safeTitle}-B站分P.csv`
        triggerDownload(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), filename)
        showToast('success', '已生成「B 站分 P 脚本」文件')
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
          placeholder="视频标题"
        />
        <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          {data.clips.length} 段 · {totalDuration} 秒
          {paidCount > 0 && <span className="text-amber-600">· {paidCount} 付费</span>}
          {saving && <span className="text-muted-foreground/60">（保存中…）</span>}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowCreatorCenter(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            title="把作品提交到网站作品墙"
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
            <span className="text-muted-foreground">，文件保存在浏览器的「下载」目录里。把这个文件上传到你常发布作品的地方，读者就能直接观看。</span>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <button
              onClick={() => handleExport('player')}
              className="flex flex-col items-start gap-1 px-3 py-2.5 text-left bg-background border border-border rounded-lg hover:border-primary/50 hover:bg-background transition-colors"
            >
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <Film className="w-3.5 h-3.5 text-primary" />
                付费播放器
                <span className="text-[10px] text-primary bg-primary/10 rounded-full px-1.5 py-0.5">推荐</span>
              </span>
              <span className="text-[11px] text-muted-foreground leading-snug">完整视频加付费解锁，读者付款后才能看</span>
            </button>
            <button
              onClick={() => handleExport('preview')}
              className="flex flex-col items-start gap-1 px-3 py-2.5 text-left bg-background border border-border rounded-lg hover:border-primary/50 hover:bg-background transition-colors"
            >
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                试看预览
              </span>
              <span className="text-[11px] text-muted-foreground leading-snug">只有免费试看的部分，先看看效果</span>
            </button>
            <button
              onClick={() => handleExport('bili')}
              className="flex flex-col items-start gap-1 px-3 py-2.5 text-left bg-background border border-border rounded-lg hover:border-primary/50 hover:bg-background transition-colors"
            >
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                B 站分 P 脚本
              </span>
              <span className="text-[11px] text-muted-foreground leading-snug">按片段拆分的上传列表，适合投稿 B 站</span>
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
            <span className="text-[11px] text-muted-foreground/70">付费片段的读者需要输入这个码才能解锁；留空则付费片段自动隐藏。</span>
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
            accept="video/*,image/*,audio/*"
            className="hidden"
            onChange={(e) => handleImportFiles(e.target.files)}
          />
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {data.assets.length === 0 ? (
              <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                导入视频 / 图片 / 音频
                <br />
                用于搭建时间线
              </div>
            ) : (
              data.assets.map((asset) => {
                const Icon = TYPE_ICONS[asset.type]
                return (
                  <div
                    key={asset.hash}
                    className="group flex items-center gap-2 px-2 py-1.5 rounded-lg border border-border bg-background hover:border-primary/40 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center overflow-hidden shrink-0">
                      {asset.thumbnail ? (
                        <img src={asset.thumbnail} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Icon className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-medium truncate">{asset.name}</div>
                      <div className="text-[10px] text-muted-foreground/60">
                        {TYPE_LABELS[asset.type]}
                        {asset.duration ? ` · ${Math.round(asset.duration)}s` : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => addClip(asset)}
                      className="p-1 rounded text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                      title="添加到时间线"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })
            )}
          </div>
          <div className="border-t border-border p-2.5 space-y-1.5 shrink-0">
            <button
              onClick={() => addEmptyClip('image')}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              <Plus className="w-3 h-3" /> 添加图片片段
            </button>
            <button
              onClick={() => addEmptyClip('video')}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              <Plus className="w-3 h-3" /> 添加视频片段
            </button>
            <button
              onClick={() => addEmptyClip('audio')}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              <Plus className="w-3 h-3" /> 添加音频片段
            </button>
          </div>
        </aside>

        {/* 时间线 + 预览 */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5">
            <div className="max-w-3xl mx-auto">
              <TimelinePlayer clips={playerClips} />
            </div>
          </div>

          {/* 时间线片段列表 */}
          <div className="border-t border-border shrink-0 max-h-48 overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-xs font-semibold text-muted-foreground">时间线</span>
              <span className="text-[10px] text-muted-foreground/60">共 {data.clips.length} 段 · {totalDuration} 秒</span>
            </div>
            {data.clips.length === 0 ? (
              <div className="px-4 pb-4 text-center text-xs text-muted-foreground">
                从左侧素材导入并添加到时间线，或点击下方按钮添加空片段
              </div>
            ) : (
              <div className="px-3 pb-3 space-y-1.5">
                {data.clips.map((clip, i) => {
                  const Icon = TYPE_ICONS[clip.type]
                  return (
                    <div
                      key={clip.id}
                      onClick={() => setSelectedClipId(clip.id)}
                      className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer border transition-colors ${
                        selectedClipId === clip.id
                          ? 'bg-primary/10 border-primary/25'
                          : 'border-transparent hover:bg-muted/60'
                      }`}
                    >
                      <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${clip.paid ? 'text-amber-600' : 'text-muted-foreground/60'}`} />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium truncate">{clip.assetName || clip.subtitle || `片段 ${i + 1}`}</span>
                        <span className="ml-2 text-[10px] text-muted-foreground/60">{Math.round(clip.duration)}s</span>
                      </div>
                      {clip.paid && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600">
                          <Lock className="w-2.5 h-2.5" />¥{clip.price || 0}
                        </span>
                      )}
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); moveClip(clip.id, -1) }}
                          disabled={i === 0}
                          className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 rounded"
                          title="左移"
                        >
                          ←
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); moveClip(clip.id, 1) }}
                          disabled={i === data.clips.length - 1}
                          className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 rounded"
                          title="右移"
                        >
                          →
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteClip(clip.id) }}
                          className="p-1 text-muted-foreground hover:text-primary rounded"
                          title="删除片段"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </main>

        {/* 片段属性 + 付费设置 */}
        <aside className="w-64 border-l border-border flex flex-col shrink-0 bg-card/40 overflow-y-auto">
          <div className="px-3 py-2.5 border-b border-border text-xs font-semibold text-muted-foreground shrink-0">
            片段属性
          </div>
          {selectedClip ? (
            <div className="p-3 space-y-3">
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">类型</label>
                <div className="flex gap-1.5">
                  {(Object.keys(TYPE_LABELS) as VideoClipType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => updateClip(selectedClip.id, { type: t })}
                      className={`flex-1 px-2 py-1.5 text-[11px] rounded-lg border transition-colors ${
                        selectedClip.type === t
                          ? 'bg-primary/10 border-primary/30 text-primary'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">素材</label>
                <select
                  value={selectedClip.assetHash || ''}
                  onChange={(e) => {
                    const asset = data.assets.find((a) => a.hash === e.target.value)
                    updateClip(selectedClip.id, {
                      assetHash: asset?.hash,
                      assetName: asset?.name,
                      type: asset?.type || selectedClip.type,
                      assetDuration: asset?.duration,
                    })
                  }}
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-background"
                >
                  <option value="">（未选择素材）</option>
                  {data.assets.map((a) => (
                    <option key={a.hash} value={a.hash}>{a.name}</option>
                  ))}
                </select>
              </div>

              {selectedClip.type !== 'image' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">截取起点 (s)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={selectedClip.trimStart || 0}
                      onChange={(e) => updateClip(selectedClip.id, { trimStart: Math.max(0, Number(e.target.value) || 0) })}
                      className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">时长 (s)</label>
                    <input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={selectedClip.duration || 0.1}
                      onChange={(e) => updateClip(selectedClip.id, { duration: Math.max(0.1, Number(e.target.value) || 0.1) })}
                      className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-background"
                    />
                  </div>
                </div>
              )}

              {selectedClip.type === 'image' && (
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">显示时长 (s)</label>
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={selectedClip.duration || 3}
                    onChange={(e) => updateClip(selectedClip.id, { duration: Math.max(0.1, Number(e.target.value) || 0.1) })}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-background"
                  />
                </div>
              )}

              {selectedClip.type !== 'audio' && (
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">转场</label>
                  <select
                    value={selectedClip.transition || 'none'}
                    onChange={(e) => updateClip(selectedClip.id, { transition: e.target.value as VideoClip['transition'] })}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-background"
                  >
                    {VIDEO_TRANSITIONS.map((t) => (
                      <option key={t} value={t}>
                        {t === 'none' ? '无' : { fade: '淡入淡出', cut: '硬切', dissolve: '溶解', slide: '滑动', zoom: '缩放' }[t] || t}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedClip.type !== 'audio' && (
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">字幕 / 台词</label>
                  <input
                    value={selectedClip.subtitle || ''}
                    onChange={(e) => updateClip(selectedClip.id, { subtitle: e.target.value })}
                    placeholder="显示在画面底部的文字"
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-background"
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">配音 / TTS 提示</label>
                <input
                  value={selectedClip.voiceover || ''}
                  onChange={(e) => updateClip(selectedClip.id, { voiceover: e.target.value })}
                  placeholder="AI 配音文本或说明"
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-background"
                />
              </div>

              {selectedClip.type === 'audio' && (
                <div>
                  <label className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
                    <Volume2 className="w-3 h-3" /> 音量
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={selectedClip.volume ?? 1}
                    onChange={(e) => updateClip(selectedClip.id, { volume: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>
              )}

              <div className="pt-2 border-t border-border space-y-2">
                <label className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    {selectedClip.paid ? <Lock className="w-3 h-3 text-amber-600" /> : <Unlock className="w-3 h-3" />}
                    片段付费
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={selectedClip.price ?? 0}
                    onChange={(e) => {
                      const price = Number(e.target.value) || 0
                      updateClip(selectedClip.id, { price, paid: price > 0 })
                    }}
                    className="w-20 px-1.5 py-1 text-xs rounded border border-border bg-background text-right"
                    placeholder="价格"
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              选择时间线片段<br />编辑属性
            </div>
          )}

          <div className="border-t border-border p-3 space-y-2.5 mt-auto">
            <div className="text-[11px] font-semibold text-muted-foreground">付费设置</div>
            <label className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">试看秒数</span>
              <input
                type="number"
                min={0}
                value={data.previewSeconds || 0}
                onChange={(e) => updateData({ previewSeconds: Math.max(0, Number(e.target.value) || 0) })}
                className="w-14 px-1.5 py-1 text-xs rounded border border-border bg-background text-right"
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">整片价格</span>
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
