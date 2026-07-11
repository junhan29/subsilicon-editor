import type { NodeTemplate, StoryNode, StoryEdge, TemplateManifest, TemplateCategory, TemplateSource } from '@editor/types/editor'

const STORAGE_KEY = 'subsilicon-node-templates'

export function loadTemplates(): NodeTemplate[] {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return []
    const parsed = JSON.parse(data)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveTemplate(template: NodeTemplate): void {
  if (typeof window === 'undefined') return
  const templates = loadTemplates()
  const existingIndex = templates.findIndex((t) => t.id === template.id)
  if (existingIndex >= 0) {
    templates[existingIndex] = template
  } else {
    templates.unshift(template)
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}

export function deleteTemplate(id: string): void {
  if (typeof window === 'undefined') return
  const templates = loadTemplates().filter((t) => t.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createTemplateFromSelection(
  name: string,
  description: string | undefined,
  nodes: StoryNode[],
  edges: StoryEdge[],
): NodeTemplate {
  const minX = Math.min(...nodes.map((n) => n.position.x))
  const minY = Math.min(...nodes.map((n) => n.position.y))

  const normalizedNodes: StoryNode[] = nodes.map((node) => ({
    ...JSON.parse(JSON.stringify(node)),
    position: {
      x: node.position.x - minX,
      y: node.position.y - minY,
    },
  }))

  const normalizedEdges: StoryEdge[] = edges.map((edge) => ({
    ...JSON.parse(JSON.stringify(edge)),
  }))

  return {
    id: genId('tpl'),
    name,
    description,
    category: 'custom',
    nodes: normalizedNodes,
    edges: normalizedEdges,
    createdAt: Date.now(),
  }
}

export function getOfficialTemplates(): NodeTemplate[] {
  return OFFICIAL_TEMPLATES
}

const OFFICIAL_TEMPLATES: NodeTemplate[] = [
  {
    id: 'official-opener',
    name: '开场白',
    description: '对话 + 旁白 + 选择的经典开场结构',
    category: 'official',
    createdAt: 0,
    nodes: [
      {
        id: 'n1',
        type: 'narration',
        position: { x: 0, y: 0 },
        data: { text: '故事从这里开始...', textAnimation: 'typewriter' },
      },
      {
        id: 'n2',
        type: 'dialogue',
        position: { x: 0, y: 140 },
        data: { characterId: '', text: '你好，欢迎来到这个世界。', spritePosition: 'center' },
      },
      {
        id: 'n3',
        type: 'choice',
        position: { x: 0, y: 280 },
        data: {
          prompt: '你想要怎么做？',
          options: [
            { id: 'opt-a', text: '选项一' },
            { id: 'opt-b', text: '选项二' },
          ],
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
    ],
  },
  {
    id: 'official-triple-dialogue',
    name: '对话三连',
    description: '三个连续的对话节点',
    category: 'official',
    createdAt: 0,
    nodes: [
      {
        id: 'n1',
        type: 'dialogue',
        position: { x: 0, y: 0 },
        data: { characterId: '', text: '第一段对话', spritePosition: 'center' },
      },
      {
        id: 'n2',
        type: 'dialogue',
        position: { x: 0, y: 140 },
        data: { characterId: '', text: '第二段对话', spritePosition: 'center' },
      },
      {
        id: 'n3',
        type: 'dialogue',
        position: { x: 0, y: 280 },
        data: { characterId: '', text: '第三段对话', spritePosition: 'center' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
    ],
  },
  {
    id: 'official-two-choice',
    name: '二选一',
    description: '选择节点 + 两个结局',
    category: 'official',
    createdAt: 0,
    nodes: [
      {
        id: 'n1',
        type: 'choice',
        position: { x: 0, y: 0 },
        data: {
          prompt: '做出你的选择',
          options: [
            { id: 'opt-a', text: '选择 A' },
            { id: 'opt-b', text: '选择 B' },
          ],
        },
      },
      {
        id: 'n2',
        type: 'ending',
        position: { x: -180, y: 180 },
        data: { title: '结局 A', text: '', endingType: 'neutral' as const },
      },
      {
        id: 'n3',
        type: 'ending',
        position: { x: 180, y: 180 },
        data: { title: '结局 B', text: '', endingType: 'neutral' as const },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', sourceHandle: 'opt-a', target: 'n2' },
      { id: 'e2', source: 'n1', sourceHandle: 'opt-b', target: 'n3' },
    ],
  },
  {
    id: 'official-branch-gather',
    name: '分支汇合',
    description: '条件节点 + 两个对话 + 汇聚节点',
    category: 'official',
    createdAt: 0,
    nodes: [
      {
        id: 'n1',
        type: 'condition',
        position: { x: 0, y: 0 },
        data: { expression: 'true', trueLabel: '是', falseLabel: '否' },
      },
      {
        id: 'n2',
        type: 'dialogue',
        position: { x: -200, y: 160 },
        data: { characterId: '', text: '条件为真的分支', spritePosition: 'center' },
      },
      {
        id: 'n3',
        type: 'dialogue',
        position: { x: 200, y: 160 },
        data: { characterId: '', text: '条件为假的分支', spritePosition: 'center' },
      },
      {
        id: 'n4',
        type: 'gather',
        position: { x: 0, y: 320 },
        data: { label: '汇聚' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', sourceHandle: 'true', target: 'n2' },
      { id: 'e2', source: 'n1', sourceHandle: 'false', target: 'n3' },
      { id: 'e3', source: 'n2', target: 'n4' },
      { id: 'e4', source: 'n3', target: 'n4' },
    ],
  },
  {
    id: 'official-random-event',
    name: '随机事件',
    description: '随机节点 + 3 个对话分支',
    category: 'official',
    createdAt: 0,
    nodes: [
      {
        id: 'n1',
        type: 'random',
        position: { x: 0, y: 0 },
        data: {
          label: '随机事件',
          options: [
            { id: '1', label: '事件 A', weight: 33 },
            { id: '2', label: '事件 B', weight: 33 },
            { id: '3', label: '事件 C', weight: 34 },
          ],
        },
      },
      {
        id: 'n2',
        type: 'dialogue',
        position: { x: -280, y: 180 },
        data: { characterId: '', text: '随机事件 A 发生了', spritePosition: 'center' },
      },
      {
        id: 'n3',
        type: 'dialogue',
        position: { x: 0, y: 180 },
        data: { characterId: '', text: '随机事件 B 发生了', spritePosition: 'center' },
      },
      {
        id: 'n4',
        type: 'dialogue',
        position: { x: 280, y: 180 },
        data: { characterId: '', text: '随机事件 C 发生了', spritePosition: 'center' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', sourceHandle: '1', target: 'n2' },
      { id: 'e2', source: 'n1', sourceHandle: '2', target: 'n3' },
      { id: 'e3', source: 'n1', sourceHandle: '3', target: 'n4' },
    ],
  },
  {
    id: 'official-ending-branch',
    name: '结局分支',
    description: '选择节点 + 解锁节点 + 结局',
    category: 'official',
    createdAt: 0,
    nodes: [
      {
        id: 'n1',
        type: 'choice',
        position: { x: 0, y: 0 },
        data: {
          prompt: '选择你的道路',
          options: [
            { id: 'opt-free', text: '免费路线' },
            { id: 'opt-paid', text: '付费路线' },
          ],
        },
      },
      {
        id: 'n2',
        type: 'ending',
        position: { x: -200, y: 160 },
        data: { title: '普通结局', text: '这是免费的结局', endingType: 'neutral' as const },
      },
      {
        id: 'n3',
        type: 'unlock',
        position: { x: 200, y: 160 },
        data: { amount: 1, nodeTitle: '解锁真结局', description: '付费查看完整结局' },
      },
      {
        id: 'n4',
        type: 'ending',
        position: { x: 200, y: 320 },
        data: { title: '真结局', text: '这是付费解锁的真结局', endingType: 'good' as const },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', sourceHandle: 'opt-free', target: 'n2' },
      { id: 'e2', source: 'n1', sourceHandle: 'opt-paid', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
    ],
  },
]

// =========== Phase 1: 去中心化市场 - 模板导出/导入/发布 ===========

function mapCategory(cat: string): TemplateCategory {
  const map: Record<string, TemplateCategory> = {
    official: 'beginner', custom: 'custom', romance: 'romance',
    adventure: 'adventure', mystery: 'mystery', horror: 'horror',
    'sci-fi': 'sci-fi', fantasy: 'fantasy',
  }
  return map[cat] || 'custom'
}

export function exportTemplateToFile(template: NodeTemplate): void {
  const manifest: TemplateManifest = {
    formatVersion: '1.0',
    templateId: template.id,
    name: template.name,
    description: template.description || '',
    category: mapCategory(template.category),
    tags: [],
    creator: { name: '' },
    nodes: template.nodes,
    edges: template.edges,
    createdAt: new Date(template.createdAt).toISOString(),
    updatedAt: new Date().toISOString(),
    source: { type: 'local' },
  }
  const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/vnd.subsilicon.template+json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${template.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.subsilicon-template`
  a.click()
  URL.revokeObjectURL(url)
}

export function importTemplateFromFile(): Promise<NodeTemplate | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.subsilicon-template'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) { resolve(null); return }
      try {
        const text = await file.text()
        const manifest: TemplateManifest = JSON.parse(text)
        if (manifest.formatVersion !== '1.0') {
          resolve(null)
          return
        }
        const template: NodeTemplate = {
          id: `imported-${Date.now()}`,
          name: manifest.name,
          description: manifest.description,
          category: 'custom',
          nodes: manifest.nodes,
          edges: manifest.edges,
          createdAt: Date.now(),
        }
        resolve(template)
      } catch {
        resolve(null)
      }
    }
    input.click()
  })
}

const SUBMIT_CONFIG = {
  apiUrl: 'https://subsilicon.cn/api/templates/publish',
  submitToken: 'subsilicon-preview-submit-2026',
}

export async function publishTemplateToCommunity(
  template: NodeTemplate,
  sourceType: 'platform' | 'github' | 'cloud_drive',
  externalUrl?: string,
  publicKey?: string,
  signature?: string,
): Promise<{ success: boolean; error?: string; url?: string }> {
  try {
    const source: TemplateSource = sourceType === 'platform'
      ? { type: 'platform' }
      : sourceType === 'github'
        ? { type: 'github', repo: externalUrl || '' }
        : { type: 'cloud_drive', url: externalUrl || '' }

    const manifest: TemplateManifest = {
      formatVersion: '1.0',
      templateId: template.id,
      name: template.name,
      description: template.description || '',
      category: mapCategory(template.category),
      tags: [],
      creator: {
        name: '',
        ...(publicKey ? { publicKey } : {}),
        ...(signature ? { signature } : {}),
      },
      nodes: template.nodes,
      edges: template.edges,
      createdAt: new Date(template.createdAt).toISOString(),
      updatedAt: new Date().toISOString(),
      source,
    }

    const config: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manifest }),
    }

    if (sourceType === 'platform') {
      const fd = new FormData()
      fd.append('manifest', JSON.stringify(manifest))
      fd.append('file', new Blob([JSON.stringify(manifest)], { type: 'application/vnd.subsilicon.template+json' }), `${template.name}.subsilicon-template`)
      config.body = fd
      delete (config.headers as Record<string, string>)['Content-Type']
    }

    const res = await fetch(SUBMIT_CONFIG.apiUrl, config)
    const data = await res.json()

    if (res.ok) {
      return { success: true, url: data.url || '' }
    }
    return { success: false, error: data.error || '发布失败' }
  } catch (err) {
    return { success: false, error: '网络错误' }
  }
}
