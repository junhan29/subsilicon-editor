'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { HelpCircle, X, Play, Keyboard, BookOpen, MessageCircle, Lightbulb, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@editor/components/ui/button'
import { showToast } from '../toast'

interface HelpMenuProps {
  onStartTour: () => void
  onShowShortcuts: () => void
}

export function HelpMenu({ onStartTour, onShowShortcuts }: HelpMenuProps) {
  const [open, setOpen] = useState(false)
  const [updateChecking, setUpdateChecking] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'not-available' | 'error'>('idle')
  const [updateVersion, setUpdateVersion] = useState('')
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
    const api = (window as any).__electronAPI
    if (typeof window !== 'undefined' && api) {
      api.onUpdateChecking(() => {
        setUpdateStatus('checking')
      })
      api.onUpdateAvailable((info: { version: string }) => {
        setUpdateStatus('available')
        setUpdateVersion(info.version)
        showToast('info', `发现新版本 ${info.version}`)
      })
      api.onUpdateNotAvailable(() => {
        setUpdateStatus('not-available')
      })
      api.onUpdateError((message: string) => {
        setUpdateStatus('error')
        showToast('error', `更新检查失败: ${message}`)
      })
      api.onUpdateDownloaded(() => {
        showToast('success', '更新已下载，即将重启安装')
      })
    }
  }, [])

  const handleCheckUpdates = useCallback(() => {
    if (updateChecking) return
    setUpdateChecking(true)
    setUpdateStatus('checking')
    
    if (typeof window !== 'undefined' && (window as any).__electronAPI) {
      (window as any).__electronAPI.checkForUpdates()
    }
    
    setTimeout(() => {
      setUpdateChecking(false)
    }, 5000)
  }, [updateChecking])

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
      icon: updateChecking ? <RefreshCw className="w-4 h-4 animate-spin" /> : updateStatus === 'available' ? <AlertCircle className="w-4 h-4 text-green-400" /> : updateStatus === 'not-available' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <RefreshCw className="w-4 h-4" />, 
      label: '检查更新', 
      desc: updateChecking ? '检查中...' : updateStatus === 'available' ? `新版本 ${updateVersion}` : updateStatus === 'not-available' ? '已是最新版本' : '手动检查更新', 
      onClick: handleCheckUpdates, 
      disabled: updateChecking,
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
                }`} style={{ color: item.disabled ? undefined : undefined }}>
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
