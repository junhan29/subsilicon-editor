/** B5. 收款推荐 Tab（三步引导，含跳转 + 勾选状态） */
import React from 'react'
import {
  Check,
  ChevronRight,
  KeyRound,
  UploadCloud,
  Package2,
  Rocket,
} from 'lucide-react'
import type { BoothTabKey } from '../booth-sidebar'

export interface MonetizeTabProps {
  isLoggedIn: boolean
  downloadLinksCount: number
  hasPackedOnce: boolean
  onJump: (tab: BoothTabKey, highlight?: 'downloadLinks') => void
}

export function MonetizeTab({
  isLoggedIn,
  downloadLinksCount,
  hasPackedOnce,
  onJump,
}: MonetizeTabProps) {
  const desc1 = isLoggedIn
    ? '已绑定创作身份，发布记录会归属到你的账号'
    : '未登录或未生成令牌，无法上传到自由集市'
  const desc2 =
    downloadLinksCount > 0
      ? '已配置 ' + String(downloadLinksCount) + ' 条下载渠道，买家可直接网盘下载'
      : '暂未配置下载渠道，建议至少一条网盘链接加速成交'
  const desc3 = hasPackedOnce
    ? '最近已打包，产物可直接发布'
    : '尚未打包：一键生成可分发的摊位/作品包'

  const steps = [
    {
      key: 'token',
      idx: 1,
      title: '生成 / 绑定创作令牌',
      desc: desc1,
      done: isLoggedIn,
      Icon: KeyRound,
      cta: isLoggedIn ? undefined : '前往生成令牌',
      action: () => onJump('display'),
      badge: '第一步 · 身份',
    },
    {
      key: 'channels',
      idx: 2,
      title: '配置下载渠道',
      desc: desc2,
      done: downloadLinksCount > 0,
      Icon: UploadCloud,
      cta: '前往陈列 → 上传到自由集市',
      action: () => onJump('display', 'downloadLinks'),
      badge: '第二步 · 分发',
    },
    {
      key: 'pack',
      idx: 3,
      title: '打包签名发布',
      desc: desc3,
      done: hasPackedOnce,
      Icon: Package2,
      cta: '前往打包发布 Tab',
      action: () => onJump('pack'),
      badge: '第三步 · 分发',
    },
  ]

  return (
    <div className="max-w-3xl mx-auto py-8 px-6 space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-gold-400/30 to-primary/20 flex items-center justify-center shrink-0">
          <Rocket className="w-5 h-5 text-gold-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">收款推荐 · 三步起步</h2>
          <p className="text-xs text-muted-foreground mt-1">
            SubSilicon 平台零抽成：所有交易直接通过你的收款码/网盘直达。按引导完成配置即可开始。
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {steps.map((s) => (
          <button
            key={s.key}
            onClick={s.action}
            className={
              'w-full text-left rounded-xl border p-5 transition-all group hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40 ' +
              (s.done
                ? 'bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-500/60'
                : 'bg-muted/20 border-border hover:border-primary/40 hover:bg-muted/40')
            }
          >
            <div className="flex items-start gap-4">
              <div
                className={
                  'relative w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ' +
                  (s.done
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-muted text-muted-foreground')
                }
              >
                {s.done ? (
                  <Check className="w-5 h-5" strokeWidth={2.4} />
                ) : (
                  <s.Icon className="w-5 h-5" />
                )}
                <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-card border border-border text-[10px] text-muted-foreground flex items-center justify-center">
                  {s.idx}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-medium text-white">{s.title}</h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {s.badge}
                  </span>
                  {s.done && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                      <Check className="w-3 h-3" />
                      已完成
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {s.desc}
                </p>
                {s.cta && (
                  <span className="inline-flex items-center gap-1 mt-2 text-xs text-primary group-hover:underline">
                    {s.cta}
                    <ChevronRight className="w-3.5 h-3.5 -translate-x-0.5 group-hover:translate-x-0 transition-transform" />
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
