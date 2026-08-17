'use client'

/**
 * 小说编辑器（NovelEditor）
 *
 * 章节树 + 富文本正文编辑，支持：
 * - 章节增删/重排/重命名
 * - 富文本正文（复用 Tiptap RichTextEditor）
 * - 整本价格 / 单章付费 / 试读前 N 章
 * - 导出 EPUB / HTML / TXT / 预览
 *
 * 数据存放于 WorkDocument.extra.novel，保存走 saveWork。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Download,
  Eye,
  FileCode,
  FileText,
  GripVertical,
  Lock,
  Plus,
  Save,
  Send,
  Trash2,
  Unlock,
  X,
} from 'lucide-react'
import type { StoredWork } from '@editor/lib/local-db/work-store'
import type { WorkDocument } from '@editor/types/work'
import { getGraphFromWork, saveWork } from '@editor/lib/local-db/work-store'
import { RichTextEditor, RichTextViewer } from './rich-text-editor'
import {
  type NovelChapter,
  type NovelData,
  countNovelWords,
  createEmptyNovelData,
  generateChapterId,
  getNovelData,
  withNovelData,
} from '@editor/lib/work-types/novel'
import {
  exportNovelToEPUB,
  exportNovelToHTML,
  exportNovelToTXT,
} from '@editor/lib/export-novel'
import { CreatorCenterDialog } from './creator-center-dialog'
import { showToast } from './toast'

interface NovelEditorProps {
  work: StoredWork
  onBack: () => void
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || '未命名小说'
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

export function NovelEditor({ work, onBack }: NovelEditorProps) {
  const initialData = useMemo<NovelData>(() => {
    const doc = work.editorData as WorkDocument
    return getNovelData(doc)
  }, [work])

  const [data, setData] = useState<NovelData>(() => ({
    ...createEmptyNovelData(),
    ...initialData,
    chapters: [...(initialData.chapters || [])].sort((a, b) => a.order - b.order),
  }))
  const [title, setTitle] = useState(() => {
    const doc = work.editorData as WorkDocument
    return doc.meta?.title || work.name || '未命名小说'
  })
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(
    () => (initialData.chapters?.[0]?.id || null)
  )
  const [saving, setSaving] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [exportDone, setExportDone] = useState<string | null>(null)
  const [showCreatorCenter, setShowCreatorCenter] = useState(false)
  const saveTimer = useRef<number | null>(null)
  // 防抖窗口内最新待保存的数据（卸载时 flush 用）
  const pendingRef = useRef<{ data: NovelData; title: string } | null>(null)

  const doc = useMemo(() => work.editorData as WorkDocument, [work])

  const selectedChapter = useMemo(
    () => data.chapters.find((c) => c.id === selectedChapterId) || null,
    [data.chapters, selectedChapterId]
  )

  const wordCount = useMemo(() => countNovelWords(data), [data])

  // 保存（防抖）
  const persist = useCallback(
    (next: NovelData, nextTitle: string) => {
      const updatedDoc: WorkDocument = withNovelData(doc, next)
      updatedDoc.meta = { ...updatedDoc.meta, title: nextTitle, updatedAt: Date.now() }
      updatedDoc.graph.title = nextTitle
      const updated: StoredWork = {
        ...work,
        name: nextTitle,
        updatedAt: Date.now(),
        lastOpened: Date.now(),
        nodeCount: next.chapters.length,
        edgeCount: 0,
        workType: 'novel',
        editorData: updatedDoc,
      }
      void saveWork(updated)
    },
    [doc, work]
  )

  const scheduleSave = useCallback(
    (next: NovelData, nextTitle: string) => {
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

  const addChapter = () => {
    const next: NovelData = {
      ...data,
      chapters: [
        ...data.chapters,
        {
          id: generateChapterId(),
          title: `第 ${data.chapters.length + 1} 章`,
          contentHtml: '',
          order: data.chapters.length,
          paid: false,
        },
      ],
    }
    setData(next)
    scheduleSave(next, title)
    const newChapter = next.chapters[next.chapters.length - 1]
    setSelectedChapterId(newChapter.id)
  }

  const deleteChapter = (id: string) => {
    const next: NovelData = {
      ...data,
      chapters: data.chapters
        .filter((c) => c.id !== id)
        .map((c, i) => ({ ...c, order: i })),
    }
    setData(next)
    scheduleSave(next, title)
    if (selectedChapterId === id) {
      setSelectedChapterId(next.chapters[0]?.id || null)
    }
  }

  const moveChapter = (id: string, dir: -1 | 1) => {
    const idx = data.chapters.findIndex((c) => c.id === id)
    const target = idx + dir
    if (idx < 0 || target < 0 || target >= data.chapters.length) return
    const reordered = [...data.chapters]
    ;[reordered[idx], reordered[target]] = [reordered[target], reordered[idx]]
    const next: NovelData = {
      ...data,
      chapters: reordered.map((c, i) => ({ ...c, order: i })),
    }
    setData(next)
    scheduleSave(next, title)
  }

  const updateChapter = (id: string, patch: Partial<NovelChapter>) => {
    const next: NovelData = {
      ...data,
      chapters: data.chapters.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }
    setData(next)
    scheduleSave(next, title)
  }

  const handleExport = async (format: 'epub' | 'html' | 'txt') => {
    const safeTitle = sanitizeFilename(title)
    try {
      let filename = ''
      if (format === 'epub') {
        const blob = await exportNovelToEPUB(data, title)
        filename = `${safeTitle}.epub`
        triggerDownload(blob, filename)
      } else if (format === 'html') {
        const html = exportNovelToHTML(data, title, doc.meta?.creatorName)
        filename = `${safeTitle}.html`
        triggerDownload(new Blob([html], { type: 'text/html;charset=utf-8' }), filename)
      } else {
        const txt = exportNovelToTXT(data, title)
        filename = `${safeTitle}.txt`
        triggerDownload(new Blob([txt], { type: 'text/plain;charset=utf-8' }), filename)
      }
      setShowExport(false)
      setExportDone(filename)
      showToast('success', `已生成「${format === 'epub' ? '电子书' : format === 'html' ? '在线阅读版' : '纯文本'}」文件`)
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
          placeholder="作品标题"
        />
        <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <BookOpen className="w-3.5 h-3.5" />
          {data.chapters.length} 章 · {wordCount} 字
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <button
              onClick={() => handleExport('epub')}
              className="flex flex-col items-start gap-1 px-3 py-2.5 text-left bg-background border border-border rounded-lg hover:border-primary/50 hover:bg-background transition-colors"
            >
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <BookOpen className="w-3.5 h-3.5 text-primary" />
                EPUB 电子书
                <span className="text-[10px] text-primary bg-primary/10 rounded-full px-1.5 py-0.5">推荐</span>
              </span>
              <span className="text-[11px] text-muted-foreground leading-snug">正规电子书格式，手机和阅读器都能打开</span>
            </button>
            <button
              onClick={() => handleExport('html')}
              className="flex flex-col items-start gap-1 px-3 py-2.5 text-left bg-background border border-border rounded-lg hover:border-primary/50 hover:bg-background transition-colors"
            >
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <FileCode className="w-3.5 h-3.5 text-muted-foreground" />
                HTML 在线阅读
              </span>
              <span className="text-[11px] text-muted-foreground leading-snug">网页形式，浏览器打开就能看</span>
            </button>
            <button
              onClick={() => handleExport('txt')}
              className="flex flex-col items-start gap-1 px-3 py-2.5 text-left bg-background border border-border rounded-lg hover:border-primary/50 hover:bg-background transition-colors"
            >
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                纯文本 TXT
              </span>
              <span className="text-[11px] text-muted-foreground leading-snug">最简单纯文本，什么设备都能看</span>
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* 章节列表 */}
        <aside className="w-60 border-r border-border flex flex-col shrink-0 bg-card/40">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
            <span className="text-xs font-semibold text-muted-foreground">章节</span>
            <button
              onClick={addChapter}
              className="flex items-center gap-1 px-2 py-1 text-[11px] bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors"
            >
              <Plus className="w-3 h-3" />
              新增章节
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-1.5">
            {data.chapters.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                还没有章节
                <br />
                点击「新增章节」开始创作
              </div>
            ) : (
              data.chapters.map((ch, i) => (
                <div
                  key={ch.id}
                  onClick={() => setSelectedChapterId(ch.id)}
                  className={`group flex items-center gap-1.5 mx-1.5 mb-1 px-2 py-2 rounded-lg cursor-pointer transition-colors ${
                    selectedChapterId === ch.id
                      ? 'bg-primary/10 border border-primary/20'
                      : 'border border-transparent hover:bg-muted/60'
                  }`}
                >
                  <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{ch.title || `第 ${i + 1} 章`}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {ch.paid ? (
                        <span className="inline-flex items-center gap-0.5 text-[9px] text-amber-600">
                          <Lock className="w-2.5 h-2.5" />
                          ¥{ch.price || 0}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground/60">
                          <Unlock className="w-2.5 h-2.5" />
                          免费
                        </span>
                      )}
                      <span className="text-[9px] text-muted-foreground/50 ml-auto">
                        {ch.contentHtml.replace(/<[^>]*>/g, '').length} 字
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); moveChapter(ch.id, -1) }}
                      disabled={i === 0}
                      className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 rounded"
                      title="上移"
                    >
                      ↑
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); moveChapter(ch.id, 1) }}
                      disabled={i === data.chapters.length - 1}
                      className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 rounded"
                      title="下移"
                    >
                      ↓
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteChapter(ch.id) }}
                      className="p-1 text-muted-foreground hover:text-primary rounded"
                      title="删除章节"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 付费设置 */}
          <div className="border-t border-border p-3 space-y-2.5 shrink-0 bg-card/60">
            <div className="text-[11px] font-semibold text-muted-foreground">付费设置</div>
            <label className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">试读前 N 章</span>
              <input
                type="number"
                min={0}
                max={Math.max(0, data.chapters.length - 1)}
                value={data.freePreviewChapters}
                onChange={(e) => {
                  const next = { ...data, freePreviewChapters: Math.max(0, Number(e.target.value) || 0) }
                  setData(next)
                  scheduleSave(next, title)
                }}
                className="w-14 px-1.5 py-1 text-xs rounded border border-border bg-background text-right"
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">整本价</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={data.wholePrice ?? 0}
                  onChange={(e) => {
                    const next = { ...data, wholePrice: Math.max(0, Number(e.target.value) || 0) }
                    setData(next)
                    scheduleSave(next, title)
                  }}
                  className="w-16 px-1.5 py-1 text-xs rounded border border-border bg-background text-right"
                  placeholder="价格"
                />
                <span className="text-muted-foreground/60">元</span>
              </div>
            </label>
            {selectedChapter && (
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">本章付费</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={selectedChapter.price ?? 0}
                    onChange={(e) =>
                      updateChapter(selectedChapter.id, {
                        price: Number(e.target.value) || 0,
                        paid: (Number(e.target.value) || 0) > 0,
                      })
                    }
                    className="w-16 px-1.5 py-1 text-xs rounded border border-border bg-background text-right"
                    placeholder="价格"
                  />
                  <span className="text-muted-foreground/60">元</span>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* 正文编辑区 */}
        <main className="flex-1 overflow-y-auto">
          {selectedChapter ? (
            <div className="max-w-3xl mx-auto px-6 py-8">
              <div className="mb-4">
                <input
                  value={selectedChapter.title}
                  onChange={(e) => updateChapter(selectedChapter.id, { title: e.target.value })}
                  className="w-full px-0 py-1 text-xl font-semibold bg-transparent border-none outline-none font-hand"
                  placeholder="章节标题"
                />
              </div>
              <RichTextEditor
                content={selectedChapter.contentHtml}
                onChange={(html) => updateChapter(selectedChapter.id, { contentHtml: html })}
                placeholder="开始写作，支持加粗、斜体、标题、列表、链接…"
                minHeight="60vh"
              />
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-6">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium mb-1">{data.chapters.length === 0 ? '开始创作你的第一部小说' : '选择左侧章节开始编辑'}</p>
                <p className="text-xs text-muted-foreground">章节内容保存在本地，导出即部署，收益归你所有</p>
              </div>
              <button
                onClick={addChapter}
                className="flex items-center gap-1.5 px-4 py-2 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
              >
                <Plus className="w-3.5 h-3.5" />
                新增章节
              </button>
            </div>
          )}
        </main>
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
