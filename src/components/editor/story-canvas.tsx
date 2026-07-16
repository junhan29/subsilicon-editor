'use client'

import { useCallback, useEffect, useState, useRef, useMemo, memo } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  applyNodeChanges,
  type Connection,
  type Edge,
  type Node,
  type Edge as RFEdge,
  type NodeChange,
} from '@xyflow/react'
import { Undo2, Redo2, Trash2, X, Copy, ShieldCheck, Layers, ChevronDown, ChevronRight, Pencil, Download, MessageSquare, Lock, Crown, Upload, Play, ArrowLeft, Globe } from 'lucide-react'
import clsx from 'clsx'
import CustomEdge from './custom-edge'
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
import { EmptyCanvasGuide } from './onboarding/empty-canvas-guide'
import { HelpMenu } from './onboarding/help-menu'
import { ShortcutsModal } from './onboarding/shortcuts-modal'
import { showToast, useToast, ToastContainer } from './toast'
import { A11yAnnouncer, useA11yAnnouncer } from './a11y-announcer'
import { HistoryStore, createSnapshot, type StoryGraphSnapshot, type HistoryActionType } from '@editor/lib/history-store'
import {
  loadVersions,
  saveVersion,
  deleteVersion as deleteVersionFromStore,
  restoreVersion,
  type VersionSnapshot,
} from '@editor/lib/version-store'
import { getPerformanceMode, PERFORMANCE_CONFIG } from '@editor/lib/performance-mode'
import { NodeSearch } from './node-search'
import { ExportDialog } from './export-dialog'
import { CreatorCenterDialog } from './creator-center-dialog'
import { DiscoverDialog } from './discover-dialog'
import { StoryPreview } from './preview/story-preview'
import { AlignmentLines } from './alignment-lines'
import type { AlignmentGuide } from '@editor/lib/alignment-guides'
import type { StoryNode, StoryEdge, StoryCharacter, StoryGraph, ComicScene, ComicAudio, NodeGroup, NodeTemplate, CharacterSprite, NodeAnnotation, AnnotationType } from '@editor/types/editor'
import type { MonetizationConfig } from '@editor/lib/work-monetization'
import { GROUP_COLORS } from '@editor/types/editor'
import { parseOutline, generateNodesFromOutline, generateOutlineFromNodes } from '@editor/lib/outline-parser'
import type { LibraryAsset } from '@editor/lib/asset-library'
import { getCurrentEdition, isDesktop } from '@editor/lib/editor-versions'
import { getAccount, isLoggedIn } from '@editor/lib/local-account-store'
import { isLoggedIn as isCreatorLoggedIn, getCurrentAccount as getCreatorAccount, ensureCreatorServiceInit } from '@editor/lib/creator-service'
import {
  loadAnnotations,
  saveAnnotations,
  addAnnotation as storeAddAnnotation,
  updateAnnotation as storeUpdateAnnotation,
  deleteAnnotation as storeDeleteAnnotation,
  deleteAnnotationsByNode as storeDeleteAnnotationsByNode,
  addReply as storeAddReply,
  getAnnotationAuthor,
  setAnnotationAuthor as storeSetAuthor,
} from '@editor/lib/annotation-store'
import { AnnotationMarkerProvider, withAnnotationMarker } from './annotation-marker'
import { matchShortcut } from '@editor/lib/shortcut-manager'
import { toggleTheme, getCurrentTheme, initTheme, type Theme, subscribeTheme } from '@editor/lib/theme-manager'
import { startSession, endSession, recordAction, estimateWordCount } from '@editor/lib/writing-stats'

// 为所有节点类型包裹批注标记
const nodeTypes = {
  dialogue: withAnnotationMarker(DialogueNode),
  narration: withAnnotationMarker(NarrationNode),
  choice: withAnnotationMarker(ChoiceNode),
  unlock: withAnnotationMarker(UnlockNode),
  ending: withAnnotationMarker(EndingNode),
  gather: withAnnotationMarker(GatherNode),
  condition: withAnnotationMarker(ConditionNode),
  cg: withAnnotationMarker(CgNode),
  jump: withAnnotationMarker(JumpNode),
  random: withAnnotationMarker(RandomNode),
  group: GroupNode,
}

const edgeTypes = {
  default: CustomEdge,
}

interface StoryCanvasProps {
  initialGraph?: StoryGraph
  onSave: (graph: StoryGraph) => void
  onGraphChange?: (graph: StoryGraph) => void
  templateId?: string
  onStartTour?: () => void
  workId?: string
  onBack?: () => void
}

export function StoryCanvas({ initialGraph, onSave, onGraphChange, templateId, onStartTour, workId, onBack }: StoryCanvasProps) {
  return (
    <ReactFlowProvider>
      <A11yAnnouncer>
        <StoryCanvasInner
          initialGraph={initialGraph}
          onSave={onSave}
          onGraphChange={onGraphChange}
          templateId={templateId}
          onStartTour={onStartTour}
          workId={workId}
          onBack={onBack}
        />
      </A11yAnnouncer>
    </ReactFlowProvider>
  )
}

function StoryCanvasInner({ initialGraph, onSave, onGraphChange, templateId, onStartTour, workId, onBack }: StoryCanvasProps) {
  const [nodes, setNodes] = useNodesState(initialGraph?.nodes || [])
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialGraph?.edges || [])
  const [groups, setGroups] = useState<NodeGroup[]>(initialGraph?.groups || [])
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [title, setTitle] = useState(initialGraph?.title || '未命名故事')
  const [tags, setTags] = useState<string[]>(initialGraph?.settings?.tags || [])
  const [characters, setCharacters] = useState<StoryCharacter[]>(initialGraph?.characters || [])
  const [variables, setVariables] = useState<import('@editor/types/editor').StoryVariable[]>(initialGraph?.variables || [])
  const { announce } = useA11yAnnouncer()
  // 不频繁变化的大型数据移入 useRef，避免每次状态更新触发重渲染
  const assetsRef = useRef(initialGraph?.assets || { images: [], audios: [], fonts: [] })
  const scenesRef = useRef<ComicScene[]>(initialGraph?.scenes || [
    { id: 'scene-default', name: '默认场景', backgroundImage: 'https://picsum.photos/seed/default-scene/800/600' },
  ])
  const audioRef = useRef<ComicAudio[]>(initialGraph?.audios || [])
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [showNodeSearch, setShowNodeSearch] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  // 创作者中心状态
  const [showCreatorCenter, setShowCreatorCenter] = useState(false)
  const [creatorCenterTab, setCreatorCenterTab] = useState<'account' | 'platforms' | 'publish' | 'records'>('account')
  const [loginState, setLoginState] = useState(0) // 用于刷新登录状态
  // 作品发现
  const [showDiscover, setShowDiscover] = useState(false)
  // 快捷键提示弹窗
  const [showShortcutsModal, setShowShortcutsModal] = useState(false)
  // 预览状态
  const [showPreview, setShowPreview] = useState(false)
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false })
  const [rightPanelTab, setRightPanelTab] = useState('properties')
  const [outlineText, setOutlineText] = useState('')
  const [versions, setVersions] = useState<VersionSnapshot[]>([])
  // 节点批注系统
  const [annotations, setAnnotations] = useState<NodeAnnotation[]>(initialGraph?.annotations || [])
  const [monetization, setMonetization] = useState<MonetizationConfig | null>(initialGraph?.monetization || null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null)
  const [annotationDialog, setAnnotationDialog] = useState<{ nodeId: string } | null>(null)
  // 视图切换状态
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [rightPanelVisible, setRightPanelVisible] = useState(true)
  // 主题状态（订阅变化以触发重渲染）
  const [currentTheme, setCurrentTheme] = useState<Theme>('dark')
  const annotationAuthor = useMemo(() => getAnnotationAuthor(), [])
  const { screenToFlowPosition, fitView, getNodes, zoomIn, zoomOut } = useReactFlow()
  const canvasRef = useRef<HTMLDivElement>(null)
  const historyStoreRef = useRef<HistoryStore<StoryGraphSnapshot> | null>(null)
  const pendingHistoryActionRef = useRef<{ type: HistoryActionType; description: string } | null>(null)
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
    }
    historyStoreRef.current.initialize(initialSnapshot)

    const unsubscribe = historyStoreRef.current.subscribe(setHistoryState)
    return () => {
      // 取消订阅避免内存泄漏
      unsubscribe()
    }
  }, [initialGraph])

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
    showToast('info', `已切换到${next === 'dark' ? '深色' : '浅色'}主题`)
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

  // 账号登录状态刷新
  // 当登录/登出后触发重渲染
  useEffect(() => {
    const handleLoginChange = () => {
      setLoginState(n => n + 1)
    }
    window.addEventListener('app:login-change', handleLoginChange)
    return () => window.removeEventListener('app:login-change', handleLoginChange)
  }, [])

  // 创作者中心初始化（从 localStorage 恢复登录态）
  useEffect(() => {
    ensureCreatorServiceInit().then(() => {
      setLoginState(n => n + 1)
    })
  }, [])

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
  const latestRef = useRef({ nodes, edges, characters, scenes: scenesRef.current, audioTracks: audioRef.current, variables, groups })
  latestRef.current = { nodes, edges, characters, scenes: scenesRef.current, audioTracks: audioRef.current, variables, groups }

  const buildSnapshot = useCallback((): StoryGraphSnapshot => {
    const { nodes: n, edges: e, characters: c, scenes: s, audioTracks: a, variables: v, groups: g } = latestRef.current
    return {
      nodes: n as StoryGraphSnapshot['nodes'],
      edges: e as StoryGraphSnapshot['edges'],
      characters: c as StoryGraphSnapshot['characters'],
      scenes: s as StoryGraphSnapshot['scenes'],
      audios: a as StoryGraphSnapshot['audios'],
      variables: v as StoryGraphSnapshot['variables'],
      groups: g as StoryGraphSnapshot['groups'],
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
  }, [nodes, edges, buildSnapshot, workId])

  // 拖拽过程中节流记录历史
  const lastPushTimeRef = useRef(0)
  const throttledPushHistory = useCallback((type: HistoryActionType, description: string) => {
    const now = Date.now()
    if (now - lastPushTimeRef.current < 200) return
    lastPushTimeRef.current = now
    pushHistory(type, description)
  }, [pushHistory])

  const undo = useCallback(() => {
    const snapshot = historyStoreRef.current?.undo()
    if (snapshot) {
      setNodes(snapshot.nodes as StoryNode[])
      setEdges(snapshot.edges as StoryEdge[])
      setGroups(snapshot.groups as NodeGroup[])
      setCharacters(snapshot.characters as StoryCharacter[])
      setVariables(snapshot.variables as import('@editor/types/editor').StoryVariable[])
      scenesRef.current = snapshot.scenes as ComicScene[]
      audioRef.current = snapshot.audios as ComicAudio[]
      showToast('info', '已撤销')
      announce('已撤销')
    }
  }, [setNodes, setEdges, setGroups, setCharacters, setVariables, announce])

  const redo = useCallback(() => {
    const snapshot = historyStoreRef.current?.redo()
    if (snapshot) {
      setNodes(snapshot.nodes as StoryNode[])
      setEdges(snapshot.edges as StoryEdge[])
      setGroups(snapshot.groups as NodeGroup[])
      setCharacters(snapshot.characters as StoryCharacter[])
      setVariables(snapshot.variables as import('@editor/types/editor').StoryVariable[])
      scenesRef.current = snapshot.scenes as ComicScene[]
      audioRef.current = snapshot.audios as ComicAudio[]
      showToast('info', '已重做')
      announce('已重做')
    }
  }, [setNodes, setEdges, setGroups, setCharacters, setVariables, announce])

  // 构建当前 graph — useMemo 优化避免每次渲染重建
  const graph = useMemo((): StoryGraph => ({
    title,
    description: '',
    templateId: (templateId as StoryGraph['templateId']) || 'dialogue',
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
  }), [title, templateId, characters, variables, nodes, edges, tags, groups, annotations, monetization])

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
    const id = `${type}-${Date.now()}`
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

    if (deletedCount === 1) {
      const nodeType = nodes.find((n) => n.id === idsToDelete[0])?.type
      pushHistory('DELETE_NODE', `删除 ${nodeTypeLabels[nodeType || ''] || '节点'}`)
      showToast('info', `${nodeTypeLabels[nodeType || ''] || '节点'}已删除`)
    } else {
      pushHistory('BATCH', `批量删除 ${deletedCount} 个节点`)
      showToast('info', `已删除 ${deletedCount} 个节点`)
    }
  }, [selectedNodeIds, nodes, setNodes, setEdges, pushHistory, workId])

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
    const groupId = `group-${Date.now()}`
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

  const generateNodeId = useCallback((type: string) => {
    return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }, [])

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

      const target = e.target as HTMLElement
      const isInputTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable ||
        target.tagName === 'SELECT'

      if (isInputTarget) {
        return
      }

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
        }
        return
      }

      // 视图类：切换侧边栏 / 右侧栏 / 主题
      if (matchShortcut(e, 'toggleSidebar')) {
        e.preventDefault()
        setSidebarVisible((v) => !v)
        return
      }

      if (matchShortcut(e, 'toggleRightPanel')) {
        e.preventDefault()
        setRightPanelVisible((v) => !v)
        return
      }

      if (matchShortcut(e, 'toggleTheme')) {
        e.preventDefault()
        handleToggleTheme()
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
    copySelectedNodes,
    pasteNodes,
    duplicateSelectedNodes,
    createGroupFromSelection,
    addNodeAtCenter,
    zoomIn,
    zoomOut,
    fitView,
    handleToggleTheme,
    setNodes,
    throttledPushHistory,
  ])

  const updateNodeData = useCallback((nodeId: string, data: Partial<StoryNode['data']>) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n))
    )
    throttledPushHistory('UPDATE_NODE', '修改节点属性')
  }, [setNodes, throttledPushHistory])

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
    pushHistory('DELETE_NODE', `删除 ${nodeTypeLabels[nodeType || ''] || '节点'}`)
    showToast('info', `${nodeTypeLabels[nodeType || ''] || '节点'}已删除`)
    announce(`${nodeTypeLabels[nodeType || ''] || '节点'}已删除`)
  }, [nodes, setNodes, setEdges, pushHistory, announce])

  const saveGraph = useCallback(() => {
    onSave(graphRef.current)
  }, [onSave])

  const handleSave = useCallback(() => {
    saveGraph()
    showToast('success', '作品已保存')
    announce('作品已保存')
  }, [saveGraph, announce])

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
    showToast('success', `角色「${character.name}」已添加`)
  }, [setCharacters])

  const updateCharacter = useCallback((character: StoryCharacter) => {
    setCharacters((prev) => prev.map((c) => (c.id === character.id ? character : c)))
    showToast('success', `角色「${character.name}」已更新`)
  }, [setCharacters])

  const deleteCharacter = useCallback((characterId: string) => {
    const char = characters.find(c => c.id === characterId)
    setCharacters((prev) => prev.filter((c) => c.id !== characterId))
    showToast('info', `角色「${char?.name || ''}」已删除`)
  }, [characters, setCharacters])

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

  const handleNodeDragStop = useCallback(() => {
    alignmentLinesRef.current?.handleNodeDragStop()
    throttledPushHistory('UPDATE_GROUP', '移动分组')
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

    const id = `${type}-${Date.now()}`
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

  const handleDeleteEdge = useCallback((id: string) => {
    setEdges((eds) => eds.filter((e) => e.id !== id))
    setSelectedEdgeId(null)
  }, [setEdges])

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
  }, [])

  const handleAudiosChange = useCallback((newAudios: ComicAudio[]) => {
    audioRef.current = newAudios
  }, [])

  const handleCloseNodeSearch = useCallback(() => {
    setShowNodeSearch(false)
  }, [])

  const handleStartTour = useCallback(() => {
    onStartTour?.()
  }, [onStartTour])

  return (
    <div className="flex h-[calc(100vh-52px)]">
      {/* 左侧：可拖拽节点面板（可通过 B 键切换显隐） */}
      {sidebarVisible && (
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
        />
      )}

      {/* 中间：React Flow 画布 */}
      <div
        ref={canvasRef}
        role="region"
        aria-label="故事节点编辑器画布"
        aria-describedby="canvas-description"
        className={`flex-1 relative transition-colors ${isDraggingOver ? 'ring-2 ring-inset ring-primary/30 bg-primary/[0.02]' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onContextMenu={(e) => {
          // 允许节点右键菜单，但阻止画布右键默认行为
          if (e.target === e.currentTarget) e.preventDefault()
        }}
      >
        <span
          id="canvas-description"
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: '0',
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: '0',
          }}
        >
          使用鼠标拖拽节点，滚轮缩放画布，空格拖拽平移。支持键盘快捷键操作。
        </span>
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
          {perfConfig.miniMapVisible && (
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

        {/* 右键菜单：节点操作 */}
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

        {/* 添加批注弹窗 */}
        {annotationDialog && (
          <AnnotationDialog
            nodeId={annotationDialog.nodeId}
            defaultAuthor={annotationAuthor}
            onSubmit={handleAddAnnotation}
            onClose={() => setAnnotationDialog(null)}
          />
        )}

        {/* 空画布引导 */}
        {isEmpty && (
          <EmptyCanvasGuide
            onQuickAdd={addNodeAtCenter}
            onStartTour={handleStartTour}
          />
        )}

        {/* 创作者中心入口（空画布时右上角单独显示） */}
        {isEmpty && (
          <div className="absolute top-4 right-4 flex items-center gap-1 bg-card/90 backdrop-blur border rounded-lg px-2 py-1 shadow-sm z-10">
            {isCreatorLoggedIn() && getCreatorAccount() ? (
              <span className="flex items-center gap-1.5 px-2 py-1 text-xs text-emerald-400" title={getCreatorAccount()!.email}>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="font-medium">{getCreatorAccount()!.displayName}</span>
              </span>
            ) : (
              <button
                onClick={() => { setCreatorCenterTab('account'); setShowCreatorCenter(true) }}
                className="flex items-center gap-1.5 px-2 py-1 rounded transition-colors hover:bg-muted text-muted-foreground hover:text-foreground text-xs"
                title="创作者中心 - 登录/注册账号"
              >
                登录
              </button>
            )}
            <span className="w-px h-4 bg-border" />
            <button
              onClick={() => { setCreatorCenterTab('publish'); setShowCreatorCenter(true) }}
              className="flex items-center gap-1.5 px-2 py-1 rounded transition-colors hover:bg-amber-500/10 text-foreground hover:text-amber-400"
              title="创作者中心 - 管理平台、发布作品"
            >
              <Upload className="w-4 h-4" />
              <span className="text-xs font-medium">创作者中心</span>
            </button>
          </div>
        )}

        {/* 拖拽提示遮罩 */}
        {isDraggingOver && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
            <div className="bg-primary/90 text-primary-foreground px-6 py-3 rounded-xl shadow-lg text-sm font-medium">
              释放以添加节点
            </div>
          </div>
        )}

        {/* 底部状态栏 */}
        {!isEmpty && (
          <StatusBar
            nodeCount={nodes.length}
            edgeCount={edges.length}
            completionPercent={completionPercent}
            onStatsClick={() => setRightPanelTab('stats')}
          />
        )}

        {/* 撤销/重做按钮 */}
        {!isEmpty && (
          <UndoRedoButtons
            canUndo={historyState.canUndo}
            canRedo={historyState.canRedo}
            onUndo={undo}
            onRedo={redo}
            onPreview={() => setShowPreview(true)}
            onExport={() => setShowExportDialog(true)}
            onDirectoryUpload={() => { setCreatorCenterTab('publish'); setShowCreatorCenter(true) }}
            onDiscover={() => setShowDiscover(true)}
            loggedIn={isCreatorLoggedIn()}
            account={getCreatorAccount()}
            onOpenAccount={() => { setCreatorCenterTab('account'); setShowCreatorCenter(true) }}
            onBack={onBack}
            onStartTour={handleStartTour}
            onShowShortcuts={() => setShowShortcutsModal(true)}
          />
        )}

        {/* 多选浮动工具栏 */}
        {isMultiSelect && (
          <MultiSelectToolbar
            selectedCount={selectedNodeIds.length}
            onCopy={copySelectedNodes}
            onDelete={deleteSelectedNodes}
            onCancel={() => setSelectedNodeIds([])}
            onCreateGroup={createGroupFromSelection}
          />
        )}

        {/* 分组选中工具栏 */}
        {selectedGroupId && !isMultiSelect && (() => {
          const selectedGroup = groups.find((g) => g.id === selectedGroupId)
          if (!selectedGroup) {
            setSelectedGroupId(null)
            return null
          }
          return (
            <GroupToolbar
              group={selectedGroup}
              onToggleCollapse={() => toggleGroupCollapse(selectedGroupId)}
              onRename={(name) => renameGroup(selectedGroupId, name)}
              onColorChange={(color) => changeGroupColor(selectedGroupId, color)}
              onUngroup={() => deleteGroup(selectedGroupId, true)}
              onDelete={() => deleteGroup(selectedGroupId, false)}
              onClose={() => setSelectedGroupId(null)}
            />
          )
        })()}
      </div>

      {/* 右侧：属性面板（可通过 P 键切换显隐） */}
      {rightPanelVisible && (
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
          onUpdateVariables={setVariables}
          onNodeSelect={handleNodeSelect}
          onEdgeSelect={handleEdgeSelect}
          onScenesChange={handleScenesChange}
          onAudiosChange={handleAudiosChange}
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
            pushHistory('BATCH', `应用 AI 生成故事「${newTitle}」`)
            showToast('success', `故事「${newTitle}」已应用到画布`)
            setTimeout(() => {
              fitView({ padding: 0.3, duration: 500 })
            }, 100)
          }}
          onAddCharacters={(newChars) => {
            newChars.forEach((char) => addCharacter(char))
          }}
        />
      )}

      <ToastContainerPortal />

      {/* NodeSearch: Ctrl+F 打开 */}
      <NodeSearch
        nodes={nodes as StoryNode[]}
        characters={characters}
        open={showNodeSearch}
        onClose={handleCloseNodeSearch}
        onReplaceNode={handleReplaceNode}
      />

      {/* 导出对话框 */}
      <ExportDialog
        open={showExportDialog}
        graph={graph}
        onClose={() => setShowExportDialog(false)}
        onImportTranslation={handleImportTranslation}
        monetization={monetization}
      />

      {/* 预览对话框 */}
      <StoryPreview
        graph={graph}
        open={showPreview}
        onClose={() => setShowPreview(false)}
      />

      {/* 创作者中心 */}
      <CreatorCenterDialog
        open={showCreatorCenter}
        onClose={() => setShowCreatorCenter(false)}
        graph={graph}
        workId={workId}
        initialTab={creatorCenterTab}
        onLoginStateChange={() => setLoginState(n => n + 1)}
      />

      {/* 作品发现 */}
      <DiscoverDialog
        open={showDiscover}
        onClose={() => setShowDiscover(false)}
      />

      {/* 快捷键提示 */}
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
        className="flex items-center gap-1.5 hover:text-pink-400 transition-colors"
        title="故事统计"
      >
        <ShieldCheck className="w-3.5 h-3.5" />
        故事统计
      </button>
      {nodeCount > 200 && (
        <>
          <span className="w-px h-3 bg-border" />
          <span className={clsx(
            nodeCount > 500 ? 'text-amber-400' : 'text-slate-500'
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

interface UndoRedoButtonsProps {
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onPreview?: () => void
  onExport?: () => void
  onDirectoryUpload?: () => void
  onDiscover?: () => void
  loggedIn?: boolean
  account?: { displayName: string; email: string } | null
  onOpenAccount?: () => void
  onBack?: () => void
  onStartTour?: () => void
  onShowShortcuts?: () => void
}

const UndoRedoButtons = memo(function UndoRedoButtons({ canUndo, canRedo, onUndo, onRedo, onPreview, onExport, onDirectoryUpload, onDiscover, loggedIn, account, onOpenAccount, onBack, onStartTour, onShowShortcuts }: UndoRedoButtonsProps) {
  return (
    <div className="absolute top-4 right-4 flex items-center gap-1 bg-card/90 backdrop-blur border rounded-lg px-2 py-1 shadow-sm z-10">
      {onBack && (
        <>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-2 py-1 rounded transition-colors hover:bg-slate-700 text-slate-400 hover:text-white text-xs"
            title="返回项目管理"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs font-medium hidden sm:inline">项目</span>
          </button>
          <span className="w-px h-4 bg-border" />
        </>
      )}
      {/* 账号登录状态 */}
      {onOpenAccount && (
        <>
          {loggedIn && account ? (
            <span className="flex items-center gap-1.5 px-2 py-1 text-xs text-emerald-400" title={account.email}>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="font-medium">{account.displayName}</span>
            </span>
          ) : (
            <button
              onClick={onOpenAccount}
              className="flex items-center gap-1.5 px-2 py-1 rounded transition-colors hover:bg-muted text-muted-foreground hover:text-foreground text-xs"
              title="创作者中心 - 登录/注册账号"
            >
              登录
            </button>
          )}
          <span className="w-px h-4 bg-border" />
        </>
      )}
      {/* 预览按钮 */}
      {onPreview && (
        <>
          <button
            onClick={onPreview}
            className="flex items-center gap-1.5 px-2 py-1 rounded transition-colors hover:bg-emerald-500/10 text-foreground hover:text-emerald-400"
            title="预览作品 (Ctrl+P)"
          >
            <Play className="w-4 h-4" />
            <span className="text-xs font-medium">预览</span>
          </button>
          <span className="w-px h-4 bg-border" />
        </>
      )}
      {onExport && (
        <>
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-2 py-1 rounded transition-colors hover:bg-primary/10 text-foreground hover:text-primary"
            title="导出作品"
          >
            <Download className="w-4 h-4" />
            <span className="text-xs font-medium">导出</span>
          </button>
          <span className="w-px h-4 bg-border" />
        </>
      )}
      {/* 作品墙上传按钮 */}
      {onDirectoryUpload && (
        <>
          <button
            onClick={onDirectoryUpload}
            className="flex items-center gap-1.5 px-2 py-1 rounded transition-colors hover:bg-amber-500/10 text-foreground hover:text-amber-400"
            title="创作者中心 - 管理平台、发布作品"
          >
            <Upload className="w-4 h-4" />
            <span className="text-xs font-medium">创作者中心</span>
          </button>
          <span className="w-px h-4 bg-border" />
        </>
      )}
      {/* 作品发现按钮 */}
      {onDiscover && (
        <>
          <button
            onClick={onDiscover}
            className="flex items-center gap-1.5 px-2 py-1 rounded transition-colors hover:bg-purple-500/10 text-foreground hover:text-purple-400"
            title="发现作品 - 探索去中心化作品生态"
          >
            <Globe className="w-4 h-4" />
            <span className="text-xs font-medium hidden sm:inline">发现</span>
          </button>
          <span className="w-px h-4 bg-border" />
        </>
      )}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className={`p-1.5 rounded transition-colors ${canUndo ? 'hover:bg-muted text-foreground' : 'text-muted-foreground/40 cursor-not-allowed'}`}
        title="撤销 (Ctrl+Z)"
      >
        <Undo2 className="w-4 h-4" />
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className={`p-1.5 rounded transition-colors ${canRedo ? 'hover:bg-muted text-foreground' : 'text-muted-foreground/40 cursor-not-allowed'}`}
        title="重做 (Ctrl+Y)"
      >
        <Redo2 className="w-4 h-4" />
      </button>
      {onStartTour && onShowShortcuts && (
        <>
          <span className="w-px h-4 bg-border" />
          <HelpMenu
            onStartTour={onStartTour}
            onShowShortcuts={onShowShortcuts}
          />
        </>
      )}
    </div>
  )
})

interface MultiSelectToolbarProps {
  selectedCount: number
  onCopy: () => void
  onDelete: () => void
  onCancel: () => void
  onCreateGroup?: () => void
}

const MultiSelectToolbar = memo(function MultiSelectToolbar({ selectedCount, onCopy, onDelete, onCancel, onCreateGroup }: MultiSelectToolbarProps) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-card/95 backdrop-blur border border-primary/30 rounded-lg px-4 py-2 shadow-lg z-20">
      <span className="text-sm font-medium text-foreground">
        已选中 <span className="text-primary">{selectedCount}</span> 个节点
      </span>
      <div className="w-px h-4 bg-border" />
      {onCreateGroup && selectedCount >= 2 && (
        <>
          <button
            onClick={onCreateGroup}
            className="flex items-center gap-1.5 px-3 py-1 text-xs bg-purple-600/90 hover:bg-purple-600 text-white rounded-md transition-colors"
            title="创建分组"
          >
            <Layers className="w-3.5 h-3.5" />
            创建分组
          </button>
          <div className="w-px h-4 bg-border" />
        </>
      )}
      <button
        onClick={onCopy}
        className="flex items-center gap-1.5 px-3 py-1 text-xs bg-primary/90 hover:bg-primary text-primary-foreground rounded-md transition-colors"
        title="复制选中节点 (Ctrl+C)"
      >
        <Copy className="w-3.5 h-3.5" />
        复制
      </button>
      <button
        onClick={onDelete}
        className="flex items-center gap-1.5 px-3 py-1 text-xs bg-destructive/90 hover:bg-destructive text-destructive-foreground rounded-md transition-colors"
        title="删除选中节点 (Delete)"
      >
        <Trash2 className="w-3.5 h-3.5" />
        批量删除
      </button>
      <button
        onClick={onCancel}
        className="flex items-center gap-1.5 px-3 py-1 text-xs bg-muted hover:bg-muted/80 text-foreground rounded-md transition-colors"
        title="取消选择 (Esc)"
      >
        <X className="w-3.5 h-3.5" />
        取消选择
      </button>
    </div>
  )
})

interface GroupToolbarProps {
  group: NodeGroup
  onToggleCollapse: () => void
  onRename: (name: string) => void
  onColorChange: (color: string) => void
  onUngroup: () => void
  onDelete: () => void
  onClose: () => void
}

const GroupToolbar = memo(function GroupToolbar({ group, onToggleCollapse, onRename, onColorChange, onUngroup, onDelete, onClose }: GroupToolbarProps) {
  const [showColors, setShowColors] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [editName, setEditName] = useState(group.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isRenaming])

  const handleSaveName = useCallback(() => {
    if (editName.trim() && editName !== group.name) {
      onRename(editName.trim())
    }
    setIsRenaming(false)
  }, [editName, group.name, onRename])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveName()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setEditName(group.name)
      setIsRenaming(false)
    }
  }, [handleSaveName, group.name])

  const colorInfo = GROUP_COLORS.find(c => c.value === group.color) || GROUP_COLORS[0]

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-card/95 backdrop-blur border rounded-lg px-4 py-2 shadow-lg z-20"
      style={{ borderColor: colorInfo.value + '50' }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-4 h-4 rounded"
          style={{ backgroundColor: group.color }}
        />
        {isRenaming ? (
          <input
            ref={inputRef}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSaveName}
            className="text-sm font-medium bg-background border border-primary/30 rounded px-2 py-0.5 outline-none w-32"
          />
        ) : (
          <span className="text-sm font-medium text-foreground">{group.name}</span>
        )}
        <span className="text-xs text-muted-foreground">({group.nodeIds.length} 节点)</span>
      </div>

      <div className="w-px h-4 bg-border" />

      <button
        onClick={onToggleCollapse}
        className="flex items-center gap-1.5 px-3 py-1 text-xs bg-muted hover:bg-muted/80 text-foreground rounded-md transition-colors"
        title={group.collapsed ? '展开分组' : '折叠分组'}
      >
        {group.collapsed ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
        {group.collapsed ? '展开' : '折叠'}
      </button>

      {!isRenaming && (
        <button
          onClick={() => setIsRenaming(true)}
          className="flex items-center gap-1.5 px-3 py-1 text-xs bg-muted hover:bg-muted/80 text-foreground rounded-md transition-colors"
          title="重命名分组"
        >
          <Pencil className="w-3.5 h-3.5" />
          重命名
        </button>
      )}

      <div className="relative">
        <button
          onClick={() => setShowColors(!showColors)}
          className="flex items-center gap-1.5 px-3 py-1 text-xs bg-muted hover:bg-muted/80 text-foreground rounded-md transition-colors"
          title="更改颜色"
        >
          <div className="w-3.5 h-3.5 rounded" style={{ backgroundColor: group.color }} />
          颜色
        </button>
        {showColors && (
          <div className="absolute top-full left-0 mt-1 flex gap-1 p-2 bg-card border rounded-lg shadow-lg z-30">
            {GROUP_COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() => {
                  onColorChange(color.value)
                  setShowColors(false)
                }}
                className={`w-6 h-6 rounded transition-transform hover:scale-110 ${
                  group.color === color.value ? 'ring-2 ring-offset-1 ring-foreground' : ''
                }`}
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-4 bg-border" />

      <button
        onClick={onUngroup}
        className="flex items-center gap-1.5 px-3 py-1 text-xs bg-amber-500/90 hover:bg-amber-500 text-white rounded-md transition-colors"
        title="取消分组（保留节点）"
      >
        <Layers className="w-3.5 h-3.5" />
        取消分组
      </button>

      <button
        onClick={onDelete}
        className="flex items-center gap-1.5 px-3 py-1 text-xs bg-destructive/90 hover:bg-destructive text-destructive-foreground rounded-md transition-colors"
        title="删除分组及节点"
      >
        <Trash2 className="w-3.5 h-3.5" />
        删除
      </button>

      <button
        onClick={onClose}
        className="flex items-center justify-center p-1 text-muted-foreground hover:text-foreground transition-colors"
        title="关闭工具栏"
      >
        <X className="w-4 h-4" />
      </button>
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
