import type { AiProviderConfig, AiRequestOptions } from '../types'
import { BaseAiProvider } from './base'

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
    return !!this.config.apiKey && this.config.enabled
  }

  async generate(options: AiRequestOptions): Promise<string> {
    const apiUrl = this.config.apiUrl || this.getDefaultApiUrl()

    const response = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: options.systemPrompt },
          { role: 'user', content: options.userPrompt },
        ],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2000,
      }),
    })

    if (!response.ok) {
      throw new Error(`Remote API error: ${response.status}`)
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
  }

  async *generateStream(options: AiRequestOptions): AsyncGenerator<string, void, unknown> {
    const apiUrl = this.config.apiUrl || this.getDefaultApiUrl()

    const response = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: options.systemPrompt },
          { role: 'user', content: options.userPrompt },
        ],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2000,
        stream: true,
      }),
    })

    if (!response.ok) {
      throw new Error(`Remote API error: ${response.status}`)
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
          if (!trimmed || !trimmed.startsWith('data: ')) continue

          const data = trimmed.slice(6)
          if (data === '[DONE]') return

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) {
              yield content
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

  private getDefaultApiUrl(): string {
    switch (this.config.provider) {
      case 'openai':
        return 'https://api.openai.com/v1'
      case 'deepseek':
        return 'https://api.deepseek.com/v1'
      case 'anthropic':
        return 'https://api.anthropic.com/v1'
      case 'google':
        return 'https://generativelanguage.googleapis.com/v1'
      default:
        return 'https://api.openai.com/v1'
    }
  }
}
