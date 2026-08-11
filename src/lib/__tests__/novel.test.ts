/**
 * 小说类型单元测试
 *
 * 覆盖：
 * - NovelData 模型（增删改、字数统计、付费章节统计）
 * - 导出器：EPUB / TXT / HTML / 预览（付费章节遮蔽、试读逻辑）
 */

import { describe, it, expect } from 'vitest'
import {
  createEmptyNovelData,
  getNovelData,
  withNovelData,
  countNovelWords,
  countPaidChapters,
  generateChapterId,
  createEmptyNovelDocument,
  type NovelData,
} from '../work-types/novel'
import { novelAdapter } from '../work-types/novel-adapter'
import {
  exportNovelToEPUB,
  exportNovelToTXT,
  exportNovelToHTML,
  exportNovelPreviewHTML,
} from '../export-novel'

function sampleData(): NovelData {
  return {
    chapters: [
      { id: 'ch1', title: '第一章 启程', contentHtml: '<p>故事开始。</p>', order: 0, paid: false },
      { id: 'ch2', title: '第二章 危机', contentHtml: '<p>危机来临。</p>', order: 1, paid: true, price: 3.5 },
      { id: 'ch3', title: '第三章 抉择', contentHtml: '<p>做出抉择。</p>', order: 2, paid: true, price: 3.5 },
    ],
    freePreviewChapters: 1,
    descriptionHtml: '<p>一本测试小说。</p>',
    wholePrice: 9.9,
    author: '测试作者',
  }
}

describe('novel model', () => {
  it('createEmptyNovelData 返回空结构', () => {
    const data = createEmptyNovelData()
    expect(data.chapters).toEqual([])
    expect(data.freePreviewChapters).toBe(0)
  })

  it('createEmptyNovelDocument 生成正确 WorkDocument', () => {
    const doc = createEmptyNovelDocument('我的书')
    expect(doc.workType).toBe('novel')
    expect(doc.formatVersion).toBe('2.0')
    expect(doc.meta.title).toBe('我的书')
    expect(doc.extra?.novel).toBeDefined()
  })

  it('getNovelData 从 WorkDocument 提取数据', () => {
    const doc = createEmptyNovelDocument('我的书')
    const data = getNovelData(doc)
    expect(data.chapters).toEqual([])
  })

  it('withNovelData 写入小说数据', () => {
    const doc = createEmptyNovelDocument('我的书')
    const data = sampleData()
    const updated = withNovelData(doc, data)
    expect((updated.extra as Record<string, unknown>).novel).toBe(data)
  })

  it('generateChapterId 生成唯一 ID', () => {
    const a = generateChapterId()
    const b = generateChapterId()
    expect(a).not.toBe(b)
    expect(a.startsWith('ch_')).toBe(true)
  })

  it('countNovelWords 统计正文（去标签）字数', () => {
    const data = sampleData()
    const words = countNovelWords(data)
    expect(words).toBeGreaterThan(0)
    expect(words).toBe('故事开始。危机来临。做出抉择。'.length)
  })

  it('countPaidChapters 统计付费章节数', () => {
    expect(countPaidChapters(sampleData())).toBe(2)
  })
})

describe('novel adapter', () => {
  it('类型信息正确', () => {
    expect(novelAdapter.id).toBe('novel')
    expect(novelAdapter.name).toBe('小说')
    expect(novelAdapter.getMonetizationGranularity()).toEqual(['whole', 'chapter'])
  })

  it('导出格式清单正确', () => {
    const formats = novelAdapter.getExportFormats().map((f) => f.id)
    expect(formats).toEqual(['novel_epub', 'novel_html', 'novel_txt'])
  })

  it('createEmptyGraph 返回合法占位图', () => {
    const graph = novelAdapter.createEmptyGraph()
    expect(graph.nodes).toEqual([])
    expect(graph.edges).toEqual([])
  })

  it('getPreviewHTML 返回 HTML', () => {
    const html = novelAdapter.getPreviewHTML(novelAdapter.createEmptyGraph())
    expect(html).toContain('<!DOCTYPE html>')
  })
})

describe('novel export', () => {
  it('exportNovelToEPUB 生成有效 EPUB Blob', async () => {
    const blob = await exportNovelToEPUB(sampleData(), '测试小说', '测试作者')
    expect(blob.type).toBe('application/epub+zip')
    expect(blob.size).toBeGreaterThan(100)
  })

  it('exportNovelToTXT 包含标题与章节', () => {
    const txt = exportNovelToTXT(sampleData(), '测试小说')
    expect(txt).toContain('《测试小说》')
    expect(txt).toContain('第一章 启程')
    expect(txt).toContain('故事开始。')
  })

  it('exportNovelToTXT 付费章节遮蔽内容', () => {
    const txt = exportNovelToTXT(sampleData(), '测试小说')
    // 付费章节（第 2/3 章，试读 1 章）应显示占位而非正文
    expect(txt).not.toContain('危机来临。')
    expect(txt).toContain('【本章节为付费内容')
  })

  it('exportNovelToHTML 免费章节含正文，付费章节显示遮罩', () => {
    const html = exportNovelToHTML(sampleData(), '测试小说')
    expect(html).toContain('故事开始。')
    expect(html).toContain('本章节为付费内容')
    expect(html).not.toContain('危机来临。')
  })

  it('exportNovelPreviewHTML 只含前 3 章', () => {
    const data = sampleData()
    const html = exportNovelPreviewHTML(data, '测试小说', '测试作者')
    expect(html).toContain('故事开始。')
    expect(html).toContain('测试作者')
    expect(html).toContain('共 3 章')
  })
})
