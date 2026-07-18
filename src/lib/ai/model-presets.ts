import type { AiProviderType } from '@editor/types/ai'

export interface ModelPreset {
  id: string
  name: string
  description?: string
  /** 是否为推荐模型 */
  recommended?: boolean
}

export interface ProviderModelPresets {
  provider: AiProviderType
  models: ModelPreset[]
}

/** 各服务商的模型预设 */
export const MODEL_PRESETS: Record<string, ProviderModelPresets> = {
  openai: {
    provider: 'openai',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: '快速、经济，适合日常创作', recommended: true },
      { id: 'gpt-4o', name: 'GPT-4o', description: '旗舰多模态，最强综合能力' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: '高智能，128K 上下文' },
      { id: 'gpt-4.1', name: 'GPT-4.1', description: '最新版本，代码与指令遵循优化' },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', description: '轻量高效，性价比之选' },
      { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', description: '最快速，简单任务' },
      { id: 'o4-mini', name: 'o4 Mini', description: '深度推理，轻量快速' },
      { id: 'o3', name: 'o3', description: '深度推理，复杂逻辑' },
      { id: 'o3-mini', name: 'o3 Mini', description: '推理模型轻量版' },
    ],
  },
  anthropic: {
    provider: 'anthropic',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: '最佳综合性能，高速推理' },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', description: '最强能力，复杂任务首选', recommended: true },
      { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', description: '经典平衡之选' },
      { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku', description: '快速、经济' },
      { id: 'claude-3-opus-latest', name: 'Claude 3 Opus', description: '上代旗舰' },
    ],
  },
  deepseek: {
    provider: 'deepseek',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek V3', description: '通用对话，中文优化' },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1', description: '深度推理，逻辑分析', recommended: true },
      { id: 'deepseek-v3-0324', name: 'DeepSeek V3 (0324)', description: 'V3 最新版本，更强中文能力' },
    ],
  },
  google: {
    provider: 'google',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: '快速推理，低延迟', recommended: true },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: '最强性能，长上下文' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: '稳定版本' },
      { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', description: '最经济' },
    ],
  },
  baidu: {
    provider: 'baidu',
    models: [
      { id: 'ernie-4.0-turbo-8k', name: 'ERNIE 4.0 Turbo', description: '旗舰模型', recommended: true },
      { id: 'ernie-4.5-8k-preview', name: 'ERNIE 4.5', description: '最新版本，更强推理' },
      { id: 'ernie-3.5-8k', name: 'ERNIE 3.5', description: '经典版本' },
      { id: 'ernie-speed-8k', name: 'ERNIE Speed', description: '快速轻量' },
      { id: 'ernie-lite-8k', name: 'ERNIE Lite', description: '最经济' },
    ],
  },
  alibaba: {
    provider: 'alibaba',
    models: [
      { id: 'qwen-max', name: 'Qwen Max', description: '最强能力', recommended: true },
      { id: 'qwen-plus', name: 'Qwen Plus', description: '性能与速度平衡' },
      { id: 'qwen-turbo', name: 'Qwen Turbo', description: '快速推理' },
      { id: 'qwen3-235b-a22b', name: 'Qwen3 235B', description: '最新旗舰 MoE' },
      { id: 'qwq-32b', name: 'QWQ 32B', description: '深度推理专用' },
    ],
  },
  doubao: {
    provider: 'doubao',
    models: [
      { id: 'doubao-pro-32k', name: '豆包 Pro 32K', description: '旗舰，32K 上下文' },
      { id: 'doubao-pro-128k', name: '豆包 Pro 128K', description: '长上下文版本' },
      { id: 'doubao-lite-32k', name: '豆包 Lite 32K', description: '轻量快速', recommended: true },
      { id: 'doubao-lite-128k', name: '豆包 Lite 128K', description: '长上下文轻量版' },
      { id: 'doubao-1.5-pro-32k', name: '豆包 1.5 Pro', description: '最新旗舰' },
      { id: 'doubao-1.5-thinking-pro', name: '豆包 1.5 Thinking', description: '深度推理' },
    ],
  },
  zhipu: {
    provider: 'zhipu',
    models: [
      { id: 'glm-4-plus', name: 'GLM-4 Plus', description: '旗舰模型', recommended: true },
      { id: 'glm-4-flash', name: 'GLM-4 Flash', description: '快速免费' },
      { id: 'glm-4-air', name: 'GLM-4 Air', description: '轻量平衡' },
      { id: 'glm-4-long', name: 'GLM-4 Long', description: '超长上下文 128K' },
    ],
  },
  moonshot: {
    provider: 'moonshot',
    models: [
      { id: 'moonshot-v1-8k', name: 'Moonshot V1 8K', description: '标准上下文' },
      { id: 'moonshot-v1-32k', name: 'Moonshot V1 32K', description: '中等上下文' },
      { id: 'moonshot-v1-128k', name: 'Moonshot V1 128K', description: '长文本处理', recommended: true },
      { id: 'kimi-latest', name: 'Kimi Latest', description: 'Kimi 最新版本' },
    ],
  },
  custom: {
    provider: 'custom',
    models: [
      { id: 'gpt-4', name: 'GPT-4', description: '兼容 OpenAI 格式' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: '经典模型' },
    ],
  },
}

/** 获取指定服务商的模型列表 */
export function getModelsForProvider(provider: string): ModelPreset[] {
  return MODEL_PRESETS[provider]?.models || []
}

/** 获取指定服务商的默认模型 */
export function getDefaultModel(provider: string): string {
  const presets = MODEL_PRESETS[provider]
  if (!presets) return 'gpt-4o-mini'
  const recommended = presets.models.find((m) => m.recommended)
  return recommended?.id || presets.models[0]?.id || 'gpt-4o-mini'
}

/** 获取所有服务商的模型（扁平列表，用于模型切换器） */
export function getAllModelsByProvider(): Record<string, ModelPreset[]> {
  const result: Record<string, ModelPreset[]> = {}
  for (const [key, presets] of Object.entries(MODEL_PRESETS)) {
    result[presets.models[0]?.name || key] = presets.models
  }
  return result
}
