import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function createMockStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v) },
    removeItem: (k: string) => { map.delete(k) },
    clear: () => map.clear(),
  }
}

describe('accessibility-store', () => {
  beforeEach(() => {
    const storage = createMockStorage()
    // shortcut-manager 读取 window.localStorage，store persist 读取全局 localStorage，
    // 两者指向同一实例，保证联动写入可断言
    vi.stubGlobal('window', { localStorage: storage })
    vi.stubGlobal('localStorage', storage)
    vi.resetModules()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('默认全部关闭', async () => {
    const { useAccessibilityStore } = await import('../accessibility-store')
    const s = useAccessibilityStore.getState()
    expect(s.focusMode).toBe(false)
    expect(s.lowStimulus).toBe(false)
    expect(s.compactInterface).toBe(false)
    expect(s.simpleShortcuts).toBe(false)
    expect(s.longFeedback).toBe(false)
  })

  it('四项设置开关可独立切换', async () => {
    const { useAccessibilityStore } = await import('../accessibility-store')
    const s = useAccessibilityStore.getState()
    s.setLowStimulus(true)
    s.setCompactInterface(true)
    s.setSimpleShortcuts(true)
    s.setLongFeedback(true)
    const after = useAccessibilityStore.getState()
    expect(after.lowStimulus).toBe(true)
    expect(after.compactInterface).toBe(true)
    expect(after.simpleShortcuts).toBe(true)
    expect(after.longFeedback).toBe(true)
  })

  it('专注模式：进入收起面板，退出还原布局', async () => {
    const { useAccessibilityStore } = await import('../accessibility-store')
    const { useEditorCanvasStore } = await import('../editor-canvas-store')
    // 预设展开状态
    useEditorCanvasStore.setState({
      activeLeftActivity: 'nodes',
      activeRightActivity: 'properties',
      aiPanelMode: 'floating',
    })
    // 进入专注
    useAccessibilityStore.getState().toggleFocusMode()
    expect(useAccessibilityStore.getState().focusMode).toBe(true)
    expect(useEditorCanvasStore.getState().activeLeftActivity).toBeNull()
    expect(useEditorCanvasStore.getState().activeRightActivity).toBeNull()
    expect(useEditorCanvasStore.getState().aiPanelMode).toBe('hidden')
    // 退出专注：还原
    useAccessibilityStore.getState().toggleFocusMode()
    expect(useAccessibilityStore.getState().focusMode).toBe(false)
    expect(useEditorCanvasStore.getState().activeLeftActivity).toBe('nodes')
    expect(useEditorCanvasStore.getState().activeRightActivity).toBe('properties')
    expect(useEditorCanvasStore.getState().aiPanelMode).toBe('floating')
  })

  it('开启基础快捷键：联动写入禁用单字母的预设；关闭则清除自定义绑定', async () => {
    const { useAccessibilityStore } = await import('../accessibility-store')
    // 开启 → 预设写入 storage，addDialogue 为空数组（单字母禁用）
    useAccessibilityStore.getState().setSimpleShortcuts(true)
    const raw = window.localStorage.getItem('subsilicon-shortcuts')
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw as string).addDialogue).toEqual([])
    // 关闭 → 恢复默认（清除自定义绑定）
    useAccessibilityStore.getState().setSimpleShortcuts(false)
    expect(window.localStorage.getItem('subsilicon-shortcuts')).toBeNull()
  })
})
