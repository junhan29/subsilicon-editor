import type { AiConfig, AiOutlineResult, OutlineScene } from '../types'
import { callAi } from '../provider-registry'

export const OUTLINE_SYSTEM_PROMPT = `你是一个专业的互动叙事设计师。请根据主题和类型生成一个结构化的互动故事大纲。输出必须是严格的 JSON 格式，不要包含任何 markdown 标记或额外文字。

JSON 格式要求：
{
  "title": "故事标题",
  "scenes": [
    {
      "id": "scene-1",
      "title": "场景标题",
      "description": "场景描述，包含环境、人物状态和剧情要点",
      "characters": ["角色1", "角色2"],
      "choices": [
        {"text": "选择文本1", "nextSceneId": "scene-2"},
        {"text": "选择文本2", "nextSceneId": "scene-3"}
      ]
    }
  ]
}

注意：
1. 第一个场景作为开场，最后一个场景作为结局
2. 每个场景的 id 使用 "scene-N" 格式，N 从 1 开始
3. 角色名称要简洁，不要重复
4. 描述控制在 80-120 字
5. 至少提供 2 个选择分支（除了结局场景）
6. 确保场景之间逻辑连贯，形成完整的故事线`

export async function generateOutline(
  topic: string,
  genre: string,
  sceneCount: number = 5,
  config?: AiConfig | null
): Promise<AiOutlineResult> {
  const userPrompt = `主题：${topic}\n类型：${genre}\n场景数量：${sceneCount}`

  const rawResult = await callAi(
    {
      systemPrompt: OUTLINE_SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.8,
      maxTokens: 2000,
    },
    config
  )

  try {
    const jsonStr = rawResult.replace(/```json/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>

    return {
      title: typeof parsed.title === 'string' ? parsed.title : `基于"${topic}"的故事`,
      scenes: Array.isArray(parsed.scenes)
        ? parsed.scenes.map((scene: unknown, index: number) => parseScene(scene, index))
        : [],
      result: rawResult,
    }
  } catch {
    return {
      title: `基于"${topic}"的故事`,
      scenes: [],
      result: rawResult,
    }
  }
}

export function parseScene(scene: unknown, index: number): OutlineScene {
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
