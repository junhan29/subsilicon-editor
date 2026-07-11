import type { OutlineItem, StoryNode, StoryEdge } from '@editor/types/editor'

function generateId(): string {
  return `outline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function inferNodeType(title: string): string {
  if (title.includes('结局')) return 'ending'
  if (title.includes('选择') || title.includes('选项')) return 'choice'
  if (title.includes('如果') || title.includes('条件')) return 'condition'
  if (title.includes('随机')) return 'random'
  return 'dialogue'
}

export function parseOutline(text: string): OutlineItem[] {
  const lines = text.split('\n')
  const result: OutlineItem[] = []
  const stack: { item: OutlineItem; level: number }[] = []

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '')
    if (!line.trim()) continue

    const chapterMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (chapterMatch) {
      const level = chapterMatch[1].length
      const title = chapterMatch[2].trim()
      const item: OutlineItem = {
        id: generateId(),
        type: 'chapter',
        title,
        level,
        children: [],
      }

      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop()
      }

      if (stack.length === 0) {
        result.push(item)
      } else {
        stack[stack.length - 1].item.children.push(item)
      }

      stack.push({ item, level })
      continue
    }

    const listMatch = line.match(/^(\s*)[-*+]\s+(.+)$/)
    if (listMatch) {
      const indent = listMatch[1]
      const title = listMatch[2].trim()
      const level = Math.floor(indent.length / 2) + 100
      const nodeType = inferNodeType(title)

      const item: OutlineItem = {
        id: generateId(),
        type: 'node',
        title,
        level,
        children: [],
        nodeType,
      }

      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop()
      }

      if (stack.length === 0) {
        result.push(item)
      } else {
        stack[stack.length - 1].item.children.push(item)
      }

      stack.push({ item, level })
    }
  }

  return result
}

interface GenerateOptions {
  startX?: number
  startY?: number
  nodeWidth?: number
  nodeHeight?: number
  hGap?: number
  vGap?: number
}

export function generateNodesFromOutline(
  items: OutlineItem[],
  options: GenerateOptions = {}
): { nodes: StoryNode[]; edges: StoryEdge[] } {
  const {
    startX = 400,
    startY = 100,
    nodeWidth = 280,
    nodeHeight = 120,
    hGap = 80,
    vGap = 60,
  } = options

  const nodes: StoryNode[] = []
  const edges: StoryEdge[] = []
  let nodeCounter = 0

  const generateNodeId = (type: string): string => {
    nodeCounter += 1
    return `${type}-${Date.now()}-${nodeCounter}`
  }

  const createNodeData = (type: string, title: string): Record<string, unknown> => {
    switch (type) {
      case 'dialogue':
        return {
          characterId: '',
          text: title,
          emotion: '',
          spritePosition: 'center',
          textAnimation: 'typewriter',
        }
      case 'choice':
        return {
          options: [
            { id: 'opt-a', text: '选项A' },
            { id: 'opt-b', text: '选项B' },
          ],
          prompt: title,
        }
      case 'ending':
        return {
          title,
          text: '',
          endingType: 'neutral' as const,
        }
      case 'condition':
        return {
          expression: 'true',
          trueLabel: '是',
          falseLabel: '否',
        }
      case 'random':
        return {
          label: title,
          options: [
            { id: '1', label: '选项 A', weight: 50 },
            { id: '2', label: '选项 B', weight: 50 },
          ],
        }
      default:
        return { text: title }
    }
  }

  const processNode = (
    item: OutlineItem,
    x: number,
    y: number,
    parentId?: string,
    parentType?: string,
    childIndex?: number
  ): { maxY: number; nodeId: string } => {
    const nodeType = item.nodeType || 'dialogue'
    const nodeId = generateNodeId(nodeType)

    const node: StoryNode = {
      id: nodeId,
      type: nodeType as StoryNode['type'],
      position: { x, y },
      data: createNodeData(nodeType, item.title),
    }
    nodes.push(node)

    if (parentId && parentType) {
      let sourceHandle: string | undefined
      let targetHandle: string | undefined

      if (parentType === 'choice') {
        sourceHandle = `source-${childIndex || 0}`
      } else if (parentType === 'condition') {
        sourceHandle = childIndex === 0 ? 'source-true' : 'source-false'
      } else if (parentType === 'random') {
        sourceHandle = `source-${childIndex || 0}`
      }

      const edge: StoryEdge = {
        id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        source: parentId,
        target: nodeId,
        sourceHandle,
        targetHandle,
      }
      edges.push(edge)
    }

    if (item.children.length === 0) {
      return { maxY: y, nodeId }
    }

    const isChoiceType = nodeType === 'choice' || nodeType === 'condition' || nodeType === 'random'

    if (isChoiceType) {
      let currentY = y + nodeHeight + vGap
      const childStartX = x + nodeWidth + hGap

      if (nodeType === 'choice') {
        const choiceOptions: { id: string; text: string }[] = []
        item.children.forEach((child, idx) => {
          choiceOptions.push({
            id: `opt-${idx}`,
            text: child.title,
          })
        })
        node.data = { ...node.data, options: choiceOptions, prompt: item.title }
      } else if (nodeType === 'condition') {
        if (item.children.length >= 2) {
          node.data = {
            ...node.data,
            trueLabel: item.children[0].title,
            falseLabel: item.children[1].title,
            expression: 'true',
          }
        }
      } else if (nodeType === 'random') {
        const randomOptions: { id: string; label: string; weight: number }[] = []
        const weight = Math.floor(100 / item.children.length)
        item.children.forEach((child, idx) => {
          randomOptions.push({
            id: `${idx + 1}`,
            label: child.title,
            weight,
          })
        })
        node.data = { ...node.data, options: randomOptions, label: item.title }
      }

      let maxY = currentY
      item.children.forEach((child, idx) => {
        const result = processNode(child, childStartX, currentY, nodeId, nodeType, idx)
        maxY = Math.max(maxY, result.maxY)
        currentY = result.maxY + vGap
      })

      return { maxY, nodeId }
    } else {
      let currentY = y
      let lastId = nodeId

      item.children.forEach((child) => {
        currentY += nodeHeight + vGap
        const result = processNode(child, x, currentY, lastId, 'dialogue', 0)
        lastId = result.nodeId
        currentY = result.maxY
      })

      return { maxY: currentY, nodeId: lastId }
    }
  }

  let currentY = startY
  let currentChapterStartX = startX

  for (const item of items) {
    if (item.type === 'chapter') {
      const chapterNodes: StoryNode[] = []
      const chapterEdges: StoryEdge[] = []

      const tempNodes: StoryNode[] = []
      const tempEdges: StoryEdge[] = []

      const originalNodes = nodes
      const originalEdges = edges

      let chapterMaxY = currentY

      item.children.forEach((child) => {
        const result = processNode(child, currentChapterStartX, chapterMaxY)
        chapterMaxY = result.maxY + vGap * 2
      })

      currentY = chapterMaxY + vGap * 2
    } else {
      const result = processNode(item, currentChapterStartX, currentY)
      currentY = result.maxY + vGap * 2
    }
  }

  return { nodes, edges }
}

export function generateOutlineFromNodes(
  nodes: StoryNode[],
  edges: StoryEdge[],
  groups?: { id: string; name: string; nodeIds: string[] }[]
): string {
  if (nodes.length === 0) return ''

  const incomingCount = new Map<string, number>()
  const outgoingEdges = new Map<string, StoryEdge[]>()

  nodes.forEach((n) => {
    incomingCount.set(n.id, 0)
    outgoingEdges.set(n.id, [])
  })

  edges.forEach((e) => {
    incomingCount.set(e.target, (incomingCount.get(e.target) || 0) + 1)
    const out = outgoingEdges.get(e.source) || []
    out.push(e)
    outgoingEdges.set(e.source, out)
  })

  const startNodes = nodes.filter((n) => (incomingCount.get(n.id) || 0) === 0)

  const visited = new Set<string>()
  const lines: string[] = []

  const getNodeTitle = (node: StoryNode): string => {
    const data = node.data as Record<string, unknown>
    switch (node.type) {
      case 'dialogue':
        return (data.text as string)?.slice(0, 30) || '对话节点'
      case 'choice':
        return (data.prompt as string) || '选择节点'
      case 'ending':
        return `结局：${(data.title as string) || '结局'}`
      case 'condition':
        return `条件：${(data.expression as string) || '条件判断'}`
      case 'random':
        return `随机：${(data.label as string) || '随机分支'}`
      case 'narration':
        return (data.text as string)?.slice(0, 30) || '旁白节点'
      case 'cg':
        return `CG：${(data.title as string) || 'CG过场'}`
      case 'jump':
        return `跳转：${(data.label as string) || '跳转'}`
      case 'unlock':
        return `付费解锁：${(data.nodeTitle as string) || '解锁'}`
      case 'gather':
        return '汇聚节点'
      default:
        return '节点'
    }
  }

  const nodeGroupMap = new Map<string, string>()
  if (groups) {
    groups.forEach((g) => {
      g.nodeIds.forEach((nid) => {
        nodeGroupMap.set(nid, g.id)
      })
    })
  }

  const chapterAdded = new Set<string>()

  const traverse = (nodeId: string, depth: number) => {
    if (visited.has(nodeId)) return
    visited.add(nodeId)

    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return

    const groupId = nodeGroupMap.get(nodeId)
    if (groupId && groups && !chapterAdded.has(groupId)) {
      const group = groups.find((g) => g.id === groupId)
      if (group) {
        chapterAdded.add(groupId)
        lines.push(`## ${group.name}`)
        lines.push('')
      }
    }

    const indent = '  '.repeat(depth)
    lines.push(`${indent}- ${getNodeTitle(node)}`)

    const outEdges = outgoingEdges.get(nodeId) || []

    if (node.type === 'choice' || node.type === 'condition' || node.type === 'random') {
      const data = node.data as Record<string, unknown>
      const options: { label: string; edge?: StoryEdge }[] = []

      if (node.type === 'choice') {
        const opts = (data.options as { id: string; text: string }[]) || []
        opts.forEach((opt, idx) => {
          const edge = outEdges.find((e) => e.sourceHandle === `source-${idx}`) || outEdges[idx]
          options.push({ label: opt.text, edge })
        })
      } else if (node.type === 'condition') {
        const trueEdge = outEdges.find((e) => e.sourceHandle === 'source-true') || outEdges[0]
        const falseEdge = outEdges.find((e) => e.sourceHandle === 'source-false') || outEdges[1]
        if (trueEdge) options.push({ label: (data.trueLabel as string) || '是', edge: trueEdge })
        if (falseEdge) options.push({ label: (data.falseLabel as string) || '否', edge: falseEdge })
      } else if (node.type === 'random') {
        const opts = (data.options as { id: string; label: string }[]) || []
        opts.forEach((opt, idx) => {
          const edge = outEdges.find((e) => e.sourceHandle === `source-${idx}`) || outEdges[idx]
          options.push({ label: opt.label, edge })
        })
      }

      options.forEach((opt) => {
        const childIndent = '  '.repeat(depth + 1)
        lines.push(`${childIndent}- ${opt.label}`)
        if (opt.edge) {
          traverse(opt.edge.target, depth + 2)
        }
      })
    } else {
      outEdges.forEach((edge) => {
        traverse(edge.target, depth)
      })
    }
  }

  startNodes.forEach((node) => {
    traverse(node.id, 0)
    lines.push('')
  })

  const unvisited = nodes.filter((n) => !visited.has(n.id))
  if (unvisited.length > 0) {
    lines.push('## 其他节点')
    lines.push('')
    unvisited.forEach((node) => {
      lines.push(`- ${getNodeTitle(node)}`)
    })
  }

  return lines.join('\n').trim() + '\n'
}
