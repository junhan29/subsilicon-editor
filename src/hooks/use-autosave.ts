'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AutoSaveManager,
  type AutoSaveConfig,
  type EditorState,
  type GetStateFn,
} from '@editor/lib/auto-save'

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

export interface UseAutosaveReturn {
  save: () => void
  isSaving: boolean
  /** 上次保存时间戳（ms），null 表示从未保存过 */
  lastSavedAt: number | null
  snapshotCount: number
  snapshots: EditorState[]
  clearAll: () => void
  setConfig: (config: Partial<AutoSaveConfig>) => void
  config: AutoSaveConfig
}

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

  const clearAll = useCallback(() => {
    const manager = managerRef.current
    if (!manager) return
    manager.clearAll()
    setSnapshotCount(0)
    setSnapshots([])
    setLastSavedAt(null)
  }, [])

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
