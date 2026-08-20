'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  type Connection,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  type NodeChange,
  type NodeProps,
  type Edge as RFEdge,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyNodeChanges,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import { BarChart3, Bot, GitBranch, Image, MessageSquare, PanelRight, Search, Settings, ShieldCheck, User, Workflow, X } from 'lucide-react'
import clsx from 'clsx'
import CustomEdge from './custom-edge'
import { useEditorCanvasStore } from '@editor/stores/editor-canvas-store'
import '@xyflow/react/dist/style.css'
import { DialogueNode } from './nodes/dialogue-node'
import { ChoiceNode } from './nodes/choice-node'
import { UnlockNode } from './nodes/unlock-node'
import { EndingNode } from './nodes/ending-node'
import { GatherNode } from './nodes/gather-node'
import { ConditionNode } from './nodes/condition-node'
import { CgNode } from './nodes/cg-node'
import { JumpNode } from './nodes/jump-node'
import { RandomNode } from './nodes/random-node'
import { NarrationNode } from './nodes/narration-node'
import { GroupNode } from './nodes/group-node'
import { EditorSidebar } from './editor-sidebar'
import { EditorRightPanel } from './editor-right-panel'
import { AiChatPanel } from './ai-chat-panel'
import { AssetLibraryPanel } from './asset-library-panel'
import { VersionPanel } from './version-panel'
import { MemoizedWritingStatsPanel } from './writing-stats-panel'
import { ActivityBar, type ActivityBarItem } from './activity-bar'
import { TopToolbar } from './top-toolbar'
import { AiFloatingButton } from './ai-floating-button'
import { AiPanelFlyout } from './ai-panel-flyout'
import { EmptyCanvasGuide } from './onboarding/empty-canvas-guide'
import { HelpMenu } from './onboarding/help-menu'
import { ShortcutsModal } from './onboarding/shortcuts-modal'
import { ToastContainer, showToast, useToast } from './toast'
import { A11yAnnouncer, useA11yAnnouncer } from './a11y-announcer'
import { type HistoryActionType, HistoryStore, type StoryGraphSnapshot, createSnapshot } from '@editor/lib/history-store'
import {
  type VersionSnapshot,
  deleteVersion as deleteVersionFromStore,
  loadVersions,
  restoreVersion,
  saveVersion,
} from '@editor/lib/version-store'
import { PERFORMANCE_CONFIG, getPerformanceMode } from '@editor/lib/performance-mode'
import { useAccessibilityStore } from '@editor/stores/accessibility-store'
import { type QualityIssue, runQualityCheck } from '@editor/lib/quality-check'
import { createAutoSaveManager, createRecoveryManager, formatRecoveryTime } from '@editor/lib/auto-save'
import { QualityCheckPanel } from './quality-check-panel'
import { RecoveryBanner } from './recovery-banner'
import { NodeSearch } from './node-search'
import { ExportDialog } from './export-dialog'
import { CreatorCenterDialog } from './creator-center-dialog'
import { DiscoverDialog } from './discover-dialog'
import { StoryPreview } from './preview/story-preview'
import { AlignmentLines } from './alignment-lines'
import type { AlignmentGuide } from '@editor/lib/alignment-guides'
import type { AnnotationType, CharacterSprite, ComicAudio, ComicScene, NodeAnnotation, NodeGroup, NodeTemplate, StoryCharacter, StoryEdge, StoryGraph, StoryNode } from '@editor/types/editor'
import type { WorkTypeId } from '@editor/types/work'
import type { MonetizationConfig } from '@editor/lib/work-monetization'
import { GROUP_COLORS } from '@editor/types/editor'
import { generateNodesFromOutline, generateOutlineFromNodes, parseOutline } from '@editor/lib/outline-parser'
import type { LibraryAsset } from '@editor/lib/asset-library'
import {
  getAnnotationAuthor,
  loadAnnotations,
  saveAnnotations,
  addAnnotation as storeAddAnnotation,
  addReply as storeAddReply,
  deleteAnnotation as storeDeleteAnnotation,
  deleteAnnotationsByNode as storeDeleteAnnotationsByNode,
  setAnnotationAuthor as storeSetAuthor,
  updateAnnotation as storeUpdateAnnotation,
} from '@editor/lib/annotation-store'
import { AnnotationMarkerProvider, withAnnotationMarker } from './annotation-marker'
import { matchShortcut } from '@editor/lib/shortcut-manager'
import { type Theme, THEME_LABELS, initTheme, subscribeTheme, toggleTheme } from '@editor/lib/theme-manager'
import { useAssistantName } from '@editor/lib/assistant-name'
import { endSession, estimateWordCount, recordAction, startSession } from '@editor/lib/writing-stats'
import { continueText, generateOutline, polishText, type AiOutlineResult } from '@editor/lib/ai'
import { getAiConfig, refreshAiConfig } from '@editor/lib/ai/provider-registry'
import type { OutlineScene } from '@editor/lib/ai/types'

// 为所有节点类型包裹批注标记（random 在组件内动态包装以传入 updateNodeData）
const baseNodeTypes = {
  dialogue: withAnnotationMarker(DialogueNode),
  narration: withAnnotationMarker(NarrationNode),
  choice: withAnnotationMarker(ChoiceNode),
  unlock: withAnnotationMarker(UnlockNode),
  ending: withAnnotationMarker(EndingNode),
  gather: withAnnotationMarker(GatherNode),
  condition: withAnnotationMarker(ConditionNode),
  cg: withAnnotationMarker(CgNode),
  jump: withAnnotationMarker(JumpNode),
  group: GroupNode,
}

const edgeTypes = {
  default: CustomEdge,
}

/**
 * 复制/粘贴/插入模板后重映射节点内部引用（jump 的 targetNodeId、random 选项的 targetId）。
 * idMap 为「旧 id → 新 id」。内部引用指向本次副本内的节点时替换为副本 id，
 * 指向组外节点时保留原 id（引用的原节点仍存在）。
 */
function remapNodeRefsInGraph(nodes: StoryNode[], idMap: Map<string, string>): void {
  for (const node of nodes) {
    const data = node.data as Record<string, unknown>
    if (typeof data.targetNodeId === 'string' && idMap.has(data.targetNodeId)) {
      data.targetNodeId = idMap.get(data.targetNodeId) as string
    }
    const options = data.options as Array<Record<string, unknown>> | undefined
    if (Array.isArray(options)) {
      for (const opt of options) {
        if (opt && typeof opt.targetId === 'string' && idMap.has(opt.targetId)) {
          opt.targetId = idMap.get(opt.targetId) as string
        }
      }
    }
  }
}

interface StoryCanvasProps {
  initialGraph?: StoryGraph
  onSave: (graph: StoryGraph) => void
  onGraphChange?: (graph: StoryGraph) => void
  onStartTour?: () => void
  workId?: string
  onBack?: () => void
  /** v2.0：作品类型（默认互动叙事） */
  workType?: WorkTypeId
}

export function StoryCanvas({ initialGraph, onSave, onGraphChange, onStartTour, workId, onBack, workType = 'interactive-narrative' }: StoryCanvasProps) {
  return (
    <ReactFlowProvider>
      <A11yAnnouncer>
        <StoryCanvasInner
          initialGraph={initialGraph}
          onSave={onSave}
          onGraphChange={onGraphChange}
          onStartTour={onStartTour}
          workId={workId}
          onBack={onBack}
          workType={workType}
        />
      </A11yAnnouncer>
    </ReactFlowProvider>
  )
}

function StoryCanvasInner({ initialGraph, onSave, onGraphChange, onStartTour, workId, onBack, workType = 'interactive-narrative' }: StoryCanvasProps) {
  const [nodes, setNodes] = useNodesState(initialGraph?.nodes || [])
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialGraph?.edges || [])
  const [groups, setGroups] = useState<NodeGroup[]>(initialGraph?.groups || [])
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [title, setTitle] = useState(initialGraph?.title || '未命名故事')
  const [tags, setTags] = useState<string[]>(initialGraph?.settings?.tags || [])
  // 模板 ID 从作品图初始化；此前直接透传外部 prop（main.tsx 从未传入，
  // 恒为 undefined），保存时恒回退 'dialogue'，导致自定义模板被静默覆盖。
  const [graphTemplateId, setGraphTemplateId] = useState<StoryGraph['templateId']>(initialGraph?.templateId || 'custom')
  const [characters, setCharacters] = useState<StoryCharacter[]>(initialGraph?.characters || [])
  const [variables, setVariables] = useState<import('@editor/types/editor').StoryVariable[]>(initialGraph?.variables || [])
  const { announce } = useA11yAnnouncer()
  // 不频繁变化的大型数据移入 useRef，避免每次状态更新触发重渲染
  const assetsRef = useRef(initialGraph?.assets || { images: [], audios: [], fonts: [] })
  const scenesRef = useRef<ComicScene[]>(initialGraph?.scenes || [
    { id: 'scene-default', name: '默认场景', backgroundImage: 'https://picsum.photos/seed/default-scene/800/600' },
  ])
  const audioRef = useRef<ComicAudio[]>(initialGraph?.audios || [])
  // scenes/audios 存于 ref（避免大数组进入渲染依赖），用版本号驱动 graph 重算：
  // 面板编辑场景/音频后，若版本号不变，graph memo 不会重建，保存/预览/导出会拿到旧数据。
  const [scenesVersion, setScenesVersion] = useState(0)
  const [audiosVersion, setAudiosVersion] = useState(0)
  // 打开素材库时预设的分类（video CG 需定位到视频分类）
  const [assetCategory, setAssetCategory] = useState<'all' | 'video'>('all')
  // 描述：初始加载保留，避免保存时被清空
  const [description, setDescription] = useState(initialGraph?.description || '')
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [showNodeSearch, setShowNodeSearch] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  // 创作者中心状态
  const [showCreatorCenter, setShowCreatorCenter] = useState(false)
  const [creatorCenterTab, setCreatorCenterTab] = useState<'account' | 'platforms' | 'publish' | 'records' | 'unlock'>('account')
  const [loginState, setLoginState] = useState(0) // 用于刷新登录状态
  // 作品发现
  const [showDiscover, setShowDiscover] = useState(false)
  // 快捷键提示弹窗
  const [showShortcutsModal, setShowShortcutsModal] = useState(false)
  // 预览状态
  const [showPreview, setShowPreview] = useState(false)
  // AI 设置弹窗
  const [showAiSettings, setShowAiSettings] = useState(false)
  // Phase 2: TopToolbar AI 按钮忙碌状态（全局互斥：3 个 AI 动作共享同一 busy flag，避免用户双击 / 快捷键冲突）
  const [isAiBusy, setIsAiBusy] = useState(false)
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false })
  const [rightPanelTab, setRightPanelTab] = useState('properties')
  const [outlineText, setOutlineText] = useState('')
  const [versions, setVersions] = useState<VersionSnapshot[]>([])
  // 节点批注系统
  const [annotations, setAnnotations] = useState<NodeAnnotation[]>(initialGraph?.annotations || [])
  const [monetization, setMonetization] = useState<MonetizationConfig | null>(initialGraph?.monetization || null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null)
  const [annotationDialog, setAnnotationDialog] = useState<{ nodeId: string } | null>(null)
  // 三栏布局状态（来自全局 Store，支持持久化）
  const {
    activeLeftActivity,
    activeRightActivity,
    aiPanelMode,
    setActiveLeftActivity,
    setActiveRightActivity,
    setAiPanelMode,
  } = useEditorCanvasStore()

  // ADHD 无障碍设置（专注模式 / 长反馈等）
  const focusMode = useAccessibilityStore((s) => s.focusMode)
  const longFeedback = useAccessibilityStore((s) => s.longFeedback)
  const toggleFocusMode = useAccessibilityStore((s) => s.toggleFocusMode)
  // 崩溃恢复横幅状态
  const [recoveryInfo, setRecoveryInfo] = useState<{ time: number } | null>(null)
  // ADHD 适配：自动保存管理器（挂载时启动，卸载/手动保存后清理）
  const autoSaveRef = useRef<ReturnType<typeof createAutoSaveManager> | null>(null)

  // Activity Bar items
  const LEFT_ACTIVITY_ITEMS: ActivityBarItem[] = [
    { id: 'nodes', icon: <Workflow className="h-4 w-4" />, label: '节点库' },
    { id: 'assets', icon: <Image className="h-4 w-4" />, label: '资源库' },
    { id: 'search', icon: <Search className="h-4 w-4" />, label: '搜索节点' },
  ]

  const LEFT_BOTTOM_ITEMS: ActivityBarItem[] = [
    { id: 'settings', icon: <Settings className="h-4 w-4" />, label: '设置' },
    { id: 'account', icon: <User className="h-4 w-4" />, label: '账户' },
  ]

  const RIGHT_ACTIVITY_ITEMS: ActivityBarItem[] = [
    { id: 'properties', icon: <PanelRight className="h-4 w-4" />, label: '属性' },
    { id: 'ai-chat', icon: <Bot className="h-4 w-4" />, label: 'AI 对话' },
    { id: 'versions', icon: <GitBranch className="h-4 w-4" />, label: '版本' },
    { id: 'stats', icon: <BarChart3 className="h-4 w-4" />, label: '统计' },
    { id: 'quality-check', icon: <ShieldCheck className="h-4 w-4" />, label: '作品体检' },
  ]

  // 主题状态（订阅变化以触发重渲染）
  const [currentTheme, setCurrentTheme] = useState<Theme>('dark')
  const assistantName = useAssistantName()
  const annotationAuthor = useMemo(() => getAnnotationAuthor(), [])
  const { screenToFlowPosition, fitView, getNodes, zoomIn, zoomOut } = useReactFlow()
  const canvasRef = useRef<HTMLDivElement>(null)
  const historyStoreRef = useRef<HistoryStore<StoryGraphSnapshot> | null>(null)
  const pendingHistoryActionRef = useRef<{ type: HistoryActionType; description: string } | null>(null)
  // 始终保持最新 onSave 引用（见 saveGraph 中说明）
  const onSaveRef = useRef(onSave)
  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])
  const clipboardRef = useRef<{ nodes: StoryNode[]; edges: StoryEdge[] } | null>(null)
  const pasteOffsetRef = useRef(0)
  const alignmentLinesRef = useRef<import('./alignment-lines').AlignmentLinesRef | null>(null)

  const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id)) as StoryNode[]
  const selectedNode = selectedNodeIds.length === 1 ? (selectedNodes[0] as StoryNode | undefined) : undefined
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) as StoryEdge | undefined
  const isEmpty = nodes.length === 0
  const isMultiSelect = selectedNodeIds.length > 1
  const performanceMode = getPerformanceMode(nodes.length)
  const perfConfig = PERFORMANCE_CONFIG[performanceMode]

  useEffect(() => {
    if (!historyStoreRef.current) {
      historyStoreRef.current = new HistoryStore<StoryGraphSnapshot>(50)
    }
    const initialSnapshot: StoryGraphSnapshot = {
      nodes: initialGraph?.nodes || [],
      edges: initialGraph?.edges || [],
      characters: initialGraph?.characters || [],
      scenes: initialGraph?.scenes || [],
      audios: initialGraph?.audios || [],
      variables: initialGraph?.variables || [],
      groups: initialGraph?.groups || [],
      annotations: initialGraph?.annotations || [],
      monetization: initialGraph?.monetization ?? null,
    }
    historyStoreRef.current.initialize(initialSnapshot)

    const unsubscribe = historyStoreRef.current.subscribe(setHistoryState)
    return () => {
      // 取消订阅避免内存泄漏
      unsubscribe()
    }
    // 仅在首次挂载时初始化历史栈：保存后 onSave 会更新 initialGraph，
    // 若此处依赖 initialGraph，每次保存都会清空撤销/重做历史。
  }, [])

  // 加载版本列表（localStorage）
  useEffect(() => {
    setVersions(loadVersions())
  }, [])

  // 主题初始化与订阅
  useEffect(() => {
    const initial = initTheme()
    setCurrentTheme(initial)
    const unsub = subscribeTheme((t) => setCurrentTheme(t))
    return unsub
  }, [])

  // 创作时间统计：开始/结束会话
  useEffect(() => {
    const wid = workId || 'default'
    startSession(wid)
    const handleBeforeUnload = () => {
      endSession(wid)
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        endSession(wid)
      } else {
        startSession(wid)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      endSession(wid)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workId])

  // 主题切换：由快捷键或外部按钮触发
  const handleToggleTheme = useCallback(() => {
    const next = toggleTheme()
    showToast('info', `已切换到${THEME_LABELS[next]}`)
  }, [])

  // 批注：从 localStorage 加载（按 workId 隔离）
  // 工作区切换或首次加载时重新读取
  useEffect(() => {
    const wid = workId || 'default'
    const stored = loadAnnotations(wid)
    // 优先使用 localStorage 数据；若 localStorage 为空但 initialGraph 有，则使用 initialGraph 的（迁移用）
    if (stored.length > 0) {
      setAnnotations(stored)
    } else if (initialGraph?.annotations && initialGraph.annotations.length > 0) {
      setAnnotations(initialGraph.annotations)
      saveAnnotations(wid, initialGraph.annotations)
    } else {
      setAnnotations([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workId])

  // 批注数据变化时持久化（防抖 300ms 避免高频写入）
  const annotationsSaveTimerRef = useRef<number | null>(null)
  useEffect(() => {
    if (annotationsSaveTimerRef.current) {
      clearTimeout(annotationsSaveTimerRef.current)
    }
    annotationsSaveTimerRef.current = window.setTimeout(() => {
      saveAnnotations(workId || 'default', annotations)
    }, 300)
    return () => {
      if (annotationsSaveTimerRef.current) {
        clearTimeout(annotationsSaveTimerRef.current)
      }
    }
  }, [annotations, workId])

  // 关闭右键菜单的兜底（点击画布或 Esc）
  useEffect(() => {
    if (!contextMenu) return
    const handleClose = () => setContextMenu(null)
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    window.addEventListener('click', handleClose)
    window.addEventListener('keydown', handleEsc)
    return () => {
      window.removeEventListener('click', handleClose)
      window.removeEventListener('keydown', handleEsc)
    }
  }, [contextMenu])

  // 创作者中心初始化（本地账号会话由 local-account-store 承载，无需在此恢复）
  // 注：原 ensureCreatorServiceInit（creatorAccounts 会话恢复）已随账号双轨统一移除；
  // 登录/登出后的重渲染由 CreatorCenterDialog 的 onLoginStateChange 回调驱动

  // 批注 Map（nodeId -> annotations）供 marker Context 使用
  const annotationsMap = useMemo(() => {
    const map = new Map<string, NodeAnnotation[]>()
    for (const a of annotations) {
      const list = map.get(a.nodeId)
      if (list) list.push(a)
      else map.set(a.nodeId, [a])
    }
    return map
  }, [annotations])

  const annotationContextValue = useMemo(
    () => ({
      map: annotationsMap,
      highlightedNodeId: selectedNodeIds.length === 1 ? selectedNodeIds[0] : null,
      onMarkerClick: (nodeId: string) => {
        setSelectedNodeIds([nodeId])
        setRightPanelTab('annotations')
      },
    }),
    [annotationsMap, selectedNodeIds]
  )

  // 批注增删改查回调
  const handleAddAnnotation = useCallback((input: { nodeId: string; type: AnnotationType; text: string; author: string }) => {
    const wid = workId || 'default'
    const updated = storeAddAnnotation(wid, input)
    setAnnotations(updated)
    if (input.author && input.author !== annotationAuthor) {
      storeSetAuthor(input.author)
    }
    setRightPanelTab('annotations')
    showToast('success', '批注已添加')
  }, [workId, annotationAuthor])

  const handleResolveAnnotation = useCallback((id: string) => {
    const wid = workId || 'default'
    const current = annotations.find((a) => a.id === id)
    if (!current) return
    const updated = storeUpdateAnnotation(wid, id, { resolved: !current.resolved })
    setAnnotations(updated)
  }, [workId, annotations])

  const handleReplyAnnotation = useCallback((id: string, text: string) => {
    const wid = workId || 'default'
    const updated = storeAddReply(wid, id, text)
    setAnnotations(updated)
  }, [workId])

  const handleDeleteAnnotation = useCallback((id: string) => {
    const wid = workId || 'default'
    const updated = storeDeleteAnnotation(wid, id)
    setAnnotations(updated)
    showToast('info', '批注已删除')
  }, [workId])

  // 使用 ref 持有最新状态，避免频繁重建
  const latestRef = useRef({ nodes, edges, characters, scenes: scenesRef.current, audioTracks: audioRef.current, variables, groups, annotations, monetization })
  latestRef.current = { nodes, edges, characters, scenes: scenesRef.current, audioTracks: audioRef.current, variables, groups, annotations, monetization }

  const buildSnapshot = useCallback((): StoryGraphSnapshot => {
    const { nodes: n, edges: e, characters: c, scenes: s, audioTracks: a, variables: v, groups: g, annotations: ann, monetization: mon } = latestRef.current
    return {
      nodes: n as StoryGraphSnapshot['nodes'],
      edges: e as StoryGraphSnapshot['edges'],
      characters: c as StoryGraphSnapshot['characters'],
      scenes: s as StoryGraphSnapshot['scenes'],
      audios: a as StoryGraphSnapshot['audios'],
      variables: v as StoryGraphSnapshot['variables'],
      groups: g as StoryGraphSnapshot['groups'],
      annotations: ann as StoryGraphSnapshot['annotations'],
      monetization: mon as StoryGraphSnapshot['monetization'],
    }
  }, [])

  const pushHistory = useCallback((type: HistoryActionType, description: string) => {
    pendingHistoryActionRef.current = { type, description }
  }, [])

  useEffect(() => {
    const pending = pendingHistoryActionRef.current
    if (!pending) return
    const after = buildSnapshot()
    const before = historyStoreRef.current?.getPresent()
    if (before) {
      historyStoreRef.current?.push(pending.type, pending.description, before, after)
      const wid = workId || 'default'
      const beforeWords = estimateWordCount(before.nodes)
      const afterWords = estimateWordCount(after.nodes)
      const wordDelta = afterWords - beforeWords
      const nodeDelta = after.nodes.length - before.nodes.length
      recordAction(wid, wordDelta, nodeDelta)
    }
    pendingHistoryActionRef.current = null
    // groups/characters/variables/scenes/audios 变更同样要驱动历史入栈，
    // 否则 pending 操作会被挂账到下一次节点/边变更（错误入栈）或永远丢失。
  }, [nodes, edges, characters, variables, groups, scenesVersion, audiosVersion, buildSnapshot, workId])

  // 拖拽过程中节流记录历史
  const lastPushTimeRef = useRef(0)
  const throttledPushHistory = useCallback((type: HistoryActionType, description: string) => {
    const now = Date.now()
    if (now - lastPushTimeRef.current < 200) return
    lastPushTimeRef.current = now
    pushHistory(type, description)
  }, [pushHistory])

  const handleDeleteEdge = useCallback((id: string) => {
    setEdges((eds) => eds.filter((e) => e.id !== id))
    setSelectedEdgeId(null)
    // 删除连线需入历史栈，否则不可撤销（此前缺失）
    pushHistory('DELETE_EDGE', '删除连线')
  }, [setEdges, pushHistory])

  // 「管理素材 / 从素材库选择」按钮：打开左侧资源库，并定位到对应分类
  // （video CG 此前错误地打开了音频分类；tab 参数此前被丢弃，素材库无法定位视频）
  const handleOpenAssets = useCallback((tab?: 'images' | 'audios' | 'video') => {
    setAssetCategory(tab === 'video' ? 'video' : 'all')
    setActiveLeftActivity('assets')
  }, [setActiveLeftActivity])

  /** 生成带随机后缀的节点 id，避免同一毫秒批量创建（AI 生成/连点）产生重复 id */
  const generateNodeId = useCallback((type: string) => {
    return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }, [])

  // 把历史快照恢复到画布各状态源（undo / redo / 回滚 AI 操作共用）
  const applySnapshot = useCallback((snapshot: StoryGraphSnapshot) => {
    setNodes(snapshot.nodes as StoryNode[])
    setEdges(snapshot.edges as StoryEdge[])
    setGroups(snapshot.groups as NodeGroup[])
    setCharacters(snapshot.characters as StoryCharacter[])
    setVariables(snapshot.variables as import('@editor/types/editor').StoryVariable[])
    scenesRef.current = snapshot.scenes as ComicScene[]
    audioRef.current = snapshot.audios as ComicAudio[]
    // 场景/音频可能随快照回滚，递增版本号驱动 graph 重算
    setScenesVersion((v) => v + 1)
    setAudiosVersion((v) => v + 1)
    // 批注与付费配置随快照回滚（可选字段兼容早期快照）
    if (snapshot.annotations) {
      setAnnotations(snapshot.annotations as NodeAnnotation[])
    }
    if (snapshot.monetization !== undefined) {
      setMonetization((snapshot.monetization as MonetizationConfig | null) ?? null)
    }
  }, [setNodes, setEdges, setGroups, setCharacters, setVariables, setAnnotations, setMonetization, setScenesVersion, setAudiosVersion])

  const undo = useCallback(() => {
    const snapshot = historyStoreRef.current?.undo()
    if (snapshot) {
      applySnapshot(snapshot)
      showToast('info', '已撤销')
      announce('已撤销')
    }
  }, [applySnapshot, announce])

  const redo = useCallback(() => {
    const snapshot = historyStoreRef.current?.redo()
    if (snapshot) {
      applySnapshot(snapshot)
      showToast('info', '已重做')
      announce('已重做')
    }
  }, [applySnapshot, announce])

  // AI 批量操作检查点：act-along 模式下，AI 每批动作执行前把当前画布状态推入历史栈
  const markAiBatchBoundary = useCallback(() => {
    const graph = buildSnapshot()
    historyStoreRef.current?.markAiBatch(graph)
  }, [buildSnapshot])

  // 回滚到最近一次 AI 批量操作之前的状态（可重复回退到更早的 AI 批次）
  const undoToAiBatchBoundary = useCallback((): boolean => {
    const result = historyStoreRef.current?.undoToLastAiBatch()
    if (!result || !result.done || !result.snapshot) return false
    applySnapshot(result.snapshot)
    showToast('info', '已回滚 AI 操作')
    announce('已回滚 AI 操作')
    return true
  }, [applySnapshot, announce])

  // 构建当前 graph — useMemo 优化避免每次渲染重建
  const graph = useMemo((): StoryGraph => ({
    title,
    description,
    templateId: graphTemplateId,
    characters,
    variables,
    nodes: nodes as StoryNode[],
    edges: edges as StoryEdge[],
    settings: { title, tags },
    assets: assetsRef.current,
    scenes: scenesRef.current,
    audios: audioRef.current,
    groups,
    annotations,
    monetization: monetization ?? undefined,
  }), [title, description, graphTemplateId, characters, variables, nodes, edges, tags, groups, annotations, monetization, scenesVersion, audiosVersion])

  // 使用 ref 持有最新 graph，供 beforeunload / unmount 同步保存使用
  const graphRef = useRef(graph)
  graphRef.current = graph

  // 通知外部数据变化（节流 200ms 避免拖拽时高频触发）
  const graphChangeTimerRef = useRef<number | null>(null)
  useEffect(() => {
    if (graphChangeTimerRef.current) {
      clearTimeout(graphChangeTimerRef.current)
    }
    graphChangeTimerRef.current = window.setTimeout(() => {
      onGraphChange?.(graph)
    }, 200)
    return () => {
      if (graphChangeTimerRef.current) {
        clearTimeout(graphChangeTimerRef.current)
      }
    }
  }, [graph, onGraphChange])

  // Ctrl+F 打开节点搜索
  useEffect(() => {
    const handleOpenSearch = () => setShowNodeSearch(true)
    window.addEventListener('subsilicon-node-search-open', handleOpenSearch)
    return () => window.removeEventListener('subsilicon-node-search-open', handleOpenSearch)
  }, [])

  const nodeTypeLabels: Record<string, string> = useMemo(() => ({
    dialogue: '对话',
    narration: '旁白',
    choice: '选择',
    gather: '汇聚',
    condition: '条件',
    unlock: '付费',
    ending: '结局',
    cg: 'CG过场',
    jump: '跳转',
    random: '随机',
  }), [])

  const createNodeData = (type: string) => {
    switch (type) {
      case 'dialogue':
        return { characterId: '', text: '', emotion: '', spritePosition: 'center', enterAnimation: 'fade-in', textAnimation: 'typewriter' }
      case 'narration':
        return { text: '', fontSize: 16, fontColor: '#ffffff', textAnimation: 'typewriter', backgroundColor: '' }
      case 'choice':
        return { options: [{ id: 'opt-a', text: '选项A' }, { id: 'opt-b', text: '选项B' }], prompt: '你的选择是？' }
      case 'ending':
        return { title: '结局', text: '', endingType: 'neutral' as const }
      case 'gather':
        return { label: '汇聚' }
      case 'condition':
        return { expression: 'true', trueLabel: '是', falseLabel: '否' }
      case 'unlock':
        return { amount: 1, nodeTitle: '解锁内容', description: '' }
      case 'cg':
        return { mediaType: 'image' as const, url: '', title: '', duration: 0, canSkip: true, transitionIn: 'fade', transitionOut: 'fade', transitionDuration: 1000, letterbox: true }
      case 'jump':
        return { label: '', targetNodeId: '', expression: '' }
      case 'random':
        return { label: '', options: [
          { id: '1', label: '选项 A', weight: 50 },
          { id: '2', label: '选项 B', weight: 50 },
        ] }
      default:
        return {}
    }
  }

  const addNodeAtCenter = useCallback((type: string) => {
    const id = generateNodeId(type)
    const position = screenToFlowPosition({
      x: window.innerWidth / 2 - 100,
      y: window.innerHeight / 2 - 80,
    })
    const newNode = {
      id,
      type: type as StoryNode['type'],
      position,
      data: createNodeData(type) as StoryNode['data'],
    }
    setNodes((nds) => [...nds, newNode as StoryNode])
    setSelectedNodeIds([id])
    pushHistory('ADD_NODE', `添加 ${nodeTypeLabels[type] || type} 节点`)
    showToast('success', `已添加${nodeTypeLabels[type] || type}节点`)
    announce(`已添加${nodeTypeLabels[type] || type}节点`)
  }, [screenToFlowPosition, setNodes, pushHistory, announce])

  // 监听侧边栏拖拽放置的自定义事件
  useEffect(() => {
    const handleDrop = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dropData = (window as any).__subsilicon_drop_node
      if (!dropData) return

      const newNode: any = {
        id: dropData.id,
        type: dropData.type,
        position: dropData.position,
        data: dropData.data,
      }
      setNodes((nds) => [...nds, newNode])
      setSelectedNodeIds([dropData.id])
      setIsDraggingOver(false)
      pushHistory('ADD_NODE', `添加 ${nodeTypeLabels[dropData.type] || dropData.type} 节点`)
      showToast('success', `已添加${nodeTypeLabels[dropData.type] || dropData.type}节点`)
      delete (window as any).__subsilicon_drop_node
    }

    window.addEventListener('subsilicon-node-drop', handleDrop)
    return () => window.removeEventListener('subsilicon-node-drop', handleDrop)
  }, [setNodes, pushHistory, nodeTypeLabels])

  /**
   * 删除节点后的关联数据清理：
   * - 分组 nodeIds 中的悬空 id（避免分组节点数/折叠显示错误）
   * - monetization.paidNodes / freePreviewNodes 中的悬空 id（付费列表残留已删节点）
   * 批注清理见 deleteSelectedNodes / deleteNode 各自的 store 调用。
   */
  const cleanupOrphanRefs = useCallback((idsToDelete: string[]) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.nodeIds.some((id) => idsToDelete.includes(id))
          ? { ...g, nodeIds: g.nodeIds.filter((id) => !idsToDelete.includes(id)) }
          : g
      )
    )
    setMonetization((prev) => {
      if (!prev) return prev
      const paidNodes = (prev.paidNodes || []).filter((id) => !idsToDelete.includes(id))
      const freePreviewNodes = (prev.freePreviewNodes || []).filter((id) => !idsToDelete.includes(id))
      if (paidNodes.length === (prev.paidNodes || []).length && freePreviewNodes.length === (prev.freePreviewNodes || []).length) {
        return prev
      }
      return { ...prev, paidNodes, freePreviewNodes }
    })
  }, [setGroups, setMonetization])

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds))
      pushHistory('ADD_EDGE', '创建连线')
      showToast('info', '连线已创建')
    },
    [setEdges, pushHistory]
  )

  const deleteSelectedNodes = useCallback(() => {
    if (selectedNodeIds.length === 0) return

    const idsToDelete = [...selectedNodeIds]
    const deletedCount = idsToDelete.length

    // 清理关联的批注
    const wid = workId || 'default'
    idsToDelete.forEach(nodeId => {
      storeDeleteAnnotationsByNode(wid, nodeId)
    })
    // 重新加载批注以更新 UI
    setAnnotations(loadAnnotations(wid))

    setNodes((nds) => nds.filter((n) => !idsToDelete.includes(n.id)))
    setEdges((eds) => eds.filter((e) => !idsToDelete.includes(e.source) && !idsToDelete.includes(e.target)))
    setSelectedNodeIds([])
    cleanupOrphanRefs(idsToDelete)

    if (deletedCount === 1) {
      const nodeType = nodes.find((n) => n.id === idsToDelete[0])?.type
      pushHistory('DELETE_NODE', `删除 ${nodeTypeLabels[nodeType || ''] || '节点'}`)
      showToast('info', `${nodeTypeLabels[nodeType || ''] || '节点'}已删除`)
    } else {
      pushHistory('BATCH', `批量删除 ${deletedCount} 个节点`)
      showToast('info', `已删除 ${deletedCount} 个节点`)
    }
  }, [selectedNodeIds, nodes, setNodes, setEdges, pushHistory, workId, cleanupOrphanRefs])

  const createGroupFromSelection = useCallback(() => {
    if (selectedNodeIds.length < 2) {
      showToast('info', '请至少选择 2 个节点创建分组')
      return
    }

    const selectedNodesList = nodes.filter((n) => selectedNodeIds.includes(n.id))
    if (selectedNodesList.length === 0) return

    const minX = Math.min(...selectedNodesList.map((n) => n.position.x))
    const minY = Math.min(...selectedNodesList.map((n) => n.position.y))
    const maxX = Math.max(...selectedNodesList.map((n) => n.position.x + 280))
    const maxY = Math.max(...selectedNodesList.map((n) => n.position.y + 120))

    const padding = 40
    const groupId = `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const newGroup: NodeGroup = {
      id: groupId,
      name: `分组 ${groups.length + 1}`,
      color: GROUP_COLORS[groups.length % GROUP_COLORS.length].value,
      nodeIds: [...selectedNodeIds],
      collapsed: false,
      position: { x: minX - padding, y: minY - padding - 32 },
      size: { width: maxX - minX + padding * 2, height: maxY - minY + padding * 2 + 32 },
    }

    setGroups((prev) => [...prev, newGroup])
    setSelectedGroupId(groupId)
    setSelectedNodeIds([])
    pushHistory('ADD_GROUP', `创建分组「${newGroup.name}」`)
    showToast('success', `已创建分组「${newGroup.name}」`)
  }, [selectedNodeIds, nodes, groups, setGroups, pushHistory])

  const deleteGroup = useCallback((groupId: string, keepNodes = true) => {
    const group = groups.find((g) => g.id === groupId)
    if (!group) return

    setGroups((prev) => prev.filter((g) => g.id !== groupId))
    if (selectedGroupId === groupId) {
      setSelectedGroupId(null)
    }

    if (keepNodes) {
      pushHistory('DELETE_GROUP', `取消分组「${group.name}」`)
      showToast('info', `已取消分组「${group.name}」，节点已保留`)
    } else {
      setNodes((nds) => nds.filter((n) => !group.nodeIds.includes(n.id)))
      setEdges((eds) => eds.filter((e) => !group.nodeIds.includes(e.source) && !group.nodeIds.includes(e.target)))
      pushHistory('DELETE_GROUP', `删除分组「${group.name}」及节点`)
      showToast('info', `已删除分组「${group.name}」及其节点`)
    }
  }, [groups, selectedGroupId, setGroups, setNodes, setEdges, pushHistory])

  const toggleGroupCollapse = useCallback((groupId: string) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g
        const newCollapsed = !g.collapsed
        return { ...g, collapsed: newCollapsed }
      })
    )
    const group = groups.find((g) => g.id === groupId)
    if (group) {
      pushHistory('UPDATE_GROUP', `${group.collapsed ? '展开' : '折叠'}分组「${group.name}」`)
    }
  }, [groups, setGroups, pushHistory])

  const renameGroup = useCallback((groupId: string, newName: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, name: newName } : g))
    )
    pushHistory('UPDATE_GROUP', '重命名分组')
  }, [setGroups, pushHistory])

  const changeGroupColor = useCallback((groupId: string, color: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, color } : g))
    )
    pushHistory('UPDATE_GROUP', '修改分组颜色')
  }, [setGroups, pushHistory])

  const handleGroupNodeDrag = useCallback((event: MouseEvent | TouchEvent, node: Node, draggedNodes: Node[]) => {
    const groupNode = draggedNodes.find((n) => n.type === 'group')
    if (!groupNode) return

    const group = groups.find((g) => g.id === groupNode.id)
    if (!group || group.collapsed) return

    const dx = groupNode.position.x - group.position.x
    const dy = groupNode.position.y - group.position.y

    if (dx === 0 && dy === 0) return

    setNodes((nds) =>
      nds.map((n) => {
        if (!group.nodeIds.includes(n.id)) return n
        return {
          ...n,
          position: {
            x: n.position.x + dx,
            y: n.position.y + dy,
          },
        }
      })
    )

    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== group.id) return g
        return {
          ...g,
          position: { x: groupNode.position.x, y: groupNode.position.y },
        }
      })
    )
  }, [groups, setNodes, setGroups])

  const groupNodesForFlow = useMemo(() => {
    return groups.map((group) => ({
      id: group.id,
      type: 'group' as const,
      position: group.position,
      data: {
        name: group.name,
        color: group.color,
        collapsed: group.collapsed,
        nodeCount: group.nodeIds.length,
        onToggleCollapse: toggleGroupCollapse,
        onRename: renameGroup,
        onColorChange: changeGroupColor,
        onDelete: deleteGroup,
      },
      style: {
        width: group.size.width,
        height: group.collapsed ? 32 : group.size.height,
        zIndex: -1,
      },
      draggable: true,
      selectable: true,
    }))
  }, [groups, toggleGroupCollapse, renameGroup, changeGroupColor, deleteGroup])

  const visibleNodes = useMemo(() => {
    const collapsedGroupNodeIds = new Set<string>()
    groups.forEach((g) => {
      if (g.collapsed) {
        g.nodeIds.forEach((id) => collapsedGroupNodeIds.add(id))
      }
    })

    const filteredNodes = nodes.filter((n) => !collapsedGroupNodeIds.has(n.id))
    return [...groupNodesForFlow, ...filteredNodes] as Node[]
  }, [nodes, groups, groupNodesForFlow])

  const copySelectedNodes = useCallback(() => {
    if (selectedNodeIds.length === 0) return

    const selectedNodesList = nodes.filter((n) => selectedNodeIds.includes(n.id)) as StoryNode[]
    const selectedEdgesList = edges.filter(
      (e) => selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target)
    ) as StoryEdge[]

    clipboardRef.current = {
      nodes: JSON.parse(JSON.stringify(selectedNodesList)),
      edges: JSON.parse(JSON.stringify(selectedEdgesList)),
    }
    pasteOffsetRef.current = 0

    showToast('info', `已复制 ${selectedNodesList.length} 个节点`)
  }, [selectedNodeIds, nodes, edges])

  const pasteNodes = useCallback(() => {
    const clipboard = clipboardRef.current
    if (!clipboard || clipboard.nodes.length === 0) return

    pasteOffsetRef.current += 1
    const offset = pasteOffsetRef.current * 40

    const idMap = new Map<string, string>()
    const newNodes: StoryNode[] = clipboard.nodes.map((node) => {
      const newId = generateNodeId(node.type)
      idMap.set(node.id, newId)
      return {
        ...node,
        id: newId,
        position: {
          x: node.position.x + offset,
          y: node.position.y + offset,
        },
        data: JSON.parse(JSON.stringify(node.data)),
      }
    })
    // idMap 完整后重映射节点内部引用（jump 的 targetNodeId、random 选项的 targetId），
    // 否则副本指向原节点，原节点被删后副本在预览中死链
    remapNodeRefsInGraph(newNodes, idMap)

    const newEdges: StoryEdge[] = clipboard.edges.map((edge) => {
      const newSource = idMap.get(edge.source) || edge.source
      const newTarget = idMap.get(edge.target) || edge.target
      return {
        ...edge,
        id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        source: newSource,
        target: newTarget,
        data: edge.data ? JSON.parse(JSON.stringify(edge.data)) : undefined,
      }
    })

    setNodes((nds) => [...nds, ...newNodes])
    setEdges((eds) => [...eds, ...newEdges])
    setSelectedNodeIds(newNodes.map((n) => n.id))

    const nodeCount = newNodes.length
    if (nodeCount === 1) {
      pushHistory('ADD_NODE', `粘贴 ${nodeTypeLabels[newNodes[0].type] || '节点'}`)
    } else {
      pushHistory('BATCH', `粘贴 ${nodeCount} 个节点`)
    }
    showToast('success', `已粘贴 ${nodeCount} 个节点`)
  }, [generateNodeId, setNodes, setEdges, pushHistory])

  const duplicateSelectedNodes = useCallback(() => {
    if (selectedNodeIds.length === 0) return

    const selectedNodesList = nodes.filter((n) => selectedNodeIds.includes(n.id)) as StoryNode[]
    const selectedEdgesList = edges.filter(
      (e) => selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target)
    ) as StoryEdge[]

    clipboardRef.current = {
      nodes: JSON.parse(JSON.stringify(selectedNodesList)),
      edges: JSON.parse(JSON.stringify(selectedEdgesList)),
    }
    pasteOffsetRef.current = 0

    pasteNodes()
  }, [selectedNodeIds, nodes, edges, pasteNodes])

  const insertTemplate = useCallback((template: NodeTemplate, dropX: number, dropY: number) => {
    if (!template.nodes || template.nodes.length === 0) return

    const idMap = new Map<string, string>()
    const newNodes: StoryNode[] = template.nodes.map((node) => {
      const newId = generateNodeId(node.type)
      idMap.set(node.id, newId)
      return {
        ...JSON.parse(JSON.stringify(node)),
        id: newId,
        position: {
          x: node.position.x + dropX,
          y: node.position.y + dropY,
        },
      }
    })

    const newEdges: StoryEdge[] = template.edges.map((edge) => {
      const newSource = idMap.get(edge.source) || edge.source
      const newTarget = idMap.get(edge.target) || edge.target
      return {
        ...JSON.parse(JSON.stringify(edge)),
        id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        source: newSource,
        target: newTarget,
      }
    })
    // 模板复制同样要重映射节点内部引用
    remapNodeRefsInGraph(newNodes, idMap)

    setNodes((nds) => [...nds, ...newNodes])
    setEdges((eds) => [...eds, ...newEdges])
    setSelectedNodeIds(newNodes.map((n) => n.id))

    const nodeCount = newNodes.length
    pushHistory('BATCH', `插入模板「${template.name}」(${nodeCount} 个节点)`)
    showToast('success', `已插入模板「${template.name}」`)
  }, [generateNodeId, setNodes, setEdges, pushHistory])

  const handleGenerateNodesFromOutline = useCallback((outline: string) => {
    const items = parseOutline(outline)
    if (items.length === 0) {
      showToast('info', '未解析到有效的大纲内容')
      return
    }

    const allNodes = getNodes()
    const maxX = allNodes.length > 0
      ? Math.max(...allNodes.map(n => n.position.x + (n.width || 280)))
      : 0
    const startX = maxX + 200
    const startY = 100

    const { nodes: newNodes, edges: newEdges } = generateNodesFromOutline(items, {
      startX,
      startY,
    })

    if (newNodes.length === 0) {
      showToast('info', '未生成任何节点')
      return
    }

    setNodes((nds) => [...nds, ...newNodes])
    setEdges((eds) => [...eds, ...newEdges])
    setSelectedNodeIds(newNodes.map((n) => n.id))

    const nodeCount = newNodes.length
    pushHistory('BATCH', `从大纲生成 ${nodeCount} 个节点`)
    showToast('success', `已生成 ${nodeCount} 个节点`)

    setTimeout(() => {
      fitView({
        nodes: newNodes.map(n => ({ id: n.id })),
        padding: 0.3,
        duration: 500,
      })
    }, 100)
  }, [getNodes, setNodes, setEdges, pushHistory, fitView])

  const handleGenerateOutlineFromNodes = useCallback((): string => {
    const result = generateOutlineFromNodes(
      nodes as StoryNode[],
      edges as StoryEdge[],
      groups
    )
    return result
  }, [nodes, edges, groups])

  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const lastDeleteTimeRef = useRef(0)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.target) return

      // 保存快捷键在输入框聚焦时也生效：创作过程常处于文本编辑状态，
      // 同时 preventDefault 可拦截浏览器默认的「保存网页」弹窗
      if (matchShortcut(e, 'save')) {
        e.preventDefault()
        saveGraph()
        showToast('success', '作品已保存')
        announce('作品已保存')
        return
      }

      const target = e.target as HTMLElement
      const isInputTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable ||
        target.tagName === 'SELECT'

      if (isInputTarget) {
        return
      }

      // 弹窗/预览打开时不响应画布快捷键，否则导出/预览流程中
      // 误按 Delete 或字母键会删除/修改弹窗背后的作品数据
      const anyDialogOpen =
        showNodeSearch ||
        showExportDialog ||
        showCreatorCenter ||
        showDiscover ||
        showShortcutsModal ||
        showPreview ||
        showAiSettings
      if (anyDialogOpen) return

      // 画布类：撤销 / 重做 / 缩放 / 适应视图
      if (matchShortcut(e, 'undo')) {
        e.preventDefault()
        undo()
        return
      }

      if (matchShortcut(e, 'redo')) {
        e.preventDefault()
        redo()
        return
      }

      if (matchShortcut(e, 'zoomIn')) {
        e.preventDefault()
        zoomIn?.({ duration: 200 })
        return
      }

      if (matchShortcut(e, 'zoomOut')) {
        e.preventDefault()
        zoomOut?.({ duration: 200 })
        return
      }

      if (matchShortcut(e, 'fitView')) {
        e.preventDefault()
        fitView({ padding: 0.2, duration: 300 })
        return
      }

      // 编辑类：复制 / 粘贴 / 克隆 / 创建分组
      if (matchShortcut(e, 'copy')) {
        e.preventDefault()
        copySelectedNodes()
        return
      }

      if (matchShortcut(e, 'paste')) {
        e.preventDefault()
        pasteNodes()
        return
      }

      if (matchShortcut(e, 'duplicate')) {
        e.preventDefault()
        duplicateSelectedNodes()
        return
      }

      if (matchShortcut(e, 'group')) {
        if (selectedNodeIds.length >= 2) {
          e.preventDefault()
          createGroupFromSelection()
        }
        return
      }

      // 节点类：取消选中 / 删除
      if (matchShortcut(e, 'deselectAll')) {
        if (selectedNodeIds.length > 0 || selectedEdgeId) {
          e.preventDefault()
          setSelectedNodeIds([])
          setSelectedEdgeId(null)
        }
        return
      }

      if (matchShortcut(e, 'deleteNode')) {
        if (selectedNodeIds.length > 0) {
          e.preventDefault()
          const now = Date.now()
          if (now - lastDeleteTimeRef.current < 300) return
          lastDeleteTimeRef.current = now
          deleteSelectedNodes()
        } else if (selectedEdgeId) {
          // 选中连线时 Delete/Backspace 同样生效（此前仅节点分支，连线删除入口断链）
          e.preventDefault()
          const now = Date.now()
          if (now - lastDeleteTimeRef.current < 300) return
          lastDeleteTimeRef.current = now
          handleDeleteEdge(selectedEdgeId)
        }
        return
      }

      // 视图类：切换侧边栏 / 右侧属性面板 / AI 面板 / 主题
      if (matchShortcut(e, 'toggleSidebar')) {
        e.preventDefault()
        setActiveLeftActivity(activeLeftActivity === 'nodes' ? null : 'nodes')
        return
      }

      if (matchShortcut(e, 'toggleRightPanel')) {
        e.preventDefault()
        setActiveRightActivity(activeRightActivity === 'properties' ? null : 'properties')
        return
      }

      if (matchShortcut(e, 'toggleTheme')) {
        e.preventDefault()
        handleToggleTheme()
        return
      }

      // ADHD 适配：专注模式（收起所有面板，进入无干扰画布）
      if (matchShortcut(e, 'focusMode')) {
        e.preventDefault()
        toggleFocusMode()
        announce(focusMode ? '专注模式已退出' : '专注模式已开启，已隐藏所有面板')
        return
      }

      // ADHD 适配：作品体检（'Q'）
      if (matchShortcut(e, 'qualityCheck')) {
        e.preventDefault()
        // 退出专注模式以显示体检面板
        if (focusMode) {
          toggleFocusMode()
        }
        setActiveRightActivity('quality-check')
        const issues = runQualityCheck(graphRef.current)
        announce(`作品体检：发现 ${issues.length} 个${issues.some((i) => i.severity === 'error') ? '需要处理' : '可优化'}的问题`)
        return
      }

      // AI 面板显隐
      if (matchShortcut(e, 'toggleAiPanel')) {
        e.preventDefault()
        setAiPanelMode(aiPanelMode === 'hidden' ? 'floating' : 'hidden')
        return
      }

      // Phase 2: TopToolbar AI 动作快捷键
      if (matchShortcut(e, 'aiOutline')) {
        e.preventDefault()
        void handleAiOutline()
        return
      }
      if (matchShortcut(e, 'aiContinue')) {
        e.preventDefault()
        void handleAiContinue()
        return
      }
      if (matchShortcut(e, 'aiPolish')) {
        e.preventDefault()
        void handleAiPolish()
        return
      }

      // 节点类：快速添加节点
      if (matchShortcut(e, 'addDialogue')) {
        e.preventDefault()
        addNodeAtCenter('dialogue')
        return
      }

      if (matchShortcut(e, 'addChoice')) {
        e.preventDefault()
        addNodeAtCenter('choice')
        return
      }

      if (matchShortcut(e, 'addEnding')) {
        e.preventDefault()
        addNodeAtCenter('ending')
        return
      }

      if (matchShortcut(e, 'addGather')) {
        e.preventDefault()
        addNodeAtCenter('gather')
        return
      }

      if (matchShortcut(e, 'addJump')) {
        e.preventDefault()
        addNodeAtCenter('jump')
        return
      }

      if (matchShortcut(e, 'addRandom')) {
        e.preventDefault()
        addNodeAtCenter('random')
        return
      }

      if (matchShortcut(e, 'addUnlock')) {
        e.preventDefault()
        addNodeAtCenter('unlock')
        return
      }

      if (matchShortcut(e, 'addCondition')) {
        e.preventDefault()
        addNodeAtCenter('condition')
        return
      }

      if (matchShortcut(e, 'addCG')) {
        e.preventDefault()
        addNodeAtCenter('cg')
        return
      }

      // 节点位置微调（方向键）
      if (selectedNodeIds.length > 0) {
        const step = e.shiftKey ? 20 : 5
        let dx = 0
        let dy = 0

        if (e.key === 'ArrowUp') {
          dy = -step
        } else if (e.key === 'ArrowDown') {
          dy = step
        } else if (e.key === 'ArrowLeft') {
          dx = -step
        } else if (e.key === 'ArrowRight') {
          dx = step
        }

        if (dx !== 0 || dy !== 0) {
          e.preventDefault()
          setNodes((nds) =>
            nds.map((n) => {
              if (selectedNodeIds.includes(n.id)) {
                return {
                  ...n,
                  position: {
                    x: n.position.x + dx,
                    y: n.position.y + dy,
                  },
                }
              }
              return n
            })
          )
          throttledPushHistory('UPDATE_NODE', `移动节点 ${dx !== 0 ? `水平${dx > 0 ? '右' : '左'}` : ''}${dy !== 0 ? `垂直${dy > 0 ? '下' : '上'}` : ''}`)
          return
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    selectedNodeIds,
    selectedEdgeId,
    undo,
    redo,
    deleteSelectedNodes,
    handleDeleteEdge,
    copySelectedNodes,
    pasteNodes,
    duplicateSelectedNodes,
    createGroupFromSelection,
    addNodeAtCenter,
    zoomIn,
    zoomOut,
  ])

  // 为所有全局快捷键（非节点类、非 AI）使用独立依赖数组，避免与上面的主 handler 合并后产生 stale closure。

  const updateNodeData = useCallback((nodeId: string, data: Partial<StoryNode['data']>) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n))
    )
    throttledPushHistory('UPDATE_NODE', '修改节点属性')
  }, [setNodes, throttledPushHistory])

  // ────────────────────────────────────────────────────────────────────────
  // Phase 2: TopToolbar AI 动作接入（生成大纲 / 续写 / 润色）
  // ────────────────────────────────────────────────────────────────────────

  /** 从当前选中节点抽取可传给 AI 的纯文本（对话/旁白/选项合并）。 */
  const extractNodeText = useCallback((node: StoryNode | undefined | null): string => {
    if (!node) return ''
    const d = node.data as Record<string, unknown>
    const text = typeof d.text === 'string' ? d.text.trim() : ''
    const narration = typeof d.narration === 'string' ? d.narration.trim() : ''
    const content = typeof d.content === 'string' ? d.content.trim() : ''
    const label = typeof d.label === 'string' ? d.label.trim() : ''
    const options = Array.isArray(d.options) ? d.options.map((o: any) => (o && typeof o.label === 'string' ? o.label : '')).filter(Boolean) as string[] : []
    return [narration, content, text, label, ...options].join(' ').trim()
  }, [])

  /** 把 AI 大纲服务返回的 scenes 转成 Markdown，方便复用现有 parseOutline → generateNodesFromOutline。 */
  function scenesToMarkdown(result: AiOutlineResult): string {
    const lines: string[] = [`# ${result.title}`]
    for (const s of result.scenes) {
      lines.push(`## ${s.title || '场景'}`)
      if (s.description) lines.push(`- 旁白: ${s.description}`)
      if (Array.isArray(s.characters) && s.characters.length) {
        lines.push(`- 角色: ${s.characters.join('、')}`)
      }
      if (Array.isArray(s.choices) && s.choices.length) {
        for (const c of s.choices) {
          lines.push(`- 选项: ${c.text}`)
        }
      } else if (s.description) {
        lines.push(`- 对话: ${s.description.slice(0, 120)}`)
      }
    }
    return lines.join('\n')
  }

  /** 统一的 AI 配置未就绪提示，避免文案分裂。 */
  function requireAiConfig(): boolean {
    refreshAiConfig()
    const ok = !!getAiConfig()
    if (!ok) {
      showToast('error', '请先配置 AI 服务（右上角齿轮）后再使用 AI 创作工具')
      setShowAiSettings(true)
    }
    return ok
  }

  const handleAiOutline = useCallback(async () => {
    if (isAiBusy || !requireAiConfig()) return
    setIsAiBusy(true)
    announce('开始 AI 生成大纲')
    try {
      const topic = (title && title !== '未命名故事') ? title : '原创互动故事'
      const outline = await generateOutline(topic, '互动叙事', 5)
      if (!outline.scenes || outline.scenes.length === 0) {
        showToast('error', 'AI 未返回可用场景，请重试')
        return
      }
      const markdown = scenesToMarkdown(outline)
      const parsed = parseOutline(markdown)
      if (parsed.length === 0) {
        showToast('error', '大纲解析失败，请重试')
        return
      }
      const { nodes: newNodes, edges: newEdges } = generateNodesFromOutline(parsed, {
        startX: 400,
        startY: 120,
      })
      setNodes((nds) => [...nds, ...newNodes])
      setEdges((eds) => [...eds, ...newEdges])
      setSelectedNodeIds(newNodes.map((n) => n.id))
      pushHistory('BATCH', `AI 生成 ${newNodes.length} 个节点`)
      setTitle((prev) => (prev === '未命名故事' ? outline.title || prev : prev))
      showToast('success', `AI 已生成 ${newNodes.length} 个节点`)
      announce(`大纲生成完成，共 ${newNodes.length} 个节点`)
      setTimeout(() => {
        fitView?.({ padding: 0.3, duration: 500, nodes: newNodes.map((n) => ({ id: n.id })) })
      }, 120)
    } catch (err: any) {
      showToast('error', `AI 生成大纲失败：${err?.message || '未知错误'}`)
    } finally {
      setIsAiBusy(false)
    }
  }, [isAiBusy, title, pushHistory, setNodes, setEdges, announce, fitView])

  const handleAiContinue = useCallback(async () => {
    if (isAiBusy || !requireAiConfig()) return
    const src = selectedNode
    const srcText = extractNodeText(src)
    if (!srcText) {
      showToast('error', '请先选中一个有内容的节点作为续写起点')
      return
    }
    setIsAiBusy(true)
    announce('开始 AI 续写')
    try {
      const { result } = await continueText(srcText)
      if (!result || !result.trim()) {
        showToast('error', 'AI 未返回续写内容')
        return
      }
      // 新增一个 dialogue 节点在源节点下方，并生成一条从源节点到新节点的边
      const basePos = src?.position ? { x: src.position.x, y: src.position.y + 160 } : { x: 400, y: 100 }
      const id = `dialogue-${Date.now()}-ai`
      const newNode: StoryNode = {
        id,
        type: 'dialogue',
        position: basePos,
        data: {
          characterId: '',
          text: result.trim(),
          emotion: '',
          spritePosition: 'center',
          textAnimation: 'typewriter',
        },
      }
      setNodes((nds) => [...nds, newNode])
      if (src) {
        const newEdge: StoryEdge = {
          id: `ai-edge-${Date.now()}`,
          source: src.id,
          target: id,
          label: 'AI 续写',
        }
        setEdges((eds) => [...eds, newEdge])
      }
      setSelectedNodeIds([id])
      pushHistory('BATCH', 'AI 续写节点')
      showToast('success', 'AI 续写完成，已为你追加新节点')
      announce('AI 续写完成')
      setTimeout(() => {
        fitView?.({ padding: 0.35, duration: 500, nodes: [{ id }] })
      }, 120)
    } catch (err: any) {
      showToast('error', `AI 续写失败：${err?.message || '未知错误'}`)
    } finally {
      setIsAiBusy(false)
    }
  }, [isAiBusy, selectedNode, extractNodeText, setNodes, setEdges, pushHistory, announce, fitView])

  const handleAiPolish = useCallback(async () => {
    if (isAiBusy || !requireAiConfig()) return
    const src = selectedNode
    const srcText = extractNodeText(src)
    if (!srcText) {
      showToast('error', '请先选中一个有内容的节点再润色')
      return
    }
    const targetNode = src!
    setIsAiBusy(true)
    announce('开始润色节点文案')
    try {
      const { result } = await polishText(srcText)
      if (!result || !result.trim()) {
        showToast('error', 'AI 未返回润色结果')
        return
      }
      const polished = result.trim()
      updateNodeData(targetNode.id, {
        narration: undefined as any,
        content: undefined as any,
        label: undefined as any,
        options: undefined as any,
        text: polished,
      })
      showToast('success', '节点文案已润色')
      announce('润色完成')
    } catch (err: any) {
      showToast('error', `润色失败：${err?.message || '未知错误'}`)
    } finally {
      setIsAiBusy(false)
    }
  }, [isAiBusy, selectedNode, extractNodeText, updateNodeData, announce])

  // random 节点自带编辑控件，需要受控更新回调（入历史栈 + 触发 graph 重算）
  const nodeTypes = useMemo(() => ({
    ...baseNodeTypes,
    random: withAnnotationMarker((props: NodeProps) => (
      <RandomNode {...props} onUpdateNode={updateNodeData} />
    )),
  }), [updateNodeData])

  const handleReplaceNode = useCallback((nodeId: string, data: Partial<StoryNode['data']>) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n))
    )
    pushHistory('UPDATE_NODE', '查找替换')
  }, [setNodes, pushHistory])

  const updateEdgeData = useCallback((edgeId: string, data: Partial<StoryEdge>) => {
    setEdges((eds) =>
      eds.map((e) =>
        e.id === edgeId
          ? ({
              ...e,
              ...data,
              data: { ...(e.data || {}), ...(data.data || {}) },
            } as StoryEdge)
          : e
      )
    )
    throttledPushHistory('UPDATE_EDGE', '修改连线属性')
  }, [setEdges, throttledPushHistory])

  const deleteNode = useCallback((nodeId: string) => {
    const nodeType = nodes.find(n => n.id === nodeId)?.type
    setNodes((nds) => nds.filter((n) => n.id !== nodeId))
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
    setSelectedNodeIds((ids) => ids.filter((id) => id !== nodeId))
    cleanupOrphanRefs([nodeId])
    // 单删同样清理关联批注（此前仅批量删除清理）
    const wid = workId || 'default'
    storeDeleteAnnotationsByNode(wid, nodeId)
    setAnnotations(loadAnnotations(wid))
    pushHistory('DELETE_NODE', `删除 ${nodeTypeLabels[nodeType || ''] || '节点'}`)
    showToast('info', `${nodeTypeLabels[nodeType || ''] || '节点'}已删除`)
    announce(`${nodeTypeLabels[nodeType || ''] || '节点'}已删除`)
  }, [nodes, setNodes, setEdges, pushHistory, announce, cleanupOrphanRefs, workId, setAnnotations])

  const saveGraph = useCallback(() => {
    // 通过 ref 调用最新的 onSave，保持 saveGraph 引用稳定：
    // 若直接依赖 onSave（每次父组件渲染都是新引用），卸载 effect 会因
    // onSave 变化反复重启并触发保存 → 保存 → setState → 重渲染 → 重启，
    // 造成海量 saveWork 事务堆积（曾实测数万个 pending 事务挂起）。
    onSaveRef.current(graphRef.current)
  }, [])

  const handleSave = useCallback(() => {
    saveGraph()
    // 手动保存成功后清掉自动保存与崩溃恢复快照（无需再恢复）
    autoSaveRef.current?.clearAll()
    createRecoveryManager().clearEditorState()
    // ADHD 适配：长反馈开启时 toast 停留更久（6000ms）
    showToast('success', '作品已保存', { duration: longFeedback ? 6000 : undefined })
    announce('作品已保存')
  }, [saveGraph, announce, longFeedback])

  // 窗口关闭前与组件卸载时立即保存，避免防抖导致的数据丢失
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveGraph()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      saveGraph()
    }
  }, [saveGraph])

  // ADHD 适配：定时自动保存（30s 周期，崩溃后可恢复）+ 崩溃恢复检测
  useEffect(() => {
    const autoSave = createAutoSaveManager({
      // 复用性能模式配置：normal 30s / large 60s / huge 120s
      interval: PERFORMANCE_CONFIG[getPerformanceMode(nodes.length)].autoSaveInterval,
      maxSnapshots: 3,
    })
    autoSave.start(
      () => {
        const g = graphRef.current
        return {
          nodes: g.nodes,
          edges: g.edges,
          characters: g.characters,
          scenes: g.scenes || [],
          audios: g.audios || [],
          variables: g.variables || [],
          title: g.title,
          tags: g.settings?.tags || [],
          timestamp: Date.now(),
        }
      },
      () => {
        if (longFeedback) announce('已自动保存')
      }
    )
    autoSaveRef.current = autoSave

    // 崩溃恢复：检测上次非正常退出留下的未保存状态
    const recovery = createRecoveryManager()
    const state = recovery.getEditorState()
    if (state && Date.now() - state.timestamp < 24 * 60 * 60 * 1000) {
      setRecoveryInfo({ time: state.timestamp })
    }

    return () => {
      autoSave.stop()
      autoSave.clearAll()
    }
    // 挂载时执行一次；性能模式的间隔随节点规模在下次挂载更新
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSaveVersion = useCallback(
    (name: string, description: string) => {
      const snapshot = buildSnapshot()
      saveVersion(name, description, snapshot)
      setVersions(loadVersions())
      showToast('success', `版本「${name}」已保存`)
    },
    [buildSnapshot]
  )

  const handleRestoreVersion = useCallback(
    (id: string) => {
      const restored = restoreVersion(id)
      if (!restored) {
        showToast('error', '版本不存在或已被删除')
        return
      }
      const graphData = restored.graph
      // 替换全部图数据
      setNodes(graphData.nodes as StoryNode[])
      setEdges(graphData.edges as StoryEdge[])
      setGroups(graphData.groups as NodeGroup[])
      setCharacters(graphData.characters as StoryCharacter[])
      setVariables(graphData.variables as import('@editor/types/editor').StoryVariable[])
      scenesRef.current = graphData.scenes as ComicScene[]
      audioRef.current = graphData.audios as ComicAudio[]
      setSelectedNodeIds([])
      setSelectedEdgeId(null)
      setSelectedGroupId(null)
      // 版本快照含批注与付费配置时一并恢复
      if (graphData.annotations) {
        setAnnotations(graphData.annotations as NodeAnnotation[])
      }
      if (graphData.monetization !== undefined) {
        setMonetization((graphData.monetization as MonetizationConfig | null) ?? null)
      }
      // 推入历史记录以支持撤销
      pushHistory('BATCH', `恢复版本「${restored.name}」`)
      showToast('success', `已恢复到版本「${restored.name}」`)
    },
    [setNodes, setEdges, setGroups, setCharacters, setVariables, pushHistory]
  )

  const handleDeleteVersion = useCallback((id: string) => {
    const remaining = deleteVersionFromStore(id)
    setVersions(remaining)
    showToast('info', '版本已删除')
  }, [])

  const handleImportTranslation = useCallback(
    (newGraph: StoryGraph) => {
      setNodes(newGraph.nodes as StoryNode[])
      setEdges(newGraph.edges as StoryEdge[])
      setGroups(newGraph.groups as NodeGroup[])
      setCharacters(newGraph.characters as StoryCharacter[])
      setVariables(newGraph.variables as import('@editor/types/editor').StoryVariable[])
      if (newGraph.scenes) {
        scenesRef.current = newGraph.scenes as ComicScene[]
      }
      if (newGraph.audios) {
        audioRef.current = newGraph.audios as ComicAudio[]
      }
      setSelectedNodeIds([])
      setSelectedEdgeId(null)
      setSelectedGroupId(null)
      pushHistory('BATCH', '导入翻译表')
      showToast('success', '翻译表导入成功')
    },
    [setNodes, setEdges, setGroups, setCharacters, setVariables, pushHistory]
  )

  const addCharacter = useCallback((character: StoryCharacter) => {
    setCharacters((prev) => [...prev, character])
    pushHistory('ADD_CHARACTER', `新增角色「${character.name}」`)
    showToast('success', `角色「${character.name}」已添加`)
  }, [setCharacters, pushHistory])

  const updateCharacter = useCallback((character: StoryCharacter) => {
    setCharacters((prev) => prev.map((c) => (c.id === character.id ? character : c)))
    pushHistory('UPDATE_CHARACTER', `编辑角色「${character.name}」`)
    showToast('success', `角色「${character.name}」已更新`)
  }, [setCharacters, pushHistory])

  const deleteCharacter = useCallback((characterId: string) => {
    const char = characters.find(c => c.id === characterId)
    setCharacters((prev) => prev.filter((c) => c.id !== characterId))
    pushHistory('DELETE_CHARACTER', `删除角色「${char?.name || ''}」`)
    showToast('info', `角色「${char?.name || ''}」已删除`)
  }, [characters, setCharacters, pushHistory])

  // 素材库：插入素材到当前选中节点
  // - 背景图 → 设置到节点的 backgroundImage 字段
  // - 角色立绘 → 添加到当前对话节点所绑定角色的 sprites 列表
  // - 音效 → 设置到节点的 bgm 字段（若有URL）
  const handleInsertAsset = useCallback((asset: LibraryAsset) => {
    if (!selectedNode) {
      showToast('info', '请先在画布上选中一个节点')
      return
    }

    if (asset.category === 'background') {
      updateNodeData(selectedNode.id, { backgroundImage: asset.fullUrl })
      pushHistory('UPDATE_NODE', `插入背景图「${asset.name}」`)
      showToast('success', `已将「${asset.name}」设为背景图`)
      return
    }

    if (asset.category === 'character') {
      const characterId = (selectedNode.data as Record<string, unknown>)?.characterId as string | undefined
      if (!characterId) {
        showToast('info', '请选中一个已绑定角色的对话节点')
        return
      }
      const targetChar = characters.find((c) => c.id === characterId)
      if (!targetChar) {
        showToast('info', '未找到对应角色')
        return
      }
      const newSprite: CharacterSprite = {
        emotion: 'normal',
        url: asset.fullUrl,
        name: asset.name,
        position: 'center',
      }
      updateCharacter({
        ...targetChar,
        sprites: [...(targetChar.sprites || []), newSprite],
      })
      showToast('success', `已将「${asset.name}」添加为角色「${targetChar.name}」的立绘`)
      return
    }

    if (asset.category === 'audio') {
      if (!asset.fullUrl) {
        showToast('info', `「${asset.name}」需自行上传音频文件`)
        return
      }
      updateNodeData(selectedNode.id, { bgm: asset.fullUrl })
      pushHistory('UPDATE_NODE', `插入音频「${asset.name}」`)
      showToast('success', `已将「${asset.name}」设为背景音乐`)
      return
    }

    // 其他类型素材暂不支持直接插入
    showToast('info', `暂不支持插入「${asset.name}」类型的素材`)
  }, [selectedNode, characters, updateNodeData, updateCharacter, pushHistory])

  // 计算完成度
  const hasEnding = nodes.some((n) => n.type === 'ending')
  const hasDialogue = nodes.some((n) => n.type === 'dialogue')
  const hasChoices = nodes.some((n) => n.type === 'choice')
  const completionPercent = Math.min(
    100,
    Math.round(
      (Number(hasDialogue) * 25 + Number(hasChoices) * 25 + Number(hasEnding) * 25 + Math.min(edges.length * 5, 25))
    )
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDraggingOver(false)
  }, [])

  const alignmentEnabled = nodes.length <= 200

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    // 过滤掉 group 节点的变化（group 节点有自己的拖拽处理）
    const filteredChanges = changes.filter((change) => {
      if ('id' in change && change.id?.startsWith('group-')) {
        return false
      }
      return true
    })

    // select 状态由我们自己管理，不传给 React Flow
    const meaningfulChanges = filteredChanges.filter((c) => c.type !== 'select')

    if (meaningfulChanges.length === 0) return

    // 使用 React Flow 官方的 applyNodeChanges，内部对 position 变化做了优化
    // 避免 setNodes 内部的 result.map() 重建整个 nodes 数组导致 useMemo 缓存失效
    setNodes((nds) => applyNodeChanges(meaningfulChanges, nds) as StoryNode[])
  }, [setNodes])

  const handleNodeDrag = useCallback((event: MouseEvent | TouchEvent, node: Node, nodes: Node[]) => {
    alignmentLinesRef.current?.handleNodeDrag(event, node, nodes)
    handleGroupNodeDrag(event, node, nodes)
  }, [handleGroupNodeDrag])

  const handleNodeDragStop = useCallback((_event: unknown, node?: Node) => {
    alignmentLinesRef.current?.handleNodeDragStop()
    // 仅分组节点拖拽属于「移动分组」；普通节点此前也被标记为移动分组，
    // 导致历史描述错乱
    if (node?.type === 'group') {
      throttledPushHistory('UPDATE_GROUP', '移动分组')
    } else {
      throttledPushHistory('UPDATE_NODE', '移动节点')
    }
  }, [throttledPushHistory])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingOver(false)

    const templateData = e.dataTransfer.getData('application/subsilicon-template')
    if (templateData) {
      try {
        const template = JSON.parse(templateData) as NodeTemplate
        const position = screenToFlowPosition({
          x: e.clientX,
          y: e.clientY,
        })
        insertTemplate(template, position.x, position.y)
        return
      } catch {
        // 解析失败，继续尝试其他类型
      }
    }

    const type = e.dataTransfer.getData('application/reactflow')
    if (!type) return

    const position = screenToFlowPosition({
      x: e.clientX,
      y: e.clientY,
    })

    const id = generateNodeId(type)
    const data = createNodeData(type)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__subsilicon_drop_node = { id, type, position, data }
    window.dispatchEvent(new CustomEvent('subsilicon-node-drop'))
  }, [screenToFlowPosition, insertTemplate])

  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (node.type === 'group') {
      if (event.shiftKey) {
        setSelectedNodeIds((prev) =>
          prev.includes(node.id)
            ? prev.filter((id) => id !== node.id)
            : [...prev, node.id]
        )
      } else {
        setSelectedNodeIds([node.id])
        setSelectedGroupId(node.id)
      }
      setSelectedEdgeId(null)
      return
    }

    if (event.shiftKey) {
      setSelectedNodeIds((prev) =>
        prev.includes(node.id)
          ? prev.filter((id) => id !== node.id)
          : [...prev, node.id]
      )
    } else {
      setSelectedNodeIds([node.id])
      setSelectedGroupId(null)
    }
    setSelectedEdgeId(null)
  }, [])

  // 双击节点：聚焦到节点并打开属性面板
  const handleNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.type === 'group') return
    setSelectedNodeIds([node.id])
    setSelectedGroupId(null)
    setSelectedEdgeId(null)
    setRightPanelTab('properties')
    // 聚焦到节点位置
    fitView({
      nodes: [{ id: node.id }],
      padding: 0.3,
      duration: 400,
    })
  }, [fitView])

  const handleEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id)
    setSelectedNodeIds([])
  }, [])

  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    if (node.type === 'group') return
    event.preventDefault()
    setSelectedNodeIds([node.id])
    setSelectedGroupId(null)
    setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id })
  }, [])

  const handlePaneClick = useCallback(() => {
    setSelectedNodeIds([])
    setSelectedEdgeId(null)
    setSelectedGroupId(null)
    setContextMenu(null)
  }, [])

  const handleSelectionChange = useCallback(({ nodes: selNodes, edges: selEdges }: { nodes: Node[]; edges: Edge[] }) => {
    if (selNodes.length > 0) {
      setSelectedNodeIds(selNodes.map((n) => n.id))
      setSelectedEdgeId(null)
    } else if (selEdges.length > 0) {
      setSelectedEdgeId(selEdges[0].id)
      setSelectedNodeIds([])
    }
  }, [])

  const handleNodeSelect = useCallback((id: string) => {
    setSelectedNodeIds([id])
    const node = nodes.find((n) => n.id === id)
    if (node) {
      fitView({
        nodes: [{ id }],
        padding: 0.2,
        duration: 300,
      })
    }
  }, [nodes, fitView])

  const handleEdgeSelect = useCallback((id: string) => {
    setSelectedEdgeId(id)
    setSelectedNodeIds([])
  }, [])

  const handleScenesChange = useCallback((newScenes: ComicScene[]) => {
    scenesRef.current = newScenes
    // 触发 graph 重算，确保保存/预览/导出使用最新场景数据
    setScenesVersion((v) => v + 1)
    // 场景编辑入历史栈，避免 undo 静默回滚未记录的场景变更
    pushHistory('UPDATE_SCENE', '更新场景')
  }, [pushHistory])

  const handleAudiosChange = useCallback((newAudios: ComicAudio[]) => {
    audioRef.current = newAudios
    // 触发 graph 重算，确保保存/预览/导出使用最新音频数据
    setAudiosVersion((v) => v + 1)
    // 音频编辑入历史栈，避免 undo 静默回滚未记录的音频变更
    pushHistory('UPDATE_AUDIO', '更新音频')
  }, [pushHistory])

  const handleVariablesChange = useCallback((newVariables: import('@editor/types/editor').StoryVariable[]) => {
    setVariables(newVariables)
    pushHistory('UPDATE_VARIABLES', '编辑变量')
  }, [setVariables, pushHistory])

  const handleCloseNodeSearch = useCallback(() => {
    setShowNodeSearch(false)
  }, [])

  const handleStartTour = useCallback(() => {
    onStartTour?.()
  }, [onStartTour])

  // AI 浮动面板切换
  const handleToggleAiPanel = useCallback(() => {
    setAiPanelMode(aiPanelMode === 'hidden' ? 'floating' : 'hidden')
  }, [aiPanelMode, setAiPanelMode])

  // AiChatPanel 共享元素 —— 右侧栏和浮动面板复用同一实例的 props 配置
  const aiChatPanelElement = (
    <AiChatPanel
      nodes={nodes as StoryNode[]}
      edges={edges as StoryEdge[]}
      characters={characters}
      scenes={scenesRef.current}
      variables={variables}
      onUpdateNode={updateNodeData}
      onDeleteNode={deleteNode}
      onUpdateEdge={updateEdgeData}
      onDeleteEdge={handleDeleteEdge}
      onAddNode={(type, position, data) => {
        const id = generateNodeId(type)
        const newNode = {
          id,
          type: type as StoryNode['type'],
          position,
          data: { ...createNodeData(type), ...data } as StoryNode['data'],
        }
        setNodes((nds) => [...nds, newNode as StoryNode])
        setSelectedNodeIds([id])
        pushHistory('ADD_NODE', `AI 对话添加 ${type} 节点`)
        return id
      }}
      onAddEdge={(source, target) => {
        const connection = { source, target, sourceHandle: null, targetHandle: null }
        let edgeId = ''
        setEdges((eds) => {
          const newEdges = addEdge(connection, eds)
          edgeId = newEdges[newEdges.length - 1]?.id || ''
          return newEdges as StoryEdge[]
        })
        pushHistory('ADD_EDGE', `AI 对话连接 ${source} → ${target}`)
        return edgeId
      }}
      onNodeSelect={handleNodeSelect}
      onAddCharacter={(char) => {
        addCharacter(char)
        showToast('success', `角色「${char.name}」已创建`)
      }}
      onUpdateCharacter={(characterId, data) => {
        const existing = characters.find((c) => c.id === characterId)
        if (!existing) return
        updateCharacter({ ...existing, ...data, id: characterId })
      }}
      onDeleteCharacter={(characterId) => {
        deleteCharacter(characterId)
      }}
      onRenameWork={(t) => {
        setTitle(t)
        pushHistory('UPDATE_TITLE', `作品重命名为「${t}」`)
        showToast('success', `作品已重命名为「${t}」`)
      }}
      onAddVariable={(variable) => {
        setVariables((prev) => [...prev, variable])
        pushHistory('UPDATE_VARIABLES', `新增变量「${variable.name}」`)
        showToast('success', `变量「${variable.name}」已创建`)
      }}
      onUpdateVariable={(variableId, data) => {
        setVariables((prev) => prev.map((v) => (v.id === variableId ? { ...v, ...data, id: variableId } : v)))
        pushHistory('UPDATE_VARIABLES', `修改变量 ${variableId}`)
        showToast('success', '变量已更新')
      }}
      onDeleteVariable={(variableId) => {
        setVariables((prev) => prev.filter((v) => v.id !== variableId))
        pushHistory('UPDATE_VARIABLES', `删除变量 ${variableId}`)
        showToast('info', '变量已删除')
      }}
      onBindAsset={async (nodeId, assetHash, usageType) => {
        try {
          const { getAllAssets } = await import('@editor/lib/local-db')
          const all = await getAllAssets()
          const asset = all.find((a) => a.hash.startsWith(assetHash) || a.hash === assetHash)
          if (!asset) return false
          const url = URL.createObjectURL(asset.blob)
          const node = nodes.find((n) => n.id === nodeId) as StoryNode | undefined
          if (!node) return false
          const ann = asset.annotation
          const ut = usageType || ann?.usageType
          if (ut === 'background' || (!ut && asset.type.startsWith('image/') && node.type === 'narration')) {
            updateNodeData(nodeId, { backgroundImage: url })
          } else if (ut === 'cg' || (!ut && node.type === 'cg')) {
            updateNodeData(nodeId, {
              url,
              mediaType: asset.type.startsWith('video/') ? 'video' : 'image',
            } as Record<string, unknown>)
          } else if (asset.type.startsWith('audio/')) {
            updateNodeData(nodeId, { bgm: url } as Record<string, unknown>)
          } else {
            updateNodeData(nodeId, { backgroundImage: url } as Record<string, unknown>)
          }
          pushHistory('UPDATE_NODE', `AI 对话绑定素材到 ${nodeId}`)
          showToast('success', `素材「${asset.name}」已绑定到节点`)
          return true
        } catch {
          return false
        }
      }}
      onSaveWork={() => {
        saveGraph()
        showToast('success', '作品已保存')
      }}
      onExportWork={() => setShowExportDialog(true)}
      onPreviewWork={() => setShowPreview(true)}
      onUndo={undo}
      onRedo={redo}
      // act-along 模式：AI 动作执行前打批次检查点 + 提供「回滚 AI 操作」
      onMarkAiBatch={markAiBatchBoundary}
      onRollbackAiBatch={undoToAiBatchBoundary}
      workId={workId}
    />
  )

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* ADHD 适配：崩溃恢复横幅（检测到上次未保存的编辑时显示） */}
      {recoveryInfo && (
        <RecoveryBanner
          time={recoveryInfo.time}
          onRestore={() => {
            const recovery = createRecoveryManager()
            const state = recovery.getEditorState()
            if (state) {
              setNodes(state.nodes as StoryNode[])
              setEdges(state.edges as StoryEdge[])
              setCharacters(state.characters as StoryCharacter[])
              setVariables(state.variables as import('@editor/types/editor').StoryVariable[])
              setTitle(state.title)
              setTags(state.tags)
              scenesRef.current = state.scenes as ComicScene[]
              setScenesVersion((v) => v + 1)
              audioRef.current = state.audios as ComicAudio[]
              setAudiosVersion((v) => v + 1)
              recovery.clearEditorState()
              autoSaveRef.current?.clearAll()
              setRecoveryInfo(null)
              showToast('success', '已恢复上次未保存的编辑')
              announce('已恢复上次未保存的编辑')
            }
          }}
          onDiscard={() => {
            createRecoveryManager().clearEditorState()
            setRecoveryInfo(null)
          }}
        />
      )}

      {/* Top Toolbar */}
      <TopToolbar
        title={title}
        canUndo={historyState.canUndo}
        canRedo={historyState.canRedo}
        onUndo={undo}
        onRedo={redo}
        onSave={handleSave}
        onPreview={() => setShowPreview(true)}
        onExport={() => setShowExportDialog(true)}
        onToggleAiPanel={handleToggleAiPanel}
        aiPanelVisible={aiPanelMode !== 'hidden'}
        onAiOutline={() => { void handleAiOutline() }}
        onAiContinue={() => { void handleAiContinue() }}
        onAiPolish={() => { void handleAiPolish() }}
        isAiBusy={isAiBusy}
        onToggleFocusMode={() => {
          toggleFocusMode()
          announce(focusMode ? '专注模式已退出' : '专注模式已开启，已隐藏所有面板')
        }}
        focusMode={focusMode}
        onBack={onBack}
      />

      {/* Main content area: Activity Bars + Canvas */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Activity Bar（专注模式隐藏图标栏，保留纯画布） */}
        {!focusMode && (
          <ActivityBar
            side="left"
            items={LEFT_ACTIVITY_ITEMS}
            activeItem={activeLeftActivity}
            onItemClick={setActiveLeftActivity}
            bottomItems={LEFT_BOTTOM_ITEMS}
          />
        )}

        {/* Left panel overlay (when activity item active) */}
        {activeLeftActivity && (
          <div
            className="absolute left-11 top-0 bottom-0 z-30 w-64 border-r border-border bg-card shadow-lg overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-3 py-2 shrink-0">
              <span className="text-xs font-semibold text-foreground">
                {[...LEFT_ACTIVITY_ITEMS, ...LEFT_BOTTOM_ITEMS].find((i) => i.id === activeLeftActivity)?.label}
              </span>
              <button
                onClick={() => setActiveLeftActivity(null)}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {activeLeftActivity === 'nodes' && (
                <EditorSidebar
                  onQuickAdd={addNodeAtCenter}
                  outline={outlineText}
                  onOutlineChange={setOutlineText}
                  selectedNodes={selectedNodes}
                  selectedEdges={edges.filter(
                    (e) => selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target)
                  ) as StoryEdge[]}
                  selectedNode={selectedNode || null}
                  onInsertTemplate={insertTemplate}
                  onGenerateNodesFromOutline={handleGenerateNodesFromOutline}
                  onGenerateOutlineFromNodes={handleGenerateOutlineFromNodes}
                  onInsertAsset={handleInsertAsset}
                  characters={characters}
                />
              )}
              {activeLeftActivity === 'assets' && (
                <AssetLibraryPanel
                  selectedNode={selectedNode || null}
                  onInsertAsset={handleInsertAsset}
                  characters={characters}
                  initialCategory={assetCategory}
                />
              )}
              {activeLeftActivity === 'search' && (
                <NodeSearch
                  nodes={nodes as StoryNode[]}
                  characters={characters}
                  open={true}
                  onClose={() => setActiveLeftActivity(null)}
                  onReplaceNode={handleReplaceNode}
                />
              )}
              {activeLeftActivity === 'settings' && (
                <div className="p-3 space-y-2">
                  <button
                    onClick={() => { setShowAiSettings(true); setActiveLeftActivity(null) }}
                    className="w-full text-left text-xs text-foreground hover:bg-muted rounded px-2 py-1.5 transition-colors"
                  >
                    {assistantName}（AI）设置
                  </button>
                  <button
                    onClick={() => { setShowShortcutsModal(true); setActiveLeftActivity(null) }}
                    className="w-full text-left text-xs text-foreground hover:bg-muted rounded px-2 py-1.5 transition-colors"
                  >
                    快捷键说明
                  </button>
                  <button
                    onClick={() => { onStartTour?.(); setActiveLeftActivity(null) }}
                    className="w-full text-left text-xs text-foreground hover:bg-muted rounded px-2 py-1.5 transition-colors"
                  >
                    新手引导
                  </button>
                </div>
              )}
              {activeLeftActivity === 'account' && (
                <div className="p-3 space-y-2">
                  <button
                    onClick={() => { setShowCreatorCenter(true); setCreatorCenterTab('account'); setActiveLeftActivity(null) }}
                    className="w-full text-left text-xs text-foreground hover:bg-muted rounded px-2 py-1.5 transition-colors"
                  >
                    创作者中心
                  </button>
                  <button
                    onClick={() => { setShowCreatorCenter(true); setCreatorCenterTab('publish'); setActiveLeftActivity(null) }}
                    className="w-full text-left text-xs text-foreground hover:bg-muted rounded px-2 py-1.5 transition-colors"
                  >
                    发布管理
                  </button>
                  <button
                    onClick={() => { setShowCreatorCenter(true); setCreatorCenterTab('platforms'); setActiveLeftActivity(null) }}
                    className="w-full text-left text-xs text-foreground hover:bg-muted rounded px-2 py-1.5 transition-colors"
                  >
                    平台绑定
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Canvas - main work area */}
        <div
          ref={canvasRef}
          role="region"
          aria-label="故事节点编辑器画布"
          className="flex-1 relative min-w-0 bg-background overflow-hidden"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onContextMenu={(e) => {
            if (e.target === e.currentTarget) e.preventDefault()
          }}
          onClick={() => {
            // Auto-close floating AI panel when clicking canvas
            if (aiPanelMode === 'floating') {
              setAiPanelMode('hidden')
            }
          }}
        >
          <AnnotationMarkerProvider value={annotationContextValue}>
            <ReactFlow
              nodes={visibleNodes}
              edges={edges}
              onNodesChange={handleNodesChange as any}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeDrag={handleNodeDrag}
              onNodeDragStop={handleNodeDragStop}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodeClick={handleNodeClick}
              onNodeDoubleClick={handleNodeDoubleClick}
              onEdgeClick={handleEdgeClick}
              onPaneClick={handlePaneClick}
              onSelectionChange={handleSelectionChange}
              onNodeContextMenu={handleNodeContextMenu}
              selectionOnDrag={perfConfig.selectNodesOnDrag}
              multiSelectionKeyCode={['Shift']}
              defaultViewport={{ x: 0, y: 0, zoom: 1 }}
              minZoom={0.15}
              maxZoom={2.5}
              fitView={false}
              nodesDraggable={true}
              nodesConnectable={true}
              elementsSelectable={true}
              panOnDrag={perfConfig.panOnDrag}
              selectNodesOnDrag={perfConfig.selectNodesOnDrag}
              elevateEdgesOnSelect={perfConfig.elevateEdgesOnSelect}
              elevateNodesOnSelect={perfConfig.elevateNodesOnSelect}
              deleteKeyCode={null}
              className={isEmpty ? 'opacity-0 pointer-events-none' : ''}
              onlyRenderVisibleElements={true}
              panOnScroll={true}
              zoomOnScroll={true}
              zoomOnPinch={true}
              zoomOnDoubleClick={true}
            >
              <Background gap={12} size={1} />
              <Controls showZoom={true} showFitView={true} showInteractive={false} />
              {alignmentEnabled && (
                <AlignmentLines ref={alignmentLinesRef} enabled={alignmentEnabled} />
              )}
              {/* 专注模式隐藏小地图，减少视觉干扰 */}
              {perfConfig.miniMapVisible && !focusMode && (
                <MiniMap
                  className="!bg-card !border !border-border"
                  nodeStrokeWidth={3}
                  pannable={perfConfig.miniMapPannable}
                  zoomable={perfConfig.miniMapZoomable}
                  maskColor="rgba(0,0,0,0.08)"
                  style={{ width: 200, height: 150 }}
                />
              )}
            </ReactFlow>
          </AnnotationMarkerProvider>

          {/* Context menu */}
          {contextMenu && (
            <NodeContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              nodeId={contextMenu.nodeId}
              annotationCount={annotationsMap.get(contextMenu.nodeId)?.length || 0}
              onAddAnnotation={() => {
                setAnnotationDialog({ nodeId: contextMenu.nodeId })
                setContextMenu(null)
              }}
              onViewAnnotations={() => {
                setSelectedNodeIds([contextMenu.nodeId])
                setRightPanelTab('annotations')
                setContextMenu(null)
              }}
              onClose={() => setContextMenu(null)}
            />
          )}

          {/* Annotation dialog */}
          {annotationDialog && (
            <AnnotationDialog
              nodeId={annotationDialog.nodeId}
              defaultAuthor={annotationAuthor}
              onSubmit={handleAddAnnotation}
              onClose={() => setAnnotationDialog(null)}
            />
          )}

          {/* Empty canvas guide */}
          {isEmpty && (
            <EmptyCanvasGuide
              onQuickAdd={addNodeAtCenter}
              onStartTour={handleStartTour}
            />
          )}

          {/* Drag overlay */}
          {isDraggingOver && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
              <div className="bg-primary/90 text-primary-foreground px-6 py-3 rounded-xl shadow-lg text-sm font-medium">
                释放以添加节点
              </div>
            </div>
          )}

          {/* Bottom status bar */}
          {!isEmpty && (
            <StatusBar
              nodeCount={nodes.length}
              edgeCount={edges.length}
              completionPercent={completionPercent}
              onStatsClick={() => setActiveRightActivity('stats')}
            />
          )}
        </div>

        {/* Right Activity Bar（专注模式隐藏图标栏，保留纯画布） */}
        {!focusMode && (
          <ActivityBar
            side="right"
            items={RIGHT_ACTIVITY_ITEMS}
            activeItem={activeRightActivity}
            onItemClick={setActiveRightActivity}
          />
        )}

        {/* Right panel overlay */}
        {activeRightActivity && (
          <div
            className="absolute right-11 top-0 bottom-0 z-30 w-72 border-l border-border bg-card shadow-lg overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-3 py-2 shrink-0">
              <span className="text-xs font-semibold text-foreground">
                {RIGHT_ACTIVITY_ITEMS.find((i) => i.id === activeRightActivity)?.label}
              </span>
              <button
                onClick={() => setActiveRightActivity(null)}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className={`flex-1 min-h-0 ${activeRightActivity === 'ai-chat' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
              {activeRightActivity === 'quality-check' && (
                <QualityCheckPanel
                  nodes={nodes as StoryNode[]}
                  edges={edges as StoryEdge[]}
                  monetization={monetization}
                  onLocateNode={(nodeId) => {
                    setSelectedNodeIds([nodeId])
                    const node = (nodes as StoryNode[]).find((n) => n.id === nodeId)
                    if (node) {
                      fitView({ nodes: [{ id: nodeId, position: node.position }], padding: 0.6, duration: 400 })
                    }
                  }}
                  onClose={() => setActiveRightActivity(null)}
                />
              )}
              {activeRightActivity === 'properties' && (
                <EditorRightPanel
                  selectedNode={selectedNode || null}
                  selectedEdge={selectedEdge || null}
                  selectedNodeCount={selectedNodeIds.length}
                  characters={characters}
                  tags={tags}
                  title={title}
                  assets={assetsRef.current}
                  variables={variables}
                  scenes={scenesRef.current}
                  audios={audioRef.current}
                  nodes={nodes as StoryNode[]}
                  edges={edges as StoryEdge[]}
                  activeTab={rightPanelTab}
                  onTabChange={setRightPanelTab}
                  onUpdateNode={updateNodeData}
                  onDeleteNode={deleteNode}
                  onUpdateEdge={updateEdgeData}
                  onDeleteEdge={handleDeleteEdge}
                  onAddCharacter={addCharacter}
                  onUpdateCharacter={updateCharacter}
                  onDeleteCharacter={deleteCharacter}
                  onUpdateTitle={setTitle}
                  onUpdateTags={setTags}
                  onUpdateVariables={handleVariablesChange}
                  onNodeSelect={handleNodeSelect}
                  onEdgeSelect={handleEdgeSelect}
                  onScenesChange={handleScenesChange}
                  onAudiosChange={handleAudiosChange}
                  onOpenAssets={handleOpenAssets}
                  versions={versions}
                  currentGraph={buildSnapshot()}
                  onSaveVersion={handleSaveVersion}
                  onRestoreVersion={handleRestoreVersion}
                  onDeleteVersion={handleDeleteVersion}
                  annotations={annotations}
                  annotationAuthor={annotationAuthor}
                  onAddAnnotation={handleAddAnnotation}
                  onResolveAnnotation={handleResolveAnnotation}
                  onReplyAnnotation={handleReplyAnnotation}
                  onDeleteAnnotation={handleDeleteAnnotation}
                  onOpenAnnotationDialog={(nodeId) => setAnnotationDialog({ nodeId })}
                  graph={graph}
                  workId={workId}
                  onApplyStory={(newNodes, newEdges, newChars, newTitle) => {
                    setNodes(newNodes)
                    setEdges(newEdges)
                    setCharacters(newChars)
                    setTitle(newTitle)
                    setSelectedNodeIds(newNodes.map((n) => n.id))
                    pushHistory('BATCH', `应用创作助理生成故事「${newTitle}」`)
                    showToast('success', `故事「${newTitle}」已应用到画布`)
                    setTimeout(() => {
                      fitView({ padding: 0.3, duration: 500 })
                    }, 100)
                  }}
                  onAddCharacters={(newChars) => {
                    newChars.forEach((char) => addCharacter(char))
                  }}
                  onAddNode={(type, position, data) => {
                    const id = generateNodeId(type)
                    const newNode = {
                      id,
                      type: type as StoryNode['type'],
                      position,
                      data: { ...createNodeData(type), ...data } as StoryNode['data'],
                    }
                    setNodes((nds) => [...nds, newNode as StoryNode])
                    setSelectedNodeIds([id])
                    pushHistory('ADD_NODE', `创作助理添加 ${nodeTypeLabels[type] || type} 节点`)
                    return id
                  }}
                  onAddEdge={(source, target) => {
                    const connection = { source, target, sourceHandle: null, targetHandle: null }
                    let edgeId = ''
                    setEdges((eds) => {
                      const newEdges = addEdge(connection, eds)
                      edgeId = newEdges[newEdges.length - 1]?.id || ''
                      return newEdges as StoryEdge[]
                    })
                    pushHistory('ADD_EDGE', '创作助理创建连线')
                    return edgeId
                  }}
                />
              )}
              {activeRightActivity === 'versions' && (
                <VersionPanel
                  versions={versions}
                  currentGraph={{ nodes, edges, characters, scenes: scenesRef.current, audios: audioRef.current, variables, groups: [] }}
                  onSaveVersion={handleSaveVersion}
                  onRestoreVersion={handleRestoreVersion}
                  onDeleteVersion={handleDeleteVersion}
                />
              )}
              {activeRightActivity === 'ai-chat' && (
                aiChatPanelElement
              )}
              {activeRightActivity === 'stats' && (
                <MemoizedWritingStatsPanel
                  workId={workId || 'default'}
                  nodeCount={nodes.length}
                  wordCount={nodes.reduce((acc, node) => {
                    const data = node.data as Record<string, unknown> | undefined
                    if (!data) return acc
                    let count = 0
                    if (typeof data.text === 'string') count += data.text.length
                    if (typeof data.prompt === 'string') count += data.prompt.length
                    if (typeof data.title === 'string') count += data.title.length
                    if (Array.isArray(data.options)) {
                      for (const opt of data.options) {
                        if (opt && typeof opt === 'object') {
                          const optObj = opt as Record<string, unknown>
                          if (typeof optObj.text === 'string') count += optObj.text.length
                        }
                      }
                    }
                    return acc + count
                  }, 0)}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* AI Floating Button + Flyout */}
      <AiFloatingButton
        onClick={() => setAiPanelMode(aiPanelMode === 'hidden' ? 'floating' : 'hidden')}
        isOpen={aiPanelMode !== 'hidden'}
      />
      <AiPanelFlyout
        open={aiPanelMode !== 'hidden'}
        pinned={aiPanelMode === 'pinned'}
        onClose={() => setAiPanelMode('hidden')}
        onPin={() => setAiPanelMode(aiPanelMode === 'pinned' ? 'floating' : 'pinned')}
      >
        {aiChatPanelElement}
      </AiPanelFlyout>

      {/* Modal dialogs (unchanged, keep existing) */}
      <ToastContainerPortal />
      <ExportDialog
        open={showExportDialog}
        graph={graph}
        onClose={() => setShowExportDialog(false)}
        onImportTranslation={handleImportTranslation}
        monetization={monetization}
        workType={workType}
        workId={workId}
        onMonetizationChange={setMonetization}
      />
      <StoryPreview
        graph={graph}
        open={showPreview}
        onClose={() => setShowPreview(false)}
        workId={workId}
      />
      <CreatorCenterDialog
        open={showCreatorCenter}
        onClose={() => setShowCreatorCenter(false)}
        graph={graph}
        workId={workId}
        initialTab={creatorCenterTab}
        onLoginStateChange={() => setLoginState(n => n + 1)}
      />
      <DiscoverDialog
        open={showDiscover}
        onClose={() => setShowDiscover(false)}
      />
      <ShortcutsModal
        open={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />
    </div>
  )
}

function ToastContainerPortal() {
  const { toasts, removeToast } = useToast()
  if (toasts.length === 0) return null
  return <ToastContainer toasts={toasts} removeToast={removeToast} />
}

interface StatusBarProps {
  nodeCount: number
  edgeCount: number
  completionPercent: number
  onStatsClick: () => void
}

const StatusBar = memo(function StatusBar({ nodeCount, edgeCount, completionPercent, onStatsClick }: StatusBarProps) {
  return (
    <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-card/90 backdrop-blur border rounded-lg px-4 py-1.5 shadow-sm text-xs text-muted-foreground z-10">
      <span>{nodeCount} 个节点</span>
      <span className="w-px h-3 bg-border" />
      <span>{edgeCount} 条连线</span>
      <span className="w-px h-3 bg-border" />
      <span>完成度 {completionPercent}%</span>
      <span className="w-px h-3 bg-border" />
      <button
        onClick={onStatsClick}
        className="flex items-center gap-1.5 hover:text-primary transition-colors"
        title="故事统计"
      >
        <ShieldCheck className="w-3.5 h-3.5" />
        故事统计
      </button>
      {nodeCount > 200 && (
        <>
          <span className="w-px h-3 bg-border" />
          <span className={clsx(
            nodeCount > 500 ? 'text-gold-400' : 'text-muted-foreground'
          )}>
            {nodeCount > 500
              ? '建议使用"查找节点"功能而非手动拖拽'
              : '性能优化模式'}
          </span>
        </>
      )}
    </div>
  )
})

interface NodeContextMenuProps {
  x: number
  y: number
  nodeId: string
  annotationCount: number
  onAddAnnotation: () => void
  onViewAnnotations: () => void
  onClose: () => void
}

const NodeContextMenu = memo(function NodeContextMenu({
  x,
  y,
  nodeId,
  annotationCount,
  onAddAnnotation,
  onViewAnnotations,
  onClose,
}: NodeContextMenuProps) {
  // 边界修正：避免菜单超出视窗
  const adjustedX = Math.min(x, window.innerWidth - 220)
  const adjustedY = Math.min(y, window.innerHeight - 160)

  return (
    <div
      className="fixed z-50 min-w-[200px] bg-card border border-border rounded-lg shadow-xl py-1 text-sm"
      style={{ left: adjustedX, top: adjustedY }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-b border-border">
        节点 #{nodeId.slice(0, 12)}
      </div>
      <button
        onClick={onAddAnnotation}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-foreground transition-colors"
      >
        <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
        添加批注
      </button>
      <button
        onClick={onViewAnnotations}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-foreground transition-colors"
        disabled={annotationCount === 0}
      >
        <MessageSquare className="w-3.5 h-3.5 text-purple-500" />
        查看批注
        {annotationCount > 0 && (
          <span className="ml-auto text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
            {annotationCount}
          </span>
        )}
      </button>
    </div>
  )
})

interface AnnotationDialogProps {
  nodeId: string
  defaultAuthor: string
  onSubmit: (input: { nodeId: string; type: AnnotationType; text: string; author: string }) => void
  onClose: () => void
}

const AnnotationDialog = memo(function AnnotationDialog({
  nodeId,
  defaultAuthor,
  onSubmit,
  onClose,
}: AnnotationDialogProps) {
  const [type, setType] = useState<AnnotationType>('comment')
  const [text, setText] = useState('')
  const [author, setAuthor] = useState(defaultAuthor)

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed) return
    onSubmit({ nodeId, type, text: trimmed, author: author.trim() || '匿名创作者' })
  }, [text, type, author, nodeId, onSubmit])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [handleSubmit, onClose])

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-500" />
            添加批注
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-[10px] text-muted-foreground border-b border-border pb-2">
          目标节点：#{nodeId.slice(0, 12)}
        </div>

        {/* 类型选择 */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">批注类型</label>
          <div className="grid grid-cols-4 gap-1.5">
            {([
              { type: 'comment' as const, label: '评论', color: '#3b82f6' },
              { type: 'todo' as const, label: 'TODO', color: '#eab308' },
              { type: 'warning' as const, label: '警告', color: '#ef4444' },
              { type: 'idea' as const, label: '想法', color: '#a855f7' },
            ]).map((opt) => {
              const active = type === opt.type
              return (
                <button
                  key={opt.type}
                  onClick={() => setType(opt.type)}
                  className="flex flex-col items-center gap-1 px-2 py-1.5 rounded border transition-colors"
                  style={{
                    borderColor: active ? opt.color : 'rgba(100, 116, 139, 0.3)',
                    backgroundColor: active ? `${opt.color}20` : 'transparent',
                    color: active ? opt.color : 'rgb(148, 163, 184)',
                  }}
                >
                  <span className="text-xs font-medium">{opt.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 文本输入 */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">批注内容</label>
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入批注内容... (Ctrl+Enter 提交)"
            className="w-full min-h-[80px] max-h-[160px] resize-none text-sm bg-background border border-border rounded px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
        </div>

        {/* 作者 */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">作者名（保存到本地）</label>
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="匿名创作者"
            className="w-full text-sm bg-background border border-border rounded px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
        </div>

        {/* 按钮 */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 text-foreground rounded transition-colors"
          >
            取消 (Esc)
          </button>
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="px-3 py-1.5 text-xs bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground rounded transition-colors"
          >
            添加 (Ctrl+Enter)
          </button>
        </div>
      </div>
    </div>
  )
})
