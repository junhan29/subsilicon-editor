/**
 * 漫画类型单元测试
 *
 * 覆盖：
 * - ComicData 模型（画格增删、分页统计、付费画格统计）
 * - 导出器：翻页 HTML（付费遮罩/解锁码/转义）、长条 HTML、试看预览（前 N 格）、ZIP 打包
 */

import { describe, expect, it } from 'vitest'
import {
  type ComicData,
  countComicPages,
  countComicPanels,
  countPaidPanels,
  createEmptyComicData,
  createEmptyComicDocument,
  generatePanelId,
  getComicData,
  withComicData,
} from '../work-types/comic'
import { comicAdapter } from '../work-types/comic-adapter'
import {
  type ComicPage,
  buildComicPages,
  exportComicToZip,
  freePreviewPanels,
  renderComicPreviewHTML,
  renderFlipHTML,
  renderScrollHTML,
} from '../export-comic'

function sampleData(): ComicData {
  return {
    panels: [
      { id: 'p1', page: 1, order: 0, assetHash: 'a1', assetName: '封面.png', dialogues: [{ id: 'd1', text: '欢迎来到小镇' }], narration: '晨雾弥漫。', paid: false },
      { id: 'p2', page: 2, order: 0, assetHash: 'a2', assetName: '对决.png', dialogues: [{ id: 'd2', speaker: '林远', text: '你终于来了' }], narration: '', paid: true, price: 1.5 },
      { id: 'p3', page: 2, order: 1, assetHash: 'a2', assetName: '对决.png', dialogues: [], narration: '风停了。', paid: true, price: 1.5 },
    ],
    assets: [
      { hash: 'a1', name: '封面.png', type: 'image', mime: 'image/png', size: 100 },
      { hash: 'a2', name: '对决.png', type: 'image', mime: 'image/png', size: 200 },
    ],
    freePreviewPanels: 1,
    wholePrice: 6.6,
    author: '测试作者',
  }
}

const mockResolve: (hash: string) => Promise<string | null> = async (hash) =>
  hash === 'none' ? null : `data:image/png;base64,${hash}`

describe('comic model', () => {
  it('createEmptyComicData 返回空结构', () => {
    const data = createEmptyComicData()
    expect(data.panels).toEqual([])
    expect(data.assets).toEqual([])
    expect(data.freePreviewPanels).toBe(0)
  })

  it('createEmptyComicDocument 生成正确 WorkDocument', () => {
    const doc = createEmptyComicDocument('我的漫画')
    expect(doc.workType).toBe('comic')
    expect(doc.formatVersion).toBe('2.0')
    expect(doc.meta.title).toBe('我的漫画')
    expect(doc.extra?.comic).toBeDefined()
  })

  it('getComicData 从 WorkDocument 提取数据', () => {
    const doc = createEmptyComicDocument('我的漫画')
    const data = getComicData(doc)
    expect(data.panels).toEqual([])
  })

  it('countComicPanels / countComicPages / countPaidPanels 统计', () => {
    const data = sampleData()
    expect(countComicPanels(data)).toBe(3)
    expect(countComicPages(data)).toBe(2)
    expect(countPaidPanels(data)).toBe(2)
  })

  it('withComicData 写入 extra.comic', () => {
    const doc = createEmptyComicDocument('x')
    const next = withComicData(doc, sampleData())
    expect(getComicData(next).panels).toHaveLength(3)
  })

  it('generatePanelId 生成唯一 ID', () => {
    expect(generatePanelId()).not.toBe(generatePanelId())
  })
})

describe('comic adapter', () => {
  it('类型标识与描述', () => {
    expect(comicAdapter.id).toBe('comic')
    expect(comicAdapter.name).toBe('漫画')
  })

  it('createEmptyGraph 生成占位图', () => {
    const graph = comicAdapter.createEmptyGraph()
    expect(Array.isArray(graph.nodes)).toBe(true)
  })

  it('导出格式包含翻页/长条/ZIP/试看', () => {
    const ids = comicAdapter.getExportFormats().map((f) => f.id)
    expect(ids).toContain('comic_flip')
    expect(ids).toContain('comic_scroll')
    expect(ids).toContain('comic_zip')
    expect(ids).toContain('comic_preview')
  })

  it('getPreviewHTML 返回可用的 HTML', async () => {
    const graph = comicAdapter.createEmptyGraph()
    graph.title = '预览漫画'
    const html = await comicAdapter.getPreviewHTML(graph)
    expect(html).toContain('<html')
    expect(html).toContain('试看')
  })

  it('getDdpStats 返回类型化统计字段', () => {
    const graph = comicAdapter.createEmptyGraph()
    graph.title = 'x'
    const stats = comicAdapter.getDdpStats(graph)
    expect(stats).toHaveProperty('panelCount')
    expect(stats).toHaveProperty('pageCount')
    expect(stats).toHaveProperty('paidPanelCount')
    expect(stats).toHaveProperty('freePreviewPanels')
  })

  it('付费粒度支持 whole/panel', () => {
    expect(comicAdapter.getMonetizationGranularity()).toEqual(['whole', 'panel'])
  })
})

describe('comic export', () => {
  it('buildComicPages 按页分组并保持顺序', async () => {
    const pages = await buildComicPages(sampleData(), mockResolve)
    expect(pages).toHaveLength(2)
    expect(pages[0].page).toBe(1)
    expect(pages[0].panels).toHaveLength(1)
    expect(pages[1].page).toBe(2)
    expect(pages[1].panels).toHaveLength(2)
    expect(pages[1].panels[0].src).toContain('a2')
  })

  it('buildComicPages 缺素材兜底占位图', async () => {
    const data: ComicData = {
      panels: [{ id: 'x', page: 1, order: 0, assetHash: 'none', dialogues: [], narration: '', paid: false }],
      assets: [],
      freePreviewPanels: 0,
    }
    const pages = await buildComicPages(data, mockResolve)
    expect(pages[0].panels[0].src).toContain('data:image/svg+xml')
  })

  it('freePreviewPanels 优先使用试读格数', () => {
    expect(freePreviewPanels(sampleData())).toBe(1)
  })

  it('freePreviewPanels 无试读设置时取首个付费格前格数', () => {
    const data = sampleData()
    data.freePreviewPanels = 0
    expect(freePreviewPanels(data)).toBe(1)
  })

  it('renderFlipHTML 包含分页/素材/台词/付费遮罩与解锁码', () => {
    const pages: ComicPage[] = [
      { page: 1, panels: [{ id: 'p1', page: 1, index: 0, src: 'data:image/png;base64,aa', dialogues: [{ id: 'd1', text: '欢迎' }], narration: '晨雾', paid: false }] },
      { page: 2, panels: [{ id: 'p2', page: 2, index: 1, src: 'data:image/png;base64,bb', dialogues: [{ id: 'd2', speaker: '林远', text: '你来了' }], narration: '', paid: true }] },
    ]
    const html = renderFlipHTML({
      title: '测试漫画',
      author: '作者',
      pages,
      freePanels: 1,
      paidPanelCount: 1,
      unlockCodeHash: 'code123',
    })
    expect(html).toContain('<html')
    expect(html).toContain('测试漫画')
    expect(html).toContain('作者')
    expect(html).toContain('2 页 · 2 格')
    expect(html).toContain('1 个付费画格')
    expect(html).toContain('data:image/png;base64,aa')
    expect(html).toContain('data:image/png;base64,bb')
    expect(html).toContain('晨雾')
    expect(html).toContain('林远')
    expect(html).toContain('你来了')
    expect(html).toContain('id="lock"')
    expect(html).toContain('code123')
    expect(html).toContain('freePanels = 1')
  })

  it('renderFlipHTML 无付费时不渲染锁面板', () => {
    const pages: ComicPage[] = [
      { page: 1, panels: [{ id: 'p1', page: 1, index: 0, src: 'data:image/png;base64,aa', dialogues: [], narration: '', paid: false }] },
    ]
    const html = renderFlipHTML({ title: 't', pages, freePanels: 0, paidPanelCount: 0 })
    expect(html).toContain('免费阅读')
    expect(html).not.toContain('id="lock"')
  })

  it('renderFlipHTML 转义标题防注入', () => {
    const html = renderFlipHTML({ title: '<script>alert(1)</script>', pages: [], freePanels: 0, paidPanelCount: 0 })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('renderScrollHTML 长条模式包含全部画格', () => {
    const pages: ComicPage[] = [
      { page: 1, panels: [{ id: 'p1', page: 1, index: 0, src: 'data:image/png;base64,aa', dialogues: [{ id: 'd1', text: '欢迎' }], narration: '', paid: false }] },
      { page: 2, panels: [{ id: 'p2', page: 2, index: 1, src: 'data:image/png;base64,bb', dialogues: [], narration: '', paid: true }] },
    ]
    const html = renderScrollHTML({ title: '长条漫画', pages, freePanels: 1, paidPanelCount: 1 })
    expect(html).toContain('长条版')
    expect(html).toContain('data:image/png;base64,aa')
    expect(html).toContain('data:image/png;base64,bb')
    expect(html).toContain('1 个付费画格')
  })

  it('renderComicPreviewHTML 试看仅含前 N 格', () => {
    const pages: ComicPage[] = [
      { page: 1, panels: [{ id: 'p1', page: 1, index: 0, src: 'data:a', dialogues: [{ id: 'd1', text: '第一格' }], narration: '', paid: false }] },
      { page: 2, panels: [{ id: 'p2', page: 2, index: 1, src: 'data:b', dialogues: [], narration: '第二格', paid: true }] },
      { page: 3, panels: [{ id: 'p3', page: 3, index: 2, src: 'data:c', dialogues: [], narration: '', paid: true }] },
    ]
    const html = renderComicPreviewHTML({ title: '预览', pages, freePanels: 2 })
    expect(html).toContain('data:a')
    expect(html).toContain('data:b')
    expect(html).not.toContain('data:c')
    expect(html).toContain('第一格')
    expect(html).toContain('试看结束')
  })

  it('exportComicToZip 生成包含 HTML 与素材文件的 ZIP', async () => {
    const blob = await exportComicToZip(sampleData(), '测试漫画', mockResolve, { author: '作者' })
    expect(blob.size).toBeGreaterThan(100)
  })
})
