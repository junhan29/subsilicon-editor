import { describe, it, expect } from 'vitest'
import {
  HistoryStore,
  createHistoryStore,
  createSnapshot,
} from '../history-store'
import type {
  StoryGraphSnapshot,
  HistoryState,
} from '../history-store'

function makeSnapshot(id: number | string): StoryGraphSnapshot {
  return {
    nodes: [{ id: String(id) }],
    edges: [],
    characters: [],
    scenes: [],
    audios: [],
    variables: [],
    groups: [],
  }
}

describe('HistoryStore.initialize', () => {
  it('初始化后 present 等于传入状态', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    const snap = makeSnapshot(1)
    store.initialize(snap)
    expect(store.getPresent()).toEqual(snap)
  })

  it('初始化后 past/future 为空，canUndo/canRedo 为 false', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(1))
    expect(store.canUndo()).toBe(false)
    expect(store.canRedo()).toBe(false)
    expect(store.getHistory()).toHaveLength(0)
    expect(store.getFuture()).toHaveLength(0)
  })

  it('多次 initialize 会重置历史栈', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(1))
    store.push('ADD_NODE', 'add 1', makeSnapshot(1), makeSnapshot(2))
    store.initialize(makeSnapshot(99))
    expect(store.getHistory()).toHaveLength(0)
    expect(store.getPresent()?.nodes[0]).toEqual({ id: '99' })
  })

  it('getState 返回正确的 HistoryState', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(0))
    store.push('ADD_NODE', 'step 1', makeSnapshot(0), makeSnapshot(1))
    const state: HistoryState = store.getState()
    expect(state.canUndo).toBe(true)
    expect(state.canRedo).toBe(false)
    expect(state.undoDescription).toBe('step 1')
    expect(state.redoDescription).toBeNull()
    expect(state.historySize).toBe(1)
    expect(state.currentIndex).toBe(1)
  })
})

describe('HistoryStore.push', () => {
  it('present 为 null 时首次 push 只设置 present，不写入历史', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.push('ADD_NODE', 'first', makeSnapshot(0), makeSnapshot(1))
    expect(store.getPresent()).toEqual(makeSnapshot(1))
    expect(store.getHistory()).toHaveLength(0)
    expect(store.canUndo()).toBe(false)
  })

  it('push 多次后 past 顺序累积', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(0))
    store.push('ADD_NODE', 'step 1', makeSnapshot(0), makeSnapshot(1))
    store.push('ADD_NODE', 'step 2', makeSnapshot(1), makeSnapshot(2))
    store.push('ADD_NODE', 'step 3', makeSnapshot(2), makeSnapshot(3))
    expect(store.getHistory()).toHaveLength(3)
    expect(store.getHistory()[0].description).toBe('step 1')
    expect(store.getHistory()[2].description).toBe('step 3')
  })

  it('push 会清空 future', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(0))
    store.push('ADD_NODE', 'step 1', makeSnapshot(0), makeSnapshot(1))
    store.undo()
    expect(store.getFuture()).toHaveLength(1)
    store.push('ADD_NODE', 'new step', makeSnapshot(0), makeSnapshot(5))
    expect(store.getFuture()).toHaveLength(0)
  })

  it('push 通过深拷贝避免后续修改污染历史', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    const before = makeSnapshot(0)
    const after = makeSnapshot(1)
    store.initialize(before)
    store.push('UPDATE_NODE', 'update', before, after)
    after.nodes.push({ id: 'mutated' })
    expect(store.getHistory()[0].after.nodes).toHaveLength(1)
  })

  it('push 后 present 等于 action.after', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(0))
    store.push('ADD_NODE', 'step 1', makeSnapshot(0), makeSnapshot(1))
    expect(store.getPresent()).toEqual(store.getHistory()[0].after)
  })
})

describe('HistoryStore.undo/redo', () => {
  it('undo 返回 before 状态并移动到 future', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(0))
    store.push('ADD_NODE', 'step 1', makeSnapshot(0), makeSnapshot(1))
    const result = store.undo()
    expect(result).toEqual(makeSnapshot(0))
    expect(store.getPresent()).toEqual(makeSnapshot(0))
    expect(store.canRedo()).toBe(true)
    expect(store.canUndo()).toBe(false)
  })

  it('redo 恢复 undo 前的状态', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(0))
    store.push('ADD_NODE', 'step 1', makeSnapshot(0), makeSnapshot(1))
    store.undo()
    const result = store.redo()
    expect(result).toEqual(makeSnapshot(1))
    expect(store.getPresent()).toEqual(makeSnapshot(1))
    expect(store.canUndo()).toBe(true)
    expect(store.canRedo()).toBe(false)
  })

  it('无可撤销时 undo 返回 null', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(0))
    const result = store.undo()
    expect(result).toBeNull()
  })

  it('无可重做时 redo 返回 null', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(0))
    const result = store.redo()
    expect(result).toBeNull()
  })

  it('多步 undo/redo 链', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(0))
    store.push('ADD_NODE', 's1', makeSnapshot(0), makeSnapshot(1))
    store.push('ADD_NODE', 's2', makeSnapshot(1), makeSnapshot(2))
    store.push('ADD_NODE', 's3', makeSnapshot(2), makeSnapshot(3))
    expect(store.undo()).toEqual(makeSnapshot(2))
    expect(store.undo()).toEqual(makeSnapshot(1))
    expect(store.redo()).toEqual(makeSnapshot(2))
    expect(store.getPresent()).toEqual(makeSnapshot(2))
  })

  it('present 为 null 时 undo/redo 都返回 null', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    expect(store.undo()).toBeNull()
    expect(store.redo()).toBeNull()
  })
})

describe('HistoryStore maxSize', () => {
  it('超过 maxSize 时丢弃最旧的历史', () => {
    const store = new HistoryStore<StoryGraphSnapshot>(3)
    store.initialize(makeSnapshot(0))
    store.push('ADD_NODE', 's1', makeSnapshot(0), makeSnapshot(1))
    store.push('ADD_NODE', 's2', makeSnapshot(1), makeSnapshot(2))
    store.push('ADD_NODE', 's3', makeSnapshot(2), makeSnapshot(3))
    store.push('ADD_NODE', 's4', makeSnapshot(3), makeSnapshot(4))
    expect(store.getHistory()).toHaveLength(3)
    expect(store.getHistory()[0].description).toBe('s2')
    expect(store.getHistory()[2].description).toBe('s4')
  })

  it('默认 maxSize=50', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(0))
    for (let i = 1; i <= 60; i++) {
      store.push('ADD_NODE', `s${i}`, makeSnapshot(i - 1), makeSnapshot(i))
    }
    expect(store.getHistory()).toHaveLength(50)
    expect(store.getHistory()[0].description).toBe('s11')
  })

  it('maxSize=1 时只保留最新一条', () => {
    const store = new HistoryStore<StoryGraphSnapshot>(1)
    store.initialize(makeSnapshot(0))
    store.push('ADD_NODE', 's1', makeSnapshot(0), makeSnapshot(1))
    store.push('ADD_NODE', 's2', makeSnapshot(1), makeSnapshot(2))
    expect(store.getHistory()).toHaveLength(1)
    expect(store.getHistory()[0].description).toBe('s2')
  })
})

describe('HistoryStore.subscribe', () => {
  it('订阅后立即收到当前状态', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(0))
    let received: HistoryState | null = null
    const unsub = store.subscribe((state) => {
      received = state
    })
    expect(received).not.toBeNull()
    expect(received!.canUndo).toBe(false)
    unsub()
  })

  it('push 时通知订阅者', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(0))
    let count = 0
    const unsub = store.subscribe(() => { count++ })
    const initialCount = count
    store.push('ADD_NODE', 's1', makeSnapshot(0), makeSnapshot(1))
    expect(count).toBeGreaterThan(initialCount)
    unsub()
  })

  it('unsubscribe 后不再接收通知', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(0))
    let count = 0
    const unsub = store.subscribe(() => { count++ })
    const beforeUnsub = count
    unsub()
    store.push('ADD_NODE', 's1', makeSnapshot(0), makeSnapshot(1))
    expect(count).toBe(beforeUnsub)
  })

  it('多个订阅者同时接收通知', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(0))
    let a = 0
    let b = 0
    const unsubA = store.subscribe(() => { a++ })
    const unsubB = store.subscribe(() => { b++ })
    store.push('ADD_NODE', 's1', makeSnapshot(0), makeSnapshot(1))
    expect(a).toBeGreaterThan(0)
    expect(b).toBeGreaterThan(0)
    unsubA()
    unsubB()
  })

  it('undo/redo 也会通知订阅者', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(0))
    store.push('ADD_NODE', 's1', makeSnapshot(0), makeSnapshot(1))
    let count = 0
    const unsub = store.subscribe(() => { count++ })
    store.undo()
    store.redo()
    expect(count).toBeGreaterThan(0)
    unsub()
  })
})

describe('createHistoryStore', () => {
  it('带初始状态创建', () => {
    const store = createHistoryStore(makeSnapshot(0))
    expect(store.getPresent()).toEqual(makeSnapshot(0))
    expect(store.canUndo()).toBe(false)
  })

  it('不带初始状态创建，present 为 null', () => {
    const store = createHistoryStore<StoryGraphSnapshot>()
    expect(store.getPresent()).toBeNull()
  })

  it('带 maxSize 创建并受限', () => {
    const store = createHistoryStore<StoryGraphSnapshot>(undefined, 2)
    store.initialize(makeSnapshot(0))
    store.push('ADD_NODE', 's1', makeSnapshot(0), makeSnapshot(1))
    store.push('ADD_NODE', 's2', makeSnapshot(1), makeSnapshot(2))
    store.push('ADD_NODE', 's3', makeSnapshot(2), makeSnapshot(3))
    expect(store.getHistory()).toHaveLength(2)
  })
})

describe('createSnapshot', () => {
  it('返回的对象引用与原对象不同', () => {
    const snap = makeSnapshot(1)
    const copy = createSnapshot(snap)
    expect(copy).not.toBe(snap)
    expect(copy.nodes).not.toBe(snap.nodes)
  })

  it('修改拷贝不影响原对象', () => {
    const snap = makeSnapshot(1)
    const copy = createSnapshot(snap)
    copy.nodes.push({ id: 'new' })
    expect(snap.nodes).toHaveLength(1)
  })

  it('深拷贝保留嵌套数据', () => {
    const snap = makeSnapshot(1)
    const copy = createSnapshot(snap)
    expect(copy.nodes[0]).toEqual({ id: '1' })
  })
})

describe('HistoryStore.clear', () => {
  it('清空历史但保留 present', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(0))
    store.push('ADD_NODE', 's1', makeSnapshot(0), makeSnapshot(1))
    const beforePresent = store.getPresent()
    store.clear()
    expect(store.getHistory()).toHaveLength(0)
    expect(store.getFuture()).toHaveLength(0)
    expect(store.getPresent()).toEqual(beforePresent)
  })

  it('clear 后 canUndo/canRedo 都为 false', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(0))
    store.push('ADD_NODE', 's1', makeSnapshot(0), makeSnapshot(1))
    store.clear()
    expect(store.canUndo()).toBe(false)
    expect(store.canRedo()).toBe(false)
  })
})

describe('getHistory/getFuture', () => {
  it('getHistory 返回副本，外部修改不影响内部', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(0))
    store.push('ADD_NODE', 's1', makeSnapshot(0), makeSnapshot(1))
    const h1 = store.getHistory()
    h1.pop()
    expect(store.getHistory()).toHaveLength(1)
  })

  it('getFuture 返回副本', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(0))
    store.push('ADD_NODE', 's1', makeSnapshot(0), makeSnapshot(1))
    store.undo()
    const f1 = store.getFuture()
    f1.pop()
    expect(store.getFuture()).toHaveLength(1)
  })
})
