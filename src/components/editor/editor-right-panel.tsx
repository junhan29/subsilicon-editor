'use client'

import { memo, useCallback, useState } from 'react'
import { Activity, BarChart3, ChevronDown, ChevronLeft, ChevronRight, DollarSign, Edit3, GitBranch, Image, Layers, MessageSquare, Music, Plus, Settings, Users, X } from 'lucide-react'
import { showToast } from './toast'
import { useAccessibilityStore } from '@editor/stores/accessibility-store'
import { PropertyPanel } from './property-panel'
import { PuzzleEditor } from './puzzle/puzzle-editor'
import { VariablePanel } from './editor-right-panel/variable-panel'
import { VersionPanel } from './version-panel'
import { AnnotationPanel } from './annotation-panel'
import { MemoizedWritingStatsPanel } from './writing-stats-panel'
import { IncomePanel } from './income-panel'
import { AiMediaPanel } from './ai-media-panel'
import { AnalyticsPanel } from './analytics-panel'
import { PluginManagerPanel } from './plugin-manager-panel'
import { generateDefaultAvatar } from '@editor/lib/avatar-utils'
import type { AnnotationType, ComicAudio, ComicScene, NodeAnnotation, StoryCharacter, StoryEdge, StoryGraph, StoryNode, StoryVariable } from '@editor/types/editor'
import type { StoryGraphSnapshot } from '@editor/lib/history-store'
import type { VersionSnapshot } from '@editor/lib/version-store'
import type { MonetizationConfig } from '@editor/lib/work-monetization'
import { generateWorkId } from '@editor/lib/work-monetization'

interface EditorRightPanelProps {
  selectedNode: StoryNode | null
  selectedEdge: StoryEdge | null
  selectedNodeCount?: number
  characters: StoryCharacter[]
  tags?: string[]
  title?: string
  assets?: { images: string[]; audios: string[]; fonts: string[] }
  variables?: StoryVariable[]
  scenes?: ComicScene[]
  audios?: ComicAudio[]
  nodes: StoryNode[]
  edges: StoryEdge[]
  graph?: StoryGraph
  activeTab?: string
  onTabChange?: (tab: string) => void
  onUpdateNode: (nodeId: string, data: Partial<StoryNode['data']>) => void
  onDeleteNode: (nodeId: string) => void
  onUpdateEdge: (edgeId: string, data: Partial<StoryEdge>) => void
  onDeleteEdge: (edgeId: string) => void
  onAddCharacter: (character: StoryCharacter) => void
  onUpdateCharacter: (character: StoryCharacter) => void
  onDeleteCharacter: (characterId: string) => void
  onUpdateTitle?: (title: string) => void
  onUpdateTags?: (tags: string[]) => void
  onUpdateVariables?: (variables: StoryVariable[]) => void
  onNodeSelect?: (nodeId: string) => void
  onEdgeSelect?: (edgeId: string) => void
  onScenesChange?: (scenes: ComicScene[]) => void
  onAudiosChange?: (audios: ComicAudio[]) => void
  onApplyStory?: (nodes: StoryNode[], edges: StoryEdge[], characters: StoryCharacter[], title: string) => void
  onAddCharacters?: (characters: StoryCharacter[]) => void
  onAddNode?: (type: string, position: { x: number; y: number }, data: Record<string, unknown>) => string | undefined
  onAddEdge?: (source: string, target: string) => string | undefined
  versions?: VersionSnapshot[]
  currentGraph?: StoryGraphSnapshot
  onSaveVersion?: (name: string, description: string) => void
  onRestoreVersion?: (id: string) => void
  onDeleteVersion?: (id: string) => void
  annotations?: NodeAnnotation[]
  annotationAuthor?: string
  onAddAnnotation?: (input: { nodeId: string; type: AnnotationType; text: string; author: string }) => void
  onResolveAnnotation?: (id: string) => void
  onReplyAnnotation?: (id: string, text: string) => void
  onDeleteAnnotation?: (id: string) => void
  onOpenAnnotationDialog?: (nodeId: string) => void
  monetization?: MonetizationConfig | null
  onMonetizationChange?: (config: MonetizationConfig) => void
  workId?: string
  /** 打开素材库（供「管理素材 / 从素材库选择」按钮使用） */
  onOpenAssets?: (tab?: 'images' | 'audios' | 'video') => void
}

// VS Code 风格标签按钮组件
interface TabButtonProps {
  icon: React.FC<{ className?: string }>
  label: string
  tab: string
  activeTab: string
  onSelect: (tab: string) => void
  badge?: number
  className?: string
}

function TabButton({ icon: Icon, label, tab, activeTab, onSelect, badge, className = '' }: TabButtonProps) {
  const isActive = activeTab === tab
  return (
    <button
      onClick={() => onSelect(tab)}
      data-active={isActive}
      title={label || tab}
      className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium whitespace-nowrap transition-colors shrink-0 ${
        isActive
          ? 'bg-slate-800 text-white border-b-2 border-amber-500'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border-b-2 border-transparent'
      } ${className}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
      {badge !== undefined && (
        <span className="inline-flex items-center justify-center min-w-[14px] h-3.5 px-1 text-[9px] font-semibold rounded-full bg-blue-500/80 text-white">
          {badge}
        </span>
      )}
    </button>
  )
}

function EditorRightPanel({
  selectedNode,
  selectedEdge,
  selectedNodeCount = 0,
  characters,
  tags,
  title,
  assets,
  variables,
  scenes = [],
  audios = [],
  nodes,
  edges,
  graph,
  activeTab: activeTabProp,
  onTabChange,
  onUpdateNode,
  onDeleteNode,
  onUpdateEdge,
  onDeleteEdge,
  onAddCharacter,
  onUpdateCharacter,
  onDeleteCharacter,
  onUpdateTitle,
  onUpdateTags,
  onUpdateVariables,
  onNodeSelect,
  onEdgeSelect,
  onScenesChange,
  onAudiosChange,
  onApplyStory,
  onAddCharacters,
  onAddNode,
  onAddEdge,
  versions = [],
  currentGraph,
  onSaveVersion,
  onRestoreVersion,
  onDeleteVersion,
  annotations = [],
  annotationAuthor = '匿名创作者',
  onAddAnnotation,
  onResolveAnnotation,
  onReplyAnnotation,
  onDeleteAnnotation,
  onOpenAnnotationDialog,
  monetization,
  onMonetizationChange,
  workId = generateWorkId(),
  onOpenAssets,
}: EditorRightPanelProps) {
  const [internalActiveTab, setInternalActiveTab] = useState('properties')
  const activeTab = activeTabProp ?? internalActiveTab
  const setActiveTab = (tab: string) => {
    if (onTabChange) {
      onTabChange(tab)
    } else {
      setInternalActiveTab(tab)
    }
  }
  const [sceneName, setSceneName] = useState('')
  const [sceneImage, setSceneImage] = useState('')
  const [audioName, setAudioName] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [audioType, setAudioType] = useState<'bgm' | 'sfx'>('bgm')
  const [editingScene, setEditingScene] = useState<ComicScene | null>(null)
  const [showPuzzleEditor, setShowPuzzleEditor] = useState(false)
  const [editCharId, setEditCharId] = useState<string>('')

  // ADHD 适配：精简界面开启时，tab 条按「内容 / 管理」两组折叠展示
  const compactInterface = useAccessibilityStore((s) => s.compactInterface)
  const [contentCollapsed, setContentCollapsed] = useState(false)
  const [manageCollapsed, setManageCollapsed] = useState(false)

  // tab 分组定义（compact 模式下分组折叠，普通模式保持原有单行顺序）
  const CONTENT_TABS = ['properties', 'characters', 'scenes', 'audio', 'variables']
  const MANAGE_TABS = ['versions', 'annotations', 'stats', 'income', 'analytics', 'plugins']

  const toggleGroup = useCallback(
    (group: 'content' | 'manage') => {
      const groupTabs = group === 'content' ? CONTENT_TABS : MANAGE_TABS
      const collapsing = group === 'content' ? !contentCollapsed : !manageCollapsed
      if (group === 'content') {
        setContentCollapsed(collapsing)
      } else {
        setManageCollapsed(collapsing)
      }
      // 折叠某组时，若当前激活 tab 在该组内，切换到另一组第一个 tab，避免内容与标签不一致
      if (collapsing && groupTabs.includes(activeTab)) {
        setActiveTab(group === 'content' ? MANAGE_TABS[0] : CONTENT_TABS[0])
      }
    },
    [contentCollapsed, manageCollapsed, activeTab]
  )

  const addScene = useCallback(() => {
    if (!sceneName.trim()) return
    const newScene: ComicScene = {
      id: `scene-${Date.now()}`,
      name: sceneName,
      backgroundImage: sceneImage || `https://picsum.photos/seed/${sceneName}/800/600`,
    }
    onScenesChange?.([...scenes, newScene])
    setSceneName('')
    setSceneImage('')
  }, [sceneName, sceneImage, scenes, onScenesChange])

  const deleteScene = useCallback((id: string) => {
    onScenesChange?.(scenes.filter((s) => s.id !== id))
  }, [scenes, onScenesChange])

  const addAudio = useCallback(() => {
    if (!audioName.trim()) return
    const newAudio: ComicAudio = {
      id: `audio-${Date.now()}`,
      name: audioName,
      type: audioType,
      url: audioUrl || '',
      loop: audioType === 'bgm',
    }
    onAudiosChange?.([...audios, newAudio])
    setAudioName('')
    setAudioUrl('')
  }, [audioName, audioUrl, audioType, audios, onAudiosChange])

  const deleteAudio = useCallback((id: string) => {
    onAudiosChange?.(audios.filter((a) => a.id !== id))
  }, [audios, onAudiosChange])

  const handleEditScene = useCallback((scene: ComicScene) => {
    setEditingScene(scene)
    setShowPuzzleEditor(true)
  }, [])

  const handleSaveScene = useCallback((updatedScene: ComicScene) => {
    if (!scenes) return
    const newScenes = scenes.map((s) => (s.id === updatedScene.id ? updatedScene : s))
    onScenesChange?.(newScenes)
    setShowPuzzleEditor(false)
    setEditingScene(null)
  }, [scenes, onScenesChange])

  const handleNewPuzzleScene = useCallback(() => {
    const name = sceneName.trim() || `场景 ${scenes.length + 1}`
    const newScene: ComicScene = {
      id: `scene-${Date.now()}`,
      name,
      backgroundImage: sceneImage || `https://picsum.photos/seed/${name}/800/600`,
    }
    onScenesChange?.([...scenes, newScene])
    setSceneName('')
    setSceneImage('')
    setEditingScene(newScene)
    setShowPuzzleEditor(true)
  }, [sceneName, sceneImage, scenes, onScenesChange])

  // tab 按钮组（分组后仍复用原有 TabButton 样式）
  const contentTabs = (
    <>
      <TabButton icon={Settings} label="属性" tab="properties" activeTab={activeTab} onSelect={setActiveTab} />
      <TabButton icon={Users} label="角色" tab="characters" activeTab={activeTab} onSelect={setActiveTab} />
      <TabButton icon={Image} label="场景" tab="scenes" activeTab={activeTab} onSelect={setActiveTab} />
      <TabButton icon={Music} label="音频" tab="audio" activeTab={activeTab} onSelect={setActiveTab} />
      <TabButton icon={BarChart3} label="变量" tab="variables" activeTab={activeTab} onSelect={setActiveTab} />
    </>
  )
  const manageTabs = (
    <>
      <TabButton icon={GitBranch} label="版本" tab="versions" activeTab={activeTab} onSelect={setActiveTab} />
      <TabButton icon={MessageSquare} label="批注" tab="annotations" activeTab={activeTab} onSelect={setActiveTab}
        badge={annotations.length > 0 ? annotations.length : undefined} />
      <TabButton icon={Activity} label="统计" tab="stats" activeTab={activeTab} onSelect={setActiveTab} />
      <TabButton icon={DollarSign} label="收益" tab="income" activeTab={activeTab} onSelect={setActiveTab} />
      <TabButton icon={BarChart3} label="分析" tab="analytics" activeTab={activeTab} onSelect={setActiveTab} />
      <TabButton icon={Layers} label="插件" tab="plugins" activeTab={activeTab} onSelect={setActiveTab} />
    </>
  )

  return (
    <div role="region" aria-label="右侧属性面板" className="w-[300px] flex flex-col bg-slate-800 border-l border-slate-700 h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* VS Code 风格标签栏：单行紧凑标签，图标+文字 */}
        {compactInterface ? (
          /* ADHD 适配：精简界面开启时，tab 条分为「内容 / 管理」两组，每组可折叠 */
          <div className="border-b border-slate-800 bg-slate-900 shrink-0">
            <div className="flex items-center px-2 py-1.5 border-b border-slate-800/60">
              <button
                onClick={() => toggleGroup('content')}
                className="flex items-center gap-1 text-[10px] font-semibold text-slate-300 hover:text-white transition-colors"
                aria-expanded={!contentCollapsed}
              >
                <ChevronDown className={`w-3 h-3 transition-transform ${contentCollapsed ? '-rotate-90' : ''}`} />
                内容
              </button>
            </div>
            {!contentCollapsed && (
              <div className="flex items-center overflow-x-auto scrollbar-none">
                {contentTabs}
              </div>
            )}
            <div className="flex items-center px-2 py-1.5 border-y border-slate-800/60">
              <button
                onClick={() => toggleGroup('manage')}
                className="flex items-center gap-1 text-[10px] font-semibold text-slate-300 hover:text-white transition-colors"
                aria-expanded={!manageCollapsed}
              >
                <ChevronDown className={`w-3 h-3 transition-transform ${manageCollapsed ? '-rotate-90' : ''}`} />
                管理
              </button>
            </div>
            {!manageCollapsed && (
              <div className="flex items-center overflow-x-auto scrollbar-none">
                {manageTabs}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center border-b border-slate-800 bg-slate-900 overflow-x-auto scrollbar-none shrink-0">
            {contentTabs}
            <div className="w-px h-5 bg-slate-700 mx-1 shrink-0" />
            {manageTabs}
          </div>
        )}

          {activeTab === 'properties' && <div className="flex-1 overflow-y-auto p-0">
            <PropertyPanel
              selectedNode={selectedNode}
              selectedEdge={selectedEdge}
              selectedNodeCount={selectedNodeCount}
              characters={characters}
              tags={tags}
              title={title}
              assets={assets}
              scenes={scenes}
              variables={variables}
              editCharId={editCharId}
              onOpenAssets={onOpenAssets}
              onUpdateNode={onUpdateNode}
              onDeleteNode={onDeleteNode}
              onUpdateEdge={onUpdateEdge}
              onDeleteEdge={onDeleteEdge}
              onAddCharacter={onAddCharacter}
              onUpdateCharacter={onUpdateCharacter}
              onDeleteCharacter={onDeleteCharacter}
              onUpdateTitle={onUpdateTitle}
              onUpdateTags={onUpdateTags}
              onUpdateVariables={onUpdateVariables}
              annotations={annotations.filter((a) => a.nodeId === selectedNode?.id)}
              onAddAnnotation={(nodeId) => onOpenAnnotationDialog?.(nodeId)}
              onViewAnnotations={() => setActiveTab('annotations')}
              graph={graph}
            />
          </div>}

          {activeTab === 'characters' && <div className="flex-1 overflow-y-auto p-0 m-0">
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">角色管理</h3>
                <button
                  onClick={() => {
                    const color = '#ec4899'
                    const charName = `角色${characters.length + 1}`
                    const newChar = {
                      id: `char-${Date.now()}`,
                      name: charName,
                      avatar: generateDefaultAvatar(charName, color),
                      color,
                      gender: 'unknown' as const,
                      age: '',
                      occupation: '',
                      personality: [],
                      appearance: [],
                      background: '',
                      speech: { tone: '', catchphrases: [] },
                      skills: [],
                      motivation: '',
                      habits: [],
                      fears: [],
                      relations: [],
                      tags: [],
                      bio: '',
                    }
                    onAddCharacter(newChar)
                    setEditCharId(newChar.id)
                    setActiveTab('properties')
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-pink-500 hover:bg-pink-600 text-white rounded-md transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  新建角色
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { name: '热血少年', color: '#3b82f6', gender: 'male' as const },
                  { name: '高冷御姐', color: '#8b5cf6', gender: 'female' as const },
                  { name: '呆萌可爱', color: '#ec4899', gender: 'female' as const },
                  { name: '神秘老者', color: '#6b7280', gender: 'male' as const },
                  { name: '元气少女', color: '#f43f5e', gender: 'female' as const },
                ].map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => {
                      const newChar = {
                        id: `char-${Date.now()}`,
                        name: preset.name,
                        avatar: generateDefaultAvatar(preset.name, preset.color),
                        color: preset.color,
                        gender: preset.gender,
                        age: '',
                        occupation: '',
                        personality: [],
                        appearance: [],
                        background: '',
                        speech: { tone: '', catchphrases: [] },
                        skills: [],
                        motivation: '',
                        habits: [],
                        fears: [],
                        relations: [],
                        tags: [],
                        bio: '',
                      }
                      onAddCharacter(newChar)
                      setEditCharId(newChar.id)
                      setActiveTab('properties')
                    }}
                    className="px-2 py-1 text-[10px] rounded-md border border-slate-600 bg-slate-700/50 hover:bg-slate-700 transition-colors"
                    style={{ color: preset.color }}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {characters.map((char) => (
                  <div
                    key={char.id}
                    onClick={() => {
                      setEditCharId(char.id)
                      setActiveTab('properties')
                    }}
                    className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg border border-slate-600/50 hover:border-pink-500/50 cursor-pointer transition-colors"
                  >
                    <img src={char.avatar} alt={char.name} className="w-10 h-10 rounded-full object-cover border-2" style={{ borderColor: char.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{char.name}</p>
                      <p className="text-xs text-slate-400">{char.occupation || '未设定'} · {char.gender === 'male' ? '男' : char.gender === 'female' ? '女' : '其他'}</p>
                    </div>
                    <span className="text-xs text-slate-500">{char.personality?.slice?.(0, 2).join('、') || '无标签'}</span>
                  </div>
                ))}
                {characters.length === 0 && (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    暂无角色，点击上方按钮添加
                  </div>
                )}
              </div>
            </div>
          </div>}

          {activeTab === 'scenes' && <div className="flex-1 overflow-y-auto p-0 m-0">
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">场景库</h3>
                <button
                  onClick={() => {
                    const name = `场景 ${scenes.length + 1}`
                    const newScene: ComicScene = {
                      id: `scene-${Date.now()}`,
                      name,
                      backgroundImage: `https://picsum.photos/seed/${name}/800/600`,
                    }
                    onScenesChange?.([...scenes, newScene])
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-pink-500 hover:bg-pink-600 text-white rounded-md transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  新建场景
                </button>
              </div>

              <div className="border-2 border-dashed border-slate-700 rounded-lg p-4 text-center hover:border-pink-500/50 transition-colors cursor-pointer relative">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={async (e) => {
                    const files = e.target.files
                    if (files) {
                      const fileArray = Array.from(files)
                      const newScenes: ComicScene[] = []
                      for (let i = 0; i < fileArray.length; i++) {
                        const file = fileArray[i]
                        if (file.size > 10 * 1024 * 1024) {
                          showToast('error', `${file.name} 超过 10MB，已跳过`)
                          continue
                        }
                        const base64 = await new Promise<string>((resolve, reject) => {
                          const reader = new FileReader()
                          reader.onload = () => resolve(reader.result as string)
                          reader.onerror = reject
                          reader.readAsDataURL(file)
                        })
                        const name = file.name.replace(/\.[^.]+$/, '')
                        newScenes.push({
                          id: `scene-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                          name,
                          backgroundImage: base64,
                        })
                      }
                      onScenesChange?.([...scenes, ...newScenes])
                    }
                  }}
                />
                <Image className="w-6 h-6 text-slate-500 mx-auto mb-1" />
                <p className="text-xs text-slate-400">拖拽或点击上传图片</p>
                <p className="text-[10px] text-slate-600 mt-0.5">JPG / PNG / WebP，支持批量</p>
              </div>

              {/* 创境媒体生成 */}
              <div className="border border-slate-700 rounded-lg p-3 bg-slate-800/30">
                <AiMediaPanel
                  characters={characters}
                  onImageGenerated={(url, name) => {
                    const newScene: ComicScene = {
                      id: `scene-${Date.now()}`,
                      name: `创境生成-${name.slice(0, 20)}`,
                      backgroundImage: url,
                    }
                    onScenesChange?.([...scenes, newScene])
                    showToast('success', '已添加到场景库')
                  }}
                />
              </div>

              <div className="space-y-2">
                {scenes.map((scene) => (
                  <div
                    key={scene.id}
                    className="relative group rounded-lg overflow-hidden border border-slate-700 hover:border-pink-500/50 transition-colors"
                  >
                    <div className="relative h-24">
                      <img src={scene.backgroundImage} alt={scene.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                      {scene.puzzleData && (
                        <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 bg-pink-500/80 rounded text-[9px] text-white">
                          <Layers className="w-2.5 h-2.5" />
                          拼图
                        </div>
                      )}
                      <button
                        onClick={() => deleteScene(scene.id)}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 bg-black/60 hover:bg-red-500/80 rounded transition-all"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                      <button
                        onClick={() => handleEditScene(scene)}
                        className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 bg-pink-500 hover:bg-pink-600 text-white rounded text-[10px] transition-all"
                      >
                        <Edit3 className="w-2.5 h-2.5" />
                        {scene.puzzleData ? '编辑' : '拼图'}
                      </button>
                    </div>
                    <div className="p-2 bg-slate-800/50">
                      <p className="text-xs font-medium text-white truncate">{scene.name}</p>
                      {scene.puzzleData && (
                        <p className="text-[10px] text-slate-500">{scene.puzzleData.layers?.length ?? 0} 个图层</p>
                      )}
                    </div>
                  </div>
                ))}
                {scenes.length === 0 && (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    暂无场景，上传图片即可创建
                  </div>
                )}
              </div>
            </div>
          </div>}

          {activeTab === 'audio' && <div className="flex-1 overflow-y-auto p-0 m-0">
            <div className="p-4 space-y-4">
              <h3 className="text-sm font-semibold text-white">音频库</h3>

              <div className="border-2 border-dashed border-slate-700 rounded-lg p-4 text-center hover:border-pink-500/50 transition-colors cursor-pointer relative">
                <input
                  type="file"
                  accept="audio/*"
                  multiple
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={async (e) => {
                    const files = e.target.files
                    if (files) {
                      const fileArray = Array.from(files)
                      const newAudios: ComicAudio[] = []
                      for (let i = 0; i < fileArray.length; i++) {
                        const file = fileArray[i]
                        if (file.size > 50 * 1024 * 1024) {
                          showToast('error', `${file.name} 超过 50MB，已跳过`)
                          continue
                        }
                        const base64 = await new Promise<string>((resolve, reject) => {
                          const reader = new FileReader()
                          reader.onload = () => resolve(reader.result as string)
                          reader.onerror = reject
                          reader.readAsDataURL(file)
                        })
                        const name = file.name.replace(/\.[^.]+$/, '')
                        newAudios.push({
                          id: `audio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                          name,
                          url: base64,
                          type: audioType,
                          loop: audioType === 'bgm',
                        })
                      }
                      onAudiosChange?.([...audios, ...newAudios])
                    }
                  }}
                />
                <Music className="w-6 h-6 text-slate-500 mx-auto mb-1" />
                <p className="text-xs text-slate-400">拖拽或点击上传音频</p>
                <p className="text-[10px] text-slate-600 mt-0.5">MP3 / WAV / OGG</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setAudioType('bgm')}
                  className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${
                    audioType === 'bgm'
                      ? 'bg-pink-500/20 text-pink-400 border border-pink-500/50'
                      : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                  }`}
                >
                  BGM ({audios.filter((a) => a.type === 'bgm').length})
                </button>
                <button
                  onClick={() => setAudioType('sfx')}
                  className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${
                    audioType === 'sfx'
                      ? 'bg-pink-500/20 text-pink-400 border border-pink-500/50'
                      : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                  }`}
                >
                  音效 ({audios.filter((a) => a.type === 'sfx').length})
                </button>
              </div>

              <div className="space-y-1.5">
                {audios.filter((a) => a.type === audioType).length === 0 && (
                  <div className="text-center py-6 text-slate-600 text-xs">
                    暂无{audioType === 'bgm' ? '背景音乐' : '音效'}
                  </div>
                )}
                {audios.filter((a) => a.type === audioType).map((audio) => (
                  <div key={audio.id} className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg border border-slate-700 group">
                    <div className="w-8 h-8 rounded-md bg-purple-500/20 flex items-center justify-center shrink-0">
                      <Music className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{audio.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{audio.url?.startsWith('data:') ? '本地文件' : '在线'}</p>
                    </div>
                    <button
                      onClick={() => deleteAudio(audio.id)}
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>}

          {activeTab === 'variables' && <div className="flex-1 overflow-y-auto p-0 m-0">
            <VariablePanel
              variables={variables}
              onUpdateVariables={onUpdateVariables}
            />
          </div>}

          {activeTab === 'versions' && <div className="flex-1 overflow-y-auto p-0">
            <VersionPanel
              versions={versions}
              currentGraph={currentGraph || { nodes, edges, characters, scenes, audios, variables: variables || [], groups: [] }}
              onSaveVersion={onSaveVersion || (() => {})}
              onRestoreVersion={onRestoreVersion || (() => {})}
              onDeleteVersion={onDeleteVersion || (() => {})}
            />
          </div>}

          {activeTab === 'annotations' && <div className="flex-1 overflow-hidden p-0 m-0">
            <AnnotationPanel
              annotations={annotations}
              nodes={nodes}
              defaultAuthor={annotationAuthor}
              selectedNodeId={selectedNode?.id || null}
              onAddAnnotation={onAddAnnotation}
              onResolveAnnotation={onResolveAnnotation}
              onReplyAnnotation={onReplyAnnotation}
              onDeleteAnnotation={onDeleteAnnotation}
              onNodeSelect={onNodeSelect}
            />
          </div>}

          {activeTab === 'stats' && <div className="flex-1 overflow-hidden p-0 m-0">
            <MemoizedWritingStatsPanel
              workId={workId}
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
                      if (typeof optObj.text === 'string') {
                        count += optObj.text.length
                      }
                    }
                  }
                }
                return acc + count
              }, 0)}
            />
          </div>}
          
          {activeTab === 'income' && <div className="flex-1 overflow-y-auto p-4 m-0">
            <IncomePanel
              graph={graph}
              workId={workId}
            />
          </div>}
          
          {activeTab === 'analytics' && <div className="flex-1 overflow-hidden p-0 m-0">
            <AnalyticsPanel />
          </div>}

          {activeTab === 'plugins' && <div className="flex-1 overflow-hidden p-0 m-0">
            <PluginManagerPanel />
          </div>}
        </div>

      {showPuzzleEditor && editingScene && (
        <PuzzleEditor
          scene={editingScene}
          characters={characters}
          onClose={() => {
            setShowPuzzleEditor(false)
            setEditingScene(null)
          }}
          onSave={handleSaveScene}
        />
      )}
    </div>
  )
}

function areEditorRightPanelPropsEqual(prev: EditorRightPanelProps, next: EditorRightPanelProps) {
  return prev.nodes === next.nodes &&
         prev.scenes === next.scenes &&
         prev.audios === next.audios &&
         prev.variables === next.variables &&
         prev.selectedNode === next.selectedNode &&
         prev.selectedEdge === next.selectedEdge
}

export const MemoizedEditorRightPanel = memo(EditorRightPanel, areEditorRightPanelPropsEqual)
export { EditorRightPanel }
export default MemoizedEditorRightPanel
