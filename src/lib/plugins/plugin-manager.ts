import type {
  PluginManifest,
  PluginModule,
  PluginInstance,
  PluginStatus,
  PluginHookName,
  HookHandler,
  EditorPluginApi,
  PluginStorage,
  PluginContext,
} from './types'
import { SandboxStorage } from './sandbox-storage'

export class PluginManager {
  private plugins = new Map<string, PluginInstance>()
  private hooks = new Map<PluginHookName, Set<HookHandler>>()
  private commands = new Map<string, { handler: () => void; label?: string }>()
  private eventListeners = new Map<string, Set<(...args: any[]) => void>>()
  private state: Record<string, unknown> = {}

  register(manifest: PluginManifest, module: PluginModule): void {
    if (this.plugins.has(manifest.id)) {
      throw new Error(`Plugin "${manifest.id}" is already registered`)
    }

    this.plugins.set(manifest.id, {
      manifest,
      module,
      status: 'inactive',
    })
  }

  unregister(pluginId: string): void {
    const instance = this.plugins.get(pluginId)
    if (!instance) return

    if (instance.status === 'active') {
      this.deactivate(pluginId)
    }

    this.plugins.delete(pluginId)
  }

  async activate(pluginId: string): Promise<void> {
    const instance = this.plugins.get(pluginId)
    if (!instance) {
      throw new Error(`Plugin "${pluginId}" not found`)
    }

    if (instance.status === 'active' || instance.status === 'activating') {
      return
    }

    instance.status = 'activating'
    instance.error = undefined

    try {
      const context = this.createContext(instance.manifest)
      instance.context = context

      if (instance.module.activate) {
        await instance.module.activate(context)
      }

      instance.status = 'active'
    } catch (error) {
      instance.status = 'error'
      instance.error = error instanceof Error ? error.message : String(error)
      throw error
    }
  }

  async deactivate(pluginId: string): Promise<void> {
    const instance = this.plugins.get(pluginId)
    if (!instance || instance.status !== 'active') return

    try {
      if (instance.module.deactivate) {
        await instance.module.deactivate()
      }
    } finally {
      this.cleanupPluginHooks(pluginId)
      this.cleanupPluginCommands(pluginId)
      instance.status = 'inactive'
      instance.context = undefined
    }
  }

  getStatus(pluginId: string): PluginStatus | null {
    return this.plugins.get(pluginId)?.status || null
  }

  getPlugin(pluginId: string): PluginInstance | undefined {
    return this.plugins.get(pluginId)
  }

  listPlugins(): PluginInstance[] {
    return Array.from(this.plugins.values())
  }

  listActivePlugins(): PluginInstance[] {
    return this.listPlugins().filter((p) => p.status === 'active')
  }

  registerHook(hook: PluginHookName, handler: HookHandler): void {
    if (!this.hooks.has(hook)) {
      this.hooks.set(hook, new Set())
    }
    this.hooks.get(hook)!.add(handler)
  }

  unregisterHook(hook: PluginHookName, handler: HookHandler): void {
    this.hooks.get(hook)?.delete(handler)
  }

  async triggerHook(hook: PluginHookName, ...args: any[]): Promise<unknown[]> {
    const handlers = this.hooks.get(hook)
    if (!handlers || handlers.size === 0) return []

    const results: unknown[] = []
    for (const handler of handlers) {
      try {
        const result = await handler(...args)
        results.push(result)
      } catch (error) {
        console.warn(`Hook ${hook} handler failed:`, error)
      }
    }
    return results
  }

  addCommand(id: string, handler: () => void, label?: string): void {
    this.commands.set(id, { handler, label })
  }

  removeCommand(id: string): void {
    this.commands.delete(id)
  }

  getCommand(id: string): { handler: () => void; label?: string } | undefined {
    return this.commands.get(id)
  }

  listCommands(): Array<{ id: string; label?: string }> {
    return Array.from(this.commands.entries()).map(([id, { label }]) => ({ id, label }))
  }

  executeCommand(id: string): boolean {
    const cmd = this.commands.get(id)
    if (!cmd) return false
    try {
      cmd.handler()
      return true
    } catch (error) {
      console.warn(`Command ${id} failed:`, error)
      return false
    }
  }

  on(event: string, handler: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(handler)
  }

  off(event: string, handler: (...args: any[]) => void): void {
    this.eventListeners.get(event)?.delete(handler)
  }

  emit(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event)
    if (!listeners) return
    for (const listener of listeners) {
      try {
        listener(...args)
      } catch (error) {
        console.warn(`Event ${event} listener failed:`, error)
      }
    }
  }

  setState(key: string, value: unknown): void {
    this.state[key] = value
  }

  getState(): Readonly<Record<string, unknown>> {
    return { ...this.state }
  }

  private createContext(manifest: PluginManifest): PluginContext {
    const api = this.createApi(manifest)
    return { manifest, api }
  }

  private createApi(manifest: PluginManifest): EditorPluginApi {
    const storage = new SandboxStorage(manifest.id)

    return {
      registerHook: (hook, handler) => this.registerHook(hook, handler),
      unregisterHook: (hook, handler) => this.unregisterHook(hook, handler),
      addCommand: (id, handler, label) => this.addCommand(`${manifest.id}:${id}`, handler, label),
      removeCommand: (id) => this.removeCommand(`${manifest.id}:${id}`),
      getStorage: (namespace: string): PluginStorage =>
        new SandboxStorage(`${manifest.id}:${namespace}`),
      getState: () => this.getState(),
      on: (event, handler) => this.on(event, handler),
      off: (event, handler) => this.off(event, handler),
      emit: (event, ...args) => this.emit(event, ...args),
    }
  }

  private cleanupPluginHooks(pluginId: string): void {
    // 简化实现：实际场景需要追踪每个插件注册了哪些 hook
    // 这里先不做复杂追踪，依赖插件在 deactivate 中自行清理
  }

  private cleanupPluginCommands(pluginId: string): void {
    const prefix = `${pluginId}:`
    for (const id of this.commands.keys()) {
      if (id.startsWith(prefix)) {
        this.commands.delete(id)
      }
    }
  }

  async deactivateAll(): Promise<void> {
    for (const pluginId of this.plugins.keys()) {
      await this.deactivate(pluginId)
    }
  }

  clear(): void {
    this.deactivateAll()
    this.plugins.clear()
    this.hooks.clear()
    this.commands.clear()
    this.eventListeners.clear()
    this.state = {}
  }
}

export const pluginManager = new PluginManager()
