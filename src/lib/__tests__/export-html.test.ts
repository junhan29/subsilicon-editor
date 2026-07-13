/** export-html 单元测试 */
import { describe, it, expect } from 'vitest'
import {
  exportToHTML,
  encryptPaidContent,
  embedAssets,
} from '../export-html'
import type { StoryGraph, StoryNode } from '@editor/types/editor'
import type { MonetizationConfig } from '../work-monetization'

function makeNode(
  id: string,
  type: string = 'dialogue',
  data: Record<string, unknown> = {}
): StoryNode {
  return {
    id,
    type: type as any,
    position: { x: 0, y: 0 },
    data,
  }
}

function makeStoryGraph(
  overrides: Partial<StoryGraph> = {}
): StoryGraph {
  return {
    title: '测试故事',
    description: '这是一个测试故事',
    templateId: 'custom',
    characters: [],
    variables: [],
    nodes: [
      makeNode('node-1', 'dialogue', { text: '你好世界', characterName: '角色A' }),
      makeNode('node-2', 'choice', {
        prompt: '请选择',
        options: [
          { id: 'opt-1', text: '选项A' },
          { id: 'opt-2', text: '选项B' },
        ],
      }),
      makeNode('node-3', 'ending', { text: '结局', title: '好结局', endingType: 'good' }),
    ],
    edges: [
      { id: 'e1', source: 'node-1', target: 'node-2' },
      { id: 'e2', source: 'node-2', target: 'node-3' },
    ],
    settings: {
      title: '测试故事',
      tags: [],
    },
    assets: { images: [], audios: [], fonts: [] },
    ...overrides,
  }
}

function makeMonetization(
  overrides: Partial<MonetizationConfig> = {}
): MonetizationConfig {
  return {
    enabled: true,
    granularity: 'whole',
    paymentMethod: 'wechat_manual',
    paidNodes: ['node-2', 'node-3'],
    price: 9.9,
    workId: 'work_test_html',
    seedKey: 'SUBSL-SEED-TESTKEY1234567890ABCDEF1234567890ABCDEF1234567890ABCD',
    ...overrides,
  }
}

function decodeEncValue(value: string): string {
  const prefix = '__ENC__:'
  if (!value.startsWith(prefix)) return value
  const encoded = value.slice(prefix.length)
  return decodeURIComponent(escape(atob(encoded)))
}

describe('encryptPaidContent 付费内容加密', () => {
  it('付费关闭时返回原图（深拷贝）', () => {
    const graph = makeStoryGraph()
    const monetization = makeMonetization({ enabled: false })
    const result = encryptPaidContent(graph, monetization)
    expect(result).toEqual(graph)
    expect(result !== graph).toBe(true)
    expect(result.nodes !== graph.nodes).toBe(true)
  })

  it('无付费节点时返回原图', () => {
    const graph = makeStoryGraph()
    const monetization = makeMonetization({ paidNodes: [] })
    const result = encryptPaidContent(graph, monetization)
    expect(result.nodes[0].data).toEqual(graph.nodes[0].data)
  })

  it('加密付费节点的 text 字段', () => {
    const graph = makeStoryGraph()
    const monetization = makeMonetization({ paidNodes: ['node-1'] })
    const result = encryptPaidContent(graph, monetization)
    const encryptedText = result.nodes[0].data.text as string
    expect(encryptedText.startsWith('__ENC__:')).toBe(true)
    expect(decodeEncValue(encryptedText)).toEqual('你好世界')
  })

  it('加密付费节点的 title/description/prompt/subtitle 字段', () => {
    const graph = makeStoryGraph({
      nodes: [
        makeNode('paid-1', 'dialogue', {
          text: '文本',
          title: '标题',
          description: '描述',
          prompt: '提示',
          subtitle: '副标题',
        }),
      ],
    })
    const monetization = makeMonetization({ paidNodes: ['paid-1'] })
    const result = encryptPaidContent(graph, monetization)
    const data = result.nodes[0].data
    for (const field of ['text', 'title', 'description', 'prompt', 'subtitle']) {
      const value = data[field] as string
      expect(value.startsWith('__ENC__:')).toBe(true)
    }
  })

  it('免费预览节点不被加密', () => {
    const graph = makeStoryGraph()
    const monetization = makeMonetization({
      paidNodes: ['node-1', 'node-2'],
      freePreviewNodes: ['node-1'],
    })
    const result = encryptPaidContent(graph, monetization)
    const node1Text = result.nodes[0].data.text as string
    expect(!node1Text.startsWith('__ENC__:')).toBe(true)
    const node2Prompt = result.nodes[1].data.prompt as string
    expect(node2Prompt.startsWith('__ENC__:')).toBe(true)
  })

  it('加密 options 数组中的 text 字段', () => {
    const graph = makeStoryGraph()
    const monetization = makeMonetization({ paidNodes: ['node-2'] })
    const result = encryptPaidContent(graph, monetization)
    const options = result.nodes[1].data.options as Array<{ text: string; id: string }>
    for (const opt of options) {
      expect(opt.text.startsWith('__ENC__:')).toBe(true)
    }
  })

  it('不重复加密已加密的字段', () => {
    const graph = makeStoryGraph({
      nodes: [
        makeNode('paid-1', 'dialogue', {
          text: '__ENC__:already-encrypted',
        }),
      ],
    })
    const monetization = makeMonetization({ paidNodes: ['paid-1'] })
    const result = encryptPaidContent(graph, monetization)
    const text = result.nodes[0].data.text as string
    expect(text).toEqual('__ENC__:already-encrypted')
  })

  it('不修改原始 graph', () => {
    const graph = makeStoryGraph()
    const originalText = graph.nodes[0].data.text as string
    const monetization = makeMonetization({ paidNodes: ['node-1'] })
    encryptPaidContent(graph, monetization)
    expect(graph.nodes[0].data.text).toEqual(originalText)
  })

  it('非付费节点的字段不被加密', () => {
    const graph = makeStoryGraph()
    const monetization = makeMonetization({ paidNodes: ['node-3'] })
    const result = encryptPaidContent(graph, monetization)
    const node1Text = result.nodes[0].data.text as string
    expect(!node1Text.startsWith('__ENC__:')).toBe(true)
  })
})

describe('embedAssets 素材内嵌', () => {
  it('无 blob: URL 时直接返回深拷贝', async () => {
    const graph = makeStoryGraph()
    const result = await embedAssets(graph)
    expect(result !== graph).toBe(true)
    expect(result).toEqual(graph)
  })

  it('不修改原始 graph', async () => {
    const graph = makeStoryGraph()
    const originalTitle = graph.title
    await embedAssets(graph)
    expect(graph.title).toEqual(originalTitle)
  })

  it('空 nodes 数组正常处理', async () => {
    const graph = makeStoryGraph({ nodes: [] })
    const result = await embedAssets(graph)
    expect(result.nodes.length).toEqual(0)
  })
})

describe('exportToHTML HTML 导出', () => {
  it('返回包含 DOCTYPE 的完整 HTML 字符串', async () => {
    const graph = makeStoryGraph()
    const html = await exportToHTML(graph)
    expect(typeof html === 'string').toBe(true)
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html.includes('</html>')).toBe(true)
  })

  it('HTML 中包含故事标题', async () => {
    const graph = makeStoryGraph({ title: '我的测试故事' })
    const html = await exportToHTML(graph)
    expect(html.includes('<title>我的测试故事</title>')).toBe(true)
  })

  it('HTML 中包含 lang="zh-CN"', async () => {
    const graph = makeStoryGraph()
    const html = await exportToHTML(graph)
    expect(html.includes('lang="zh-CN"')).toBe(true)
  })

  it('HTML 中包含 #root 容器', async () => {
    const graph = makeStoryGraph()
    const html = await exportToHTML(graph)
    expect(html.includes('id="root"')).toBe(true)
  })

  it('HTML 中包含故事数据（window.__STORY_GRAPH__）', async () => {
    const graph = makeStoryGraph()
    const html = await exportToHTML(graph)
    expect(html.includes('window.__STORY_GRAPH__')).toBe(true)
  })

  it('无付费配置时不包含 paywall overlay', async () => {
    const graph = makeStoryGraph()
    const html = await exportToHTML(graph)
    expect(!html.includes('id="paywall-overlay"')).toBe(true)
    expect(!html.includes('window.__MONETIZATION__ =')).toBe(true)
  })

  it('有付费配置时包含 paywall overlay', async () => {
    const graph = makeStoryGraph()
    const monetization = makeMonetization()
    const html = await exportToHTML(graph, monetization)
    expect(html.includes('paywall-overlay')).toBe(true)
    expect(html.includes('window.__MONETIZATION__')).toBe(true)
  })

  it('有付费配置时付费节点内容被加密', async () => {
    const graph = makeStoryGraph()
    const monetization = makeMonetization({ paidNodes: ['node-1'] })
    const html = await exportToHTML(graph, monetization)
    expect(html.includes('__ENC__:')).toBe(true)
  })

  it('导出的 HTML 中 JSON 被 XSS 转义（< > & 转义）', async () => {
    const graph = makeStoryGraph({
      nodes: [
        makeNode('xss-1', 'dialogue', {
          text: '</script><script>alert(1)</script>',
          characterName: '角色',
        }),
      ],
    })
    const html = await exportToHTML(graph)
    expect(!html.includes('</script><script>alert(1)')).toBe(true)
    expect(html.includes('\\u003c/script\\u003e')).toBe(true)
  })

  it('不同配置导出不同 HTML', async () => {
    const graph1 = makeStoryGraph({ title: '故事一' })
    const graph2 = makeStoryGraph({ title: '故事二' })
    const html1 = await exportToHTML(graph1)
    const html2 = await exportToHTML(graph2)
    expect(html1 !== html2).toBe(true)
    expect(html1.includes('故事一')).toBe(true)
    expect(html2.includes('故事二')).toBe(true)
  })

  it('HTML 包含运行时脚本', async () => {
    const graph = makeStoryGraph()
    const html = await exportToHTML(graph)
    expect(html.includes('<script>')).toBe(true)
    expect(html.includes('renderNode') || html.includes('function')).toBe(true)
  })

  it('HTML 包含 CSS 样式', async () => {
    const graph = makeStoryGraph()
    const html = await exportToHTML(graph)
    expect(html.includes('<style>')).toBe(true)
    expect(html.includes('.node')).toBe(true)
  })

  it('HTML 包含 UNLOCK_CODE_PREFIX 常量', async () => {
    const graph = makeStoryGraph()
    const html = await exportToHTML(graph)
    expect(html.includes('SUBSL-UNLOCK-')).toBe(true)
    expect(html.includes('SUBSL-REQ-')).toBe(true)
  })
})
