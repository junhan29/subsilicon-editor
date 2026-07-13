export type SaveVersion = 1 | 2 | 3

export interface HistoryEntry {
  nodeId: string
  variables: Record<string, string | number | boolean>
}

export interface SaveSlot {
  id: number
  title: string
  timestamp: number
  nodeId: string
  variables: Record<string, string | number | boolean>
  history: HistoryEntry[]
  thumbnail?: string
  nodeCount: number
  version: SaveVersion
  checksum: string
  graphId: string
}

export interface AutoSaveConfig {
  enabled: boolean
  interval: number
}

export const SAVE_KEY_PREFIX = 'subsilicon_save_'
export const SAVE_SLOT_COUNT = 9
export const QUICK_SAVE_ID = 0
export const CURRENT_SAVE_VERSION: SaveVersion = 3

// 注意：djb2 哈希用于本地存档完整性校验，不是安全用途
function calculateChecksum(data: string): string {
  let hash = 5381
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) + hash) + char
    hash = hash | 0
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function validateSaveShape(value: unknown): value is SaveSlot {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'number' &&
    typeof v.title === 'string' &&
    typeof v.timestamp === 'number' &&
    typeof v.nodeId === 'string' &&
    typeof v.nodeCount === 'number' &&
    typeof v.graphId === 'string' &&
    typeof v.checksum === 'string' &&
    (v.version === 1 || v.version === 2 || v.version === 3) &&
    v.variables !== null && typeof v.variables === 'object' &&
    Array.isArray(v.history)
  )
}

export function createSaveSlot(
  slot: Omit<SaveSlot, 'checksum' | 'version'>
): SaveSlot {
  const dataWithoutChecksum = JSON.stringify({ ...slot, checksum: '', version: CURRENT_SAVE_VERSION })
  const checksum = calculateChecksum(dataWithoutChecksum)
  return { ...slot, version: CURRENT_SAVE_VERSION, checksum }
}

export function migrateSaveSlot(
  slot: SaveSlot,
  targetVersion: SaveVersion
): SaveSlot | null {
  try {
    if (slot.version === targetVersion) {
      return slot
    }

    let migrated: SaveSlot = { ...slot }

    if (migrated.version < 2) {
      migrated.graphId = migrated.graphId || 'default'
      migrated.thumbnail = migrated.thumbnail || undefined
      migrated.version = 2 as SaveVersion
    }

    if (migrated.version < 3) {
      if (!migrated.graphId) {
        migrated.graphId = 'default'
      }
      migrated.version = 3 as SaveVersion
    }

    const dataWithoutChecksum = JSON.stringify({ ...migrated, checksum: '', version: CURRENT_SAVE_VERSION })
    migrated.checksum = calculateChecksum(dataWithoutChecksum)

    return migrated
  } catch {
    return null
  }
}

export function validateSaveSlot(slot: SaveSlot): boolean {
  if (slot.version > CURRENT_SAVE_VERSION) {
    return false
  }

  const dataWithoutChecksum = JSON.stringify({ ...slot, checksum: '', version: CURRENT_SAVE_VERSION })
  const expectedChecksum = calculateChecksum(dataWithoutChecksum)
  return slot.checksum === expectedChecksum
}

export function loadSaveSlots(graphId: string): SaveSlot[] {
  try {
    const key = `${SAVE_KEY_PREFIX}${graphId}`
    const raw = localStorage.getItem(key)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    const slots = parsed as unknown[]
    const validated: SaveSlot[] = []
    let needsRewrite = false

    for (const item of slots) {
      // schema 校验
      if (!validateSaveShape(item)) {
        needsRewrite = true
        continue
      }

      const slot = item as SaveSlot

      if (!validateSaveSlot(slot)) {
        const migrated = migrateSaveSlot(slot, CURRENT_SAVE_VERSION)
        if (migrated && validateSaveSlot(migrated)) {
          validated.push(migrated)
          needsRewrite = true
        } else {
          needsRewrite = true
        }
        continue
      }

      if (slot.version !== CURRENT_SAVE_VERSION) {
        const migrated = migrateSaveSlot(slot, CURRENT_SAVE_VERSION)
        if (migrated) {
          validated.push(migrated)
          needsRewrite = true
        }
      } else {
        validated.push(slot)
      }
    }

    // 仅当发现需要清理的数据时才回写
    if (needsRewrite) {
      saveSaveSlots(graphId, validated)
    }

    return validated
  } catch {
    return []
  }
}

export function saveSaveSlots(graphId: string, slots: SaveSlot[]): void {
  try {
    const key = `${SAVE_KEY_PREFIX}${graphId}`
    localStorage.setItem(key, JSON.stringify(slots))
  } catch {
  }
}

export function deleteSaveSlot(graphId: string, slotId: number): SaveSlot[] {
  const slots = loadSaveSlots(graphId)
  const updated = slots.filter((s) => s.id !== slotId)
  saveSaveSlots(graphId, updated)
  return updated
}

export function saveToSlot(
  graphId: string,
  slotId: number,
  data: {
    nodeId: string
    variables: Record<string, string | number | boolean>
    history: HistoryEntry[]
  }
): SaveSlot {
  const newSlot = createSaveSlot({
    id: slotId,
    title: slotId === QUICK_SAVE_ID ? '快速存档' : `存档 ${slotId}`,
    timestamp: Date.now(),
    nodeId: data.nodeId,
    variables: { ...data.variables },
    history: [...data.history],
    nodeCount: data.history.length + 1,
    graphId,
  })

  const existing = loadSaveSlots(graphId)
  const filtered = existing.filter((s) => s.id !== slotId)
  const updated = [...filtered, newSlot].sort((a, b) => a.id - b.id)
  saveSaveSlots(graphId, updated)

  return newSlot
}

export function formatSaveTime(timestamp: number): string {
  const d = new Date(timestamp)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function formatSaveDate(timestamp: number): string {
  const d = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - timestamp

  if (diff < 60000) {
    return '刚刚'
  } else if (diff < 3600000) {
    return `${Math.floor(diff / 60000)} 分钟前`
  } else if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)} 小时前`
  } else if (d.getDate() === now.getDate()) {
    return `今天 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } else if (d.getDate() === now.getDate() - 1) {
    return `昨天 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } else {
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
}

export class SaveManager {
  private graphId: string
  private autoSaveTimer: number | null = null
  private autoSaveConfig: AutoSaveConfig

  constructor(graphId: string, config?: Partial<AutoSaveConfig>) {
    this.graphId = graphId
    this.autoSaveConfig = {
      enabled: config?.enabled ?? true,
      interval: config?.interval ?? 300000,
    }
  }

  startAutoSave(callback: () => void): void {
    if (!this.autoSaveConfig.enabled) return

    this.stopAutoSave()

    this.autoSaveTimer = window.setInterval(() => {
      callback()
    }, this.autoSaveConfig.interval)
  }

  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer)
      this.autoSaveTimer = null
    }
  }

  setAutoSaveConfig(config: Partial<AutoSaveConfig>): void {
    this.autoSaveConfig = { ...this.autoSaveConfig, ...config }
    if (this.autoSaveConfig.enabled) {
      this.startAutoSave(() => {})
    } else {
      this.stopAutoSave()
    }
  }

  getSlots(): SaveSlot[] {
    return loadSaveSlots(this.graphId)
  }

  save(slotId: number, data: {
    nodeId: string
    variables: Record<string, string | number | boolean>
    history: HistoryEntry[]
  }): SaveSlot {
    return saveToSlot(this.graphId, slotId, data)
  }

  quickSave(data: {
    nodeId: string
    variables: Record<string, string | number | boolean>
    history: HistoryEntry[]
  }): SaveSlot {
    return this.save(QUICK_SAVE_ID, data)
  }

  delete(slotId: number): SaveSlot[] {
    return deleteSaveSlot(this.graphId, slotId)
  }

  load(slotId: number): SaveSlot | null {
    const slots = this.getSlots()
    return slots.find((s) => s.id === slotId) || null
  }

  hasSlot(slotId: number): boolean {
    return this.getSlots().some((s) => s.id === slotId)
  }

  getSlotCount(): number {
    return this.getSlots().length
  }

  getAllSlotsOrderedByTime(): SaveSlot[] {
    return [...this.getSlots()].sort((a, b) => b.timestamp - a.timestamp)
  }

  getLatestSlot(): SaveSlot | null {
    const slots = this.getAllSlotsOrderedByTime()
    return slots[0] || null
  }

  clearAll(): void {
    saveSaveSlots(this.graphId, [])
  }

  destroy(): void {
    this.stopAutoSave()
  }
}