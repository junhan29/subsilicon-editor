import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { StoryCanvas } from './components/editor/story-canvas'
import { ErrorBoundary } from './components/error-boundary'
import { showToast } from './components/editor/toast'
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

function handleSave(graph: StoryGraph): void {
  console.log('[Editor] Save story:', graph.title)
}

function App() {
  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      console.error('Global error:', event.error || event.message)
      logError('error', event.message, event.error?.stack)
      showToast('error', '发生了意外错误，请刷新页面重试')
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason)
      const message = event.reason?.message || String(event.reason) || '未知错误'
      const stack = event.reason?.stack
      logError('unhandledrejection', message, stack)
      showToast('error', '发生了意外错误')
    }

    window.addEventListener('error', handleWindowError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleWindowError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  return (
    <ErrorBoundary onReset={() => window.location.reload()}>
      <ErrorBoundary onReset={() => window.location.reload()}>
        <StoryCanvas initialGraph={emptyGraph} onSave={handleSave} />
      </ErrorBoundary>
    </ErrorBoundary>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
