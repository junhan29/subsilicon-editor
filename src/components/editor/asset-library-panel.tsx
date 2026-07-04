'use client'

import { useCallback, useMemo, useState, memo, useEffect, useRef } from 'react'
import {
  Search,
  X,
  ImageIcon,
  Music,
  Check,
  ExternalLink,
  AlertCircle,
  Upload,
  Download,
  Trash2,
  Edit3,
  HardDrive,
  Package,
  Loader2,
} from 'lucide-react'
import { Input } from '@editor/components/ui/input'
import { Button } from '@editor/components/ui/button'
import {
  filterAssetsByCategory,
  searchAssets,
  type AssetCategory,
  type LibraryAsset,
} from '@editor/lib/asset-library'
import type { StoryNode } from '@editor/types/editor'
import {
  exportAssetPack,
  importAssetPack,
  formatFileSize,
  generateThumbnail,
  type ImportResult,
  type ExportProgress,
  type ImportProgress,
} from '@editor/lib/asset-packager'
import {
  getAllAssets,
  deleteAsset,
  getTotalAssetSize,
  type StoredAsset,
} from '@editor/lib/local-db'

type FilterCategory = 'all' | AssetCategory
type PanelTab = 'official' | 'mine'

interface AssetLibraryPanelProps {
  selectedNode?: StoryNode | null
  onInsertAsset?: (asset: LibraryAsset) => void
}

const LICENSE_LABELS: Record<string, string> = {
  free: '免费',
  cc0: 'CC0',
  'cc-by': 'CC-BY',
  commercial: '可商用',
}

const LICENSE_STYLES: Record<string, string> = {
  free: 'bg-green-500/15 text-green-400 border-green-500/30',
  cc0: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'cc-by': 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  commercial: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
}

const CATEGORY_TABS: { key: FilterCategory; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'background', label: '背景图' },
  { key: 'character', label: '角色立绘' },
  { key: 'audio', label: '音效' },
]

const PANEL_TABS: { key: PanelTab; label: string; icon: typeof ImageIcon }[] = [
  { key: 'official', label: '官方素材', icon: Package },
  { key: 'mine', label: '我的素材', icon: HardDrive },
]

function AssetLibraryPanelImpl({ selectedNode, onInsertAsset }: AssetLibraryPanelProps) {
  const [activePanel, setActivePanel] = useState<PanelTab>('official')
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [previewAsset, setPreviewAsset] = useState<LibraryAsset | null>(null)

  const [myAssets, setMyAssets] = useState<StoredAsset[]>([])
  const [totalSize, setTotalSize] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null)
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [deleteConfirm, setDeleteConfirm] = useState<StoredAsset | null>(null)
  const [editingAsset, setEditingAsset] = useState<StoredAsset | null>(null)
  const [editName, setEditName] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  const loadMyAssets = useCallback(async () => {
    setIsLoading(true)
    try {
      const [assets, size] = await Promise.all([getAllAssets(), getTotalAssetSize()])
      setMyAssets(assets)
      setTotalSize(size)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activePanel === 'mine') {
      loadMyAssets()
    }
  }, [activePanel, loadMyAssets])

  const filteredOfficialAssets = useMemo(() => {
    const byCategory = filterAssetsByCategory(activeCategory)
    return searchAssets(searchQuery, byCategory)
  }, [activeCategory, searchQuery])

  const filteredMyAssets = useMemo(() => {
    if (!searchQuery.trim()) return myAssets
    const q = searchQuery.toLowerCase()
    return myAssets.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.type.toLowerCase().includes(q) ||
        a.hash.toLowerCase().includes(q)
    )
  }, [myAssets, searchQuery])

  const handleCategoryClick = useCallback((cat: FilterCategory) => {
    setActiveCategory(cat)
  }, [])

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }, [])

  const handleAssetClick = useCallback((asset: LibraryAsset) => {
    setPreviewAsset(asset)
  }, [])

  const handleClosePreview = useCallback(() => {
    setPreviewAsset(null)
  }, [])

  const handleInsert = useCallback(() => {
    if (!previewAsset || !onInsertAsset) return
    onInsertAsset(previewAsset)
    setPreviewAsset(null)
  }, [previewAsset, onInsertAsset])

  useEffect(() => {
    setPreviewAsset(null)
  }, [activeCategory, activePanel])

  const selectedNodeHint = useMemo(() => {
    if (!selectedNode) return '未选中节点'
    const typeLabels: Record<string, string> = {
      dialogue: '对话节点',
      cg: 'CG过场节点',
      choice: '选择节点',
      ending: '结局节点',
      narration: '旁白节点',
    }
    return `当前：${typeLabels[selectedNode.type] || selectedNode.type}`
  }, [selectedNode])

  const handleExport = useCallback(async () => {
    setErrorMsg(null)
    setExportProgress({ current: 0, total: myAssets.length, assetName: '' })
    try {
      const blob = await exportAssetPack((p) => setExportProgress(p))
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `assets_${new Date().toISOString().slice(0, 10)}.sassets`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '导出失败')
    } finally {
      setTimeout(() => setExportProgress(null), 1000)
    }
  }, [myAssets.length])

  const handleImportClick = useCallback(() => {
    setErrorMsg(null)
    setImportResult(null)
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      e.target.value = ''

      setImportProgress({ current: 0, total: 0, assetName: '' })
      try {
        const result = await importAssetPack(file, (p) => setImportProgress(p))
        setImportResult(result)
        if (result.imported > 0) {
          loadMyAssets()
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : '导入失败')
      } finally {
        setTimeout(() => setImportProgress(null), 1000)
      }
    },
    [loadMyAssets]
  )

  const handleDelete = useCallback(
    async (asset: StoredAsset) => {
      try {
        await deleteAsset(asset.hash)
        setMyAssets((prev) => prev.filter((a) => a.hash !== asset.hash))
        setTotalSize((prev) => prev - asset.size)
      } finally {
        setDeleteConfirm(null)
      }
    },
    []
  )

  const handleStartRename = useCallback((asset: StoredAsset) => {
    setEditingAsset(asset)
    setEditName(asset.name)
    setTimeout(() => editInputRef.current?.focus(), 0)
  }, [])

  const handleRenameSubmit = useCallback(() => {
    if (!editingAsset || !editName.trim()) {
      setEditingAsset(null)
      return
    }
    setMyAssets((prev) =>
      prev.map((a) => (a.hash === editingAsset.hash ? { ...a, name: editName.trim() } : a))
    )
    setEditingAsset(null)
  }, [editingAsset, editName])

  const handleMyAssetClick = useCallback(
    (asset: StoredAsset) => {
      const url = URL.createObjectURL(asset.blob)
      const isAudio = asset.type.startsWith('audio/')
      const libAsset: LibraryAsset = {
        id: asset.hash,
        name: asset.name,
        category: isAudio ? 'audio' : 'background',
        license: 'free',
        thumbnailUrl: '',
        fullUrl: url,
        tags: [],
        description: '本地素材',
        source: '本地',
        fileType: isAudio ? 'audio' : 'image',
      }
      setPreviewAsset(libAsset)
    },
    []
  )

  const showProgress = exportProgress || importProgress

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <input
        ref={fileInputRef}
        type="file"
        accept=".sassets"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="px-2.5 pt-2 pb-1 border-b">
        <div className="grid grid-cols-2 gap-0.5 bg-muted rounded-md p-0.5">
          {PANEL_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActivePanel(tab.key)}
              className={`
                py-1 text-[10px] font-medium rounded transition-colors flex items-center justify-center gap-1
                ${activePanel === tab.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground/80'
                }
              `}
            >
              <tab.icon className="w-3 h-3" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activePanel === 'official' && (
        <div className="px-2.5 pt-1.5 pb-1 border-b">
          <div className="grid grid-cols-4 gap-0.5 bg-muted rounded-md p-0.5">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleCategoryClick(tab.key)}
                className={`
                  py-1 text-[10px] font-medium rounded transition-colors
                  ${activeCategory === tab.key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground/80'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {activePanel === 'mine' && (
        <div className="px-2.5 py-1.5 border-b flex items-center justify-between gap-1.5">
          <span className="text-[10px] text-muted-foreground">
            {myAssets.length} 个素材 · {formatFileSize(totalSize)}
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={handleImportClick}
              disabled={!!showProgress}
            >
              <Upload className="w-3 h-3 mr-1" />
              导入
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={handleExport}
              disabled={!!showProgress || myAssets.length === 0}
            >
              <Download className="w-3 h-3 mr-1" />
              导出
            </Button>
          </div>
        </div>
      )}

      <div className="px-2.5 py-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder={activePanel === 'mine' ? '搜索我的素材...' : '搜索素材...'}
            value={searchQuery}
            onChange={handleSearchChange}
            className="h-7 text-[11px] pl-7 pr-7"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded flex items-center justify-center text-muted-foreground hover:text-foreground"
              title="清除"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <p className="text-[9px] text-muted-foreground mt-1.5 px-0.5">{selectedNodeHint}</p>
      </div>

      {showProgress && (
        <div className="px-2.5 py-2 border-b bg-muted/30">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="text-muted-foreground">
              {exportProgress ? '导出中' : '导入中'}：{showProgress.assetName}
            </span>
            <span className="text-foreground/80">
              {showProgress.current}/{showProgress.total}
            </span>
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-ochre-500 to-terracotta transition-all duration-200"
              style={{
                width: showProgress.total
                  ? `${(showProgress.current / showProgress.total) * 100}%`
                  : '0%',
              }}
            />
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="px-2.5 py-2 border-b bg-red-500/10">
          <div className="flex items-start gap-1.5 text-[10px] text-red-400">
            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
            <span className="leading-relaxed">{errorMsg}</span>
            <button
              onClick={() => setErrorMsg(null)}
              className="ml-auto text-red-400/70 hover:text-red-400"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {importResult && (
        <div className="px-2.5 py-2 border-b bg-green-500/10">
          <div className="flex items-start gap-1.5 text-[10px] text-green-400">
            <Check className="w-3 h-3 mt-0.5 shrink-0" />
            <span className="leading-relaxed">
              导入完成：成功 {importResult.imported} 个，跳过 {importResult.skipped} 个（已存在），共 {importResult.total} 个
            </span>
            <button
              onClick={() => setImportResult(null)}
              className="ml-auto text-green-400/70 hover:text-green-400"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2">
        {activePanel === 'official' ? (
          filteredOfficialAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ImageIcon className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-[11px]">未找到素材</p>
              <p className="text-[9px] mt-1">试试其他关键词或分类</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {filteredOfficialAssets.map((asset) => (
                <AssetCard key={asset.id} asset={asset} onClick={handleAssetClick} />
              ))}
            </div>
          )
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-6 h-6 mb-2 animate-spin opacity-50" />
            <p className="text-[11px]">加载中...</p>
          </div>
        ) : filteredMyAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <HardDrive className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-[11px]">暂无本地素材</p>
            <p className="text-[9px] mt-1">导入 .sassets 素材包开始使用</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 h-7 text-[10px]"
              onClick={handleImportClick}
            >
              <Upload className="w-3 h-3 mr-1" />
              导入素材包
            </Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredMyAssets.map((asset) => (
              <MyAssetItem
                key={asset.hash}
                asset={asset}
                isEditing={editingAsset?.hash === asset.hash}
                editName={editName}
                editInputRef={editInputRef}
                onClick={() => handleMyAssetClick(asset)}
                onEdit={() => handleStartRename(asset)}
                onEditChange={(v) => setEditName(v)}
                onEditSubmit={handleRenameSubmit}
                onDelete={() => setDeleteConfirm(asset)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="border-t px-2.5 py-1.5">
        <p className="text-[9px] text-muted-foreground text-center leading-relaxed">
          {activePanel === 'official'
            ? `共 ${filteredOfficialAssets.length} 个素材 · 点击查看详情`
            : `共 ${filteredMyAssets.length} 个本地素材`}
        </p>
      </div>

      {previewAsset && (
        <AssetPreviewModal
          asset={previewAsset}
          selectedNode={selectedNode}
          onClose={handleClosePreview}
          onInsert={handleInsert}
        />
      )}

      {deleteConfirm && (
        <DeleteConfirmModal
          asset={deleteConfirm}
          onConfirm={() => handleDelete(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  )
}

interface AssetCardProps {
  asset: LibraryAsset
  onClick: (asset: LibraryAsset) => void
}

const AssetCard = memo(function AssetCard({ asset, onClick }: AssetCardProps) {
  const handleClick = useCallback(() => onClick(asset), [asset, onClick])
  const isAudio = asset.fileType === 'audio' || asset.category === 'audio'
  const licenseStyle = LICENSE_STYLES[asset.license] || LICENSE_STYLES.free

  return (
    <button
      onClick={handleClick}
      className="group relative rounded-md overflow-hidden border border-border/60 bg-background hover:border-primary/60 hover:ring-1 hover:ring-primary/40 transition-all cursor-pointer"
      title={asset.name}
    >
      <div className="aspect-square bg-muted/40 relative overflow-hidden">
        {isAudio || !asset.thumbnailUrl ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-900/30 to-slate-900/40">
            <Music className="w-5 h-5 text-purple-400/70" />
          </div>
        ) : (
          <img
            src={asset.thumbnailUrl}
            alt={asset.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
          />
        )}
        <div className="absolute top-0.5 left-0.5">
          <span className={`inline-block px-1 py-px rounded-sm text-[8px] font-medium leading-tight border ${licenseStyle}`}>
            {LICENSE_LABELS[asset.license] || asset.license}
          </span>
        </div>
      </div>
      <div className="px-1 py-0.5 bg-card">
        <p className="text-[9px] font-medium leading-tight truncate">{asset.name}</p>
      </div>
    </button>
  )
})

interface MyAssetItemProps {
  asset: StoredAsset
  isEditing: boolean
  editName: string
  editInputRef: React.RefObject<HTMLInputElement | null>
  onClick: () => void
  onEdit: () => void
  onEditChange: (v: string) => void
  onEditSubmit: () => void
  onDelete: () => void
}

const MyAssetItem = memo(function MyAssetItem({
  asset,
  isEditing,
  editName,
  editInputRef,
  onClick,
  onEdit,
  onEditChange,
  onEditSubmit,
  onDelete,
}: MyAssetItemProps) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)
  const isAudio = asset.type.startsWith('audio/')
  const isVideo = asset.type.startsWith('video/')

  useEffect(() => {
    if (!isAudio && !isVideo && asset.blob) {
      let cancelled = false
      generateThumbnail(asset.blob, 100, 100)
        .then((url) => {
          if (!cancelled) setThumbUrl(url)
        })
        .catch(() => {})
      return () => {
        cancelled = true
      }
    }
  }, [asset.blob, asset.hash, isAudio, isVideo])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        onEditSubmit()
      } else if (e.key === 'Escape') {
        onEditSubmit()
      }
    },
    [onEditSubmit]
  )

  return (
    <div className="flex items-center gap-2 p-1.5 rounded-md border border-border/60 bg-background hover:border-primary/40 transition-colors group">
      <button
        onClick={onClick}
        className="shrink-0 w-10 h-10 rounded overflow-hidden bg-muted/40 flex items-center justify-center"
      >
        {isAudio ? (
          <Music className="w-4 h-4 text-purple-400/70" />
        ) : isVideo ? (
          <ImageIcon className="w-4 h-4 text-blue-400/70" />
        ) : thumbUrl ? (
          <img src={thumbUrl} alt={asset.name} className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="w-4 h-4 text-muted-foreground/50" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={editInputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={editName}
            onChange={(e) => onEditChange(e.target.value)}
            onBlur={onEditSubmit}
            onKeyDown={handleKeyDown}
            className="w-full h-5 text-[10px] px-1.5 rounded border border-ochre-400/60 bg-background focus:outline-none focus:ring-1 focus:ring-ochre-400"
          />
        ) : (
          <p className="text-[10px] font-medium truncate">{asset.name}</p>
        )}
        <p className="text-[9px] text-muted-foreground mt-0.5">
          {formatFileSize(asset.size)} · {asset.type.split('/')[1] || asset.type}
        </p>
      </div>

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
          title="重命名"
        >
          <Edit3 className="w-3 h-3" />
        </button>
        <button
          onClick={onDelete}
          className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
          title="删除"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
})

interface AssetPreviewModalProps {
  asset: LibraryAsset
  selectedNode?: StoryNode | null
  onClose: () => void
  onInsert: () => void
}

function AssetPreviewModal({ asset, selectedNode, onClose, onInsert }: AssetPreviewModalProps) {
  const isAudio = asset.fileType === 'audio' || asset.category === 'audio'
  const licenseStyle = LICENSE_STYLES[asset.license] || LICENSE_STYLES.free
  const hasUrl = Boolean(asset.fullUrl)

  const insertHint = useMemo(() => {
    if (!selectedNode) return '请先选中一个节点再插入'
    if (!hasUrl) return '此素材需自行上传，暂不支持直接插入'
    if (asset.category === 'background') {
      return '将设置到当前节点的背景图字段'
    }
    if (asset.category === 'character') {
      const characterId = (selectedNode.data as Record<string, unknown>)?.characterId
      if (!characterId) return '请选中一个有角色的对话节点'
      return '将作为新立绘添加到当前对话节点的角色'
    }
    return '可插入到当前节点'
  }, [selectedNode, hasUrl, asset.category])

  const canInsert = Boolean(selectedNode) && hasUrl

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-card border rounded-lg shadow-2xl w-[420px] max-w-[90vw] max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-sm font-medium flex items-center gap-2">
            {isAudio ? <Music className="w-4 h-4 text-purple-400" /> : <ImageIcon className="w-4 h-4 text-blue-400" />}
            素材详情
          </h3>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
            title="关闭 (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-black/40 flex items-center justify-center" style={{ minHeight: '200px', maxHeight: '320px' }}>
          {isAudio || !asset.fullUrl ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Music className="w-16 h-16 mb-3 opacity-40" />
              <p className="text-xs">音频素材占位</p>
              <p className="text-[10px] mt-1">需自行上传音频文件</p>
            </div>
          ) : (
            <img
              src={asset.fullUrl}
              alt={asset.name}
              className="max-w-full max-h-[320px] object-contain"
            />
          )}
        </div>

        <div className="px-4 py-3 space-y-2 overflow-y-auto">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{asset.name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{asset.description}</p>
            </div>
            <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-medium border ${licenseStyle}`}>
              {LICENSE_LABELS[asset.license] || asset.license}
            </span>
          </div>

          {asset.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {asset.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground pt-1">
            <div>
              <span className="text-muted-foreground/70">来源：</span>
              <span className="text-foreground/80">{asset.source}</span>
            </div>
            {asset.author && (
              <div>
                <span className="text-muted-foreground/70">作者：</span>
                <span className="text-foreground/80">{asset.author}</span>
              </div>
            )}
            {asset.dimensions && (
              <div>
                <span className="text-muted-foreground/70">尺寸：</span>
                <span className="text-foreground/80">{asset.dimensions.width} × {asset.dimensions.height}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground/70">类型：</span>
              <span className="text-foreground/80">
                {asset.fileType === 'audio' ? '音频' : asset.fileType === 'video' ? '视频' : '图片'}
              </span>
            </div>
          </div>

          <div className="bg-muted/40 rounded-md px-2.5 py-1.5 text-[10px] text-muted-foreground leading-relaxed">
            {asset.license === 'cc0' && 'CC0：完全放弃版权，可任意使用，包括商用。'}
            {asset.license === 'free' && '免费：可免费使用，包括商用场景。'}
            {asset.license === 'cc-by' && 'CC-BY：可商用，但需标注原作者。'}
            {asset.license === 'commercial' && '可商用：购买后可用于商业用途。'}
          </div>
        </div>

        <div className="border-t px-4 py-3 space-y-2">
          <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground bg-muted/30 rounded px-2 py-1.5">
            {canInsert ? (
              <Check className="w-3 h-3 mt-0.5 shrink-0 text-green-500" />
            ) : (
              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0 text-amber-500" />
            )}
            <span className="leading-relaxed">{insertHint}</span>
          </div>

          <div className="flex gap-2">
            {asset.fullUrl && (
              <a
                href={asset.fullUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button variant="outline" size="sm" className="w-full h-8 text-xs">
                  <ExternalLink className="w-3.5 h-3.5 mr-1" />
                  打开原图
                </Button>
              </a>
            )}
            <Button
              size="sm"
              className="flex-1 h-8 text-xs"
              disabled={!canInsert}
              onClick={onInsert}
            >
              插入到当前节点
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface DeleteConfirmModalProps {
  asset: StoredAsset
  onConfirm: () => void
  onCancel: () => void
}

function DeleteConfirmModal({ asset, onConfirm, onCancel }: DeleteConfirmModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="bg-card border rounded-lg shadow-2xl w-[320px] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-red-400" />
            删除素材
          </h3>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-foreground/90">确定要删除此素材吗？</p>
          <p className="text-[11px] text-muted-foreground mt-1 break-all">
            {asset.name}
          </p>
          <p className="text-[10px] text-red-400/80 mt-2">此操作无法撤销。</p>
        </div>
        <div className="border-t px-4 py-3 flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={onCancel}>
            取消
          </Button>
          <Button
            size="sm"
            className="flex-1 h-8 text-xs bg-red-500 hover:bg-red-600 text-white"
            onClick={onConfirm}
          >
            确认删除
          </Button>
        </div>
      </div>
    </div>
  )
}

export const AssetLibraryPanel = memo(AssetLibraryPanelImpl)
export { AssetLibraryPanel as default }
