import { describe, expect, it } from 'vitest'
import { runQualityCheck } from '../quality-check'
import type { StoryEdge, StoryNode } from '@editor/types/editor'
import type { MonetizationConfig } from '@editor/lib/work-monetization'

function node(id: string, type: string, data: Record<string, unknown> = {}): StoryNode {
  return { id, type: type as StoryNode['type'], position: { x: 0, y: 0 }, data }
}

function edge(id: string, source: string, target: string): StoryEdge {
  return { id, source, target }
}

const textNode = (id: string, text: string, type = 'dialogue') => node(id, type, { text })

describe('runQualityCheck', () => {
  it('空作品 → 无结局错误', () => {
    const issues = runQualityCheck({ nodes: [], edges: [], monetization: null })
    expect(issues.some((i) => i.id === 'no-ending' && i.severity === 'error')).toBe(true)
  })

  it('孤立节点 → warning', () => {
    const issues = runQualityCheck({
      nodes: [textNode('n1', '你好')],
      edges: [],
      monetization: null,
    })
    expect(issues.some((i) => i.id === 'orphan-n1' && i.severity === 'warning')).toBe(true)
  })

  it('对话节点无出边 → error（读者卡死）', () => {
    const issues = runQualityCheck({
      nodes: [textNode('n1', '你好'), node('n2', 'ending', { title: '结局' })],
      edges: [],
      monetization: null,
    })
    expect(issues.some((i) => i.id === 'no-out-n1' && i.severity === 'error')).toBe(true)
  })

  it('结局节点无入边 → warning（无法到达）', () => {
    const issues = runQualityCheck({
      nodes: [textNode('n1', '你好'), node('n2', 'ending', { title: '结局' })],
      edges: [],
      monetization: null,
    })
    expect(issues.some((i) => i.id === 'ending-orphan-n2' && i.severity === 'warning')).toBe(true)
  })

  it('条件节点出边 < 2 → warning', () => {
    const issues = runQualityCheck({
      nodes: [node('n1', 'condition', { expression: 'a > 1' }), textNode('n2', '下一步')],
      edges: [edge('e1', 'n1', 'n2')],
      monetization: null,
    })
    expect(issues.some((i) => i.id === 'branch-n1' && i.severity === 'warning')).toBe(true)
  })

  it('启用付费但未标记付费节点 → warning', () => {
    const monetization = { enabled: true, paidNodes: [], granularity: 'whole', paymentMethod: 'offline', price: 9.9, workId: 'w1' } as unknown as MonetizationConfig
    const issues = runQualityCheck({ nodes: [], edges: [], monetization })
    expect(issues.some((i) => i.id === 'paid-not-configured')).toBe(true)
  })

  it('对话内容为空 → warning', () => {
    const issues = runQualityCheck({
      nodes: [textNode('n1', '   ')],
      edges: [],
      monetization: null,
    })
    expect(issues.some((i) => i.id === 'empty-n1' && i.severity === 'warning')).toBe(true)
  })

  it('完整作品 → 无问题', () => {
    const issues = runQualityCheck({
      nodes: [textNode('n1', '开场'), node('n2', 'ending', { title: '结局' })],
      edges: [edge('e1', 'n1', 'n2')],
      monetization: null,
    })
    expect(issues).toEqual([])
  })

  it('付费节点已配置 → 不报 paid-not-configured', () => {
    const monetization = { enabled: true, paidNodes: ['n3'], granularity: 'whole', paymentMethod: 'offline', price: 9.9, workId: 'w1' } as unknown as MonetizationConfig
    const issues = runQualityCheck({
      nodes: [textNode('n1', '开场'), node('n2', 'ending', { title: '结局' }), textNode('n3', '付费章')],
      edges: [edge('e1', 'n1', 'n3'), edge('e2', 'n3', 'n2')],
      monetization,
    })
    expect(issues.some((i) => i.id === 'paid-not-configured')).toBe(false)
  })
})
