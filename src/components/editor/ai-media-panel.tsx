'use client'

import { useState } from 'react'
import { Image, Video, Loader2, Wand2, Settings, Check, AlertCircle } from 'lucide-react'
import { showToast } from './toast'
import {
  generateMedia,
  optimizePrompt,
  buildConsistentImagePrompt,
  getMediaProviderConfig,
  saveMediaProviderConfig,
  type MediaProviderConfig,
} from '@editor/lib/ai'
import type { StoryCharacter, ComicScene } from '@editor/types/editor'

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

const PROVIDER_OPTIONS: Array<{ value: 'openai' | 'stability' | 'comfyui' | 'wan' | 'custom'; label: string; desc: string }> = [
  { value: 'openai', label: 'OpenAI DALL-E', desc: '高质量图片生成' },
  { value: 'stability', label: 'Stability AI', desc: '专业级图像生成' },
  { value: 'comfyui', label: 'ComfyUI', desc: '本地/远程 ComfyUI' },
  { value: 'wan', label: 'Wan AI', desc: '万相视频生成' },
  { value: 'custom', label: '自定义', desc: '兼容 OpenAI 格式' },
]

export function AiMediaPanel({ characters, onImageGenerated }: AiMediaPanelProps) {
  const [provider, setProvider] = useState<MediaProviderConfig | null>(getMediaProviderConfig)
  const [showSettings, setShowSettings] = useState(!getMediaProviderConfig())
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('anime')
  const [generating, setGenerating] = useState(false)
  const [results, setResults] = useState<Array<{ url: string; type: 'image' | 'video'; prompt: string }>>([])
  const [selectedChars, setSelectedChars] = useState<string[]>([])
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image')

  const handleGenerate = async () => {
    if (!provider) {
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
      const enhancedPrompt = buildConsistentImagePrompt(prompt, selectedCharacters, style)
      const optimized = await optimizePrompt(enhancedPrompt, mediaType, style)

      const result = await generateMedia(
        {
          prompt: optimized,
          width: 1024,
          height: 1024,
          style: style as any,
        },
        provider
      )

      setResults(prev => [result, ...prev])
      onImageGenerated?.(result.url, prompt)
      showToast('success', `${mediaType === 'image' ? '图片' : '视频'}生成完成`)
    } catch (e) {
      if (e instanceof Error && 'needsConfig' in e && (e as { needsConfig: boolean }).needsConfig) {
        showToast('error', '创境未配置，请在设置中配置 API Key 或启动本地 Ollama')
      } else {
        showToast('error', '生成失败: ' + (e instanceof Error ? e.message : '未知错误'))
      }
    }
    setGenerating(false)
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
          {mediaType === 'image' ? <Image className="w-4 h-4 text-pink-400" /> : <Video className="w-4 h-4 text-purple-400" />}
          <h3 className="text-sm font-medium text-white">创境媒体生成</h3>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
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
          className={`flex-1 py-1.5 text-[11px] rounded-md border transition-colors ${
            mediaType === 'image'
              ? 'bg-pink-500/15 text-pink-400 border-pink-500/30'
              : 'bg-slate-700 text-slate-400 border-slate-600 hover:border-slate-500'
          }`}
        >
          <Image className="w-3 h-3 inline mr-1" />
          图片
        </button>
        <button
          onClick={() => setMediaType('video')}
          className={`flex-1 py-1.5 text-[11px] rounded-md border transition-colors ${
            mediaType === 'video'
              ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
              : 'bg-slate-700 text-slate-400 border-slate-600 hover:border-slate-500'
          }`}
        >
          <Video className="w-3 h-3 inline mr-1" />
          视频
        </button>
      </div>

      {/* 角色选择（保持一致性） */}
      {characters.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-[11px] text-slate-400">选择角色（保持形象一致）</Label>
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
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border transition-colors ${
                  selectedChars.includes(char.id)
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    : 'bg-slate-700 text-slate-400 border-slate-600 hover:border-slate-500'
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
        <Label className="text-[11px] text-slate-400">画面风格</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {STYLE_OPTIONS.map((s) => (
            <button
              key={s.value}
              onClick={() => setStyle(s.value)}
              className={`p-2 rounded-md border text-left transition-colors ${
                style === s.value
                  ? 'bg-pink-500/15 text-pink-400 border-pink-500/30'
                  : 'bg-slate-700 text-slate-400 border-slate-600 hover:border-slate-500'
              }`}
            >
              <p className="text-[11px] font-medium">{s.label}</p>
              <p className="text-[9px] text-slate-500">{s.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 描述输入 */}
      <div className="space-y-1.5">
        <Label className="text-[11px] text-slate-400">场景描述</Label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="描述你想要生成的场景画面..."
          className="w-full h-20 text-xs rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 resize-none"
        />
      </div>

      {/* 生成按钮 */}
      <button
        onClick={handleGenerate}
        disabled={generating || !prompt.trim()}
        className="w-full flex items-center justify-center gap-2 py-2 text-xs bg-pink-500/15 text-pink-400 border border-pink-500/30 hover:bg-pink-500/25 rounded-lg transition-colors disabled:opacity-50"
      >
        {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
        {generating ? '生成中...' : `生成${mediaType === 'image' ? '图片' : '视频'}`}
      </button>

      {/* 结果展示 */}
      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] text-slate-400">生成结果</p>
          <div className="grid grid-cols-2 gap-2">
            {results.map((result, i) => (
              <div key={i} className="relative rounded-lg overflow-hidden border border-slate-600 group">
                {result.type === 'image' ? (
                  <img src={result.url} alt={result.prompt} className="w-full aspect-square object-cover" />
                ) : (
                  <video src={result.url} className="w-full aspect-square object-cover" controls />
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
                    className="px-2 py-1 text-[10px] bg-pink-500 text-white rounded hover:bg-pink-600 transition-colors"
                  >
                    添加到场景
                  </button>
                </div>
              </div>
            ))}
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
    <div className="p-3 bg-slate-700/40 rounded-lg border border-slate-600/50 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
        <p className="text-[11px] text-slate-300">配置媒体生成服务商</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] text-slate-400">服务商</Label>
        <div className="grid grid-cols-1 gap-1.5">
          {PROVIDER_OPTIONS.map((p) => (
            <button
              key={p.value}
              onClick={() => setType(p.value)}
              className={`p-2 rounded-md border text-left transition-colors ${
                type === p.value
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : 'bg-slate-700 text-slate-400 border-slate-600 hover:border-slate-500'
              }`}
            >
              <p className="text-[11px] font-medium">{p.label}</p>
              <p className="text-[9px] text-slate-500">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] text-slate-400">API Key</Label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="输入 API Key"
          className="w-full h-8 text-xs rounded-lg border border-slate-600 bg-slate-700 px-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
        />
      </div>

      {type === 'comfyui' && (
        <div className="space-y-1.5">
          <Label className="text-[11px] text-slate-400">API URL</Label>
          <input
            type="text"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="http://localhost:8188"
            className="w-full h-8 text-xs rounded-lg border border-slate-600 bg-slate-700 px-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-1.5 text-[11px] text-slate-400 hover:text-white transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleSave}
          className="flex-1 py-1.5 text-[11px] bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 rounded-lg transition-colors"
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
