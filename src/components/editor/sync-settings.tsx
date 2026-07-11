'use client'

import { useState, useEffect } from 'react'
import { getIndexSources, setIndexSources, resetIndexSources } from '@editor/lib/template-index-fetcher'
import { X, Plus, RefreshCw, Undo } from 'lucide-react'

interface SyncSettingsProps {
  onClose: () => void
}

const DEFAULT_SOURCES = [
  'https://subsilicon.cn/api/templates/index.json',
  'https://subsilicon.github.io/template-index/index.json',
]

export function SyncSettings({ onClose }: SyncSettingsProps) {
  const [sources, setSources] = useState<string[]>([])
  const [newUrl, setNewUrl] = useState('')

  useEffect(() => {
    setSources(getIndexSources())
  }, [])

  const addSource = () => {
    const url = newUrl.trim()
    if (url && !sources.includes(url)) {
      const updated = [...sources, url]
      setSources(updated)
      setIndexSources(updated)
      setNewUrl('')
    }
  }

  const removeSource = (index: number) => {
    if (index < DEFAULT_SOURCES.length) return // Can't remove defaults
    const updated = sources.filter((_, i) => i !== index)
    setSources(updated)
    setIndexSources(updated)
  }

  const handleReset = () => {
    resetIndexSources()
    setSources(DEFAULT_SOURCES)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card border rounded-lg shadow-xl w-96 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">模板/插件索引源</h3>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 mb-4">
          <p className="text-[10px] text-muted-foreground">默认源（不可移除）</p>
          {sources.slice(0, DEFAULT_SOURCES.length).map((url, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-slate-800/30 rounded border border-slate-700/50">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-[10px] text-slate-300 truncate flex-1">{url}</span>
              <span className="text-[9px] text-slate-500 shrink-0">
                {i === 0 ? '官方' : '备份'}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-2 mb-4">
          <p className="text-[10px] text-muted-foreground">自定义源</p>
          {sources.slice(DEFAULT_SOURCES.length).map((url, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-slate-800/20 rounded border border-slate-700/30">
              <span className="text-[10px] text-slate-300 truncate flex-1">{url}</span>
              <button onClick={() => removeSource(DEFAULT_SOURCES.length + i)} className="p-0.5 text-red-400/60 hover:text-red-400 shrink-0">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://example.com/index.json"
              className="flex-1 h-7 text-[10px] bg-slate-800 border border-slate-700 rounded px-2 text-slate-300 placeholder:text-slate-600"
              onKeyDown={(e) => e.key === 'Enter' && addSource()}
            />
            <button onClick={addSource} className="p-1 text-slate-400 hover:text-white shrink-0" title="添加">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="text-[10px] text-slate-500 mb-4">
          每个源之间按顺序尝试，从上到下。如果第一个源不可用，自动切换到下一个。
        </div>

        <div className="flex justify-between">
          <button onClick={handleReset} className="flex items-center gap-1 px-2 py-1 text-[10px] text-slate-400 hover:text-slate-200 transition-colors">
            <Undo className="w-3 h-3" />
            恢复默认
          </button>
          <button onClick={onClose} className="px-3 py-1.5 text-xs bg-pink-600 text-white rounded hover:bg-pink-500">
            完成
          </button>
        </div>
      </div>
    </div>
  )
}
