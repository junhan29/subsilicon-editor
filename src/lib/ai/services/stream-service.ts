import type {
  AiConfig,
  AiPolishResult,
  AiLayoutResult,
  AiGenerateResult,
  AiOutlineResult,
  AiCharacterResult,
  AiDialogueResult,
  AiSceneDescriptionResult,
  AiPolishStyle,
  AiLayoutType,
  AiStreamResult,
} from '../types'
import { callAiStream } from '../provider-registry'
import {
  STYLE_PROMPTS,
  LAYOUT_PROMPTS,
  CONTINUE_STYLE_PROMPTS,
} from './text-service'
import { OUTLINE_SYSTEM_PROMPT, parseScene } from './outline-service'
import {
  CHARACTER_DETAIL_SYSTEM_PROMPT,
  parseCharacterFromJson,
  createFallbackCharacter,
} from './character-service'
import { DIALOGUE_SYSTEM_PROMPT } from './dialogue-service'
import { SCENE_DESCRIPTION_SYSTEM_PROMPT } from './scene-service'

export interface StreamCallbacks {
  onChunk?: (chunk: string) => void
  onDone?: (fullText: string) => void
  onError?: (error: unknown) => void
}

export async function streamPolishText(
  text: string,
  style: AiPolishStyle = 'general',
  config?: AiConfig | null,
  callbacks?: StreamCallbacks
): Promise<AiStreamResult> {
  const { stream, fullText } = await callAiStream(
    {
      systemPrompt: STYLE_PROMPTS[style] || STYLE_PROMPTS.general,
      userPrompt: text,
      temperature: 0.7,
    },
    config
  )

  pipeStream(stream, callbacks)

  return { stream, fullText }
}

export async function streamLayoutText(
  text: string,
  layoutType: AiLayoutType = 'dialogue',
  config?: AiConfig | null,
  callbacks?: StreamCallbacks
): Promise<AiStreamResult> {
  const { stream, fullText } = await callAiStream(
    {
      systemPrompt: LAYOUT_PROMPTS[layoutType] || LAYOUT_PROMPTS.dialogue,
      userPrompt: text,
      temperature: 0.5,
    },
    config
  )

  pipeStream(stream, callbacks)

  return { stream, fullText }
}

export async function streamContinueText(
  text: string,
  style: AiPolishStyle = 'general',
  config?: AiConfig | null,
  callbacks?: StreamCallbacks
): Promise<AiStreamResult> {
  const { stream, fullText } = await callAiStream(
    {
      systemPrompt: CONTINUE_STYLE_PROMPTS[style] || CONTINUE_STYLE_PROMPTS.general,
      userPrompt: text,
      temperature: 0.8,
      maxTokens: 200,
    },
    config
  )

  pipeStream(stream, callbacks)

  return { stream, fullText }
}

export async function streamGenerateOutline(
  topic: string,
  genre: string,
  sceneCount: number = 5,
  config?: AiConfig | null,
  callbacks?: StreamCallbacks
): Promise<AiStreamResult> {
  const userPrompt = `主题：${topic}\n类型：${genre}\n场景数量：${sceneCount}`

  const { stream, fullText } = await callAiStream(
    {
      systemPrompt: OUTLINE_SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.8,
      maxTokens: 2000,
    },
    config
  )

  pipeStream(stream, callbacks)

  return { stream, fullText }
}

export async function streamGenerateOutlineParsed(
  topic: string,
  genre: string,
  sceneCount: number = 5,
  config?: AiConfig | null,
  callbacks?: StreamCallbacks
): Promise<AiOutlineResult> {
  const { fullText } = await streamGenerateOutline(
    topic,
    genre,
    sceneCount,
    config,
    callbacks
  )

  const rawResult = await fullText

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

function pipeStream(
  stream: AsyncGenerator<string, void, unknown>,
  callbacks?: StreamCallbacks
): void {
  if (!callbacks) return

  const { onChunk, onDone, onError } = callbacks

  ;(async () => {
    try {
      let full = ''
      for await (const chunk of stream) {
        full += chunk
        onChunk?.(chunk)
      }
      onDone?.(full)
    } catch (error) {
      onError?.(error)
    }
  })()
}

export async function streamGenerateCharacterDetail(
  name: string,
  personality: string,
  genre: string = 'general',
  config?: AiConfig | null,
  callbacks?: StreamCallbacks
): Promise<AiCharacterResult> {
  const userPrompt = `角色名：${name}\n性格特点：${personality}\n故事类型：${genre}`

  const { fullText } = await callAiStream(
    {
      systemPrompt: CHARACTER_DETAIL_SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.7,
      maxTokens: 800,
    },
    config
  )

  pipeStream(await fullText, callbacks)

  const rawResult = await fullText

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

export async function streamGenerateDialogue(
  characterNames: string[],
  context: string,
  emotion: string = '',
  config?: AiConfig | null,
  callbacks?: StreamCallbacks
): Promise<AiDialogueResult> {
  const emotionPrompt = emotion ? `\n整体情绪：${emotion}` : ''
  const userPrompt = `角色：${characterNames.join('、')}\n上下文：${context}${emotionPrompt}`

  const { fullText } = await callAiStream(
    {
      systemPrompt: DIALOGUE_SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.7,
      maxTokens: 800,
    },
    config
  )

  pipeStream(await fullText, callbacks)

  const rawResult = await fullText

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

export async function streamGenerateSceneDescription(
  location: string,
  timeOfDay: string,
  mood: string,
  config?: AiConfig | null,
  callbacks?: StreamCallbacks
): Promise<AiSceneDescriptionResult> {
  const userPrompt = `地点：${location}\n时间：${timeOfDay}\n氛围：${mood}`

  const { fullText } = await callAiStream(
    {
      systemPrompt: SCENE_DESCRIPTION_SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.7,
      maxTokens: 600,
    },
    config
  )

  pipeStream(await fullText, callbacks)

  const rawResult = await fullText

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
