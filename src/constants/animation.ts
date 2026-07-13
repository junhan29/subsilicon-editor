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

export type TransitionType = typeof TRANSITION_TYPES[number]['value']

export const TEXT_ANIMATION_TYPES = [
  { value: 'typewriter', label: '打字机' },
  { value: 'fade', label: '淡入' },
  { value: 'slide-up', label: '上浮' },
  { value: 'none', label: '无' },
] as const

export type TextAnimationType = typeof TEXT_ANIMATION_TYPES[number]['value']

export const ENTER_ANIMATION_TYPES = [
  { value: 'fade-in', label: '淡入' },
  { value: 'slide-left', label: '从左滑入' },
  { value: 'slide-right', label: '从右滑入' },
  { value: 'zoom', label: '放大进入' },
  { value: 'none', label: '无' },
] as const

export type EnterAnimationType = typeof ENTER_ANIMATION_TYPES[number]['value']

export const DIALOG_STYLE_TYPES = [
  { id: 'default', label: '默认' },
  { id: 'rounded', label: '圆角' },
  { id: 'sharp', label: '直角' },
] as const

export type DialogStyleType = typeof DIALOG_STYLE_TYPES[number]['id']

export const DIALOG_COLOR_OPTIONS = [
  { color: '#1a1a2e', label: '深蓝' },
  { color: '#1a1a1a', label: '暗黑' },
  { color: '#2d1b2e', label: '暗紫' },
  { color: '#1b2e1b', label: '暗绿' },
  { color: '#2e1b1b', label: '暗红' },
  { color: '#1b2e2e', label: '暗青' },
]
