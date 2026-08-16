'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, Cpu, ExternalLink, Globe, Image, Loader2, Music, Settings2, SlidersHorizontal, Sparkles, Wand2, X } from 'lucide-react'
import { showToast } from './toast'
import { ComfyuiWorkflowDialog } from './comfyui-workflow-dialog'
import {
  type AiProviderConfig,
  type AiTaskRoutingConfig,
  type MediaProviderConfig,
  type TaskMediaSlot,
  type TaskTextSlot,
  getMediaProviderConfig,
  getSkillTemplatesForTask,
  getTaskRoutingConfig,
  getTaskRoutingProviders,
  refreshAiConfig,
  saveMediaProviderConfig,
  saveTaskRoutingConfig,
} from '@editor/lib/ai'
import { getDefaultModel, getModelsForProvider } from '@editor/lib/ai/model-presets'
import { decryptAiConfig, decryptApiKeyField, decryptAiKey } from '@editor/lib/ai/ai-key-vault'
import { saveAiConfigEncrypted } from '@editor/lib/ai/ai-config-store'
import { useAssistantName } from '@editor/lib/assistant-name'

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
        // 加载媒体生成配置
        const mp = getMediaProviderConfig()
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
    // 保存媒体生成配置（有 apiKey，或 ComfyUI 工作流——ComfyUI 无 apiKey 但需持久化工作流）
    if (mediaProvider.apiKey.trim() || mediaProvider.type === 'comfyui') {
      await saveMediaProviderConfig(mediaProvider)
    }
    // 保存任务路由配置（内部对媒体槽 apiKey 加密）
    await saveTaskRoutingConfig(routing)
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
              className="fixed z-[100] w-72 max-h-60 overflow-y-auto rounded border border-slate-600 bg-slate-800 shadow-xl"
              style={{ top: pickerPos.top, left: pickerPos.left }}
            >
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    onPick(t.skillPrompt)
                    setSkillPickerOpen(null)
                  }}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-slate-700 border-b border-slate-700/50 last:border-0"
                >
                  <p className="text-[11px] font-medium text-cyan-300">{t.name}</p>
                  <p className="text-[9px] text-slate-500 leading-relaxed">{t.desc}</p>
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
      <div className="p-2 rounded border border-slate-700/60 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-300">{label}</span>
          <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer select-none">
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
        <p className="text-[9px] text-slate-500 leading-relaxed">{desc}</p>
        {useCustom && (
          <>
            <select
              value={slot.providerId || ''}
              onChange={(e) => updateTextSlot(task, { providerId: e.target.value || undefined })}
              className="w-full h-8 text-xs rounded border border-slate-600 bg-slate-700 px-2 text-white"
            >
              <option value="">智能默认（第一个启用服务商）</option>
              {routingProviders.map((p) => (
                <option key={p.id} value={p.id}>{p.name} · {p.model}</option>
              ))}
            </select>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400">技能指令</span>
                {renderSkillPicker(task, (p) => updateTextSlot(task, { skillPrompt: p }))}
              </div>
              <textarea
                value={slot.skillPrompt || ''}
                onChange={(e) => updateTextSlot(task, { skillPrompt: e.target.value })}
                placeholder="给该任务注入的额外系统提示词（可选），或点上方「技能模板」一键套用"
                rows={2}
                className="w-full text-[10px] rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-white placeholder:text-slate-500 resize-y"
              />
            </div>
            <div className="flex gap-2">
              <label className="flex-1 flex items-center gap-1.5 text-[10px] text-slate-400">
                温度
                <input
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={slot.temperature ?? ''}
                  onChange={(e) => updateTextSlot(task, { temperature: e.target.value === '' ? undefined : Number(e.target.value) })}
                  placeholder="默认"
                  className="w-full h-7 text-xs rounded border border-slate-600 bg-slate-700 px-2 text-white placeholder:text-slate-500"
                />
              </label>
              <label className="flex-1 flex items-center gap-1.5 text-[10px] text-slate-400">
                最大 token
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={slot.maxTokens ?? ''}
                  onChange={(e) => updateTextSlot(task, { maxTokens: e.target.value === '' ? undefined : Number(e.target.value) })}
                  placeholder="默认"
                  className="w-full h-7 text-xs rounded border border-slate-600 bg-slate-700 px-2 text-white placeholder:text-slate-500"
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
      <div className="p-2 rounded border border-slate-700/60 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
            {task === 'image' ? <Image className="w-3 h-3 text-amber-400" /> : task === 'video' ? <Wand2 className="w-3 h-3 text-purple-400" /> : <Music className="w-3 h-3 text-green-400" />}
            {label}
          </span>
          <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer select-none">
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
        <p className="text-[9px] text-slate-500 leading-relaxed">{desc}</p>
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
              className="w-full h-8 text-xs rounded border border-slate-600 bg-slate-700 px-2 text-white"
            >
              <option value="wan">通义万相（国内直连）</option>
              <option value="openai">OpenAI（需翻墙）</option>
              <option value="stability">Stability AI</option>
              <option value="custom">自定义（OpenAI 兼容）</option>
              <option value="comfyui">ComfyUI（本地高级）</option>
            </select>

            {/* ComfyUI 专属配置：独立面板入口 */}
            {isComfyui ? (
              <div className="space-y-1.5 p-2 rounded border border-amber-500/20 bg-amber-500/5">
                <p className="text-[10px] text-amber-300 leading-relaxed">
                  ComfyUI 需本地部署。编辑器自动注入 prompt（CLIPTextEncode）和参考图（LoadImage）。
                </p>
                <button
                  onClick={() => setComfyEditor(task)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded transition-colors"
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
                    className="w-full h-8 text-xs rounded border border-slate-600 bg-slate-700 px-2 pr-12 text-white placeholder:text-slate-500"
                  />
                  <button
                    onClick={() => setRoutingMediaKeys((prev) => ({ ...prev, [task]: !prev[task] }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-200"
                  >
                    {routingMediaKeys[task] ? '隐藏' : '显示'}
                  </button>
                </div>
                {media.type !== 'openai' && media.type !== 'stability' && (
                  <input
                    value={media.apiUrl || ''}
                    onChange={(e) => updateSlotMedia(task, { apiUrl: e.target.value })}
                    placeholder="API 地址，如 https://dashscope.aliyuncs.com/compatible-mode/v1"
                    className="w-full h-8 text-xs rounded border border-slate-600 bg-slate-700 px-2 text-white placeholder:text-slate-500"
                  />
                )}
                <input
                  value={media.model || ''}
                  onChange={(e) => updateSlotMedia(task, { model: e.target.value })}
                  placeholder="模型名，如 wanx2.1-t2i-turbo"
                  className="w-full h-8 text-xs rounded border border-slate-600 bg-slate-700 px-2 text-white placeholder:text-slate-500"
                />
              </>
            )}

            {/* 技能指令（所有服务商通用） */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400">技能指令</span>
                {renderSkillPicker(task, (p) => updateMediaSlot(task, { skillPrompt: p }))}
              </div>
              <textarea
                value={routing[task].skillPrompt || ''}
                onChange={(e) => updateMediaSlot(task, { skillPrompt: e.target.value })}
                placeholder={isComfyui ? "附加风格指令（可选），如 'anime style, masterpiece'" : "如「统一 3D 卡通风格」（可选）"}
                rows={2}
                className="w-full text-[10px] rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-white placeholder:text-slate-500 resize-y"
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
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500/30 to-cyan-400/30 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <h3 className="text-sm font-semibold yasgui-gradient-text leading-tight">{assistantName}服务设置</h3>
              <p className="text-[9px] text-slate-500 leading-none">创作搭档 · 配置对话与媒体生成服务</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-full hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
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
              <p className="text-[10px] text-slate-500">开启后将使用{assistantName}辅助创作</p>
            </div>
            <button
              onClick={() => setAiEnabled(!aiEnabled)}
              className={`w-10 h-5 rounded-full transition-colors ${
                aiEnabled ? 'bg-gradient-to-r from-amber-500 to-amber-600 shadow shadow-amber-500/30' : 'bg-slate-600'
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
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-2.5 space-y-1">
                <p className="text-[10px] text-amber-300 font-medium">📖 第一次使用？三步搞定：</p>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  <span className="text-amber-400">①</span> 点下方链接注册账号 →
                  <span className="text-amber-400"> ②</span> 创建 API Key 并复制 →
                  <span className="text-amber-400"> ③</span> 粘贴到下方框框，点「测试连接」
                </p>
              </div>

              {/* Provider */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">服务商</label>
                <select
                  value={aiConfig.provider}
                  onChange={(e) => updateProvider(e.target.value)}
                  className="w-full h-8 text-xs rounded border border-slate-600 bg-slate-700 px-2 text-white"
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
                    <p className="text-[10px] text-slate-500 leading-relaxed">{currentProvider.desc}</p>
                    <a
                      href={currentProvider.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300"
                    >
                      <ExternalLink className="w-3 h-3" />
                      点这里去注册 / 申请 API Key →
                    </a>
                  </>
                )}
              </div>

              {/* API Key */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">API Key</label>
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
                      className="w-full h-8 text-xs rounded border border-slate-600 bg-slate-700 px-2 pr-16 text-white"
                    />
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-200"
                    >
                      {showApiKey ? '隐藏' : '显示'}
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Key 加密存储在本机，不上传服务器。若更换浏览器或屏幕分辨率变化导致无法识别，请重新填写。
                </p>
              </div>

              {/* API URL */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">API 地址</label>
                <div className="flex gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-2" />
                  <input
                    value={aiConfig.apiUrl}
                    onChange={(e) => {
                      setAiConfig((prev) => ({ ...prev, apiUrl: e.target.value }))
                      setTestResult(null)
                    }}
                    className="flex-1 h-8 text-xs rounded border border-slate-600 bg-slate-700 px-2 text-white"
                  />
                </div>
                <p className="text-[10px] text-slate-500">通常无需修改，切换服务商时已自动填好</p>
              </div>

              {/* Model */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">模型</label>
                <select
                  value={aiConfig.model}
                  onChange={(e) => setAiConfig((prev) => ({ ...prev, model: e.target.value }))}
                  className="w-full h-8 text-xs rounded border border-slate-600 bg-slate-700 px-2 text-white"
                >
                  {getModelsForProvider(aiConfig.provider).map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500">
                  切换服务商后模型会自动更新为推荐型号
                </p>
              </div>

              {/* Test Connection */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={testConnection}
                  disabled={testing || !aiConfig.apiKey}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-500 text-amber-950 hover:bg-amber-400 rounded transition-colors disabled:opacity-50"
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
          <div className="border-t border-slate-800 pt-3 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-400/25 to-cyan-400/10 flex items-center justify-center">
                <Image className="w-3.5 h-3.5 text-cyan-300" />
              </div>
              <span className="text-xs font-semibold text-white">图片/视频生成</span>
              <span className="text-[9px] text-slate-400 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded">可选</span>
            </div>
            <p className="text-[10px] text-slate-500 -mt-2 leading-relaxed">
              这是<span className="text-slate-400">可选功能</span>。不配置也能用 AI 写故事、建节点。
              <br />配置后 AI 才能自动生成图片/视频。密钥仅存本地，不会上传。
              <br />首次使用建议选「通义万相」，国内注册即送免费额度。
            </p>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">选择服务商</label>
              <select
                value={mediaProvider.type}
                onChange={(e) => updateMediaType(e.target.value)}
                className="w-full h-8 text-xs rounded border border-slate-600 bg-slate-700 px-2 text-white"
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
              <p className="text-[10px] text-slate-500 leading-relaxed">{MEDIA_PROVIDER_INFO[mediaProvider.type]?.desc}</p>
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
              className="text-[10px] text-slate-500 hover:text-slate-300 underline"
            >
              {showAdvancedMedia ? '收起高级选项' : '显示高级选项（自定义服务 / ComfyUI）'}
            </button>

            {mediaProvider.type !== 'comfyui' && (
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">API Key</label>
                <div className="relative">
                  <input
                    type={showMediaKey ? 'text' : 'password'}
                    value={mediaProvider.apiKey}
                    onChange={(e) => {
                      setMediaProvider((prev) => ({ ...prev, apiKey: e.target.value }))
                      setMediaTestResult(null)
                    }}
                    placeholder="粘贴你刚才申请的 API Key"
                    className="w-full h-8 text-xs rounded border border-slate-600 bg-slate-700 px-2 pr-12 text-white"
                  />
                  <button
                    onClick={() => setShowMediaKey(!showMediaKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-200"
                  >
                    {showMediaKey ? '隐藏' : '显示'}
                  </button>
                </div>
              </div>
            )}

            {mediaProvider.type !== 'openai' && mediaProvider.type !== 'stability' && mediaProvider.type !== 'comfyui' && (
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">API 地址</label>
                <input
                  value={mediaProvider.apiUrl}
                  onChange={(e) => {
                    setMediaProvider((prev) => ({ ...prev, apiUrl: e.target.value }))
                    setMediaTestResult(null)
                  }}
                  placeholder="https://..."
                  className="w-full h-8 text-xs rounded border border-slate-600 bg-slate-700 px-2 text-white"
                />
                <p className="text-[10px] text-slate-500">通常无需修改，切换服务商时已自动填好</p>
              </div>
            )}

            {mediaProvider.type !== 'comfyui' && (
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">模型名</label>
                <input
                  value={mediaProvider.model}
                  onChange={(e) => {
                    setMediaProvider((prev) => ({ ...prev, model: e.target.value }))
                    setMediaTestResult(null)
                  }}
                  placeholder="已自动填好，一般不用改"
                  className="w-full h-8 text-xs rounded border border-slate-600 bg-slate-700 px-2 text-white"
                />
                <p className="text-[10px] text-slate-500">已自动填好推荐模型，一般不用改</p>
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

            {/* ComfyUI 专属配置（高级）：独立面板入口 */}
            {mediaProvider.type === 'comfyui' && (
              <div className="space-y-1.5 p-2 rounded border border-amber-500/20 bg-amber-500/5">
                <p className="text-[10px] text-amber-300 leading-relaxed">
                  ⚠️ ComfyUI 需要你已在本地装好 ComfyUI。新手请选「通义万相」。
                </p>
                <button
                  onClick={() => setComfyEditor('legacy')}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded transition-colors"
                >
                  <Settings2 className="w-3 h-3" />
                  {mediaProvider.workflowJson ? '编辑工作流' : '配置工作流'}
                </button>
              </div>
            )}
          </div>
          {/* AI 任务路由（高级）：不同创作任务用不同模型 */}
          <div className="border-t border-slate-800 pt-3 space-y-3">
            <button
              onClick={() => setShowRouting(!showRouting)}
              className="w-full flex items-center gap-2 text-left"
            >
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-400/25 to-cyan-400/10 flex items-center justify-center shrink-0">
                <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-300" />
              </div>
              <span className="text-xs font-semibold text-white">AI 任务路由</span>
              <span className="text-[9px] text-slate-400 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded">高级</span>
              <span className={`ml-auto text-slate-400 transition-transform ${showRouting ? 'rotate-180' : ''}`}>▾</span>
            </button>
            <p className="text-[10px] text-slate-500 -mt-1.5 leading-relaxed">
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

                <p className="text-[9px] text-slate-600 leading-relaxed">
                  提示：媒体任务若不打开独立配置，图片/视频回退使用上方「图片/视频生成」的服务商；音乐/音效必须独立配置。
                </p>
              </div>
            )}
          </div>
        </div>
        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-xs font-medium bg-gradient-to-br from-amber-500 to-amber-600 hover:brightness-110 text-white rounded shadow-lg shadow-amber-500/20 transition-all"
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