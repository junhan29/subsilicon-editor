'use client'

import { useState, useMemo } from 'react'
import { DollarSign, Plus, Trash2, Wallet, TrendingUp, AlertCircle } from 'lucide-react'
import { showToast } from './toast'
import {
  loadIncomeTracking, addIncomeRecord, deleteIncomeRecord, getComplianceStatus,
} from '@editor/lib/compliance-tracker'
import type { StoryGraph } from '@editor/types/editor'
import { generateWorkId } from '@editor/lib/work-monetization'

interface IncomePanelProps {
  graph?: StoryGraph
  workId: string
}

export function IncomePanel({ graph, workId }: IncomePanelProps) {
  const [tracking, setTracking] = useState(loadIncomeTracking())
  const [showAdd, setShowAdd] = useState(false)
  const [amount, setAmount] = useState('')
  const [channel, setChannel] = useState<string>('other')
  const [note, setNote] = useState('')

  const records = tracking.records
  const compliance = useMemo(() => getComplianceStatus(), [tracking])

  const handleAdd = () => {
    const num = parseFloat(amount)
    if (!num || num <= 0) {
      showToast('error', '请输入有效金额')
      return
    }
    addIncomeRecord({ workId, workTitle: note || '未命名作品', amount: num, channel: channel as any, note: note || '未记录', date: Date.now() })
    setTracking(loadIncomeTracking())
    setShowAdd(false)
    setAmount('')
    setNote('')
    showToast('success', '收入记录已添加')
  }

  const handleDelete = (id: string) => {
    deleteIncomeRecord(id)
    setTracking(loadIncomeTracking())
  }

  const yearlyTotal = records.reduce((sum, r) => sum + r.amount, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
          <DollarSign className="w-4 h-4 text-emerald-400" />
          收益管理
        </h3>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-md transition-colors"
        >
          <Plus className="w-3 h-3" />
          添加记录
        </button>
      </div>

      {showAdd && (
        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-12">金额</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="flex-1 h-7 text-xs rounded border border-slate-600 bg-slate-700 px-2 text-white"
            />
            <span className="text-xs text-slate-400">元</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-12">渠道</span>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="flex-1 h-7 text-xs rounded border border-slate-600 bg-slate-700 px-1.5 text-white"
            >
              <option value="wechat">微信</option>
              <option value="alipay">支付宝</option>
              <option value="third_party">第三方平台</option>
              <option value="other">其他</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-12">备注</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="作品名称或来源"
              className="flex-1 h-7 text-xs rounded border border-slate-600 bg-slate-700 px-2 text-white"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setShowAdd(false)}
              className="px-2 py-1 text-[10px] text-slate-400 hover:text-slate-200"
            >
              取消
            </button>
            <button
              onClick={handleAdd}
              className="px-3 py-1 text-[10px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded transition-colors"
            >
              保存
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <Wallet className="w-3.5 h-3.5" />
            年度总收入
          </div>
          <div className="text-xl font-bold text-emerald-400">
            ¥{yearlyTotal.toFixed(2)}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <TrendingUp className="w-3.5 h-3.5" />
            合规状态
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              compliance.warningLevel === 'safe'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-amber-500/20 text-amber-400'
            }`}>
              {compliance.warningLevel === 'safe' ? '安全' : '关注'}
            </span>
            {compliance.warningLevel !== 'safe' && (
              <AlertCircle className="w-3 h-3 text-amber-400" />
            )}
          </div>
        </div>
      </div>

      {compliance.warnings.length > 0 && (
        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertCircle className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] text-amber-400 font-medium">合规提示</span>
          </div>
          {compliance.warnings.map((w, i) => (
            <p key={i} className="text-[10px] text-amber-400/80 ml-5">{w.title}: {w.message}</p>
          ))}
        </div>
      )}

      <div>
        <h4 className="text-xs font-medium text-slate-300 mb-2">收入记录</h4>
        {records.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs">
            暂无收入记录，点击上方「添加记录」开始记录
          </div>
        ) : (
          <div className="space-y-1.5">
            {[...records].reverse().map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 p-2 rounded bg-slate-800/30 border border-slate-700/50 group"
              >
                <span className="text-emerald-400 text-sm font-medium w-16 shrink-0">
                  ¥{r.amount.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-500 w-12 shrink-0">
                  {(r.channel === 'wechat' ? '微信' : r.channel === 'alipay' ? '支付宝' : r.channel === 'other' ? '其他' : '第三方') as string}
                </span>
                <span className="text-[10px] text-slate-400 flex-1 truncate">{r.note}</span>
                <span className="text-[10px] text-slate-600 shrink-0">
                  {new Date(r.date).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                </span>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-red-400 hover:text-red-300 transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
