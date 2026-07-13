import type { AiConfig, AiPolishResult, AiLayoutResult, AiGenerateResult, AiPolishStyle, AiLayoutType } from '../types'
import { callAi } from '../provider-registry'

export const STYLE_PROMPTS: Record<AiPolishStyle, string> = {
  general: '请润色以下文字，使表达更流畅自然，保持原意：',
  vivid: '请将以下文字润色得更加生动形象，富有感染力，保持原意：',
  concise: '请精简以下文字，使表达更简洁有力，保持核心意思：',
  literary: '请用文学化的风格润色以下文字，增加文采，保持原意：',
}

export const LAYOUT_PROMPTS: Record<AiLayoutType, string> = {
  dialogue: '请将以下内容排版成对话剧本格式，每行一个角色说话，用"角色名：内容"的格式，保持原意：',
  narrative: '请将以下内容排版成叙事文本格式，分段清晰，增加适当的描写，保持原意：',
  mixed: '请将以下内容排版成对话与叙事结合的剧本格式，合理分配对话和旁白，保持原意：',
}

export const CONTINUE_STYLE_PROMPTS: Record<AiPolishStyle, string> = {
  general: '请继续续写以下文字，保持风格一致，约 100 字：',
  vivid: '请继续续写以下文字，保持生动风格，约 100 字：',
  concise: '请继续续写以下文字，保持简洁风格，约 80 字：',
  literary: '请继续续写以下文字，保持文学风格，约 120 字：',
}

export async function polishText(
  text: string,
  style: AiPolishStyle = 'general',
  config?: AiConfig | null
): Promise<AiPolishResult> {
  const result = await callAi(
    {
      systemPrompt: STYLE_PROMPTS[style] || STYLE_PROMPTS.general,
      userPrompt: text,
      temperature: 0.7,
    },
    config
  )

  return { result }
}

export async function layoutText(
  text: string,
  layoutType: AiLayoutType = 'dialogue',
  config?: AiConfig | null
): Promise<AiLayoutResult> {
  const result = await callAi(
    {
      systemPrompt: LAYOUT_PROMPTS[layoutType] || LAYOUT_PROMPTS.dialogue,
      userPrompt: text,
      temperature: 0.5,
    },
    config
  )

  return { result }
}

export async function continueText(
  text: string,
  style: AiPolishStyle = 'general',
  config?: AiConfig | null
): Promise<AiGenerateResult> {
  const result = await callAi(
    {
      systemPrompt: CONTINUE_STYLE_PROMPTS[style] || CONTINUE_STYLE_PROMPTS.general,
      userPrompt: text,
      temperature: 0.8,
      maxTokens: 200,
    },
    config
  )

  return { result }
}
