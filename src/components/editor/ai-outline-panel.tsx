'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Sparkles, Play, Loader2, X, Copy, CheckCircle2, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@editor/components/ui/button'
import { generateOutline, isAiAvailable, getAiConfig, type AiOutlineResult, type OutlineScene } from '@editor/lib/ai-service'
import { streamGenerateOutlineParsed, type StreamCallbacks } from '@editor/lib/ai'
import { showToast } from './toast'
import { AiSettingsDialog } from './ai-settings-dialog'

interface AiOutlinePanelProps {
  onApplyOutline?: (outline: AiOutlineResult) => void
}

const GENRES = [
  { id: 'fantasy', label: '奇幻', desc: '魔法、冒险、异世界' },
  { id: 'scifi', label: '科幻', desc: '未来科技、太空探索' },
  { id: 'mystery', label: '悬疑', desc: '解谜、探案、惊悚' },
  { id: 'romance', label: '恋爱', desc: '情感、青春、甜蜜' },
  { id: 'drama', label: '剧情', desc: '人性、成长、冲突' },
  { id: 'comedy', label: '喜剧', desc: '搞笑、轻松、欢乐' },
  { id: 'horror', label: '恐怖', desc: '惊悚、灵异、悬疑' },
  { id: 'historical', label: '历史', desc: '古代、战争、史诗' },
]

export function AiOutlinePanel({ onApplyOutline }: AiOutlinePanelProps) {
  const [topic, setTopic] = useState('')
  const [genre, setGenre] = useState('fantasy')
  const [sceneCount, setSceneCount] = useState(5)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AiOutlineResult | null>(null)
  const [expandedScene, setExpandedScene] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) {
      showToast('error', '请输入故事主题')
      return
    }
    if (!isAiAvailable()) {
      showToast('error', '请先配置 AI 服务商')
      return
    }

    setLoading(true)
    setResult(null)
    setStreamingText('')

    try {
      const config = getAiConfig()
      const outline = await generateOutline(topic.trim(), genre, sceneCount, config)
      setResult(outline)
      showToast('success', '大纲生成成功')
    } catch (error) {
      if (error instanceof Error && 'needsConfig' in error && (error as { needsConfig: boolean }).needsConfig) {
        setShowSettings(true)
        showToast('error', 'AI 未配置，请先设置 API Key 或启动本地 Ollama')
      } else {
        showToast('error', (error as Error).message)
      }
    } finally {
      setLoading(false)
    }
  }, [topic, genre, sceneCount])

  const handleGenerateStream = useCallback(async () => {
    if (!topic.trim()) {
      showToast('error', '请输入故事主题')
      return
    }
    if (!isAiAvailable()) {
      showToast('error', '请先配置 AI 服务商')
      return
    }

    setLoading(true)
    setResult(null)
    setStreamingText('')

    try {
      const config = getAiConfig()
      const callbacks: StreamCallbacks = {
        onChunk: (chunk) => {
          setStreamingText((prev) => prev + chunk)
        },
        onDone: () => {
          showToast('success', '大纲生成成功')
        },
        onError: (error) => {
          showToast('error', (error as Error).message)
        },
      }

      const outline = await streamGenerateOutlineParsed(
        topic.trim(),
        genre,
        sceneCount,
        config,
        callbacks
      )

      setResult(outline)
    } catch (error) {
      if (error instanceof Error && 'needsConfig' in error && (error as { needsConfig: boolean }).needsConfig) {
        setShowSettings(true)
        showToast('error', 'AI 未配置，请先设置 API Key 或启动本地 Ollama')
      } else {
        showToast('error', (error as Error).message)
      }
    } finally {
      setLoading(false)
    }
  }, [topic, genre, sceneCount])

  const handleCopyResult = useCallback(() => {
    if (!result) return
    navigator.clipboard.writeText(result.result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    showToast('success', '已复制到剪贴板')
  }, [result])

  const handleApply = useCallback(() => {
    if (!result) return
    onApplyOutline?.(result)
    showToast('success', '大纲已应用到画布')
  }, [result, onApplyOutline])

  const handleRegenerate = useCallback(() => {
    handleGenerate()
  }, [handleGenerate])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-amber-500" />
        <h3 className="font-medium">AI 剧情大纲生成</h3>
      </div>

      <div className="p-4 bg-muted/30 rounded-xl space-y-4">
        <div>
          <label className="text-sm font-medium mb-1 block">故事主题</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="例如：一个少年在魔法学院的成长故事"
            className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleGenerate()
            }}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">故事类型</label>
          <div className="grid grid-cols-4 gap-2">
            {GENRES.map((g) => (
              <button
                key={g.id}
                onClick={() => setGenre(g.id)}
                className={`p-2 rounded-lg border transition-colors text-left ${
                  genre === g.id
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-border hover:border-amber-500/30'
                }`}
              >
                <p className="text-xs font-medium">{g.label}</p>
                <p className="text-[10px] text-muted-foreground truncate">{g.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">场景数量</label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="3"
              max="10"
              value={sceneCount}
              onChange={(e) => setSceneCount(Number(e.target.value))}
              className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm font-medium w-8 text-right">{sceneCount}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleGenerate}
            disabled={loading || !topic.trim()}
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                生成中...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                生成大纲
              </>
            )}
          </Button>
          <Button
            onClick={handleGenerateStream}
            disabled={loading || !topic.trim()}
            variant="outline"
            className="flex-1 border-amber-500 text-amber-500 hover:bg-amber-500/10"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                流式...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                流式生成
              </>
            )}
          </Button>
        </div>
      </div>

      {loading && streamingText && (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-4 bg-muted/20">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
              <h4 className="font-medium">生成中...</h4>
            </div>
          </div>
          <div className="p-4">
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
              {streamingText}
              <span className="inline-block w-2 h-4 bg-amber-500 animate-pulse ml-0.5" />
            </pre>
          </div>
        </div>
      )}

      {result && (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-4 bg-muted/20">
            <div>
              <h4 className="font-medium">{result.title}</h4>
              <p className="text-xs text-muted-foreground">{result.scenes.length} 个场景</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyResult}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded-md transition-colors"
              >
                {copied ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                {copied ? '已复制' : '复制'}
              </button>
              <button
                onClick={handleRegenerate}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded-md transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                重新生成
              </button>
              <Button
                onClick={handleApply}
                size="sm"
                className="bg-pink-500 hover:bg-pink-600 text-white"
              >
                应用到画布
              </Button>
            </div>
          </div>

          <div className="divide-y divide-border">
            {result.scenes.map((scene: OutlineScene, index: number) => (
              <div key={scene.id} className="p-4">
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => setExpandedScene(expandedScene === scene.id ? null : scene.id)}
                >
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/20 text-amber-500 text-xs font-medium shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{scene.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{scene.description}</p>
                  </div>
                  {expandedScene === scene.id ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>

                {expandedScene === scene.id && (
                  <div className="mt-3 pl-10 space-y-3">
                    <p className="text-xs text-muted-foreground">{scene.description}</p>

                    {scene.characters && scene.characters.length > 0 && (
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">涉及角色</p>
                        <div className="flex flex-wrap gap-1">
                          {scene.characters.map((char) => (
                            <span
                              key={char}
                              className="px-2 py-0.5 bg-pink-500/10 text-pink-400 rounded text-[10px]"
                            >
                              {char}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {scene.choices && scene.choices.length > 0 && (
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">选择分支</p>
                        <div className="space-y-1">
                          {scene.choices.map((choice, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 px-2 py-1.5 bg-slate-800/50 rounded text-xs"
                            >
                              <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-500 text-[9px] flex items-center justify-center shrink-0">
                                {i + 1}
                              </span>
                              <span className="flex-1">{choice.text}</span>
                              {choice.nextSceneId && (
                                <span className="text-[10px] text-muted-foreground">
                                  → {choice.nextSceneId}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
        <p className="font-medium mb-1">使用提示：</p>
        <ul className="space-y-1">
          <li>• 主题描述越详细，生成的大纲越精准</li>
          <li>• 选择合适的类型有助于 AI 把握风格</li>
          <li>• 场景数量建议 3-7 个，保证故事完整性</li>
          <li>• 生成的大纲可以作为创作起点，自由修改</li>
        </ul>
      </div>

      <AiSettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  )
}