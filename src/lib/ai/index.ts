export * from './types'
export {
  getAiConfig,
  getActiveProvider,
  isAiAvailable,
  checkLocalAiAvailability,
  callAi,
  callAiStream,
  getAvailableProviders,
  refreshAiConfig,
  resetAiRegistry,
} from './provider-registry'

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

export {
  generateMedia,
  optimizePrompt,
  generateCharacterPrompt,
  buildConsistentImagePrompt,
  getMediaProviderConfig,
  saveMediaProviderConfig,
} from './services/media-generation-service'
export type {
  ImageGenerationParams,
  VideoGenerationParams,
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
