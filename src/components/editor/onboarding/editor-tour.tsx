'use client'

import { useState, useEffect } from 'react'
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react'
import { Button } from '@editor/components/ui/button'
import type { TourStep } from './tour-steps'

const TOUR_COMPLETED_KEY = 'subsilicon_tour_completed'

export function isTourCompleted(): boolean {
  try {
    return localStorage.getItem(TOUR_COMPLETED_KEY) === 'true'
  } catch {
    return false
  }
}

export function markTourCompleted(): void {
  try {
    localStorage.setItem(TOUR_COMPLETED_KEY, 'true')
  } catch {
  }
}

export function resetTour(): void {
  try {
    localStorage.removeItem(TOUR_COMPLETED_KEY)
  } catch {
  }
}

interface EditorTourProps {
  active: boolean
  steps: TourStep[]
  onClose: () => void
  onComplete?: () => void
}

export function EditorTour({ active, steps, onClose, onComplete }: EditorTourProps) {
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    if (active) {
      setCurrentStep(0)
    }
  }, [active])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!active) return
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') handleNext()
      if (e.key === 'ArrowLeft') handlePrev()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, currentStep])

  if (!active || steps.length === 0) return null

  const step = steps[currentStep]
  const isLast = currentStep === steps.length - 1
  const isFirst = currentStep === 0

  const handleNext = () => {
    if (isLast) {
      markTourCompleted()
      onClose()
      onComplete?.()
    } else {
      setCurrentStep((s) => s + 1)
    }
  }

  const handlePrev = () => {
    if (!isFirst) {
      setCurrentStep((s) => s - 1)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] pointer-events-none">
      {/* 半透明遮罩 */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />

      {/* 引导卡片 - 居中显示 */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
        <div className="w-full max-w-md bg-background rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* 顶部进度 */}
          <div className="h-1 bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>

          <div className="p-6">
            {/* 图标和标题 */}
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                {step.icon || <Sparkles className="w-6 h-6 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {currentStep + 1} / {steps.length}
                  </span>
                </div>
                <h3 className="text-lg font-bold">{step.title}</h3>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center shrink-0 transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* 描述 */}
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              {step.description}
            </p>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
              {!isFirst && (
                <Button variant="outline" onClick={handlePrev} className="gap-1.5">
                  <ChevronLeft className="w-4 h-4" />
                  上一步
                </Button>
              )}
              {isFirst && <div className="flex-1" />}
              <Button onClick={handleNext} className="flex-1 gap-1.5">
                {isLast ? (
                  <>
                    <Sparkles className="w-4 h-4" />
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

            {/* 跳过提示 */}
            <p className="text-[10px] text-muted-foreground text-center mt-3">
              按 <kbd className="px-1 py-0.5 rounded bg-muted font-mono">Esc</kbd> 跳过引导 ·{' '}
              <kbd className="px-1 py-0.5 rounded bg-muted font-mono">←</kbd>{' '}
              <kbd className="px-1 py-0.5 rounded bg-muted font-mono">→</kbd> 切换步骤
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
