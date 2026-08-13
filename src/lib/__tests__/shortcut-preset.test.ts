import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SIMPLE_SHORTCUT_PRESET,
  applyDefaultPreset,
  applySimplePreset,
  getActiveKeys,
  matchShortcut,
} from '../shortcut-manager'

function createMockStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v) },
    removeItem: (k: string) => { map.delete(k) },
    clear: () => map.clear(),
  }
}

// shortcut-manager 读取 window.localStorage，node 环境下需 stub window
describe('shortcut-preset', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: createMockStorage() })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('基础模式预设不包含任何单字母加节点键', () => {
    expect(SIMPLE_SHORTCUT_PRESET.addDialogue).toEqual([])
    expect(SIMPLE_SHORTCUT_PRESET.addChoice).toEqual([])
    expect(SIMPLE_SHORTCUT_PRESET.addEnding).toEqual([])
  })

  it('applySimplePreset 后 addDialogue 为空数组（禁用）且 save 保留', () => {
    applySimplePreset()
    expect(getActiveKeys('addDialogue')).toEqual([])
    expect(getActiveKeys('save')).toEqual(['Ctrl', 'S'])
    // focusMode 用 macOS 安全键位 Ctrl+Shift+L（Ctrl+Shift+F 会被系统全屏拦截）
    expect(getActiveKeys('focusMode')).toEqual(['Ctrl', 'Shift', 'L'])
  })

  it('空数组绑定时 matchShortcut 恒 false（防误触生效）', () => {
    applySimplePreset()
    const ev = {
      key: 'D',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
    } as KeyboardEvent
    expect(matchShortcut(ev, 'addDialogue')).toBe(false)
    // 未在预设中的单字母（如 addNarration）同样禁用
    const nEv = {
      key: 'N',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
    } as KeyboardEvent
    expect(matchShortcut(nEv, 'addNarration')).toBe(false)
  })

  it('applyDefaultPreset 恢复默认绑定', () => {
    applySimplePreset()
    applyDefaultPreset()
    expect(getActiveKeys('addDialogue')).toEqual(['D'])
    expect(getActiveKeys('save')).toEqual(['Ctrl', 'S'])
  })
})
