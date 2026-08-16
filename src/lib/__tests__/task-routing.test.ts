// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  TASK_ROUTING_KEY,
  getTaskRoutingConfig,
  getTaskRoutingProviders,
  getTaskSkillPrompt,
  resetTaskRoutingConfig,
  resolveMediaProviderForTask,
  resolveTextProviderForTask,
  saveTaskRoutingConfig,
} from '../ai/task-routing'
import { isEncryptedAiKey, decryptAiKey } from '../ai/ai-key-vault'
import type { AiProviderConfig } from '@editor/types/ai'

const activeProvider = (): AiProviderConfig => ({
  id: 'active',
  name: 'active',
  provider: 'openai',
  enabled: true,
  apiKey: 'k',
  model: 'm',
})

const legacyMedia = () => ({ type: 'wan' as const, apiKey: 'old', apiUrl: 'u', model: 'm' })

beforeEach(() => {
  localStorage.clear()
})

describe('getTaskRoutingConfig 智能默认', () => {
  it('无配置时返回全空槽默认', () => {
    const cfg = getTaskRoutingConfig()
    expect(cfg.version).toBe(1)
    expect(cfg.editor.providerId).toBeUndefined()
    expect(cfg.text.skillPrompt).toBeUndefined()
    expect(cfg.image.media).toBeUndefined()
    expect(cfg.video.media).toBeUndefined()
    expect(cfg.audio.media).toBeUndefined()
  })

  it('损坏 JSON 返回默认', () => {
    localStorage.setItem(TASK_ROUTING_KEY, '{bad json')
    expect(getTaskRoutingConfig().editor.providerId).toBeUndefined()
  })

  it('版本不匹配返回默认', () => {
    localStorage.setItem(TASK_ROUTING_KEY, JSON.stringify({ version: 99 }))
    expect(getTaskRoutingConfig().editor.providerId).toBeUndefined()
  })
})

describe('保存 / 读取往返', () => {
  it('saveTaskRoutingConfig 后可读回', async () => {
    await saveTaskRoutingConfig({
      version: 1,
      editor: { providerId: 'deepseek', skillPrompt: '你是专家', temperature: 0.3, maxTokens: 2048 },
      text: {},
      image: { media: { type: 'wan', apiKey: 'k', apiUrl: 'u', model: 'm' } },
      video: {},
      audio: {},
    })
    const cfg = getTaskRoutingConfig()
    expect(cfg.editor.providerId).toBe('deepseek')
    expect(cfg.editor.skillPrompt).toBe('你是专家')
    expect(cfg.editor.temperature).toBe(0.3)
    expect(cfg.editor.maxTokens).toBe(2048)
    expect(cfg.image.media?.type).toBe('wan')
    // 媒体槽 apiKey 落盘为密文
    expect(isEncryptedAiKey(cfg.image.media?.apiKey ?? '')).toBe(true)
  })

  it('resetTaskRoutingConfig 清空路由', async () => {
    await saveTaskRoutingConfig({ version: 1, editor: { providerId: 'x' }, text: {}, image: {}, video: {}, audio: {} })
    resetTaskRoutingConfig()
    expect(getTaskRoutingConfig().editor.providerId).toBeUndefined()
  })
})

describe('resolveTextProviderForTask', () => {
  it('空槽回退智能默认（第一个启用 provider）', () => {
    const p = resolveTextProviderForTask('editor', activeProvider)
    expect(p?.id).toBe('active')
  })

  it('路由指定 provider 命中', async () => {
    localStorage.setItem('subsilicon_ai_config', JSON.stringify({
      enabled: true,
      providers: [
        { id: 'a', name: 'A', provider: 'deepseek', enabled: true, apiKey: 'k', model: 'm' },
        { id: 'b', name: 'B', provider: 'openai', enabled: true, apiKey: 'k', model: 'm' },
      ],
    }))
    await saveTaskRoutingConfig({ version: 1, editor: { providerId: 'b' }, text: {}, image: {}, video: {}, audio: {} })
    const p = resolveTextProviderForTask('editor', activeProvider)
    expect(p?.id).toBe('b')
  })

  it('路由指定的 provider 不存在时回退智能默认', async () => {
    await saveTaskRoutingConfig({ version: 1, editor: { providerId: 'gone' }, text: {}, image: {}, video: {}, audio: {} })
    const p = resolveTextProviderForTask('editor', activeProvider)
    expect(p?.id).toBe('active')
  })
})

describe('resolveMediaProviderForTask', () => {
  it('image/video 未独立配置时回退旧版媒体配置', () => {
    expect(resolveMediaProviderForTask('image', legacyMedia)?.apiKey).toBe('old')
    expect(resolveMediaProviderForTask('video', legacyMedia)?.apiKey).toBe('old')
  })

  it('audio 无旧版回退，返回 null', () => {
    expect(resolveMediaProviderForTask('audio', legacyMedia)).toBeNull()
  })

  it('路由指定 media 优先于旧版（apiKey 落盘加密、可解密回原值）', async () => {
    await saveTaskRoutingConfig({
      version: 1,
      editor: {},
      text: {},
      image: { media: { type: 'custom', apiKey: 'new', apiUrl: 'u' } },
      video: {},
      audio: {},
    })
    const resolved = resolveMediaProviderForTask('image', legacyMedia)
    expect(resolved?.type).toBe('custom')
    // 存储为密文，非明文
    expect(isEncryptedAiKey(resolved?.apiKey ?? '')).toBe(true)
    expect(await decryptAiKey(resolved?.apiKey ?? '')).toBe('new')
  })
})

describe('getTaskSkillPrompt', () => {
  it('返回技能 prompt 并去除首尾空白', async () => {
    await saveTaskRoutingConfig({
      version: 1,
      editor: {},
      text: { skillPrompt: '  统一文风  ' },
      image: { skillPrompt: '3D 卡通' },
      video: {},
      audio: {},
    })
    expect(getTaskSkillPrompt('text')).toBe('统一文风')
    expect(getTaskSkillPrompt('image')).toBe('3D 卡通')
    expect(getTaskSkillPrompt('editor')).toBe('')
  })
})

describe('getTaskRoutingProviders', () => {
  it('多 provider 格式返回启用的 provider', () => {
    localStorage.setItem('subsilicon_ai_config', JSON.stringify({
      enabled: true,
      providers: [
        { id: 'a', name: 'A', provider: 'deepseek', enabled: true, apiKey: 'k', model: 'm' },
        { id: 'b', name: 'B', provider: 'openai', enabled: false, apiKey: 'k', model: 'm' },
      ],
    }))
    const list = getTaskRoutingProviders()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('a')
  })

  it('Flat 配置格式返回单个 provider', () => {
    localStorage.setItem('subsilicon_ai_config', JSON.stringify({ enabled: true, provider: 'deepseek', apiKey: 'k', apiUrl: 'u', model: 'm' }))
    const list = getTaskRoutingProviders()
    expect(list).toHaveLength(1)
    expect(list[0].provider).toBe('deepseek')
  })

  it('无配置返回空数组', () => {
    expect(getTaskRoutingProviders()).toEqual([])
  })
})
