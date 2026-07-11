/**
 * EPUB 导出测试
 */
import { describe, it, expect } from 'vitest'
import type { StoryGraph } from '@editor/types/editor'

// 动态导入以处理 JSZip 依赖
describe('EPUB Export', () => {
  const mockGraph: StoryGraph = {
    title: '测试故事',
    description: '一个测试故事',
    templateId: 'beginner-tutorial' as any,
    characters: [
      { id: 'char1', name: '小明', avatar: '', bio: '主角', color: '#ff0000' },
    ],
    variables: [],
    nodes: [
      {
        id: 'node1',
        type: 'dialogue',
        position: { x: 0, y: 0 },
        data: { characterId: 'char1', text: '你好，世界！' },
      },
      {
        id: 'node2',
        type: 'ending',
        position: { x: 200, y: 0 },
        data: { title: '结局', text: '故事结束' },
      },
    ],
    edges: [
      { id: 'edge1', source: 'node1', target: 'node2' },
    ],
    settings: { title: '测试故事', tags: [] },
    assets: { images: [], audios: [], fonts: [] },
    scenes: [],
    audios: [],
  }

  it('should generate valid EPUB blob', async () => {
    const { exportToEPUB } = await import('@editor/lib/export-epub')
    const blob = await exportToEPUB(mockGraph)
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/epub+zip')
    expect(blob.size).toBeGreaterThan(0)
  })

  it('should handle empty graph', async () => {
    const emptyGraph: StoryGraph = {
      ...mockGraph,
      nodes: [],
      edges: [],
    }
    const { exportToEPUB } = await import('@editor/lib/export-epub')
    const blob = await exportToEPUB(emptyGraph)
    expect(blob).toBeInstanceOf(Blob)
  })
})
