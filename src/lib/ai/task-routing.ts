/**
 * AI 任务路由（Task Routing）
 *
 * 让不同创作任务使用不同的大模型 API，并可为每个任务槽植入技能（自定义 system prompt）与参数限制：
 * - editor：编辑器画布对话（AI 创作助理面板）
 * - text：文本生成（润色/大纲/角色/故事等）
 * - image：图片生成
 * - video：视频生成
 * - audio：音乐/音效生成
 *
 * 设计原则：**智能默认**——未配置任务路由时，所有任务回退到现有行为
 * （文本走第一个启用的 AI provider，图片/视频走旧版媒体配置），零成本迁移。
 */

import type { AiProviderConfig } from '@editor/types/ai'
import { encryptApiKeyField } from './ai-key-vault'
import type { MediaProviderConfig } from './services/media-generation-service'

/** 文本类任务槽 */
export interface TaskTextSlot {
  /** 指向 AiConfig.providers 中某个 provider 的 id；留空 = 智能默认（第一个启用 provider） */
  providerId?: string
  /** 覆盖该任务的采样温度 */
  temperature?: number
  /** 覆盖该任务的最大 token 数 */
  maxTokens?: number
  /** 技能：注入到 systemPrompt 末尾的自定义指令 */
  skillPrompt?: string
}

/** 媒体类任务槽 */
export interface TaskMediaSlot {
  /** 该任务的媒体生成配置；null/缺省 = 未配置 */
  media?: MediaProviderConfig | null
  /** 技能：媒体生成附加指令（如统一风格） */
  skillPrompt?: string
}

export interface AiTaskRoutingConfig {
  version: 1
  editor: TaskTextSlot
  text: TaskTextSlot
  image: TaskMediaSlot
  video: TaskMediaSlot
  audio: TaskMediaSlot
}

export type AiTaskType = keyof AiTaskRoutingConfig

export const TASK_ROUTING_KEY = 'subsilicon_ai_routing_v1'

/** 媒体类任务 */
export type MediaTaskType = 'image' | 'video' | 'audio'

const TEXT_TASKS = ['editor', 'text'] as const
const MEDIA_TASKS = ['image', 'video', 'audio'] as const

export function isMediaTask(task: AiTaskType): task is MediaTaskType {
  return (MEDIA_TASKS as readonly string[]).includes(task)
}

export function isTextTask(task: AiTaskType): task is 'editor' | 'text' {
  return (TEXT_TASKS as readonly string[]).includes(task)
}

/** 默认路由：全槽留空 = 智能默认 */
function defaultRouting(): AiTaskRoutingConfig {
  return {
    version: 1,
    editor: {},
    text: {},
    image: {},
    video: {},
    audio: {},
  }
}

/** 读取任务路由配置；不存在/解析失败时返回智能默认 */
export function getTaskRoutingConfig(): AiTaskRoutingConfig {
  if (typeof localStorage === 'undefined') return defaultRouting()
  try {
    const raw = localStorage.getItem(TASK_ROUTING_KEY)
    if (!raw) return defaultRouting()
    const parsed = JSON.parse(raw) as Partial<AiTaskRoutingConfig>
    if (parsed.version !== 1) return defaultRouting()
    const base = defaultRouting()
    for (const task of TEXT_TASKS) {
      base[task] = { ...(parsed[task] as TaskTextSlot | undefined) }
    }
    for (const task of MEDIA_TASKS) {
      base[task] = { ...(parsed[task] as TaskMediaSlot | undefined) }
    }
    return base
  } catch {
    return defaultRouting()
  }
}

/** 保存任务路由配置（媒体槽的 apiKey 落盘前 AES-256 加密） */
export async function saveTaskRoutingConfig(config: AiTaskRoutingConfig): Promise<void> {
  if (typeof localStorage === 'undefined') return
  try {
    const encrypted = { ...config }
    for (const task of ['image', 'video', 'audio'] as const) {
      const slot = encrypted[task] as TaskMediaSlot | undefined
      if (slot?.media?.apiKey) {
        const { apiKey } = await encryptApiKeyField(slot.media)
        slot.media = { ...slot.media, apiKey }
      }
    }
    localStorage.setItem(TASK_ROUTING_KEY, JSON.stringify(encrypted))
  } catch {
    // 忽略（隐私模式 / 配额超限）
  }
}

/** 重置任务路由为智能默认（不清除底层 provider/媒体配置） */
export function resetTaskRoutingConfig(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(TASK_ROUTING_KEY)
  } catch {
    // 忽略
  }
}

/** 文本类任务槽的 provider 选择：路由指定 > 智能默认（第一个启用 provider） */
export function resolveTextProviderForTask(
  task: 'editor' | 'text',
  getActiveProvider: () => AiProviderConfig | null
): AiProviderConfig | null {
  const routing = getTaskRoutingConfig()
  const slot = routing[task] as TaskTextSlot | undefined
  if (slot?.providerId) {
    // 若路由指定的 provider 已不存在（配置被删），回退智能默认
    const all = getTaskRoutingProviders()
    const found = all.find((p) => p.id === slot.providerId)
    if (found) return found
  }
  return getActiveProvider()
}

/** 读取当前所有启用的文本 provider（供路由 UI 选择） */
export function getTaskRoutingProviders(): AiProviderConfig[] {
  try {
    const saved = localStorage.getItem('subsilicon_ai_config')
    if (!saved) return []
    const config = JSON.parse(saved)
    if (Array.isArray(config.providers)) {
      return config.providers.filter((p: AiProviderConfig) => p.enabled && p.apiKey)
    }
    if (config.apiKey && config.enabled !== false) {
      return [{
        id: (config.provider as string) || 'openai',
        name: (config.provider as string) || 'openai',
        provider: (config.provider as AiProviderConfig['provider']) || 'openai',
        enabled: true,
        apiKey: config.apiKey,
        apiUrl: config.apiUrl,
        model: config.model,
      }]
    }
    return []
  } catch {
    return []
  }
}

/** 媒体类任务槽的配置：路由指定 > 回退旧版媒体配置（仅 image/video 兼容旧行为） */
export function resolveMediaProviderForTask(
  task: MediaTaskType,
  legacy: () => MediaProviderConfig | null
): MediaProviderConfig | null {
  const routing = getTaskRoutingConfig()
  const slot = routing[task] as TaskMediaSlot | undefined
  if (slot?.media) return slot.media
  // 旧版单一配置只对图片/视频生效（audio 从未有过旧配置）
  if (task === 'image' || task === 'video') return legacy()
  return null
}

/** 任务槽的技能 prompt（无则返回空串） */
export function getTaskSkillPrompt(task: AiTaskType): string {
  try {
    const routing = getTaskRoutingConfig()
    const slot = (routing as unknown as Record<string, unknown>)[task] as
      | (TaskTextSlot & TaskMediaSlot)
      | undefined
    return slot?.skillPrompt?.trim() || ''
  } catch {
    return ''
  }
}
