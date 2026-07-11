'use client'

import { useCallback, useEffect, useState } from 'react'
import { Minus, Square, X, Menu, FolderOpen, Save, Plus, ChevronDown } from 'lucide-react'
import { showToast } from './toast'

export function CustomTitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)
  const [currentPath, setCurrentPath] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const [recentFiles, setRecentFiles] = useState<string[]>([])

  const electronApi = (window as any).__electronAPI

  const handleMinimize = useCallback(() => {
    electronApi?.minimizeWindow()
  }, [electronApi])

  const handleMaximize = useCallback(() => {
    electronApi?.maximizeWindow()
    setIsMaximized(prev => !prev)
  }, [electronApi])

  const handleClose = useCallback(() => {
    electronApi?.closeWindow()
  }, [electronApi])

  const handleNewFile = useCallback(() => {
    setShowMenu(false)
    window.dispatchEvent(new CustomEvent('app:new-file'))
  }, [])

  const handleOpenFile = useCallback(async () => {
    setShowMenu(false)
    const result = await electronApi?.openFileDialog()
    if (result?.success && result.path) {
      setCurrentPath(result.path)
      window.dispatchEvent(new CustomEvent('app:open-file', { detail: { path: result.path } }))
    }
  }, [electronApi])

  const handleSaveFile = useCallback(async () => {
    setShowMenu(false)
    if (currentPath) {
      window.dispatchEvent(new CustomEvent('app:save-file', { detail: { path: currentPath } }))
    } else {
      const result = await electronApi?.saveFileDialog()
      if (result?.success && result.path) {
        setCurrentPath(result.path)
        window.dispatchEvent(new CustomEvent('app:save-file', { detail: { path: result.path } }))
      }
    }
  }, [currentPath, electronApi])

  const handleSaveAs = useCallback(async () => {
    setShowMenu(false)
    const result = await electronApi?.saveFileDialog({ defaultPath: currentPath })
    if (result?.success && result.path) {
      setCurrentPath(result.path)
      window.dispatchEvent(new CustomEvent('app:save-file', { detail: { path: result.path } }))
    }
  }, [currentPath, electronApi])

  const handleOpenRecent = useCallback((filePath: string) => {
    setShowMenu(false)
    setCurrentPath(filePath)
    window.dispatchEvent(new CustomEvent('app:open-file', { detail: { path: filePath } }))
  }, [])

  useEffect(() => {
    const loadRecentFiles = async () => {
      const result = await electronApi?.getRecentFiles()
      if (result?.success && result.files) {
        setRecentFiles(result.files)
      }
    }
    loadRecentFiles()
  }, [electronApi])

  useEffect(() => {
    const handleOpenFileWithPath = (e: Event) => {
      const detail = (e as CustomEvent<{ path: string }>).detail
      if (detail?.path) {
        setCurrentPath(detail.path)
      }
    }
    window.addEventListener('app:open-file', handleOpenFileWithPath)
    return () => window.removeEventListener('app:open-file', handleOpenFileWithPath)
  }, [])

  useEffect(() => {
    const handleSaveSuccess = () => {
      showToast('success', '已保存')
    }
    window.addEventListener('app:save-success', handleSaveSuccess)
    return () => window.removeEventListener('app:save-success', handleSaveSuccess)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-title-bar-menu]')) {
        setShowMenu(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const filename = currentPath ? currentPath.split('/').pop() || '未命名作品' : '未命名作品'

  return (
    <div className="h-10 bg-[#0f172a] border-b border-border flex items-center justify-between select-none relative">
      <div className="flex items-center gap-2 pl-3">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-500 to-red-500 flex items-center justify-center">
          <span className="text-white text-xs font-bold">S</span>
        </div>
        <span className="text-sm font-medium text-white">SubSilicon Editor</span>
      </div>

      <div className="flex-1 mx-4 flex items-center justify-center">
        <div className="max-w-md flex items-center gap-2 text-xs text-muted-foreground truncate">
          <FolderOpen className="w-3.5 h-3.5 opacity-60" />
          <span className="truncate">{filename}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 pr-1">
        <button
          onClick={handleNewFile}
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
          title="新建作品 (Ctrl+N)"
        >
          <Plus className="w-4 h-4 text-white/70" />
        </button>
        <button
          onClick={handleOpenFile}
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
          title="打开作品 (Ctrl+O)"
        >
          <FolderOpen className="w-4 h-4 text-white/70" />
        </button>
        <button
          onClick={handleSaveFile}
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
          title="保存作品 (Ctrl+S)"
        >
          <Save className="w-4 h-4 text-white/70" />
        </button>

        <div className="w-px h-6 bg-border mx-1" />

        <div className="relative" data-title-bar-menu>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            title="菜单"
          >
            <Menu className="w-4 h-4 text-white/70" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-10 w-56 bg-[#1e293b] border border-border rounded-lg shadow-xl py-1 z-50">
              <button
                onClick={handleNewFile}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                新建作品
                <span className="ml-auto text-xs text-muted-foreground">Ctrl+N</span>
              </button>
              <button
                onClick={handleOpenFile}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2"
              >
                <FolderOpen className="w-4 h-4" />
                打开作品
                <span className="ml-auto text-xs text-muted-foreground">Ctrl+O</span>
              </button>
              <button
                onClick={handleSaveFile}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                保存作品
                <span className="ml-auto text-xs text-muted-foreground">Ctrl+S</span>
              </button>
              <button
                onClick={handleSaveAs}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                另存为
                <span className="ml-auto text-xs text-muted-foreground">Ctrl+Shift+S</span>
              </button>
              {recentFiles.length > 0 && (
                <>
                  <div className="h-px bg-border my-1" />
                  <div className="px-4 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    最近打开
                  </div>
                  {recentFiles.slice(0, 5).map((file, index) => (
                    <button
                      key={index}
                      onClick={() => handleOpenRecent(file)}
                      className="w-full px-4 py-2 text-left text-sm text-white/80 hover:bg-white/10 truncate"
                    >
                      {file}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-border mx-1" />

        <button
          onClick={handleMinimize}
          className="p-2 rounded hover:bg-white/10 transition-colors"
          title="最小化"
        >
          <Minus className="w-4 h-4 text-white/70" />
        </button>
        <button
          onClick={handleMaximize}
          className="p-2 rounded hover:bg-white/10 transition-colors"
          title={isMaximized ? '还原' : '最大化'}
        >
          <Square className="w-4 h-4 text-white/70" />
        </button>
        <button
          onClick={handleClose}
          className="p-2 rounded hover:bg-red-500/80 transition-colors"
          title="关闭"
        >
          <X className="w-4 h-4 text-white/70" />
        </button>
      </div>
    </div>
  )
}