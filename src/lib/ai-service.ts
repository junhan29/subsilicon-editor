/**
 * AI 服务模块
 * 
 * 为下载版编辑器提供 AI 功能，用户自备 API 密钥
 */

import type { AiConfig, AiProviderConfig } from '@editor/components/editor/ai-settings-panel'

export interface AiPolishResult {
  result: string
  remaining?: number
  limit?: number
}

export interface AiLayoutResult {
  result: string
  remaining?: number
  limit?: number
}

export interface AiGenerateResult {
  result: string
}

// 获取当前配置
export function getAiConfig(): AiConfig | null {
  try {
    const saved = localStorage.getItem('subsilicon_ai_config')
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

// 获取启用的服务商
export function getActiveProvider(config?: AiConfig): AiProviderConfig | null {
  if (!config) config = getAiConfig() || undefined
  if (!config?.enabled) return null
  
  const provider = config.providers.find(p => p.enabled)
  if (!provider) return null
  
  return provider
}

// 检查 AI 是否可用
export function isAiAvailable(): boolean {
  const config = getAiConfig()
  if (!config?.enabled) return false
  
  const provider = getActiveProvider(config)
  return !!provider?.apiKey
}

// 调用 AI 润色
export async function polishText(
  text: string,
  style: 'general' | 'vivid' | 'concise' | 'literary' = 'general',
  config?: AiConfig
): Promise<AiPolishResult> {
  const provider = getActiveProvider(config)
  if (!provider) {
    throw new Error('请先配置 AI 服务商')
  }

  const stylePrompts: Record<string, string> = {
    general: '请润色以下文字，使表达更流畅自然，保持原意：',
    vivid: '请将以下文字润色得更加生动形象，富有感染力，保持原意：',
    concise: '请精简以下文字，使表达更简洁有力，保持核心意思：',
    literary: '请用文学化的风格润色以下文字，增加文采，保持原意：',
  }

  const systemPrompt = stylePrompts[style] || stylePrompts.general

  const response = await fetch(`${provider.apiUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`AI 润色失败：${errorText.slice(0, 100)}`)
  }

  const data = await response.json()
  return {
    result: data.choices?.[0]?.message?.content || '',
  }
}

// 调用 AI 排版
export async function layoutText(
  text: string,
  layoutType: 'dialogue' | 'narrative' | 'mixed' = 'dialogue',
  config?: AiConfig
): Promise<AiLayoutResult> {
  const provider = getActiveProvider(config)
  if (!provider) {
    throw new Error('请先配置 AI 服务商')
  }

  const layoutPrompts: Record<string, string> = {
    dialogue: '请将以下内容排版成对话剧本格式，每行一个角色说话，用"角色名：内容"的格式，保持原意：',
    narrative: '请将以下内容排版成叙事文本格式，分段清晰，增加适当的描写，保持原意：',
    mixed: '请将以下内容排版成对话与叙事结合的剧本格式，合理分配对话和旁白，保持原意：',
  }

  const systemPrompt = layoutPrompts[layoutType] || layoutPrompts.dialogue

  const response = await fetch(`${provider.apiUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      temperature: 0.5,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`AI 排版失败：${errorText.slice(0, 100)}`)
  }

  const data = await response.json()
  return {
    result: data.choices?.[0]?.message?.content || '',
  }
}

// 调用 AI 续写
export async function continueText(
  text: string,
  style: 'general' | 'vivid' | 'concise' | 'literary' = 'general',
  config?: AiConfig
): Promise<AiGenerateResult> {
  const provider = getActiveProvider(config)
  if (!provider) {
    throw new Error('请先配置 AI 服务商')
  }

  const stylePrompts: Record<string, string> = {
    general: '请继续续写以下文字，保持风格一致，约 100 字：',
    vivid: '请继续续写以下文字，保持生动风格，约 100 字：',
    concise: '请继续续写以下文字，保持简洁风格，约 80 字：',
    literary: '请继续续写以下文字，保持文学风格，约 120 字：',
  }

  const systemPrompt = stylePrompts[style] || stylePrompts.general

  const response = await fetch(`${provider.apiUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      temperature: 0.8,
      max_tokens: 200,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`AI 续写失败：${errorText.slice(0, 100)}`)
  }

  const data = await response.json()
  return {
    result: data.choices?.[0]?.message?.content || '',
  }
}

// 调用 AI 生成角色描述
export async function generateCharacter(
  name: string,
  personality: string,
  config?: AiConfig
): Promise<AiGenerateResult> {
  const provider = getActiveProvider(config)
  if (!provider) {
    throw new Error('请先配置 AI 服务商')
  }

  const systemPrompt = `请根据以下信息生成一个角色的详细描述，包括外貌、性格、背景故事，约 150 字：`

  const response = await fetch(`${provider.apiUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `角色名：${name}\n性格特点：${personality}` },
      ],
      temperature: 0.7,
      max_tokens: 300,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`AI 生成角色失败：${errorText.slice(0, 100)}`)
  }

  const data = await response.json()
  return {
    result: data.choices?.[0]?.message?.content || '',
  }
}

// 调用 AI 生成场景描述
export async function generateScene(
  location: string,
  atmosphere: string,
  config?: AiConfig
): Promise<AiGenerateResult> {
  const provider = getActiveProvider(config)
  if (!provider) {
    throw new Error('请先配置 AI 服务商')
  }

  const systemPrompt = `请根据以下信息生成一个场景的详细描述，包括环境、氛围、细节，约 100 字：`

  const response = await fetch(`${provider.apiUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `地点：${location}\n氛围：${atmosphere}` },
      ],
      temperature: 0.7,
      max_tokens: 200,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`AI 生成场景失败：${errorText.slice(0, 100)}`)
  }

  const data = await response.json()
  return {
    result: data.choices?.[0]?.message?.content || '',
  }
}