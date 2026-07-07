import type { AiConfig, AiGenerateResult, AiSceneDescriptionResult } from '../types'
import { callAi } from '../provider-registry'

export const SCENE_DESCRIPTION_SYSTEM_PROMPT = `你是一个专业的场景描述师。请根据地点、时间和氛围，生成详细的场景描述。输出必须是严格的 JSON 格式，不要包含任何 markdown 标记或额外文字。

JSON 格式要求：
{
  "description": "场景详细描述，150字左右",
  "backgroundImage": "适合作为背景的图片描述，用于 AI 图像生成",
  "mood": "场景的整体氛围",
  "lighting": "光线描述"
}

注意：
1. description 要生动具体，包含感官细节
2. backgroundImage 要清晰描述画面内容，便于图像生成
3. mood 使用简洁的词语描述氛围
4. lighting 描述光线条件和效果`

export async function generateSceneSimple(
  location: string,
  atmosphere: string,
  config?: AiConfig | null
): Promise<AiGenerateResult> {
  const systemPrompt = `请根据以下信息生成一个场景的详细描述，包括环境、氛围、细节，约 100 字：`
  const userPrompt = `地点：${location}\n氛围：${atmosphere}`

  const result = await callAi(
    {
      systemPrompt,
      userPrompt,
      temperature: 0.7,
      maxTokens: 200,
    },
    config
  )

  return { result }
}

export async function generateSceneDescription(
  location: string,
  timeOfDay: string,
  mood: string,
  config?: AiConfig | null
): Promise<AiSceneDescriptionResult> {
  const userPrompt = `地点：${location}\n时间：${timeOfDay}\n氛围：${mood}`

  const rawResult = await callAi(
    {
      systemPrompt: SCENE_DESCRIPTION_SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.7,
      maxTokens: 600,
    },
    config
  )

  try {
    const jsonStr = rawResult.replace(/```json/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>

    return {
      description: typeof parsed.description === 'string' ? parsed.description : '',
      backgroundImage: typeof parsed.backgroundImage === 'string' ? parsed.backgroundImage : '',
      mood: typeof parsed.mood === 'string' ? parsed.mood : mood,
      lighting: typeof parsed.lighting === 'string' ? parsed.lighting : '',
      result: rawResult,
    }
  } catch {
    return {
      description: rawResult,
      backgroundImage: `${location}, ${timeOfDay}, ${mood}`,
      mood,
      lighting: '',
      result: rawResult,
    }
  }
}

export { generateSceneSimple as generateScene }
