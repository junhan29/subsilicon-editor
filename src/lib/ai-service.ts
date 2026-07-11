import { chatCompletion, getActiveProvider, isAiConfigured } from './ai-client'
import type { StoryCharacter, CharacterGender } from '@editor/types/editor'

export interface OutlineChoice {
  text: string
  nextSceneId: string
}

export interface OutlineScene {
  id: string
  title: string
  description: string
  type: 'normal' | 'ending' | 'choice'
  choices?: OutlineChoice[]
  characters?: string[]
}

export interface AiOutlineResult {
  title: string
  synopsis?: string
  scenes: OutlineScene[]
}

export interface AiCharacter {
  id: string
  name: string
  gender: CharacterGender
  age: string
  occupation: string
  personality: string[]
  appearance: string[]
  background: string
  speech: {
    tone: string
    catchphrases: string[]
  }
  motivation: string
  bio: string
}

export interface AiFullStoryResult {
  title: string
  synopsis: string
  characters: AiCharacter[]
  scenes: OutlineScene[]
}

export async function isAiAvailable(): Promise<boolean> {
  return isAiConfigured()
}

export { getActiveProvider } from './ai-client'

export async function getAiConfig() {
  const { loadAiConfig } = await import('./ai-client')
  return loadAiConfig()
}

export async function resetAiRegistry() {
  const { saveAiConfig } = await import('./ai-client')
  await saveAiConfig({
    providers: [],
    enabled: false,
    defaultProviderId: '',
  })
}

export interface AiCharacterEnrichResult {
  personality: string[]
  appearance: string[]
  background: string
  speech: {
    tone: string
    catchphrases: string[]
  }
  skills: string[]
  motivation: string
  habits: string[]
  fears: string[]
  bio: string
  occupation: string
  age: string
  gender: CharacterGender
}

export async function enrichCharacter(char: Partial<StoryCharacter>, style = 'general'): Promise<AiCharacterEnrichResult> {
  const provider = await getActiveProvider()
  if (!provider) {
    throw new Error('请先在设置中配置 AI 服务商')
  }

  const stylePrompt: Record<string, string> = {
    general: '通用风格',
    vivid: '生动细腻、富有感染力',
    concise: '简洁有力、言简意赅',
    literary: '文学性强、富有文采',
  }

  const existingInfo = [
    char.name ? `姓名：${char.name}` : '',
    char.gender && char.gender !== 'unknown' ? `性别：${char.gender === 'male' ? '男' : char.gender === 'female' ? '女' : '其他'}` : '',
    char.age ? `年龄：${char.age}` : '',
    char.occupation ? `职业：${char.occupation}` : '',
    char.personality && char.personality.length > 0 ? `性格特点：${char.personality.join('、')}` : '',
    char.background ? `已有背景：${char.background}` : '',
  ].filter(Boolean).join('\n')

  const systemPrompt = `你是互动叙事角色设定专家。请根据提供的信息，丰富角色的各项设定。
要求：
1. 输出严格的 JSON 格式，不要包含任何额外文字
2. 性格、外貌、技能、习惯、恐惧各返回 3-6 个中文标签
3. 口头禅返回 2-3 个短句
4. 背景故事 80-150 字
5. 角色简介 30-50 字
6. 风格：${stylePrompt[style] || stylePrompt.general}

JSON 格式：
{
  "personality": ["标签1", "标签2"],
  "appearance": ["标签1", "标签2"],
  "background": "背景故事文本",
  "speech": { "tone": "说话语气", "catchphrases": ["口头禅1", "口头禅2"] },
  "skills": ["技能1", "技能2"],
  "motivation": "核心动机",
  "habits": ["习惯1", "习惯2"],
  "fears": ["恐惧1", "恐惧2"],
  "bio": "角色简介",
  "occupation": "职业",
  "age": "年龄（如"24岁"）",
  "gender": "male" | "female" | "other"
}`

  const userPrompt = `请丰富以下角色的设定：\n\n${existingInfo || '一个全新的角色'}`

  const result = await chatCompletion(
    provider,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    1024,
    0.8
  )

  return parseJsonResult<AiCharacterEnrichResult>(result)
}

export type PolishStyle = 'general' | 'vivid' | 'concise' | 'literary'

export async function polishDialogue(text: string, character?: { name: string; personality?: string[]; speechTone?: string }, style: PolishStyle = 'general'): Promise<string> {
  const provider = await getActiveProvider()
  if (!provider) {
    throw new Error('请先在设置中配置 AI 服务商')
  }

  const styleDesc: Record<PolishStyle, string> = {
    general: '保持原意，让对话更自然流畅',
    vivid: '让对话更生动、富有感染力，增加细节和情绪',
    concise: '精简对话，去掉冗余，更简洁有力',
    literary: '增加文学性，语言更优美',
  }

  const charInfo = character ? `
角色：${character.name}
${character.personality?.length ? `性格：${character.personality.join('、')}` : ''}
${character.speechTone ? `说话风格：${character.speechTone}` : ''}` : ''

  const systemPrompt = `你是互动叙事的对话润色专家。${styleDesc[style]}。
规则：
1. 保持原意和大致长度
2. 符合角色性格和说话风格
3. 直接输出润色后的文本，不要加引号或解释`

  const userPrompt = `${charInfo ? charInfo + '\n\n' : ''}原始对话：
${text}

请润色这段对话。`

  return chatCompletion(
    provider,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    512,
    0.7
  )
}

export async function expandScene(text: string, style: PolishStyle = 'vivid'): Promise<string> {
  const provider = await getActiveProvider()
  if (!provider) {
    throw new Error('请先在设置中配置 AI 服务商')
  }

  const styleDesc: Record<PolishStyle, string> = {
    general: '扩充场景描写，增加环境氛围细节',
    vivid: '生动细腻地描写场景，调动五感',
    concise: '精简但有力地补充关键环境细节',
    literary: '用文学性的语言描绘场景，增加意境',
  }

  const systemPrompt = `你是互动叙事的场景描写专家。${styleDesc[style]}。
规则：
1. 保持原文的核心信息和叙事节奏
2. 增加环境、氛围、光线、声音等细节
3. 直接输出扩写后的文本，不要加解释`

  const userPrompt = `原始旁白：
${text}

请扩写这段场景描写。`

  return chatCompletion(
    provider,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    1024,
    0.75
  )
}

function parseJsonResult<T>(text: string): T {
  let cleaned = text.trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    cleaned = jsonMatch[0]
  }
  try {
    return JSON.parse(cleaned) as T
  } catch {
    throw new Error('AI 返回结果解析失败，请重试')
  }
}
