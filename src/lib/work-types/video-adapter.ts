/**
 * 视频作品类型适配器
 *
 * 视频数据存放于 WorkDocument.extra.video（见 video.ts）。
 * 编辑界面使用独立时间线面板（VideoEditor），导出走 export-video。
 */

import type { WorkDocument, WorkTypeAdapter } from '@editor/types/work'
import type { StoryGraph } from '@editor/types/editor'
import {
  VIDEO_WORK_TYPE,
  countPaidClips,
  countVideoClips,
  countVideoDuration,
  createEmptyVideoData,
  createEmptyVideoDocument,
  getVideoData,
} from '@editor/lib/work-types/video'
import {
  exportVideoPreviewHTML,
  exportVideoToBiliScript,
  exportVideoToPlayerHTML,
  freePreviewSeconds,
} from '@editor/lib/export-video'

export const videoAdapter: WorkTypeAdapter = {
  id: VIDEO_WORK_TYPE,
  name: '视频',
  icon: 'Film',
  description: '时间线轻中度剪辑，支持字幕/配音/转场、片段付费与试看，导出付费播放器 HTML / B 站脚本',

  createEmptyGraph(): StoryGraph {
    return createEmptyVideoDocument('未命名视频').graph
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
      workType: VIDEO_WORK_TYPE,
      meta: {
        title: graph.title || '未命名视频',
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
      { id: 'video_html', name: '付费播放器 HTML', description: '单文件网页，内嵌素材，付费片段遮罩与解锁码', icon: 'Film', ext: '.html' },
      { id: 'video_preview', name: '试看预览 HTML', description: '仅前 N 秒/免费片段，用于发布展示', icon: 'Eye', ext: '.html' },
      { id: 'video_bili', name: 'B 站互动视频脚本', description: '分 P 配置 CSV（素材需自行上传 B 站）', icon: 'FileText', ext: '.csv' },
    ]
  },

  async getPreviewHTML(graph: StoryGraph): Promise<string> {
    // 预览数据从 graph 中回读 extra 不可行（发布侧只有 graph）；
    // 视频发布预览在发布侧由 extra 提供，此处给出空预览兜底。
    return exportVideoPreviewHTML(createEmptyVideoData(), graph.title || '未命名视频', async () => null)
  },

  getDdpStats(graph: StoryGraph): Record<string, unknown> {
    const data = getVideoData({
      formatVersion: '2.0',
      workType: VIDEO_WORK_TYPE,
      meta: { title: graph.title || '' },
      graph,
      resources: { images: [], audios: [], videos: [], fonts: [], others: [] },
    })
    return {
      clipCount: countVideoClips(data),
      durationSec: countVideoDuration(data),
      paidClipCount: countPaidClips(data),
      previewSeconds: freePreviewSeconds(data),
    }
  },

  getMonetizationGranularity() {
    return ['whole', 'segment'] as const
  },
}
