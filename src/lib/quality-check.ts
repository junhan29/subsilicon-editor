import type { StoryEdge, StoryGraph, StoryNode } from '@editor/types/editor'
import type { MonetizationConfig } from '@editor/lib/work-monetization'

export interface QualityIssue {
  id: string
  severity: 'error' | 'warning'
  message: string
  nodeId?: string
}

interface CheckInput {
  nodes: StoryNode[]
  edges: StoryEdge[]
  monetization?: MonetizationConfig | null
}

const NODE_LABELS: Record<string, string> = {
  dialogue: '对话',
  narration: '旁白',
  choice: '选择',
  ending: '结局',
  condition: '条件',
  random: '随机',
  jump: '跳转',
  gather: '汇聚',
  cg: 'CG 过场',
  scene: '场景',
  unlock: '付费解锁',
}

function nodeLabel(node: StoryNode): string {
  const data = (node.data || {}) as Record<string, unknown>
  const name =
    typeof data.characterName === 'string' && data.characterName
      ? data.characterName
      : typeof data.title === 'string' && data.title
        ? data.title
        : ''
  return name ? `「${name}」` : (NODE_LABELS[node.type] || node.type)
}

/**
 * 作品体检（ADHD 适配）：主动发现会让读者卡住或体验不完整的结构问题。
 * 纯函数，无 React 依赖，便于单测。
 */
export function runQualityCheck({ nodes, edges, monetization }: CheckInput): QualityIssue[] {
  const issues: QualityIssue[] = []
  const nodeList: StoryNode[] = Array.isArray(nodes) ? nodes : []
  const edgeList: StoryEdge[] = Array.isArray(edges) ? edges : []
  const connectedIds = new Set<string>()
  const outCount = new Map<string, number>()
  const inCount = new Map<string, number>()

  edgeList.forEach((e) => {
    connectedIds.add(e.source)
    connectedIds.add(e.target)
    outCount.set(e.source, (outCount.get(e.source) || 0) + 1)
    inCount.set(e.target, (inCount.get(e.target) || 0) + 1)
  })

  // 1. 孤立节点（没有任何连线）
  nodeList.forEach((n) => {
    if (!connectedIds.has(n.id)) {
      issues.push({
        id: `orphan-${n.id}`,
        severity: 'warning',
        message: `${nodeLabel(n)}节点没有任何连线（孤立节点）`,
        nodeId: n.id,
      })
    }
  })

  // 2. 对话/旁白节点无出边 → 读者卡死
  nodeList.forEach((n) => {
    if ((n.type === 'dialogue' || n.type === 'narration') && !(outCount.get(n.id) || 0)) {
      issues.push({
        id: `no-out-${n.id}`,
        severity: 'error',
        message: `${nodeLabel(n)}节点没有出边，读者会卡在这里无法继续`,
        nodeId: n.id,
      })
    }
  })

  // 3. 没有任何结局节点
  const hasEnding = nodeList.some((n) => n.type === 'ending')
  if (!hasEnding) {
    issues.push({
      id: 'no-ending',
      severity: 'error',
      message: '作品中没有结局节点，读者无法结束故事',
    })
  }

  // 4. 结局节点无法到达（无入边）
  nodeList.forEach((n) => {
    if (n.type === 'ending' && !(inCount.get(n.id) || 0)) {
      issues.push({
        id: `ending-orphan-${n.id}`,
        severity: 'warning',
        message: `${nodeLabel(n)}结局没有任何连线指向它，读者无法到达`,
        nodeId: n.id,
      })
    }
  })

  // 5. 分支节点出边不足（条件/随机建议至少 2 条）
  nodeList.forEach((n) => {
    if ((n.type === 'condition' || n.type === 'random') && (outCount.get(n.id) || 0) < 2) {
      issues.push({
        id: `branch-${n.id}`,
        severity: 'warning',
        message: `${nodeLabel(n)}分支节点只有 ${outCount.get(n.id) || 0} 条出边（建议至少 2 条，否则分支不会真正生效）`,
        nodeId: n.id,
      })
    }
  })

  // 6. 已开启付费但未标记任何付费节点
  if (monetization?.enabled && (!monetization.paidNodes || monetization.paidNodes.length === 0)) {
    issues.push({
      id: 'paid-not-configured',
      severity: 'warning',
      message: '已开启付费，但还没有标记任何付费节点',
    })
  }

  // 7. 对话/旁白内容为空
  nodeList.forEach((n) => {
    if (n.type === 'dialogue' || n.type === 'narration') {
      const text = (n.data as Record<string, unknown> | undefined)?.text
      if (!text || !String(text).trim()) {
        issues.push({
          id: `empty-${n.id}`,
          severity: 'warning',
          message: `${nodeLabel(n)}节点内容为空`,
          nodeId: n.id,
        })
      }
    }
  })

  return issues
}
