import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  streamPolishText,
  streamContinueText,
  streamGenerateOutlineParsed,
} from '../ai/services/stream-service'
import { callAiStream } from '../ai/provider-registry'
import type { AiStreamResult } from '../ai/types'

vi.mock('../ai/provider-registry', () => ({
  callAiStream: vi.fn(),
}))

describe('Stream Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function* mockStream(chunks: string[]): AsyncGenerator<string, void, unknown> {
    for (const chunk of chunks) {
      yield chunk
    }
  }

  describe('streamPolishText', () => {
    it('调用 callAiStream 并返回流和完整文本', async () => {
      const chunks = ['Hello', ' ', 'World']
      const mockResult: AiStreamResult = {
        stream: mockStream(chunks),
        fullText: Promise.resolve('Hello World'),
      }
      vi.mocked(callAiStream).mockResolvedValue(mockResult)

      const result = await streamPolishText('test text', 'general')

      expect(callAiStream).toHaveBeenCalledOnce()
      expect(await result.fullText).toBe('Hello World')
    })

    it('通过回调接收 chunk', async () => {
      const chunks = ['A', 'B', 'C']
      const mockResult: AiStreamResult = {
        stream: mockStream(chunks),
        fullText: Promise.resolve('ABC'),
      }
      vi.mocked(callAiStream).mockResolvedValue(mockResult)

      const received: string[] = []
      await streamPolishText('test', 'general', null, {
        onChunk: (c) => received.push(c),
      })

      // 等待异步 pipeStream 完成
      await new Promise((r) => setTimeout(r, 50))
      expect(received).toEqual(['A', 'B', 'C'])
    })

    it('onDone 回调收到完整文本', async () => {
      const chunks = ['X', 'Y']
      const mockResult: AiStreamResult = {
        stream: mockStream(chunks),
        fullText: Promise.resolve('XY'),
      }
      vi.mocked(callAiStream).mockResolvedValue(mockResult)

      let doneText = ''
      await streamPolishText('test', 'vivid', null, {
        onDone: (t) => { doneText = t },
      })

      await new Promise((r) => setTimeout(r, 50))
      expect(doneText).toBe('XY')
    })

    it('onError 回调处理流错误', async () => {
      async function* errorStream(): AsyncGenerator<string, void, unknown> {
        throw new Error('stream error')
      }

      const rejectedPromise = Promise.reject(new Error('stream error'))
      // 避免 unhandled rejection
      rejectedPromise.catch(() => {})

      const mockResult: AiStreamResult = {
        stream: errorStream(),
        fullText: rejectedPromise,
      }
      vi.mocked(callAiStream).mockResolvedValue(mockResult)

      let errorCaught: unknown = null
      await streamPolishText('test', 'general', null, {
        onError: (e) => { errorCaught = e },
      })

      await new Promise((r) => setTimeout(r, 50))
      expect(errorCaught).toBeInstanceOf(Error)
    })
  })

  describe('streamContinueText', () => {
    it('使用续写 prompt', async () => {
      const mockResult: AiStreamResult = {
        stream: mockStream(['续写']),
        fullText: Promise.resolve('续写'),
      }
      vi.mocked(callAiStream).mockResolvedValue(mockResult)

      await streamContinueText('原文', 'general')

      expect(callAiStream).toHaveBeenCalledOnce()
      const args = vi.mocked(callAiStream).mock.calls[0][0]
      expect(args.maxTokens).toBe(200)
      expect(args.temperature).toBe(0.8)
    })
  })

  describe('streamGenerateOutlineParsed', () => {
    it('解析流式生成的 JSON 大纲', async () => {
      const json = JSON.stringify({
        title: '测试故事',
        scenes: [
          {
            id: 'scene-1',
            title: '开场',
            description: '故事开始',
            characters: ['主角'],
            choices: [{ text: '前进', nextSceneId: 'scene-2' }],
          },
        ],
      })

      const mockResult: AiStreamResult = {
        stream: mockStream([json]),
        fullText: Promise.resolve(json),
      }
      vi.mocked(callAiStream).mockResolvedValue(mockResult)

      const result = await streamGenerateOutlineParsed('测试', '冒险')

      expect(result.title).toBe('测试故事')
      expect(result.scenes).toHaveLength(1)
      expect(result.scenes[0].title).toBe('开场')
      expect(result.scenes[0].characters).toEqual(['主角'])
      expect(result.scenes[0].choices).toHaveLength(1)
    })

    it('JSON 解析失败时返回 fallback', async () => {
      const mockResult: AiStreamResult = {
        stream: mockStream(['不是 JSON']),
        fullText: Promise.resolve('不是 JSON'),
      }
      vi.mocked(callAiStream).mockResolvedValue(mockResult)

      const result = await streamGenerateOutlineParsed('测试', '冒险')

      expect(result.title).toBe('基于"测试"的故事')
      expect(result.scenes).toEqual([])
      expect(result.result).toBe('不是 JSON')
    })

    it('处理带 markdown 标记的 JSON', async () => {
      const jsonWithMarkdown = '```json\n{"title":"MD故事","scenes":[]}\n```'

      const mockResult: AiStreamResult = {
        stream: mockStream([jsonWithMarkdown]),
        fullText: Promise.resolve(jsonWithMarkdown),
      }
      vi.mocked(callAiStream).mockResolvedValue(mockResult)

      const result = await streamGenerateOutlineParsed('测试', '冒险')

      expect(result.title).toBe('MD故事')
      expect(result.scenes).toEqual([])
    })
  })
})
