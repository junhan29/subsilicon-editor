import { describe, it, expect, vi } from 'vitest'
import {
  parseAiCommands,
  parseAllAiCommands,
  executeAiActions,
  type AiAction,
  type EditorCanvasCallbacks,
  type MediaGenerationRequest,
} from '../ai/chat-command-executor'

function createMockCallbacks(): EditorCanvasCallbacks {
  return {
    onUpdateNode: vi.fn(),
    onDeleteNode: vi.fn(),
    onUpdateEdge: vi.fn(),
    onDeleteEdge: vi.fn(),
    onAddNode: vi.fn().mockReturnValue('new-node-1'),
    onAddEdge: vi.fn().mockReturnValue('new-edge-1'),
    onNodeSelect: vi.fn(),
  }
}

describe('parseAiCommands', () => {
  it('解析基本的 ai-action 命令块', () => {
    const text = `我创建了一个对话节点

\`\`\`ai-action
{
  "actions": [
    { "type": "createNode", "payload": { "nodeType": "dialogue", "data": { "text": "你好" } } }
  ]
}
\`\`\``

    const result = parseAiCommands(text)
    expect(result).not.toBeNull()
    expect(result!.actions).toHaveLength(1)
    expect(result!.actions[0].type).toBe('createNode')
  })

  it('解析 requestMediaGeneration 命令', () => {
    const text = `让我为你生成一张图片

\`\`\`ai-action
{
  "actions": [
    { "type": "requestMediaGeneration", "payload": { "mediaType": "image", "prompt": "A ninja at sunset", "style": "anime" } }
  ]
}
\`\`\``

    const result = parseAiCommands(text)
    expect(result).not.toBeNull()
    expect(result!.actions[0].type).toBe('requestMediaGeneration')
    expect(result!.actions[0].payload.mediaType).toBe('image')
    expect(result!.actions[0].payload.prompt).toBe('A ninja at sunset')
  })

  it('无效 JSON 返回 null', () => {
    const text = `\`\`\`ai-action
{ invalid json }
\`\`\``
    expect(parseAiCommands(text)).toBeNull()
  })

  it('无 ai-action 块返回 null', () => {
    expect(parseAiCommands('普通文本')).toBeNull()
  })
})

describe('parseAllAiCommands', () => {
  it('解析多个命令块', () => {
    const text = `第一个块

\`\`\`ai-action
{ "actions": [ { "type": "createNode", "payload": { "nodeType": "dialogue" } } ] }
\`\`\`

第二个块

\`\`\`ai-action
{ "actions": [ { "type": "requestMediaGeneration", "payload": { "mediaType": "image", "prompt": "test" } } ] }
\`\`\``

    const results = parseAllAiCommands(text)
    expect(results).toHaveLength(2)
    expect(results[0].actions[0].type).toBe('createNode')
    expect(results[1].actions[0].type).toBe('requestMediaGeneration')
  })

  it('无命令块返回空数组', () => {
    expect(parseAllAiCommands('普通文本')).toEqual([])
  })
})

describe('executeAiActions', () => {
  it('执行 createNode', async () => {
    const callbacks = createMockCallbacks()
    const actions: AiAction[] = [
      { type: 'createNode', payload: { nodeType: 'dialogue', data: { text: 'hi' }, position: { x: 100, y: 100 } } },
    ]
    const result = await executeAiActions(actions, callbacks)
    expect(result.success).toBe(1)
    expect(result.failed).toBe(0)
    expect(callbacks.onAddNode).toHaveBeenCalledWith('dialogue', { x: 100, y: 100 }, { text: 'hi' })
  })

  it('执行 connectNodes', async () => {
    const callbacks = createMockCallbacks()
    const actions: AiAction[] = [
      { type: 'connectNodes', payload: { source: 'node-a', target: 'node-b' } },
    ]
    const result = await executeAiActions(actions, callbacks)
    expect(result.success).toBe(1)
    expect(callbacks.onAddEdge).toHaveBeenCalledWith('node-a', 'node-b')
  })

  it('执行 requestMediaGeneration 返回 mediaRequests', async () => {
    const callbacks = createMockCallbacks()
    const actions: AiAction[] = [
      { type: 'requestMediaGeneration', payload: { mediaType: 'image', prompt: 'A warrior at sunrise', style: 'anime', width: 1024, height: 1024 } },
    ]
    const result = await executeAiActions(actions, callbacks)
    expect(result.mediaRequests).toHaveLength(1)
    expect(result.mediaRequests[0].mediaType).toBe('image')
    expect(result.mediaRequests[0].prompt).toBe('A warrior at sunrise')
    expect(result.mediaRequests[0].style).toBe('anime')
  })

  it('混合执行普通操作和媒体请求', async () => {
    const callbacks = createMockCallbacks()
    const actions: AiAction[] = [
      { type: 'createNode', payload: { nodeType: 'narration', data: { text: '开始' } } },
      { type: 'requestMediaGeneration', payload: { mediaType: 'image', prompt: 'A castle' } },
      { type: 'connectNodes', payload: { source: 'a', target: 'b' } },
      { type: 'requestMediaGeneration', payload: { mediaType: 'video', prompt: 'An explosion scene' } },
    ]
    const result = await executeAiActions(actions, callbacks)
    expect(result.success).toBe(2)
    expect(result.failed).toBe(0)
    expect(result.mediaRequests).toHaveLength(2)
    expect(result.mediaRequests[0].mediaType).toBe('image')
    expect(result.mediaRequests[1].mediaType).toBe('video')
  })

  it('requestMediaGeneration 空 prompt 不添加到列表', async () => {
    const callbacks = createMockCallbacks()
    const actions: AiAction[] = [
      { type: 'requestMediaGeneration', payload: { mediaType: 'image', prompt: '' } },
    ]
    const result = await executeAiActions(actions, callbacks)
    expect(result.mediaRequests).toHaveLength(0)
  })

  it('未知操作类型计入失败', async () => {
    const callbacks = createMockCallbacks()
    const actions: AiAction[] = [
      { type: 'unknownType' as any, payload: {} },
    ]
    const result = await executeAiActions(actions, callbacks)
    expect(result.failed).toBe(1)
  })

  it('操作失败不影响后续操作', async () => {
    const callbacks = createMockCallbacks()
    callbacks.onUpdateNode = vi.fn(() => { throw new Error('test error') })
    const actions: AiAction[] = [
      { type: 'updateNode', payload: { nodeId: 'x', data: { text: 'hi' } } },
      { type: 'createNode', payload: { nodeType: 'dialogue', data: { text: 'hello' } } },
    ]
    const result = await executeAiActions(actions, callbacks)
    expect(result.failed).toBe(1)
    expect(result.success).toBe(1)
  })

  it('selectNode 调用 onNodeSelect', async () => {
    const callbacks = createMockCallbacks()
    const actions: AiAction[] = [
      { type: 'selectNode', payload: { nodeId: 'node-1' } },
    ]
    await executeAiActions(actions, callbacks)
    expect(callbacks.onNodeSelect).toHaveBeenCalledWith('node-1')
  })
})
