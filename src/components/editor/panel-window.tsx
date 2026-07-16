'use client'

import { useEffect, useState, useCallback } from 'react'
import type { StoryGraph } from '@editor/types/editor'

interface PanelWindowProps {
  graph?: StoryGraph
}

export function PanelWindow({ graph }: PanelWindowProps) {
  const [panelState, setPanelState] = useState<{
    selectedNodeId: string | null
    activeTab: string
  }>({
    selectedNodeId: null,
    activeTab: 'property',
  })

  useEffect(() => {
    const handleMainMessage = (message: unknown) => {
      if (typeof message === 'object' && message !== null) {
        const msg = message as Record<string, unknown>
        if (msg.type === 'node-selected') {
          setPanelState(prev => ({ ...prev, selectedNodeId: msg.nodeId as string | null }))
        }
        if (msg.type === 'tab-change') {
          setPanelState(prev => ({ ...prev, activeTab: msg.tab as string }))
        }
      }
    }

    const cleanup = (window as unknown as { __electronAPI?: { onMainMessage: (cb: (m: unknown) => void) => () => void } })
      .__electronAPI?.onMainMessage(handleMainMessage)

    return () => cleanup?.()
  }, [])

  const handleNodeSelect = useCallback((nodeId: string | null) => {
    setPanelState(prev => ({ ...prev, selectedNodeId: nodeId }))
    ;(window as unknown as { __electronAPI?: { sendMainMessage: (m: unknown) => void } })
      .__electronAPI?.sendMainMessage({ type: 'node-selected', nodeId })
  }, [])

  const handleTabChange = useCallback((tab: string) => {
    setPanelState(prev => ({ ...prev, activeTab: tab }))
    ;(window as unknown as { __electronAPI?: { sendMainMessage: (m: unknown) => void } })
      .__electronAPI?.sendMainMessage({ type: 'tab-change', tab })
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P') {
        ;(window as unknown as { __electronAPI?: { closePanelWindow: () => void } })
          .__electronAPI?.closePanelWindow()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
        e.preventDefault()
        ;(window as unknown as { __electronAPI?: { closePanelWindow: () => void } })
          .__electronAPI?.closePanelWindow()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="h-screen w-full bg-slate-900 text-slate-100 overflow-hidden">
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-slate-900/95 backdrop-blur-sm">
          <span className="text-sm font-medium text-slate-300">管理面板</span>
          <button
            onClick={() => {
              ;(window as unknown as { __electronAPI?: { closePanelWindow: () => void } })
                .__electronAPI?.closePanelWindow()
            }}
            className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors"
          >
            关闭
          </button>
        </div>
        <div className="flex-1 overflow-hidden p-4">
          <div className="text-center text-slate-500 mt-20">
            <p className="text-sm">管理面板</p>
            <p className="text-xs mt-2">独立面板窗口已准备就绪</p>
            <p className="text-xs mt-1 text-slate-600">按 P 键或 Cmd/Ctrl+W 关闭</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PanelWindow
