import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, FolderOpen, Settings, Trash2, Copy, Edit3, MoreHorizontal, BookOpen, Clock, FileText, Sparkles, RefreshCw, Download, RotateCcw, AlertCircle, CheckCircle2, X, FolderSync, CheckCircle, Search, Grid, List, Star, HardDrive, Hash } from 'lucide-react'
import type { StoryGraph } from '@editor/types/editor'
import { getAllWorks, loadWork, saveWork, deleteWork, generateProjectId, type StoredWork } from '@editor/lib/local-db/work-store'

type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'
interface UpdateInfo { version: string; releaseDate?: string; releaseNotes?: string }

const emptyGraph: StoryGraph = {
  title: '未命名故事',
  description: '',
  templateId: 'custom',
  characters: [],
  variables: [],
  nodes: [],
  edges: [],
  settings: { title: '未命名故事', tags: [] },
  assets: { images: [], audios: [], fonts: [] },
  scenes: [],
  audios: [],
  groups: [],
  annotations: [],
}

interface ProjectManagerProps {
  onOpenProject: (work: StoredWork) => void
  onNewProject: (work: StoredWork) => void
  onOpenSettings: () => void
}

export function ProjectManager({ onOpenProject, onNewProject, onOpenSettings }: ProjectManagerProps) {
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
  const [creating, setCreating] = useState(false)
  
  // 导入项目状态
  const [importing, setImporting] = useState(false)

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
  const [downloadProgress, setDownloadProgress] = useState(0)
  const updateInitRef = useRef(false)

  useEffect(() => {
    if (updateInitRef.current) return
    updateInitRef.current = true
    const api = window.__electronAPI
    if (!api) return

    const unsubs = [
      api.onUpdateChecking(() => setUpdateStatus('checking')),
      api.onUpdateAvailable((info) => {
        setUpdateStatus('available')
        setUpdateInfo(info)
      }),
      api.onUpdateNotAvailable(() => setUpdateStatus('not-available')),
      api.onUpdateError(() => setUpdateStatus('error')),
      api.onUpdateProgress((p) => {
        setUpdateStatus('downloading')
        setDownloadProgress(Math.round(p.percent))
      }),
      api.onUpdateDownloaded(() => {
        setUpdateStatus('downloaded')
        setDownloadProgress(100)
      }),
    ]

    setTimeout(() => api.checkForUpdates(), 2000)

    return () => unsubs.forEach(fn => fn())
  }, [])

  const handleCheckUpdates = () => {
    if (updateStatus === 'checking' || updateStatus === 'downloading') return
    setUpdateStatus('checking')
    window.__electronAPI?.checkForUpdates()
    setTimeout(() => setUpdateStatus(s => s === 'checking' ? 'idle' : s), 15000)
  }

  const handleDownloadUpdate = () => {
    window.__electronAPI?.downloadUpdate()
    setUpdateStatus('downloading')
    setDownloadProgress(0)
  }

  const handleInstallUpdate = () => {
    window.__electronAPI?.installUpdate()
  }

  // 打开新建项目对话框
  const handleOpenNewProjectDialog = () => {
    setNewProjectName('')
    setNewProjectPath('')
    setShowNewProjectDialog(true)
  }

  // 确认创建新项目
  const handleConfirmNewProject = async () => {
    if (!newProjectName.trim()) return
    setCreating(true)
    
    const id = generateProjectId()
    const now = Date.now()
    const work: StoredWork = {
      id,
      name: newProjectName.trim(),
      updatedAt: now,
      createdAt: now,
      lastOpened: now,
      nodeCount: 0,
      edgeCount: 0,
      templateId: 'custom',
      editorData: { ...emptyGraph, title: newProjectName.trim() },
      customPath: newProjectPath.trim() || undefined,
    }
    await saveWork(work)
    setCreating(false)
    setShowNewProjectDialog(false)
    onNewProject(work)
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
        const content = await window.__electronAPI?.readFile(filePath)
        if (content) {
          let projectData: Partial<StoryGraph> | null = null
          
          // 解析文件内容
          if (filePath.endsWith('.json')) {
            projectData = JSON.parse(content)
          } else if (filePath.endsWith('.story.html')) {
            // 从 HTML 中提取嵌入的 JSON 数据
            const match = content.match(/<script[^>]*id="story-data"[^>]*>([\s\S]*?)<\/script>/)
            if (match) {
              projectData = JSON.parse(match[1])
            }
          }
          
          if (projectData) {
            const id = generateProjectId()
            const now = Date.now()
            const work: StoredWork = {
              id,
              name: projectData.title || projectData.settings?.title || '导入的项目',
              updatedAt: now,
              createdAt: now,
              lastOpened: now,
              nodeCount: projectData.nodes?.length || 0,
              edgeCount: projectData.edges?.length || 0,
              templateId: projectData.templateId || 'custom',
              editorData: { ...emptyGraph, ...projectData, title: projectData.title || projectData.settings?.title || '导入的项目' },
            }
            await saveWork(work)
            loadWorks()
          }
        }
      }
    } catch (error) {
      console.error('导入项目失败:', error)
    }
    setImporting(false)
  }

  const handleNewProject = async () => {
    const id = generateProjectId()
    const now = Date.now()
    const work: StoredWork = {
      id,
      name: '新项目',
      updatedAt: now,
      createdAt: now,
      lastOpened: now,
      nodeCount: 0,
      edgeCount: 0,
      templateId: 'custom',
      editorData: { ...emptyGraph, title: '新项目' },
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
    loadWorks()
  }

  const handleDuplicate = async (work: StoredWork) => {
    const id = generateProjectId()
    const now = Date.now()
    const copy: StoredWork = {
      ...work,
      id,
      name: work.name + ' (副本)',
      createdAt: now,
      lastOpened: now,
      updatedAt: now,
      editorData: { ...work.editorData },
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
      work.editorData.title = renameValue.trim()
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
    <div className="h-screen w-screen bg-slate-900 flex flex-col overflow-hidden">
      {/* 顶栏 */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-lg font-semibold text-white">SubSilicon Editor</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCheckUpdates}
            disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${
              updateStatus === 'available'
                ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
                : updateStatus === 'downloaded'
                ? 'bg-green-500/15 text-green-400 hover:bg-green-500/25'
                : updateStatus === 'not-available'
                ? 'text-green-400 hover:bg-slate-800'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            } ${(updateStatus === 'checking' || updateStatus === 'downloading') ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={
              updateStatus === 'available' ? `发现新版本 v${updateInfo?.version}` :
              updateStatus === 'downloaded' ? '已下载，点击安装' :
              updateStatus === 'checking' ? '检查中...' :
              updateStatus === 'downloading' ? `下载中 ${downloadProgress}%` :
              '检查更新'
            }
          >
            {updateStatus === 'checking' ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : updateStatus === 'available' || updateStatus === 'downloading' ? (
              <Download className="w-4 h-4" />
            ) : updateStatus === 'downloaded' ? (
              <RotateCcw className="w-4 h-4" />
            ) : updateStatus === 'not-available' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {updateStatus === 'checking' ? '检查中' :
             updateStatus === 'available' ? '有更新' :
             updateStatus === 'downloading' ? `${downloadProgress}%` :
             updateStatus === 'downloaded' ? '安装' :
             updateStatus === 'not-available' ? '已是最新' :
             '检查更新'}
          </button>
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" />
            设置
          </button>
        </div>
      </header>

      {/* 更新通知横幅 */}
      {(updateStatus === 'available' || updateStatus === 'downloading' || updateStatus === 'downloaded') && updateInfo && (
        <div className="mx-6 mt-3 mb-0 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/20">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                updateStatus === 'downloaded' ? 'bg-green-500/15' : 'bg-amber-500/15'
              }`}>
                {updateStatus === 'downloading' ? (
                  <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
                ) : updateStatus === 'downloaded' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">
                  {updateStatus === 'available' && `新版本 v${updateInfo.version} 可用`}
                  {updateStatus === 'downloading' && `正在下载更新 ${downloadProgress}%`}
                  {updateStatus === 'downloaded' && `更新已下载完成`}
                </p>
                {updateInfo.releaseNotes && (
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                    {updateInfo.releaseNotes.split('\n').slice(1, 3).join(' · ').replace(/^##\s*/, '')}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {updateStatus === 'downloading' && (
                <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 transition-all duration-300 rounded-full" style={{ width: `${downloadProgress}%` }} />
                </div>
              )}
              {updateStatus === 'available' && (
                <button
                  onClick={handleDownloadUpdate}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  下载更新
                </button>
              )}
              {updateStatus === 'downloaded' && (
                <button
                  onClick={handleInstallUpdate}
                  className="flex items-center gap-1.5 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  重启安装
                </button>
              )}
              {(updateStatus === 'available' || updateStatus === 'downloaded') && (
                <button
                  onClick={() => { setUpdateStatus('idle'); setUpdateInfo(null) }}
                  className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : works.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="w-20 h-20 rounded-2xl bg-slate-800 border-2 border-dashed border-slate-600 flex items-center justify-center">
              <FolderOpen className="w-8 h-8 text-slate-500" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-medium text-white mb-1">欢迎使用 SubSilicon Editor</h2>
              <p className="text-sm text-slate-400 mb-6">创建一个新项目或打开已有项目</p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleOpenNewProjectDialog}
                className="flex items-center gap-2 px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-pink-500/20"
              >
                <Plus className="w-5 h-5" />
                新建项目
              </button>
              <button
                onClick={handleImportProject}
                disabled={importing}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
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
            {/* 工具栏：搜索、排序、视图切换 */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索项目..."
                  className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus:outline-none focus:border-pink-500/50"
                />
              </div>
              <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                <button
                  onClick={() => setSortBy('lastOpened')}
                  className={`px-2 py-1 text-[10px] rounded-md transition-colors ${sortBy === 'lastOpened' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                  title="最近打开"
                >
                  <Clock className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setSortBy('created')}
                  className={`px-2 py-1 text-[10px] rounded-md transition-colors ${sortBy === 'created' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                  title="创建时间"
                >
                  <Star className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setSortBy('name')}
                  className={`px-2 py-1 text-[10px] rounded-md transition-colors ${sortBy === 'name' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                  title="名称"
                >
                  <Hash className="w-3 h-3" />
                </button>
              </div>
              <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                  title="网格视图"
                >
                  <Grid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1 rounded-md transition-colors ${viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                  title="列表视图"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={handleImportProject}
                  disabled={importing}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                >
                  {importing ? (
                    <div className="w-4 h-4 border-2 border-slate-500 border-t-white rounded-full animate-spin" />
                  ) : (
                    <FolderSync className="w-4 h-4" />
                  )}
                  打开
                </button>
                <button
                  onClick={handleOpenNewProjectDialog}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  新建项目
                </button>
              </div>
            </div>

            {/* 项目统计 */}
            <div className="flex items-center gap-4 mb-4 text-[11px] text-slate-500">
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

            {/* 网格视图 */}
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredWorks.map((work) => (
                  <div
                    key={work.id}
                    className="group relative bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-pink-500/50 transition-all overflow-hidden cursor-pointer"
                    onClick={() => {
                      if (renamingId !== work.id) handleOpenProject(work)
                    }}
                  >
                    {/* 缩略图占位 */}
                    <div className="aspect-[16/10] bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                      {work.thumbnail ? (
                        <img src={work.thumbnail} alt={work.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-slate-600">
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
                          className="w-full text-xs font-medium bg-slate-700 border border-pink-500 rounded px-1.5 py-0.5 text-white outline-none"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <p className="text-xs font-medium text-white truncate">{work.name}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500">
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
                          className="p-1 rounded-lg bg-black/50 hover:bg-black/70 text-white transition-colors"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {menuOpenId === work.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
                            <div className="absolute right-0 top-full mt-1 z-20 w-36 bg-slate-800 rounded-lg border border-slate-700 shadow-xl overflow-hidden">
                              <button
                                onClick={(e) => { e.stopPropagation(); startRename(work) }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                重命名
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDuplicate(work) }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                复制
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(work.id) }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-slate-700 transition-colors"
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
              /* 列表视图 */
              <div className="space-y-1">
                {filteredWorks.map((work) => (
                  <div
                    key={work.id}
                    className="group flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:border-pink-500/50 transition-all cursor-pointer"
                    onClick={() => {
                      if (renamingId !== work.id) handleOpenProject(work)
                    }}
                  >
                    {/* 图标 */}
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center shrink-0">
                      {work.thumbnail ? (
                        <img src={work.thumbnail} alt={work.name} className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <BookOpen className="w-5 h-5 text-slate-500" />
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
                          className="w-full text-xs font-medium bg-slate-700 border border-pink-500 rounded px-1.5 py-0.5 text-white outline-none"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <p className="text-xs font-medium text-white truncate">{work.name}</p>
                      )}
                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(work.lastOpened)}
                        </span>
                        <span>{work.nodeCount} 节点</span>
                        <span>{work.edgeCount || 0} 连接</span>
                        {work.customPath && (
                          <span className="truncate text-slate-600">{work.customPath}</span>
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
                          className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 transition-colors"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {menuOpenId === work.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
                            <div className="absolute right-0 top-full mt-1 z-20 w-36 bg-slate-800 rounded-lg border border-slate-700 shadow-xl overflow-hidden">
                              <button
                                onClick={(e) => { e.stopPropagation(); startRename(work) }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                重命名
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDuplicate(work) }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                复制
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(work.id) }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-slate-700 transition-colors"
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
      <footer className="flex items-center justify-between px-6 py-2 border-t border-slate-800 bg-slate-900/80">
        <span className="text-[10px] text-slate-600">{__APP_NAME__} {__APP_VERSION__}</span>
        <span className="text-[10px] text-slate-600">项目存储在本地数据库中</span>
      </footer>

      {/* 新建项目对话框 */}
      {showNewProjectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <h3 className="text-sm font-medium text-white">新建项目</h3>
              <button
                onClick={() => setShowNewProjectDialog(false)}
                className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-400">项目名称 *</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="输入项目名称..."
                  className="w-full h-9 text-sm rounded-lg border border-slate-600 bg-slate-700 px-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirmNewProject()}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-xs text-slate-400">存储位置（可选）</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newProjectPath}
                    onChange={(e) => setNewProjectPath(e.target.value)}
                    placeholder="默认使用应用数据目录"
                    className="flex-1 h-9 text-sm rounded-lg border border-slate-600 bg-slate-700 px-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
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
                    className="px-3 h-9 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg border border-slate-600 transition-colors"
                  >
                    浏览
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">留空则使用默认位置，推荐大多数用户使用默认设置</p>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-700">
              <button
                onClick={() => setShowNewProjectDialog(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmNewProject}
                disabled={!newProjectName.trim() || creating}
                className="flex items-center gap-1.5 px-4 py-2 text-xs bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>
  )
}
