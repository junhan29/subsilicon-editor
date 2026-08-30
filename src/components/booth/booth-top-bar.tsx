/**
 * B1. 我的摊位工作台顶栏
 * 左：SubSilicon +「我的摊位」次级小字
 * 中：保存状态 Badge（已自动保存 / 保存中 / !未保存）
 * 右：创作身份（已登录显示信息/未登录引导生成令牌）
 */
import React, { useEffect, useState } from 'react'
import { ArrowLeft, Check, Loader2, AlertTriangle, User, LogOut, KeyRound } from 'lucide-react'
import type { LocalAccount } from '@editor/lib/local-account-store'
import { getAccount, isLoggedIn, logout } from '@editor/lib/local-account-store'
import { showToast } from '@editor/components/editor/toast'

export interface BoothTopBarProps {
  onBack: () => void
  saved: boolean
  updatedAt: number
  onRequestLogin: () => void
}

type SaveState = 'saved' | 'saving' | 'dirty'

export function BoothTopBar({ onBack, saved, updatedAt, onRequestLogin }: BoothTopBarProps) {
  const [saveState, setSaveState] = useState<SaveState>(saved ? 'saved' : 'saving')
  const [account, setAccount] = useState<Omit<LocalAccount, "passwordHash"> | null>(isLoggedIn() ? getAccount() : null)

  // dirty 判定：saved=false 且距离上次 update > 3s → 标红未保存
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const sync = () => {
      if (saved) setSaveState('saved')
      else {
        setSaveState('saving')
        const age = Date.now() - updatedAt
        t = setTimeout(() => {
          if (!saved) setSaveState('dirty')
        }, Math.max(0, 3000 - age))
      }
    }
    sync()
    return () => { if (t) clearTimeout(t) }
  }, [saved, updatedAt])

  const handleLogout = () => {
    logout()
    setAccount(null)
    showToast('success', '已退出创作身份')
  }

  const badge = () => {
    switch (saveState) {
      case 'saved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gold-400/10 border border-gold-400/30 text-[11px] text-gold-400">
            <Check className="w-3 h-3" />
            已自动保存
          </span>
        )
      case 'saving':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-silver-400/10 border border-silver-400/30 text-[11px] text-silver-500">
            <Loader2 className="w-3 h-3 animate-spin" />
            保存中…
          </span>
        )
      case 'dirty':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-destructive/10 border border-destructive/30 text-[11px] text-destructive">
            <AlertTriangle className="w-3 h-3" />
            未保存
          </span>
        )
    }
  }

  return (
    <header className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card/90 backdrop-blur shrink-0 h-11">
      {/* 左：返回 + 品牌名 + 一级导航 */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onBack}
          aria-label="返回编辑器"
          className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 pl-1">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-[0_0_0_1px_rgba(255,255,255,0.05)]">
            <span className="text-[10px] font-bold text-black">S</span>
          </div>
          <span className="text-sm font-semibold text-foreground whitespace-nowrap">SubSilicon</span>
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">/ 我的摊位</span>
        </div>
      </div>

      {/* 中：保存状态 */}
      <div className="flex-1 flex items-center justify-center">
        {badge()}
      </div>

      {/* 右：创作身份 */}
      <div className="flex items-center gap-2 min-w-0">
        {account ? (
          <div className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg bg-muted/60 border border-border hover:border-primary/40 transition-colors">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gold-400 to-sienna flex items-center justify-center shrink-0">
              <User className="w-3.5 h-3.5 text-black" />
            </div>
            <div className="leading-tight max-w-[160px] hidden sm:block">
              <div className="text-xs font-medium text-foreground truncate">
                {account.displayName || account.email.split('@')[0]}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">{account.email}</div>
            </div>
            <button
              onClick={handleLogout}
              title="退出创作身份"
              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-primary/10 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={onRequestLogin}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary/15 text-primary hover:bg-primary/25 rounded-lg border border-primary/30 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <KeyRound className="w-3.5 h-3.5" />
            生成创作令牌
          </button>
        )}
      </div>
    </header>
  )
}
