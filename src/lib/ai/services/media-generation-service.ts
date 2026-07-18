import type { AiConfig } from '../../ai/types'
import { callAi } from '../../ai/provider-registry'
import type { StoryCharacter, ComicScene } from '@editor/types/editor'

export interface ImageGenerationParams {
  prompt: string
  negativePrompt?: string
  width?: number
  height?: number
  style?: 'anime' | 'realistic' | 'illustration' | 'pixel' | '3d'
  characterRef?: string
}

export interface VideoGenerationParams {
  prompt: string
  imageUrl?: string
  duration?: number
  motionStrength?: number
}

export interface MediaGenerationResult {
  url: string
  type: 'image' | 'video'
  prompt: string
  cleanup?: () => void // 用于释放 blob URL 内存
}

export interface MediaProviderConfig {
  type: 'openai' | 'stability' | 'comfyui' | 'wan' | 'custom'
  apiKey: string
  apiUrl?: string
  model?: string
}

// 从角色信息生成一致性 prompt
export function generateCharacterPrompt(character: StoryCharacter): string {
  const parts: string[] = []

  if (character.appearance?.length) {
    parts.push(character.appearance.join(', '))
  }

  if (character.gender === 'male') parts.push('male character')
  else if (character.gender === 'female') parts.push('female character')

  if (character.age) parts.push(`${character.age} years old`)

  if (character.personality?.length) {
    parts.push(`personality: ${character.personality.join(', ')}`)
  }

  // 添加一致性标识符
  const consistencySeed = character.name.toLowerCase().replace(/\s+/g, '_')
  parts.push(`character_${consistencySeed}`)

  return parts.join(', ')
}

// 从场景信息生成 prompt
export function generateScenePrompt(scene: ComicScene, characters: StoryCharacter[]): string {
  const charPrompts = characters.map(generateCharacterPrompt).join('; ')
  return `${scene.name}, ${scene.style || ''}, featuring: ${charPrompts}`
}

// 构建带有一致性角色的图片生成 prompt
export function buildConsistentImagePrompt(
  basePrompt: string,
  characters: StoryCharacter[],
  style: string = 'anime'
): string {
  const charPrompts = characters.map(c => {
    const desc = generateCharacterPrompt(c)
    return `(${desc}:1.2)`
  }).join(', ')

  const stylePrompts: Record<string, string> = {
    anime: 'anime style, high quality, detailed, masterpiece',
    realistic: 'photorealistic, high quality, detailed, cinematic lighting',
    illustration: 'illustration, artstation, high quality, detailed',
    pixel: 'pixel art, retro game style, crisp pixels',
    '3d': '3D render, blender, octane render, high quality',
  }

  return `${basePrompt}, ${charPrompts}, ${stylePrompts[style] || stylePrompts.anime}`
}

// 调用 OpenAI DALL-E 生成图片
async function generateWithOpenAI(
  params: ImageGenerationParams,
  apiKey: string,
  model: string = 'dall-e-3'
): Promise<MediaGenerationResult> {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt: params.prompt,
      n: 1,
      size: `${params.width || 1024}x${params.height || 1024}`,
      quality: 'standard',
      response_format: 'url',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${error}`)
  }

  const data = await response.json()
  return {
    url: data.data[0].url,
    type: 'image',
    prompt: params.prompt,
  }
}

// 调用 Stability AI 生成图片
async function generateWithStability(
  params: ImageGenerationParams,
  apiKey: string,
  model: string = 'stable-image-core'
): Promise<MediaGenerationResult & { cleanup?: () => void }> {
  const response = await fetch(`https://api.stability.ai/v2beta/stable-image/generate/core`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'image/*',
    },
    body: JSON.stringify({
      prompt: params.prompt,
      negative_prompt: params.negativePrompt || '',
      width: params.width || 1024,
      height: params.height || 1024,
      output_format: 'webp',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Stability API error: ${error}`)
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)

  return {
    url,
    type: 'image',
    prompt: params.prompt,
    // 提供清理函数，调用方在不需要时应调用
    cleanup: () => URL.revokeObjectURL(url),
  }
}

// 调用 ComfyUI 生成图片/视频
async function generateWithComfyUI(
  params: ImageGenerationParams | VideoGenerationParams,
  apiUrl: string
): Promise<MediaGenerationResult> {
  // ComfyUI 集成需要完整的工作流配置，当前为占位实现
  throw new Error('ComfyUI 集成尚未完成。请使用 OpenAI DALL-E 或 Stability AI。')
}

// 调用 OpenAI 兼容接口生成图片（用于 wan/custom 等供应商）
async function generateWithOpenAICompatible(
  params: ImageGenerationParams,
  apiUrl: string,
  apiKey: string,
  model: string = 'dall-e-3'
): Promise<MediaGenerationResult> {
  const baseUrl = apiUrl.replace(/\/+$/, '')
  const response = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt: params.prompt,
      n: 1,
      size: `${params.width || 1024}x${params.height || 1024}`,
      response_format: 'url',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`API error: ${error}`)
  }

  const data = await response.json()
  return {
    url: data.data?.[0]?.url || data.url || '',
    type: 'image',
    prompt: params.prompt,
  }
}

// 主生成函数
export async function generateMedia(
  params: ImageGenerationParams | VideoGenerationParams,
  provider: MediaProviderConfig
): Promise<MediaGenerationResult> {
  switch (provider.type) {
    case 'openai':
      return generateWithOpenAI(params as ImageGenerationParams, provider.apiKey, provider.model)
    case 'stability':
      return generateWithStability(params as ImageGenerationParams, provider.apiKey, provider.model)
    case 'comfyui':
      return generateWithComfyUI(params, provider.apiUrl || 'http://localhost:8188')
    case 'wan':
    case 'custom':
      if (provider.apiUrl && provider.apiKey) {
        return generateWithOpenAICompatible(params as ImageGenerationParams, provider.apiUrl, provider.apiKey, provider.model)
      }
      throw new Error(`${provider.type} 供应商需要配置 apiUrl 和 apiKey`)
    default:
      throw new Error(`Unsupported provider type: ${provider.type}`)
  }
}

// 使用创境优化 prompt
export async function optimizePrompt(
  basePrompt: string,
  type: 'image' | 'video',
  style?: string,
  config?: AiConfig | null
): Promise<string> {
  const systemPrompt = `你是一位专业的创境绘画/视频提示词工程师。请将用户的简单描述转化为高质量的英文提示词。

要求：
1. 使用英文输出
2. 添加高质量、细节丰富的描述词
3. 包含风格、光影、构图等关键词
4. 输出纯提示词文本，不要添加解释
5. 控制在 200 词以内`

  const userPrompt = `类型：${type === 'image' ? '图片生成' : '视频生成'}\n风格：${style || '默认'}\n描述：${basePrompt}\n\n请优化为高质量提示词。`

  return callAi(
    { systemPrompt, userPrompt, temperature: 0.7, maxTokens: 500 },
    config
  )
}

// 获取本地存储的媒体生成配置
export function getMediaProviderConfig(): MediaProviderConfig | null {
  try {
    const saved = localStorage.getItem('subsilicon_media_provider')
    if (saved) {
      return JSON.parse(saved)
    }
  } catch {
    // ignore
  }
  return null
}

export function saveMediaProviderConfig(config: MediaProviderConfig) {
  localStorage.setItem('subsilicon_media_provider', JSON.stringify(config))
}
