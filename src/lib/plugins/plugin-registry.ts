import type { PluginManifest, PluginPermission } from '@editor/types/editor'

const INSTALLED_KEY = 'subsilicon-installed-plugins'
const CONFIG_KEY = 'subsilicon-plugin-configs'
const ENABLED_KEY = 'subsilicon-enabled-plugins'

// ============ Storage ============

function getInstalled(): PluginManifest[] {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem(INSTALLED_KEY)
    return data ? JSON.parse(data) : []
  } catch { return [] }
}

function saveInstalled(plugins: PluginManifest[]): void {
  localStorage.setItem(INSTALLED_KEY, JSON.stringify(plugins))
}

function getConfigs(): Record<string, Record<string, string>> {
  try {
    const data = localStorage.getItem(CONFIG_KEY)
    return data ? JSON.parse(data) : {}
  } catch { return {} }
}

function saveConfigs(configs: Record<string, Record<string, string>>): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(configs))
}

// ============ Plugin Manager ============

export async function installPlugin(manifest: PluginManifest, sourceUrl: string): Promise<boolean> {
  try {
    const installed = getInstalled()
    if (installed.find(p => p.pluginId === manifest.pluginId)) {
      return false
    }
    
    if (manifest.source.checksum) {
      const res = await fetch(sourceUrl)
      const blob = await res.blob()
      const hashBuffer = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      if (checksum !== manifest.source.checksum) {
        console.warn('Plugin checksum mismatch')
      }
    }

    manifest.source.url = sourceUrl
    installed.push(manifest)
    saveInstalled(installed)
    
    enablePlugin(manifest.pluginId)
    
    return true
  } catch (err) {
    console.error('Plugin install failed:', err)
    return false
  }
}

export function uninstallPlugin(pluginId: string): boolean {
  const installed = getInstalled().filter(p => p.pluginId !== pluginId)
  saveInstalled(installed)
  disablePlugin(pluginId)
  return true
}

export function getInstalledPlugins(): PluginManifest[] {
  return getInstalled()
}

export function getPlugin(pluginId: string): PluginManifest | undefined {
  return getInstalled().find(p => p.pluginId === pluginId)
}

export function isPluginInstalled(pluginId: string): boolean {
  return !!getPlugin(pluginId)
}

// ============ Enable/Disable ============

function loadEnabled(): string[] {
  try {
    const data = localStorage.getItem(ENABLED_KEY)
    return data ? JSON.parse(data) : []
  } catch { return [] }
}

function saveEnabled(enabled: string[]): void {
  localStorage.setItem(ENABLED_KEY, JSON.stringify(enabled))
}

export function enablePlugin(pluginId: string): boolean {
  const enabled = loadEnabled()
  if (!enabled.includes(pluginId)) {
    enabled.push(pluginId)
    saveEnabled(enabled)
  }
  return true
}

export function disablePlugin(pluginId: string): boolean {
  const enabled = loadEnabled().filter(id => id !== pluginId)
  saveEnabled(enabled)
  return true
}

export function isPluginEnabled(pluginId: string): boolean {
  return loadEnabled().includes(pluginId)
}

export function getEnabledPlugins(): PluginManifest[] {
  const enabled = loadEnabled()
  return getInstalled().filter(p => enabled.includes(p.pluginId))
}

// ============ Permissions ============

export function hasPermission(pluginId: string, permission: PluginPermission): boolean {
  const plugin = getPlugin(pluginId)
  if (!plugin) return false
  return plugin.permissions.includes(permission)
}

// ============ Config ============

export function getPluginConfig(pluginId: string): Record<string, string> {
  return getConfigs()[pluginId] || {}
}

export function setPluginConfig(pluginId: string, config: Record<string, string>): void {
  const configs = getConfigs()
  configs[pluginId] = config
  saveConfigs(configs)
}

// ============ Available plugins catalog ============

const DEFAULT_PLUGIN_CATALOG_URL = 'https://subsilicon.cn/api/plugins/index.json'

export async function getAvailablePlugins(): Promise<PluginManifest[]> {
  try {
    const res = await fetch(DEFAULT_PLUGIN_CATALOG_URL)
    if (res.ok) {
      const data = await res.json()
      return data.plugins || []
    }
  } catch {}
  return []
}

// ============ Sandbox ============
// Creates a properly isolated iframe sandbox for running plugin code.
// Security principles:
// 1. NO allow-same-origin — prevents DOM access to the parent page
// 2. NO allow-top-navigation — prevents plugin redirecting the page
// 3. NO allow-forms — prevents unexpected form submissions
// 4. allow-scripts only + specific allow-popups if needed
// 5. postMessage is the ONLY communication channel

const sandboxes = new Map<string, HTMLIFrameElement>()

export function createPluginSandbox(pluginId: string, codeUrl: string): boolean {
  try {
    // Destroy existing if any
    destroyPluginSandbox(pluginId)

    const iframe = document.createElement('iframe')
    // NO allow-same-origin = plugin cannot access parent DOM/storage
    iframe.sandbox.add('allow-scripts')
    iframe.style.display = 'none'
    iframe.title = `Plugin: ${pluginId}`
    iframe.src = codeUrl
    document.body.appendChild(iframe)

    // Set up message listener for this plugin's sandbox
    const messageHandler = (event: MessageEvent) => {
      // Only accept messages from our own plugin iframe
      if (event.source !== iframe.contentWindow) return
      // Forward to registered hook listeners
      const data = event.data
      if (data?.hook) {
        executeHook(data.hook, data.context)
      }
    }
    window.addEventListener('message', messageHandler)
    ;(iframe as any)._sandboxHandler = messageHandler

    sandboxes.set(pluginId, iframe)
    return true
  } catch {
    return false
  }
}

export function destroyPluginSandbox(pluginId: string): void {
  const iframe = sandboxes.get(pluginId)
  if (iframe) {
    // Clean up message listener
    const handler = (iframe as any)._sandboxHandler
    if (handler) window.removeEventListener('message', handler)
    iframe.remove()
    sandboxes.delete(pluginId)
  }
}

export function postMessageToPlugin(pluginId: string, msg: any): void {
  const iframe = sandboxes.get(pluginId)
  // Use targetOrigin restriction — only send to our sandbox origin
  // (sandboxed iframe has origin 'null', so we use '*' but the
  //  sandbox property already prevents DOM access)
  if (iframe?.contentWindow) {
    iframe.contentWindow.postMessage(msg, '*')
  }
}

export function getSandboxCount(): number {
  return sandboxes.size
}

// ============ Hooks ============

type PluginHookCallback = (pluginId: string, context: any) => Promise<any>

const hooks = new Map<string, PluginHookCallback[]>()

export function registerHook(hook: string, callback: PluginHookCallback): void {
  if (!hooks.has(hook)) {
    hooks.set(hook, [])
  }
  hooks.get(hook)!.push(callback)
}

export async function executeHook(hook: string, context: any): Promise<any[]> {
  const callbacks = hooks.get(hook) || []
  const results: any[] = []
  for (const cb of callbacks) {
    try {
      const result = await cb('system', context)
      results.push(result)
    } catch {}
  }
  return results
}

export interface PluginManager {
  install(source: { url: string; checksum?: string }): Promise<boolean>
  uninstall(pluginId: string): boolean
  enable(pluginId: string): boolean
  disable(pluginId: string): boolean
  isEnabled(pluginId: string): boolean
  getInstalled(): PluginManifest[]
  getAvailable(): Promise<PluginManifest[]>
  getConfig(pluginId: string): Record<string, string>
  setConfig(pluginId: string, config: Record<string, string>): void
  executeHook(hook: string, context: any): Promise<any[]>
}

export function createPluginManager(): PluginManager {
  return {
    install: async (source) => {
      try {
        const res = await fetch(source.url)
        const manifest: PluginManifest = await res.json()
        return installPlugin(manifest, source.url)
      } catch { return false }
    },
    uninstall: uninstallPlugin,
    enable: enablePlugin,
    disable: disablePlugin,
    isEnabled: isPluginEnabled,
    getInstalled: getInstalledPlugins,
    getAvailable: getAvailablePlugins,
    getConfig: getPluginConfig,
    setConfig: setPluginConfig,
    executeHook,
  }
}
