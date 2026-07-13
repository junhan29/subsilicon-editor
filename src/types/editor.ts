export type ComicNodeType =
  | 'dialogue'
  | 'choice'
  | 'narration'
  | 'ending'
  | 'unlock'
  | 'gather'
  | 'condition'
  | 'cg'
  | 'jump'
  | 'random'

export type PuzzleLayerType =
  | 'background'
  | 'image'
  | 'character'
  | 'text'
  | 'effect'

export interface PuzzleLayer {
  id: string
  name: string
  type: PuzzleLayerType
  visible: boolean
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  zIndex: number
  assetId?: string
  url: string
  characterId?: string
  emotion?: string
  animation?: {
    type: 'fade-in' | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down' | 'zoom-in' | 'bounce' | 'none'
    duration: number
    delay: number
  }
  textContent?: string
  fontSize?: number
  fontColor?: string
}

export interface PuzzleScene {
  id: string
  name: string
  width: number
  height: number
  thumbnail?: string
  layers: PuzzleLayer[]
  createdAt: number
  updatedAt: number
}

export interface ComicScene {
  id: string
  name: string
  backgroundImage: string
  thumbnail?: string
  width?: number
  height?: number
  style?: string
  era?: string
  puzzleData?: PuzzleScene
}

export type CharacterGender = 'male' | 'female' | 'other' | 'unknown'

export type EmotionType = 'normal' | 'happy' | 'sad' | 'angry' | 'surprised' | 'embarrassed' | 'thinking' | 'scared' | 'crying' | 'laughing'

export interface CharacterSprite {
  id?: string
  emotion: string            // 表情：normal/happy/angry/sad/surprised 等
  image?: string             // 立绘URL（兼容旧字段）
  url?: string               // 立绘URL（新字段，优先使用）
  name?: string
  position?: 'left' | 'center' | 'right'
  scale?: number
  opacity?: number
}

export interface ComicCharacter {
  id: string
  name: string
  avatar: string
  sprites: CharacterSprite[]
  color: string
  gender?: CharacterGender
  voiceUrl?: string
}

export interface DialogueData {
  characterId: string
  spriteEmotion?: string
  spritePosition?: 'left' | 'center' | 'right'
  text: string
  fontSize?: number
  fontColor?: string
  textAnimation?: 'typewriter' | 'fade' | 'none'
  bgsound?: string
  voiceUrl?: string
  backgroundImage?: string
  bgm?: string
  bgmVolume?: number
  bgs?: string
  bgsVolume?: number
  seUrl?: string
  seVolume?: number
  emotion?: string
}

export interface NarrationData {
  text: string
  fontSize?: number
  fontColor?: string
  textAnimation?: 'none' | 'typewriter' | 'fade' | 'slide-up'
  backgroundColor?: string
  bgm?: string
  bgmVolume?: number
}

export interface ChoiceOption {
  id: string
  text: string
  icon?: string
  condition?: string
  nextNodeId?: string
  effects?: {
    variableName: string
    operation: 'set' | 'add' | 'subtract'
    value: string | number | boolean
  }[]
  variableEffect?: {
    variableName: string
    operation: 'set' | 'add' | 'subtract' | 'multiply'
    value: string | number | boolean
  }
}

export interface ChoiceData {
  prompt?: string
  options: ChoiceOption[]
  defaultNext?: string
}

export type TransitionType =
  | 'none'
  | 'fade'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'zoom-in'
  | 'zoom-out'
  | 'wipe'
  | 'cross-dissolve'

export interface TransitionData {
  type: TransitionType
  duration?: number
}

export interface EndingData {
  title: string
  subtitle?: string
  text?: string
  coverImage?: string
  endingType: 'good' | 'bad' | 'neutral' | 'secret'
  bgm?: string
  bgmVolume?: number
}

export type CgMediaType = 'image' | 'video'

export interface CgData {
  mediaType: CgMediaType
  url: string
  title?: string
  subtitle?: string
  duration?: number           // 0 表示点击继续
  canSkip?: boolean
  transitionIn?: TransitionType
  transitionOut?: TransitionType
  transitionDuration?: number
  bgm?: string
  bgmVolume?: number
  soundEffect?: string
  letterbox?: boolean
  displayMode?: 'contain' | 'cover' | 'fill' | 'custom'
  customWidth?: number    // 百分比 (10-100)
  customHeight?: number   // 百分比 (10-100)
  objectPosition?: string // CSS object-position 值，如 'center top'
}

export interface SceneData {
  sceneId: string
  transition?: TransitionData
}

export type ComicNodeData =
  | SceneData
  | DialogueData
  | NarrationData
  | ChoiceData
  | TransitionData
  | EndingData
  | CgData

export interface ComicNode {
  id: string
  type: ComicNodeType
  position: { x: number; y: number }
  data: ComicNodeData
}

export interface ComicEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  condition?: string
  transition?: TransitionType
}

export interface ComicVariable {
  id: string
  name: string
  type: 'string' | 'number' | 'boolean'
  initialValue: string | number | boolean
  description?: string
}

export interface ConditionClause {
  id: string
  variable: string
  operator: '==' | '!=' | '>' | '>=' | '<' | '<=' | 'contains' | 'startsWith' | 'endsWith'
  value: string | number | boolean
  valueType: 'string' | 'number' | 'boolean'
}

export interface ConditionGroup {
  id: string
  logic: 'AND' | 'OR'
  clauses: ConditionClause[]
}

export interface ComicAudio {
  id: string
  name: string
  type: 'bgm' | 'sfx' | 'voice'
  url: string
  loop?: boolean         // 仅 BGM 支持循环
  volume?: number
}

export interface ComicSettings {
  title: string
  description?: string
  coverImage?: string
  tags: string[]
  defaultBgm?: string
  defaultTransition?: TransitionType
  defaultTextSpeed?: number
  defaultAutoPlay?: boolean
  customCss?: string
}

export interface NodeGroup {
  id: string
  name: string
  color: string
  nodeIds: string[]
  collapsed: boolean
  position: { x: number; y: number }
  size: { width: number; height: number }
}

export const GROUP_COLORS = [
  { name: '蓝色', value: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.5)' },
  { name: '绿色', value: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.5)' },
  { name: '紫色', value: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)', border: 'rgba(168, 85, 247, 0.5)' },
  { name: '橙色', value: '#f97316', bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.5)' },
  { name: '粉色', value: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)', border: 'rgba(236, 72, 153, 0.5)' },
  { name: '灰色', value: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)', border: 'rgba(107, 114, 128, 0.5)' },
]

export interface ComicGraph {
  settings: ComicSettings
  scenes: ComicScene[]
  characters: ComicCharacter[]
  variables: ComicVariable[]
  nodes: ComicNode[]
  edges: ComicEdge[]
  audios: ComicAudio[]
  groups: NodeGroup[]
}

export type ComicTemplateId = 'romance' | 'adventure' | 'mystery' | 'custom'

export interface ComicTemplate {
  id: ComicTemplateId
  name: string
  description: string
  coverImage: string
  category: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  features: string[]
  defaultConfig: Partial<ComicSettings>
  initialScenes?: ComicScene[]
  initialCharacters?: ComicCharacter[]
  sampleNodes?: ComicNode[]
  sampleEdges?: ComicEdge[]
}

export const COMIC_TEMPLATES: ComicTemplate[] = [
  {
    id: 'romance',
    name: '恋爱漫剧',
    description: '甜蜜恋爱故事模板，适合新手入门',
    coverImage: 'https://picsum.photos/seed/romance/800/600',
    category: '恋爱',
    difficulty: 'beginner',
    features: ['角色管理', '立绘表情', '分支选择', '多结局'],
    defaultConfig: {
      tags: ['恋爱', '甜蜜'],
      defaultTransition: 'fade',
      defaultTextSpeed: 50,
    },
  },
  {
    id: 'adventure',
    name: '冒险故事',
    description: '热血冒险故事模板，支持战斗系统',
    coverImage: 'https://picsum.photos/seed/adventure/800/600',
    category: '冒险',
    difficulty: 'intermediate',
    features: ['战斗系统', '道具收集', '同伴支援', '隐藏结局'],
    defaultConfig: {
      tags: ['冒险', '热血'],
      defaultTransition: 'slide-left',
      defaultTextSpeed: 40,
    },
  },
  {
    id: 'mystery',
    name: '悬疑推理',
    description: '烧脑悬疑故事模板，层层推理',
    coverImage: 'https://picsum.photos/seed/mystery/800/600',
    category: '悬疑',
    difficulty: 'advanced',
    features: ['证据收集', '推理系统', '多嫌疑人', '隐藏真相'],
    defaultConfig: {
      tags: ['悬疑', '推理'],
      defaultTransition: 'zoom-in',
      defaultTextSpeed: 60,
    },
  },
]

// 兼容旧版类型（用于迁移）
export type TemplateId = ComicTemplateId

export interface StoryCharacter {
  id: string
  name: string
  avatar: string
  color: string
  gender: CharacterGender
  age: string
  occupation: string
  personality: string[]
  appearance: string[]
  background: string
  speech: {
    tone: string
    catchphrases: string[]
    rhythm?: string
    vocabulary?: string
  }
  skills: string[]
  motivation: string
  habits: string[]
  fears: string[]
  relations: { targetId: string; relation: string }[]
  tags: string[]
  bio: string
  voice?: string
  sprites?: CharacterSprite[]
}

export interface StoryVariable {
  name: string
  initialValue: string | number | boolean
  type: 'string' | 'number' | 'boolean'
}

export interface StoryNode {
  id: string
  type: ComicNodeType
  position: { x: number; y: number }
  data: Record<string, unknown>
}

export interface StoryEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  label?: string
  condition?: string
  data?: {
    label?: string
    condition?: string
  }
}

export interface StoryGraph {
  title: string
  description: string
  templateId: TemplateId
  characters: StoryCharacter[]
  variables: StoryVariable[]
  nodes: StoryNode[]
  edges: StoryEdge[]
  settings: ComicSettings & {
    bgm?: string
    backgroundColor?: string
    fontFamily?: string
    customCss?: string
    tags?: string[]
  }
  assets: {
    images: string[]
    audios: string[]
    fonts: string[]
  }
  scenes?: ComicScene[]
  audios?: ComicAudio[]
  groups?: NodeGroup[]
  annotations?: NodeAnnotation[]
  monetization?: import('@editor/lib/work-monetization').MonetizationConfig
}

export type AnnotationType = 'comment' | 'todo' | 'warning' | 'idea'

export interface AnnotationReply {
  id: string
  text: string
  author: string
  createdAt: number
}

export interface NodeAnnotation {
  id: string
  nodeId: string
  type: AnnotationType
  text: string
  author: string
  createdAt: number
  resolved: boolean
  replies?: AnnotationReply[]
}

export const ANNOTATION_TYPE_META: Record<
  AnnotationType,
  { label: string; color: string; bg: string; border: string }
> = {
  comment: { label: '评论', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.45)' },
  todo:    { label: 'TODO', color: '#eab308', bg: 'rgba(234, 179, 8, 0.12)', border: 'rgba(234, 179, 8, 0.45)' },
  warning: { label: '警告', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.45)' },
  idea:    { label: '想法', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.45)' },
}

export interface TemplateDefinition {
  id: TemplateId
  name: string
  icon: string
  description: string
  supportedNodes: ComicNodeType[]
  features?: string[]
  defaultConfig: {
    backgroundColor: string
    fontFamily: string
  }
  defaultNodes: StoryNode[]
  defaultEdges: StoryEdge[]
}

export const TEMPLATES: TemplateDefinition[] = COMIC_TEMPLATES as unknown as TemplateDefinition[]

export interface OutlineItem {
  id: string
  type: 'chapter' | 'node'
  title: string
  level: number
  children: OutlineItem[]
  nodeType?: string
}

export interface NodeTemplate {
  id: string
  name: string
  description?: string
  category: 'custom' | 'official'
  nodes: StoryNode[]
  edges: StoryEdge[]
  createdAt: number
  thumbnail?: string
}
