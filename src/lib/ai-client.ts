import { encryptString, decryptString } from './crypto-utils'

const STORAGE_KEY = 'subsilicon_ai_config'

export type AiProviderType = 'openai' | 'anthropic' | 'aliyun' | 'baidu' | 'tencent' | 'custom'

export interface AiProviderConfig {
  id: string
  name: string
  provider: AiProviderType
  apiKey: string
  apiUrl: string
  model: string
  enabled: boolean
}

export interface AiConfig {
  enabled: boolean
  providers: AiProviderConfig[]
  defaultProviderId: string
}

const DEFAULT_CONFIG: AiConfig = {
  enabled: false,
  providers: [],
  defaultProviderId: '',
}

export const PROVIDER_PRESETS: Record<AiProviderType, { name: string; apiUrl: string; defaultModel: string }> = {
  openai: { name: 'OpenAI', apiUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
  anthropic: { name: 'Anthropic', apiUrl: 'https://api.anthropic.com/v1', defaultModel: 'claude-3-sonnet-20240229' },
  aliyun: { name: '阿里云通义千问', apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-plus' },
  baidu: { name: '百度文心一言', apiUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop', defaultModel: 'ernie-4.0-turbo' },
  tencent: { name: '腾讯混元', apiUrl: 'https://api.hunyuan.tencent.com/v1', defaultModel: 'hunyuan-pro' },
  custom: { name: '自定义', apiUrl: '', defaultModel: 'gpt-4o-mini' },
}

export async function loadAiConfig(): Promise<AiConfig> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return { ...DEFAULT_CONFIG }
    const decrypted = await decryptString(stored)
    const config = JSON.parse(decrypted) as AiConfig
    return { ...DEFAULT_CONFIG, ...config }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export async function saveAiConfig(config: AiConfig): Promise<void> {
  const encrypted = await encryptString(JSON.stringify(config))
  localStorage.setItem(STORAGE_KEY, encrypted)
}

export async function testConnection(provider: AiProviderConfig): Promise<boolean> {
  try {
    const result = await chatCompletion(provider, [{ role: 'user', content: '回复"测试成功"' }], 10)
    return result.includes('测试成功') || result.length > 0
  } catch {
    return false
  }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function chatCompletion(
  provider: AiProviderConfig,
  messages: ChatMessage[],
  maxTokens = 1024,
  temperature = 0.7
): Promise<string> {
  const { apiUrl, apiKey, model, provider: providerType } = provider

  if (providerType === 'anthropic') {
    return callAnthropic(apiUrl, apiKey, model, messages, maxTokens, temperature)
  }

  return callOpenAICompatible(apiUrl, apiKey, model, messages, maxTokens, temperature)
}

async function callOpenAICompatible(
  apiUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  maxTokens: number,
  temperature: number
): Promise<string> {
  const response = await fetch(`${apiUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`API 请求失败 (${response.status}): ${text.slice(0, 100)}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new Error('API 响应格式异常')
  }
  return content.trim()
}

async function callAnthropic(
  apiUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  maxTokens: number,
  temperature: number
): Promise<string> {
  const systemMessages = messages.filter((m) => m.role === 'system')
  const nonSystem = messages.filter((m) => m.role !== 'system')

  const body: Record<string, unknown> = {
    model,
    messages: nonSystem,
    max_tokens: maxTokens,
    temperature,
  }
  if (systemMessages.length > 0) {
    body.system = systemMessages.map((m) => m.content).join('\n')
  }

  const response = await fetch(`${apiUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`API 请求失败 (${response.status}): ${text.slice(0, 100)}`)
  }

  const data = await response.json()
  const text = data.content?.[0]?.text
  if (typeof text !== 'string') {
    throw new Error('API 响应格式异常')
  }
  return text.trim()
}

export async function getActiveProvider(): Promise<AiProviderConfig | null> {
  const config = await loadAiConfig()
  if (!config.enabled || config.providers.length === 0) return null
  const active = config.providers.find((p) => p.id === config.defaultProviderId && p.enabled)
    || config.providers.find((p) => p.enabled)
  return active || null
}

export async function isAiConfigured(): Promise<boolean> {
  const provider = await getActiveProvider()
  return !!provider
}
