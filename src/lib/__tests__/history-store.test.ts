/** history-store 单元测试 */
import {
  HistoryStore,
  createHistoryStore,
  createSnapshot,
} from '../history-store'
import type {
  StoryGraphSnapshot,
  HistoryState,
} from '../history-store'

let passed = 0
let failed = 0
const failures: string[] = []

function describe(name: string, fn: () => void): void {
  console.log(`\n▸ ${name}`)
  fn()
}

function it(name: string, fn: () => void): void {
  try {
    fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    failed++
    const msg = e instanceof Error ? e.message : String(e)
    failures.push(`${name}: ${msg}`)
    console.log(`  ✗ ${name}`)
    console.log(`    ${msg.split('\n').join('\n    ')}`)
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) {
    throw new Error(`${message}\n     expected: ${e}\n     actual:   ${a}`)
  }
}

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

export function runTests(): void {
  passed = 0
  failed = 0
  failures.length = 0

  describe('HistoryStore.initialize 初始化', () => {
    it('初始化后 present 等于传入状态', () => {
      const store = new HistoryStore<StoryGraphSnapshot>()
      const snap = makeSnapshot(1)
      store.initialize(snap)
      assertEqual(store.getPresent(), snap, 'present 应等于初始化状态')
    })

    it('初始化后 past/future 为空，canUndo/canRedo 为 false', () => {
      const store = new HistoryStore<StoryGraphSnapshot>()
      store.initialize(makeSnapshot(1))
      assert(store.canUndo() === false, 'canUndo 应为 false')
      assert(store.canRedo() === false, 'canRedo 应为 false')
      assertEqual(store.getHistory().length, 0, 'past 应为空')
      assertEqual(store.getFuture().length, 0, 'future 应为空')
    })

    it('多次 initialize 会重置历史栈', () => {
      const store = new HistoryStore<StoryGraphSnapshot>()
      store.initialize(makeSnapshot(1))
      store.push('ADD_NODE', 'add 1', makeSnapshot(1), makeSnapshot(2))
      store.initialize(makeSnapshot(99))
      assertEqual(store.getHistory().length, 0, '重新 initialize 后 past 应清空')
      assertEqual(
        store.getPresent()?.nodes[0],
        { id: '99' },
        'present 应为新状态'
      )
    })

    it('getState 返回正确的 HistoryState', () => {
      const store = new HistoryStore<StoryGraphSnapshot>()
      store.initialize(makeSnapshot(0))
      store.push('ADD_NODE', 'step 1', makeSnapshot(0), makeSnapshot(1))
      const state: HistoryState = store.getState()
      assert(state.canUndo === true, 'canUndo 应为 true')
      assert(state.canRedo === false, 'canRedo 应为 false')
      assertEqual(state.undoDescription, 'step 1', 'undoDescription')
      assertEqual(state.redoDescription, null, 'redoDescription 应为 null')
      assertEqual(state.historySize, 1, 'historySize')
      assertEqual(state.currentIndex, 1, 'currentIndex')
    })
  })

  describe('HistoryStore.push 推送历史', () => {
    it('present 为 null 时首次 push 只设置 present，不写入历史', () => {
      const store = new HistoryStore<StoryGraphSnapshot>()
      store.push('ADD_NODE', 'first', makeSnapshot(0), makeSnapshot(1))
      assertEqual(store.getPresent(), makeSnapshot(1), 'present 应为 after')
      assertEqual(store.getHistory().length, 0, 'past 应为空')
      assert(store.canUndo() === false, 'canUndo 应为 false')
    })

    it('push 多次后 past 顺序累积', () => {
      const store = new HistoryStore<StoryGraphSnapshot>()
      store.initialize(makeSnapshot(0))
      store.push('ADD_NODE', 'step 1', makeSnapshot(0), makeSnapshot(1))
      store.push('ADD_NODE', 'step 2', makeSnapshot(1), makeSnapshot(2))
      store.push('ADD_NODE', 'step 3', makeSnapshot(2), makeSnapshot(3))
      assertEqual(store.getHistory().length, 3, 'past 应有 3 条')
      assertEqual(
        store.getHistory()[0].description,
        'step 1',
        '第一条描述应为 step 1'
      )
      assertEqual(
        store.getHistory()[2].description,
        'step 3',
        '最后一条描述应为 step 3'
      )
    })

    it('push 会清空 future', () => {
      const store = new HistoryStore<StoryGraphSnapshot>()
      store.initialize(makeSnapshot(0))
      store.push('ADD_NODE', 'step 1', makeSnapshot(0), makeSnapshot(1))
      store.undo()
      assert(store.getFuture().length === 1, 'undo 后 future 应有 1 条')
      store.push('ADD_NODE', 'new step', makeSnapshot(0), makeSnapshot(5))
      assertEqual(store.getFuture().length, 0, '新 push 后 future 应清空')
    })

    it('push 通过深拷贝避免后续修改污染历史', () => {
      const store = new HistoryStore<StoryGraphSnapshot>()
      const before = makeSnapshot(0)
      const after = makeSnapshot(1)
      store.initialize(before)
      store.push('UPDATE_NODE', 'update', before, after)
      // 修改 after 引用对象
      after.nodes.push({ id: 'mutated' })
      const history = store.getHistory()
      assertEqual(
        history[0].after.nodes.length,
        1,
        '历史中的 after 不应被外部修改污染'
      )
    })

    it('push 后 present 等于 action.after', () => {
      const store = new HistoryStore<StoryGraphSnapshot>()
      store.initialize(makeSnapshot(0))
      store.push('ADD_NODE', 'step 1', makeSnapshot(0), makeSnapshot(1))
      assertEqual(
        store.getPresent(),
        store.getHistory()[0].after,
        'present 应等于最新 action 的 after'
      )
    })
  })

  describe('HistoryStore.undo/redo', () => {
    it('undo 返回 before 状态并移动到 future', () => {
      const store = new HistoryStore<StoryGraphSnapshot>()
      store.initialize(makeSnapshot(0))
      store.push('ADD_NODE', 'step 1', makeSnapshot(0), makeSnapshot(1))
      const result = store.undo()
      assertEqual(result, makeSnapshot(0), 'undo 返回 before')
      assertEqual(store.getPresent(), makeSnapshot(0), 'present 应回到 before')
      assert(store.canRedo() === true, 'canRedo 应为 true')
      assert(store.canUndo() === false, 'canUndo 应为 false')
    })

    it('redo 恢复 undo 前的状态', () => {
      const store = new HistoryStore<StoryGraphSnapshot>()
      store.initialize(makeSnapshot(0))
      store.push('ADD_NODE', 'step 1', makeSnapshot(0), makeSnapshot(1))
      store.undo()
      const result = store.redo()
      assertEqual(result, makeSnapshot(1), 'redo 返回 after')
      assertEqual(store.getPresent(), makeSnapshot(1), 'present 应恢复为 after')
      assert(store.canUndo() === true, 'canUndo 应为 true')
      assert(store.canRedo() === false, 'canRedo 应为 false')
    })

    it('无可撤销时 undo 返回 null', () => {
      const store = new HistoryStore<StoryGraphSnapshot>()
      store.initialize(makeSnapshot(0))
      const result = store.undo()
      assert(result === null, '空历史 undo 应返回 null')
    })

    it('无可重做时 redo 返回 null', () => {
      const store = new HistoryStore<StoryGraphSnapshot>()
      store.initialize(makeSnapshot(0))
      const result = store.redo()
      assert(result === null, '空 future redo 应返回 null')
    })

    it('多步 undo/redo 链', () => {
      const store = new HistoryStore<StoryGraphSnapshot>()
      store.initialize(makeSnapshot(0))
      store.push('ADD_NODE', 's1', makeSnapshot(0), makeSnapshot(1))
      store.push('ADD_NODE', 's2', makeSnapshot(1), makeSnapshot(2))
      store.push('ADD_NODE', 's3', makeSnapshot(2), makeSnapshot(3))
      assertEqual(store.undo(), makeSnapshot(2), 'undo 1 应返回 s2')
      assertEqual(store.undo(), makeSnapshot(1), 'undo 2 应返回 s1')
      assertEqual(store.redo(), makeSnapshot(2), 'redo 1 应返回 s2')
      assertEqual(store.getPresent(), makeSnapshot(2), 'present 应为 s2')
    })

    it('present 为 null 时 undo/redo 都返回 null', () => {
      const store = new HistoryStore<StoryGraphSnapshot>()
      assert(store.undo() === null, 'present null 时 undo 返回 null')
      assert(store.redo() === null, 'present null 时 redo 返回 null')
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
      assertEqual(store.getHistory().length, 3, 'past 应不超过 maxSize')
      assertEqual(
        store.getHistory()[0].description,
        's2',
        '最旧的 s1 应被丢弃'
      )
      assertEqual(
        store.getHistory()[2].description,
        's4',
        '最新的应为 s4'
      )
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
      assertEqual(store.getHistory().length, 50, '默认上限应为 50')
      assertEqual(
        store.getHistory()[0].description,
        's11',
        '最早应保留 s11'
      )
    })

    it('maxSize=1 时只保留最新一条', () => {
      const store = new HistoryStore<StoryGraphSnapshot>(1)
      store.initialize(makeSnapshot(0))
      store.push('ADD_NODE', 's1', makeSnapshot(0), makeSnapshot(1))
      store.push('ADD_NODE', 's2', makeSnapshot(1), makeSnapshot(2))
      assertEqual(store.getHistory().length, 1, '应只保留 1 条')
      assertEqual(store.getHistory()[0].description, 's2', '应为 s2')
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
      assert(received !== null, '应立即收到状态')
      assert(received!.canUndo === false, 'canUndo 应为 false')
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
      assert(count > initialCount, 'push 后订阅者应被通知')
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
      assertEqual(count, beforeUnsub, '取消订阅后不应再收到通知')
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
      assert(a > aBefore, '订阅者 A 应被通知')
      assert(b > bBefore, '订阅者 B 应被通知')
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
      assert(count > before, 'undo + redo 应触发通知')
      unsub()
    })
  })

  describe('createHistoryStore 工厂函数', () => {
    it('带初始状态创建', () => {
      const store = createHistoryStore(makeSnapshot(0))
      assertEqual(store.getPresent(), makeSnapshot(0), 'present 应为初始状态')
      assert(store.canUndo() === false, 'canUndo 应为 false')
    })

    it('不带初始状态创建，present 为 null', () => {
      const store = createHistoryStore<StoryGraphSnapshot>()
      assert(store.getPresent() === null, 'present 应为 null')
    })

    it('带 maxSize 创建并受限', () => {
      const store = createHistoryStore<StoryGraphSnapshot>(undefined, 2)
      store.initialize(makeSnapshot(0))
      store.push('ADD_NODE', 's1', makeSnapshot(0), makeSnapshot(1))
      store.push('ADD_NODE', 's2', makeSnapshot(1), makeSnapshot(2))
      store.push('ADD_NODE', 's3', makeSnapshot(2), makeSnapshot(3))
      assertEqual(store.getHistory().length, 2, '应受 maxSize=2 限制')
    })
  })

  describe('createSnapshot 深拷贝', () => {
    it('返回的对象引用与原对象不同', () => {
      const snap = makeSnapshot(1)
      const copy = createSnapshot(snap)
      assert(copy !== snap, '顶层引用应不同')
      assert(copy.nodes !== snap.nodes, '嵌套数组引用应不同')
    })

    it('修改拷贝不影响原对象', () => {
      const snap = makeSnapshot(1)
      const copy = createSnapshot(snap)
      copy.nodes.push({ id: 'new' })
      assertEqual(snap.nodes.length, 1, '原对象不应被修改')
    })

    it('深拷贝保留嵌套数据', () => {
      const snap = makeSnapshot(1)
      const copy = createSnapshot(snap)
      assertEqual(copy.nodes[0], { id: '1' }, '嵌套数据应保留')
    })
  })

  describe('HistoryStore.clear 清空', () => {
    it('清空历史但保留 present', () => {
      const store = new HistoryStore<StoryGraphSnapshot>()
      store.initialize(makeSnapshot(0))
      store.push('ADD_NODE', 's1', makeSnapshot(0), makeSnapshot(1))
      const beforePresent = store.getPresent()
      store.clear()
      assertEqual(store.getHistory().length, 0, 'past 应清空')
      assertEqual(store.getFuture().length, 0, 'future 应清空')
      assertEqual(store.getPresent(), beforePresent, 'present 应保留')
    })

    it('clear 后 canUndo/canRedo 都为 false', () => {
      const store = new HistoryStore<StoryGraphSnapshot>()
      store.initialize(makeSnapshot(0))
      store.push('ADD_NODE', 's1', makeSnapshot(0), makeSnapshot(1))
      store.clear()
      assert(store.canUndo() === false, 'canUndo 应为 false')
      assert(store.canRedo() === false, 'canRedo 应为 false')
    })
  })

  describe('getHistory/getFuture 返回副本', () => {
    it('getHistory 返回副本，外部修改不影响内部', () => {
      const store = new HistoryStore<StoryGraphSnapshot>()
      store.initialize(makeSnapshot(0))
      store.push('ADD_NODE', 's1', makeSnapshot(0), makeSnapshot(1))
      const h1 = store.getHistory()
      h1.pop()
      assertEqual(store.getHistory().length, 1, '内部 past 不应被外部修改')
    })

    it('getFuture 返回副本', () => {
      const store = new HistoryStore<StoryGraphSnapshot>()
      store.initialize(makeSnapshot(0))
      store.push('ADD_NODE', 's1', makeSnapshot(0), makeSnapshot(1))
      store.undo()
      const f1 = store.getFuture()
      f1.pop()
      assertEqual(store.getFuture().length, 1, '内部 future 不应被外部修改')
    })
  })

  console.log(
    `\n=== history-store 测试结果: ${passed} 通过, ${failed} 失败 ===`
  )
  if (failed > 0) {
    console.log('\n失败用例:')
    failures.forEach((f) => console.log(`  - ${f}`))
    throw new Error(`${failed} 个测试失败`)
  }
}

// 当作主模块运行时自动执行测试
const isMainModule = (() => {
  try {
    return (
      typeof process !== 'undefined' &&
      !!process.argv[1]?.includes('history-store.test')
    )
  } catch {
    return false
  }
})()

if (isMainModule) {
  runTests()
}
