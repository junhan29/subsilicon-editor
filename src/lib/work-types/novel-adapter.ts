/**
 * 小说作品类型适配器
 *
 * 小说数据存放于 WorkDocument.extra.novel（见 novel.ts）。
 * 编辑界面使用独立章节树视图（NovelEditor），导出走 export-novel。
 */

import type { WorkDocument, WorkTypeAdapter } from '@editor/types/work'
import type { StoryGraph } from '@editor/types/editor'
import {
  NOVEL_WORK_TYPE,
  countNovelWords,
  countPaidChapters,
  createEmptyNovelDocument,
  getNovelData,
} from '@editor/lib/work-types/novel'
import {
  exportNovelPreviewHTML,
  exportNovelToEPUB,
  exportNovelToHTML,
  exportNovelToTXT,
} from '@editor/lib/export-novel'

export const novelAdapter: WorkTypeAdapter = {
  id: NOVEL_WORK_TYPE,
  name: '小说',
  icon: 'BookOpen',
  description: '章节树 + 富文本正文，支持章节付费与试读，可导出 EPUB / HTML / TXT',

  createEmptyGraph(): StoryGraph {
    return createEmptyNovelDocument('未命名小说').graph
  },

  validateGraph(graph: unknown): boolean {
    // 小说数据在 extra 中，graph 为占位图；只要有 graph 结构即可
    if (!graph || typeof graph !== 'object') return false
    const g = graph as Record<string, unknown>
    return Array.isArray(g.nodes) && Array.isArray(g.edges)
  },

  toGraph(doc: WorkDocument): StoryGraph {
    return doc.graph
  },

  fromGraph(graph: StoryGraph, extra?: Record<string, unknown>): WorkDocument {
    const doc: WorkDocument = {
      formatVersion: '2.0',
      workType: NOVEL_WORK_TYPE,
      meta: {
        title: graph.title || '未命名小说',
        description: graph.description || undefined,
        tags: graph.settings?.tags?.length ? graph.settings.tags : undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      graph,
      resources: {
        images: graph.assets?.images || [],
        audios: graph.assets?.audios || [],
        videos: [],
        fonts: graph.assets?.fonts || [],
        others: [],
      },
      monetization: graph.monetization,
      extra,
    }
    return doc
  },

  getExportFormats() {
    return [
      { id: 'novel_epub', name: 'EPUB 电子书', description: '可导入阅读器阅读，含目录与封面', icon: 'BookOpen', ext: '.epub' },
      { id: 'novel_html', name: 'HTML 在线阅读', description: '单文件网页，付费章节显示试读遮罩', icon: 'FileCode', ext: '.html' },
      { id: 'novel_txt', name: '纯文本', description: 'TXT 全文（付费章节为占位提示）', icon: 'FileText', ext: '.txt' },
    ]
  },

  getPreviewHTML(graph: StoryGraph): string {
    // 预览数据从 graph 中回读 extra 不可行（发布侧只有 graph）；
    // 小说发布预览在发布侧由 extra 提供，此处给出空预览兜底。
    const title = graph.title || '未命名小说'
    return exportNovelPreviewHTML(
      { chapters: [], freePreviewChapters: 0, descriptionHtml: graph.description },
      title
    )
  },

  getDdpStats(graph: StoryGraph): Record<string, unknown> {
    const data = getNovelData({ formatVersion: '2.0', workType: NOVEL_WORK_TYPE, meta: { title: graph.title || '' }, graph, resources: { images: [], audios: [], videos: [], fonts: [], others: [] } })
    return {
      chapterCount: data.chapters.length,
      wordCount: countNovelWords(data),
      paidChapterCount: countPaidChapters(data),
    }
  },

  getMonetizationGranularity() {
    return ['whole', 'chapter'] as const
  },
}
