const DEFAULT_SOURCES = [
  'https://subsilicon.cn/api/templates/index.json',
  'https://subsilicon.github.io/template-index/index.json',
]

const CACHE_KEY = 'subsilicon-template-index-cache'
const SOURCE_KEY = 'subsilicon-index-sources'

function getConfiguredSources(): string[] {
  if (typeof window === 'undefined') return DEFAULT_SOURCES
  try {
    const saved = localStorage.getItem(SOURCE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return DEFAULT_SOURCES
}

function loadCachedIndex(): any {
  if (typeof window === 'undefined') return null
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    return cached ? JSON.parse(cached) : null
  } catch {
    return null
  }
}

function saveCachedIndex(index: any): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data: index,
      cachedAt: Date.now(),
    }))
  } catch {}
}

export interface IndexFetchResult {
  index: any | null
  source: string
  fallbackUsed: boolean
  error?: string
}

// Try sources in order, fall through on failure
export async function fetchTemplateIndex(): Promise<IndexFetchResult> {
  const sources = getConfiguredSources()

  for (let i = 0; i < sources.length; i++) {
    const url = sources[i]
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
      if (res.ok) {
        const index = await res.json()
        saveCachedIndex(index)
        return {
          index,
          source: url,
          fallbackUsed: i > 0,
        }
      }
    } catch {
      console.warn(`Template index source ${url} failed, trying next...`)
      continue
    }
  }

  // All online sources failed — try local cache
  const cached = loadCachedIndex()
  if (cached?.data) {
    return {
      index: cached.data,
      source: 'local-cache',
      fallbackUsed: true,
      error: '无法连接到索引服务器，显示本地缓存',
    }
  }

  return {
    index: null,
    source: '',
    fallbackUsed: true,
    error: '无法连接到索引服务器，且无本地缓存',
  }
}

export function getIndexSources(): string[] {
  return getConfiguredSources()
}

export function setIndexSources(sources: string[]): void {
  try {
    localStorage.setItem(SOURCE_KEY, JSON.stringify(sources))
  } catch {}
}

export function resetIndexSources(): void {
  try {
    localStorage.removeItem(SOURCE_KEY)
  } catch {}
}
