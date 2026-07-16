'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  X,
  Loader2,
  Search,
  Tag,
  Plus,
  Trash2,
  Settings,
  Globe,
  ExternalLink,
  Clock,
  Sparkles,
  ChevronDown,
  Filter,
  RefreshCw,
} from 'lucide-react'
import {
  listDdpSources,
  addDdpSource,
  removeDdpSource,
  updateDdpSource,
  fetchWorksFederated,
  type DDPSource,
  type DDPSummary,
} from '@editor/lib/ddp-client'
import { showToast } from './toast'

interface DiscoverDialogProps {
  open: boolean
  onClose: () => void
}

type Tab = 'discover' | 'sources'

function DiscoverDialog({ open, onClose }: DiscoverDialogProps) {
  const [activeTab, setActiveTab] = useState<Tab>('discover')
  const [works, setWorks] = useState<DDPSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'newest' | 'popular'>('newest')
  const [sources, setSources] = useState<DDPSource[]>([])
  const [showAddSource, setShowAddSource] = useState(false)
  const [newSource, setNewSource] = useState({ name: '', url: '', type: 'community' as DDPSource['type'] })
  const [showFilters, setShowFilters] = useState(false)

  const loadSources = useCallback(() => {
    setSources(listDdpSources())
  }, [])

  const loadWorks = useCallback(async () => {
    const enabledSources = sources.filter(s => s.enabled)
    if (enabledSources.length === 0) {
      setWorks([])
      return
    }

    setLoading(true)
    try {
      const result = await fetchWorksFederated({
        page: 1,
        limit: 30,
        search: searchQuery || undefined,
        tag: selectedTag || undefined,
        sort: sortBy,
      })
      setWorks(result)
    } catch (err) {
      showToast('error', '加载作品失败')
    } finally {
      setLoading(false)
    }
  }, [sources, searchQuery, selectedTag, sortBy])

  useEffect(() => {
    if (open) {
      loadSources()
    }
  }, [open, loadSources])

  useEffect(() => {
    if (open && activeTab === 'discover') {
      const timer = setTimeout(() => {
        loadWorks()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [open, activeTab, searchQuery, selectedTag, sortBy, loadWorks])

  const handleAddSource = useCallback(() => {
    if (!newSource.name.trim() || !newSource.url.trim()) {
      showToast('error', '请填写名称和 URL')
      return
    }
    const trimmedUrl = newSource.url.trim()
    try {
      new URL(trimmedUrl)
    } catch {
      showToast('error', 'URL 格式不正确')
      return
    }
    addDdpSource({
      id: `ddp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: newSource.name.trim(),
      url: trimmedUrl,
      type: newSource.type,
    })
    setNewSource({ name: '', url: '', type: 'community' })
    setShowAddSource(false)
    loadSources()
    showToast('success', '已添加名录源')
  }, [newSource, loadSources])

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    works.forEach(w => w.tags?.forEach(t => tagSet.add(t)))
    return Array.from(tagSet).slice(0, 20)
  }, [works])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[85vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Globe className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">作品发现</h2>
              <p className="text-[10px] text-slate-500">探索去中心化作品生态</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 py-2 border-b border-slate-700 flex items-center gap-1">
          <button
            onClick={() => setActiveTab('discover')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'discover'
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            发现作品
          </button>
          <button
            onClick={() => setActiveTab('sources')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'sources'
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            名录源
          </button>
          <div className="flex-1" />
          <button
            onClick={loadWorks}
            disabled={loading || activeTab !== 'discover'}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'discover' && (
            <div className="p-5">
              {/* Search bar */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索作品..."
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
                />
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <Filter className="w-4 h-4" />
                </button>
              </div>

              {/* Filters */}
              {showFilters && (
                <div className="mb-4 p-3 rounded-xl bg-slate-800/50 border border-slate-700 space-y-3">
                  <div>
                    <p className="text-[11px] font-medium text-slate-400 mb-2">排序方式</p>
                    <div className="flex gap-2">
                      {(['newest', 'popular'] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => setSortBy(s)}
                          className={`px-2.5 py-1 text-[11px] rounded-lg transition-colors ${
                            sortBy === s
                              ? 'bg-amber-500 text-slate-900 font-medium'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          {s === 'newest' ? '最新发布' : '最受欢迎'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {allTags.length > 0 && (
                    <div>
                      <p className="text-[11px] font-medium text-slate-400 mb-2">热门标签</p>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => setSelectedTag(null)}
                          className={`px-2 py-0.5 text-[11px] rounded-full transition-colors ${
                            !selectedTag
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-slate-700/50 text-slate-400 border border-slate-600 hover:border-slate-500'
                          }`}
                        >
                          全部
                        </button>
                        {allTags.map(tag => (
                          <button
                            key={tag}
                            onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                            className={`px-2 py-0.5 text-[11px] rounded-full transition-colors flex items-center gap-1 ${
                              selectedTag === tag
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-slate-700/50 text-slate-400 border border-slate-600 hover:border-slate-500'
                            }`}
                          >
                            <Tag className="w-2.5 h-2.5" />
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Works grid */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 text-amber-400 animate-spin mb-3" />
                  <p className="text-xs text-slate-400">正在加载作品...</p>
                </div>
              ) : works.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-4">
                    <Sparkles className="w-8 h-8 text-slate-600" />
                  </div>
                  <p className="text-sm text-slate-300 mb-1">暂无作品</p>
                  <p className="text-xs text-slate-500 mb-4">添加更多名录源发现更多作品</p>
                  <button
                    onClick={() => setActiveTab('sources')}
                    className="px-3 py-1.5 text-xs rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium"
                  >
                    管理名录源
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {works.map((work) => (
                    <WorkCard key={`${work.directoryId}:${work.workId}`} work={work} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'sources' && (
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-slate-200">名录源管理</p>
                  <p className="text-[11px] text-slate-500">添加多个名录源，发现更多作品</p>
                </div>
                <button
                  onClick={() => setShowAddSource(!showAddSource)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  添加名录源
                </button>
              </div>

              {showAddSource && (
                <div className="mb-4 p-3 rounded-xl bg-slate-800/50 border border-slate-700 space-y-2">
                  <input
                    type="text"
                    value={newSource.name}
                    onChange={(e) => setNewSource(s => ({ ...s, name: e.target.value }))}
                    placeholder="名录源名称"
                    className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
                  />
                  <input
                    type="url"
                    value={newSource.url}
                    onChange={(e) => setNewSource(s => ({ ...s, url: e.target.value }))}
                    placeholder="API 地址（https://...）"
                    className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
                  />
                  <select
                    value={newSource.type}
                    onChange={(e) => setNewSource(s => ({ ...s, type: e.target.value as DDPSource['type'] }))}
                    className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500/60"
                  >
                    <option value="official">官方</option>
                    <option value="community">社区</option>
                    <option value="personal">个人</option>
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddSource}
                      className="px-3 py-1.5 text-xs rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium"
                    >
                      添加
                    </button>
                    <button
                      onClick={() => setShowAddSource(false)}
                      className="px-3 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {sources.map(source => (
                  <div
                    key={source.id}
                    className="p-3 rounded-xl bg-slate-800/30 border border-slate-700 flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                      <Globe className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-200 truncate">{source.name}</p>
                        <span className={`px-1.5 py-0.5 text-xs font-medium rounded-full ${
                          source.type === 'official' ? 'bg-amber-500/20 text-amber-400' :
                          source.type === 'community' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-slate-600/50 text-slate-400'
                        }`}>
                          {source.type === 'official' ? '官方' : source.type === 'community' ? '社区' : '个人'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">{source.url}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={source.enabled}
                        onChange={() => {
                          updateDdpSource(source.id, { enabled: !source.enabled })
                          loadSources()
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500" />
                    </label>
                    {!source.builtin && (
                      <button
                        onClick={() => {
                          removeDdpSource(source.id)
                          loadSources()
                          showToast('info', '已移除名录源')
                        }}
                        className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                <h4 className="text-xs font-medium text-amber-400 mb-2">关于去中心化名录</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  SubSilicon 采用去中心化作品名录协议 (DDP)，任何人都可以搭建自己的作品展示墙。
                  添加多个名录源可以发现更多创作者的作品，也可以搭建自己的展示墙发布作品。
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function WorkCard({ work }: { work: DDPSummary }) {
  const formatDate = (ts: number) => {
    const date = new Date(ts)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  return (
    <div className="group rounded-xl overflow-hidden bg-slate-800/50 border border-slate-700 hover:border-amber-500/40 transition-all cursor-pointer">
      <div className="aspect-video bg-slate-700 relative overflow-hidden">
        {work.coverImage ? (
          <img
            src={work.coverImage}
            alt={work.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-slate-600" />
          </div>
        )}
        <div className="absolute top-2 right-2">
          {work.monetizationType === 'paid' && work.price && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-amber-500 text-slate-900">
              ¥{work.price}
            </span>
          )}
          {work.monetizationType === 'free' && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-emerald-500 text-white">
              免费
            </span>
          )}
          {work.monetizationType === 'donation' && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-blue-500 text-white">
              打赏
            </span>
          )}
        </div>
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium text-slate-200 truncate mb-1">{work.title}</h3>
        <p className="text-[11px] text-slate-500 line-clamp-2 mb-2 h-8">{work.summary}</p>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500">{work.creatorName}</span>
          <div className="flex items-center gap-1 text-[10px] text-slate-500">
            <Clock className="w-3 h-3" />
            {formatDate(work.publishedAt)}
          </div>
        </div>
        {work.tags && work.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {work.tags.slice(0, 3).map(tag => (
              <span key={tag} className="px-1.5 py-0.5 text-xs rounded-full bg-slate-700/50 text-slate-400">
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 pt-2 border-t border-slate-700/50 flex items-center justify-between">
          <span className="text-[10px] text-slate-600">来自 {work.directoryName}</span>
          <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-amber-400 transition-colors" />
        </div>
      </div>
    </div>
  )
}

export { DiscoverDialog }
