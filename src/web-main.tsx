import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { StoryCanvas } from './components/editor/story-canvas'
import { ErrorBoundary } from './components/error-boundary'
import { EnvironmentBanner } from './components/editor/environment-panel'
import { showToast } from './components/editor/toast'
import { isWeb } from './lib/environment-detector'
import type { StoryGraph } from './types/editor'
import './index.css'

const ERROR_LOG_KEY = 'subsilicon_editor_error_log'
const MAX_ERROR_LOGS = 20
const GRAPH_STORAGE_KEY = 'subsilicon_story_graph'

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

const emptyGraph: StoryGraph = {
  title: '未命名故事',
  description: '',
  templateId: 'custom',
  characters: [],
  variables: [],
  nodes: [],
  edges: [],
  settings: {
    title: '未命名故事',
    tags: [],
  },
  assets: {
    images: [],
    audios: [],
    fonts: [],
  },
  scenes: [],
  audios: [],
  groups: [],
  annotations: [],
}

function loadSavedGraph(): StoryGraph | null {
  try {
    const saved = localStorage.getItem(GRAPH_STORAGE_KEY)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (error) {
    console.warn('Failed to load saved graph:', error)
  }
  return null
}

function saveGraph(graph: StoryGraph): void {
  try {
    localStorage.setItem(GRAPH_STORAGE_KEY, JSON.stringify(graph))
  } catch (error) {
    console.warn('Failed to save graph:', error)
    showToast('error', '保存失败，存储空间可能不足')
  }
}

function App() {
  const [initialGraph, setInitialGraph] = useState<StoryGraph>(emptyGraph)
  const [hasLoaded, setHasLoaded] = useState(false)

  useEffect(() => {
    const saved = loadSavedGraph()
    if (saved) {
      setInitialGraph(saved)
      showToast('success', '已恢复上次编辑的故事')
    }
    setHasLoaded(true)
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

  const handleSave = (graph: StoryGraph) => {
    saveGraph(graph)
    showToast('success', '故事已自动保存')
  }

  if (!hasLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${isWeb() ? 'pt-12' : ''}`}>
      {isWeb() && <EnvironmentBanner />}
      <ErrorBoundary onReset={() => window.location.reload()}>
        <ErrorBoundary onReset={() => window.location.reload()}>
          <StoryCanvas initialGraph={initialGraph} onSave={handleSave} />
        </ErrorBoundary>
      </ErrorBoundary>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
