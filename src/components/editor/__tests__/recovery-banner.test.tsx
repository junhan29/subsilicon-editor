// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecoveryBanner } from '../recovery-banner'

describe('RecoveryBanner', () => {
  it('显示恢复横幅与相对时间', () => {
    render(<RecoveryBanner time={Date.now() - 5 * 60 * 1000} onRestore={vi.fn()} onDiscard={vi.fn()} />)
    expect(screen.getByText(/检测到上次未保存的编辑/)).toBeInTheDocument()
    expect(screen.getByText(/分钟前/)).toBeInTheDocument()
  })

  it('点击「恢复」触发 onRestore', async () => {
    const user = userEvent.setup()
    const onRestore = vi.fn()
    render(<RecoveryBanner time={Date.now()} onRestore={onRestore} onDiscard={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: '恢复' }))
    expect(onRestore).toHaveBeenCalledOnce()
  })

  it('点击「放弃」触发 onDiscard', async () => {
    const user = userEvent.setup()
    const onDiscard = vi.fn()
    render(<RecoveryBanner time={Date.now()} onRestore={vi.fn()} onDiscard={onDiscard} />)
    await user.click(screen.getByRole('button', { name: '放弃' }))
    expect(onDiscard).toHaveBeenCalledOnce()
  })
})
