/** B7. 关于 Tab */
import React from 'react'
import { ExternalLink, FileCode } from 'lucide-react'

export function AboutTab() {
  const appVer =
    (typeof window !== 'undefined' && (window as any).__SUBVER__) || '1.16.1'
  return (
    <div className="max-w-2xl mx-auto py-10 px-6 space-y-6">
      <div className="text-center space-y-3">
        <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-gold-400 via-orange-500 to-primary flex items-center justify-center shadow-xl">
          <span className="text-3xl font-black text-white">S</span>
        </div>
        <h2 className="text-xl font-bold text-white">SubSilicon Editor</h2>
        <p className="text-xs text-muted-foreground">
          零代码可视化互动叙事编辑器 · 版本 v{appVer}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 divide-y divide-border overflow-hidden">
        <div className="px-5 py-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">开源协议</span>
          <span className="text-xs font-medium text-foreground">MIT License</span>
        </div>
        <div className="px-5 py-3 flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground shrink-0">开源仓库</span>
          <a
            href="https://github.com/subsilicon/subsilicon-editor"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline truncate focus:outline-none focus:ring-2 focus:ring-primary/30 rounded px-1"
          >
            <FileCode className="w-3.5 h-3.5 shrink-0" />
            github.com/subsilicon/subsilicon-editor
            <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
          </a>
        </div>
        <div className="px-5 py-3 flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground shrink-0">官方站点</span>
          <a
            href="https://subsilicon.cn"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline truncate focus:outline-none focus:ring-2 focus:ring-primary/30 rounded px-1"
          >
            https://subsilicon.cn
            <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
          </a>
        </div>
      </div>

      <p className="text-center text-[11px] text-muted-foreground leading-relaxed">
        © SubSilicon Team. SubSilicon 自由集市仅提供作品宣传信息展示，
        <br />
        作品内容交易与分发由创作者直接负责，平台零参与。
      </p>
    </div>
  )
}
