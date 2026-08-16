import { describe, it, expect, beforeAll } from 'vitest'
import {
  createEmptyBooth,
  defaultPreviewForType,
  DEFAULT_COMPLIANCE_NOTE,
  PRIMARY_BOOTH_ID,
  BOOTH_VERSION,
} from '@editor/lib/booth/types'
import { collectBoothItems, buildBoothPackage, generateBoothPreviewHTML, buildBoothDdp, DDP_PROTOCOL_VERSION } from '@editor/lib/booth/pack'
import type { Booth, BoothWorkEntry } from '@editor/lib/booth/types'
import type { StoredWork } from '@editor/lib/local-db/work-store'
import type { WorkDocument } from '@editor/types/work'
import { registerBuiltinWorkTypes } from '@editor/lib/work-types'

beforeAll(() => {
  // 测试环境不经过 main.tsx，需手动注册内置作品类型适配器，
  // 否则 getWorkType() 抛错，buildBoothDdp 的 stats 计算会退化为空对象
  registerBuiltinWorkTypes()
})

function makeWork(id: string, title: string, workType: WorkDocument['workType']): StoredWork {
  const now = Date.now()
  return {
    id,
    name: title,
    updatedAt: now,
    createdAt: now,
    lastOpened: now,
    nodeCount: 0,
    edgeCount: 0,
    templateId: 'custom',
    workType,
    editorData: {
      formatVersion: '2.0',
      workType,
      meta: { title, description: `${title} 简介` },
      graph: { title, nodes: [], edges: [] } as never,
      resources: { images: [], audios: [], videos: [], fonts: [], others: [] },
    },
  }
}

function entryFor(workId: string, workType: BoothWorkEntry['workType']): BoothWorkEntry {
  return {
    workId,
    workType,
    preview: { type: 'nodes', value: 3 },
    pricing: { override: false },
    addedAt: Date.now(),
  }
}

describe('booth types', () => {
  it('createEmptyBooth 生成合规空摊位', () => {
    const booth = createEmptyBooth('测试摊位')
    expect(booth.boothVersion).toBe(BOOTH_VERSION)
    expect(booth.id).toBe(PRIMARY_BOOTH_ID)
    expect(booth.name).toBe('测试摊位')
    expect(booth.creator.handle).toBe('测试摊位')
    expect(booth.works).toEqual([])
    expect(booth.display.order).toEqual([])
    expect(booth.sync.walls).toEqual([])
    expect(booth.complianceNote).toBe(DEFAULT_COMPLIANCE_NOTE)
    expect(booth.creator.contact).toBe('')
  })

  it('defaultPreviewForType 按类型给默认试阅', () => {
    expect(defaultPreviewForType('novel')).toEqual({ type: 'chapters', value: 2 })
    expect(defaultPreviewForType('video')).toEqual({ type: 'seconds', value: 30 })
    expect(defaultPreviewForType('comic')).toEqual({ type: 'panels', value: 6 })
    expect(defaultPreviewForType('interactive-narrative')).toEqual({ type: 'nodes', value: 3 })
  })
})

describe('booth pack', () => {
  const w1 = makeWork('w1', '雾都来信', 'interactive-narrative')
  const w2 = makeWork('w2', '长夜录', 'novel')

  function boothWith(order: string[]): Booth {
    const booth = createEmptyBooth('测试摊位')
    booth.creator.bio = '在摊位上写故事的人'
    booth.creator.contact = '微信：test'
    booth.profile.slogan = '把故事摆上桌'
    booth.profile.tags = ['悬疑', '短篇']
    booth.works = [entryFor('w1', 'interactive-narrative'), entryFor('w2', 'novel')]
    booth.display.order = order
    booth.channels.manual = [{ id: 'c1', kind: 'wechat', label: '微信', value: 'wxid' }]
    booth.channels.thirdParty = [{ id: 'c2', kind: 'afdian', label: '爱发电', link: 'https://afdian.com/x' }]
    return booth
  }

  it('collectBoothItems 按陈列顺序返回条目', () => {
    const items = collectBoothItems(boothWith(['w2', 'w1']), [w1, w2])
    expect(items.map((i) => i.work.id)).toEqual(['w2', 'w1'])
  })

  it('collectBoothItems 把未列入 order 的已入摊作品追加在末尾', () => {
    const booth = boothWith(['w1'])
    const items = collectBoothItems(booth, [w1, w2])
    expect(items.map((i) => i.work.id)).toEqual(['w1', 'w2'])
  })

  it('buildBoothPackage 生成 booth.json / ddp.json / preview.html / works 目录', () => {
    const files = buildBoothPackage(boothWith(['w1', 'w2']), collectBoothItems(boothWith(['w1', 'w2']), [w1, w2]))
    const paths = files.map((f) => f.path)
    expect(paths).toContain('booth/booth.json')
    expect(paths).toContain('booth/ddp.json')
    expect(paths).toContain('booth/preview.html')
    expect(paths.some((p) => p.startsWith('booth/works/') && p.endsWith('.json'))).toBe(true)
    const boothJson = JSON.parse(files.find((f) => f.path === 'booth/booth.json')!.content)
    expect(boothJson.name).toBe('测试摊位')
  })

  it('buildBoothDdp 产出 DDP 1.1 结构（booth 层 + workType + 类型化 stats）', () => {
    const booth = boothWith(['w1', 'w2'])
    const items = collectBoothItems(booth, [w1, w2])
    const ddp = buildBoothDdp(booth, items)
    expect(ddp.protocolVersion).toBe(DDP_PROTOCOL_VERSION)
    expect(ddp.protocolVersion).toBe('1.1')
    expect(ddp.booth.handle).toBe('测试摊位')
    expect(ddp.booth.tags).toEqual(['悬疑', '短篇'])
    expect(ddp.works).toHaveLength(2)
    // 互动叙事 stats
    const narrative = ddp.works.find((w) => w.workId === 'w1')!
    expect(narrative.workType).toBe('interactive-narrative')
    expect(typeof narrative.stats.nodeCount).toBe('number')
    // 小说 stats
    const novel = ddp.works.find((w) => w.workId === 'w2')!
    expect(novel.workType).toBe('novel')
    expect(typeof novel.stats.wordCount).toBe('number')
    expect(typeof novel.stats.chapterCount).toBe('number')
    // 试阅配置透传
    expect(novel.preview).toEqual({ type: 'nodes', value: 3 })
  })

  it('booth/ddp.json 包含协议版本与类型化统计', () => {
    const booth = boothWith(['w1', 'w2'])
    const files = buildBoothPackage(booth, collectBoothItems(booth, [w1, w2]))
    const ddpJson = JSON.parse(files.find((f) => f.path === 'booth/ddp.json')!.content)
    expect(ddpJson.protocolVersion).toBe('1.1')
    expect(Array.isArray(ddpJson.works)).toBe(true)
    expect(ddpJson.works[0].stats).toBeDefined()
  })

  it('generateBoothPreviewHTML 包含摊位关键区块与合规声明', () => {
    const booth = boothWith(['w1', 'w2'])
    booth.display.featuredId = 'w1'
    const html = generateBoothPreviewHTML(booth, collectBoothItems(booth, [w1, w2]), booth.display.featuredId)
    expect(html).toContain('创作者摊位')
    expect(html).toContain('把故事摆上桌')
    expect(html).toContain('陈列作品')
    expect(html).toContain('雾都来信')
    expect(html).toContain('试玩前 3 个节点')
    expect(html).toContain('收款方式')
    expect(html).toContain('联系创作者')
    expect(html).toContain('微信：test')
    expect(html).toContain(DEFAULT_COMPLIANCE_NOTE)
    // 主推高亮
    expect(html).toContain('featured')
  })

  it('generateBoothPreviewHTML 空摊位给出空态', () => {
    const booth = createEmptyBooth()
    const html = generateBoothPreviewHTML(booth, [], null)
    expect(html).toContain('摊位上还没有陈列作品')
  })
})
