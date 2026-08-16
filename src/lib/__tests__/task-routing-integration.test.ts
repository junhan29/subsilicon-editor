// @vitest-environment happy-dom
/**
 * 集成测试：验证 P1 功能（ComfyUI 工作流 + 技能模板库）已集成到主路由层，
 * 且多模型自动切换流程端到端正确。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock local-db 避免 IndexedDB 依赖
vi.mock('../local-db', () => ({
  getAsset: vi.fn().mockResolvedValue({ blob: new Blob(['fake-image-data']) }),
}))

import {
  callAiForTask,
  generateMediaForTask,
  resetAiRegistry,
  saveTaskRoutingConfig,
  getSkillTemplate,
} from '../ai'
import type { AiProviderConfig, AiTaskRoutingConfig, MediaProviderConfig } from '../ai'

// ---------- 工具函数 ----------

const realSetTimeout = globalThis.setTimeout

/** 创建 mock fetch 响应 */
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

/** 设置 AI 服务商配置到 localStorage */
function setupAiConfig(providers: AiProviderConfig[]) {
  localStorage.setItem('subsilicon_ai_config', JSON.stringify({ enabled: true, providers }))
}

/** 设置路由配置 */
function setupRouting(routing: AiTaskRoutingConfig) {
  saveTaskRoutingConfig(routing)
}

/** OpenAI 兼容 chat completions 响应 */
function chatResponse(content: string) {
  return mockResponse({ choices: [{ message: { content } }] })
}

/** 最小 ComfyUI 工作流（含 LoadImage + positive/negative CLIPTextEncode） */
const SIMPLE_WORKFLOW = JSON.stringify({
  '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'model.safetensors' } },
  '6': { class_type: 'CLIPTextEncode', inputs: { text: 'placeholder', clip: ['4', 1] }, _meta: { title: 'positive' } },
  '7': { class_type: 'CLIPTextEncode', inputs: { text: 'bad', clip: ['4', 1] }, _meta: { title: 'negative' } },
  '9': { class_type: 'SaveImage', inputs: { images: ['8', 0] } },
  '11': { class_type: 'LoadImage', inputs: { image: 'placeholder.png' } },
})

const mockFetch = vi.fn()

// ---------- 公共 setup ----------

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  resetAiRegistry()
  // ComfyUI 轮询有 1s setTimeout，改为 0ms 加速测试
  globalThis.setTimeout = ((fn: () => void, _ms?: number) => realSetTimeout(fn, 0)) as typeof setTimeout
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  globalThis.setTimeout = realSetTimeout
})

// ---------- 多模型文本路由 ----------

describe('多模型文本路由', () => {
  it('editor 槽和 text 槽分别路由到不同 provider', async () => {
    setupAiConfig([
      { id: 'editor-m', name: 'Editor', provider: 'deepseek', enabled: true, apiKey: 'key-a', apiUrl: 'https://api.a.com/v1', model: 'model-a' },
      { id: 'text-m', name: 'Text', provider: 'openai', enabled: true, apiKey: 'key-b', apiUrl: 'https://api.b.com/v1', model: 'model-b' },
    ])
    setupRouting({
      version: 1,
      editor: { providerId: 'editor-m' },
      text: { providerId: 'text-m' },
      image: {}, video: {}, audio: {},
    })

    mockFetch.mockImplementation((url: string) => Promise.resolve(chatResponse('ok')))

    await callAiForTask('editor', { systemPrompt: '', userPrompt: 'hello' })
    await callAiForTask('text', { systemPrompt: '', userPrompt: 'hello' })

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch.mock.calls[0][0]).toContain('api.a.com')
    expect(mockFetch.mock.calls[1][0]).toContain('api.b.com')
  })

  it('槽未配置 providerId 时回退到默认 provider', async () => {
    setupAiConfig([
      { id: 'default-m', name: 'Default', provider: 'openai', enabled: true, apiKey: 'key', apiUrl: 'https://api.default.com/v1', model: 'gpt-4' },
    ])
    setupRouting({
      version: 1,
      editor: {}, text: {}, image: {}, video: {}, audio: {},
    })

    mockFetch.mockImplementation(() => Promise.resolve(chatResponse('ok')))

    await callAiForTask('text', { systemPrompt: '', userPrompt: 'hi' })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0][0]).toContain('api.default.com')
  })

  it('槽指定了不存在的 providerId 时回退到默认', async () => {
    setupAiConfig([
      { id: 'real-m', name: 'Real', provider: 'openai', enabled: true, apiKey: 'key', apiUrl: 'https://api.real.com/v1', model: 'gpt-4' },
    ])
    setupRouting({
      version: 1,
      editor: { providerId: 'ghost-m' },
      text: {},
      image: {}, video: {}, audio: {},
    })

    mockFetch.mockImplementation(() => Promise.resolve(chatResponse('ok')))

    await callAiForTask('editor', { systemPrompt: '', userPrompt: 'hi' })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0][0]).toContain('api.real.com')
  })
})

// ---------- 技能模板注入 ----------

describe('技能模板注入路由层', () => {
  it('套用技能模板后 skillPrompt 注入到 systemPrompt', async () => {
    const template = getSkillTemplate('editor-branch-architect')!
    setupAiConfig([
      { id: 'm1', name: 'M1', provider: 'openai', enabled: true, apiKey: 'k', apiUrl: 'https://api.test.com/v1', model: 'gpt-4' },
    ])
    setupRouting({
      version: 1,
      editor: { providerId: 'm1', skillPrompt: template.skillPrompt },
      text: {}, image: {}, video: {}, audio: {},
    })

    mockFetch.mockImplementation(() => Promise.resolve(chatResponse('ok')))

    await callAiForTask('editor', { systemPrompt: '你是编辑器助手', userPrompt: '帮我设计分支' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.messages[0].content).toContain('你是编辑器助手')
    expect(body.messages[0].content).toContain('分支叙事架构师')
    expect(body.messages[0].content).toContain('蝴蝶效应')
  })

  it('text 槽技能模板同样注入', async () => {
    const template = getSkillTemplate('text-suspense-builder')!
    setupAiConfig([
      { id: 'm2', name: 'M2', provider: 'deepseek', enabled: true, apiKey: 'k', apiUrl: 'https://api.text.com/v1', model: 'deepseek-chat' },
    ])
    setupRouting({
      version: 1,
      editor: {},
      text: { providerId: 'm2', skillPrompt: template.skillPrompt },
      image: {}, video: {}, audio: {},
    })

    mockFetch.mockImplementation(() => Promise.resolve(chatResponse('ok')))

    await callAiForTask('text', { systemPrompt: 'base', userPrompt: '写一段' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.messages[0].content).toContain('悬念铺设')
    expect(body.messages[0].content).toContain('伏笔')
  })

  it('温度和 maxTokens 覆盖生效', async () => {
    setupAiConfig([
      { id: 'm3', name: 'M3', provider: 'openai', enabled: true, apiKey: 'k', apiUrl: 'https://api.test.com/v1', model: 'gpt-4' },
    ])
    setupRouting({
      version: 1,
      editor: { providerId: 'm3', temperature: 0.1, maxTokens: 500 },
      text: {}, image: {}, video: {}, audio: {},
    })

    mockFetch.mockImplementation(() => Promise.resolve(chatResponse('ok')))

    await callAiForTask('editor', { systemPrompt: '', userPrompt: 'hi', temperature: 0.9, maxTokens: 2000 })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.temperature).toBe(0.1)
    expect(body.max_tokens).toBe(500)
  })
})

// ---------- ComfyUI 工作流通过路由层注入 ----------

/** 设置 ComfyUI 路由 + mock fetch 端点 */
function setupComfyui(skillPrompt?: string) {
  const media: MediaProviderConfig = {
    type: 'comfyui',
    apiKey: '',
    apiUrl: 'http://localhost:8188',
    model: '',
    workflowJson: SIMPLE_WORKFLOW,
  }
  setupRouting({
    version: 1,
    editor: {}, text: {},
    image: { media, skillPrompt },
    video: {}, audio: {},
  })

  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/upload/image')) {
      return Promise.resolve(mockResponse({ name: 'uploaded.png', subfolder: '' }))
    }
    if (url.includes('/prompt') && !url.includes('/upload')) {
      return Promise.resolve(mockResponse({ prompt_id: 'test-123' }))
    }
    if (url.includes('/history/')) {
      return Promise.resolve(mockResponse({
        'test-123': { outputs: { '9': { images: [{ filename: 'result.png', subfolder: '' }] } } },
      }))
    }
    if (url.includes('/view')) {
      return Promise.resolve(mockResponse(null, { blob: new Blob([new Uint8Array([1, 2, 3])]) }))
    }
    return Promise.resolve(mockResponse({}))
  })
}

/** 从 /prompt 调用中提取提交的工作流 */
function getSubmittedWorkflow(): Record<string, { class_type: string; inputs: Record<string, unknown>; _meta?: { title?: string } }> {
  const promptCall = mockFetch.mock.calls.find((c: unknown[]) =>
    typeof c[0] === 'string' && c[0].includes('/prompt') && !c[0].includes('/upload'),
  )
  expect(promptCall, '应调用 /prompt 端点').toBeDefined()
  return JSON.parse((promptCall![1] as { body: string }).body).prompt
}

describe('ComfyUI 工作流通过路由层注入', () => {
  it('prompt 和参考图被正确注入到工作流', async () => {
    setupComfyui()

    const result = await generateMediaForTask('image', {
      prompt: 'a girl with red hair',
      referenceImageHash: 'abc123',
    })

    expect(result.type).toBe('image')
    expect(result.url).toBeTruthy()

    // 验证参考图上传
    const uploadCall = mockFetch.mock.calls.find((c: unknown[]) =>
      typeof c[0] === 'string' && c[0].includes('/upload/image'),
    )
    expect(uploadCall, '应上传参考图').toBeDefined()

    // 验证工作流注入
    const wf = getSubmittedWorkflow()
    const positive = Object.values(wf).find((n) => n._meta?.title === 'positive')
    expect(positive?.inputs.text).toBe('a girl with red hair')
    const loadImg = Object.values(wf).find((n) => n.class_type === 'LoadImage')
    expect(loadImg?.inputs.image).toBe('uploaded.png')
    // 负向 prompt 不受影响
    const negative = Object.values(wf).find((n) => n._meta?.title === 'negative')
    expect(negative?.inputs.text).toBe('bad')
  })

  it('无参考图时跳过上传，仅注入 prompt', async () => {
    setupComfyui()

    await generateMediaForTask('image', { prompt: 'a sunset' })

    const uploadCall = mockFetch.mock.calls.find((c: unknown[]) =>
      typeof c[0] === 'string' && c[0].includes('/upload/image'),
    )
    expect(uploadCall).toBeUndefined()

    const wf = getSubmittedWorkflow()
    const positive = Object.values(wf).find((n) => n._meta?.title === 'positive')
    expect(positive?.inputs.text).toBe('a sunset')
    // LoadImage 保持原值
    const loadImg = Object.values(wf).find((n) => n.class_type === 'LoadImage')
    expect(loadImg?.inputs.image).toBe('placeholder.png')
  })

  it('技能 prompt 拼接到媒体生成 prompt 前', async () => {
    setupComfyui('anime style, masterpiece')

    await generateMediaForTask('image', { prompt: 'a girl' })

    const wf = getSubmittedWorkflow()
    const positive = Object.values(wf).find((n) => n._meta?.title === 'positive')
    expect(positive?.inputs.text as string).toContain('anime style, masterpiece')
    expect(positive?.inputs.text as string).toContain('a girl')
  })
})

// ---------- 端到端多任务切换 ----------

describe('端到端多任务切换', () => {
  it('同一会话中 editor / text / image 三种任务各用不同模型', async () => {
    setupAiConfig([
      { id: 'gpt4', name: 'GPT4', provider: 'openai', enabled: true, apiKey: 'k1', apiUrl: 'https://api.openai.com/v1', model: 'gpt-4' },
      { id: 'ds', name: 'DS', provider: 'deepseek', enabled: true, apiKey: 'k2', apiUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
    ])
    const comfyMedia: MediaProviderConfig = {
      type: 'comfyui', apiKey: '', apiUrl: 'http://localhost:8188', model: '', workflowJson: SIMPLE_WORKFLOW,
    }
    setupRouting({
      version: 1,
      editor: { providerId: 'gpt4' },
      text: { providerId: 'ds' },
      image: { media: comfyMedia },
      video: {}, audio: {},
    })

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/upload/image')) return Promise.resolve(mockResponse({ name: 'u.png' }))
      if (url.includes('/prompt') && !url.includes('/upload')) return Promise.resolve(mockResponse({ prompt_id: 'p1' }))
      if (url.includes('/history/')) return Promise.resolve(mockResponse({ p1: { outputs: { '9': { images: [{ filename: 'r.png' }] } } } }))
      if (url.includes('/view')) return Promise.resolve(mockResponse(null, { blob: new Blob([new Uint8Array([1])]) }))
      // chat completions
      return Promise.resolve(chatResponse('ok'))
    })

    // 1. editor 任务 → GPT-4
    await callAiForTask('editor', { systemPrompt: '', userPrompt: 'add node' })
    // 2. text 任务 → DeepSeek
    await callAiForTask('text', { systemPrompt: '', userPrompt: '写一段' })
    // 3. image 任务 → ComfyUI
    const imgResult = await generateMediaForTask('image', { prompt: 'a scene' })

    // 验证 editor 走 GPT-4
    const editorUrl = mockFetch.mock.calls[0][0] as string
    expect(editorUrl).toContain('api.openai.com')
    // 验证 text 走 DeepSeek
    const textUrl = mockFetch.mock.calls[1][0] as string
    expect(textUrl).toContain('api.deepseek.com')
    // 验证 image 走 ComfyUI
    expect(imgResult.type).toBe('image')
    const comfyCall = mockFetch.mock.calls.find((c: unknown[]) =>
      typeof c[0] === 'string' && c[0].includes('localhost:8188/prompt'),
    )
    expect(comfyCall, 'image 应调用 ComfyUI').toBeDefined()
  })
})
