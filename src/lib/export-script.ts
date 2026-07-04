import type { StoryGraph, StoryNode, StoryCharacter, ComicScene } from '@editor/types/editor'

// 拓扑排序：按依赖顺序排列节点
// - 使用 Kahn 算法
// - 入度为 0 的节点优先；同入度按节点在 nodes 数组中的顺序保持稳定
// - 存在环时，剩余节点按原始顺序追加（已访问集合防止无限循环）
export function topologicalSortNodes(
  nodes: StoryNode[],
  edges: { source: string; target: string }[]
): StoryNode[] {
  const nodeMap = new Map<string, StoryNode>()
  nodes.forEach((n) => nodeMap.set(n.id, n))

  // 计算入度
  const inDegree = new Map<string, number>()
  nodes.forEach((n) => inDegree.set(n.id, 0))
  edges.forEach((e) => {
    if (nodeMap.has(e.source) && nodeMap.has(e.target)) {
      inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1)
    }
  })

  // 出边邻接表
  const adjacency = new Map<string, string[]>()
  nodes.forEach((n) => adjacency.set(n.id, []))
  edges.forEach((e) => {
    if (nodeMap.has(e.source) && nodeMap.has(e.target)) {
      adjacency.get(e.source)?.push(e.target)
    }
  })

  // 入度为 0 的节点队列（按 nodes 数组原始顺序入队，保持稳定）
  const queue: string[] = nodes.filter((n) => (inDegree.get(n.id) || 0) === 0).map((n) => n.id)
  const visited = new Set<string>()
  const result: StoryNode[] = []

  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    const node = nodeMap.get(id)
    if (node) result.push(node)

    const next = adjacency.get(id) || []
    for (const targetId of next) {
      if (visited.has(targetId)) continue
      const newDeg = (inDegree.get(targetId) || 1) - 1
      inDegree.set(targetId, newDeg)
      if (newDeg <= 0) queue.push(targetId)
    }
  }

  // 环中或孤立节点：按原始顺序追加
  for (const n of nodes) {
    if (!visited.has(n.id)) result.push(n)
  }

  return result
}

// 解析节点对应的场景信息
function resolveScene(node: StoryNode, scenes: ComicScene[] | undefined): ComicScene | null {
  const data = node.data as Record<string, unknown>
  // 优先按 sceneId
  const sceneId = data.sceneId as string | undefined
  if (sceneId && scenes) {
    const found = scenes.find((s) => s.id === sceneId)
    if (found) return found
  }
  // 其次按 backgroundImage 匹配
  const bg = data.backgroundImage as string | undefined
  if (bg && scenes) {
    const found = scenes.find((s) => s.backgroundImage === bg)
    if (found) return found
  }
  return null
}

// 格式化场景标题
function formatSceneLine(scene: ComicScene, isFirst: boolean): string {
  const parts: string[] = []
  if (scene.name) parts.push(scene.name)
  if (scene.style) parts.push(scene.style)
  if (scene.era) parts.push(scene.era)
  const label = parts.join(' - ') || '未命名场景'
  return isFirst ? `[场景：${label}]` : `[场景切换：${label}]`
}

// 转义控制字符（防止剧本语法被破坏）
function sanitize(text: unknown): string {
  if (text == null) return ''
  return String(text).replace(/\r\n/g, '\n').trim()
}

// 查找角色名
function findCharacterName(characterId: string | undefined, characters: StoryCharacter[]): string {
  if (!characterId) return '???'
  return characters.find((c) => c.id === characterId)?.name || '???'
}

// 格式化单个节点为剧本片段
function formatNode(
  node: StoryNode,
  ctx: { characters: StoryCharacter[]; scenes?: ComicScene[]; lastSceneId: string | null }
): { lines: string[]; sceneChanged: boolean } {
  const data = node.data as Record<string, unknown>
  const lines: string[] = []
  let sceneChanged = false

  switch (node.type) {
    case 'dialogue': {
      const name = findCharacterName(data.characterId as string, ctx.characters)
      const text = sanitize(data.text)
      // 检查场景切换
      const scene = resolveScene(node, ctx.scenes)
      if (scene && scene.id !== ctx.lastSceneId) {
        // 场景标记独占一行，与对话内容之间留空行（与示例对齐）
        lines.push(formatSceneLine(scene, ctx.lastSceneId === null))
        lines.push('')
        ctx.lastSceneId = scene.id
        sceneChanged = true
      }
      if (text) {
        lines.push(`${name}: ${text}`)
      } else {
        lines.push(`${name}:`)
      }
      break
    }
    case 'narration': {
      const text = sanitize(data.text)
      if (text) lines.push(`> （旁白：${text}）`)
      break
    }
    case 'choice': {
      const prompt = sanitize(data.prompt) || '你的选择是？'
      lines.push('◆ 选择：')
      if (prompt && prompt !== '你的选择是？') lines.push(`  ${prompt}`)
      const options = (data.options as Array<{ text?: string }>) || []
      options.forEach((opt, i) => {
        const txt = sanitize(opt.text) || `选项 ${i + 1}`
        lines.push(`  → 选项${String.fromCharCode(65 + i)}: ${txt}`)
      })
      break
    }
    case 'ending': {
      const title = sanitize(data.title) || '结局'
      const text = sanitize(data.text)
      lines.push(`【结局：${title}】`)
      if (text) lines.push(text)
      break
    }
    case 'cg': {
      const title = sanitize(data.title || data.subtitle) || 'CG 过场'
      lines.push(`[CG: ${title}]`)
      break
    }
    case 'condition': {
      const expr = sanitize(data.expression) || 'true'
      lines.push(`⟲ 条件：${expr}`)
      break
    }
    case 'unlock': {
      const title = sanitize(data.title || data.nodeTitle) || '隐藏内容'
      const price = sanitize(data.price ?? data.amount) || '0'
      lines.push(`★ 解锁内容：${title}`)
      lines.push(`  支付：${price}元`)
      break
    }
    case 'jump': {
      const label = sanitize(data.label) || '跳转'
      lines.push(`↻ 跳转：${label}`)
      break
    }
    case 'gather': {
      const label = sanitize(data.label) || '汇聚'
      lines.push(`≈ 汇聚：${label}`)
      break
    }
    case 'random': {
      const options = (data.options as Array<{ label?: string; weight?: number }>) || []
      lines.push('⚂ 随机：')
      options.forEach((opt, i) => {
        const label = sanitize(opt.label) || `选项 ${i + 1}`
        const weight = opt.weight ?? 0
        lines.push(`  · ${label} (权重 ${weight})`)
      })
      break
    }
    default: {
      // 未知节点类型：跳过
      break
    }
  }

  return { lines, sceneChanged }
}

// 导出为剧本格式纯文本
export function exportToScript(graph: StoryGraph): string {
  const nodes = graph.nodes || []
  const edges = graph.edges || []
  const characters = graph.characters || []
  const scenes = graph.scenes

  const title = graph.title || '未命名故事'
  const description = graph.description ? sanitize(graph.description) : ''

  const sortedNodes = topologicalSortNodes(nodes, edges)

  const ctx: { characters: StoryCharacter[]; scenes?: ComicScene[]; lastSceneId: string | null } = {
    characters,
    scenes,
    lastSceneId: null,
  }

  const body: string[] = []
  body.push(`【${title}】`)
  body.push('')
  if (description) {
    body.push(description)
    body.push('')
  }

  // 按节流分组：连续对话节点（同场景）合并为一组，组间空行分隔
  let lastType: string | null = null
  sortedNodes.forEach((node) => {
    const { lines, sceneChanged } = formatNode(node, ctx)
    if (lines.length === 0) return

    // 决定是否在当前块前插入空行
    // - 第一个节点不需要前导空行
    // - 后续节点：场景切换 / 节点类型变化 -> 插入空行
    // - 连续对话节点（同场景）-> 不插入空行
    if (lastType !== null) {
      const isDialogue = node.type === 'dialogue'
      const needBlank = sceneChanged || !isDialogue || lastType !== 'dialogue'
      if (needBlank) body.push('')
    }

    body.push(...lines)
    lastType = node.type
  })

  // 末尾元信息
  body.push('')
  body.push('— — — — — — — — — —')
  body.push(`节点数：${nodes.length}`)
  body.push(`连线数：${edges.length}`)
  body.push(`角色数：${characters.length}`)
  body.push(`由 SubSilicon 编辑器导出于 ${new Date().toLocaleString('zh-CN')}`)

  return body.join('\n')
}
