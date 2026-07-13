'use client'

import { useState, useEffect } from 'react'
import { Sparkles, Settings, ChevronDown, ChevronUp, CheckCircle2, ExternalLink, Copy, AlertCircle, Loader2, Key, Globe, Wand2, BookOpen, Users, Play, FileText } from 'lucide-react'
import { Button } from '@editor/components/ui/button'
import { Toggle } from '@editor/components/ui/toggle'
import { showToast } from './toast'
import { AiOutlinePanel } from './ai-outline-panel'
import {
  generateFullStory, generateCharacterDetail, type AiFullStoryResult, type AiCharacter,
} from '@editor/lib/ai-service'
import { convertAiStoryToGraph, convertAiCharacterToStoryCharacter } from '@editor/lib/ai-story-converter'
import type { StoryNode, StoryEdge, StoryCharacter } from '@editor/types/editor'

interface FlatAiConfig {
  enabled: boolean
  provider: string
  apiKey: string
  apiUrl: string
  model: string
}

interface AiPanelProps {
  onApplyStory: (nodes: StoryNode[], edges: StoryEdge[], characters: StoryCharacter[], title: string) => void
  onAddCharacters: (characters: StoryCharacter[]) => void
}

const GENRES = [
  { value: 'romance', label: '恋爱', icon: '💕' },
  { value: 'adventure', label: '冒险', icon: '⚔️' },
  { value: 'mystery', label: '悬疑', icon: '🔍' },
  { value: 'fantasy', label: '奇幻', icon: '🧙' },
  { value: 'scifi', label: '科幻', icon: '🚀' },
  { value: 'comedy', label: '喜剧', icon: '😄' },
  { value: 'horror', label: '恐怖', icon: '👻' },
  { value: 'drama', label: '剧情', icon: '🎭' },
]

const PROVIDER_INFO: Record<string, {
  name: string; website: string; apiUrl: string; defaultModel: string
}> = {
  openai: { name: 'OpenAI', website: 'https://platform.openai.com', apiUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
  anthropic: { name: 'Anthropic', website: 'https://console.anthropic.com', apiUrl: 'https://api.anthropic.com', defaultModel: 'claude-3-5-haiku-latest' },
  deepseek: { name: 'DeepSeek', website: 'https://platform.deepseek.com', apiUrl: 'https://api.deepseek.com', defaultModel: 'deepseek-chat' },
  google: { name: 'Google AI', website: 'https://aistudio.google.com', apiUrl: 'https://generativelanguage.googleapis.com/v1beta', defaultModel: 'gemini-2.0-flash' },
}

export function AiPanel({ onApplyStory, onAddCharacters }: AiPanelProps) {
  const [activeSection, setActiveSection] = useState<'generate' | 'settings'>('generate')
  const [aiEnabled, setAiEnabled] = useState(() => {
    const saved = localStorage.getItem('subsilicon_ai_config')
    return saved ? JSON.parse(saved).enabled ?? false : false
  })
  const [aiConfig, setAiConfig] = useState<FlatAiConfig>(() => {
    const saved = localStorage.getItem('subsilicon_ai_config')
    return saved ? JSON.parse(saved) : {
      enabled: false,
      provider: 'openai',
      apiKey: '',
      apiUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    }
  })

  const [showApiKey, setShowApiKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedStory, setGeneratedStory] = useState<AiFullStoryResult | null>(null)
  const [generatedCharacter, setGeneratedCharacter] = useState<AiCharacter | null>(null)

  const [storyTopic, setStoryTopic] = useState('')
  const [storyGenre, setStoryGenre] = useState('fantasy')
  const [storyCharacterCount, setStoryCharacterCount] = useState(3)
  const [storySceneCount, setStorySceneCount] = useState(5)

  const [charName, setCharName] = useState('')
  const [charPersonality, setCharPersonality] = useState('')
  const [charGenre, setCharGenre] = useState('general')

  useEffect(() => {
    const config = { ...aiConfig, enabled: aiEnabled }
    localStorage.setItem('subsilicon_ai_config', JSON.stringify(config))
  }, [aiConfig, aiEnabled])

  const updateProvider = (provider: string) => {
    const info = PROVIDER_INFO[provider]
    setAiConfig((prev) => ({
      ...prev,
      provider,
      apiUrl: info.apiUrl,
      model: info.defaultModel,
    }))
  }

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const resp = await fetch(aiConfig.apiUrl + '/models', {
        headers: { Authorization: `Bearer ${aiConfig.apiKey}` },
      })
      if (resp.ok) {
        setTestResult({ ok: true, message: '连接成功' })
      } else {
        setTestResult({ ok: false, message: `连接失败 (${resp.status})` })
      }
    } catch {
      setTestResult({ ok: false, message: '无法连接到 API 地址' })
    }
    setTesting(false)
  }

  const handleFullStory = async () => {
    if (!storyTopic.trim()) { showToast('error', '请输入故事主题'); return }
    setIsGenerating(true)
    try {
      const result = await generateFullStory(storyTopic, storyGenre, storyCharacterCount, storySceneCount)
      setGeneratedStory(result)
      showToast('success', '故事生成完成')
    } catch (e) {
      showToast('error', '生成失败: ' + (e instanceof Error ? e.message : '未知错误'))
    }
    setIsGenerating(false)
  }

  const handleCharacterGen = async () => {
    if (!charName.trim()) { showToast('error', '请输入角色名称'); return }
    setIsGenerating(true)
    try {
      const result = await generateCharacterDetail(charName, charPersonality, charGenre)
      setGeneratedCharacter(result.character)
      showToast('success', '角色生成完成')
    } catch (e) {
      showToast('error', '生成失败: ' + (e instanceof Error ? e.message : '未知错误'))
    }
    setIsGenerating(false)
  }

  const applyGeneratedStory = () => {
    if (!generatedStory) return
    const { nodes, edges } = convertAiStoryToGraph(generatedStory)
    const characters = generatedStory.characters.map(c => convertAiCharacterToStoryCharacter(c))
    onApplyStory(nodes, edges, characters, generatedStory.title)
    showToast('success', '故事已应用到画布')
  }

  const applyGeneratedCharacter = () => {
    if (!generatedCharacter) return
    const char = convertAiCharacterToStoryCharacter(generatedCharacter)
    onAddCharacters([char])
    showToast('success', '角色已添加到列表')
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-1 px-2 py-1.5 bg-slate-900 border-b border-slate-800">
        <button
          onClick={() => setActiveSection('generate')}
          className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${
            activeSection === 'generate' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wand2 className="w-3 h-3 inline mr-1" />
          创作
        </button>
        <button
          onClick={() => setActiveSection('settings')}
          className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${
            activeSection === 'settings' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Settings className="w-3 h-3 inline mr-1" />
          设置
        </button>
      </div>

      {activeSection === 'settings' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white">启用 AI</span>
            <Toggle
              checked={aiEnabled}
              onChange={setAiEnabled}
            />
          </div>

          {aiEnabled && (
            <>
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400">服务商</label>
                <select
                  value={aiConfig.provider}
                  onChange={(e) => updateProvider(e.target.value)}
                  className="w-full h-7 text-xs rounded border border-slate-600 bg-slate-700 px-2 text-white"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="google">Google AI</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-slate-400">API Key</label>
                <div className="flex gap-1">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={aiConfig.apiKey}
                    onChange={(e) => setAiConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
                    className="flex-1 h-7 text-xs rounded border border-slate-600 bg-slate-700 px-2 text-white"
                    placeholder="sk-..."
                  />
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="px-1.5 text-slate-400 hover:text-slate-200"
                  >
                    {showApiKey ? '隐藏' : '显示'}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-slate-400">API 地址</label>
                <input
                  value={aiConfig.apiUrl}
                  onChange={(e) => setAiConfig((prev) => ({ ...prev, apiUrl: e.target.value }))}
                  className="w-full h-7 text-xs rounded border border-slate-600 bg-slate-700 px-2 text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-slate-400">模型名称</label>
                <input
                  value={aiConfig.model}
                  onChange={(e) => setAiConfig((prev) => ({ ...prev, model: e.target.value }))}
                  className="w-full h-7 text-xs rounded border border-slate-600 bg-slate-700 px-2 text-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={testConnection}
                  disabled={testing || !aiConfig.apiKey}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded transition-colors disabled:opacity-50"
                >
                  {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
                  测试连接
                </button>
                {testResult && (
                  <span className={`text-[10px] ${testResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                    {testResult.message}
                  </span>
                )}
              </div>
            </>
          )}

          <div className="pt-2 border-t border-slate-700">
            <AiOutlinePanel />
          </div>
        </div>
      )}

      {activeSection === 'generate' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-pink-400" />
              完整故事生成
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <input
                  value={storyTopic}
                  onChange={(e) => setStoryTopic(e.target.value)}
                  placeholder="输入故事主题..."
                  className="w-full h-7 text-xs rounded border border-slate-600 bg-slate-700 px-2 text-white"
                />
              </div>
              <select
                value={storyGenre}
                onChange={(e) => setStoryGenre(e.target.value)}
                className="h-7 text-xs rounded border border-slate-600 bg-slate-700 px-1.5 text-white"
              >
                {GENRES.map((g) => (
                  <option key={g.value} value={g.value}>{g.icon} {g.label}</option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <input
                  type="number" min={1} max={10}
                  value={storyCharacterCount}
                  onChange={(e) => setStoryCharacterCount(Number(e.target.value))}
                  className="w-10 h-7 text-xs rounded border border-slate-600 bg-slate-700 px-1 text-white text-center"
                />
                <span className="text-[10px] text-slate-400">角色</span>
                <input
                  type="number" min={1} max={20}
                  value={storySceneCount}
                  onChange={(e) => setStorySceneCount(Number(e.target.value))}
                  className="w-10 h-7 text-xs rounded border border-slate-600 bg-slate-700 px-1 text-white text-center"
                />
                <span className="text-[10px] text-slate-400">场景</span>
              </div>
            </div>
            <button
              onClick={handleFullStory}
              disabled={isGenerating || !storyTopic.trim()}
              className="w-full flex items-center justify-center gap-1 py-1.5 text-xs bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 rounded transition-colors disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
              生成完整故事
            </button>

            {generatedStory && (
              <div className="p-2 bg-slate-800/50 rounded-lg border border-slate-700 space-y-2">
                <p className="text-xs font-medium text-white">{generatedStory.title}</p>
                <p className="text-[10px] text-slate-400 line-clamp-3">{generatedStory.description}</p>
                <button
                  onClick={applyGeneratedStory}
                  className="w-full py-1 text-[10px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded transition-colors"
                >
                  应用到画布
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-slate-700 pt-3 space-y-3">
            <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-purple-400" />
              角色生成
            </h4>
            <div className="space-y-2">
              <input
                value={charName}
                onChange={(e) => setCharName(e.target.value)}
                placeholder="角色名称"
                className="w-full h-7 text-xs rounded border border-slate-600 bg-slate-700 px-2 text-white"
              />
              <input
                value={charPersonality}
                onChange={(e) => setCharPersonality(e.target.value)}
                placeholder="性格特点（如：乐观开朗、外冷内热）"
                className="w-full h-7 text-xs rounded border border-slate-600 bg-slate-700 px-2 text-white"
              />
            </div>
            <button
              onClick={handleCharacterGen}
              disabled={isGenerating || !charName.trim()}
              className="w-full flex items-center justify-center gap-1 py-1.5 text-xs bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded transition-colors disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Users className="w-3 h-3" />}
              生成角色
            </button>

            {generatedCharacter && (
              <div className="p-2 bg-slate-800/50 rounded-lg border border-slate-700 space-y-2">
                <p className="text-xs font-medium text-white">{generatedCharacter.name}</p>
                <p className="text-[10px] text-slate-400 line-clamp-2">{generatedCharacter.bio || generatedCharacter.background}</p>
                <button
                  onClick={applyGeneratedCharacter}
                  className="w-full py-1 text-[10px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded transition-colors"
                >
                  添加到角色列表
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
