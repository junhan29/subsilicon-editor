'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Target,
  MapPin,
  CheckCircle2,
  Box,
  GitBranch,
  Flag,
  Users,
  BookOpen,
  Layers,
  Wand2,
  Trash2,
} from 'lucide-react'
import {
  analyzeStoryQuality,
  getNodeLabel,
  type QualityIssue,
  type QualityReport,
  type QualityIssueSeverity,
} from '@editor/lib/story-quality'
import type { StoryNode, StoryEdge, StoryVariable } from '@editor/types/editor'

interface QualityPanelProps {
  nodes: StoryNode[]
  edges: StoryEdge[]
  variables?: StoryVariable[]
  onNodeClick?: (nodeId: string) => void
  onEdgeClick?: (edgeId: string) => void
  onQuickFixDeadEnd?: (nodeId: string) => void
  onQuickFixDanglingEdge?: (edgeId: string) => void
}

const severityConfig: Record<
  QualityIssueSeverity,
  { icon: typeof AlertTriangle; color: string; bgColor: string; borderColor: string; label: string }
> = {
  high: {
    icon: AlertCircle,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    label: '严重',
  },
  medium: {
    icon: AlertTriangle,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    label: '中等',
  },
  low: {
    icon: Info,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    label: '轻微',
  },
}

function ScoreDisplay({ score }: { score: number }) {
  const getScoreColor = (s: number) => {
    if (s >= 90) return 'text-emerald-400'
    if (s >= 70) return 'text-amber-400'
    return 'text-red-400'
  }

  const getScoreLabel = (s: number) => {
    if (s >= 90) return '优秀'
    if (s >= 70) return '良好'
    if (s >= 50) return '一般'
    return '较差'
  }

  const circumference = 2 * Math.PI * 40
  const progress = (score / 100) * circumference
  const offset = circumference - progress

  return (
    <div className="flex items-center justify-center py-4">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-slate-700"
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={getScoreColor(score)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold ${getScoreColor(score)}`}>
            {score}
          </span>
          <span className="text-xs text-slate-400">{getScoreLabel(score)}</span>
        </div>
      </div>
    </div>
  )
}

function IssueItem({
  issue,
  nodes,
  edges,
  onNodeClick,
  onEdgeClick,
  onQuickFixDeadEnd,
  onQuickFixDanglingEdge,
}: {
  issue: QualityIssue
  nodes: StoryNode[]
  edges: StoryEdge[]
  onNodeClick?: (nodeId: string) => void
  onEdgeClick?: (edgeId: string) => void
  onQuickFixDeadEnd?: (nodeId: string) => void
  onQuickFixDanglingEdge?: (edgeId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const config = severityConfig[issue.severity]
  const Icon = config.icon
  const isMetric = issue.details?.isMetric === true

  const count = issue.nodeIds.length + issue.edgeIds.length

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      onNodeClick?.(nodeId)
    },
    [onNodeClick]
  )

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const edgeMap = new Map(edges.map((e) => [e.id, e]))

  const variableIssues = issue.details?.variableIssues as Array<{
    nodeId?: string
    edgeId?: string
    variableName: string
    suggestion?: string
  }> | undefined

  const longDialogues = issue.details?.longDialogues as Array<{
    nodeId: string
    length: number
    exceedBy: number
  }> | undefined

  const canQuickFix =
    (issue.type === 'dead-end' && onQuickFixDeadEnd) ||
    (issue.type === 'dangling-edge' && onQuickFixDanglingEdge)

  return (
    <div
      className={`rounded-lg border ${config.borderColor} ${isMetric ? 'bg-slate-800/50' : config.bgColor} overflow-hidden transition-all duration-300`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 transition-colors"
      >
        <Icon className={`w-5 h-5 shrink-0 ${config.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white text-sm">{issue.title}</span>
            {!isMetric && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${config.bgColor} ${config.color} border ${config.borderColor}`}
              >
                {config.label}
              </span>
            )}
            {count > 0 && !isMetric && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-300">
                {count} 项
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5 truncate">{issue.description}</p>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-white/10 p-2 max-h-72 overflow-y-auto space-y-1">
          {issue.nodeIds.length > 0 && (
            <div className="space-y-1">
              {issue.nodeIds.map((nodeId, idx) => {
                const node = nodeMap.get(nodeId)
                const longDialogue = longDialogues?.find((d) => d.nodeId === nodeId)
                const nodeVarIssues = variableIssues?.filter((v) => v.nodeId === nodeId)
                return (
                  <div key={nodeId} className="flex items-center gap-2">
                    <button
                      onClick={() => handleNodeClick(nodeId)}
                      className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/10 text-left transition-colors group min-w-0"
                    >
                      <MapPin className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-slate-300 truncate block">
                          {node ? getNodeLabel(node) : nodeId}
                        </span>
                        {longDialogue && (
                          <span className="text-[10px] text-amber-400 block">
                            {longDialogue.length} 字（超出 {longDialogue.exceedBy} 字）
                          </span>
                        )}
                        {nodeVarIssues && nodeVarIssues.length > 0 && (
                          <div className="text-[10px] text-amber-400">
                            {nodeVarIssues.map((v, i) => (
                              <div key={i} className="truncate">
                                未定义变量: {v.variableName}
                                {v.suggestion && ` → 你是想说「${v.suggestion}」吗？`}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 group-hover:text-slate-400 shrink-0">
                        跳转
                      </span>
                    </button>
                    {issue.type === 'dead-end' && onQuickFixDeadEnd && (
                      <button
                        onClick={() => onQuickFixDeadEnd(nodeId)}
                        className="shrink-0 p-1.5 rounded hover:bg-emerald-500/20 text-emerald-400 transition-colors"
                        title="添加返回跳转"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {issue.edgeIds.length > 0 && (
            <div className="space-y-1">
              {issue.edgeIds.map((edgeId) => {
                const edge = edgeMap.get(edgeId)
                const edgeVarIssues = variableIssues?.filter((v) => v.edgeId === edgeId)
                return (
                  <div key={edgeId} className="flex items-center gap-2">
                    <button
                      onClick={() => onEdgeClick?.(edgeId)}
                      className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/10 text-left transition-colors group min-w-0"
                    >
                      <Target className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-slate-300 truncate block">
                          连线: {edge?.source?.slice(0, 10)} → {edge?.target?.slice(0, 10)}
                        </span>
                        {edgeVarIssues && edgeVarIssues.length > 0 && (
                          <div className="text-[10px] text-amber-400">
                            {edgeVarIssues.map((v, i) => (
                              <div key={i} className="truncate">
                                未定义变量: {v.variableName}
                                {v.suggestion && ` → 你是想说「${v.suggestion}」吗？`}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </button>
                    {issue.type === 'dangling-edge' && onQuickFixDanglingEdge && (
                      <button
                        onClick={() => onQuickFixDanglingEdge(edgeId)}
                        className="shrink-0 p-1.5 rounded hover:bg-red-500/20 text-red-400 transition-colors"
                        title="删除悬空连线"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {canQuickFix && count > 1 && (
            <div className="pt-2 mt-1 border-t border-white/10">
              <button
                onClick={() => {
                  if (issue.type === 'dead-end' && onQuickFixDeadEnd) {
                    issue.nodeIds.forEach((id) => onQuickFixDeadEnd(id))
                  } else if (issue.type === 'dangling-edge' && onQuickFixDanglingEdge) {
                    issue.edgeIds.forEach((id) => onQuickFixDanglingEdge(id))
                  }
                }}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition-colors"
              >
                <Wand2 className="w-3.5 h-3.5" />
                一键修复全部
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function QualityPanel({
  nodes,
  edges,
  variables = [],
  onNodeClick,
  onEdgeClick,
  onQuickFixDeadEnd,
  onQuickFixDanglingEdge,
}: QualityPanelProps) {
  const [report, setReport] = useState<QualityReport | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [justCompleted, setJustCompleted] = useState(false)

  const runAnalysis = useCallback(() => {
    setIsAnalyzing(true)
    setJustCompleted(false)
    requestAnimationFrame(() => {
      const result = analyzeStoryQuality(nodes, edges, variables)
      setReport(result)
      setIsAnalyzing(false)
      setJustCompleted(true)
      setTimeout(() => setJustCompleted(false), 600)
    })
  }, [nodes, edges, variables])

  useEffect(() => {
    runAnalysis()
  }, [runAnalysis])

  const actualIssues = report?.issues.filter((i) => !i.details?.isMetric) || []
  const metricIssues = report?.issues.filter((i) => i.details?.isMetric) || []

  const highCount = actualIssues
    .filter((i) => i.severity === 'high')
    .reduce((s, i) => s + i.nodeIds.length + i.edgeIds.length, 0)
  const mediumCount = actualIssues
    .filter((i) => i.severity === 'medium')
    .reduce((s, i) => s + i.nodeIds.length + i.edgeIds.length, 0)
  const lowCount = actualIssues
    .filter((i) => i.severity === 'low')
    .reduce((s, i) => s + i.nodeIds.length + i.edgeIds.length, 0)

  const highIssues = actualIssues.filter((i) => i.severity === 'high')
  const mediumIssues = actualIssues.filter((i) => i.severity === 'medium')
  const lowIssues = actualIssues.filter((i) => i.severity === 'low')

  const stats = report?.statistics

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-white">故事质量检测</h3>
          <button
            onClick={runAnalysis}
            disabled={isAnalyzing}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 rounded-md transition-all disabled:opacity-50 ${
              justCompleted ? 'scale-105 bg-emerald-500/30 text-emerald-400' : ''
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
            {justCompleted ? '检测完成' : '重新检测'}
          </button>
        </div>

        {report && (
          <>
            <ScoreDisplay score={report.score} />

            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="text-center p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="text-lg font-bold text-red-400">{highCount}</div>
                <div className="text-[10px] text-red-400/70">严重</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="text-lg font-bold text-amber-400">{mediumCount}</div>
                <div className="text-[10px] text-amber-400/70">中等</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <div className="text-lg font-bold text-yellow-400">{lowCount}</div>
                <div className="text-[10px] text-yellow-400/70">轻微</div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {report && stats && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              统计概览
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <Box className="w-4 h-4 text-blue-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">{stats.totalNodes}</div>
                  <div className="text-[10px] text-slate-400">总节点数</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <GitBranch className="w-4 h-4 text-purple-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">{stats.totalEdges}</div>
                  <div className="text-[10px] text-slate-400">总连线数</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <Flag className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">{stats.endingCount}</div>
                  <div className="text-[10px] text-slate-400">结局数量</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <Users className="w-4 h-4 text-pink-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">{stats.characterCount}</div>
                  <div className="text-[10px] text-slate-400">角色数量</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <BookOpen className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">{stats.totalWordCount}</div>
                  <div className="text-[10px] text-slate-400">总字数</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">{stats.branchDepth}</div>
                  <div className="text-[10px] text-slate-400">分支深度</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {report && metricIssues.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-slate-500" />
              统计指标
            </div>
            {metricIssues.map((issue) => (
              <IssueItem
                key={issue.type}
                issue={issue}
                nodes={nodes}
                edges={edges}
                onNodeClick={onNodeClick}
                onEdgeClick={onEdgeClick}
                onQuickFixDeadEnd={onQuickFixDeadEnd}
                onQuickFixDanglingEdge={onQuickFixDanglingEdge}
              />
            ))}
          </div>
        )}

        {report && actualIssues.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3" />
            <p className="text-sm font-medium text-white">故事结构良好</p>
            <p className="text-xs text-slate-400 mt-1">未发现质量问题</p>
          </div>
        )}

        {highIssues.length > 0 && (
          <div className="space-y-2 animate-fade-in">
            <div className="text-xs font-medium text-red-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              严重问题
              <span className="ml-auto px-1.5 py-0.5 text-[10px] rounded-full bg-red-500/20 text-red-400">
                {highIssues.length} 类
              </span>
            </div>
            {highIssues.map((issue) => (
              <IssueItem
                key={issue.type}
                issue={issue}
                nodes={nodes}
                edges={edges}
                onNodeClick={onNodeClick}
                onEdgeClick={onEdgeClick}
                onQuickFixDeadEnd={onQuickFixDeadEnd}
                onQuickFixDanglingEdge={onQuickFixDanglingEdge}
              />
            ))}
          </div>
        )}

        {mediumIssues.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              中等问题
              <span className="ml-auto px-1.5 py-0.5 text-[10px] rounded-full bg-amber-500/20 text-amber-400">
                {mediumIssues.length} 类
              </span>
            </div>
            {mediumIssues.map((issue) => (
              <IssueItem
                key={issue.type}
                issue={issue}
                nodes={nodes}
                edges={edges}
                onNodeClick={onNodeClick}
                onEdgeClick={onEdgeClick}
                onQuickFixDeadEnd={onQuickFixDeadEnd}
                onQuickFixDanglingEdge={onQuickFixDanglingEdge}
              />
            ))}
          </div>
        )}

        {lowIssues.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-yellow-400 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              轻微问题
              <span className="ml-auto px-1.5 py-0.5 text-[10px] rounded-full bg-yellow-500/20 text-yellow-400">
                {lowIssues.length} 类
              </span>
            </div>
            {lowIssues.map((issue) => (
              <IssueItem
                key={issue.type}
                issue={issue}
                nodes={nodes}
                edges={edges}
                onNodeClick={onNodeClick}
                onEdgeClick={onEdgeClick}
                onQuickFixDeadEnd={onQuickFixDeadEnd}
                onQuickFixDanglingEdge={onQuickFixDanglingEdge}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
