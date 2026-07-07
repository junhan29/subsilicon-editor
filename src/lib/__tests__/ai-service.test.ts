import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getAiConfig,
  getActiveProvider,
  isAiAvailable,
  resetAiRegistry,
} from '../ai-service'
import type { AiConfig, AiProviderConfig } from '@editor/types/ai'

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

describe('ai-service - 配置相关', () => {
  beforeEach(() => {
    localStorageMock.clear()
    resetAiRegistry()
  })

  describe('getAiConfig', () => {
    it('没有配置时返回 null', () => {
      const result = getAiConfig()
      expect(result).toBeNull()
    })

    it('能正确读取保存的配置', () => {
      const config: AiConfig = {
        enabled: true,
        providers: [
          {
            id: 'test',
            name: 'Test',
            provider: 'deepseek',
            apiKey: 'test-key',
            apiUrl: 'https://api.test.com/v1',
            model: 'test-model',
            enabled: true,
          },
        ],
        defaultProvider: 'test',
        autoPolish: false,
        autoPolishStyle: 'general',
      }

      localStorageMock.setItem('subsilicon_ai_config', JSON.stringify(config))

      const result = getAiConfig()
      expect(result).toEqual(config)
      expect(result?.enabled).toBe(true)
      expect(result?.providers).toHaveLength(1)
    })

    it('配置损坏时返回 null', () => {
      localStorageMock.setItem('subsilicon_ai_config', 'invalid json')
      const result = getAiConfig()
      expect(result).toBeNull()
    })
  })

  describe('getActiveProvider', () => {
    it('没有配置时返回 null', () => {
      const result = getActiveProvider()
      expect(result).toBeNull()
    })

    it('AI 未启用时返回 null', () => {
      const config: AiConfig = {
        enabled: false,
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

      const result = getActiveProvider(config)
      expect(result).toBeNull()
    })

    it('返回第一个启用的 provider', () => {
      const providers: AiProviderConfig[] = [
        {
          id: 'p1',
          name: 'Provider 1',
          provider: 'deepseek',
          apiKey: 'key1',
          model: 'model1',
          enabled: false,
        },
        {
          id: 'p2',
          name: 'Provider 2',
          provider: 'openai',
          apiKey: 'key2',
          model: 'model2',
          enabled: true,
        },
      ]

      const config: AiConfig = {
        enabled: true,
        providers,
        defaultProvider: 'p2',
        autoPolish: false,
        autoPolishStyle: 'general',
      }

      const result = getActiveProvider(config)
      expect(result).toBeDefined()
      expect(result?.id).toBe('p2')
      expect(result?.apiKey).toBe('key2')
    })

    it('没有启用的 provider 时返回 null', () => {
      const config: AiConfig = {
        enabled: true,
        providers: [
          {
            id: 'p1',
            name: 'Provider 1',
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

      const result = getActiveProvider(config)
      expect(result).toBeNull()
    })
  })

  describe('isAiAvailable', () => {
    it('没有配置时返回 false', () => {
      const result = isAiAvailable()
      expect(result).toBe(false)
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

      const result = isAiAvailable()
      expect(result).toBe(true)
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

      const result = isAiAvailable()
      expect(result).toBe(false)
    })
  })
})
