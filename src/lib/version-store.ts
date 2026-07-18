import { createSnapshot, type StoryGraphSnapshot } from '@editor/lib/history-store'

export interface VersionSnapshot {
  id: string
  name: string // 用户命名的版本名，如"第一章完成v1"
  description?: string
  createdAt: number
  graph: StoryGraphSnapshot // 完整的图数据快照
  thumbnail?: string // 画布缩略图（可选）
}

export interface VersionFieldChange {
  field: string
  before: unknown
  after: unknown
}

export interface VersionModifiedNode {
  id: string
  type: string
  label: string
  changes: VersionFieldChange[]
}

export interface VersionDiff {
  addedNodes: { id: string; type: string; label: string }[]
  removedNodes: { id: string; type: string; label: string }[]
  modifiedNodes: VersionModifiedNode[]
  addedEdges: { id: string; source: string; target: string }[]
  removedEdges: { id: string; source: string; target: string }[]
  addedCharacters: { id: string; name: string }[]
  removedCharacters: { id: string; name: string }[]
  summary: {
    totalChanges: number
    addedCount: number
    removedCount: number
    modifiedCount: number
  }
}

export const VERSION_STORAGE_KEY = 'subsilicon-versions'
export const AUTO_SAVE_KEY_PREFIX = 'subsilicon-autosave'
const MAX_VERSIONS = 30
const AUTO_SAVE_INTERVAL = 5 * 60 * 1000 // 5分钟自动保存
const MAX_AUTO_SAVES = 10 // 最多保留 10 个自动存档

interface SnapshotNode {
  id: string
  type: string
  position?: { x: number; y: number }
  data?: Record<string, unknown>
}

interface SnapshotEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  label?: string
  condition?: string
  data?: Record<string, unknown>
}

interface SnapshotCharacter {
  id: string
  name: string
}

const nodeTypeLabels: Record<string, string> = {
  dialogue: '对话',
  choice: '选择',
  gather: '汇聚',
  condition: '条件',
  unlock: '付费',
  ending: '结局',
  cg: 'CG过场',
  jump: '跳转',
  random: '随机',
  narration: '旁白',
}

function asNode(value: unknown): SnapshotNode | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (typeof v.id !== 'string' || typeof v.type !== 'string') return null
  return {
    id: v.id,
    type: v.type,
    position:
      v.position && typeof v.position === 'object'
        ? (v.position as { x: number; y: number })
        : undefined,
    data:
      v.data && typeof v.data === 'object'
        ? (v.data as Record<string, unknown>)
        : undefined,
  }
}

function asEdge(value: unknown): SnapshotEdge | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (typeof v.id !== 'string' || typeof v.source !== 'string' || typeof v.target !== 'string') {
    return null
  }
  return {
    id: v.id,
    source: v.source,
    target: v.target,
    sourceHandle: typeof v.sourceHandle === 'string' ? v.sourceHandle : undefined,
    targetHandle: typeof v.targetHandle === 'string' ? v.targetHandle : undefined,
    label: typeof v.label === 'string' ? v.label : undefined,
    condition: typeof v.condition === 'string' ? v.condition : undefined,
    data:
      v.data && typeof v.data === 'object'
        ? (v.data as Record<string, unknown>)
        : undefined,
  }
}

function asCharacter(value: unknown): SnapshotCharacter | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (typeof v.id !== 'string' || typeof v.name !== 'string') return null
  return { id: v.id, name: v.name }
}

export function getNodeLabel(node: SnapshotNode): string {
  const data = node.data || {}
  const typeLabel = nodeTypeLabels[node.type] || node.type || '节点'

  switch (node.type) {
    case 'dialogue': {
      const text = typeof data.text === 'string' ? data.text : ''
      return text ? truncate(text, 18) : typeLabel
    }
    case 'choice': {
      const prompt = typeof data.prompt === 'string' ? data.prompt : ''
      return prompt ? truncate(prompt, 18) : typeLabel
    }
    case 'ending': {
      const title = typeof data.title === 'string' ? data.title : ''
      return title ? truncate(title, 18) : typeLabel
    }
    case 'cg': {
      const title = typeof data.title === 'string' ? data.title : ''
      return title ? truncate(title, 18) : typeLabel
    }
    case 'condition': {
      const expr = typeof data.expression === 'string' ? data.expression : ''
      return expr ? `${typeLabel}: ${truncate(expr, 14)}` : typeLabel
    }
    case 'jump': {
      const label = typeof data.label === 'string' ? data.label : ''
      return label ? truncate(label, 18) : typeLabel
    }
    case 'random': {
      const label = typeof data.label === 'string' ? data.label : ''
      return label ? truncate(label, 18) : typeLabel
    }
    case 'gather': {
      const label = typeof data.label === 'string' ? data.label : ''
      return label ? truncate(label, 18) : typeLabel
    }
    default:
      return typeLabel
  }
}

function truncate(text: string, max: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return trimmed.slice(0, max) + '…'
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function validateSnapshotShape(value: unknown): value is VersionSnapshot {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.createdAt === 'number' &&
    v.graph !== null &&
    typeof v.graph === 'object'
  )
}

export function loadVersions(): VersionSnapshot[] {
  if (!isBrowser()) return []
  try {
    const raw = window.localStorage.getItem(VERSION_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(validateSnapshotShape) as VersionSnapshot[]
  } catch {
    return []
  }
}

function persistVersions(versions: VersionSnapshot[]): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(VERSION_STORAGE_KEY, JSON.stringify(versions))
  } catch {
  }
}

export function saveVersion(
  name: string,
  description: string | undefined,
  graph: StoryGraphSnapshot,
  thumbnail?: string
): VersionSnapshot {
  const snapshot = createSnapshot(graph)
  const version: VersionSnapshot = {
    id: `ver-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || `版本 ${new Date().toLocaleString()}`,
    description: description?.trim() || undefined,
    createdAt: Date.now(),
    graph: snapshot,
    thumbnail,
  }

  const versions = loadVersions()
  versions.push(version)

  // 超出上限时删除最旧的
  if (versions.length > MAX_VERSIONS) {
    versions.splice(0, versions.length - MAX_VERSIONS)
  }

  persistVersions(versions)
  return version
}

export function deleteVersion(id: string): VersionSnapshot[] {
  const versions = loadVersions().filter((v) => v.id !== id)
  persistVersions(versions)
  return versions
}

export function restoreVersion(id: string): VersionSnapshot | null {
  const versions = loadVersions()
  const found = versions.find((v) => v.id === id)
  if (!found) return null
  // 返回深拷贝避免外部修改污染存储
  return {
    ...found,
    graph: createSnapshot(found.graph),
  }
}

export function compareVersions(
  v1: VersionSnapshot,
  v2: VersionSnapshot
): VersionDiff {
  const g1 = v1.graph
  const g2 = v2.graph

  const addedNodes: VersionDiff['addedNodes'] = []
  const removedNodes: VersionDiff['removedNodes'] = []
  const modifiedNodes: VersionModifiedNode[] = []
  const addedEdges: VersionDiff['addedEdges'] = []
  const removedEdges: VersionDiff['removedEdges'] = []
  const addedCharacters: VersionDiff['addedCharacters'] = []
  const removedCharacters: VersionDiff['removedCharacters'] = []

  const nodes1 = new Map<string, SnapshotNode>()
  for (const raw of g1.nodes) {
    const n = asNode(raw)
    if (n) nodes1.set(n.id, n)
  }
  const nodes2 = new Map<string, SnapshotNode>()
  for (const raw of g2.nodes) {
    const n = asNode(raw)
    if (n) nodes2.set(n.id, n)
  }

  for (const [id, node2] of nodes2) {
    if (!nodes1.has(id)) {
      addedNodes.push({ id, type: node2.type, label: getNodeLabel(node2) })
    }
  }
  for (const [id, node1] of nodes1) {
    if (!nodes2.has(id)) {
      removedNodes.push({ id, type: node1.type, label: getNodeLabel(node1) })
    }
  }
  for (const [id, node1] of nodes1) {
    const node2 = nodes2.get(id)
    if (!node2) continue

    const changes: VersionFieldChange[] = []

    if (node1.type !== node2.type) {
      changes.push({ field: 'type', before: node1.type, after: node2.type })
    }

    const p1 = node1.position
    const p2 = node2.position
    if (p1 && p2) {
      if (p1.x !== p2.x) changes.push({ field: 'position.x', before: p1.x, after: p2.x })
      if (p1.y !== p2.y) changes.push({ field: 'position.y', before: p1.y, after: p2.y })
    } else if (valuesEqual(p1, p2) === false) {
      changes.push({ field: 'position', before: p1, after: p2 })
    }

    const data1 = node1.data || {}
    const data2 = node2.data || {}
    const dataKeys = new Set([...Object.keys(data1), ...Object.keys(data2)])
    for (const key of dataKeys) {
      const before = data1[key]
      const after = data2[key]
      if (!valuesEqual(before, after)) {
        changes.push({ field: `data.${key}`, before, after })
      }
    }

    if (changes.length > 0) {
      modifiedNodes.push({
        id,
        type: node2.type,
        label: getNodeLabel(node2),
        changes,
      })
    }
  }

  const edges1 = new Map<string, SnapshotEdge>()
  for (const raw of g1.edges) {
    const e = asEdge(raw)
    if (e) edges1.set(e.id, e)
  }
  const edges2 = new Map<string, SnapshotEdge>()
  for (const raw of g2.edges) {
    const e = asEdge(raw)
    if (e) edges2.set(e.id, e)
  }

  for (const [id, edge2] of edges2) {
    if (!edges1.has(id)) {
      addedEdges.push({ id, source: edge2.source, target: edge2.target })
    }
  }
  for (const [id, edge1] of edges1) {
    if (!edges2.has(id)) {
      removedEdges.push({ id, source: edge1.source, target: edge1.target })
    }
  }

  const chars1 = new Map<string, SnapshotCharacter>()
  for (const raw of g1.characters) {
    const c = asCharacter(raw)
    if (c) chars1.set(c.id, c)
  }
  const chars2 = new Map<string, SnapshotCharacter>()
  for (const raw of g2.characters) {
    const c = asCharacter(raw)
    if (c) chars2.set(c.id, c)
  }

  for (const [id, char2] of chars2) {
    if (!chars1.has(id)) {
      addedCharacters.push({ id, name: char2.name })
    }
  }
  for (const [id, char1] of chars1) {
    if (!chars2.has(id)) {
      removedCharacters.push({ id, name: char1.name })
    }
  }

  const addedCount =
    addedNodes.length + addedEdges.length + addedCharacters.length
  const removedCount =
    removedNodes.length + removedEdges.length + removedCharacters.length
  const modifiedCount = modifiedNodes.length

  return {
    addedNodes,
    removedNodes,
    modifiedNodes,
    addedEdges,
    removedEdges,
    addedCharacters,
    removedCharacters,
    summary: {
      totalChanges: addedCount + removedCount + modifiedCount,
      addedCount,
      removedCount,
      modifiedCount,
    },
  }
}

// ====== 自动存档 ======

export interface AutoSaveEntry {
  id: string
  name: string
  createdAt: number
  graph: StoryGraphSnapshot
}

export function getAutoSaveKey(workId: string): string {
  return `${AUTO_SAVE_KEY_PREFIX}-${workId}`
}

/** 自动保存当前画布状态 */
export function autoSaveVersion(
  workId: string,
  graph: StoryGraphSnapshot
): AutoSaveEntry | null {
  if (!isBrowser()) return null
  try {
    const key = getAutoSaveKey(workId)
    const raw = window.localStorage.getItem(key)
    const entries: AutoSaveEntry[] = raw ? JSON.parse(raw) : []

    const entry: AutoSaveEntry = {
      id: `auto-${Date.now()}`,
      name: `自动存档 - ${new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
      createdAt: Date.now(),
      graph: createSnapshot(graph),
    }

    entries.push(entry)
    if (entries.length > MAX_AUTO_SAVES) {
      entries.splice(0, entries.length - MAX_AUTO_SAVES)
    }

    window.localStorage.setItem(key, JSON.stringify(entries))
    return entry
  } catch {
    return null
  }
}

/** 获取自动存档列表 */
export function getAutoSaves(workId: string): AutoSaveEntry[] {
  if (!isBrowser()) return []
  try {
    const raw = window.localStorage.getItem(getAutoSaveKey(workId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as AutoSaveEntry[]
  } catch {
    return []
  }
}

/** 清除自动存档 */
export function clearAutoSaves(workId: string): void {
  if (!isBrowser()) return
  window.localStorage.removeItem(getAutoSaveKey(workId))
}

// ====== 导出/导入 ======

/** 将所有版本导出为 JSON 文件 */
export function exportVersionsToFile(versions: VersionSnapshot[]): void {
  if (!isBrowser()) return
  const data = JSON.stringify(versions, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `subsilicon-versions-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** 从 JSON 文件导入版本（合并模式） */
export function importVersionsFromFile(jsonStr: string): { imported: number; skipped: number } {
  if (!isBrowser()) return { imported: 0, skipped: 0 }
  try {
    const parsed = JSON.parse(jsonStr)
    if (!Array.isArray(parsed)) throw new Error('Invalid format')

    const incoming = parsed.filter(validateSnapshotShape) as VersionSnapshot[]
    const existing = loadVersions()
    const existingIds = new Set(existing.map((v) => v.id))

    let imported = 0
    let skipped = 0
    for (const v of incoming) {
      if (existingIds.has(v.id)) {
        skipped++
        continue
      }
      existing.push(v)
      existingIds.add(v.id)
      imported++
    }

    persistVersions(existing)
    return { imported, skipped }
  } catch {
    return { imported: 0, skipped: 0 }
  }
}
