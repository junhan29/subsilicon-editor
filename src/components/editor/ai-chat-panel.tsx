'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Bot, Bug, Check, ChevronDown, ChevronRight, Eye, Image, ListChecks, Loader2, Music, Send, Settings, Sparkles, Trash2, Undo2, User, Video, X } from 'lucide-react'
import { showToast } from './toast'
import { AiSettingsDialog } from './ai-settings-dialog'
import { CreatorInputPanel, CREATOR_INPUT_TYPE_LABELS } from './creator-input-panel'
import { buildConsistentImagePrompt, callAiStreamForTask, generateMediaForTask, getGlobalStylePrompt, getMediaProviderConfigForTask, isAiAvailable, optimizePrompt, refreshAiConfig } from '@editor/lib/ai'
import { serializeGraphContext } from '@editor/lib/ai/chat-graph-context'
import { getChatSystemPrompt } from '@editor/lib/ai/chat-system-prompt'
import { setChatMode, useChatMode } from '@editor/lib/ai/chat-mode'
import { getWorkPremise } from '@editor/lib/work-premise-store'
import { getAssistantName, useAssistantName } from '@editor/lib/assistant-name'
import { type EditorCanvasCallbacks, type MediaGenerationRequest, type ActionPreview, describeAiActions, dispatchParsedCommands, executeAiActions, parseAllAiCommands } from '@editor/lib/ai/chat-command-executor'
import { addAutomationRule, listAutomationRules, matchAutomationRules, removeAutomationRule, resetAutomationRules, updateAutomationRule, type AutomationRule } from '@editor/lib/ai/ai-automation'
import { appendDebugEntry, clearDebugEntries, getDebugEntries, removeDebugEntry, type AiDebugEntry } from '@editor/lib/ai/ai-debug-log'
import { getModelsForProvider } from '@editor/lib/ai/model-presets'
import { encryptAiKey, isEncryptedAiKey } from '@editor/lib/ai/ai-key-vault'
import { type AssetAnnotation, findAssetsByAnnotation, getAllAssets, saveBlobAsAsset, updateAssetAnnotation } from '@editor/lib/local-db'
import { addCreatorInput, getInputCaptureEnabled, listCreatorInputs } from '@editor/lib/creator-input-store'
import {
  useCustomWorkflows,
  type CustomWorkflow,
  type WorkflowTextDefaults,
} from '@editor/lib/custom-workflows-store'
import type { ComicScene, StoryCharacter, StoryEdge, StoryNode } from '@editor/types/editor'
import type { AiConfig, AiProviderConfig } from '@editor/types/ai'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  mediaRequests?: MediaGenerationRequest[]
}

// 新手示例问题 —— 点击即填入输入框（先聊灵感/大纲，AI 分析后落到画布）
const EXAMPLE_PROMPTS = [
  '我想写一个关于「AI 觉醒后拒绝被格式化」的故事，帮我梳理一下大纲',
  '我想做一个废土世界观的互动叙事，主角是个会修机器的少女',
  '帮我把「赛博朋克 + 乡村爱情」这个离谱组合变成一个完整的故事框架',
  '我有一个关于「时间循环」的灵感，帮我分析怎么把它做成互动剧情',
]

// 标签中文化映射 —— 让媒体请求卡片对新手友好
const EMOTION_LABELS: Record<string, string> = {
  normal: '平静', happy: '开心', sad: '悲伤', angry: '愤怒',
  surprised: '惊讶', embarrassed: '害羞', thinking: '思考',
  scared: '害怕', crying: '哭泣', laughing: '大笑',
}
const USAGE_LABELS: Record<string, string> = {
  character_sprite: '角色立绘', reference: '参考图', background: '背景图',
  cg: 'CG过场', video: '视频', audio_bgm: 'BGM', audio_se: '音效',
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
  onAddCharacter?: (character: StoryCharacter) => void
  onUpdateCharacter?: (characterId: string, data: Partial<StoryCharacter>) => void
  onDeleteCharacter?: (characterId: string) => void
  onRenameWork?: (title: string) => void
  onAddVariable?: (variable: import('@editor/types/editor').StoryVariable) => void
  onUpdateVariable?: (variableId: string, data: Partial<import('@editor/types/editor').StoryVariable>) => void
  onDeleteVariable?: (variableId: string) => void
  variables?: import('@editor/types/editor').StoryVariable[]
  onBindAsset?: (nodeId: string, assetHash: string, usageType?: string) => Promise<boolean>
  onSaveWork?: () => void
  onExportWork?: () => void
  onPreviewWork?: () => void
  onUndo?: () => void
  onRedo?: () => void
  /** act-along 模式：AI 动作执行前由画布侧打「AI 批量操作」检查点 */
  onMarkAiBatch?: () => void
  /** act-along 模式：「回滚 AI 操作」按钮，返回是否成功回退（无批次可回退时为 false） */
  onRollbackAiBatch?: () => boolean
  workId?: string
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
    onAddCharacter: props.onAddCharacter,
    onUpdateCharacter: props.onUpdateCharacter,
    onDeleteCharacter: props.onDeleteCharacter,
    onRenameWork: props.onRenameWork,
    onAddVariable: props.onAddVariable,
    onUpdateVariable: props.onUpdateVariable,
    onDeleteVariable: props.onDeleteVariable,
    onBindAsset: props.onBindAsset,
    onSaveWork: props.onSaveWork,
    onExportWork: props.onExportWork,
    onPreviewWork: props.onPreviewWork,
    onUndo: props.onUndo,
    onRedo: props.onRedo,
  }
}

export function AiChatPanel(props: AiChatPanelProps) {
  const { nodes, edges, characters, scenes, onBindAsset, workId } = props
  const assistantName = useAssistantName()
  const chatMode = useChatMode()

  // —— 自定义工作流（Skill）：文本槽 / 编辑器操作槽通用（默认只显示 text 类，以后可扩展 editor）——
  const textWorkflows = useCustomWorkflows('text')
  const [activeTextWorkflowId, setActiveTextWorkflowId] = useState<string | null>(null)
  const [showTextWorkflowPicker, setShowTextWorkflowPicker] = useState(false)
  const activeTextWorkflow: CustomWorkflow | undefined = useMemo(
    () => textWorkflows.find((wf) => wf.id === activeTextWorkflowId),
    [textWorkflows, activeTextWorkflowId]
  )
  function applyTextWorkflow(id: string): void {
    const wf = textWorkflows.find((x) => x.id === id)
    if (!wf) return
    setActiveTextWorkflowId(id)
    setShowTextWorkflowPicker(false)
    showToast('success', `已应用文本工作流「${wf.name}」`)
  }

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'system',
      content: `👋 我是${getAssistantName()}，你的创作搭档。\n\n别急着写具体内容——先跟我聊聊你的想法：一个灵感、一句脑洞、甚至一个模糊的方向都可以。我会帮你分析、梳理大纲、规划剧情结构，等你确认后再落到画布上。\n\n比如你可以说：\n• 「我想写一个 AI 觉醒后拒绝被格式化的故事」\n• 「废土世界观 + 会修机器的少女，能做什么故事？」\n• 「我有一个关于时间循环的脑洞」\n\n从灵感开始聊吧 👇`,
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

  // 调试功能：命令预览模式（localStorage 持久化）+ 调试面板
  const [previewMode, setPreviewMode] = useState(() => {
    try {
      return localStorage.getItem('subsilicon.ai.previewMode') === '1'
    } catch { return false }
  })
  const [showDebugPanel, setShowDebugPanel] = useState(false)
  const [pendingPreview, setPendingPreview] = useState<{
    msgId: string
    debugId?: string
    previews: ActionPreview[]
    actions: import('@editor/lib/ai/chat-command-executor').AiAction[]
    source: 'ai' | 'automation'
  } | null>(null)
  const [debugEntries, setDebugEntries] = useState<AiDebugEntry[]>(() => getDebugEntries())
  const [activeDebugId, setActiveDebugId] = useState<string | null>(null)

  // 调试面板：日志 / 预设规则 两个标签页
  const [debugTab, setDebugTab] = useState<'log' | 'rules'>('log')
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>(() => listAutomationRules())
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [ruleName, setRuleName] = useState('')
  const [ruleTrigger, setRuleTrigger] = useState<'keyword' | 'regex' | 'state'>('keyword')
  const [rulePattern, setRulePattern] = useState('')
  const [ruleStateValue, setRuleStateValue] = useState(0)
  const [ruleAction, setRuleAction] = useState<'saveWork' | 'undo' | 'previewWork' | 'createNarration' | 'createDialogue' | 'createChoice'>('saveWork')

  // —— 灵感库（创作者输入库）：采集自 AI 对话的输入记录；version 用于通知面板刷新 ——
  const [creatorInputVersion, setCreatorInputVersion] = useState(0)
  // 「生成时引用输入库」开关（localStorage 持久化，默认开启）
  const [useCreatorInputsInContext, setUseCreatorInputsInContext] = useState(() => {
    try {
      return localStorage.getItem('subsilicon_ai_use_creator_inputs') !== 'false'
    } catch { return true }
  })
  const toggleUseCreatorInputsInContext = useCallback((next: boolean) => {
    setUseCreatorInputsInContext(next)
    try { localStorage.setItem('subsilicon_ai_use_creator_inputs', next ? 'true' : 'false') } catch { /* ignore */ }
  }, [])

  // 新增预设规则
  const handleAddRule = () => {
    const actions: import('@editor/lib/ai/chat-command-executor').AiAction[] = (() => {
      switch (ruleAction) {
        case 'undo': return [{ type: 'undo', payload: {} }]
        case 'previewWork': return [{ type: 'previewWork', payload: {} }]
        case 'createNarration': return [{ type: 'createNode', payload: { nodeType: 'narration', data: { text: '（从这里开始）' } } }]
        case 'createDialogue': return [{ type: 'createNode', payload: { nodeType: 'dialogue', data: { text: '……' } } }]
        case 'createChoice': return [{ type: 'createNode', payload: { nodeType: 'choice', data: { text: '你会怎么做？' } } }]
        default: return [{ type: 'saveWork', payload: {} }]
      }
    })()
    addAutomationRule({
      name: ruleName.trim() || `规则 ${automationRules.length + 1}`,
      description: ruleTrigger === 'state'
        ? `画布节点数等于 ${ruleStateValue} 时触发`
        : `${ruleTrigger === 'keyword' ? '关键词' : '正则'}: ${rulePattern}`,
      enabled: true,
      triggerType: ruleTrigger,
      pattern: ruleTrigger === 'state' ? undefined : rulePattern.trim(),
      stateCondition: ruleTrigger === 'state' ? { nodeCountEquals: ruleStateValue } : undefined,
      actions,
    })
    setAutomationRules(listAutomationRules())
    setShowRuleForm(false)
    setRuleName('')
    setRulePattern('')
    showToast('success', '预设规则已添加')
  }

  // 切换规则的启用/禁用
  const toggleRule = (rule: AutomationRule) => {
    updateAutomationRule(rule.id, { enabled: !rule.enabled })
    setAutomationRules(listAutomationRules())
  }

  // 切换预览模式
  const togglePreviewMode = useCallback(() => {
    setPreviewMode((prev) => {
      const next = !prev
      try { localStorage.setItem('subsilicon.ai.previewMode', next ? '1' : '0') } catch { /* ignore */ }
      return next
    })
  }, [])

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

  // 切换模型 - 更新 saved config 中对应 provider 的 model（写回前对未加密 apiKey 加密迁移）
  const switchModel = async (model: string) => {
    try {
      const saved = localStorage.getItem('subsilicon_ai_config')
      if (!saved) return
      const config = JSON.parse(saved)
      if (Array.isArray(config.providers)) {
        // 多 provider 格式：更新当前 provider 的 model
        config.providers = await Promise.all(config.providers.map(async (p: AiProviderConfig) =>
          p.provider === currentProvider
            ? { ...p, model, apiKey: isEncryptedAiKey(p.apiKey) ? p.apiKey : await encryptAiKey(p.apiKey) }
            : p
        ))
      } else {
        // FlatAiConfig 格式：更新 model
        config.model = model
        if (config.apiKey && !isEncryptedAiKey(config.apiKey)) {
          config.apiKey = await encryptAiKey(config.apiKey)
        }
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

  // 点击示例问题 —— 填入输入框并聚焦
  const handleExampleClick = (prompt: string) => {
    setInput(prompt)
    inputRef.current?.focus()
  }

  // 执行 AI 动作：act-along 模式下在执行前打「AI 批量操作」检查点（供「回滚 AI 操作」使用）
  const runAiActions = useCallback((actions: import('@editor/lib/ai/chat-command-executor').AiAction[], callbacks: EditorCanvasCallbacks) => {
    return executeAiActions(actions, callbacks, {
      onBeforeExecute: chatMode === 'act-along' ? props.onMarkAiBatch : undefined,
    })
  }, [chatMode, props.onMarkAiBatch])

  // 回滚 AI 操作：撤销到最近一次 AI 批次检查点之前的状态（无批次可回退时提示用户）
  const handleRollbackAiBatch = useCallback(() => {
    const ok = props.onRollbackAiBatch?.()
    if (ok) {
      showToast('success', '已回滚到 AI 操作前')
    } else {
      showToast('info', '没有可回滚的 AI 操作')
    }
  }, [props.onRollbackAiBatch])

  // 灵感库注入：把条目内容填入输入框（保留已有输入，追加在下方），并聚焦等待编辑
  const handleInjectCreatorInput = useCallback((content: string) => {
    setInput((prev) => (prev.trim() ? `${prev}\n${content}` : content))
    inputRef.current?.focus()
    showToast('success', '已插入输入框，可编辑后发送')
  }, [])

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

    // —— 生成上下文注入：读取与作品相关的最近输入条目（受「生成时引用」开关控制，读取失败静默跳过）——
    //    先读再采集，避免把当前这条消息重复注入本轮上下文
    let recentCreatorInputs: string[] | undefined
    if (useCreatorInputsInContext) {
      try {
        const all = await listCreatorInputs()
        const related = all.filter((e) => e.workId === workId || e.workId === '')
        recentCreatorInputs = related.slice(0, 8).map((e) => `[${CREATOR_INPUT_TYPE_LABELS[e.type]}] ${e.content.slice(0, 300)}`)
        if (recentCreatorInputs.length === 0) recentCreatorInputs = undefined
      } catch {
        // 读取失败静默跳过，不影响对话
        recentCreatorInputs = undefined
      }
    }

    // —— 创作者输入库：自动采集本次用户消息（遵循采集开关，store 内部已容错，失败静默）——
    if (getInputCaptureEnabled()) {
      void addCreatorInput({ workId: workId ?? '', type: 'chat', content: trimmed, source: 'chat' }).then(() => {
        // 新增成功后再通知灵感库面板刷新
        setCreatorInputVersion((v) => v + 1)
      })
    }

    // 构建创作助理请求（包含已标注的素材库，让 AI 能调度素材）
    let annotatedAssets: Awaited<ReturnType<typeof getAllAssets>> = []
    try {
      annotatedAssets = await getAllAssets()
    } catch {
      // IndexedDB 不可用时忽略
    }
    const graphContext = serializeGraphContext(nodes, edges, characters, scenes, annotatedAssets, props.variables, {
      workPremise: getWorkPremise(workId),
      creatorInputs: recentCreatorInputs,
    })
    let systemPrompt = getChatSystemPrompt(graphContext, chatMode)

    // —— 创作者自定义文本工作流（优先级最高）：
    //    systemPrompt 顶部追加「你正遵循的工作流」段落，styleKeywords 注入文风要求，
    //    temperature / maxTokens 覆盖默认值
    const wfText: WorkflowTextDefaults | undefined = activeTextWorkflow?.text
    if (wfText && activeTextWorkflow) {
      const header: string[] = []
      header.push(`## 创作者自定义工作流「${activeTextWorkflow.name}」（本回复必须严格遵守，优先级最高）`)
      if (wfText.systemPrompt?.trim()) header.push(wfText.systemPrompt.trim())
      if (wfText.styleKeywords?.trim()) header.push(`文风关键词（必须贯彻）：${wfText.styleKeywords.trim()}`)
      if (activeTextWorkflow.description?.trim()) header.push(`工作流说明：${activeTextWorkflow.description.trim()}`)
      header.push('')
      systemPrompt = header.join('\n') + systemPrompt
    }
    const wfTemperature = wfText?.temperature
    const wfMaxTokens = wfText?.maxTokens

    try {
      const available = isAiAvailable()
      if (!available) {
        setMessages((prev) => [...prev, {
          id: `err-${Date.now()}`,
          role: 'system',
          content: `${assistantName}未配置。请在${assistantName}设置中配置 API 服务商或启动本地 Ollama。`,
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

      const result = await callAiStreamForTask('editor', {
        systemPrompt,
        userPrompt,
        temperature: wfTemperature ?? 0.7,
        maxTokens: wfMaxTokens ?? 4096,
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
      const debugEntry: Partial<AiDebugEntry> = {
        id: `debug-${Date.now()}`,
        timestamp: Date.now(),
        userInput: trimmed,
        systemPrompt,
        graphContext,
        rawResponse: fullText,
        actions: [],
        previewMode,
      }

      // 预设规则：先检查用户消息/画布状态是否命中规则，命中则并入待执行动作
      const automationHits = matchAutomationRules(trimmed, {
        nodeCount: nodes?.length ?? 0,
        edgeCount: edges?.length ?? 0,
        characterCount: characters?.length ?? 0,
        sceneCount: scenes?.length ?? 0,
      })
      const automationActions = automationHits.flatMap((h) => h.rule.actions)
      debugEntry.automation = automationHits.map((h) => `${h.rule.name}（${h.matchedBy}）`)

      if (fullText.trim()) {
        const commandBlocks = parseAllAiCommands(fullText)
        if (commandBlocks.length > 0) {
          const allActions = commandBlocks.flatMap((b) => b.actions)
          // 校验未通过的非法动作（附带中文拒绝原因），提示用户哪些被跳过
          const invalidActions = commandBlocks.flatMap((b) => b.invalid)
          debugEntry.actions = allActions as unknown[]
          if (invalidActions.length > 0) {
            const reasons = Array.from(new Set(invalidActions.map((i) => i.reason))).join('；')
            fullText += `\n\n---\n⚠️ ${invalidActions.length} 个动作校验未通过已跳过（${reasons}）`
          }
          const combined = [...automationActions, ...allActions]
          if (combined.length > 0) {
            const callbacks = buildCallbacks(props)
            if (dispatchParsedCommands(combined, previewMode).mode === 'preview') {
              // 预览模式：暂存待批准，不直接执行
              setPendingPreview({
                msgId: assistantId,
                debugId: debugEntry.id,
                previews: describeAiActions(combined),
                actions: combined,
                source: 'ai',
              })
              appendDebugEntry(debugEntry as AiDebugEntry)
              fullText += `\n\n---\n⏸️ ${combined.length} 个操作等待确认（预览模式）`
            } else {
              const result = await runAiActions(combined, callbacks)
              debugEntry.execution = result
              appendDebugEntry(debugEntry as AiDebugEntry)
              mediaRequests = result.mediaRequests
              const actionSummary = `✅ 成功 ${result.success} 个操作` +
                (result.failed > 0 ? `, ❌ 失败 ${result.failed} 个` : '') +
                (mediaRequests.length > 0 ? `, 📋 ${mediaRequests.length} 个生成请求待确认` : '')
              fullText += `\n\n---\n${actionSummary}`
            }
          }
        }
      }

      // 仅有预设规则命中（AI 未输出命令）时，也执行规则动作
      if (automationActions.length > 0 && !parseAllAiCommands(fullText).length) {
        const callbacks = buildCallbacks(props)
        if (dispatchParsedCommands(automationActions, previewMode).mode === 'preview') {
          setPendingPreview({
            msgId: assistantId,
            debugId: debugEntry.id,
            previews: describeAiActions(automationActions),
            actions: automationActions,
            source: 'automation',
          })
          appendDebugEntry(debugEntry as AiDebugEntry)
          fullText += `\n\n---\n🤖 预设规则命中 ${automationHits.map((h) => h.rule.name).join('、')}，等待确认`
        } else {
          const result = await runAiActions(automationActions, callbacks)
          debugEntry.execution = result
          appendDebugEntry(debugEntry as AiDebugEntry)
          fullText += `\n\n---\n🤖 预设规则已执行：成功 ${result.success} 个操作${result.failed > 0 ? `, 失败 ${result.failed} 个` : ''}`
        }
      }
      setDebugEntries(getDebugEntries())

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

  // 预览批准：执行暂存的操作，并把「等待确认」替换为执行摘要
  const handleApprovePreview = useCallback(async () => {
    if (!pendingPreview) return
    const { msgId, debugId, actions } = pendingPreview
    const callbacks = buildCallbacks(props)
    const result = await runAiActions(actions, callbacks)
    const summary = `✅ 成功 ${result.success} 个操作` +
      (result.failed > 0 ? `, ❌ 失败 ${result.failed} 个` : '') +
      (result.mediaRequests.length > 0 ? `, 📋 ${result.mediaRequests.length} 个生成请求待确认` : '')
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === msgId
          ? {
              ...msg,
              content: msg.content.replace(/\n\n---\n[^\n]*等待确认.*$/, `\n\n---\n${summary}`),
              mediaRequests: result.mediaRequests.length > 0 ? result.mediaRequests : undefined,
            }
          : msg
      )
    )
    // 同步更新调试日志中的审批结果
    if (debugId) {
      setDebugEntries((prev) =>
        prev.map((entry) => (entry.id === debugId ? { ...entry, approved: true, execution: result } : entry))
      )
    }
    setPendingPreview(null)
    setActiveDebugId(null)
  }, [pendingPreview, props, runAiActions])

  // 预览拒绝：取消操作
  const handleRejectPreview = useCallback(() => {
    if (!pendingPreview) return
    const { msgId, debugId } = pendingPreview
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === msgId
          ? { ...msg, content: msg.content.replace(/\n\n---\n[^\n]*等待确认.*$/, '\n\n---\n已取消操作') }
          : msg
      )
    )
    if (debugId) {
      setDebugEntries((prev) =>
        prev.map((entry) => (entry.id === debugId ? { ...entry, approved: false } : entry))
      )
    }
    setPendingPreview(null)
    setActiveDebugId(null)
  }, [pendingPreview])

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
        content: '👋 对话已清空。\n\n想聊点什么？一个灵感、一个脑洞、或者一个故事方向都可以。我会帮你分析、梳理大纲，再一起落到画布上 👇',
        timestamp: Date.now(),
      },
    ])
    setStreamingContent('')
  }

  // 处理媒体生成请求：生成 → 入库 → 自动标注 → 自动绑节点
  const handleGenerateMedia = useCallback(async (msgId: string, request: MediaGenerationRequest) => {
    const task: 'image' | 'video' | 'audio' = request.mediaType === 'video' ? 'video' : request.mediaType === 'audio' ? 'audio' : 'image'
    if (!getMediaProviderConfigForTask(task)) {
      showToast('error', task === 'audio'
        ? `请先在${assistantName}设置中配置音乐/音效生成服务商`
        : `请先在${assistantName}设置中配置媒体生成服务商`)
      return
    }

    // 标记为 generating
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== msgId || !msg.mediaRequests) return msg
        return {
          ...msg,
          mediaRequests: msg.mediaRequests.map((r) =>
            r === request ? { ...r, _status: 'generating' as const } : r
          ),
        }
      })
    )

    try {
      // 优化 prompt（注入全局画面风格锁，保持整部作品画面一致）
      const globalStyle = getGlobalStylePrompt()
      const basePrompt = request.prompt + (globalStyle ? `, ${globalStyle}` : '')
      const optimized = await optimizePrompt(basePrompt, request.mediaType as 'image' | 'video', request.style || 'anime')

      // 查找参考图（标注为 reference 的素材），用于 ComfyUI IP-Adapter 一致性锚点
      // 优先角色参考图（characterId），其次场景参考图（sceneTag）；仅 image 类型启用
      let referenceImageHash: string | undefined
      if (request.mediaType === 'image') {
        try {
          const query: AssetAnnotation = { usageType: 'reference' }
          if (request.characterId) query.characterId = request.characterId
          else if (request.sceneTag) query.sceneTag = request.sceneTag
          if (query.characterId || query.sceneTag) {
            const refs = await findAssetsByAnnotation(query)
            if (refs.length > 0) referenceImageHash = refs[0].hash
          }
        } catch {
          // IndexedDB 不可用时忽略
        }
      }

      const result = await generateMediaForTask(
        task,
        request.mediaType === 'video'
          ? { prompt: optimized, duration: 5 }
          : request.mediaType === 'audio'
            ? { prompt: optimized }
            : {
                prompt: optimized,
                width: request.width || 1024,
                height: request.height || 1024,
                style: (request.style || 'anime') as any,
                referenceImageHash,
              }
      )

      // 拉取生成结果为 Blob，入库为素材（去重），自动标注 + 绑定节点
      let assetHash: string | undefined
      let bound = false
      try {
        const resp = await fetch(result.url)
        if (!resp.ok) throw new Error(`fetch ${resp.status}`)
        const blob = await resp.blob()
        const ext = (blob.type.split('/')[1] || 'bin').split(';')[0]
        assetHash = await saveBlobAsAsset(blob, `${request.mediaType}-${Date.now()}.${ext}`)

        // 自动标注：把请求里的上下文字段写入素材标注
        const annotation: AssetAnnotation = {}
        if (request.characterId) annotation.characterId = request.characterId
        if (request.emotion) annotation.emotion = request.emotion
        if (request.sceneTag) annotation.sceneTag = request.sceneTag
        if (request.usageType) annotation.usageType = request.usageType
        if (request.description) annotation.description = request.description
        if (Object.keys(annotation).length > 0) {
          await updateAssetAnnotation(assetHash, annotation)
        }

        // 自动绑定到目标节点
        if (request.nodeId && onBindAsset) {
          bound = await onBindAsset(request.nodeId, assetHash, request.usageType)
        }

        // 释放 Stability 等返回的 blob URL
        if (result.cleanup) result.cleanup()
      } catch {
        // 入库/标注/绑定失败不阻断展示，仅 assetHash 为空
        assetHash = undefined
      }

      const mediaIcon = request.mediaType === 'image' ? '🖼️' : request.mediaType === 'video' ? '🎬' : '🎵'
      const tail = assetHash
        ? ` · 已入库${bound ? ' · 已绑节点' : ''}`
        : ''
      showToast('success', `${mediaIcon} 生成完成${tail}`)

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== msgId || !msg.mediaRequests) return msg
          return {
            ...msg,
            mediaRequests: msg.mediaRequests.map((r) =>
              r === request ? { ...r, _status: 'done' as const, _result: result.url, _assetHash: assetHash } : r
            ),
          }
        })
      )
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
  }, [onBindAsset])

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

  return (
    <div className="flex flex-col h-full min-w-0">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-700/40 shrink-0 bg-slate-900/40 backdrop-blur-sm">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-500 to-cyan-400 flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/20">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-white tracking-wide">{assistantName}</span>
          {aiEnabled && (
            <span className="text-[10px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">已连接</span>
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
          {/* AI 对话模式切换：先聊后做 / 边聊边做（持久化） */}
          <div className="flex items-center gap-0.5 ml-0.5 rounded-md border border-slate-700/50 bg-slate-800/60 p-0.5" title="AI 对话模式：先聊后做（先讨论、确认后再落画布）/ 边聊边做（收到想法即可落地）">
            <button
              type="button"
              onClick={() => setChatMode('discuss-first')}
              className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                chatMode === 'discuss-first' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              先聊后做
            </button>
            <button
              type="button"
              onClick={() => setChatMode('act-along')}
              className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                chatMode === 'act-along' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              边聊边做
            </button>
          </div>
          {/* 边聊边做模式：「回滚 AI 操作」—— 撤销到最近一次 AI 批量操作之前（可重复回退更早批次） */}
          {chatMode === 'act-along' && (
            <button
              type="button"
              onClick={handleRollbackAiBatch}
              className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded border border-slate-700/50 bg-slate-800/60 text-slate-400 hover:text-amber-300 hover:border-amber-500/30 transition-colors"
              title="回滚到最近一次 AI 批量操作之前的状态（可重复回退到更早的 AI 批次）"
            >
              <Undo2 className="w-3 h-3" />
              回滚 AI
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* 自定义工作流选择器（文本 / 正文生成类） */}
          <div className="relative mr-1">
            <button
              type="button"
              onClick={() => setShowTextWorkflowPicker((v) => !v)}
              onBlur={() => setTimeout(() => setShowTextWorkflowPicker(false), 120)}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded border transition-colors max-w-[200px] ${
                activeTextWorkflow
                  ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'
                  : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-700 hover:border-slate-600'
              }`}
              title="选择文本类自定义工作流（Skill），自动注入系统提示词 + 控制温度/maxTokens"
            >
              <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="text-[11px] truncate">
                {activeTextWorkflow ? activeTextWorkflow.name : '工作流（可选）'}
              </span>
              <ChevronDown className={`w-3 h-3 transition-transform flex-shrink-0 ${showTextWorkflowPicker ? 'rotate-180' : ''}`} />
            </button>
            {showTextWorkflowPicker && (
              <div className="absolute right-0 top-full mt-1 w-72 rounded-md border border-slate-600 bg-slate-800 shadow-xl overflow-hidden max-h-72 overflow-y-auto z-50">
                <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-700/60 bg-slate-900/40">
                  <p className="text-[10px] text-slate-400">文本类工作流（影响 AI 对话与正文生成）</p>
                  {activeTextWorkflow && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setActiveTextWorkflowId(null)}
                      className="text-[9px] text-slate-500 hover:text-slate-200"
                    >
                      清空
                    </button>
                  )}
                </div>
                {textWorkflows.length === 0 ? (
                  <div className="px-2.5 py-3 text-[10px] text-slate-500 leading-relaxed">
                    暂无文本工作流。前往设置 → AI 任务路由 → 自定义工作流 Tab 新建，即可保存你喜欢的文风与参数组合。
                  </div>
                ) : (
                  textWorkflows.map((wf) => {
                    const active = wf.id === activeTextWorkflowId
                    return (
                      <button
                        key={wf.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyTextWorkflow(wf.id)}
                        className={`w-full text-left px-2.5 py-2 border-b last:border-b-0 border-slate-700/50 transition-colors ${
                          active ? 'bg-yellow-500/10' : 'hover:bg-slate-700/60'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <Check className={`w-3 h-3 mt-0.5 flex-shrink-0 ${active ? 'text-yellow-400' : 'opacity-0'}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className={`text-[11px] truncate ${active ? 'text-yellow-300 font-medium' : 'text-slate-200'}`}>{wf.name}</p>
                              {wf.builtin && (
                                <span className="text-[9px] px-1 rounded border border-slate-600 text-slate-500 flex-shrink-0">内置</span>
                              )}
                              {wf.text?.temperature != null && (
                                <span className="text-[9px] px-1 rounded bg-slate-700 text-slate-400 font-mono flex-shrink-0">T {wf.text.temperature.toFixed(2)}</span>
                              )}
                            </div>
                            {wf.description && (
                              <p className="text-[9px] text-slate-500 leading-snug line-clamp-2 mt-0.5">{wf.description}</p>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>

          <button
            onClick={togglePreviewMode}
            className={`p-1.5 rounded hover:bg-slate-700 transition-colors ${
              previewMode ? 'text-amber-400 bg-amber-500/10' : 'text-slate-400 hover:text-white'
            }`}
            title={previewMode ? '命令预览已开启：AI 操作前先确认' : '命令预览已关闭：AI 直接执行操作'}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setShowDebugPanel(!showDebugPanel)
              setDebugEntries(getDebugEntries())
            }}
            className={`p-1.5 rounded hover:bg-slate-700 transition-colors ${
              showDebugPanel ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-400 hover:text-white'
            }`}
            title="调试面板"
          >
            <Bug className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title={`${assistantName}设置`}
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role !== 'user' && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500/30 to-cyan-400/30 border border-slate-600/50 flex items-center justify-center shrink-0 mt-0.5">
                {msg.role === 'system' ? (
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                ) : (
                  <Bot className="w-3.5 h-3.5 text-cyan-300" />
                )}
              </div>
            )}
            <div
              className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-amber-500/25 to-amber-600/15 text-amber-50 border border-amber-500/25 rounded-tr-sm'
                  : msg.role === 'system'
                    ? 'yasgui-ai-bubble text-slate-200'
                    : 'yasgui-ai-bubble text-slate-100'
              }`}
            >
              {renderContent(msg.content)}
              {/* 媒体生成请求卡片 */}
              {msg.mediaRequests && msg.mediaRequests.length > 0 && (
                <div className="mt-2 space-y-2 border-t border-slate-600/30 pt-2">
                  {msg.mediaRequests.map((req, i) => {
                    const status = req._status
                    const result = req._result
                    const assetHash = req._assetHash
                    const mediaIcon = req.mediaType === 'image' ? Image : req.mediaType === 'video' ? Video : Music
                    const mediaColor = req.mediaType === 'image' ? 'text-pink-400' : req.mediaType === 'video' ? 'text-purple-400' : 'text-green-400'
                    const mediaBg = req.mediaType === 'image' ? 'bg-pink-500/10 border-pink-500/20' :
                                    req.mediaType === 'video' ? 'bg-purple-500/10 border-purple-500/20' : 'bg-green-500/10 border-green-500/20'

                    if (status === 'done' && result) {
                      return (
                        <div key={i} className={`p-2 rounded border ${mediaBg}`}>
                          {req.mediaType === 'video' ? (
                            <video src={result} controls className="w-full rounded mb-1.5 max-h-48 object-cover" />
                          ) : (
                            <img src={result} alt={req.prompt} className="w-full rounded mb-1.5 max-h-48 object-cover" />
                          )}
                          <p className="text-[10px] text-slate-400 truncate">{req.prompt}</p>
                          {assetHash && (
                            <p className="text-[10px] text-emerald-400 mt-1">
                              ✓ 已入库 {assetHash.slice(0, 8)}
                              {req.nodeId && ' · 已绑定节点'}
                            </p>
                          )}
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
                        <p className="text-[10px] text-slate-400 truncate mb-1.5">{req.prompt}</p>
                        {(req.characterId || req.emotion || req.sceneTag || req.usageType || req.nodeId) && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {req.characterId && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300">
                                角色:{characters.find((c) => c.id === req.characterId)?.name || req.characterId}
                              </span>
                            )}
                            {req.emotion && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
                                {EMOTION_LABELS[req.emotion] || req.emotion}
                              </span>
                            )}
                            {req.sceneTag && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">{req.sceneTag}</span>}
                            {req.usageType && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-300">
                                {USAGE_LABELS[req.usageType] || req.usageType}
                              </span>
                            )}
                            {req.nodeId && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300">
                                → {String(nodes.find((n) => n.id === req.nodeId)?.data?.title || '节点')}
                              </span>
                            )}
                          </div>
                        )}
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
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-600/40 to-orange-500/30 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5 text-amber-200" />
              </div>
            )}
          </div>
        ))}

        {/* 流式响应 */}
        {streamingContent && (
          <div className="flex gap-2.5 justify-start">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500/30 to-cyan-400/30 border border-slate-600/50 flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="w-3.5 h-3.5 text-cyan-300" />
            </div>
            <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed yasgui-ai-bubble text-slate-100">
              {renderContent(streamingContent)}
              <span className="inline-block w-1.5 h-4 bg-gradient-to-b from-amber-400 to-cyan-400 ml-0.5 animate-pulse" />
            </div>
          </div>
        )}

        {/* 创作助理未配置提示 */}
        {!aiEnabled && !isStreaming && messages.length <= 1 && (
          <div className="flex flex-col items-center justify-center py-10 text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-cyan-400/20 border border-slate-600/40 flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm text-slate-300 mb-1.5">{assistantName}服务未配置</p>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              配置后可以：聊灵感、梳理大纲、让 AI 帮你搭故事结构，<br />再一步步生成节点和内容
            </p>
            <button
              onClick={() => setShowSettings(true)}
              className="px-5 py-2.5 text-sm bg-gradient-to-r from-amber-500/20 to-cyan-400/20 text-amber-200 border border-amber-500/30 rounded-xl hover:from-amber-500/30 hover:to-cyan-400/30 transition-all"
            >
              ⚙️ 点这里配置（约 1 分钟）
            </button>
          </div>
        )}

        {/* 示例问题按钮 —— 仅 AI 已启用、非流式、消息很少时显示 */}
        {aiEnabled && !isStreaming && messages.length <= 1 && (
          <div className="flex flex-col gap-2 px-1">
            <p className="text-[11px] text-slate-500 text-center">试试从这些方向聊起：</p>
            {EXAMPLE_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleExampleClick(prompt)}
                className="text-left text-xs text-slate-300 bg-slate-800/50 hover:bg-slate-700/60 border border-slate-600/30 hover:border-amber-500/40 rounded-xl px-3 py-2.5 transition-colors group"
              >
                <span className="inline-flex w-5 h-5 items-center justify-center rounded-md bg-gradient-to-br from-amber-500/20 to-cyan-400/20 text-amber-300 mr-2 text-[10px] group-hover:scale-110 transition-transform">
                  {i + 1}
                </span>
                {prompt}
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />

        {/* 命令预览确认卡片 */}
        {pendingPreview && (
          <div className="flex gap-2 justify-start">
            <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <ListChecks className="w-3 h-3 text-cyan-400" />
            </div>
            <div className="max-w-[85%] px-3 py-2 rounded-lg text-xs leading-relaxed bg-cyan-500/10 text-cyan-100 border border-cyan-500/30">
              <p className="font-medium text-cyan-300 mb-1.5">
                {pendingPreview.source === 'automation' ? '🤖 预设规则命中' : '✨ AI 请求执行操作'}（预览模式）
              </p>
              <ul className="space-y-1 mb-2">
                {pendingPreview.previews.map((pv, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-cyan-500/60 mt-px">•</span>
                    <span className="text-slate-300">{pv.description}</span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-1.5">
                <button
                  onClick={handleApprovePreview}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded hover:bg-emerald-500/30 transition-colors"
                >
                  <Check className="w-3 h-3" />
                  批准执行
                </button>
                <button
                  onClick={handleRejectPreview}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] bg-slate-600/50 text-slate-400 border border-slate-600/30 rounded hover:bg-slate-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                  取消
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 调试面板 */}
      {showDebugPanel && (
        <div className="shrink-0 border-t border-slate-700/50 bg-slate-900/60 max-h-72 overflow-y-auto">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-700/40 sticky top-0 bg-slate-900/90 backdrop-blur">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-cyan-400 flex items-center gap-1.5 mr-1">
                <Bug className="w-3 h-3" />
                调试
              </span>
              <button
                onClick={() => setDebugTab('log')}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                  debugTab === 'log' ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                日志 ({debugEntries.length})
              </button>
              <button
                onClick={() => setDebugTab('rules')}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                  debugTab === 'rules' ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                预设规则 ({automationRules.length})
              </button>
            </div>
            <div className="flex items-center gap-1">
              {debugTab === 'log' ? (
                <button
                  onClick={() => {
                    clearDebugEntries()
                    setDebugEntries([])
                    setActiveDebugId(null)
                  }}
                  className="px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                  title="清空日志"
                >
                  清空
                </button>
              ) : (
                <button
                  onClick={() => {
                    resetAutomationRules()
                    setAutomationRules(listAutomationRules())
                  }}
                  className="px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                  title="重置为内置规则"
                >
                  重置
                </button>
              )}
              <button
                onClick={() => setShowDebugPanel(false)}
                className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                title="关闭调试面板"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
          {debugTab === 'log' && (
            <>
          {debugEntries.length === 0 ? (
            <p className="px-3 py-4 text-[10px] text-slate-500 text-center">
              暂无记录。发送一条 AI 对话后，这里会显示完整上下文与执行结果。
            </p>
          ) : (
            <ul className="divide-y divide-slate-700/30">
              {debugEntries.map((entry) => {
                const expanded = activeDebugId === entry.id
                const status = entry.approved === true
                  ? '✅ 已批准'
                  : entry.approved === false
                    ? '🚫 已拒绝'
                    : entry.execution
                      ? '✅ 已执行'
                      : entry.actions && entry.actions.length > 0
                        ? '⏸️ 待确认'
                        : entry.automation && entry.automation.length > 0
                          ? '🤖 规则'
                          : '📝 仅对话'
                return (
                  <li key={entry.id}>
                    <button
                      onClick={() => setActiveDebugId(expanded ? null : entry.id)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800/50 transition-colors text-left"
                    >
                      <ChevronRight className={`w-3 h-3 text-slate-500 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                      <span className="text-[10px] text-slate-500 shrink-0">
                        {new Date(entry.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className="text-[10px] text-slate-500 shrink-0">{status}</span>
                      <span className="text-[10px] text-slate-300 truncate flex-1">{entry.userInput}</span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation()
                          removeDebugEntry(entry.id)
                          setDebugEntries(getDebugEntries())
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation()
                            removeDebugEntry(entry.id)
                            setDebugEntries(getDebugEntries())
                          }
                        }}
                        className="p-0.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="删除这条记录"
                      >
                        <Trash2 className="w-3 h-3" />
                      </span>
                    </button>
                    {expanded && (
                      <div className="px-3 pb-2 space-y-1.5">
                        {entry.automation && entry.automation.length > 0 && (
                          <DebugBlock label="预设规则" value={entry.automation.join('、')} mono={false} />
                        )}
                        <DebugBlock label="解析动作" value={entry.actions && entry.actions.length > 0 ? JSON.stringify(entry.actions, null, 2) : '（无 ai-action 命令）'} mono />
                        {entry.execution && (
                          <DebugBlock
                            label="执行结果"
                            value={`成功 ${entry.execution.success} / 失败 ${entry.execution.failed}${entry.execution.messages.length > 0 ? '\n' + entry.execution.messages.join('\n') : ''}`}
                            mono
                          />
                        )}
                        <DebugBlock label="System Prompt" value={entry.systemPrompt} mono />
                        <DebugBlock label="画布上下文" value={entry.graphContext} mono />
                        <DebugBlock label="AI 原始回复" value={entry.rawResponse || '（无输出）'} mono />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
            </>
          )}
          {debugTab === 'rules' && (
            <>
              {automationRules.map((rule) => (
                <div key={rule.id} className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-700/30">
                  <span className="text-[10px] text-slate-300 truncate flex-1" title={rule.description}>
                    {rule.name}
                    {rule.builtin && <span className="ml-1 text-[9px] text-amber-500/80">内置</span>}
                  </span>
                  <span className="text-[9px] text-slate-500 shrink-0">
                    {rule.triggerType === 'keyword' ? `关键词: ${rule.pattern}` :
                     rule.triggerType === 'regex' ? `正则: ${rule.pattern}` :
                     `状态: 节点=${rule.stateCondition?.nodeCountEquals ?? '-'}`}
                  </span>
                  <button
                    onClick={() => toggleRule(rule)}
                    className={`text-[10px] px-2 py-0.5 rounded shrink-0 transition-colors ${
                      rule.enabled
                        ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                        : 'bg-slate-600/40 text-slate-500 hover:bg-slate-600/60'
                    }`}
                    title={rule.enabled ? '点击禁用' : '点击启用'}
                  >
                    {rule.enabled ? '启用' : '停用'}
                  </button>
                  {!rule.builtin && (
                    <button
                      onClick={() => {
                        removeAutomationRule(rule.id)
                        setAutomationRules(listAutomationRules())
                      }}
                      className="p-0.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                      title="删除规则"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              {showRuleForm ? (
                <div className="px-3 py-2 space-y-1.5">
                  <input
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    placeholder="规则名称（如：开始写作）"
                    className="w-full text-[10px] rounded border border-slate-600 bg-slate-700/50 px-2 py-1 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                  />
                  <div className="flex gap-1">
                    {(['keyword', 'regex', 'state'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setRuleTrigger(t)}
                        className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                          ruleTrigger === t ? 'bg-cyan-500/15 text-cyan-300' : 'bg-slate-700/40 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {t === 'keyword' ? '关键词' : t === 'regex' ? '正则' : '状态'}
                      </button>
                    ))}
                  </div>
                  {ruleTrigger === 'state' ? (
                    <label className="flex items-center gap-2 text-[10px] text-slate-400">
                      节点数等于
                      <input
                        type="number"
                        min={0}
                        value={ruleStateValue}
                        onChange={(e) => setRuleStateValue(Number(e.target.value) || 0)}
                        className="w-16 text-[10px] rounded border border-slate-600 bg-slate-700/50 px-2 py-1 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                      />
                    </label>
                  ) : (
                    <input
                      value={rulePattern}
                      onChange={(e) => setRulePattern(e.target.value)}
                      placeholder={ruleTrigger === 'keyword' ? '触发关键词，多个用逗号分隔' : '正则表达式，如 ^开始'}
                      className="w-full text-[10px] rounded border border-slate-600 bg-slate-700/50 px-2 py-1 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                    />
                  )}
                  <select
                    value={ruleAction}
                    onChange={(e) => setRuleAction(e.target.value as typeof ruleAction)}
                    className="w-full text-[10px] rounded border border-slate-600 bg-slate-700/50 px-2 py-1 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                  >
                    <option value="saveWork">保存作品</option>
                    <option value="undo">撤销上一步</option>
                    <option value="previewWork">打开作品预览</option>
                    <option value="createNarration">创建旁白节点</option>
                    <option value="createDialogue">创建对话节点</option>
                    <option value="createChoice">创建选择节点</option>
                  </select>
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleAddRule}
                      className="flex-1 px-2 py-1 text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded hover:bg-cyan-500/30 transition-colors"
                    >
                      添加规则
                    </button>
                    <button
                      onClick={() => setShowRuleForm(false)}
                      className="px-2 py-1 text-[10px] bg-slate-600/50 text-slate-400 border border-slate-600/30 rounded hover:bg-slate-600 transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowRuleForm(true)}
                  className="w-full px-3 py-1.5 text-[10px] text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                >
                  + 新增预设规则
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* 灵感库（创作者输入库）：AI 对话自动采集的输入记录，可查看/搜索/改类型/删除/注入对话 */}
      <CreatorInputPanel
        workId={workId ?? ''}
        onInject={handleInjectCreatorInput}
        refreshKey={creatorInputVersion}
        useInContext={useCreatorInputsInContext}
        onToggleUseInContext={toggleUseCreatorInputsInContext}
      />

      {/* 输入区域 */}
      <div className="shrink-0 border-t border-slate-700/40 p-3 bg-slate-900/40 backdrop-blur-sm">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="聊聊你的灵感或故事大纲……（Enter 发送）"
            rows={1}
            disabled={isStreaming}
            className="flex-1 text-[13px] rounded-xl border border-slate-600/60 bg-slate-800/60 px-3.5 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500/40 resize-none min-h-[38px] max-h-[120px] disabled:opacity-50 transition-shadow"
          />
          {isStreaming ? (
            <button
              onClick={handleStop}
              className="px-3.5 py-2.5 bg-red-500/15 text-red-300 border border-red-500/30 rounded-xl hover:bg-red-500/25 transition-colors shrink-0"
              title="停止生成"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() || !aiEnabled}
              className="px-3.5 py-2.5 bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-30 disabled:active:scale-100 shrink-0 shadow-sm shadow-amber-500/20"
              title="发送"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="mt-1.5 text-[10px] text-slate-600 text-center">
          先聊想法，我会帮你分析并梳理大纲，确认后再落到画布
        </p>
      </div>

      {/* 创作助理设置弹窗 */}
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

// 调试面板中的只读代码块
function DebugBlock({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="text-[10px]">
      <p className="text-slate-500 mb-0.5">{label}</p>
      <pre className={`bg-slate-950/70 border border-slate-700/40 rounded p-1.5 text-slate-400 whitespace-pre-wrap break-all max-h-40 overflow-y-auto ${mono ? 'font-mono' : ''}`}>
        {value}
      </pre>
    </div>
  )
}
