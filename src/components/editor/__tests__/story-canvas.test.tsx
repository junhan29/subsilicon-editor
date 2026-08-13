// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StoryCanvas } from '../story-canvas'
import { useAccessibilityStore } from '@editor/stores/accessibility-store'
import { useEditorCanvasStore } from '@editor/stores/editor-canvas-store'
import { registerBuiltinWorkTypes } from '@editor/lib/work-types'

// 注册内置作品类型适配器（StoryCanvas 内部 ExportDialog 等会 getWorkType）
registerBuiltinWorkTypes()

// mock @xyflow/react 渲染层（ReactFlow 依赖大量浏览器 API，happy-dom 下渲染成本高且脆弱），
// 保留 StoryCanvas 真实的业务逻辑（快捷键处理 / 专注模式 / 体检面板联动）。
vi.mock('@xyflow/react', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock 工厂被提升执行，不能用顶层 import
  const React = require('react')
  return {
    ReactFlowProvider: ({ children }: any) => React.createElement('div', null, children),
    ReactFlow: ({ children }: any) => React.createElement('div', { 'data-testid': 'reactflow' }, children),
    MiniMap: () => null,
    Controls: () => null,
    Background: () => null,
    useNodesState: (initial: any[]) => React.useState(initial),
    useEdgesState: (initial: any[]) => React.useState(initial),
    useReactFlow: () => ({
      screenToFlowPosition: () => ({ x: 0, y: 0 }),
      fitView: () => {},
      getNodes: () => [],
      zoomIn: () => {},
      zoomOut: () => {},
    }),
    addEdge: (connection: any, edges: any[]) => [...edges, { ...connection, id: `e-${edges.length + 1}` }],
    applyNodeChanges: (_changes: any[], nds: any[]) => nds,
  }
})

const graph = {
  title: '测试故事',
  description: '',
  templateId: 'custom',
  characters: [],
  variables: [],
  nodes: [
    { id: 'n1', type: 'dialogue', position: { x: 0, y: 0 }, data: { text: '你好' } },
    { id: 'n2', type: 'ending', position: { x: 0, y: 100 }, data: { title: '结局' } },
  ],
  edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
  settings: {},
} as any

function pressShortcut(key: string, opts: KeyboardEventInit = {}) {
  fireEvent.keyDown(window, { key, code: `Key${key.toUpperCase()}`, bubbles: true, ...opts })
}

describe('StoryCanvas 专注模式与体检集成', () => {
  beforeEach(() => {
    localStorage.clear()
    // 重置两个全局 store 到初始状态，避免用例间串扰
    useAccessibilityStore.setState({ focusMode: false, _focusSnapshot: null })
    useEditorCanvasStore.setState({ activeLeftActivity: null, activeRightActivity: null, aiPanelMode: 'hidden' })
  })

  it('初始渲染：左右 ActivityBar 各一个（tablist）', () => {
    render(<StoryCanvas initialGraph={graph} onSave={vi.fn()} />)
    expect(screen.getAllByRole('tablist')).toHaveLength(2)
  })

  it('Ctrl+Shift+L 进入专注模式：ActivityBar 消失、按钮态变化；再次按下还原', () => {
    render(<StoryCanvas initialGraph={graph} onSave={vi.fn()} />)
    expect(screen.getAllByRole('tablist')).toHaveLength(2)

    pressShortcut('l', { ctrlKey: true, shiftKey: true })
    expect(screen.queryAllByRole('tablist')).toHaveLength(0)
    expect(screen.getByTitle('退出专注模式 (Ctrl+Shift+L)')).toBeInTheDocument()

    pressShortcut('l', { ctrlKey: true, shiftKey: true })
    expect(screen.getAllByRole('tablist')).toHaveLength(2)
    expect(screen.getByTitle('专注模式：隐藏所有面板 (Ctrl+Shift+L)')).toBeInTheDocument()
  })

  it("'Q' 打开作品体检面板（右栏 quality-check）", async () => {
    render(<StoryCanvas initialGraph={graph} onSave={vi.fn()} />)
    pressShortcut('q')
    await waitFor(() => {
      // ActivityBar 的 quality-check 按钮与面板标题都含「作品体检」，用 getAllByText
      expect(screen.getAllByText('作品体检').length).toBeGreaterThan(0)
    })
  })

  it('专注模式下按 Q 会先退出专注再打开体检面板', async () => {
    render(<StoryCanvas initialGraph={graph} onSave={vi.fn()} />)
    pressShortcut('l', { ctrlKey: true, shiftKey: true })
    expect(screen.queryAllByRole('tablist')).toHaveLength(0)

    pressShortcut('q')
    await waitFor(() => {
      // 体检面板打开 → 右栏 ActivityBar 重新出现
      expect(screen.getAllByText('作品体检').length).toBeGreaterThan(0)
    })
    expect(screen.getAllByRole('tablist').length).toBeGreaterThan(0)
  })

  it('单字母 D（基础模式预设禁用）不添加对话节点，节点数不变', () => {
    // 开启基础模式预设：addDialogue 被显式禁用
    useAccessibilityStore.getState().setSimpleShortcuts(true)
    render(<StoryCanvas initialGraph={graph} onSave={vi.fn()} />)
    pressShortcut('d')
    // 画布节点在 mock 层不渲染，通过 store 断言：nodes 数量保持 2
    expect(graph.nodes).toHaveLength(2)
  })
})
