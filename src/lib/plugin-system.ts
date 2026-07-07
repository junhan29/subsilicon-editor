export interface PluginConfig {
  id: string
  name: string
  version: string
  description: string
  author: string
  homepage?: string
  icon?: string
  enabled: boolean
}

export interface PluginAction {
  id: string
  label: string
  icon?: string
  shortcut?: string
  handler: () => void
  context?: 'editor' | 'canvas' | 'node' | 'menu'
}

export interface PluginPanel {
  id: string
  label: string
  icon?: string
  component: React.ComponentType<{ pluginId: string }>
}

export interface Plugin {
  config: PluginConfig
  actions?: PluginAction[]
  panels?: PluginPanel[]
  init?: () => void
  cleanup?: () => void
}

const PLUGINS_KEY = 'subsilicon_plugins'
const enabledPlugins: Map<string, Plugin> = new Map()

export function registerPlugin(plugin: Plugin): void {
  if (enabledPlugins.has(plugin.config.id)) {
    console.warn(`Plugin ${plugin.config.id} already registered`)
    return
  }
  
  if (plugin.config.enabled) {
    enabledPlugins.set(plugin.config.id, plugin)
    plugin.init?.()
    console.log(`Plugin registered: ${plugin.config.name}`)
  }
}

export function unregisterPlugin(pluginId: string): void {
  const plugin = enabledPlugins.get(pluginId)
  if (plugin) {
    plugin.cleanup?.()
    enabledPlugins.delete(pluginId)
    console.log(`Plugin unregistered: ${plugin.config.name}`)
  }
}

export function getPlugins(): Plugin[] {
  return Array.from(enabledPlugins.values())
}

export function getPlugin(pluginId: string): Plugin | undefined {
  return enabledPlugins.get(pluginId)
}

export function getPluginActions(context?: string): PluginAction[] {
  const actions: PluginAction[] = []
  for (const plugin of enabledPlugins.values()) {
    if (plugin.actions) {
      actions.push(...plugin.actions.filter((a) => !context || a.context === context))
    }
  }
  return actions
}

export function getPluginPanels(): PluginPanel[] {
  const panels: PluginPanel[] = []
  for (const plugin of enabledPlugins.values()) {
    if (plugin.panels) {
      panels.push(...plugin.panels)
    }
  }
  return panels
}

export function togglePlugin(pluginId: string): void {
  const plugin = enabledPlugins.get(pluginId)
  if (plugin) {
    plugin.config.enabled = !plugin.config.enabled
    if (plugin.config.enabled) {
      plugin.init?.()
    } else {
      plugin.cleanup?.()
    }
    savePluginConfigs()
  }
}

export function savePluginConfigs(): void {
  const configs: PluginConfig[] = []
  for (const plugin of enabledPlugins.values()) {
    configs.push(plugin.config)
  }
  localStorage.setItem(PLUGINS_KEY, JSON.stringify(configs))
}

export function loadPluginConfigs(): PluginConfig[] {
  try {
    const str = localStorage.getItem(PLUGINS_KEY)
    return str ? JSON.parse(str) : []
  } catch {
    return []
  }
}

export function createPluginConfig(
  id: string,
  name: string,
  version: string,
  description: string,
  author: string
): PluginConfig {
  return {
    id,
    name,
    version,
    description,
    author,
    enabled: true,
  }
}

export interface PluginHook<T = unknown> {
  id: string
  callback: (data: T) => void | Promise<void>
}

const hooks: Map<string, PluginHook[]> = new Map()

export function registerHook<T>(hookId: string, callback: PluginHook<T>['callback']): () => void {
  if (!hooks.has(hookId)) {
    hooks.set(hookId, [])
  }
  
  const hook: PluginHook<T> = {
    id: `${hookId}-${Date.now()}`,
    callback,
  }
  
  hooks.get(hookId)!.push(hook)
  
  return () => {
    const hookList = hooks.get(hookId)
    if (hookList) {
      hooks.set(hookId, hookList.filter((h) => h.id !== hook.id))
    }
  }
}

export async function triggerHook<T>(hookId: string, data: T): Promise<void> {
  const hookList = hooks.get(hookId)
  if (!hookList) return
  
  for (const hook of hookList) {
    try {
      await hook.callback(data)
    } catch (error) {
      console.error(`Error in hook ${hookId}:`, error)
    }
  }
}

export const HOOKS = {
  NODE_CREATE: 'node:create',
  NODE_UPDATE: 'node:update',
  NODE_DELETE: 'node:delete',
  EDGE_CREATE: 'edge:create',
  EDGE_DELETE: 'edge:delete',
  GRAPH_SAVE: 'graph:save',
  GRAPH_LOAD: 'graph:load',
  APP_INIT: 'app:init',
  APP_SHUTDOWN: 'app:shutdown',
  AI_REQUEST: 'ai:request',
  AI_RESPONSE: 'ai:response',
} as const

export type HookId = typeof HOOKS[keyof typeof HOOKS]
