import type { AiConfig, AiFullStoryResult, AiCharacter, OutlineScene } from '../types'
import { callAi } from '../provider-registry'

const FULL_STORY_SYSTEM_PROMPT = `你是一个专业的互动叙事设计师。请根据主题和类型，生成一个完整的互动故事。输出必须是严格的 JSON 格式，不要包含任何 markdown 标记或额外文字。

JSON 格式要求：
{
  "title": "故事标题",
  "description": "故事简介，100字左右",
  "characters": [
    {
      "name": "角色名",
      "gender": "male" | "female" | "other" | "unknown",
      "age": "年龄",
      "occupation": "职业",
      "personality": ["特点1", "特点2"],
      "background": "背景故事",
      "speech": { "tone": "说话风格", "catchphrases": ["口头禅"] },
      "motivation": "核心动机"
    }
  ],
  "scenes": [
    {
      "id": "scene-1",
      "title": "场景标题",
      "description": "场景描述",
      "characters": ["角色1", "角色2"],
      "location": "地点",
      "timeOfDay": "时间",
      "choices": [
        {"text": "选择文本1", "nextSceneId": "scene-2"},
        {"text": "选择文本2", "nextSceneId": "scene-3"}
      ]
    }
  ]
}

注意：
1. 第一个场景作为开场，最后一个场景作为结局
2. 每个场景的 id 使用 "scene-N" 格式
3. 角色数量适中，每个角色要有独特的性格和背景
4. 场景之间逻辑连贯，形成完整的故事线
5. 至少提供 2 个选择分支（除了结局场景）
6. 确保故事有吸引力和互动性`

export async function generateFullStory(
  topic: string,
  genre: string,
  characterCount: number = 3,
  sceneCount: number = 5,
  config?: AiConfig | null
): Promise<AiFullStoryResult> {
  const userPrompt = `主题：${topic}\n类型：${genre}\n角色数量：${characterCount}\n场景数量：${sceneCount}`

  const rawResult = await callAi(
    {
      systemPrompt: FULL_STORY_SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.8,
      maxTokens: 3000,
    },
    config
  )

  try {
    const jsonStr = rawResult.replace(/```json/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>

    return {
      title: typeof parsed.title === 'string' ? parsed.title : `基于"${topic}"的故事`,
      description: typeof parsed.description === 'string' ? parsed.description : '',
      characters: Array.isArray(parsed.characters)
        ? parsed.characters.map((char: unknown, index: number) =>
            parseCharacter(char, index)
          )
        : [],
      scenes: Array.isArray(parsed.scenes)
        ? parsed.scenes.map((scene: unknown, index: number) => parseScene(scene, index))
        : [],
      result: rawResult,
    }
  } catch {
    return {
      title: `基于"${topic}"的故事`,
      description: '',
      characters: [],
      scenes: [],
      result: rawResult,
    }
  }
}

function parseCharacter(char: unknown, index: number): AiCharacter {
  const c = char as Record<string, unknown>
  return {
    id: `char-${Date.now()}-${index}`,
    name: typeof c.name === 'string' ? c.name : `角色${index + 1}`,
    gender: ['male', 'female', 'other', 'unknown'].includes(c.gender as string)
      ? (c.gender as AiCharacter['gender'])
      : 'unknown',
    age: typeof c.age === 'string' ? c.age : '',
    occupation: typeof c.occupation === 'string' ? c.occupation : '',
    personality: Array.isArray(c.personality)
      ? c.personality.filter((p: unknown) => typeof p === 'string')
      : [],
    appearance: [],
    background: typeof c.background === 'string' ? c.background : '',
    speech: {
      tone: typeof (c.speech as Record<string, unknown>)?.tone === 'string'
        ? (c.speech as Record<string, string>).tone
        : '',
      catchphrases: Array.isArray((c.speech as Record<string, unknown>)?.catchphrases)
        ? (c.speech as Record<string, string[]>).catchphrases.filter(
            (cp: unknown) => typeof cp === 'string'
          )
        : [],
    },
    motivation: typeof c.motivation === 'string' ? c.motivation : '',
    bio: typeof c.background === 'string' ? c.background : '',
  }
}

function parseScene(scene: unknown, index: number): OutlineScene {
  const s = scene as Record<string, unknown>
  return {
    id: typeof s.id === 'string' ? s.id : `scene-${index + 1}`,
    title: typeof s.title === 'string' ? s.title : `场景 ${index + 1}`,
    description: typeof s.description === 'string' ? s.description : '',
    characters: Array.isArray(s.characters)
      ? s.characters.filter((c) => typeof c === 'string') as string[]
      : [],
    choices: Array.isArray(s.choices)
      ? s.choices
          .map((c: unknown) => {
            const choice = c as Record<string, unknown>
            return {
              text: typeof choice.text === 'string' ? choice.text : '',
              nextSceneId:
                typeof choice.nextSceneId === 'string' ? choice.nextSceneId : undefined,
            }
          })
          .filter((c) => c.text)
      : undefined,
  }
}
