'use client'

import {
  X,
  Sparkles,
  MousePointer2,
  GitBranch,
  Lock,
  Flag,
  Play,
  ChevronRight,
  BookOpen,
  Keyboard,
  Zap,
  LayoutTemplate,
  Clock,
} from 'lucide-react'
import { Button } from '@editor/components/ui/button'

interface WelcomeModalProps {
  open: boolean
  onClose: () => void
  onStartTour: () => void
  onShowShortcuts: () => void
  /** 点击"快速开始"：直接创建一个对话节点 */
  onQuickStart?: () => void
  /** 点击"从模板开始"：打开模板选择器 */
  onShowTemplates?: () => void
  /** 点击"继续编辑"：恢复最近文件 */
  onContinueEditing?: () => void
  /** 是否存在最近文件（控制"继续编辑"按钮显隐） */
  hasRecentWork?: boolean
  /** 最近文件名（用于按钮副标题） */
  recentWorkName?: string
}

const FEATURES = [
  {
    icon: <MousePointer2 className="w-5 h-5" />,
    title: '拖拽节点',
    desc: '从左侧面板拖拽节点到画布，构建你的故事结构',
    color: 'text-amber-300 bg-amber-500/15',
  },
  {
    icon: <GitBranch className="w-5 h-5" />,
    title: '连接分支',
    desc: '拖动节点底部的连接点到下一个节点，创建故事线',
    color: 'text-amber-300 bg-amber-500/15',
  },
  {
    icon: <Lock className="w-5 h-5" />,
    title: '付费解锁',
    desc: '添加付费节点，设置解锁金额，让读者支持你的创作',
    color: 'text-amber-300 bg-amber-500/15',
  },
  {
    icon: <Flag className="w-5 h-5" />,
    title: '多结局',
    desc: '创作不同走向的结局，让读者的选择影响故事走向',
    color: 'text-amber-300 bg-amber-500/15',
  },
]

export function WelcomeModal({
  open,
  onClose,
  onStartTour,
  onShowShortcuts,
  onQuickStart,
  onShowTemplates,
  onContinueEditing,
  hasRecentWork = false,
  recentWorkName,
}: WelcomeModalProps) {
  if (!open) return null

  const handleStart = () => {
    onClose()
    onStartTour()
  }

  const handleQuickStart = () => {
    onClose()
    onQuickStart?.()
  }

  const handleShowTemplates = () => {
    onClose()
    onShowTemplates?.()
  }

  const handleContinue = () => {
    onClose()
    onContinueEditing?.()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-gradient-to-b from-slate-900 to-slate-950 rounded-2xl shadow-2xl overflow-hidden border border-amber-500/20">
        {/* 顶部装饰 */}
        <div className="relative h-36 bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent flex items-center justify-center">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 50%, rgba(251, 146, 60, 0.35) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(245, 158, 11, 0.35) 0%, transparent 50%)',
            }}
          />
          <div className="relative flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-900/80 shadow-lg flex items-center justify-center mb-2 border border-amber-500/30">
              <Sparkles className="w-7 h-7 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-50 tracking-tight">SubSilicon Editor</h2>
            <p className="text-xs text-amber-300/80 mt-1 font-medium tracking-wide">
              零代码可视化互动叙事编辑器
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="absolute top-3 right-3 w-8 h-8 rounded-full hover:bg-slate-800/60 flex items-center justify-center transition-colors text-slate-300 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 功能介绍 */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-3 mb-5">
            {FEATURES.map((feature, i) => (
              <div
                key={i}
                className="flex gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/60"
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${feature.color}`}
                >
                  {feature.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-100">{feature.title}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* 三大入口按钮 */}
          <div className="space-y-2">
            {/* 主推：快速开始 */}
            {onQuickStart && (
              <Button
                onClick={handleQuickStart}
                className="w-full gap-2 h-11 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white border-amber-400/40 shadow-lg shadow-amber-500/20"
              >
                <Zap className="w-4 h-4" />
                快速开始
                <span className="text-[11px] font-normal opacity-80 ml-1">
                  · 直接创建一个对话节点
                </span>
                <ChevronRight className="w-4 h-4 ml-auto" />
              </Button>
            )}

            {/* 从模板开始 */}
            {onShowTemplates && (
              <Button
                variant="outline"
                onClick={handleShowTemplates}
                className="w-full gap-2 h-10 border-slate-700 bg-slate-800/40 text-slate-100 hover:bg-slate-800 hover:text-amber-300 hover:border-amber-500/40"
              >
                <LayoutTemplate className="w-4 h-4" />
                从模板开始
                <span className="text-[11px] opacity-60 ml-1">· 选择预设故事结构</span>
                <ChevronRight className="w-4 h-4 ml-auto" />
              </Button>
            )}

            {/* 继续编辑（仅当存在最近文件时显示） */}
            {onContinueEditing && hasRecentWork && (
              <Button
                variant="outline"
                onClick={handleContinue}
                className="w-full gap-2 h-10 border-slate-700 bg-slate-800/40 text-slate-100 hover:bg-slate-800 hover:text-amber-300 hover:border-amber-500/40"
              >
                <Clock className="w-4 h-4" />
                继续编辑
                {recentWorkName && (
                  <span className="text-[11px] opacity-60 ml-1 truncate max-w-[180px]">
                    · {recentWorkName}
                  </span>
                )}
                <ChevronRight className="w-4 h-4 ml-auto" />
              </Button>
            )}

            {/* 引导之旅 */}
            <Button
              variant="ghost"
              onClick={handleStart}
              className="w-full gap-2 h-10 text-slate-300 hover:text-amber-300 hover:bg-slate-800/50"
            >
              <Play className="w-4 h-4" />
              引导之旅（1 分钟）
            </Button>
          </div>

          {/* 次要操作 */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onShowShortcuts}
              className="gap-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            >
              <Keyboard className="w-3.5 h-3.5" />
              快捷键
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="gap-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            >
              <BookOpen className="w-3.5 h-3.5" />
              直接开始
            </Button>
          </div>


        </div>

        {/* 底部提示 */}
        <div className="px-6 pb-5 pt-2 border-t border-slate-800 bg-slate-900/40">
          <p className="text-[11px] text-slate-500 text-center">
            随时按{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300">
              ?
            </kbd>{' '}
            查看快捷键 · 点击右上角{' '}
            <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-slate-800 text-[8px] text-slate-300">
              ?
            </span>{' '}
            查看帮助
          </p>
        </div>
      </div>
    </div>
  )
}
