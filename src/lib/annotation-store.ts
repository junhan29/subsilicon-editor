import type { NodeAnnotation, AnnotationType, AnnotationReply } from '@editor/types/editor'

const STORAGE_KEY_PREFIX = 'subsilicon-annotations-'
const FALLBACK_WORK_ID = 'default'
const AUTHOR_KEY = 'subsilicon-annotation-author'
const DEFAULT_AUTHOR = '匿名创作者'

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function storageKey(workId: string): string {
  return `${STORAGE_KEY_PREFIX}${workId || FALLBACK_WORK_ID}`
}

function isAnnotation(value: unknown): value is NodeAnnotation {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.nodeId === 'string' &&
    (typeof v.type === 'string') &&
    typeof v.text === 'string' &&
    typeof v.author === 'string' &&
    typeof v.createdAt === 'number' &&
    typeof v.resolved === 'boolean'
  )
}

export function getAnnotationAuthor(): string {
  if (!isBrowser()) return DEFAULT_AUTHOR
  try {
    return window.localStorage.getItem(AUTHOR_KEY) || DEFAULT_AUTHOR
  } catch {
    return DEFAULT_AUTHOR
  }
}

export function setAnnotationAuthor(name: string): void {
  if (!isBrowser()) return
  const trimmed = (name || '').trim()
  if (!trimmed) return
  try {
    window.localStorage.setItem(AUTHOR_KEY, trimmed)
  } catch {
  }
}

export function loadAnnotations(workId: string): NodeAnnotation[] {
  if (!isBrowser()) return []
  try {
    const raw = window.localStorage.getItem(storageKey(workId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isAnnotation) as NodeAnnotation[]
  } catch {
    return []
  }
}

export function saveAnnotations(workId: string, annotations: NodeAnnotation[]): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(storageKey(workId), JSON.stringify(annotations))
  } catch {
  }
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export interface NewAnnotationInput {
  nodeId: string
  type: AnnotationType
  text: string
  author?: string
}

export function addAnnotation(workId: string, input: NewAnnotationInput): NodeAnnotation[] {
  const annotations = loadAnnotations(workId)
  const annotation: NodeAnnotation = {
    id: genId('anno'),
    nodeId: input.nodeId,
    type: input.type,
    text: input.text.trim(),
    author: input.author || getAnnotationAuthor(),
    createdAt: Date.now(),
    resolved: false,
    replies: [],
  }
  annotations.push(annotation)
  saveAnnotations(workId, annotations)
  return annotations
}

export function updateAnnotation(
  workId: string,
  id: string,
  patch: Partial<Omit<NodeAnnotation, 'id' | 'nodeId'>>
): NodeAnnotation[] {
  const annotations = loadAnnotations(workId)
  const result = annotations.map((a) => (a.id === id ? { ...a, ...patch } : a))
  saveAnnotations(workId, result)
  return result
}

export function deleteAnnotation(workId: string, id: string): NodeAnnotation[] {
  const annotations = loadAnnotations(workId).filter((a) => a.id !== id)
  saveAnnotations(workId, annotations)
  return annotations
}

export function getAnnotationsByNode(workId: string, nodeId: string): NodeAnnotation[] {
  return loadAnnotations(workId).filter((a) => a.nodeId === nodeId)
}

export function getAnnotationsMap(workId: string): Map<string, NodeAnnotation[]> {
  const map = new Map<string, NodeAnnotation[]>()
  for (const annotation of loadAnnotations(workId)) {
    const list = map.get(annotation.nodeId)
    if (list) {
      list.push(annotation)
    } else {
      map.set(annotation.nodeId, [annotation])
    }
  }
  return map
}

export function addReply(
  workId: string,
  annotationId: string,
  text: string,
  author?: string
): NodeAnnotation[] {
  const annotations = loadAnnotations(workId)
  const reply: AnnotationReply = {
    id: genId('reply'),
    text: text.trim(),
    author: author || getAnnotationAuthor(),
    createdAt: Date.now(),
  }
  const result = annotations.map((a) =>
    a.id === annotationId
      ? { ...a, replies: [...(a.replies || []), reply] }
      : a
  )
  saveAnnotations(workId, result)
  return result
}

export function deleteAnnotationsByNode(workId: string, nodeId: string): NodeAnnotation[] {
  const remaining = loadAnnotations(workId).filter((a) => a.nodeId !== nodeId)
  saveAnnotations(workId, remaining)
  return remaining
}

export function resolveAllByNode(workId: string, nodeId: string): NodeAnnotation[] {
  const result = loadAnnotations(workId).map((a) =>
    a.nodeId === nodeId ? { ...a, resolved: true } : a
  )
  saveAnnotations(workId, result)
  return result
}
