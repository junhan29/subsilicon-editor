import type { AiConfig } from '../../ai/types'
import { callAiForTask } from '../../ai/provider-registry'
import { getAsset } from '../../local-db'
import { getTaskSkillPrompt, resolveMediaProviderForTask, type MediaTaskType } from '../task-routing'
import { injectPrompt, injectReferenceImage, type ComfyWorkflow } from '../comfyui-workflow'
import { encryptApiKeyField, decryptApiKeyField } from '../ai-key-vault'
import type { ComicScene, StoryCharacter } from '@editor/types/editor'

export interface ImageGenerationParams {
  prompt: string
  negativePrompt?: string
  width?: number
  height?: number
  style?: 'anime' | 'realistic' | 'illustration' | 'pixel' | '3d'
  characterRef?: string
  /** 参考图素材 hash（ComfyUI IP-Adapter 一致性锚点）。在 ai-chat-panel 中由角色参考图自动填充。 */
  referenceImageHash?: string
}

export interface VideoGenerationParams {
  prompt: string
  imageUrl?: string
  duration?: number
  motionStrength?: number
}

export interface AudioGenerationParams {
  prompt: string
  /** 人声/音色提示（可选，部分 API 支持） */
  voice?: string
  /** 时长秒数（可选，部分 API 支持） */
  duration?: number
}

export interface MediaGenerationResult {
  url: string
  type: 'image' | 'video' | 'audio'
  prompt: string
  cleanup?: () => void // 用于释放 blob URL 内存
}

export interface MediaProviderConfig {
  type: 'openai' | 'stability' | 'comfyui' | 'wan' | 'custom'
  apiKey: string
  apiUrl?: string
  model?: string
  /** ComfyUI 专用：用户导出的工作流 JSON（API 格式）。编辑器会自动注入 prompt 和参考图。 */
  workflowJson?: string
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

// 调用 ComfyUI 生成图片：用户在工作流里预留 LoadImage + CLIPTextEncode 节点，编辑器自动注入参考图与 prompt
async function generateWithComfyUI(
  params: ImageGenerationParams,
  apiUrl: string,
  workflowJson?: string
): Promise<MediaGenerationResult> {
  if (!workflowJson) {
    throw new Error('ComfyUI 需要在创境设置中粘贴工作流 JSON（API 格式）。请在 ComfyUI 里 Save (API Format) 后粘贴。')
  }

  let workflow: ComfyWorkflow
  try {
    workflow = JSON.parse(workflowJson) as ComfyWorkflow
  } catch {
    throw new Error('工作流 JSON 解析失败，请确认是 ComfyUI 的 API 格式输出')
  }

  const base = apiUrl.replace(/\/+$/, '')

  // 1. 如果有参考图，上传到 ComfyUI 并注入 LoadImage 节点
  if (params.referenceImageHash) {
    const asset = await getAsset(params.referenceImageHash)
    if (asset) {
      const form = new FormData()
      form.append('image', asset.blob, `ref-${params.referenceImageHash.slice(0, 8)}.png`)
      const upResp = await fetch(`${base}/upload/image`, { method: 'POST', body: form })
      if (!upResp.ok) throw new Error(`ComfyUI 上传参考图失败: ${upResp.status}`)
      const upData = await upResp.json() as { name: string; subfolder?: string }
      const imageName = upData.subfolder ? `${upData.subfolder}/${upData.name}` : upData.name
      workflow = injectReferenceImage(workflow, imageName)
    }
  }

  // 2. 注入 prompt（优先 title 含 positive/正向 的 CLIPTextEncode）
  workflow = injectPrompt(workflow, params.prompt)

  // 3. 提交任务
  const promptResp = await fetch(`${base}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: 'subsilicon-editor' }),
  })
  if (!promptResp.ok) {
    const errText = await promptResp.text()
    throw new Error(`ComfyUI /prompt 失败: ${promptResp.status} ${errText.slice(0, 200)}`)
  }
  const promptData = await promptResp.json() as { prompt_id: string }
  const promptId = promptData.prompt_id

  // 4. 轮询 /history/{prompt_id}，最长等 180 秒
  const deadline = Date.now() + 180_000
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000))
    const histResp = await fetch(`${base}/history/${promptId}`)
    if (!histResp.ok) continue
    const hist = await histResp.json() as Record<string, unknown>
    const entry = hist[promptId] as
      | { outputs?: Record<string, { images?: Array<{ filename: string; subfolder?: string; type?: string }> }> }
      | undefined
    if (entry?.outputs) {
      const images: Array<{ filename: string; subfolder?: string; type?: string }> = []
      for (const v of Object.values(entry.outputs)) {
        if (v?.images) images.push(...v.images)
      }
      if (images.length > 0) {
        const img = images[0]
        const viewParams = new URLSearchParams({ filename: img.filename })
        if (img.subfolder) viewParams.set('subfolder', img.subfolder)
        if (img.type) viewParams.set('type', img.type)
        const viewResp = await fetch(`${base}/view?${viewParams.toString()}`)
        if (!viewResp.ok) throw new Error(`ComfyUI /view 失败: ${viewResp.status}`)
        const blob = await viewResp.blob()
        const url = URL.createObjectURL(blob)
        return { url, type: 'image' as const, prompt: params.prompt, cleanup: () => URL.revokeObjectURL(url) }
      }
    }
  }
  throw new Error('ComfyUI 生成超时（180s），请检查 ComfyUI 是否在运行、工作流是否有报错')
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

// 调用 OpenAI 兼容接口生成视频（用于 wan/custom 等供应商）
// 支持文生视频与图生视频（imageUrl）；兼容同步返回与异步任务轮询
async function generateVideoWithOpenAICompatible(
  params: VideoGenerationParams,
  apiUrl: string,
  apiKey: string,
  model: string = 'cogvideox-2b'
): Promise<MediaGenerationResult> {
  const base = apiUrl.replace(/\/+$/, '')
  const body: Record<string, unknown> = { model, prompt: params.prompt }
  if (params.imageUrl) body.image_url = params.imageUrl
  if (params.duration) body.duration = params.duration
  if (params.motionStrength != null) body.motion_strength = params.motionStrength

  const resp = await fetch(`${base}/videos/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  })
  if (!resp.ok) throw new Error(`视频 API 错误: ${await resp.text()}`)

  const data = await resp.json() as Record<string, unknown>
  // 同步返回
  const syncUrl = (data.data as Array<{ url?: string }> | undefined)?.[0]?.url
    || (data.url as string | undefined)
    || (data.video_url as string | undefined)
    || (data.output as Array<{ url?: string }> | undefined)?.[0]?.url
  if (syncUrl) return { url: syncUrl, type: 'video', prompt: params.prompt }

  // 异步任务：轮询
  const taskId = (data.task_id || data.id || data.request_id) as string | undefined
  if (!taskId) throw new Error('视频 API 未返回 url 或 task_id，无法继续')

  const deadline = Date.now() + 300_000 // 视频生成慢，等 5 分钟
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000))
    const poll = await fetch(`${base}/videos/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!poll.ok) continue
    const pd = await poll.json() as Record<string, unknown>
    const status = String(pd.status || pd.state || '').toLowerCase()
    if (['succeeded', 'completed', 'success'].includes(status)) {
      const url = (pd.video_url as string | undefined)
        || (pd.output as Array<{ url?: string }> | undefined)?.[0]?.url
        || (pd.result as { url?: string } | undefined)?.url
      if (url) return { url, type: 'video', prompt: params.prompt }
      throw new Error('视频生成完成但未返回 url')
    }
    if (['failed', 'error'].includes(status)) {
      throw new Error(`视频生成失败: ${pd.error || pd.message || '未知原因'}`)
    }
    // 其他状态（pending/processing/running）继续轮询
  }
  throw new Error('视频生成超时（5 分钟）')
}

// 调用 OpenAI 兼容接口生成音乐/音效/语音（用于 wan/custom 等供应商）
// 端点：POST {base}/audio/speech，返回音频字节流
async function generateAudioWithOpenAICompatible(
  params: AudioGenerationParams,
  apiUrl: string,
  apiKey: string,
  model: string = 'gpt-4o-mini-tts'
): Promise<MediaGenerationResult> {
  const base = apiUrl.replace(/\/+$/, '')
  const body: Record<string, unknown> = { model, input: params.prompt }
  if (params.voice) body.voice = params.voice

  const resp = await fetch(`${base}/audio/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  })
  if (!resp.ok) throw new Error(`音频 API 错误: ${await resp.text()}`)

  const blob = await resp.blob()
  const url = URL.createObjectURL(blob)
  return {
    url,
    type: 'audio' as const,
    prompt: params.prompt,
    cleanup: () => URL.revokeObjectURL(url),
  }
}

// 生成音频（音乐/音效/语音）
export async function generateAudio(
  params: AudioGenerationParams,
  provider: MediaProviderConfig
): Promise<MediaGenerationResult> {
  const resolved = await decryptApiKeyField(provider)
  if (resolved.type === 'comfyui') {
    throw new Error('ComfyUI 不支持音频生成，请选择 wan/custom 类型服务商')
  }
  if (resolved.type === 'openai' || resolved.type === 'stability') {
    // OpenAI/Stability 走各自官方音频端点；此处统一走 OpenAI 兼容格式
    return generateAudioWithOpenAICompatible(params, resolved.apiUrl || 'https://api.openai.com/v1', resolved.apiKey, resolved.model)
  }
  if (resolved.type === 'wan' || resolved.type === 'custom') {
    if (!resolved.apiUrl || !resolved.apiKey) {
      throw new Error(`${resolved.type} 供应商需要配置 apiUrl 和 apiKey`)
    }
    return generateAudioWithOpenAICompatible(params, resolved.apiUrl, resolved.apiKey, resolved.model)
  }
  throw new Error(`Unsupported provider type: ${resolved.type}`)
}

// 主生成函数
export async function generateMedia(
  params: ImageGenerationParams | VideoGenerationParams,
  provider: MediaProviderConfig
): Promise<MediaGenerationResult> {
  const isVideo = 'imageUrl' in params || 'duration' in params
  const resolved = await decryptApiKeyField(provider)
  // 视频生成仅支持 wan/custom（云端视频 API）
  if (isVideo && resolved.type !== 'wan' && resolved.type !== 'custom') {
    throw new Error('视频生成仅支持 wan/custom 类型服务商（云端视频 API），请在创境设置中配置')
  }

  switch (resolved.type) {
    case 'openai':
      return generateWithOpenAI(params as ImageGenerationParams, resolved.apiKey, resolved.model)
    case 'stability':
      return generateWithStability(params as ImageGenerationParams, resolved.apiKey, resolved.model)
    case 'comfyui':
      return generateWithComfyUI(params as ImageGenerationParams, resolved.apiUrl || 'http://localhost:8188', resolved.workflowJson)
    case 'wan':
    case 'custom': {
      if (!resolved.apiUrl || !resolved.apiKey) {
        throw new Error(`${resolved.type} 供应商需要配置 apiUrl 和 apiKey`)
      }
      if (isVideo) {
        return generateVideoWithOpenAICompatible(params as VideoGenerationParams, resolved.apiUrl, resolved.apiKey, resolved.model)
      }
      return generateWithOpenAICompatible(params as ImageGenerationParams, resolved.apiUrl, resolved.apiKey, resolved.model)
    }
    default:
      throw new Error(`Unsupported provider type: ${resolved.type}`)
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

  return callAiForTask('text',
    { systemPrompt, userPrompt, temperature: 0.7, maxTokens: 500 }
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

export async function saveMediaProviderConfig(config: MediaProviderConfig) {
  localStorage.setItem('subsilicon_media_provider', JSON.stringify(await encryptApiKeyField(config)))
}

// ---------- 任务路由（image / video / audio） ----------

/** 按任务取媒体生成配置：路由指定 > 旧版单一配置回退（仅 image/video） */
export function getMediaProviderConfigForTask(task: MediaTaskType): MediaProviderConfig | null {
  return resolveMediaProviderForTask(task, getMediaProviderConfig)
}

/**
 * 按任务路由生成媒体（image / video / audio 槽）。
 * 使用该任务槽配置的服务商；槽未配置时回退旧版媒体配置（仅 image/video）。
 * 槽的技能 prompt（skillPrompt）会自动拼接在生成 prompt 前。
 */
export async function generateMediaForTask(
  task: MediaTaskType,
  params: ImageGenerationParams | VideoGenerationParams | AudioGenerationParams
): Promise<MediaGenerationResult> {
  const provider = getMediaProviderConfigForTask(task)
  if (!provider) {
    throw new Error(
      task === 'image' ? '未配置图片生成服务商，请在创境设置中配置'
      : task === 'video' ? '未配置视频生成服务商，请在创境设置中配置'
      : '未配置音乐/音效生成服务商，请在创境设置中配置'
    )
  }
  const skill = getTaskSkillPrompt(task)
  const merged = skill
    ? { ...params, prompt: `${skill}。${params.prompt}` }
    : params

  if (task === 'audio') {
    return generateAudio(merged as AudioGenerationParams, provider)
  }
  return generateMedia(merged, provider)
}
