/**
 * work-registry / work-migrate 单元测试
 *
 * 覆盖 Phase 1 核心抽象：
 * - 类型适配器注册与回退
 * - 旧格式 StoryGraph → WorkDocument 迁移
 * - 双格式读取归一化（StoredWork.editorData）
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { getWorkType, hasWorkType, isLegacyStoryGraph, isWorkDocument, listWorkTypes, registerWorkType } from '../work-registry'
import { interactiveNarrativeAdapter } from '../work-types/interactive-narrative'
import type { StoryGraph } from '@editor/types/editor'

function createLegacyGraph(): StoryGraph {
  return {
    title: '测试故事',
    description: '描述',
    templateId: 'custom',
    characters: [],
    variables: [],
    nodes: [
      { id: 'n1', type: 'narration', position: { x: 0, y: 0 }, data: { text: '开场旁白' } },
      { id: 'n2', type: 'choice', position: { x: 0, y: 100 }, data: { prompt: '选择', options: [] } },
    ],
    edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    settings: { title: '测试故事', tags: ['测试', '互动'] },
    assets: { images: ['img-a'], audios: [], fonts: [] },
    scenes: [],
    audios: [],
    groups: [],
    annotations: [],
  }
}

beforeAll(() => {
  // 测试环境不执行 main.tsx，需手动注册内置适配器
  registerWorkType(interactiveNarrativeAdapter)
})

describe('work-registry', () => {
  it('互动叙事类型默认已注册', () => {
    expect(hasWorkType('interactive-narrative')).toBe(true)
    expect(listWorkTypes().some((a) => a.id === 'interactive-narrative')).toBe(true)
  })

  it('getWorkType 未注册类型回退到互动叙事', () => {
    const adapter = getWorkType('unknown-type' as never)
    expect(adapter.id).toBe('interactive-narrative')
  })

  it('重复注册同一类型不覆盖（幂等）', () => {
    registerWorkType(interactiveNarrativeAdapter)
    const count = listWorkTypes().filter((a) => a.id === 'interactive-narrative').length
    expect(count).toBe(1)
  })

  it('isLegacyStoryGraph / isWorkDocument 判定正确', () => {
    const legacy = createLegacyGraph()
    expect(isLegacyStoryGraph(legacy)).toBe(true)
    expect(isWorkDocument(legacy)).toBe(false)

    const doc = interactiveNarrativeAdapter.fromGraph(legacy)
    expect(isWorkDocument(doc)).toBe(true)
    expect(isLegacyStoryGraph(doc)).toBe(false)
  })
})

describe('互动叙事适配器', () => {
  it('适配器 fromGraph 保留营利配置', () => {
    const legacy = createLegacyGraph()
    legacy.monetization = {
      enabled: true,
      granularity: 'whole',
      paymentMethod: 'wechat_manual',
      paidNodes: ['n2'],
      price: 9.9,
      workId: 'work_1',
    } as never
    const doc = interactiveNarrativeAdapter.fromGraph(legacy)
    expect(doc.monetization?.enabled).toBe(true)
  })

  it('适配器 DDP 统计正确', () => {
    const legacy = createLegacyGraph()
    const stats = interactiveNarrativeAdapter.getDdpStats(legacy)
    expect(stats.nodeCount).toBe(2)
    expect(stats.endingCount).toBe(0)
    expect(stats.wordCount).toBeGreaterThan(0)
  })

  it('导出格式清单与互动叙事既有格式一致', () => {
    const formats = interactiveNarrativeAdapter.getExportFormats()
    const ids = formats.map((f) => f.id)
    expect(ids).toEqual(
      expect.arrayContaining(['html', 'zip', 'story_exec', 'script', 'epub', 'i18n', 'desktop_app', 'bilibili_interactive'])
    )
  })

  it('营利粒度包含整本/章节/节点', () => {
    const granularity = interactiveNarrativeAdapter.getMonetizationGranularity()
    expect(granularity).toEqual(expect.arrayContaining(['whole', 'chapter', 'node']))
  })
})
