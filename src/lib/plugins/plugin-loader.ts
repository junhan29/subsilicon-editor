import type { PluginManifest, PluginModule } from './types'
import { pluginManager } from './plugin-manager'

export interface PluginSource {
  type: 'module' | 'url' | 'inline'
  url?: string
  module?: PluginModule
  manifest: PluginManifest
}

const loadedSources = new Map<string, PluginSource>()

export async function loadPlugin(source: PluginSource): Promise<void> {
  const { manifest } = source

  if (loadedSources.has(manifest.id)) {
    throw new Error(`Plugin "${manifest.id}" is already loaded`)
  }

  let module: PluginModule

  if (source.type === 'inline' && source.module) {
    module = source.module
  } else if (source.type === 'module' && source.url) {
    module = await loadFromUrl(source.url)
  } else if (source.type === 'url' && source.url) {
    module = await loadFromUrl(source.url)
  } else {
    throw new Error(`Invalid plugin source for "${manifest.id}"`)
  }

  validateModule(module, manifest)
  pluginManager.register(manifest, module)
  loadedSources.set(manifest.id, source)
}

async function loadFromUrl(url: string): Promise<PluginModule> {
  const imported = await import(
    /* @vite-ignore */ url
  )
  return imported.default || imported
}

export function validateModule(module: unknown, manifest: PluginManifest): asserts module is PluginModule {
  if (typeof module !== 'object' || module === null) {
    throw new Error(`Plugin "${manifest.id}" module is not an object`)
  }

  const m = module as Record<string, unknown>

  if (m.activate !== undefined && typeof m.activate !== 'function') {
    throw new Error(`Plugin "${manifest.id}" activate must be a function`)
  }

  if (m.deactivate !== undefined && typeof m.deactivate !== 'function') {
    throw new Error(`Plugin "${manifest.id}" deactivate must be a function`)
  }
}

export function unloadPlugin(pluginId: string): void {
  const source = loadedSources.get(pluginId)
  if (!source) return

  pluginManager.unregister(pluginId)
  loadedSources.delete(pluginId)
}

export function getLoadedSources(): PluginSource[] {
  return Array.from(loadedSources.values())
}

export function isPluginLoaded(pluginId: string): boolean {
  return loadedSources.has(pluginId)
}

export async function activateLoadedPlugin(pluginId: string): Promise<void> {
  await pluginManager.activate(pluginId)
}

export async function deactivateLoadedPlugin(pluginId: string): Promise<void> {
  await pluginManager.deactivate(pluginId)
}

export async function loadAndActivate(source: PluginSource): Promise<void> {
  await loadPlugin(source)
  await pluginManager.activate(source.manifest.id)
}

export function clearLoadedPlugins(): void {
  for (const id of loadedSources.keys()) {
    pluginManager.unregister(id)
  }
  loadedSources.clear()
}
