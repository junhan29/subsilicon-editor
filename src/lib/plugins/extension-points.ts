import type { ComponentType } from 'react'
import { pluginManager } from './plugin-manager'

export interface ExtensionPoint {
  id: string
  label: string
  area: ExtensionArea
}

export type ExtensionArea =
  | 'sidebar'
  | 'toolbar'
  | 'node-menu'
  | 'canvas-menu'
  | 'settings-tab'
  | 'status-bar'

export interface PanelExtension {
  id: string
  pluginId: string
  label: string
  icon?: string
  order?: number
  component: ComponentType<{ pluginId: string }>
}

export interface ActionExtension {
  id: string
  pluginId: string
  label: string
  icon?: string
  shortcut?: string
  order?: number
  handler: () => void
}

export interface MenuItemExtension extends ActionExtension {
  area: ExtensionArea
}

const panels = new Map<string, PanelExtension>()
const actions = new Map<string, ActionExtension>()
const menuItems = new Map<string, MenuItemExtension>()

const extensionPoints: Record<ExtensionArea, ExtensionPoint> = {
  sidebar: { id: 'sidebar', label: '侧边栏', area: 'sidebar' },
  toolbar: { id: 'toolbar', label: '工具栏', area: 'toolbar' },
  'node-menu': { id: 'node-menu', label: '节点菜单', area: 'node-menu' },
  'canvas-menu': { id: 'canvas-menu', label: '画布菜单', area: 'canvas-menu' },
  'settings-tab': { id: 'settings-tab', label: '设置标签页', area: 'settings-tab' },
  'status-bar': { id: 'status-bar', label: '状态栏', area: 'status-bar' },
}

export function getExtensionPoint(area: ExtensionArea): ExtensionPoint {
  return extensionPoints[area]
}

export function registerPanel(
  pluginId: string,
  panel: Omit<PanelExtension, 'pluginId'>
): string {
  const id = `${pluginId}:${panel.id}`
  const ext: PanelExtension = { ...panel, pluginId }

  panels.set(id, ext)
  pluginManager.emit('extension:panel-added', ext)
  return id
}

export function unregisterPanel(id: string): void {
  const ext = panels.get(id)
  if (ext) {
    panels.delete(id)
    pluginManager.emit('extension:panel-removed', ext)
  }
}

export function getPanels(): PanelExtension[] {
  return Array.from(panels.values()).sort(
    (a, b) => (a.order ?? 100) - (b.order ?? 100)
  )
}

export function getPanelsByPlugin(pluginId: string): PanelExtension[] {
  return getPanels().filter((p) => p.pluginId === pluginId)
}

export function registerAction(
  pluginId: string,
  action: Omit<ActionExtension, 'pluginId'>
): string {
  const id = `${pluginId}:${action.id}`
  const ext: ActionExtension = { ...action, pluginId }

  actions.set(id, ext)
  pluginManager.addCommand(`${pluginId}:${action.id}`, action.handler, action.label)
  pluginManager.emit('extension:action-added', ext)
  return id
}

export function unregisterAction(id: string): void {
  const ext = actions.get(id)
  if (ext) {
    actions.delete(id)
    pluginManager.removeCommand(id)
    pluginManager.emit('extension:action-removed', ext)
  }
}

export function getActions(): ActionExtension[] {
  return Array.from(actions.values()).sort(
    (a, b) => (a.order ?? 100) - (b.order ?? 100)
  )
}

export function getActionsByPlugin(pluginId: string): ActionExtension[] {
  return getActions().filter((a) => a.pluginId === pluginId)
}

export function registerMenuItem(
  pluginId: string,
  item: Omit<MenuItemExtension, 'pluginId'>
): string {
  const id = `${pluginId}:${item.id}`
  const ext: MenuItemExtension = { ...item, pluginId }

  menuItems.set(id, ext)
  pluginManager.emit('extension:menu-added', ext)
  return id
}

export function unregisterMenuItem(id: string): void {
  const ext = menuItems.get(id)
  if (ext) {
    menuItems.delete(id)
    pluginManager.emit('extension:menu-removed', ext)
  }
}

export function getMenuItems(area?: ExtensionArea): MenuItemExtension[] {
  const all = Array.from(menuItems.values())
  const filtered = area ? all.filter((m) => m.area === area) : all
  return filtered.sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
}

export function getMenuItemsByPlugin(pluginId: string): MenuItemExtension[] {
  return Array.from(menuItems.values()).filter((m) => m.pluginId === pluginId)
}

export function cleanupPluginExtensions(pluginId: string): void {
  for (const [id, ext] of panels) {
    if (ext.pluginId === pluginId) {
      unregisterPanel(id)
    }
  }
  for (const [id, ext] of actions) {
    if (ext.pluginId === pluginId) {
      unregisterAction(id)
    }
  }
  for (const [id, ext] of menuItems) {
    if (ext.pluginId === pluginId) {
      unregisterMenuItem(id)
    }
  }
}

export function clearAllExtensions(): void {
  panels.clear()
  actions.clear()
  menuItems.clear()
}
