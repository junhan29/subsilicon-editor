/**
 * 漫画/绘本作品模型（Comic）
 *
 * 分镜画格节点链（Phase 4 首版）：画格（panel）为基本单元，
 * 每格含背景图 + 台词气泡 + 旁白；按页分组，支持翻页/长条阅读。
 * 数据存放于 WorkDocument.extra.comic，graph 使用空的 StoryGraph 占位
 * （与小说/视频一致，保持「统一 WorkDocument」架构）。
 *
 * 支持：画格增删排序、按页分组、台词/旁白、整本/单格付费、试读前 N 格。
 */

import type { WorkDocument } from '@editor/types/work'
import type { StoryGraph } from '@editor/types/editor'

/** 台词气泡 */
export interface ComicDialogue {
  id: string
  /** 说话人（可选） */
  speaker?: string
  text: string
}

/** 漫画画格 */
export interface ComicPanel {
  id: string
  /** 所属页码（从 1 开始；同页多格按 order 排列） */
  page: number
  /** 格内顺序 */
  order: number
  /** 背景图素材 hash */
  assetHash?: string
  assetName?: string
  /** 台词列表 */
  dialogues: ComicDialogue[]
  /** 旁白文本 */
  narration?: string
  /** 是否付费画格 */
  paid: boolean
  /** 画格价格（CNY），付费画格必填 */
  price?: number
}

/** 漫画素材引用（仅图片） */
export interface ComicAssetRef {
  hash: string
  name: string
  type: 'image'
  mime: string
  /** 缩略图 dataURL（可选） */
  thumbnail?: string
  size: number
}

export interface ComicData {
  panels: ComicPanel[]
  assets: ComicAssetRef[]
  /** 试读画格数（前 N 格免费） */
  freePreviewPanels: number
  /** 整本价格（0 表示按画格付费） */
  wholePrice?: number
  /** 简介（富文本） */
  descriptionHtml?: string
  /** 作者名 */
  author?: string
}

export const COMIC_WORK_TYPE = 'comic'

/** 从 WorkDocument 提取漫画数据（无则返回空结构） */
export function getComicData(doc: WorkDocument): ComicData {
  const extra = (doc.extra || {}) as Record<string, unknown>
  const comic = extra.comic as ComicData | undefined
  if (comic && Array.isArray(comic.panels)) {
    return comic
  }
  return createEmptyComicData()
}

/** 创建空白漫画数据 */
export function createEmptyComicData(): ComicData {
  return {
    panels: [],
    assets: [],
    freePreviewPanels: 0,
  }
}

/** 生成画格 ID */
export function generatePanelId(): string {
  return `cp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** 生成台词 ID */
export function generateDialogueId(): string {
  return `cd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

/** 计算画格总数 */
export function countComicPanels(data: ComicData): number {
  return data.panels.length
}

/** 计算页数 */
export function countComicPages(data: ComicData): number {
  const pages = new Set<number>()
  for (const p of data.panels) pages.add(p.page)
  return pages.size
}

/** 计算付费画格数 */
export function countPaidPanels(data: ComicData): number {
  return data.panels.filter((p) => p.paid).length
}

/** 将漫画数据写入 WorkDocument */
export function withComicData(doc: WorkDocument, data: ComicData): WorkDocument {
  return {
    ...doc,
    extra: {
      ...(doc.extra || {}),
      comic: data,
    },
  }
}

/** 新建漫画 WorkDocument（graph 用空 StoryGraph 占位） */
export function createEmptyComicDocument(title: string): WorkDocument {
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
    workType: COMIC_WORK_TYPE,
    meta: { title },
    graph: emptyGraph,
    resources: { images: [], audios: [], videos: [], fonts: [], others: [] },
    extra: { comic: createEmptyComicData() },
  }
}
