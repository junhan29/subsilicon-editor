import type { StoryCharacter, StoryEdge, StoryNode, StoryVariable } from '@editor/types/editor'

export interface AiAction {
  type: 'createNode' | 'updateNode' | 'deleteNode' | 'connectNodes' | 'updateEdge' | 'deleteEdge' | 'addCharacter' | 'updateCharacter' | 'deleteCharacter' | 'selectNode' | 'requestMediaGeneration' | 'bindAsset' | 'saveWork' | 'exportWork' | 'previewWork' | 'undo' | 'redo' | 'renameWork' | 'addVariable' | 'updateVariable' | 'deleteVariable'
  payload: Record<string, unknown>
}

export interface AiCommandBlock {
  actions: AiAction[]
  /** 校验未通过的非法动作（保留原始内容与拒绝原因，便于调试与提示用户） */
  invalid: { raw: unknown; reason: string }[]
}

export interface MediaGenerationRequest {
  mediaType: 'image' | 'video' | 'audio'
  prompt: string
  style?: string
  width?: number
  height?: number
  /** 生成成功后自动绑定到的目标节点 ID */
  nodeId?: string
  /** 自动标注：关联角色 ID */
  characterId?: string
  /** 自动标注：情绪/表情 */
  emotion?: string
  /** 自动标注：场景标签 */
  sceneTag?: string
  /** 自动标注：用途分类（character_sprite / background / cg / video ...） */
  usageType?: string
  /** 自动标注：自由描述 */
  description?: string
  /** 运行时状态：生成中 */
  _status?: 'pending' | 'generating' | 'done' | 'error' | 'rejected'
  /** 运行时状态：生成结果 URL */
  _result?: string
  /** 运行时状态：入库后的素材 hash（前 12 位可用于 bindAsset） */
  _assetHash?: string
}

export interface ExecuteResult {
  success: number
  failed: number
  messages: string[]
  mediaRequests: MediaGenerationRequest[]
}

/** executeAiActions 的可选配置 */
export interface ExecuteAiActionsOptions {
  /**
   * 执行第一批动作前回调一次（act-along 模式下由调用方传入，
   * 用于在历史栈建立「AI 批量操作」检查点快照）。
   */
  onBeforeExecute?: () => void
}

/**
 * 审批决策：预览模式开启时动作暂存待批准（不执行），否则直接执行。
 * 空动作永不进入预览（避免出现空确认卡片）。
 * 独立成纯函数便于单测：防止预览审批被绕过或出现空卡片。
 */
export function dispatchParsedCommands(
  actions: AiAction[],
  previewMode: boolean
): { mode: 'execute' | 'preview'; actions: AiAction[] } {
  if (actions.length === 0) return { mode: 'execute', actions: [] }
  return previewMode ? { mode: 'preview', actions } : { mode: 'execute', actions }
}

/** 单条动作的可读描述（用于命令预览卡片） */
export interface ActionPreview {
  action: AiAction
  /** 人类可读的中文描述，如「创建 对话 节点：你好」 */
  description: string
}

/** 节点类型的中文标签（与画布一致） */
export const AI_NODE_TYPE_LABELS: Record<string, string> = {
  dialogue: '对话',
  narration: '旁白',
  choice: '选择',
  ending: '结局',
  gather: '汇聚',
  condition: '条件',
  unlock: '付费解锁',
  cg: 'CG 过场',
  jump: '跳转',
  random: '随机',
  group: '分组',
}

const MEDIA_TYPE_LABELS: Record<string, string> = {
  image: '图片',
  video: '视频',
  audio: '音频',
}

function truncate(text: string | undefined, max = 24): string {
  if (!text) return ''
  const t = text.trim().replace(/\s+/g, ' ')
  return t.length > max ? `${t.slice(0, max)}…` : t
}

/**
 * 将动作数组转为人类可读的中文描述列表。
 * 供「命令预览」卡片展示，让用户在 AI 真正操作画布前看清楚要做什么。
 */
export function describeAiActions(actions: AiAction[]): ActionPreview[] {
  return actions.map((action) => {
    const p = (action.payload || {}) as Record<string, any>
    switch (action.type) {
      case 'createNode': {
        const type = (p.nodeType as string) || 'unknown'
        const label = AI_NODE_TYPE_LABELS[type] || type
        const text = truncate((p.data as any)?.text) || truncate((p.data as any)?.prompt) || truncate((p.data as any)?.title)
        return { action, description: `创建 ${label} 节点${text ? `：${text}` : ''}` }
      }
      case 'updateNode':
        return { action, description: `修改节点 ${p.nodeId ?? '?'}` }
      case 'deleteNode':
        return { action, description: `删除节点 ${p.nodeId ?? '?'}` }
      case 'connectNodes':
        return { action, description: `连接节点 ${p.source ?? '?'} → ${p.target ?? '?'}` }
      case 'updateEdge':
        return { action, description: `修改连线 ${p.edgeId ?? '?'}` }
      case 'deleteEdge':
        return { action, description: `删除连线 ${p.edgeId ?? '?'}` }
      case 'selectNode':
        return { action, description: `选中节点 ${p.nodeId ?? '?'}` }
      case 'addCharacter': {
        const name = (p.name as string) || '?'
        const gender = p.gender ? `（${p.gender}）` : ''
        return { action, description: `创建角色 ${name}${gender}` }
      }
      case 'updateCharacter':
        return { action, description: `修改角色 ${truncate(p.characterId as string, 16)}` }
      case 'deleteCharacter':
        return { action, description: `删除角色 ${truncate(p.characterId as string, 16)}` }
      case 'renameWork':
        return { action, description: `作品重命名为「${truncate(p.title as string)}」` }
      case 'addVariable':
        return { action, description: `新增变量 ${truncate((p.name as string) || (p.variable as any)?.name, 16)}` }
      case 'updateVariable':
        return { action, description: `修改变量 ${truncate(p.variableId as string, 16)}` }
      case 'deleteVariable':
        return { action, description: `删除变量 ${truncate(p.variableId as string, 16)}` }
      case 'bindAsset':
        return { action, description: `绑定素材 ${truncate(p.assetHash as string, 12)} 到节点 ${p.nodeId ?? '?'}` }
      case 'requestMediaGeneration': {
        const type = MEDIA_TYPE_LABELS[(p.mediaType as string) || 'image'] || '媒体'
        return { action, description: `生成${type}：${truncate(p.prompt as string)}` }
      }
      case 'saveWork':
        return { action, description: '保存当前作品' }
      case 'exportWork':
        return { action, description: '打开导出对话框' }
      case 'previewWork':
        return { action, description: '打开作品预览' }
      case 'undo':
        return { action, description: '撤销上一步操作' }
      case 'redo':
        return { action, description: '重做操作' }
      default:
        return { action, description: `未知操作：${action.type}` }
    }
  })
}

export interface EditorCanvasCallbacks {
  onUpdateNode?: (nodeId: string, data: Partial<StoryNode['data']>) => void
  onDeleteNode?: (nodeId: string) => void
  onUpdateEdge?: (edgeId: string, data: Partial<StoryEdge>) => void
  onDeleteEdge?: (edgeId: string) => void
  onAddNode?: (type: string, position: { x: number; y: number }, data: Record<string, unknown>) => string | undefined
  onAddEdge?: (source: string, target: string) => string | undefined
  onNodeSelect?: (nodeId: string) => void
  onAddCharacter?: (character: StoryCharacter) => void
  /** AI 编辑角色（局部字段合并） */
  onUpdateCharacter?: (characterId: string, data: Partial<StoryCharacter>) => void
  /** AI 删除角色 */
  onDeleteCharacter?: (characterId: string) => void
  /** AI 重命名作品 */
  onRenameWork?: (title: string) => void
  /** AI 新增变量 */
  onAddVariable?: (variable: StoryVariable) => void
  /** AI 修改变量（局部字段合并） */
  onUpdateVariable?: (variableId: string, data: Partial<StoryVariable>) => void
  /** AI 删除变量 */
  onDeleteVariable?: (variableId: string) => void
  /** AI 把已标注的素材绑定到节点（assetHash 前 12 位匹配 + blob URL 生成） */
  onBindAsset?: (nodeId: string, assetHash: string, usageType?: string) => Promise<boolean>
  /** 保存当前作品到本地 */
  onSaveWork?: () => void
  /** 打开导出对话框 */
  onExportWork?: () => void
  /** 打开预览 */
  onPreviewWork?: () => void
  /** 撤销上一步操作 */
  onUndo?: () => void
  /** 重做 */
  onRedo?: () => void
}

/** 合法的 AI 动作类型列表（与 AiAction 联合类型一一对应，共 21 种） */
const AI_ACTION_TYPES = [
  'createNode', 'updateNode', 'deleteNode', 'connectNodes', 'updateEdge', 'deleteEdge',
  'selectNode', 'addCharacter', 'updateCharacter', 'deleteCharacter',
  'addVariable', 'updateVariable', 'deleteVariable', 'bindAsset', 'requestMediaGeneration',
  'renameWork', 'saveWork', 'exportWork', 'previewWork', 'undo', 'redo',
] as const

type AiActionType = (typeof AI_ACTION_TYPES)[number]

/** 允许缺省 payload 的动作类型（JSON 中省略 payload 时按空对象处理） */
const NO_PAYLOAD_TYPES = new Set<AiActionType>(['undo', 'redo', 'saveWork', 'exportWork', 'previewWork'])

/**
 * 校验单个 AI 动作的结构与常见字段类型。
 * 目标：未知 type 必拒、明显类型错误必拒，避免非法动作被当作真实动作执行。
 * 返回 ok:true 时附上归一化后的合法动作（缺省的 payload 补为空对象）。
 */
export function validateAiAction(
  raw: unknown
): { ok: true; action: AiAction } | { ok: false; reason: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, reason: '动作必须是 JSON 对象' }
  }

  const candidate = raw as Record<string, unknown>
  const type = candidate.type
  if (typeof type !== 'string' || !(AI_ACTION_TYPES as readonly string[]).includes(type)) {
    return { ok: false, reason: `未知动作类型: ${typeof type === 'string' ? type : String(type)}` }
  }
  const actionType = type as AiActionType

  const payload = candidate.payload
  if (payload !== undefined && (typeof payload !== 'object' || payload === null || Array.isArray(payload))) {
    return { ok: false, reason: `${actionType} 的 payload 必须是对象` }
  }
  if (payload === undefined && !NO_PAYLOAD_TYPES.has(actionType)) {
    return { ok: false, reason: `${actionType} 缺少 payload` }
  }

  const p = (payload ?? {}) as Record<string, unknown>
  const fieldError = validateRequiredFields(actionType, p)
  if (fieldError) return { ok: false, reason: fieldError }

  return { ok: true, action: { type: actionType, payload: p } }
}

/** 对常见动作做轻量必填/类型校验，返回错误描述；合法时返回 null */
function validateRequiredFields(type: AiActionType, p: Record<string, unknown>): string | null {
  const needNonEmptyString = (field: string): string | null => {
    const v = p[field]
    if (typeof v !== 'string' || v.trim() === '') return `${type} 的 ${field} 必须为非空字符串`
    return null
  }

  switch (type) {
    case 'createNode':
      return needNonEmptyString('nodeType')
    case 'updateNode':
    case 'deleteNode':
    case 'selectNode':
      return needNonEmptyString('nodeId')
    case 'connectNodes':
      return needNonEmptyString('source') ?? needNonEmptyString('target')
    case 'updateEdge':
    case 'deleteEdge':
      return needNonEmptyString('edgeId')
    case 'addCharacter':
      return needNonEmptyString('name')
    case 'updateCharacter':
    case 'deleteCharacter':
      return needNonEmptyString('characterId')
    case 'renameWork':
      return needNonEmptyString('title')
    case 'addVariable': {
      const variable = p.variable
      const name = (typeof variable === 'object' && variable !== null && !Array.isArray(variable))
        ? (variable as Record<string, unknown>).name
        : p.name
      if (typeof name !== 'string' || name.trim() === '') return 'addVariable 的 name 必须为非空字符串'
      const varType = p.type
      if (varType !== undefined && varType !== 'string' && varType !== 'number' && varType !== 'boolean') {
        return 'addVariable 的 type 必须是 string | number | boolean'
      }
      return null
    }
    case 'updateVariable':
    case 'deleteVariable':
      return needNonEmptyString('variableId')
    case 'bindAsset':
      return needNonEmptyString('nodeId') ?? needNonEmptyString('assetHash')
    case 'requestMediaGeneration': {
      const mediaType = p.mediaType
      if (mediaType !== undefined && mediaType !== 'image' && mediaType !== 'video' && mediaType !== 'audio') {
        return 'requestMediaGeneration 的 mediaType 必须是 image | video | audio'
      }
      return null
    }
    default:
      // 无需 payload 的动作（undo/redo/saveWork/exportWork/previewWork）不做字段校验
      return null
  }
}

/** 将 JSON 块中的动作逐一过校验：合法动作保留，非法动作收集到 invalid 并附拒绝原因 */
function sanitizeCommandBlock(parsed: unknown): AiCommandBlock {
  const block: AiCommandBlock = { actions: [], invalid: [] }
  if (typeof parsed !== 'object' || parsed === null) return block
  const actions = (parsed as Record<string, unknown>).actions
  if (!Array.isArray(actions)) return block
  for (const item of actions) {
    const result = validateAiAction(item)
    if (result.ok) {
      block.actions.push(result.action)
    } else {
      block.invalid.push({ raw: item, reason: result.reason })
    }
  }
  return block
}

/**
 * 解析创作助理响应文本中的 JSON 命令块。
 * 格式：```ai-action { "actions": [...] } ```
 * 动作会逐一经过 validateAiAction 校验：合法动作保留在 actions，
 * 非法动作收集到 invalid（带拒绝原因），确保执行器/预览不会执行非法动作。
 */
export function parseAiCommands(text: string): AiCommandBlock | null {
  const regex = /```ai-action\s*\n?([\s\S]*?)```/
  const match = text.match(regex)
  if (!match) return null

  try {
    const parsed = JSON.parse(match[1].trim())
    if (!parsed.actions || !Array.isArray(parsed.actions)) return null
    return sanitizeCommandBlock(parsed)
  } catch {
    return null
  }
}

/**
 * 提取创作助理响应中的所有 JSON 命令块（支持多个命令块）。
 * 每个块内的动作同样经过 validateAiAction 校验过滤。
 */
export function parseAllAiCommands(text: string): AiCommandBlock[] {
  const regex = /```ai-action\s*\n?([\s\S]*?)```/g
  const blocks: AiCommandBlock[] = []
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim())
      if (parsed.actions && Array.isArray(parsed.actions)) {
        blocks.push(sanitizeCommandBlock(parsed))
      }
    } catch {
      // 跳过无效 JSON 块
    }
  }

  return blocks
}

/**
 * 逐一执行创作助理命令操作。
 * 每个操作独立执行，单个失败不影响后续操作。
 * 返回执行结果摘要。
 * options.onBeforeExecute 在执行第一批动作前回调一次（用于打 AI 批次检查点）。
 */
export async function executeAiActions(
  actions: AiAction[],
  callbacks: EditorCanvasCallbacks,
  options?: ExecuteAiActionsOptions
): Promise<ExecuteResult> {
  let success = 0
  let failed = 0
  const messages: string[] = []
  const mediaRequests: MediaGenerationRequest[] = []

  // 执行第一批动作前回调（仅一次），act-along 模式下用于建立 AI 批次检查点
  options?.onBeforeExecute?.()

  for (const action of actions) {
    try {
      switch (action.type) {
        case 'createNode': {
          const nodeType = action.payload.nodeType as string
          const data = (action.payload.data as Record<string, unknown>) || {}
          const pos = action.payload.position as { x: number; y: number } | undefined
          const position = pos || { x: 200 + Math.random() * 300, y: 200 + Math.random() * 300 }
          const nodeId = callbacks.onAddNode?.(nodeType, position, data)
          messages.push(`创建 ${nodeType} 节点${nodeId ? ` (ID: ${nodeId})` : ''}`)
          success++
          break
        }

        case 'updateNode': {
          const nodeId = action.payload.nodeId as string
          const data = action.payload.data as Partial<StoryNode['data']>
          if (!nodeId) throw new Error('缺少 nodeId')
          callbacks.onUpdateNode?.(nodeId, data)
          messages.push(`更新节点 ${nodeId}`)
          success++
          break
        }

        case 'deleteNode': {
          const nodeId = action.payload.nodeId as string
          if (!nodeId) throw new Error('缺少 nodeId')
          callbacks.onDeleteNode?.(nodeId)
          messages.push(`删除节点 ${nodeId}`)
          success++
          break
        }

        case 'connectNodes': {
          const source = action.payload.source as string
          const target = action.payload.target as string
          if (!source || !target) throw new Error('缺少 source 或 target')
          const edgeId = callbacks.onAddEdge?.(source, target)
          messages.push(`连接节点 ${source} → ${target}${edgeId ? ` (边 ID: ${edgeId})` : ''}`)
          success++
          break
        }

        case 'updateEdge': {
          const edgeId = action.payload.edgeId as string
          const data = action.payload.data as Partial<StoryEdge>
          if (!edgeId) throw new Error('缺少 edgeId')
          callbacks.onUpdateEdge?.(edgeId, data)
          messages.push(`更新边 ${edgeId}`)
          success++
          break
        }

        case 'deleteEdge': {
          const edgeId = action.payload.edgeId as string
          if (!edgeId) throw new Error('缺少 edgeId')
          callbacks.onDeleteEdge?.(edgeId)
          messages.push(`删除边 ${edgeId}`)
          success++
          break
        }

        case 'selectNode': {
          const nodeId = action.payload.nodeId as string
          if (!nodeId) throw new Error('缺少 nodeId')
          callbacks.onNodeSelect?.(nodeId)
          messages.push(`选中节点 ${nodeId}`)
          success++
          break
        }

        case 'addCharacter': {
          const name = action.payload.name as string
          if (!name) throw new Error('缺少角色 name')
          const char: StoryCharacter = {
            id: action.payload.id as string || `char-${Date.now()}`,
            name,
            avatar: '',
            color: action.payload.color as string || '#3b82f6',
            gender: (action.payload.gender as StoryCharacter['gender']) || 'unknown',
            age: (action.payload.age as string) || '',
            occupation: (action.payload.occupation as string) || '',
            personality: (action.payload.personality as string[]) || [],
            appearance: (action.payload.appearance as string[]) || [],
            background: (action.payload.background as string) || '',
            speech: {
              tone: (action.payload.speechTone as string) || '',
              catchphrases: (action.payload.catchphrases as string[]) || [],
            },
            skills: [],
            motivation: '',
            habits: [],
            fears: [],
            relations: [],
            tags: (action.payload.tags as string[]) || [],
            bio: (action.payload.bio as string) || '',
          }
          callbacks.onAddCharacter?.(char)
          messages.push(`创建角色 ${name} (ID: ${char.id})`)
          success++
          break
        }

        case 'updateCharacter': {
          const characterId = action.payload.characterId as string
          if (!characterId) throw new Error('缺少 characterId')
          callbacks.onUpdateCharacter?.(characterId, (action.payload.data as Partial<StoryCharacter>) || {})
          messages.push(`修改角色 ${characterId}`)
          success++
          break
        }

        case 'deleteCharacter': {
          const characterId = action.payload.characterId as string
          if (!characterId) throw new Error('缺少 characterId')
          callbacks.onDeleteCharacter?.(characterId)
          messages.push(`删除角色 ${characterId}`)
          success++
          break
        }

        case 'renameWork': {
          const title = action.payload.title as string
          if (!title) throw new Error('缺少 title')
          callbacks.onRenameWork?.(title)
          messages.push(`作品重命名为「${title}」`)
          success++
          break
        }

        case 'addVariable': {
          const raw = (action.payload.variable as Partial<StoryVariable>) || {
            name: action.payload.name as string,
            initialValue: action.payload.initialValue,
            type: (action.payload.type as StoryVariable['type']) || 'string',
          }
          if (!raw.name) throw new Error('缺少变量 name')
          const variable: StoryVariable = {
            id: (raw.id as string) || `var-${Date.now()}`,
            name: raw.name,
            initialValue: raw.initialValue ?? '',
            defaultValue: raw.defaultValue ?? raw.initialValue ?? '',
            type: raw.type || 'string',
            description: raw.description,
          }
          callbacks.onAddVariable?.(variable)
          messages.push(`新增变量 ${variable.name} (ID: ${variable.id})`)
          success++
          break
        }

        case 'updateVariable': {
          const variableId = action.payload.variableId as string
          if (!variableId) throw new Error('缺少 variableId')
          callbacks.onUpdateVariable?.(variableId, (action.payload.data as Partial<StoryVariable>) || {})
          messages.push(`修改变量 ${variableId}`)
          success++
          break
        }

        case 'deleteVariable': {
          const variableId = action.payload.variableId as string
          if (!variableId) throw new Error('缺少 variableId')
          callbacks.onDeleteVariable?.(variableId)
          messages.push(`删除变量 ${variableId}`)
          success++
          break
        }

        case 'bindAsset': {
          const nodeId = action.payload.nodeId as string
          const assetHash = action.payload.assetHash as string
          if (!nodeId) throw new Error('缺少 nodeId')
          if (!assetHash) throw new Error('缺少 assetHash')
          const usageType = action.payload.usageType as string | undefined
          const ok = await callbacks.onBindAsset?.(nodeId, assetHash, usageType)
          if (ok) {
            messages.push(`绑定素材 ${assetHash.slice(0, 12)} 到节点 ${nodeId}`)
            success++
          } else {
            throw new Error(`素材未找到或绑定失败: ${assetHash}`)
          }
          break
        }

        case 'requestMediaGeneration': {
          const request: MediaGenerationRequest = {
            mediaType: (action.payload.mediaType as 'image' | 'video' | 'audio') || 'image',
            prompt: (action.payload.prompt as string) || '',
            style: action.payload.style as string | undefined,
            width: action.payload.width as number | undefined,
            height: action.payload.height as number | undefined,
            nodeId: action.payload.nodeId as string | undefined,
            characterId: action.payload.characterId as string | undefined,
            emotion: action.payload.emotion as string | undefined,
            sceneTag: action.payload.sceneTag as string | undefined,
            usageType: action.payload.usageType as string | undefined,
            description: action.payload.description as string | undefined,
          }
          if (request.prompt) {
            mediaRequests.push(request)
            const targetHint = request.nodeId ? ` → 节点 ${request.nodeId}` : ''
            messages.push(`请求生成${request.mediaType === 'image' ? '图片' : request.mediaType === 'video' ? '视频' : '音频'}: ${request.prompt.slice(0, 50)}...${targetHint}`)
          }
          break
        }

        case 'saveWork': {
          callbacks.onSaveWork?.()
          messages.push('作品已保存')
          success++
          break
        }

        case 'exportWork': {
          callbacks.onExportWork?.()
          messages.push('已打开导出对话框')
          success++
          break
        }

        case 'previewWork': {
          callbacks.onPreviewWork?.()
          messages.push('已打开预览')
          success++
          break
        }

        case 'undo': {
          callbacks.onUndo?.()
          messages.push('已撤销')
          success++
          break
        }

        case 'redo': {
          callbacks.onRedo?.()
          messages.push('已重做')
          success++
          break
        }

        default:
          messages.push(`未知操作类型: ${(action as AiAction).type}`)
          failed++
      }
    } catch (e) {
      failed++
      messages.push(`操作失败: ${action.type} - ${e instanceof Error ? e.message : '未知错误'}`)
    }
  }

  return { success, failed, messages, mediaRequests }
}
