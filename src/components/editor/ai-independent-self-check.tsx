/**
 * 作品设置页面的 AI 独立运行自检面板（Todo #6）
 * 直接调用 provider-registry 中的 runAiIndependentSelfCheck，并把检查结果可视化。
 */
import { useState } from 'react'
import { AlertTriangle, Bot, CheckCircle2, ChevronDown, ChevronRight, Loader2, Network, XCircle } from 'lucide-react'
import { Button } from '@editor/components/ui/button'
import { showToast } from './toast'
import {
  type AiIndependentRunReport,
  type ConnectivityCheckResult,
  runAiIndependentSelfCheck,
} from '@editor/lib/ai/provider-registry'

interface ResultGroupProps {
  title: string
  items: ConnectivityCheckResult[] | undefined
  summary: (ok: number, total: number) => string
}
function ResultGroup({ title, items, summary }: ResultGroupProps) {
  const [open, setOpen] = useState(true)
  const total = items?.length || 0
  const ok = (items || []).filter((x) => x.ok).length
  return (
    <div className="rounded-lg border border-border/60 bg-background overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors text-left"
      >
        <Network className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-[11px] font-medium">{title}</span>
        <span
          className={`ml-auto text-[10px] px-1.5 py-0.5 rounded border ${
            total > 0 && ok === total
              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
              : total === 0
              ? 'bg-muted text-muted-foreground border-border'
              : 'bg-gold-400/10 text-amber-600 border-gold-400/20'
          }`}
        >
          {summary(ok, total)}
        </span>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        )}
      </button>
      {open && (
        <div className="border-t border-border/40 divide-y divide-border/40">
          {total === 0 ? (
            <div className="px-3 py-3 text-[11px] text-muted-foreground italic text-center">
              （未执行）
            </div>
          ) : (
            (items || []).map((x, i) => (
              <div key={i} className="px-3 py-2">
                <div className="flex items-start gap-2">
                  {x.ok ? (
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 mt-0.5 text-rose-500 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-medium flex items-center gap-1.5">
                      <span className="truncate">{x.providerName || x.providerId || '（未命名）'}</span>
                      {x.latencyMs != null && (
                        <span className="text-[9px] text-muted-foreground font-mono shrink-0">
                          {x.latencyMs}ms
                        </span>
                      )}
                    </div>
                    {!x.ok && (
                      <div className="text-[10px] text-rose-600 mt-0.5 break-all">
                        {x.error || 'Unknown error'}
                      </div>
                    )}
                    {x.ok && x.content && (
                      <div className="text-[10px] text-muted-foreground mt-0.5 break-all">
                        响应：{String(x.content).slice(0, 120)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function AiIndependentSelfCheckPanel() {
  const [report, setReport] = useState<AiIndependentRunReport | null>(null)
  const [running, setRunning] = useState(false)

  const runCheck = async () => {
    if (running) return
    setRunning(true)
    setReport(null)
    try {
      const r = await runAiIndependentSelfCheck()
      setReport(r)
      if (r.overallOk) {
        showToast('success', 'AI 自检通过：当前配置可独立运行')
      } else if (r.configReady) {
        showToast('info', '部分链路失败，详见下方自检报告')
      } else {
        showToast('info', '尚未完整配置 AI，请先到创作助理设置里填写 API Key')
      }
    } catch (e) {
      showToast('error', `自检失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium">AI 独立运行自检</div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              严格按真实业务链路走「配置检查 → 连通性测试 → 最小 Prompt 冒烟」，验证接入 API 后能否独立运行。
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="default"
          className="shrink-0"
          onClick={runCheck}
          disabled={running}
        >
          {running ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              自检中...
            </>
          ) : (
            '立即自检'
          )}
        </Button>
      </div>

      {report && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-border/60 bg-background p-2.5">
              <div className="text-[10px] text-muted-foreground">配置完整度</div>
              <div className="mt-1 flex items-center gap-1.5">
                {report.configReady ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-gold-400" />
                )}
                <span className="text-xs font-medium">
                  {report.configReady ? '通过' : '待补全'}
                </span>
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background p-2.5">
              <div className="text-[10px] text-muted-foreground">远程连通性</div>
              <div className="mt-1 flex items-center gap-1.5">
                {report.remoteResults.every((r) => r.ok) && report.remoteResults.length > 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : report.remoteResults.some((r) => r.ok) ? (
                  <AlertTriangle className="w-4 h-4 text-gold-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-500" />
                )}
                <span className="text-xs font-medium">
                  {report.remoteResults.filter((r) => r.ok).length}/{report.remoteResults.length}
                </span>
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background p-2.5">
              <div className="text-[10px] text-muted-foreground">总体可独立运行</div>
              <div className="mt-1 flex items-center gap-1.5">
                {report.overallOk ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-500" />
                )}
                <span className="text-xs font-medium">
                  {report.overallOk ? '是' : '否'}
                </span>
              </div>
            </div>
          </div>

          <ResultGroup
            title="远程 Provider 连通性（chat/completions 严格同源）"
            items={report.remoteResults}
            summary={(o, t) => `${o}/${t} 可达`}
          />
          <ResultGroup
            title="本地 Ollama 连通性"
            items={report.localResults}
            summary={(o, t) => `${o}/${t} 可达`}
          />
          <ResultGroup
            title="业务链路冒烟（最小 Prompt 走完整生成 & 解析）"
            items={report.smokeResults}
            summary={(o, t) => `${o}/${t} 通过`}
          />

          {report.suggestions.length > 0 && (
            <div className="rounded-lg border border-gold-400/30 bg-gold-400/5 p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700 mb-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                修复建议（{report.suggestions.length} 条）
              </div>
              <ul className="list-disc pl-4 space-y-0.5">
                {report.suggestions.map((s, i) => (
                  <li key={i} className="text-[10.5px] text-amber-700/90 leading-snug">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground text-right">
            检查时间：{new Date(report.checkedAt).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  )
}
