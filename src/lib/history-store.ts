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
  | 'UPDATE_VARIABLES'
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
}

export interface StoryGraphSnapshot {
  nodes: unknown[]
  edges: unknown[]
  characters: unknown[]
  scenes: unknown[]
  audios: unknown[]
  variables: unknown[]
  groups: unknown[]
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

  constructor(maxSize = 50) {
    this.maxSize = maxSize
  }

  initialize(state: T): void {
    this.past = []
    this.future = []
    this.present = state
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
    after: T
  ): void {
    if (this.present === null) {
      this.present = after
      this.notifyListeners()
      return
    }

    // 使用深拷贝避免历史栈被回写污染（P1-7）
    const action: HistoryAction<T> = {
      type,
      timestamp: Date.now(),
      description,
      before: createSnapshot(before),
      after: createSnapshot(after),
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
    this.notifyListeners()
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
  return JSON.parse(JSON.stringify(state))
}
