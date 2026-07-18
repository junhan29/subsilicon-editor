import type { StoryNode, StoryEdge, StoryCharacter, ComicScene } from '@editor/types/editor'

const NODE_TYPE_LABELS: Record<string, string> = {
  dialogue: '对话',
  narration: '旁白',
  choice: '选择',
  ending: '结局',
  gather: '汇聚',
  condition: '条件',
  unlock: '付费解锁',
  cg: 'CG 过场',
  jump: '跳转',
  random: '随机',
  group: '分组',
}

function serializeNode(node: StoryNode): string {
  const label = NODE_TYPE_LABELS[node.type] || node.type
  const data = node.data as Record<string, unknown>

  let summary = ''
  switch (node.type) {
    case 'dialogue':
      summary = `角色: ${data.characterId || '未指定'}, 文本: "${(data.text as string || '').slice(0, 40)}"`
      break
    case 'narration':
      summary = `文本: "${(data.text as string || '').slice(0, 40)}"`
      break
    case 'choice':
      summary = `提示: "${data.prompt as string || ''}", 选项: ${Array.isArray(data.options) ? data.options.length : 0}个`
      break
    case 'ending':
      summary = `标题: "${data.title as string || ''}", 类型: ${(data.endingType as string) || 'neutral'}`
      break
    case 'condition':
      summary = `表达式: "${data.expression as string || ''}"`
      break
    case 'unlock':
      summary = `标题: "${data.nodeTitle as string || ''}", 金额: ${data.amount as number || 0}`
      break
    case 'cg':
      summary = `标题: "${data.title as string || ''}", 类型: ${(data.mediaType as string) || 'image'}`
      break
    case 'jump':
      summary = `目标: "${data.targetNodeId as string || '未设置'}"`
      break
    case 'random':
      summary = `选项: ${Array.isArray(data.options) ? data.options.length : 0}个`
      break
    default:
      summary = JSON.stringify(data).slice(0, 60)
  }

  const pos = node.position
  return `- [${node.id}] ${label}: ${summary} (位置: ${Math.round(pos.x)}, ${Math.round(pos.y)})`
}

function serializeEdge(edge: StoryEdge): string {
  return `- ${edge.source} → ${edge.target}${edge.label ? ` (标签: "${edge.label}")` : ''}`
}

function serializeCharacter(char: StoryCharacter): string {
  return `- ${char.name} (ID: ${char.id})${char.gender ? `, ${char.gender === 'male' ? '男' : char.gender === 'female' ? '女' : char.gender}` : ''}${char.age ? `, ${char.age}` : ''}${char.occupation ? `, ${char.occupation}` : ''}${char.personality?.length ? `, 性格: ${char.personality.slice(0, 3).join(', ')}` : ''}`
}

function serializeScene(scene: ComicScene): string {
  return `- ${scene.name} (ID: ${scene.id})${scene.style ? `: ${scene.style}` : ''}${scene.backgroundImage ? `, 背景: ${scene.backgroundImage}` : ''}`
}

export function serializeGraphContext(
  nodes: StoryNode[],
  edges: StoryEdge[],
  characters: StoryCharacter[],
  scenes: ComicScene[]
): string {
  const parts: string[] = []

  // 统计摘要
  const nodeTypeCount = new Map<string, number>()
  for (const n of nodes) {
    const label = NODE_TYPE_LABELS[n.type] || n.type
    nodeTypeCount.set(label, (nodeTypeCount.get(label) || 0) + 1)
  }
  const typeSummary = Array.from(nodeTypeCount.entries())
    .map(([type, count]) => `${type}×${count}`)
    .join(', ')

  parts.push(`## 项目结构`)
  parts.push(`- 节点总数: ${nodes.length} (${typeSummary})`)
  parts.push(`- 边总数: ${edges.length}`)
  parts.push(`- 角色数: ${characters.length}`)
  parts.push(`- 场景数: ${scenes.length}`)
  parts.push('')

  if (nodes.length > 0) {
    parts.push(`### 节点列表`)
    for (const node of nodes) {
      parts.push(serializeNode(node))
    }
    parts.push('')
  }

  if (edges.length > 0) {
    parts.push(`### 边列表`)
    for (const edge of edges) {
      parts.push(serializeEdge(edge))
    }
    parts.push('')
  }

  if (characters.length > 0) {
    parts.push(`### 角色列表`)
    for (const char of characters) {
      parts.push(serializeCharacter(char))
    }
    parts.push('')
  }

  if (scenes.length > 0) {
    parts.push(`### 场景列表`)
    for (const scene of scenes) {
      parts.push(serializeScene(scene))
    }
    parts.push('')
  }

  return parts.join('\n')
}
