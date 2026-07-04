import { create } from 'zustand'
import type { StoryNode, StoryEdge, StoryCharacter, StoryVariable, ComicScene, ComicAudio, NodeGroup, NodeAnnotation } from '@editor/types/editor'
import type { MonetizationConfig } from '@editor/lib/work-monetization'
import type { VersionSnapshot } from '@editor/lib/version-store'
import type { StoryGraphSnapshot } from '@editor/lib/history-store'

/**
 * 编辑器画布全局状态 Store
 *
 * 用于消除 story-canvas → editor-right-panel → property-panel 的 Props 透传链。
 * 右侧面板和各子面板可以直接从 Store 读取状态，不需要逐层传递。
 */

interface EditorCanvasState {
  // === 选中状态 ===
  selectedNodeIds: string[]
  selectedEdgeId: string | null
  selectedGroupId: string | null

  // === 选中对象（从 nodes/edges 中派生） ===
  selectedNode: StoryNode | null
  selectedEdge: StoryEdge | null

  // === 面板状态 ===
  activeTab: string
  sidebarVisible: boolean
  rightPanelVisible: boolean

  // === 编辑器元数据 ===
  title: string
  tags: string[]
  workId?: string

  // === 面板操作回调（由 story-canvas 注入） ===
  _onUpdateNode?: (nodeId: string, data: Partial<StoryNode['data']>) => void
  _onDeleteNode?: (nodeId: string) => void
  _onUpdateEdge?: (edgeId: string, data: Partial<StoryEdge>) => void
  _onDeleteEdge?: (edgeId: string) => void
  _onAddCharacter?: (character: StoryCharacter) => void
  _onUpdateCharacter?: (character: StoryCharacter) => void
  _onDeleteCharacter?: (characterId: string) => void
  _onUpdateTitle?: (title: string) => void
  _onUpdateTags?: (tags: string[]) => void
  _onUpdateVariables?: (variables: StoryVariable[]) => void
  _onNodeSelect?: (nodeId: string) => void
  _onEdgeSelect?: (edgeId: string) => void

  // === Actions ===
  setSelectedNodeIds: (ids: string[]) => void
  setSelectedEdgeId: (id: string | null) => void
  setSelectedGroupId: (id: string | null) => void
  setSelectedNode: (node: StoryNode | null) => void
  setSelectedEdge: (edge: StoryEdge | null) => void
  setActiveTab: (tab: string) => void
  setSidebarVisible: (visible: boolean) => void
  setRightPanelVisible: (visible: boolean) => void
  setTitle: (title: string) => void
  setTags: (tags: string[]) => void
  setWorkId: (id: string | undefined) => void

  // 注入操作回调
  injectCallbacks: (callbacks: {
    onUpdateNode?: (nodeId: string, data: Partial<StoryNode['data']>) => void
    onDeleteNode?: (nodeId: string) => void
    onUpdateEdge?: (edgeId: string, data: Partial<StoryEdge>) => void
    onDeleteEdge?: (edgeId: string) => void
    onAddCharacter?: (character: StoryCharacter) => void
    onUpdateCharacter?: (character: StoryCharacter) => void
    onDeleteCharacter?: (characterId: string) => void
    onUpdateTitle?: (title: string) => void
    onUpdateTags?: (tags: string[]) => void
    onUpdateVariables?: (variables: StoryVariable[]) => void
    onNodeSelect?: (nodeId: string) => void
    onEdgeSelect?: (edgeId: string) => void
  }) => void

  // 代理操作（调用注入的回调）
  updateNode: (nodeId: string, data: Partial<StoryNode['data']>) => void
  deleteNode: (nodeId: string) => void
  updateEdge: (edgeId: string, data: Partial<StoryEdge>) => void
  deleteEdge: (edgeId: string) => void
  addCharacter: (character: StoryCharacter) => void
  updateCharacter: (character: StoryCharacter) => void
  deleteCharacter: (characterId: string) => void
  updateTitle: (title: string) => void
  updateTags: (tags: string[]) => void
  updateVariables: (variables: StoryVariable[]) => void
  nodeSelect: (nodeId: string) => void
  edgeSelect: (edgeId: string) => void
}

export const useEditorCanvasStore = create<EditorCanvasState>((set, get) => ({
  // === 初始状态 ===
  selectedNodeIds: [],
  selectedEdgeId: null,
  selectedGroupId: null,
  selectedNode: null,
  selectedEdge: null,

  activeTab: 'properties',
  sidebarVisible: true,
  rightPanelVisible: true,

  title: '未命名故事',
  tags: [],
  workId: undefined,

  // === Actions ===
  setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids }),
  setSelectedEdgeId: (id) => set({ selectedEdgeId: id }),
  setSelectedGroupId: (id) => set({ selectedGroupId: id }),
  setSelectedNode: (node) => set({ selectedNode: node }),
  setSelectedEdge: (edge) => set({ selectedEdge: edge }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSidebarVisible: (visible) => set({ sidebarVisible: visible }),
  setRightPanelVisible: (visible) => set({ rightPanelVisible: visible }),
  setTitle: (title) => set({ title }),
  setTags: (tags) => set({ tags }),
  setWorkId: (id) => set({ workId: id }),

  injectCallbacks: (callbacks) => set(callbacks as any),

  // === 代理操作 ===
  updateNode: (nodeId, data) => get()._onUpdateNode?.(nodeId, data),
  deleteNode: (nodeId) => get()._onDeleteNode?.(nodeId),
  updateEdge: (edgeId, data) => get()._onUpdateEdge?.(edgeId, data),
  deleteEdge: (edgeId) => get()._onDeleteEdge?.(edgeId),
  addCharacter: (character) => get()._onAddCharacter?.(character),
  updateCharacter: (character) => get()._onUpdateCharacter?.(character),
  deleteCharacter: (characterId) => get()._onDeleteCharacter?.(characterId),
  updateTitle: (title) => get()._onUpdateTitle?.(title),
  updateTags: (tags) => get()._onUpdateTags?.(tags),
  updateVariables: (variables) => get()._onUpdateVariables?.(variables),
  nodeSelect: (nodeId) => get()._onNodeSelect?.(nodeId),
  edgeSelect: (edgeId) => get()._onEdgeSelect?.(edgeId),
}))

/**
 * 编辑器数据状态 Store
 *
 * 存储从 story-canvas 传入的只读数据，供右侧面板各子面板读取。
 * story-canvas 在状态变化时调用 setData 更新。
 */
interface EditorDataState {
  nodes: StoryNode[]
  edges: StoryEdge[]
  characters: StoryCharacter[]
  variables: StoryVariable[]
  scenes: ComicScene[]
  audios: ComicAudio[]
  groups: NodeGroup[]
  annotations: NodeAnnotation[]
  monetization: MonetizationConfig | null
  versions: VersionSnapshot[]
  currentGraph: StoryGraphSnapshot | null
  assets: { images: string[]; audios: string[]; fonts: string[] }

  setData: (data: Partial<EditorDataState>) => void
}

export const useEditorDataStore = create<EditorDataState>((set) => ({
  nodes: [],
  edges: [],
  characters: [],
  variables: [],
  scenes: [],
  audios: [],
  groups: [],
  annotations: [],
  monetization: null,
  versions: [],
  currentGraph: null,
  assets: { images: [], audios: [], fonts: [] },

  setData: (data) => set(data),
}))
