import type { StoryNode, StoryEdge, StoryCharacter } from '@editor/types/editor'

export interface AiAction {
  type: 'createNode' | 'updateNode' | 'deleteNode' | 'connectNodes' | 'updateEdge' | 'deleteEdge' | 'addCharacter' | 'selectNode' | 'requestMediaGeneration' | 'bindAsset' | 'saveWork' | 'exportWork' | 'previewWork' | 'undo' | 'redo'
  payload: Record<string, unknown>
}

export interface AiCommandBlock {
  actions: AiAction[]
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

export interface EditorCanvasCallbacks {
  onUpdateNode?: (nodeId: string, data: Partial<StoryNode['data']>) => void
  onDeleteNode?: (nodeId: string) => void
  onUpdateEdge?: (edgeId: string, data: Partial<StoryEdge>) => void
  onDeleteEdge?: (edgeId: string) => void
  onAddNode?: (type: string, position: { x: number; y: number }, data: Record<string, unknown>) => string | undefined
  onAddEdge?: (source: string, target: string) => string | undefined
  onNodeSelect?: (nodeId: string) => void
  onAddCharacter?: (character: StoryCharacter) => void
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

/**
 * 解析创境响应文本中的 JSON 命令块。
 * 格式：```ai-action { "actions": [...] } ```
 */
export function parseAiCommands(text: string): AiCommandBlock | null {
  const regex = /```ai-action\s*\n?([\s\S]*?)```/
  const match = text.match(regex)
  if (!match) return null

  try {
    const parsed = JSON.parse(match[1].trim())
    if (!parsed.actions || !Array.isArray(parsed.actions)) return null
    return parsed as AiCommandBlock
  } catch {
    return null
  }
}

/**
 * 提取创境响应中的所有 JSON 命令块（支持多个命令块）。
 */
export function parseAllAiCommands(text: string): AiCommandBlock[] {
  const regex = /```ai-action\s*\n?([\s\S]*?)```/g
  const blocks: AiCommandBlock[] = []
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim())
      if (parsed.actions && Array.isArray(parsed.actions)) {
        blocks.push(parsed as AiCommandBlock)
      }
    } catch {
      // skip invalid blocks
    }
  }

  return blocks
}

/**
 * 逐一执行创境命令操作。
 * 每个操作独立执行，单个失败不影响后续操作。
 * 返回执行结果摘要。
 */
export async function executeAiActions(
  actions: AiAction[],
  callbacks: EditorCanvasCallbacks
): Promise<ExecuteResult> {
  let success = 0
  let failed = 0
  const messages: string[] = []
  const mediaRequests: MediaGenerationRequest[] = []

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
