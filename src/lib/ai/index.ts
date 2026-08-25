export * from './types'
export {
  getAiConfig,
  getActiveProvider,
  isAiAvailable,
  checkLocalAiAvailability,
  callAi,
  callAiStream,
  callAiForTask,
  callAiStreamForTask,
  getAvailableProviders,
  refreshAiConfig,
  resetAiRegistry,
  AiConfigNeededError,
} from './provider-registry'

export {
  getTaskRoutingConfig,
  saveTaskRoutingConfig,
  resetTaskRoutingConfig,
  getTaskRoutingProviders,
  resolveTextProviderForTask,
  resolveMediaProviderForTask,
  getTaskSkillPrompt,
  isMediaTask,
  isTextTask,
  type AiTaskRoutingConfig,
  type AiTaskType,
  type MediaTaskType,
  type TaskTextSlot,
  type TaskMediaSlot,
} from './task-routing'

export { polishText, layoutText, continueText } from './services/text-service'
export {
  generateCharacter,
  generateCharacterDetail,
} from './services/character-service'
export { generateDialogue } from './services/dialogue-service'
export {
  generateScene,
  generateSceneDescription,
} from './services/scene-service'
export { generateOutline } from './services/outline-service'
export { generateFullStory } from './services/full-story-service'
export {
  suggestNextPlot,
  generateNodeContent,
  enhanceCharacter,
} from './services/story-assist-service'
export type { PlotSuggestion, StoryBranchSuggestion } from './services/story-assist-service'

/** @deprecated 媒体生成已从核心 UI 移除，这些导出仅供向后兼容，插件请直接 import from './services/media-generation-service' */
export {
  generateMedia,
  generateAudio,
  generateMediaForTask,
  optimizePrompt,
  generateCharacterPrompt,
  buildConsistentImagePrompt,
  getGlobalStylePrompt,
  saveGlobalStylePrompt,
  getMediaProviderConfig,
  getMediaProviderConfigForTask,
  saveMediaProviderConfig,
} from './services/media-generation-service'
export type {
  AudioGenerationParams,
  ImageGenerationParams,
  VideoGenerationParams,
  VideoAspectRatio,
  MediaGenerationResult,
  MediaProviderConfig,
} from './services/media-generation-service'

export {
  streamPolishText,
  streamLayoutText,
  streamContinueText,
  streamGenerateOutline,
  streamGenerateOutlineParsed,
  streamGenerateCharacterDetail,
  streamGenerateDialogue,
  streamGenerateSceneDescription,
} from './services/stream-service'
export type { StreamCallbacks } from './services/stream-service'

export {
  getPromptTemplate,
  getPromptTemplatesByCategory,
  getAllPromptTemplates,
  PROMPT_TEMPLATES,
} from './prompt-templates'
export type { PromptTemplate } from './prompt-templates'

export {
  BUILTIN_SKILL_TEMPLATES,
  getSkillTemplate,
  getSkillTemplatesForTask,
} from './skill-templates'
export type { SkillTemplate } from './skill-templates'

/** @deprecated ComfyUI 已从核心 UI 移除，这些导出仅供向后兼容 */
export {
  WORKFLOW_PRESETS,
  getWorkflowPreset,
  injectPrompt,
  injectReferenceImage,
  validateWorkflow,
} from './comfyui-workflow'
export type {
  ComfyWorkflow,
  ComfyWorkflowNode,
  WorkflowNodeInfo,
  WorkflowPreset,
  WorkflowValidationResult,
} from './comfyui-workflow'
