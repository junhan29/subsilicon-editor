import { setOllamaConfig, getOllamaConfig } from './local-ai-service'

export interface LocalModelInfo {
  name: string
  displayName: string
  provider: string
  size: number
  sizeFormatted: string
  description: string
  recommended: boolean
  category: 'general' | 'creative' | 'small' | 'large'
  parameters: string
}

export interface ModelDownloadStatus {
  modelName: string
  status: 'pending' | 'downloading' | 'completed' | 'error'
  progress: number
  totalBytes: number
  downloadedBytes: number
  speed: number
  eta: string
  error?: string
}

export interface OllamaModel {
  name: string
  model: string
  modified_at: string
  size: number
  digest: string
}

export const RECOMMENDED_MODELS: LocalModelInfo[] = [
  {
    name: 'deepseek-chat',
    displayName: 'DeepSeek Chat',
    provider: 'DeepSeek',
    size: 13,
    sizeFormatted: '~13 GB',
    description: '适合中文对话和创意写作，性能均衡',
    recommended: true,
    category: 'general',
    parameters: '7B',
  },
  {
    name: 'llama3',
    displayName: 'Llama 3',
    provider: 'Meta',
    size: 4.7,
    sizeFormatted: '~4.7 GB',
    description: '开源模型标杆，多语言支持好',
    recommended: true,
    category: 'small',
    parameters: '8B',
  },
  {
    name: 'qwen2',
    displayName: 'Qwen 2',
    provider: '阿里',
    size: 3.5,
    sizeFormatted: '~3.5 GB',
    description: '中文优化，体积小巧，适合低配设备',
    recommended: true,
    category: 'small',
    parameters: '7B',
  },
  {
    name: 'mistral',
    displayName: 'Mistral',
    provider: 'Mistral',
    size: 4.1,
    sizeFormatted: '~4.1 GB',
    description: '推理速度快，响应流畅',
    recommended: false,
    category: 'general',
    parameters: '7B',
  },
  {
    name: 'gemma',
    displayName: 'Gemma',
    provider: 'Google',
    size: 2.5,
    sizeFormatted: '~2.5 GB',
    description: 'Google 开源模型，适合轻量级任务',
    recommended: false,
    category: 'small',
    parameters: '7B',
  },
  {
    name: 'llama3:70b',
    displayName: 'Llama 3 70B',
    provider: 'Meta',
    size: 35,
    sizeFormatted: '~35 GB',
    description: '大模型，效果接近GPT-4，但需要高配置设备',
    recommended: false,
    category: 'large',
    parameters: '70B',
  },
]

const OLLAMA_BASE_URL = 'http://localhost:11434'

export async function isOllamaRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function listInstalledModels(): Promise<OllamaModel[]> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`)
    if (!response.ok) return []
    
    const data = await response.json()
    return data.models || []
  } catch {
    return []
  }
}

export async function downloadModel(
  modelName: string,
  onProgress?: (status: ModelDownloadStatus) => void
): Promise<void> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/pull`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: modelName, stream: true }),
  })

  if (!response.ok) {
    throw new Error(`下载失败: ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('响应体不可读')
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let startTime = Date.now()
  let totalBytes = 0
  let downloadedBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue

        try {
          const data = JSON.parse(line)
          
          if (data.status === 'downloading') {
            totalBytes = data.total || totalBytes
            downloadedBytes = data.completed || downloadedBytes
            
            const elapsed = (Date.now() - startTime) / 1000
            const speed = elapsed > 0 ? downloadedBytes / elapsed : 0
            
            const progress = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0
            const remaining = totalBytes - downloadedBytes
            const eta = speed > 0 ? formatDuration(remaining / speed) : '--:--'

            onProgress?.({
              modelName,
              status: 'downloading',
              progress,
              totalBytes,
              downloadedBytes,
              speed,
              eta,
            })
          } else if (data.status === 'success') {
            onProgress?.({
              modelName,
              status: 'completed',
              progress: 100,
              totalBytes: downloadedBytes,
              downloadedBytes,
              speed: 0,
              eta: '00:00',
            })
          } else if (data.error) {
            onProgress?.({
              modelName,
              status: 'error',
              progress: 0,
              totalBytes: 0,
              downloadedBytes: 0,
              speed: 0,
              eta: '--:--',
              error: data.error,
            })
            throw new Error(data.error)
          }
        } catch {
          // 忽略解析错误
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export async function deleteModel(modelName: string): Promise<void> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/delete`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: modelName }),
  })

  if (!response.ok) {
    throw new Error(`删除失败: ${response.status}`)
  }
}

export async function useModel(modelName: string): Promise<void> {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('subsilicon_local_model', modelName)
  }
  setOllamaConfig({ model: modelName })
}

export function getCurrentModel(): string {
  if (typeof localStorage === 'undefined') return 'deepseek-chat'
  return localStorage.getItem('subsilicon_local_model') || 'deepseek-chat'
}

export function initLocalModelConfig(): void {
  if (typeof localStorage === 'undefined') return
  const savedModel = localStorage.getItem('subsilicon_local_model')
  if (savedModel) {
    setOllamaConfig({ model: savedModel })
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function getModelInfo(modelName: string): LocalModelInfo | undefined {
  return RECOMMENDED_MODELS.find((m) => m.name === modelName)
}
