/**
 * 漫画/绘本作品类型适配器
 *
 * 漫画数据存放于 WorkDocument.extra.comic（见 comic.ts）。
 * 编辑界面使用独立画格编辑器（ComicEditor），导出走 export-comic。
 */

import type { WorkDocument, WorkTypeAdapter } from '@editor/types/work'
import type { StoryGraph } from '@editor/types/editor'
import {
  COMIC_WORK_TYPE,
  countComicPages,
  countComicPanels,
  countPaidPanels,
  createEmptyComicData,
  createEmptyComicDocument,
  getComicData,
} from '@editor/lib/work-types/comic'
import {
  exportComicPreviewHTML,
  exportComicToFlipHTML,
  exportComicToScrollHTML,
  exportComicToZip,
  freePreviewPanels,
} from '@editor/lib/export-comic'

export const comicAdapter: WorkTypeAdapter = {
  id: COMIC_WORK_TYPE,
  name: '漫画',
  icon: 'Images',
  description: '分镜画格 + 台词旁白，支持单格付费与试读，导出翻页 / 长条 / ZIP',

  createEmptyGraph(): StoryGraph {
    return createEmptyComicDocument('未命名漫画').graph
  },

  validateGraph(graph: unknown): boolean {
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
      workType: COMIC_WORK_TYPE,
      meta: {
        title: graph.title || '未命名漫画',
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
      { id: 'comic_flip', name: '翻页漫画 HTML', description: '单文件网页，按页翻页，付费画格遮罩与解锁码', icon: 'BookOpen', ext: '.html' },
      { id: 'comic_scroll', name: '长条漫画 HTML', description: '纵向滚动阅读（webtoon 风格），付费遮罩', icon: 'Images', ext: '.html' },
      { id: 'comic_zip', name: 'ZIP 包', description: '翻页 HTML + 素材文件，便于二次加工与分发', icon: 'Archive', ext: '.zip' },
      { id: 'comic_preview', name: '试看预览 HTML', description: '仅前 N 格，用于发布展示', icon: 'Eye', ext: '.html' },
    ]
  },

  async getPreviewHTML(graph: StoryGraph): Promise<string> {
    // 发布侧仅提供 graph（无 extra），给出空预览兜底
    return exportComicPreviewHTML(createEmptyComicData(), graph.title || '未命名漫画', async () => null)
  },

  getDdpStats(graph: StoryGraph): Record<string, unknown> {
    const data = getComicData({
      formatVersion: '2.0',
      workType: COMIC_WORK_TYPE,
      meta: { title: graph.title || '' },
      graph,
      resources: { images: [], audios: [], videos: [], fonts: [], others: [] },
    })
    return {
      panelCount: countComicPanels(data),
      pageCount: countComicPages(data),
      paidPanelCount: countPaidPanels(data),
      freePreviewPanels: freePreviewPanels(data),
    }
  },

  getMonetizationGranularity() {
    return ['whole', 'panel'] as const
  },
}
