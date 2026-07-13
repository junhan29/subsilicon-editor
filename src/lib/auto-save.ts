export interface EditorState {
  nodes: unknown[]
  edges: unknown[]
  characters: unknown[]
  scenes: unknown[]
  audios: unknown[]
  variables: unknown[]
  title: string
  tags: string[]
  timestamp: number
}

export interface AutoSaveConfig {
  enabled: boolean
  interval: number
  maxSnapshots: number
}

export const AUTOSAVE_KEY = 'subsilicon_autosave'
export const EDITOR_STATE_KEY = 'subsilicon_editor_state'
export const DEFAULT_CONFIG: AutoSaveConfig = {
  enabled: true,
  interval: 30000,
  maxSnapshots: 3,
}

export function validateEditorState(value: unknown): value is EditorState {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    Array.isArray(v.nodes) &&
    Array.isArray(v.edges) &&
    Array.isArray(v.characters) &&
    Array.isArray(v.scenes) &&
    Array.isArray(v.audios) &&
    Array.isArray(v.variables) &&
    typeof v.title === 'string' &&
    Array.isArray(v.tags) &&
    typeof v.timestamp === 'number'
  )
}

export type GetStateFn = () => EditorState | null

// 最大自动保存数据大小（5MB）
const MAX_AUTO_SAVE_SIZE = 5 * 1024 * 1024

export class AutoSaveManager {
  private config: AutoSaveConfig
  private timer: number | null = null
  private getState: GetStateFn | null = null
  private lastSaveTime = 0
  private onSnapshot: ((state: EditorState) => void) | null = null
  private lastSavedSnapshot: string | null = null

  constructor(config: Partial<AutoSaveConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  start(
    getState: GetStateFn,
    onSnapshot?: (state: EditorState) => void
  ): void {
    if (!this.config.enabled) return

    this.getState = getState
    this.onSnapshot = onSnapshot ?? null

    if (this.timer) {
      clearInterval(this.timer)
    }

    this.timer = window.setInterval(() => {
      this.triggerAutoSave()
    }, this.config.interval)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.getState = null
    this.onSnapshot = null
  }

  triggerAutoSave(): void {
    if (!this.getState) return

    const now = Date.now()
    if (now - this.lastSaveTime < 5000) return

    const state = this.getState()
    if (!state) return

    // 增量保存：只有与上次保存不同的部分才写入
    const snapshot = JSON.stringify(state)
    if (this.lastSavedSnapshot === snapshot) return

    // 极限情况下的保护
    if (snapshot.length > MAX_AUTO_SAVE_SIZE) {
      console.warn('[AutoSave] 作品数据 > 5MB，自动保存已暂停。请手动保存。')
      return
    }

    this.lastSavedSnapshot = snapshot
    this.lastSaveTime = now
    this.saveSnapshot(state)
    this.onSnapshot?.(state)
  }

  saveSnapshot(state: EditorState): void {
    try {
      const snapshots = this.getAllSnapshots()

      const newSnapshot: EditorState = {
        ...state,
        timestamp: Date.now(),
      }

      snapshots.unshift(newSnapshot)

      while (snapshots.length > this.config.maxSnapshots) {
        snapshots.pop()
      }

      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(snapshots))
    } catch (e) {
      console.warn('Failed to save auto snapshot:', e)
    }
  }

  getLatestSnapshot(): EditorState | null {
    const snapshots = this.getAllSnapshots()
    return snapshots[0] || null
  }

  getAllSnapshots(): EditorState[] {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY)
      if (!raw) return []

      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []

      // schema 校验
      return parsed.filter(validateEditorState)
    } catch {
      return []
    }
  }

  getSnapshotCount(): number {
    return this.getAllSnapshots().length
  }

  hasUnsavedChanges(): boolean {
    return this.getSnapshotCount() > 0
  }

  clearAll(): void {
    try {
      localStorage.removeItem(AUTOSAVE_KEY)
    } catch {
    }
  }

  deleteSnapshot(index: number): void {
    const snapshots = this.getAllSnapshots()
    if (index >= 0 && index < snapshots.length) {
      snapshots.splice(index, 1)
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(snapshots))
    }
  }

  setConfig(config: Partial<AutoSaveConfig>): void {
    this.config = { ...this.config, ...config }
    if (this.getState) {
      const getState = this.getState
      const onSnapshot = this.onSnapshot
      this.stop()
      this.start(getState, onSnapshot ?? undefined)
    }
  }

  getConfig(): AutoSaveConfig {
    return { ...this.config }
  }
}

export class EditorRecoveryManager {
  private storageKey: string

  constructor(storageKey = EDITOR_STATE_KEY) {
    this.storageKey = storageKey
  }

  saveEditorState(state: Partial<EditorState>): void {
    try {
      const existing = this.getEditorState() || {
        nodes: [],
        edges: [],
        characters: [],
        scenes: [],
        audios: [],
        variables: [],
        title: '',
        tags: [],
        timestamp: Date.now(),
      }
      const updated: EditorState = {
        ...existing,
        ...state,
        timestamp: Date.now(),
      }
      localStorage.setItem(this.storageKey, JSON.stringify(updated))
    } catch {
    }
  }

  getEditorState(): EditorState | null {
    try {
      const raw = localStorage.getItem(this.storageKey)
      if (!raw) return null

      const parsed = JSON.parse(raw)
      if (!validateEditorState(parsed)) return null

      const maxAge = 24 * 60 * 60 * 1000
      if (Date.now() - parsed.timestamp > maxAge) {
        this.clearEditorState()
        return null
      }

      return parsed
    } catch {
      return null
    }
  }

  hasRecoverableState(): boolean {
    return this.getEditorState() !== null
  }

  clearEditorState(): void {
    try {
      localStorage.removeItem(this.storageKey)
    } catch {
    }
  }

  updateTimestamp(): void {
    const state = this.getEditorState()
    if (state) {
      state.timestamp = Date.now()
      localStorage.setItem(this.storageKey, JSON.stringify(state))
    }
  }
}

export function createAutoSaveManager(config?: Partial<AutoSaveConfig>): AutoSaveManager {
  return new AutoSaveManager(config)
}

export function createRecoveryManager(storageKey?: string): EditorRecoveryManager {
  return new EditorRecoveryManager(storageKey)
}

export function formatRecoveryTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)

  if (diff < 60000) {
    return '刚刚'
  } else if (minutes < 60) {
    return `${minutes} 分钟前`
  } else if (hours < 24) {
    return `${hours} 小时前`
  } else {
    const d = new Date(timestamp)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  }
}
