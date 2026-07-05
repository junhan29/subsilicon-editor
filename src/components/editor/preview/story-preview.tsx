'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Play, ChevronRight, RotateCcw, Star, Lock, CheckCircle2, Music, Volume2, VolumeX, Settings, Save, FolderOpen, Trash2, Clock, Keyboard, SkipForward, Merge, GitBranch, Coins } from 'lucide-react'
import { Button } from '@editor/components/ui/button'
import type { StoryNode, StoryEdge, StoryCharacter, StoryGraph } from '@editor/types/editor'
import { AudioManager, createAudioManager } from '@editor/lib/audio-manager'
import { SaveManager, formatSaveDate, loadSaveSlots, saveSaveSlots, createSaveSlot } from '@editor/lib/save-manager'
import { TransitionManager, createTransitionManager, TRANSITION_TYPES, type TransitionType } from '@editor/lib/transition-manager'
import { ExpressionParser, createDefaultContext } from '@editor/lib/expression-parser'

interface StoryPreviewProps {
  graph: StoryGraph
  open: boolean
  onClose: () => void
}

interface HistoryEntry {
  nodeId: string
  variables: Record<string, string | number | boolean>
}

interface StoryState {
  currentNodeId: string | null
  history: HistoryEntry[]
  variables: Record<string, string | number | boolean>
  visitCounts: Record<string, number>
}

interface SaveSlot {
  id: number
  title: string
  timestamp: number
  nodeId: string
  variables: Record<string, string | number | boolean>
  history: HistoryEntry[]
  thumbnail?: string
  nodeCount: number
  version: number
  checksum: string
}



const SAVE_SLOT_COUNT = 9
const QUICK_SAVE_ID = 0

const ENDING_TYPE_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  good: { icon: <Star className="w-5 h-5 text-yellow-500" />, label: '好结局', color: 'bg-yellow-50 border-yellow-200' },
  bad: { icon: <X className="w-5 h-5 text-red-500" />, label: '坏结局', color: 'bg-red-50 border-red-200' },
  neutral: { icon: <CheckCircle2 className="w-5 h-5 text-gray-500" />, label: '普通结局', color: 'bg-gray-50 border-gray-200' },
  secret: { icon: <Star className="w-5 h-5 text-purple-500" />, label: '隐藏结局', color: 'bg-purple-50 border-purple-200' },
}



const evaluateExpression = (
  expr: string,
  variables: Record<string, string | number | boolean>
): boolean => {
  try {
    const ctx = createDefaultContext({ ...variables })
    const parser = new ExpressionParser(ctx)
    const result = parser.parse(expr)
    return Boolean(result)
  } catch {
    return false
  }
}

function AudioChannelControl({ volume, label, icon, isPlaying, onVolumeChange }: {
  volume: number
  label: string
  icon: React.ReactNode
  isPlaying: boolean
  onVolumeChange: (volume: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className={`text-xs w-8 ${isPlaying ? 'text-primary' : 'text-muted-foreground'}`}>{label}</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.1"
        value={volume}
        onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
        className="w-16 h-1 accent-primary"
      />
      <span className="text-[10px] text-muted-foreground w-6">
        {Math.round(volume * 100)}%
      </span>
    </div>
  )
}

export function StoryPreview({ graph, open, onClose }: StoryPreviewProps) {
  const [state, setState] = useState<StoryState>({
    currentNodeId: null,
    history: [],
    variables: {},
    visitCounts: {},
  })
  const [isEnded, setIsEnded] = useState(false)
  const [showVars, setShowVars] = useState(false)
  const [showSaveMenu, setShowSaveMenu] = useState(false)
  const [saveSlots, setSaveSlots] = useState<SaveSlot[]>([])
  const [saveMode, setSaveMode] = useState<'save' | 'load'>('save')
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showAudioPanel, setShowAudioPanel] = useState(false)
  const [autoSaveIndicator, setAutoSaveIndicator] = useState(false)

  const audioManager = useRef<AudioManager | null>(null)
  const transitionManager = useRef<TransitionManager | null>(null)
  const autoSaveTimer = useRef<number | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const graphId = graph.title || 'default'

  useEffect(() => {
    audioManager.current = createAudioManager()
    transitionManager.current = createTransitionManager()
    return () => {
      if (audioManager.current) {
        audioManager.current.destroy()
      }
      if (transitionManager.current) {
        transitionManager.current.destroy()
      }
    }
  }, [])

  useEffect(() => {
    if (open) {
      setSaveSlots(loadSaveSlots(graphId))
      setShowShortcuts(false)
      setShowAudioPanel(false)
    }
  }, [open, graphId])

  const playAudio = useCallback((channel: 'bgm' | 'bgs' | 'se' | 'voice', url: string, options?: { loop?: boolean; volume?: number }) => {
    audioManager.current?.play(channel, url, {
      loop: options?.loop,
      volume: options?.volume,
      fadeTime: channel === 'bgm' || channel === 'bgs' ? 500 : undefined,
    })
  }, [])

  const stopAudio = useCallback((channel: 'bgm' | 'bgs' | 'se' | 'voice') => {
    audioManager.current?.stop(channel, channel === 'bgm' || channel === 'bgs' ? 500 : undefined)
  }, [])

  const setChannelVolume = useCallback((channel: 'bgm' | 'bgs' | 'se' | 'voice', volume: number) => {
    audioManager.current?.setChannelVolume(channel, volume)
  }, [])

  const getChannelVolume = useCallback((channel: 'bgm' | 'bgs' | 'se' | 'voice') => {
    return audioManager.current?.getChannelVolume(channel) ?? 0
  }, [])

  const isChannelPlaying = useCallback((channel: 'bgm' | 'bgs' | 'se' | 'voice') => {
    return audioManager.current?.isPlaying(channel) ?? false
  }, [])

  const handleSave = useCallback((slotId: number) => {
    if (!state.currentNodeId) return

    const newSlot = createSaveSlot({
      id: slotId,
      title: slotId === QUICK_SAVE_ID ? '快速存档' : `存档 ${slotId}`,
      timestamp: Date.now(),
      nodeId: state.currentNodeId,
      variables: { ...state.variables },
      history: [...state.history],
      nodeCount: state.history.length + 1,
      graphId,
    })

    const existing = loadSaveSlots(graphId)
    const filtered = existing.filter((s) => s.id !== slotId)
    const updated = [...filtered, newSlot].sort((a, b) => a.id - b.id)
    saveSaveSlots(graphId, updated)
    setSaveSlots(updated)
    setShowSaveMenu(false)
  }, [state, graphId])

  const handleLoad = useCallback((slot: SaveSlot) => {
    setState({
      currentNodeId: slot.nodeId,
      history: [...slot.history],
      variables: { ...slot.variables },
      visitCounts: (() => {
        const counts: Record<string, number> = {}
        slot.history.forEach((h) => {
          counts[h.nodeId] = (counts[h.nodeId] || 0) + 1
        })
        return counts
      })(),
    })
    setIsEnded(false)
    setShowSaveMenu(false)

    ;(['bgm', 'bgs', 'se', 'voice'] as const).forEach(channel => {
      stopAudio(channel)
    })
  }, [stopAudio])

  const handleDeleteSlot = useCallback((slotId: number) => {
    const existing = loadSaveSlots(graphId)
    const updated = existing.filter((s) => s.id !== slotId)
    saveSaveSlots(graphId, updated)
    setSaveSlots(updated)
  }, [graphId])

  const handleAutoSave = useCallback(() => {
    if (!state.currentNodeId) return

    setAutoSaveIndicator(true)
    handleSave(QUICK_SAVE_ID)
    setTimeout(() => setAutoSaveIndicator(false), 1500)
  }, [state.currentNodeId, handleSave])

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const findStartNode = useCallback(() => {
    const targetIds = new Set(graph.edges.map((e) => e.target))
    return graph.nodes.find((n) => !targetIds.has(n.id))
  }, [graph])

  const currentNode = graph.nodes.find((n) => n.id === state.currentNodeId)

  const startStory = useCallback(() => {
    const startNode = findStartNode()
    const initialVars: Record<string, string | number | boolean> = {}
    graph.variables.forEach((v) => {
      initialVars[v.name] = v.initialValue
    })
    const initialVisitCounts: Record<string, number> = {}
    if (startNode) {
      initialVisitCounts[startNode.id] = 1
    }
    setState({
      currentNodeId: startNode?.id || null,
      history: startNode ? [{ nodeId: startNode.id, variables: initialVars }] : [],
      variables: initialVars,
      visitCounts: initialVisitCounts,
    })
    setIsEnded(false)

    ;(['bgm', 'bgs', 'se', 'voice'] as const).forEach(channel => {
      stopAudio(channel)
    })
  }, [findStartNode, graph.variables, stopAudio])

  const handleChoice = useCallback((optionId: string) => {
    const data = currentNode?.data as any
    const options = data?.options || []
    const option = options.find((o: any) => o.id === optionId)
    if (!option) return

    let newVariables = { ...state.variables }
    const applyEffect = (effect: any) => {
      if (!effect?.variableName) return
      const { variableName, operation, value } = effect
      const currentVal = newVariables[variableName]

      if (operation === 'set') {
        newVariables[variableName] = value
      } else if (operation === 'add') {
        if (typeof currentVal === 'number' && typeof value === 'number') {
          newVariables[variableName] = currentVal + value
        } else {
          newVariables[variableName] = value
        }
      } else if (operation === 'subtract') {
        if (typeof currentVal === 'number' && typeof value === 'number') {
          newVariables[variableName] = currentVal - value
        } else {
          newVariables[variableName] = value
        }
      } else if (operation === 'multiply') {
        if (typeof currentVal === 'number' && typeof value === 'number') {
          newVariables[variableName] = currentVal * value
        } else {
          newVariables[variableName] = value
        }
      }
    }

    // 批量效果
    if (Array.isArray(option.effects)) {
      option.effects.forEach(applyEffect)
    }
    // 兼容旧的单效果字段
    if (option.variableEffect) {
      applyEffect(option.variableEffect)
    }

    const seUrl = option.seUrl || (currentNode?.data as any)?.seUrl
    if (seUrl) {
      playAudio('se', seUrl, { loop: false })
    }

    const edge = graph.edges.find(
      (e) => e.source === state.currentNodeId && e.sourceHandle === optionId
    )
    if (edge) {
      setState((s) => ({
        ...s,
        currentNodeId: edge.target,
        history: [...s.history, { nodeId: edge.target, variables: newVariables }],
        variables: newVariables,
        visitCounts: {
          ...s.visitCounts,
          [edge.target]: (s.visitCounts[edge.target] || 0) + 1,
        },
      }))
    }
  }, [currentNode, graph.edges, state.currentNodeId, state.variables, playAudio])

  const continueStory = useCallback(() => {
    if (!state.currentNodeId) return
    const node = graph.nodes.find((n) => n.id === state.currentNodeId)
    if (!node) return
    const data = node.data as any

    // 结局节点为终止节点，不应继续
    if (node.type === 'ending') return

    let nextNodeId: string | null = null

    if (node.type === 'condition') {
      // 条件节点：评估表达式，选择 true/false 分支
      const expr = data?.expression
      const result = expr ? evaluateExpression(String(expr), state.variables) : true
      const handle = result ? 'true' : 'false'
      const edge = graph.edges.find(
        (e) => e.source === node.id && e.sourceHandle === handle
      )
      if (edge) nextNodeId = edge.target
    } else if (node.type === 'random') {
      // 随机节点：按权重选择一个选项
      const options: Array<{ id?: string; weight?: number; targetId?: string }> = data?.options || []
      const validOptions = options.filter((o) => o && (o.id || o.targetId))
      if (validOptions.length > 0) {
        const totalWeight = validOptions.reduce(
          (sum, o) => sum + (typeof o.weight === 'number' && o.weight > 0 ? o.weight : 1),
          0
        )
        let roll = Math.random() * totalWeight
        let chosen = validOptions[0]
        for (const o of validOptions) {
          const w = typeof o.weight === 'number' && o.weight > 0 ? o.weight : 1
          if (roll < w) {
            chosen = o
            break
          }
          roll -= w
        }
        if (chosen.targetId) {
          // 直接跳转到指定节点
          if (graph.nodes.some((n) => n.id === chosen.targetId)) {
            nextNodeId = chosen.targetId
          }
        } else if (chosen.id) {
          const edge = graph.edges.find(
            (e) => e.source === node.id && e.sourceHandle === chosen.id
          )
          if (edge) nextNodeId = edge.target
        }
      }
    } else if (node.type === 'jump') {
      // 跳转节点：直接跳到目标节点，可选表达式门控
      const expr = data?.expression
      const canJump = expr ? evaluateExpression(String(expr), state.variables) : true
      if (canJump && data?.targetNodeId) {
        if (graph.nodes.some((n) => n.id === data.targetNodeId)) {
          nextNodeId = data.targetNodeId
        }
      } else if (!data?.targetNodeId) {
        const edge = graph.edges.find((e) => e.source === node.id)
        if (edge) nextNodeId = edge.target
      }
    } else {
      // 对话 / 旁白 / CG / 汇聚及其它：跟随第一条出边
      const edge = graph.edges.find((e) => e.source === node.id)
      if (edge) nextNodeId = edge.target
    }

    if (nextNodeId) {
      const target = nextNodeId
      setState((s) => ({
        ...s,
        currentNodeId: target,
        history: [...s.history, { nodeId: target, variables: s.variables }],
        visitCounts: {
          ...s.visitCounts,
          [target]: (s.visitCounts[target] || 0) + 1,
        },
      }))
    }
  }, [graph.edges, graph.nodes, state.currentNodeId, state.variables])

  // 用于快捷键的派生状态（需要在 useEffect 之前定义）
  const isChoiceNode = currentNode?.type === 'choice'
  const hasOutgoingEdges = graph.edges.some((e) => e.source === state.currentNodeId)

  useEffect(() => {
    if (currentNode?.type === 'ending') {
      const timer = setTimeout(() => {
        continueStory()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [currentNode, continueStory])

  useEffect(() => {
    if (!currentNode || !open) return

    const data = currentNode.data as any

    if (data.bgm) {
      const currentBgm = audioManager.current?.getCurrentUrl('bgm')
      if (currentBgm !== data.bgm) {
        stopAudio('bgm')
        playAudio('bgm', data.bgm, { loop: true, volume: data.bgmVolume || 0.3 })
      }
    }

    if (data.bgs) {
      const currentBgs = audioManager.current?.getCurrentUrl('bgs')
      if (currentBgs !== data.bgs) {
        stopAudio('bgs')
        playAudio('bgs', data.bgs, { loop: true, volume: data.bgsVolume || 0.2 })
      }
    }

    if (data.seUrl) {
      playAudio('se', data.seUrl, { loop: false, volume: data.seVolume || 0.5 })
    }

    if (data.voiceUrl) {
      playAudio('voice' as any, data.voiceUrl, { loop: false, volume: 0.8 })
    }
  }, [currentNode, open, playAudio, stopAudio])

  useEffect(() => {
    if (!open) {
      ;(['bgm', 'bgs', 'se', 'voice'] as const).forEach(channel => {
        stopAudio(channel)
      })
    }
  }, [open, stopAudio])

  useEffect(() => {
    if (!open || !state.currentNodeId || state.history.length === 0) return

    handleAutoSave()
  }, [state.currentNodeId, state.history.length, open, handleAutoSave])

  // 快捷键系统
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.key) {
        case ' ':
        case 'Enter':
          e.preventDefault()
          if (!showSaveMenu && !isChoiceNode && hasOutgoingEdges) {
            continueStory()
          }
          break
        case 'Escape':
          e.preventDefault()
          if (showSaveMenu) setShowSaveMenu(false)
          else if (showShortcuts) setShowShortcuts(false)
          else if (showAudioPanel) setShowAudioPanel(false)
          else onClose()
          break
        case 's':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            if (state.currentNodeId) handleSave(QUICK_SAVE_ID)
          }
          break
        case 'l':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            if (saveSlots.length > 0) {
              setSaveMode('load')
              setShowSaveMenu(true)
            }
          }
          break
        case 'v':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            setShowVars(v => !v)
          }
          break
        case 'm':
          e.preventDefault()
          setShowAudioPanel(v => !v)
          break
        case '?':
          e.preventDefault()
          setShowShortcuts(v => !v)
          break
        case 'r':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            startStory()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, showSaveMenu, showShortcuts, showAudioPanel, isChoiceNode, hasOutgoingEdges, state.currentNodeId, saveSlots.length, continueStory, handleSave, startStory, onClose])

  const getCharacter = (characterId: string) => {
    return graph.characters.find((c) => c.id === characterId)
  }

  const renderNodeContent = () => {
    if (!currentNode) return null

    const data = currentNode.data as any

    switch (currentNode.type) {
      case 'dialogue':
        const character = getCharacter(data.characterId)
        return (
          <div className={`space-y-4 ${bgImage ? 'bg-card/95 backdrop-blur-sm rounded-2xl p-6 shadow-xl' : ''}`}>
            {character && (
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: character.color }}
                >
                  {character.name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium">{character.name}</p>
                  {data.emotion && (
                    <p className="text-xs text-muted-foreground">{data.emotion}</p>
                  )}
                </div>
              </div>
            )}
            <p className="text-lg leading-relaxed">{data.text}</p>
          </div>
        )

      case 'narration':
        return (
          <div
            className={`text-center italic text-lg leading-relaxed px-8 py-6 rounded-2xl ${
              bgImage
                ? 'bg-card/90 backdrop-blur-sm shadow-xl'
                : data.backgroundColor
                ? ''
                : 'bg-muted/30'
            }`}
            style={{
              fontSize: data.fontSize ? `${data.fontSize}px` : undefined,
              color: data.fontColor || undefined,
              backgroundColor: !bgImage ? data.backgroundColor : undefined,
            }}
          >
            {data.text || '（旁白文本）'}
          </div>
        )

      case 'choice': {
        const allOptions: any[] = data.options || []
        // 过滤掉显示条件不满足的选项
        const visibleOptions = allOptions.filter((opt) => {
          if (!opt) return false
          if (opt.condition && !evaluateExpression(String(opt.condition), state.variables)) {
            return false
          }
          return true
        })
        return (
          <div className={`space-y-3 ${bgImage ? 'bg-card/95 backdrop-blur-sm rounded-2xl p-6 shadow-xl' : ''}`}>
            <p className="text-sm text-muted-foreground mb-4">请做出选择：</p>
            {visibleOptions.map((opt: any, i: number) => {
              const hasConnection = graph.edges.some(
                (e) => e.source === currentNode.id && e.sourceHandle === opt.id
              )
              return (
                <Button
                  key={opt.id || i}
                  variant={hasConnection ? 'default' : 'outline'}
                  className={`w-full justify-start text-left h-auto py-3 px-4 ${
                    hasConnection ? '' : 'opacity-50'
                  }`}
                  onClick={() => handleChoice(opt.id || `opt-${i}`)}
                  disabled={!hasConnection}
                >
                  <span className="w-6 h-6 rounded-full bg-background/20 text-xs flex items-center justify-center mr-3">
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt.text}
                  {!hasConnection && <Lock className="w-3 h-3 ml-auto opacity-50" />}
                </Button>
              )
            })}
            {visibleOptions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                此节点尚未配置选项
              </p>
            )}
          </div>
        )
      }

      case 'ending':
        const endingConfig = ENDING_TYPE_CONFIG[data.endingType || 'neutral'] || ENDING_TYPE_CONFIG.neutral
        return (
          <div className={`text-center p-6 rounded-xl border-2 ${endingConfig.color} ${bgImage ? 'backdrop-blur-sm shadow-xl' : ''}`}>
            <div className="flex items-center justify-center gap-2 mb-3">
              {endingConfig.icon}
              <span className="text-sm font-medium">{endingConfig.label}</span>
            </div>
            <h3 className="text-xl font-bold mb-3">{data.title || '结局'}</h3>
            {data.text && <p className="text-sm leading-relaxed mb-4">{data.text}</p>}
            <div className="pt-4 border-t border-current/10">
              <p className="text-xs text-muted-foreground mb-3">
                共阅读 {state.history.length} 个节点
              </p>
              <Button variant="outline" onClick={startStory} className="gap-2">
                <RotateCcw className="w-4 h-4" />
                重新开始
              </Button>
            </div>
          </div>
        )

      case 'cg':
        const isVideo = data.mediaType === 'video'
        const hasLetterbox = data.letterbox !== false
        return (
          <div className="w-full bg-black rounded-xl overflow-hidden shadow-2xl border border-black">
            <div className="relative aspect-video">
              {isVideo ? (
                data.url ? (
                  <video src={data.url} className="w-full h-full object-contain" controls playsInline />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                    未设置 CG 资源
                  </div>
                )
              ) : (
                data.url ? (
                  <img src={data.url} alt={data.title || 'CG'} className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                    未设置 CG 资源
                  </div>
                )
              )}
              {hasLetterbox && (
                <>
                  <div className="absolute top-0 left-0 right-0 h-[6%] bg-black" />
                  <div className="absolute bottom-0 left-0 right-0 h-[6%] bg-black" />
                </>
              )}
            </div>
            {(data.title || data.subtitle) && (
              <div className="p-4 text-center bg-slate-900">
                {data.title && <h3 className="text-white font-bold mb-1">{data.title}</h3>}
                {data.subtitle && <p className="text-white/60 text-sm">{data.subtitle}</p>}
              </div>
            )}
            <div className="px-4 pb-3 bg-slate-900 flex items-center justify-between text-xs text-white/40">
              <span>{isVideo ? '视频 CG' : '图片 CG'}</span>
              <span>{data.canSkip === false ? '不可跳过' : '可跳过'}</span>
            </div>
          </div>
        )

      case 'gather':
        return (
          <div className={`text-center py-8 ${bgImage ? 'bg-card/90 backdrop-blur-sm rounded-2xl shadow-xl' : ''}`}>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Merge className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium">{data.label || '汇聚点'}</p>
            <p className="text-sm text-muted-foreground mt-2">多条剧情线在此汇合</p>
          </div>
        )

      case 'condition':
        return (
          <div className={`space-y-4 ${bgImage ? 'bg-card/95 backdrop-blur-sm rounded-2xl p-6 shadow-xl' : 'p-6'}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <GitBranch className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-medium">条件判断</p>
                <p className="text-xs text-muted-foreground font-mono">{data.expression || 'true'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
                <p className="text-xs text-emerald-600 font-medium mb-1">✓ 条件成立</p>
                <p className="text-sm">{data.trueLabel || '是'}</p>
              </div>
              <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/5">
                <p className="text-xs text-rose-600 font-medium mb-1">✗ 条件不成立</p>
                <p className="text-sm">{data.falseLabel || '否'}</p>
              </div>
            </div>
          </div>
        )

      case 'unlock':
        return (
          <div className={`text-center space-y-4 ${bgImage ? 'bg-card/95 backdrop-blur-sm rounded-2xl p-6 shadow-xl' : 'p-6'}`}>
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center">
              <Lock className="w-8 h-8 text-amber-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold mb-2">{data.nodeTitle || '解锁内容'}</h3>
              {data.description && (
                <p className="text-sm text-muted-foreground mb-4">{data.description}</p>
              )}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 text-amber-600">
                <Coins className="w-4 h-4" />
                <span className="font-medium">{data.amount || 1} 次解锁</span>
              </div>
            </div>
          </div>
        )

      default:
        return <p className="text-sm text-muted-foreground">预览模式暂不支持此节点类型</p>
    }
  }

  const isEndingNode = currentNode?.type === 'ending'
  const hasVariables = Object.keys(state.variables).length > 0

  const bgImage = (() => {
    if (!currentNode || currentNode.type === 'cg') return null
    const data = currentNode.data as any
    // 结局节点：优先使用封面图作为全屏背景
    if (currentNode.type === 'ending' && data?.coverImage) return data.coverImage
    // 优先级：1. 节点直接设置的背景图 2. 通过 sceneId 查找场景 3. 第一个场景作为默认
    if (data?.backgroundImage) return data.backgroundImage
    if (data?.sceneId && graph.scenes) {
      const scene = graph.scenes.find((s: any) => s.id === data.sceneId)
      if (scene?.backgroundImage) return scene.backgroundImage
    }
    // 兜底：使用第一个场景的背景图
    if (graph.scenes && graph.scenes.length > 0 && graph.scenes[0].backgroundImage) {
      return graph.scenes[0].backgroundImage
    }
    return null
  })()

  const hasAudio = currentNode
    ? !!(currentNode.data as any)?.bgm || (currentNode.data as any)?.bgs
    : false

  const anyAudioPlaying = isChannelPlaying('bgm') || isChannelPlaying('bgs') || isChannelPlaying('se')

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] bg-background flex flex-col">
      {/* 顶部栏 */}
      <div className="h-14 border-b bg-card/80 backdrop-blur flex items-center justify-between px-4 shrink-0 relative z-10">
        <div className="flex items-center gap-2">
          <Play className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">{graph.title || '故事预览'}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">预览模式</span>
        </div>
        <div className="flex items-center gap-1">
          {state.currentNodeId && (
            <>
              <div className="relative">
                <Button variant="ghost" size="sm" onClick={() => { setSaveMode('save'); setShowSaveMenu(true) }} className="gap-1.5" title="保存 (Ctrl+S)">
                  <Save className={`w-4 h-4 ${autoSaveIndicator ? 'text-emerald-500 animate-pulse' : 'text-muted-foreground'}`} />
                </Button>
                {autoSaveIndicator && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-ping" />
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setSaveMode('load'); setShowSaveMenu(true) }} className="gap-1.5" title="读取 (Ctrl+L)">
                <FolderOpen className="w-4 h-4 text-muted-foreground" />
              </Button>
            </>
          )}
          {hasVariables && state.currentNodeId && (
            <Button variant="ghost" size="sm" onClick={() => setShowVars(!showVars)} className="gap-1.5" title="变量 (Ctrl+V)">
              <Settings className={`w-4 h-4 ${showVars ? 'text-primary' : 'text-muted-foreground'}`} />
            </Button>
          )}
          {hasAudio && (
            <Button variant="ghost" size="sm" onClick={() => setShowAudioPanel(!showAudioPanel)} className="gap-1.5" title="音频 (M)">
              <Volume2 className={`w-4 h-4 ${anyAudioPlaying ? 'text-amber-500' : 'text-muted-foreground'}`} />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setShowShortcuts(!showShortcuts)} className="gap-1.5" title="快捷键 (?)">
            <Keyboard className={`w-4 h-4 ${showShortcuts ? 'text-primary' : 'text-muted-foreground'}`} />
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5" title="关闭 (Esc)">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 音频控制面板 */}
      {showAudioPanel && (
        <div className="border-b bg-card/95 backdrop-blur p-3 space-y-2">
          <div className="text-xs text-muted-foreground mb-2">音频通道控制</div>
          <div className="flex flex-wrap gap-4">
            <AudioChannelControl
              volume={getChannelVolume('bgm')}
              label="BGM"
              icon={<Music className="w-4 h-4" />}
              isPlaying={isChannelPlaying('bgm')}
              onVolumeChange={(v) => setChannelVolume('bgm', v)}
            />
            <AudioChannelControl
              volume={getChannelVolume('bgs')}
              label="BGS"
              icon={<Volume2 className="w-4 h-4" />}
              isPlaying={isChannelPlaying('bgs')}
              onVolumeChange={(v) => setChannelVolume('bgs', v)}
            />
            <AudioChannelControl
              volume={getChannelVolume('se')}
              label="SE"
              icon={<SkipForward className="w-4 h-4" />}
              isPlaying={isChannelPlaying('se')}
              onVolumeChange={(v) => setChannelVolume('se', v)}
            />
          </div>
        </div>
      )}

      {/* 快捷键提示面板 */}
      {showShortcuts && (
        <div className="border-b bg-card/95 backdrop-blur p-4">
          <div className="max-w-md mx-auto space-y-2">
            <div className="text-sm font-medium mb-2">快捷键</div>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                <span>继续 / 确认</span>
                <kbd className="px-1.5 py-0.5 bg-muted border rounded text-[10px]">Space / Enter</kbd>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                <span>关闭菜单</span>
                <kbd className="px-1.5 py-0.5 bg-muted border rounded text-[10px]">Esc</kbd>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                <span>快速存档</span>
                <kbd className="px-1.5 py-0.5 bg-muted border rounded text-[10px]">Ctrl+S</kbd>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                <span>读取存档</span>
                <kbd className="px-1.5 py-0.5 bg-muted border rounded text-[10px]">Ctrl+L</kbd>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                <span>变量面板</span>
                <kbd className="px-1.5 py-0.5 bg-muted border rounded text-[10px]">Ctrl+V</kbd>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                <span>音频面板</span>
                <kbd className="px-1.5 py-0.5 bg-muted border rounded text-[10px]">M</kbd>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                <span>重新开始</span>
                <kbd className="px-1.5 py-0.5 bg-muted border rounded text-[10px]">Ctrl+R</kbd>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                <span>显示帮助</span>
                <kbd className="px-1.5 py-0.5 bg-muted border rounded text-[10px]">?</kbd>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 主内容 */}
      <div
        ref={contentRef}
        className="flex-1 flex items-center justify-center p-4 overflow-y-auto relative transition-all duration-300"
        style={bgImage ? {
          backgroundImage: `url(${bgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : {}}
      >
        {bgImage && <div className="absolute inset-0 bg-black/40" />}
        <div className="w-full max-w-xl relative z-10">
          {!state.currentNodeId ? (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Play className="w-10 h-10 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2">{graph.title || '开始阅读'}</h2>
                {graph.description && <p className="text-sm text-muted-foreground">{graph.description}</p>}
              </div>
              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <span>{graph.nodes.length} 个节点</span>
                <span className="w-px h-3 bg-border" />
                <span>{graph.edges.length} 条分支</span>
                {graph.characters.length > 0 && (
                  <>
                    <span className="w-px h-3 bg-border" />
                    <span>{graph.characters.length} 个角色</span>
                  </>
                )}
              </div>
              <Button onClick={startStory} size="lg" className="gap-2 px-8">
                <Play className="w-5 h-5" />
                开始阅读
              </Button>
              {saveSlots.length > 0 && (
                <div className="pt-2">
                  <Button variant="outline" size="sm" onClick={() => { setSaveMode('load'); setShowSaveMenu(true) }} className="gap-2">
                    <FolderOpen className="w-4 h-4" />
                    读取存档（{saveSlots.length}）
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {showVars && hasVariables && (
                <div className="bg-card/90 backdrop-blur-sm rounded-xl border p-3 shadow-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium">当前变量</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(state.variables).map(([name, value]) => (
                      <div key={name} className="flex items-center justify-between bg-muted/50 rounded-md px-2 py-1.5">
                        <span className="text-[10px] text-muted-foreground truncate">{name}</span>
                        <span className="text-[11px] font-mono font-medium">
                          {typeof value === 'boolean' ? (value ? '是' : '否') : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>第 {state.history.length + 1} 步</span>
                {state.history.length > 0 && (
                  <>
                    <ChevronRight className="w-3 h-3" />
                    <button
                      onClick={() => {
                        const newHistory = state.history.slice(0, -1)
                        const prevNodeId = newHistory.length > 0
                          ? newHistory[newHistory.length - 1].nodeId
                          : (findStartNode()?.id || null)
                        setState((s) => ({
                          ...s,
                          history: newHistory,
                          currentNodeId: prevNodeId,
                          variables: newHistory.length > 0
                            ? newHistory[newHistory.length - 1].variables
                            : (() => {
                                const init: Record<string, string | number | boolean> = {}
                                graph.variables.forEach((v) => { init[v.name] = v.initialValue })
                                return init
                              })(),
                        }))
                      }}
                      className="hover:text-foreground"
                    >
                      上一步
                    </button>
                  </>
                )}
              </div>

              <div className="min-h-[200px] flex items-center justify-center">
                {renderNodeContent()}
              </div>

              {!isEndingNode && !isChoiceNode && hasOutgoingEdges && (
                <div className="flex justify-center">
                  <Button onClick={continueStory} className="gap-2">
                    继续 <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {!isEndingNode && !hasOutgoingEdges && (
                <p className="text-sm text-muted-foreground text-center">
                  此节点没有连接到下一个节点
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 底部提示 */}
      <div className="h-10 border-t bg-muted/30 flex items-center justify-center">
        <p className="text-xs text-muted-foreground">
          预览模式 · 按 <kbd className="px-1 py-0.5 bg-muted border rounded text-[10px] mx-1">?</kbd> 查看快捷键
        </p>
      </div>

      {/* 存档/读档菜单 */}
      {showSaveMenu && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4" onClick={() => setShowSaveMenu(false)}>
          <div className="bg-card rounded-2xl border shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">{saveMode === 'save' ? '保存进度' : '读取进度'}</h3>
                <p className="text-xs text-muted-foreground">
                  {saveMode === 'save' ? '选择一个存档位保存当前进度' : '选择一个存档继续游戏'}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowSaveMenu(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* 快速存档 */}
              {(() => {
                const quickSlot = saveSlots.find((s) => s.id === QUICK_SAVE_ID)
                return (
                  <div
                    className={`relative rounded-xl border-2 overflow-hidden transition-all cursor-pointer group ${
                      quickSlot ? 'border-border hover:border-primary' : 'border-dashed border-border hover:border-primary/50'
                    }`}
                    onClick={() => {
                      if (saveMode === 'save') handleSave(QUICK_SAVE_ID)
                      else if (quickSlot) handleLoad(quickSlot)
                    }}
                  >
                    <div className="flex items-center gap-3 p-3">
                      <div className={`w-14 h-14 rounded-lg flex items-center justify-center shrink-0 ${quickSlot ? 'bg-primary/10' : 'bg-muted'}`}>
                        {quickSlot ? <Clock className="w-6 h-6 text-primary" /> : <Save className="w-6 h-6 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{quickSlot ? '快速存档' : '空存档位'}</p>
                        {quickSlot ? (
                          <>
                            <p className="text-xs text-muted-foreground">进度: 第 {quickSlot.nodeCount} 步</p>
                            <p className="text-[10px] text-muted-foreground/70">{formatSaveDate(quickSlot.timestamp)}</p>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">{saveMode === 'save' ? '点击快速保存' : '暂无存档'}</p>
                        )}
                      </div>
                      {quickSlot && saveMode === 'load' && <div className="opacity-0 group-hover:opacity-100 transition-opacity"><ChevronRight className="w-5 h-5 text-primary" /></div>}
                      {quickSlot && (
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteSlot(QUICK_SAVE_ID) }} className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })()}

              <div className="text-[10px] text-muted-foreground/70 px-1 pt-1">普通存档</div>

              {Array.from({ length: SAVE_SLOT_COUNT }, (_, i) => i + 1).map((slotId) => {
                const slot = saveSlots.find((s) => s.id === slotId)
                return (
                  <div
                    key={slotId}
                    className={`relative rounded-xl border-2 overflow-hidden transition-all cursor-pointer group ${
                      slot ? 'border-border hover:border-primary' : 'border-dashed border-border hover:border-primary/50'
                    }`}
                    onClick={() => {
                      if (saveMode === 'save') handleSave(slotId)
                      else if (slot) handleLoad(slot)
                    }}
                  >
                    <div className="flex items-center gap-3 p-3">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold ${
                        slot ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                      }`}>{slotId}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{slot ? `存档 ${slotId}` : '空存档位'}</p>
                        {slot ? (
                          <>
                            <p className="text-xs text-muted-foreground">进度: 第 {slot.nodeCount} 步</p>
                            <p className="text-[10px] text-muted-foreground/70">{formatSaveDate(slot.timestamp)}</p>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">{saveMode === 'save' ? '点击保存到此位置' : '暂无存档'}</p>
                        )}
                      </div>
                      {slot && saveMode === 'load' && <div className="opacity-0 group-hover:opacity-100 transition-opacity"><ChevronRight className="w-5 h-5 text-primary" /></div>}
                      {slot && (
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteSlot(slotId) }} className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
