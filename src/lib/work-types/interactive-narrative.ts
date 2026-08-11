/**
 * 互动叙事作品类型适配器
 *
 * v1.x 交互叙事（StoryGraph）作为首个作品类型适配器注册。
 * 行为与 v1.x 完全一致：导出格式、预览 HTML、营利粒度均对齐现有实现。
 */

import type { WorkDocument, WorkTypeAdapter } from '@editor/types/work'
import type { StoryGraph } from '@editor/types/editor'
import { exportPreviewHTML } from '@editor/lib/export-preview-html'

export const INTERACTIVE_NARRATIVE_ID = 'interactive-narrative'

/** 互动叙事空白图（与 project-manager 中的 emptyGraph 对齐） */
export function createEmptyInteractiveGraph(): StoryGraph {
  return {
    title: '未命名故事',
    description: '',
    templateId: 'custom',
    characters: [],
    variables: [],
    nodes: [],
    edges: [],
    settings: { title: '未命名故事', tags: [] },
    assets: { images: [], audios: [], fonts: [] },
    scenes: [],
    audios: [],
    groups: [],
    annotations: [],
  }
}

/** 从 StoryGraph 提取 DDP 类型化统计 */
export function getInteractiveDdpStats(graph: StoryGraph): Record<string, unknown> {
  const nodes = graph.nodes || []
  const endingCount = nodes.filter(n => n.type === 'ending').length
  return {
    nodeCount: nodes.length,
    endingCount,
    wordCount: estimateWordCount(graph),
    estimatedReadTime: Math.max(1, Math.round(estimateWordCount(graph) / 300)),
  }
}

/** 估算正文字数（对话/旁白节点 text 之和） */
function estimateWordCount(graph: StoryGraph): number {
  let count = 0
  for (const node of graph.nodes || []) {
    const data = node.data as Record<string, unknown>
    const text = data?.text as string | undefined
    if (text) count += text.length
  }
  return count
}

export const interactiveNarrativeAdapter: WorkTypeAdapter = {
  id: INTERACTIVE_NARRATIVE_ID,
  name: '互动叙事',
  icon: 'BookOpenText',
  description: '零代码可视化互动叙事编辑器，支持分支、变量、多结局与付费解锁',

  createEmptyGraph: createEmptyInteractiveGraph,

  validateGraph(graph: unknown): graph is StoryGraph {
    if (!graph || typeof graph !== 'object') return false
    const g = graph as Record<string, unknown>
    return (
      typeof g.title === 'string' &&
      Array.isArray(g.nodes) &&
      Array.isArray(g.edges)
    )
  },

  toGraph(doc: WorkDocument): StoryGraph {
    return doc.graph
  },

  fromGraph(graph: StoryGraph, extra?: Record<string, unknown>): WorkDocument {
    const assets = graph.assets || { images: [], audios: [], fonts: [] }
    return {
      formatVersion: '2.0',
      workType: INTERACTIVE_NARRATIVE_ID,
      meta: {
        title: graph.title || '未命名故事',
        description: graph.description || undefined,
        tags: graph.settings?.tags?.length ? graph.settings.tags : undefined,
        coverImage: graph.settings?.coverImage || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      graph,
      resources: {
        images: assets.images || [],
        audios: assets.audios || [],
        videos: [],
        fonts: assets.fonts || [],
        others: [],
      },
      monetization: graph.monetization,
      extra,
    }
  },

  // 导出格式与 v1.x ExportDialog FORMATS 对齐
  getExportFormats() {
    return [
      { id: 'html', name: 'HTML 单文件', description: '可直接在浏览器打开', icon: 'FileCode', ext: '.html', themeable: true, debugApplicable: true },
      { id: 'zip', name: 'ZIP 包', description: '含 HTML 和资源文件', icon: 'Archive', ext: '.zip', assetsApplicable: true },
      { id: 'story_exec', name: '可执行故事', description: '加密 + 扫码付费解锁', icon: 'ShieldCheck', ext: '.story.html' },
      { id: 'script', name: '剧本文本', description: '剧本格式的纯文本', icon: 'FileText', ext: '.txt' },
      { id: 'epub', name: 'EPUB 电子书', description: '可导入阅读器阅读', icon: 'BookOpen', ext: '.epub', assetsApplicable: true },
      { id: 'i18n', name: '翻译表', description: '提取文本用于多语言翻译', icon: 'Languages', ext: '.json/.csv' },
      { id: 'desktop_app', name: '独立游戏 / 桌面软件', description: '打包为 .dmg / .exe / .AppImage', icon: 'MonitorPlay', ext: '.zip / 安装包' },
      { id: 'bilibili_interactive', name: 'B 站互动视频 / 伪互动', description: '分 P 配置 CSV + 章节拼接脚本', icon: 'Film', ext: '.zip' },
    ]
  },

  getPreviewHTML(graph: StoryGraph): string {
    return exportPreviewHTML(graph)
  },

  getDdpStats(graph: StoryGraph): Record<string, unknown> {
    return getInteractiveDdpStats(graph)
  },

  getMonetizationGranularity() {
    return ['whole', 'chapter', 'node'] as const
  },
}
