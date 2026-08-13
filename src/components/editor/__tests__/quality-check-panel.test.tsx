// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QualityCheckPanel } from '../quality-check-panel'
import type { StoryEdge, StoryNode } from '@editor/types/editor'

/** 完整作品：有文本的对话节点 → 结局节点，全部有连线，无任何问题 */
const healthyNodes: StoryNode[] = [
  { id: 'n1', type: 'dialogue', position: { x: 0, y: 0 }, data: { text: '你好' } },
  { id: 'n2', type: 'ending', position: { x: 0, y: 100 }, data: { title: '结局' } },
]
const healthyEdges: StoryEdge[] = [{ id: 'e1', source: 'n1', target: 'n2' }]

/** 孤立节点：有文本的对话节点但没有任何连线 */
const orphanNode: StoryNode[] = [
  { id: 'n1', type: 'dialogue', position: { x: 0, y: 0 }, data: { text: '你好' } },
]

describe('QualityCheckPanel', () => {
  it('作品结构完整时显示「一切正常」空态', () => {
    render(
      <QualityCheckPanel
        nodes={healthyNodes}
        edges={healthyEdges}
        monetization={null}
        onLocateNode={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('一切正常，作品结构完整，可以放心导出。')).toBeInTheDocument()
    expect(screen.getByText('没有发现问题')).toBeInTheDocument()
  })

  it('存在孤立节点时展示问题，点击可定位到该节点', async () => {
    const user = userEvent.setup()
    const onLocateNode = vi.fn()
    render(
      <QualityCheckPanel
        nodes={orphanNode}
        edges={[]}
        monetization={null}
        onLocateNode={onLocateNode}
        onClose={vi.fn()}
      />
    )

    const orphanIssue = await screen.findByRole('button', { name: /孤立节点/ })
    expect(orphanIssue).toBeInTheDocument()
    await user.click(orphanIssue)
    expect(onLocateNode).toHaveBeenCalledWith('n1')
  })

  it('错误与警告分别统计到摘要中', () => {
    // 孤立节点(warning) + 无出边(error) + 无结局(error) 混合场景
    render(
      <QualityCheckPanel
        nodes={orphanNode}
        edges={[]}
        monetization={null}
        onLocateNode={vi.fn()}
        onClose={vi.fn()}
      />
    )
    // 摘要文案：发现 {errorCount} 个需要处理的问题，{warningCount} 个可优化项
    expect(screen.getByText(/个需要处理的问题/)).toBeInTheDocument()
    expect(screen.getByText(/个可优化项/)).toBeInTheDocument()
  })

  it('点击关闭按钮触发 onClose', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <QualityCheckPanel
        nodes={healthyNodes}
        edges={healthyEdges}
        monetization={null}
        onLocateNode={vi.fn()}
        onClose={onClose}
      />
    )
    await user.click(screen.getByTitle('关闭'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
