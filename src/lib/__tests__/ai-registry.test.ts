import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getAiConfig,
  getActiveProvider,
  isAiAvailable,
  getAvailableProviders,
  resetAiRegistry,
  refreshAiConfig,
} from '../ai'
import type { AiConfig } from '@editor/types/ai'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
})

vi.mock('../local-ai-service', () => ({
  isOllamaAvailable: vi.fn().mockResolvedValue(false),
  generateCompletion: vi.fn(),
  listModels: vi.fn(),
  setOllamaConfig: vi.fn(),
  getOllamaConfig: vi.fn(),
}))

describe('AI Provider Registry', () => {
  beforeEach(() => {
    localStorageMock.clear()
    resetAiRegistry()
  })

  describe('getAiConfig', () => {
    it('没有配置时返回 null', () => {
      expect(getAiConfig()).toBeNull()
    })

    it('读取配置后缓存结果', () => {
      const config: AiConfig = {
        enabled: true,
        providers: [
          {
            id: 'test',
            name: 'Test',
            provider: 'deepseek',
            apiKey: 'key1',
            model: 'model1',
            enabled: true,
          },
        ],
        defaultProvider: 'test',
        autoPolish: false,
        autoPolishStyle: 'general',
      }

      localStorageMock.setItem('subsilicon_ai_config', JSON.stringify(config))

      const result1 = getAiConfig()
      expect(result1).toEqual(config)

      localStorageMock.removeItem('subsilicon_ai_config')

      const result2 = getAiConfig()
      expect(result2).toEqual(config)
    })
  })

  describe('getActiveProvider', () => {
    it('没有配置时返回 null', () => {
      expect(getActiveProvider()).toBeNull()
    })

    it('AI 未启用时返回 null', () => {
      const config: AiConfig = {
        enabled: false,
        providers: [
          {
            id: 'p1',
            name: 'P1',
            provider: 'deepseek',
            apiKey: 'key',
            model: 'model',
            enabled: true,
          },
        ],
        defaultProvider: 'p1',
        autoPolish: false,
        autoPolishStyle: 'general',
      }

      expect(getActiveProvider(config)).toBeNull()
    })

    it('返回第一个启用的 provider', () => {
      const config: AiConfig = {
        enabled: true,
        providers: [
          {
            id: 'p1',
            name: 'P1',
            provider: 'deepseek',
            apiKey: 'key1',
            model: 'model1',
            enabled: false,
          },
          {
            id: 'p2',
            name: 'P2',
            provider: 'openai',
            apiKey: 'key2',
            model: 'model2',
            enabled: true,
          },
        ],
        defaultProvider: 'p2',
        autoPolish: false,
        autoPolishStyle: 'general',
      }

      const result = getActiveProvider(config)
      expect(result).toBeDefined()
      expect(result?.id).toBe('p2')
    })

    it('没有启用的 provider 时返回 null', () => {
      const config: AiConfig = {
        enabled: true,
        providers: [
          {
            id: 'p1',
            name: 'P1',
            provider: 'deepseek',
            apiKey: 'key1',
            model: 'model1',
            enabled: false,
          },
        ],
        defaultProvider: 'p1',
        autoPolish: false,
        autoPolishStyle: 'general',
      }

      expect(getActiveProvider(config)).toBeNull()
    })

    it('接受 null 参数', () => {
      expect(getActiveProvider(null)).toBeNull()
    })
  })

  describe('isAiAvailable', () => {
    it('没有配置时返回 false', () => {
      expect(isAiAvailable()).toBe(false)
    })

    it('有启用的 provider 且有 apiKey 时返回 true', () => {
      const config: AiConfig = {
        enabled: true,
        providers: [
          {
            id: 'test',
            name: 'Test',
            provider: 'deepseek',
            apiKey: 'test-key',
            model: 'test-model',
            enabled: true,
          },
        ],
        defaultProvider: 'test',
        autoPolish: false,
        autoPolishStyle: 'general',
      }

      localStorageMock.setItem('subsilicon_ai_config', JSON.stringify(config))
      resetAiRegistry()

      expect(isAiAvailable()).toBe(true)
    })

    it('provider 没有 apiKey 时返回 false', () => {
      const config: AiConfig = {
        enabled: true,
        providers: [
          {
            id: 'test',
            name: 'Test',
            provider: 'deepseek',
            apiKey: '',
            model: 'test-model',
            enabled: true,
          },
        ],
        defaultProvider: 'test',
        autoPolish: false,
        autoPolishStyle: 'general',
      }

      localStorageMock.setItem('subsilicon_ai_config', JSON.stringify(config))
      resetAiRegistry()

      expect(isAiAvailable()).toBe(false)
    })
  })

  describe('getAvailableProviders', () => {
    it('没有配置时也返回 Ollama provider', () => {
      const providers = getAvailableProviders()
      expect(providers.length).toBeGreaterThanOrEqual(1)
      expect(providers.some((p) => p.id === 'ollama-local')).toBe(true)
    })

    it('有配置时包含远程 provider', () => {
      const config: AiConfig = {
        enabled: true,
        providers: [
          {
            id: 'test',
            name: 'Test Provider',
            provider: 'deepseek',
            apiKey: 'key1',
            model: 'model1',
            enabled: true,
          },
        ],
        defaultProvider: 'test',
        autoPolish: false,
        autoPolishStyle: 'general',
      }

      localStorageMock.setItem('subsilicon_ai_config', JSON.stringify(config))
      resetAiRegistry()

      const providers = getAvailableProviders()
      expect(providers.length).toBeGreaterThanOrEqual(2)
      expect(providers.some((p) => p.id === 'test')).toBe(true)
      expect(providers.some((p) => p.id === 'ollama-local')).toBe(true)
    })
  })

  describe('refreshAiConfig', () => {
    it('刷新配置后能读取新值', () => {
      const config1: AiConfig = {
        enabled: true,
        providers: [
          {
            id: 'p1',
            name: 'P1',
            provider: 'deepseek',
            apiKey: 'key1',
            model: 'model1',
            enabled: true,
          },
        ],
        defaultProvider: 'p1',
        autoPolish: false,
        autoPolishStyle: 'general',
      }

      localStorageMock.setItem('subsilicon_ai_config', JSON.stringify(config1))
      const result1 = getAiConfig()
      expect(result1?.providers[0].apiKey).toBe('key1')

      const config2: AiConfig = {
        ...config1,
        providers: [
          {
            ...config1.providers[0],
            apiKey: 'key2',
          },
        ],
      }
      localStorageMock.setItem('subsilicon_ai_config', JSON.stringify(config2))

      refreshAiConfig()

      const result2 = getAiConfig()
      expect(result2?.providers[0].apiKey).toBe('key2')
    })
  })

  describe('resetAiRegistry', () => {
    it('重置后重新读取配置', () => {
      const config: AiConfig = {
        enabled: true,
        providers: [
          {
            id: 'test',
            name: 'Test',
            provider: 'deepseek',
            apiKey: 'key1',
            model: 'model1',
            enabled: true,
          },
        ],
        defaultProvider: 'test',
        autoPolish: false,
        autoPolishStyle: 'general',
      }

      localStorageMock.setItem('subsilicon_ai_config', JSON.stringify(config))
      expect(getAiConfig()).not.toBeNull()

      localStorageMock.clear()
      resetAiRegistry()

      expect(getAiConfig()).toBeNull()
    })
  })
})
