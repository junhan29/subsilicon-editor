/** B4. 打包发布 Tab：【本地打包】/【打包参数】双子 Tab + 复用 saveBoothZip 流程 */
import React, { useState } from 'react'
import {
  FolderOpen,
  HardDrive,
  FileArchive,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Terminal,
  ChevronDown,
  ChevronUp,
  Folder,
} from 'lucide-react'
import type { Booth } from '@editor/lib/booth/types'
import type { BoothExportItem } from '@editor/lib/booth/pack'
import { saveBoothZip } from '@editor/lib/booth/pack'
import { showToast } from '@editor/components/editor/toast'

export interface PackTabProps {
  booth: Booth
  items: BoothExportItem[]
}

type SubTab = 'local' | 'params'
type PackStatus = 'idle' | 'running' | 'success' | 'error'

const inputCls =
  'w-full h-9 text-sm rounded-lg border border-border bg-secondary px-3 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50'
const labelCls = 'block text-xs text-muted-foreground mb-1'
const CARD = 'rounded-xl border border-border bg-muted/20 p-4'

export function PackTab({ booth, items }: PackTabProps) {
  const [sub, setSub] = useState<SubTab>('local')
  const [shellDir, setShellDir] = useState<string>('')
  const syncedAt = booth?.sync?.lastSyncedAt
  const defaultVer = syncedAt ? '1.0.' + String(new Date(syncedAt).getDate()) : '1.0.0'
  const [ver, setVer] = useState<string>(defaultVer)
  const [platforms, setPlatforms] = useState<string[]>(['current'])
  const [status, setStatus] = useState<PackStatus>('idle')
  const [outputInfo, setOutputInfo] = useState<{ path?: string; sizeKb?: number } | null>(null)
  const [logsOpen, setLogsOpen] = useState(true)
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (line: string) => {
    const t = new Date().toLocaleTimeString()
    setLogs((prev) => prev.slice(-120).concat('[' + t + '] ' + line))
  }

  const onChooseShell = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        const r = await (window as any).electronAPI.openFolderDialog()
        if (r?.filePaths?.[0]) setShellDir(r.filePaths[0])
      } else {
        setShellDir('/Users/demo/subsilicon-shell (mock)')
      }
    } catch (_e) {
      showToast('error', '目录选择失败')
    }
  }

  const estSizeKb = () => {
    const base = 45 * 1024
    return Math.round(base + items.length * 800)
  }

  const runPackBoothZip = async () => {
    setStatus('running')
    setOutputInfo(null)
    addLog('>>> 开始导出摊位 zip（saveBoothZip）')
    try {
      const r = await saveBoothZip(booth, items)
      if (r.success && r.path) {
        addLog('✓ 摊位包已导出至：' + r.path)
        const size = r.size ? Math.round(r.size / 1024) : estSizeKb()
        setOutputInfo({ path: r.path, sizeKb: size })
        setStatus('success')
        showToast('success', '摊位包已导出')
      } else if (r.error === '已取消') {
        addLog('· 用户已取消保存对话框')
        setStatus('idle')
      } else {
        addLog('✗ ' + (r.error || '导出失败'))
        setStatus('error')
        if (r.error) showToast('error', r.error)
      }
    } catch (e: any) {
      addLog('✗ 异常：' + (e?.message ?? String(e)))
      setStatus('error')
      showToast('error', '打包异常')
    }
  }

  const runShellBuild = async () => {
    setStatus('running')
    setOutputInfo(null)
    addLog('>>> 请求主进程 desktop:build（shell=' + (shellDir || '未选择') + '，platforms=' + platforms.join(',') + '）')
    if (!shellDir) {
      addLog('✗ 请先选择壳目录')
      setStatus('error')
      return
    }
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        const api = (window as any).electronAPI
        const logCh = 'pack_log_' + String(Date.now())
        api.on(logCh, (_: any, m: any) => {
          addLog('[' + (m.level || 'info') + '] ' + (m.msg || ''))
        })
        const r: any = await api.invoke('desktop:build', {
          shellDir,
          platforms,
          logChannel: logCh,
        })
        if (r?.success) {
          const outputs: any[] = r.outputs || []
          const totalSize = outputs.reduce((a, b) => a + ((b && b.size) || 0), 0)
          setOutputInfo({
            path: r.outputDir,
            sizeKb: totalSize ? Math.round(totalSize / 1024) : undefined,
          })
          addLog('✓ 构建成功：' + String(outputs.length) + ' 个产物')
          setStatus('success')
          showToast('success', '壳打包完成，共 ' + String(outputs.length) + ' 份文件')
        } else {
          addLog('✗ ' + (r?.error || '构建失败'))
          setStatus('error')
          if (r?.error) showToast('error', r.error)
        }
      } else {
        addLog('! 当前在浏览器预览模式，无 Electron 环境，跳过实际构建')
        addLog('! （模拟）执行 electron-builder')
        setOutputInfo({ path: shellDir + '/dist (mock)', sizeKb: 82000 })
        setStatus('success')
      }
    } catch (e: any) {
      addLog('✗ 异常：' + (e?.message ?? String(e)))
      setStatus('error')
    }
  }

  const statusBadge = () => {
    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold-400/10 text-gold-400 border border-gold-400/30 text-[10px]">
            <Loader2 className="w-3 h-3 animate-spin" /> 构建中
          </span>
        )
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px]">
            <CheckCircle2 className="w-3 h-3" /> 成功
          </span>
        )
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-red-300 border border-primary/30 text-[10px]">
            <AlertCircle className="w-3 h-3" /> 失败
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border text-[10px]">
            待开始
          </span>
        )
    }
  }

  const togglePlatform = (p: string) => {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : prev.concat([p])))
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-white">打包发布</h2>
        {statusBadge()}
      </div>

      <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
        {(
          [
            ['local', '本地打包'],
            ['params', '打包参数'],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setSub(k)}
            className={
              'px-4 py-1.5 text-xs rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 ' +
              (sub === k
                ? 'bg-card text-white shadow-sm'
                : 'text-muted-foreground hover:text-white')
            }
          >
            {l}
          </button>
        ))}
      </div>

      {sub === 'local' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={CARD}>
              <div className="flex items-center gap-2 mb-3">
                <Folder className="w-4 h-4 text-sky-400" />
                <h4 className="text-sm font-medium text-white">壳目录</h4>
              </div>
              <div className="space-y-2">
                <span className={labelCls}>Standalone 壳模板</span>
                <div className="flex gap-2">
                  <input
                    className={inputCls + ' flex-1 font-mono text-[11px] truncate'}
                    value={shellDir}
                    readOnly
                    placeholder="请选择壳目录"
                  />
                  <button
                    onClick={onChooseShell}
                    className="flex items-center gap-1 px-2.5 text-xs border border-border text-foreground hover:bg-muted rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    选择
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                  签名状态：<b>未签名</b>（开发态默认）
                </p>
              </div>
            </div>

            <div className={CARD}>
              <div className="flex items-center gap-2 mb-3">
                <Terminal className="w-4 h-4 text-gold-400" />
                <h4 className="text-sm font-medium text-white">目标版本</h4>
              </div>
              <div className="space-y-2">
                <div>
                  <span className={labelCls}>版本号</span>
                  <input
                    className={inputCls + ' font-mono text-xs'}
                    value={ver}
                    onChange={(e) => setVer(e.target.value)}
                  />
                </div>
                <div>
                  <span className={labelCls}>目标平台</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(['current', 'mac', 'win', 'linux'] as const).map((p) => {
                      const on = platforms.includes(p)
                      return (
                        <button
                          key={p}
                          onClick={() => togglePlatform(p)}
                          className={
                            'px-2.5 py-1 text-[11px] rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 ' +
                            (on
                              ? 'bg-primary/15 text-primary border-primary/40'
                              : 'bg-muted/40 text-muted-foreground border-border hover:text-white')
                          }
                        >
                          {p}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className={CARD}>
              <div className="flex items-center gap-2 mb-3">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-medium text-white">产物估算</h4>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">陈列作品</span>
                  <span className="text-foreground">{String(items.length)} 件</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">摊位 zip 估算</span>
                  <span className="text-foreground">{(estSizeKb() / 1024).toFixed(1)} MB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">壳 dmg/exe</span>
                  <span className="text-foreground">~85 MB</span>
                </div>
                {outputInfo && (
                  <div className="mt-2 pt-2 border-t border-border text-[11px] text-emerald-400">
                    ✓ 产物路径：
                    <code className="block truncate mt-0.5 text-muted-foreground">
                      {outputInfo.path}
                    </code>
                    {outputInfo.sizeKb != null && (
                      <div>大小：{(outputInfo.sizeKb / 1024).toFixed(1)} MB</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={runPackBoothZip}
              disabled={status === 'running'}
              className="flex items-center gap-1.5 px-4 py-2 text-xs border border-border text-foreground hover:bg-muted rounded-lg transition-colors disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <FileArchive className="w-3.5 h-3.5" />
              导出摊位 zip
            </button>
            <button
              onClick={runShellBuild}
              disabled={status === 'running'}
              className="flex items-center gap-1.5 px-4 py-2 text-xs bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <Loader2
                className={
                  'w-3.5 h-3.5 ' + (status === 'running' ? 'animate-spin' : '')
                }
              />
              Electron 壳打包
            </button>
          </div>

          <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
            <button
              onClick={() => setLogsOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <div className="flex items-center gap-2 text-xs font-medium text-white">
                <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
                构建日志
                <span className="text-muted-foreground font-normal">
                  （{String(logs.length)} 条）
                </span>
              </div>
              {logsOpen ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
            {logsOpen && (
              <div className="px-4 pb-4">
                <pre className="h-44 overflow-auto rounded-lg bg-black/30 border border-border p-3 text-[11px] leading-relaxed text-muted-foreground font-mono whitespace-pre-wrap">
{logs.length === 0
  ? '// 尚未触发构建。点击"导出摊位 zip"或"Electron 壳打包"查看实时日志。'
  : logs.join('\n')}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {sub === 'params' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={CARD}>
            <h4 className="text-sm font-medium text-white mb-2">压缩 / Asar</h4>
            <dl className="text-xs space-y-1.5 text-muted-foreground">
              <div className="flex justify-between">
                <dt>asar</dt>
                <dd className="text-foreground">true（maximum）</dd>
              </div>
              <div className="flex justify-between">
                <dt>compression</dt>
                <dd className="text-foreground">maximum</dd>
              </div>
              <div className="flex justify-between">
                <dt>target</dt>
                <dd className="text-foreground">nsis / dmg / AppImage</dd>
              </div>
            </dl>
          </div>
          <div className={CARD}>
            <h4 className="text-sm font-medium text-white mb-2">签名配置（只读）</h4>
            <dl className="text-xs space-y-1.5 text-muted-foreground">
              <div className="flex justify-between">
                <dt>mac hardenedRuntime</dt>
                <dd className="text-gold-400">false（未签名）</dd>
              </div>
              <div className="flex justify-between">
                <dt>win signAndEditExecutable</dt>
                <dd className="text-gold-400">false</dd>
              </div>
              <div className="flex justify-between">
                <dt>升级发布</dt>
                <dd className="text-foreground">generic · subsilicon.cn/releases</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  )
}
