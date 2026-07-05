'use client'

import { useState, useEffect, memo } from 'react'
import { Button } from '@editor/components/ui/button'
import { Input } from '@editor/components/ui/input'
import { Label } from '@editor/components/ui/label'
import { Textarea } from '@editor/components/ui/textarea'
import { X, Plus, Trash2, Users, ArrowRight, ChevronDown, ChevronRight, Copy, Check, Layers, MessageSquare } from 'lucide-react'
import type { StoryNode, StoryCharacter, StoryEdge, StoryVariable, CharacterGender, NodeAnnotation } from '@editor/types/editor'

// 引入拆分的面板组件
import { DialoguePanel } from './panels/dialogue-panel'
import { ChoicePanel } from './panels/choice-panel'
import { NarrationPanel } from './panels/narration-panel'
import { EndingPanel } from './panels/ending-panel'
import { UnlockPanel } from './panels/unlock-panel'
import { CGPanel } from './panels/cg-panel'
import { ConditionPanel } from './panels/condition-panel'
import { GatherPanel } from './panels/gather-panel'
import { JumpPanel } from './panels/jump-panel'
import { RandomPanel } from './panels/random-panel'
import { NODE_TYPE_LABELS } from './panels/shared-props'

// 面板映射表
const PANEL_MAP: Record<string, React.ComponentType<any>> = {
  dialogue: DialoguePanel,
  choice: ChoicePanel,
  narration: NarrationPanel,
  ending: EndingPanel,
  unlock: UnlockPanel,
  cg: CGPanel,
  condition: ConditionPanel,
  gather: GatherPanel,
  jump: JumpPanel,
  random: RandomPanel,
}

// ------ 角色管理相关常量（保留在主文件）------
const CHAR_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e']

const STORY_TAGS = ['古风', '玄幻', '悬疑', '恋爱', '现代', '科幻', '恐怖', '校园', '都市', '穿越']

const PERSONALITY_TRAITS = [
  '勇敢', '冷静', '热血', '高傲', '温柔', '腹黑', '傲娇', '天然呆',
  '正义', '邪恶', '乐观', '悲观', '开朗', '内向', '活泼', '稳重'
]

const APPEARANCE_TAGS = [
  '长发', '短发', '卷发', '大眼', '小眼', '高挑', '娇小', '肌肉',
  '眼镜', '帽子', '纹身', '伤疤', '马尾', '双马尾', '麻花辫'
]

const SPEECH_TONES = [
  '热血激昂', '冷淡简洁', '软萌可爱', '成熟稳重', '痞气十足',
  '文绉绉', '网络用语', '地方口音', '娃娃音', '御姐音'
]

const SPEECH_RHYTHMS = ['快节奏', '慢条斯理', '跳跃', '顿挫', '流畅']

const SPEECH_VOCABULARY = ['直接', '委婉', '正式', '口语化', '文艺', '网络']

const SKILL_TAGS = [
  '格斗', '射击', '魔法', '烹饪', '黑客', '驾驶', '医术', '演技',
  '管理', '谈判', '潜行', '跑酷', '乐器', '舞蹈', '绘画'
]

const HABIT_TAGS = [
  '吃零食', '喝咖啡', '熬夜', '早起', '健身', '阅读', '发呆', '自言自语',
  '整理东西', '迟到'
]

const FEAR_TAGS = [
  '黑暗', '打雷', '虫子', '高处', '深海', '孤独', '失败', '背叛',
  '鬼魂', '蛇', '蜘蛛', '密闭空间', '公开演讲'
]

const CHARACTER_CUSTOM_TAGS = [
  '学生', '老师', '警察', '医生', '商人', '运动员', '艺术家', '程序员',
  '热血', '御姐', '萝莉', '正太', '大叔', '女神', '男神', '萌新'
]

// 角色预设
const CHARACTER_PRESETS: Array<{
  name: string
  color: string
  gender: CharacterGender
  age: string
  occupation: string
  personality: string[]
  appearance: string[]
  background: string
  speech: { tone: string; catchphrases: string[]; rhythm: string; vocabulary: string }
  skills: string[]
  motivation: string
  habits: string[]
  fears: string[]
  tags: string[]
  bio: string
}> = [
  {
    name: '热血少年', color: '#3b82f6', gender: 'male', age: '16', occupation: '学生',
    personality: ['勇敢', '正义', '热血'], appearance: ['阳光', '运动装'],
    background: '普通的热血高中生，为了守护重要的人不断努力',
    speech: { tone: '热血激昂', catchphrases: ['我不会输的！', '相信我！'], rhythm: '快节奏', vocabulary: '直接' },
    skills: ['格斗', '跑步'], motivation: '变得更强', habits: ['每天晨跑'], fears: ['失去朋友'],
    tags: ['热血', '学生', '格斗'], bio: '普通的热血高中生'
  },
  {
    name: '高冷御姐', color: '#8b5cf6', gender: 'female', age: '22', occupation: '职场精英',
    personality: ['冷静', '优雅', '高傲'], appearance: ['长发', '高跟鞋'],
    background: '职场女强人，看似冷漠实则内心柔软',
    speech: { tone: '冷淡简洁', catchphrases: ['这只是工作而已。', '不必感谢。'], rhythm: '慢条斯理', vocabulary: '正式' },
    skills: ['管理', '谈判'], motivation: '事业成功', habits: ['喝咖啡'], fears: ['失败'],
    tags: ['御姐', '职场', '精英'], bio: '职场女强人'
  },
  {
    name: '呆萌可爱', color: '#ec4899', gender: 'female', age: '15', occupation: '学生',
    personality: ['天真', '可爱', '迷糊'], appearance: ['短发', '大眼'],
    background: '天真烂漫的少女，对世界充满好奇',
    speech: { tone: '软萌可爱', catchphrases: ['嘿嘿~', '这是什么呀？'], rhythm: '跳跃', vocabulary: '简单' },
    skills: ['撒娇'], motivation: '开心就好', habits: ['吃零食'], fears: ['打雷'],
    tags: ['萝莉', '可爱', '学生'], bio: '天真烂漫的少女'
  },
]

function generateCharacterCard(character: StoryCharacter) {
  return {
    ...character,
    displayName: character.name,
    initials: (character.name || '').slice(0, 2),
  }
}

interface PropertyPanelProps {
  selectedNode: StoryNode | null
  selectedEdge: StoryEdge | null
  selectedNodeCount?: number
  characters: StoryCharacter[]
  tags?: string[]
  title?: string
  assets?: { images: string[]; audios: string[]; fonts: string[] }
  scenes?: any[]
  onUpdateNode: (nodeId: string, data: Partial<StoryNode['data']>) => void
  onDeleteNode: (nodeId: string) => void
  onUpdateEdge: (edgeId: string, data: Partial<StoryEdge>) => void
  onDeleteEdge: (edgeId: string) => void
  onAddCharacter: (character: StoryCharacter) => void
  onUpdateCharacter: (character: StoryCharacter) => void
  onDeleteCharacter: (characterId: string) => void
  editCharId?: string
  onUpdateTitle?: (title: string) => void
  onUpdateTags?: (tags: string[]) => void
  onOpenAssets?: (tab?: 'images' | 'audios') => void
  variables?: StoryVariable[]
  onUpdateVariables?: (variables: StoryVariable[]) => void
  annotations?: NodeAnnotation[]
  onAddAnnotation?: (nodeId: string) => void
  onViewAnnotations?: () => void
}

function PropertyPanel({
  selectedNode,
  selectedEdge,
  selectedNodeCount = 0,
  characters,
  tags = [],
  title = '',
  assets = { images: [], audios: [], fonts: [] },
  scenes = [],
  onUpdateNode,
  onDeleteNode,
  onUpdateEdge,
  onDeleteEdge,
  onAddCharacter,
  onUpdateCharacter,
  onDeleteCharacter,
  editCharId,
  onUpdateTitle,
  onUpdateTags,
  onOpenAssets,
  variables = [],
  onUpdateVariables,
  annotations = [],
  onAddAnnotation,
  onViewAnnotations,
}: PropertyPanelProps) {
  const [expandedCharId, setExpandedCharId] = useState<string | null>(null)
  const [copiedCharId, setCopiedCharId] = useState<string | null>(null)

  useEffect(() => {
    if (editCharId) {
      setExpandedCharId(editCharId)
    }
  }, [editCharId])

  // 选中边时显示边属性面板
  if (selectedEdge) {
    const edge = selectedEdge as any
    const label = edge.data?.label || edge.label || ''
    return (
      <div className="w-full h-full border-l bg-card flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-primary" />
              <h3 className="font-medium text-sm">连线属性</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {edge.source} → {edge.target}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onDeleteEdge(edge.id)}
            className="text-destructive hover:text-destructive" title="删除连线">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">连线标签（可选）</Label>
            <Input value={label}
              onChange={(e) => onUpdateEdge(edge.id, { label: e.target.value, data: { ...(edge.data || {}), label: e.target.value } } as any)}
              placeholder="如：好感度 > 50" className="text-sm" />
            <p className="text-[10px] text-muted-foreground">标签会显示在连线中间，方便识别分支条件</p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">条件表达式（可选）</Label>
            <Textarea value={edge.data?.condition || ''}
              onChange={(e) => onUpdateEdge(edge.id, { condition: e.target.value, data: { ...(edge.data || {}), condition: e.target.value } } as any)}
              placeholder="如：好感度 >= 50" className="min-h-[60px] resize-none text-sm" />
            <p className="text-[10px] text-muted-foreground">仅当表达式为 true 时，读者才会走这条分支</p>
          </div>
        </div>

        <div className="p-3 border-t">
          <p className="text-[10px] text-muted-foreground text-center">点击画布空白处取消选中</p>
        </div>
      </div>
    )
  }

  // 多选节点时显示批量选择提示
  if (selectedNodeCount > 1) {
    return (
      <div className="w-full h-full border-l bg-card flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <h3 className="font-medium text-sm">批量选择</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            已选中 <span className="text-primary font-medium">{selectedNodeCount}</span> 个节点
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="rounded-lg border border-border/60 bg-background p-6 text-center">
            <Layers className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-2">多选模式</p>
            <p className="text-xs text-muted-foreground/70 leading-relaxed">
              按住 <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">Shift</kbd> 点击节点可追加/移除选择
            </p>
            <p className="text-xs text-muted-foreground/70 leading-relaxed mt-1">
              按 <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">Delete</kbd> 键可批量删除
            </p>
          </div>
        </div>

        <div className="p-3 border-t">
          <p className="text-[10px] text-muted-foreground text-center">点击画布空白处取消选择</p>
        </div>
      </div>
    )
  }

  // 未选中节点时显示角色管理面板
  if (!selectedNode) {
    return (
      <div className="w-full h-full border-l bg-card flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-medium text-sm">角色 & 作品设置</h3>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">管理角色与作品属性</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 作品标题、标签、变量管理（简化版，完整版见原文件） */}
          <div className="space-y-2">
            <Label className="text-xs">作品标题</Label>
            <Input value={title} onChange={(e) => onUpdateTitle?.(e.target.value)}
              placeholder="输入作品标题" className="text-sm" />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">作品标签</Label>
            <div className="flex flex-wrap gap-1.5">
              {STORY_TAGS.map((tag) => {
                const active = tags.includes(tag)
                return (
                  <button key={tag}
                    onClick={() => onUpdateTags?.(active ? tags.filter(t => t !== tag) : [...tags, tag])}
                    className={`px-2 py-0.5 text-[10px] rounded-full border transition-colors ${
                      active ? 'bg-primary/10 border-primary/30 text-primary font-medium'
                        : 'bg-background border-border text-muted-foreground hover:border-border/80'
                    }`}>
                    {tag}
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] text-muted-foreground">已选 {tags.length}/10</p>
          </div>

          {/* 角色管理部分 */}
          {characters.map((char) => (
            <div key={char.id} className="rounded-lg border border-border/60 bg-background overflow-hidden">
              <button onClick={() => setExpandedCharId(expandedCharId === char.id ? null : char.id)}
                className="w-full flex items-center gap-2.5 p-2.5 hover:bg-muted/30 transition-colors">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: char.color }}>
                  {char.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium truncate">{char.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {char.occupation || '未设定职业'}
                  </p>
                </div>
                {expandedCharId === char.id ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
              </button>

              {expandedCharId === char.id && (
                <div className="px-3 pb-3 space-y-3 border-t border-border/40 pt-3">
                  {/* 基本信息 */}
                  <div className="space-y-1.5">
                    <Label className="text-[10px]">基本信息</Label>
                    <Input value={char.name}
                      onChange={(e) => onUpdateCharacter({ ...char, name: e.target.value })}
                      className="h-7 text-xs" placeholder="姓名" />
                  </div>

                  {/* 删除角色 */}
                  <div className="pt-1 border-t border-border/40">
                    <Button variant="ghost" size="sm"
                      className="w-full h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => { onDeleteCharacter(char.id); if (expandedCharId === char.id) setExpandedCharId(null) }}>
                      <Trash2 className="w-3 h-3 mr-1" />删除角色
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {characters.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">暂无角色</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // 选中节点时显示属性编辑面板
  const { type, id } = selectedNode
  const PanelComponent = PANEL_MAP[type]

  return (
    <div className="w-full h-full border-l bg-card flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h3 className="font-medium text-sm">{NODE_TYPE_LABELS[type] || '节点'}</h3>
          <p className="text-xs text-muted-foreground">{(id || '').slice(0, 8)}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onDeleteNode(id)}
          className="text-destructive hover:text-destructive" title="删除节点 (Delete)">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {PanelComponent ? (
          <PanelComponent node={selectedNode} characters={characters} variables={variables}
            assets={assets} scenes={scenes} onUpdateNode={onUpdateNode} onDeleteNode={onDeleteNode}
            onOpenAssets={onOpenAssets} />
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-xs">未知节点类型：{type}</p>
          </div>
        )}

        {/* 批注快捷区 */}
        <div className="border-t border-border pt-3 mt-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              节点批注
            </span>
            {annotations.length > 0 && (
              <button
                onClick={() => onViewAnnotations?.()}
                className="text-[10px] text-primary hover:underline"
              >
                查看 {annotations.length} 条 →
              </button>
            )}
          </div>
          {annotations.length > 0 && (
            <div className="space-y-1 max-h-[100px] overflow-y-auto">
              {annotations.slice(0, 3).map((anno) => (
                <div
                  key={anno.id}
                  className="text-[10px] px-2 py-1 rounded border border-border/60 bg-muted/30 truncate"
                  style={anno.resolved ? undefined : {
                    borderLeftWidth: '2px',
                    borderLeftColor: anno.type === 'warning' ? '#ef4444'
                      : anno.type === 'todo' ? '#eab308'
                      : anno.type === 'idea' ? '#a855f7'
                      : '#3b82f6',
                  }}
                >
                  <span className={anno.resolved ? 'text-muted-foreground line-through' : 'text-foreground'}>
                    {anno.text}
                  </span>
                </div>
              ))}
              {annotations.length > 3 && (
                <p className="text-[10px] text-muted-foreground text-center">
                  还有 {annotations.length - 3} 条...
                </p>
              )}
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddAnnotation?.(id)}
            className="w-full h-7 text-xs gap-1"
          >
            <Plus className="w-3 h-3" />
            添加批注
          </Button>
        </div>
      </div>

      <div className="p-3 border-t">
        <p className="text-[10px] text-muted-foreground text-center">按 Delete 键删除节点 · 右键节点添加批注</p>
      </div>
    </div>
  )
}

function arePropertyPanelPropsEqual(
  prevProps: PropertyPanelProps,
  nextProps: PropertyPanelProps
): boolean {
  if (prevProps.selectedNode?.id !== nextProps.selectedNode?.id) return false
  if (prevProps.selectedEdge?.id !== nextProps.selectedEdge?.id) return false
  if (prevProps.editCharId !== nextProps.editCharId) return false
  if (prevProps.annotations !== nextProps.annotations) return false
  if (prevProps.selectedNode?.type !== nextProps.selectedNode?.type) return false
  return true
}

export const MemoizedPropertyPanel = memo(PropertyPanel, arePropertyPanelPropsEqual)
export { PropertyPanel }
export default MemoizedPropertyPanel