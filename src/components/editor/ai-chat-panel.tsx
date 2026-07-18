'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Send, Bot, User, Trash2, Sparkles, Loader2, AlertCircle, Settings, Check, X, Image, Video, Music, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { showToast } from './toast'
import { AiSettingsDialog } from './ai-settings-dialog'
import { isAiAvailable, callAiStream, generateMedia, optimizePrompt, getMediaProviderConfig, buildConsistentImagePrompt, refreshAiConfig, type MediaProviderConfig } from '@editor/lib/ai'
import { serializeGraphContext } from '@editor/lib/ai/chat-graph-context'
import { getChatSystemPrompt } from '@editor/lib/ai/chat-system-prompt'
import { parseAllAiCommands, executeAiActions, type EditorCanvasCallbacks, type MediaGenerationRequest } from '@editor/lib/ai/chat-command-executor'
import { getModelsForProvider } from '@editor/lib/ai/model-presets'
import type { StoryNode, StoryEdge, StoryCharacter, ComicScene } from '@editor/types/editor'
import type { AiConfig, AiProviderConfig } from '@editor/types/ai'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  mediaRequests?: MediaGenerationRequest[]
}

interface AiChatPanelProps {
  nodes: StoryNode[]
  edges: StoryEdge[]
  characters: StoryCharacter[]
  scenes: ComicScene[]
  onUpdateNode: (nodeId: string, data: Partial<StoryNode['data']>) => void
  onDeleteNode: (nodeId: string) => void
  onUpdateEdge: (edgeId: string, data: Partial<StoryEdge>) => void
  onDeleteEdge: (edgeId: string) => void
  onAddNode?: (type: string, position: { x: number; y: number }, data: Record<string, unknown>) => string | undefined
  onAddEdge?: (source: string, target: string) => string | undefined
  onNodeSelect?: (nodeId: string) => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}

function buildCallbacks(props: AiChatPanelProps): EditorCanvasCallbacks {
  return {
    onUpdateNode: props.onUpdateNode,
    onDeleteNode: props.onDeleteNode,
    onUpdateEdge: props.onUpdateEdge,
    onDeleteEdge: props.onDeleteEdge,
    onAddNode: props.onAddNode,
    onAddEdge: props.onAddEdge,
    onNodeSelect: props.onNodeSelect,
  }
}

export function AiChatPanel(props: AiChatPanelProps) {
  const { nodes, edges, characters, scenes, collapsed, onToggleCollapse } = props

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'system',
      content: '我是创境助手，可以直接操作画布上的节点。试试对我说「创建一个对话节点」或「帮我设计一个悬疑故事开场」。',
      timestamp: Date.now(),
    },
  ])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [aiEnabled, setAiEnabled] = useState(false)
  const [showModelSwitcher, setShowModelSwitcher] = useState(false)
  const [currentProvider, setCurrentProvider] = useState('')
  const [currentModel, setCurrentModel] = useState('')
  const [configuredProviders, setConfiguredProviders] = useState<string[]>([])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const modelSwitcherRef = useRef<HTMLDivElement>(null)

  // 读取保存的配置，提取当前激活的 provider 和 model
  const loadConfigState = useCallback(() => {
    try {
      const saved = localStorage.getItem('subsilicon_ai_config')
      if (!saved) return
      const config = JSON.parse(saved) as AiConfig & Record<string, unknown>
      if (!config.enabled) return

      // 兼容两种格式
      if (Array.isArray(config.providers) && config.providers.length > 0) {
        const enabled = config.providers.filter((p: AiProviderConfig) => p.enabled && p.apiKey)
        setConfiguredProviders(enabled.map((p: AiProviderConfig) => p.provider))
        if (enabled.length > 0) {
          setCurrentProvider(enabled[0].provider)
          setCurrentModel(enabled[0].model || '')
        }
      } else if (config.provider && config.apiKey) {
        // FlatAiConfig 格式
        setConfiguredProviders([config.provider as string])
        setCurrentProvider(config.provider as string)
        setCurrentModel(config.model as string || '')
      }
    } catch { /* ignore */ }
  }, [])

  // 初始化：读取配置状态
  useEffect(() => {
    setAiEnabled(isAiAvailable())
    loadConfigState()
  }, [loadConfigState])

  // 构建模型切换器列表：只显示已配置 provider 的模型
  const modelSwitcherList = useMemo(() => {
    const result: { provider: string; label: string; model: string; name: string }[] = []
    for (const prov of configuredProviders) {
      const models = getModelsForProvider(prov)
      for (const m of models) {
        result.push({ provider: prov, label: prov, model: m.id, name: m.name })
      }
    }
    return result
  }, [configuredProviders])

  // Group models by provider for display
  const modelGroups = useMemo(() => {
    const groups: Record<string, typeof modelSwitcherList> = {}
    for (const item of modelSwitcherList) {
      if (!groups[item.provider]) groups[item.provider] = []
      groups[item.provider].push(item)
    }
    return groups
  }, [modelSwitcherList])

  // 点外部关闭模型选择器
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modelSwitcherRef.current && !modelSwitcherRef.current.contains(e.target as Node)) {
        setShowModelSwitcher(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // 切换模型 - 更新 saved config 中对应 provider 的 model
  const switchModel = (model: string) => {
    try {
      const saved = localStorage.getItem('subsilicon_ai_config')
      if (!saved) return
      const config = JSON.parse(saved)
      if (Array.isArray(config.providers)) {
        // 多 provider 格式：更新当前 provider 的 model
        config.providers = config.providers.map((p: AiProviderConfig) =>
          p.provider === currentProvider ? { ...p, model } : p
        )
      } else {
        // FlatAiConfig 格式：更新 model
        config.model = model
      }
      localStorage.setItem('subsilicon_ai_config', JSON.stringify(config))
      refreshAiConfig()
      setCurrentModel(model)
      showToast('success', `已切换到 ${model}`)
    } catch { /* ignore */ }
  }

  // 自动滚动到最新消息
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingContent, scrollToBottom])

  // 自动调整 textarea 高度
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px'
    }
  }, [input])

  // 发送消息
  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return

    setInput('')
    setIsStreaming(true)

    // 初始化 AbortController
    abortRef.current = new AbortController()

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, userMessage])

    // 构建创境请求
    const graphContext = serializeGraphContext(nodes, edges, characters, scenes)
    const systemPrompt = getChatSystemPrompt(graphContext)

    try {
      const available = isAiAvailable()
      if (!available) {
        setMessages((prev) => [...prev, {
          id: `err-${Date.now()}`,
          role: 'system',
          content: '创境未配置。请在创境设置中配置 API 服务商或启动本地 Ollama。',
          timestamp: Date.now(),
        }])
        setIsStreaming(false)
        return
      }

      setStreamingContent('')

      // 构建对话历史
      const conversationHistory = messages
        .filter((m) => m.role !== 'system')
        .slice(-10) // 最多保留最近 10 条消息
        .map((m) => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`)
        .join('\n')

      const userPrompt = conversationHistory
        ? `以下是之前的对话：\n${conversationHistory}\n\n用户的新消息：${trimmed}`
        : trimmed

      const result = await callAiStream({
        systemPrompt,
        userPrompt,
        temperature: 0.7,
        maxTokens: 4096,
      })

      let fullText = ''
      const assistantId = `ai-${Date.now()}`

      // 更新助手的流式响应
      const updateStream = () => {
        setStreamingContent(fullText)
      }

      for await (const chunk of result.stream) {
        if (abortRef.current?.signal.aborted) break
        fullText += chunk
        updateStream()
      }

      // 流结束后，解析并执行命令
      let mediaRequests: MediaGenerationRequest[] = []
      if (fullText.trim()) {
        const commandBlocks = parseAllAiCommands(fullText)
        if (commandBlocks.length > 0) {
          const allActions = commandBlocks.flatMap((b) => b.actions)
          if (allActions.length > 0) {
            const callbacks = buildCallbacks(props)
            const result = await executeAiActions(allActions, callbacks)
            mediaRequests = result.mediaRequests
            const actionSummary = `✅ 成功 ${result.success} 个操作` +
              (result.failed > 0 ? `, ❌ 失败 ${result.failed} 个` : '') +
              (mediaRequests.length > 0 ? `, 📋 ${mediaRequests.length} 个生成请求待确认` : '')
            fullText += `\n\n---\n${actionSummary}`
          }
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: 'assistant',
          content: fullText,
          timestamp: Date.now(),
          mediaRequests: mediaRequests.length > 0 ? mediaRequests : undefined,
        },
      ])
      setStreamingContent('')
    } catch (e) {
      if (abortRef.current?.signal.aborted) return
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'system',
          content: `请求失败: ${e instanceof Error ? e.message : '未知错误'}`,
          timestamp: Date.now(),
        },
      ])
    } finally {
      setIsStreaming(false)
    }
  }

  // 中断流式输出
  const handleStop = () => {
    abortRef.current?.abort()
    setIsStreaming(false)
    // 如果有流式内容，保存为消息
    if (streamingContent.trim()) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: streamingContent + '\n\n*（已中断）*',
          timestamp: Date.now(),
        },
      ])
      setStreamingContent('')
    }
  }

  // 清空对话
  const handleClear = () => {
    if (isStreaming) {
      abortRef.current?.abort()
      setIsStreaming(false)
    }
    setMessages([
      {
        id: 'welcome-' + Date.now(),
        role: 'system',
        content: '对话已清空。有什么我可以帮你的？',
        timestamp: Date.now(),
      },
    ])
    setStreamingContent('')
  }

  // 处理媒体生成请求
  const handleGenerateMedia = useCallback(async (msgId: string, request: MediaGenerationRequest) => {
    const provider = getMediaProviderConfig()
    if (!provider) {
      showToast('error', '请先配置媒体生成服务商（在创境设置 → 媒体生成中配置）')
      return
    }

    // 在消息中更新该请求的状态为 generating
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== msgId || !msg.mediaRequests) return msg
        return {
          ...msg,
          mediaRequests: msg.mediaRequests.map((r, i) =>
            i === msg.mediaRequests!.indexOf(request) ? { ...r, _status: 'generating' as const } : r
          ),
        }
      })
    )

    try {
      // 优化 prompt
      const optimized = await optimizePrompt(request.prompt, request.mediaType as 'image' | 'video', request.style || 'anime')
      const result = await generateMedia(
        { prompt: optimized, width: request.width || 1024, height: request.height || 1024, style: (request.style || 'anime') as any },
        provider
      )

      // 将生成结果添加到场景
      const mediaIcon = request.mediaType === 'image' ? '🖼️' : request.mediaType === 'video' ? '🎬' : '🎵'
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== msgId || !msg.mediaRequests) return msg
          return {
            ...msg,
            mediaRequests: msg.mediaRequests.map((r) =>
              r === request ? { ...r, _status: 'done' as const, _result: result.url } : r
            ),
          }
        })
      )
      showToast('success', `${mediaIcon} 生成完成`)
    } catch (e) {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== msgId || !msg.mediaRequests) return msg
          return {
            ...msg,
            mediaRequests: msg.mediaRequests.map((r) =>
              r === request ? { ...r, _status: 'error' as const } : r
            ),
          }
        })
      )
      showToast('error', `生成失败: ${e instanceof Error ? e.message : '未知错误'}`)
    }
  }, [])

  // 拒绝媒体生成
  const handleRejectMedia = useCallback((msgId: string, request: MediaGenerationRequest) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== msgId || !msg.mediaRequests) return msg
        return {
          ...msg,
          mediaRequests: msg.mediaRequests.map((r) =>
            r === request ? { ...r, _status: 'rejected' as const } : r
          ),
        }
      })
    )
  }, [])

  // 键盘快捷键：Enter 发送，Shift+Enter 换行
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // 渲染消息内容（支持简单 markdown 格式）
  const renderContent = (content: string) => {
    // 将 ```ai-action 代码块高亮为可识别的操作块
    const parts = content.split(/(```ai-action[\s\S]*?```)/g)
    return parts.map((part, i) => {
      if (part.startsWith('```ai-action')) {
        const json = part.replace(/```ai-action\n?/, '').replace(/```$/, '')
        let actionCount = 0
        try {
          const parsed = JSON.parse(json.trim())
          actionCount = parsed.actions?.length || 0
        } catch {
          // ignore
        }
        return (
          <div key={i} className="my-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-400">
            <Sparkles className="w-3 h-3 inline mr-1" />
            执行 {actionCount} 个画布操作
          </div>
        )
      }
      // 普通文本，简单的换行处理
      return (
        <span key={i} className="whitespace-pre-wrap">
          {part.split('\n').map((line, j) => (
            <span key={j}>
              {line}
              {j < part.split('\n').length - 1 && <br />}
            </span>
          ))}
        </span>
      )
    })
  }

  if (collapsed) {
    return (
      <div className="flex flex-col h-full w-10 bg-slate-900 border-r border-slate-800 items-center py-2 gap-2 shrink-0">
        <div
          className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0"
          title="创境 AI 对话"
        >
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          title="展开 AI 面板"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        {aiEnabled && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="已连接" />
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-w-0">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-xs font-medium text-white shrink-0">创境</span>
          {aiEnabled && (
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">已连接</span>
          )}
          {/* 模型切换器 */}
          {aiEnabled && currentModel && (
            <div className="relative" ref={modelSwitcherRef}>
              <button
                onClick={() => setShowModelSwitcher(!showModelSwitcher)}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded transition-colors"
                title="切换模型"
              >
                {currentModel}
                <ChevronDown className="w-3 h-3" />
              </button>
              {showModelSwitcher && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 py-1 max-h-80 overflow-y-auto">
                  {Object.entries(modelGroups).map(([provider, models]) => (
                    <div key={provider}>
                      <div className="px-2 py-1 text-[10px] text-slate-500 font-medium uppercase border-b border-slate-700/50">
                        {provider}
                      </div>
                      {models.map((m) => (
                        <button
                          key={m.model}
                          onClick={() => {
                            if (m.provider !== currentProvider) {
                              setCurrentProvider(m.provider)
                            }
                            switchModel(m.model)
                            setShowModelSwitcher(false)
                          }}
                          className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-slate-700 transition-colors flex items-center gap-2 ${
                            currentModel === m.model ? 'text-amber-400 bg-amber-500/10' : 'text-slate-300'
                          }`}
                        >
                          <span className="flex-1">{m.name}</span>
                          <span className="text-[10px] text-slate-500">{m.model}</span>
                          {currentModel === m.model && <Check className="w-3 h-3 text-amber-400 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="收起 AI 面板"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="创境设置"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleClear}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="清空对话"
            disabled={messages.length <= 1 && !streamingContent}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role !== 'user' && (
              <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                {msg.role === 'system' ? (
                  <Sparkles className="w-3 h-3 text-amber-400" />
                ) : (
                  <Bot className="w-3 h-3 text-amber-400" />
                )}
              </div>
            )}
            <div
              className={`max-w-[85%] px-3 py-2 rounded-lg text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-amber-500/20 text-amber-100 border border-amber-500/20'
                  : msg.role === 'system'
                    ? 'bg-slate-700/50 text-slate-300 border border-slate-600/50'
                    : 'bg-slate-700/30 text-slate-200 border border-slate-600/30'
              }`}
            >
              {renderContent(msg.content)}
              {/* 媒体生成请求卡片 */}
              {msg.mediaRequests && msg.mediaRequests.length > 0 && (
                <div className="mt-2 space-y-2 border-t border-slate-600/30 pt-2">
                  {msg.mediaRequests.map((req, i) => {
                    const status = (req as any)._status as string | undefined
                    const result = (req as any)._result as string | undefined
                    const mediaIcon = req.mediaType === 'image' ? Image : req.mediaType === 'video' ? Video : Music
                    const mediaColor = req.mediaType === 'image' ? 'text-pink-400' : req.mediaType === 'video' ? 'text-purple-400' : 'text-green-400'
                    const mediaBg = req.mediaType === 'image' ? 'bg-pink-500/10 border-pink-500/20' :
                                    req.mediaType === 'video' ? 'bg-purple-500/10 border-purple-500/20' : 'bg-green-500/10 border-green-500/20'

                    if (status === 'done' && result) {
                      return (
                        <div key={i} className={`p-2 rounded border ${mediaBg}`}>
                          <img src={result} alt={req.prompt} className="w-full rounded mb-1.5 max-h-48 object-cover" />
                          <p className="text-[10px] text-slate-400 truncate">{req.prompt}</p>
                        </div>
                      )
                    }

                    if (status === 'rejected') {
                      return (
                        <div key={i} className="p-2 rounded bg-slate-700/50 border border-slate-600/50">
                          <p className="text-[10px] text-slate-500">已拒绝生成</p>
                        </div>
                      )
                    }

                    if (status === 'generating') {
                      return (
                        <div key={i} className={`p-2 rounded border ${mediaBg}`}>
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span className="text-[10px]">正在生成 {req.mediaType === 'image' ? '图片' : req.mediaType === 'video' ? '视频' : '音频'}...</span>
                          </div>
                        </div>
                      )
                    }

                    if (status === 'error') {
                      return (
                        <div key={i} className={`p-2 rounded border ${mediaBg}`}>
                          <p className="text-[10px] text-red-400">生成失败，请重试</p>
                        </div>
                      )
                    }

                    return (
                      <div key={i} className={`p-2 rounded border ${mediaBg}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          {req.mediaType === 'image' ? <Image className={`w-3 h-3 ${mediaColor}`} /> :
                           req.mediaType === 'video' ? <Video className={`w-3 h-3 ${mediaColor}`} /> :
                           <Music className={`w-3 h-3 ${mediaColor}`} />}
                          <span className={`text-[10px] font-medium ${mediaColor}`}>
                            {req.mediaType === 'image' ? '图片生成' : req.mediaType === 'video' ? '视频生成' : '音频生成'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate mb-2">{req.prompt}</p>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleGenerateMedia(msg.id, req)}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded hover:bg-amber-500/30 transition-colors"
                          >
                            <Check className="w-3 h-3" />
                            生成
                          </button>
                          <button
                            onClick={() => handleRejectMedia(msg.id, req)}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] bg-slate-600/50 text-slate-400 border border-slate-600/30 rounded hover:bg-slate-600 transition-colors"
                          >
                            <X className="w-3 h-3" />
                            跳过
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-3 h-3 text-blue-400" />
              </div>
            )}
          </div>
        ))}

        {/* 流式响应 */}
        {streamingContent && (
          <div className="flex gap-2 justify-start">
            <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="w-3 h-3 text-amber-400" />
            </div>
            <div className="max-w-[85%] px-3 py-2 rounded-lg text-xs leading-relaxed bg-slate-700/30 text-slate-200 border border-slate-600/30">
              {renderContent(streamingContent)}
              <span className="inline-block w-1.5 h-4 bg-amber-400/70 ml-0.5 animate-pulse" />
            </div>
          </div>
        )}

        {/* 创境未配置提示 */}
        {!aiEnabled && !isStreaming && messages.length <= 1 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="w-8 h-8 text-slate-500 mb-2" />
            <p className="text-xs text-slate-400 mb-3">创境服务未配置</p>
            <button
              onClick={() => setShowSettings(true)}
              className="px-3 py-1.5 text-xs bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/25 transition-colors"
            >
              配置创境服务商
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="shrink-0 border-t border-slate-700/50 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的创作需求... (Enter 发送, Shift+Enter 换行)"
            rows={1}
            disabled={isStreaming}
            className="flex-1 text-xs rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-none min-h-[34px] max-h-[120px] disabled:opacity-50"
          />
          {isStreaming ? (
            <button
              onClick={handleStop}
              className="px-3 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors shrink-0"
              title="停止生成"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() || !aiEnabled}
              className="px-3 py-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/30 transition-colors disabled:opacity-30 shrink-0"
              title="发送"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 创境设置弹窗 */}
      <AiSettingsDialog
        open={showSettings}
        onClose={() => {
          setShowSettings(false)
          setAiEnabled(isAiAvailable())
          loadConfigState()
        }}
      />
    </div>
  )
}
