import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'
import {
  cloneCustomWorkflow,
  createCustomWorkflow,
  deleteCustomWorkflow,
  getCustomWorkflow,
  listCustomWorkflows,
  resetCustomWorkflows,
  updateCustomWorkflow,
  type CustomWorkflow,
} from '../custom-workflows-store'

const KEY = 'subsilicon-custom-workflows:v1'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = String(v) },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { store = {} },
    // length / key 仅为实现 Storage 接口的最小 stub，本次测试不直接调用
    get length() { return Object.keys(store).length },
    key: (i: number) => Object.keys(store)[i] ?? null,
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, configurable: true })
// stub CustomEvent + window（hook 用到），测试纯 CRUD 不订阅事件，只需占位即可
if (typeof (globalThis as unknown as { window?: unknown }).window === 'undefined') {
  Object.defineProperty(globalThis, 'window', {
    value: { addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false } },
    configurable: true,
  })
}
if (typeof (globalThis as unknown as { CustomEvent?: unknown }).CustomEvent === 'undefined') {
  Object.defineProperty(globalThis, 'CustomEvent', {
    value: class CustomEvent<T = unknown> {
      public type: string
      public detail: T | null
      constructor(type: string, options?: { detail?: T }) {
        this.type = type
        this.detail = options?.detail ?? null
      }
    },
    configurable: true,
  })
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
})

const makeImage = (): CustomWorkflow => createCustomWorkflow({
  taskType: 'image',
  name: '我的像素图生成',
  description: '低分辨率复古像素风',
  media: { style: 'pixel', skillPrompt: '16x16 风格，色块鲜明，无抗锯齿' },
})

describe('custom-workflows-store', () => {
  it('内置模板默认存在（3 条），内置排在最前面，且每个 taskType 都有至少一条', () => {
    const all = listCustomWorkflows()
    const builtins = all.filter((w) => w.builtin)
    expect(builtins.length).toBe(3)
    expect(all[0].builtin).toBe(true)
    expect(listCustomWorkflows('image').some((w) => w.builtin)).toBe(true)
    expect(listCustomWorkflows('video').some((w) => w.builtin)).toBe(true)
    expect(listCustomWorkflows('text').some((w) => w.builtin)).toBe(true)
  })

  it('listCustomWorkflows(taskType) 仅返回对应分类，且内置排在自定义前', () => {
    makeImage()
    const images = listCustomWorkflows('image')
    expect(images.every((w) => w.taskType === 'image')).toBe(true)
    expect(images[0].builtin).toBe(true)
    expect(images.some((w) => w.name === '我的像素图生成')).toBe(true)
  })

  it('createCustomWorkflow: 写入 & getCustomWorkflow 可回读，字符串字段被裁剪', () => {
    const created = createCustomWorkflow({
      taskType: 'text',
      name: 'a'.repeat(40),
      description: 'b'.repeat(200),
      text: { temperature: 0.9, maxTokens: 512, styleKeywords: '黑色幽默,短句' },
    })
    expect(created.name.length).toBe(24)
    expect((created.description || '').length).toBe(120)
    expect(created.text?.temperature).toBe(0.9)
    expect(created.text?.maxTokens).toBe(512)
    expect(created.taskType).toBe('text')
    const read = getCustomWorkflow(created.id)
    expect(read?.id).toBe(created.id)
  })

  it('createCustomWorkflow: image 任务写入 media 分桶，text 分桶保持 undefined', () => {
    const created = makeImage()
    expect(created.media?.style).toBe('pixel')
    expect(created.text).toBeUndefined()
  })

  it('updateCustomWorkflow: 可改 name / media，内置拒绝修改', () => {
    const created = makeImage()
    const updated = updateCustomWorkflow(created.id, {
      name: '新的像素风格',
      media: { ...created.media, style: 'anime', seedLock: 1234 },
    })
    expect(updated?.name).toBe('新的像素风格')
    expect(updated?.media?.style).toBe('anime')
    expect(updated?.media?.seedLock).toBe(1234)
    // 再次读回
    expect(getCustomWorkflow(created.id)?.name).toBe('新的像素风格')

    // 内置不可改
    const builtin = listCustomWorkflows().find((w) => w.builtin)
    expect(builtin).toBeDefined()
    const res = updateCustomWorkflow(builtin!.id, { name: 'xxx' })
    expect(res).toBeNull()
  })

  it('deleteCustomWorkflow: 自定义可删，内置拒绝删除，删后 get 返回 undefined', () => {
    const created = makeImage()
    expect(deleteCustomWorkflow(created.id)).toBe(true)
    expect(getCustomWorkflow(created.id)).toBeUndefined()

    const builtin = listCustomWorkflows().find((w) => w.builtin)
    expect(deleteCustomWorkflow(builtin!.id)).toBe(false)
    // 内置还在
    expect(listCustomWorkflows().find((w) => w.id === builtin!.id)).toBeDefined()
  })

  it('cloneCustomWorkflow: 克隆内置 → 得到自定义副本，可正常修改删除', () => {
    const builtin = listCustomWorkflows('video').find((w) => w.builtin)
    expect(builtin).toBeDefined()
    const cloned = cloneCustomWorkflow(builtin!.id, '自制电影运镜')
    expect(cloned).not.toBeNull()
    expect(cloned?.builtin).toBeUndefined()
    expect(cloned?.name).toBe('自制电影运镜')
    expect(cloned?.taskType).toBe('video')
    expect(cloned?.media?.ratio).toBe('16:9')

    // 副本可改
    const updated = updateCustomWorkflow(cloned!.id, { media: { ...cloned!.media, durationSec: 7 } })
    expect(updated?.media?.durationSec).toBe(7)
    // 且不影响原内置
    const stillBuiltin = listCustomWorkflows('video').find((w) => w.id === builtin!.id)
    expect(stillBuiltin?.media?.durationSec).toBe(5)
  })

  it('cloneCustomWorkflow 不存在的 id → null', () => {
    expect(cloneCustomWorkflow('nope')).toBeNull()
  })

  it('resetCustomWorkflows: 清空自定义，只剩内置 3 条', () => {
    makeImage()
    createCustomWorkflow({ taskType: 'text', name: '另一条文本' })
    expect(listCustomWorkflows().length).toBeGreaterThan(3)
    resetCustomWorkflows()
    expect(listCustomWorkflows().length).toBe(3)
    expect(listCustomWorkflows().every((w) => w.builtin)).toBe(true)
  })

  it('空 / 损坏 localStorage 自动恢复：内置模板仍然可列出', () => {
    localStorage.setItem(KEY, '{ broken json')
    expect(listCustomWorkflows().length).toBe(3)
    localStorage.setItem(KEY, JSON.stringify({ version: 2, items: 'not array' } as any))
    expect(listCustomWorkflows().length).toBe(3)
    localStorage.removeItem(KEY)
    expect(listCustomWorkflows().length).toBe(3)
  })

  it('升级合并：用户已存部分内置时，只补缺失的，不重复合并', () => {
    // 模拟用户只保存了其中一条内置（理论上用户不会持久化内置，但需测试 mergeBuiltins 幂等）
    const onlyOne = listCustomWorkflows().slice(0, 1)
    localStorage.setItem(KEY, JSON.stringify({ version: 1, items: onlyOne }))
    const merged = listCustomWorkflows()
    const builtinKeys = new Set(merged.filter((w) => w.builtin).map((w) => w.builtinKey))
    expect(builtinKeys.size).toBe(3)
  })
})
