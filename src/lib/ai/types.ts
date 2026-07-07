import type { AiConfig, AiProviderConfig } from '@editor/types/ai'

export type { AiConfig, AiProviderConfig }

export interface AiRequestOptions {
  systemPrompt: string
  userPrompt: string
  temperature?: number
  maxTokens?: number
}

export interface AiPolishResult {
  result: string
  remaining?: number
  limit?: number
}

export interface AiLayoutResult {
  result: string
  remaining?: number
  limit?: number
}

export interface AiGenerateResult {
  result: string
}

export interface OutlineScene {
  id: string
  title: string
  description: string
  characters: string[]
  choices?: { text: string; nextSceneId?: string }[]
}

export interface AiOutlineResult {
  title: string
  scenes: OutlineScene[]
  result: string
}

export interface AiCharacter {
  id: string
  name: string
  gender: 'male' | 'female' | 'other' | 'unknown'
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

export interface AiCharacterResult {
  character: AiCharacter
  result: string
}

export interface AiDialogueResult {
  lines: { character: string; text: string; emotion?: string }[]
  result: string
}

export interface AiSceneDescriptionResult {
  description: string
  backgroundImage: string
  mood: string
  lighting: string
  result: string
}

export interface AiFullStoryResult {
  title: string
  description: string
  characters: AiCharacter[]
  scenes: OutlineScene[]
  result: string
}

export type AiPolishStyle = 'general' | 'vivid' | 'concise' | 'literary'
export type AiLayoutType = 'dialogue' | 'narrative' | 'mixed'

export interface AiProvider {
  id: string
  name: string
  type: 'remote' | 'local'
  generate(options: AiRequestOptions): Promise<string>
  generateStream?(options: AiRequestOptions): AsyncGenerator<string, void, unknown>
  isAvailable(): Promise<boolean> | boolean
}

export interface AiStreamResult {
  stream: AsyncGenerator<string, void, unknown>
  fullText: Promise<string>
}
