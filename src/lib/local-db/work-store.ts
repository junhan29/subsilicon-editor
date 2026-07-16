import type { StoryGraph } from '@editor/types/editor'
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
}

export interface StoredWork extends WorkMetadata {
  editorData: StoryGraph
}

export async function saveWork(work: StoredWork): Promise<void> {
  const db = await openDB()
  const tx = db.transaction('works', 'readwrite')
  tx.objectStore('works').put(work)
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
