export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  author?: string
  homepage?: string
  permissions?: string[]
}

export interface PluginContext {
  readonly manifest: PluginManifest
  readonly api: EditorPluginApi
}

export interface PluginModule {
  activate?(context: PluginContext): void | Promise<void>
  deactivate?(): void | Promise<void>
}

export type PluginHookName =
  | 'beforeNodeCreate'
  | 'afterNodeCreate'
  | 'beforeNodeDelete'
  | 'afterNodeDelete'
  | 'beforeNodeUpdate'
  | 'afterNodeUpdate'
  | 'beforeExport'
  | 'afterExport'
  | 'onCanvasReady'
  | 'onStoryLoad'
  | 'onStorySave'

export type HookHandler<T = unknown> = (...args: any[]) => T | Promise<T>

export interface EditorPluginApi {
  registerHook(hook: PluginHookName, handler: HookHandler): void
  unregisterHook(hook: PluginHookName, handler: HookHandler): void
  addCommand(id: string, handler: () => void, label?: string): void
  removeCommand(id: string): void
  getStorage(namespace: string): PluginStorage
  getState(): Readonly<Record<string, unknown>>
  on(event: string, handler: (...args: any[]) => void): void
  off(event: string, handler: (...args: any[]) => void): void
  emit(event: string, ...args: any[]): void
}

export interface PluginStorage {
  get<T = unknown>(key: string): Promise<T | null>
  set<T = unknown>(key: string, value: T): Promise<void>
  remove(key: string): Promise<void>
  clear(): Promise<void>
  keys(): Promise<string[]>
}

export type PluginStatus = 'inactive' | 'activating' | 'active' | 'error'

export interface PluginInstance {
  manifest: PluginManifest
  module: PluginModule
  status: PluginStatus
  error?: string
  context?: PluginContext
}
