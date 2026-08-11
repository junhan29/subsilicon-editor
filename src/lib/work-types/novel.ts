/**
 * 小说作品模型（Novel）
 *
 * 线性小说（Phase 2 首版）：章节树 + 富文本正文。
 * 数据存放于 WorkDocument.extra.novel，graph 使用空的 StoryGraph 占位
 * （保持核心「统一 WorkDocument」不变，后续可迁移到专用 graph 结构）。
 *
 * 支持：章节管理、富文本正文、整本/章节付费、试读前 N 章。
 */

import type { WorkDocument } from '@editor/types/work'
import type { StoryGraph } from '@editor/types/editor'

export interface NovelChapter {
  id: string
  title: string
  /** 富文本正文（Tiptap HTML） */
  contentHtml: string
  /** 排序（章节树顺序） */
  order: number
  /** 是否付费章节 */
  paid: boolean
  /** 章节价格（CNY），付费章节必填 */
  price?: number
  /** 章节目录备注（可选） */
  note?: string
}

export interface NovelData {
  chapters: NovelChapter[]
  /** 简介（富文本） */
  descriptionHtml?: string
  /** 试读章节数（前 N 章免费） */
  freePreviewChapters: number
  /** 整本售价（0 表示非整本付费，按章节计） */
  wholePrice?: number
  /** 作者名 */
  author?: string
}

export const NOVEL_WORK_TYPE = 'novel'

/** 从 WorkDocument 提取小说数据（无则返回空结构） */
export function getNovelData(doc: WorkDocument): NovelData {
  const extra = (doc.extra || {}) as Record<string, unknown>
  const novel = extra.novel as NovelData | undefined
  if (novel && Array.isArray(novel.chapters)) {
    return novel
  }
  return createEmptyNovelData()
}

/** 创建空白小说数据 */
export function createEmptyNovelData(): NovelData {
  return {
    chapters: [],
    freePreviewChapters: 0,
  }
}

/** 生成章节 ID */
export function generateChapterId(): string {
  return `ch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** 计算小说字数（正文纯文本去标签后统计） */
export function countNovelWords(data: NovelData): number {
  let total = 0
  for (const ch of data.chapters) {
    total += stripHtml(ch.contentHtml).length
  }
  return total
}

/** 计算付费章节数 */
export function countPaidChapters(data: NovelData): number {
  return data.chapters.filter((c) => c.paid).length
}

/** 简单去 HTML 标签（字数统计用） */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

/** 将小说数据写入 WorkDocument */
export function withNovelData(doc: WorkDocument, data: NovelData): WorkDocument {
  return {
    ...doc,
    extra: {
      ...(doc.extra || {}),
      novel: data,
    },
  }
}

/** 新建小说 WorkDocument（graph 用空 StoryGraph 占位） */
export function createEmptyNovelDocument(title: string): WorkDocument {
  const emptyGraph: StoryGraph = {
    title,
    description: '',
    templateId: 'custom',
    characters: [],
    variables: [],
    nodes: [],
    edges: [],
    settings: { title, tags: [] },
    assets: { images: [], audios: [], fonts: [] },
    scenes: [],
    audios: [],
    groups: [],
    annotations: [],
  }
  return {
    formatVersion: '2.0',
    workType: NOVEL_WORK_TYPE,
    meta: { title },
    graph: emptyGraph,
    resources: { images: [], audios: [], videos: [], fonts: [], others: [] },
    extra: { novel: createEmptyNovelData() },
  }
}
