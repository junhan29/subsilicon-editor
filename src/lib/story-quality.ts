import type { StoryNode, StoryEdge, StoryVariable } from '@editor/types/editor'
import { extractVariables } from './expression-parser'

export type QualityIssueSeverity = 'high' | 'medium' | 'low'

export type QualityIssueType =
  | 'dead-end'
  | 'island'
  | 'dangling-edge'
  | 'no-entry'
  | 'infinite-loop'
  | 'ending-coverage'
  | 'undefined-variable'
  | 'long-dialogue'

export interface QualityIssue {
  type: QualityIssueType
  severity: QualityIssueSeverity
  title: string
  description: string
  nodeIds: string[]
  edgeIds: string[]
  details?: Record<string, unknown>
}

export interface QualityStatistics {
  totalNodes: number
  totalEdges: number
  endingCount: number
  characterCount: number
  totalWordCount: number
  branchDepth: number
  reachableEndingCount: number
  endingCoveragePercent: number
}

export interface QualityReport {
  issues: QualityIssue[]
  score: number
  totalNodes: number
  totalEdges: number
  startNodeId: string | null
  statistics: QualityStatistics
}

const SEVERITY_WEIGHTS: Record<QualityIssueSeverity, number> = {
  high: 10,
  medium: 5,
  low: 2,
}

const ISSUE_INFO: Record<QualityIssueType, { title: string; description: string; severity: QualityIssueSeverity }> = {
  'dead-end': {
    title: '死路节点',
    description: '非结局节点没有任何出边，故事无法继续',
    severity: 'high',
  },
  island: {
    title: '孤岛节点',
    description: '从起始节点出发无法到达的节点',
    severity: 'medium',
  },
  'dangling-edge': {
    title: '悬空连线',
    description: '引用了不存在的节点的连线',
    severity: 'high',
  },
  'no-entry': {
    title: '无入口节点',
    description: '除起始节点外，没有任何入边的节点',
    severity: 'low',
  },
  'infinite-loop': {
    title: '死循环检测',
    description: '检测到不经过任何结局节点的循环路径，可能导致无限循环',
    severity: 'high',
  },
  'ending-coverage': {
    title: '结局覆盖率',
    description: '从起始节点出发可到达的结局节点比例',
    severity: 'medium',
  },
  'undefined-variable': {
    title: '未定义变量',
    description: '条件节点中使用了未在变量管理器中定义的变量',
    severity: 'medium',
  },
  'long-dialogue': {
    title: '长对话预警',
    description: '单条对话超过 200 字，建议拆分以提升阅读体验',
    severity: 'low',
  },
}

export function findStartNode(nodes: StoryNode[], edges: StoryEdge[]): string | null {
  if (nodes.length === 0) return null

  const inDegree = new Map<string, number>()
  nodes.forEach((n) => inDegree.set(n.id, 0))
  edges.forEach((e) => {
    const target = inDegree.get(e.target)
    if (target !== undefined) {
      inDegree.set(e.target, target + 1)
    }
  })

  const zeroInDegreeNodes = nodes.filter((n) => inDegree.get(n.id) === 0)

  if (zeroInDegreeNodes.length === 0) {
    return nodes[0].id
  }

  const dialogueZeroIn = zeroInDegreeNodes.find((n) => n.type === 'dialogue')
  if (dialogueZeroIn) {
    return dialogueZeroIn.id
  }

  return zeroInDegreeNodes[0].id
}

function buildAdjacencyList(nodes: StoryNode[], edges: StoryEdge[]): Map<string, string[]> {
  const adj = new Map<string, string[]>()
  nodes.forEach((n) => adj.set(n.id, []))
  edges.forEach((e) => {
    if (adj.has(e.source) && adj.has(e.target)) {
      adj.get(e.source)!.push(e.target)
    }
  })
  return adj
}

function bfsReachable(startId: string, adj: Map<string, string[]>): Set<string> {
  const visited = new Set<string>()
  const queue: string[] = [startId]
  visited.add(startId)

  while (queue.length > 0) {
    const current = queue.shift()!
    const neighbors = adj.get(current) || []
    for (const next of neighbors) {
      if (!visited.has(next)) {
        visited.add(next)
        queue.push(next)
      }
    }
  }

  return visited
}

function findInfiniteLoops(
  nodes: StoryNode[],
  adj: Map<string, string[]>
): { loopNodeIds: string[]; cycles: string[][] } {
  const visited = new Set<string>()
  const recStack = new Set<string>()
  const cycles: string[][] = []
  const path: string[] = []

  const isEndingNode = (nodeId: string): boolean => {
    const node = nodes.find((n) => n.id === nodeId)
    return node?.type === 'ending'
  }

  const dfs = (nodeId: string) => {
    visited.add(nodeId)
    recStack.add(nodeId)
    path.push(nodeId)

    const neighbors = adj.get(nodeId) || []
    for (const neighbor of neighbors) {
      if (isEndingNode(neighbor)) {
        continue
      }
      if (!visited.has(neighbor)) {
        dfs(neighbor)
      } else if (recStack.has(neighbor)) {
        const cycleStartIdx = path.indexOf(neighbor)
        if (cycleStartIdx !== -1) {
          const cycle = path.slice(cycleStartIdx)
          cycles.push([...cycle])
        }
      }
    }

    path.pop()
    recStack.delete(nodeId)
  }

  for (const node of nodes) {
    if (!visited.has(node.id) && !isEndingNode(node.id)) {
      dfs(node.id)
    }
  }

  const loopNodeSet = new Set<string>()
  for (const cycle of cycles) {
    for (const nodeId of cycle) {
      loopNodeSet.add(nodeId)
    }
  }

  return { loopNodeIds: Array.from(loopNodeSet), cycles }
}

function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1
      }
    }
  }

  return dp[m][n]
}

function findUndefinedVariables(
  nodes: StoryNode[],
  edges: StoryEdge[],
  variables: StoryVariable[]
): { nodeIds: string[]; edgeIds: string[]; variableIssues: Array<{ nodeId?: string; edgeId?: string; variableName: string; suggestion?: string }> } {
  const definedVarNames = new Set(variables.map((v) => v.name))
  const variableIssues: Array<{ nodeId?: string; edgeId?: string; variableName: string; suggestion?: string }> = []
  const affectedNodeIds = new Set<string>()
  const affectedEdgeIds = new Set<string>()

  const checkExpression = (expression: string, nodeId?: string, edgeId?: string) => {
    if (!expression || expression.trim() === '') return

    const referencedVars = extractVariables(expression)
    const builtinFunctions = new Set(['RANDOM', 'CHOICE_COUNT', 'TURNS_SINCE', 'VISIT_COUNT', 'HAS', 'SET'])

    for (const varName of referencedVars) {
      if (builtinFunctions.has(varName.toUpperCase())) continue
      if (definedVarNames.has(varName)) continue

      let suggestion: string | undefined
      let minDistance = Infinity

      for (const definedVar of variables) {
        const dist = editDistance(varName.toLowerCase(), definedVar.name.toLowerCase())
        if (dist <= 2 && dist < minDistance) {
          minDistance = dist
          suggestion = definedVar.name
        }
      }

      variableIssues.push({ nodeId, edgeId, variableName: varName, suggestion })
      if (nodeId) affectedNodeIds.add(nodeId)
      if (edgeId) affectedEdgeIds.add(edgeId)
    }
  }

  for (const node of nodes) {
    if (node.type === 'condition') {
      const data = node.data as Record<string, unknown>
      if (typeof data.expression === 'string') {
        checkExpression(data.expression, node.id)
      }
    }
    if (node.type === 'choice') {
      const data = node.data as Record<string, unknown>
      const options = data.options as Array<Record<string, unknown>> | undefined
      if (Array.isArray(options)) {
        for (const opt of options) {
          if (typeof opt.condition === 'string') {
            checkExpression(opt.condition, node.id)
          }
        }
      }
    }
  }

  for (const edge of edges) {
    const condition = edge.condition || (edge.data as Record<string, unknown> | undefined)?.condition
    if (typeof condition === 'string') {
      checkExpression(condition, undefined, edge.id)
    }
  }

  return {
    nodeIds: Array.from(affectedNodeIds),
    edgeIds: Array.from(affectedEdgeIds),
    variableIssues,
  }
}

function findLongDialogues(nodes: StoryNode[], maxLength: number = 200): { nodeIds: string[]; longDialogues: Array<{ nodeId: string; length: number; exceedBy: number }> } {
  const nodeIds: string[] = []
  const longDialogues: Array<{ nodeId: string; length: number; exceedBy: number }> = []

  for (const node of nodes) {
    let text = ''
    if (node.type === 'dialogue') {
      const data = node.data as Record<string, unknown>
      if (typeof data.text === 'string') {
        text = data.text
      }
    } else if (node.type === 'narration') {
      const data = node.data as Record<string, unknown>
      if (typeof data.text === 'string') {
        text = data.text
      }
    }

    if (text.length > maxLength) {
      nodeIds.push(node.id)
      longDialogues.push({ nodeId: node.id, length: text.length, exceedBy: text.length - maxLength })
    }
  }

  return { nodeIds, longDialogues }
}

function calculateStatistics(
  nodes: StoryNode[],
  edges: StoryEdge[],
  startNodeId: string | null,
  adj: Map<string, string[]>
): QualityStatistics {
  const endingNodes = nodes.filter((n) => n.type === 'ending')
  const characterIds = new Set<string>()

  let totalWordCount = 0
  for (const node of nodes) {
    const data = node.data as Record<string, unknown>
    if (node.type === 'dialogue') {
      if (typeof data.text === 'string') {
        totalWordCount += data.text.length
      }
      if (typeof data.characterId === 'string') {
        characterIds.add(data.characterId)
      }
    } else if (node.type === 'narration') {
      if (typeof data.text === 'string') {
        totalWordCount += data.text.length
      }
    }
  }

  let branchDepth = 0
  if (startNodeId) {
    const visitedDepth = new Map<string, number>()
    const dfs = (nodeId: string, depth: number) => {
      if (visitedDepth.has(nodeId)) return
      visitedDepth.set(nodeId, depth)
      branchDepth = Math.max(branchDepth, depth)
      const neighbors = adj.get(nodeId) || []
      for (const next of neighbors) {
        dfs(next, depth + 1)
      }
    }
    dfs(startNodeId, 1)
  }

  let reachableEndingCount = 0
  if (startNodeId) {
    const reachable = bfsReachable(startNodeId, adj)
    for (const ending of endingNodes) {
      if (reachable.has(ending.id)) {
        reachableEndingCount++
      }
    }
  }

  const endingCoveragePercent = endingNodes.length > 0
    ? Math.round((reachableEndingCount / endingNodes.length) * 100)
    : 100

  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    endingCount: endingNodes.length,
    characterCount: characterIds.size,
    totalWordCount,
    branchDepth,
    reachableEndingCount,
    endingCoveragePercent,
  }
}

export function analyzeStoryQuality(
  nodes: StoryNode[],
  edges: StoryEdge[],
  variables: StoryVariable[] = []
): QualityReport {
  const issues: QualityIssue[] = []
  const nodeIdSet = new Set(nodes.map((n) => n.id))
  const startNodeId = findStartNode(nodes, edges)
  const adj = buildAdjacencyList(nodes, edges)

  const outDegree = new Map<string, number>()
  const inDegree = new Map<string, number>()
  nodes.forEach((n) => {
    outDegree.set(n.id, 0)
    inDegree.set(n.id, 0)
  })

  const danglingEdgeIds: string[] = []
  edges.forEach((e) => {
    const sourceExists = nodeIdSet.has(e.source)
    const targetExists = nodeIdSet.has(e.target)

    if (!sourceExists || !targetExists) {
      danglingEdgeIds.push(e.id)
      return
    }

    outDegree.set(e.source, (outDegree.get(e.source) || 0) + 1)
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1)
  })

  if (danglingEdgeIds.length > 0) {
    const info = ISSUE_INFO['dangling-edge']
    issues.push({
      type: 'dangling-edge',
      severity: info.severity,
      title: info.title,
      description: info.description,
      nodeIds: [],
      edgeIds: danglingEdgeIds,
    })
  }

  const deadEndIds: string[] = []
  nodes.forEach((n) => {
    if (n.type !== 'ending' && (outDegree.get(n.id) || 0) === 0) {
      deadEndIds.push(n.id)
    }
  })

  if (deadEndIds.length > 0) {
    const info = ISSUE_INFO['dead-end']
    issues.push({
      type: 'dead-end',
      severity: info.severity,
      title: info.title,
      description: info.description,
      nodeIds: deadEndIds,
      edgeIds: [],
    })
  }

  if (startNodeId) {
    const reachable = bfsReachable(startNodeId, adj)

    const islandIds: string[] = []
    nodes.forEach((n) => {
      if (!reachable.has(n.id)) {
        islandIds.push(n.id)
      }
    })

    if (islandIds.length > 0) {
      const info = ISSUE_INFO.island
      issues.push({
        type: 'island',
        severity: info.severity,
        title: info.title,
        description: info.description,
        nodeIds: islandIds,
        edgeIds: [],
      })
    }
  }

  const noEntryIds: string[] = []
  nodes.forEach((n) => {
    if (n.id !== startNodeId && (inDegree.get(n.id) || 0) === 0) {
      noEntryIds.push(n.id)
    }
  })

  if (noEntryIds.length > 0) {
    const info = ISSUE_INFO['no-entry']
    issues.push({
      type: 'no-entry',
      severity: info.severity,
      title: info.title,
      description: info.description,
      nodeIds: noEntryIds,
      edgeIds: [],
    })
  }

  const { loopNodeIds, cycles } = findInfiniteLoops(nodes, adj)
  if (loopNodeIds.length > 0) {
    const info = ISSUE_INFO['infinite-loop']
    issues.push({
      type: 'infinite-loop',
      severity: info.severity,
      title: info.title,
      description: info.description,
      nodeIds: loopNodeIds,
      edgeIds: [],
      details: { cycles },
    })
  }

  const {
    nodeIds: undefinedVarNodeIds,
    edgeIds: undefinedVarEdgeIds,
    variableIssues,
  } = findUndefinedVariables(nodes, edges, variables)
  if (undefinedVarNodeIds.length > 0 || undefinedVarEdgeIds.length > 0) {
    const info = ISSUE_INFO['undefined-variable']
    issues.push({
      type: 'undefined-variable',
      severity: info.severity,
      title: info.title,
      description: info.description,
      nodeIds: undefinedVarNodeIds,
      edgeIds: undefinedVarEdgeIds,
      details: { variableIssues },
    })
  }

  const { nodeIds: longDialogueNodeIds, longDialogues } = findLongDialogues(nodes)
  if (longDialogueNodeIds.length > 0) {
    const info = ISSUE_INFO['long-dialogue']
    issues.push({
      type: 'long-dialogue',
      severity: info.severity,
      title: info.title,
      description: info.description,
      nodeIds: longDialogueNodeIds,
      edgeIds: [],
      details: { longDialogues },
    })
  }

  const statistics = calculateStatistics(nodes, edges, startNodeId, adj)

  const endingNodes = nodes.filter((n) => n.type === 'ending')
  const unreachableEndingIds: string[] = []
  if (startNodeId && endingNodes.length > 0) {
    const reachable = bfsReachable(startNodeId, adj)
    for (const ending of endingNodes) {
      if (!reachable.has(ending.id)) {
        unreachableEndingIds.push(ending.id)
      }
    }
  }

  const endingCoverageInfo = ISSUE_INFO['ending-coverage']
  issues.push({
    type: 'ending-coverage',
    severity: endingCoverageInfo.severity,
    title: endingCoverageInfo.title,
    description: `结局覆盖率：${statistics.endingCoveragePercent}%（${statistics.reachableEndingCount}/${statistics.endingCount}）`,
    nodeIds: unreachableEndingIds,
    edgeIds: [],
    details: {
      coveragePercent: statistics.endingCoveragePercent,
      reachableCount: statistics.reachableEndingCount,
      totalCount: statistics.endingCount,
      isMetric: true,
    },
  })

  issues.sort((a, b) => {
    const severityOrder: Record<QualityIssueSeverity, number> = { high: 0, medium: 1, low: 2 }
    const aIsMetric = a.details?.isMetric ? 1 : 0
    const bIsMetric = b.details?.isMetric ? 1 : 0
    if (aIsMetric !== bIsMetric) return aIsMetric - bIsMetric
    return severityOrder[a.severity] - severityOrder[b.severity]
  })

  const scorableIssues = issues.filter((i) => !i.details?.isMetric)
  const totalPenalty = scorableIssues.reduce(
    (sum, issue) => sum + SEVERITY_WEIGHTS[issue.severity] * (issue.nodeIds.length + issue.edgeIds.length),
    0
  )
  const maxScore = 100
  const minScore = 0
  const penaltyRatio = Math.min(1, totalPenalty / Math.max(1, (nodes.length + edges.length) * 10))
  const score = Math.round(Math.max(minScore, maxScore - penaltyRatio * 50))

  return {
    issues,
    score,
    totalNodes: nodes.length,
    totalEdges: edges.length,
    startNodeId,
    statistics,
  }
}

export function getNodeLabel(node: StoryNode): string {
  const typeLabels: Record<string, string> = {
    dialogue: '对话',
    choice: '选择',
    narration: '旁白',
    ending: '结局',
    unlock: '解锁',
    gather: '汇聚',
    condition: '条件',
    cg: 'CG过场',
    jump: '跳转',
    random: '随机',
  }

  const data = node.data as Record<string, unknown>
  let name = ''

  if (node.type === 'dialogue' && typeof data.text === 'string') {
    name = data.text.slice(0, 20)
  } else if (node.type === 'ending' && typeof data.title === 'string') {
    name = data.title
  } else if (node.type === 'choice' && typeof data.prompt === 'string') {
    name = data.prompt
  } else if (node.type === 'narration' && typeof data.text === 'string') {
    name = data.text.slice(0, 20)
  }

  const typeLabel = typeLabels[node.type] || node.type
  return name ? `${typeLabel}: ${name}` : typeLabel
}
