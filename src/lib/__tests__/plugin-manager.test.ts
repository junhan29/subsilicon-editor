import { describe, it, expect, beforeEach } from 'vitest'
import { PluginManager } from '../plugins/plugin-manager'
import type { PluginManifest, PluginModule } from '../plugins/types'

describe('PluginManager', () => {
  let manager: PluginManager

  const testManifest: PluginManifest = {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin',
  }

  beforeEach(() => {
    manager = new PluginManager()
  })

  describe('register / unregister', () => {
    it('能注册插件', () => {
      const module: PluginModule = {}
      manager.register(testManifest, module)

      const plugins = manager.listPlugins()
      expect(plugins).toHaveLength(1)
      expect(plugins[0].manifest.id).toBe('test-plugin')
      expect(plugins[0].status).toBe('inactive')
    })

    it('重复注册相同 ID 会报错', () => {
      manager.register(testManifest, {})
      expect(() => manager.register(testManifest, {})).toThrow('already registered')
    })

    it('能注销插件', () => {
      manager.register(testManifest, {})
      manager.unregister('test-plugin')
      expect(manager.listPlugins()).toHaveLength(0)
    })

    it('注销不存在的插件不会报错', () => {
      expect(() => manager.unregister('nonexistent')).not.toThrow()
    })
  })

  describe('activate / deactivate', () => {
    it('能激活插件并调用 activate', async () => {
      let activated = false
      const module: PluginModule = {
        activate: () => {
          activated = true
        },
      }

      manager.register(testManifest, module)
      await manager.activate('test-plugin')

      expect(activated).toBe(true)
      expect(manager.getStatus('test-plugin')).toBe('active')
    })

    it('activate 失败时状态为 error', async () => {
      const module: PluginModule = {
        activate: () => {
          throw new Error('activation failed')
        },
      }

      manager.register(testManifest, module)

      await expect(manager.activate('test-plugin')).rejects.toThrow('activation failed')
      expect(manager.getStatus('test-plugin')).toBe('error')
    })

    it('能停用插件并调用 deactivate', async () => {
      let deactivated = false
      const module: PluginModule = {
        activate: () => {},
        deactivate: () => {
          deactivated = true
        },
      }

      manager.register(testManifest, module)
      await manager.activate('test-plugin')
      await manager.deactivate('test-plugin')

      expect(deactivated).toBe(true)
      expect(manager.getStatus('test-plugin')).toBe('inactive')
    })

    it('激活不存在的插件会报错', async () => {
      await expect(manager.activate('nonexistent')).rejects.toThrow('not found')
    })

    it('重复激活不会重复调用 activate', async () => {
      let count = 0
      const module: PluginModule = {
        activate: () => {
          count++
        },
      }

      manager.register(testManifest, module)
      await manager.activate('test-plugin')
      await manager.activate('test-plugin')

      expect(count).toBe(1)
    })
  })

  describe('hooks', () => {
    it('能注册和触发 hook', async () => {
      const results: string[] = []

      manager.registerHook('beforeNodeCreate', (node) => {
        results.push(`hook1-${node.type}`)
      })

      manager.registerHook('beforeNodeCreate', (node) => {
        results.push(`hook2-${node.type}`)
      })

      await manager.triggerHook('beforeNodeCreate', { type: 'dialogue' })

      expect(results).toEqual(['hook1-dialogue', 'hook2-dialogue'])
    })

    it('能注销 hook', async () => {
      const results: string[] = []
      const handler = () => results.push('called')

      manager.registerHook('afterNodeCreate', handler)
      await manager.triggerHook('afterNodeCreate')
      expect(results).toEqual(['called'])

      manager.unregisterHook('afterNodeCreate', handler)
      results.length = 0
      await manager.triggerHook('afterNodeCreate')
      expect(results).toEqual([])
    })

    it('hook 处理错误不影响其他 hook', async () => {
      const results: string[] = []

      manager.registerHook('beforeExport', () => {
        throw new Error('boom')
      })
      manager.registerHook('beforeExport', () => {
        results.push('ok')
      })

      await manager.triggerHook('beforeExport')
      expect(results).toEqual(['ok'])
    })

    it('触发没有注册的 hook 返回空数组', async () => {
      const results = await manager.triggerHook('nonexistent' as any)
      expect(results).toEqual([])
    })
  })

  describe('commands', () => {
    it('能添加和执行命令', () => {
      let called = false
      manager.addCommand('test.cmd', () => {
        called = true
      })

      const result = manager.executeCommand('test.cmd')
      expect(result).toBe(true)
      expect(called).toBe(true)
    })

    it('执行不存在的命令返回 false', () => {
      expect(manager.executeCommand('nonexistent')).toBe(false)
    })

    it('能列出命令', () => {
      manager.addCommand('cmd1', () => {}, 'Command 1')
      manager.addCommand('cmd2', () => {}, 'Command 2')

      const commands = manager.listCommands()
      expect(commands).toHaveLength(2)
      expect(commands.map((c) => c.id).sort()).toEqual(['cmd1', 'cmd2'])
    })

    it('能移除命令', () => {
      manager.addCommand('test.cmd', () => {})
      manager.removeCommand('test.cmd')
      expect(manager.executeCommand('test.cmd')).toBe(false)
    })

    it('插件命令自动加前缀', async () => {
      let called = false
      const module: PluginModule = {
        activate: (ctx) => {
          ctx.api.addCommand('hello', () => {
            called = true
          }, 'Hello Command')
        },
      }

      manager.register(testManifest, module)
      await manager.activate('test-plugin')

      expect(manager.executeCommand('test-plugin:hello')).toBe(true)
      expect(called).toBe(true)
    })

    it('停用插件时自动清理其命令', async () => {
      const module: PluginModule = {
        activate: (ctx) => {
          ctx.api.addCommand('cmd1', () => {})
          ctx.api.addCommand('cmd2', () => {})
        },
      }

      manager.register(testManifest, module)
      await manager.activate('test-plugin')
      expect(manager.listCommands().length).toBeGreaterThanOrEqual(2)

      await manager.deactivate('test-plugin')

      const commands = manager.listCommands()
      expect(commands.filter((c) => c.id.startsWith('test-plugin:'))).toHaveLength(0)
    })
  })

  describe('events', () => {
    it('能订阅和触发事件', () => {
      const received: any[] = []

      manager.on('custom-event', (data) => {
        received.push(data)
      })

      manager.emit('custom-event', { foo: 'bar' })
      expect(received).toEqual([{ foo: 'bar' }])
    })

    it('能取消订阅', () => {
      let count = 0
      const handler = () => count++

      manager.on('event', handler)
      manager.emit('event')
      expect(count).toBe(1)

      manager.off('event', handler)
      manager.emit('event')
      expect(count).toBe(1)
    })
  })

  describe('storage', () => {
    it('插件沙箱存储相互隔离', async () => {
      let storage1: any
      let storage2: any

      const module1: PluginModule = {
        activate: (ctx) => {
          storage1 = ctx.api.getStorage('data')
        },
      }
      const module2: PluginModule = {
        activate: (ctx) => {
          storage2 = ctx.api.getStorage('data')
        },
      }

      manager.register({ ...testManifest, id: 'plugin1' }, module1)
      manager.register({ ...testManifest, id: 'plugin2' }, module2)

      await manager.activate('plugin1')
      await manager.activate('plugin2')

      await storage1.set('key', 'value1')
      await storage2.set('key', 'value2')

      expect(await storage1.get('key')).toBe('value1')
      expect(await storage2.get('key')).toBe('value2')
    })

    it('能列出存储的键', async () => {
      let storage: any

      const module: PluginModule = {
        activate: (ctx) => {
          storage = ctx.api.getStorage('test')
        },
      }

      manager.register(testManifest, module)
      await manager.activate('test-plugin')

      await storage.set('a', 1)
      await storage.set('b', 2)
      await storage.set('c', 3)

      const keys = await storage.keys()
      expect(keys).toHaveLength(3)
      expect(keys.sort()).toEqual(['a', 'b', 'c'])
    })

    it('能清除存储', async () => {
      let storage: any

      const module: PluginModule = {
        activate: (ctx) => {
          storage = ctx.api.getStorage('test')
        },
      }

      manager.register(testManifest, module)
      await manager.activate('test-plugin')

      await storage.set('a', 1)
      await storage.set('b', 2)
      await storage.clear()

      expect(await storage.keys()).toEqual([])
    })
  })

  describe('state', () => {
    it('能读写全局状态', () => {
      manager.setState('counter', 42)
      const state = manager.getState()
      expect(state.counter).toBe(42)
    })

    it('getState 返回的是顶层副本', () => {
      manager.setState('obj', { a: 1 })
      const state = manager.getState() as any
      state.newProp = 'added'

      const state2 = manager.getState() as any
      expect(state2.newProp).toBeUndefined()
    })
  })

  describe('deactivateAll / clear', () => {
    it('能停用所有插件', async () => {
      let deactivated = 0

      manager.register(
        { ...testManifest, id: 'p1' },
        { activate: () => {}, deactivate: () => { deactivated++ } }
      )
      manager.register(
        { ...testManifest, id: 'p2' },
        { activate: () => {}, deactivate: () => { deactivated++ } }
      )

      await manager.activate('p1')
      await manager.activate('p2')

      await manager.deactivateAll()

      expect(deactivated).toBe(2)
      expect(manager.getStatus('p1')).toBe('inactive')
      expect(manager.getStatus('p2')).toBe('inactive')
    })

    it('clear 能清空所有数据', async () => {
      manager.register(testManifest, {})
      manager.addCommand('cmd', () => {})
      manager.registerHook('beforeNodeCreate', () => {})
      manager.setState('key', 'value')

      manager.clear()

      expect(manager.listPlugins()).toHaveLength(0)
      expect(manager.listCommands()).toHaveLength(0)
      expect(Object.keys(manager.getState())).toHaveLength(0)
    })
  })
})
