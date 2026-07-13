import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadPlugin,
  unloadPlugin,
  isPluginLoaded,
  clearLoadedPlugins,
  validateModule,
} from '../plugins/plugin-loader'
import { pluginManager } from '../plugins/plugin-manager'
import {
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
  cleanupPluginExtensions,
  clearAllExtensions,
} from '../plugins/extension-points'
import type { PluginManifest, PluginModule } from '../plugins/types'

const manifest: PluginManifest = {
  id: 'test-ext',
  name: 'Test Extension',
  version: '1.0.0',
  description: 'test',
}

describe('Plugin Loader', () => {
  beforeEach(() => {
    clearLoadedPlugins()
    pluginManager.clear()
  })

  describe('loadPlugin (inline)', () => {
    it('能加载内联插件模块', async () => {
      const module: PluginModule = {
        activate: () => {},
        deactivate: () => {},
      }

      await loadPlugin({ type: 'inline', manifest, module })

      expect(isPluginLoaded('test-ext')).toBe(true)
      expect(pluginManager.listPlugins()).toHaveLength(1)
    })

    it('重复加载会报错', async () => {
      const module: PluginModule = {}
      await loadPlugin({ type: 'inline', manifest, module })

      await expect(loadPlugin({ type: 'inline', manifest, module })).rejects.toThrow(
        'already loaded'
      )
    })

    it('无效的 source 类型会报错', async () => {
      await expect(
        loadPlugin({ type: 'inline', manifest })
      ).rejects.toThrow('Invalid plugin source')
    })
  })

  describe('unloadPlugin', () => {
    it('能卸载已加载的插件', async () => {
      await loadPlugin({ type: 'inline', manifest, module: {} })
      expect(isPluginLoaded('test-ext')).toBe(true)

      unloadPlugin('test-ext')
      expect(isPluginLoaded('test-ext')).toBe(false)
    })

    it('卸载不存在的插件不会报错', () => {
      expect(() => unloadPlugin('nonexistent')).not.toThrow()
    })
  })

  describe('validateModule', () => {
    it('有效模块通过验证', () => {
      expect(() => validateModule({ activate: () => {} }, manifest)).not.toThrow()
      expect(() => validateModule({}, manifest)).not.toThrow()
    })

    it('非对象模块报错', () => {
      expect(() => validateModule(null, manifest)).toThrow('not an object')
      expect(() => validateModule('string', manifest)).toThrow('not an object')
    })

    it('activate 不是函数报错', () => {
      expect(() => validateModule({ activate: 'not-fn' }, manifest)).toThrow(
        'activate must be a function'
      )
    })

    it('deactivate 不是函数报错', () => {
      expect(() => validateModule({ deactivate: 123 }, manifest)).toThrow(
        'deactivate must be a function'
      )
    })
  })
})

describe('Extension Points', () => {
  beforeEach(() => {
    clearLoadedPlugins()
    pluginManager.clear()
    clearAllExtensions()
  })

  describe('panels', () => {
    it('能注册和获取面板', () => {
      const Comp = () => null
      registerPanel('plugin1', { id: 'panel1', label: 'Panel 1', component: Comp })

      const panels = getPanels()
      expect(panels).toHaveLength(1)
      expect(panels[0].label).toBe('Panel 1')
    })

    it('按 order 排序', () => {
      registerPanel('p1', { id: 'b', label: 'B', component: () => null, order: 2 })
      registerPanel('p1', { id: 'a', label: 'A', component: () => null, order: 1 })

      const panels = getPanels()
      expect(panels[0].label).toBe('A')
      expect(panels[1].label).toBe('B')
    })

    it('按插件过滤面板', () => {
      registerPanel('p1', { id: 'a', label: 'A', component: () => null })
      registerPanel('p2', { id: 'b', label: 'B', component: () => null })

      expect(getPanelsByPlugin('p1')).toHaveLength(1)
      expect(getPanelsByPlugin('p2')).toHaveLength(1)
    })

    it('能注销面板', () => {
      const id = registerPanel('p1', { id: 'a', label: 'A', component: () => null })
      unregisterPanel(id)
      expect(getPanels()).toHaveLength(0)
    })
  })

  describe('actions', () => {
    it('能注册和执行动作', () => {
      let called = false
      registerAction('p1', { id: 'act1', label: 'Action 1', handler: () => { called = true } })

      const actions = getActions()
      expect(actions).toHaveLength(1)

      pluginManager.executeCommand('p1:act1')
      expect(called).toBe(true)
    })

    it('能按插件过滤', () => {
      registerAction('p1', { id: 'a', label: 'A', handler: () => {} })
      registerAction('p2', { id: 'b', label: 'B', handler: () => {} })

      expect(getActionsByPlugin('p1')).toHaveLength(1)
    })

    it('注销动作同时移除命令', () => {
      const id = registerAction('p1', { id: 'a', label: 'A', handler: () => {} })
      unregisterAction(id)
      expect(getActions()).toHaveLength(0)
      expect(pluginManager.executeCommand('p1:a')).toBe(false)
    })
  })

  describe('menu items', () => {
    it('能注册菜单项并按区域过滤', () => {
      registerMenuItem('p1', {
        id: 'm1',
        label: 'Menu 1',
        handler: () => {},
        area: 'node-menu',
      })
      registerMenuItem('p1', {
        id: 'm2',
        label: 'Menu 2',
        handler: () => {},
        area: 'canvas-menu',
      })

      expect(getMenuItems()).toHaveLength(2)
      expect(getMenuItems('node-menu')).toHaveLength(1)
      expect(getMenuItems('canvas-menu')).toHaveLength(1)
    })

    it('能注销菜单项', () => {
      const id = registerMenuItem('p1', {
        id: 'm1',
        label: 'M1',
        handler: () => {},
        area: 'toolbar',
      })
      unregisterMenuItem(id)
      expect(getMenuItems()).toHaveLength(0)
    })
  })

  describe('cleanupPluginExtensions', () => {
    it('清理指定插件的所有扩展', () => {
      registerPanel('p1', { id: 'panel', label: 'P', component: () => null })
      registerAction('p1', { id: 'act', label: 'A', handler: () => {} })
      registerMenuItem('p1', { id: 'm', label: 'M', handler: () => {}, area: 'toolbar' })

      registerPanel('p2', { id: 'panel', label: 'P2', component: () => null })

      cleanupPluginExtensions('p1')

      expect(getPanels()).toHaveLength(1)
      expect(getActions()).toHaveLength(0)
      expect(getMenuItems()).toHaveLength(0)
    })
  })
})
