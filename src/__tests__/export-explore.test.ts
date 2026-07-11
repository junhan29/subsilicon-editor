/**
 * 探索解谜运行时导出测试
 */
import { describe, it, expect } from 'vitest'
import type { StoryGraph } from '@editor/types/editor'

describe('Explore HTML Export', () => {
  const mockGraph: StoryGraph = {
    title: '密室逃脱',
    description: '一间神秘的房间',
    templateId: 'beginner-tutorial' as any,
    characters: [],
    variables: [],
    nodes: [
      {
        id: 'node1',
        type: 'dialogue',
        position: { x: 0, y: 0 },
        data: {
          text: '你发现自己在一个陌生的房间里。',
          hotspots: [
            { id: 'h1', x: 30, y: 40, width: 40, height: 40, label: '书桌', action: 'dialogue', targetId: 'node2' },
            { id: 'h2', x: 70, y: 60, width: 40, height: 40, label: '钥匙', action: 'item', targetId: 'key1' },
          ],
        },
      },
      {
        id: 'node2',
        type: 'narration',
        position: { x: 200, y: 0 },
        data: { text: '书桌上有一本日记。' },
      },
    ],
    edges: [
      { id: 'edge1', source: 'node1', target: 'node2' },
    ],
    settings: { title: '密室逃脱', tags: [] },
    assets: { images: [], audios: [], fonts: [] },
    scenes: [],
    audios: [],
  }

  it('should generate explore HTML with hotspot support', async () => {
    const { exportToExploreHTML } = await import('@editor/lib/export-explore-html')
    const html = await exportToExploreHTML(mockGraph)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('explore-container')
    expect(html).toContain('hotspot')
    expect(html).toContain('inventory-bar')
    expect(html).toContain('window.STORY_DATA')
  })
})
