'use client'

import { useState } from 'react'
import { Sparkles, Loader2, Wand2, PenLine, ArrowRight, Lightbulb, Image, Video } from 'lucide-react'
import { showToast } from './toast'
import { isAiAvailable, callAi } from '@editor/lib/ai'

export type AiAssistMode = 'polish' | 'continue' | 'generate' | 'expand' | 'suggest' | 'image' | 'video'

interface AiAssistButtonProps {
  mode: AiAssistMode
  context: string
  onResult: (result: string) => void
  className?: string
  size?: 'sm' | 'md'
  label?: string
}

const MODE_CONFIG: Record<AiAssistMode, {
  icon: React.ReactNode
  label: string
  tooltip: string
  systemPrompt: string
}> = {
  polish: {
    icon: <PenLine className="w-3 h-3" />,
    label: '润色',
    tooltip: 'AI 润色当前文本',
    systemPrompt: '你是一位专业的文字编辑。请对以下文本进行润色，使其更加流畅、生动、有感染力。保持原意不变，直接输出润色后的文本，不要添加解释。',
  },
  continue: {
    icon: <ArrowRight className="w-3 h-3" />,
    label: '续写',
    tooltip: 'AI 基于上下文续写内容',
    systemPrompt: '你是一位专业的故事创作者。请根据以下内容续写，保持风格一致，情节连贯。直接输出续写内容，不要添加解释。',
  },
  generate: {
    icon: <Wand2 className="w-3 h-3" />,
    label: '生成',
    tooltip: 'AI 基于提示生成内容',
    systemPrompt: '你是一位专业的互动叙事创作者。请根据以下要求生成内容，要求生动有趣、适合互动叙事场景。直接输出内容，不要添加解释。',
  },
  expand: {
    icon: <Sparkles className="w-3 h-3" />,
    label: '扩写',
    tooltip: 'AI 扩展当前内容',
    systemPrompt: '你是一位专业的故事创作者。请将以下简短内容扩展成更丰富、更详细的版本，增加细节描写和情感表达。直接输出扩写后的内容，不要添加解释。',
  },
  suggest: {
    icon: <Lightbulb className="w-3 h-3" />,
    label: '建议',
    tooltip: 'AI 提供剧情建议',
    systemPrompt: '你是一位专业的互动叙事设计师。请基于以下剧情内容，提供3个不同的后续发展建议，每个建议包含简短说明。用中文回复。',
  },
  image: {
    icon: <Image className="w-3 h-3" />,
    label: '生图',
    tooltip: 'AI 生成图片',
    systemPrompt: '',
  },
  video: {
    icon: <Video className="w-3 h-3" />,
    label: '生视频',
    tooltip: 'AI 生成视频',
    systemPrompt: '',
  },
}

export function AiAssistButton({ mode, context, onResult, className = '', size = 'sm', label }: AiAssistButtonProps) {
  const [loading, setLoading] = useState(false)
  const config = MODE_CONFIG[mode]

  const handleClick = async () => {
    const available = await isAiAvailable()
    if (!available) {
      showToast('error', 'AI 未配置，请先在 AI 设置中配置 API')
      return
    }

    if (!context.trim()) {
      showToast('error', '内容为空，无法处理')
      return
    }

    setLoading(true)
    try {
      if (mode === 'image' || mode === 'video') {
        showToast('info', '图片/视频生成需要通过 AI 媒体服务调用')
        return
      }

      const result = await callAi({
        systemPrompt: config.systemPrompt,
        userPrompt: context,
        temperature: 0.75,
        maxTokens: 1500,
      })

      onResult(result.trim())
      showToast('success', `${config.label}完成`)
    } catch (e) {
      showToast('error', `${config.label}失败: ${e instanceof Error ? e.message : '未知错误'}`)
    } finally {
      setLoading(false)
    }
  }

  const sizeClasses = size === 'sm'
    ? 'px-2 py-1 text-[10px]'
    : 'px-3 py-1.5 text-xs'

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title={config.tooltip}
      className={`inline-flex items-center gap-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors disabled:opacity-50 ${sizeClasses} ${className}`}
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : config.icon}
      {label || config.label}
    </button>
  )
}
