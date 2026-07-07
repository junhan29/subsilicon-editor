import type { AiConfig, AiDialogueResult } from '../types'
import { callAi } from '../provider-registry'

export const DIALOGUE_SYSTEM_PROMPT = `你是一个专业的剧本创作助手。请根据角色列表和上下文，生成一段自然流畅的对话。输出必须是严格的 JSON 格式，不要包含任何 markdown 标记或额外文字。

JSON 格式要求：
{
  "lines": [
    { "character": "角色名", "text": "对话内容", "emotion": "情绪描述（可选）" }
  ]
}

注意：
1. 每个角色的对话风格要符合其性格
2. 对话要自然流畅，不要太生硬
3. 情绪描述用简洁的词语，如：开心、悲伤、愤怒、惊讶等
4. 确保对话围绕上下文展开，有明确的目的和结果`

export async function generateDialogue(
  characterNames: string[],
  context: string,
  emotion: string = '',
  config?: AiConfig | null
): Promise<AiDialogueResult> {
  const emotionPrompt = emotion ? `\n整体情绪：${emotion}` : ''
  const userPrompt = `角色：${characterNames.join('、')}\n上下文：${context}${emotionPrompt}`

  const rawResult = await callAi(
    {
      systemPrompt: DIALOGUE_SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.7,
      maxTokens: 800,
    },
    config
  )

  try {
    const jsonStr = rawResult.replace(/```json/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>

    return {
      lines: Array.isArray(parsed.lines)
        ? parsed.lines
            .map((line: unknown) => {
              const l = line as Record<string, unknown>
              return {
                character: typeof l.character === 'string' ? l.character : '',
                text: typeof l.text === 'string' ? l.text : '',
                emotion: typeof l.emotion === 'string' ? l.emotion : undefined,
              }
            })
            .filter((l) => l.character && l.text)
        : [],
      result: rawResult,
    }
  } catch {
    const lines: { character: string; text: string; emotion?: string }[] = []
    const parts = rawResult.split(/\n/)
    for (const part of parts) {
      const match = part.match(/^(.+?)[：:] (.+)$/)
      if (match) {
        lines.push({ character: match[1].trim(), text: match[2].trim() })
      }
    }
    return { lines, result: rawResult }
  }
}
