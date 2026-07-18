import type { AiConfig, AiProviderConfig, AiRequestOptions, AiProvider, AiStreamResult } from './types'
import { OpenAiCompatibleProvider } from './providers/openai-compatible'
import { ollamaProvider } from './providers/ollama-provider'
import { initLocalModelConfig } from '../local-model-manager'

initLocalModelConfig()

let cachedConfig: AiConfig | null = null
let cachedProviders: AiProvider[] = []
let remoteProviders: OpenAiCompatibleProvider[] = []

/** FlatAiConfig 格式（来自 ai-settings-dialog / settings-page） */
type FlatishConfig = Record<string, unknown> & { enabled?: boolean }

function isFlatConfig(config: AiConfig | null): config is AiConfig & FlatishConfig {
  return !!(config && ((config as unknown) as FlatishConfig).apiKey)
}

function loadConfig(): AiConfig | null {
  try {
    const saved = localStorage.getItem('subsilicon_ai_config')
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

function flatToProviderConfig(cfg: AiConfig & FlatishConfig): AiProviderConfig {
  const providerId = (cfg.provider as string) || 'openai'
  return {
    id: providerId,
    name: providerId,
    provider: (cfg.provider as AiProviderConfig['provider']) || 'openai',
    enabled: true,
    apiKey: cfg.apiKey as string,
    apiUrl: cfg.apiUrl as string,
    model: cfg.model as string,
  }
}

function buildProviders(config: AiConfig | null): AiProvider[] {
  const providers: AiProvider[] = []

  if (config?.enabled) {
    // 兼容两种格式：
    // 1. AiConfig（含 providers 数组，来自 ai-settings-panel.tsx）
    // 2. FlatAiConfig（含单个 apiKey/apiUrl/model，来自 ai-settings-dialog.tsx / settings-page.tsx）
    if (Array.isArray(config.providers) && config.providers.length > 0) {
      for (const p of config.providers) {
        if (p.enabled && p.apiKey) {
          providers.push(new OpenAiCompatibleProvider(p.id, p.name, p))
        }
      }
    } else if (isFlatConfig(config)) {
      // FlatAiConfig 格式：转换为单个 provider
      const pc = flatToProviderConfig(config)
      providers.push(new OpenAiCompatibleProvider(pc.id, pc.name, pc))
    }
  }

  providers.push(ollamaProvider)
  return providers
}

function refreshProviders() {
  const config = loadConfig()
  cachedConfig = config
  cachedProviders = buildProviders(config)
  remoteProviders = cachedProviders.filter(
    (p): p is OpenAiCompatibleProvider => p.type === 'remote'
  )
}

export class AiConfigNeededError extends Error {
  needsConfig = true
  constructor() {
    super('请先配置创境服务商或启动本地 Ollama')
    this.name = 'AiConfigNeededError'
  }
}

export function getAiConfig(): AiConfig | null {
  if (!cachedConfig) {
    refreshProviders()
  }
  return cachedConfig
}

export function getActiveProvider(config?: AiConfig | null): AiProviderConfig | null {
  const cfg = config ?? getAiConfig()
  if (!cfg?.enabled) return null

  // 兼容 FlatAiConfig 格式
  if (isFlatConfig(cfg)) {
    return flatToProviderConfig(cfg)
  }

  // AiConfig 格式
  const provider = cfg.providers?.find((p) => p.enabled)
  return provider || null
}

export function isAiAvailable(): boolean {
  const config = getAiConfig()
  if (!config?.enabled) return false

  // 兼容 FlatAiConfig 格式
  if (isFlatConfig(config)) return true

  // AiConfig 格式
  const hasRemote = config.providers?.some((p) => p.enabled && p.apiKey)
  if (hasRemote) return true

  return false
}

export async function checkLocalAiAvailability(): Promise<boolean> {
  return ollamaProvider.isAvailable()
}

export async function callAi(options: AiRequestOptions, _config?: AiConfig | null): Promise<string> {
  if (!cachedConfig) {
    refreshProviders()
  }

  let lastError: unknown = null

  for (const provider of cachedProviders) {
    try {
      const available = await provider.isAvailable()
      if (!available) continue

      return await provider.generate(options)
    } catch (error) {
      lastError = error
      console.warn(`AI provider ${provider.name} failed, trying next:`, error)
    }
  }

  if (lastError) {
    throw lastError
  }
  throw new AiConfigNeededError()
}

export function getAvailableProviders(): AiProvider[] {
  if (!cachedConfig) {
    refreshProviders()
  }
  return [...cachedProviders]
}

export function refreshAiConfig() {
  refreshProviders()
}

export function resetAiRegistry() {
  cachedConfig = null
  cachedProviders = []
  remoteProviders = []
}

export async function callAiStream(options: AiRequestOptions, _config?: AiConfig | null): Promise<AiStreamResult> {
  if (!cachedConfig) {
    refreshProviders()
  }

  let lastError: unknown = null

  for (const provider of cachedProviders) {
    try {
      const available = await provider.isAvailable()
      if (!available) continue

      if (provider.generateStream) {
        const rawStream = provider.generateStream(options)
        // 不预先消耗流 — 用 bufferTee 实现同时收集全文和流式输出
        return bufferTee(rawStream)
      }

      const result = await provider.generate(options)
      const stream = fallbackStream(result)
      return { stream, fullText: Promise.resolve(result) }
    } catch (error) {
      lastError = error
      console.warn(`AI provider ${provider.name} failed, trying next:`, error)
    }
  }

  if (lastError) {
    throw lastError
  }
  throw new AiConfigNeededError()
}

/** 创建一个 tee：同时供流式消费和收集全文 */
function bufferTee(
  raw: AsyncGenerator<string, void, unknown>
): AiStreamResult {
  let fullText = ''
  let resolveFullText!: (text: string) => void
  const fullTextPromise = new Promise<string>((resolve) => {
    resolveFullText = resolve
  })

  const stream = (async function* () {
    try {
      for await (const chunk of raw) {
        fullText += chunk
        yield chunk
      }
    } finally {
      resolveFullText(fullText)
    }
  })()

  return { stream, fullText: fullTextPromise }
}

async function collectStream(stream: AsyncGenerator<string, void, unknown>): Promise<string> {
  let result = ''
  for await (const chunk of stream) {
    result += chunk
  }
  return result
}

async function* fallbackStream(text: string): AsyncGenerator<string, void, unknown> {
  const chunkSize = 3
  for (let i = 0; i < text.length; i += chunkSize) {
    yield text.slice(i, i + chunkSize)
    await new Promise((r) => setTimeout(r, 10))
  }
}
