import { generateId } from './utils'
import { openDB } from './local-db/db'

// 创作者输入库：灵感/大纲/设定/纠错/对话等采集条目，存于 IndexedDB creatorInputs 表（v5）

export type CreatorInputType = 'inspiration' | 'outline' | 'setting' | 'correction' | 'chat'

export interface CreatorInput {
  id: string
  workId: string // 空字符串表示全局
  type: CreatorInputType
  content: string // 剪裁到 MAX_CONTENT_LENGTH
  source: string // 采集来源，如 'chat' | 'panel' | 'manual'
  createdAt: number
  notes?: string // 可选备注
}

/** 单条内容最大长度（超出部分直接剪裁丢弃） */
export const MAX_CONTENT_LENGTH = 2000

const STORE_NAME = 'creatorInputs'
// 采集开关 localStorage key（无值视为开启）
const CAPTURE_KEY = 'subsilicon_creator_input_capture'

function trimContent(content: string): string {
  return content.length > MAX_CONTENT_LENGTH ? content.slice(0, MAX_CONTENT_LENGTH) : content
}

/** 采集开关：默认开启（未设置过视为 true） */
export function getInputCaptureEnabled(): boolean {
  try {
    const raw = localStorage.getItem(CAPTURE_KEY)
    return raw === null ? true : raw === 'true'
  } catch {
    // localStorage 不可用（如隐私模式）时视为开启
    return true
  }
}

/** 设置采集开关 */
export function setInputCaptureEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(CAPTURE_KEY, String(enabled))
  } catch {
    // localStorage 不可用时静默失败
  }
}

/** 新增一条创作者输入；IndexedDB 不可用时静默失败但仍返回记录 */
export async function addCreatorInput(input: Omit<CreatorInput, 'id' | 'createdAt'>): Promise<CreatorInput> {
  const record: CreatorInput = {
    ...input,
    id: generateId('ci'),
    createdAt: Date.now(),
    content: trimContent(input.content),
  }
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    await new Promise<void>((resolve, reject) => {
      const req = store.put(record)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch {
    // IndexedDB 不可用：静默失败，不抛异常破坏调用方
  }
  return record
}

/** 列出创作者输入；workId 为空返回全部（按 createdAt 倒序），非空时按索引 byWorkId 过滤 */
export async function listCreatorInputs(workId?: string): Promise<CreatorInput[]> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const results = await new Promise<CreatorInput[]>((resolve, reject) => {
      const req = workId
        ? store.index('byWorkId').getAll(workId)
        : store.getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })
    return results.sort((a, b) => b.createdAt - a.createdAt)
  } catch {
    // IndexedDB 不可用：返回空列表
    return []
  }
}

/** 更新创作者输入的 type / notes（先读后写合并，不存在时静默跳过） */
export async function updateCreatorInput(
  id: string,
  patch: Partial<Pick<CreatorInput, 'type' | 'notes'>>,
): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const existing = await new Promise<CreatorInput | undefined>((resolve, reject) => {
      const req = store.get(id)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    if (!existing) return
    await new Promise<void>((resolve, reject) => {
      const req = store.put({ ...existing, ...patch })
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch {
    // IndexedDB 不可用：静默失败
  }
}

/** 删除一条创作者输入 */
export async function deleteCreatorInput(id: string): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    await new Promise<void>((resolve, reject) => {
      const req = store.delete(id)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch {
    // IndexedDB 不可用：静默失败
  }
}
