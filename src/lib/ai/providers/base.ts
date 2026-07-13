import type { AiRequestOptions, AiProvider } from '../types'

export abstract class BaseAiProvider implements AiProvider {
  abstract id: string
  abstract name: string
  abstract type: 'remote' | 'local'

  abstract generate(options: AiRequestOptions): Promise<string>
  abstract isAvailable(): Promise<boolean> | boolean

  async *generateStream?(options: AiRequestOptions): AsyncGenerator<string, void, unknown> {
    const result = await this.generate(options)
    for (let i = 0; i < result.length; i++) {
      yield result[i]
      await new Promise((r) => setTimeout(r, 10))
    }
  }

  protected extractJson(text: string): string {
    return text.replace(/```json/g, '').replace(/```/g, '').trim()
  }

  protected safeParseJson<T = unknown>(text: string, fallback: T): T {
    try {
      const jsonStr = this.extractJson(text)
      return JSON.parse(jsonStr) as T
    } catch {
      return fallback
    }
  }
}
