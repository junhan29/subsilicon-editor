'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, CheckCircle2, ChevronDown, Copy, Cpu, ExternalLink, Globe, Image, Loader2, Music, Pencil, Settings2, SlidersHorizontal, Sparkles, Trash2, Wand2, X } from 'lucide-react'
import { Label } from '../ui/label'
import { showToast } from './toast'
import { ComfyuiWorkflowDialog } from './comfyui-workflow-dialog'
import {
  type AiProviderConfig,
  type AiTaskRoutingConfig,
  type MediaProviderConfig,
  type TaskMediaSlot,
  type TaskTextSlot,
  getMediaProviderConfigForTask,
  getSkillTemplatesForTask,
  getTaskRoutingConfig,
  getTaskRoutingProviders,
  refreshAiConfig,
  saveTaskRoutingConfig,
} from '@editor/lib/ai'
import { getDefaultModel, getModelsForProvider } from '@editor/lib/ai/model-presets'
import { decryptAiConfig, decryptApiKeyField, decryptAiKey } from '@editor/lib/ai/ai-key-vault'
import { saveAiConfigEncrypted } from '@editor/lib/ai/ai-config-store'
import { useAssistantName } from '@editor/lib/assistant-name'
import {
  cloneCustomWorkflow,
  createCustomWorkflow,
  deleteCustomWorkflow,
  getCustomWorkflow,
  resetCustomWorkflows,
  updateCustomWorkflow,
  useCustomWorkflows,
  type CustomWorkflow,
  type WorkflowTaskType,
  type WorkflowPatch,
} from '@editor/lib/custom-workflows-store'

interface AiSettingsDialogProps {
  open: boolean
  onClose: () => void
}

interface FlatAiConfig {
  enabled: boolean
  provider: string
  apiKey: string
  apiUrl: string
  model: string
}

interface FlatAiConfig {
  enabled: boolean
  provider: string
  apiKey: string
  apiUrl: string
  model: string
}

/* ======================================================================== */
/*  自定义工作流 CRUD：纯函数 helpers + 列表子组件                            */
/* ======================================================================== */

type WfDraftShape = {
  name: string
  desc: string
  t: number
  maxT: number
  sys: string
  kw: string
  style: string
  skill: string
  ratio: '16:9' | '9:16' | '1:1'
  d: number
  seed: string
}

function buildDraftFromState(taskType: WorkflowTaskType, d: WfDraftShape) {
  if (taskType === 'text') {
    return {
      taskType: 'text' as const,
      name: d.name,
      description: d.desc || undefined,
      text: {
        temperature: d.t,
        maxTokens: Math.max(128, Math.min(16384, Math.round(d.maxT || 1024))),
        systemPrompt: d.sys || undefined,
        styleKeywords: d.kw || undefined,
      },
    } as const
  }
  const seedNum = d.seed.trim() !== '' ? parseInt(d.seed, 10) : undefined
  return {
    taskType,
    name: d.name,
    description: d.desc || undefined,
    media: {
      style: d.style || undefined,
      skillPrompt: d.skill || undefined,
      seedLock: Number.isFinite(seedNum) ? seedNum : undefined,
      ratio: taskType === 'video' ? d.ratio : undefined,
      durationSec: taskType === 'video' ? Math.max(3, Math.min(10, Math.round(d.d))) : undefined,
    },
  } as const
}

function buildPatchFromDraft(taskType: WorkflowTaskType, d: WfDraftShape): WorkflowPatch {
  const seedNum = d.seed.trim() !== '' ? parseInt(d.seed, 10) : undefined
  return {
    name: d.name,
    description: d.desc,
    ...(taskType === 'text'
      ? {
          text: {
            temperature: d.t,
            maxTokens: Math.max(128, Math.min(16384, Math.round(d.maxT || 1024))),
            systemPrompt: d.sys || undefined,
            styleKeywords: d.kw || undefined,
          },
        }
      : {
          media: {
            style: d.style || undefined,
            skillPrompt: d.skill || undefined,
            seedLock: Number.isFinite(seedNum) ? seedNum : undefined,
            ratio: taskType === 'video' ? d.ratio : undefined,
            durationSec: taskType === 'video' ? Math.max(3, Math.min(10, Math.round(d.d))) : undefined,
          },
        }),
  }
}

interface WorkflowListByTaskProps {
  taskType: WorkflowTaskType
  onEdit: (wf: CustomWorkflow) => void
  onClone: (wf: CustomWorkflow) => void
  onDelete: (wf: CustomWorkflow) => void
}

function WorkflowListByTask({ taskType, onEdit, onClone, onDelete }: WorkflowListByTaskProps) {
  // 这里内部用 hook 没问题，因为组件总在同一位置渲染（固定分类 tab）
  const items = useCustomWorkflows(taskType)
  if (items.length === 0) {
    return (
      <div className="p-3 rounded-md border border-dashed border-border text-center">
        <p className="text-[11px] text-muted-foreground">暂无工作流。使用上方表单新建第一条吧 ✨</p>
      </div>
    )
  }
  return (
    <div className="space-y-1.5 max-h-80 overflow-y-auto pr-0.5">
      {items.map((wf) => (
        <div key={wf.id} className="p-2.5 rounded-md border border-border bg-card/40 flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-[12px] font-medium text-foreground truncate">{wf.name}</p>
              {wf.builtin && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted border border-border text-muted-foreground flex-shrink-0">内置</span>
              )}
              {wf.taskType === 'text' && wf.text?.temperature != null && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 font-mono border border-green-500/20">
                  T {wf.text.temperature.toFixed(2)}
                </span>
              )}
              {wf.taskType === 'video' && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 font-mono border border-purple-500/20">
                  {wf.media?.ratio || '16:9'} · {wf.media?.durationSec ?? 5}s
                </span>
              )}
              {wf.taskType === 'image' && wf.media?.style && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  {wf.media.style}
                </span>
              )}
            </div>
            {wf.description && (
              <p className="text-[10px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">{wf.description}</p>
            )}
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => onClone(wf)}
              className="p-1 rounded text-muted-foreground hover:text-gold-400 hover:bg-muted transition-colors"
              title="克隆工作流"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            {!wf.builtin && (
              <>
                <button
                  type="button"
                  onClick={() => onEdit(wf)}
                  className="p-1 rounded text-muted-foreground hover:text-cyan-300 hover:bg-muted transition-colors"
                  title="编辑"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`确认删除工作流「${wf.name}」？`)) onDelete(wf)
                  }}
                  className="p-1 rounded text-muted-foreground hover:text-red-400 hover:bg-muted transition-colors"
                  title="删除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

const PROVIDER_INFO: Record<string, {
  name: string
  desc: string
  website: string
  apiUrl: string
  recommended?: boolean  // 推荐给新手
}> = {
  deepseek: {
    name: 'DeepSeek（推荐）',
    desc: '国内直连无需翻墙，注册即送额度，便宜好用，最易上手',
    website: 'https://platform.deepseek.com/api_keys',
    apiUrl: 'https://api.deepseek.com/v1',
    recommended: true,
  },
  openai: {
    name: 'OpenAI',
    desc: 'ChatGPT 官方，画质最好但需翻墙 + 海外信用卡',
    website: 'https://platform.openai.com/api-keys',
    apiUrl: 'https://api.openai.com/v1',
  },
  anthropic: {
    name: 'Anthropic Claude',
    desc: 'Claude 官方，文笔好但需翻墙 + 海外卡',
    website: 'https://console.anthropic.com',
    apiUrl: 'https://api.anthropic.com/v1',
  },
  google: {
    name: 'Google AI',
    desc: 'Gemini 官方，需翻墙',
    website: 'https://aistudio.google.com',
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
  },
}

const MEDIA_PROVIDER_INFO: Record<string, {
  name: string
  desc: string
  website: string        // 申请 API Key 的地址
  defaultApiUrl: string
  defaultModel: string
  recommended?: boolean  // 推荐给新手
  advanced?: boolean     // 高级选项，默认隐藏
}> = {
  wan: {
    name: '通义万相（推荐）',
    desc: '阿里云出品，国内直连无需翻墙，注册即送免费额度，最易上手',
    website: 'https://dashscope.console.aliyun.com/apiKey',
    defaultApiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'wanx2.1-t2i-turbo',
    recommended: true,
  },
  openai: {
    name: 'OpenAI DALL·E',
    desc: '画质好但需翻墙 + 海外信用卡，适合有海外账号的用户',
    website: 'https://platform.openai.com/api-keys',
    defaultApiUrl: 'https://api.openai.com/v1',
    defaultModel: 'dall-e-3',
  },
  stability: {
    name: 'Stability AI',
    desc: 'Stable Diffusion 官方 API，需海外卡',
    website: 'https://platform.stability.ai/account/keys',
    defaultApiUrl: 'https://api.stability.ai',
    defaultModel: 'stable-image-core',
  },
  custom: {
    name: '自定义服务',
    desc: '兼容 OpenAI 图片接口的任意服务（如硅基流动、Together AI 等）',
    website: '',
    defaultApiUrl: '',
    defaultModel: 'dall-e-3',
    advanced: true,
  },
  comfyui: {
    name: 'ComfyUI（本地高级）',
    desc: '本地部署，支持参考图一致性。需要技术基础，新手慎选',
    website: 'https://github.com/comfyanonymous/ComfyUI',
    defaultApiUrl: 'http://localhost:8188',
    defaultModel: '',
    advanced: true,
  },
}

export function AiSettingsDialog({ open, onClose }: AiSettingsDialogProps) {
  const assistantName = useAssistantName()
  const [aiEnabled, setAiEnabled] = useState(false)
  const [aiConfig, setAiConfig] = useState<FlatAiConfig>({
    enabled: false,
    provider: 'deepseek',
    apiKey: '',
    apiUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  })
  const [showApiKey, setShowApiKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [mediaProvider, setMediaProvider] = useState<MediaProviderConfig>({
    type: 'wan',
    apiKey: '',
    apiUrl: MEDIA_PROVIDER_INFO.wan.defaultApiUrl,
    model: MEDIA_PROVIDER_INFO.wan.defaultModel,
  })
  const [showMediaKey, setShowMediaKey] = useState(false)
  const [showAdvancedMedia, setShowAdvancedMedia] = useState(false)
  const [mediaTesting, setMediaTesting] = useState(false)
  const [mediaTestResult, setMediaTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  // 任务路由（高级）：不同创作任务用不同模型
  const [showRouting, setShowRouting] = useState(false)
  const [routing, setRouting] = useState<AiTaskRoutingConfig>(() => getTaskRoutingConfig())
  const [routingProviders, setRoutingProviders] = useState<AiProviderConfig[]>(() => getTaskRoutingProviders())
  const [routingMediaKeys, setRoutingMediaKeys] = useState<Record<string, boolean>>({})
  // 技能模板下拉：记录哪个任务槽打开了模板选择
  const [skillPickerOpen, setSkillPickerOpen] = useState<string | null>(null)
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null)
  // ComfyUI 独立面板：记录当前编辑哪个来源的工作流（第 2 层媒体区 或 某任务槽）
  const [comfyEditor, setComfyEditor] = useState<'legacy' | 'image' | 'video' | 'audio' | null>(null)

  // ============================================================
  // 自定义工作流（Skill）CRUD state & helpers
  // ============================================================
  const [showWorkflows, setShowWorkflows] = useState(false)
  // 高级设置总手风琴：收纳任务路由 / 自定义工作流 / ComfyUI 等进阶配置，默认收起，不持久化
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [wfTaskType, setWfTaskType] = useState<WorkflowTaskType>('image')
  const allWorkflows = useCustomWorkflows()
  const [editingWfId, setEditingWfId] = useState<string | null>(null)
  const [wfDraft, setWfDraft] = useState<{
    name: string
    desc: string
    // text 专用
    t: number
    maxT: number
    sys: string
    kw: string
    // media 专用（image/video 共享）
    style: string
    skill: string
    // video 专用
    ratio: '16:9' | '9:16' | '1:1'
    d: number
    seed: string
  }>({ name: '', desc: '', sys: '', t: 0.7, maxT: 1024, style: 'anime', ratio: '16:9', d: 5, seed: '', kw: '', skill: '' })

  // 更新文本类任务槽（editor / text）
  const updateTextSlot = (task: 'editor' | 'text', patch: Partial<TaskTextSlot>) => {
    setRouting((prev) => ({ ...prev, [task]: { ...prev[task], ...patch } }))
  }
  // 更新媒体类任务槽（image / video / audio）
  const updateMediaSlot = (task: 'image' | 'video' | 'audio', patch: Partial<TaskMediaSlot>) => {
    setRouting((prev) => ({ ...prev, [task]: { ...prev[task], ...patch } }))
  }
  // 更新媒体槽内的服务商配置
  const updateSlotMedia = (task: 'image' | 'video' | 'audio', patch: Partial<MediaProviderConfig>) => {
    setRouting((prev) => {
      const current = prev[task].media || { type: 'wan' as const, apiKey: '', apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'wanx2.1-t2i-turbo' }
      return { ...prev, [task]: { ...prev[task], media: { ...current, ...patch } } }
    })
  }

  useEffect(() => {
    if (open) {
      // 加载为异步：apiKey 落盘为 AES-256 密文，回显前需解密（兼容旧明文）
      ;(async () => {
        try {
          const saved = localStorage.getItem('subsilicon_ai_config')
          if (saved) {
            const parsed = JSON.parse(saved)
            setAiEnabled(parsed.enabled ?? false)
            setAiConfig((await decryptAiConfig(parsed)) as FlatAiConfig)
          }
        } catch {
          // ignore
        }
        // 加载媒体生成配置（媒体配置收敛：以任务路由 image 槽为统一入口）
        // 回退链：image 槽配置优先 → 槽缺失时回退旧全局配置（历史数据，兼容老用户）
        // 旧全局配置仅作读取回退，保存时不再写回，避免双轨维护
        const mp = getMediaProviderConfigForTask('image')
        if (mp) {
          setMediaProvider(await decryptApiKeyField(mp))
          // 已配置高级服务商时自动展开高级选项，避免下拉显示与服务商不一致
          if (mp.type === 'comfyui' || mp.type === 'custom') {
            setShowAdvancedMedia(true)
          }
        }
        // 加载任务路由配置（媒体槽 apiKey 解密回显）
        const routing = getTaskRoutingConfig()
        const decrypted: AiTaskRoutingConfig = { ...routing }
        for (const task of ['image', 'video', 'audio'] as const) {
          const slot = decrypted[task]
          if (slot?.media?.apiKey) {
            const { apiKey } = await decryptApiKeyField(slot.media)
            slot.media = { ...slot.media, apiKey }
          }
        }
        setRouting(decrypted)
        setRoutingProviders(getTaskRoutingProviders())
      })()
    }
  }, [open])

  const updateMediaType = (type: string) => {
    const info = MEDIA_PROVIDER_INFO[type]
    setMediaProvider((prev) => ({
      ...prev,
      type: type as MediaProviderConfig['type'],
      // 切换服务商时自动填入推荐的 API 地址和模型名，用户无需手动查
      apiUrl: info.defaultApiUrl,
      model: info.defaultModel,
    }))
    setMediaTestResult(null)
  }

  // 媒体生成连通性测试：用最小尺寸生成一张图，验证配置是否可用
  const testMediaConnection = async () => {
    setMediaTesting(true)
    setMediaTestResult(null)
    try {
      const { generateMedia } = await import('@editor/lib/ai')
      await generateMedia(
        { prompt: 'a red apple, simple test', width: 512, height: 512 },
        mediaProvider
      )
      setMediaTestResult({ ok: true, message: '配置可用，测试图片已生成' })
    } catch (e) {
      const raw = e instanceof Error ? e.message : '未知错误'
      // 翻译常见错误为人话
      let friendly = raw
      if (/401|unauthorized|invalid api key/i.test(raw)) friendly = 'API Key 无效，请检查是否复制完整（去前后空格）'
      else if (/403|forbidden/i.test(raw)) friendly = 'API Key 无权限或已欠费，请到服务商后台检查'
      else if (/Failed to fetch|NetworkError|load failed/i.test(raw)) friendly = '无法连接服务，请检查 API 地址是否正确、网络是否通畅（OpenAI/Stability 需翻墙）'
      else if (/model/i.test(raw) && /not found|invalid|unsupported/i.test(raw)) friendly = '模型名错误，请到服务商后台查看支持的模型名'
      else if (/balance|quota|insufficient/i.test(raw)) friendly = '账号余额不足，请先充值'
      setMediaTestResult({ ok: false, message: friendly })
    }
    setMediaTesting(false)
  }

  const updateProvider = (provider: string) => {
    const info = PROVIDER_INFO[provider]
    setAiConfig((prev) => ({
      ...prev,
      provider,
      apiUrl: info.apiUrl,
      model: getDefaultModel(provider),
    }))
    setTestResult(null)
  }

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const apiKey = await decryptAiKey(aiConfig.apiKey)
      const resp = await fetch(aiConfig.apiUrl + '/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (resp.ok) {
        setTestResult({ ok: true, message: '连接成功，可以开始使用了' })
      } else {
        // 翻译 HTTP 状态码为人话
        const status = resp.status
        let friendly = `连接失败 (${status})`
        if (status === 401) friendly = 'API Key 无效，请检查是否复制完整（去前后空格）'
        else if (status === 403) friendly = 'API Key 无权限或已欠费，请到服务商后台检查'
        else if (status === 404) friendly = 'API 地址错误，请确认服务商地址未改'
        else if (status === 429) friendly = '请求太频繁或额度用完，请稍后再试或充值'
        setTestResult({ ok: false, message: friendly })
      }
    } catch {
      setTestResult({ ok: false, message: '无法连接，请检查网络（OpenAI/Anthropic/Google 需翻墙），或 API 地址是否正确' })
    }
    setTesting(false)
  }

  const handleSave = async () => {
    const config = { ...aiConfig, enabled: aiEnabled }
    // 落盘前 AES-256 加密全部 apiKey
    await saveAiConfigEncrypted(config)
    refreshAiConfig()
    // 媒体配置收敛：统一写入任务路由 image 槽（不再写旧全局配置，旧全局仅作读取回退）
    // 有有效配置（apiKey，或 ComfyUI 工作流——ComfyUI 无 apiKey 但需持久化工作流）才落槽；
    // 空配置则清空槽位，保留「未配置 → 回退旧全局配置」的回退链
    const hasMedia = mediaProvider.apiKey.trim() || mediaProvider.type === 'comfyui'
    const nextRouting: AiTaskRoutingConfig = {
      ...routing,
      image: { ...routing.image, media: hasMedia ? mediaProvider : undefined },
    }
    // 保存任务路由配置（内部对媒体槽 apiKey 加密）
    await saveTaskRoutingConfig(nextRouting)
    showToast('success', `${assistantName}设置已保存`)
    onClose()
  }

  const currentProvider = PROVIDER_INFO[aiConfig.provider]

  // 技能模板选择器（通过 Portal 渲染到 body，绕过 overflow-y-auto 容器裁剪）
  const renderSkillPicker = (task: string, onPick: (prompt: string) => void) => {
    const templates = getSkillTemplatesForTask(task as never)
    if (templates.length === 0) return null
    const isOpen = skillPickerOpen === task
    return (
      <div className="relative">
        <button
          onClick={(e) => {
            if (isOpen) {
              setSkillPickerOpen(null)
            } else {
              const rect = e.currentTarget.getBoundingClientRect()
              setPickerPos({ top: rect.bottom + 4, left: rect.left })
              setSkillPickerOpen(task)
            }
          }}
          className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300"
        >
          <Sparkles className="w-3 h-3" />
          技能模板
        </button>
        {isOpen && pickerPos && createPortal(
          <>
            <div className="fixed inset-0 z-[99]" onClick={() => setSkillPickerOpen(null)} />
            <div
              className="fixed z-[100] w-72 max-h-60 overflow-y-auto rounded border border-border bg-muted shadow-xl"
              style={{ top: pickerPos.top, left: pickerPos.left }}
            >
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    onPick(t.skillPrompt)
                    setSkillPickerOpen(null)
                  }}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-secondary border-b border-border/50 last:border-0"
                >
                  <p className="text-[11px] font-medium text-cyan-300">{t.name}</p>
                  <p className="text-[9px] text-muted-foreground leading-relaxed">{t.desc}</p>
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
      </div>
    )
  }

  // 渲染文本类任务槽（editor / text）
  const renderTextSlot = (task: 'editor' | 'text', label: string, desc: string) => {
    const slot = routing[task] as TaskTextSlot
    const useCustom = !!(slot.providerId || slot.skillPrompt || slot.temperature != null || slot.maxTokens != null)
    return (
      <div className="p-2 rounded border border-border/60 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-foreground">{label}</span>
          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={useCustom}
              onChange={(e) => {
                if (e.target.checked) {
                  updateTextSlot(task, { providerId: routingProviders[0]?.id })
                } else {
                  updateTextSlot(task, { providerId: undefined, skillPrompt: undefined, temperature: undefined, maxTokens: undefined })
                }
              }}
              className="accent-cyan-500"
            />
            独立配置
          </label>
        </div>
        <p className="text-[9px] text-muted-foreground leading-relaxed">{desc}</p>
        {useCustom && (
          <>
            <select
              value={slot.providerId || ''}
              onChange={(e) => updateTextSlot(task, { providerId: e.target.value || undefined })}
              className="w-full h-8 text-xs rounded border border-border bg-secondary px-2 text-white"
            >
              <option value="">智能默认（第一个启用服务商）</option>
              {routingProviders.map((p) => (
                <option key={p.id} value={p.id}>{p.name} · {p.model}</option>
              ))}
            </select>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">技能指令</span>
                {renderSkillPicker(task, (p) => updateTextSlot(task, { skillPrompt: p }))}
              </div>
              <textarea
                value={slot.skillPrompt || ''}
                onChange={(e) => updateTextSlot(task, { skillPrompt: e.target.value })}
                placeholder="给该任务注入的额外系统提示词（可选），或点上方「技能模板」一键套用"
                rows={2}
                className="w-full text-[10px] rounded border border-border bg-secondary px-2 py-1.5 text-white placeholder:text-muted-foreground resize-y"
              />
            </div>
            <div className="flex gap-2">
              <label className="flex-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                温度
                <input
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={slot.temperature ?? ''}
                  onChange={(e) => updateTextSlot(task, { temperature: e.target.value === '' ? undefined : Number(e.target.value) })}
                  placeholder="默认"
                  className="w-full h-7 text-xs rounded border border-border bg-secondary px-2 text-white placeholder:text-muted-foreground"
                />
              </label>
              <label className="flex-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                最大 token
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={slot.maxTokens ?? ''}
                  onChange={(e) => updateTextSlot(task, { maxTokens: e.target.value === '' ? undefined : Number(e.target.value) })}
                  placeholder="默认"
                  className="w-full h-7 text-xs rounded border border-border bg-secondary px-2 text-white placeholder:text-muted-foreground"
                />
              </label>
            </div>
          </>
        )}
      </div>
    )
  }

  // 渲染媒体类任务槽（image / video / audio）
  const renderMediaSlot = (task: 'image' | 'video' | 'audio', label: string, desc: string) => {
    const media = routing[task].media
    const useCustom = !!media
    const isComfyui = media?.type === 'comfyui'
    return (
      <div className="p-2 rounded border border-border/60 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-foreground flex items-center gap-1.5">
            {task === 'image' ? <Image className="w-3 h-3 text-gold-400" /> : task === 'video' ? <Wand2 className="w-3 h-3 text-purple-400" /> : <Music className="w-3 h-3 text-green-400" />}
            {label}
          </span>
          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={useCustom}
              onChange={(e) => {
                if (e.target.checked) {
                  updateMediaSlot(task, { media: { type: 'wan', apiKey: '', apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'wanx2.1-t2i-turbo' } })
                } else {
                  updateMediaSlot(task, { media: undefined })
                }
              }}
              className="accent-cyan-500"
            />
            独立配置
          </label>
        </div>
        <p className="text-[9px] text-muted-foreground leading-relaxed">{desc}</p>
        {useCustom && media && (
          <>
            <select
              value={media.type}
              onChange={(e) => {
                const newType = e.target.value as MediaProviderConfig['type']
                // 切换到 comfyui 时自动填入默认地址
                if (newType === 'comfyui') {
                  updateSlotMedia(task, { type: newType, apiUrl: 'http://localhost:8188', apiKey: '', model: '' })
                } else {
                  updateSlotMedia(task, { type: newType, workflowJson: undefined })
                }
              }}
              className="w-full h-8 text-xs rounded border border-border bg-secondary px-2 text-white"
            >
              <option value="wan">通义万相（国内直连）</option>
              <option value="openai">OpenAI（需翻墙）</option>
              <option value="stability">Stability AI</option>
              <option value="custom">自定义（OpenAI 兼容）</option>
              <option value="comfyui">ComfyUI（本地高级）</option>
            </select>

            {/* ComfyUI 专属配置：独立面板入口 */}
            {isComfyui ? (
              <div className="space-y-1.5 p-2 rounded border border-gold-400/20 bg-gold-400/5">
                <p className="text-[10px] text-gold-400 leading-relaxed">
                  ComfyUI 需本地部署。编辑器自动注入 prompt（CLIPTextEncode）和参考图（LoadImage）。
                </p>
                <button
                  onClick={() => setComfyEditor(task)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs bg-gold-400/20 hover:bg-gold-400/30 text-gold-400 rounded transition-colors"
                >
                  <Settings2 className="w-3 h-3" />
                  {media.workflowJson ? '编辑工作流' : '配置工作流'}
                </button>
              </div>
            ) : (
              <>
                {/* 非ComfyUI的标准配置 */}
                <div className="relative">
                  <input
                    type={routingMediaKeys[task] ? 'text' : 'password'}
                    value={media.apiKey || ''}
                    onChange={(e) => updateSlotMedia(task, { apiKey: e.target.value })}
                    placeholder="API Key"
                    className="w-full h-8 text-xs rounded border border-border bg-secondary px-2 pr-12 text-white placeholder:text-muted-foreground"
                  />
                  <button
                    onClick={() => setRoutingMediaKeys((prev) => ({ ...prev, [task]: !prev[task] }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    {routingMediaKeys[task] ? '隐藏' : '显示'}
                  </button>
                </div>
                {media.type !== 'openai' && media.type !== 'stability' && (
                  <input
                    value={media.apiUrl || ''}
                    onChange={(e) => updateSlotMedia(task, { apiUrl: e.target.value })}
                    placeholder="API 地址，如 https://dashscope.aliyuncs.com/compatible-mode/v1"
                    className="w-full h-8 text-xs rounded border border-border bg-secondary px-2 text-white placeholder:text-muted-foreground"
                  />
                )}
                <input
                  value={media.model || ''}
                  onChange={(e) => updateSlotMedia(task, { model: e.target.value })}
                  placeholder="模型名，如 wanx2.1-t2i-turbo"
                  className="w-full h-8 text-xs rounded border border-border bg-secondary px-2 text-white placeholder:text-muted-foreground"
                />
              </>
            )}

            {/* 技能指令（所有服务商通用） */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">技能指令</span>
                {renderSkillPicker(task, (p) => updateMediaSlot(task, { skillPrompt: p }))}
              </div>
              <textarea
                value={routing[task].skillPrompt || ''}
                onChange={(e) => updateMediaSlot(task, { skillPrompt: e.target.value })}
                placeholder={isComfyui ? "附加风格指令（可选），如 'anime style, masterpiece'" : "如「统一 3D 卡通风格」（可选）"}
                rows={2}
                className="w-full text-[10px] rounded border border-border bg-secondary px-2 py-1.5 text-white placeholder:text-muted-foreground resize-y"
              />
            </div>
          </>
        )}
      </div>
    )
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="yasgui-panel rounded-xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-gold-400/30 to-cyan-400/30 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-gold-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold yasgui-gradient-text leading-tight">{assistantName}服务设置</h3>
              <p className="text-[9px] text-muted-foreground leading-none">创作搭档 · 配置对话与媒体生成服务</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-white">启用{assistantName}</p>
              <p className="text-[10px] text-muted-foreground">开启后将使用{assistantName}辅助创作</p>
            </div>
            <button
              onClick={() => setAiEnabled(!aiEnabled)}
              className={`w-10 h-5 rounded-full transition-colors ${
                aiEnabled ? 'bg-gradient-to-r from-gold-400 to-gold-500 shadow shadow-amber-500/30' : 'bg-slate-600'
              }`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                aiEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {aiEnabled && (
            <>
              {/* 新手三步引导 */}
              <div className="bg-gold-400/5 border border-gold-400/20 rounded-lg p-2.5 space-y-1">
                <p className="text-[10px] text-gold-400 font-medium">📖 第一次使用？三步搞定：</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  <span className="text-gold-400">①</span> 点下方链接注册账号 →
                  <span className="text-gold-400"> ②</span> 创建 API Key 并复制 →
                  <span className="text-gold-400"> ③</span> 粘贴到下方框框，点「测试连接」
                </p>
              </div>

              {/* Provider */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">服务商</label>
                <select
                  value={aiConfig.provider}
                  onChange={(e) => updateProvider(e.target.value)}
                  className="w-full h-8 text-xs rounded border border-border bg-secondary px-2 text-white"
                >
                  {/* 推荐项排在前面 */}
                  {Object.entries(PROVIDER_INFO)
                    .sort(([, a], [, b]) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0))
                    .map(([key, info]) => (
                      <option key={key} value={key}>{info.name}</option>
                    ))}
                </select>
                {currentProvider && (
                  <>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{currentProvider.desc}</p>
                    <a
                      href={currentProvider.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-gold-400 hover:text-gold-400"
                    >
                      <ExternalLink className="w-3 h-3" />
                      点这里去注册 / 申请 API Key →
                    </a>
                  </>
                )}
              </div>

              {/* API Key */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">API Key</label>
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={aiConfig.apiKey}
                      onChange={(e) => {
                        setAiConfig((prev) => ({ ...prev, apiKey: e.target.value }))
                        setTestResult(null)
                      }}
                      placeholder="粘贴你刚才复制的 API Key"
                      className="w-full h-8 text-xs rounded border border-border bg-secondary px-2 pr-16 text-white"
                    />
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      {showApiKey ? '隐藏' : '显示'}
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Key 加密存储在本机，不上传服务器。若更换浏览器或屏幕分辨率变化导致无法识别，请重新填写。
                </p>
              </div>

              {/* API URL */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">API 地址</label>
                <div className="flex gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-2" />
                  <input
                    value={aiConfig.apiUrl}
                    onChange={(e) => {
                      setAiConfig((prev) => ({ ...prev, apiUrl: e.target.value }))
                      setTestResult(null)
                    }}
                    className="flex-1 h-8 text-xs rounded border border-border bg-secondary px-2 text-white"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">通常无需修改，切换服务商时已自动填好</p>
              </div>

              {/* Model */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">模型</label>
                <select
                  value={aiConfig.model}
                  onChange={(e) => setAiConfig((prev) => ({ ...prev, model: e.target.value }))}
                  className="w-full h-8 text-xs rounded border border-border bg-secondary px-2 text-white"
                >
                  {getModelsForProvider(aiConfig.provider).map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground">
                  切换服务商后模型会自动更新为推荐型号
                </p>
              </div>

              {/* Test Connection */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={testConnection}
                  disabled={testing || !aiConfig.apiKey}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gold-400 text-amber-950 hover:bg-amber-400 rounded transition-colors disabled:opacity-50"
                >
                  {testing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Globe className="w-3 h-3" />
                  )}
                  测试连接
                </button>
                {testResult && (
                  <span className={`text-xs flex items-center gap-1 ${
                    testResult.ok ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {testResult.ok && <CheckCircle2 className="w-3 h-3" />}
                    {testResult.message}
                  </span>
                )}
              </div>
            </>
          )}

          {/* 媒体生成（图片/视频）配置 —— 独立于文本 AI，可单独配置 */}
          <div className="border-t border-border pt-3 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-400/25 to-cyan-400/10 flex items-center justify-center">
                <Image className="w-3.5 h-3.5 text-cyan-300" />
              </div>
              <span className="text-xs font-semibold text-white">图片/视频生成</span>
              <span className="text-[9px] text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded">可选</span>
            </div>
            <p className="text-[10px] text-muted-foreground -mt-2 leading-relaxed">
              这是<span className="text-muted-foreground">可选功能</span>。不配置也能用 AI 写故事、建节点。
              <br />配置后 AI 才能自动生成图片/视频。密钥仅存本地，不会上传。
              <br />首次使用建议选「通义万相」，国内注册即送免费额度。
              <br />此配置会保存到下方「AI 任务路由」的<span className="text-muted-foreground">图片生成</span>槽（统一入口）；
              视频/音乐可在任务路由中单独配置，未配置时视频回退旧全局配置（历史数据）。
            </p>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">选择服务商</label>
              <select
                value={mediaProvider.type}
                onChange={(e) => updateMediaType(e.target.value)}
                className="w-full h-8 text-xs rounded border border-border bg-secondary px-2 text-white"
              >
                {/* 推荐项在前 */}
                {Object.entries(MEDIA_PROVIDER_INFO)
                  .filter(([, info]) => !info.advanced)
                  .map(([key, info]) => (
                    <option key={key} value={key}>{info.name}</option>
                  ))}
                {showAdvancedMedia && Object.entries(MEDIA_PROVIDER_INFO)
                  .filter(([, info]) => info.advanced)
                  .map(([key, info]) => (
                    <option key={key} value={key}>{info.name}</option>
                  ))}
              </select>
              <p className="text-[10px] text-muted-foreground leading-relaxed">{MEDIA_PROVIDER_INFO[mediaProvider.type]?.desc}</p>
              {MEDIA_PROVIDER_INFO[mediaProvider.type]?.website && (
                <a
                  href={MEDIA_PROVIDER_INFO[mediaProvider.type].website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300"
                >
                  <ExternalLink className="w-3 h-3" />
                  点这里去申请 API Key →
                </a>
              )}
            </div>

            {/* 高级模式切换 */}
            <button
              onClick={() => setShowAdvancedMedia(!showAdvancedMedia)}
              className="text-[10px] text-muted-foreground hover:text-foreground underline"
            >
              {showAdvancedMedia ? '收起高级选项' : '显示高级选项（自定义服务 / ComfyUI）'}
            </button>

            {mediaProvider.type !== 'comfyui' && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">API Key</label>
                <div className="relative">
                  <input
                    type={showMediaKey ? 'text' : 'password'}
                    value={mediaProvider.apiKey}
                    onChange={(e) => {
                      setMediaProvider((prev) => ({ ...prev, apiKey: e.target.value }))
                      setMediaTestResult(null)
                    }}
                    placeholder="粘贴你刚才申请的 API Key"
                    className="w-full h-8 text-xs rounded border border-border bg-secondary px-2 pr-12 text-white"
                  />
                  <button
                    onClick={() => setShowMediaKey(!showMediaKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    {showMediaKey ? '隐藏' : '显示'}
                  </button>
                </div>
              </div>
            )}

            {mediaProvider.type !== 'openai' && mediaProvider.type !== 'stability' && mediaProvider.type !== 'comfyui' && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">API 地址</label>
                <input
                  value={mediaProvider.apiUrl}
                  onChange={(e) => {
                    setMediaProvider((prev) => ({ ...prev, apiUrl: e.target.value }))
                    setMediaTestResult(null)
                  }}
                  placeholder="https://..."
                  className="w-full h-8 text-xs rounded border border-border bg-secondary px-2 text-white"
                />
                <p className="text-[10px] text-muted-foreground">通常无需修改，切换服务商时已自动填好</p>
              </div>
            )}

            {mediaProvider.type !== 'comfyui' && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">模型名</label>
                <input
                  value={mediaProvider.model}
                  onChange={(e) => {
                    setMediaProvider((prev) => ({ ...prev, model: e.target.value }))
                    setMediaTestResult(null)
                  }}
                  placeholder="已自动填好，一般不用改"
                  className="w-full h-8 text-xs rounded border border-border bg-secondary px-2 text-white"
                />
                <p className="text-[10px] text-muted-foreground">已自动填好推荐模型，一般不用改</p>
              </div>
            )}

            {/* 测试连接 —— 配错能立刻发现 */}
            {mediaProvider.type !== 'comfyui' && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={testMediaConnection}
                  disabled={mediaTesting || !mediaProvider.apiKey}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-cyan-500 text-cyan-950 hover:bg-cyan-400 rounded transition-colors disabled:opacity-50"
                >
                  {mediaTesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Image className="w-3 h-3" />}
                  测试生成
                </button>
                {mediaTestResult && (
                  <span className={`text-xs flex items-center gap-1 ${mediaTestResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                    {mediaTestResult.ok && <CheckCircle2 className="w-3 h-3" />}
                    {mediaTestResult.message}
                  </span>
                )}
              </div>
            )}

            {/* ComfyUI 无 API Key：指引到下方「高级设置」配置工作流 */}
            {mediaProvider.type === 'comfyui' && (
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                已选 ComfyUI 服务商。工作流配置收在下方「高级设置」区，展开后即可配置。
              </p>
            )}
          </div>

          {/* 高级设置（默认收起）：收纳 ComfyUI 工作流 / 任务路由 / 自定义工作流等进阶配置 */}
          <div className="border-t border-border pt-3 space-y-3">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center gap-2 text-left"
            >
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-400/25 to-cyan-400/10 flex items-center justify-center shrink-0">
                <Settings2 className="w-3.5 h-3.5 text-cyan-300" />
              </div>
              <span className="text-xs font-semibold text-white">高级设置</span>
              <span className="text-[9px] text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded">高级</span>
              <span className={`ml-auto text-muted-foreground transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>▾</span>
            </button>
            <p className="text-[10px] text-muted-foreground -mt-1.5 leading-relaxed">
              以下为进阶配置：不修改也能正常使用全部基础功能，新手建议保持默认。
            </p>

            {showAdvanced && (
              <div className="space-y-3">
                {/* ComfyUI 专属配置（高级）：独立面板入口（选择 ComfyUI 服务商后出现） */}
                {mediaProvider.type === 'comfyui' && (
                  <div className="space-y-1.5 p-2 rounded border border-gold-400/20 bg-gold-400/5">
                    <p className="text-[10px] text-gold-400 leading-relaxed">
                      ⚠️ ComfyUI 需要你已在本地装好 ComfyUI。新手请选「通义万相」。
                    </p>
                    <button
                      onClick={() => setComfyEditor('legacy')}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs bg-gold-400/20 hover:bg-gold-400/30 text-gold-400 rounded transition-colors"
                    >
                      <Settings2 className="w-3 h-3" />
                      {mediaProvider.workflowJson ? '编辑工作流' : '配置工作流'}
                    </button>
                  </div>
                )}
                {/* AI 任务路由（高级）：不同创作任务用不同模型 */}
                <div className="space-y-3">
            <button
              onClick={() => setShowRouting(!showRouting)}
              className="w-full flex items-center gap-2 text-left"
            >
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-400/25 to-cyan-400/10 flex items-center justify-center shrink-0">
                <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-300" />
              </div>
              <span className="text-xs font-semibold text-white">AI 任务路由</span>
              <span className="text-[9px] text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded">高级</span>
              <span className={`ml-auto text-muted-foreground transition-transform ${showRouting ? 'rotate-180' : ''}`}>▾</span>
            </button>
            <p className="text-[10px] text-muted-foreground -mt-1.5 leading-relaxed">
              默认智能分配：所有 AI 功能共用你上面配置的服务商，开箱即用。
              <br />如需让「编辑器操作 / 文本生成 / 图片 / 视频 / 音乐」各用不同的模型，逐个打开「独立配置」即可。
              <br />每个任务还可设置专属技能指令（系统提示词），实现"植入技能"的效果。
            </p>

            {showRouting && (
              <div className="space-y-3">
                {/* 文本类任务槽：editor / text */}
                {renderTextSlot(
                  'editor',
                  '编辑器操作',
                  'AI 对话面板：写故事、建节点、连线、生成命令'
                )}
                {renderTextSlot(
                  'text',
                  '文本生成',
                  '润色、续写、大纲、角色设定、故事生成等'
                )}

                {/* 媒体类任务槽：image / video / audio */}
                {renderMediaSlot('image', '图片生成', '角色立绘、背景图、CG 过场')}
                {renderMediaSlot('video', '视频生成', '文生视频（需云端视频 API）')}
                {renderMediaSlot('audio', '音乐 / 音效', '音乐、音效、语音（OpenAI 兼容音频接口）')}

                <p className="text-[9px] text-muted-foreground leading-relaxed">
                  提示：媒体配置以任务路由槽为统一入口——上方「图片/视频生成」区实际编辑「图片生成」槽；
                  槽未配置时，图片/视频回退旧全局配置（历史数据），音乐/音效无回退、必须独立配置。
                </p>
              </div>
            )}
          </div>

                {/* 自定义工作流（Skill）CRUD：生图 / 生视频 / 生文字 */}
                <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowWorkflows(!showWorkflows)}
                  className="flex items-center gap-2 text-left"
                >
                  <div className="w-6 h-6 rounded-md bg-gradient-to-br from-yellow-400/25 to-gold-300/10 flex items-center justify-center shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-white">自定义工作流（Skill）</span>
                    <span className="text-[9px] text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded">v1.16</span>
                  </div>
                </button>
                <button
                  onClick={() => setShowWorkflows(!showWorkflows)}
                  className={`p-1 rounded hover:bg-muted text-muted-foreground transition-transform ${showWorkflows ? 'rotate-180' : ''}`}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground -mt-1 leading-relaxed">
                把你反复调的参数组合（风格 / 画幅 / 时长 / 系统提示词 / 温度）保存成工作流，
                在任意生成入口一键套用；内置 3 条模板可直接克隆改造。
              </p>
            </div>

            {showWorkflows && (
              <div className="space-y-3">
                {/* 分类 Tab：image / video / text */}
                <div className="flex rounded-md border border-border bg-card/40 p-0.5">
                  {(['image', 'video', 'text'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setWfTaskType(t)}
                      className={`flex-1 px-2 py-1 rounded text-[11px] transition-colors ${
                        wfTaskType === t
                          ? t === 'text'
                            ? 'bg-green-500/15 text-green-300 border border-green-500/30'
                            : t === 'video'
                            ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                            : 'bg-primary/15 text-primary/80 border border-primary/30'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {t === 'image' ? '生图' : t === 'video' ? '生视频' : '生文字'}
                      <span className="text-[9px] opacity-70 ml-1">
                        ({allWorkflows.filter((x) => x.taskType === t).length})
                      </span>
                    </button>
                  ))}
                </div>

                {/* 表单：新建 / 编辑共用 */}
                <div className="p-3 rounded-md border border-border bg-card/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium text-foreground">
                      {editingWfId ? `编辑工作流：${getCustomWorkflow(editingWfId)?.name || ''}` : `新建${wfTaskType === 'image' ? '生图' : wfTaskType === 'video' ? '生视频' : '生文字'}工作流`}
                    </p>
                    {editingWfId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingWfId(null)
                          setWfDraft({ name: '', desc: '', sys: '', t: 0.7, maxT: 1024, style: 'anime', ratio: '16:9' as const, d: 5, seed: '', kw: '', skill: '' })
                        }}
                        className="text-[9px] text-muted-foreground hover:text-foreground"
                      >
                        取消编辑
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        value={wfDraft.name}
                        onChange={(e) => setWfDraft({ ...wfDraft, name: e.target.value })}
                        placeholder="工作流名（≤ 24 字）"
                        className="flex-1 px-2 py-1.5 text-[11px] rounded bg-muted border border-border text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!wfDraft.name.trim()) {
                            showToast('error', '请先填写工作流名')
                            return
                          }
                          if (editingWfId) {
                            const patch = buildPatchFromDraft(wfTaskType, wfDraft)
                            const r = updateCustomWorkflow(editingWfId, patch)
                            if (!r) showToast('error', '内置工作流不可直接修改，请先克隆副本再编辑')
                            else {
                              showToast('success', `已更新：${r.name}`)
                              setEditingWfId(null)
                            }
                          } else {
                            const draft = buildDraftFromState(wfTaskType, wfDraft)
                            const created = createCustomWorkflow(draft)
                            showToast('success', `已创建工作流「${created.name}」`)
                            setWfDraft({ name: '', desc: '', sys: '', t: 0.7, maxT: 1024, style: 'anime', ratio: '16:9', d: 5, seed: '', kw: '', skill: '' })
                          }
                        }}
                        className="px-3 py-1.5 text-[11px] rounded bg-gold-400/15 text-gold-400 border border-gold-400/30 hover:bg-gold-400/25 transition-colors"
                      >
                        {editingWfId ? '保存修改' : '+ 新建工作流'}
                      </button>
                    </div>
                    <textarea
                      value={wfDraft.desc}
                      onChange={(e) => setWfDraft({ ...wfDraft, desc: e.target.value })}
                      rows={1}
                      placeholder="简短说明（≤ 120 字，可选）：这条工作流解决什么问题"
                      className="w-full px-2 py-1.5 text-[11px] rounded bg-muted border border-border text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-none"
                    />

                    {wfTaskType === 'text' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div className="space-y-1 md:col-span-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-[10px] text-muted-foreground">temperature</Label>
                            <span className="text-[10px] font-mono text-green-300 tabular-nums">{wfDraft.t.toFixed(2)}</span>
                          </div>
                          <input type="range" min={0} max={1.5} step={0.05} value={wfDraft.t}
                            onChange={(e) => setWfDraft({ ...wfDraft, t: parseFloat(e.target.value) })}
                            className="w-full accent-green-500 h-1.5" />
                        </div>
                        <div className="md:col-span-1">
                          <Label className="text-[10px] text-muted-foreground">maxTokens</Label>
                          <input type="number" value={wfDraft.maxT}
                            onChange={(e) => setWfDraft({ ...wfDraft, maxT: Math.max(128, Math.min(16384, parseInt(e.target.value || '0', 10))) })}
                            className="w-full px-2 py-1 mt-1 text-[11px] rounded bg-muted border border-border text-white font-mono" />
                        </div>
                        <div className="md:col-span-2">
                          <Label className="text-[10px] text-muted-foreground">文风关键词（逗号分隔）</Label>
                          <input value={wfDraft.kw} onChange={(e) => setWfDraft({ ...wfDraft, kw: e.target.value })}
                            placeholder="例：克制,细腻,白描,短句分段,少心理"
                            className="w-full px-2 py-1 mt-1 text-[11px] rounded bg-muted border border-border text-white placeholder:text-muted-foreground" />
                        </div>
                        <div className="md:col-span-2">
                          <Label className="text-[10px] text-muted-foreground">系统提示词（技能指令）：决定 AI 会怎么回答</Label>
                          <textarea value={wfDraft.sys} onChange={(e) => setWfDraft({ ...wfDraft, sys: e.target.value })}
                            rows={4} placeholder="1) 段落规则；2) 信息量节奏；3) 钩子设置；4) 禁止出现的内容..."
                            className="w-full px-2 py-1 mt-1 text-[11px] rounded bg-muted border border-border text-white placeholder:text-muted-foreground resize-y leading-relaxed" />
                        </div>
                      </div>
                    )}

                    {(wfTaskType === 'image' || wfTaskType === 'video') && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px] text-muted-foreground">画面风格</Label>
                            <select value={wfDraft.style} onChange={(e) => setWfDraft({ ...wfDraft, style: e.target.value })}
                              className="w-full px-2 py-1 mt-1 text-[11px] rounded bg-muted border border-border text-white">
                              {[
                                { v: 'anime', l: '动漫' },
                                { v: 'realistic', l: '写实' },
                                { v: 'illustration', l: '插画' },
                                { v: 'pixel', l: '像素' },
                                { v: '3d', l: '3D' },
                              ].map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}
                            </select>
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">固定 seed（留空=随机）</Label>
                            <input type="text" value={wfDraft.seed}
                              onChange={(e) => setWfDraft({ ...wfDraft, seed: e.target.value.replace(/[^\d-]/g, '') })}
                              placeholder="例：123456"
                              className="w-full px-2 py-1 mt-1 text-[11px] rounded bg-muted border border-border text-white placeholder:text-muted-foreground font-mono" />
                          </div>
                        </div>
                        {wfTaskType === 'video' && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-[10px] text-muted-foreground">画幅比例</Label>
                              <div className="grid grid-cols-3 gap-1 mt-1">
                                {(['16:9','9:16','1:1'] as const).map((r) => (
                                  <button key={r} type="button" onClick={() => setWfDraft({ ...wfDraft, ratio: r })}
                                    className={`px-1.5 py-1 text-[10px] rounded border transition-colors ${
                                      wfDraft.ratio === r
                                        ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                                        : 'text-muted-foreground border-border hover:text-foreground'
                                    }`}>{r}</button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center justify-between">
                                <Label className="text-[10px] text-muted-foreground">时长</Label>
                                <span className="text-[10px] font-mono text-purple-300 tabular-nums">{wfDraft.d}s</span>
                              </div>
                              <input type="range" min={3} max={10} step={1} value={wfDraft.d}
                                onChange={(e) => setWfDraft({ ...wfDraft, d: parseInt(e.target.value, 10) })}
                                className="w-full accent-purple-500 h-1.5 mt-1" />
                            </div>
                          </div>
                        )}
                        <div>
                          <Label className="text-[10px] text-muted-foreground">技能指令（拼接到生成 prompt 前，优先级最高）</Label>
                          <textarea value={wfDraft.skill} onChange={(e) => setWfDraft({ ...wfDraft, skill: e.target.value })}
                            rows={3}
                            placeholder={wfTaskType === 'image'
                              ? '例：人物必须严格保持参考图脸型和发型；不要出现逆光剪影遮挡五官；画面统一使用冷色调。'
                              : '例：电影感构图，轻微推镜，镜头不晃；情绪随场景进展推进；结尾留出呼吸帧。'}
                            className="w-full px-2 py-1 mt-1 text-[11px] rounded bg-muted border border-border text-white placeholder:text-muted-foreground resize-y leading-relaxed" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 工作流列表（按当前 wfTaskType 分类展示） */}
                <WorkflowListByTask taskType={wfTaskType}
                  onEdit={(wf) => {
                    setEditingWfId(wf.id)
                    // 把当前工作流字段回填到 draft state
                    const wfText = wf.taskType === 'text' ? wf.text : undefined
                    const wfMedia = (wf.taskType === 'image' || wf.taskType === 'video') ? wf.media : undefined
                    setWfDraft({
                      name: wf.name,
                      desc: wf.description || '',
                      sys: wfText?.systemPrompt || '',
                      t: wfText?.temperature ?? 0.7,
                      maxT: wfText?.maxTokens ?? 1024,
                      kw: wfText?.styleKeywords || '',
                      skill: wfMedia?.skillPrompt || '',
                      style: wfMedia?.style || 'anime',
                      ratio: (wfMedia?.ratio as '16:9' | '9:16' | '1:1' | undefined) ?? '16:9',
                      d: wfMedia?.durationSec ?? 5,
                      seed: wfMedia?.seedLock != null ? String(wfMedia.seedLock) : '',
                    })
                  }}
                  onClone={(wf) => {
                    const c = cloneCustomWorkflow(wf.id)
                    if (c) showToast('success', `已克隆为「${c.name}」，可编辑修改`)
                  }}
                  onDelete={(wf) => {
                    if (deleteCustomWorkflow(wf.id)) showToast('success', `已删除工作流「${wf.name}」`)
                    else showToast('error', '内置工作流不可删除，可先克隆再编辑自定义副本')
                  }}
                />

                <div className="flex items-center justify-between">
                  <p className="text-[9px] text-muted-foreground">
                    提示：内置工作流（标签「内置」）保持不可改名不可删除；想改造请先「克隆」。
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('确定要重置所有自定义工作流吗？内置模板会恢复，自定义会被清空。')) {
                        resetCustomWorkflows()
                        setEditingWfId(null)
                        showToast('success', '工作流已重置')
                      }
                    }}
                    className="text-[9px] text-muted-foreground hover:text-red-400 transition-colors"
                  >
                    重置为内置默认
                  </button>
                </div>
              </div>
            )}
          </div>
              </div>
            )}
          </div>
        </div>
        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-xs font-medium bg-gradient-to-br from-gold-400 to-gold-500 hover:brightness-110 text-white rounded shadow-lg shadow-gold-400/20 transition-all"
          >
            保存设置
          </button>
        </div>
      </div>

      {/* ComfyUI 工作流独立编辑面板 */}
      <ComfyuiWorkflowDialog
        open={comfyEditor !== null}
        initialApiUrl={comfyEditor === 'legacy'
          ? mediaProvider.apiUrl || 'http://localhost:8188'
          : comfyEditor
            ? routing[comfyEditor].media?.apiUrl || 'http://localhost:8188'
            : 'http://localhost:8188'}
        initialWorkflowJson={comfyEditor === 'legacy'
          ? mediaProvider.workflowJson
          : comfyEditor
            ? routing[comfyEditor].media?.workflowJson
            : undefined}
        onClose={() => setComfyEditor(null)}
        onSave={(data) => {
          if (comfyEditor === 'legacy') {
            setMediaProvider((prev) => ({ ...prev, apiUrl: data.apiUrl, workflowJson: data.workflowJson }))
          } else if (comfyEditor) {
            updateSlotMedia(comfyEditor, { apiUrl: data.apiUrl, workflowJson: data.workflowJson })
          }
        }}
      />
    </div>
  )
}