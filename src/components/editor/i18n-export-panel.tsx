'use client'

import { useState, useCallback, useMemo, memo, useRef } from 'react'
import {
  Languages,
  Download,
  Upload,
  FileJson,
  FileText,
  FileCode,
  Globe,
  Hash,
  AlertCircle,
  CheckCircle2,
  X,
  Info,
} from 'lucide-react'
import { Button } from '@editor/components/ui/button'
import { Label } from '@editor/components/ui/label'
import type { StoryGraph } from '@editor/types/editor'
import {
  exportTranslationTable,
  exportToJSON,
  exportToCSV,
  exportToXLIFF,
  importTranslationTable,
  parseTranslationTable,
  parseCSVTranslation,
  countTotalCharacters,
  CATEGORY_LABELS,
  SUPPORTED_LANGUAGES,
  type TranslationTable,
  type TextCategory,
} from '@editor/lib/i18n-exporter'
import { showToast } from './toast'

type ExportFormat = 'json' | 'csv' | 'xliff'

interface I18nExportPanelProps {
  graph: StoryGraph
  onImport?: (newGraph: StoryGraph) => void
}

const FORMAT_OPTIONS: { id: ExportFormat; name: string; description: string; icon: typeof FileJson; ext: string }[] = [
  { id: 'json', name: 'JSON 格式', description: '结构化数据，适合程序处理', icon: FileJson, ext: '.json' },
  { id: 'csv', name: 'CSV 表格', description: '可用 Excel 打开编辑', icon: FileText, ext: '.csv' },
  { id: 'xliff', name: 'XLIFF 格式', description: '专业翻译工具标准格式', icon: FileCode, ext: '.xlf' },
]

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || '未命名故事'
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

const I18nExportPanel = memo(function I18nExportPanel({ graph, onImport }: I18nExportPanelProps) {
  const [sourceLang, setSourceLang] = useState('zh-CN')
  const [targetLang, setTargetLang] = useState('en-US')
  const [format, setFormat] = useState<ExportFormat>('json')
  const [importPreview, setImportPreview] = useState<{
    table: TranslationTable
    appliedCount: number
    skippedCount: number
    newGraph: StoryGraph
  } | null>(null)
  const [showImportConfirm, setShowImportConfirm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const table = useMemo(() => {
    return exportTranslationTable(graph, sourceLang, graph.title)
  }, [graph, sourceLang])

  const totalChars = useMemo(() => countTotalCharacters(table), [table])

  const handleExport = useCallback(() => {
    const safeTitle = sanitizeFilename(graph.title || '未命名故事')
    const langSuffix = targetLang ? `_${targetLang}` : ''
    let content = ''
    let filename = ''
    let mimeType = ''

    switch (format) {
      case 'json':
        content = exportToJSON({ ...table, targetLanguage: targetLang })
        filename = `${safeTitle}_翻译表${langSuffix}.json`
        mimeType = 'application/json;charset=utf-8'
        break
      case 'csv':
        content = exportToCSV({ ...table, targetLanguage: targetLang })
        filename = `${safeTitle}_翻译表${langSuffix}.csv`
        mimeType = 'text/csv;charset=utf-8'
        break
      case 'xliff':
        content = exportToXLIFF({ ...table, targetLanguage: targetLang })
        filename = `${safeTitle}_翻译表${langSuffix}.xlf`
        mimeType = 'application/xml;charset=utf-8'
        break
    }

    const blob = new Blob([content], { type: mimeType })
    triggerDownload(blob, filename)
    showToast('success', `已导出翻译表：${filename}`)
  }, [format, graph.title, table, targetLang])

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result as string
        if (!content) {
          showToast('error', '文件读取失败')
          return
        }

        let parsedTable: TranslationTable | null = null

        if (file.name.endsWith('.json')) {
          parsedTable = parseTranslationTable(content)
        } else if (file.name.endsWith('.csv')) {
          parsedTable = parseCSVTranslation(content)
        } else {
          showToast('error', '不支持的文件格式，请上传 JSON 或 CSV 文件')
          return
        }

        if (!parsedTable) {
          showToast('error', '翻译表解析失败，请检查文件格式')
          return
        }

        const result = importTranslationTable(graph, parsedTable)
        if (!result.success) {
          showToast('error', result.error || '导入失败')
          return
        }

        setImportPreview({
          table: parsedTable,
          appliedCount: result.appliedCount,
          skippedCount: result.skippedCount,
          newGraph: result.newGraph,
        })
        setShowImportConfirm(true)
      }
      reader.onerror = () => {
        showToast('error', '文件读取失败')
      }
      reader.readAsText(file)

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [graph]
  )

  const handleConfirmImport = useCallback(() => {
    if (!importPreview) return
    onImport?.(importPreview.newGraph)
    showToast('success', `已导入翻译，应用了 ${importPreview.appliedCount} 条文本`)
    setShowImportConfirm(false)
    setImportPreview(null)
  }, [importPreview, onImport])

  const handleCancelImport = useCallback(() => {
    setShowImportConfirm(false)
    setImportPreview(null)
  }, [])

  const categoryEntries = useMemo(() => {
    return Object.entries(table.categories) as [TextCategory, number][]
  }, [table])

  return (
    <div className="space-y-5">
      <section>
        <div className="flex items-center gap-2 mb-2.5">
          <Globe className="w-3.5 h-3.5 text-muted-foreground" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            语言设置
          </h4>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">源语言</Label>
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">目标语言</Label>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-2.5">
          <Hash className="w-3.5 h-3.5 text-muted-foreground" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            文本统计
          </h4>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="p-3 rounded-lg border border-border bg-muted/30 text-center">
            <div className="text-xl font-bold text-foreground">{table.totalTexts}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">总条数</div>
          </div>
          <div className="p-3 rounded-lg border border-border bg-muted/30 text-center">
            <div className="text-xl font-bold text-foreground">{totalChars.toLocaleString()}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">总字数</div>
          </div>
          <div className="p-3 rounded-lg border border-border bg-muted/30 text-center">
            <div className="text-xl font-bold text-foreground">{categoryEntries.length}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">分类数</div>
          </div>
        </div>
        <div className="space-y-1.5">
          {categoryEntries.map(([cat, count]) => (
            <div key={cat} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{CATEGORY_LABELS[cat] || cat}</span>
              <span className="font-medium text-foreground">{count} 条</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-2.5">
          <FileCode className="w-3.5 h-3.5 text-muted-foreground" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            导出格式
          </h4>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {FORMAT_OPTIONS.map((fmt) => {
            const Icon = fmt.icon
            const isActive = format === fmt.id
            return (
              <button
                key={fmt.id}
                type="button"
                onClick={() => setFormat(fmt.id)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-all ${
                  isActive
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                    : 'border-border hover:border-primary/40 hover:bg-muted/40'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="text-xs font-medium">{fmt.name}</div>
                <div className="text-[9px] text-muted-foreground leading-tight">{fmt.description}</div>
              </button>
            )
          })}
        </div>
      </section>

      <section className="pt-2">
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleExport}
            className="flex-1"
          >
            <Download className="w-3.5 h-3.5" />
            导出翻译表
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1"
          >
            <Upload className="w-3.5 h-3.5" />
            导入翻译
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
          <Info className="w-3 h-3" />
          导入操作可通过撤销功能还原
        </p>
      </section>

      {showImportConfirm && importPreview && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-background rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Languages className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">确认导入翻译</h3>
                  <p className="text-[10px] text-muted-foreground">将应用翻译到当前作品</p>
                </div>
              </div>
              <button
                onClick={handleCancelImport}
                className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-green-500/30 bg-green-500/10 text-center">
                  <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto mb-1" />
                  <div className="text-lg font-bold text-green-600">{importPreview.appliedCount}</div>
                  <div className="text-[10px] text-green-600/80">将应用的文本</div>
                </div>
                <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-center">
                  <AlertCircle className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                  <div className="text-lg font-bold text-amber-600">{importPreview.skippedCount}</div>
                  <div className="text-[10px] text-amber-600/80">跳过/未匹配</div>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-border bg-muted/30">
                <div className="text-xs text-muted-foreground mb-1">翻译表信息</div>
                <div className="text-sm font-medium">{importPreview.table.workName}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  共 {importPreview.table.totalTexts} 条文本
                  {importPreview.table.targetLanguage && ` · 目标语言：${importPreview.table.targetLanguage}`}
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                导入后可通过「撤销」功能恢复到导入前的状态。
              </p>
            </div>

            <div className="px-5 py-3.5 border-t bg-muted/20 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelImport}
              >
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmImport}
              >
                确认导入
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

export { I18nExportPanel }
