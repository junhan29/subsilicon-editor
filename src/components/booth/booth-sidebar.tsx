/**
 * B2. 纵向图标侧边栏（60px 宽）
 * 5 个图标 Tab：陈列 / 打包发布 / 收款推荐 / 设置 / 关于
 */
import React from 'react'
import { Store, Package, Wallet, Settings, Info } from 'lucide-react'

export type BoothTabKey = 'display' | 'pack' | 'monetize' | 'settings' | 'about'

export interface BoothSidebarProps {
  active: BoothTabKey
  onChange: (key: BoothTabKey) => void
}

const ICON_ITEMS: { key: BoothTabKey; icon: typeof Store; tooltip: string }[] = [
  { key: 'display', icon: Store, tooltip: '陈列' },
  { key: 'pack', icon: Package, tooltip: '打包发布' },
  { key: 'monetize', icon: Wallet, tooltip: '收款推荐' },
  { key: 'settings', icon: Settings, tooltip: '设置' },
  { key: 'about', icon: Info, tooltip: '关于' },
]

export function BoothSidebar({ active, onChange }: BoothSidebarProps) {
  return (
    <aside
      className="w-[60px] shrink-0 border-r border-border bg-card/60 flex flex-col items-center py-3 gap-1.5"
      role="tablist"
      aria-label="我的摊位侧边栏"
    >
      {ICON_ITEMS.map(({ key, icon: Icon, tooltip }) => {
        const isActive = active === key
        return (
          <button
            key={key}
            role="tab"
            aria-selected={isActive}
            aria-label={tooltip}
            title={tooltip}
            onClick={() => onChange(key)}
            className={
              'group relative w-11 h-11 rounded-xl flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 ' +
              (isActive
                ? 'bg-primary/20 text-primary shadow-[inset_2px_0_0_0_hsl(var(--primary)/0.6)]'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted')
            }
          >
            <Icon className="w-5 h-5" strokeWidth={isActive ? 2.2 : 1.8} />
            {/* Tooltip */}
            <span className="pointer-events-none absolute left-full ml-3 px-2 py-1 rounded-md bg-muted border border-border text-[11px] text-foreground whitespace-nowrap opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-focus-within:opacity-100 group-focus-within:translate-x-0 transition-all duration-150 z-50 shadow">
              {tooltip}
            </span>
          </button>
        )
      })}
    </aside>
  )
}
