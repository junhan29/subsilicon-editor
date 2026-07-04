'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import {
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type OnEdgesChange,
} from '@xyflow/react'
import type {
  StoryNode,
  StoryEdge,
  StoryCharacter,
  StoryVariable,
  NodeGroup,
  NodeTemplate,
  StoryGraph,
  CharacterSprite,
  ComicScene,
  ComicAudio,
} from '@editor/types/editor'
import { GROUP_COLORS } from '@editor/types/editor'
import { showToast } from '../components/editor/toast'
import type { HistoryActionType } from '@editor/lib/history-store'
import {
  generateNodesFromOutline,
  generateOutlineFromNodes,
  parseOutline,
} from '@editor/lib/outline-parser'
import type { LibraryAsset } from '@editor/lib/asset-library'

/** 节点类型中文标签映射 */
const NODE_TYPE_LABELS: Record<string, string> = {
  dialogue: '对话',
  choice: '选择',
  gather: '汇聚',
  condition: '条件',
  unlock: '付费',
  ending: '结局',
  cg: 'CG过场',
  jump: '跳转',
  random: '随机',
}

/** 根据节点类型创建默认节点 data */
function createNodeData(type: string): Record<string, unknown> {
  switch (type) {
    case 'dialogue':
      return {
        characterId: '',
        text: '',
        emotion: '',
        spritePosition: 'center',
        enterAnimation: 'fade-in',
        textAnimation: 'typewriter',
      }
    case 'choice':
      return {
        options: [
          { id: 'opt-a', text: '选项A' },
          { id: 'opt-b', text: '选项B' },
        ],
        prompt: '你的选择是？',
      }
    case 'ending':
      return { title: '结局', text: '', endingType: 'neutral' as const }
    case 'gather':
      return { label: '汇聚' }
    case 'condition':
      return { expression: 'true', trueLabel: '是', falseLabel: '否' }
    case 'unlock':
      return { amount: 1, nodeTitle: '解锁内容', description: '' }
    case 'cg':
      return {
        mediaType: 'image' as const,
        url: '',
        title: '',
        duration: 0,
        canSkip: true,
        transitionIn: 'fade',
        transitionOut: 'fade',
        transitionDuration: 1000,
        letterbox: true,
      }
    case 'jump':
      return { label: '', targetNodeId: '', expression: '' }
    case 'random':
      return {
        label: '',
        options: [
          { id: '1', label: '选项 A', weight: 50 },
          { id: '2', label: '选项 B', weight: 50 },
        ],
      }
    default:
      return {}
  }
}

/**
 * 画布状态管理 Hook 的配置项
 */
export interface UseCanvasStateOptions {
  /** 初始图数据 */
  initialGraph?: StoryGraph
  /** 记录历史动作（来自 use-history） */
  pushHistory: (type: HistoryActionType, description: string) => void
  /** 节流版记录历史（来自 use-history） */
  throttledPushHistory: (type: HistoryActionType, description: string) => void
  /** 无障碍播报函数 */
  announce: (message: string) => void
}

/**
 * 画布状态管理 Hook 的返回值
 */
export interface UseCanvasStateReturn {
  // === 基础状态 ===
  nodes: Node[]
  edges: Edge[]
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>
  onEdgesChange: OnEdgesChange<Edge>
  groups: NodeGroup[]
  setGroups: React.Dispatch<React.SetStateAction<NodeGroup[]>>

  // === 选中状态 ===
  selectedNodeIds: string[]
  setSelectedNodeIds: React.Dispatch<React.SetStateAction<string[]>>
  selectedEdgeId: string | null
  setSelectedEdgeId: React.Dispatch<React.SetStateAction<string | null>>
  selectedGroupId: string | null
  setSelectedGroupId: React.Dispatch<React.SetStateAction<string | null>>
  selectedNodes: StoryNode[]
  selectedNode: StoryNode | undefined
  selectedEdge: StoryEdge | undefined

  // === 派生状态 ===
  isEmpty: boolean
  isMultiSelect: boolean

  // === 节点操作 ===
  addNodeAtCenter: (type: string) => void
  deleteSelectedNodes: () => void
  deleteNode: (nodeId: string) => void
  updateNodeData: (nodeId: string, data: Partial<StoryNode['data']>) => void
  updateEdgeData: (edgeId: string, data: Partial<StoryEdge>) => void
  onConnect: (connection: Connection) => void

  // === 复制 / 粘贴 / 克隆 ===
  copySelectedNodes: () => void
  pasteNodes: () => void
  duplicateSelectedNodes: () => void
  insertTemplate: (template: NodeTemplate, dropX: number, dropY: number) => void

  // === 大纲生成 ===
  handleGenerateNodesFromOutline: (outline: string) => void
  handleGenerateOutlineFromNodes: () => string

  // === 分组操作 ===
  createGroupFromSelection: () => void
  deleteGroup: (groupId: string, keepNodes?: boolean) => void
  toggleGroupCollapse: (groupId: string) => void
  renameGroup: (groupId: string, newName: string) => void
  changeGroupColor: (groupId: string, color: string) => void
  handleGroupNodeDrag: (
    event: MouseEvent | TouchEvent,
    node: Node,
    draggedNodes: Node[]
  ) => void
  groupNodesForFlow: Node[]
  visibleNodes: Node[]

  // === 角色 / 变量 / 场景 / 音频（委托给外部的 setter） ===
  characters: StoryCharacter[]
  setCharacters: React.Dispatch<React.SetStateAction<StoryCharacter[]>>
  variables: StoryVariable[]
  setVariables: React.Dispatch<React.SetStateAction<StoryVariable[]>>
  scenesRef: React.MutableRefObject<ComicScene[]>
  audioRef: React.MutableRefObject<ComicAudio[]>
  assetsRef: React.MutableRefObject<StoryGraph['assets']>

  // === 剪贴板 ===
  clipboardRef: React.MutableRefObject<{
    nodes: StoryNode[]
    edges: StoryEdge[]
  } | null>

  // === 工具方法 ===
  generateNodeId: (type: string) => string
  handleInsertAsset: (asset: LibraryAsset) => void
  addCharacter: (character: StoryCharacter) => void
  updateCharacter: (character: StoryCharacter) => void
  deleteCharacter: (characterId: string) => void

  // === ReactFlow 实例方法 ===
  screenToFlowPosition: ReturnType<typeof useReactFlow>['screenToFlowPosition']
  fitView: ReturnType<typeof useReactFlow>['fitView']
  getNodes: ReturnType<typeof useReactFlow>['getNodes']
}

/**
 * 画布状态管理 Hook
 *
 * 提取自 story-canvas.tsx，管理节点、边、分组、选中状态及相关操作。
 */
export function useCanvasState({
  initialGraph,
  pushHistory,
  throttledPushHistory,
  announce,
}: UseCanvasStateOptions): UseCanvasStateReturn {
  const { screenToFlowPosition, fitView, getNodes } = useReactFlow()

  // === 基础状态 ===
  const [nodes, setNodes] = useNodesState<Node>(
    (initialGraph?.nodes || []) as Node[]
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    (initialGraph?.edges || []) as Edge[]
  )
  const [groups, setGroups] = useState<NodeGroup[]>(
    initialGraph?.groups || []
  )

  // === 选中状态 ===
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)

  // === 角色 / 变量 ===
  const [characters, setCharacters] = useState<StoryCharacter[]>(
    initialGraph?.characters || []
  )
  const [variables, setVariables] = useState<StoryVariable[]>(
    initialGraph?.variables || []
  )

  // === 不频繁变化的大型数据使用 ref ===
  const assetsRef = useRef<StoryGraph['assets']>(
    initialGraph?.assets || { images: [], audios: [], fonts: [] }
  )
  const scenesRef = useRef<ComicScene[]>(
    initialGraph?.scenes || [
      {
        id: 'scene-default',
        name: '默认场景',
        backgroundImage:
          'https://picsum.photos/seed/default-scene/800/600',
      },
    ]
  )
  const audioRef = useRef<ComicAudio[]>(initialGraph?.audios || [])

  // === 剪贴板 ===
  const clipboardRef = useRef<{
    nodes: StoryNode[]
    edges: StoryEdge[]
  } | null>(null)
  const pasteOffsetRef = useRef(0)

  // === 派生状态 ===
  const selectedNodes = nodes.filter((n) =>
    selectedNodeIds.includes(n.id)
  ) as StoryNode[]
  const selectedNode =
    selectedNodeIds.length === 1
      ? (selectedNodes[0] as StoryNode | undefined)
      : undefined
  const selectedEdge = edges.find(
    (e) => e.id === selectedEdgeId
  ) as StoryEdge | undefined
  const isEmpty = nodes.length === 0
  const isMultiSelect = selectedNodeIds.length > 1

  // === 节点 ID 生成 ===
  const generateNodeId = useCallback((type: string) => {
    return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }, [])

  // === 添加节点到画布中心 ===
  const addNodeAtCenter = useCallback(
    (type: string) => {
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
      pushHistory(
        'ADD_NODE',
        `添加 ${NODE_TYPE_LABELS[type] || type} 节点`
      )
      showToast('success', `已添加${NODE_TYPE_LABELS[type] || type}节点`)
      announce(`已添加${NODE_TYPE_LABELS[type] || type}节点`)
    },
    [screenToFlowPosition, setNodes, pushHistory, announce]
  )

  // === 连线 ===
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds))
      pushHistory('ADD_EDGE', '创建连线')
      showToast('info', '连线已创建')
    },
    [setEdges, pushHistory]
  )

  // === 删除选中节点 ===
  const deleteSelectedNodes = useCallback(() => {
    if (selectedNodeIds.length === 0) return

    const idsToDelete = [...selectedNodeIds]
    const deletedCount = idsToDelete.length

    setNodes((nds) => nds.filter((n) => !idsToDelete.includes(n.id)))
    setEdges((eds) =>
      eds.filter(
        (e) =>
          !idsToDelete.includes(e.source) && !idsToDelete.includes(e.target)
      )
    )
    setSelectedNodeIds([])

    if (deletedCount === 1) {
      const nodeType = nodes.find((n) => n.id === idsToDelete[0])?.type
      pushHistory(
        'DELETE_NODE',
        `删除 ${NODE_TYPE_LABELS[nodeType || ''] || '节点'}`
      )
      showToast(
        'info',
        `${NODE_TYPE_LABELS[nodeType || ''] || '节点'}已删除`
      )
    } else {
      pushHistory('BATCH', `批量删除 ${deletedCount} 个节点`)
      showToast('info', `已删除 ${deletedCount} 个节点`)
    }
  }, [selectedNodeIds, nodes, setNodes, setEdges, pushHistory])

  // === 删除单个节点 ===
  const deleteNode = useCallback(
    (nodeId: string) => {
      const nodeType = nodes.find((n) => n.id === nodeId)?.type
      setNodes((nds) => nds.filter((n) => n.id !== nodeId))
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
      )
      setSelectedNodeIds((ids) => ids.filter((id) => id !== nodeId))
      pushHistory(
        'DELETE_NODE',
        `删除 ${NODE_TYPE_LABELS[nodeType || ''] || '节点'}`
      )
      showToast(
        'info',
        `${NODE_TYPE_LABELS[nodeType || ''] || '节点'}已删除`
      )
      announce(`${NODE_TYPE_LABELS[nodeType || ''] || '节点'}已删除`)
    },
    [nodes, setNodes, setEdges, pushHistory, announce]
  )

  // === 更新节点数据 ===
  const updateNodeData = useCallback(
    (nodeId: string, data: Partial<StoryNode['data']>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
        )
      )
      throttledPushHistory('UPDATE_NODE', '修改节点属性')
    },
    [setNodes, throttledPushHistory]
  )

  // === 更新边数据 ===
  const updateEdgeData = useCallback(
    (edgeId: string, data: Partial<StoryEdge>) => {
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
    },
    [setEdges, throttledPushHistory]
  )

  // === 复制选中节点 ===
  const copySelectedNodes = useCallback(() => {
    if (selectedNodeIds.length === 0) return

    const selectedNodesList = nodes.filter((n) =>
      selectedNodeIds.includes(n.id)
    ) as StoryNode[]
    const selectedEdgesList = edges.filter(
      (e) =>
        selectedNodeIds.includes(e.source) &&
        selectedNodeIds.includes(e.target)
    ) as StoryEdge[]

    clipboardRef.current = {
      nodes: JSON.parse(JSON.stringify(selectedNodesList)),
      edges: JSON.parse(JSON.stringify(selectedEdgesList)),
    }
    pasteOffsetRef.current = 0

    showToast('info', `已复制 ${selectedNodesList.length} 个节点`)
  }, [selectedNodeIds, nodes, edges])

  // === 粘贴节点 ===
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
      pushHistory(
        'ADD_NODE',
        `粘贴 ${NODE_TYPE_LABELS[newNodes[0].type] || '节点'}`
      )
    } else {
      pushHistory('BATCH', `粘贴 ${nodeCount} 个节点`)
    }
    showToast('success', `已粘贴 ${nodeCount} 个节点`)
  }, [generateNodeId, setNodes, setEdges, pushHistory])

  // === 克隆选中节点 ===
  const duplicateSelectedNodes = useCallback(() => {
    if (selectedNodeIds.length === 0) return

    const selectedNodesList = nodes.filter((n) =>
      selectedNodeIds.includes(n.id)
    ) as StoryNode[]
    const selectedEdgesList = edges.filter(
      (e) =>
        selectedNodeIds.includes(e.source) &&
        selectedNodeIds.includes(e.target)
    ) as StoryEdge[]

    clipboardRef.current = {
      nodes: JSON.parse(JSON.stringify(selectedNodesList)),
      edges: JSON.parse(JSON.stringify(selectedEdgesList)),
    }
    pasteOffsetRef.current = 0

    pasteNodes()
  }, [selectedNodeIds, nodes, edges, pasteNodes])

  // === 插入模板 ===
  const insertTemplate = useCallback(
    (template: NodeTemplate, dropX: number, dropY: number) => {
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
      pushHistory(
        'BATCH',
        `插入模板「${template.name}」(${nodeCount} 个节点)`
      )
      showToast('success', `已插入模板「${template.name}」`)
    },
    [generateNodeId, setNodes, setEdges, pushHistory]
  )

  // === 从大纲生成节点 ===
  const handleGenerateNodesFromOutline = useCallback(
    (outline: string) => {
      const items = parseOutline(outline)
      if (items.length === 0) {
        showToast('info', '未解析到有效的大纲内容')
        return
      }

      const allNodes = getNodes()
      const maxX =
        allNodes.length > 0
          ? Math.max(
              ...allNodes.map((n) => n.position.x + (n.width || 280))
            )
          : 0
      const startX = maxX + 200
      const startY = 100

      const { nodes: newNodes, edges: newEdges } = generateNodesFromOutline(
        items,
        { startX, startY }
      )

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
          nodes: newNodes.map((n) => ({ id: n.id })),
          padding: 0.3,
          duration: 500,
        })
      }, 100)
    },
    [getNodes, setNodes, setEdges, pushHistory, fitView]
  )

  // === 从节点生成大纲 ===
  const handleGenerateOutlineFromNodes = useCallback((): string => {
    return generateOutlineFromNodes(
      nodes as StoryNode[],
      edges as StoryEdge[],
      groups
    )
  }, [nodes, edges, groups])

  // ==================== 分组功能 ====================

  const createGroupFromSelection = useCallback(() => {
    if (selectedNodeIds.length < 2) {
      showToast('info', '请至少选择 2 个节点创建分组')
      return
    }

    const selectedNodesList = nodes.filter((n) =>
      selectedNodeIds.includes(n.id)
    )
    if (selectedNodesList.length === 0) return

    const minX = Math.min(...selectedNodesList.map((n) => n.position.x))
    const minY = Math.min(...selectedNodesList.map((n) => n.position.y))
    const maxX = Math.max(
      ...selectedNodesList.map((n) => n.position.x + 280)
    )
    const maxY = Math.max(
      ...selectedNodesList.map((n) => n.position.y + 120)
    )

    const padding = 40
    const groupId = `group-${Date.now()}`
    const newGroup: NodeGroup = {
      id: groupId,
      name: `分组 ${groups.length + 1}`,
      color: GROUP_COLORS[groups.length % GROUP_COLORS.length].value,
      nodeIds: [...selectedNodeIds],
      collapsed: false,
      position: { x: minX - padding, y: minY - padding - 32 },
      size: {
        width: maxX - minX + padding * 2,
        height: maxY - minY + padding * 2 + 32,
      },
    }

    setGroups((prev) => [...prev, newGroup])
    setSelectedGroupId(groupId)
    setSelectedNodeIds([])
    pushHistory('ADD_GROUP', `创建分组「${newGroup.name}」`)
    showToast('success', `已创建分组「${newGroup.name}」`)
  }, [selectedNodeIds, nodes, groups, setGroups, pushHistory])

  const deleteGroup = useCallback(
    (groupId: string, keepNodes = true) => {
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
        setEdges((eds) =>
          eds.filter(
            (e) =>
              !group.nodeIds.includes(e.source) &&
              !group.nodeIds.includes(e.target)
          )
        )
        pushHistory('DELETE_GROUP', `删除分组「${group.name}」及节点`)
        showToast('info', `已删除分组「${group.name}」及其节点`)
      }
    },
    [groups, selectedGroupId, setGroups, setNodes, setEdges, pushHistory]
  )

  const toggleGroupCollapse = useCallback(
    (groupId: string) => {
      setGroups((prev) =>
        prev.map((g) => {
          if (g.id !== groupId) return g
          return { ...g, collapsed: !g.collapsed }
        })
      )
      const group = groups.find((g) => g.id === groupId)
      if (group) {
        pushHistory(
          'UPDATE_GROUP',
          `${group.collapsed ? '展开' : '折叠'}分组「${group.name}」`
        )
      }
    },
    [groups, setGroups, pushHistory]
  )

  const renameGroup = useCallback(
    (groupId: string, newName: string) => {
      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, name: newName } : g))
      )
      pushHistory('UPDATE_GROUP', '重命名分组')
    },
    [setGroups, pushHistory]
  )

  const changeGroupColor = useCallback(
    (groupId: string, color: string) => {
      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, color } : g))
      )
      pushHistory('UPDATE_GROUP', '修改分组颜色')
    },
    [setGroups, pushHistory]
  )

  const handleGroupNodeDrag = useCallback(
    (
      _event: MouseEvent | TouchEvent,
      node: Node,
      draggedNodes: Node[]
    ) => {
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
    },
    [groups, setNodes, setGroups]
  )

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

    const filteredNodes = nodes.filter(
      (n) => !collapsedGroupNodeIds.has(n.id)
    )
    return [...groupNodesForFlow, ...filteredNodes] as Node[]
  }, [nodes, groups, groupNodesForFlow])

  // ==================== 角色管理 ====================

  const addCharacter = useCallback(
    (character: StoryCharacter) => {
      setCharacters((prev) => [...prev, character])
      showToast('success', `角色「${character.name}」已添加`)
    },
    [setCharacters]
  )

  const updateCharacter = useCallback(
    (character: StoryCharacter) => {
      setCharacters((prev) =>
        prev.map((c) => (c.id === character.id ? character : c))
      )
      showToast('success', `角色「${character.name}」已更新`)
    },
    [setCharacters]
  )

  const deleteCharacter = useCallback(
    (characterId: string) => {
      const char = characters.find((c) => c.id === characterId)
      setCharacters((prev) => prev.filter((c) => c.id !== characterId))
      showToast('info', `角色「${char?.name || ''}」已删除`)
    },
    [characters, setCharacters]
  )

  // ==================== 素材插入 ====================

  const handleInsertAsset = useCallback(
    (asset: LibraryAsset) => {
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
        const characterId = (selectedNode.data as Record<string, unknown>)
          ?.characterId as string | undefined
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
        showToast(
          'success',
          `已将「${asset.name}」添加为角色「${targetChar.name}」的立绘`
        )
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

      showToast('info', `暂不支持插入「${asset.name}」类型的素材`)
    },
    [selectedNode, characters, updateNodeData, updateCharacter, pushHistory]
  )

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    onEdgesChange,
    groups,
    setGroups,
    selectedNodeIds,
    setSelectedNodeIds,
    selectedEdgeId,
    setSelectedEdgeId,
    selectedGroupId,
    setSelectedGroupId,
    selectedNodes,
    selectedNode,
    selectedEdge,
    isEmpty,
    isMultiSelect,
    addNodeAtCenter,
    deleteSelectedNodes,
    deleteNode,
    updateNodeData,
    updateEdgeData,
    onConnect,
    copySelectedNodes,
    pasteNodes,
    duplicateSelectedNodes,
    insertTemplate,
    handleGenerateNodesFromOutline,
    handleGenerateOutlineFromNodes,
    createGroupFromSelection,
    deleteGroup,
    toggleGroupCollapse,
    renameGroup,
    changeGroupColor,
    handleGroupNodeDrag,
    groupNodesForFlow,
    visibleNodes,
    characters,
    setCharacters,
    variables,
    setVariables,
    scenesRef,
    audioRef,
    assetsRef,
    clipboardRef,
    generateNodeId,
    handleInsertAsset,
    addCharacter,
    updateCharacter,
    deleteCharacter,
    screenToFlowPosition,
    fitView,
    getNodes,
  }
}
