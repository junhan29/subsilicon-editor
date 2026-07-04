'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  HistoryStore,
  type StoryGraphSnapshot,
  type HistoryActionType,
} from '@editor/lib/history-store'
import { recordAction, estimateWordCount } from '@editor/lib/writing-stats'
import { showToast } from '../components/editor/toast'

/**
 * 历史记录 Hook 的配置项
 */
export interface UseHistoryOptions {
  /** 初始快照，用于初始化历史栈 */
  initialSnapshot: StoryGraphSnapshot
  /** 工作 ID，用于创作统计 */
  workId?: string
  /** 无障碍播报函数 */
  announce: (message: string) => void
  /** 获取当前状态快照（应读取最新状态，通常通过 ref 实现） */
  getSnapshot: () => StoryGraphSnapshot
  /** 将快照应用到组件状态（用于 undo / redo 恢复） */
  applySnapshot: (snapshot: StoryGraphSnapshot) => void
  /**
   * 触发待处理历史记录写入的依赖列表。
   * 当这些值变化时，会将 pending 的历史动作正式写入历史栈。
   * 通常传入 `[nodes, edges]`。
   */
  flushDeps: unknown[]
}

/**
 * 历史记录 Hook 的返回值
 */
export interface UseHistoryReturn {
  /** 历史栈 store 实例的 ref */
  historyStoreRef: React.MutableRefObject<HistoryStore<StoryGraphSnapshot> | null>
  /** 历史状态（canUndo / canRedo） */
  historyState: { canUndo: boolean; canRedo: boolean }
  /** 记录历史（标记为 pending，等待状态更新后写入） */
  pushHistory: (type: HistoryActionType, description: string) => void
  /** 节流版 pushHistory（200ms 内重复调用会被忽略） */
  throttledPushHistory: (type: HistoryActionType, description: string) => void
  /** 撤销 */
  undo: () => void
  /** 重做 */
  redo: () => void
  /** 构建当前状态快照 */
  buildSnapshot: () => StoryGraphSnapshot
}

/**
 * 历史记录管理 Hook
 *
 * 提取自 story-canvas.tsx 中的撤销/重做逻辑。
 * 使用 pending + flush 模式：调用 pushHistory 时仅记录动作类型和描述，
 * 待状态更新（flushDeps 变化）后再捕获 after 快照并写入历史栈。
 */
export function useHistory({
  initialSnapshot,
  workId,
  announce,
  getSnapshot,
  applySnapshot,
  flushDeps,
}: UseHistoryOptions): UseHistoryReturn {
  const historyStoreRef = useRef<HistoryStore<StoryGraphSnapshot> | null>(null)
  const pendingHistoryActionRef = useRef<{
    type: HistoryActionType
    description: string
  } | null>(null)
  const lastPushTimeRef = useRef(0)
  const [historyState, setHistoryState] = useState<{
    canUndo: boolean
    canRedo: boolean
  }>({ canUndo: false, canRedo: false })

  // 初始化历史栈并订阅状态变化
  useEffect(() => {
    if (!historyStoreRef.current) {
      historyStoreRef.current = new HistoryStore<StoryGraphSnapshot>(50)
    }
    historyStoreRef.current.initialize(initialSnapshot)
    const unsubscribe = historyStoreRef.current.subscribe(setHistoryState)
    return () => {
      unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSnapshot])

  const buildSnapshot = useCallback((): StoryGraphSnapshot => {
    return getSnapshot()
  }, [getSnapshot])

  const pushHistory = useCallback(
    (type: HistoryActionType, description: string) => {
      pendingHistoryActionRef.current = { type, description }
    },
    []
  )

  // 当状态变化时，将待处理的历史动作写入历史栈
  useEffect(() => {
    const pending = pendingHistoryActionRef.current
    if (!pending) return
    const after = buildSnapshot()
    const before = historyStoreRef.current?.getPresent()
    if (before) {
      historyStoreRef.current?.push(
        pending.type,
        pending.description,
        before,
        after
      )
      const wid = workId || 'default'
      const beforeWords = estimateWordCount(before.nodes)
      const afterWords = estimateWordCount(after.nodes)
      const wordDelta = afterWords - beforeWords
      const nodeDelta = after.nodes.length - before.nodes.length
      recordAction(wid, wordDelta, nodeDelta)
    }
    pendingHistoryActionRef.current = null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...flushDeps, buildSnapshot, workId])

  const throttledPushHistory = useCallback(
    (type: HistoryActionType, description: string) => {
      const now = Date.now()
      if (now - lastPushTimeRef.current < 200) return
      lastPushTimeRef.current = now
      pushHistory(type, description)
    },
    [pushHistory]
  )

  const undo = useCallback(() => {
    const snapshot = historyStoreRef.current?.undo()
    if (snapshot) {
      applySnapshot(snapshot)
      showToast('info', '已撤销')
      announce('已撤销')
    }
  }, [applySnapshot, announce])

  const redo = useCallback(() => {
    const snapshot = historyStoreRef.current?.redo()
    if (snapshot) {
      applySnapshot(snapshot)
      showToast('info', '已重做')
      announce('已重做')
    }
  }, [applySnapshot, announce])

  return {
    historyStoreRef,
    historyState,
    pushHistory,
    throttledPushHistory,
    undo,
    redo,
    buildSnapshot,
  }
}
