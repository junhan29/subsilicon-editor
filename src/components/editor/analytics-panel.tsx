'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileDown,
  PieChartIcon,
  RefreshCw,
  Timer,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import { Button } from '@editor/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@editor/components/ui/card'
import { Badge } from '@editor/components/ui/badge'
import { ScrollArea } from '@editor/components/ui/scroll-area'
import {
  type ChoiceStat,
  type NodeVisitStat,
  type StoryAnalytics,
  analyticsStore,
} from '@editor/lib/analytics'
import { showToast } from './toast'
import { BarChart, PieChart, Sparkline } from './analytics-charts'

export function AnalyticsPanel() {
  const [analytics, setAnalytics] = useState<StoryAnalytics | null>(null)
  const [loading, setLoading] = useState(false)
  const [storyId, setStoryId] = useState('')

  const loadAnalytics = useCallback(async () => {
    setLoading(true)
    try {
      const result = await analyticsStore.getStoryAnalytics(storyId || 'default')
      setAnalytics(result)
    } catch (error) {
      showToast('error', `加载失败: ${(error as Error).message}`)
    }
    setLoading(false)
  }, [storyId])

  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

  const handleClearData = async () => {
    if (!confirm('确定要清除所有分析数据吗？')) return

    setLoading(true)
    try {
      await analyticsStore.clearAll()
      setAnalytics(null)
      showToast('success', '数据已清除')
    } catch (error) {
      showToast('error', `清除失败: ${(error as Error).message}`)
    }
    setLoading(false)
  }

  /** 通过 Blob + 下载链接导出本地文件，不依赖后端 */
  const downloadBlob = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleExportJson = async () => {
    try {
      const json = await analyticsStore.exportAnalyticsJson(storyId || 'default')
      downloadBlob(json, `analytics-${storyId || 'default'}-${Date.now()}.json`, 'application/json;charset=utf-8')
      showToast('success', 'JSON 报告已导出')
    } catch (error) {
      showToast('error', `导出失败: ${(error as Error).message}`)
    }
  }

  const handleExportCsv = async () => {
    try {
      const csv = await analyticsStore.exportAnalyticsCsv(storyId || 'default')
      // 前置 BOM，便于 Excel 打开时正确识别中文
      downloadBlob(`\uFEFF${csv}`, `analytics-${storyId || 'default'}-${Date.now()}.csv`, 'text/csv;charset=utf-8')
      showToast('success', 'CSV 报告已导出')
    } catch (error) {
      showToast('error', `导出失败: ${(error as Error).message}`)
    }
  }

  const formatTime = (ms: number): string => {
    if (ms < 60000) return `${Math.round(ms / 1000)}秒`
    if (ms < 3600000) return `${Math.round(ms / 60000)}分钟`
    return `${(ms / 3600000).toFixed(1)}小时`
  }

  // 停留时长区间总计数（用于分布条宽度计算）
  const totalDwellCount = analytics?.dwellDistribution.reduce((sum, b) => sum + b.count, 0) || 1

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-gold-400" />
          <h3 className="font-medium">读者行为分析</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={loadAnalytics}
            disabled={loading}
          >
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="输入故事 ID（留空查看默认）"
              value={storyId}
              onChange={(e) => setStoryId(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-muted border border-border rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-gold-400" />
            </div>
          )}

          {!loading && analytics && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Card className="border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">总访问次数</p>
                        <p className="text-2xl font-bold text-gold-400 mt-1">
                          {analytics.totalSessions}
                        </p>
                      </div>
                      <Users className="w-8 h-8 text-gold-400/20" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">独立读者数</p>
                        <p className="text-2xl font-bold text-blue-500 mt-1">
                          {analytics.uniqueReaders}
                        </p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-blue-500/20" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">平均停留时间</p>
                        <p className="text-xl font-bold text-green-500 mt-1">
                          {formatTime(analytics.averageDwellTime)}
                        </p>
                      </div>
                      <Clock className="w-8 h-8 text-green-500/20" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">完成率</p>
                        <p className="text-xl font-bold text-purple-500 mt-1">
                          {(analytics.completionRate * 100).toFixed(0)}%
                        </p>
                      </div>
                      <CheckCircle2 className="w-8 h-8 text-purple-500/20" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {analytics.nodeVisits.length > 0 && (
                <Card className="border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-gold-400" />
                      节点访问统计
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-center">
                      <BarChart
                        data={analytics.nodeVisits.slice(0, 8).map((node: NodeVisitStat) => ({
                          label: node.nodeType || node.nodeId.slice(0, 6),
                          value: node.visitCount,
                          color: node.nodeType === 'dialogue' ? '#F59E0B' : 
                                 node.nodeType === 'choice' ? '#3B82F6' : 
                                 node.nodeType === 'ending' ? '#10B981' : '#8B5CF6',
                        }))}
                        height={100}
                        barWidth={28}
                        gap={6}
                      />
                    </div>
                    <div className="space-y-2">
                      {analytics.nodeVisits.slice(0, 10).map((node: NodeVisitStat) => (
                        <div
                          key={node.nodeId}
                          className="flex items-center gap-3 p-2 rounded-[2px] bg-muted/30"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">
                              {node.nodeType ? `${node.nodeType} - ${node.nodeId}` : node.nodeId}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              访问 {node.visitCount} 次 · 平均 {formatTime(node.averageDwellTime)}
                            </p>
                          </div>
                          <Sparkline
                            data={[node.visitCount, node.visitCount * 0.8, node.visitCount * 0.6, node.visitCount * 0.9]}
                            width={40}
                            height={16}
                            color={node.nodeType === 'dialogue' ? '#F59E0B' : '#8B5CF6'}
                          />
                        </div>
                      ))}
                    </div>
                    {analytics.nodeVisits.length > 10 && (
                      <p className="text-xs text-center text-muted-foreground mt-2">
                        仅显示前 10 个节点
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {analytics.dropOffPoints.length > 0 && (
                <Card className="border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-primary" />
                      读者流失点
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-center">
                      <BarChart
                        data={analytics.dropOffPoints.slice(0, 8).map((drop) => ({
                          label: drop.nodeId.slice(0, 6),
                          value: drop.dropCount,
                          color: '#EF4444',
                        }))}
                        height={100}
                        barWidth={28}
                        gap={6}
                      />
                    </div>
                    <div className="space-y-2">
                      {analytics.dropOffPoints.slice(0, 10).map((drop) => (
                        <div
                          key={drop.nodeId}
                          className="flex items-center gap-3 p-2 rounded-[2px] bg-muted/30"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{drop.nodeId}</p>
                            <p className="text-[10px] text-muted-foreground">读者在此节点后离开</p>
                          </div>
                          <Badge variant="secondary" className="text-[10px]">
                            {drop.dropCount} 次
                          </Badge>
                        </div>
                      ))}
                    </div>
                    {analytics.dropOffPoints.length > 10 && (
                      <p className="text-xs text-center text-muted-foreground mt-2">
                        仅显示前 10 个流失点
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {analytics.nodeDwellStats.length > 0 && (
                <Card className="border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Timer className="w-4 h-4 text-cyan-500" />
                      节点停留分布
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-center">
                      <BarChart
                        data={analytics.nodeDwellStats.slice(0, 8).map((node) => ({
                          label: node.nodeId.slice(0, 6),
                          value: Math.max(Math.round(node.avgDwellMs / 1000), 1),
                          color: '#14B8A6',
                        }))}
                        height={100}
                        barWidth={28}
                        gap={6}
                      />
                    </div>
                    <div className="space-y-2">
                      {analytics.nodeDwellStats.slice(0, 10).map((node) => (
                        <div
                          key={node.nodeId}
                          className="flex items-center gap-3 p-2 rounded-[2px] bg-muted/30"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{node.nodeId}</p>
                            <p className="text-[10px] text-muted-foreground">
                              平均 {formatTime(node.avgDwellMs)} · {node.visitCount} 次访问
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-2">停留时长区间分布</p>
                      <div className="space-y-2">
                        {analytics.dwellDistribution.map((bucket) => (
                          <div key={bucket.label}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs">{bucket.label}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {bucket.count} 次 ({((bucket.count / totalDwellCount) * 100).toFixed(1)}%)
                              </span>
                            </div>
                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-cyan-500 rounded-full transition-all"
                                style={{ width: `${(bucket.count / totalDwellCount) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {analytics.choiceDistribution.length > 0 && (
                <Card className="border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <PieChartIcon className="w-4 h-4 text-blue-500" />
                      选择分布
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-center">
                      <PieChart
                        data={analytics.choiceDistribution.slice(0, 6).map((choice: ChoiceStat) => ({
                          label: choice.choiceText.slice(0, 10),
                          value: choice.selectionCount,
                        }))}
                        size={140}
                        innerRadius={30}
                      />
                    </div>
                    <div className="space-y-2">
                      {analytics.choiceDistribution.slice(0, 10).map((choice: ChoiceStat) => (
                        <div key={`${choice.nodeId}-${choice.choiceIndex}`}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{choice.choiceText}</p>
                              <p className="text-[10px] text-muted-foreground">节点: {choice.nodeId}</p>
                            </div>
                            <Badge variant="secondary" className="text-[10px]">
                              {choice.percentage.toFixed(1)}% ({choice.selectionCount})
                            </Badge>
                          </div>
                          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all"
                              style={{ width: `${choice.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    {analytics.choiceDistribution.length > 10 && (
                      <p className="text-xs text-center text-muted-foreground mt-2">
                        仅显示前 10 个选择
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="p-3 bg-muted/30 rounded-[2px] space-y-2">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" />
                  导出分析报告（仅本地生成，不联网）
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleExportJson}
                    disabled={loading}
                  >
                    <FileDown className="w-4 h-4 mr-2" />
                    导出 JSON
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleExportCsv}
                    disabled={loading}
                  >
                    <FileDown className="w-4 h-4 mr-2" />
                    导出 CSV
                  </Button>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full border-primary/30 text-primary hover:bg-primary/10"
                onClick={handleClearData}
                disabled={loading}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                清除所有数据
              </Button>
            </>
          )}

          {!loading && !analytics && (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">暂无分析数据</p>
              <p className="text-xs mt-1">分析数据会在读者阅读时自动收集</p>
            </div>
          )}

          <div className="p-3 bg-gold-400/10 rounded-[2px] shadow-[2px_2px_0_hsl(var(--gold)/0.15)] text-xs text-amber-600">
            <p className="font-medium mb-1">去中心化模式说明</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>作品导出为 .story.html 文件后，平台无法收集读者数据</li>
              <li>如需读者行为分析，请自行托管作品并接入分析服务</li>
              <li>推荐使用：百度统计、Google Analytics、或自建埋点系统</li>
              <li>当前面板数据仅在编辑器预览时本地记录</li>
            </ul>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
