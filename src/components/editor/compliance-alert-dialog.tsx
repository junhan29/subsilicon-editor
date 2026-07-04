'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, Shield, AlertCircle, X, ExternalLink, TrendingUp } from 'lucide-react'
import { getComplianceStatus } from '@editor/lib/compliance-tracker'
import type { ComplianceWarning } from '@editor/lib/work-monetization'

interface ComplianceAlertDialogProps {
  open: boolean
  onClose: () => void
}

const LEVEL_CONFIG = {
  safe: { icon: Shield, color: 'text-green-400', bg: 'bg-green-900/20', border: 'border-green-800' },
  notice: { icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-900/20', border: 'border-blue-800' },
  warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-900/20', border: 'border-amber-800' },
  critical: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-900/20', border: 'border-red-800' },
}

export function ComplianceAlertDialog({ open, onClose }: ComplianceAlertDialogProps) {
  const [warnings, setWarnings] = useState<ComplianceWarning[]>([])
  const [level, setLevel] = useState<'safe' | 'notice' | 'warning' | 'critical'>('safe')
  const [income, setIncome] = useState(0)
  const [monthlyAvg, setMonthlyAvg] = useState(0)

  useEffect(() => {
    if (open) {
      const status = getComplianceStatus()
      setWarnings(status.warnings)
      setLevel(status.warningLevel)
      setIncome(status.currentYearIncome)
      setMonthlyAvg(status.monthlyAverage)
    }
  }, [open])

  if (!open) return null

  const config = LEVEL_CONFIG[level]
  const Icon = config.icon

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-[90%] max-w-[480px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl ${config.bg} ${config.border} border flex items-center justify-center`}>
              <Icon className={`w-6 h-6 ${config.color}`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">合规提醒</h3>
              <p className="text-sm text-slate-400">
                系统检测到您的收入情况需要关注以下合规事项
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700">
            <div>
              <p className="text-xs text-slate-400 mb-1">本年度累计收入</p>
              <p className="text-xl font-bold text-white">¥{income.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">近3个月月均</p>
              <p className="text-xl font-bold text-white">¥{monthlyAvg.toFixed(2)}</p>
            </div>
          </div>

          <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
            {warnings.map((warning, i) => {
              const wConfig = LEVEL_CONFIG[warning.level]
              const WIcon = wConfig.icon
              return (
                <div
                  key={i}
                  className={`p-4 rounded-xl border ${wConfig.bg} ${wConfig.border}`}
                >
                  <div className="flex items-start gap-3">
                    <WIcon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${wConfig.color}`} />
                    <div className="flex-1 space-y-2">
                      <p className="font-medium text-white">{warning.title}</p>
                      <p className="text-sm text-slate-300 leading-relaxed">{warning.message}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">
                          当前 ¥{warning.current.toFixed(0)} / 阈值 ¥{warning.threshold.toFixed(0)}
                        </span>
                        {warning.action && (
                          <a
                            href="#"
                            className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                            onClick={(e) => {
                              e.preventDefault()
                            }}
                          >
                            {warning.action}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors"
            >
              我知道了
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
