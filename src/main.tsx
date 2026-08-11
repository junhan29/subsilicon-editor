import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { StoryCanvas } from './components/editor/story-canvas'
import { NovelEditor } from './components/editor/novel-editor'
import { VideoEditor } from './components/editor/video-editor'
import { ComicEditor } from './components/editor/comic-editor'
import { ProjectManager } from './components/project-manager'
import { SettingsPage } from './components/settings-page'
import { PanelWindow } from './components/editor/panel-window'
import { ErrorBoundary } from './components/error-boundary'
import { showToast } from './components/editor/toast'
import { EditorTour, isTourCompleted, markTourCompleted } from './components/editor/onboarding/editor-tour'
import { DEFAULT_TOUR_STEPS } from './components/editor/onboarding/tour-steps'
import { saveWork, getGraphFromWork, getDocumentFromWork } from '@editor/lib/local-db/work-store'
import type { WorkDocument } from '@editor/types/work'
import type { StoredWork } from '@editor/lib/local-db/work-store'
import type { StoryGraph } from './types/editor'
import { interactiveNarrativeAdapter } from '@editor/lib/work-types/interactive-narrative'
import { registerBuiltinWorkTypes } from '@editor/lib/work-types'
import './index.css'

// 应用启动即注册内置作品类型适配器
registerBuiltinWorkTypes()

const ERROR_LOG_KEY = 'subsilicon_editor_error_log'
const MAX_ERROR_LOGS = 20

interface ErrorLogEntry {
  id: string
  type: 'error' | 'unhandledrejection'
  message: string
  stack?: string
  timestamp: number
}

function logError(type: ErrorLogEntry['type'], message: string, stack?: string) {
  try {
    const existing: ErrorLogEntry[] = JSON.parse(localStorage.getItem(ERROR_LOG_KEY) || '[]')
    const entry: ErrorLogEntry = {
      id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type,
      message,
      stack,
      timestamp: Date.now(),
    }
    const updated = [entry, ...existing].slice(0, MAX_ERROR_LOGS)
    localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(updated))
  } catch {
  }
}

function App() {
  const [appMode, setAppMode] = useState<'project-manager' | 'editor' | 'settings' | 'panel'>('project-manager')
  const [currentWork, setCurrentWork] = useState<StoredWork | null>(null)
  const [showTour, setShowTour] = useState(false)

  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#panel') {
        setAppMode('panel')
      }
    }

    handleHashChange()
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    const completed = isTourCompleted()
    if (!completed) {
      const timer = setTimeout(() => {
        setShowTour(true)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    const IGNORED_ERRORS = [
      'ResizeObserver loop completed with undelivered notifications',
      'ResizeObserver loop limit exceeded',
    ]

    const isIgnoredError = (msg: string) => {
      return IGNORED_ERRORS.some((ignored) => msg.includes(ignored))
    }

    const handleWindowError = (event: ErrorEvent) => {
      const msg = event.error?.message || event.message || '未知错误'
      if (isIgnoredError(msg)) return
      console.error('Global error:', event.error || event.message)
      logError('error', msg, event.error?.stack)
      showToast('error', '发生了意外错误，请刷新页面重试')
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const message = event.reason?.message || String(event.reason) || '未知错误'
      if (isIgnoredError(message)) return
      console.error('Unhandled promise rejection:', event.reason)
      logError('error', message, event.reason?.stack)
      showToast('error', '发生了意外错误，请刷新页面重试')
    }

    window.addEventListener('error', handleWindowError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    return () => {
      window.removeEventListener('error', handleWindowError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  const handleOpenProject = (work: StoredWork) => {
    setCurrentWork(work)
    setAppMode('editor')
  }

  const handleNewProject = (work: StoredWork) => {
    setCurrentWork(work)
    setAppMode('editor')
  }

  const handleSaveGraph = async (graph: StoryGraph) => {
    if (!currentWork) return
    // v2.0：保存为 WorkDocument（保持当前作品类型，避免把插件/其他类型作品改写为互动叙事）
    const workType = currentWork.workType || 'interactive-narrative'
    const document = interactiveNarrativeAdapter.fromGraph(graph)
    // 重建式保存此前会丢弃原文档的 meta.createdAt/creatorName/language、
    // resources.videos/others 与 extra 字段；此处从原文档透传保留
    const prevDoc = getDocumentFromWork(currentWork)
    const preservedDoc: WorkDocument = {
      ...document,
      workType,
      meta: {
        ...document.meta,
        ...prevDoc.meta,
        title: graph.title,
        description: graph.description || prevDoc.meta?.description,
        updatedAt: Date.now(),
      },
      resources: {
        ...prevDoc.resources,
        ...document.resources,
      },
      extra: prevDoc.extra ?? document.extra,
    }
    const updated: StoredWork = {
      ...currentWork,
      name: graph.title,
      updatedAt: Date.now(),
      lastOpened: Date.now(),
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      workType,
      editorData: preservedDoc,
    }
    setCurrentWork(updated)
    await saveWork(updated)
  }

  const handleBackToProjects = async () => {
    setAppMode('project-manager')
    setCurrentWork(null)
  }

  // 按作品类型获取编辑器组件：互动叙事用 StoryCanvas，其他类型用对应编辑器
  const workType = currentWork
    ? currentWork.workType || getDocumentFromWork(currentWork).workType
    : 'interactive-narrative'

  return (
    <>
      <ErrorBoundary onReset={() => window.location.reload()}>
        {appMode === 'project-manager' && (
          <ProjectManager
            onOpenProject={handleOpenProject}
            onNewProject={handleNewProject}
            onOpenSettings={() => setAppMode('settings')}
          />
        )}
        {appMode === 'editor' && currentWork && workType === 'novel' && (
          <NovelEditor
            work={currentWork}
            onBack={handleBackToProjects}
          />
        )}
        {appMode === 'editor' && currentWork && workType === 'video' && (
          <VideoEditor
            work={currentWork}
            onBack={handleBackToProjects}
          />
        )}
        {appMode === 'editor' && currentWork && workType === 'comic' && (
          <ComicEditor
            work={currentWork}
            onBack={handleBackToProjects}
          />
        )}
        {appMode === 'editor' && currentWork && workType !== 'novel' && workType !== 'video' && workType !== 'comic' && (
          <StoryCanvas
            initialGraph={getGraphFromWork(currentWork)}
            onSave={handleSaveGraph}
            onBack={handleBackToProjects}
            workType={workType}
            workId={currentWork.id}
          />
        )}
        {appMode === 'settings' && (
          <SettingsPage
            onBack={() => setAppMode('project-manager')}
          />
        )}
        {appMode === 'panel' && (
          <PanelWindow />
        )}
      </ErrorBoundary>
      <EditorTour
        active={showTour}
        steps={DEFAULT_TOUR_STEPS}
        onClose={() => {
          setShowTour(false)
          markTourCompleted()
        }}
      />
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
