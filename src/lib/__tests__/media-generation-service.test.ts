// @vitest-environment happy-dom
/**
 * 媒体生成服务独立测试：覆盖 OpenAI / Stability / Wan(OpenAI 兼容) 的
 * image / video / audio 分支，以及「API Key 落盘加密 → 生成时解密」的
 * 完整加密链路（验证请求头携带的是明文 Key）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { webcrypto } from 'node:crypto'

// Mock local-db 避免 IndexedDB 依赖
vi.mock('../local-db', () => ({
  getAsset: vi.fn().mockResolvedValue(null),
}))

import {
  generateMedia,
  generateAudio,
  generateMediaForTask,
  validateMediaResult,
  blobToDataURL,
  getGlobalStylePrompt,
  saveGlobalStylePrompt,
  saveMediaProviderConfig,
  type MediaProviderConfig,
} from '../ai/services/media-generation-service'
import { saveTaskRoutingConfig } from '../ai/task-routing'
import { encryptAiKey } from '../ai/ai-key-vault'

// happy-dom 可能缺 WebCrypto：补 node webcrypto，保证 AES 加解密可用
if (typeof globalThis.crypto?.subtle === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
}
// 补 URL.createObjectURL（Stability 分支需要；node 环境缺失）
if (typeof URL.createObjectURL !== 'function') {
  Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:mock-url', configurable: true })
}
if (typeof URL.revokeObjectURL !== 'function') {
  Object.defineProperty(URL, 'revokeObjectURL', { value: () => {}, configurable: true })
}

function mockResponse(data: unknown, opts: { ok?: boolean; status?: number; blob?: Blob } = {}) {
  const ok = opts.ok ?? true
  const status = opts.status ?? 200
  const text = data == null ? '' : typeof data === 'string' ? data : JSON.stringify(data)
  return {
    ok,
    status,
    text: () => Promise.resolve(text),
    json: () => Promise.resolve(typeof data === 'string' ? JSON.parse(data) : data),
    blob: () => Promise.resolve(opts.blob || new Blob([text])),
  }
}

const mockFetch = vi.fn()

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mockFetch.mockImplementation(async (url: string) => {
    if (url.includes('images/generations')) {
      return mockResponse({ data: [{ url: 'https://img.example.com/out.png' }] })
    }
    if (url.includes('videos/generations')) {
      return mockResponse({ data: [{ url: 'https://video.example.com/out.mp4' }] })
    }
    if (url.includes('audio/speech')) {
      return mockResponse(null, { blob: new Blob(['audio-bytes'], { type: 'audio/mpeg' }) })
    }
    if (url.includes('stability.ai')) {
      return mockResponse(null, { blob: new Blob(['img-bytes'], { type: 'image/webp' }) })
    }
    return mockResponse({ error: { message: 'unexpected url' } }, { ok: false, status: 500 })
  })
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const openaiProvider: MediaProviderConfig = { type: 'openai', apiKey: 'sk-openai-test', model: 'dall-e-3' }
const stabilityProvider: MediaProviderConfig = { type: 'stability', apiKey: 'sk-stability-test' }
const wanProvider: MediaProviderConfig = { type: 'wan', apiKey: 'sk-wan-test', apiUrl: 'https://dashscope.example.com/compatible-mode/v1', model: 'wanx2.1-t2i-turbo' }

describe('generateMedia（image）', () => {
  it('openai 图片生成：请求带明文 Authorization', async () => {
    const res = await generateMedia({ prompt: 'a cat' }, openaiProvider)
    expect(res.type).toBe('image')
    expect(res.url).toBe('https://img.example.com/out.png')
    const init = mockFetch.mock.calls[0][1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer sk-openai-test')
  })

  it('加密 Key 落盘后仍可正确解密请求（完整加密链路）', async () => {
    const encKey = await encryptAiKey('sk-secret-encrypted')
    expect(encKey).not.toContain('sk-secret-encrypted')
    const res = await generateMedia({ prompt: 'a dog' }, { ...openaiProvider, apiKey: encKey })
    expect(res.type).toBe('image')
    const init = mockFetch.mock.calls[0][1] as RequestInit
    const headers = init.headers as Record<string, string>
    // 解密后请求头携带明文 Key
    expect(headers.Authorization).toBe('Bearer sk-secret-encrypted')
  })

  it('stability 图片生成：返回 blob URL 与 cleanup', async () => {
    const res = await generateMedia({ prompt: 'a tree' }, stabilityProvider)
    expect(res.type).toBe('image')
    expect(res.url).toContain('blob:')
    expect(typeof res.cleanup).toBe('function')
  })

  it('wan 图片生成（OpenAI 兼容）', async () => {
    const res = await generateMedia({ prompt: 'a mountain' }, wanProvider)
    expect(res.type).toBe('image')
    expect(res.url).toBe('https://img.example.com/out.png')
  })
})

describe('generateMedia（video）', () => {
  it('视频仅支持 wan/custom：openai 抛错', async () => {
    await expect(
      generateMedia({ prompt: 'a clip', duration: 5 }, openaiProvider)
    ).rejects.toThrow('视频生成仅支持 wan/custom')
  })

  it('wan 视频生成（同步返回 url）', async () => {
    const res = await generateMedia({ prompt: 'a clip', duration: 5 }, wanProvider)
    expect(res.type).toBe('video')
    expect(res.url).toBe('https://video.example.com/out.mp4')
  })
})

describe('generateAudio', () => {
  it('wan 音频生成：返回 audio blob URL', async () => {
    const res = await generateAudio({ prompt: 'rainy night' }, wanProvider)
    expect(res.type).toBe('audio')
    expect(res.url).toContain('blob:')
  })

  it('comfyui 不支持音频：抛明确错误', async () => {
    await expect(
      generateAudio({ prompt: 'x' }, { type: 'comfyui', apiKey: '' })
    ).rejects.toThrow('ComfyUI 不支持音频生成')
  })

  it('wan 缺 apiUrl/apiKey 抛明确错误', async () => {
    await expect(
      generateAudio({ prompt: 'x' }, { type: 'wan', apiKey: '', apiUrl: '' })
    ).rejects.toThrow('需要配置 apiUrl 和 apiKey')
  })
})

describe('generateMediaForTask（任务路由）', () => {
  it('未配置服务商时给出明确提示', async () => {
    await expect(
      generateMediaForTask('image', { prompt: 'x' })
    ).rejects.toThrow('未配置图片生成服务商')
  })
})

describe('媒体配置回退链（任务槽优先，旧全局配置回退）', () => {
  it('任务槽有配置时优先使用槽配置（忽略旧全局配置）', async () => {
    // 旧全局配置存在但不该被使用
    await saveMediaProviderConfig(wanProvider)
    // image 槽配置了 openai（与旧全局 wan 不同）
    await saveTaskRoutingConfig({
      version: 1,
      editor: {},
      text: {},
      image: { media: openaiProvider },
      video: {},
      audio: {},
    })
    const res = await generateMediaForTask('image', { prompt: 'a cat' })
    expect(res.type).toBe('image')
    const init = mockFetch.mock.calls[0][1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer sk-openai-test')
  })

  it('任务槽无配置时回退旧全局配置', async () => {
    await saveMediaProviderConfig(wanProvider)
    const res = await generateMediaForTask('image', { prompt: 'a cat' })
    expect(res.type).toBe('image')
    const init = mockFetch.mock.calls[0][1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer sk-wan-test')
  })

  it('video 槽无配置时回退旧全局配置', async () => {
    await saveMediaProviderConfig(wanProvider)
    const res = await generateMediaForTask('video', { prompt: 'a clip', duration: 5 })
    expect(res.type).toBe('video')
    const init = mockFetch.mock.calls[0][1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer sk-wan-test')
  })

  it('audio 槽无配置时不回退旧全局配置（audio 无旧配置，需独立配置）', async () => {
    await saveMediaProviderConfig(wanProvider)
    await expect(
      generateMediaForTask('audio', { prompt: 'x' })
    ).rejects.toThrow('未配置音乐/音效生成服务商')
  })

  it('槽与旧全局均无配置时保持现状报错', async () => {
    await expect(
      generateMediaForTask('image', { prompt: 'x' })
    ).rejects.toThrow('未配置图片生成服务商')
  })
})

describe('seed 支持', () => {
  it('wan 图片生成请求携带 seed', async () => {
    await generateMedia({ prompt: 'a cat', seed: 42 }, wanProvider)
    const init = mockFetch.mock.calls[0][1] as RequestInit
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body.seed).toBe(42)
  })

  it('未传 seed 时不携带 seed 字段', async () => {
    await generateMedia({ prompt: 'a cat' }, wanProvider)
    const init = mockFetch.mock.calls[0][1] as RequestInit
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect('seed' in body).toBe(false)
  })

  it('wan 视频生成请求携带 seed', async () => {
    await generateMedia({ prompt: 'a clip', duration: 5, seed: 7 }, wanProvider)
    const init = mockFetch.mock.calls[0][1] as RequestInit
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body.seed).toBe(7)
  })
})

describe('参考图云端注入（wan/custom 图生图）', () => {
  it('有参考图时 body 携带 image（base64 data URL）', async () => {
    const { getAsset } = await import('../local-db')
    vi.mocked(getAsset).mockResolvedValueOnce({
      hash: 'abc',
      name: 'ref.png',
      type: 'image/png',
      size: 10,
      blob: new Blob(['fake-img'], { type: 'image/png' }),
      createdAt: 1,
    } as never)
    await generateMedia({ prompt: 'a cat', referenceImageHash: 'abc' }, wanProvider)
    const init = mockFetch.mock.calls[0][1] as RequestInit
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body.image).toContain('data:image/png;base64,')
  })

  it('服务商不支持 image 参数（400）时回退纯 prompt 重试', async () => {
    const { getAsset } = await import('../local-db')
    vi.mocked(getAsset).mockResolvedValueOnce({
      hash: 'abc',
      name: 'ref.png',
      type: 'image/png',
      size: 10,
      blob: new Blob(['fake-img'], { type: 'image/png' }),
      createdAt: 1,
    } as never)
    mockFetch
      .mockResolvedValueOnce(mockResponse({ error: { message: 'image not supported' } }, { ok: false, status: 400 }))
      .mockResolvedValueOnce(mockResponse({ data: [{ url: 'https://img.example.com/retry.png' }] }))
    const res = await generateMedia({ prompt: 'a cat', referenceImageHash: 'abc' }, wanProvider)
    expect(res.url).toBe('https://img.example.com/retry.png')
    const init2 = mockFetch.mock.calls[1][1] as RequestInit
    const body2 = JSON.parse(String(init2.body)) as Record<string, unknown>
    expect('image' in body2).toBe(false)
  })

  it('无参考图时不携带 image 字段', async () => {
    await generateMedia({ prompt: 'a cat' }, wanProvider)
    const init = mockFetch.mock.calls[0][1] as RequestInit
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect('image' in body).toBe(false)
  })
})

describe('validateMediaResult / blobToDataURL / 全局画面风格', () => {
  it('url 为空时抛可读错误', () => {
    expect(() => validateMediaResult({ url: '', type: 'image', prompt: 'x' })).toThrow('生成结果为空')
  })

  it('url 格式异常时抛错', () => {
    expect(() => validateMediaResult({ url: 'not-a-url', type: 'image', prompt: 'x' })).toThrow('地址格式异常')
  })

  it('blobToDataURL 返回 base64 data URL', async () => {
    const url = await blobToDataURL(new Blob(['hi'], { type: 'text/plain' }))
    expect(url).toContain('data:text/plain;base64,')
  })

  it('全局画面风格存取', () => {
    expect(getGlobalStylePrompt()).toBe('')
    saveGlobalStylePrompt('赛博朋克城市夜景')
    expect(getGlobalStylePrompt()).toBe('赛博朋克城市夜景')
    saveGlobalStylePrompt('')
    expect(getGlobalStylePrompt()).toBe('')
  })
})
