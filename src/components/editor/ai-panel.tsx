'use client'

import { useState, useEffect } from 'react'
import { Sparkles, Settings, AlertCircle, Loader2, Wand2, BookOpen, Users, ArrowRight } from 'lucide-react'
import { showToast } from './toast'
import { AiSettingsDialog } from './ai-settings-dialog'
import {
  generateFullStory, generateCharacterDetail, type AiFullStoryResult, type AiCharacter,
} from '@editor/lib/ai-service'
import { convertAiStoryToGraph, convertAiCharacterToStoryCharacter } from '@editor/lib/ai-story-converter'
import type { StoryNode, StoryEdge, StoryCharacter } from '@editor/types/editor'

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

export function AiPanel({ onApplyStory, onAddCharacters }: AiPanelProps) {
  const [aiEnabled, setAiEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('subsilicon_ai_config')
      return saved ? JSON.parse(saved).enabled ?? false : false
    } catch {
      return false
    }
  })
  const [showSettings, setShowSettings] = useState(false)

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

  // 监听设置变更，刷新启用状态
  useEffect(() => {
    const checkEnabled = () => {
      try {
        const saved = localStorage.getItem('subsilicon_ai_config')
        if (saved) {
          const parsed = JSON.parse(saved)
          setAiEnabled(parsed.enabled ?? false)
        }
      } catch {
        // ignore
      }
    }
    // 设置关闭时刷新状态
    if (!showSettings) {
      checkEnabled()
    }
  }, [showSettings])

  const handleFullStory = async () => {
    if (!storyTopic.trim()) { showToast('error', '请输入故事主题'); return }
    setIsGenerating(true)
    try {
      const result = await generateFullStory(storyTopic, storyGenre, storyCharacterCount, storySceneCount)
      setGeneratedStory(result)
      showToast('success', '故事生成完成')
    } catch (e) {
      if (e instanceof Error && 'needsConfig' in e && (e as { needsConfig: boolean }).needsConfig) {
        setShowSettings(true)
        showToast('error', 'AI 未配置，请先设置 API Key 或启动本地 Ollama')
      } else {
        showToast('error', '生成失败: ' + (e instanceof Error ? e.message : '未知错误'))
      }
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
      if (e instanceof Error && 'needsConfig' in e && (e as { needsConfig: boolean }).needsConfig) {
        setShowSettings(true)
        showToast('error', 'AI 未配置，请先设置 API Key 或启动本地 Ollama')
      } else {
        showToast('error', '生成失败: ' + (e instanceof Error ? e.message : '未知错误'))
      }
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
    <>
      <div className="h-full flex flex-col">
        {/* AI 状态与跳转设置 */}
        <div className="flex items-center justify-between px-2 py-1.5 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-pink-400" />
            <span className="text-xs text-white">
              {aiEnabled ? 'AI 已启用' : 'AI 未配置'}
            </span>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
          >
            <Settings className="w-3 h-3" />
            设置
            <ArrowRight className="w-2.5 h-2.5" />
          </button>
        </div>

        {/* 未启用提示 */}
        {!aiEnabled && (
          <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
            <AlertCircle className="w-8 h-8 text-slate-500 mb-3" />
            <p className="text-xs text-slate-400 mb-2">AI 功能未启用</p>
            <p className="text-[10px] text-slate-500 mb-3">
              请在设置中配置 AI 服务商和 API Key
            </p>
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
            >
              <Settings className="w-3 h-3" />
              前往设置
            </button>
          </div>
        )}

        {/* AI 创作面板 */}
        {aiEnabled && (
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

      {/* AI 设置对话框 */}
      <AiSettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </>
  )
}