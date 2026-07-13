import type { AiRequestOptions } from '../types'
import { BaseAiProvider } from './base'
import { isOllamaAvailable, generateCompletion, getOllamaConfig } from '../../local-ai-service'

export class OllamaProvider extends BaseAiProvider {
  readonly id = 'ollama-local'
  readonly name = 'Ollama 本地模型'
  readonly type = 'local' as const

  private available: boolean | null = null

  async isAvailable(): Promise<boolean> {
    if (this.available !== null) {
      return this.available
    }
    this.available = await isOllamaAvailable()
    return this.available
  }

  async generate(options: AiRequestOptions): Promise<string> {
    const available = await this.isAvailable()
    if (!available) {
      throw new Error('本地 AI 不可用，请检查 Ollama 是否已启动')
    }

    try {
      return await generateCompletion(
        options.userPrompt,
        options.systemPrompt,
        {
          temperature: options.temperature,
          maxTokens: options.maxTokens,
        }
      )
    } catch (error) {
      throw new Error('本地 AI 调用失败，请检查 Ollama 是否已启动')
    }
  }

  async *generateStream(options: AiRequestOptions): AsyncGenerator<string, void, unknown> {
    const available = await this.isAvailable()
    if (!available) {
      throw new Error('本地 AI 不可用，请检查 Ollama 是否已启动')
    }

    const ollamaConfig = getOllamaConfig()

    const response = await fetch(`${ollamaConfig.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ollamaConfig.model,
        prompt: options.userPrompt,
        system: options.systemPrompt,
        temperature: options.temperature ?? ollamaConfig.temperature,
        max_tokens: options.maxTokens ?? ollamaConfig.maxTokens,
        stream: true,
      }),
    })

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Response body is not readable')
    }

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

          try {
            const parsed = JSON.parse(trimmed)
            if (parsed.response) {
              yield parsed.response
            }
            if (parsed.done) {
              return
            }
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

export const ollamaProvider = new OllamaProvider()
