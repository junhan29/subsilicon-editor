/** B6. 设置 Tab：基本设置 + 主题设置 + 构建高级 */
import React, { useState } from 'react'
import { FolderOpen, Monitor, Moon, Sun, Palette, Terminal } from 'lucide-react'
import type { Booth } from '@editor/lib/booth/types'

export interface SettingsTabProps {
  booth: Booth
  updateCreator: (patch: Partial<Booth['creator']>) => void
}

const inputCls =
  'w-full h-9 text-sm rounded-lg border border-border bg-secondary px-3 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50'
const labelCls = 'block text-xs text-muted-foreground mb-1'

export function SettingsTab({ booth, updateCreator }: SettingsTabProps) {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('dark')
  const [shellDir, setShellDir] = useState<string>(
    '（未选择壳目录，需打包时选择）'
  )

  const onChooseShell = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        const r = await (window as any).electronAPI.openFolderDialog()
        if (r?.filePaths?.[0]) setShellDir(r.filePaths[0])
      } else {
        setShellDir('/Users/dev/demo-shell (mock: 浏览器环境无 dialog)')
      }
    } catch {
      setShellDir('选择失败：请重试')
    }
  }

  const envWhitelist: [string, string][] = [
    [
      'NODE_ENV',
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.MODE) || 'production',
    ],
    ['VITE_BUILD_VERSION', '1.16.1'],
  ]

  return (
    <div className="max-w-3xl mx-auto py-8 px-6 space-y-5">
      <h2 className="text-lg font-semibold text-white">设置</h2>

      <section className="rounded-xl border border-border bg-muted/20 overflow-hidden">
        <header className="px-5 py-3 border-b border-border flex items-center gap-2">
          <Palette className="w-4 h-4 text-gold-400" />
          <h3 className="text-sm font-medium text-white">基本设置</h3>
        </header>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <span className={labelCls}>摊位名 / 创作者笔名</span>
            <input
              className={inputCls}
              value={booth.creator.handle}
              placeholder="如：阿摊"
              onChange={(e) => updateCreator({ handle: e.target.value })}
            />
          </div>
          <div>
            <span className={labelCls}>头像 URL</span>
            <input
              className={inputCls}
              value={booth.creator.avatar ?? ''}
              placeholder="可留空，使用默认头像"
              onChange={(e) => updateCreator({ avatar: e.target.value || null })}
            />
          </div>
          <div>
            <span className={labelCls}>联系邮箱 / 站外入口</span>
            <input
              className={inputCls}
              value={booth.creator.contact}
              placeholder="邮箱、微信等公开联系方式"
              onChange={(e) => updateCreator({ contact: e.target.value })}
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-muted/20 overflow-hidden">
        <header className="px-5 py-3 border-b border-border flex items-center gap-2">
          <Monitor className="w-4 h-4 text-sky-400" />
          <h3 className="text-sm font-medium text-white">主题设置</h3>
        </header>
        <div className="p-5 flex flex-wrap gap-2">
          {(
            [
              ['light', Sun, '亮色'],
              ['dark', Moon, '暗色'],
              ['system', Monitor, '跟随系统'],
            ] as const
          ).map(([k, Icon, label]) => (
            <button
              key={k}
              onClick={() => setTheme(k)}
              className={
                'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 ' +
                (theme === k
                  ? 'bg-primary/15 text-primary border-primary/40'
                  : 'bg-muted/40 text-foreground border-border hover:border-primary/30')
              }
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-muted/20 overflow-hidden">
        <header className="px-5 py-3 border-b border-border flex items-center gap-2">
          <Terminal className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-medium text-white">构建高级</h3>
        </header>
        <div className="p-5 space-y-4">
          <div>
            <span className={labelCls}>壳目录选择（独立桌面打包使用）</span>
            <div className="flex gap-2">
              <input
                className={inputCls + ' flex-1 truncate font-mono text-xs'}
                value={shellDir}
                readOnly
              />
              <button
                onClick={onChooseShell}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border text-foreground hover:bg-muted rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 shrink-0"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                选择目录
              </button>
            </div>
          </div>
          <div>
            <span className={labelCls}>环境变量（只读）</span>
            <div className="rounded-lg border border-border overflow-hidden">
              {envWhitelist.map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center px-3 py-2 even:bg-muted/30 gap-3"
                >
                  <code className="text-[11px] text-muted-foreground font-mono shrink-0 w-40">
                    {k}
                  </code>
                  <code className="text-[11px] text-foreground font-mono truncate">
                    {v}
                  </code>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
