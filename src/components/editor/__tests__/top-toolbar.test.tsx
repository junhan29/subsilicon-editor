// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { matchShortcut } from '../../../lib/shortcut-manager'
import { TopToolbar } from '../top-toolbar'

const baseProps = {
  title: '测试作品',
  canUndo: false,
  canRedo: false,
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  onSave: vi.fn(),
  onPreview: vi.fn(),
  onExport: vi.fn(),
  onToggleAiPanel: vi.fn(),
  aiPanelVisible: false,
}

describe('TopToolbar', () => {
  it('专注模式按钮未传 onToggleFocusMode 时不渲染', () => {
    render(<TopToolbar {...baseProps} />)
    expect(screen.queryByTitle(/专注模式/)).not.toBeInTheDocument()
  })

  it('非专注状态下按钮 title 提示「进入」且 aria-pressed 为 false', () => {
    render(<TopToolbar {...baseProps} onToggleFocusMode={vi.fn()} focusMode={false} />)
    const btn = screen.getByTitle('专注模式：隐藏所有面板 (Ctrl+Shift+L)')
    expect(btn).toHaveAttribute('aria-pressed', 'false')
  })

  it('专注状态下按钮 title 提示「退出」且 aria-pressed 为 true', () => {
    render(<TopToolbar {...baseProps} onToggleFocusMode={vi.fn()} focusMode={true} />)
    const btn = screen.getByTitle('退出专注模式 (Ctrl+Shift+L)')
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })

  it('点击专注按钮触发回调', async () => {
    const user = userEvent.setup()
    const onToggleFocusMode = vi.fn()
    render(<TopToolbar {...baseProps} onToggleFocusMode={onToggleFocusMode} focusMode={false} />)
    await user.click(screen.getByTitle(/专注模式：隐藏所有面板/))
    expect(onToggleFocusMode).toHaveBeenCalledOnce()
  })

  it('撤销按钮在 canUndo=false 时禁用', () => {
    render(<TopToolbar {...baseProps} />)
    expect(screen.getByTitle('撤销 (Ctrl+Z)')).toBeDisabled()
  })

  it('保存按钮触发 onSave', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<TopToolbar {...baseProps} onSave={onSave} />)
    await user.click(screen.getByTitle('保存作品 (Ctrl+S)'))
    expect(onSave).toHaveBeenCalledOnce()
  })

  it('onBack 存在时渲染「项目」返回按钮并触发回调', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(<TopToolbar {...baseProps} onBack={onBack} />)
    await user.click(screen.getByText('项目'))
    expect(onBack).toHaveBeenCalledOnce()
  })

  // ── Phase 2: AI 组容器与视觉 / a11y 统一 ──
  it('传 onAiOutline 时渲染 AI 组容器：role=group 且 aria-label=AI 创作工具', () => {
    render(<TopToolbar {...baseProps} onAiOutline={vi.fn()} />)
    const group = screen.getByRole('group', { name: 'AI 创作工具' })
    expect(group).toBeInTheDocument()
    expect(group).toHaveClass(/gold-/)
  })

  it('仅传 AI 回调时组容器仍渲染 gold 系边框/背景语义色', () => {
    render(<TopToolbar {...baseProps} onAiContinue={vi.fn()} />)
    const group = screen.getByRole('group', { name: 'AI 创作工具' })
    const cls = group.className
    // 语义色至少应包含 gold，且不能是旧的 purple / violet / amber / rose
    expect(cls).toMatch(/gold/)
    expect(cls).not.toMatch(/purple|violet|amber|rose/)
  })

  it('生成大纲按钮带 aria-label 与 title，点击触发 onAiOutline', async () => {
    const user = userEvent.setup()
    const onAiOutline = vi.fn()
    render(<TopToolbar {...baseProps} onAiOutline={onAiOutline} />)
    const btn = screen.getByRole('button', { name: /生成互动故事大纲并铺节点/ })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('title')
    await user.click(btn)
    expect(onAiOutline).toHaveBeenCalledOnce()
  })

  it('续写按钮点击触发 onAiContinue，并在生成时 aria-busy=true', async () => {
    const user = userEvent.setup()
    const onAiContinue = vi.fn()
    const { rerender } = render(
      <TopToolbar {...baseProps} onAiContinue={onAiContinue} isAiBusy={false} />,
    )
    const btn = screen.getByRole('button', { name: /AI 续写后续节点/ })
    expect(btn).toHaveAttribute('aria-busy', 'false')
    await user.click(btn)
    expect(onAiContinue).toHaveBeenCalledOnce()

    rerender(<TopToolbar {...baseProps} onAiContinue={onAiContinue} isAiBusy={true} />)
    expect(screen.getByRole('button', { name: /AI 续写后续节点/ })).toHaveAttribute(
      'aria-busy',
      'true',
    )
  })

  it('润色按钮点击触发 onAiPolish；未传回调时不渲染对应按钮', async () => {
    const user = userEvent.setup()
    const onAiPolish = vi.fn()
    const { rerender } = render(
      <TopToolbar {...baseProps} onAiOutline={vi.fn()} onAiPolish={onAiPolish} />,
    )
    const btn = screen.getByRole('button', { name: /润色选中节点文案/ })
    await user.click(btn)
    expect(onAiPolish).toHaveBeenCalledOnce()

    rerender(<TopToolbar {...baseProps} onAiOutline={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /润色选中节点文案/ })).not.toBeInTheDocument()
  })

  it('AI 面板按钮 title 含 Ctrl+K 并有切换激活态样式', async () => {
    const user = userEvent.setup()
    const onToggleAiPanel = vi.fn()
    const { rerender } = render(
      <TopToolbar {...baseProps} onToggleAiPanel={onToggleAiPanel} aiPanelVisible={false} />,
    )
    const btn = screen.getByTitle(/AI 面板.*Ctrl\+K/)
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    await user.click(btn)
    expect(onToggleAiPanel).toHaveBeenCalledOnce()

    rerender(
      <TopToolbar {...baseProps} onToggleAiPanel={onToggleAiPanel} aiPanelVisible={true} />,
    )
    expect(screen.getByTitle(/AI 面板.*Ctrl\+K/)).toHaveAttribute('aria-pressed', 'true')
  })

  it('AI 快捷键绑定：matchShortcut 对 Ctrl+K / Ctrl+Shift+L 命中正确 action', () => {
    const makeEv = (init: Partial<KeyboardEventInit> & { key: string }) =>
      new KeyboardEvent('keydown', { ...init, bubbles: true }) as unknown as KeyboardEvent

    expect(matchShortcut(makeEv({ key: 'k', ctrlKey: true }), 'toggleAiPanel')).toBe(true)
    // focusMode 绑定 Ctrl+Shift+L（ADHD 适配：避开 macOS 全屏 Ctrl+Shift+F）
    expect(matchShortcut(makeEv({ key: 'L', ctrlKey: true, shiftKey: true }), 'focusMode')).toBe(true)
    // 单字母误触不命中修饰键 action
    expect(matchShortcut(makeEv({ key: 'k' }), 'toggleAiPanel')).toBe(false)
    expect(matchShortcut(makeEv({ key: 'l' }), 'focusMode')).toBe(false)
  })

  it('导出按钮存在且 title=导出，点击触发 onExport', async () => {
    const user = userEvent.setup()
    const onExport = vi.fn()
    render(<TopToolbar {...baseProps} onExport={onExport} />)
    const btn = screen.getByTitle('导出')
    await user.click(btn)
    expect(onExport).toHaveBeenCalledOnce()
  })
})
