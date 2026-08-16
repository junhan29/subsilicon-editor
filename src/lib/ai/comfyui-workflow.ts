/**
 * ComfyUI 工作流辅助工具
 *
 * 提供工作流 JSON 校验、节点解析、预设工作流和 prompt/参考图注入逻辑。
 * 供媒体槽配置 UI 与生成调用共用。
 */

/** ComfyUI API 格式工作流的节点结构 */
export interface ComfyWorkflowNode {
  class_type: string
  inputs: Record<string, unknown>
  _meta?: { title?: string }
}

/** ComfyUI API 格式工作流：节点 id → 节点定义 */
export type ComfyWorkflow = Record<string, ComfyWorkflowNode>

/** 校验结果 */
export interface WorkflowValidationResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  /** 解析出的节点摘要，供 UI 展示 */
  nodes: WorkflowNodeInfo[]
}

/** 节点摘要信息（供 UI 展示） */
export interface WorkflowNodeInfo {
  id: string
  classType: string
  title?: string
  /** 该节点是否会被编辑器自动注入（如 LoadImage / CLIPTextEncode） */
  injectable?: 'reference_image' | 'prompt' | 'negative_prompt'
}

/** 预设工作流定义 */
export interface WorkflowPreset {
  id: string
  name: string
  desc: string
  /** 需要的 ComfyUI 自定义节点/模型 */
  requirements: string[]
  workflowJson: string
}

// ---------- 校验与解析 ----------

/**
 * 校验并解析 ComfyUI 工作流 JSON。
 * 返回校验结果 + 节点摘要。
 */
export function validateWorkflow(json: string): WorkflowValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!json.trim()) {
    return { ok: false, errors: ['工作流为空'], warnings, nodes: [] }
  }

  let workflow: ComfyWorkflow
  try {
    workflow = JSON.parse(json) as ComfyWorkflow
  } catch {
    return { ok: false, errors: ['JSON 格式错误，无法解析'], warnings, nodes: [] }
  }

  if (typeof workflow !== 'object' || workflow === null || Array.isArray(workflow)) {
    return { ok: false, errors: ['工作流应为对象（节点 id → 节点），当前不是'], warnings, nodes: [] }
  }

  const nodes: WorkflowNodeInfo[] = []
  const entries = Object.entries(workflow)

  if (entries.length === 0) {
    errors.push('工作流不包含任何节点')
  }

  for (const [id, node] of entries) {
    if (!node || typeof node !== 'object') {
      errors.push(`节点 ${id} 不是有效对象`)
      continue
    }
    if (!node.class_type || typeof node.class_type !== 'string') {
      errors.push(`节点 ${id} 缺少 class_type`)
      continue
    }
    if (!node.inputs || typeof node.inputs !== 'object') {
      errors.push(`节点 ${id} 缺少 inputs`)
      continue
    }

    const info: WorkflowNodeInfo = {
      id,
      classType: node.class_type,
      title: node._meta?.title,
    }

    // 标记可注入节点
    const title = (node._meta?.title || '').toLowerCase()
    if (node.class_type === 'LoadImage') {
      info.injectable = 'reference_image'
    } else if (node.class_type === 'CLIPTextEncode') {
      if (/positive|正向/.test(title)) {
        info.injectable = 'prompt'
      } else if (/negative|负向/.test(title)) {
        info.injectable = 'negative_prompt'
      }
    }

    nodes.push(info)
  }

  // 结构性检查
  const hasCheckpoint = entries.some(([, n]) =>
    n.class_type === 'CheckpointLoaderSimple' || n.class_type === 'CheckpointLoader'
  )
  const hasKSampler = entries.some(([, n]) => n.class_type === 'KSampler')
  const hasSave = entries.some(([, n]) =>
    n.class_type === 'SaveImage' || n.class_type === 'SaveImageWebsocket'
  )
  const hasClipText = entries.some(([, n]) => n.class_type === 'CLIPTextEncode')
  const hasLoadImage = entries.some(([, n]) => n.class_type === 'LoadImage')

  if (!hasCheckpoint) warnings.push('未找到 CheckpointLoaderSimple 节点（模型加载）')
  if (!hasKSampler) warnings.push('未找到 KSampler 节点（采样器）')
  if (!hasSave) warnings.push('未找到 SaveImage 节点（保存图片）')
  if (!hasClipText) warnings.push('未找到 CLIPTextEncode 节点，编辑器将无法自动注入 prompt')
  if (!hasLoadImage) warnings.push('未找到 LoadImage 节点，编辑器将无法注入参考图（角色一致性）')

  return { ok: errors.length === 0, errors, warnings, nodes }
}

// ---------- 注入逻辑 ----------

/**
 * 将 prompt 注入工作流中的正向 CLIPTextEncode 节点。
 * 优先找 title 含 positive/正向 的节点，否则注入第一个 CLIPTextEncode。
 * 返回新的工作流对象（不修改原对象）。
 */
export function injectPrompt(workflow: ComfyWorkflow, prompt: string): ComfyWorkflow {
  const result: ComfyWorkflow = JSON.parse(JSON.stringify(workflow))
  const clipNodes = Object.values(result).filter((n) => n.class_type === 'CLIPTextEncode')
  if (clipNodes.length === 0) return result

  const positive = clipNodes.find((n) => {
    const t = (n._meta?.title || '').toLowerCase()
    return /positive|正向/.test(t)
  }) || clipNodes[0]

  positive.inputs.text = prompt
  return result
}

/**
 * 将参考图名称注入工作流中的第一个 LoadImage 节点。
 * 返回新的工作流对象（不修改原对象）。
 */
export function injectReferenceImage(workflow: ComfyWorkflow, imageName: string): ComfyWorkflow {
  const result: ComfyWorkflow = JSON.parse(JSON.stringify(workflow))
  for (const node of Object.values(result)) {
    if (node.class_type === 'LoadImage') {
      node.inputs.image = imageName
      break
    }
  }
  return result
}

// ---------- 预设工作流 ----------

/**
 * 预设 1：IP-Adapter 角色一致性工作流（默认推荐）
 * 含 LoadImage（参考图）+ CLIPTextEncode 正向/负向 + IPAdapterApply + KSampler + SaveImage
 * 需安装 ComfyUI_IPAdapter_plus 插件 + IP-Adapter 模型
 */
const IPADAPTER_WORKFLOW = JSON.stringify({
  '3': {
    class_type: 'KSampler',
    inputs: {
      seed: 42, steps: 25, cfg: 7, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 1,
      model: ['10', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0],
    },
  },
  '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'your_model.safetensors' } },
  '5': { class_type: 'EmptyLatentImage', inputs: { width: 1024, height: 1024, batch_size: 1 } },
  '6': {
    class_type: 'CLIPTextEncode', inputs: { text: 'positive prompt here', clip: ['4', 1] },
    _meta: { title: 'positive' },
  },
  '7': {
    class_type: 'CLIPTextEncode', inputs: { text: 'lowres, bad anatomy, deformed', clip: ['4', 1] },
    _meta: { title: 'negative' },
  },
  '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
  '9': { class_type: 'SaveImage', inputs: { filename_prefix: 'subsilicon', images: ['8', 0] } },
  '10': {
    class_type: 'IPAdapterApply',
    inputs: {
      weight: 0.85, noise: 0, weight_type: 'standard', start_at: 0, end_at: 1,
      model: ['4', 0], ipadapter: ['12', 0], image: ['11', 0],
    },
  },
  '11': { class_type: 'LoadImage', inputs: { image: 'reference_placeholder.png' } },
  '12': { class_type: 'IPAdapterModelLoader', inputs: { ipadapter_file: 'ip-adapter_sd15.safetensors' } },
}, null, 2)

/**
 * 预设 2：纯文生图工作流（无参考图，最简结构）
 * 适合不需要角色一致性的场景图生成
 */
const TXT2IMG_WORKFLOW = JSON.stringify({
  '3': {
    class_type: 'KSampler',
    inputs: {
      seed: 42, steps: 25, cfg: 7, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 1,
      model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0],
    },
  },
  '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'your_model.safetensors' } },
  '5': { class_type: 'EmptyLatentImage', inputs: { width: 1024, height: 1024, batch_size: 1 } },
  '6': {
    class_type: 'CLIPTextEncode', inputs: { text: 'positive prompt here', clip: ['4', 1] },
    _meta: { title: 'positive' },
  },
  '7': {
    class_type: 'CLIPTextEncode', inputs: { text: 'lowres, bad anatomy, deformed', clip: ['4', 1] },
    _meta: { title: 'negative' },
  },
  '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
  '9': { class_type: 'SaveImage', inputs: { filename_prefix: 'subsilicon', images: ['8', 0] } },
}, null, 2)

/**
 * 预设 3：图生图工作流（Image-to-Image）
 * 用 LoadImage 加载输入图 → VAE Encode → KSampler(denoise<1) 重绘
 * 适合在已有图基础上做风格转换或局部修改
 */
const IMG2IMG_WORKFLOW = JSON.stringify({
  '3': {
    class_type: 'KSampler',
    inputs: {
      seed: 42, steps: 25, cfg: 7, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 0.55,
      model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['13', 0],
    },
  },
  '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'your_model.safetensors' } },
  '6': {
    class_type: 'CLIPTextEncode', inputs: { text: 'positive prompt here', clip: ['4', 1] },
    _meta: { title: 'positive' },
  },
  '7': {
    class_type: 'CLIPTextEncode', inputs: { text: 'lowres, bad anatomy, deformed', clip: ['4', 1] },
    _meta: { title: 'negative' },
  },
  '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
  '9': { class_type: 'SaveImage', inputs: { filename_prefix: 'subsilicon', images: ['8', 0] } },
  '11': { class_type: 'LoadImage', inputs: { image: 'reference_placeholder.png' } },
  '12': { class_type: 'VAEEncode', inputs: { pixels: ['11', 0], vae: ['4', 2] } },
  '13': { class_type: 'LatentBlend', inputs: { samples0: ['12', 0], samples1: ['12', 0], blend_factor: 0.5 } },
}, null, 2)

/** 内置预设工作流列表 */
export const WORKFLOW_PRESETS: WorkflowPreset[] = [
  {
    id: 'ipadapter',
    name: 'IP-Adapter 角色一致性（推荐）',
    desc: '通过参考图保持角色面部/风格一致，适合角色立绘。需安装 IPAdapter 插件和模型。',
    requirements: ['ComfyUI_IPAdapter_plus 插件', 'IP-Adapter 模型（如 ip-adapter_sd15.safetensors）'],
    workflowJson: IPADAPTER_WORKFLOW,
  },
  {
    id: 'txt2img',
    name: '纯文生图（最简）',
    desc: '无参考图，仅文生图。适合场景背景、道具等不需要角色一致性的图片。',
    requirements: ['基础 ComfyUI（无需额外插件）'],
    workflowJson: TXT2IMG_WORKFLOW,
  },
  {
    id: 'img2img',
    name: '图生图重绘',
    desc: '在输入图基础上重绘，适合风格转换或局部修改。denoise 越低越接近原图。',
    requirements: ['基础 ComfyUI（无需额外插件）'],
    workflowJson: IMG2IMG_WORKFLOW,
  },
]

/** 按 id 获取预设工作流 */
export function getWorkflowPreset(id: string): WorkflowPreset | undefined {
  return WORKFLOW_PRESETS.find((p) => p.id === id)
}
