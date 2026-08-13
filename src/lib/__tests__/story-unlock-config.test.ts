/** Task 1.4：导出配置注入验证 —— 在线验码 / 站内发码申请 / creatorEmail / apiUrl 注入条件 */
import { describe, expect, it } from 'vitest'
import { exportToStoryHTML } from '../export-story-html'
import type { StoryExportConfig } from '../export-story-html'
import type { StoryGraph, StoryNode } from '@editor/types/editor'

function makeNode(id: string, type: string = 'dialogue', data: Record<string, unknown> = {}): StoryNode {
  return { id, type: type as any, position: { x: 0, y: 0 }, data }
}

function makeGraph(): StoryGraph {
  return {
    title: '导出配置验证故事',
    description: '验证',
    templateId: 'custom',
    characters: [],
    variables: [],
    nodes: [
      makeNode('n1', 'dialogue', { text: '开始', characterName: '旁白' }),
      makeNode('n2', 'ending', { text: '结局', title: '结局', endingType: 'good' }),
    ],
    edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    settings: { title: '导出配置验证故事', tags: [] },
    assets: { images: [], audios: [], fonts: [] },
  }
}

function makeConfig(overrides: Partial<StoryExportConfig> = {}): StoryExportConfig {
  return {
    unlockMode: 'offline',
    price: 9.9,
    freePreview: 0,
    workId: 'work_unlock_config',
    customApiUrl: '',
    offlineCodes: [],
    keyBase64: undefined,
    ...overrides,
  }
}

describe('导出配置注入：在线验码 / 站内发码申请（Task 1.4）', () => {
  it('默认关闭：未传 onlineCodeVerify/inWorkCodeRequest 时导出为 false', async () => {
    const { html } = await exportToStoryHTML(makeGraph(), makeConfig())
    expect(html).toContain('onlineCodeVerify: false')
    expect(html).toContain('inWorkCodeRequest: false')
  })

  it('开启注入：onlineCodeVerify/inWorkCodeRequest/creatorEmail 落盘为开启值', async () => {
    const { html } = await exportToStoryHTML(
      makeGraph(),
      makeConfig({
        onlineCodeVerify: true,
        inWorkCodeRequest: true,
        creatorEmail: 'creator@test.com',
      }),
    )
    expect(html).toContain('onlineCodeVerify: true')
    expect(html).toContain('inWorkCodeRequest: true')
    expect(html).toContain('creatorEmail: "creator@test.com"')
  })

  it('manual + onlineCodeVerify：强制注入默认平台端点 apiUrl 而非 null', async () => {
    const { html } = await exportToStoryHTML(
      makeGraph(),
      makeConfig({ unlockMode: 'manual', onlineCodeVerify: true }),
    )
    expect(html).toContain('apiUrl: "https://subsilicon.cn/api/story-unlock"')
    expect(html).not.toContain('apiUrl: null')
  })

  it('customApiUrl 优先于默认端点（即使开启在线验码）', async () => {
    const { html } = await exportToStoryHTML(
      makeGraph(),
      makeConfig({
        unlockMode: 'manual',
        onlineCodeVerify: true,
        customApiUrl: 'https://example.com/verify',
      }),
    )
    expect(html).toContain('apiUrl: "https://example.com/verify"')
    expect(html).not.toContain('https://subsilicon.cn/api/story-unlock')
  })

  it('未开启任何在线机制时 manual 模式 apiUrl 为 null', async () => {
    const { html } = await exportToStoryHTML(makeGraph(), makeConfig({ unlockMode: 'manual' }))
    expect(html).toContain('apiUrl: null')
    expect(html).toContain('onlineCodeVerify: false')
    expect(html).toContain('inWorkCodeRequest: false')
  })

  it('price=0 且 offlineCodes 非空：仍按免费导出（freeKey 注入，onlineCodeVerify:false）', async () => {
    const { html } = await exportToStoryHTML(
      makeGraph(),
      makeConfig({
        price: 0,
        offlineCodes: [{ codeHash: 'b'.repeat(64), maskedKeyBase64: 'masked-key' }],
      }),
    )
    // freeKey 注入条件以 isFree（price<=0 且无自定义端点）为准，offlineCodes 不再影响免费判定
    expect(html).toContain('freeKey: "')
    expect(html).not.toContain('freeKey: null')
    expect(html).toContain('onlineCodeVerify: false')
  })
})
