import React, { useEffect, useState, useCallback } from 'react'
import { StoryCanvas } from './components/editor/story-canvas'
import { ProjectManager } from './components/project-manager'
import { PanelWindow } from './components/panel-window'
import { ErrorBoundary } from './components/error-boundary'
import { showToast } from './components/editor/toast'
import { EditorTour } from './components/editor/onboarding/editor-tour'
import { DEFAULT_TOUR_STEPS } from './components/editor/onboarding/tour-steps'
import type { StoryGraph } from './types/editor'

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

export function EditorEntry() {
  const [showTour, setShowTour] = useState(false)
  const [currentGraph, setCurrentGraph] = useState<StoryGraph | null>(null)
  const [showProjectManager, setShowProjectManager] = useState(true)
  const [isPanelWindow, setIsPanelWindow] = useState(false)

  useEffect(() => {
    if (window.location.hash === '#panel') {
      setIsPanelWindow(true)
      setShowProjectManager(false)
    }
  }, [])

  const handleOpenProject = useCallback((graph: StoryGraph) => {
    setCurrentGraph(graph)
    setShowProjectManager(false)
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

  useEffect(() => {
    if (showProjectManager) return
    const timer = setTimeout(() => {
      setShowTour(true)
    }, 500)
    return () => clearTimeout(timer)
  }, [showProjectManager])

  if (showProjectManager) {
    return (
      <ErrorBoundary onReset={() => window.location.reload()}>
        <ProjectManager onOpenProject={handleOpenProject} />
      </ErrorBoundary>
    )
  }

  if (isPanelWindow) {
    return (
      <ErrorBoundary onReset={() => window.location.reload()}>
        <PanelWindow />
      </ErrorBoundary>
    )
  }

  return (
    <>
      <ErrorBoundary onReset={() => window.location.reload()}>
        <ErrorBoundary onReset={() => window.location.reload()}>
          <StoryCanvas
            initialGraph={currentGraph || emptyGraph}
            onSave={() => {}}
            onStartTour={() => setShowTour(true)}
          />
        </ErrorBoundary>
      </ErrorBoundary>
      <EditorTour
        active={showTour}
        steps={DEFAULT_TOUR_STEPS}
        onClose={() => setShowTour(false)}
      />
    </>
  )
}
