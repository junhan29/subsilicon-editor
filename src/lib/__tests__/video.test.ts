/**
 * 视频类型单元测试
 *
 * 覆盖：
 * - VideoData 模型（片段增删、时长统计、付费片段统计）
 * - 导出器：播放列表构建、试看秒数、付费播放器 HTML（遮罩/解锁码）、试看 HTML（裁剪）、B 站分 P 脚本
 */

import { describe, expect, it } from 'vitest'
import {
  type VideoData,
  countPaidClips,
  countVideoClips,
  countVideoDuration,
  createEmptyVideoData,
  createEmptyVideoDocument,
  defaultClipDuration,
  generateClipId,
  getVideoData,
  withVideoData,
} from '../work-types/video'
import { videoAdapter } from '../work-types/video-adapter'
import {
  type PlaylistClip,
  buildVideoPlaylist,
  exportVideoToBiliScript,
  freePreviewSeconds,
  renderPlayerHTML,
  renderPreviewHTML,
} from '../export-video'

function sampleData(): VideoData {
  return {
    clips: [
      { id: 'vc1', type: 'video', assetHash: 'a1', assetName: '开场.mp4', trimStart: 0, trimEnd: 0, duration: 5, volume: 1, transition: 'fade', subtitle: '开场字幕', voiceover: '', paid: false, order: 0 },
      { id: 'vc2', type: 'image', assetHash: 'a2', assetName: '关键图.png', trimStart: 0, trimEnd: 0, duration: 3, volume: 1, transition: 'none', subtitle: '剧情图', voiceover: '', paid: true, price: 1.5, order: 1 },
      { id: 'vc3', type: 'audio', assetHash: 'a3', assetName: '配乐.mp3', trimStart: 10, trimEnd: 0, duration: 8, volume: 0.6, transition: 'none', subtitle: '', voiceover: '', paid: false, order: 2 },
    ],
    assets: [
      { hash: 'a1', name: '开场.mp4', type: 'video', mime: 'video/mp4', duration: 5, size: 100 },
      { hash: 'a2', name: '关键图.png', type: 'image', mime: 'image/png', size: 50 },
      { hash: 'a3', name: '配乐.mp3', type: 'audio', mime: 'audio/mpeg', duration: 60, size: 200 },
    ],
    wholePrice: 9.9,
    previewSeconds: 4,
    author: '测试作者',
  }
}

const mockResolve: (hash: string) => Promise<string | null> = async (hash) =>
  hash === 'none' ? null : `data:application/octet-stream;base64,${hash}`

describe('video model', () => {
  it('createEmptyVideoData 返回空结构', () => {
    const data = createEmptyVideoData()
    expect(data.clips).toEqual([])
    expect(data.assets).toEqual([])
    expect(data.previewSeconds).toBe(0)
  })

  it('createEmptyVideoDocument 生成正确 WorkDocument', () => {
    const doc = createEmptyVideoDocument('我的视频')
    expect(doc.workType).toBe('video')
    expect(doc.formatVersion).toBe('2.0')
    expect(doc.meta.title).toBe('我的视频')
    expect(doc.extra?.video).toBeDefined()
  })

  it('getVideoData 从 WorkDocument 提取数据', () => {
    const doc = createEmptyVideoDocument('我的视频')
    const data = getVideoData(doc)
    expect(data.clips).toEqual([])
  })

  it('countVideoDuration 汇总片段时长', () => {
    expect(countVideoDuration(sampleData())).toBe(16)
  })

  it('countPaidClips 统计付费片段', () => {
    expect(countPaidClips(sampleData())).toBe(1)
  })

  it('countVideoClips 统计片段数', () => {
    expect(countVideoClips(sampleData())).toBe(3)
  })

  it('withVideoData 写入 extra.video', () => {
    const doc = createEmptyVideoDocument('x')
    const data = sampleData()
    const next = withVideoData(doc, data)
    expect(getVideoData(next).clips).toHaveLength(3)
  })

  it('generateClipId 生成唯一 ID', () => {
    expect(generateClipId()).not.toBe(generateClipId())
  })

  it('defaultClipDuration 返回合理默认值', () => {
    expect(defaultClipDuration('image')).toBe(3)
    expect(defaultClipDuration('video')).toBe(5)
  })
})

describe('video adapter', () => {
  it('类型标识与描述', () => {
    expect(videoAdapter.id).toBe('video')
    expect(videoAdapter.name).toBe('视频')
  })

  it('createEmptyGraph 生成占位图', () => {
    const graph = videoAdapter.createEmptyGraph()
    expect(Array.isArray(graph.nodes)).toBe(true)
    expect(Array.isArray(graph.edges)).toBe(true)
  })

  it('validateGraph 校验结构', () => {
    expect(videoAdapter.validateGraph({ nodes: [], edges: [] })).toBe(true)
    expect(videoAdapter.validateGraph({})).toBe(false)
    expect(videoAdapter.validateGraph(null)).toBe(false)
  })

  it('导出格式包含播放器/试看/B站脚本', () => {
    const formats = videoAdapter.getExportFormats()
    const ids = formats.map((f) => f.id)
    expect(ids).toContain('video_html')
    expect(ids).toContain('video_preview')
    expect(ids).toContain('video_bili')
  })

  it('getPreviewHTML 返回可用的 HTML', async () => {
    const graph = videoAdapter.createEmptyGraph()
    graph.title = '预览视频'
    const html = await videoAdapter.getPreviewHTML(graph)
    expect(html).toContain('<html')
    expect(html).toContain('试看')
  })

  it('getDdpStats 返回类型化统计字段', () => {
    const graph = videoAdapter.createEmptyGraph()
    graph.title = 'x'
    const stats = videoAdapter.getDdpStats(graph)
    // 发布侧仅提供 graph（无 extra），类型化统计字段存在但为默认值（限制见 adapter 注释）
    expect(stats).toHaveProperty('clipCount')
    expect(stats).toHaveProperty('durationSec')
    expect(stats).toHaveProperty('paidClipCount')
    expect(stats).toHaveProperty('previewSeconds')
  })

  it('付费粒度支持 whole/segment', () => {
    expect(videoAdapter.getMonetizationGranularity()).toEqual(['whole', 'segment'])
  })
})

describe('video export', () => {
  it('buildVideoPlaylist 解析素材并保持顺序', async () => {
    const playlist = await buildVideoPlaylist(sampleData(), mockResolve)
    expect(playlist).toHaveLength(3)
    expect(playlist[0].type).toBe('video')
    expect(playlist[0].dur).toBe(5)
    expect(playlist[0].src).toContain('a1')
    expect(playlist[1].paid).toBe(true)
    // 缺素材兜底为占位图
    const missing = await buildVideoPlaylist({ clips: [{ id: 'x', type: 'image', assetHash: 'none', trimStart: 0, trimEnd: 0, duration: 2, volume: 1, transition: 'none', subtitle: '', voiceover: '', paid: false, order: 0 }], assets: [], previewSeconds: 0 }, mockResolve)
    expect(missing[0].src).toContain('data:image/svg+xml')
  })

  it('freePreviewSeconds 优先使用试看秒数', () => {
    const data = sampleData()
    expect(freePreviewSeconds(data)).toBe(4)
  })

  it('freePreviewSeconds 无试看设置时取首个付费片段前时长', () => {
    const data = sampleData()
    data.previewSeconds = 0
    expect(freePreviewSeconds(data)).toBe(5)
  })

  it('renderPlayerHTML 包含全部片段与付费遮罩逻辑', () => {
    const playlist: PlaylistClip[] = [
      { id: 'p1', type: 'video', src: 'data:video/mp4;base64,xx', dur: 5, trimStart: 0, subtitle: '开场', transition: 'fade', paid: false },
      { id: 'p2', type: 'image', src: 'data:image/png;base64,yy', dur: 3, trimStart: 0, subtitle: '剧情图', transition: 'none', paid: true },
    ]
    const html = renderPlayerHTML({
      title: '测试视频',
      author: '作者',
      playlist,
      previewSeconds: 4,
      wholePrice: 9.9,
      paidClipCount: 1,
      unlockCodeHash: 'abc123',
      paymentNote: '支持创作者',
    })
    expect(html).toContain('<html')
    expect(html).toContain('测试视频')
    expect(html).toContain('作者')
    expect(html).toContain('previewSeconds = 4')
    expect(html).toContain('abc123')
    expect(html).toContain('data:video/mp4;base64,xx')
    expect(html).toContain('data:image/png;base64,yy')
    expect(html).toContain('开场')
    // 付费遮罩逻辑：lock 面板与解锁逻辑存在
    expect(html).toContain('id="lock"')
    expect(html).toContain('解锁完整内容')
    // 1 个付费片段标签
    expect(html).toContain('1 个付费片段')
  })

  it('renderPlayerHTML 无付费时标记免费观看', () => {
    const playlist: PlaylistClip[] = [
      { id: 'p1', type: 'image', src: 'data:image/png;base64,yy', dur: 3, trimStart: 0, subtitle: '', transition: 'none', paid: false },
    ]
    const html = renderPlayerHTML({ title: 't', playlist, previewSeconds: 0, paidClipCount: 0 })
    expect(html).toContain('免费观看')
    expect(html).not.toContain('id="lock"')
  })

  it('renderPlayerHTML 转义标题防注入', () => {
    const playlist: PlaylistClip[] = []
    const html = renderPlayerHTML({ title: '<script>alert(1)</script>', playlist, previewSeconds: 0, paidClipCount: 0 })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('renderPreviewHTML 按试看秒数裁剪片段且不含付费片段', () => {
    const playlist: PlaylistClip[] = [
      { id: 'p1', type: 'video', src: 'data:v', dur: 5, trimStart: 0, subtitle: 'a', transition: 'none', paid: false },
      { id: 'p2', type: 'image', src: 'data:i', dur: 3, trimStart: 0, subtitle: 'b', transition: 'none', paid: true },
      { id: 'p3', type: 'audio', src: 'data:a', dur: 8, trimStart: 0, subtitle: '', transition: 'none', paid: false },
    ]
    const html = renderPreviewHTML({ title: '预览', playlist, previewSeconds: 6 })
    // 试看 6 秒：p1(5s) 后付费片段 p2 跳过（不泄露），p3 截断补足 1s
    expect(html).toContain('data:v')
    expect(html).toContain('data:a')
    expect(html).not.toContain('data:i')
    // 截断的片段 dur 为 1
    expect(html).toContain('"dur":1')
    expect(html).toContain('试看结束')
  })

  it('renderPreviewHTML 无试看时长时不包含任何片段', () => {
    const playlist: PlaylistClip[] = [
      { id: 'p1', type: 'image', src: 'data:i', dur: 3, trimStart: 0, subtitle: '', transition: 'none', paid: false },
    ]
    // previewSeconds=0 表示无免费试看：试看文件为空，不得兜底塞入片段
    const html = renderPreviewHTML({ title: '预览', playlist, previewSeconds: 0 })
    expect(html).not.toContain('data:i')
  })

  it('exportVideoToBiliScript 生成分 P CSV', () => {
    const csv = exportVideoToBiliScript(sampleData(), '测试视频')
    expect(csv).toContain('分P序号,标题,素材文件,起止(秒),时长(秒),字幕')
    expect(csv).toContain('开场.mp4')
    expect(csv).toContain('10-结尾')
    expect(csv).toContain('配乐.mp3')
  })
})
