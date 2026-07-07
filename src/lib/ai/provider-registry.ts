import type { AiConfig, AiProviderConfig, AiRequestOptions, AiProvider, AiStreamResult } from './types'
import { OpenAiCompatibleProvider } from './providers/openai-compatible'
import { ollamaProvider } from './providers/ollama-provider'
import { initLocalModelConfig } from '../local-model-manager'

initLocalModelConfig()

let cachedConfig: AiConfig | null = null
let cachedProviders: AiProvider[] = []
let remoteProviders: OpenAiCompatibleProvider[] = []

function loadConfig(): AiConfig | null {
  try {
    const saved = localStorage.getItem('subsilicon_ai_config')
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

function buildProviders(config: AiConfig | null): AiProvider[] {
  const providers: AiProvider[] = []

  if (config?.enabled) {
    for (const p of config.providers) {
      if (p.enabled && p.apiKey) {
        providers.push(new OpenAiCompatibleProvider(p.id, p.name, p))
      }
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

export function getAiConfig(): AiConfig | null {
  if (!cachedConfig) {
    refreshProviders()
  }
  return cachedConfig
}

export function getActiveProvider(config?: AiConfig | null): AiProviderConfig | null {
  const cfg = config ?? getAiConfig()
  if (!cfg?.enabled) return null

  const provider = cfg.providers.find((p) => p.enabled)
  return provider || null
}

export function isAiAvailable(): boolean {
  const config = getAiConfig()
  if (!config?.enabled) return false

  const hasRemote = config.providers.some((p) => p.enabled && p.apiKey)
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
  throw new Error('请先配置 AI 服务商或启动本地 Ollama')
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
        const stream = provider.generateStream(options)
        const fullText = collectStream(stream)
        return { stream, fullText }
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
  throw new Error('请先配置 AI 服务商或启动本地 Ollama')
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
