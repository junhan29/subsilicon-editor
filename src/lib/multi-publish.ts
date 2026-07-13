import type { StoryGraph } from '@editor/types/editor'
import {
  listProviders,
  type SubmitProvider,
} from '@editor/lib/submit-providers'
import { exportPreviewHTML } from '@editor/lib/export-preview-html'
import { getAccount } from '@editor/lib/local-account-store'

export interface PublishRecord {
  id: string
  workId: string
  providerId: string
  providerName: string
  title: string
  status: 'pending' | 'publishing' | 'success' | 'failed'
  errorMessage?: string
  remoteWorkId?: string
  submittedAt: number
  updatedAt: number
}

export interface PublishTarget {
  providerId: string
  selected: boolean
}

const PUBLISH_RECORDS_KEY = 'subsilicon.publish.records.v1'
const PUBLISH_TARGETS_KEY = 'subsilicon.publish.targets.v1'

function generateId(): string {
  return `pub_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function loadPublishRecords(workId: string): PublishRecord[] {
  try {
    const raw = localStorage.getItem(PUBLISH_RECORDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PublishRecord[]
    return parsed.filter(r => r.workId === workId).sort((a, b) => b.submittedAt - a.submittedAt)
  } catch {
    return []
  }
}

export function loadAllPublishRecords(): PublishRecord[] {
  try {
    const raw = localStorage.getItem(PUBLISH_RECORDS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as PublishRecord[]
  } catch {
    return []
  }
}

function saveAllRecords(records: PublishRecord[]) {
  try {
    localStorage.setItem(PUBLISH_RECORDS_KEY, JSON.stringify(records))
  } catch {
    // ignore
  }
}

export function addPublishRecord(record: Omit<PublishRecord, 'id' | 'submittedAt' | 'updatedAt'>): PublishRecord {
  const now = Date.now()
  const newRecord: PublishRecord = {
    ...record,
    id: generateId(),
    submittedAt: now,
    updatedAt: now,
  }
  const all = loadAllPublishRecords()
  all.push(newRecord)
  saveAllRecords(all)
  return newRecord
}

export function updatePublishRecord(id: string, patch: Partial<PublishRecord>): void {
  const all = loadAllPublishRecords()
  const idx = all.findIndex(r => r.id === id)
  if (idx === -1) return
  all[idx] = { ...all[idx], ...patch, updatedAt: Date.now() }
  saveAllRecords(all)
}

export function loadPublishTargets(workId: string): PublishTarget[] {
  try {
    const raw = localStorage.getItem(`${PUBLISH_TARGETS_KEY}_${workId}`)
    if (!raw) {
      const providers = listProviders().filter(p => p.enabled)
      return providers.map(p => ({ providerId: p.id, selected: true }))
    }
    return JSON.parse(raw) as PublishTarget[]
  } catch {
    return []
  }
}

export function savePublishTargets(workId: string, targets: PublishTarget[]): void {
  try {
    localStorage.setItem(`${PUBLISH_TARGETS_KEY}_${workId}`, JSON.stringify(targets))
  } catch {
    // ignore
  }
}

export interface PublishOptions {
  title: string
  summary: string
  tags: string[]
  coverImage?: File | null
  screenshots?: { file: File; preview: string }[]
  contactInfo?: string
  externalLink?: string
}

export async function publishToProvider(
  provider: SubmitProvider,
  graph: StoryGraph,
  workId: string,
  options: PublishOptions
): Promise<{ success: boolean; remoteWorkId?: string; error?: string }> {
  const account = getAccount()
  if (!account) {
    return { success: false, error: '请先登录账号' }
  }

  try {
    const previewHtml = exportPreviewHTML(graph)
    const previewBlob = new Blob([previewHtml], { type: 'text/html;charset=utf-8' })

    const formData = new FormData()
    formData.append('creatorEmail', account.email)
    formData.append('creatorName', account.displayName)
    formData.append('creatorBio', account.bio || '')
    formData.append('title', options.title.trim())
    formData.append('summary', options.summary.trim())
    formData.append('tags', JSON.stringify(options.tags))
    if (options.coverImage) formData.append('coverImage', options.coverImage)
    if (options.screenshots) {
      options.screenshots.forEach((s, i) => {
        formData.append(`screenshot-${i}`, s.file)
      })
    }
    formData.append('contactInfo', options.contactInfo || '')
    formData.append('externalLink', options.externalLink || '')
    formData.append('previewHtml', previewBlob, 'preview.html')
    formData.append('workId', workId)

    const res = await fetch(provider.apiUrl, {
      method: 'POST',
      headers: {
        [provider.authHeader || 'X-Submit-Token']: provider.authToken || '',
      },
      body: formData,
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { success: false, error: data.message || `服务器响应异常（${res.status}）` }
    }

    const data = await res.json().catch(() => ({}))
    return {
      success: true,
      remoteWorkId: data.workId || data.id || undefined,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export interface MultiPublishResult {
  providerId: string
  providerName: string
  success: boolean
  error?: string
  recordId: string
}

export async function publishToMultiple(
  providerIds: string[],
  graph: StoryGraph,
  workId: string,
  options: PublishOptions,
  onProgress?: (providerId: string, status: 'publishing' | 'success' | 'failed', error?: string) => void
): Promise<MultiPublishResult[]> {
  const providers = listProviders().filter(p => providerIds.includes(p.id) && p.enabled)
  const results: MultiPublishResult[] = []

  for (const provider of providers) {
    const record = addPublishRecord({
      workId,
      providerId: provider.id,
      providerName: provider.name,
      title: options.title,
      status: 'publishing',
    })

    onProgress?.(provider.id, 'publishing')

    const result = await publishToProvider(provider, graph, workId, options)

    if (result.success) {
      updatePublishRecord(record.id, {
        status: 'success',
        remoteWorkId: result.remoteWorkId,
      })
      onProgress?.(provider.id, 'success')
    } else {
      updatePublishRecord(record.id, {
        status: 'failed',
        errorMessage: result.error,
      })
      onProgress?.(provider.id, 'failed', result.error)
    }

    results.push({
      providerId: provider.id,
      providerName: provider.name,
      success: result.success,
      error: result.error,
      recordId: record.id,
    })
  }

  return results
}

export function getPublishStats(workId: string): {
  total: number
  success: number
  failed: number
  pending: number
} {
  const records = loadPublishRecords(workId)
  const stats = { total: records.length, success: 0, failed: 0, pending: 0 }
  for (const r of records) {
    if (r.status === 'success') stats.success++
    else if (r.status === 'failed') stats.failed++
    else stats.pending++
  }
  return stats
}
