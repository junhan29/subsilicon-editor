'use client'

import type { StoryNode, StoryCharacter, StoryEdge, StoryVariable, ComicScene } from '@editor/types/editor'

// 共享的 PropertyPanel Props 类型
export interface BasePanelProps {
  node: StoryNode
  characters: StoryCharacter[]
  variables?: StoryVariable[]
  assets?: { images: string[]; audios: string[]; fonts: string[] }
  scenes?: ComicScene[]
  onUpdateNode: (nodeId: string, data: Partial<StoryNode['data']>) => void
  onDeleteNode: (nodeId: string) => void
  onOpenAssets?: (tab?: 'images' | 'audios') => void
}

// 边属性面板 Props
export interface EdgePanelProps {
  edge: StoryEdge
  onUpdateEdge: (edgeId: string, data: Partial<StoryEdge>) => void
  onDeleteEdge: (edgeId: string) => void
}

// 节点类型标签映射
export const NODE_TYPE_LABELS: Record<string, string> = {
  dialogue: '对话节点',
  choice: '选择节点',
  unlock: '付费节点',
  ending: '结局节点',
  gather: '汇聚节点',
  condition: '条件节点',
  cg: 'CG过场节点',
  narration: '旁白节点',
  random: '随机节点',
  jump: '跳转节点',
}

// 结局类型选项
export const ENDING_TYPES = [
  { value: 'good', label: '好结局' },
  { value: 'bad', label: '坏结局' },
  { value: 'neutral', label: '普通结局' },
  { value: 'secret', label: '隐藏结局' },
] as const

// 转场类型选项
export const TRANSITION_TYPES = [
  { value: 'none', label: '无转场' },
  { value: 'fade', label: '淡入淡出' },
  { value: 'slide-left', label: '左滑' },
  { value: 'slide-right', label: '右滑' },
  { value: 'slide-up', label: '上滑' },
  { value: 'slide-down', label: '下滑' },
  { value: 'zoom-in', label: '放大' },
  { value: 'zoom-out', label: '缩小' },
  { value: 'cross-dissolve', label: '溶解' },
] as const

// 表情类型选项
export const EMOTION_TYPES = [
  { value: 'normal', label: '普通' },
  { value: 'happy', label: '开心' },
  { value: 'sad', label: '悲伤' },
  { value: 'angry', label: '愤怒' },
  { value: 'surprised', label: '惊讶' },
  { value: 'embarrassed', label: '尴尬' },
  { value: 'thinking', label: '思考' },
  { value: 'scared', label: '害怕' },
  { value: 'crying', label: '哭泣' },
  { value: 'laughing', label: '大笑' },
] as const

// 文字动画选项
export const TEXT_ANIMATION_TYPES = [
  { value: 'typewriter', label: '打字机' },
  { value: 'fade', label: '淡入' },
  { value: 'slide-up', label: '上浮' },
  { value: 'none', label: '无' },
] as const

// 入场动画选项
export const ENTER_ANIMATION_TYPES = [
  { value: 'fade-in', label: '淡入' },
  { value: 'slide-left', label: '从左滑入' },
  { value: 'slide-right', label: '从右滑入' },
  { value: 'zoom', label: '放大进入' },
  { value: 'none', label: '无' },
] as const

// 角色位置选项
export const SPRITE_POSITION_TYPES = [
  { value: 'left', label: '左侧' },
  { value: 'center', label: '居中' },
  { value: 'right', label: '右侧' },
] as const

// 对话框样式选项
export const DIALOG_STYLE_TYPES = [
  { id: 'default', label: '默认' },
  { id: 'rounded', label: '圆角' },
  { id: 'sharp', label: '直角' },
] as const

// 对话框颜色选项
export const DIALOG_COLOR_OPTIONS = [
  { color: '#1a1a2e', label: '深蓝' },
  { color: '#1a1a1a', label: '暗黑' },
  { color: '#2d1b2e', label: '暗紫' },
  { color: '#1b2e1b', label: '暗绿' },
  { color: '#2e1b1b', label: '暗红' },
  { color: '#1b2e2e', label: '暗青' },
]