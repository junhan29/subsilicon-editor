/**
 * 视频作品模型（Video）
 *
 * 轻中度剪辑（Phase 3 首版）：时间线片段序列 + 素材引用 + 字幕/配音 + 付费。
 * 数据存放于 WorkDocument.extra.video，graph 使用空的 StoryGraph 占位
 * （与小说一致，保持「统一 WorkDocument」架构）。
 *
 * 支持：时间线片段（video/image/audio）、截取起止、音量、转场、
 * 字幕、配音、整片/片段付费、试看前 N 秒。
 */

import type { WorkDocument } from '@editor/types/work'
import type { StoryGraph } from '@editor/types/editor'

/** 片段类型 */
export type VideoClipType = 'video' | 'image' | 'audio'

/** 转场效果预设 */
export const VIDEO_TRANSITIONS = ['none', 'fade', 'cut', 'dissolve', 'slide', 'zoom'] as const
export type VideoTransition = (typeof VIDEO_TRANSITIONS)[number]

export interface VideoClip {
  id: string
  type: VideoClipType
  /** 素材资源引用（asset-store 的 hash；video/image/audio 素材） */
  assetHash?: string
  /** 素材名（显示用） */
  assetName?: string
  /** 素材总时长（秒，导入时读取源文件获得） */
  assetDuration?: number
  /** 截取起点（秒，0 表示从头） */
  trimStart: number
  /** 截取终点（秒，0 表示到素材末尾） */
  trimEnd: number
  /** 片段实际时长（秒，播放器按此播放） */
  duration: number
  /** 音量（0-1，仅音频相关片段生效） */
  volume: number
  /** 转场效果（进入该片段时的过渡） */
  transition: VideoTransition
  /** 字幕/台词文本（叠加在画面底部） */
  subtitle?: string
  /** 配音说明 / AI TTS 文本（生成配音的提示词） */
  voiceover?: string
  /** 是否付费片段（未解锁时显示遮罩） */
  paid: boolean
  /** 片段价格（CNY），付费片段必填 */
  price?: number
  /** 排序（时间线顺序） */
  order: number
}

export interface VideoData {
  clips: VideoClip[]
  /** 素材引用列表（随作品保存，片段通过 assetHash 引用） */
  assets: VideoAssetRef[]
  /** 整片价格（0 表示按片段付费） */
  wholePrice?: number
  /** 试看秒数（前 N 秒免费播放） */
  previewSeconds: number
  /** 简介（富文本） */
  descriptionHtml?: string
  /** 作者名 */
  author?: string
  /** 分辨率预设（显示用） */
  resolution?: string
}

/** 视频素材引用（存入作品，供片段引用与导出打包） */
export interface VideoAssetRef {
  hash: string
  name: string
  type: 'video' | 'image' | 'audio'
  mime: string
  /** 素材总时长（秒，video/audio 有） */
  duration?: number
  /** 缩略图 dataURL（可选） */
  thumbnail?: string
  size: number
}

export const VIDEO_WORK_TYPE = 'video'

/** 从 WorkDocument 提取视频数据（无则返回空结构） */
export function getVideoData(doc: WorkDocument): VideoData {
  const extra = (doc.extra || {}) as Record<string, unknown>
  const video = extra.video as VideoData | undefined
  if (video && Array.isArray(video.clips)) {
    return video
  }
  return createEmptyVideoData()
}

/** 创建空白视频数据 */
export function createEmptyVideoData(): VideoData {
  return {
    clips: [],
    assets: [],
    previewSeconds: 0,
  }
}

/** 生成片段 ID */
export function generateClipId(): string {
  return `vc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** 计算时间线总时长（秒） */
export function countVideoDuration(data: VideoData): number {
  let total = 0
  for (const clip of data.clips) {
    total += Math.max(0, clip.duration || 0)
  }
  return Math.round(total * 10) / 10
}

/** 计算付费片段数 */
export function countPaidClips(data: VideoData): number {
  return data.clips.filter((c) => c.paid).length
}

/** 计算片段数量 */
export function countVideoClips(data: VideoData): number {
  return data.clips.length
}

/** 将视频数据写入 WorkDocument */
export function withVideoData(doc: WorkDocument, data: VideoData): WorkDocument {
  return {
    ...doc,
    extra: {
      ...(doc.extra || {}),
      video: data,
    },
  }
}

/** 新建视频 WorkDocument（graph 用空 StoryGraph 占位） */
export function createEmptyVideoDocument(title: string): WorkDocument {
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
    workType: VIDEO_WORK_TYPE,
    meta: { title },
    graph: emptyGraph,
    resources: { images: [], audios: [], videos: [], fonts: [], others: [] },
    extra: { video: createEmptyVideoData() },
  }
}

/** 根据片段类型生成默认时长（无素材时占位） */
export function defaultClipDuration(type: VideoClipType): number {
  if (type === 'image') return 3
  return 5
}
