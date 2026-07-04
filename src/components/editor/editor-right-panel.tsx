'use client'

import { useState, useCallback, useEffect, memo } from 'react'
import { shallowEqual } from '@editor/lib/utils'
import { Settings, Users, Image, Music, ChevronDown, ChevronUp, X, Plus, Edit3, Layers, BarChart3, Trash2, ShieldCheck, GitBranch, MessageSquare, Activity, Lock, Sparkles } from 'lucide-react'
import { Button } from '@editor/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@editor/components/ui/tabs'
import { LivePreview } from './live-preview'
import { PropertyPanel } from './property-panel'
import { PuzzleEditor } from './puzzle/puzzle-editor'
import { VariablePanel } from './editor-right-panel/variable-panel'
import { QualityPanel } from './quality-panel'
import { VersionPanel } from './version-panel'
import { AnnotationPanel } from './annotation-panel'
import { MemoizedWritingStatsPanel } from './writing-stats-panel'
import { MonetizationSettingsPanel } from './monetization-settings-panel'
import { AiSettingsPanel } from './ai-settings-panel'
import { generateDefaultAvatar } from '@editor/lib/avatar-utils'
import type { StoryNode, StoryCharacter, StoryEdge, StoryVariable, ComicScene, ComicAudio, NodeAnnotation, AnnotationType, StoryGraph } from '@editor/types/editor'
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
}: EditorRightPanelProps) {
  const [previewCollapsed, setPreviewCollapsed] = useState(false)
  const [internalActiveTab, setInternalActiveTab] = useState('properties')
  const [tabGroup, setTabGroup] = useState<'edit' | 'manage'>('edit')
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

  return (
    <div role="region" aria-label="右侧属性面板" className="w-[360px] flex flex-col bg-slate-800 border-l border-slate-700 h-full">
      {!previewCollapsed ? (
        <div className="h-[40%] min-h-[220px] relative border-b border-slate-700 bg-slate-900">
          <LivePreview
            nodes={nodes}
            characters={characters}
            scenes={scenes}
            audios={audios}
            selectedNodeId={selectedNode?.id || null}
            onNodeSelect={onNodeSelect}
          />
          <button
            onClick={() => setPreviewCollapsed(true)}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-full border border-slate-600 p-0.5 transition-colors"
            title="收起预览"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setPreviewCollapsed(false)}
          className="w-full py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white text-xs flex items-center justify-center gap-1 border-b border-slate-600 transition-colors"
        >
          <ChevronUp className="w-3.5 h-3.5" />
          展开预览
        </button>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          <div className="flex items-center gap-1 px-2 py-1.5 bg-slate-900 border-b border-slate-800">
            <button
              onClick={() => { setTabGroup('edit'); setActiveTab('properties') }}
              className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${
                tabGroup === 'edit' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              编辑
            </button>
            <button
              onClick={() => { setTabGroup('manage'); setActiveTab('quality') }}
              className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${
                tabGroup === 'manage' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              管理
            </button>
          </div>
          <TabsList className="w-full justify-start rounded-none border-b border-slate-800 bg-slate-900 p-0 h-10 flex-wrap">
            {tabGroup === 'edit' && (
              <>
                <TabsTrigger
                  value="properties"
                  className="data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-none text-slate-400 h-10 rounded-none px-4 text-xs"
                >
                  <Settings className="w-3.5 h-3.5 mr-1.5" />
                  属性
                </TabsTrigger>
                <TabsTrigger
                  value="characters"
                  className="data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-none text-slate-400 h-10 rounded-none px-4 text-xs"
                >
                  <Users className="w-3.5 h-3.5 mr-1.5" />
                  角色
                </TabsTrigger>
                <TabsTrigger
                  value="scenes"
                  className="data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-none text-slate-400 h-10 rounded-none px-4 text-xs"
                >
                  <Image className="w-3.5 h-3.5 mr-1.5" />
                  场景
                </TabsTrigger>
                <TabsTrigger
                  value="audio"
                  className="data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-none text-slate-400 h-10 rounded-none px-4 text-xs"
                >
                  <Music className="w-3.5 h-3.5 mr-1.5" />
                  音频
                </TabsTrigger>
                <TabsTrigger
                  value="variables"
                  className="data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-none text-slate-400 h-10 rounded-none px-4 text-xs"
                >
                  <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
                  变量
                </TabsTrigger>
              </>
            )}
            {tabGroup === 'manage' && (
              <>
                <TabsTrigger
                  value="quality"
                  className="data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-none text-slate-400 h-10 rounded-none px-4 text-xs"
                >
                  <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                  质量
                </TabsTrigger>
                <TabsTrigger
                  value="versions"
                  className="data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-none text-slate-400 h-10 rounded-none px-4 text-xs"
                >
                  <GitBranch className="w-3.5 h-3.5 mr-1.5" />
                  版本
                </TabsTrigger>
                <TabsTrigger
                  value="annotations"
                  className="data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-none text-slate-400 h-10 rounded-none px-4 text-xs relative"
                >
                  <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                  批注
                  {annotations.length > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-semibold rounded-full bg-blue-500/80 text-white">
                      {annotations.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="stats"
                  className="data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-none text-slate-400 h-10 rounded-none px-4 text-xs"
                >
                  <Activity className="w-3.5 h-3.5 mr-1.5" />
                  统计
                </TabsTrigger>
                <TabsTrigger
                  value="monetization"
                  className="data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-none text-slate-400 h-10 rounded-none px-4 text-xs"
                >
                  <Lock className="w-3.5 h-3.5 mr-1.5" />
                  付费
                </TabsTrigger>
                <TabsTrigger
                  value="ai"
                  className="data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-none text-slate-400 h-10 rounded-none px-4 text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  AI
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="properties" className="flex-1 overflow-y-auto p-0 m-0">
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
            />
          </TabsContent>

          <TabsContent value="characters" className="flex-1 overflow-y-auto p-0 m-0">
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
          </TabsContent>

          <TabsContent value="scenes" className="flex-1 overflow-y-auto p-0 m-0">
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
                  onChange={(e) => {
                    const files = e.target.files
                    if (files) {
                      Array.from(files).forEach((file) => {
                        const url = URL.createObjectURL(file)
                        const name = file.name.replace(/\.[^.]+$/, '')
                        const newScene: ComicScene = {
                          id: `scene-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                          name,
                          backgroundImage: url,
                        }
                        onScenesChange?.([...scenes, newScene])
                      })
                    }
                  }}
                />
                <Image className="w-6 h-6 text-slate-500 mx-auto mb-1" />
                <p className="text-xs text-slate-400">拖拽或点击上传图片</p>
                <p className="text-[10px] text-slate-600 mt-0.5">JPG / PNG / WebP，支持批量</p>
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
          </TabsContent>

          <TabsContent value="audio" className="flex-1 overflow-y-auto p-0 m-0">
            <div className="p-4 space-y-4">
              <h3 className="text-sm font-semibold text-white">音频库</h3>

              <div className="border-2 border-dashed border-slate-700 rounded-lg p-4 text-center hover:border-pink-500/50 transition-colors cursor-pointer relative">
                <input
                  type="file"
                  accept="audio/*"
                  multiple
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => {
                    const files = e.target.files
                    if (files) {
                      Array.from(files).forEach((file) => {
                        const url = URL.createObjectURL(file)
                        const name = file.name.replace(/\.[^.]+$/, '')
                        const newAudio: ComicAudio = {
                          id: `audio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                          name,
                          url,
                          type: audioType,
                        }
                        onAudiosChange?.([...audios, newAudio])
                      })
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
                      <p className="text-[10px] text-slate-500 truncate">{audio.url?.startsWith('blob:') ? '本地文件' : '在线'}</p>
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
          </TabsContent>

          <TabsContent value="variables" className="flex-1 overflow-y-auto p-0 m-0">
            <VariablePanel
              variables={variables}
              onUpdateVariables={onUpdateVariables}
            />
          </TabsContent>

          <TabsContent value="quality" className="flex-1 overflow-hidden p-0 m-0">
            <QualityPanel
              nodes={nodes}
              edges={edges}
              variables={variables}
              onNodeClick={(id) => onNodeSelect?.(id)}
              onEdgeClick={(id) => onEdgeSelect?.(id)}
            />
          </TabsContent>

          <TabsContent value="versions" className="flex-1 overflow-y-auto p-0 m-0">
            <VersionPanel
              versions={versions}
              currentGraph={currentGraph || { nodes, edges, characters, scenes, audios, variables: variables || [], groups: [] }}
              onSaveVersion={onSaveVersion || (() => {})}
              onRestoreVersion={onRestoreVersion || (() => {})}
              onDeleteVersion={onDeleteVersion || (() => {})}
            />
          </TabsContent>

          <TabsContent value="annotations" className="flex-1 overflow-hidden p-0 m-0">
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
          </TabsContent>

          <TabsContent value="stats" className="flex-1 overflow-hidden p-0 m-0">
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
          </TabsContent>
          
          <TabsContent value="monetization" className="flex-1 overflow-y-auto p-4 m-0">
            <MonetizationSettingsPanel
              graph={graph!}
              config={monetization ?? null}
              onChange={onMonetizationChange!}
              workId={workId}
            />
          </TabsContent>
          
          <TabsContent value="ai" className="flex-1 overflow-y-auto p-4 m-0">
            <AiSettingsPanel
              onChange={(config) => {
                localStorage.setItem('subsilicon_ai_config', JSON.stringify(config))
              }}
            />
          </TabsContent>
        </Tabs>
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

function areEditorRightPanelPropsEqual(
  prevProps: EditorRightPanelProps,
  nextProps: EditorRightPanelProps
): boolean {
  if (prevProps.selectedNode?.id !== nextProps.selectedNode?.id) return false
  if (prevProps.selectedEdge?.id !== nextProps.selectedEdge?.id) return false
  if (prevProps.characters.length !== nextProps.characters.length) return false
  if (prevProps.scenes?.length !== nextProps.scenes?.length) return false
  if (prevProps.audios?.length !== nextProps.audios?.length) return false
  if (prevProps.variables?.length !== nextProps.variables?.length) return false
  if (prevProps.nodes.length !== nextProps.nodes.length) return false
  if (prevProps.activeTab !== nextProps.activeTab) return false
  if (prevProps.versions?.length !== nextProps.versions?.length) return false
  if (prevProps.annotations !== nextProps.annotations) return false
  if (prevProps.annotationAuthor !== nextProps.annotationAuthor) return false
  if (prevProps.workId !== nextProps.workId) return false
  return true
}

export const MemoizedEditorRightPanel = memo(EditorRightPanel, areEditorRightPanelPropsEqual)
export { EditorRightPanel }
export default MemoizedEditorRightPanel
