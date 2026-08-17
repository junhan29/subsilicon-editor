'use client'

import { useMemo, useRef, useState } from 'react'
import { AlertCircle, DollarSign, Download, Plus, Search, Trash2, TrendingUp, Upload, Wallet } from 'lucide-react'
import { showToast } from './toast'
import {
  addIncomeRecord, deleteIncomeRecord, getComplianceStatus, loadIncomeTracking, saveIncomeTracking,
} from '@editor/lib/compliance-tracker'
import {
  aggregateIncomeByChannel, aggregateIncomeByMonth, exportIncomeCSV, exportIncomeJSON,
  filterIncomeByNotes, parseIncomeCSV, parseIncomeJSON,
} from '@editor/lib/income-analytics'
import { BarChart, PieChart } from './analytics-charts'
import type { StoryGraph } from '@editor/types/editor'
import { generateWorkId } from '@editor/lib/work-monetization'

/** 通过 Blob 下载文本文件（JSON / CSV） */
function downloadTextFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

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
  const [noteQuery, setNoteQuery] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const records = tracking.records
  const compliance = useMemo(() => getComplianceStatus(), [tracking])

  // 备注筛选后的可见记录，聚合与列表均基于筛选结果
  const visibleRecords = useMemo(() => filterIncomeByNotes(records, noteQuery), [records, noteQuery])
  const channelAgg = useMemo(() => aggregateIncomeByChannel(visibleRecords), [visibleRecords])
  const monthAgg = useMemo(() => aggregateIncomeByMonth(visibleRecords), [visibleRecords])

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

  const handleExportJSON = () => {
    downloadTextFile(exportIncomeJSON(visibleRecords), `income-${new Date().toISOString().slice(0, 10)}.json`, 'application/json')
  }

  const handleExportCSV = () => {
    downloadTextFile(exportIncomeCSV(visibleRecords), `income-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8')
  }

  /** 导入 JSON / CSV 文件：解析、去重后合并进本地记录 */
  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text()
      const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv'
      const result = isCsv ? parseIncomeCSV(text) : parseIncomeJSON(text)
      if (result.records.length === 0) {
        showToast('error', '导入失败：文件中没有可导入的记录')
        return
      }
      const existingIds = new Set(tracking.records.map(r => r.id))
      const newRecords = result.records.filter(r => !existingIds.has(r.id))
      if (newRecords.length === 0) {
        showToast('error', '导入失败：所有记录均已存在')
        return
      }
      saveIncomeTracking({ records: [...tracking.records, ...newRecords], lastUpdated: Date.now() })
      setTracking(loadIncomeTracking())
      showToast('success', `成功导入 ${newRecords.length} 条记录${result.skipped > 0 ? `（跳过 ${result.skipped} 条损坏数据）` : ''}`)
    } catch {
      showToast('error', '导入失败：文件无法解析')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
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

      {visibleRecords.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {/* 渠道聚合 */}
          <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
            <h4 className="text-xs font-medium text-slate-300 mb-1">渠道占比</h4>
            <div className="flex justify-center">
              <PieChart data={channelAgg.map(a => ({ label: a.label, value: a.total }))} size={130} />
            </div>
            <ul className="mt-1 space-y-1">
              {channelAgg.map(a => (
                <li key={a.channel} className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">{a.label}（{a.count}笔）</span>
                  <span className="text-slate-300">¥{a.total.toFixed(2)} · {a.percent.toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </div>
          {/* 月度聚合 */}
          <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
            <h4 className="text-xs font-medium text-slate-300 mb-1">月度收入</h4>
            <div className="overflow-x-auto pb-1">
              <BarChart
                data={monthAgg.map(m => ({ label: m.month.slice(2), value: m.total }))}
                height={90}
                barWidth={24}
              />
            </div>
            {monthAgg.length === 0 && (
              <div className="text-center py-6 text-slate-500 text-xs">暂无数据</div>
            )}
          </div>
        </div>
      )}

      {/* 备注搜索与导入导出 */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <input
            type="text"
            value={noteQuery}
            onChange={(e) => setNoteQuery(e.target.value)}
            placeholder="按备注筛选记录"
            className="flex-1 h-7 text-xs rounded border border-slate-600 bg-slate-700 px-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
          {noteQuery && (
            <button
              onClick={() => setNoteQuery('')}
              className="text-[10px] text-slate-400 hover:text-slate-200 shrink-0"
            >
              清除
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleExportJSON}
            disabled={visibleRecords.length === 0}
            className="flex items-center gap-1 px-2 py-1 text-[10px] bg-slate-700/60 hover:bg-slate-600/60 text-slate-300 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-3 h-3" /> 导出 JSON
          </button>
          <button
            onClick={handleExportCSV}
            disabled={visibleRecords.length === 0}
            className="flex items-center gap-1 px-2 py-1 text-[10px] bg-slate-700/60 hover:bg-slate-600/60 text-slate-300 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-3 h-3" /> 导出 CSV
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1 text-[10px] bg-slate-700/60 hover:bg-slate-600/60 text-slate-300 rounded transition-colors"
          >
            <Upload className="w-3 h-3" /> 导入
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv,application/json,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImportFile(file)
            }}
          />
        </div>
      </div>

      <div>
        <h4 className="text-xs font-medium text-slate-300 mb-2">
          收入记录{noteQuery.trim() ? `（${visibleRecords.length}）` : ''}
        </h4>
        {records.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs">
            暂无收入记录，点击上方「添加记录」开始记录
          </div>
        ) : visibleRecords.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs">
            没有匹配「{noteQuery.trim()}」的记录
          </div>
        ) : (
          <div className="space-y-1.5">
            {[...visibleRecords].reverse().map((r) => (
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
