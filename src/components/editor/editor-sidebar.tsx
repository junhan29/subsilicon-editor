'use client'

import { useCallback, useState, memo, useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import {
  MessageCircle,
  GitBranch,
  Lock,
  Flag,
  GripVertical,
  Lightbulb,
  Merge,
  Layers,
  FileText,
  Plus,
  Trash2,
  Save,
  SplitSquareVertical,
  Film,
  Zap,
  Shuffle,
  Pencil,
  X,
  Sparkles,
  User,
  Library,
  Download,
  Upload,
  Globe,
  Puzzle,
  Settings,
  Check,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@editor/components/ui/button'
import { Input } from '@editor/components/ui/input'
import { loadTemplates, saveTemplate, deleteTemplate, getOfficialTemplates, createTemplateFromSelection, exportTemplateToFile, importTemplateFromFile, publishTemplateToCommunity } from '@editor/lib/template-store'
import { parseOutline, generateNodesFromOutline } from '@editor/lib/outline-parser'
import { showToast } from './toast'
import { AssetLibraryPanel } from './asset-library-panel'
import { getInstalledPlugins, getPluginConfig, setPluginConfig, uninstallPlugin, enablePlugin, disablePlugin, isPluginEnabled, getAvailablePlugins, createPluginSandbox, destroyPluginSandbox } from '@editor/lib/plugins/plugin-registry'
import type { NodeTemplate, StoryNode, StoryEdge, PluginManifest } from '@editor/types/editor'
import type { LibraryAsset } from '@editor/lib/asset-library'

export interface SidebarNodeType {
  type: string
  label: string
  icon: React.ReactNode
  description: string
}

const NODE_TYPES: SidebarNodeType[] = [
  {
    type: 'dialogue',
    label: '对话',
    icon: <MessageCircle className="w-5 h-5 text-primary" />,
    description: '角色说话的内容',
  },
  {
    type: 'choice',
    label: '选择',
    icon: <GitBranch className="w-5 h-5 text-amber-500" />,
    description: '让读者做选择，走向不同剧情',
  },
  {
    type: 'gather',
    label: '汇聚',
    icon: <Merge className="w-5 h-5 text-slate-500" />,
    description: '多条路线汇合到一起',
  },
  {
    type: 'condition',
    label: '条件',
    icon: <SplitSquareVertical className="w-5 h-5 text-purple-500" />,
    description: '满足条件走一条路，否则走另一条',
  },
  {
    type: 'unlock',
    label: '付费',
    icon: <Lock className="w-5 h-5 text-orange-500" />,
    description: '读者付费后才能继续看',
  },
  {
    type: 'ending',
    label: '结局',
    icon: <Flag className="w-5 h-5 text-green-500" />,
    description: '故事结束的地方',
  },
  {
    type: 'cg',
    label: '过场',
    icon: <Film className="w-5 h-5 text-purple-500" />,
    description: '展示一张图或一段动画',
  },
  {
    type: 'jump',
    label: '跳转',
    icon: <Zap className="w-5 h-5 text-violet-500" />,
    description: '跳到故事中的另一个位置',
  },
  {
    type: 'random',
    label: '随机',
    icon: <Shuffle className="w-5 h-5 text-cyan-500" />,
    description: '随机走向某条路线',
  },
]

type TabKey = 'nodes' | 'templates' | 'outline' | 'assets' | 'plugins'

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
  const [isPublishing, setIsPublishing] = useState(false)
  const editInputRef = useRef<HTMLInputElement>(null)

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
    { key: 'plugins' as TabKey, label: '插件', icon: <Puzzle className="w-3.5 h-3.5" /> },
  ]

  return (
    <div role="region" aria-label="左侧工具栏" className="w-52 border-r bg-card flex flex-col shrink-0">
      <div className="px-2 pt-2 pb-0 border-b">
        <div role="tablist" aria-label="工具栏标签" className="flex bg-muted rounded-md p-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              aria-controls={`panel-${tab.key}`}
              id={`tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`
                flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium rounded-md transition-colors
                ${activeTab === tab.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground/80'
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
          <div className="px-3 py-2.5 border-b">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <GripVertical className="w-3 h-3" />
              拖拽到画布添加节点
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
            {NODE_TYPES.map((node) => (
              <div
                key={node.type}
                draggable
                onDragStart={(e) => onDragStart(e, node.type)}
                className="flex items-center gap-2.5 p-2 rounded-lg border border-border/60 bg-background hover:bg-accent/50 hover:border-border cursor-grab active:cursor-grabbing transition-all group relative"
                title={node.description}
              >
                <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0 group-hover:bg-accent transition-colors">
                  {node.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{node.label}</p>
                  <p className="text-[9px] text-muted-foreground truncate">{node.description}</p>
                </div>
                <GripVertical className="w-3 h-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors shrink-0" />
              </div>
            ))}
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
                <Lightbulb className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
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
                    onDoubleClick={() => handleTemplateDoubleClick(tpl)}
                    className="flex items-center gap-2 p-2 rounded-lg border border-blue-200/50 bg-blue-50/30 hover:bg-blue-100/50 hover:border-blue-300/70 cursor-grab group transition-all"
                    title={tpl.description}
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
                <User className="w-3 h-3 text-slate-500" />
                <span className="text-[9px] font-medium text-slate-600">我的模板</span>
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
                    onDoubleClick={() => handleTemplateDoubleClick(tpl)}
                    className="flex items-center gap-2 p-2 rounded-lg border border-border/60 bg-background hover:bg-accent/50 hover:border-border cursor-grab group transition-all relative"
                    title={tpl.description}
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
                        className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                        onClick={(e) => {
                          e.stopPropagation()
                          exportTemplateToFile(tpl)
                        }}
                        title="导出模板文件"
                      >
                        <Download className="w-3 h-3" />
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

            <div className="flex gap-1 pt-2 border-t border-slate-700">
              <button
                onClick={async () => {
                  const tpl = await importTemplateFromFile()
                  if (tpl) {
                    saveTemplate(tpl)
                    setCustomTemplates(loadTemplates())
                    showToast('success', '模板导入成功')
                  } else {
                    showToast('error', '导入失败，文件格式不正确')
                  }
                }}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md transition-colors"
              >
                <Upload className="w-3 h-3" />
                导入
              </button>
              <button
                onClick={() => {
                  if (customTemplates.length === 0) { showToast('info', '暂无自定义模板可发布'); return }
                  setIsPublishing(true)
                  publishTemplateToCommunity(customTemplates[0], 'platform').then((res) => {
                    setIsPublishing(false)
                    if (res.success) {
                      showToast('success', '模板已发布到社区！')
                    } else {
                      showToast('error', res.error || '发布失败')
                    }
                  })
                }}
                disabled={isPublishing}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] bg-pink-600 hover:bg-pink-500 text-white rounded-md transition-colors disabled:opacity-50"
              >
                <Globe className="w-3 h-3" />
                {isPublishing ? '发布中...' : '发布'}
              </button>
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
        />
      )}

      {/* 插件面板 */}
      {activeTab === 'plugins' && (
        <PluginPanelContent />
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

/** 插件管理面板 */
function PluginPanelContent() {
  const [installed, setInstalled] = useState<PluginManifest[]>([])
  const [available, setAvailable] = useState<PluginManifest[]>([])
  const [showAvailable, setShowAvailable] = useState(false)
  const [configOpen, setConfigOpen] = useState<string | null>(null)
  const [configValues, setConfigValues] = useState<Record<string, string>>({})

  useEffect(() => {
    setInstalled(getInstalledPlugins())
    getAvailablePlugins().then(setAvailable)
  }, [])

  const refresh = () => {
    setInstalled(getInstalledPlugins())
  }

  const handleToggle = (pluginId: string, enabled: boolean) => {
    if (enabled) disablePlugin(pluginId)
    else enablePlugin(pluginId)
    refresh()
  }

  const handleUninstall = (pluginId: string) => {
    destroyPluginSandbox(pluginId)
    uninstallPlugin(pluginId)
    refresh()
  }

  const openConfig = (pluginId: string) => {
    setConfigOpen(pluginId)
    setConfigValues(getPluginConfig(pluginId))
  }

  const saveConfig = () => {
    if (configOpen) {
      setPluginConfig(configOpen, configValues)
      setConfigOpen(null)
      showToast('success', '插件配置已保存')
    }
  }

  const handleInstallFromUrl = async () => {
    const url = window.prompt('输入插件 manifest URL:')
    if (!url) return
    try {
      const res = await fetch(url)
      const manifest: PluginManifest = await res.json()
      if (!manifest.pluginId || !manifest.name) {
        showToast('error', '无效的插件清单')
        return
      }
      const success = await import('@editor/lib/plugins/plugin-registry').then(m => m.installPlugin(manifest, url))
      if (success) {
        showToast('success', `插件 ${manifest.name} 已安装`)
        refresh()
      } else {
        showToast('error', '插件已安装或安装失败')
      }
    } catch {
      showToast('error', '无法获取插件清单')
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-0 m-0">
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-foreground">
            已安装 ({installed.length})
          </h3>
          <div className="flex gap-1">
            <button
              onClick={() => setShowAvailable(!showAvailable)}
              className="px-2 py-1 text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md transition-colors"
            >
              {showAvailable ? '收起' : `可用 (${available.length})`}
            </button>
            <button
              onClick={handleInstallFromUrl}
              className="px-2 py-1 text-[10px] bg-pink-600 hover:bg-pink-500 text-white rounded-md transition-colors"
              title="从 URL 安装插件"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {installed.length === 0 && !showAvailable && (
          <div className="text-center py-8 text-slate-500 text-[10px]">
            暂无已安装的插件
            <br />
            点击"可用"按钮浏览社区插件
          </div>
        )}

        <div className="space-y-1.5">
          {installed.map((p) => {
            const enabled = isPluginEnabled(p.pluginId)
            return (
              <div key={p.pluginId} className="p-2 rounded-lg bg-slate-800/40 border border-slate-700/50">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{p.name}</p>
                    <p className="text-[10px] text-slate-400 line-clamp-1">{p.description}</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">
                      v{p.version} · {renderAuthor(p.author)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {p.configFields && p.configFields.length > 0 && (
                      <button
                        onClick={() => openConfig(p.pluginId)}
                        className="p-1 text-slate-400 hover:text-white transition-colors"
                        title="配置"
                      >
                        <Settings className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={() => handleToggle(p.pluginId, enabled)}
                      className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${
                        enabled
                          ? 'bg-emerald-600/30 text-emerald-400'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {enabled ? '启用' : '禁用'}
                    </button>
                    <button
                      onClick={() => handleUninstall(p.pluginId)}
                      className="p-1 text-red-400/60 hover:text-red-400 transition-colors"
                      title="卸载"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* 可用插件列表 */}
        {showAvailable && (
          <div className="space-y-1.5 pt-2 border-t border-slate-700/50">
            <p className="text-[10px] text-slate-500">社区可用插件</p>
            {available.length === 0 ? (
              <p className="text-center py-4 text-slate-600 text-[10px]">暂无可用插件</p>
            ) : (
              available.filter(a => !installed.find(i => i.pluginId === a.pluginId)).map((p) => (
                <div key={p.pluginId} className="p-2 rounded-lg bg-slate-800/20 border border-slate-700/30">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{p.name}</p>
                      <p className="text-[10px] text-slate-400 line-clamp-1">{p.description}</p>
                      <p className="text-[9px] text-slate-500 mt-0.5">
                        v{p.version} · {renderAuthor(p.author)}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        const success = await import('@editor/lib/plugins/plugin-registry').then(m => m.installPlugin(p, p.source.url))
                        if (success) {
                          showToast('success', `插件 ${p.name} 已安装`)
                          refresh()
                        }
                      }}
                      className="px-2 py-0.5 text-[9px] bg-pink-600 hover:bg-pink-500 text-white rounded transition-colors shrink-0"
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 配置弹窗 */}
        {configOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setConfigOpen(null)}>
            <div className="bg-card border rounded-lg shadow-xl w-72 p-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">插件配置</h3>
                <button onClick={() => setConfigOpen(null)} className="p-1 text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-3">
                {getPlugin(configOpen)?.configFields?.map((field) => (
                  <div key={field.key}>
                    <label className="text-[10px] text-muted-foreground block mb-1">{field.label}</label>
                    {field.type === 'select' ? (
                      <select
                        value={configValues[field.key] || ''}
                        onChange={(e) => setConfigValues({ ...configValues, [field.key]: e.target.value })}
                        className="w-full h-7 text-xs bg-muted border rounded px-2"
                      >
                        {field.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        value={configValues[field.key] || ''}
                        onChange={(e) => setConfigValues({ ...configValues, [field.key]: e.target.value })}
                        placeholder={field.placeholder}
                        type={field.type === 'password' ? 'password' : 'text'}
                        className="h-7 text-xs"
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setConfigOpen(null)} className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground">取消</button>
                <button onClick={saveConfig} className="px-3 py-1 text-xs bg-pink-600 text-white rounded hover:bg-pink-500">保存</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function getPlugin(id: string): PluginManifest | undefined {
  return getInstalledPlugins().find(p => p.pluginId === id)
}

function renderAuthor(author: string | { name: string; email?: string; homepage?: string; publicKey?: string }): string {
  if (typeof author === 'string') return author || '未知作者'
  return author.name || '未知作者'
}
