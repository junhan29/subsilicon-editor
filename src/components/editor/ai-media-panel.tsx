'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, ChevronDown, Image, Loader2, Settings, Sparkles, Video, Wand2 } from 'lucide-react'
import { showToast } from './toast'
import { useAssistantName } from '@editor/lib/assistant-name'
import {
  type MediaGenerationResult,
  type MediaProviderConfig,
  type VideoAspectRatio,
  buildConsistentImagePrompt,
  generateMediaForTask,
  getGlobalStylePrompt,
  getMediaProviderConfig,
  getMediaProviderConfigForTask,
  optimizePrompt,
  saveMediaProviderConfig,
} from '@editor/lib/ai'
import {
  useCustomWorkflows,
  type CustomWorkflow,
  type WorkflowMediaDefaults,
} from '@editor/lib/custom-workflows-store'
import type { ComicScene, StoryCharacter } from '@editor/types/editor'

interface AiMediaPanelProps {
  characters: StoryCharacter[]
  onImageGenerated?: (url: string, name: string) => void
}

const STYLE_OPTIONS = [
  { value: 'anime', label: '动漫', desc: '日系动漫风格' },
  { value: 'realistic', label: '写实', desc: '照片级真实感' },
  { value: 'illustration', label: '插画', desc: '艺术插画风格' },
  { value: 'pixel', label: '像素', desc: '复古像素风格' },
  { value: '3d', label: '3D', desc: '三维渲染风格' },
]

const RATIO_OPTIONS: Array<{ value: VideoAspectRatio; label: string; desc: string }> = [
  { value: '16:9', label: '横屏 16:9', desc: '过场 / 电影感' },
  { value: '9:16', label: '竖屏 9:16', desc: '手机 / 短视频' },
  { value: '1:1',  label: '方形 1:1',  desc: '社交媒体'   },
]

function ratioToTailwindClass(ratio: VideoAspectRatio | undefined | null, fallback: 'square' | 'video' = 'square'): string {
  if (ratio === '16:9') return 'aspect-video'
  if (ratio === '9:16') return 'aspect-[9/16]'
  if (ratio === '1:1')  return 'aspect-square'
  return fallback === 'video' ? 'aspect-video' : 'aspect-square'
}

const PROVIDER_OPTIONS: Array<{ value: 'openai' | 'stability' | 'comfyui' | 'wan' | 'custom'; label: string; desc: string }> = [
  { value: 'openai', label: 'OpenAI DALL-E', desc: '高质量图片生成' },
  { value: 'stability', label: 'Stability AI', desc: '专业级图像生成' },
  { value: 'comfyui', label: 'ComfyUI', desc: '本地/远程 ComfyUI' },
  { value: 'wan', label: 'Wan AI', desc: '万相视频生成' },
  { value: 'custom', label: '自定义', desc: '兼容 OpenAI 格式' },
]

export function AiMediaPanel({ characters, onImageGenerated }: AiMediaPanelProps) {
  const assistantName = useAssistantName()
  const [provider, setProvider] = useState<MediaProviderConfig | null>(getMediaProviderConfig)
  const [showSettings, setShowSettings] = useState(!getMediaProviderConfig())
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('anime')
  const [generating, setGenerating] = useState(false)
  const [results, setResults] = useState<Array<MediaGenerationResult & { mediaType?: 'image' | 'video'; ratio?: VideoAspectRatio | null; durationSec?: number | null }>>([])
  const [selectedChars, setSelectedChars] = useState<string[]>([])
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image')
  // 视频专用参数
  const [videoDuration, setVideoDuration] = useState<number>(5)
  const [videoRatio, setVideoRatio] = useState<VideoAspectRatio>('16:9')

  // —— 自定义工作流选择器（生图 / 生视频共享，按 taskType 过滤）——
  const mediaWorkflows = useCustomWorkflows(mediaType)
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null)
  const [showWorkflowPicker, setShowWorkflowPicker] = useState(false)
  const activeWorkflow: CustomWorkflow | undefined = useMemo(
    () => mediaWorkflows.find((wf) => wf.id === activeWorkflowId),
    [mediaWorkflows, activeWorkflowId]
  )

  // 切换任务类型时：若当前工作流不匹配新 taskType，清空选中
  useEffect(() => {
    if (activeWorkflow && activeWorkflow.taskType !== mediaType) {
      setActiveWorkflowId(null)
    }
  }, [mediaType, activeWorkflow])

  /** 应用一个 media 工作流到当前 UI 参数（style/ratio/duration，以及后续生成时会拼 skillPrompt） */
  function applyWorkflowDefaults(media?: WorkflowMediaDefaults): void {
    if (!media) return
    if (media.style) setStyle(media.style)
    if (media.ratio) setVideoRatio(media.ratio)
    if (media.durationSec != null) {
      setVideoDuration(Math.max(3, Math.min(10, Math.round(media.durationSec))))
    }
  }

  // 切换到某个工作流：应用默认参数，关闭下拉
  function selectWorkflow(id: string): void {
    const wf = mediaWorkflows.find((w) => w.id === id)
    if (!wf) return
    setActiveWorkflowId(id)
    applyWorkflowDefaults(wf.media)
    setShowWorkflowPicker(false)
    showToast('success', `已应用工作流「${wf.name}」`)
  }

  const imageSizeForRatio = useMemo(() => {
    // 1024 基准，按比例调整（常见尺寸，避免非标准）
    switch (mediaType === 'video' ? videoRatio : '1:1') {
      case '16:9': return { width: 1280, height: 720 }
      case '9:16': return { width: 720, height: 1280 }
      default:     return { width: 1024, height: 1024 }
    }
  }, [mediaType, videoRatio])

  const handleGenerate = async () => {
    if (!getMediaProviderConfigForTask(mediaType)) {
      showToast('error', '请先配置媒体生成服务商')
      setShowSettings(true)
      return
    }

    if (!prompt.trim()) {
      showToast('error', '请输入描述')
      return
    }

    setGenerating(true)
    try {
      const selectedCharacters = characters.filter(c => selectedChars.includes(c.id))
      const globalStyle = getGlobalStylePrompt()
      // —— 工作流增强：skillPrompt 拼在 enhanced 前面，确保指令优先级最高 ——
      const workflowSkill = activeWorkflow?.media?.skillPrompt
      const styleOverride = activeWorkflow?.media?.style || style
      const ratioOverride = (mediaType === 'video' ? (activeWorkflow?.media?.ratio ?? videoRatio) : undefined) as VideoAspectRatio | undefined
      const durationOverride = mediaType === 'video'
        ? (activeWorkflow?.media?.durationSec != null ? Math.max(3, Math.min(10, Math.round(activeWorkflow.media.durationSec))) : videoDuration)
        : undefined
      const seedOverride = activeWorkflow?.media?.seedLock

      let enhancedPrompt = buildConsistentImagePrompt(prompt, selectedCharacters, styleOverride)
        + (globalStyle ? `, ${globalStyle}` : '')
      if (workflowSkill?.trim()) {
        enhancedPrompt = `${workflowSkill.trim()}\n用户画面描述：${enhancedPrompt}`
      }
      const optimized = await optimizePrompt(enhancedPrompt, mediaType, styleOverride)

      const { width, height } = imageSizeForRatio

      const result = await generateMediaForTask(
        mediaType,
        mediaType === 'video'
          ? {
              prompt: optimized,
              duration: durationOverride,
              ratio: ratioOverride,
              seed: seedOverride,
            }
          : {
              prompt: optimized,
              width,
              height,
              style: styleOverride as any,
              seed: seedOverride,
            }
      )

      setResults(prev => [{
        ...result,
        mediaType,
        ratio: mediaType === 'video' ? ratioOverride ?? null : null,
        durationSec: mediaType === 'video' ? durationOverride ?? null : null,
      }, ...prev])
      onImageGenerated?.(result.url, prompt)
      showToast('success', `${mediaType === 'image' ? '图片' : '视频'}生成完成${activeWorkflow ? `（工作流：${activeWorkflow.name}）` : ''}`)
    } catch (e) {
      if (e instanceof Error && 'needsConfig' in e && (e as { needsConfig: boolean }).needsConfig) {
        showToast('error', `${assistantName}未配置，请在设置中配置 API Key 或启动本地 Ollama`)
      } else {
        showToast('error', '生成失败: ' + (e instanceof Error ? e.message : '未知错误'))
      }
    } finally {
      setGenerating(false)
    }
  }

  const handleSaveProvider = (newProvider: MediaProviderConfig) => {
    saveMediaProviderConfig(newProvider)
    setProvider(newProvider)
    setShowSettings(false)
    showToast('success', '配置已保存')
  }

  return (
    <div className="space-y-4">
      {/* 服务商配置 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {mediaType === 'image' ? <Image className="w-4 h-4 text-primary" /> : <Video className="w-4 h-4 text-purple-400" />}
          <h3 className="text-sm font-medium text-foreground">{assistantName}媒体生成</h3>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-1.5 rounded-[2px] hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          title="配置服务商"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>

      {showSettings && (
        <ProviderSettingsPanel
          provider={provider}
          onSave={handleSaveProvider}
          onCancel={() => setShowSettings(false)}
        />
      )}

      {/* 类型切换 */}
      <div className="flex gap-2">
        <button
          onClick={() => setMediaType('image')}
          className={`flex-1 py-1.5 text-[11px] rounded-md border transition-colors [clip-path:polygon(4px_0,100%_0,100%_calc(100%-4px),calc(100%-4px)_100%,0_100%,0_4px)] ${
            mediaType === 'image'
              ? 'bg-gold-400/15 text-gold-500 border-gold-400/40' : 'bg-secondary text-muted-foreground border-border hover:border-slate-500' }`}
        >
          <Image className="w-3 h-3 inline mr-1" />
          图片
        </button>
        <button
          onClick={() => setMediaType('video')}
          className={`flex-1 py-1.5 text-[11px] rounded-md border transition-colors [clip-path:polygon(4px_0,100%_0,100%_calc(100%-4px),calc(100%-4px)_100%,0_100%,0_4px)] ${
            mediaType === 'video'
              ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
              : 'bg-secondary text-muted-foreground border-border hover:border-slate-500'
          }`}
        >
          <Video className="w-3 h-3 inline mr-1" />
          视频
        </button>
      </div>

      {/* 自定义工作流（Skill）选择器：图片 / 视频共享，按 mediaType 动态筛选 */}
      <div className="relative space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">
            <Sparkles className="w-3 h-3 inline mr-1 text-yellow-400" />
            自定义工作流（Skill）
          </Label>
          {activeWorkflow && (
            <button
              type="button"
              onClick={() => setActiveWorkflowId(null)}
              className="text-[9px] text-muted-foreground hover:text-foreground transition-colors"
            >
              清空
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowWorkflowPicker((v) => !v)}
          onBlur={() => setTimeout(() => setShowWorkflowPicker(false), 120)}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md border text-left transition-colors [clip-path:polygon(4px_0,100%_0,100%_calc(100%-4px),calc(100%-4px)_100%,0_100%,0_4px)] ${
            activeWorkflow
              ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'
              : 'bg-secondary border-border text-muted-foreground hover:border-slate-500'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Sparkles className="w-3 h-3 flex-shrink-0 opacity-80" />
            <span className="text-[11px] truncate">
              {activeWorkflow ? activeWorkflow.name : mediaType === 'image' ? '选择生图工作流（可选）' : '选择生视频工作流（可选）'}
            </span>
            {activeWorkflow?.description && (
              <span className="text-[9px] text-muted-foreground truncate hidden sm:inline">· {activeWorkflow.description}</span>
            )}
          </div>
          <ChevronDown className={`w-3 h-3 transition-transform flex-shrink-0 ${showWorkflowPicker ? 'rotate-180' : ''}`} />
        </button>
        {showWorkflowPicker && (
          <div className="absolute left-0 right-0 z-20 mt-1 rounded-md border border-border bg-muted shadow-xl overflow-hidden max-h-64 overflow-y-auto [clip-path:polygon(4px_0,100%_0,100%_calc(100%-4px),calc(100%-4px)_100%,0_100%,0_4px)]">
            {mediaWorkflows.length === 0 ? (
              <div className="px-2.5 py-2 text-[10px] text-muted-foreground">暂无工作流：前往设置 → AI 任务路由 → 自定义工作流新建</div>
            ) : (
              mediaWorkflows.map((wf) => {
                const active = wf.id === activeWorkflowId
                return (
                  <button
                    key={wf.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectWorkflow(wf.id)}
                    className={`w-full text-left px-2.5 py-2 border-b last:border-b-0 border-border/60 flex items-start gap-2 transition-colors ${
                      active ? 'bg-yellow-500/10' : 'hover:bg-secondary/60'
                    }`}
                  >
                    <Check className={`w-3 h-3 mt-0.5 flex-shrink-0 ${active ? 'text-yellow-400' : 'opacity-0'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[11px] ${active ? 'text-yellow-300 font-medium' : 'text-foreground'} truncate`}>{wf.name}</span>
                        {wf.builtin && (
                          <span className="text-[9px] px-1 rounded border border-border text-muted-foreground flex-shrink-0">内置</span>
                        )}
                      </div>
                      {wf.description && (
                        <p className="text-[9px] text-muted-foreground leading-snug line-clamp-2">{wf.description}</p>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* 角色选择（保持一致性） */}
      {characters.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">选择角色（保持形象一致）</Label>
          <div className="flex flex-wrap gap-1.5">
            {characters.map((char) => (
              <button
                key={char.id}
                onClick={() => {
                  setSelectedChars(prev =>
                    prev.includes(char.id)
                      ? prev.filter(id => id !== char.id)
                      : [...prev, char.id]
                  )
                }}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border transition-colors [clip-path:polygon(4px_0,100%_0,100%_calc(100%-4px),calc(100%-4px)_100%,0_100%,0_4px)] ${
                  selectedChars.includes(char.id)
                    ? 'bg-gold-400/15 text-gold-400 border-gold-400/30'
                    : 'bg-secondary text-muted-foreground border-border hover:border-slate-500'
                }`}
              >
                <img src={char.avatar} alt={char.name} className="w-4 h-4 rounded-full object-cover" />
                {char.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 风格选择 */}
      <div className="space-y-1.5">
        <Label className="text-[11px] text-muted-foreground">画面风格</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {STYLE_OPTIONS.map((s) => (
            <button
              key={s.value}
              onClick={() => setStyle(s.value)}
              className={`p-2 rounded-md border text-left transition-colors [clip-path:polygon(4px_0,100%_0,100%_calc(100%-4px),calc(100%-4px)_100%,0_100%,0_4px)] ${
                style === s.value
                  ? 'bg-gold-400/15 text-gold-500 border-gold-400/40' : 'bg-secondary text-muted-foreground border-border hover:border-slate-500' }`}
            >
              <p className="text-[11px] font-medium">{s.label}</p>
              <p className="text-[9px] text-muted-foreground">{s.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 描述输入 */}
      <div className="space-y-1.5">
        <Label className="text-[11px] text-muted-foreground">场景描述</Label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="描述你想要生成的场景画面..."
          className="w-full h-20 text-xs rounded-[2px] border border-border bg-secondary px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold-400/50 focus:border-gold-400/60 resize-none [clip-path:polygon(4px_0,100%_0,100%_calc(100%-4px),calc(100%-4px)_100%,0_100%,0_4px)]"
        />
      </div>

      {/* 视频专属参数（时长 + 画幅比例） */}
      {mediaType === 'video' && (
        <div className="space-y-3 p-2.5 rounded-[2px] border border-indigo-500/20 bg-indigo-500/5 [clip-path:polygon(4px_0,100%_0,100%_calc(100%-4px),calc(100%-4px)_100%,0_100%,0_4px)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Video className="w-3 h-3 text-indigo-400" />
              <Label className="text-[11px] text-indigo-300">视频参数</Label>
            </div>
            <button
              type="button"
              onClick={() => { setVideoDuration(5); setVideoRatio('16:9') }}
              className="text-[9px] text-muted-foreground hover:text-indigo-400 transition-colors"
            >
              重置
            </button>
          </div>

          {/* 时长滑杆 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground">时长</Label>
              <span className="text-[10px] text-indigo-300 font-mono tabular-nums">{videoDuration}s</span>
            </div>
            <input
              type="range"
              min={3}
              max={10}
              step={1}
              value={videoDuration}
              onChange={(e) => setVideoDuration(parseInt(e.target.value, 10))}
              className="w-full accent-indigo-500 h-1.5"
            />
            <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
              <span>3s</span>
              <span>5s</span>
              <span>10s</span>
            </div>
          </div>

          {/* 画幅比例 */}
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground">画幅比例</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {RATIO_OPTIONS.map((r) => (
                <button
                  type="button"
                  key={r.value}
                  onClick={() => setVideoRatio(r.value)}
                  className={`p-1.5 rounded-md border text-left transition-colors [clip-path:polygon(4px_0,100%_0,100%_calc(100%-4px),calc(100%-4px)_100%,0_100%,0_4px)] ${
                    videoRatio === r.value
                      ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40'
                      : 'bg-secondary text-muted-foreground border-border hover:border-slate-500'
                  }`}
                >
                  <p className="text-[10px] font-medium leading-tight">{r.label}</p>
                  <p className="text-[9px] opacity-75 leading-tight">{r.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 生成按钮 */}
      <button
        onClick={handleGenerate}
        disabled={generating || !prompt.trim()}
        className="w-full flex items-center justify-center gap-2 py-2 text-xs bg-gold-400/15 text-gold-500 border border-gold-400/40 hover:bg-gold-400/25 rounded-[2px] transition-colors disabled:opacity-50 [clip-path:polygon(4px_0,100%_0,100%_calc(100%-4px),calc(100%-4px)_100%,0_100%,0_4px)]"
      >
        {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
        {generating ? '生成中...' : `生成${mediaType === 'image' ? '图片' : '视频'}`}
      </button>

      {/* 结果展示：视频卡片按所选比例显示；图片按生成尺寸自适应 */}
      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">生成结果 <span className="text-muted-foreground">· {results.length}</span></p>
          <div className="grid grid-cols-2 gap-2">
            {results.map((result, i) => {
              const isVideo = result.type === 'video'
              const cardClass = isVideo
                ? ratioToTailwindClass(result.ratio as VideoAspectRatio | undefined | null, 'video')
                : 'aspect-square'
              return (
                <div key={i} className="relative rounded-[2px] overflow-hidden border border-border group flex-col [clip-path:polygon(4px_0,100%_0,100%_calc(100%-4px),calc(100%-4px)_100%,0_100%,0_4px)]">
                  <div className={`${cardClass} w-full`}>
                    {isVideo ? (
                      <video src={result.url} className="w-full h-full object-cover" controls />
                    ) : (
                      <img src={result.url} alt={result.prompt} className="w-full h-full object-cover" loading="lazy" />
                    )}
                  </div>
                  {isVideo && (
                    <div className="flex items-center justify-between px-2 py-1 bg-muted/80 border-t border-border/50 text-[9px] text-muted-foreground font-mono">
                      <span>{((result as { ratio?: VideoAspectRatio }).ratio || '16:9')}</span>
                      <span>{(result as { durationSec?: number | null }).durationSec || '5'}s</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(result.url)
                        showToast('success', '链接已复制')
                      }}
                      className="px-2 py-1 text-[10px] bg-white/20 text-white rounded hover:bg-white/30 transition-colors"
                    >
                      复制链接
                    </button>
                    <button
                      onClick={() => onImageGenerated?.(result.url, result.prompt)}
                      className="px-2 py-1 text-[10px] bg-primary text-white rounded hover:bg-primary/90 transition-colors"
                    >
                      添加到场景
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function ProviderSettingsPanel({
  provider,
  onSave,
  onCancel,
}: {
  provider: MediaProviderConfig | null
  onSave: (config: MediaProviderConfig) => void
  onCancel: () => void
}) {
  const [type, setType] = useState(provider?.type || 'openai')
  const [apiKey, setApiKey] = useState(provider?.apiKey || '')
  const [apiUrl, setApiUrl] = useState(provider?.apiUrl || '')
  const [model, setModel] = useState(provider?.model || '')

  const handleSave = () => {
    if (!apiKey.trim()) {
      showToast('error', '请输入 API Key')
      return
    }
    onSave({ type: type as any, apiKey, apiUrl: apiUrl || undefined, model: model || undefined })
  }

  return (
    <div className="p-3 bg-secondary/40 rounded-[2px] border border-border/50 space-y-3 [clip-path:polygon(4px_0,100%_0,100%_calc(100%-4px),calc(100%-4px)_100%,0_100%,0_4px)]">
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle className="w-3.5 h-3.5 text-gold-400" />
        <p className="text-[11px] text-foreground">配置媒体生成服务商</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] text-muted-foreground">服务商</Label>
        <div className="grid grid-cols-1 gap-1.5">
          {PROVIDER_OPTIONS.map((p) => (
            <button
              key={p.value}
              onClick={() => setType(p.value)}
              className={`p-2 rounded-md border text-left transition-colors [clip-path:polygon(4px_0,100%_0,100%_calc(100%-4px),calc(100%-4px)_100%,0_100%,0_4px)] ${
                type === p.value
                  ? 'bg-gold-400/15 text-gold-400 border-gold-400/30'
                  : 'bg-secondary text-muted-foreground border-border hover:border-slate-500'
              }`}
            >
              <p className="text-[11px] font-medium">{p.label}</p>
              <p className="text-[9px] text-muted-foreground">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] text-muted-foreground">API Key</Label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="输入 API Key"
          className="w-full h-8 text-xs rounded-[2px] border border-border bg-secondary px-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold-400/50 focus:border-gold-400/60 [clip-path:polygon(4px_0,100%_0,100%_calc(100%-4px),calc(100%-4px)_100%,0_100%,0_4px)]"
        />
      </div>

      {type === 'comfyui' && (
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">API URL</Label>
          <input
            type="text"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="http://localhost:8188"
            className="w-full h-8 text-xs rounded-[2px] border border-border bg-secondary px-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold-400/50 focus:border-gold-400/60 [clip-path:polygon(4px_0,100%_0,100%_calc(100%-4px),calc(100%-4px)_100%,0_100%,0_4px)]"
          />
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleSave}
          className="flex-1 py-1.5 text-[11px] bg-gold-400/15 text-gold-400 border border-gold-400/30 hover:bg-gold-400/25 rounded-[2px] transition-colors [clip-path:polygon(4px_0,100%_0,100%_calc(100%-4px),calc(100%-4px)_100%,0_100%,0_4px)]"
        >
          <Check className="w-3 h-3 inline mr-1" />
          保存
        </button>
      </div>
    </div>
  )
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={`font-medium ${className}`}>{children}</p>
}
