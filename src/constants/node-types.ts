export const NODE_TYPE_LABELS: Record<string, string> = {
  dialogue: '对话节点',
  choice: '选择节点',
  narration: '旁白节点',
  ending: '结局节点',
  unlock: '付费节点',
  gather: '汇聚节点',
  condition: '条件节点',
  cg: 'CG过场节点',
  jump: '跳转节点',
  random: '随机节点',
  group: '分组节点',
}

export const NODE_TYPE_ICONS: Record<string, string> = {
  dialogue: 'message-square',
  choice: 'git-branch',
  narration: 'book-open',
  ending: 'flag',
  unlock: 'lock',
  gather: 'merge',
  condition: 'git-fork',
  cg: 'image',
  jump: 'corner-down-right',
  random: 'shuffle',
  group: 'layers',
}

export type NodeType =
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
  | 'group'

export const ALL_NODE_TYPES: NodeType[] = [
  'dialogue',
  'choice',
  'narration',
  'ending',
  'unlock',
  'gather',
  'condition',
  'cg',
  'jump',
  'random',
]

export const GROUP_COLORS = [
  { value: '#6366f1', name: '靛蓝' },
  { value: '#ec4899', name: '粉红' },
  { value: '#10b981', name: '翠绿' },
  { value: '#f59e0b', name: '琥珀' },
  { value: '#8b5cf6', name: '紫罗兰' },
  { value: '#ef4444', name: '红色' },
  { value: '#06b6d4', name: '青色' },
  { value: '#84cc16', name: '青柠' },
] as const

export type GroupColor = typeof GROUP_COLORS[number]['value']
