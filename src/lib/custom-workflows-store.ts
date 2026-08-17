/**
 * 创作者自定义工作流（Skill）——允许创作者为 生图 / 生视频 / 生文字
 * 任务保存一套可复用的「系统提示词 + 参数默认值」，在任何生成入口一键套用。
 *
 * 设计要点：
 *  1. 纯前端、localStorage 持久化（KEY_VERSION，升级可兼容迁移）
 *  2. 3 类任务槽共享同一套 CRUD 结构：image / video / text
 *  3. 内置 3 条不可删模板（角色立绘一致性 / 短视频运镜 / 悬念铺陈正文），
 *     用于降低用户上手门槛；自定义工作流可任意增删改
 *  4. 返回类型字段带 taskType 联合，确保 TS 下按类型区分图像专享字段 / 文本专享字段
 */

import type { VideoAspectRatio } from './ai/services/media-generation-service'

const STORAGE_KEY = 'subsilicon-custom-workflows:v1'

/** 工作流绑定的任务槽 */
export type WorkflowTaskType = 'image' | 'video' | 'text'

/** 媒体类（图/视频）共享的默认参数 */
export interface WorkflowMediaDefaults {
  /** 画面风格：动漫 / 写实 / 插画 / 像素 / 3d / 自定义字符串 */
  style?: string
  /** 固定随机种子（0 视为「不锁」，undefined 也代表不锁） */
  seedLock?: number
  /** 视频专享：画幅比例 */
  ratio?: VideoAspectRatio
  /** 视频专享：时长（秒） */
  durationSec?: number
  /** 技能指令：拼接到生成 prompt 前（图片/视频），或作为 skillPrompt 注入（文本） */
  skillPrompt?: string
}

/** 文本类（小说正文/大纲/对白）默认参数 */
export interface WorkflowTextDefaults {
  temperature?: number
  maxTokens?: number
  /** 风格关键词：逗号分隔，拼接到系统提示词中保持文风一致 */
  styleKeywords?: string
  /** 系统提示词：覆盖或追加到该任务默认 system prompt 之上 */
  systemPrompt?: string
}

/** 自定义工作流（Skill）实体 */
export interface CustomWorkflow {
  id: string
  /** 展示名（≤ 24 字符） */
  name: string
  /** 简短说明，用于 UI hint */
  description?: string
  taskType: WorkflowTaskType
  /** 是否是内置模板：内置不可改名、不可删除（但可以克隆覆盖） */
  builtin?: boolean
  /** 内置模板唯一 key（仅当 builtin=true 时存在），用于升级合并时去重 */
  builtinKey?: string
  createdAt: number
  updatedAt: number

  // —— 根据 taskType 取对应分桶 ——
  media?: WorkflowMediaDefaults
  text?: WorkflowTextDefaults
}

interface StoragePayload {
  version: 1
  items: CustomWorkflow[]
}

/* -------------------------------------------------------------------------- */
/*                                   内置模板                                 */
/* -------------------------------------------------------------------------- */

const BUILTIN_KEYS = {
  characterAnchor: 'builtin:image:character-anchor',
  shortVideoCinema: 'builtin:video:short-cinema',
  suspenseBody: 'builtin:text:suspense-body',
} as const

function builtinTemplates(): CustomWorkflow[] {
  const now = Date.now()
  return [
    {
      id: 'wf-image-character-anchor',
      name: '角色立绘·一致性优先',
      description: '复用参考图锚点 + 固定 seed，保证同一个角色跨章节长相稳定',
      taskType: 'image',
      builtin: true,
      builtinKey: BUILTIN_KEYS.characterAnchor,
      createdAt: now,
      updatedAt: now,
      media: {
        style: 'anime',
        skillPrompt: '人物五官、脸型、发型、瞳色严格与参考图锚点保持一致；不改变面部特征；光线与背景可随场景微调。',
      },
    },
    {
      id: 'wf-video-short-cinema',
      name: '短视频·电影感运镜',
      description: '16:9 / 5s，节奏慢中带推镜，适配过场 CG 转视频',
      taskType: 'video',
      builtin: true,
      builtinKey: BUILTIN_KEYS.shortVideoCinema,
      createdAt: now,
      updatedAt: now,
      media: {
        style: 'realistic',
        ratio: '16:9',
        durationSec: 5,
        skillPrompt: '电影感 2.39:1 构图，浅景深，轻微推镜（dolly-in），镜头稳定不晃；自然光色温；情绪随剧情推进。',
      },
    },
    {
      id: 'wf-text-suspense-body',
      name: '正文·悬念铺陈大师',
      description: '短句多段、信息分批释放，结尾留钩子推动下一章',
      taskType: 'text',
      builtin: true,
      builtinKey: BUILTIN_KEYS.suspenseBody,
      createdAt: now,
      updatedAt: now,
      text: {
        temperature: 0.78,
        maxTokens: 1200,
        styleKeywords: '克制, 细腻, 白描, 少心理, 多动作与对话',
        systemPrompt:
          '你是悬疑/剧情类视觉小说正文代笔。规则：\n' +
          '1) 每段 ≤ 3 行；大段心理描写一律拆为「动作→对白→微表情」三段式；\n' +
          '2) 每章释放的信息量不超过当章总量 1/3；关键线索要在「反常的细节」里而非直给；\n' +
          '3) 段落结尾必须设置一个「下一个读者会追问什么」的钩子（悬念 / 反转 / 未完成动作）；\n' +
          '4) 严禁使用上帝视角解释动机；让人物用行为和对白自证。',
      },
    },
  ]
}

/* -------------------------------------------------------------------------- */
/*                                  基础读写                                 */
/* -------------------------------------------------------------------------- */

function safeRead(): StoragePayload {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { version: 1, items: [] }
    const parsed = JSON.parse(raw) as Partial<StoragePayload>
    if (parsed && parsed.version === 1 && Array.isArray(parsed.items)) {
      return { version: 1, items: parsed.items }
    }
  } catch {
    // 忽略损坏 JSON，返回空
  }
  return { version: 1, items: [] }
}

function safeWrite(payload: StoragePayload): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    // 通知其他 tab / 组件订阅
    if (typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('subsilicon-workflows-change'))
    }
  } catch {
    // 隐私模式或 localStorage 满时静默失败
  }
}

/** 合并内置模板：确保即使 localStorage 被清空 / 升级后也能看到默认模板 */
function mergeBuiltins(existing: CustomWorkflow[]): CustomWorkflow[] {
  const templates = builtinTemplates()
  const existingBuiltinKeys = new Set(
    existing
      .filter((it) => it.builtin && it.builtinKey)
      .map((it) => it.builtinKey as string)
  )
  const missing = templates.filter((t) => !existingBuiltinKeys.has(t.builtinKey as string))
  if (!missing.length) return existing
  return [...existing, ...missing]
}

/* -------------------------------------------------------------------------- */
/*                                    CRUD                                    */
/* -------------------------------------------------------------------------- */

/** 列出全部工作流（含内置），内置永远排在同一 taskType 的最前 */
export function listCustomWorkflows(taskType?: WorkflowTaskType): CustomWorkflow[] {
  const raw = safeRead()
  const merged = mergeBuiltins(raw.items)
  const sorted = [...merged].sort((a, b) => {
    // 内置优先；其次按更新时间倒序
    if (!!a.builtin !== !!b.builtin) return a.builtin ? -1 : 1
    return b.updatedAt - a.updatedAt
  })
  if (!taskType) return sorted
  return sorted.filter((wf) => wf.taskType === taskType)
}

export function getCustomWorkflow(id: string): CustomWorkflow | undefined {
  return listCustomWorkflows().find((wf) => wf.id === id)
}

export type WorkflowDraft =
  | { taskType: 'image' | 'video'; name: string; description?: string; media?: WorkflowMediaDefaults }
  | { taskType: 'text'; name: string; description?: string; text?: WorkflowTextDefaults }

function newId(): string {
  // 足够短且足够唯一的 ID（不使用 crypto.randomUUID 以兼容老环境）
  return `wf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** 新建自定义工作流（不能建内置） */
export function createCustomWorkflow(draft: WorkflowDraft): CustomWorkflow {
  const payload = safeRead()
  const now = Date.now()
  const entity: CustomWorkflow = {
    id: newId(),
    name: draft.name.trim().slice(0, 24) || '未命名工作流',
    description: draft.description?.trim().slice(0, 120),
    taskType: draft.taskType,
    createdAt: now,
    updatedAt: now,
    ...(draft.taskType === 'text'
      ? { text: (draft as { text?: WorkflowTextDefaults }).text }
      : { media: (draft as { media?: WorkflowMediaDefaults }).media }),
  }
  payload.items.push(entity)
  safeWrite(payload)
  return entity
}

export interface WorkflowPatch {
  name?: string
  description?: string
  media?: WorkflowMediaDefaults
  text?: WorkflowTextDefaults
}

/** 更新自定义工作流（内置模板拒绝更新） */
export function updateCustomWorkflow(id: string, patch: WorkflowPatch): CustomWorkflow | null {
  const payload = safeRead()
  const merged = mergeBuiltins(payload.items)
  const idx = merged.findIndex((wf) => wf.id === id)
  if (idx < 0) return null
  const target = merged[idx]
  if (target.builtin) return null // 内置不可直接改；请用 clone 然后改副本
  const updated: CustomWorkflow = {
    ...target,
    name: patch.name != null ? patch.name.trim().slice(0, 24) || target.name : target.name,
    description: patch.description != null ? patch.description.trim().slice(0, 120) : target.description,
    media: patch.media != null && (target.taskType === 'image' || target.taskType === 'video') ? patch.media : target.media,
    text: patch.text != null && target.taskType === 'text' ? patch.text : target.text,
    updatedAt: Date.now(),
  }
  merged[idx] = updated
  // 持久化时剔除内置模板（内置下次读取会重新合并，避免用户本地污染）
  payload.items = merged.filter((wf) => !wf.builtin)
  safeWrite(payload)
  return updated
}

/** 克隆（基于任意工作流：内置 / 自定义都可以克隆） */
export function cloneCustomWorkflow(id: string, newName?: string): CustomWorkflow | null {
  const source = getCustomWorkflow(id)
  if (!source) return null
  const draft: WorkflowDraft = source.taskType === 'text'
    ? { taskType: 'text', name: newName || `${source.name}（副本）`, description: source.description, text: source.text }
    : { taskType: source.taskType, name: newName || `${source.name}（副本）`, description: source.description, media: source.media }
  return createCustomWorkflow(draft)
}

/** 删除自定义工作流（内置模板拒绝删除） */
export function deleteCustomWorkflow(id: string): boolean {
  const payload = safeRead()
  const merged = mergeBuiltins(payload.items)
  const target = merged.find((wf) => wf.id === id)
  if (!target || target.builtin) return false
  payload.items = merged.filter((wf) => wf.id !== id && !wf.builtin)
  safeWrite(payload)
  return true
}

/** 重置为初始状态：清空所有自定义工作流，恢复内置模板 */
export function resetCustomWorkflows(): void {
  safeWrite({ version: 1, items: [] })
}

/* -------------------------------------------------------------------------- */
/*                             React Hook（组件侧用）                         */
/* -------------------------------------------------------------------------- */

import { useEffect, useState } from 'react'

/** 订阅自定义工作流变更（同一浏览器多 tab 也同步），返回最新列表 */
export function useCustomWorkflows(taskType?: WorkflowTaskType): CustomWorkflow[] {
  const [items, setItems] = useState<CustomWorkflow[]>(() => listCustomWorkflows(taskType))

  useEffect(() => {
    const refresh = () => setItems(listCustomWorkflows(taskType))
    refresh()
    window.addEventListener('subsilicon-workflows-change', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('subsilicon-workflows-change', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [taskType])

  return items
}
