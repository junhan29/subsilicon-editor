// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
})
