'use client'

import { memo, useEffect, useState } from 'react'
import { Button } from '@editor/components/ui/button'
import { Input } from '@editor/components/ui/input'
import { Label } from '@editor/components/ui/label'
import { Textarea } from '@editor/components/ui/textarea'
import { AlertTriangle, ArrowRight, BookOpen, Check, ChevronDown, ChevronRight, Copy, Film, Layers, Loader2, MessageSquare, Plus, Sparkles, Trash2, Users, X } from 'lucide-react'
import type { CharacterGender, NodeAnnotation, StoryCharacter, StoryEdge, StoryNode, StoryVariable } from '@editor/types/editor'
import { enhanceCharacter } from '@editor/lib/ai'
import { showToast } from './toast'
import { getWorkPremise, saveWorkPremise } from '@editor/lib/work-premise-store'
import {
  APPEARANCE_TAGS,
  CHARACTER_CUSTOM_TAGS,
  CHAR_COLORS,
  FEAR_TAGS,
  HABIT_TAGS,
  NODE_TYPE_LABELS,
  PERSONALITY_TRAITS,
  SKILL_TAGS,
  SPEECH_RHYTHMS,
  SPEECH_TONES,
  SPEECH_VOCABULARY,
  STORY_TAGS,
} from '@editor/constants'

// 创作助理辅助增强组件（带 loading 状态）
function CharacterAIEnhance({ char, onUpdateCharacter }: { char: StoryCharacter; onUpdateCharacter: (char: StoryCharacter) => void }) {
  const [loading, setLoading] = useState<string | null>(null)

  const handleEnhance = async (type: 'background' | 'personality' | 'appearance' | 'speech' | 'full') => {
    setLoading(type)
    try {
      const result = await enhanceCharacter(char, type)
      if (type === 'background' && result.background) {
        onUpdateCharacter({ ...char, background: result.background })
        showToast('success', '背景故事已生成')
      } else if (type === 'personality' && result.personality) {
        onUpdateCharacter({ ...char, personality: result.personality })
        showToast('success', '性格特点已生成')
      } else if (type === 'appearance' && result.appearance) {
        onUpdateCharacter({ ...char, appearance: result.appearance })
        showToast('success', '外貌特征已生成')
      } else if (type === 'speech' && result.speech) {
        onUpdateCharacter({ ...char, speech: { ...char.speech, ...result.speech } })
        showToast('success', '说话风格已生成')
      } else if (type === 'full') {
        onUpdateCharacter({ ...char, ...result })
        showToast('success', '角色设定已完整增强')
      } else {
        showToast('error', '生成失败，请重试')
      }
    } catch (e) {
      if (e instanceof Error && 'needsConfig' in e && (e as { needsConfig: boolean }).needsConfig) {
        showToast('error', '创作助理未配置，请在设置中配置 API Key 或启动本地 Ollama')
      } else {
        showToast('error', '生成失败: ' + (e instanceof Error ? e.message : '未知错误'))
      }
    } finally {
      setLoading(null)
    }
  }

  const buttonClass = "px-2 py-1 text-[10px] rounded bg-gold-400/10 text-amber-600 border border-gold-400/20 hover:bg-gold-400/20 transition-colors disabled:opacity-50 flex items-center gap-1"

  return (
    <div className="flex flex-wrap gap-1">
      <button onClick={() => handleEnhance('background')} disabled={!!loading} className={buttonClass}>
        {loading === 'background' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
        生成背景
      </button>
      <button onClick={() => handleEnhance('personality')} disabled={!!loading} className={buttonClass}>
        {loading === 'personality' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
        生成性格
      </button>
      <button onClick={() => handleEnhance('appearance')} disabled={!!loading} className={buttonClass}>
        {loading === 'appearance' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
        生成外貌
      </button>
      <button onClick={() => handleEnhance('full')} disabled={!!loading} className={buttonClass}>
        {loading === 'full' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
        完整增强
      </button>
    </div>
  )
}

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
import { AiIndependentSelfCheckPanel } from './ai-independent-self-check'
import { CharacterCardPanel } from './character-card-panel'
import { collectAllVideoBindingsFromGraph } from './node-video-binding'
import type { StoryGraph } from '@editor/types/editor'
import type { VideoBinding } from '@editor/lib/export-bilibili-interactive'

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
  onOpenAssets?: (tab?: 'images' | 'audios' | 'video') => void
  variables?: StoryVariable[]
  onUpdateVariables?: (variables: StoryVariable[]) => void
  annotations?: NodeAnnotation[]
  onAddAnnotation?: (nodeId: string) => void
  onViewAnnotations?: () => void
  graph?: StoryGraph | null
  workId?: string
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
  graph,
  workId,
}: PropertyPanelProps) {
  const [expandedCharId, setExpandedCharId] = useState<string | null>(null)
  const [copiedCharId, setCopiedCharId] = useState<string | null>(null)
  const [workPremise, setWorkPremise] = useState<string>(() => getWorkPremise(workId))

  useEffect(() => {
    setWorkPremise(getWorkPremise(workId))
  }, [workId])

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
      <div className="w-full h-full border-l border-border bg-card flex flex-col">
        {/* 头部：金图标盒 + 印章贴纸 */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-[2px] bg-gold-400/15 border border-gold-400/40 flex items-center justify-center shadow-[2px_2px_0_hsl(var(--gold)/0.2)] shrink-0">
              <ArrowRight className="w-5 h-5 text-gold-500" strokeWidth={2.3} />
            </div>
            <div className="relative">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm tracking-wide text-foreground">连线属性</h3>
                <span className="text-[9px] font-black px-1.5 py-0.5 border border-cyber-cyan-400/50 bg-cyber-cyan-400/10 text-cyber-cyan-500 tracking-tighter rotate-[5deg]">
                  EDGE
                </span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[10px] font-mono px-1.5 py-0.5 bg-background border border-border rounded-[1px] text-foreground/80">
                  {edge.source.slice(0, 6)}
                </span>
                <span className="text-gold-500">→</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 bg-gold-400/10 border border-gold-400/30 rounded-[1px] text-gold-600 dark:text-gold-500">
                  {edge.target.slice(0, 6)}
                </span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onDeleteEdge(edge.id)}
            className="text-destructive hover:text-destructive hover:bg-destructive/10" title="删除连线">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="p-3 rounded-[2px] border border-border bg-card
            clip-path-polygon-[0_0,calc(100%-10px)_0,100%_10px,100%_100%,0_100%]
            shadow-[3px_3px_0_hsl(var(--gold)/0.12)] space-y-2">
            <Label className="text-xs font-semibold tracking-wide">连线标签（可选）</Label>
            <Input value={label}
              onChange={(e) => onUpdateEdge(edge.id, { label: e.target.value, data: { ...(edge.data || {}), label: e.target.value } } as any)}
              placeholder="如：好感度 > 50" className="text-sm h-8 rounded-[2px]" />
            <p className="text-[10px] text-muted-foreground leading-tight">标签会显示在连线中间，方便识别分支条件</p>
          </div>

          <div className="p-3 rounded-[2px] border border-border bg-card
            clip-path-polygon-[0_0,calc(100%-10px)_0,100%_10px,100%_100%,0_100%]
            shadow-[3px_3px_0_hsl(var(--cyber-cyan)/0.12)] space-y-2">
            <Label className="text-xs font-semibold tracking-wide flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-[1px] bg-cyber-cyan-400" />
              条件表达式（可选）
            </Label>
            <Textarea value={edge.data?.condition || ''}
              onChange={(e) => onUpdateEdge(edge.id, { condition: e.target.value, data: { ...(edge.data || {}), condition: e.target.value } } as any)}
              placeholder="如：好感度 >= 50" className="min-h-[60px] resize-none text-sm rounded-[2px] focus:border-cyber-cyan-400" />
            <p className="text-[10px] text-muted-foreground leading-tight">仅当表达式为 true 时，读者才会走这条分支</p>
          </div>
        </div>

        <div className="p-3 border-t border-border">
          <p className="text-[10px] text-muted-foreground text-center">点击画布空白处取消选中</p>
        </div>
      </div>
    )
  }

  // 多选节点时显示批量选择提示
  if (selectedNodeCount > 1) {
    return (
      <div className="w-full h-full border-l border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[2px] bg-gold-400/15 border border-gold-400/40 flex items-center justify-center shadow-[2px_2px_0_hsl(var(--gold)/0.2)]">
              <Layers className="w-5 h-5 text-gold-500" strokeWidth={2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm tracking-wide text-foreground">批量选择</h3>
                <span className="text-[9px] font-black px-1.5 py-0.5 border border-p5-red/50 bg-p5-red/10 text-p5-red tracking-tighter rotate-[-4deg]">
                  BATCH
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                已选中 <span className="font-mono text-[11px] font-bold text-gold-600 dark:text-gold-500 bg-gold-400/10 border border-gold-400/30 px-1.5 py-[1px] rounded-[1px]">{selectedNodeCount}</span> 个节点
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="rounded-[2px] border border-border bg-background p-6 text-center
            clip-path-polygon-[0_0,calc(100%-14px)_0,100%_14px,100%_100%,0_100%]
            shadow-[5px_5px_0_hsl(var(--gold)/0.18)]">
            <div className="w-12 h-12 rounded-[2px] border border-gold-400/40 bg-gold-400/10 flex items-center justify-center mx-auto mb-3 shadow-[2px_2px_0_hsl(var(--gold)/0.2)]">
              <Layers className="w-6 h-6 text-gold-500" strokeWidth={2} />
            </div>
            <p className="text-sm font-bold text-foreground mb-2 tracking-wide">多选模式</p>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground/80 leading-relaxed">
                按住 <kbd className="px-1.5 py-0.5 rounded-[1px] bg-muted border border-border text-[10px] font-mono">Shift</kbd> 点击节点可追加/移除选择
              </p>
              <p className="text-xs text-muted-foreground/80 leading-relaxed">
                按 <kbd className="px-1.5 py-0.5 rounded-[1px] bg-muted border border-border text-[10px] font-mono">Delete</kbd> 键可批量删除
              </p>
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-border">
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

        <div className="flex-1 overflow-y-auto p-4 space-y-4 relative z-10">
          {/* 半调网点装饰 - 右上 */}
          <div className="absolute top-3 right-4 w-14 h-14 opacity-[0.07] pointer-events-none z-0"
            style={{
              backgroundImage: 'radial-gradient(hsl(var(--gold)) 1px, transparent 1px)',
              backgroundSize: '6px 6px',
            }}
          />

          {/* 作品标题 */}
          <div className="space-y-2 relative z-10">
            <Label className="text-xs font-semibold tracking-wide">作品标题</Label>
            <Input value={title} onChange={(e) => onUpdateTitle?.(e.target.value)}
              placeholder="输入作品标题" className="text-sm h-9 rounded-[2px] focus:border-gold-400 shadow-[2px_2px_0_hsl(var(--gold)/0.1)]" />
          </div>

          {/* 作品标签 - 印章风标签 */}
          <div className="space-y-2.5 relative z-10">
            <Label className="text-xs font-semibold tracking-wide">作品标签</Label>
            {/* 已选标签 - 金印 */}
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold tracking-wide rounded-[1px] bg-gold-400/15 border border-gold-400/45 text-gold-600 dark:text-gold-500 shadow-[1px_1px_0_hsl(var(--gold)/0.15)]"
                >
                  {tag}
                  <button
                    onClick={() => onUpdateTags?.(tags.filter((t) => t !== tag))}
                    className="hover:text-p5-red transition-colors"
                    title="移除标签"
                  >
                    <X className="w-3 h-3" strokeWidth={2.4} />
                  </button>
                </span>
              ))}
            </div>
            {/* 预设标签 - 虚线银印 */}
            <div className="flex flex-wrap gap-1.5">
              {STORY_TAGS.filter((t) => !tags.includes(t)).map((tag) => (
                <button
                  key={tag}
                  onClick={() => {
                    if (tags.length >= 10) return
                    onUpdateTags?.([...tags, tag])
                  }}
                  className="px-2 py-0.5 text-[10px] font-medium rounded-[1px] border-2 border-dashed border-border/80 bg-background text-muted-foreground hover:border-gold-400/50 hover:text-gold-600 dark:hover:text-gold-500 transition-colors tracking-wide"
                >
                  + {tag}
                </button>
              ))}
            </div>
            {/* 自定义标签输入 */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="输入自定义标签，回车添加"
                className="flex-1 px-2.5 py-1.5 text-xs rounded-[2px] bg-background border-2 border-border focus:outline-none focus:border-gold-400 transition-colors shadow-[1px_1px_0_hsl(var(--gold)/0.08)]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = e.currentTarget.value.trim()
                    if (val && !tags.includes(val) && tags.length < 10) {
                      onUpdateTags?.([...tags, val])
                      e.currentTarget.value = ''
                    }
                  }
                }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">已选 <span className="font-bold text-gold-600 dark:text-gold-500">{tags.length}</span>/10，支持自定义标签</p>
          </div>

          {/* 作品核心设定 - 金印章容器 */}
          <div className="space-y-2 relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-[2px] bg-gold-400/15 border border-gold-400/35 flex items-center justify-center shadow-[1px_1px_0_hsl(var(--gold)/0.18)]">
                  <BookOpen className="w-4 h-4 text-gold-500" strokeWidth={2} />
                </div>
                <div>
                  <Label className="text-xs font-bold tracking-wide">作品核心设定</Label>
                  <span className="ml-1.5 text-[9px] font-black px-1.5 py-0.5 border border-p5-red/50 bg-p5-red/10 text-p5-red tracking-tighter rotate-[-4deg] inline-block">
                    LORE
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  saveWorkPremise(workId, workPremise)
                  showToast('success', workPremise.trim() ? '核心设定已保存（AI 对话时自动带入）' : '核心设定已清空')
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold tracking-wide rounded-[2px] bg-gold-400/15 text-gold-600 dark:text-gold-500 border border-gold-400/35 hover:bg-gold-400/25 transition-all shadow-[2px_2px_0_hsl(var(--gold)/0.18)]"
              >
                <Check className="w-3 h-3" strokeWidth={2.4} />
                保存
              </button>
            </div>
            <Textarea
              value={workPremise}
              onChange={(e) => setWorkPremise(e.target.value)}
              onBlur={() => saveWorkPremise(workId, workPremise)}
              rows={6}
              placeholder={`在这里写清楚本作的世界观、核心基调、必须遵守的风格禁忌、人物关系等等，比如：\n• 世界观：赛博朋克 2099 年，东亚城邦「新沪」，巨型 AI 管理一切，人类失去自由意志\n• 基调：冷静克制的反乌托邦，不要热血逆袭\n• 禁忌：不要出现魔法/超自然元素；所有科技都要能找到现实原型\n• 主角与男二是义兄弟关系，互称「哥」时不能用外号\n\nAI 在每一轮聊天和生成内容时都会先看到这段设定。`}
              className="text-xs leading-relaxed resize-y min-h-[120px] rounded-[2px] focus:border-gold-400 shadow-[2px_2px_0_hsl(var(--gold)/0.1)]"
            />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              按作品独立保存（本作品：{workId || 'default'}）；失焦自动保存。AI 对话时注入上下文最上方，减少前后矛盾、世界观冲突。
            </p>
          </div>

          {/* 变量管理 - 赛博青系阴影标识逻辑数据 */}
          <div className="space-y-2 relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-[2px] bg-cyber-cyan-400/12 border border-cyber-cyan-400/30 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-cyber-cyan-500">x</span>
                </div>
                <Label className="text-xs font-bold tracking-wide">变量管理</Label>
              </div>
              <button
                onClick={() => {
                  const newVar: StoryVariable = {
                    id: `var-${Date.now()}`,
                    name: `变量${variables.length + 1}`,
                    type: 'number',
                    initialValue: 0,
                    defaultValue: 0,
                    description: '',
                  }
                  onUpdateVariables?.([...variables, newVar])
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold tracking-wide rounded-[2px] bg-cyber-cyan-400/12 text-cyber-cyan-500 border border-cyber-cyan-400/30 hover:bg-cyber-cyan-400/22 transition-all shadow-[2px_2px_0_hsl(var(--cyber-cyan)/0.18)]"
              >
                <Plus className="w-3 h-3" strokeWidth={2.4} />
                添加变量
              </button>
            </div>
            {variables.length > 0 ? (
              <div className="space-y-1.5">
                {variables.map((v) => (
                  <div key={v.id} className="flex items-center gap-2 p-2 rounded-[2px] border border-border bg-muted/30 shadow-[2px_2px_0_hsl(var(--cyber-cyan)/0.1)]">
                    <Input
                      value={v.name}
                      onChange={(e) => onUpdateVariables?.(variables.map((vv) => vv.id === v.id ? { ...vv, name: e.target.value } : vv))}
                      className="h-7 text-xs w-20 rounded-[2px]" placeholder="变量名"
                    />
                    <select
                      value={v.type}
                      onChange={(e) => onUpdateVariables?.(variables.map((vv) => vv.id === v.id ? { ...vv, type: e.target.value as 'number' | 'string' | 'boolean' } : vv))}
                      className="h-7 text-xs rounded-[2px] border border-border bg-muted px-2 text-foreground focus:outline-none focus:border-cyber-cyan-400 shadow-[1px_1px_0_hsl(var(--cyber-cyan)/0.08)]"
                    >
                      <option value="number">数字</option>
                      <option value="string">文本</option>
                      <option value="boolean">布尔</option>
                    </select>
                    <Input
                      value={String(v.defaultValue ?? '')}
                      onChange={(e) => onUpdateVariables?.(variables.map((vv) => vv.id === v.id ? { ...vv, defaultValue: v.type === 'number' ? Number(e.target.value) : e.target.value } : vv))}
                      className="h-7 text-xs flex-1 rounded-[2px]" placeholder="默认值"
                    />
                    <button
                      onClick={() => onUpdateVariables?.(variables.filter((vv) => vv.id !== v.id))}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground">暂无变量，点击上方按钮添加</p>
            )}
            <p className="text-[10px] text-muted-foreground">变量可在选项节点中设置效果，用于记录好感度等数据</p>
          </div>

          {/* B 站互动视频：节点 → 素材绑定的批量管理视图 */}
          <VideoBindingsBulkSection graph={graph} />

          {/* AI 独立运行自检入口 */}
          <AiIndependentSelfCheckPanel />

          {/* 角色参考图（一致性锚点） */}
          <CharacterCardPanel characters={characters} />

          {/* 角色管理部分 - 卡片印章风 */}
          {characters.map((char) => (
            <div key={char.id} className="rounded-[2px] border-2 border-border bg-background overflow-hidden shadow-[3px_3px_0_hsl(var(--gold)/0.14)]
              clip-path-polygon-[0_0,calc(100%-10px)_0,100%_10px,100%_100%,0_100%]">
              <button onClick={() => setExpandedCharId(expandedCharId === char.id ? null : char.id)}
                className="w-full flex items-center gap-2.5 p-2.5 hover:bg-gold-400/5 transition-colors">
                {/* 头像：rounded-full → 斜切金边方头像 */}
                <div className="w-8 h-8 rounded-[2px] clip-path-polygon-[0_0,75%_0,100%_25%,100%_100%,0_100%] flex items-center justify-center text-white text-xs font-black shrink-0 shadow-[1px_1px_0_rgba(0,0,0,0.1)] border-[1.5px] border-gold-400/50 tracking-wide"
                  style={{ backgroundColor: char.color }}>
                  {char.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-bold truncate tracking-wide">{char.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate leading-tight">
                    {char.occupation || '未设定职业'}
                  </p>
                </div>
                {expandedCharId === char.id ? <ChevronDown className="w-4 h-4 text-gold-500 shrink-0" strokeWidth={2.2} />
                  : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={2.2} />}
              </button>

              {expandedCharId === char.id && (
                <div className="px-3 pb-3 space-y-3.5 border-t border-border/50 pt-3 bg-background/80">
                  {/* 基本信息 */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold tracking-wide">基本信息</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">姓名</p>
                        <Input value={char.name}
                          onChange={(e) => onUpdateCharacter({ ...char, name: e.target.value })}
                          className="h-8 text-xs rounded-[2px] focus:border-gold-400" placeholder="角色名称" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">性别</p>
                        <select
                          value={char.gender || 'unknown'}
                          onChange={(e) => onUpdateCharacter({ ...char, gender: e.target.value as CharacterGender })}
                          className="w-full h-8 text-xs rounded-[2px] border border-border bg-muted px-2 text-foreground focus:outline-none focus:border-gold-400 shadow-[1px_1px_0_hsl(var(--gold)/0.08)]"
                        >
                          <option value="male">男</option>
                          <option value="female">女</option>
                          <option value="other">其他</option>
                          <option value="unknown">未设定</option>
                        </select>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">年龄</p>
                        <Input value={char.age || ''}
                          onChange={(e) => onUpdateCharacter({ ...char, age: e.target.value })}
                          className="h-8 text-xs rounded-[2px] focus:border-gold-400" placeholder="如：18" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">职业</p>
                        <Input value={char.occupation || ''}
                          onChange={(e) => onUpdateCharacter({ ...char, occupation: e.target.value })}
                          className="h-8 text-xs rounded-[2px] focus:border-gold-400" placeholder="如：学生" />
                      </div>
                    </div>
                  </div>

                  {/* 性格特点 - 印章按钮 */}
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold tracking-wide">性格特点（点击选择）</Label>
                    <div className="flex flex-wrap gap-1">
                      {PERSONALITY_TRAITS.map((trait) => {
                        const selected = char.personality?.includes(trait)
                        return (
                          <button
                            key={trait}
                            onClick={() => {
                              const updated = selected
                                ? (char.personality || []).filter((t) => t !== trait)
                                : [...(char.personality || []), trait]
                              onUpdateCharacter({ ...char, personality: updated })
                            }}
                            className={`px-2 py-0.5 text-[10px] font-semibold tracking-wide rounded-[1px] border-2 transition-colors ${
                              selected
                                ? 'bg-gold-400/15 border-gold-400/45 text-gold-600 dark:text-gold-500 shadow-[1px_1px_0_hsl(var(--gold)/0.15)]'
                                : 'bg-background border-dashed border-border/70 text-muted-foreground hover:border-gold-400/40 hover:text-gold-600 dark:hover:text-gold-500'
                            }`}
                          >
                            {trait}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* 外貌特征 - 赛博青印章 */}
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold tracking-wide">外貌特征（点击选择）</Label>
                    <div className="flex flex-wrap gap-1">
                      {APPEARANCE_TAGS.map((tag) => {
                        const selected = char.appearance?.includes(tag)
                        return (
                          <button
                            key={tag}
                            onClick={() => {
                              const updated = selected
                                ? (char.appearance || []).filter((t) => t !== tag)
                                : [...(char.appearance || []), tag]
                              onUpdateCharacter({ ...char, appearance: updated })
                            }}
                            className={`px-2 py-0.5 text-[10px] font-semibold tracking-wide rounded-[1px] border-2 transition-colors ${
                              selected
                                ? 'bg-cyber-cyan-400/12 border-cyber-cyan-400/45 text-cyber-cyan-500 shadow-[1px_1px_0_hsl(var(--cyber-cyan)/0.15)]'
                                : 'bg-background border-dashed border-border/70 text-muted-foreground hover:border-cyber-cyan-400/40 hover:text-cyber-cyan-500'
                            }`}
                          >
                            {tag}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* 背景故事 - P5红阴影标识情感核心内容 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-[1px] bg-p5-red" />
                      <Label className="text-[10px] font-bold tracking-wide">背景故事</Label>
                    </div>
                    <Textarea
                      value={char.background || ''}
                      onChange={(e) => onUpdateCharacter({ ...char, background: e.target.value })}
                      placeholder="角色的成长经历、重要事件等"
                      className="min-h-[60px] resize-none text-xs rounded-[2px] focus:border-p5-red/50 shadow-[2px_2px_0_hsl(var(--p5-red)/0.08)]"
                    />
                  </div>

                  {/* 说话风格 */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold tracking-wide">说话风格</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">语调</p>
                        <select
                          value={char.speech?.tone || '温和'}
                          onChange={(e) => onUpdateCharacter({ ...char, speech: { ...char.speech, tone: e.target.value } })}
                          className="w-full h-8 text-xs rounded-[2px] border border-border bg-muted px-2 text-foreground focus:outline-none focus:border-gold-400 shadow-[1px_1px_0_hsl(var(--gold)/0.08)]"
                        >
                          {SPEECH_TONES.map((tone) => (
                            <option key={tone} value={tone}>{tone}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">语速</p>
                        <select
                          value={char.speech?.rhythm || '正常'}
                          onChange={(e) => onUpdateCharacter({ ...char, speech: { ...char.speech, rhythm: e.target.value } })}
                          className="w-full h-8 text-xs rounded-[2px] border border-border bg-muted px-2 text-foreground focus:outline-none focus:border-gold-400 shadow-[1px_1px_0_hsl(var(--gold)/0.08)]"
                        >
                          {SPEECH_RHYTHMS.map((rhythm) => (
                            <option key={rhythm} value={rhythm}>{rhythm}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {/* 口头禅 - 赛博品红语义色强调台词个性化 */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-[1px] bg-cyber-magenta-500" />
                        <p className="text-[10px] font-bold tracking-wide">口头禅（每行一条）</p>
                      </div>
                      <Textarea
                        value={(char.speech?.catchphrases || []).join('\n')}
                        onChange={(e) => onUpdateCharacter({
                          ...char,
                          speech: {
                            ...char.speech,
                            catchphrases: e.target.value.split('\n').filter((l) => l.trim())
                          }
                        })}
                        placeholder="如：嘿嘿~&#10;是这样吗？"
                        className="min-h-[44px] resize-none text-xs rounded-[2px] focus:border-cyber-magenta-500/50 shadow-[2px_2px_0_hsl(var(--cyber-magenta)/0.08)]"
                      />
                    </div>
                  </div>

                  {/* 创作助理增强 */}
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold tracking-wide flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-gold-500" strokeWidth={2.4} />
                      创作助理辅助
                    </Label>
                    <CharacterAIEnhance char={char} onUpdateCharacter={onUpdateCharacter} />
                  </div>

                  {/* 删除角色 - P5红印章危险操作 */}
                  <div className="pt-1 border-t border-dashed border-border/50">
                    <Button variant="ghost" size="sm"
                      className="w-full h-8 text-xs font-semibold text-destructive hover:text-white hover:bg-p5-red rounded-[2px]
                        clip-path-polygon-[0_0,calc(100%-8px)_0,100%_8px,100%_100%,8px_100%,0_calc(100%-8px)]
                        shadow-[2px_2px_0_hsl(var(--p5-red)/0.12)] border border-p5-red/20 hover:border-p5-red"
                      onClick={() => { onDeleteCharacter(char.id); if (expandedCharId === char.id) setExpandedCharId(null) }}>
                      <Trash2 className="w-3 h-3 mr-1.5" />删除角色
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* 空角色列表 - 斜切印章感 */}
          {characters.length === 0 && (
            <div className="text-center py-8 rounded-[2px] border-2 border-dashed border-border/60 bg-muted/20 shadow-[3px_3px_0_hsl(var(--gold)/0.06)]
              clip-path-polygon-[0_0,calc(100%-10px)_0,100%_10px,100%_100%,0_100%]">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30 text-gold-600/50" strokeWidth={1.8} />
              <p className="text-xs font-bold tracking-wide text-muted-foreground">暂无角色</p>
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
      {/* 节点属性标题栏 - 金硬印章头 */}
      <div className="p-4 border-b flex items-center justify-between shadow-[0_2px_0_hsl(var(--gold)/0.08)] bg-card/95 relative">
        {/* 顶部色条语义色：按节点类型取语义色条 */}
        <div className="absolute left-0 top-0 w-full h-[2px] bg-gradient-to-r from-gold-400/80 via-gold-500/40 to-transparent" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-[1px] bg-gold-500 shadow-[1px_1px_0_hsl(var(--gold)/0.25)]" />
            <h3 className="font-bold text-sm tracking-wide">{NODE_TYPE_LABELS[type] || '节点'}</h3>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5 font-mono opacity-80">
            #{(id || '').slice(0, 8)}
          </p>
        </div>
        {/* 危险删除按钮 - P5红印章 */}
        <Button variant="ghost" size="sm" onClick={() => onDeleteNode(id)}
          className="text-destructive hover:text-white hover:bg-p5-red rounded-[2px]
            clip-path-polygon-[0_0,calc(100%-7px)_0,100%_7px,100%_100%,7px_100%,0_calc(100%-7px)]
            border border-p5-red/20 hover:border-p5-red shadow-[2px_2px_0_hsl(var(--p5-red)/0.12)]"
          title="删除节点 (Delete)">
          <Trash2 className="w-4 h-4" strokeWidth={2} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {PanelComponent ? (
          <PanelComponent node={selectedNode} characters={characters} variables={variables}
            assets={assets} scenes={scenes} onUpdateNode={onUpdateNode} onDeleteNode={onDeleteNode}
            onOpenAssets={onOpenAssets} />
        ) : (
          <div className="text-center py-8 text-muted-foreground rounded-[2px] border-2 border-dashed border-border/60 bg-muted/10">
            <p className="text-xs font-bold tracking-wide">未知节点类型：{type}</p>
          </div>
        )}

        {/* 批注快捷区 - 斜切金边便签 */}
        <div className="border-t border-dashed border-border/50 pt-3 mt-2 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wide text-foreground/80 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-[1px] bg-gold-500" />
              <MessageSquare className="w-3 h-3" strokeWidth={2} />
              节点批注
            </span>
            {annotations.length > 0 && (
              <button
                onClick={() => onViewAnnotations?.()}
                className="text-[10px] font-semibold text-gold-600 dark:text-gold-500 hover:underline"
              >
                查看 {annotations.length} 条 →
              </button>
            )}
          </div>
          {annotations.length > 0 && (
            <div className="space-y-1.5 max-h-[108px] overflow-y-auto">
              {annotations.slice(0, 3).map((anno) => {
                const typeTint = anno.type === 'warning' ? 'bg-p5-red/10 border-p5-red/40'
                  : anno.type === 'todo' ? 'bg-gold-400/10 border-gold-400/45'
                  : anno.type === 'idea' ? 'bg-cyber-magenta-500/10 border-cyber-magenta-500/40'
                  : 'bg-cyber-cyan-400/10 border-cyber-cyan-400/40'
                return (
                  <div
                    key={anno.id}
                    className={`text-[10px] px-2 py-1.5 rounded-[2px] border-2 ${typeTint} truncate
                      clip-path-polygon-[0_0,calc(100%-7px)_0,100%_7px,100%_100%,0_100%] shadow-[1px_1px_0_rgba(0,0,0,0.05)]`}
                  >
                    <span className={anno.resolved ? 'text-muted-foreground line-through' : 'text-foreground font-medium'}>
                      {anno.text}
                    </span>
                  </div>
                )
              })}
              {annotations.length > 3 && (
                <p className="text-[10px] text-muted-foreground text-center italic opacity-70">
                  还有 {annotations.length - 3} 条...
                </p>
              )}
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddAnnotation?.(id)}
            className="w-full h-8 text-xs gap-1.5 rounded-[2px] border-2 border-border hover:border-gold-400/50 hover:bg-gold-400/5 font-semibold tracking-wide
              clip-path-polygon-[0_0,calc(100%-9px)_0,100%_9px,100%_100%,0_100%] shadow-[2px_2px_0_hsl(var(--gold)/0.08)]"
          >
            <Plus className="w-3 h-3" strokeWidth={2.3} />
            添加批注
          </Button>
        </div>
      </div>

      {/* 底部提示条 - 半调网点印章感 */}
      <div className="p-3 border-t bg-muted/20 halftone-bg">
        <p className="text-[10px] text-muted-foreground text-center font-semibold tracking-wide opacity-90">
          按 <kbd className="px-1 py-0.5 rounded-[1px] border border-border/70 bg-background/80 font-mono text-[9px]">Delete</kbd> 删除节点 · 右键节点添加批注
        </p>
      </div>
    </div>
  )
}

/** 批量查看 & 管理所有已绑定 B 站视频素材的节点（只读 + 跳转提示） */
function VideoBindingsBulkSection({ graph }: { graph?: StoryGraph | null }) {
  const [open, setOpen] = useState(false)
  if (!graph) return null
  const bindings = collectAllVideoBindingsFromGraph(graph)
  const idToNode = new Map(graph.nodes.map((n) => [n.id, n]))
  return (
    <div className="rounded-[2px] border-2 border-border/70 bg-muted/15 p-3.5 space-y-2.5 shadow-[3px_3px_0_hsl(var(--cyber-cyan)/0.08)]
      clip-path-polygon-[0_0,calc(100%-11px)_0,100%_11px,100%_100%,0_100%]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {/* 视频图标盒 - 赛博青媒体语义 */}
          <div className="w-8 h-8 rounded-[2px] bg-cyber-cyan-400/10 border-2 border-cyber-cyan-400/35 flex items-center justify-center shrink-0
            clip-path-polygon-[0_0,78%_0,100%_22%,100%_100%,0_100%] shadow-[1px_1px_0_hsl(var(--cyber-cyan)/0.15)]">
            <Film className="w-4 h-4 text-cyber-cyan-500" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-wide">B 站视频素材绑定 · 批量概览</div>
            <p className="text-[11px] text-muted-foreground leading-snug opacity-90">
              共 {graph.nodes.length} 个节点，已绑定 {bindings.length} 处。点击选中节点即可在下方进行编辑。
            </p>
          </div>
        </div>
        {open ? (
          <ChevronDown className="w-4 h-4 text-cyber-cyan-500 shrink-0" strokeWidth={2.2} />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={2.2} />
        )}
      </button>
      {open && (
        <div className="rounded-[2px] border-2 border-border/60 bg-background divide-y divide-border/40 overflow-hidden shadow-[2px_2px_0_hsl(var(--cyber-cyan)/0.06)]">
          {bindings.length === 0 ? (
            <div className="px-3 py-4 text-center text-[11px] text-muted-foreground italic opacity-85">
              尚未有任何节点绑定视频素材。选中具体节点，在「视频素材绑定」折叠块里编辑即可。
            </div>
          ) : (
            bindings.map((b, idx) => {
              const node = idToNode.get(b.nodeId) as any
              const title =
                b.partTitle ||
                (node?.data?.title as string | undefined) ||
                (node?.data?.text as string | undefined)?.slice(0, 20) ||
                b.nodeId.slice(0, 10)
              return (
                <div key={b.nodeId} className="px-3 py-2.5 hover:bg-cyber-cyan-400/5 transition-colors"
                  style={idx % 2 === 1 ? { backgroundColor: 'color-mix(in srgb, hsl(var(--muted)) 30%, transparent)' } : undefined}>
                  <div className="text-[11px] font-bold tracking-wide flex items-center justify-between gap-2">
                    <span className="truncate flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-[1px] bg-cyber-cyan-500/80 shrink-0" />
                      {title}
                    </span>
                    <span className="text-[9px] font-mono text-muted-foreground shrink-0 px-1 py-0.5 rounded-[1px] border border-border/50 bg-muted/30">
                      {b.nodeId.slice(0, 8)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-1.5 text-[10px]">
                    <div className="col-span-3 text-muted-foreground break-all truncate font-medium">
                      {b.assetRef || '（未绑定素材路径）'}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground/80">时长</span>
                      <span className="font-bold text-foreground/85">{b.durationSec ?? '默认'}s</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground/80">弹窗</span>
                      <span className="font-bold text-foreground/85">
                        {b.popupOffsetSec == null
                          ? '默认'
                          : b.popupOffsetSec < 0
                          ? '不显示'
                          : `${b.popupOffsetSec}s`}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="px-1.5 py-0.5 rounded-[1px] border-2 border-gold-400/30 bg-gold-400/10 text-gold-600 dark:text-gold-500 font-bold">
                        {(node?.type as string) || 'unknown'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
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