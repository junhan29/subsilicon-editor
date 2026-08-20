'use client'

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import {
  AlignLeft,
  ChevronLeft,
  ChevronRight,
  FileText,
  Film,
  Flag,
  GitBranch,
  GripVertical,
  Layers,
  Library,
  Lightbulb,
  Lock,
  Merge,
  MessageCircle,
  Pencil,
  Plus,
  Save,
  Shuffle,
  Sparkles,
  SplitSquareVertical,
  Trash2,
  User,
  X,
  Zap,
} from 'lucide-react'
import { Button } from '@editor/components/ui/button'
import { Input } from '@editor/components/ui/input'
import { createTemplateFromSelection, deleteTemplate, getOfficialTemplates, loadTemplates, saveTemplate } from '@editor/lib/template-store'
import { generateNodesFromOutline, parseOutline } from '@editor/lib/outline-parser'
import { showToast } from './toast'
import { useAccessibilityStore } from '@editor/stores/accessibility-store'
import { AssetLibraryPanel } from './asset-library-panel'
import type { NodeTemplate, StoryCharacter, StoryEdge, StoryNode } from '@editor/types/editor'
import type { LibraryAsset } from '@editor/lib/asset-library'

export interface SidebarNodeType {
  type: string
  label: string
  icon: React.ReactNode
  description: string
}

// 节点视觉语义映射：每个侧边栏缩略图标盒对应画布节点的主色 + 装饰特征
const NODE_STYLE_MAP: Record<string, { tint: string; border: string; label: string }> = {
  dialogue:  { tint: 'bg-gold-400/15',    border: 'border-gold-400/40',       label: '金' },
  narration: { tint: 'bg-gold-50/80 dark:bg-gold-900/15', border: 'border-gold-300/40 dark:border-gold-700/40', label: '条' },
  choice:    { tint: 'bg-gold-400/20',    border: 'border-gold-400/50',       label: '叉' },
  gather:    { tint: 'bg-cyber-cyan-400/12', border: 'border-cyber-cyan-400/35', label: '汇' },
  condition: { tint: 'bg-cyber-cyan-400/15', border: 'border-cyber-cyan-400/45', label: '判' },
  unlock:    { tint: 'bg-p5-red/12',      border: 'border-p5-red/45',          label: '锁' },
  ending:    { tint: 'bg-p5-red/15',      border: 'border-p5-red/50',          label: '终' },
  cg:        { tint: 'bg-cyber-magenta-400/12', border: 'border-cyber-magenta-400/40', label: '相' },
  jump:      { tint: 'bg-p5-red/12',      border: 'border-p5-red/40',          label: '电' },
  random:    { tint: 'bg-cyber-cyan-400/14', border: 'border-cyber-cyan-400/40', label: '骰' },
  group:     { tint: 'bg-slate-200/50 dark:bg-slate-700/40', border: 'border-slate-400/40', label: '组' },
}

const NODE_TYPES: SidebarNodeType[] = [
  {
    type: 'dialogue',
    label: '对话',
    icon: <MessageCircle className="w-5 h-5 text-gold-500" strokeWidth={2.1} />,
    description: '角色台词与对话',
  },
  {
    type: 'narration',
    label: '旁白',
    icon: <AlignLeft className="w-5 h-5 text-gold-600 dark:text-gold-500" strokeWidth={2.1} />,
    description: '叙述与环境描写',
  },
  {
    type: 'choice',
    label: '选择',
    icon: <GitBranch className="w-5 h-5 text-gold-500" strokeWidth={2.2} />,
    description: '玩家分支选择',
  },
  {
    type: 'gather',
    label: '汇聚',
    icon: <Merge className="w-5 h-5 text-cyber-cyan-500" strokeWidth={2.2} />,
    description: '多分支汇聚到一处',
  },
  {
    type: 'condition',
    label: '条件',
    icon: <SplitSquareVertical className="w-5 h-5 text-cyber-cyan-500" strokeWidth={2.2} />,
    description: '按条件判断分支',
  },
  {
    type: 'unlock',
    label: '付费',
    icon: <Lock className="w-5 h-5 text-p5-red" strokeWidth={2.1} />,
    description: '付费解锁内容',
  },
  {
    type: 'ending',
    label: '结局',
    icon: <Flag className="w-5 h-5 text-p5-red" strokeWidth={2.2} />,
    description: '故事结局节点',
  },
  {
    type: 'cg',
    label: 'CG过场',
    icon: <Film className="w-5 h-5 text-cyber-magenta-500" strokeWidth={2} />,
    description: '图片/视频过场动画',
  },
  {
    type: 'jump',
    label: '跳转',
    icon: <Zap className="w-5 h-5 text-p5-red" strokeWidth={2.3} />,
    description: '跳转到指定节点',
  },
  {
    type: 'random',
    label: '随机',
    icon: <Shuffle className="w-5 h-5 text-cyber-cyan-500" strokeWidth={2.2} />,
    description: '随机选择分支',
  },
]

type TabKey = 'nodes' | 'templates' | 'outline' | 'assets'

interface EditorSidebarProps {
  onQuickAdd: (type: string) => void
  outline?: string
  onOutlineChange?: (text: string) => void
  selectedNodes?: StoryNode[]
  selectedEdges?: StoryEdge[]
  selectedNode?: StoryNode | null
  onInsertTemplate?: (template: NodeTemplate, centerX: number, centerY: number) => void
  onSaveTemplate?: () => void
  onGenerateNodesFromOutline?: (outlineText: string) => void
  onGenerateOutlineFromNodes?: () => string | undefined
  onInsertAsset?: (asset: LibraryAsset) => void
  characters?: StoryCharacter[]
}

function EditorSidebar({
  onQuickAdd,
  outline: outlineProp,
  onOutlineChange,
  selectedNodes = [],
  selectedEdges = [],
  selectedNode,
  onInsertTemplate,
  onGenerateNodesFromOutline,
  onGenerateOutlineFromNodes,
  onInsertAsset,
  characters = [],
}: EditorSidebarProps) {
  useReactFlow()
  const [activeTab, setActiveTab] = useState<TabKey>('nodes')
  const [showTip, setShowTip] = useState(true)
  const [customTemplates, setCustomTemplates] = useState<NodeTemplate[]>([])
  const [officialTemplates, setOfficialTemplates] = useState<NodeTemplate[]>([])
  const [internalOutline, setInternalOutline] = useState('')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateDesc, setTemplateDesc] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false)
  const [pendingNodeCount, setPendingNodeCount] = useState(0)
  const editInputRef = useRef<HTMLInputElement>(null)

  // ADHD 适配：精简界面开启时，节点库默认只显示常用 3 种，可展开查看全部
  const compactInterface = useAccessibilityStore((s) => s.compactInterface)
  const [showAllNodes, setShowAllNodes] = useState(false)
  const COMMON_NODE_TYPES = ['dialogue', 'choice', 'ending']
  const visibleNodeTypes = compactInterface && !showAllNodes
    ? NODE_TYPES.filter((n) => COMMON_NODE_TYPES.includes(n.type))
    : NODE_TYPES

  const outline = outlineProp !== undefined ? outlineProp : internalOutline
  const handleOutlineChange = onOutlineChange || setInternalOutline

  useEffect(() => {
    setCustomTemplates(loadTemplates())
    setOfficialTemplates(getOfficialTemplates())
  }, [])

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  const onDragStart = useCallback(
    (event: React.DragEvent, nodeType: string) => {
      event.dataTransfer.setData('application/reactflow', nodeType)
      event.dataTransfer.effectAllowed = 'move'
    },
    []
  )

  const onTemplateDragStart = useCallback(
    (event: React.DragEvent, template: NodeTemplate) => {
      event.dataTransfer.setData('application/subsilicon-template', JSON.stringify(template))
      event.dataTransfer.effectAllowed = 'move'
    },
    []
  )

  const handleSaveAsTemplate = useCallback(() => {
    if (selectedNodes.length === 0) {
      showToast('info', '请先选中要保存的节点')
      return
    }
    setTemplateName('')
    setTemplateDesc('')
    setShowSaveDialog(true)
  }, [selectedNodes.length])

  const confirmSaveTemplate = useCallback(() => {
    if (!templateName.trim()) {
      showToast('info', '请输入模板名称')
      return
    }
    const template = createTemplateFromSelection(
      templateName.trim(),
      templateDesc.trim() || undefined,
      selectedNodes,
      selectedEdges,
    )
    saveTemplate(template)
    setCustomTemplates(loadTemplates())
    setShowSaveDialog(false)
    setTemplateName('')
    setTemplateDesc('')
    showToast('success', '模板已保存')
  }, [templateName, templateDesc, selectedNodes, selectedEdges])

  const handleDeleteTemplate = useCallback((id: string) => {
    deleteTemplate(id)
    setCustomTemplates(loadTemplates())
    showToast('info', '模板已删除')
  }, [])

  const handleStartRename = useCallback((template: NodeTemplate) => {
    setEditingId(template.id)
    setEditingName(template.name)
  }, [])

  const handleConfirmRename = useCallback(() => {
    if (!editingId || !editingName.trim()) {
      setEditingId(null)
      return
    }
    const templates = loadTemplates()
    const tpl = templates.find((t) => t.id === editingId)
    if (tpl) {
      tpl.name = editingName.trim()
      saveTemplate(tpl)
      setCustomTemplates(loadTemplates())
    }
    setEditingId(null)
    setEditingName('')
  }, [editingId, editingName])

  const handleTemplateDoubleClick = useCallback(
    (template: NodeTemplate) => {
      if (onInsertTemplate) {
        const centerX = window.innerWidth / 2 - 100
        const centerY = window.innerHeight / 2 - 80
        onInsertTemplate(template, centerX, centerY)
      }
    },
    [onInsertTemplate]
  )

  const handleGenerateNodes = useCallback(() => {
    if (!outline.trim()) {
      showToast('info', '请先输入大纲内容')
      return
    }
    const items = parseOutline(outline)
    if (items.length === 0) {
      showToast('info', '未解析到有效的大纲内容')
      return
    }
    const { nodes } = generateNodesFromOutline(items)
    setPendingNodeCount(nodes.length)
    setShowGenerateConfirm(true)
  }, [outline])

  const confirmGenerateNodes = useCallback(() => {
    if (onGenerateNodesFromOutline) {
      onGenerateNodesFromOutline(outline)
    }
    setShowGenerateConfirm(false)
    setPendingNodeCount(0)
  }, [onGenerateNodesFromOutline, outline])

  const handleGenerateOutline = useCallback(() => {
    if (onGenerateOutlineFromNodes) {
      const result = onGenerateOutlineFromNodes()
      if (result !== undefined) {
        handleOutlineChange(result)
        showToast('success', '已从节点生成大纲')
      }
    }
  }, [onGenerateOutlineFromNodes, handleOutlineChange])

  const tabs = [
    { key: 'nodes' as TabKey, label: '节点', icon: <Layers className="w-3.5 h-3.5" /> },
    { key: 'templates' as TabKey, label: '模板', icon: <Save className="w-3.5 h-3.5" /> },
    { key: 'outline' as TabKey, label: '大纲', icon: <FileText className="w-3.5 h-3.5" /> },
    { key: 'assets' as TabKey, label: '素材', icon: <Library className="w-3.5 h-3.5" /> },
  ]

  return (
    <div role="region" aria-label="左侧工具栏" className="min-w-0 border-r border-border bg-card flex flex-col shrink-0 relative">
      {/* 订书钉装饰 - 顶栏 */}
      <div className="absolute top-0 left-6 w-4 h-1.5 bg-slate-400/55 rounded-b-[1px] z-20" />
      <div className="absolute top-0 right-10 w-4 h-1.5 bg-slate-400/55 rounded-b-[1px] z-20" />

      <div className="px-2 pt-2.5 pb-2 border-b border-border flex items-center justify-between">
        <div role="tablist" aria-label="工具栏标签" className="flex bg-muted rounded-[2px] p-0.5 flex-1 border border-border/60 shadow-[2px_2px_0_hsl(var(--gold)/0.1)]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              aria-controls={`panel-${tab.key}`}
              id={`tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`
                flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-semibold rounded-[2px] transition-all tracking-wide
                ${activeTab === tab.key
                  ? 'bg-background text-foreground shadow-[2px_2px_0_hsl(var(--gold)/0.22)] border border-gold-400/30 -m-px'
                  : 'text-muted-foreground hover:text-foreground/80 hover:bg-background/40'
                }
              `}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'nodes' && (
        <div className="flex-1 overflow-y-auto flex flex-col">
          <div className="px-3 py-2 border-b border-border bg-gold-400/5 flex items-center gap-2">
            <GripVertical className="w-3 h-3 text-gold-500 shrink-0" />
            <p className="text-[10px] font-semibold text-foreground/80 tracking-wide">拖拽到画布添加节点</p>
            <span className="ml-auto text-[9px] font-black text-gold-600 dark:text-gold-500/80 bg-gold-400/15 border border-gold-400/30 px-1.5 py-[1px] rounded-[1px] tracking-tighter">
              10
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {visibleNodeTypes.map((node) => {
              const style = NODE_STYLE_MAP[node.type] ?? NODE_STYLE_MAP.dialogue
              return (
                <div
                  key={node.type}
                  draggable
                  onDragStart={(e) => onDragStart(e, node.type)}
                  className="flex items-center gap-2.5 p-2 rounded-[2px]
                    clip-path-polygon-[0_0,calc(100%-8px)_0,100%_8px,100%_100%,0_100%]
                    border border-border bg-background
                    hover:border-dashed hover:border-gold-400/45 hover:bg-gold-400/[0.04]
                    cursor-grab active:cursor-grabbing transition-all group relative
                    shadow-[3px_3px_0_hsl(var(--gold)/0.1)]
                    hover:shadow-[4px_4px_0_hsl(var(--gold)/0.16)]"
                  title={node.description}
                >
                  {/* 差异化图标盒：按节点语义色 + 迷你装饰徽章 */}
                  <div className={`w-8 h-8 rounded-[2px] flex items-center justify-center shrink-0 group-hover:scale-[1.03] transition-transform relative ${style.tint} border ${style.border} shadow-[1px_1px_0_rgba(0,0,0,0.05)]`}>
                    {node.icon}
                    {/* 迷你印章角标（节点识别的决定性特征，左上1~2字母） */}
                    <span className={`absolute -top-1 -left-1 text-[8px] font-black leading-none px-[3px] py-[1px] rounded-[1px] border tracking-tighter
                      ${node.type === 'ending' || node.type === 'unlock' || node.type === 'jump'
                        ? 'bg-p5-red/15 border-p5-red/55 text-p5-red rotate-[-8deg]'
                        : node.type === 'cg'
                          ? 'bg-cyber-magenta-400/12 border-cyber-magenta-400/50 text-cyber-magenta-500 rotate-[6deg]'
                          : node.type === 'condition' || node.type === 'gather' || node.type === 'random'
                            ? 'bg-cyber-cyan-400/12 border-cyber-cyan-400/50 text-cyber-cyan-500 rotate-[-5deg]'
                            : 'bg-gold-400/15 border-gold-400/50 text-gold-600 dark:text-gold-500 rotate-[7deg]'
                      }`}>
                      {style.label}
                    </span>
                    {/* 节点特色迷你装饰（画布节点对应语言的小尺寸再现） */}
                    {node.type === 'gather' && (
                      <div className="absolute -top-0.5 right-1 w-2.5 h-0.5 bg-slate-500/60 rounded-b-[1px]" /> // 订书钉
                    )}
                    {node.type === 'narration' && (
                      <div className="absolute -right-0.5 -bottom-0.5 w-2 h-2 bg-gold-400/70 rotate-12 rounded-[1px]" /> // 纸条折角
                    )}
                    {node.type === 'random' && (
                      <span className="absolute -bottom-1 -right-1 text-[8px]">⚅</span> // 骰子
                    )}
                    {node.type === 'cg' && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2 bg-white border border-slate-300/70 rounded-[1px] shadow-[1px_1px_0_rgba(0,0,0,0.1)]" /> // 拍立得白边
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-foreground truncate tracking-wide">{node.label}</p>
                    <p className="text-[9px] text-muted-foreground truncate leading-tight mt-[1px]">{node.description}</p>
                  </div>
                  <GripVertical className="w-3 h-3 text-muted-foreground/25 group-hover:text-muted-foreground/60 transition-colors shrink-0" />
                </div>
              )
            })}
            {compactInterface && (
              <button
                onClick={() => setShowAllNodes((v) => !v)}
                className="w-full flex items-center justify-center gap-1 py-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground hover:text-gold-600 dark:hover:text-gold-500 hover:bg-gold-400/8 rounded-[2px] border-2 border-dashed border-border/70 hover:border-gold-400/40 transition-all"
              >
                {showAllNodes ? '收起，仅显示常用' : '全部节点'}
              </button>
            )}
          </div>

          {showTip && (
            <div className="mx-2.5 mb-2 px-2.5 py-2 rounded-lg bg-primary/5 border border-primary/20 relative">
              <button
                onClick={() => setShowTip(false)}
                className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full hover:bg-primary/10 flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <span className="text-[10px]">×</span>
              </button>
              <div className="flex items-start gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-gold-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-medium">小技巧</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5 leading-relaxed">
                    拖动节点底部圆点到另一个节点顶部，即可创建连线
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="flex-1 overflow-y-auto flex flex-col">
          <div className="px-3 py-2.5 border-b flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">节点片段模板</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              title="保存选中节点为模板"
              onClick={handleSaveAsTemplate}
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-3">
            <div>
              <div className="flex items-center gap-1 mb-1.5 px-0.5">
                <Sparkles className="w-3 h-3 text-blue-500" />
                <span className="text-[9px] font-medium text-blue-600">官方模板</span>
              </div>
              <div className="space-y-1.5">
                {officialTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    draggable
                    onDragStart={(e) => onTemplateDragStart(e, tpl)}
                    onClick={() => handleTemplateDoubleClick(tpl)}
                    className="flex items-center gap-2 p-2 rounded-lg border border-blue-200/50 bg-blue-50/30 hover:bg-blue-100/50 hover:border-blue-300/70 cursor-pointer group transition-all"
                    title={`${tpl.description}（点击插入）`}
                  >
                    <div className="w-7 h-7 rounded-md bg-blue-100 flex items-center justify-center shrink-0 group-hover:bg-blue-200 transition-colors">
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate text-foreground">{tpl.name}</p>
                      <p className="text-[9px] text-muted-foreground truncate">{tpl.nodes.length} 个节点</p>
                    </div>
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 shrink-0">
                      官方
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1 mb-1.5 px-0.5">
                <User className="w-3 h-3 text-muted-foreground" />
                <span className="text-[9px] font-medium text-muted-foreground">我的模板</span>
              </div>
              <div className="space-y-1.5">
                {customTemplates.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground bg-background/50 rounded-lg border border-dashed border-border">
                    <Save className="w-5 h-5 mx-auto mb-1.5 opacity-30" />
                    <p className="text-[10px]">暂无自定义模板</p>
                    <p className="text-[9px] mt-0.5">选中节点后点击 + 保存</p>
                  </div>
                )}

                {customTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    draggable={editingId !== tpl.id}
                    onDragStart={(e) => onTemplateDragStart(e, tpl)}
                    onClick={() => handleTemplateDoubleClick(tpl)}
                    className="flex items-center gap-2 p-2 rounded-lg border border-border/60 bg-background hover:bg-accent/50 hover:border-border cursor-pointer group transition-all relative"
                    title={`${tpl.description}（点击插入）`}
                  >
                    <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0 group-hover:bg-accent transition-colors">
                      <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {editingId === tpl.id ? (
                        <Input
                          ref={editInputRef}
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={handleConfirmRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleConfirmRename()
                            } else if (e.key === 'Escape') {
                              setEditingId(null)
                            }
                          }}
                          className="h-5 text-xs px-1.5 py-0"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <p className="text-xs font-medium truncate">{tpl.name}</p>
                      )}
                      <p className="text-[9px] text-muted-foreground truncate">{tpl.nodes.length} 个节点</p>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStartRename(tpl)
                        }}
                        title="重命名"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteTemplate(tpl.id)
                        }}
                        title="删除"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t p-2.5">
            <p className="text-[9px] text-muted-foreground text-center leading-relaxed">
              拖拽模板到画布添加，双击快速插入
            </p>
          </div>
        </div>
      )}

      {activeTab === 'outline' && (
        <div className="flex-1 overflow-y-auto flex flex-col">
          <div className="px-3 py-2.5 border-b">
            <p className="text-[10px] text-muted-foreground">故事大纲</p>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5">
            <textarea
              placeholder={`在这里写故事大纲...\n\n## 第一章\n- 开场介绍主角\n- 主角遇到神秘人\n  - 选择相信\n  - 选择拒绝\n- 两人一起出发\n\n## 第二章\n- 到达目的地\n- 最终结局`}
              className="w-full h-full resize-none text-xs leading-relaxed bg-background border border-border/60 rounded-md p-2.5 focus:outline-none focus:ring-1 focus:ring-primary/50"
              value={outline}
              onChange={(e) => handleOutlineChange(e.target.value)}
            />
          </div>

          <div className="border-t p-2.5 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="default"
                size="sm"
                className="h-7 text-[10px] font-medium"
                onClick={handleGenerateNodes}
              >
                生成节点骨架
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[10px] font-medium"
                onClick={handleGenerateOutline}
              >
                从节点生成
              </Button>
            </div>

            <div className="bg-muted/50 rounded-md px-2 py-1.5">
              <p className="text-[9px] text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground">规则：</span>
                <br />
                ## 章节 → 分组
                <br />
                - 列表项 → 对话节点
                <br />
                含「选择」→ 选择节点
                <br />
                含「结局」→ 结局节点
                <br />
                含「条件/如果」→ 条件节点
                <br />
                含「随机」→ 随机节点
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'assets' && (
        <AssetLibraryPanel
          selectedNode={selectedNode}
          onInsertAsset={onInsertAsset}
          characters={characters}
        />
      )}

      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSaveDialog(false)}>
          <div
            className="bg-card border rounded-lg shadow-xl w-72 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">保存为模板</h3>
              <button
                className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={() => setShowSaveDialog(false)}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">模板名称</label>
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="输入模板名称"
                  className="h-7 text-xs"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">描述（可选）</label>
                <Input
                  value={templateDesc}
                  onChange={(e) => setTemplateDesc(e.target.value)}
                  placeholder="简单描述一下"
                  className="h-7 text-xs"
                />
              </div>

              <div className="text-[10px] text-muted-foreground bg-muted/50 rounded-md px-2 py-1.5">
                将保存 {selectedNodes.length} 个节点 + {selectedEdges.length} 条连线
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={() => setShowSaveDialog(false)}
              >
                取消
              </Button>
              <Button
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={confirmSaveTemplate}
              >
                保存
              </Button>
            </div>
          </div>
        </div>
      )}

      {showGenerateConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowGenerateConfirm(false)}>
          <div
            className="bg-card border rounded-lg shadow-xl w-72 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">生成节点骨架</h3>
              <button
                className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={() => setShowGenerateConfirm(false)}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                将根据大纲内容生成新的节点，追加到画布右侧空白区域。
              </p>
              <div className="text-[10px] text-muted-foreground bg-muted/50 rounded-md px-2 py-1.5">
                预计添加 {pendingNodeCount} 个新节点
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={() => setShowGenerateConfirm(false)}
              >
                取消
              </Button>
              <Button
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={confirmGenerateNodes}
              >
                确认生成
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export const MemoizedEditorSidebar = memo(EditorSidebar)
export { EditorSidebar }
export default MemoizedEditorSidebar
