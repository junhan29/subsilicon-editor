'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Clock, Loader2, RefreshCw, XCircle } from 'lucide-react'
import {
  type UnlockRequestItem,
  fetchPendingRequests,
  getAllUnlockWorkTokens,
  respondRequest,
} from '@editor/lib/unlock-request-client'
import { getAccount } from '@editor/lib/local-account-store'
import { getAllWorks } from '@editor/lib/local-db/work-store'
import { SUBMIT_CONFIG } from '@editor/lib/submit-config'
import { showToast } from './toast'

interface UnlockRequestsPanelProps {
  /** 未登录时「前往登录」按钮回调（跳转到账号管理 tab） */
  onRequireLogin?: () => void
}

function formatRequestTime(ts: number): string {
  if (!ts) return '未知时间'
  try {
    return new Date(ts).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(ts)
  }
}

export function UnlockRequestsPanel({ onRequireLogin }: UnlockRequestsPanelProps) {
  const [account] = useState(() => getAccount())
  const [requests, setRequests] = useState<UnlockRequestItem[]>([])
  const [workTitles, setWorkTitles] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [submittingId, setSubmittingId] = useState<string | null>(null)

  const tokenMissing = !SUBMIT_CONFIG.submitToken

  const loadRequests = useCallback(async () => {
    if (!account || tokenMissing) return
    setLoading(true)
    setLoadError('')
    try {
      // 服务端按 workToken 归属校验：对每个已保存 workToken 的作品并行拉取申请并合并，
      // 任一作品拉取失败时跳过该作品（不整体崩溃），顶部提示用户重试。
      const tokens = getAllUnlockWorkTokens()
      const merged: UnlockRequestItem[] = []
      let anyFailed = false
      await Promise.all(
        Object.entries(tokens).map(async ([workId, workToken]) => {
          try {
            const list = await fetchPendingRequests(workId, workToken)
            // 服务端返回的申请本身带 workId，仍按拉取来源显式补齐，避免跨作品混淆
            merged.push(...list.map((item) => ({ ...item, workId })))
          } catch {
            anyFailed = true
          }
        }),
      )
      merged.sort((a, b) => b.createdAt - a.createdAt)
      setRequests(merged)
      if (anyFailed) {
        setLoadError('部分作品加载失败，请重试')
      }
    } finally {
      setLoading(false)
    }
  }, [account, tokenMissing])

  // 进入 tab（组件挂载）时拉取一次申请列表
  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  // 预载本地作品库，构建 workId → title 映射
  useEffect(() => {
    const loadTitles = async () => {
      try {
        const works = await getAllWorks()
        const map: Record<string, string> = {}
        for (const work of works) {
          if (work.id) map[work.id] = work.name
        }
        setWorkTitles(map)
      } catch {
        // 映射失败时降级显示 workId
      }
    }
    loadTitles()
  }, [])

  const handleRespond = async (requestId: string, workId: string, decision: 'approve' | 'reject') => {
    if (submittingId) return
    const workToken = getAllUnlockWorkTokens()[workId]
    if (!workToken) {
      showToast('error', '该作品的 workToken 已失效，请重新导出作品以刷新令牌')
      return
    }
    setSubmittingId(requestId)
    try {
      const result = await respondRequest(requestId, workId, workToken, decision)
      if (!result.ok) {
        showToast('error', result.error || '操作失败')
        return
      }
      if (decision === 'approve') {
        showToast('success', '已发码，读者解锁码已回传')
      } else {
        showToast('success', '已拒绝')
      }
      await loadRequests()
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : '操作失败')
    } finally {
      setSubmittingId(null)
    }
  }

  // 未登录：空态提示，不强制跳转
  if (!account) {
    return (
      <div className="p-4 rounded-xl border border-blue-700/50 bg-blue-900/20">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="text-sm font-medium text-blue-200">请先登录创作者账号</div>
            <p className="text-[12px] text-blue-300/80 leading-relaxed">
              登录后即可查看读者提交的发码申请，并确认或拒绝发码。
            </p>
            {onRequireLogin && (
              <button
                onClick={onRequireLogin}
                className="mt-2 px-3 py-1 text-xs rounded-lg bg-blue-500 hover:bg-blue-400 text-white"
              >
                前往登录
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">共 {requests.length} 条待处理的发码申请。</p>
        <button
          onClick={loadRequests}
          disabled={loading || tokenMissing}
          className="px-3 py-1.5 text-xs rounded-lg border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-40 flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {tokenMissing ? (
        <div className="p-4 rounded-xl border border-amber-700/50 bg-amber-900/20">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-gold-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="text-sm font-medium text-amber-200">未配置提交令牌</div>
              <p className="text-[12px] text-gold-400/80 leading-relaxed">未配置提交令牌，无法获取发码申请。</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {loadError && (
            <div className="p-4 rounded-xl border border-red-900/60 bg-red-900/20">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="text-sm font-medium text-red-200">加载失败</div>
                  <p className="text-[12px] text-red-300/80 leading-relaxed">{loadError}</p>
                </div>
              </div>
            </div>
          )}
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              加载中...
            </div>
          ) : requests.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              暂无发码申请。导出开启「在线解锁服务」的作品后，读者的申请会出现在这里
            </div>
          ) : (
            <div className="space-y-2">
              {requests.map((req) => {
                const workTitle = workTitles[req.workId] || req.workId || '未知作品'
                const submitting = submittingId === req.id
                return (
                  <div key={req.id} className="p-3 rounded-xl border border-border bg-muted/40">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-foreground truncate">{workTitle}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 truncate">作品 ID：{req.workId}</div>
                        <div className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>申请于 {formatRequestTime(req.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="text-[11px] text-muted-foreground mb-1">付款凭证</div>
                      <div className="text-[12px] text-foreground bg-card/60 border border-border/60 rounded-lg px-2.5 py-1.5 whitespace-pre-wrap break-words">
                        {req.paymentProof || '（无凭证内容）'}
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-border/60">
                      <button
                        onClick={() => handleRespond(req.id, req.workId, 'reject')}
                        disabled={submitting || loading}
                        className="px-2.5 py-1 text-[11px] rounded-lg border border-red-900/60 text-red-300 hover:bg-red-900/30 transition-colors disabled:opacity-40 flex items-center gap-1"
                      >
                        {submitting ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        拒绝
                      </button>
                      <button
                        onClick={() => handleRespond(req.id, req.workId, 'approve')}
                        disabled={submitting || loading}
                        className="px-2.5 py-1 text-[11px] rounded-lg bg-gold-400 hover:bg-amber-400 text-slate-900 font-medium transition-colors disabled:opacity-60 flex items-center gap-1"
                      >
                        {submitting ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        确认发码
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
