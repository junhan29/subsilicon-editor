import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, FolderOpen, Settings, Trash2, Copy, Edit3, MoreHorizontal, BookOpen, Clock, FileText, Sparkles, RefreshCw, Download, RotateCcw, AlertCircle, CheckCircle2, X } from 'lucide-react'
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
              <p className="text-sm text-slate-400 mb-6">创建一个新项目开始你的故事创作</p>
            </div>
            <button
              onClick={handleNewProject}
              className="flex items-center gap-2 px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-pink-500/20"
            >
              <Plus className="w-5 h-5" />
              新建项目
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-slate-300">最近的项目</h2>
              <button
                onClick={handleNewProject}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                新建项目
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
              {works.map((work) => (
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
          </div>
        )}
      </div>

      {/* 底部信息 */}
      <footer className="flex items-center justify-between px-6 py-2 border-t border-slate-800 bg-slate-900/80">
        <span className="text-[10px] text-slate-600">SubSilicon Editor 1.2.3</span>
        <span className="text-[10px] text-slate-600">项目存储在本地数据库中</span>
      </footer>
    </div>
  )
}
