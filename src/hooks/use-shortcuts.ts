'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { Node } from '@xyflow/react'
import { matchShortcut } from '@editor/lib/shortcut-manager'
import type { HistoryActionType } from '@editor/lib/history-store'

export interface UseShortcutsOptions {
  selectedNodeIds: string[]
  selectedEdgeId: string | null

  undo: () => void
  redo: () => void
  zoomIn: (options?: { duration?: number }) => void
  zoomOut: (options?: { duration?: number }) => void
  fitView: (options?: {
    padding?: number
    duration?: number
    nodes?: { id: string }[]
  }) => void

  copySelectedNodes: () => void
  pasteNodes: () => void
  duplicateSelectedNodes: () => void
  createGroupFromSelection: () => void
  deleteSelectedNodes: () => void

  addNodeAtCenter: (type: string) => void

  handleToggleTheme: () => void
  setSidebarVisible: React.Dispatch<React.SetStateAction<boolean>>
  setRightPanelVisible: React.Dispatch<React.SetStateAction<boolean>>

  setNodes: (updater: (nodes: Node[]) => Node[]) => void
  throttledPushHistory: (
    type: HistoryActionType,
    description: string
  ) => void

  setSelectedNodeIds: React.Dispatch<React.SetStateAction<string[]>>
  setSelectedEdgeId: React.Dispatch<React.SetStateAction<string | null>>
}

export interface UseShortcutsReturn {
  register: () => void
  unregister: () => void
}

export function useShortcuts(options: UseShortcutsOptions): UseShortcutsReturn {
  const handlerRef = useRef<((e: KeyboardEvent) => void) | null>(null)
  const lastDeleteTimeRef = useRef(0)
  const registeredRef = useRef(false)

  const register = useCallback(() => {
    if (registeredRef.current || !handlerRef.current) return
    window.addEventListener('keydown', handlerRef.current)
    registeredRef.current = true
  }, [])

  const unregister = useCallback(() => {
    if (!registeredRef.current || !handlerRef.current) return
    window.removeEventListener('keydown', handlerRef.current)
    registeredRef.current = false
  }, [])

  useEffect(() => {
    if (handlerRef.current && registeredRef.current) {
      window.removeEventListener('keydown', handlerRef.current)
      registeredRef.current = false
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.target) return

      const target = e.target as HTMLElement
      const isInputTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable ||
        target.tagName === 'SELECT'

      if (isInputTarget) return

      const {
        selectedNodeIds,
        selectedEdgeId,
        undo,
        redo,
        zoomIn,
        zoomOut,
        fitView,
        copySelectedNodes,
        pasteNodes,
        duplicateSelectedNodes,
        createGroupFromSelection,
        deleteSelectedNodes,
        addNodeAtCenter,
        handleToggleTheme,
        setSidebarVisible,
        setRightPanelVisible,
        setNodes,
        throttledPushHistory,
        setSelectedNodeIds,
        setSelectedEdgeId,
      } = options

      if (matchShortcut(e, 'undo')) {
        e.preventDefault()
        undo()
        return
      }

      if (matchShortcut(e, 'redo')) {
        e.preventDefault()
        redo()
        return
      }

      if (matchShortcut(e, 'zoomIn')) {
        e.preventDefault()
        zoomIn({ duration: 200 })
        return
      }

      if (matchShortcut(e, 'zoomOut')) {
        e.preventDefault()
        zoomOut({ duration: 200 })
        return
      }

      if (matchShortcut(e, 'fitView')) {
        e.preventDefault()
        fitView({ padding: 0.2, duration: 300 })
        return
      }

      if (matchShortcut(e, 'copy')) {
        e.preventDefault()
        copySelectedNodes()
        return
      }

      if (matchShortcut(e, 'paste')) {
        e.preventDefault()
        pasteNodes()
        return
      }

      if (matchShortcut(e, 'duplicate')) {
        e.preventDefault()
        duplicateSelectedNodes()
        return
      }

      if (matchShortcut(e, 'group')) {
        if (selectedNodeIds.length >= 2) {
          e.preventDefault()
          createGroupFromSelection()
        }
        return
      }

      if (matchShortcut(e, 'deselectAll')) {
        if (selectedNodeIds.length > 0 || selectedEdgeId) {
          e.preventDefault()
          setSelectedNodeIds([])
          setSelectedEdgeId(null)
        }
        return
      }

      if (matchShortcut(e, 'deleteNode')) {
        if (selectedNodeIds.length > 0) {
          e.preventDefault()
          const now = Date.now()
          if (now - lastDeleteTimeRef.current < 300) return
          lastDeleteTimeRef.current = now
          deleteSelectedNodes()
        }
        return
      }

      if (matchShortcut(e, 'toggleSidebar')) {
        e.preventDefault()
        setSidebarVisible((v) => !v)
        return
      }

      if (matchShortcut(e, 'toggleRightPanel')) {
        e.preventDefault()
        setRightPanelVisible((v) => !v)
        return
      }

      if (matchShortcut(e, 'toggleTheme')) {
        e.preventDefault()
        handleToggleTheme()
        return
      }

      if (matchShortcut(e, 'addDialogue')) {
        e.preventDefault()
        addNodeAtCenter('dialogue')
        return
      }

      if (matchShortcut(e, 'addChoice')) {
        e.preventDefault()
        addNodeAtCenter('choice')
        return
      }

      if (matchShortcut(e, 'addEnding')) {
        e.preventDefault()
        addNodeAtCenter('ending')
        return
      }

      if (matchShortcut(e, 'addGather')) {
        e.preventDefault()
        addNodeAtCenter('gather')
        return
      }

      if (matchShortcut(e, 'addJump')) {
        e.preventDefault()
        addNodeAtCenter('jump')
        return
      }

      if (matchShortcut(e, 'addRandom')) {
        e.preventDefault()
        addNodeAtCenter('random')
        return
      }

      if (matchShortcut(e, 'addUnlock')) {
        e.preventDefault()
        addNodeAtCenter('unlock')
        return
      }

      if (matchShortcut(e, 'addCondition')) {
        e.preventDefault()
        addNodeAtCenter('condition')
        return
      }

      if (matchShortcut(e, 'addCG')) {
        e.preventDefault()
        addNodeAtCenter('cg')
        return
      }

      if (selectedNodeIds.length > 0) {
        const step = e.shiftKey ? 20 : 5
        let dx = 0
        let dy = 0

        if (e.key === 'ArrowUp') {
          dy = -step
        } else if (e.key === 'ArrowDown') {
          dy = step
        } else if (e.key === 'ArrowLeft') {
          dx = -step
        } else if (e.key === 'ArrowRight') {
          dx = step
        }

        if (dx !== 0 || dy !== 0) {
          e.preventDefault()
          setNodes((nds) =>
            nds.map((n) => {
              if (selectedNodeIds.includes(n.id)) {
                return {
                  ...n,
                  position: {
                    x: n.position.x + dx,
                    y: n.position.y + dy,
                  },
                }
              }
              return n
            })
          )
          throttledPushHistory(
            'UPDATE_NODE',
            `移动节点 ${dx !== 0 ? `水平${dx > 0 ? '右' : '左'}` : ''}${dy !== 0 ? `垂直${dy > 0 ? '下' : '上'}` : ''}`
          )
          return
        }
      }
    }

    handlerRef.current = handleKeyDown

    window.addEventListener('keydown', handleKeyDown)
    registeredRef.current = true

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      registeredRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    options.selectedNodeIds,
    options.selectedEdgeId,
    options.undo,
    options.redo,
    options.zoomIn,
    options.zoomOut,
    options.fitView,
    options.copySelectedNodes,
    options.pasteNodes,
    options.duplicateSelectedNodes,
    options.createGroupFromSelection,
    options.deleteSelectedNodes,
    options.addNodeAtCenter,
    options.handleToggleTheme,
    options.setSidebarVisible,
    options.setRightPanelVisible,
    options.setNodes,
    options.throttledPushHistory,
    options.setSelectedNodeIds,
    options.setSelectedEdgeId,
  ])

  return { register, unregister }
}
