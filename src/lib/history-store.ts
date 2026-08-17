export type HistoryActionType =
  | 'ADD_NODE'
  | 'DELETE_NODE'
  | 'UPDATE_NODE'
  | 'ADD_EDGE'
  | 'DELETE_EDGE'
  | 'UPDATE_EDGE'
  | 'ADD_CHARACTER'
  | 'DELETE_CHARACTER'
  | 'UPDATE_CHARACTER'
  | 'ADD_SCENE'
  | 'DELETE_SCENE'
  | 'UPDATE_SCENE'
  | 'ADD_AUDIO'
  | 'DELETE_AUDIO'
  | 'UPDATE_AUDIO'
  | 'UPDATE_VARIABLES'
  | 'UPDATE_TITLE'
  | 'ADD_GROUP'
  | 'DELETE_GROUP'
  | 'UPDATE_GROUP'
  | 'BATCH'

export interface HistoryAction<T = unknown> {
  type: HistoryActionType
  timestamp: number
  description: string
  before: T
  after: T
  /** 可选标记：'ai-batch' 表示该条目是 AI 批量操作起点检查点（用于「回滚 AI 操作」） */
  tag?: 'ai-batch'
}

export interface StoryGraphSnapshot {
  nodes: unknown[]
  edges: unknown[]
  characters: unknown[]
  scenes: unknown[]
  audios: unknown[]
  variables: unknown[]
  groups: unknown[]
  // 批注与付费配置纳入历史快照：撤销/重做/版本恢复时一并回滚
  // （可选字段兼容早期入栈的快照）
  annotations?: unknown[]
  monetization?: unknown | null
}

export interface HistoryState {
  canUndo: boolean
  canRedo: boolean
  undoDescription: string | null
  redoDescription: string | null
  historySize: number
  currentIndex: number
}

export class HistoryStore<T extends StoryGraphSnapshot = StoryGraphSnapshot> {
  private past: HistoryAction<T>[] = []
  private future: HistoryAction<T>[] = []
  private present: T | null = null
  private maxSize: number
  private listeners: Set<(state: HistoryState) => void> = new Set()
  /** 最近一次 AI 批次起点在历史栈中的位置（-1 表示尚未记录） */
  private lastAiBatchIndex = -1

  constructor(maxSize = 50) {
    this.maxSize = maxSize
  }

  initialize(state: T): void {
    this.past = []
    this.future = []
    this.present = state
    this.lastAiBatchIndex = -1
    this.notifyListeners()
  }

  canUndo(): boolean {
    return this.past.length > 0
  }

  canRedo(): boolean {
    return this.future.length > 0
  }

  getState(): HistoryState {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoDescription: this.past.length > 0 ? this.past[this.past.length - 1].description : null,
      redoDescription: this.future.length > 0 ? this.future[this.future.length - 1].description : null,
      historySize: this.past.length,
      currentIndex: this.past.length,
    }
  }

  push(
    type: HistoryActionType,
    description: string,
    before: T,
    after: T,
    tag?: 'ai-batch'
  ): void {
    if (this.present === null) {
      this.present = after
      this.notifyListeners()
      return
    }

    // 使用深拷贝避免历史栈被回写污染
    const action: HistoryAction<T> = {
      type,
      timestamp: Date.now(),
      description,
      before: createSnapshot(before),
      after: createSnapshot(after),
      ...(tag ? { tag } : {}),
    }

    this.past.push(action)

    if (this.past.length > this.maxSize) {
      this.past.shift()
    }

    this.future = []

    this.present = action.after
    this.notifyListeners()
  }

  undo(): T | null {
    if (!this.canUndo() || this.present === null) {
      return null
    }

    const action = this.past.pop()!
    this.future.push(action)

    this.present = action.before
    this.notifyListeners()

    return action.before
  }

  redo(): T | null {
    if (!this.canRedo() || this.present === null) {
      return null
    }

    const action = this.future.pop()!
    this.past.push(action)

    this.present = action.after
    this.notifyListeners()

    return action.after
  }

  clear(): void {
    this.past = []
    this.future = []
    this.lastAiBatchIndex = -1
    this.notifyListeners()
  }

  /**
   * 把当前 graph 作为 AI 批量操作起点检查点推入历史栈（tag='ai-batch'），
   * 并记录 lastAiBatchIndex（该快照在栈中的位置）。
   * 之后 AI 批量操作产生的普通历史条目会堆叠在其上方，undoToLastAiBatch 可一次性回退到此处。
   * 若历史栈尚未初始化（present 为 null），本次标记被忽略。
   */
  markAiBatch(graph: T): void {
    if (this.present === null) return
    this.push('BATCH', 'AI 批量操作', graph, graph, 'ai-batch')
    this.lastAiBatchIndex = this.past.length
  }

  /**
   * 撤销到最近一次 AI 批量操作的起点（不越过该起点）。
   * 可重复调用回退到更早的 AI 批次（当前已是某批次起点时继续回退到更早一个）。
   * 历史栈中没有 AI 批次检查点时返回 { done: false }。
   * done 为 true 时附上回退后的最终快照，供调用方恢复画布状态。
   */
  undoToLastAiBatch(): { done: boolean; snapshot?: T | null } {
    // 从栈顶向下找最近的 ai-batch 条目（用户可能已手动 undo/redo，动态定位保证语义正确）
    let batchPos = -1
    for (let i = this.past.length - 1; i >= 0; i--) {
      if (this.past[i].tag === 'ai-batch') {
        batchPos = i
        break
      }
    }
    if (batchPos === -1) return { done: false }

    // 反复撤销直到该 ai-batch 条目出栈（present 回到批次起点之前的状态）
    while (this.past.length > batchPos && this.canUndo()) {
      this.undo()
    }
    this.lastAiBatchIndex = batchPos
    return { done: true, snapshot: this.present }
  }

  /** 最近一次 AI 批次起点在历史栈中的位置（-1 表示尚未记录） */
  getLastAiBatchIndex(): number {
    return this.lastAiBatchIndex
  }

  subscribe(listener: (state: HistoryState) => void): () => void {
    this.listeners.add(listener)
    listener(this.getState())

    return () => {
      this.listeners.delete(listener)
    }
  }

  private notifyListeners(): void {
    const state = this.getState()
    this.listeners.forEach((listener) => listener(state))
  }

  getHistory(): HistoryAction<T>[] {
    return [...this.past]
  }

  getFuture(): HistoryAction<T>[] {
    return [...this.future]
  }

  getPresent(): T | null {
    return this.present
  }
}

export function createHistoryStore<T extends StoryGraphSnapshot>(
  initialState?: T,
  maxSize?: number
): HistoryStore<T> {
  const store = new HistoryStore<T>(maxSize)
  if (initialState) {
    store.initialize(initialState)
  }
  return store
}

export function createSnapshot<T extends StoryGraphSnapshot>(state: T): T {
  if (typeof structuredClone !== 'undefined') {
    return structuredClone(state)
  }
  return JSON.parse(JSON.stringify(state))
}
