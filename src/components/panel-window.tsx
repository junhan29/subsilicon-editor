'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Settings, Users, Image, Music, X, Plus, BarChart3, GitBranch, MessageSquare, Activity, MoveHorizontal, AlertTriangle } from 'lucide-react'
import { PropertyPanel } from './editor/property-panel'
import { VariablePanel } from './editor/editor-right-panel/variable-panel'
import { VersionPanel } from './editor/version-panel'
import { AnnotationPanel } from './editor/annotation-panel'
import { MemoizedWritingStatsPanel } from './editor/writing-stats-panel'
import { generateDefaultAvatar } from '@editor/lib/avatar-utils'
import { initTheme, subscribeTheme, type Theme } from '@editor/lib/theme-manager'
import type { StoryNode, StoryCharacter, StoryEdge, StoryVariable, ComicScene, ComicAudio, NodeAnnotation, AnnotationType, StoryGraph, CharacterGender } from '@editor/types/editor'
import type { VersionSnapshot } from '@editor/lib/version-store'

const PANEL_STATE_KEY = 'subsilicon_panel_state'

interface PanelUIState {
  activeTab: string
  tabGroup: 'edit' | 'manage'
}

interface PanelState {
  selectedNode: StoryNode | null
  selectedEdge: StoryEdge | null
  selectedNodeCount: number
  characters: StoryCharacter[]
  tags: string[]
  title: string
  variables: StoryVariable[]
  scenes: ComicScene[]
  audios: ComicAudio[]
  nodes: StoryNode[]
  edges: StoryEdge[]
  graph?: StoryGraph
  versions: VersionSnapshot[]
  annotations: NodeAnnotation[]
  annotationAuthor: string
  workId: string
}

function loadPanelUIState(): PanelUIState | null {
  try {
    const raw = localStorage.getItem(PANEL_STATE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function savePanelUIState(state: PanelUIState) {
  try {
    localStorage.setItem(PANEL_STATE_KEY, JSON.stringify(state))
  } catch {}
}

const emptyState: PanelState = {
  selectedNode: null,
  selectedEdge: null,
  selectedNodeCount: 0,
  characters: [],
  tags: [],
  title: '',
  variables: [],
  scenes: [],
  audios: [],
  nodes: [],
  edges: [],
  versions: [],
  annotations: [],
  annotationAuthor: '匿名创作者',
  workId: 'default',
}

const TAB_CONFIG = {
  edit: [
    { id: 'properties', icon: Settings, label: '属性', tip: '编辑选中节点的内容' },
    { id: 'characters', icon: Users, label: '角色', tip: '管理故事中的角色' },
    { id: 'scenes', icon: Image, label: '场景', tip: '管理背景图片' },
    { id: 'audio', icon: Music, label: '音频', tip: '管理背景音乐和音效' },
    { id: 'variables', icon: BarChart3, label: '变量', tip: '设置故事中的变量和记数' },
  ],
  manage: [
    { id: 'versions', icon: GitBranch, label: '版本', tip: '保存和恢复历史版本' },
    { id: 'annotations', icon: MessageSquare, label: '批注', badgeKey: 'annotations', tip: '给节点添加备注和待办' },
    { id: 'data', icon: Activity, label: '数据', tip: '查看创作统计' },
  ],
}

/** 数据面板：创作统计 */
function DataPanel({ workId, nodes }: { workId: string; nodes: StoryNode[] }) {
  return (
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
  )
}

export function PanelWindow() {
  const [activeTab, setActiveTab] = useState('properties')
  const [tabGroup, setTabGroup] = useState<'edit' | 'manage'>('edit')
  const [theme, setTheme] = useState<Theme>('dark')
  const [state, setState] = useState<PanelState>(emptyState)
  const [editCharId, setEditCharId] = useState('')
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const tabsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const initial = initTheme()
    setTheme(initial)
    const unsub = subscribeTheme((t) => setTheme(t))
    return unsub
  }, [])

  useEffect(() => {
    const saved = loadPanelUIState()
    if (saved) {
      setActiveTab(saved.activeTab)
      setTabGroup(saved.tabGroup)
    }
  }, [])

  useEffect(() => {
    savePanelUIState({ activeTab, tabGroup })
  }, [activeTab, tabGroup])

  useEffect(() => {
    const api = window.__electronAPI
    if (!api) return

    const unsubscribe = api.onMainMessage((message) => {
      console.log('[PanelWindow] received message:', message.action)
      const payload = message.payload as Partial<PanelState>
      setState((prev) => ({
        ...prev,
        ...payload,
      }))
    })

    return unsubscribe
  }, [])

  const switchTab = useCallback((newTab: string, newGroup: 'edit' | 'manage') => {
    setActiveTab(newTab)
    setTabGroup(newGroup)
    setEditCharId('')
  }, [])

  const sendAction = useCallback((action: string, payload: unknown) => {
    window.__electronAPI?.sendPanelMessage({ action, payload })
  }, [])

  const handleUpdateNode = useCallback((nodeId: string, data: Partial<StoryNode['data']>) => {
    sendAction('updateNode', { nodeId, data })
  }, [sendAction])

  const handleDeleteNode = useCallback((nodeId: string) => {
    sendAction('deleteNode', { nodeId })
  }, [sendAction])

  const handleUpdateEdge = useCallback((edgeId: string, data: Partial<StoryEdge>) => {
    sendAction('updateEdge', { edgeId, data })
  }, [sendAction])

  const handleDeleteEdge = useCallback((edgeId: string) => {
    sendAction('deleteEdge', { edgeId })
  }, [sendAction])

  const handleAddCharacter = useCallback((character: StoryCharacter) => {
    sendAction('addCharacter', { character })
  }, [sendAction])

  const handleUpdateCharacter = useCallback((character: StoryCharacter) => {
    sendAction('updateCharacter', { character })
  }, [sendAction])

  const handleDeleteCharacter = useCallback((characterId: string) => {
    sendAction('deleteCharacter', { characterId })
  }, [sendAction])

  const handleUpdateTitle = useCallback((title: string) => {
    sendAction('updateTitle', { title })
  }, [sendAction])

  const handleUpdateTags = useCallback((tags: string[]) => {
    sendAction('updateTags', { tags })
  }, [sendAction])

  const handleUpdateVariables = useCallback((variables: StoryVariable[]) => {
    sendAction('updateVariables', { variables })
  }, [sendAction])

  const handleNodeSelect = useCallback((nodeId: string) => {
    sendAction('nodeSelect', { nodeId })
  }, [sendAction])

  const handleEdgeSelect = useCallback((edgeId: string) => {
    sendAction('edgeSelect', { edgeId })
  }, [sendAction])

  const handleScenesChange = useCallback((scenes: ComicScene[]) => {
    sendAction('scenesChange', { scenes })
    setState((prev) => ({ ...prev, scenes }))
  }, [sendAction])

  const handleAudiosChange = useCallback((audios: ComicAudio[]) => {
    sendAction('audiosChange', { audios })
    setState((prev) => ({ ...prev, audios }))
  }, [sendAction])

  const handleSaveVersion = useCallback((name: string, description: string) => {
    sendAction('saveVersion', { name, description })
  }, [sendAction])

  const handleRestoreVersion = useCallback((id: string) => {
    sendAction('restoreVersion', { id })
  }, [sendAction])

  const handleDeleteVersion = useCallback((id: string) => {
    sendAction('deleteVersion', { id })
  }, [sendAction])

  const handleAddAnnotation = useCallback((input: { nodeId: string; type: AnnotationType; text: string; author: string }) => {
    sendAction('addAnnotation', input)
  }, [sendAction])

  const handleResolveAnnotation = useCallback((id: string) => {
    sendAction('resolveAnnotation', { id })
  }, [sendAction])

  const handleReplyAnnotation = useCallback((id: string, text: string) => {
    sendAction('replyAnnotation', { id, text })
  }, [sendAction])

  const handleDeleteAnnotation = useCallback((id: string) => {
    sendAction('deleteAnnotation', { id })
  }, [sendAction])

  const handleCloseClick = useCallback(() => {
    setShowCloseConfirm(true)
  }, [])

  const handleConfirmClose = useCallback(() => {
    setShowCloseConfirm(false)
    window.__electronAPI?.closePanelWindow()
  }, [])

  const handleCancelClose = useCallback(() => {
    setShowCloseConfirm(false)
  }, [])

  const handleTabKeyDown = useCallback((e: React.KeyboardEvent, tabId: string, group: 'edit' | 'manage') => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      switchTab(tabId, group)
    }
  }, [switchTab])

  const createNewCharacter = (name: string, color: string, gender: CharacterGender = 'unknown') => {
    return {
      id: `char-${Date.now()}`,
      name,
      avatar: generateDefaultAvatar(name, color),
      color,
      gender,
      age: '',
      occupation: '',
      personality: [] as string[],
      appearance: [] as string[],
      background: '',
      speech: { tone: '', catchphrases: [] as string[] },
      skills: [] as string[],
      motivation: '',
      habits: [] as string[],
      fears: [] as string[],
      relations: [] as { targetId: string; relation: string }[],
      tags: [] as string[],
      bio: '',
    }
  }

  const isDark = theme === 'dark'
  const bg = isDark ? 'bg-slate-800' : 'bg-white'
  const bgAlt = isDark ? 'bg-slate-900' : 'bg-gray-50'
  const borderColor = isDark ? 'border-slate-700' : 'border-gray-200'
  const textColor = isDark ? 'text-white' : 'text-gray-900'
  const textMuted = isDark ? 'text-slate-400' : 'text-gray-500'
  const textDim = isDark ? 'text-slate-500' : 'text-gray-400'
  const hoverBg = isDark ? 'hover:bg-slate-800/50' : 'hover:bg-gray-100'
  const activeBg = isDark ? 'bg-slate-700' : 'bg-gray-200'
  const cardBg = isDark ? 'bg-slate-700/30' : 'bg-gray-50'
  const cardBorder = isDark ? 'border-slate-600/50' : 'border-gray-200'

  return (
    <div className={`h-screen flex flex-col ${bg} ${textColor}`}>
      {/* 标题栏 */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${bgAlt} ${borderColor}`}>
        <div className="flex items-center gap-2">
          <MoveHorizontal className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
          <span className={`text-sm font-medium ${textColor}`}>管理面板</span>
        </div>
        <button
          onClick={handleCloseClick}
          className={`p-1.5 rounded-md transition-colors ${isDark ? 'hover:bg-red-500/20 text-gray-400 hover:text-red-400' : 'hover:bg-red-50 text-gray-400 hover:text-red-500'}`}
          title="关闭面板"
          aria-label="关闭面板"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 关闭确认弹窗 */}
      {showCloseConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleCancelClose}>
          <div
            className={`mx-4 p-5 rounded-xl shadow-xl ${isDark ? 'bg-slate-800 border border-slate-600' : 'bg-white border border-gray-300'}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isDark ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className={`text-sm font-medium mb-1 ${textColor}`}>关闭管理面板？</p>
                <p className={`text-xs ${textMuted}`}>面板窗口将被关闭，创作数据不受影响。</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleCancelClose}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${isDark ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
              >
                取消
              </button>
              <button
                onClick={handleConfirmClose}
                className="px-3 py-1.5 text-xs rounded-md bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                确认关闭
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex flex-col h-full">
          {/* 编辑/管理分组切换 */}
          <div className={`flex items-center gap-1 px-2 py-1.5 border-b ${bgAlt} ${borderColor}`}>
            <button
              onClick={() => switchTab('properties', 'edit')}
              tabIndex={0}
              className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${
                tabGroup === 'edit' ? `${activeBg} ${textColor}` : `${textMuted} ${hoverBg}`
              }`}
            >
              编辑
            </button>
            <button
              onClick={() => switchTab('versions', 'manage')}
              tabIndex={0}
              className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${
                tabGroup === 'manage' ? `${activeBg} ${textColor}` : `${textMuted} ${hoverBg}`
              }`}
            >
              管理
            </button>
          </div>

          {/* 子标签页（支持键盘导航） */}
          <div className={`w-full flex flex-wrap border-b ${bgAlt} ${borderColor}`} ref={tabsRef} role="tablist">
            {TAB_CONFIG[tabGroup].map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                tabIndex={activeTab === tab.id ? 0 : -1}
                onClick={() => { switchTab(tab.id, tabGroup) }}
                onKeyDown={(e) => handleTabKeyDown(e, tab.id, tabGroup)}
                title={tab.tip}
                className={`flex items-center px-3 py-2 text-xs transition-colors ${
                  activeTab === tab.id
                    ? `${isDark ? 'bg-slate-800' : 'bg-white'} ${textColor}`
                    : `${textMuted} ${hoverBg}`
                }`}
              >
                <tab.icon className="w-3.5 h-3.5 mr-1.5" />
                {tab.label}
                {'badgeKey' in tab && tab.badgeKey && state[tab.badgeKey as keyof PanelState] && Array.isArray(state[tab.badgeKey as keyof PanelState]) && (state[tab.badgeKey as keyof PanelState] as unknown[]).length > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-semibold rounded-full bg-blue-500/80 text-white">
                    {(state[tab.badgeKey as keyof PanelState] as unknown[]).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* 面板内容区域 */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'properties' && (
              <PropertyPanel
                selectedNode={state.selectedNode}
                selectedEdge={state.selectedEdge}
                selectedNodeCount={state.selectedNodeCount}
                characters={state.characters}
                tags={state.tags}
                title={state.title}
                scenes={state.scenes}
                variables={state.variables}
                editCharId={editCharId}
                onUpdateNode={handleUpdateNode}
                onDeleteNode={handleDeleteNode}
                onUpdateEdge={handleUpdateEdge}
                onDeleteEdge={handleDeleteEdge}
                onAddCharacter={handleAddCharacter}
                onUpdateCharacter={handleUpdateCharacter}
                onDeleteCharacter={handleDeleteCharacter}
                onUpdateTitle={handleUpdateTitle}
                onUpdateTags={handleUpdateTags}
                onUpdateVariables={handleUpdateVariables}
                annotations={state.annotations.filter((a) => a.nodeId === state.selectedNode?.id)}
                onAddAnnotation={() => {}}
                onViewAnnotations={() => switchTab('annotations', 'manage')}
              />
            )}

            {activeTab === 'characters' && (
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className={`text-sm font-semibold ${textColor}`}>角色管理</h3>
                  <button
                    onClick={() => {
                      const newChar = createNewCharacter(`角色${state.characters.length + 1}`, '#ec4899')
                      handleAddCharacter(newChar)
                      setEditCharId(newChar.id)
                      switchTab('properties', 'edit')
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
                        const newChar = createNewCharacter(preset.name, preset.color, preset.gender)
                        handleAddCharacter(newChar)
                        setEditCharId(newChar.id)
                        switchTab('properties', 'edit')
                      }}
                      className={`px-2 py-1 text-xs rounded-md border transition-colors ${cardBg} ${cardBorder} hover:border-pink-500/50`}
                      style={{ color: preset.color }}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  {state.characters.map((char) => (
                    <div
                      key={char.id}
                      tabIndex={0}
                      role="button"
                      aria-label={`编辑角色 ${char.name}`}
                      onClick={() => {
                        setEditCharId(char.id)
                        switchTab('properties', 'edit')
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setEditCharId(char.id)
                          switchTab('properties', 'edit')
                        }
                      }}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${cardBg} ${cardBorder} hover:border-pink-500/50`}
                    >
                      <img src={char.avatar} alt={char.name} className="w-10 h-10 rounded-full object-cover border-2 shrink-0" style={{ borderColor: char.color }} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${textColor}`}>{char.name}</p>
                        <p className={`text-xs ${textMuted}`}>
                          {char.occupation || '未设定'}
                          {' · '}
                          {char.gender === 'male' ? '男' : char.gender === 'female' ? '女' : '其他'}
                          {char.personality.length > 0 && ` · ${char.personality.slice(0, 2).join('、')}${char.personality.length > 2 ? '…' : ''}`}
                        </p>
                        {(char.background && char.background.length > 0) && (
                          <p className={`text-[10px] ${textDim} truncate mt-0.5`} title={char.background}>
                            {char.background.slice(0, 60)}{char.background.length > 60 ? '…' : ''}
                          </p>
                        )}
                      </div>
                      <span className={`text-xs shrink-0 ${textDim}`}>
                        {char.personality.length > 0 ? `${char.personality.length} 标签` : '无标签'}
                      </span>
                    </div>
                  ))}
                  {state.characters.length === 0 && (
                    <div className={`text-center py-8 text-sm ${textDim}`}>
                      暂无角色，点击上方按钮添加
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'scenes' && (
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className={`text-sm font-semibold ${textColor}`}>场景库</h3>
                  <button
                    onClick={() => {
                      const name = `场景 ${state.scenes.length + 1}`
                      const newScene: ComicScene = {
                        id: `scene-${Date.now()}`,
                        name,
                        backgroundImage: `https://picsum.photos/seed/${name}/800/600`,
                      }
                      handleScenesChange([...state.scenes, newScene])
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-pink-500 hover:bg-pink-600 text-white rounded-md transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    新建场景
                  </button>
                </div>

                <div className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer relative transition-colors ${isDark ? 'border-slate-700 hover:border-pink-500/50' : 'border-gray-200 hover:border-pink-300'}`}>
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
                          handleScenesChange([...state.scenes, newScene])
                        })
                      }
                    }}
                  />
                  <Image className={`w-6 h-6 mx-auto mb-1 ${textDim}`} />
                  <p className={`text-xs ${textMuted}`}>拖拽或点击上传图片</p>
                  <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>JPG / PNG / WebP，支持批量</p>
                </div>

                <div className="space-y-2">
                  {state.scenes.map((scene) => (
                    <div
                      key={scene.id}
                      className={`relative group rounded-lg overflow-hidden border transition-colors ${isDark ? 'border-slate-700 hover:border-pink-500/50' : 'border-gray-200 hover:border-pink-300'}`}
                    >
                      <div className="relative h-24">
                        <img src={scene.backgroundImage} alt={scene.name} className="w-full h-full object-cover" loading="lazy" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                        <button
                          onClick={() => {
                            handleScenesChange(state.scenes.filter((s) => s.id !== scene.id))
                          }}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 bg-black/60 hover:bg-red-500/80 rounded transition-all"
                          title="删除场景"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                      <div className={`p-2 ${isDark ? 'bg-slate-800/50' : 'bg-gray-50'}`}>
                        <p className={`text-xs font-medium truncate ${textColor}`}>{scene.name}</p>
                      </div>
                    </div>
                  ))}
                  {state.scenes.length === 0 && (
                    <div className={`text-center py-8 text-sm ${textDim}`}>
                      暂无场景，上传图片即可创建
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'audio' && (
              <div className="p-4 space-y-4">
                <h3 className={`text-sm font-semibold ${textColor}`}>音频库</h3>

                <div className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer relative transition-colors ${isDark ? 'border-slate-700 hover:border-pink-500/50' : 'border-gray-200 hover:border-pink-300'}`}>
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
                            type: 'bgm',
                          }
                          handleAudiosChange([...state.audios, newAudio])
                        })
                      }
                    }}
                  />
                  <Music className={`w-6 h-6 mx-auto mb-1 ${textDim}`} />
                  <p className={`text-xs ${textMuted}`}>拖拽或点击上传音频</p>
                  <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>MP3 / WAV / OGG</p>
                </div>

                <div className="flex gap-2">
                  {(['bgm', 'sfx'] as Array<'bgm' | 'sfx'>).map((type) => (
                    <button
                      key={type}
                      onClick={() => {}}
                      className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${
                        type === 'bgm' && state.audios.filter((a) => a.type === 'bgm').length > 0
                          ? 'bg-pink-500/20 text-pink-400 border border-pink-500/50'
                          : type === 'sfx' && state.audios.filter((a) => a.type === 'sfx').length > 0
                          ? 'bg-pink-500/20 text-pink-400 border border-pink-500/50'
                          : (isDark ? 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600' : 'bg-gray-100 text-gray-600 border border-gray-200 hover:border-gray-300')
                      }`}
                    >
                      {type === 'bgm' ? 'BGM' : '音效'} ({state.audios.filter((a) => a.type === type).length})
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  {state.audios.length === 0 && (
                    <div className={`text-center py-6 text-xs ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>
                      暂无音频
                    </div>
                  )}
                  {state.audios.map((audio) => (
                    <div key={audio.id} className={`flex items-center gap-2 p-2 rounded-lg border group ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
                      <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${isDark ? 'bg-purple-500/20' : 'bg-purple-500/10'}`}>
                        <Music className="w-3.5 h-3.5 text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${textColor}`}>{audio.name}</p>
                        <p className={`text-[10px] truncate ${textDim}`}>
                          {audio.type === 'bgm' ? 'BGM' : '音效'}
                          {audio.url?.startsWith('blob:') ? ' · 本地' : audio.url ? ' · 在线' : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => handleAudiosChange(state.audios.filter((a) => a.id !== audio.id))}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity p-1"
                        title="删除音频"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'variables' && (
              <VariablePanel
                variables={state.variables}
                onUpdateVariables={handleUpdateVariables}
              />
            )}



            {activeTab === 'versions' && (
              <VersionPanel
                versions={state.versions}
                currentGraph={{ nodes: state.nodes, edges: state.edges, characters: state.characters, scenes: state.scenes, audios: state.audios, variables: state.variables || [], groups: [] }}
                onSaveVersion={handleSaveVersion}
                onRestoreVersion={handleRestoreVersion}
                onDeleteVersion={handleDeleteVersion}
              />
            )}

            {activeTab === 'annotations' && (
              <AnnotationPanel
                annotations={state.annotations}
                nodes={state.nodes}
                defaultAuthor={state.annotationAuthor}
                selectedNodeId={state.selectedNode?.id || null}
                onAddAnnotation={handleAddAnnotation}
                onResolveAnnotation={handleResolveAnnotation}
                onReplyAnnotation={handleReplyAnnotation}
                onDeleteAnnotation={handleDeleteAnnotation}
                onNodeSelect={handleNodeSelect}
              />
            )}

            {activeTab === 'data' && (
              <DataPanel
                workId={state.workId}
                nodes={state.nodes}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
