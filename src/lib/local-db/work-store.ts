import type { StoryGraph } from '@editor/types/editor'
import type { WorkDocument, WorkTypeId } from '@editor/types/work'
import { type MonetizationConfig, stripSensitiveFromConfig } from '@editor/lib/work-monetization'
import { openDB } from './db'

export interface WorkMetadata {
  id: string
  name: string
  updatedAt: number
  createdAt: number
  lastOpened: number
  nodeCount: number
  edgeCount: number
  templateId: string
  thumbnail?: string
  customPath?: string
  /** v2.0：作品类型（旧数据缺省视为互动叙事） */
  workType?: WorkTypeId
}

export interface StoredWork extends WorkMetadata {
  /** 兼容两种格式：v1.x 裸 StoryGraph 或 v2.0 WorkDocument */
  editorData: StoryGraph | WorkDocument
}

export async function saveWork(work: StoredWork): Promise<void> {
  // 解锁凭据（seedKey / offlineCodes / preGeneratedCodes）只存本机 localStorage，
  // 绝不写入作品存储——否则作品被复制/导入/导出给他人时，接收方可凭解锁码
  // 或密钥免费解锁付费内容。
  const safeWork: StoredWork = { ...work }
  const data = work.editorData
  if (data && typeof data === 'object' && 'monetization' in data && data.monetization) {
    const stripped = stripSensitiveFromConfig(data.monetization)
    safeWork.editorData = { ...data, monetization: stripped } as StoryGraph & WorkDocument
    // WorkDocument 格式下 graph.monetization 与 data.monetization 可能是同一对象
    // 引用（interactive-narrative.fromGraph 直接透传），须同步剥离，否则敏感凭据
    // 仍会随 doc.graph.monetization 落盘/被复制。
    const graph = (data as WorkDocument).graph
    if (graph && typeof graph === 'object' && 'monetization' in graph && graph.monetization) {
      safeWork.editorData = {
        ...safeWork.editorData,
        graph: { ...graph, monetization: stripped },
      } as StoryGraph & WorkDocument
    }
  }
  const db = await openDB()
  const tx = db.transaction('works', 'readwrite')
  tx.objectStore('works').put(safeWork)
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadWork(id: string): Promise<StoredWork | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const request = db.transaction('works', 'readonly')
      .objectStore('works')
      .get(id)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

export async function getAllWorks(): Promise<StoredWork[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const request = db.transaction('works', 'readonly')
      .objectStore('works')
      .getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

export async function deleteWork(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const request = db.transaction('works', 'readwrite')
      .objectStore('works')
      .delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export function generateProjectId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 从 StoredWork 提取类型化图数据（供 StoryCanvas 编辑使用）。
 * v2.0 WorkDocument → doc.graph；v1.x 裸 StoryGraph → 原样返回。
 */
export function getGraphFromWork(work: StoredWork): StoryGraph {
  const data = work.editorData
  if (data && typeof data === 'object' && 'workType' in data && 'graph' in data) {
    return (data as WorkDocument).graph
  }
  return data as StoryGraph
}

/**
 * 从 StoredWork 提取 WorkDocument（统一入口）。
 * v2.0 直接返回；v1.x 旧数据即时包装（不写回，保持旧格式可回退）。
 */
export function getDocumentFromWork(work: StoredWork): WorkDocument {
  const data = work.editorData
  if (data && typeof data === 'object' && 'workType' in data && 'graph' in data) {
    return data as WorkDocument
  }
  // 旧格式或损坏数据：包装为互动叙事文档（对 null/缺字段做兜底，避免解引用崩溃）
  const graph = (data && typeof data === 'object' ? data : {}) as StoryGraph
  return {
    formatVersion: '2.0',
    workType: work.workType || 'interactive-narrative',
    meta: {
      title: graph.title || work.name || '未命名故事',
      description: graph.description || undefined,
      tags: graph.settings?.tags?.length ? graph.settings.tags : undefined,
      coverImage: graph.settings?.coverImage || undefined,
      createdAt: work.createdAt,
      updatedAt: work.updatedAt,
    },
    graph: {
      ...graph,
      nodes: Array.isArray(graph.nodes) ? graph.nodes : [],
      edges: Array.isArray(graph.edges) ? graph.edges : [],
    },
    resources: {
      images: graph.assets?.images || [],
      audios: graph.assets?.audios || [],
      videos: [],
      fonts: graph.assets?.fonts || [],
      others: [],
    },
    monetization: graph.monetization,
  }
}

/** 计算作品节点/连线数（兼容两种格式） */
export function countWorkEdges(work: StoredWork): { nodeCount: number; edgeCount: number } {
  const graph = getGraphFromWork(work)
  return {
    nodeCount: graph.nodes?.length || 0,
    edgeCount: graph.edges?.length || 0,
  }
}
