/**
 * outline-parser.ts 单元测试
 *
 * 由于项目未安装 vitest，本测试为纯函数验证脚本：
 *   - 导出 runTests() 函数
 *   - 内部使用自定义 describe/it + 手动断言
 *   - 可通过 `npx tsx outline-parser.test.ts` 直接执行
 */
import {
  parseOutline,
  generateNodesFromOutline,
  generateOutlineFromNodes,
} from '../outline-parser'
import type {
  OutlineItem,
  StoryNode,
  StoryEdge,
} from '@editor/types/editor'

// ============================================
// 简易测试工具
// ============================================

let passed = 0
let failed = 0
const failures: string[] = []

function describe(name: string, fn: () => void): void {
  console.log(`\n▸ ${name}`)
  fn()
}

function it(name: string, fn: () => void): void {
  try {
    fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    failed++
    const msg = e instanceof Error ? e.message : String(e)
    failures.push(`${name}: ${msg}`)
    console.log(`  ✗ ${name}`)
    console.log(`    ${msg.split('\n').join('\n    ')}`)
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

// ============================================
// 测试数据构造
// ============================================

function makeDialogueNode(id: string, text: string): StoryNode {
  return {
    id,
    type: 'dialogue',
    position: { x: 0, y: 0 },
    data: { text },
  }
}

function makeChoiceNode(
  id: string,
  prompt: string,
  options: { id: string; text: string }[]
): StoryNode {
  return {
    id,
    type: 'choice',
    position: { x: 0, y: 0 },
    data: { prompt, options },
  }
}

function makeEdge(
  source: string,
  target: string,
  sourceHandle?: string
): StoryEdge {
  return {
    id: `edge-${source}-${target}`,
    source,
    target,
    sourceHandle,
  }
}

// ============================================
// 测试用例
// ============================================

export function runTests(): void {
  passed = 0
  failed = 0
  failures.length = 0

  describe('parseOutline 大纲文本 → 节点', () => {
    it('空字符串返回空数组', () => {
      assertEqual(parseOutline(''), [], '空字符串应返回空数组')
    })

    it('纯空白行返回空数组', () => {
      assertEqual(parseOutline('\n  \n\t\n'), [], '空白行应返回空数组')
    })

    it('解析单个章节', () => {
      const items = parseOutline('# 第一章')
      assertEqual(items.length, 1, '应有 1 个 item')
      assertEqual(items[0].type, 'chapter', 'type 应为 chapter')
      assertEqual(items[0].title, '第一章', 'title')
      assertEqual(items[0].level, 1, 'level 应为 1')
      assertEqual(items[0].children.length, 0, 'children 应为空')
    })

    it('解析多级章节标题（## 和 ###）', () => {
      const items = parseOutline('## 第二章\n### 子节')
      // ## 与 ### level 不同但都视为 chapter；level>=parent 时入栈
      assertEqual(items.length, 1, '顶层应只有 1 个 chapter')
      assertEqual(items[0].level, 2, '顶层 level=2')
      assertEqual(items[0].children.length, 1, '应嵌套 1 个子节')
      assertEqual(items[0].children[0].level, 3, '子节 level=3')
    })

    it('解析列表项为节点', () => {
      const items = parseOutline('- 对话一')
      assertEqual(items.length, 1, '应有 1 个 item')
      assertEqual(items[0].type, 'node', 'type 应为 node')
      assertEqual(items[0].title, '对话一', 'title')
      assertEqual(items[0].nodeType, 'dialogue', '默认 nodeType dialogue')
    })

    it('解析 * 和 + 作为列表标记', () => {
      const items1 = parseOutline('* 项A')
      assertEqual(items1[0].title, '项A', '* 标记')
      const items2 = parseOutline('+ 项B')
      assertEqual(items2[0].title, '项B', '+ 标记')
    })

    it('根据标题推断 nodeType', () => {
      const cases: Array<{ title: string; expected: string }> = [
        { title: '完美结局', expected: 'ending' },
        { title: '选择：去哪', expected: 'choice' },
        { title: '选项A', expected: 'choice' },
        { title: '如果：好感度>50', expected: 'condition' },
        { title: '条件判断', expected: 'condition' },
        { title: '随机事件', expected: 'random' },
        { title: '普通对话', expected: 'dialogue' },
      ]
      for (const c of cases) {
        const items = parseOutline(`- ${c.title}`)
        assertEqual(
          items[0].nodeType,
          c.expected,
          `标题 "${c.title}" 应推断为 ${c.expected}`
        )
      }
    })
  })

  describe('parseOutline 缩进层级', () => {
    it('零缩进列表项都在顶层', () => {
      const items = parseOutline('- A\n- B\n- C')
      assertEqual(items.length, 3, '应有 3 个顶层 item')
      assertEqual(items[0].title, 'A', '第一个 A')
      assertEqual(items[2].title, 'C', '最后一个 C')
    })

    it('2 空格缩进创建嵌套', () => {
      const items = parseOutline('- 父节点\n  - 子节点')
      assertEqual(items.length, 1, '应有 1 个顶层 item')
      assertEqual(items[0].title, '父节点', '顶层标题')
      assertEqual(items[0].children.length, 1, '应有 1 个子节点')
      assertEqual(items[0].children[0].title, '子节点', '子节点标题')
    })

    it('4 空格缩进创建三级嵌套', () => {
      const items = parseOutline('- 一级\n  - 二级\n    - 三级')
      assertEqual(items.length, 1, '顶层 1 个')
      assertEqual(items[0].children.length, 1, '二级 1 个')
      assertEqual(
        items[0].children[0].children.length,
        1,
        '三级 1 个'
      )
      assertEqual(
        items[0].children[0].children[0].title,
        '三级',
        '三级标题'
      )
    })

    it('同级缩进保持平级', () => {
      const items = parseOutline('- 父\n  - 子1\n  - 子2\n  - 子3')
      assertEqual(items[0].children.length, 3, '应有 3 个同级子节点')
      assertEqual(items[0].children[0].title, '子1', '子1')
      assertEqual(items[0].children[2].title, '子3', '子3')
    })
  })

  describe('parseOutline 章节 + 列表混合', () => {
    it('章节下嵌套列表项', () => {
      const items = parseOutline('# 第一章\n- 对话一\n- 对话二')
      assertEqual(items.length, 1, '应有 1 个 chapter')
      assertEqual(items[0].children.length, 2, 'chapter 下应有 2 个 node')
      assertEqual(items[0].children[0].type, 'node', '子项应为 node')
      assertEqual(items[0].children[1].title, '对话二', '第二个对话')
    })

    it('多个章节分离', () => {
      const items = parseOutline('# 第一章\n- A\n# 第二章\n- B')
      assertEqual(items.length, 2, '应有 2 个 chapter')
      assertEqual(items[0].children[0].title, 'A', '第一章下 A')
      assertEqual(items[1].children[0].title, 'B', '第二章下 B')
    })

    it('忽略空行', () => {
      const items = parseOutline('- A\n\n\n- B')
      assertEqual(items.length, 2, '空行应被忽略，2 个节点')
    })

    it('处理 CRLF 换行', () => {
      const items = parseOutline('- A\r\n- B\r\n')
      assertEqual(items.length, 2, 'CRLF 应正确处理')
    })
  })

  describe('generateNodesFromOutline 大纲 → 节点', () => {
    it('空 items 返回空 nodes/edges', () => {
      const result = generateNodesFromOutline([])
      assertEqual(result.nodes.length, 0, 'nodes 应为空')
      assertEqual(result.edges.length, 0, 'edges 应为空')
    })

    it('单个 dialogue 节点', () => {
      const items: OutlineItem[] = [
        {
          id: 'i1',
          type: 'node',
          title: '你好',
          level: 100,
          children: [],
          nodeType: 'dialogue',
        },
      ]
      const result = generateNodesFromOutline(items)
      assertEqual(result.nodes.length, 1, '应有 1 个节点')
      assertEqual(result.edges.length, 0, '不应有边')
      assertEqual(result.nodes[0].type, 'dialogue', '节点类型 dialogue')
    })

    it('父节点 + 子节点生成边', () => {
      const items: OutlineItem[] = [
        {
          id: 'i1',
          type: 'node',
          title: '父',
          level: 100,
          children: [
            {
              id: 'i2',
              type: 'node',
              title: '子',
              level: 101,
              children: [],
              nodeType: 'dialogue',
            },
          ],
          nodeType: 'dialogue',
        },
      ]
      const result = generateNodesFromOutline(items)
      assertEqual(result.nodes.length, 2, '应有 2 个节点')
      assertEqual(result.edges.length, 1, '应有 1 条边')
      assertEqual(result.edges[0].source, result.nodes[0].id, '边源 = 父节点')
      assertEqual(result.edges[0].target, result.nodes[1].id, '边目标 = 子节点')
    })

    it('choice 节点的子项生成带 sourceHandle 的边', () => {
      const items: OutlineItem[] = [
        {
          id: 'i1',
          type: 'node',
          title: '选择：去哪',
          level: 100,
          children: [
            {
              id: 'i2',
              type: 'node',
              title: 'A',
              level: 101,
              children: [],
              nodeType: 'dialogue',
            },
            {
              id: 'i3',
              type: 'node',
              title: 'B',
              level: 101,
              children: [],
              nodeType: 'dialogue',
            },
          ],
          nodeType: 'choice',
        },
      ]
      const result = generateNodesFromOutline(items)
      // 1 choice + 2 children = 3 nodes; 2 edges
      assertEqual(result.nodes.length, 3, '应有 3 个节点')
      assertEqual(result.edges.length, 2, '应有 2 条边')
      assertEqual(result.edges[0].sourceHandle, 'source-0', '第一条边 source-0')
      assertEqual(result.edges[1].sourceHandle, 'source-1', '第二条边 source-1')
      // choice 节点的 data 应包含 options
      const choiceNode = result.nodes[0]
      const data = choiceNode.data as { options: unknown[]; prompt: string }
      assertEqual(data.options.length, 2, 'choice options 应有 2 项')
      assertEqual(data.prompt, '选择：去哪', 'choice prompt')
    })

    it('ending 节点的 data 包含 title 和 endingType', () => {
      const items: OutlineItem[] = [
        {
          id: 'i1',
          type: 'node',
          title: '完美结局',
          level: 100,
          children: [],
          nodeType: 'ending',
        },
      ]
      const result = generateNodesFromOutline(items)
      assertEqual(result.nodes[0].type, 'ending', '类型 ending')
      const data = result.nodes[0].data as {
        title: string
        endingType: string
      }
      assertEqual(data.title, '完美结局', 'data.title')
      assertEqual(data.endingType, 'neutral', '默认 endingType neutral')
    })

    it('condition 节点的 data 包含 trueLabel/falseLabel', () => {
      const items: OutlineItem[] = [
        {
          id: 'i1',
          type: 'node',
          title: '如果：好感>50',
          level: 100,
          children: [
            {
              id: 'i2',
              type: 'node',
              title: '是分支',
              level: 101,
              children: [],
              nodeType: 'dialogue',
            },
            {
              id: 'i3',
              type: 'node',
              title: '否分支',
              level: 101,
              children: [],
              nodeType: 'dialogue',
            },
          ],
          nodeType: 'condition',
        },
      ]
      const result = generateNodesFromOutline(items)
      const condNode = result.nodes[0]
      const data = condNode.data as {
        trueLabel: string
        falseLabel: string
        expression: string
      }
      assertEqual(data.trueLabel, '是分支', 'trueLabel 应为子项 1 标题')
      assertEqual(data.falseLabel, '否分支', 'falseLabel 应为子项 2 标题')
    })

    it('自定义 options 生效', () => {
      const items: OutlineItem[] = [
        {
          id: 'i1',
          type: 'node',
          title: 'A',
          level: 100,
          children: [],
          nodeType: 'dialogue',
        },
      ]
      const result = generateNodesFromOutline(items, {
        startX: 100,
        startY: 50,
        nodeWidth: 200,
        nodeHeight: 80,
      })
      assertEqual(result.nodes[0].position.x, 100, 'x 应为自定义 startX')
      assertEqual(result.nodes[0].position.y, 50, 'y 应为自定义 startY')
    })
  })

  describe('generateOutlineFromNodes 节点 → 大纲文本', () => {
    it('空节点列表返回空字符串', () => {
      assertEqual(generateOutlineFromNodes([], []), '', '空应返回空串')
    })

    it('单个 dialogue 节点', () => {
      const nodes = [makeDialogueNode('n1', '你好世界')]
      const outline = generateOutlineFromNodes(nodes, [])
      assert(outline.includes('你好世界'), '大纲应包含对话文本')
      assert(outline.includes('- '), '应使用列表标记')
    })

    it('短文本截断到 30 字符（dialogue 节点）', () => {
      const longText = '这是一段非常非常长的对话文本用于测试截断逻辑应该被限制在三十个字符以内'
      const nodes = [makeDialogueNode('n1', longText)]
      const outline = generateOutlineFromNodes(nodes, [])
      assert(
        outline.includes(longText.slice(0, 30)),
        '大纲应包含截断后的文本'
      )
      assert(
        !outline.includes(longText.slice(0, 31)),
        '大纲不应包含超出 30 字符的文本'
      )
    })

    it('两个节点 + 边形成链', () => {
      const n1 = makeDialogueNode('n1', '开始')
      const n2 = makeDialogueNode('n2', '结束')
      const edge = makeEdge('n1', 'n2')
      const outline = generateOutlineFromNodes([n1, n2], [edge])
      assert(outline.includes('开始'), '应包含 n1 文本')
      assert(outline.includes('结束'), '应包含 n2 文本')
      // n1 的行号应早于 n2
      const idxStart = outline.indexOf('开始')
      const idxEnd = outline.indexOf('结束')
      assert(idxStart < idxEnd, '开始应在结束之前')
    })

    it('choice 节点输出选项标签', () => {
      const choice = makeChoiceNode('c1', '选择路径', [
        { id: 'opt-a', text: '选项A' },
        { id: 'opt-b', text: '选项B' },
      ])
      const t1 = makeDialogueNode('t1', 'A 后果')
      const t2 = makeDialogueNode('t2', 'B 后果')
      const edges = [
        makeEdge('c1', 't1', 'source-0'),
        makeEdge('c1', 't2', 'source-1'),
      ]
      const outline = generateOutlineFromNodes(
        [choice, t1, t2],
        edges
      )
      assert(outline.includes('选择路径'), '应包含 choice prompt')
      assert(outline.includes('选项A'), '应包含选项 A')
      assert(outline.includes('选项B'), '应包含选项 B')
      assert(outline.includes('A 后果'), '应包含 A 后果')
      assert(outline.includes('B 后果'), '应包含 B 后果')
    })

    it('孤立节点归入"其他节点"', () => {
      // 没有边的两个节点，都视为起点，但都未被访问时归入"其他节点"
      const n1 = makeDialogueNode('n1', '孤1')
      const n2 = makeDialogueNode('n2', '孤2')
      // 没有边，n1 和 n2 都视为 startNodes，都被遍历
      const outline = generateOutlineFromNodes([n1, n2], [])
      assert(outline.includes('孤1'), '应包含孤1')
      assert(outline.includes('孤2'), '应包含孤2')
    })

    it('带 group 的大纲生成章节标题', () => {
      const n1 = makeDialogueNode('n1', 'A')
      const groups = [{ id: 'g1', name: '我的章节', nodeIds: ['n1'] }]
      const outline = generateOutlineFromNodes([n1], [], groups)
      assert(outline.includes('## 我的章节'), '应包含 ## 章节标题')
      assert(outline.includes('A'), '应包含 A')
    })

    it('outline 末尾以换行结尾', () => {
      const nodes = [makeDialogueNode('n1', '你好')]
      const outline = generateOutlineFromNodes(nodes, [])
      assert(
        outline.endsWith('\n'),
        '大纲文本应以换行结尾'
      )
    })

    it('ending 节点输出"结局："前缀', () => {
      const node: StoryNode = {
        id: 'e1',
        type: 'ending',
        position: { x: 0, y: 0 },
        data: { title: '完美', text: '', endingType: 'good' },
      }
      const outline = generateOutlineFromNodes([node], [])
      assert(outline.includes('结局：完美'), '应包含 "结局：完美"')
    })

    it('condition 节点输出"条件："前缀', () => {
      const node: StoryNode = {
        id: 'c1',
        type: 'condition',
        position: { x: 0, y: 0 },
        data: { expression: 'a > 5', trueLabel: '是', falseLabel: '否' },
      }
      const outline = generateOutlineFromNodes([node], [])
      assert(outline.includes('条件：'), '应包含 "条件：" 前缀')
      assert(outline.includes('a > 5'), '应包含表达式')
    })
  })

  describe('parseOutline → generateNodesFromOutline 集成', () => {
    it('简单列表转换为节点', () => {
      const text = '- 你好\n- 世界'
      const items = parseOutline(text)
      const result = generateNodesFromOutline(items)
      assertEqual(result.nodes.length, 2, '应生成 2 个节点')
      // 两个顶层节点无父子关系，无边
      assertEqual(result.edges.length, 0, '不应有边')
    })

    it('带嵌套的大纲转换为节点 + 边', () => {
      const text = '- 父节点\n  - 子节点A\n  - 子节点B'
      const items = parseOutline(text)
      const result = generateNodesFromOutline(items)
      assertEqual(result.nodes.length, 3, '应生成 3 个节点（1 父 2 子）')
      assertEqual(result.edges.length, 2, '应有 2 条边（父→各子）')
    })

    it('choice 大纲生成带 sourceHandle 的边', () => {
      const text = '- 选择：路径\n  - A\n  - B'
      const items = parseOutline(text)
      const result = generateNodesFromOutline(items)
      assertEqual(result.nodes.length, 3, '1 choice + 2 children = 3 nodes')
      assertEqual(result.edges.length, 2, '应有 2 条边')
      assertEqual(result.edges[0].sourceHandle, 'source-0', '边 1 source-0')
      assertEqual(result.edges[1].sourceHandle, 'source-1', '边 2 source-1')
    })

    it('章节下多个列表项各自独立', () => {
      const text = '# 第一章\n- 对话A\n- 对话B'
      const items = parseOutline(text)
      const result = generateNodesFromOutline(items)
      assertEqual(result.nodes.length, 2, '应有 2 个对话节点')
      // 章节下子节点为兄弟，无边
      assertEqual(result.edges.length, 0, '兄弟节点间不应有边')
    })
  })

  console.log(
    `\n=== outline-parser 测试结果: ${passed} 通过, ${failed} 失败 ===`
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
      !!process.argv[1]?.includes('outline-parser.test')
    )
  } catch {
    return false
  }
})()

if (isMainModule) {
  runTests()
}
