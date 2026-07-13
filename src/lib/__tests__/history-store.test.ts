/** history-store 单元测试 */
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

describe('HistoryStore.initialize 初始化', () => {
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
    expect(store.getHistory().length).toEqual(0)
    expect(store.getFuture().length).toEqual(0)
  })

  it('多次 initialize 会重置历史栈', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(1))
    store.push('ADD_NODE', 'add 1', makeSnapshot(1), makeSnapshot(2))
    store.initialize(makeSnapshot(99))
    expect(store.getHistory().length).toEqual(0)
    expect(store.getPresent()?.nodes[0]).toEqual({ id: '99' })
  })

  it('getState 返回正确的 HistoryState', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(0))
    store.push('ADD_NODE', 'step 1', makeSnapshot(0), makeSnapshot(1))
    const state: HistoryState = store.getState()
    expect(state.canUndo).toBe(true)
    expect(state.canRedo).toBe(false)
    expect(state.undoDescription).toEqual('step 1')
    expect(state.redoDescription).toEqual(null)
    expect(state.historySize).toEqual(1)
    expect(state.currentIndex).toEqual(1)
  })
})

describe('HistoryStore.push 推送历史', () => {
  it('present 为 null 时首次 push 只设置 present，不写入历史', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.push('ADD_NODE', 'first', makeSnapshot(0), makeSnapshot(1))
    expect(store.getPresent()).toEqual(makeSnapshot(1))
    expect(store.getHistory().length).toEqual(0)
    expect(store.canUndo()).toBe(false)
  })

  it('push 多次后 past 顺序累积', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(0))
    store.push('ADD_NODE', 'step 1', makeSnapshot(0), makeSnapshot(1))
    store.push('ADD_NODE', 'step 2', makeSnapshot(1), makeSnapshot(2))
    store.push('ADD_NODE', 'step 3', makeSnapshot(2), makeSnapshot(3))
    expect(store.getHistory().length).toEqual(3)
    expect(store.getHistory()[0].description).toEqual('step 1')
    expect(store.getHistory()[2].description).toEqual('step 3')
  })

  it('push 会清空 future', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(0))
    store.push('ADD_NODE', 'step 1', makeSnapshot(0), makeSnapshot(1))
    store.undo()
    expect(store.getFuture().length === 1).toBe(true)
    store.push('ADD_NODE', 'new step', makeSnapshot(0), makeSnapshot(5))
    expect(store.getFuture().length).toEqual(0)
  })

  it('push 通过深拷贝避免后续修改污染历史', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    const before = makeSnapshot(0)
    const after = makeSnapshot(1)
    store.initialize(before)
    store.push('UPDATE_NODE', 'update', before, after)
    after.nodes.push({ id: 'mutated' })
    const history = store.getHistory()
    expect(history[0].after.nodes.length).toEqual(1)
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
    expect(result === null).toBe(true)
  })

  it('无可重做时 redo 返回 null', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(0))
    const result = store.redo()
    expect(result === null).toBe(true)
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
    expect(store.undo() === null).toBe(true)
    expect(store.redo() === null).toBe(true)
  })
})

describe('HistoryStore maxSize 上限', () => {
  it('超过 maxSize 时丢弃最旧的历史', () => {
    const store = new HistoryStore<StoryGraphSnapshot>(3)
    store.initialize(makeSnapshot(0))
    store.push('ADD_NODE', 's1', makeSnapshot(0), makeSnapshot(1))
    store.push('ADD_NODE', 's2', makeSnapshot(1), makeSnapshot(2))
    store.push('ADD_NODE', 's3', makeSnapshot(2), makeSnapshot(3))
    store.push('ADD_NODE', 's4', makeSnapshot(3), makeSnapshot(4))
    expect(store.getHistory().length).toEqual(3)
    expect(store.getHistory()[0].description).toEqual('s2')
    expect(store.getHistory()[2].description).toEqual('s4')
  })

  it('默认 maxSize=50', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(0))
    for (let i = 1; i <= 60; i++) {
      store.push(
        'ADD_NODE',
        `s${i}`,
        makeSnapshot(i - 1),
        makeSnapshot(i)
      )
    }
    expect(store.getHistory().length).toEqual(50)
    expect(store.getHistory()[0].description).toEqual('s11')
  })

  it('maxSize=1 时只保留最新一条', () => {
    const store = new HistoryStore<StoryGraphSnapshot>(1)
    store.initialize(makeSnapshot(0))
    store.push('ADD_NODE', 's1', makeSnapshot(0), makeSnapshot(1))
    store.push('ADD_NODE', 's2', makeSnapshot(1), makeSnapshot(2))
    expect(store.getHistory().length).toEqual(1)
    expect(store.getHistory()[0].description).toEqual('s2')
  })
})

describe('HistoryStore.subscribe 订阅', () => {
  it('订阅后立即收到当前状态', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(0))
    let received: HistoryState | null = null
    const unsub = store.subscribe((state) => {
      received = state
    })
    expect(received !== null).toBe(true)
    expect(received!.canUndo === false).toBe(true)
    unsub()
  })

  it('push 时通知订阅者', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(0))
    let count = 0
    const unsub = store.subscribe(() => {
      count++
    })
    const initialCount = count
    store.push('ADD_NODE', 's1', makeSnapshot(0), makeSnapshot(1))
    expect(count > initialCount).toBe(true)
    unsub()
  })

  it('unsubscribe 后不再接收通知', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(0))
    let count = 0
    const unsub = store.subscribe(() => {
      count++
    })
    const beforeUnsub = count
    unsub()
    store.push('ADD_NODE', 's1', makeSnapshot(0), makeSnapshot(1))
    expect(count).toEqual(beforeUnsub)
  })

  it('多个订阅者同时接收通知', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(0))
    let a = 0
    let b = 0
    const unsubA = store.subscribe(() => {
      a++
    })
    const unsubB = store.subscribe(() => {
      b++
    })
    const aBefore = a
    const bBefore = b
    store.push('ADD_NODE', 's1', makeSnapshot(0), makeSnapshot(1))
    expect(a > aBefore).toBe(true)
    expect(b > bBefore).toBe(true)
    unsubA()
    unsubB()
  })

  it('undo/redo 也会通知订阅者', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(0))
    store.push('ADD_NODE', 's1', makeSnapshot(0), makeSnapshot(1))
    let count = 0
    const unsub = store.subscribe(() => {
      count++
    })
    const before = count
    store.undo()
    store.redo()
    expect(count > before).toBe(true)
    unsub()
  })
})

describe('createHistoryStore 工厂函数', () => {
  it('带初始状态创建', () => {
    const store = createHistoryStore(makeSnapshot(0))
    expect(store.getPresent()).toEqual(makeSnapshot(0))
    expect(store.canUndo() === false).toBe(true)
  })

  it('不带初始状态创建，present 为 null', () => {
    const store = createHistoryStore<StoryGraphSnapshot>()
    expect(store.getPresent() === null).toBe(true)
  })

  it('带 maxSize 创建并受限', () => {
    const store = createHistoryStore<StoryGraphSnapshot>(undefined, 2)
    store.initialize(makeSnapshot(0))
    store.push('ADD_NODE', 's1', makeSnapshot(0), makeSnapshot(1))
    store.push('ADD_NODE', 's2', makeSnapshot(1), makeSnapshot(2))
    store.push('ADD_NODE', 's3', makeSnapshot(2), makeSnapshot(3))
    expect(store.getHistory().length).toEqual(2)
  })
})

describe('createSnapshot 深拷贝', () => {
  it('返回的对象引用与原对象不同', () => {
    const snap = makeSnapshot(1)
    const copy = createSnapshot(snap)
    expect(copy !== snap).toBe(true)
    expect(copy.nodes !== snap.nodes).toBe(true)
  })

  it('修改拷贝不影响原对象', () => {
    const snap = makeSnapshot(1)
    const copy = createSnapshot(snap)
    copy.nodes.push({ id: 'new' })
    expect(snap.nodes.length).toEqual(1)
  })

  it('深拷贝保留嵌套数据', () => {
    const snap = makeSnapshot(1)
    const copy = createSnapshot(snap)
    expect(copy.nodes[0]).toEqual({ id: '1' })
  })
})

describe('HistoryStore.clear 清空', () => {
  it('清空历史但保留 present', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(0))
    store.push('ADD_NODE', 's1', makeSnapshot(0), makeSnapshot(1))
    const beforePresent = store.getPresent()
    store.clear()
    expect(store.getHistory().length).toEqual(0)
    expect(store.getFuture().length).toEqual(0)
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

describe('getHistory/getFuture 返回副本', () => {
  it('getHistory 返回副本，外部修改不影响内部', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(0))
    store.push('ADD_NODE', 's1', makeSnapshot(0), makeSnapshot(1))
    const h1 = store.getHistory()
    h1.pop()
    expect(store.getHistory().length).toEqual(1)
  })

  it('getFuture 返回副本', () => {
    const store = new HistoryStore<StoryGraphSnapshot>()
    store.initialize(makeSnapshot(0))
    store.push('ADD_NODE', 's1', makeSnapshot(0), makeSnapshot(1))
    store.undo()
    const f1 = store.getFuture()
    f1.pop()
    expect(store.getFuture().length).toEqual(1)
  })
})
