import type { StoryNode, StoryEdge } from '@editor/types/editor'

export interface AiAction {
  type: 'createNode' | 'updateNode' | 'deleteNode' | 'connectNodes' | 'updateEdge' | 'deleteEdge' | 'addCharacter' | 'selectNode' | 'requestMediaGeneration'
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

        case 'requestMediaGeneration': {
          const request: MediaGenerationRequest = {
            mediaType: (action.payload.mediaType as 'image' | 'video' | 'audio') || 'image',
            prompt: (action.payload.prompt as string) || '',
            style: action.payload.style as string | undefined,
            width: action.payload.width as number | undefined,
            height: action.payload.height as number | undefined,
          }
          if (request.prompt) {
            mediaRequests.push(request)
            messages.push(`请求生成${request.mediaType === 'image' ? '图片' : request.mediaType === 'video' ? '视频' : '音频'}: ${request.prompt.slice(0, 50)}...`)
          }
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
