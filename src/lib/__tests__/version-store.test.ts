import { describe, it, expect, beforeEach } from 'vitest'
import {
  autoSaveVersion,
  getAutoSaves,
  clearAutoSaves,
  importVersionsFromFile,
  saveVersion,
  loadVersions,
  deleteVersion,
  restoreVersion,
  compareVersions,
  exportVersionsToFile,
} from '../version-store'
import { createSnapshot } from '../history-store'
import type { StoryGraphSnapshot } from '../history-store'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString() },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(globalThis, 'window', {
  value: { localStorage: localStorageMock },
  writable: true,
})

function createMockGraph(overrides: Partial<StoryGraphSnapshot> = {}): StoryGraphSnapshot {
  return {
    nodes: [{ id: 'n1', type: 'dialogue', position: { x: 100, y: 100 }, data: { text: 'Hello' } }],
    edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    characters: [{ id: 'c1', name: '主角', color: '#fff', avatar: '', gender: 'female', age: '18', occupation: '', personality: [], appearance: [], background: '', speech: { tone: '', catchphrases: [] }, skills: [], motivation: '', habits: [], fears: [], relations: [], tags: [], bio: '' }],
    scenes: [],
    audios: [],
    variables: [],
    groups: [],
    ...overrides,
  }
}

describe('autoSaveVersion', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('自动保存并返回条目', () => {
    const graph = createMockGraph()
    const entry = autoSaveVersion('work-1', graph)
    expect(entry).not.toBeNull()
    expect(entry!.name).toContain('自动存档')
    expect(entry!.graph.nodes).toHaveLength(1)
  })

  it('getAutoSaves 返回保存的条目', () => {
    autoSaveVersion('work-1', createMockGraph())
    autoSaveVersion('work-1', createMockGraph())
    const saves = getAutoSaves('work-1')
    expect(saves).toHaveLength(2)
  })

  it('不同 workId 互不干扰', () => {
    autoSaveVersion('work-1', createMockGraph())
    autoSaveVersion('work-2', createMockGraph())
    expect(getAutoSaves('work-1')).toHaveLength(1)
    expect(getAutoSaves('work-2')).toHaveLength(1)
  })

  it('clearAutoSaves 清除指定 workId 的存档', () => {
    autoSaveVersion('work-1', createMockGraph())
    clearAutoSaves('work-1')
    expect(getAutoSaves('work-1')).toHaveLength(0)
  })

  it('超过上限时删除最旧的', () => {
    for (let i = 0; i < 12; i++) {
      autoSaveVersion('work-1', createMockGraph())
    }
    expect(getAutoSaves('work-1')).toHaveLength(10)
  })
})

describe('version import/export', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('importVersionsFromFile 导入版本', () => {
    const v1 = saveVersion('v1', '', createMockGraph())
    const exportData = JSON.stringify(loadVersions())

    localStorageMock.clear()

    const result = importVersionsFromFile(exportData)
    expect(result.imported).toBe(1)
    expect(result.skipped).toBe(0)
    expect(loadVersions()).toHaveLength(1)
  })

  it('重复导入跳过已存在的版本', () => {
    const v1 = saveVersion('v1', '', createMockGraph())
    const exportData = JSON.stringify(loadVersions())

    // 再次导入相同数据
    const result = importVersionsFromFile(exportData)
    expect(result.imported).toBe(0)
    expect(result.skipped).toBe(1)
    expect(loadVersions()).toHaveLength(1)
  })

  it('无效 JSON 返回 0', () => {
    const result = importVersionsFromFile('invalid json')
    expect(result.imported).toBe(0)
    expect(result.skipped).toBe(0)
  })
})

describe('compareVersions', () => {
  it('检测新增节点', () => {
    const v1 = saveVersion('before', '', createMockGraph({ nodes: [] }))
    const v2 = saveVersion('after', '', createMockGraph({
      nodes: [{ id: 'n1', type: 'dialogue', position: { x: 0, y: 0 }, data: { text: 'hi' } }],
    }))
    const diff = compareVersions(v1, v2)
    expect(diff.addedNodes).toHaveLength(1)
    expect(diff.addedNodes[0].id).toBe('n1')
  })

  it('检测删除节点', () => {
    const v1 = saveVersion('before', '', createMockGraph({
      nodes: [{ id: 'n1', type: 'dialogue', position: { x: 0, y: 0 }, data: { text: 'hi' } }],
    }))
    const v2 = saveVersion('after', '', createMockGraph({ nodes: [] }))
    const diff = compareVersions(v1, v2)
    expect(diff.removedNodes).toHaveLength(1)
  })

  it('检测修改节点', () => {
    const v1 = saveVersion('before', '', createMockGraph({
      nodes: [{ id: 'n1', type: 'dialogue', position: { x: 0, y: 0 }, data: { text: 'hello' } }],
    }))
    const v2 = saveVersion('after', '', createMockGraph({
      nodes: [{ id: 'n1', type: 'dialogue', position: { x: 0, y: 0 }, data: { text: 'world' } }],
    }))
    const diff = compareVersions(v1, v2)
    expect(diff.modifiedNodes).toHaveLength(1)
    expect(diff.modifiedNodes[0].changes.some((c) => c.field === 'data.text')).toBe(true)
  })
})
