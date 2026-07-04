'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { Node } from '@xyflow/react'
import { matchShortcut } from '@editor/lib/shortcut-manager'
import type { HistoryActionType } from '@editor/lib/history-store'

/**
 * 快捷键 Hook 的配置项
 *
 * 包含快捷键处理所需的所有操作函数和状态。
 * 调用方需确保传入的函数引用在依赖变化时更新。
 */
export interface UseShortcutsOptions {
  // === 当前选中状态 ===
  selectedNodeIds: string[]
  selectedEdgeId: string | null

  // === 画布操作 ===
  undo: () => void
  redo: () => void
  zoomIn: (options?: { duration?: number }) => void
  zoomOut: (options?: { duration?: number }) => void
  fitView: (options?: {
    padding?: number
    duration?: number
    nodes?: { id: string }[]
  }) => void

  // === 编辑操作 ===
  copySelectedNodes: () => void
  pasteNodes: () => void
  duplicateSelectedNodes: () => void
  createGroupFromSelection: () => void
  deleteSelectedNodes: () => void

  // === 节点操作 ===
  addNodeAtCenter: (type: string) => void

  // === 视图切换 ===
  handleToggleTheme: () => void
  setSidebarVisible: React.Dispatch<React.SetStateAction<boolean>>
  setRightPanelVisible: React.Dispatch<React.SetStateAction<boolean>>

  // === 节点位置微调 ===
  setNodes: (updater: (nodes: Node[]) => Node[]) => void
  throttledPushHistory: (
    type: HistoryActionType,
    description: string
  ) => void

  // === 选中状态设置 ===
  setSelectedNodeIds: React.Dispatch<React.SetStateAction<string[]>>
  setSelectedEdgeId: React.Dispatch<React.SetStateAction<string | null>>
}

/**
 * 快捷键 Hook 的返回值
 */
export interface UseShortcutsReturn {
  /** 手动注册快捷键监听器（默认已在 mount 时注册） */
  register: () => void
  /** 手动注销快捷键监听器 */
  unregister: () => void
}

/**
 * 键盘快捷键管理 Hook
 *
 * 提取自 story-canvas.tsx 中的 keydown 事件处理逻辑。
 * 在 mount 时自动注册全局 keydown 监听器，unmount 时自动注销。
 * 同时返回 register / unregister 方法供外部按需控制。
 */
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

  // 重建 handler 并注册
  useEffect(() => {
    // 注销旧 handler
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

      // === 画布类：撤销 / 重做 / 缩放 / 适应视图 ===
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

      // === 编辑类：复制 / 粘贴 / 克隆 / 创建分组 ===
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

      // === 节点类：取消选中 / 删除 ===
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

      // === 视图类：切换侧边栏 / 右侧栏 / 主题 ===
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

      // === 节点类：快速添加节点 ===
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

      // === 节点位置微调（方向键） ===
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

    // 自动注册
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
