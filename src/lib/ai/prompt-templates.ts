export interface PromptTemplate {
  id: string
  name: string
  description: string
  systemPrompt: string
  defaultTemperature: number
  defaultMaxTokens: number
  category: 'text' | 'character' | 'dialogue' | 'scene' | 'outline' | 'story'
}

const polishStylePrompts: Record<string, string> = {
  general: '请润色以下文字，使表达更流畅自然，保持原意：',
  vivid: '请将以下文字润色得更加生动形象，富有感染力，保持原意：',
  concise: '请精简以下文字，使表达更简洁有力，保持核心意思：',
  literary: '请用文学化的风格润色以下文字，增加文采，保持原意：',
}

const layoutStylePrompts: Record<string, string> = {
  dialogue: '请将以下内容排版成对话剧本格式，每行一个角色说话，用"角色名：内容"的格式，保持原意：',
  narrative: '请将以下内容排版成叙事文本格式，分段清晰，增加适当的描写，保持原意：',
  mixed: '请将以下内容排版成对话与叙事结合的剧本格式，合理分配对话和旁白，保持原意：',
}

const continueStylePrompts: Record<string, string> = {
  general: '请继续续写以下文字，保持风格一致，约 100 字：',
  vivid: '请继续续写以下文字，保持生动风格，约 100 字：',
  concise: '请继续续写以下文字，保持简洁风格，约 80 字：',
  literary: '请继续续写以下文字，保持文学风格，约 120 字：',
}

export const PROMPT_TEMPLATES: Record<string, PromptTemplate> = {
  'polish-general': {
    id: 'polish-general',
    name: '通用润色',
    description: '使文字更流畅自然',
    systemPrompt: polishStylePrompts.general,
    defaultTemperature: 0.7,
    defaultMaxTokens: 2000,
    category: 'text',
  },
  'polish-vivid': {
    id: 'polish-vivid',
    name: '生动润色',
    description: '使文字更生动有感染力',
    systemPrompt: polishStylePrompts.vivid,
    defaultTemperature: 0.7,
    defaultMaxTokens: 2000,
    category: 'text',
  },
  'polish-concise': {
    id: 'polish-concise',
    name: '精简润色',
    description: '使文字更简洁有力',
    systemPrompt: polishStylePrompts.concise,
    defaultTemperature: 0.7,
    defaultMaxTokens: 2000,
    category: 'text',
  },
  'polish-literary': {
    id: 'polish-literary',
    name: '文学润色',
    description: '增加文字文采',
    systemPrompt: polishStylePrompts.literary,
    defaultTemperature: 0.7,
    defaultMaxTokens: 2000,
    category: 'text',
  },
}

export function getPromptTemplate(id: string): PromptTemplate | undefined {
  return PROMPT_TEMPLATES[id]
}

export function getPromptTemplatesByCategory(
  category: PromptTemplate['category']
): PromptTemplate[] {
  return Object.values(PROMPT_TEMPLATES).filter((t) => t.category === category)
}

export function getAllPromptTemplates(): PromptTemplate[] {
  return Object.values(PROMPT_TEMPLATES)
}
