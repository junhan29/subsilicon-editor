'use client'

import { useState } from 'react'
import {
  MousePointerClick,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Play,
  X,
  ChevronRight,
  PanelLeft,
  Edit3,
  PanelRight,
} from 'lucide-react'
import { Button } from '@editor/components/ui/button'

interface EmptyCanvasGuideProps {
  onQuickAdd: (type: string) => void
  onStartTour: () => void
}

interface GuideStep {
  id: 'sidebar' | 'canvas' | 'panel'
  title: string
  description: string
  hint: string
  icon: React.ReactNode
  direction: 'left' | 'center' | 'right'
}

const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'sidebar',
    title: '从左侧拖拽节点开始',
    description: '左侧面板包含对话、选择、结局等各种故事节点。把它们拖到中间画布上，就能搭建故事结构。',
    hint: '← 看向左侧节点库',
    icon: <PanelLeft className="w-5 h-5" />,
    direction: 'left',
  },
  {
    id: 'canvas',
    title: '双击节点编辑内容',
    description: '在画布上双击节点可进入编辑状态，拖动节点可调整位置。从节点底部圆点拖到下一个节点顶部即可创建连线。',
    hint: '看这里 — 中间画布',
    icon: <Edit3 className="w-5 h-5" />,
    direction: 'center',
  },
  {
    id: 'panel',
    title: '在右侧面板设置属性',
    description: '选中节点后，右侧面板会出现该节点的详细属性 — 对话台词、选项分支、付费金额等都可以在这里编辑。',
    hint: '看向右侧属性面板 →',
    icon: <PanelRight className="w-5 h-5" />,
    direction: 'right',
  },
]

const QUICK_ACTIONS = [
  { type: 'dialogue', label: '对话', desc: '角色台词', color: 'text-amber-300 border-amber-500/40 hover:border-amber-400 hover:bg-amber-500/10' },
  { type: 'choice', label: '选择', desc: '玩家分支', color: 'text-amber-300 border-amber-500/40 hover:border-amber-400 hover:bg-amber-500/10' },
  { type: 'condition', label: '条件', desc: '分支判断', color: 'text-amber-300 border-amber-500/40 hover:border-amber-400 hover:bg-amber-500/10' },
  { type: 'jump', label: '跳转', desc: '跳转节点', color: 'text-amber-300 border-amber-500/40 hover:border-amber-400 hover:bg-amber-500/10' },
  { type: 'random', label: '随机', desc: '随机选择', color: 'text-amber-300 border-amber-500/40 hover:border-amber-400 hover:bg-amber-500/10' },
  { type: 'ending', label: '结局', desc: '故事终点', color: 'text-amber-300 border-amber-500/40 hover:border-amber-400 hover:bg-amber-500/10' },
]

export function EmptyCanvasGuide({ onQuickAdd, onStartTour }: EmptyCanvasGuideProps) {
  // step 为 0/1/2 表示引导中；3 表示已完成或跳过，进入快速添加阶段
  const [step, setStep] = useState(0)

  const inGuide = step < GUIDE_STEPS.length
  const current = GUIDE_STEPS[Math.min(step, GUIDE_STEPS.length - 1)]
  const isLastGuideStep = step === GUIDE_STEPS.length - 1

  const handleNext = () => {
    if (isLastGuideStep) {
      setStep(GUIDE_STEPS.length)
    } else {
      setStep((s) => s + 1)
    }
  }

  const handleSkip = () => {
    setStep(GUIDE_STEPS.length)
  }

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
        <div className="flex items-center gap-1 text-amber-400 animate-pulse">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-medium">{guide.hint}</span>
        </div>
      )
    }
    if (guide.direction === 'right') {
      return (
        <div className="flex items-center gap-1 text-amber-400 animate-pulse">
          <span className="text-xs font-medium">{guide.hint}</span>
          <ArrowRight className="w-4 h-4" />
        </div>
      )
    }
    return (
      <div className="flex items-center gap-1 text-amber-400 animate-pulse">
        <span className="text-xs font-medium">{guide.hint}</span>
      </div>
    )
  }

  return (
    <div className="pointer-events-auto w-[min(92vw,420px)]">
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-b from-slate-800/95 to-slate-900/95 shadow-2xl shadow-amber-500/10 backdrop-blur">
        {/* 顶部进度条 */}
        <div className="h-1 w-full bg-slate-700/60">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-300"
            style={{ width: `${((step + 1) / total) * 100}%` }}
          />
        </div>

        {/* 关闭按钮 */}
        <button
          onClick={onSkip}
          aria-label="跳过引导"
          className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-slate-700/50 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="p-5">
          {/* 步骤标签 + 进度 */}
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-[10px] font-semibold tracking-wide">
              <Sparkles className="w-3 h-3" />
              新手引导
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {step + 1} / {total}
            </span>
            {/* 圆点进度指示 */}
            <div className="flex items-center gap-1 ml-1">
              {Array.from({ length: total }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step
                      ? 'w-4 bg-amber-400'
                      : i < step
                      ? 'w-1.5 bg-amber-500/60'
                      : 'w-1.5 bg-slate-600'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* 图标 + 标题 */}
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-300">
              {guide.icon}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <h3 className="text-base font-semibold text-slate-50 leading-snug">
                {guide.title}
              </h3>
            </div>
          </div>

          {/* 描述 */}
          <p className="text-xs text-slate-300 leading-relaxed mb-4 pl-13">
            {guide.description}
          </p>

          {/* 方向提示 */}
          <div className="mb-4 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/60">
            <DirectionArrow />
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onSkip}
              className="text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
            >
              跳过
            </Button>
            <Button
              size="sm"
              onClick={onNext}
              className="flex-1 gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white border-amber-400/40"
            >
              {isLast ? (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  开始创作
                </>
              ) : (
                <>
                  下一步
                  <ChevronRight className="w-3.5 h-3.5" />
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
    <div className="text-center pointer-events-auto">
      {/* 主图标 */}
      <div className="relative inline-block mb-6">
        <div className="w-20 h-20 rounded-3xl bg-slate-800/60 border-2 border-dashed border-amber-500/40 flex items-center justify-center">
          <MousePointerClick className="w-9 h-9 text-amber-300/70" />
        </div>
        <div className="absolute -right-8 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-amber-300/70">
          <span className="text-xs">从左侧拖拽</span>
          <ArrowRight className="w-4 h-4 animate-pulse" />
        </div>
      </div>

      {/* 提示文字 */}
      <h3 className="text-base font-semibold text-slate-200 mb-1">开始你的故事</h3>
      <p className="text-xs text-slate-400 mb-5 max-w-xs mx-auto">
        从左侧面板拖拽节点到画布，或点击下方快速添加
      </p>

      {/* 快速添加按钮 */}
      <div className="flex items-center justify-center gap-2 mb-5">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.type}
            onClick={() => onQuickAdd(action.type)}
            className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border-2 border-dashed transition-all bg-slate-800/40 ${action.color}`}
          >
            <span className="text-sm font-medium">{action.label}</span>
            <span className="text-[10px] opacity-70">{action.desc}</span>
          </button>
        ))}
      </div>

      {/* 重新引导按钮 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onStartTour}
        className="gap-1.5 text-slate-400 hover:text-amber-300 hover:bg-slate-800/50"
      >
        <Play className="w-3.5 h-3.5" />
        重新播放引导
      </Button>
    </div>
  )
}
