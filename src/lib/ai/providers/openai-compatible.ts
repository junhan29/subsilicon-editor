import type { AiProviderConfig, AiRequestOptions } from '../types'
import { BaseAiProvider } from './base'
import {
  buildChatCompletionRequest,
  parseRemoteCompletionResponse,
  runStrictConnectivityTest,
} from '../request-builder'

export class OpenAiCompatibleProvider extends BaseAiProvider {
  readonly type = 'remote' as const

  constructor(
    public readonly id: string,
    public readonly name: string,
    private readonly config: AiProviderConfig
  ) {
    super()
  }

  isAvailable(): boolean {
    return !!this.config.apiKey && this.config.enabled && !!this.config.model
  }

  /** 严格同源连通性测试（与业务调用共用请求构建 / 解析逻辑） */
  async testConnectivity(): Promise<{
    ok: boolean
    status: number
    latencyMs: number
    error?: string
    content?: string
  }> {
    return runStrictConnectivityTest(this.config)
  }

  async generate(options: AiRequestOptions): Promise<string> {
    const req = buildChatCompletionRequest(this.config, options)
    const response = await fetch(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.body,
    })

    const text = await response.text()
    let data: unknown = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      if (!response.ok) throw new Error(`Remote API error: ${response.status} ${text.slice(0, 200)}`)
    }

    if (!response.ok) {
      const msg =
        data && typeof data === 'object' && (data as { error?: { message?: string } }).error?.message
          ? String((data as { error: { message: string } }).error.message)
          : `Remote API error: ${response.status}`
      throw new Error(msg)
    }
    return parseRemoteCompletionResponse(data).content
  }

  async *generateStream(options: AiRequestOptions): AsyncGenerator<string, void, unknown> {
    const req = buildChatCompletionRequest(this.config, options, { stream: true })
    const response = await fetch(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.body,
    })

    const text = await response.text()
    if (!response.ok) {
      let msg = `Remote API error: ${response.status}`
      try {
        const data = text ? JSON.parse(text) : null
        if (data && typeof data === 'object' && (data as { error?: { message?: string } }).error?.message) {
          msg = String((data as { error: { message: string } }).error.message)
        }
      } catch { /* ignore */ }
      throw new Error(msg)
    }

    // 某些实现（非流式的 mock 或 stream=false 时）直接返回完整 JSON
    try {
      const parsed = text ? JSON.parse(text) : null
      const staticText = parseRemoteCompletionResponse(parsed).content
      if (staticText) {
        for (let i = 0; i < staticText.length; i += 3) {
          yield staticText.slice(i, i + 3)
          await new Promise((r) => setTimeout(r, 10))
        }
        return
      }
    } catch { /* ignore, 正常 SSE 流 */ }

    // 将 text 重新作为 SSE 流逐行解析
    const reader = new Blob([text]).stream().getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          const dataLine = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed
          if (dataLine === '[DONE]') return

          try {
            const parsed = JSON.parse(dataLine)
            const content = parseRemoteCompletionResponse(parsed).content
            if (content) yield content
          } catch {
            // 忽略解析错误
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}
