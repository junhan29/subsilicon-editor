'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AutoSaveManager,
  type AutoSaveConfig,
  type EditorState,
  type GetStateFn,
} from '@editor/lib/auto-save'

/**
 * 自动保存 Hook 的配置项
 */
export interface UseAutosaveOptions {
  /** 获取当前编辑器状态的函数（应读取最新状态，通常通过 ref 实现） */
  getState: GetStateFn
  /** 自动保存配置 */
  config?: Partial<AutoSaveConfig>
  /** 是否启用自动保存（默认 true） */
  enabled?: boolean
  /** 保存成功后的回调 */
  onSnapshot?: (state: EditorState) => void
}

/**
 * 自动保存 Hook 的返回值
 */
export interface UseAutosaveReturn {
  /** 手动触发保存 */
  save: () => void
  /** 是否正在保存 */
  isSaving: boolean
  /** 上次保存时间戳（ms），null 表示从未保存过 */
  lastSavedAt: number | null
  /** 当前保存的快照数量 */
  snapshotCount: number
  /** 获取所有快照 */
  snapshots: EditorState[]
  /** 清除所有自动保存快照 */
  clearAll: () => void
  /** 更新配置 */
  setConfig: (config: Partial<AutoSaveConfig>) => void
  /** 当前配置 */
  config: AutoSaveConfig
}

/**
 * 自动保存管理 Hook
 *
 * 提取自 story-canvas.tsx 的自动保存需求，封装 AutoSaveManager。
 * 在 mount 时启动定时保存，unmount 时停止。
 * 提供手动 save 方法及保存状态查询。
 */
export function useAutosave({
  getState,
  config,
  enabled = true,
  onSnapshot,
}: UseAutosaveOptions): UseAutosaveReturn {
  const managerRef = useRef<AutoSaveManager | null>(null)
  const onSnapshotRef = useRef(onSnapshot)
  onSnapshotRef.current = onSnapshot

  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [snapshotCount, setSnapshotCount] = useState(0)
  const [snapshots, setSnapshots] = useState<EditorState[]>([])
  const [currentConfig, setCurrentConfig] = useState<AutoSaveConfig>({
    enabled,
    interval: 30000,
    maxSnapshots: 3,
    ...config,
  })

  // 初始化 AutoSaveManager
  useEffect(() => {
    if (!enabled) return

    const manager = new AutoSaveManager(currentConfig)
    managerRef.current = manager

    manager.start(getState, (state) => {
      setIsSaving(true)
      setLastSavedAt(state.timestamp)
      setSnapshotCount(manager.getSnapshotCount())
      setSnapshots(manager.getAllSnapshots())
      setIsSaving(false)
      onSnapshotRef.current?.(state)
    })

    // 初始化快照信息
    setSnapshotCount(manager.getSnapshotCount())
    setSnapshots(manager.getAllSnapshots())
    const latest = manager.getLatestSnapshot()
    if (latest) {
      setLastSavedAt(latest.timestamp)
    }

    return () => {
      manager.stop()
      managerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  // 手动触发保存
  const save = useCallback(() => {
    const manager = managerRef.current
    if (!manager) return

    setIsSaving(true)
    manager.triggerAutoSave()
    setLastSavedAt(Date.now())
    setSnapshotCount(manager.getSnapshotCount())
    setSnapshots(manager.getAllSnapshots())
    setIsSaving(false)
  }, [])

  // 清除所有快照
  const clearAll = useCallback(() => {
    const manager = managerRef.current
    if (!manager) return
    manager.clearAll()
    setSnapshotCount(0)
    setSnapshots([])
    setLastSavedAt(null)
  }, [])

  // 更新配置
  const setConfig = useCallback((newConfig: Partial<AutoSaveConfig>) => {
    const manager = managerRef.current
    const merged = { ...currentConfig, ...newConfig }
    setCurrentConfig(merged)
    if (manager) {
      manager.setConfig(newConfig)
    }
  }, [currentConfig])

  return {
    save,
    isSaving,
    lastSavedAt,
    snapshotCount,
    snapshots,
    clearAll,
    setConfig,
    config: currentConfig,
  }
}
