'use client'

import { useState } from 'react'
import { Lightbulb, Loader2, Wand2, ArrowRight, Sparkles, GitBranch, Clock, RefreshCw } from 'lucide-react'
import { showToast } from './toast'
import { isAiAvailable, suggestNextPlot, generateNodeContent, type PlotSuggestion } from '@editor/lib/ai'
import type { StoryNode, StoryEdge, StoryCharacter } from '@editor/types/editor'

interface AiStoryAssistPanelProps {
  nodes: StoryNode[]
  edges: StoryEdge[]
  characters: StoryCharacter[]
  onApplySuggestion?: (nodeType: string, content: string) => void
}

export function AiStoryAssistPanel({ nodes, edges, characters, onApplySuggestion }: AiStoryAssistPanelProps) {
  const [suggestion, setSuggestion] = useState<PlotSuggestion | null>(null)
  const [loading, setLoading] = useState(false)
  const [suggestContext, setSuggestContext] = useState('') // 剧情推演的上下文
  const [generatedContent, setGeneratedContent] = useState('')
  const [genLoading, setGenLoading] = useState(false)
  const [genContext, setGenContext] = useState('') // 内容生成的上下文
  const [selectedNodeType, setSelectedNodeType] = useState('dialogue')

  const handleSuggest = async () => {
    const available = await isAiAvailable()
    if (!available) {
      showToast('error', 'AI 未配置，请先在 AI 设置中配置 API')
      return
    }

    setLoading(true)
    try {
      const result = await suggestNextPlot(nodes, edges, characters, suggestContext)
      setSuggestion(result)
      showToast('success', '剧情推演完成')
    } catch (e) {
      showToast('error', '推演失败: ' + (e instanceof Error ? e.message : '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateContent = async () => {
    const available = await isAiAvailable()
    if (!available) {
      showToast('error', 'AI 未配置，请先在 AI 设置中配置 API')
      return
    }

    if (!genContext.trim()) {
      showToast('error', '请输入生成要求')
      return
    }

    setGenLoading(true)
    try {
      const result = await generateNodeContent(selectedNodeType, genContext, characters)
      setGeneratedContent(result)
      showToast('success', '内容生成完成')
    } catch (e) {
      showToast('error', '生成失败: ' + (e instanceof Error ? e.message : '未知错误'))
    } finally {
      setGenLoading(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* 剧情推演 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-medium text-white">剧情智能推演</h3>
        </div>
        <p className="text-[11px] text-slate-400">
          基于当前 {nodes.length} 个节点和 {characters.length} 个角色，AI 将建议后续剧情发展。
        </p>

        <textarea
          value={suggestContext}
          onChange={(e) => setSuggestContext(e.target.value)}
          placeholder="输入额外要求（可选）：例如'希望剧情更加悬疑'、'增加感情线'等"
          className="w-full h-16 text-xs rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
        />

        <button
          onClick={handleSuggest}
          disabled={loading || nodes.length === 0}
          className="w-full flex items-center justify-center gap-2 py-2 text-xs bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lightbulb className="w-3.5 h-3.5" />}
          {loading ? '推演中...' : '开始剧情推演'}
        </button>

        {suggestion && (
          <div className="space-y-3">
            <div className="p-3 bg-slate-700/40 rounded-lg border border-slate-600/50">
              <p className="text-[11px] text-amber-400 font-medium mb-1">剧情分析</p>
              <p className="text-xs text-slate-300">{suggestion.summary}</p>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] text-slate-400 font-medium">分支建议</p>
              {suggestion.branches.map((branch, i) => (
                <div key={i} className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50 hover:border-amber-500/30 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-white">{branch.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-600 text-slate-300">{branch.nodeType}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2">{branch.description}</p>
                  <div className="bg-slate-800/50 rounded p-2 mb-2">
                    <p className="text-xs text-slate-300 line-clamp-3">{branch.suggestedText}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">{branch.emotionalImpact}</span>
                    <button
                      onClick={() => onApplySuggestion?.(branch.nodeType, branch.suggestedText)}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] bg-amber-500/15 text-amber-400 rounded hover:bg-amber-500/25 transition-colors"
                    >
                      <ArrowRight className="w-3 h-3" />
                      应用
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {(suggestion.characterDevelopment || suggestion.pacing) && (
              <div className="grid grid-cols-2 gap-2">
                {suggestion.characterDevelopment && (
                  <div className="p-2.5 bg-slate-700/30 rounded-lg border border-slate-600/50">
                    <p className="text-[10px] text-slate-400 mb-1">角色发展</p>
                    <p className="text-[11px] text-slate-300">{suggestion.characterDevelopment}</p>
                  </div>
                )}
                {suggestion.pacing && (
                  <div className="p-2.5 bg-slate-700/30 rounded-lg border border-slate-600/50">
                    <p className="text-[10px] text-slate-400 mb-1">节奏建议</p>
                    <p className="text-[11px] text-slate-300">{suggestion.pacing}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-slate-700 pt-4 space-y-3">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-medium text-white">内容生成</h3>
        </div>

        <div className="flex gap-2">
          {[
            { value: 'dialogue', label: '对话' },
            { value: 'narration', label: '旁白' },
            { value: 'choice', label: '选项' },
          ].map((type) => (
            <button
              key={type.value}
              onClick={() => setSelectedNodeType(type.value)}
              className={`flex-1 py-1.5 text-[11px] rounded-md border transition-colors ${
                selectedNodeType === type.value
                  ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                  : 'bg-slate-700 text-slate-400 border-slate-600 hover:border-slate-500'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        <textarea
          value={genContext}
          onChange={(e) => setGenContext(e.target.value)}
          placeholder={`描述你要生成的${selectedNodeType === 'dialogue' ? '对话' : selectedNodeType === 'narration' ? '旁白' : '选项'}内容...`}
          className="w-full h-20 text-xs rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
        />

        <button
          onClick={handleGenerateContent}
          disabled={genLoading}
          className="w-full flex items-center justify-center gap-2 py-2 text-xs bg-purple-500/15 text-purple-400 border border-purple-500/30 hover:bg-purple-500/25 rounded-lg transition-colors disabled:opacity-50"
        >
          {genLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {genLoading ? '生成中...' : '生成内容'}
        </button>

        {generatedContent && (
          <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] text-purple-400">生成结果</p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedContent)
                  showToast('success', '已复制到剪贴板')
                }}
                className="text-[10px] text-slate-400 hover:text-white transition-colors"
              >
                复制
              </button>
            </div>
            <p className="text-xs text-slate-300 whitespace-pre-wrap">{generatedContent}</p>
          </div>
        )}
      </div>
    </div>
  )
}
