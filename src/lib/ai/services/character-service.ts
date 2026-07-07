import type { AiConfig, AiGenerateResult, AiCharacterResult, AiCharacter } from '../types'
import { callAi } from '../provider-registry'

export const CHARACTER_DETAIL_SYSTEM_PROMPT = `你是一个专业的角色设计师。请根据角色名称、性格特点和故事类型，生成一个详细的角色设定。输出必须是严格的 JSON 格式，不要包含任何 markdown 标记或额外文字。

JSON 格式要求：
{
  "name": "角色名称",
  "gender": "male" | "female" | "other" | "unknown",
  "age": "年龄描述",
  "occupation": "职业",
  "personality": ["性格特点1", "性格特点2"],
  "appearance": ["外貌特征1", "外貌特征2"],
  "background": "背景故事，100字左右",
  "speech": {
    "tone": "说话风格",
    "catchphrases": ["口头禅1", "口头禅2"]
  },
  "motivation": "核心动机",
  "bio": "完整的角色简介，200字左右"
}

注意：
1. gender 必须是 "male"、"female"、"other" 或 "unknown" 之一
2. personality 和 appearance 是数组，每个元素不超过5个词
3. speech.tone 描述角色的说话风格
4. background 简明扼要地说明角色的过往经历
5. motivation 说明角色的核心驱动力`

export async function generateCharacterSimple(
  name: string,
  personality: string,
  config?: AiConfig | null
): Promise<AiGenerateResult> {
  const systemPrompt = `请根据以下信息生成一个角色的详细描述，包括外貌、性格、背景故事，约 150 字：`
  const userPrompt = `角色名：${name}\n性格特点：${personality}`

  const result = await callAi(
    {
      systemPrompt,
      userPrompt,
      temperature: 0.7,
      maxTokens: 300,
    },
    config
  )

  return { result }
}

export async function generateCharacterDetail(
  name: string,
  personality: string,
  genre: string = 'general',
  config?: AiConfig | null
): Promise<AiCharacterResult> {
  const userPrompt = `角色名：${name}\n性格特点：${personality}\n故事类型：${genre}`

  const rawResult = await callAi(
    {
      systemPrompt: CHARACTER_DETAIL_SYSTEM_PROMPT,
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
      character: parseCharacterFromJson(parsed, name),
      result: rawResult,
    }
  } catch {
    return {
      character: createFallbackCharacter(name, rawResult),
      result: rawResult,
    }
  }
}

export function parseCharacterFromJson(
  parsed: Record<string, unknown>,
  fallbackName: string
): AiCharacter {
  return {
    id: `char-${Date.now()}`,
    name: typeof parsed.name === 'string' ? parsed.name : fallbackName,
    gender: ['male', 'female', 'other', 'unknown'].includes(parsed.gender as string)
      ? (parsed.gender as AiCharacter['gender'])
      : 'unknown',
    age: typeof parsed.age === 'string' ? parsed.age : '',
    occupation: typeof parsed.occupation === 'string' ? parsed.occupation : '',
    personality: Array.isArray(parsed.personality)
      ? parsed.personality.filter((p: unknown) => typeof p === 'string')
      : [],
    appearance: Array.isArray(parsed.appearance)
      ? parsed.appearance.filter((a: unknown) => typeof a === 'string')
      : [],
    background: typeof parsed.background === 'string' ? parsed.background : '',
    speech: {
      tone: typeof (parsed.speech as Record<string, unknown>)?.tone === 'string'
        ? (parsed.speech as Record<string, string>).tone
        : '',
      catchphrases: Array.isArray((parsed.speech as Record<string, unknown>)?.catchphrases)
        ? (parsed.speech as Record<string, string[]>).catchphrases.filter(
            (cp: unknown) => typeof cp === 'string'
          )
        : [],
    },
    motivation: typeof parsed.motivation === 'string' ? parsed.motivation : '',
    bio: typeof parsed.bio === 'string' ? parsed.bio : '',
  }
}

export function createFallbackCharacter(name: string, rawResult: string): AiCharacter {
  return {
    id: `char-${Date.now()}`,
    name,
    gender: 'unknown',
    age: '',
    occupation: '',
    personality: [],
    appearance: [],
    background: '',
    speech: { tone: '', catchphrases: [] },
    motivation: '',
    bio: rawResult,
  }
}

export { generateCharacterSimple as generateCharacter }
