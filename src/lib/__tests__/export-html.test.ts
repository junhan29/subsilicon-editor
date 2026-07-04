/** export-html 单元测试 */
import {
  exportToHTML,
  encryptPaidContent,
  embedAssets,
} from '../export-html'
import type { StoryGraph, StoryNode } from '@editor/types/editor'
import type { MonetizationConfig } from '../work-monetization'

let passed = 0
let failed = 0
const failures: string[] = []

const testQueue: Array<{ describeName: string; testName: string; fn: () => void | Promise<void> }> = []
let currentDescribe = ''

function describe(name: string, fn: () => void): void {
  currentDescribe = name
  fn()
  currentDescribe = ''
}

function it(name: string, fn: () => void | Promise<void>): void {
  testQueue.push({ describeName: currentDescribe, testName: name, fn })
}

async function runTestQueue(): Promise<void> {
  let lastDescribe = ''
  for (const test of testQueue) {
    if (test.describeName !== lastDescribe) {
      console.log(`\n▸ ${test.describeName}`)
      lastDescribe = test.describeName
    }
    try {
      await test.fn()
      passed++
      console.log(`  ✓ ${test.testName}`)
    } catch (e) {
      failed++
      const msg = e instanceof Error ? e.message : String(e)
      failures.push(`${test.testName}: ${msg}`)
      console.log(`  ✗ ${test.testName}`)
      console.log(`    ${msg.split('\n').join('\n    ')}`)
    }
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) {
    throw new Error(`${message}\n     expected: ${e}\n     actual:   ${a}`)
  }
}

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

// 解码 __ENC__: 前缀的 Base64
function decodeEncValue(value: string): string {
  const prefix = '__ENC__:'
  if (!value.startsWith(prefix)) return value
  const encoded = value.slice(prefix.length)
  return decodeURIComponent(escape(atob(encoded)))
}

export async function runTests(): Promise<void> {
  passed = 0
  failed = 0
  failures.length = 0

  describe('encryptPaidContent 付费内容加密', () => {
    it('付费关闭时返回原图（深拷贝）', () => {
      const graph = makeStoryGraph()
      const monetization = makeMonetization({ enabled: false })
      const result = encryptPaidContent(graph, monetization)
      assertEqual(result, graph, '付费关闭时应返回相同内容')
      // 验证是深拷贝（不同引用）
      assert(result !== graph, '应返回新对象')
      assert(result.nodes !== graph.nodes, 'nodes 应为新数组')
    })

    it('无付费节点时返回原图', () => {
      const graph = makeStoryGraph()
      const monetization = makeMonetization({ paidNodes: [] })
      const result = encryptPaidContent(graph, monetization)
      // 无付费节点时，返回的图内容应与原图相同
      assertEqual(result.nodes[0].data, graph.nodes[0].data, '无付费节点时内容不变')
    })

    it('加密付费节点的 text 字段', () => {
      const graph = makeStoryGraph()
      const monetization = makeMonetization({ paidNodes: ['node-1'] })
      const result = encryptPaidContent(graph, monetization)
      const encryptedText = result.nodes[0].data.text as string
      assert(encryptedText.startsWith('__ENC__:'), 'text 字段应以 __ENC__: 开头')
      // 验证可以解码回原文
      assertEqual(decodeEncValue(encryptedText), '你好世界', '解码后应等于原文')
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
        assert(value.startsWith('__ENC__:'), `${field} 应被加密`)
      }
    })

    it('免费预览节点不被加密', () => {
      const graph = makeStoryGraph()
      const monetization = makeMonetization({
        paidNodes: ['node-1', 'node-2'],
        freePreviewNodes: ['node-1'],
      })
      const result = encryptPaidContent(graph, monetization)
      // node-1 是免费预览，不应被加密
      const node1Text = result.nodes[0].data.text as string
      assert(!node1Text.startsWith('__ENC__:'), '免费预览节点不应被加密')
      // node-2 是付费节点，应被加密
      const node2Prompt = result.nodes[1].data.prompt as string
      assert(node2Prompt.startsWith('__ENC__:'), '付费节点应被加密')
    })

    it('加密 options 数组中的 text 字段', () => {
      const graph = makeStoryGraph()
      const monetization = makeMonetization({ paidNodes: ['node-2'] })
      const result = encryptPaidContent(graph, monetization)
      const options = result.nodes[1].data.options as Array<{ text: string; id: string }>
      for (const opt of options) {
        assert(opt.text.startsWith('__ENC__:'), 'options.text 应被加密')
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
      assertEqual(text, '__ENC__:already-encrypted', '已加密字段不应被重复加密')
    })

    it('不修改原始 graph', () => {
      const graph = makeStoryGraph()
      const originalText = graph.nodes[0].data.text as string
      const monetization = makeMonetization({ paidNodes: ['node-1'] })
      encryptPaidContent(graph, monetization)
      assertEqual(graph.nodes[0].data.text, originalText, '原始 graph 不应被修改')
    })

    it('非付费节点的字段不被加密', () => {
      const graph = makeStoryGraph()
      const monetization = makeMonetization({ paidNodes: ['node-3'] })
      const result = encryptPaidContent(graph, monetization)
      // node-1 不在付费列表中，不应被加密
      const node1Text = result.nodes[0].data.text as string
      assert(!node1Text.startsWith('__ENC__:'), '非付费节点不应被加密')
    })
  })

  describe('embedAssets 素材内嵌', () => {
    it('无 blob: URL 时直接返回深拷贝', async () => {
      const graph = makeStoryGraph()
      const result = await embedAssets(graph)
      assert(result !== graph, '应返回新对象（深拷贝）')
      assertEqual(result, graph, '内容应相同')
    })

    it('不修改原始 graph', async () => {
      const graph = makeStoryGraph()
      const originalTitle = graph.title
      await embedAssets(graph)
      assertEqual(graph.title, originalTitle, '原始 graph 不应被修改')
    })

    it('空 nodes 数组正常处理', async () => {
      const graph = makeStoryGraph({ nodes: [] })
      const result = await embedAssets(graph)
      assertEqual(result.nodes.length, 0, 'nodes 应为空')
    })
  })

  describe('exportToHTML HTML 导出', () => {
    it('返回包含 DOCTYPE 的完整 HTML 字符串', async () => {
      const graph = makeStoryGraph()
      const html = await exportToHTML(graph)
      assert(typeof html === 'string', '应返回字符串')
      assert(html.startsWith('<!DOCTYPE html>'), '应以 <!DOCTYPE html> 开头')
      assert(html.includes('</html>'), '应包含 </html> 结束标签')
    })

    it('HTML 中包含故事标题', async () => {
      const graph = makeStoryGraph({ title: '我的测试故事' })
      const html = await exportToHTML(graph)
      assert(html.includes('<title>我的测试故事</title>'), '应包含故事标题')
    })

    it('HTML 中包含 lang="zh-CN"', async () => {
      const graph = makeStoryGraph()
      const html = await exportToHTML(graph)
      assert(html.includes('lang="zh-CN"'), '应包含 lang="zh-CN"')
    })

    it('HTML 中包含 #root 容器', async () => {
      const graph = makeStoryGraph()
      const html = await exportToHTML(graph)
      assert(html.includes('id="root"'), '应包含 #root 容器')
    })

    it('HTML 中包含故事数据（window.__STORY_GRAPH__）', async () => {
      const graph = makeStoryGraph()
      const html = await exportToHTML(graph)
      assert(html.includes('window.__STORY_GRAPH__'), '应包含故事数据脚本')
    })

    it('无付费配置时不包含 paywall overlay', async () => {
      const graph = makeStoryGraph()
      const html = await exportToHTML(graph)
      // CSS 中总是包含 #paywall-overlay 样式定义，但无付费配置时不应有实际的 paywall div
      assert(!html.includes('id="paywall-overlay"'), '无付费配置时不应包含 paywall div')
      // 运行时脚本中总是引用 window.__MONETIZATION__（var monetization = window.__MONETIZATION__），
      // 但无付费配置时不应有赋值语句 window.__MONETIZATION__ = {...}
      assert(!html.includes('window.__MONETIZATION__ ='), '无付费配置时不应包含 __MONETIZATION__ 赋值')
    })

    it('有付费配置时包含 paywall overlay', async () => {
      const graph = makeStoryGraph()
      const monetization = makeMonetization()
      const html = await exportToHTML(graph, monetization)
      assert(html.includes('paywall-overlay'), '有付费配置时应包含 paywall overlay')
      assert(html.includes('window.__MONETIZATION__'), '应包含 __MONETIZATION__')
    })

    it('有付费配置时付费节点内容被加密', async () => {
      const graph = makeStoryGraph()
      const monetization = makeMonetization({ paidNodes: ['node-1'] })
      const html = await exportToHTML(graph, monetization)
      assert(
        html.includes('__ENC__:'),
        '付费节点内容应被 Base64 加密（包含 __ENC__: 前缀）'
      )
    })

    it('导出的 HTML 中 JSON 被 XSS 转义（< > & 转义）', async () => {
      // 将 XSS 载荷放在节点 text 字段中（仅出现在 JSON 中，不会出现在 <title> 标签中）
      const graph = makeStoryGraph({
        nodes: [
          makeNode('xss-1', 'dialogue', {
            text: '</script><script>alert(1)</script>',
            characterName: '角色',
          }),
        ],
      })
      const html = await exportToHTML(graph)
      // JSON 中的 </script> 应被转义为 \u003c/script\u003e，不能直接出现
      assert(
        !html.includes('</script><script>alert(1)'),
        'JSON 中的 </script> 应被转义'
      )
      // 验证转义后的形式存在
      assert(
        html.includes('\\u003c/script\\u003e'),
        'JSON 中应包含转义后的 \\u003c/script\\u003e'
      )
    })

    it('不同配置导出不同 HTML', async () => {
      const graph1 = makeStoryGraph({ title: '故事一' })
      const graph2 = makeStoryGraph({ title: '故事二' })
      const html1 = await exportToHTML(graph1)
      const html2 = await exportToHTML(graph2)
      assert(html1 !== html2, '不同故事应导出不同 HTML')
      assert(html1.includes('故事一'), 'html1 应包含故事一')
      assert(html2.includes('故事二'), 'html2 应包含故事二')
    })

    it('HTML 包含运行时脚本', async () => {
      const graph = makeStoryGraph()
      const html = await exportToHTML(graph)
      assert(html.includes('<script>'), '应包含 <script> 标签')
      assert(html.includes('renderNode') || html.includes('function'), '应包含运行时函数')
    })

    it('HTML 包含 CSS 样式', async () => {
      const graph = makeStoryGraph()
      const html = await exportToHTML(graph)
      assert(html.includes('<style>'), '应包含 <style> 标签')
      assert(html.includes('.node'), '应包含 .node 样式')
    })

    it('HTML 包含 UNLOCK_CODE_PREFIX 常量', async () => {
      const graph = makeStoryGraph()
      const html = await exportToHTML(graph)
      assert(html.includes('SUBSL-UNLOCK-'), '应包含解锁码前缀常量')
      assert(html.includes('SUBSL-REQ-'), '应包含请求凭证前缀常量')
    })
  })

  await runTestQueue()

  console.log(
    `\n=== export-html 测试结果: ${passed} 通过, ${failed} 失败 ===`
  )
  if (failed > 0) {
    console.log('\n失败用例:')
    failures.forEach((f) => console.log(`  - ${f}`))
    throw new Error(`${failed} 个测试失败`)
  }
}

// 当作主模块运行时自动执行测试
const isMainModule = (() => {
  try {
    return (
      typeof process !== 'undefined' &&
      !!process.argv[1]?.includes('export-html.test')
    )
  } catch {
    return false
  }
})()

if (isMainModule) {
  runTests().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
