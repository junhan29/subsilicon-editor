'use client'

import { useState, useEffect } from 'react'
import { X, Key, Globe, Cpu, CheckCircle2, Loader2, ExternalLink, Image } from 'lucide-react'
import { showToast } from './toast'
import { refreshAiConfig, getMediaProviderConfig, saveMediaProviderConfig, type MediaProviderConfig } from '@editor/lib/ai'
import { getModelsForProvider, getDefaultModel } from '@editor/lib/ai/model-presets'

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

// ComfyUI 默认 IP-Adapter 工作流（API 格式）
// 含：LoadImage（参考图，自动注入）+ CLIPTextEncode正向/负向 + IP-AdapterApply + KSampler + SaveImage
// 用户需本地安装 ComfyUI + ComfyUI_IPAdapter_plus 插件 + IP-Adapter 模型
const DEFAULT_COMFYUI_WORKFLOW = JSON.stringify({
  '3': {
    class_type: 'KSampler',
    inputs: {
      seed: 42,
      steps: 25,
      cfg: 7,
      sampler_name: 'dpmpp_2m',
      scheduler: 'karras',
      denoise: 1,
      model: ['10', 0],
      positive: ['6', 0],
      negative: ['7', 0],
      latent_image: ['5', 0],
    },
  },
  '4': {
    class_type: 'CheckpointLoaderSimple',
    inputs: { ckpt_name: 'your_model.safetensors' },
  },
  '5': {
    class_type: 'EmptyLatentImage',
    inputs: { width: 1024, height: 1024, batch_size: 1 },
  },
  '6': {
    class_type: 'CLIPTextEncode',
    inputs: { text: 'positive prompt here', clip: ['4', 1] },
    _meta: { title: 'positive' },
  },
  '7': {
    class_type: 'CLIPTextEncode',
    inputs: { text: 'lowres, bad anatomy, deformed', clip: ['4', 1] },
    _meta: { title: 'negative' },
  },
  '8': {
    class_type: 'VAEDecode',
    inputs: { samples: ['3', 0], vae: ['4', 2] },
  },
  '9': {
    class_type: 'SaveImage',
    inputs: { filename_prefix: 'subsilicon', images: ['8', 0] },
  },
  '10': {
    class_type: 'IPAdapterApply',
    inputs: {
      weight: 0.85,
      noise: 0,
      weight_type: 'standard',
      start_at: 0,
      end_at: 1,
      model: ['4', 0],
      ipadapter: ['12', 0],
      image: ['11', 0],
    },
  },
  '11': {
    class_type: 'LoadImage',
    inputs: { image: 'reference_placeholder.png' },
  },
  '12': {
    class_type: 'IPAdapterModelLoader',
    inputs: { ipadapter_file: 'ip-adapter_sd15.safetensors' },
  },
}, null, 2)

export function AiSettingsDialog({ open, onClose }: AiSettingsDialogProps) {
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

  useEffect(() => {
    if (open) {
      try {
        const saved = localStorage.getItem('subsilicon_ai_config')
        if (saved) {
          const parsed = JSON.parse(saved)
          setAiEnabled(parsed.enabled ?? false)
          setAiConfig(parsed)
        }
      } catch {
        // ignore
      }
      // 加载媒体生成配置
      const mp = getMediaProviderConfig()
      if (mp) {
        setMediaProvider(mp)
      }
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
      const resp = await fetch(aiConfig.apiUrl + '/models', {
        headers: { Authorization: `Bearer ${aiConfig.apiKey}` },
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

  const handleSave = () => {
    const config = { ...aiConfig, enabled: aiEnabled }
    localStorage.setItem('subsilicon_ai_config', JSON.stringify(config))
    refreshAiConfig()
    // 保存媒体生成配置（仅当填了 apiKey 才保存）
    if (mediaProvider.apiKey.trim()) {
      saveMediaProviderConfig(mediaProvider)
    }
    showToast('success', '创境设置已保存')
    onClose()
  }

  const currentProvider = PROVIDER_INFO[aiConfig.provider]

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl w-full max-w-md border border-slate-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-pink-400" />
            <h3 className="text-sm font-semibold text-white">创境服务设置</h3>
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
              <p className="text-xs font-medium text-white">启用创境</p>
              <p className="text-[10px] text-slate-500">开启后将使用创境辅助创作</p>
            </div>
            <button
              onClick={() => setAiEnabled(!aiEnabled)}
              className={`w-10 h-5 rounded-full transition-colors ${
                aiEnabled ? 'bg-pink-500' : 'bg-slate-600'
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
              <div className="bg-pink-500/5 border border-pink-500/20 rounded-lg p-2.5 space-y-1">
                <p className="text-[10px] text-pink-300 font-medium">📖 第一次使用？三步搞定：</p>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  <span className="text-pink-400">①</span> 点下方链接注册账号 →
                  <span className="text-pink-400"> ②</span> 创建 API Key 并复制 →
                  <span className="text-pink-400"> ③</span> 粘贴到下方框框，点「测试连接」
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
                      className="inline-flex items-center gap-1 text-[10px] text-pink-400 hover:text-pink-300"
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
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded transition-colors disabled:opacity-50"
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
          <div className="border-t border-slate-700 pt-3 space-y-3">
            <div className="flex items-center gap-1.5">
              <Image className="w-3.5 h-3.5 text-pink-400" />
              <span className="text-xs font-semibold text-white">图片/视频生成</span>
              <span className="text-[9px] text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded">可选</span>
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
                  className="inline-flex items-center gap-1 text-[10px] text-pink-400 hover:text-pink-300"
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
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded transition-colors disabled:opacity-50"
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

            {/* ComfyUI 专属配置（高级） */}
            {mediaProvider.type === 'comfyui' && (
              <div className="space-y-2 p-2 rounded border border-amber-500/20 bg-amber-500/5">
                <p className="text-[10px] text-amber-300 leading-relaxed">
                  ⚠️ ComfyUI 需要你已在本地装好 ComfyUI + IP-Adapter 插件。新手请选「通义万相」。
                </p>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">ComfyUI 地址</label>
                  <input
                    value={mediaProvider.apiUrl}
                    onChange={(e) => setMediaProvider((prev) => ({ ...prev, apiUrl: e.target.value }))}
                    className="w-full h-8 text-xs rounded border border-slate-600 bg-slate-700 px-2 text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-slate-400">工作流 JSON（API 格式）</label>
                    <button
                      onClick={() => setMediaProvider((prev) => ({ ...prev, workflowJson: DEFAULT_COMFYUI_WORKFLOW }))}
                      className="text-[10px] text-pink-400 hover:text-pink-300 underline"
                    >
                      填入默认 IP-Adapter 工作流
                    </button>
                  </div>
                  <textarea
                    value={mediaProvider.workflowJson || ''}
                    onChange={(e) => setMediaProvider((prev) => ({ ...prev, workflowJson: e.target.value }))}
                    placeholder={'点上方按钮填入默认工作流，或自行从 ComfyUI Save (API Format) 粘贴。'}
                    className="w-full h-24 text-[10px] font-mono rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-white resize-y"
                  />
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    默认工作流含 LoadImage（参考图）+ CLIPTextEncode（prompt）+ IP-Adapter 节点。
                    需你本地已安装 IP-Adapter 模型和插件。
                  </p>
                </div>
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
            className="px-4 py-1.5 text-xs bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 rounded transition-colors"
          >
            保存设置
          </button>
        </div>
      </div>
    </div>
  )
}