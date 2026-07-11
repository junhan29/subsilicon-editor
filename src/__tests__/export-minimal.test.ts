/**
 * 极简文字运行时导出测试
 */
import { describe, it, expect } from 'vitest'
import type { StoryGraph } from '@editor/types/editor'

describe('Minimal HTML Export', () => {
  const mockGraph: StoryGraph = {
    title: '深夜故事',
    description: '一个安静的夜晚',
    templateId: 'beginner-tutorial' as any,
    characters: [],
    variables: [],
    nodes: [
      {
        id: 'node1',
        type: 'narration',
        position: { x: 0, y: 0 },
        data: { text: '夜深了，窗外的街灯在薄雾中晕开一圈圈昏黄的光。' },
      },
      {
        id: 'node2',
        type: 'choice',
        position: { x: 200, y: 0 },
        data: {
          options: [
            { id: 'opt1', text: '继续看书' },
            { id: 'opt2', text: '关灯睡觉' },
          ],
        },
      },
      {
        id: 'node3',
        type: 'narration',
        position: { x: 400, y: -100 },
        data: { text: '你翻开了下一页...' },
      },
      {
        id: 'node4',
        type: 'narration',
        position: { x: 400, y: 100 },
        data: { text: '你关掉了灯，房间陷入黑暗。' },
      },
    ],
    edges: [
      { id: 'edge1', source: 'node1', target: 'node2' },
      { id: 'edge2', source: 'node2', target: 'node3', label: 'opt1' },
      { id: 'edge3', source: 'node2', target: 'node4', label: 'opt2' },
    ],
    settings: { title: '深夜故事', tags: [] },
    assets: { images: [], audios: [], fonts: [] },
    scenes: [],
    audios: [],
  }

  it('should generate minimal text HTML', async () => {
    const { exportToMinimalHTML } = await import('@editor/lib/export-minimal-html')
    const html = await exportToMinimalHTML(mockGraph)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('text-flow')
    expect(html).toContain('choices-section')
    expect(html).toContain('window.STORY_DATA')
    expect(html).not.toContain('character-sprites')
    expect(html).not.toContain('scene-bg')
  })
})
