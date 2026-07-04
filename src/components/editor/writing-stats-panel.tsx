'use client'

import { useState, useEffect, useCallback, memo } from 'react'
import {
  Clock,
  FileText,
  Flame,
  Calendar,
  Download,
  Trash2,
  AlertTriangle,
  Activity,
  GitBranch,
  PenTool,
} from 'lucide-react'
import {
  getStats,
  formatDuration,
  formatShortDuration,
  clearStats,
  exportStats,
  type WritingStats,
  type WritingSession,
} from '@editor/lib/writing-stats'
import { showToast } from './toast'

interface WritingStatsPanelProps {
  workId: string
  nodeCount: number
  wordCount: number
}

function WritingStatsPanel({ workId, nodeCount, wordCount }: WritingStatsPanelProps) {
  const [stats, setStats] = useState<WritingStats | null>(null)
  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'month'>('week')
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [, setTick] = useState(0)

  const refreshStats = useCallback(() => {
    const s = getStats(workId)
    setStats(s)
  }, [workId])

  useEffect(() => {
    refreshStats()
    const interval = setInterval(() => {
      refreshStats()
      setTick((t) => t + 1)
    }, 30000)
    return () => clearInterval(interval)
  }, [refreshStats])

  const handleExport = useCallback(() => {
    const data = exportStats(workId)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `writing-stats-${workId}-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showToast('success', '统计数据已导出')
  }, [workId])

  const handleClear = useCallback(() => {
    clearStats(workId)
    refreshStats()
    setShowClearConfirm(false)
    showToast('info', '统计数据已清除')
  }, [workId, refreshStats])

  const getChartData = useCallback(() => {
    if (!stats) return []
    const now = new Date()
    const data: { label: string; value: number; date: string }[] = []

    if (activeTab === 'today') {
      for (let i = 0; i < 24; i++) {
        data.push({ label: `${i}时`, value: 0, date: '' })
      }
      const todayStr = new Date().toISOString().slice(0, 10)
      const todayStat = stats.dailyStats[todayStr]
      if (todayStat) {
        const hours = Math.min(24, Math.ceil(todayStat.time / 3600))
        for (let i = 0; i < hours; i++) {
          data[i].value = Math.min(3600, todayStat.time - i * 3600)
          if (data[i].value < 0) data[i].value = 0
        }
      }
    } else if (activeTab === 'week') {
      const dayOfWeek = now.getDay() || 7
      const monday = new Date(now)
      monday.setDate(now.getDate() - dayOfWeek + 1)
      const weekDays = ['一', '二', '三', '四', '五', '六', '日']
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday)
        d.setDate(monday.getDate() + i)
        const dateStr = d.toISOString().slice(0, 10)
        const dayStat = stats.dailyStats[dateStr]
        data.push({
          label: `周${weekDays[i]}`,
          value: dayStat?.time || 0,
          date: dateStr,
        })
      }
    } else {
      const year = now.getFullYear()
      const month = now.getMonth()
      const daysInMonth = new Date(year, month + 1, 0).getDate()
      for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
        const dayStat = stats.dailyStats[dateStr]
        data.push({
          label: `${i}`,
          value: dayStat?.time || 0,
          date: dateStr,
        })
      }
    }

    return data
  }, [stats, activeTab])

  const chartData = getChartData()
  const maxValue = Math.max(...chartData.map((d) => d.value), 1)
  const recentSessions = stats?.sessions.slice(0, 10) || []

  const StatCard = memo(({ icon: Icon, label, value, color }: { icon: typeof Clock; label: string; value: string; color: string }) => (
    <div className="bg-slate-700/40 rounded-lg p-3 border border-slate-600/50">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-[11px] text-slate-400">{label}</span>
      </div>
      <p className="text-lg font-semibold text-white">{value}</p>
    </div>
  ))
  StatCard.displayName = 'StatCard'

  const formatSessionDate = (timestamp: number) => {
    const d = new Date(timestamp)
    const month = d.getMonth() + 1
    const day = d.getDate()
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${month}/${day} ${hours}:${minutes}`
  }

  const SessionItem = memo(({ session }: { session: WritingSession }) => (
    <div className="py-2.5 border-b border-slate-700/50 last:border-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-300">{formatSessionDate(session.startTime)}</span>
        <span className="text-xs text-pink-400 font-medium">{formatShortDuration(session.duration)}</span>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <FileText className="w-3 h-3" />
          {session.wordCountDelta >= 0 ? '+' : ''}{session.wordCountDelta} 字
        </span>
        <span className="flex items-center gap-1">
          <GitBranch className="w-3 h-3" />
          {session.nodeCountDelta >= 0 ? '+' : ''}{session.nodeCountDelta} 节点
        </span>
        <span className="flex items-center gap-1">
          <PenTool className="w-3 h-3" />
          {session.actions} 次操作
        </span>
      </div>
    </div>
  ))
  SessionItem.displayName = 'SessionItem'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-4 space-y-3 overflow-y-auto flex-1">
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            icon={Clock}
            label="总创作时长"
            value={stats ? formatDuration(stats.totalTime) : '--'}
            color="text-blue-400"
          />
          <StatCard
            icon={Flame}
            label="连续创作"
            value={stats ? `${stats.streakDays} 天` : '--'}
            color="text-orange-400"
          />
          <StatCard
            icon={FileText}
            label="总字数"
            value={wordCount > 0 ? `${wordCount} 字` : stats ? `${stats.totalWords} 字` : '--'}
            color="text-emerald-400"
          />
          <StatCard
            icon={Calendar}
            label="今日创作"
            value={stats ? formatDuration(stats.todayTime) : '--'}
            color="text-purple-400"
          />
        </div>

        <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/50">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-pink-400" />
              时间分布
            </h4>
            <div className="flex bg-slate-800 rounded-md p-0.5">
              {(['today', 'week', 'month'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                    activeTab === tab
                      ? 'bg-pink-500 text-white'
                      : 'text-slate-400 hover:text-slate-300'
                  }`}
                >
                  {tab === 'today' ? '今日' : tab === 'week' ? '本周' : '本月'}
                </button>
              ))}
            </div>
          </div>

          <div className="h-24 flex items-end gap-1">
            {chartData.map((item, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full bg-gradient-to-t from-pink-500 to-pink-400 rounded-t-sm transition-all duration-300 min-h-[2px]"
                    style={{
                      height: `${(item.value / maxValue) * 100}%`,
                      opacity: item.value > 0 ? 1 : 0.2,
                    }}
                    title={`${item.label}: ${formatDuration(item.value)}`}
                  />
                </div>
                <span className="text-[9px] text-slate-500 truncate w-full text-center">
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
            <span>
              总时长：{stats ? formatDuration(
                activeTab === 'today' ? stats.todayTime :
                activeTab === 'week' ? stats.weekTime :
                stats.monthTime
              ) : '--'}
            </span>
            <span>
              会话数：{stats ? (
                activeTab === 'today'
                  ? Object.entries(stats.dailyStats)
                      .filter(([d]) => d === new Date().toISOString().slice(0, 10))
                      .reduce((s, [, v]) => s + v.sessions, 0)
                  : activeTab === 'week'
                  ? Object.entries(stats.dailyStats)
                      .filter(([d]) => {
                        const now = new Date()
                        const dayOfWeek = now.getDay() || 7
                        const monday = new Date(now)
                        monday.setDate(now.getDate() - dayOfWeek + 1)
                        monday.setHours(0, 0, 0, 0)
                        return new Date(d) >= monday
                      })
                      .reduce((s, [, v]) => s + v.sessions, 0)
                  : Object.entries(stats.dailyStats)
                      .filter(([d]) => {
                        const now = new Date()
                        const target = new Date(d)
                        return now.getFullYear() === target.getFullYear() &&
                               now.getMonth() === target.getMonth()
                      })
                      .reduce((s, [, v]) => s + v.sessions, 0)
              ) : '--'} 次
            </span>
          </div>
        </div>

        <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/50">
          <h4 className="text-xs font-medium text-slate-300 mb-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            最近会话
          </h4>
          {recentSessions.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-xs">
              暂无创作记录
            </div>
          ) : (
            <div className="space-y-0 max-h-48 overflow-y-auto">
              {recentSessions.map((session) => (
                <SessionItem key={session.id} session={session} />
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/50">
          <h4 className="text-xs font-medium text-slate-300 mb-2">数据管理</h4>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              导出数据
            </button>
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-md transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              清除数据
            </button>
          </div>
        </div>
      </div>

      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-5 max-w-sm w-full border border-slate-700 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">确认清除</h3>
                <p className="text-xs text-slate-400">此操作不可撤销</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 mb-4">
              确定要清除所有创作统计数据吗？所有的时间记录和会话历史都将被永久删除。
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 px-4 py-2 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleClear}
                className="flex-1 px-4 py-2 text-xs bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors"
              >
                确认清除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function arePropsEqual(prev: WritingStatsPanelProps, next: WritingStatsPanelProps): boolean {
  if (prev.workId !== next.workId) return false
  return true
}

export const MemoizedWritingStatsPanel = memo(WritingStatsPanel, arePropsEqual)
export { WritingStatsPanel }
export default MemoizedWritingStatsPanel
