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
  type MediaProviderConfig,
} from '../ai/services/media-generation-service'
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
