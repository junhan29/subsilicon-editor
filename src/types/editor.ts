// SubSilicon 互动漫剧编辑器类型定义

// ---
// 节点类型 - 重新定义为分镜式
// ---

export type ComicNodeType =
  | 'dialogue'     // 对话
  | 'choice'       // 分支选择
  | 'narration'    // 旁白/叙述
  | 'ending'       // 结局
  | 'unlock'       // 解锁
  | 'gather'       // 汇聚
  | 'condition'    // 条件判断
  | 'cg'           // CG过场动画（图片/视频）
  | 'jump'         // 跳转
  | 'random'       // 随机

// ---
// 场景系统
// ---

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

// ---
// 角色系统
// ---

export type CharacterGender = 'male' | 'female' | 'other' | 'unknown'

export type EmotionType = 'normal' | 'happy' | 'sad' | 'angry' | 'surprised' | 'embarrassed' | 'thinking' | 'scared' | 'crying' | 'laughing'

export interface CharacterSprite {
  id?: string                // 唯一标识（可选）
  emotion: string            // 表情：normal/happy/angry/sad/surprised 等
  image?: string             // 立绘URL（兼容旧字段）
  url?: string               // 立绘URL（新字段，优先使用）
  name?: string              // 立绘名称（可选）
  position?: 'left' | 'center' | 'right'  // 默认位置
  scale?: number             // 缩放
  opacity?: number           // 透明度
}

export interface ComicCharacter {
  id: string
  name: string
  avatar: string         // 头像/缩略图
  sprites: CharacterSprite[]  // 所有表情立绘
  color: string          // 对话框边框颜色
  gender?: CharacterGender
  voiceUrl?: string       // 角色语音
}

// ---
// 对话节点数据
// ---

export interface DialogueData {
  characterId: string    // 说话角色ID
  spriteEmotion?: string // 使用表情（默认normal）
  spritePosition?: 'left' | 'center' | 'right'
  text: string          // 对话文本
  fontSize?: number
  fontColor?: string
  textAnimation?: 'typewriter' | 'fade' | 'none'
  bgsound?: string       // 背景音效
  voiceUrl?: string      // 语音URL
  backgroundImage?: string
  bgm?: string
  bgmVolume?: number
  bgs?: string
  bgsVolume?: number
  seUrl?: string
  seVolume?: number
  emotion?: string
}

// ---
// 旁白节点数据
// ---

export interface NarrationData {
  text: string
  fontSize?: number
  fontColor?: string
  textAnimation?: 'none' | 'typewriter' | 'fade' | 'slide-up'
  backgroundColor?: string  // 可选背景色覆盖
  bgm?: string
  bgmVolume?: number
}

// ---
// 分支选择节点
// ---

export interface ChoiceOption {
  id: string
  text: string
  icon?: string
  condition?: string     // 显示条件
  nextNodeId?: string    // 固定跳转（可选）
  effects?: {           // 选择效果
    variableName: string
    operation: 'set' | 'add' | 'subtract'
    value: string | number | boolean
  }[]
  variableEffect?: {    // 单个变量效果（实际使用中更常用）
    variableName: string
    operation: 'set' | 'add' | 'subtract' | 'multiply'
    value: string | number | boolean
  }
}

export interface ChoiceData {
  prompt?: string        // 选择提示
  options: ChoiceOption[]
  defaultNext?: string   // 无条件时的默认下一节点
}

// ---
// 转场节点
// ---

export type TransitionType = 
  | 'none'              // 无转场
  | 'fade'              // 淡入淡出
  | 'slide-left'        // 左滑
  | 'slide-right'       // 右滑
  | 'slide-up'          // 上滑
  | 'slide-down'        // 下滑
  | 'zoom-in'           // 放大
  | 'zoom-out'          // 缩小
  | 'wipe'              // 擦除
  | 'cross-dissolve'     // 溶解

export interface TransitionData {
  type: TransitionType
  duration?: number      // 转场时长（毫秒）
}

// ---
// 结局节点
// ---

export interface EndingData {
  title: string
  subtitle?: string
  text?: string
  coverImage?: string
  endingType: 'good' | 'bad' | 'neutral' | 'secret'
  bgm?: string
  bgmVolume?: number
}

// ---
// CG过场动画节点
// ---

export type CgMediaType = 'image' | 'video'

export interface CgData {
  mediaType: CgMediaType      // 媒体类型：图片或视频
  url: string                 // 媒体资源URL
  title?: string              // CG标题（可选）
  subtitle?: string           // CG副标题（可选）
  duration?: number           // 自动播放时长（毫秒，0表示点击继续）
  canSkip?: boolean           // 是否允许跳过
  transitionIn?: TransitionType   // 入场转场
  transitionOut?: TransitionType  // 出场转场
  transitionDuration?: number     // 转场时长（毫秒）
  bgm?: string                // 背景音乐URL
  bgmVolume?: number          // BGM音量（0-1）
  soundEffect?: string        // 音效URL
  letterbox?: boolean         // 是否显示黑边（电影感）
  displayMode?: 'contain' | 'cover' | 'fill' | 'custom'  // 显示模式
  customWidth?: number    // 自定义宽度百分比 (10-100)
  customHeight?: number   // 自定义高度百分比 (10-100)
  objectPosition?: string // CSS object-position 值，如 'center top'
}

// ---
// 场景节点数据
// ---

export interface SceneData {
  sceneId: string        // 关联场景ID
  transition?: TransitionData
}

// ---
// 节点数据联合类型
// ---

export type ComicNodeData =
  | SceneData
  | DialogueData
  | NarrationData
  | ChoiceData
  | TransitionData
  | EndingData
  | CgData

// ---
// 分镜节点
// ---

export interface ComicNode {
  id: string
  type: ComicNodeType
  position: { x: number; y: number }
  data: ComicNodeData
}

// ---
// 分镜连线
// ---

export interface ComicEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  condition?: string     // 条件表达式
  transition?: TransitionType
}

// ---
// 变量系统
// ---

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

// ---
// 音效系统
// ---

export interface ComicAudio {
  id: string
  name: string
  type: 'bgm' | 'sfx' | 'voice'
  url: string
  loop?: boolean         // 仅BGM支持循环
  volume?: number
}

// ---
// 故事工程
// ---

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
  scenes: ComicScene[]           // 场景库
  characters: ComicCharacter[]    // 角色库
  variables: ComicVariable[]     // 变量
  nodes: ComicNode[]             // 分镜节点
  edges: ComicEdge[]             // 连线
  audios: ComicAudio[]           // 音效库
  groups: NodeGroup[]            // 节点分组
}

// ---
// 模板定义
// ---

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

// ---
// 兼容旧版类型（用于迁移）
// ---

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

// ---
// 节点批注系统（类 Figma 评论）
// ---

export type AnnotationType = 'comment' | 'todo' | 'warning' | 'idea'

export interface AnnotationReply {
  id: string
  text: string
  author: string
  createdAt: number
}

export interface NodeAnnotation {
  id: string
  nodeId: string             // 关联的节点ID
  type: AnnotationType       // 批注类型
  text: string
  author: string             // 作者名（本地存储）
  createdAt: number
  resolved: boolean          // 是否已解决
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
