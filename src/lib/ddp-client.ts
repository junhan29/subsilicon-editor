export interface DDPSummary {
  workId: string
  title: string
  summary: string
  tags: string[]
  coverImage: string
  creatorName: string
  creatorId?: string
  monetizationType: 'free' | 'paid' | 'donation'
  price?: number
  currency?: string
  stats?: {
    nodeCount: number
    endingCount: number
    estimatedReadTime?: number
  }
  publishedAt: number
  directoryId: string
  directoryName: string
  workUrl?: string
}

export interface DDPWorkDetail {
  protocolVersion: string
  workId: string
  title: string
  summary: string
  description?: string
  tags: string[]
  genre?: string
  language?: string
  creator: {
    id: string
    name: string
    bio?: string
    avatar?: string
    contact?: Record<string, string>
    externalLinks?: Array<{ type: string; url: string }>
  }
  coverImage: string
  screenshots?: string[]
  stats: {
    nodeCount: number
    endingCount: number
    estimatedReadTime?: number
    wordCount?: number
  }
  monetization: {
    type: 'free' | 'paid' | 'donation'
    price?: number
    currency?: string
    paymentMethods?: Array<Record<string, unknown>>
  }
  content: {
    type: string
    url: string
    fileSize?: number
    hash?: string
  }
  preview?: {
    type: string
    url: string
    previewNodes?: string[]
  }
  publishedAt: number
  updatedAt: number
  version?: string
  directoryId: string
  directoryName: string
}

export interface DDPSource {
  id: string
  name: string
  url: string
  type: 'official' | 'personal' | 'community'
  submitToken?: string
  enabled: boolean
}

export interface DDPListParams {
  page?: number
  limit?: number
  tag?: string
  search?: string
  sort?: 'newest' | 'popular' | 'random'
  creatorId?: string
}

export interface DDPListResponse {
  works: DDPSummary[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

const STORAGE_KEY = 'subsilicon.ddp.sources'

const defaultSources: DDPSource[] = [
  {
    id: 'subsilicon-official',
    name: 'SubSilicon 官方名录',
    url: 'https://subsilicon.cn/api',
    type: 'official',
    enabled: true,
  },
]

export function listDdpSources(): DDPSource[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch {
    // ignore
  }
  saveDdpSources(defaultSources)
  return [...defaultSources]
}

export function saveDdpSources(sources: DDPSource[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sources))
}

export function addDdpSource(source: Omit<DDPSource, 'id' | 'enabled'> & { enabled?: boolean }): DDPSource {
  const sources = listDdpSources()
  const newSource: DDPSource = {
    ...source,
    id: source.id || `ddp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    enabled: source.enabled ?? true,
  }
  sources.push(newSource)
  saveDdpSources(sources)
  return newSource
}

export function updateDdpSource(id: string, updates: Partial<DDPSource>): void {
  const sources = listDdpSources()
  const idx = sources.findIndex(s => s.id === id)
  if (idx !== -1) {
    sources[idx] = { ...sources[idx], ...updates }
    saveDdpSources(sources)
  }
}

export function removeDdpSource(id: string): void {
  const sources = listDdpSources().filter(s => s.id !== id)
  saveDdpSources(sources)
}

export async function fetchWorksFromSource(
  source: DDPSource,
  params: DDPListParams
): Promise<DDPListResponse> {
  const url = new URL(`${source.url.replace(/\/$/, '')}/works`)
  if (params.page !== undefined) url.searchParams.set('page', String(params.page))
  if (params.limit !== undefined) url.searchParams.set('limit', String(params.limit))
  if (params.tag) url.searchParams.set('tag', params.tag)
  if (params.search) url.searchParams.set('search', params.search)
  if (params.sort) url.searchParams.set('sort', params.sort)
  if (params.creatorId) url.searchParams.set('creatorId', params.creatorId)

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    throw new Error(`请求失败: ${res.status}`)
  }

  const data = await res.json()
  if (!data.success || !data.data) {
    throw new Error('响应格式错误')
  }

  const works: DDPSummary[] = (data.data.works || []).map((w: Record<string, unknown>) => ({
    ...w,
    directoryId: source.id,
    directoryName: source.name,
  }))

  return {
    works,
    total: data.data.total || works.length,
    page: data.data.page || params.page || 1,
    limit: data.data.limit || params.limit || 20,
    hasMore: data.data.hasMore !== undefined ? data.data.hasMore : false,
  }
}

export async function fetchWorksFederated(
  params: DDPListParams,
  sourceIds?: string[]
): Promise<DDPSummary[]> {
  const sources = listDdpSources().filter(s => s.enabled && (!sourceIds || sourceIds.includes(s.id)))
  
  if (sources.length === 0) {
    return []
  }

  const promises = sources.map(async source => {
    try {
      const result = await fetchWorksFromSource(source, params)
      return result.works
    } catch (err) {
      console.warn(`Failed to fetch from ${source.name}:`, err)
      return []
    }
  })

  const results = await Promise.all(promises)
  const allWorks = results.flat()

  const seen = new Set<string>()
  const unique: DDPSummary[] = []
  for (const work of allWorks) {
    const key = `${work.directoryId}:${work.workId}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(work)
    }
  }

  if (params.sort === 'newest' || !params.sort) {
    unique.sort((a, b) => b.publishedAt - a.publishedAt)
  } else if (params.sort === 'popular') {
    // 保留原排序
  }

  return unique
}

export async function fetchWorkDetail(
  source: DDPSource,
  workId: string
): Promise<DDPWorkDetail> {
  const url = `${source.url.replace(/\/$/, '')}/works/${encodeURIComponent(workId)}`
  
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!res.ok) {
    throw new Error(`请求失败: ${res.status}`)
  }

  const data = await res.json()
  if (!data.success || !data.data) {
    throw new Error('响应格式错误')
  }

  return {
    ...data.data,
    directoryId: source.id,
    directoryName: source.name,
  }
}

export async function fetchTagsFromSource(source: DDPSource): Promise<Array<{ name: string; count: number }>> {
  const url = `${source.url.replace(/\/$/, '')}/tags`
  
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) return []
    const data = await res.json()
    if (data.success && data.data?.tags) {
      return data.data.tags
    }
    return []
  } catch {
    return []
  }
}
