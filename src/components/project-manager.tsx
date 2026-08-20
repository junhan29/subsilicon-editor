import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, AlertTriangle, BookOpen, CheckCircle, CheckCircle2, Clock, Copy, Download, Edit3, ExternalLink, FileText, FolderOpen, FolderSync, Grid, HardDrive, Hash, List, MoreHorizontal, Plus, RefreshCw, Search, Settings, Sparkles, Star, Store, Trash2, X } from 'lucide-react'
import type { StoryGraph } from '@editor/types/editor'
import type { WorkDocument, WorkTypeId } from '@editor/types/work'
import { type StoredWork, deleteWork, generateProjectId, getAllWorks, loadWork, saveWork } from '@editor/lib/local-db/work-store'
import { createEmptyInteractiveGraph, interactiveNarrativeAdapter } from '@editor/lib/work-types/interactive-narrative'
import { isWorkDocument } from '@editor/lib/work-registry'

// Mac 应用未签名，无法在应用内自动下载安装；仅保留版本检测，引导用户手动下载
type UpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'error'
interface UpdateInfo { version: string; releaseDate?: string; releaseNotes?: string; downloadUrl?: string }

const emptyGraph: StoryGraph = createEmptyInteractiveGraph()

interface ProjectManagerProps {
  onOpenProject: (work: StoredWork) => void
  onNewProject: (work: StoredWork) => void
  onOpenSettings: () => void
  onOpenBooth: () => void
}

export function ProjectManager({ onOpenProject, onNewProject, onOpenSettings, onOpenBooth }: ProjectManagerProps) {
  const [works, setWorks] = useState<StoredWork[]>([])
  const [loading, setLoading] = useState(true)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState<'lastOpened' | 'created' | 'name'>('lastOpened')
  
  // 新建项目对话框状态
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectPath, setNewProjectPath] = useState('')
  const [newProjectType, setNewProjectType] = useState<WorkTypeId>('interactive-narrative')
  const [creating, setCreating] = useState(false)
  
  // 导入项目状态
  const [importing, setImporting] = useState(false)

  // 删除确认对话框状态
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')

  const loadWorks = useCallback(async () => {
    setLoading(true)
    try {
      const all = await getAllWorks()
      all.sort((a, b) => b.lastOpened - a.lastOpened)
      setWorks(all)
    } catch {
      setWorks([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadWorks()
  }, [loadWorks])

  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle')
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const updateInitRef = useRef(false)

  useEffect(() => {
    if (updateInitRef.current) return
    updateInitRef.current = true
    const api = window.__electronAPI
    if (!api) return

    const unsubs = [
      api.onUpdateChecking(() => {
        setUpdateStatus('checking')
        setUpdateError(null)
      }),
      api.onUpdateAvailable((info: UpdateInfo) => {
        setUpdateStatus('available')
        setUpdateInfo(info)
        setUpdateError(null)
      }),
      api.onUpdateNotAvailable(() => setUpdateStatus('not-available')),
      api.onUpdateError((message: string) => {
        setUpdateStatus('error')
        setUpdateError(message || '更新失败')
      }),
    ]

    setTimeout(() => api.checkForUpdates(), 2000)

    return () => unsubs.forEach(fn => fn())
  }, [])

  const handleCheckUpdates = () => {
    if (updateStatus === 'checking') return
    setUpdateStatus('checking')
    window.__electronAPI?.checkForUpdates()
    setTimeout(() => setUpdateStatus(s => s === 'checking' ? 'idle' : s), 15000)
  }

  // Mac 应用未签名，无法在应用内自动下载安装；引导用户到浏览器下载 DMG 手动安装
  const handleDownloadUpdate = () => {
    window.__electronAPI?.openDownloadPage()
  }

  // 打开新建项目对话框
  const handleOpenNewProjectDialog = () => {
    setNewProjectName('')
    setNewProjectPath('')
    setNewProjectType('interactive-narrative')
    setShowNewProjectDialog(true)
  }

  // 确认创建新项目
  const handleConfirmNewProject = async () => {
    if (!newProjectName.trim()) return
    setCreating(true)
    try {
      const id = generateProjectId()
      const now = Date.now()
      // 按所选作品类型创建 WorkDocument（novel/video/comic 使用独立模型）
      let editorData: StoredWork['editorData']
      if (newProjectType === 'novel') {
        const { createEmptyNovelDocument } = await import('@editor/lib/work-types/novel')
        editorData = createEmptyNovelDocument(newProjectName.trim())
      } else if (newProjectType === 'video') {
        const { createEmptyVideoDocument } = await import('@editor/lib/work-types/video')
        editorData = createEmptyVideoDocument(newProjectName.trim())
      } else if (newProjectType === 'comic') {
        const { createEmptyComicDocument } = await import('@editor/lib/work-types/comic')
        editorData = createEmptyComicDocument(newProjectName.trim())
      } else {
        const graph: StoryGraph = { ...emptyGraph, title: newProjectName.trim() }
        editorData = interactiveNarrativeAdapter.fromGraph(graph)
      }
      const work: StoredWork = {
        id,
        name: newProjectName.trim(),
        updatedAt: now,
        createdAt: now,
        lastOpened: now,
        nodeCount: 0,
        edgeCount: 0,
        templateId: 'custom',
        workType: newProjectType,
        editorData,
        customPath: newProjectPath.trim() || undefined,
      }
      await saveWork(work)
      setShowNewProjectDialog(false)
      onNewProject(work)
    } finally {
      // 保存失败也不让「创建并打开」按钮永久 loading
      setCreating(false)
    }
  }

  // 从文件导入项目
  const handleImportProject = async () => {
    setImporting(true)
    try {
      // 使用 Electron 的文件选择对话框
      const result = await window.__electronAPI?.openFileDialog({
        title: '选择项目文件',
        filters: [
          { name: 'SubSilicon 项目', extensions: ['json', 'story.html'] },
          { name: 'JSON 文件', extensions: ['json'] },
          { name: 'HTML 故事文件', extensions: ['story.html'] },
        ],
        properties: ['openFile'],
      })
      
      if (result && result.filePaths && result.filePaths[0]) {
        const filePath = result.filePaths[0]
        const fileResult = await window.__electronAPI?.readFileAsText?.(filePath)
        if (fileResult?.success && fileResult.data) {
          const content = fileResult.data
          let parsed: unknown = null

          // 解析文件内容
          if (filePath.endsWith('.json')) {
            parsed = JSON.parse(content)
          } else if (filePath.endsWith('.story.html')) {
            // 从 HTML 中提取嵌入的 JSON 数据
            const match = content.match(/<script[^>]*id="story-data"[^>]*>([\s\S]*?)<\/script>/)
            if (match) {
              parsed = JSON.parse(match[1])
            }
          }
          
          if (parsed) {
            const id = generateProjectId()
            const now = Date.now()

            // v2 WorkDocument（novel/video/comic/互动叙事）：保留 workType / extra / graph，
            // 绝不能按旧 StoryGraph 解析，否则类型数据埋在 graph.extra 中会被丢弃，
            // 后续在 StoryCanvas 保存时永久覆盖原数据。
            if (isWorkDocument(parsed)) {
              const doc = parsed
              const graph = doc.graph
              const metaTitle = doc.meta?.title
              const work: StoredWork = {
                id,
                name: metaTitle || '导入的项目',
                updatedAt: now,
                createdAt: now,
                lastOpened: now,
                nodeCount: graph.nodes?.length || 0,
                edgeCount: graph.edges?.length || 0,
                templateId: 'custom',
                workType: doc.workType,
                editorData: doc,
              }
              await saveWork(work)
              loadWorks()
            } else {
              const projectData = parsed as Partial<StoryGraph>
              const graph: StoryGraph = {
                ...emptyGraph,
                ...projectData,
                title: projectData.title || projectData.settings?.title || '导入的项目',
              }
              const work: StoredWork = {
                id,
                name: projectData.title || projectData.settings?.title || '导入的项目',
                updatedAt: now,
                createdAt: now,
                lastOpened: now,
                nodeCount: projectData.nodes?.length || 0,
                edgeCount: projectData.edges?.length || 0,
                templateId: projectData.templateId || 'custom',
                workType: 'interactive-narrative',
                editorData: interactiveNarrativeAdapter.fromGraph(graph),
              }
              await saveWork(work)
              loadWorks()
            }
          }
        }
      }
    } catch (error) {
      console.error('导入项目失败:', error)
      // 添加错误提示，用户可见
      alert(`导入项目失败：${error instanceof Error ? error.message : '文件格式不正确或已损坏'}`)
    }
    setImporting(false)
  }

  const handleNewProject = async () => {
    const id = generateProjectId()
    const now = Date.now()
    const graph: StoryGraph = { ...emptyGraph, title: '新项目' }
    const work: StoredWork = {
      id,
      name: '新项目',
      updatedAt: now,
      createdAt: now,
      lastOpened: now,
      nodeCount: 0,
      edgeCount: 0,
      templateId: 'custom',
      workType: 'interactive-narrative',
      editorData: interactiveNarrativeAdapter.fromGraph(graph),
    }
    await saveWork(work)
    onNewProject(work)
  }

  const handleOpenProject = async (work: StoredWork) => {
    try {
      const fresh = await loadWork(work.id)
      if (fresh) {
        fresh.lastOpened = Date.now()
        await saveWork(fresh)
        onOpenProject(fresh)
        return
      }
    } catch { }
    work.lastOpened = Date.now()
    await saveWork(work)
    onOpenProject(work)
  }

  const handleDelete = async (id: string) => {
    await deleteWork(id)
    setMenuOpenId(null)
    setDeleteConfirmId(null)
    loadWorks()
  }

  const showDeleteConfirm = (work: StoredWork) => {
    setDeleteConfirmId(work.id)
    setDeleteConfirmName(work.name)
    setMenuOpenId(null)
  }

  const handleDuplicate = async (work: StoredWork) => {
    const id = generateProjectId()
    const now = Date.now()
    let clonedEditorData
    try {
      clonedEditorData = JSON.parse(JSON.stringify(work.editorData))
    } catch {
      clonedEditorData = work.editorData
    }
    const copy: StoredWork = {
      ...work,
      id,
      name: work.name + ' (副本)',
      createdAt: now,
      lastOpened: now,
      updatedAt: now,
      editorData: clonedEditorData,
    }
    await saveWork(copy)
    setMenuOpenId(null)
    loadWorks()
  }

  const startRename = (work: StoredWork) => {
    setRenamingId(work.id)
    setRenameValue(work.name)
    setMenuOpenId(null)
  }

  const confirmRename = async () => {
    if (!renamingId || !renameValue.trim()) return
    const work = works.find((w) => w.id === renamingId)
    if (work) {
      work.name = renameValue.trim()
      // 兼容双格式：WorkDocument 更新 meta+graph.title，旧格式更新 graph.title
      if (work.editorData && 'workType' in work.editorData) {
        const doc = work.editorData as WorkDocument
        doc.meta.title = renameValue.trim()
        doc.graph.title = renameValue.trim()
      } else {
        work.editorData.title = renameValue.trim()
      }
      await saveWork(work)
      loadWorks()
    }
    setRenamingId(null)
  }

  const formatDate = (ts: number) => {
    const d = new Date(ts)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  // 过滤和排序
  const filteredWorks = works
    .filter((w) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return w.name.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      if (sortBy === 'lastOpened') return (b.lastOpened || 0) - (a.lastOpened || 0)
      if (sortBy === 'created') return (b.createdAt || 0) - (a.createdAt || 0)
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      return 0
    })

  return (
    <div className="h-screen w-screen bg-card flex flex-col overflow-hidden relative">
      {/* 半调网点装饰 - 右上 */}
      <div className="absolute top-16 right-8 w-20 h-20 opacity-[0.06] pointer-events-none z-0"
        style={{
          backgroundImage: 'radial-gradient(hsl(var(--gold)) 1px, transparent 1px)',
          backgroundSize: '8px 8px',
        }}
      />

      {/* 顶栏 - P5剪贴风 */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/80 backdrop-blur relative z-10">
        {/* 订书钉装饰 */}
        <div className="absolute top-0 left-12 w-5 h-1.5 bg-slate-400/50 rounded-b-[1px] z-20 shadow-[0_1px_0_rgba(0,0,0,0.1)]" />
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[2px] clip-path-polygon-[0_0,75%_0,100%_25%,100%_100%,0_100%] bg-gradient-to-br from-p5-red via-p5-red to-gold-500 flex items-center justify-center shadow-[2px_2px_0_hsl(var(--p5-red)/0.25)] border border-gold-400/30">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-lg font-bold text-foreground tracking-wider">SubSilicon Editor</h1>
          <div className="rotate-[8deg]">
            <span className="text-[9px] font-black px-1.5 py-0.5 border border-p5-red/50 bg-p5-red/10 text-p5-red tracking-tighter">
              HOME
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCheckUpdates}
            disabled={updateStatus === 'checking'}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-[2px] transition-all border ${
              updateStatus === 'available'
                ? 'bg-gold-400/15 text-gold-500 border-gold-400/40 shadow-[2px_2px_0_hsl(var(--gold)/0.2)] hover:bg-gold-400/25'
                : updateStatus === 'not-available'
                ? 'bg-cyber-cyan-400/10 text-cyber-cyan-500 border-cyber-cyan-400/30 shadow-[2px_2px_0_hsl(var(--cyber-cyan)/0.15)]'
                : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-gold-400/8 hover:border-gold-400/30 shadow-[1px_1px_0_hsl(var(--gold)/0.1)]'
            } ${updateStatus === 'checking' ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={
              updateStatus === 'available' ? `发现新版本 v${updateInfo?.version}` :
              updateStatus === 'checking' ? '检查中...' :
              '检查更新'
            }
          >
            {updateStatus === 'checking' ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : updateStatus === 'available' ? (
              <Download className="w-4 h-4" />
            ) : updateStatus === 'not-available' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {updateStatus === 'checking' ? '检查中' :
             updateStatus === 'available' ? '有更新' :
             updateStatus === 'not-available' ? '已是最新' :
             '检查更新'}
          </button>
          <button
            onClick={onOpenBooth}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gold-500 hover:text-gold-400 bg-gold-400/10 hover:bg-gold-400/15 rounded-[2px] border border-gold-400/30 shadow-[2px_2px_0_hsl(var(--gold)/0.18)] transition-all"
            title="摊位工作台：管理摊位资料、作品陈列、试阅与价目，一键摆摊"
          >
            <Store className="w-4 h-4" />
            摊位工作台
          </button>
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-gold-400/8 rounded-[2px] border border-transparent hover:border-gold-400/25 transition-all shadow-[1px_1px_0_hsl(var(--gold)/0.08)]"
          >
            <Settings className="w-4 h-4" />
            设置
          </button>
        </div>
      </header>

      {/* 更新通知横幅：检测到新版本时引导用户到浏览器下载 DMG 手动安装 */}
      {(updateStatus === 'available' || updateStatus === 'error') && updateInfo && (
        <div className={`mx-6 mt-3 mb-0 p-4 rounded-[2px] border shadow-[4px_4px_0_hsl(var(--gold)/0.15)] clip-path-polygon-[0_0,calc(100%-12px)_0,100%_12px,100%_100%,0_100%] ${
          updateStatus === 'error'
            ? 'bg-p5-red/10 border-p5-red/30'
            : 'bg-gradient-to-r from-gold-400/10 to-gold-500/5 border-gold-400/30'
        }`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                updateStatus === 'error' ? 'bg-primary/15' : 'bg-gold-400/15'
              }`}>
                {updateStatus === 'error' ? (
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-gold-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">
                  {updateStatus === 'available' && `新版本 v${updateInfo.version} 可用`}
                  {updateStatus === 'error' && `更新失败`}
                </p>
                {updateStatus === 'error' && updateError && (
                  <p className="text-xs text-red-400 mt-0.5 line-clamp-1">{updateError}</p>
                )}
                {updateStatus !== 'error' && updateInfo.releaseNotes && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {updateInfo.releaseNotes.split('\n').slice(1, 3).join(' · ').replace(/^##\s*/, '')}
                  </p>
                )}
                {updateStatus === 'available' && (
                  <p className="text-[11px] text-gold-400/80 mt-0.5">
                    应用未签名，需在浏览器下载 DMG 手动安装
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {updateStatus === 'available' && (
                <button
                  onClick={handleDownloadUpdate}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gold-400 hover:bg-gold-500 text-white text-xs font-bold rounded-[2px] border border-gold-400 shadow-[2px_2px_0_hsl(var(--gold)/0.2)] transition-colors tracking-wide"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  前往下载
                </button>
              )}
              {updateStatus === 'error' && (
                <button
                  onClick={handleCheckUpdates}
                  className="flex items-center gap-1.5 px-4 py-2 bg-p5-red hover:bg-p5-red/90 text-white text-xs font-bold rounded-[2px] border border-p5-red/30 shadow-[2px_2px_0_hsl(var(--p5-red)/0.2)] transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  重试
                </button>
              )}
              <button
                onClick={() => { setUpdateStatus('idle'); setUpdateInfo(null); setUpdateError(null) }}
                className="p-2 rounded-[2px] hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : works.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="w-20 h-20 rounded-[2px] bg-muted border-2 border-dashed border-border flex items-center justify-center shadow-[4px_4px_0_hsl(var(--gold)/0.12)] clip-path-polygon-[0_0,85%_0,100%_15px,100%_100%,0_100%]">
              <FolderOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-bold text-foreground mb-1 tracking-wider">欢迎使用 SubSilicon Editor</h2>
              <p className="text-sm text-muted-foreground mb-6">创建一个新项目或打开已有项目</p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleOpenNewProjectDialog}
                className="flex items-center gap-2 px-6 py-3 bg-gold-400 hover:bg-gold-500 text-white rounded-[2px] text-sm font-bold transition-colors shadow-[3px_3px_0_hsl(var(--gold)/0.25)] border border-gold-400 tracking-wide"
              >
                <Plus className="w-5 h-5" />
                新建项目
              </button>
              <button
                onClick={handleImportProject}
                disabled={importing}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-card hover:bg-secondary text-foreground rounded-[2px] text-sm font-bold transition-colors disabled:opacity-50 border border-border shadow-[2px_2px_0_hsl(var(--gold)/0.12)] tracking-wide"
              >
                {importing ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <FolderSync className="w-5 h-5" />
                )}
                打开其他位置
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* 工具栏：搜索、排序、视图切换 - P5风 */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索项目..."
                  className="w-full h-8 pl-8 pr-3 text-xs rounded-[2px] border border-border bg-muted text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold-400 shadow-[1px_1px_0_hsl(var(--gold)/0.1)]"
                />
              </div>
              <div className="flex items-center gap-1 bg-muted rounded-[2px] p-0.5 border border-border shadow-[1px_1px_0_hsl(var(--gold)/0.08)]">
                <button
                  onClick={() => setSortBy('lastOpened')}
                  className={`px-2 py-1 text-[10px] rounded-[2px] transition-colors ${sortBy === 'lastOpened' ? 'bg-gold-400/20 text-gold-500' : 'text-muted-foreground hover:text-foreground'}`}
                  title="最近打开"
                >
                  <Clock className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setSortBy('created')}
                  className={`px-2 py-1 text-[10px] rounded-[2px] transition-colors ${sortBy === 'created' ? 'bg-gold-400/20 text-gold-500' : 'text-muted-foreground hover:text-foreground'}`}
                  title="创建时间"
                >
                  <Star className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setSortBy('name')}
                  className={`px-2 py-1 text-[10px] rounded-[2px] transition-colors ${sortBy === 'name' ? 'bg-gold-400/20 text-gold-500' : 'text-muted-foreground hover:text-foreground'}`}
                  title="名称"
                >
                  <Hash className="w-3 h-3" />
                </button>
              </div>
              <div className="flex items-center gap-1 bg-muted rounded-[2px] p-0.5 border border-border shadow-[1px_1px_0_hsl(var(--gold)/0.08)]">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1 rounded-[2px] transition-colors ${viewMode === 'grid' ? 'bg-gold-400/20 text-gold-500' : 'text-muted-foreground hover:text-foreground'}`}
                  title="网格视图"
                >
                  <Grid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1 rounded-[2px] transition-colors ${viewMode === 'list' ? 'bg-gold-400/20 text-gold-500' : 'text-muted-foreground hover:text-foreground'}`}
                  title="列表视图"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={handleImportProject}
                  disabled={importing}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-gold-400/8 rounded-[2px] transition-colors disabled:opacity-50 border border-transparent hover:border-gold-400/25 shadow-[1px_1px_0_hsl(var(--gold)/0.08)]"
                >
                  {importing ? (
                    <div className="w-4 h-4 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <FolderSync className="w-4 h-4" />
                  )}
                  打开
                </button>
                <button
                  onClick={handleOpenNewProjectDialog}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gold-400 hover:bg-gold-500 text-white rounded-[2px] transition-colors border border-gold-400 shadow-[2px_2px_0_hsl(var(--gold)/0.2)]"
                >
                  <Plus className="w-4 h-4" />
                  新建项目
                </button>
              </div>
            </div>

            {/* 项目统计 */}
            <div className="flex items-center gap-4 mb-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <HardDrive className="w-3 h-3" />
                {works.length} 个项目
              </span>
              {searchQuery && (
                <span>
                  搜索到 {filteredWorks.length} 个结果
                </span>
              )}
            </div>

            {/* 网格视图 - P5剪贴卡 */}
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredWorks.map((work) => (
                  <div
                    key={work.id}
                    className="group relative bg-muted/50 rounded-[2px] border border-border/50 hover:border-gold-400/50 transition-all overflow-hidden cursor-pointer clip-path-polygon-[0_0,calc(100%-8px)_0,100%_8px,100%_100%,0_100%] shadow-[3px_3px_0_hsl(var(--gold)/0.1)] hover:shadow-[4px_4px_0_hsl(var(--gold)/0.18)]"
                    onClick={() => {
                      if (renamingId !== work.id) handleOpenProject(work)
                    }}
                  >
                    {/* 缩略图占位 */}
                    <div className="aspect-[16/10] bg-gradient-to-br from-muted to-card flex items-center justify-center">
                      {work.thumbnail ? (
                        <img src={work.thumbnail} alt={work.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-muted-foreground">
                          <BookOpen className="w-8 h-8" />
                          <span className="text-[10px]">{work.nodeCount} 个节点</span>
                        </div>
                      )}
                    </div>

                    {/* 信息区 */}
                    <div className="p-3">
                      {renamingId === work.id ? (
                        <input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={confirmRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') confirmRename()
                            if (e.key === 'Escape') setRenamingId(null)
                          }}
                          className="w-full text-xs font-medium bg-secondary border border-primary rounded px-1.5 py-0.5 text-white outline-none"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <p className="text-xs font-medium text-white truncate">{work.name}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(work.lastOpened)}</span>
                        <span className="ml-auto">{work.nodeCount} 节点</span>
                      </div>
                    </div>

                    {/* 菜单按钮 */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setMenuOpenId(menuOpenId === work.id ? null : work.id)
                          }}
                          className="p-1 rounded-[2px] bg-black/50 hover:bg-black/70 text-white transition-colors border border-white/10"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {menuOpenId === work.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
                            <div className="absolute right-0 top-full mt-1 z-20 w-36 bg-muted rounded-[2px] border border-border shadow-[4px_4px_0_hsl(var(--gold)/0.15)] overflow-hidden">
                              <button
                                onClick={(e) => { e.stopPropagation(); startRename(work) }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-gold-400/10 transition-colors"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                重命名
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDuplicate(work) }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-gold-400/10 transition-colors"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                复制
                              </button>
                              <button
                              onClick={(e) => { e.stopPropagation(); showDeleteConfirm(work) }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-p5-red hover:bg-p5-red/10 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              删除
                            </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* 列表视图 - P5风 */
              <div className="space-y-1.5">
                {filteredWorks.map((work) => (
                  <div
                    key={work.id}
                    className="group flex items-center gap-3 p-3 bg-muted/50 rounded-[2px] border border-border/50 hover:border-gold-400/50 hover:bg-muted/70 transition-all cursor-pointer clip-path-polygon-[0_0,calc(100%-6px)_0,100%_6px,100%_100%,0_100%] shadow-[2px_2px_0_hsl(var(--gold)/0.08)] hover:shadow-[3px_3px_0_hsl(var(--gold)/0.15)]"
                    onClick={() => {
                      if (renamingId !== work.id) handleOpenProject(work)
                    }}
                  >
                    {/* 图标 */}
                    <div className="w-10 h-10 rounded-[2px] bg-gradient-to-br from-gold-400/20 to-muted flex items-center justify-center shrink-0 border border-gold-400/30">
                      {work.thumbnail ? (
                        <img src={work.thumbnail} alt={work.name} className="w-full h-full object-cover" />
                      ) : (
                        <BookOpen className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>

                    {/* 信息 */}
                    <div className="flex-1 min-w-0">
                      {renamingId === work.id ? (
                        <input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={confirmRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') confirmRename()
                            if (e.key === 'Escape') setRenamingId(null)
                          }}
                          className="w-full text-xs font-medium bg-secondary border border-gold-400 rounded-[2px] px-1.5 py-0.5 text-white outline-none"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <p className="text-xs font-medium text-foreground truncate">{work.name}</p>
                      )}
                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(work.lastOpened)}
                        </span>
                        <span>{work.nodeCount} 节点</span>
                        <span>{work.edgeCount || 0} 连接</span>
                        {work.customPath && (
                          <span className="truncate text-muted-foreground">{work.customPath}</span>
                        )}
                      </div>
                    </div>

                    {/* 操作菜单 */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setMenuOpenId(menuOpenId === work.id ? null : work.id)
                          }}
                          className="p-1.5 rounded-[2px] hover:bg-gold-400/10 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {menuOpenId === work.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
                            <div className="absolute right-0 top-full mt-1 z-20 w-36 bg-muted rounded-[2px] border border-border shadow-[4px_4px_0_hsl(var(--gold)/0.15)] overflow-hidden">
                              <button
                                onClick={(e) => { e.stopPropagation(); startRename(work) }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-gold-400/10 transition-colors"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                重命名
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDuplicate(work) }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-gold-400/10 transition-colors"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                复制
                              </button>
                              <button
                              onClick={(e) => { e.stopPropagation(); showDeleteConfirm(work) }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-p5-red hover:bg-p5-red/10 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              删除
                            </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 底部信息 */}
      <footer className="flex items-center justify-between px-6 py-2 border-t border-border bg-card/80">
        <span className="text-[10px] text-muted-foreground">{__APP_NAME__} {__APP_VERSION__}</span>
        <span className="text-[10px] text-muted-foreground">项目存储在本地数据库中</span>
      </footer>

      {/* 新建项目对话框 - P5剪贴风 */}
      {showNewProjectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-muted rounded-[2px] border border-border shadow-[6px_6px_0_hsl(var(--gold)/0.2)] clip-path-polygon-[0_0,calc(100%-14px)_0,100%_14px,100%_100%,0_100%] w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-bold text-foreground tracking-wider">新建项目</h3>
              <button
                onClick={() => setShowNewProjectDialog(false)}
                className="p-1 rounded-[2px] hover:bg-gold-400/10 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-semibold tracking-wide">作品类型</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'interactive-narrative' as WorkTypeId, name: '互动叙事', desc: '节点图 · 分支 · 多结局' },
                    { id: 'novel' as WorkTypeId, name: '小说', desc: '章节树 · 富文本正文' },
                    { id: 'video' as WorkTypeId, name: '视频', desc: '时间线 · 字幕 · 配音' },
                    { id: 'comic' as WorkTypeId, name: '漫画', desc: '分镜画格 · 台词旁白' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setNewProjectType(t.id)}
                      className={`p-2.5 rounded-[2px] border text-left transition-all ${
                        newProjectType === t.id
                          ? 'border-gold-400 bg-gold-400/10 shadow-[2px_2px_0_hsl(var(--gold)/0.2)]'
                          : 'border-border hover:border-gold-400/50'
                      }`}
                    >
                      <div className="text-sm font-bold text-foreground tracking-wide">{t.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-semibold tracking-wide">项目名称 *</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder={newProjectType === 'novel' ? '输入书名...' : newProjectType === 'video' ? '输入视频标题...' : newProjectType === 'comic' ? '输入漫画标题...' : '输入项目名称...'}
                  className="w-full h-9 text-sm rounded-[2px] border border-border bg-secondary px-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold-400 shadow-[1px_1px_0_hsl(var(--gold)/0.1)]"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirmNewProject()}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-semibold tracking-wide">存储位置（可选）</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newProjectPath}
                    onChange={(e) => setNewProjectPath(e.target.value)}
                    placeholder="默认使用应用数据目录"
                    className="flex-1 h-9 text-sm rounded-[2px] border border-border bg-secondary px-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold-400 shadow-[1px_1px_0_hsl(var(--gold)/0.1)]"
                  />
                  <button
                    onClick={async () => {
                      const result = await window.__electronAPI?.openFileDialog({
                        title: '选择存储目录',
                        properties: ['openDirectory'],
                      })
                      if (result?.filePaths?.[0]) {
                        setNewProjectPath(result.filePaths[0])
                      }
                    }}
                    className="px-3 h-9 text-xs bg-card hover:bg-secondary text-foreground rounded-[2px] border border-border hover:border-gold-400/30 shadow-[1px_1px_0_hsl(var(--gold)/0.1)] transition-colors"
                  >
                    浏览
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">留空则使用默认位置，推荐大多数用户使用默认设置</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
              <button
                onClick={() => setShowNewProjectDialog(false)}
                className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-[2px]"
              >
                取消
              </button>
              <button
                onClick={handleConfirmNewProject}
                disabled={!newProjectName.trim() || creating}
                className="flex items-center gap-1.5 px-4 py-2 text-xs bg-gold-400 hover:bg-gold-500 text-white font-bold rounded-[2px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-gold-400 shadow-[2px_2px_0_hsl(var(--gold)/0.2)]"
              >
                {creating ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                创建并打开
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认对话框 - P5剪贴风 */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-muted rounded-[2px] border border-border shadow-[5px_5px_0_hsl(var(--p5-red)/0.22)] clip-path-polygon-[0_0,calc(100%-12px)_0,100%_12px,100%_100%,0_100%] w-full max-w-sm mx-4">
            <div className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-[2px] bg-p5-red/15 border border-p5-red/40 flex items-center justify-center shadow-[2px_2px_0_hsl(var(--p5-red)/0.2)]">
                  <AlertTriangle className="w-5 h-5 text-p5-red" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground tracking-wide">确认删除项目？</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">「{deleteConfirmName}」将被永久删除</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-4 pl-[52px]">此操作无法撤销，项目数据将无法恢复。</p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-[2px]"
                >
                  取消
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirmId)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs bg-p5-red hover:bg-p5-red/90 text-white font-bold rounded-[2px] transition-colors border border-p5-red shadow-[2px_2px_0_hsl(var(--p5-red)/0.2)]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  确认删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
