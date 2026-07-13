import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { StoryCanvas } from './components/editor/story-canvas'
import { ProjectManager } from './components/project-manager'
import { SettingsPage } from './components/settings-page'
import { ErrorBoundary } from './components/error-boundary'
import { showToast } from './components/editor/toast'
import { EditorTour, isTourCompleted, markTourCompleted } from './components/editor/onboarding/editor-tour'
import { DEFAULT_TOUR_STEPS } from './components/editor/onboarding/tour-steps'
import { saveWork } from '@editor/lib/local-db/work-store'
import type { StoredWork } from '@editor/lib/local-db/work-store'
import type { StoryGraph } from './types/editor'
import './index.css'

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
  const [appMode, setAppMode] = useState<'project-manager' | 'editor' | 'settings'>('project-manager')
  const [currentWork, setCurrentWork] = useState<StoredWork | null>(null)
  const [showTour, setShowTour] = useState(false)

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
    const updated: StoredWork = {
      ...currentWork,
      name: graph.title,
      updatedAt: Date.now(),
      lastOpened: Date.now(),
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      editorData: graph,
    }
    setCurrentWork(updated)
    await saveWork(updated)
  }

  const handleBackToProjects = async () => {
    setAppMode('project-manager')
    setCurrentWork(null)
  }

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
        {appMode === 'editor' && currentWork && (
          <StoryCanvas
            initialGraph={currentWork.editorData}
            onSave={handleSaveGraph}
            onBack={handleBackToProjects}
          />
        )}
        {appMode === 'settings' && (
          <SettingsPage
            onBack={() => setAppMode('project-manager')}
          />
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
