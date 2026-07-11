import { describe, it, expect } from 'vitest'
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

describe('parseOutline', () => {
  it('空字符串返回空数组', () => {
    expect(parseOutline('')).toEqual([])
  })

  it('纯空白行返回空数组', () => {
    expect(parseOutline('\n  \n\t\n')).toEqual([])
  })

  it('解析单个章节', () => {
    const items = parseOutline('# 第一章')
    expect(items).toHaveLength(1)
    expect(items[0].type).toBe('chapter')
    expect(items[0].title).toBe('第一章')
    expect(items[0].level).toBe(1)
    expect(items[0].children).toHaveLength(0)
  })

  it('解析多级章节标题（## 和 ###）', () => {
    const items = parseOutline('## 第二章\n### 子节')
    expect(items).toHaveLength(1)
    expect(items[0].level).toBe(2)
    expect(items[0].children).toHaveLength(1)
    expect(items[0].children[0].level).toBe(3)
  })

  it('解析列表项为节点', () => {
    const items = parseOutline('- 对话一')
    expect(items).toHaveLength(1)
    expect(items[0].type).toBe('node')
    expect(items[0].title).toBe('对话一')
    expect(items[0].nodeType).toBe('dialogue')
  })

  it('解析 * 和 + 作为列表标记', () => {
    const items1 = parseOutline('* 项A')
    expect(items1[0].title).toBe('项A')
    const items2 = parseOutline('+ 项B')
    expect(items2[0].title).toBe('项B')
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
      expect(items[0].nodeType).toBe(c.expected)
    }
  })
})

describe('parseOutline 缩进层级', () => {
  it('零缩进列表项都在顶层', () => {
    const items = parseOutline('- A\n- B\n- C')
    expect(items).toHaveLength(3)
    expect(items[0].title).toBe('A')
    expect(items[2].title).toBe('C')
  })

  it('2 空格缩进创建嵌套', () => {
    const items = parseOutline('- 父节点\n  - 子节点')
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('父节点')
    expect(items[0].children).toHaveLength(1)
    expect(items[0].children[0].title).toBe('子节点')
  })

  it('4 空格缩进创建三级嵌套', () => {
    const items = parseOutline('- 一级\n  - 二级\n    - 三级')
    expect(items).toHaveLength(1)
    expect(items[0].children).toHaveLength(1)
    expect(items[0].children[0].children).toHaveLength(1)
    expect(items[0].children[0].children[0].title).toBe('三级')
  })

  it('同级缩进保持平级', () => {
    const items = parseOutline('- 父\n  - 子1\n  - 子2\n  - 子3')
    expect(items[0].children).toHaveLength(3)
    expect(items[0].children[0].title).toBe('子1')
    expect(items[0].children[2].title).toBe('子3')
  })
})

describe('parseOutline 章节 + 列表混合', () => {
  it('章节下嵌套列表项', () => {
    const items = parseOutline('# 第一章\n- 对话一\n- 对话二')
    expect(items).toHaveLength(1)
    expect(items[0].children).toHaveLength(2)
    expect(items[0].children[0].type).toBe('node')
    expect(items[0].children[1].title).toBe('对话二')
  })

  it('多个章节分离', () => {
    const items = parseOutline('# 第一章\n- A\n# 第二章\n- B')
    expect(items).toHaveLength(2)
    expect(items[0].children[0].title).toBe('A')
    expect(items[1].children[0].title).toBe('B')
  })

  it('忽略空行', () => {
    const items = parseOutline('- A\n\n\n- B')
    expect(items).toHaveLength(2)
  })

  it('处理 CRLF 换行', () => {
    const items = parseOutline('- A\r\n- B\r\n')
    expect(items).toHaveLength(2)
  })
})

describe('generateNodesFromOutline', () => {
  it('空 items 返回空 nodes/edges', () => {
    const result = generateNodesFromOutline([])
    expect(result.nodes).toHaveLength(0)
    expect(result.edges).toHaveLength(0)
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
    expect(result.nodes).toHaveLength(1)
    expect(result.edges).toHaveLength(0)
    expect(result.nodes[0].type).toBe('dialogue')
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
    expect(result.nodes).toHaveLength(2)
    expect(result.edges).toHaveLength(1)
    expect(result.edges[0].source).toBe(result.nodes[0].id)
    expect(result.edges[0].target).toBe(result.nodes[1].id)
  })

  it('choice 节点的子项生成带 sourceHandle 的边', () => {
    const items: OutlineItem[] = [
      {
        id: 'i1',
        type: 'node',
        title: '选择：去哪',
        level: 100,
        children: [
          { id: 'i2', type: 'node', title: 'A', level: 101, children: [], nodeType: 'dialogue' },
          { id: 'i3', type: 'node', title: 'B', level: 101, children: [], nodeType: 'dialogue' },
        ],
        nodeType: 'choice',
      },
    ]
    const result = generateNodesFromOutline(items)
    expect(result.nodes).toHaveLength(3)
    expect(result.edges).toHaveLength(2)
    expect(result.edges[0].sourceHandle).toBe('source-0')
    expect(result.edges[1].sourceHandle).toBe('source-1')
    const choiceNode = result.nodes[0]
    const data = choiceNode.data as { options: unknown[]; prompt: string }
    expect(data.options).toHaveLength(2)
    expect(data.prompt).toBe('选择：去哪')
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
    expect(result.nodes[0].type).toBe('ending')
    const data = result.nodes[0].data as { title: string; endingType: string }
    expect(data.title).toBe('完美结局')
    expect(data.endingType).toBe('neutral')
  })

  it('condition 节点的 data 包含 trueLabel/falseLabel', () => {
    const items: OutlineItem[] = [
      {
        id: 'i1',
        type: 'node',
        title: '如果：好感>50',
        level: 100,
        children: [
          { id: 'i2', type: 'node', title: '是分支', level: 101, children: [], nodeType: 'dialogue' },
          { id: 'i3', type: 'node', title: '否分支', level: 101, children: [], nodeType: 'dialogue' },
        ],
        nodeType: 'condition',
      },
    ]
    const result = generateNodesFromOutline(items)
    const data = result.nodes[0].data as { trueLabel: string; falseLabel: string; expression: string }
    expect(data.trueLabel).toBe('是分支')
    expect(data.falseLabel).toBe('否分支')
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
    expect(result.nodes[0].position.x).toBe(100)
    expect(result.nodes[0].position.y).toBe(50)
  })
})

describe('generateOutlineFromNodes', () => {
  it('空节点列表返回空字符串', () => {
    expect(generateOutlineFromNodes([], [])).toBe('')
  })

  it('单个 dialogue 节点', () => {
    const nodes = [makeDialogueNode('n1', '你好世界')]
    const outline = generateOutlineFromNodes(nodes, [])
    expect(outline).toContain('你好世界')
    expect(outline).toContain('- ')
  })

  it('短文本截断到 30 字符（dialogue 节点）', () => {
    const longText = '这是一段非常非常长的对话文本用于测试截断逻辑应该被限制在三十个字符以内'
    const nodes = [makeDialogueNode('n1', longText)]
    const outline = generateOutlineFromNodes(nodes, [])
    expect(outline).toContain(longText.slice(0, 30))
    expect(outline).not.toContain(longText.slice(0, 31))
  })

  it('两个节点 + 边形成链', () => {
    const n1 = makeDialogueNode('n1', '开始')
    const n2 = makeDialogueNode('n2', '结束')
    const edge = makeEdge('n1', 'n2')
    const outline = generateOutlineFromNodes([n1, n2], [edge])
    expect(outline).toContain('开始')
    expect(outline).toContain('结束')
    expect(outline.indexOf('开始')).toBeLessThan(outline.indexOf('结束'))
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
    const outline = generateOutlineFromNodes([choice, t1, t2], edges)
    expect(outline).toContain('选择路径')
    expect(outline).toContain('选项A')
    expect(outline).toContain('选项B')
    expect(outline).toContain('A 后果')
    expect(outline).toContain('B 后果')
  })

  it('孤立节点归入"其他节点"', () => {
    const n1 = makeDialogueNode('n1', '孤1')
    const n2 = makeDialogueNode('n2', '孤2')
    const outline = generateOutlineFromNodes([n1, n2], [])
    expect(outline).toContain('孤1')
    expect(outline).toContain('孤2')
  })

  it('带 group 的大纲生成章节标题', () => {
    const n1 = makeDialogueNode('n1', 'A')
    const groups = [{ id: 'g1', name: '我的章节', nodeIds: ['n1'] }]
    const outline = generateOutlineFromNodes([n1], [], groups)
    expect(outline).toContain('## 我的章节')
    expect(outline).toContain('A')
  })

  it('outline 末尾以换行结尾', () => {
    const nodes = [makeDialogueNode('n1', '你好')]
    const outline = generateOutlineFromNodes(nodes, [])
    expect(outline.endsWith('\n')).toBe(true)
  })

  it('ending 节点输出"结局："前缀', () => {
    const node: StoryNode = {
      id: 'e1',
      type: 'ending',
      position: { x: 0, y: 0 },
      data: { title: '完美', text: '', endingType: 'good' },
    }
    const outline = generateOutlineFromNodes([node], [])
    expect(outline).toContain('结局：完美')
  })

  it('condition 节点输出"条件："前缀', () => {
    const node: StoryNode = {
      id: 'c1',
      type: 'condition',
      position: { x: 0, y: 0 },
      data: { expression: 'a > 5', trueLabel: '是', falseLabel: '否' },
    }
    const outline = generateOutlineFromNodes([node], [])
    expect(outline).toContain('条件：')
    expect(outline).toContain('a > 5')
  })
})

describe('parseOutline → generateNodesFromOutline 集成', () => {
  it('简单列表转换为节点', () => {
    const text = '- 你好\n- 世界'
    const items = parseOutline(text)
    const result = generateNodesFromOutline(items)
    expect(result.nodes).toHaveLength(2)
    expect(result.edges).toHaveLength(0)
  })

  it('带嵌套的大纲转换为节点 + 边', () => {
    const text = '- 父节点\n  - 子节点A\n  - 子节点B'
    const items = parseOutline(text)
    const result = generateNodesFromOutline(items)
    expect(result.nodes).toHaveLength(3)
    expect(result.edges).toHaveLength(2)
  })

  it('choice 大纲生成带 sourceHandle 的边', () => {
    const text = '- 选择：路径\n  - A\n  - B'
    const items = parseOutline(text)
    const result = generateNodesFromOutline(items)
    expect(result.nodes).toHaveLength(3)
    expect(result.edges).toHaveLength(2)
    expect(result.edges[0].sourceHandle).toBe('source-0')
    expect(result.edges[1].sourceHandle).toBe('source-1')
  })

  it('章节下多个列表项各自独立', () => {
    const text = '# 第一章\n- 对话A\n- 对话B'
    const items = parseOutline(text)
    const result = generateNodesFromOutline(items)
    expect(result.nodes).toHaveLength(2)
    expect(result.edges).toHaveLength(0)
  })
})
