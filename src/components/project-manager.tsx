'use client'

import { useState, useEffect, useCallback } from 'react'
import { FileText, FolderOpen, Plus, Trash2, Clock, Sparkles, AlertCircle, RefreshCw, Download, RotateCcw, CheckCircle2 } from 'lucide-react'
import { showToast } from './editor/toast'
import { Button } from '../components/ui/button'
import { initTheme, subscribeTheme, type Theme } from '@editor/lib/theme-manager'
import type { StoryGraph } from '@editor/types/editor'

interface ProjectFile {
  path: string
  name: string
  modifiedAt?: string
}

interface ProjectManagerProps {
  onOpenProject: (graph: StoryGraph) => void
}

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

export function ProjectManager({ onOpenProject }: ProjectManagerProps) {
  const [recentFiles, setRecentFiles] = useState<ProjectFile[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingPath, setDeletingPath] = useState<string | null>(null)
  const [theme, setTheme] = useState<Theme>('dark')
  const [version, setVersion] = useState('加载中...')
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'>('idle')
  const [updateInfo, setUpdateInfo] = useState<{ version: string; releaseDate?: string; releaseNotes?: string } | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)

  useEffect(() => {
    const initial = initTheme()
    setTheme(initial)
    const unsub = subscribeTheme((t) => setTheme(t))
    return unsub
  }, [])

  useEffect(() => {
    loadRecentFiles()
    loadVersion()

    // 监听自动更新事件
    const api = window.__electronAPI
    if (api) {
      api.onUpdateChecking(() => {
        setUpdateStatus('checking')
      })
      api.onUpdateAvailable((info) => {
        setUpdateStatus('available')
        setUpdateInfo(info)
        showToast('info', `发现新版本 v${info.version}`)
      })
      api.onUpdateNotAvailable(() => {
        setUpdateStatus('not-available')
      })
      api.onUpdateError((message) => {
        setUpdateStatus('error')
        showToast('error', `更新检查失败: ${message}`)
      })
      api.onUpdateProgress((progress) => {
        setUpdateStatus('downloading')
        setDownloadProgress(Math.round(progress.percent))
      })
      api.onUpdateDownloaded(() => {
        setUpdateStatus('downloaded')
        setDownloadProgress(100)
        showToast('success', '更新已下载完成，点击重启安装')
      })

      // 自动检查更新
      setTimeout(() => {
        api.checkForUpdates()
      }, 3000)
    }
  }, [])

  const loadVersion = useCallback(async () => {
    try {
      const api = window.__electronAPI
      if (api && api.getVersion) {
        const result = await api.getVersion()
        if (result.success && result.version) {
          setVersion(result.version)
        }
      }
    } catch {
      setVersion('1.2.6')
    }
  }, [])

  const loadRecentFiles = useCallback(async () => {
    setLoading(true)
    try {
      const api = window.__electronAPI
      if (!api) {
        setRecentFiles([])
        setLoading(false)
        return
      }

      const result = await api.getRecentFiles()
      if (result.success) {
        const files: ProjectFile[] = (result.files || []).map((filePath: string) => ({
          path: filePath,
          name: filePath.split(/[\\/]/).pop() || '未命名',
        }))
        setRecentFiles(files)
      }
    } catch (error) {
      console.error('Failed to load recent files:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleNewProject = useCallback(async () => {
    const api = window.__electronAPI
    if (!api) {
      onOpenProject(emptyGraph)
      return
    }

    try {
      const result = await api.getDefaultProjectsDir()
      let defaultPath = result.success ? result.path : ''

      const saveResult = await api.saveFileDialog({
        defaultPath: defaultPath ? `${defaultPath}/未命名故事.json` : undefined,
        filters: [{ name: 'SubSilicon 项目', extensions: ['json'] }],
      })

      if (!saveResult.success || !saveResult.path) return

      const filePath = saveResult.path
      const content = JSON.stringify(emptyGraph, null, 2)
      const bytes = new TextEncoder().encode(content)
      await api.writeFile(filePath, Array.from(bytes))
      await api.addRecentFile(filePath)

      onOpenProject(emptyGraph)
      showToast('success', '新项目已创建')
    } catch (error) {
      showToast('error', '创建项目失败')
    }
  }, [onOpenProject])

  const handleOpenProject = useCallback(async () => {
    const api = window.__electronAPI
    if (!api) {
      console.log('[ProjectManager] No electron API, using empty graph')
      onOpenProject(emptyGraph)
      return
    }

    try {
      console.log('[ProjectManager] Opening file dialog...')
      const result = await api.openFileDialog({
        filters: [{ name: 'SubSilicon 项目', extensions: ['json'] }],
      })

      console.log('[ProjectManager] Dialog result:', result)
      if (!result.success || !result.path) {
        console.log('[ProjectManager] Dialog canceled or no path')
        return
      }

      const filePath = result.path
      console.log('[ProjectManager] Reading file:', filePath)
      const readResult = await api.readFile(filePath)
      console.log('[ProjectManager] Read result:', readResult.success, readResult.error)

      if (!readResult.success) {
        showToast('error', '读取项目失败: ' + (readResult.error || '未知错误'))
        return
      }

      let graph: StoryGraph
      try {
        const bytes = readResult.data as number[] || []
        console.log('[ProjectManager] File size:', bytes.length, 'bytes')
        const content = new TextDecoder('utf-8').decode(new Uint8Array(bytes))
        console.log('[ProjectManager] File content preview:', content.substring(0, 200))
        graph = JSON.parse(content)
        console.log('[ProjectManager] Parsed graph successfully:', graph.title, graph.nodes?.length, 'nodes')
      } catch (parseError) {
        console.error('[ProjectManager] Parse error:', parseError)
        showToast('error', '项目文件格式无效: ' + (parseError instanceof Error ? parseError.message : String(parseError)))
        return
      }

      await api.addRecentFile(filePath)
      console.log('[ProjectManager] Opening project...')
      onOpenProject(graph)
    } catch (error) {
      console.error('[ProjectManager] Open project error:', error)
      showToast('error', '打开项目失败')
    }
  }, [onOpenProject])

  const handleOpenRecent = useCallback(async (project: ProjectFile) => {
    const api = window.__electronAPI
    if (!api) {
      showToast('error', 'Electron API 不可用')
      return
    }

    try {
      const readResult = await api.readFile(project.path)
      if (!readResult.success) {
        showToast('error', '读取项目失败')
        return
      }

      let graph: StoryGraph
      try {
        const bytes = readResult.data as number[] || []
        const content = new TextDecoder('utf-8').decode(new Uint8Array(bytes))
        graph = JSON.parse(content)
      } catch {
        showToast('error', '项目文件格式无效')
        return
      }

      await api.addRecentFile(project.path)
      onOpenProject(graph)
    } catch (error) {
      console.error('Failed to open recent project:', error)
      showToast('error', '打开项目失败')
    }
  }, [onOpenProject])

  const handleDeleteRecent = useCallback(async (project: ProjectFile) => {
    setDeletingPath(project.path)
    try {
      const api = window.__electronAPI
      if (!api) return

      const result = await api.removeRecentFile(project.path)
      if (result.success) {
        setRecentFiles(prev => prev.filter(p => p.path !== project.path))
        showToast('info', '已从最近列表移除')
      }
    } catch (error) {
      showToast('error', '删除失败')
    } finally {
      setDeletingPath(null)
    }
  }, [])

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-8 ${theme === 'dark' ? 'bg-[#0f172a]' : 'bg-white'}`}>
      <div className={`w-full max-w-md ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        <div className="text-center mb-12">
          <div className={`w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center ${theme === 'dark' ? 'bg-gradient-to-br from-emerald-500/20 to-cyan-500/20' : 'bg-gradient-to-br from-emerald-100 to-cyan-100'}`}>
            <Sparkles className={`w-10 h-10 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`} />
          </div>
          <h1 className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>SubSilicon Editor</h1>
          <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>互动叙事创作工具</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <Button
            onClick={handleNewProject}
            className={`${theme === 'dark' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-500 hover:bg-emerald-600'} text-white h-14 text-base font-medium`}
            size="lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            新建项目
          </Button>
          <Button
            onClick={handleOpenProject}
            variant={theme === 'dark' ? 'outline' : 'secondary'}
            className={`h-14 text-base font-medium ${theme === 'dark' ? 'border-gray-700 hover:bg-gray-800' : ''}`}
            size="lg"
          >
            <FolderOpen className="w-5 h-5 mr-2" />
            打开项目
          </Button>
        </div>

        {recentFiles.length > 0 && (
          <div className={`rounded-xl p-4 ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
            <div className="flex items-center gap-2 mb-4">
              <Clock className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
              <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>最近项目</span>
            </div>
            <div className="space-y-2">
              {recentFiles.map((project) => (
                <div
                  key={project.path}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                  onClick={() => handleOpenRecent(project)}
                >
                  <div className="flex items-center gap-3">
                    <FileText className={`w-5 h-5 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-500'}`} />
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {project.name}
                      </p>
                      <p className={`text-xs truncate ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                        {project.path}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteRecent(project)
                    }}
                    disabled={deletingPath === project.path}
                    className={`p-1.5 rounded-md transition-colors ${theme === 'dark' ? 'hover:bg-red-500/20 text-gray-400 hover:text-red-400' : 'hover:bg-red-50 text-gray-400 hover:text-red-500'} ${deletingPath === project.path ? 'opacity-50' : ''}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && recentFiles.length === 0 && (
          <div className={`rounded-xl p-8 text-center ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
            <AlertCircle className={`w-10 h-10 mx-auto mb-3 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>暂无最近项目</p>
            <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>点击「新建项目」开始创作</p>
          </div>
        )}

        {loading && (
          <div className={`rounded-xl p-8 text-center ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
            <div className={`w-6 h-6 mx-auto border-2 border-t-transparent rounded-full animate-spin ${theme === 'dark' ? 'border-emerald-500' : 'border-gray-300'}`} />
          </div>
        )}

        {/* 更新提示 */}
        {updateInfo && (updateStatus === 'available' || updateStatus === 'downloading' || updateStatus === 'downloaded') && (
          <div className={`mt-6 mx-auto max-w-sm rounded-xl p-4 border ${theme === 'dark' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <span className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                发现新版本 v{updateInfo.version}
              </span>
            </div>
            {updateInfo.releaseNotes && (
              <div className={`text-xs mb-3 max-h-20 overflow-y-auto whitespace-pre-line ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                {updateInfo.releaseNotes.split('\n').slice(0, 5).join('\n')}
              </div>
            )}
            {updateStatus === 'downloading' && (
              <div className="mb-3">
                <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${downloadProgress}%` }} />
                </div>
                <p className={`text-xs mt-1 text-center ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{downloadProgress}%</p>
              </div>
            )}
            <div className="flex gap-2">
              {updateStatus === 'available' && (
                <button
                  onClick={() => {
                    window.__electronAPI?.downloadUpdate()
                    if (window.__electronAPI?.platform === 'darwin') {
                      setUpdateStatus('idle')
                    } else {
                      setUpdateStatus('downloading')
                      setDownloadProgress(0)
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  下载更新
                </button>
              )}
              {updateStatus === 'downloaded' && (
                <button
                  onClick={() => window.__electronAPI?.installUpdate()}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-medium transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  重启安装
                </button>
              )}
            </div>
          </div>
        )}

        {/* 版本信息 */}
        <div className={`mt-8 text-center text-xs ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>
          <div className="flex items-center justify-center gap-2">
            <span>版本 {version}</span>
            <button
              onClick={() => {
                if (updateStatus === 'checking' || updateStatus === 'downloading') return
                setUpdateStatus('checking')
                window.__electronAPI?.checkForUpdates()
              }}
              disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
              className={`inline-flex items-center gap-1 transition-colors ${updateStatus === 'checking' ? 'opacity-50' : 'hover:text-amber-500'}`}
              title="检查更新"
            >
              {updateStatus === 'checking' ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : updateStatus === 'not-available' ? (
                <CheckCircle2 className="w-3 h-3 text-green-500" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
