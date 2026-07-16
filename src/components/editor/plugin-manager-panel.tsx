'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Package,
  Download,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Search,
  ExternalLink,
  Globe,
  AlertCircle,
  Settings,
} from 'lucide-react'
import { Button } from '@editor/components/ui/button'
import { Card, CardContent } from '@editor/components/ui/card'
import { Badge } from '@editor/components/ui/badge'
import {
  fetchPluginMarketplace,
  installPlugin,
  uninstallPlugin,
  PLUGIN_CATEGORIES,
  clearMarketplaceCache,
  type PluginManifest,
} from '@editor/lib/plugins/plugin-registry'
import { showToast } from './toast'

const ICON_MAP: Record<string, React.ReactNode> = {
  FileExport: <Package className="w-5 h-5" />,
  Sparkles: <Package className="w-5 h-5" />,
  BarChart3: <Package className="w-5 h-5" />,
  Palette: <Package className="w-5 h-5" />,
  Package: <Package className="w-5 h-5" />,
  Moon: <Package className="w-5 h-5" />,
  Map: <Package className="w-5 h-5" />,
  BookOpen: <Package className="w-5 h-5" />,
  FileText: <Package className="w-5 h-5" />,
  MessageSquare: <Package className="w-5 h-5" />,
  LineChart: <Package className="w-5 h-5" />,
  Braces: <Package className="w-5 h-5" />,
}

export function PluginManagerPanel() {
  const [plugins, setPlugins] = useState<PluginManifest[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('market')

  const loadPlugins = useCallback(async () => {
    setLoading(true)
    try {
      const { plugins: all } = await fetchPluginMarketplace()
      setPlugins(all)
    } catch {
      showToast('error', '加载插件列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPlugins()
  }, [loadPlugins])

  const handleInstall = async (pluginId: string) => {
    setLoading(true)
    const success = installPlugin(pluginId)
    if (success) {
      showToast('success', '插件已安装')
      loadPlugins()
    } else {
      showToast('error', '安装失败')
    }
    setLoading(false)
  }

  const handleUninstall = async (pluginId: string) => {
    if (!confirm('确定要卸载此插件吗？')) return

    setLoading(true)
    const success = uninstallPlugin(pluginId)
    if (success) {
      showToast('success', '插件已卸载')
      loadPlugins()
    } else {
      showToast('error', '卸载失败')
    }
    setLoading(false)
  }

  const handleRefresh = () => {
    clearMarketplaceCache()
    loadPlugins()
  }

  const filteredPlugins = plugins.filter((p) => {
    if (activeCategory && p.category !== activeCategory) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.keywords?.some((k) => k.toLowerCase().includes(query))
      )
    }
    return true
  })

  const installedPlugins = filteredPlugins.filter((p) => p.enabled)
  const availablePlugins = filteredPlugins.filter((p) => !p.enabled)

  const PluginCard = ({ plugin, installed }: { plugin: PluginManifest; installed: boolean }) => (
    <Card className="border-border hover:border-purple-500/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
            installed ? 'bg-green-500/10 text-green-500' : 'bg-purple-500/10 text-purple-500'
          }`}>
            {ICON_MAP[plugin.icon || 'Package'] || <Package className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-medium">{plugin.name}</p>
              <Badge variant="outline" className="text-[10px]">v{plugin.version}</Badge>
              {installed && <CheckCircle2 className="w-3 h-3 text-green-500" />}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{plugin.description}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-[10px]">
                {PLUGIN_CATEGORIES.find((c) => c.id === plugin.category)?.name}
              </Badge>
              <span className="text-[10px] text-muted-foreground">{plugin.author}</span>
              {plugin.homepage && (
                <a
                  href={plugin.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
          {installed ? (
            <div className="flex gap-1 shrink-0">
              <Button size="sm" variant="outline" className="text-xs h-7">
                <Settings className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleUninstall(plugin.id)}
                disabled={loading}
                className="text-xs h-7 text-red-500 border-red-500/30 hover:bg-red-500/10"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="default"
              onClick={() => handleInstall(plugin.id)}
              disabled={loading}
              className="text-xs h-7 shrink-0"
            >
              <Download className="w-3 h-3 mr-1" />
              安装
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-purple-500" />
          <h3 className="font-medium">插件管理</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="搜索插件..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-1.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Category filters */}
      <div className="px-4 py-2 border-b border-border shrink-0">
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant={activeCategory === null ? 'default' : 'outline'}
            onClick={() => setActiveCategory(null)}
            className="text-xs h-7"
          >
            全部
          </Button>
          {PLUGIN_CATEGORIES.map((cat) => (
            <Button
              key={cat.id}
              size="sm"
              variant={activeCategory === cat.id ? 'default' : 'outline'}
              onClick={() => setActiveCategory(cat.id)}
              className="text-xs h-7"
            >
              {cat.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border shrink-0">
        <button
          onClick={() => setActiveTab('market')}
          className={`flex-1 py-2 text-xs font-medium text-center transition-colors ${
            activeTab === 'market'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          发现 ({availablePlugins.length})
        </button>
        <button
          onClick={() => setActiveTab('installed')}
          className={`flex-1 py-2 text-xs font-medium text-center transition-colors ${
            activeTab === 'installed'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          已安装 ({installedPlugins.length})
        </button>
      </div>

      {/* Scrollable content - FIX: overflow-y-auto for scrolling */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-purple-500" />
          </div>
        )}

        {!loading && activeTab === 'market' && availablePlugins.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">暂无可安装插件</p>
          </div>
        )}

        {!loading && activeTab === 'market' && availablePlugins.map((plugin) => (
          <PluginCard key={plugin.id} plugin={plugin} installed={false} />
        ))}

        {!loading && activeTab === 'installed' && installedPlugins.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">暂无已安装插件</p>
            <p className="text-xs mt-1">切换到"发现"标签页安装插件</p>
          </div>
        )}

        {!loading && activeTab === 'installed' && installedPlugins.map((plugin) => (
          <PluginCard key={plugin.id} plugin={plugin} installed={true} />
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 bg-purple-500/10 rounded-lg m-4 text-xs text-purple-600 shrink-0">
        <p className="font-medium mb-1">插件说明</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>插件可扩展编辑器功能</li>
          <li>安装后需要刷新页面生效</li>
          <li>部分插件需要额外配置</li>
        </ul>
      </div>
    </div>
  )
}
