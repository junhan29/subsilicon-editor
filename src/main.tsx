import React, { useCallback, useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { StoryCanvas } from './components/editor/story-canvas'
import { NovelEditor } from './components/editor/novel-editor'
import { VideoEditor } from './components/editor/video-editor'
import { ComicEditor } from './components/editor/comic-editor'
import { ProjectManager } from './components/project-manager'
import { BoothWorkbench } from './components/booth/booth-workbench'
import { SettingsPage } from './components/settings-page'
import { PanelWindow } from './components/editor/panel-window'
import { ErrorBoundary } from './components/error-boundary'
import { showToast } from './components/editor/toast'
import { EditorTour, isTourCompleted, markTourCompleted } from './components/editor/onboarding/editor-tour'
import { DEFAULT_TOUR_STEPS } from './components/editor/onboarding/tour-steps'
import { getDocumentFromWork, getGraphFromWork, saveWork } from '@editor/lib/local-db/work-store'
import { migrateFromLocalStorage } from '@editor/lib/local-db'
import type { WorkDocument } from '@editor/types/work'
import type { StoredWork } from '@editor/lib/local-db/work-store'
import type { StoryGraph } from './types/editor'
import { interactiveNarrativeAdapter } from '@editor/lib/work-types/interactive-narrative'
import { registerBuiltinWorkTypes } from '@editor/lib/work-types'
import { useAccessibilityStore } from './stores/accessibility-store'
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
  const [appMode, setAppMode] = useState<'project-manager' | 'editor' | 'booth' | 'settings' | 'panel'>('project-manager')
  const [currentWork, setCurrentWork] = useState<StoredWork | null>(null)
  const [showTour, setShowTour] = useState(false)

  // 用 ref 跟踪最新 currentWork：handleSaveGraph 保持稳定引用，
  // 避免每次保存后 setCurrentWork 触发重渲染 → onSave 新引用 →
  // StoryCanvas 卸载 effect 再次触发保存的无限循环（曾导致海量 saveWork 事务堆积）。
  const currentWorkRef = useRef<StoredWork | null>(null)
  useEffect(() => {
    currentWorkRef.current = currentWork
  }, [currentWork])

  // ADHD 适配：低干扰模式开启时给 body 挂 low-stimulus class（配合 index.css 减弱动画）
  const lowStimulus = useAccessibilityStore((s) => s.lowStimulus)
  useEffect(() => {
    document.body.classList.toggle('low-stimulus', lowStimulus)
  }, [lowStimulus])

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
    // 启动时把旧版 localStorage 作品数据迁移到 IndexedDB（幂等，只执行一次）
    migrateFromLocalStorage().catch((err) => {
      console.error('LocalStorage 数据迁移失败:', err)
    })
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

  const handleSaveGraph = useCallback(async (graph: StoryGraph) => {
    const work = currentWorkRef.current
    if (!work) return
    // v2.0：保存为 WorkDocument（保持当前作品类型，避免把插件/其他类型作品改写为互动叙事）
    const workType = work.workType || 'interactive-narrative'
    const document = interactiveNarrativeAdapter.fromGraph(graph)
    // 重建式保存此前会丢弃原文档的 meta.createdAt/creatorName/language、
    // resources.videos/others 与 extra 字段；此处从原文档透传保留
    const prevDoc = getDocumentFromWork(work)
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
        // fromGraph 重建的 document.resources 会把 videos/others 置为空数组，
        // 展开时覆盖 prevDoc 的同名字段导致资源丢失，此处显式保留原值。
        videos: prevDoc.resources?.videos ?? document.resources.videos ?? [],
        others: prevDoc.resources?.others ?? document.resources.others ?? [],
      },
      extra: prevDoc.extra ?? document.extra,
    }
    const updated: StoredWork = {
      ...work,
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
  }, [])

  const handleBackToProjects = async () => {
    setAppMode('project-manager')
    setCurrentWork(null)
  }

  const handleOpenBooth = () => {
    setAppMode('booth')
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
            onOpenBooth={handleOpenBooth}
          />
        )}
        {appMode === 'booth' && (
          <BoothWorkbench onBack={handleBackToProjects} />
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
