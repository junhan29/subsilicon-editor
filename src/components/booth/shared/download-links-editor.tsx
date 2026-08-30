/**
 * 下载渠道编辑器（网盘链接配置 1..10 条）
 * - kind 下拉白名单
 * - label / link / password / note
 * - 增删 + 空态
 * - 使用 validateDownloadLinks（渲染层校验），onChange 外抛规范化数组
 */
import React, { useMemo } from 'react'
import { Plus, Trash2, AlertTriangle } from 'lucide-react'
import {
  DOWNLOAD_KIND_WHITELIST,
  type DownloadLink,
  type DownloadLinkKind,
  validateDownloadLinks,
} from '@editor/lib/creator-service'
import { EmptyDownloadSvg } from './svg-illustrations'

const KIND_LABELS: Record<DownloadLinkKind, string> = {
  baidupan: '百度网盘',
  aliyundrive: '阿里云盘',
  quark: '夸克',
  onedrive: 'OneDrive',
  googledrive: 'Google Drive',
  lanzou: '蓝奏云',
  other: '其他',
}

export interface DownloadLinksEditorProps {
  value: DownloadLink[]
  onChange: (next: DownloadLink[]) => void
  /** 传入则显示 flash 高亮（来自收款推荐跳转） */
  flashHighlight?: boolean
  disabled?: boolean
}

const inputCls =
  'w-full h-8 text-xs rounded-md border border-border bg-secondary px-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50'
const labelCls = 'block text-[11px] text-muted-foreground mb-1'

function newId(): string {
  return 'dl_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6)
}

export function DownloadLinksEditor({
  value,
  onChange,
  flashHighlight = false,
  disabled = false,
}: DownloadLinksEditorProps) {
  // 实时校验：显示错误信息
  const validation = useMemo(() => validateDownloadLinks(value, { allowEmpty: true }), [value])

  const add = () => {
    if (value.length >= 10) return
    onChange([
      ...value,
      {
        id: newId(),
        kind: 'baidupan',
        label: '',
        link: '',
        password: '',
        note: '',
      },
    ])
  }

  const remove = (id: string) => onChange(value.filter((d) => d.id !== id))

  const update = (id: string, patch: Partial<DownloadLink>) =>
    onChange(value.map((d) => (d.id === id ? { ...d, ...patch } : d)))

  return (
    <div
      className={
        'rounded-xl border transition-all duration-300 ' +
        (flashHighlight
          ? 'border-gold-400/70 ring-2 ring-gold-400/40 shadow-[0_0_0_4px_rgba(201,123,45,0.12)]'
          : 'border-border bg-muted/20')
      }
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h4 className="text-sm font-medium text-white flex items-center gap-2">
            下载渠道配置
            <span className="text-[10px] text-muted-foreground font-normal">
              {value.length}/10 条
            </span>
          </h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            支持多网盘链接，买家通过此处下载作品本体
          </p>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={disabled || value.length >= 10}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary/15 text-primary hover:bg-primary/25 rounded-lg border border-primary/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <Plus className="w-3.5 h-3.5" />
          添加下载渠道
        </button>
      </div>

      <div className="p-4 space-y-3">
        {!validation.ok && validation.error && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-[11px] text-red-300">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-400" />
            <span>{validation.error}</span>
          </div>
        )}

        {value.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center text-center border border-dashed border-border rounded-lg">
            <EmptyDownloadSvg className="w-40 h-24 mb-3 opacity-70" />
            <p className="text-xs text-foreground mb-1">暂未配置下载渠道</p>
            <p className="text-[11px] text-muted-foreground max-w-sm mb-4">
              买家获取作品本体将仅通过你的联系方式。建议至少配置 1 条网盘链接，加快成交。
            </p>
            {!disabled && (
              <button
                type="button"
                onClick={add}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-primary hover:bg-primary/10 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <Plus className="w-3.5 h-3.5" />
                配置第一条下载渠道
              </button>
            )}
          </div>
        ) : (
          value.map((d, i) => (
            <div
              key={d.id}
              className="p-3 rounded-lg border border-border/70 bg-muted/40 space-y-2.5 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground">
                  渠道 #{i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => remove(d.id)}
                  disabled={disabled}
                  title="删除此渠道"
                  className="p-1 text-muted-foreground hover:text-red-400 hover:bg-primary/10 rounded-md transition-colors disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <span className={labelCls}>网盘类型 *</span>
                  <select
                    className={inputCls}
                    value={d.kind}
                    disabled={disabled}
                    onChange={(e) => update(d.id, { kind: e.target.value as DownloadLinkKind })}
                  >
                    {DOWNLOAD_KIND_WHITELIST.map((k) => (
                      <option key={k} value={k}>
                        {KIND_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className={labelCls}>展示名 *（≤120 字）</span>
                  <input
                    type="text"
                    className={inputCls}
                    value={d.label}
                    disabled={disabled}
                    maxLength={120}
                    placeholder="如：全本（百度网盘）"
                    onChange={(e) => update(d.id, { label: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <span className={labelCls}>下载链接 *（http/https）</span>
                  <input
                    type="url"
                    className={inputCls}
                    value={d.link}
                    disabled={disabled}
                    maxLength={500}
                    placeholder="https://pan.baidu.com/s/xxxxxx"
                    onChange={(e) => update(d.id, { link: e.target.value })}
                  />
                </div>
                <div>
                  <span className={labelCls}>提取码（≤64 字符，可选）</span>
                  <input
                    type="text"
                    className={inputCls}
                    value={d.password ?? ''}
                    disabled={disabled}
                    maxLength={64}
                    placeholder="如：a1b2"
                    onChange={(e) => update(d.id, { password: e.target.value })}
                  />
                </div>
                <div>
                  <span className={labelCls}>备注（≤200 字，可选）</span>
                  <input
                    type="text"
                    className={inputCls}
                    value={d.note ?? ''}
                    disabled={disabled}
                    maxLength={200}
                    placeholder="如：解压密码 xxx"
                    onChange={(e) => update(d.id, { note: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export { KIND_LABELS }
