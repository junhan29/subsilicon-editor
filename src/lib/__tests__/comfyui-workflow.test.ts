import { describe, expect, it } from 'vitest'
import {
  type ComfyWorkflow,
  WORKFLOW_PRESETS,
  getWorkflowPreset,
  injectPrompt,
  injectReferenceImage,
  validateWorkflow,
} from '../ai/comfyui-workflow'

const validWorkflow: ComfyWorkflow = {
  '3': {
    class_type: 'KSampler',
    inputs: { seed: 42, steps: 25, cfg: 7, model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0] },
  },
  '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'model.safetensors' } },
  '5': { class_type: 'EmptyLatentImage', inputs: { width: 512, height: 512, batch_size: 1 } },
  '6': {
    class_type: 'CLIPTextEncode',
    inputs: { text: 'old prompt', clip: ['4', 1] },
    _meta: { title: 'positive' },
  },
  '7': {
    class_type: 'CLIPTextEncode',
    inputs: { text: 'bad', clip: ['4', 1] },
    _meta: { title: 'negative' },
  },
  '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
  '9': { class_type: 'SaveImage', inputs: { images: ['8', 0] } },
  '11': { class_type: 'LoadImage', inputs: { image: 'placeholder.png' } },
}

describe('validateWorkflow', () => {
  it('空字符串返回错误', () => {
    const r = validateWorkflow('')
    expect(r.ok).toBe(false)
    expect(r.errors).toContain('工作流为空')
    expect(r.nodes).toHaveLength(0)
  })

  it('非法 JSON 返回错误', () => {
    const r = validateWorkflow('{bad json')
    expect(r.ok).toBe(false)
    expect(r.errors[0]).toBe('JSON 格式错误，无法解析')
  })

  it('数组而非对象返回错误', () => {
    const r = validateWorkflow('[]')
    expect(r.ok).toBe(false)
    expect(r.errors[0]).toContain('应为对象')
  })

  it('空对象返回错误（无节点）', () => {
    const r = validateWorkflow('{}')
    expect(r.ok).toBe(false)
    expect(r.errors).toContain('工作流不包含任何节点')
  })

  it('节点缺少 class_type 报错', () => {
    const r = validateWorkflow(JSON.stringify({ '1': { inputs: {} } }))
    expect(r.ok).toBe(false)
    expect(r.errors.some((e) => e.includes('class_type'))).toBe(true)
  })

  it('节点缺少 inputs 报错', () => {
    const r = validateWorkflow(JSON.stringify({ '1': { class_type: 'Test' } }))
    expect(r.ok).toBe(false)
    expect(r.errors.some((e) => e.includes('inputs'))).toBe(true)
  })

  it('完整工作流校验通过', () => {
    const r = validateWorkflow(JSON.stringify(validWorkflow))
    expect(r.ok).toBe(true)
    expect(r.errors).toHaveLength(0)
    expect(r.nodes.length).toBeGreaterThan(0)
  })

  it('解析出可注入节点标记', () => {
    const r = validateWorkflow(JSON.stringify(validWorkflow))
    const loadImg = r.nodes.find((n) => n.classType === 'LoadImage')
    expect(loadImg?.injectable).toBe('reference_image')
    const positive = r.nodes.find((n) => n.injectable === 'prompt')
    expect(positive).toBeDefined()
    const negative = r.nodes.find((n) => n.injectable === 'negative_prompt')
    expect(negative).toBeDefined()
  })

  it('缺少 KSampler 时产生警告', () => {
    const wf = { ...validWorkflow }
    delete wf['3']
    const r = validateWorkflow(JSON.stringify(wf))
    expect(r.warnings.some((w) => w.includes('KSampler'))).toBe(true)
  })

  it('缺少 LoadImage 时产生警告', () => {
    const wf = { ...validWorkflow }
    delete wf['11']
    const r = validateWorkflow(JSON.stringify(wf))
    expect(r.warnings.some((w) => w.includes('LoadImage'))).toBe(true)
  })

  it('缺少 CLIPTextEncode 时产生警告', () => {
    const wf = { ...validWorkflow }
    delete wf['6']
    delete wf['7']
    const r = validateWorkflow(JSON.stringify(wf))
    expect(r.warnings.some((w) => w.includes('CLIPTextEncode'))).toBe(true)
  })
})

describe('injectPrompt', () => {
  it('注入到 title 含 positive 的 CLIPTextEncode', () => {
    const result = injectPrompt(validWorkflow, 'new prompt text')
    const positive = result['6']
    expect(positive.inputs.text).toBe('new prompt text')
    // 负向不受影响
    expect(result['7'].inputs.text).toBe('bad')
  })

  it('无 positive title 时注入第一个 CLIPTextEncode', () => {
    const wf: ComfyWorkflow = {
      '1': { class_type: 'CLIPTextEncode', inputs: { text: 'old' } },
    }
    const result = injectPrompt(wf, 'injected')
    expect(result['1'].inputs.text).toBe('injected')
  })

  it('无 CLIPTextEncode 时原样返回', () => {
    const wf: ComfyWorkflow = {
      '1': { class_type: 'SaveImage', inputs: {} },
    }
    const result = injectPrompt(wf, 'test')
    expect(result['1'].class_type).toBe('SaveImage')
  })

  it('不修改原对象', () => {
    const original = JSON.parse(JSON.stringify(validWorkflow))
    injectPrompt(validWorkflow, 'mutated')
    expect(validWorkflow['6'].inputs.text).toBe(original['6'].inputs.text)
  })
})

describe('injectReferenceImage', () => {
  it('注入到第一个 LoadImage 节点', () => {
    const result = injectReferenceImage(validWorkflow, 'my_image.png')
    expect(result['11'].inputs.image).toBe('my_image.png')
  })

  it('不修改原对象', () => {
    const original = JSON.parse(JSON.stringify(validWorkflow))
    injectReferenceImage(validWorkflow, 'test.png')
    expect(validWorkflow['11'].inputs.image).toBe(original['11'].inputs.image)
  })

  it('无 LoadImage 时原样返回', () => {
    const wf: ComfyWorkflow = { '1': { class_type: 'SaveImage', inputs: {} } }
    const result = injectReferenceImage(wf, 'test.png')
    expect(result).toEqual(wf)
  })
})

describe('WORKFLOW_PRESETS', () => {
  it('包含 3 个预设', () => {
    expect(WORKFLOW_PRESETS).toHaveLength(3)
  })

  it('每个预设的 workflowJson 是有效 JSON', () => {
    for (const preset of WORKFLOW_PRESETS) {
      expect(() => JSON.parse(preset.workflowJson)).not.toThrow()
    }
  })

  it('每个预设校验通过', () => {
    for (const preset of WORKFLOW_PRESETS) {
      const r = validateWorkflow(preset.workflowJson)
      expect(r.ok, `${preset.name}: ${r.errors.join('; ')}`).toBe(true)
    }
  })

  it('ipadapter 预设含 IPAdapterApply 节点', () => {
    const r = validateWorkflow(WORKFLOW_PRESETS[0].workflowJson)
    expect(r.nodes.some((n) => n.classType === 'IPAdapterApply')).toBe(true)
  })

  it('txt2img 预设不含 LoadImage', () => {
    const r = validateWorkflow(WORKFLOW_PRESETS[1].workflowJson)
    expect(r.nodes.some((n) => n.classType === 'LoadImage')).toBe(false)
  })

  it('img2img 预设含 VAEEncode', () => {
    const r = validateWorkflow(WORKFLOW_PRESETS[2].workflowJson)
    expect(r.nodes.some((n) => n.classType === 'VAEEncode')).toBe(true)
  })
})

describe('getWorkflowPreset', () => {
  it('按 id 获取预设', () => {
    const p = getWorkflowPreset('ipadapter')
    expect(p).toBeDefined()
    expect(p?.name).toContain('IP-Adapter')
  })

  it('不存在返回 undefined', () => {
    expect(getWorkflowPreset('nonexistent')).toBeUndefined()
  })
})
