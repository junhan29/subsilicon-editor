export { PluginManager, pluginManager } from './plugin-manager'
export { SandboxStorage } from './sandbox-storage'
export {
  loadPlugin,
  unloadPlugin,
  loadAndActivate,
  isPluginLoaded,
  getLoadedSources,
  clearLoadedPlugins,
  validateModule,
} from './plugin-loader'
export type { PluginSource } from './plugin-loader'
export {
  registerPanel,
  unregisterPanel,
  getPanels,
  getPanelsByPlugin,
  registerAction,
  unregisterAction,
  getActions,
  getActionsByPlugin,
  registerMenuItem,
  unregisterMenuItem,
  getMenuItems,
  getMenuItemsByPlugin,
  cleanupPluginExtensions,
  clearAllExtensions,
  getExtensionPoint,
} from './extension-points'
export type {
  ExtensionPoint,
  ExtensionArea,
  PanelExtension,
  ActionExtension,
  MenuItemExtension,
} from './extension-points'

export type {
  PluginManifest,
  PluginModule,
  PluginInstance,
  PluginContext,
  PluginStatus,
  PluginHookName,
  HookHandler,
  EditorPluginApi,
  PluginStorage,
} from './types'
