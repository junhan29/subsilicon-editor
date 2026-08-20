'use client'

import { useCallback, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Edit3,
  MessageSquare,
  MousePointerClick,
  PanelLeft,
  PanelRight,
  Play,
  Sparkles,
  X,
} from 'lucide-react'
import { Button } from '@editor/components/ui/button'

interface EmptyCanvasGuideProps {
  onQuickAdd: (type: string) => void
  onStartTour: () => void
}

interface GuideStep {
  id: 'sidebar' | 'ai' | 'canvas' | 'panel'
  title: string
  description: string
  hint: string
  icon: React.ReactNode
  direction: 'left' | 'center' | 'right'
}

const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'sidebar',
    title: '从左侧节点库开始',
    description: '左侧面板包含对话、选择、结局等各种故事节点。把它们拖到右侧画布上，就能搭建故事结构。',
    hint: '← 看向左侧节点库',
    icon: <PanelLeft className="w-5 h-5" />,
    direction: 'left',
  },
  {
    id: 'ai',
    title: '在中间与 AI 协作',
    description: '中间是创作助理 AI 面板，用自然语言描述你想要的剧情、角色或节点，AI 会自动生成并应用到画布。',
    hint: '中间 AI 面板',
    icon: <MessageSquare className="w-5 h-5" />,
    direction: 'center',
  },
  {
    id: 'canvas',
    title: '在右侧画布直接操作',
    description: '右侧是主画布，可直接拖拽节点、双击编辑、从节点底部圆点连线。拖拽右栏左边缘可放大画布，或点击全屏按钮进入纯手动画布模式。',
    hint: '右侧主画布',
    icon: <Edit3 className="w-5 h-5" />,
    direction: 'right',
  },
  {
    id: 'panel',
    title: '在属性面板精调细节',
    description: '选中节点后，右栏内的属性面板会出现详细设置 — 对话台词、选项分支、付费金额等都可以在这里编辑。',
    hint: '右栏内属性面板',
    icon: <PanelRight className="w-5 h-5" />,
    direction: 'right',
  },
]

const QUICK_ACTIONS = [
  { type: 'dialogue', label: '对话', desc: '角色台词', color: 'text-gold-400 border-gold-400/40 hover:border-amber-400 hover:bg-gold-400/10' },
  { type: 'choice', label: '选择', desc: '玩家分支', color: 'text-gold-400 border-gold-400/40 hover:border-amber-400 hover:bg-gold-400/10' },
  { type: 'condition', label: '条件', desc: '分支判断', color: 'text-gold-400 border-gold-400/40 hover:border-amber-400 hover:bg-gold-400/10' },
  { type: 'jump', label: '跳转', desc: '跳转节点', color: 'text-gold-400 border-gold-400/40 hover:border-amber-400 hover:bg-gold-400/10' },
  { type: 'random', label: '随机', desc: '随机选择', color: 'text-gold-400 border-gold-400/40 hover:border-amber-400 hover:bg-gold-400/10' },
  { type: 'ending', label: '结局', desc: '故事终点', color: 'text-gold-400 border-gold-400/40 hover:border-amber-400 hover:bg-gold-400/10' },
]

const EMPTY_GUIDE_COMPLETED_KEY = 'subsilicon_empty_guide_completed'

function isEmptyGuideCompleted(): boolean {
  try {
    return localStorage.getItem(EMPTY_GUIDE_COMPLETED_KEY) === 'true'
  } catch {
    return false
  }
}

function markEmptyGuideCompleted(): void {
  try {
    localStorage.setItem(EMPTY_GUIDE_COMPLETED_KEY, 'true')
  } catch {
    // 忽略写入失败（隐私模式 / 存储配额超限）
  }
}

export function EmptyCanvasGuide({ onQuickAdd, onStartTour }: EmptyCanvasGuideProps) {
  // step 为 0/1/2 表示引导中；3 表示已完成或跳过，进入快速添加阶段
  const [step, setStep] = useState(() => {
    return isEmptyGuideCompleted() ? GUIDE_STEPS.length : 0
  })

  const inGuide = step < GUIDE_STEPS.length
  const current = GUIDE_STEPS[Math.min(step, GUIDE_STEPS.length - 1)]
  const isLastGuideStep = step === GUIDE_STEPS.length - 1

  const handleNext = useCallback(() => {
    if (isLastGuideStep) {
      markEmptyGuideCompleted()
      setStep(GUIDE_STEPS.length)
    } else {
      setStep((s) => s + 1)
    }
  }, [isLastGuideStep])

  const handleSkip = useCallback(() => {
    markEmptyGuideCompleted()
    setStep(GUIDE_STEPS.length)
  }, [])

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
      {inGuide ? (
        <GuideCard
          step={step}
          total={GUIDE_STEPS.length}
          guide={current}
          onNext={handleNext}
          onSkip={handleSkip}
          isLast={isLastGuideStep}
        />
      ) : (
        <QuickAddPanel onQuickAdd={onQuickAdd} onStartTour={onStartTour} />
      )}
    </div>
  )
}

interface GuideCardProps {
  step: number
  total: number
  guide: GuideStep
  onNext: () => void
  onSkip: () => void
  isLast: boolean
}

function GuideCard({ step, total, guide, onNext, onSkip, isLast }: GuideCardProps) {
  // 根据方向渲染指向箭头
  const DirectionArrow = () => {
    if (guide.direction === 'left') {
      return (
        <div className="flex items-center gap-1 text-gold-400 animate-pulse">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-medium">{guide.hint}</span>
        </div>
      )
    }
    if (guide.direction === 'right') {
      return (
        <div className="flex items-center gap-1 text-gold-400 animate-pulse">
          <span className="text-xs font-medium">{guide.hint}</span>
          <ArrowRight className="w-4 h-4" />
        </div>
      )
    }
    return (
      <div className="flex items-center gap-1 text-gold-400 animate-pulse">
        <span className="text-xs font-medium">{guide.hint}</span>
      </div>
    )
  }

  return (
    <div className="pointer-events-auto w-[min(92vw,440px)] tape-top">
      <div className="relative overflow-hidden rounded-xl border-2 border-primary shadow-[6px_6px_0_hsl(var(--primary)/0.35)] bg-card">
        {/* 半调网点背景（P5 怪盗视觉） */}
        <div className="absolute inset-0 halftone-bg opacity-25 pointer-events-none" aria-hidden />
        {/* 左上红印章 + 右上金色斜切装饰 */}
        <div className="absolute top-3 left-3 z-10 pointer-events-none">
          <div className="stamp-red text-[10px] px-2 py-0.5">
            第 {step + 1} 章 / {total}
          </div>
        </div>
        <div className="pointer-events-none absolute top-0 right-0 w-24 h-24 overflow-hidden" aria-hidden>
          <div
            className="absolute top-0 right-0 w-16 h-16 rotate-12 translate-y-[-50%] translate-x-[25%]"
            style={{
              background:
                'linear-gradient(135deg, hsl(var(--gold)) 0%, hsl(var(--primary)) 100%)',
            }}
          />
        </div>

        {/* 顶部进度条 */}
        <div className="relative h-1.5 w-full bg-muted/80 border-b border-border/50">
          <div
            className="h-full bg-gradient-to-r from-primary via-gold-400 to-cyber-cyan-500 transition-all duration-300"
            style={{ width: `${((step + 1) / total) * 100}%` }}
          />
        </div>

        {/* 关闭按钮 */}
        <button
          onClick={onSkip}
          aria-label="跳过引导"
          className="absolute top-3 right-3 z-20 w-8 h-8 rounded-md border border-border/60 bg-card/90 hover:bg-destructive/10 hover:border-destructive/50 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="relative p-5 pt-8">
          {/* 顶部标签栏 */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <span className="p5-sash-gold text-[10px] !py-1 !px-3">
              <span className="mr-1.5">✦</span>
              新手引导
            </span>
            {/* 圆点进度指示 */}
            <div className="flex items-center gap-1">
              {Array.from({ length: total }).map((_, i) => (
                <span
                  key={i}
                  className={`transition-all rounded-sm ${
                    i === step
                      ? 'w-5 h-2 bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.4)]'
                      : i < step
                      ? 'w-2 h-2 bg-gold-400'
                      : 'w-2 h-2 bg-border'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* 图标 + 标题 */}
          <div className="flex items-start gap-3 mb-4">
            <div className="relative">
              <div className="w-11 h-11 rounded-lg bg-card border-2 border-gold-400/60 flex items-center justify-center shrink-0 text-gold-400 shadow-[3px_3px_0_hsl(var(--gold)/0.35)] rotate-[-3deg]">
                {guide.icon}
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-cyber-cyan-500 border-2 border-card" />
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h3 className="text-lg font-black text-foreground leading-snug tracking-wide">
                {guide.title}
              </h3>
            </div>
          </div>

          {/* 描述 */}
          <p className="text-sm text-foreground leading-relaxed mb-5 border-l-2 border-primary/60 pl-3">
            {guide.description}
          </p>

          {/* 方向提示 */}
          <div className="mb-5 px-3 py-2.5 rounded-md bg-gold-400/8 border border-gold-400/30 relative">
            <DirectionArrow />
            <div className="absolute inset-0 pointer-events-none halftone-bg-gold opacity-30" aria-hidden />
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2">
            <Button
              variant="stamp-gold"
              size="sm"
              onClick={onSkip}
            >
              跳过
            </Button>
            <Button
              variant="p5-clipped"
              size="sm"
              onClick={onNext}
              className="flex-1 gap-1.5 text-foreground"
            >
              {isLast ? (
                <>
                  <Sparkles className="w-4 h-4 text-primary" />
                  开始创作
                </>
              ) : (
                <>
                  下一步
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface QuickAddPanelProps {
  onQuickAdd: (type: string) => void
  onStartTour: () => void
}

function QuickAddPanel({ onQuickAdd, onStartTour }: QuickAddPanelProps) {
  return (
    <div className="relative text-center pointer-events-auto w-[min(92vw,480px)]">
      {/* 顶部金色胶带 */}
      <div className="relative inline-block tape-top mb-2">
        {/* 标题板 */}
        <div className="relative p-5 pr-7 rounded-xl border-2 border-gold-400/60 bg-card shadow-[6px_6px_0_hsl(var(--gold)/0.3)]">
          {/* 半调网点背景 */}
          <div className="absolute inset-0 halftone-bg-gold opacity-25 pointer-events-none" aria-hidden />
          {/* 左上角斜切红装饰 */}
          <div className="pointer-events-none absolute top-0 left-0 w-20 h-20 overflow-hidden" aria-hidden>
            <div
              className="absolute top-0 left-0 w-14 h-14 -rotate-12 translate-y-[-50%] translate-x-[-25%]"
              style={{
                background:
                  'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--gold)) 100%)',
              }}
            />
          </div>

          {/* 主图标（怪盗 LOGO 风） */}
          <div className="relative inline-block mb-5 mt-2">
            <div className="w-20 h-20 rounded-xl border-2 border-primary bg-card flex items-center justify-center shadow-[4px_4px_0_hsl(var(--primary)/0.35)] rotate-[-4deg]">
              <MousePointerClick className="w-10 h-10 text-primary" />
            </div>
            <div className="absolute -bottom-1 -right-2 rotate-[8deg]">
              <div className="stamp-gold text-[10px] !py-0.5 !px-2">
                START!
              </div>
            </div>
            <div className="absolute -right-10 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-primary/80">
              <ArrowRight className="w-4 h-4 animate-pulse" />
              <span className="text-xs font-bold">从左侧拖拽</span>
            </div>
          </div>

          {/* 提示文字 */}
          <h3 className="text-xl font-black text-foreground mb-1 tracking-wide">
            开始你的故事
          </h3>
          <p className="text-xs text-muted-foreground mb-5 max-w-xs mx-auto leading-relaxed">
            从左侧面板拖拽节点到画布，或点击下方按钮<span className="text-gold-400 font-bold"> 快速添加 </span>故事节点
          </p>

          {/* 快速添加按钮 — 6 个节点 */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            {QUICK_ACTIONS.map((action, i) => (
              <button
                key={action.type}
                onClick={() => onQuickAdd(action.type)}
                className={`relative flex flex-col items-center gap-1 px-2 py-3 rounded-md border-2 transition-all bg-card hover:-translate-y-0.5 ${
                  i % 2 === 0
                    ? 'border-primary/50 shadow-[3px_3px_0_hsl(var(--primary)/0.25)] hover:shadow-[4px_4px_0_hsl(var(--primary)/0.35)]'
                    : 'border-gold-400/50 shadow-[3px_3px_0_hsl(var(--gold)/0.25)] hover:shadow-[4px_4px_0_hsl(var(--gold)/0.35)]'
                } ${action.color}`}
                style={{ transform: `rotate(${i % 2 === 0 ? -1 : 1}deg)` }}
              >
                <span className="text-sm font-black tracking-wide">{action.label}</span>
                <span className="text-[10px] opacity-80">{action.desc}</span>
              </button>
            ))}
          </div>

          {/* 重新引导按钮 */}
          <Button
            variant="cyber-magenta"
            size="sm"
            onClick={onStartTour}
            className="gap-1.5"
          >
            <Play className="w-3.5 h-3.5" />
            重新播放引导
          </Button>
        </div>
      </div>
    </div>
  )
}
