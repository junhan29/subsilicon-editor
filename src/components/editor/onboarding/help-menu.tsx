'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { HelpCircle, X, Play, Keyboard, BookOpen, MessageCircle, Lightbulb, RefreshCw, CheckCircle2, AlertCircle, Download, RotateCcw } from 'lucide-react'
import { Button } from '@editor/components/ui/button'
import { showToast } from '../toast'

interface HelpMenuProps {
  onStartTour: () => void
  onShowShortcuts: () => void
}

interface UpdateInfo {
  version: string
  releaseDate?: string
  releaseNotes?: string
}

export function HelpMenu({ onStartTour, onShowShortcuts }: HelpMenuProps) {
  const [open, setOpen] = useState(false)
  const [updateChecking, setUpdateChecking] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'>('idle')
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const api = window.__electronAPI
    if (typeof window !== 'undefined' && api) {
      api.onUpdateChecking(() => {
        setUpdateStatus('checking')
      })
      api.onUpdateAvailable((info) => {
        setUpdateStatus('available')
        setUpdateInfo(info)
        showToast('info', `发现新版本 v${info.version}`)
      })
      api.onUpdateNotAvailable(() => {
        setUpdateStatus('not-available')
      })
      api.onUpdateError((message) => {
        setUpdateStatus('error')
        showToast('error', `更新检查失败: ${message}`)
      })
      api.onUpdateProgress((progress) => {
        setUpdateStatus('downloading')
        setDownloadProgress(Math.round(progress.percent))
      })
      api.onUpdateDownloaded(() => {
        setUpdateStatus('downloaded')
        setDownloadProgress(100)
        showToast('success', '更新已下载完成，点击重启安装')
      })
    }
  }, [])

  const handleCheckUpdates = useCallback(() => {
    if (updateChecking || updateStatus === 'downloading') return
    setUpdateChecking(true)
    setUpdateStatus('checking')

    if (typeof window !== 'undefined' && window.__electronAPI) {
      window.__electronAPI.checkForUpdates()
    }

    setTimeout(() => {
      setUpdateChecking(false)
    }, 10000)
  }, [updateChecking, updateStatus])

  const handleDownloadUpdate = useCallback(() => {
    if (typeof window !== 'undefined' && window.__electronAPI) {
      window.__electronAPI.downloadUpdate()
      setUpdateStatus('downloading')
      setDownloadProgress(0)
    }
  }, [])

  const handleInstallUpdate = useCallback(() => {
    if (typeof window !== 'undefined' && window.__electronAPI) {
      window.__electronAPI.installUpdate()
    }
  }, [])

  const handleStartTour = () => {
    setOpen(false)
    onStartTour()
  }

  const handleShowShortcuts = () => {
    setOpen(false)
    onShowShortcuts()
  }

  const menuItems = [
    { icon: <Play className="w-4 h-4" />, label: '重新播放引导', desc: '1 分钟快速上手', onClick: handleStartTour, shortcut: 'Shift + ?' },
    { icon: <Keyboard className="w-4 h-4" />, label: '键盘快捷键', desc: '查看所有快捷键', onClick: handleShowShortcuts, shortcut: '?' },
    {
      icon: updateChecking
        ? <RefreshCw className="w-4 h-4 animate-spin" />
        : updateStatus === 'available' || updateStatus === 'downloading' || updateStatus === 'downloaded'
        ? <AlertCircle className="w-4 h-4 text-amber-400" />
        : updateStatus === 'not-available'
        ? <CheckCircle2 className="w-4 h-4 text-green-500" />
        : <RefreshCw className="w-4 h-4" />,
      label: '检查更新',
      desc: updateChecking ? '检查中...' : updateStatus === 'available' ? `发现新版本 v${updateInfo?.version}` : updateStatus === 'downloading' ? `下载中 ${downloadProgress}%` : updateStatus === 'downloaded' ? '已下载，等待安装' : updateStatus === 'not-available' ? '已是最新版本' : '手动检查更新',
      onClick: handleCheckUpdates,
      disabled: updateChecking || updateStatus === 'downloading',
    },
  ]

  const tips = [
    '从左侧拖拽节点到画布即可添加',
    '拖动节点底部圆点到下一个节点顶部创建连线',
    '选中节点后在右侧面板编辑内容',
    '按 Delete 键可删除选中的节点',
  ]

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(!open)}
        className="w-8 h-8 p-0 rounded-full"
        title="帮助 (?)"
      >
        <HelpCircle className="w-4 h-4" />
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-background rounded-xl shadow-xl border z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* 头部 */}
          <div className="px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">帮助中心</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-6 h-6 rounded-full hover:bg-muted flex items-center justify-center"
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* 快捷操作 */}
          <div className="p-2">
            {menuItems.map((item, i) => (
              <button
                key={i}
                onClick={item.onClick}
                disabled={item.disabled}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                  item.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/50'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  item.disabled ? 'bg-muted' : 'bg-primary/10'
                }`}>
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                </div>
                {item.shortcut && (
                  <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono shrink-0">
                    {item.shortcut}
                  </kbd>
                )}
              </button>
            ))}
          </div>

          {/* 更新详情面板 */}
          {updateInfo && (updateStatus === 'available' || updateStatus === 'downloading' || updateStatus === 'downloaded') && (
            <div className="mx-2 mb-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Download className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-medium">v{updateInfo.version}</span>
                {updateInfo.releaseDate && (
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(updateInfo.releaseDate).toLocaleDateString('zh-CN')}
                  </span>
                )}
              </div>

              {updateInfo.releaseNotes && (
                <div className="text-[11px] text-muted-foreground mb-2 max-h-24 overflow-y-auto whitespace-pre-line">
                  {updateInfo.releaseNotes.split('\n').slice(0, 5).join('\n')}
                </div>
              )}

              {/* 下载进度条 */}
              {updateStatus === 'downloading' && (
                <div className="mb-2">
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all duration-300"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 text-center">{downloadProgress}%</p>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex gap-2">
                {updateStatus === 'available' && (
                  <button
                    onClick={handleDownloadUpdate}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 text-xs font-medium transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    下载更新
                  </button>
                )}
                {updateStatus === 'downloaded' && (
                  <button
                    onClick={handleInstallUpdate}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-green-500/15 hover:bg-green-500/25 text-green-600 dark:text-green-400 text-xs font-medium transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    重启安装
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 小贴士 */}
          <div className="px-4 py-3 border-t bg-muted/20">
            <div className="flex items-center gap-1.5 mb-2">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-medium">创作小贴士</span>
            </div>
            <ul className="space-y-1.5">
              {tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground leading-relaxed">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/40 mt-1.5 shrink-0" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
