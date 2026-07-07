import { pluginManager } from './plugin-manager'

export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  author: string
  category: 'export' | 'ai' | 'analytics' | 'ui' | 'theme' | 'other'
  icon?: string
  homepage?: string
  repository?: string
  keywords?: string[]
  permissions?: string[]
  entry?: string
  enabled?: boolean
}

export interface PluginCategory {
  id: string
  name: string
  icon: string
  description: string
}

export const PLUGIN_CATEGORIES: PluginCategory[] = [
  { id: 'export', name: '导出增强', icon: 'FileExport', description: '扩展导出格式和功能' },
  { id: 'ai', name: 'AI 能力', icon: 'Sparkles', description: '集成更多 AI 模型和功能' },
  { id: 'analytics', name: '数据分析', icon: 'BarChart3', description: '增强读者行为分析' },
  { id: 'ui', name: '界面增强', icon: 'Palette', description: '优化编辑界面和交互' },
  { id: 'theme', name: '主题样式', icon: 'Paintbrush', description: '自定义编辑器外观' },
  { id: 'other', name: '其他', icon: 'Package', description: '其他类型插件' },
]

export const OFFICIAL_PLUGINS: PluginManifest[] = [
  {
    id: 'export-pdf',
    name: 'PDF 导出',
    version: '1.0.0',
    description: '将故事导出为 PDF 文档，支持自定义样式和封面',
    author: 'SubSilicon',
    category: 'export',
    icon: 'FileText',
    keywords: ['pdf', 'export', 'document'],
    permissions: ['export'],
  },
  {
    id: 'export-epub',
    name: 'EPUB 导出',
    version: '1.0.0',
    description: '将故事导出为 EPUB 电子书格式，支持章节划分',
    author: 'SubSilicon',
    category: 'export',
    icon: 'BookOpen',
    keywords: ['epub', 'ebook', 'export'],
    permissions: ['export'],
  },
  {
    id: 'ai-claude',
    name: 'Claude AI 集成',
    version: '1.0.0',
    description: '集成 Anthropic Claude API，支持 Claude 3.5 Sonnet',
    author: 'SubSilicon',
    category: 'ai',
    icon: 'MessageSquare',
    keywords: ['claude', 'anthropic', 'ai'],
    permissions: ['ai', 'network'],
  },
  {
    id: 'analytics-chart',
    name: '高级图表',
    version: '1.0.0',
    description: '为分析面板添加更多图表类型：折线图、散点图、热力图',
    author: 'SubSilicon',
    category: 'analytics',
    icon: 'LineChart',
    keywords: ['chart', 'analytics', 'visualization'],
    permissions: ['ui'],
  },
  {
    id: 'theme-dark-pro',
    name: '深色主题 Pro',
    version: '1.0.0',
    description: '更精致的深色主题，适合夜间创作',
    author: 'SubSilicon',
    category: 'theme',
    icon: 'Moon',
    keywords: ['theme', 'dark', 'style'],
    permissions: ['ui'],
  },
  {
    id: 'ui-minimap',
    name: '画布小地图',
    version: '1.0.0',
    description: '在画布角落显示缩略图，快速导航大型故事',
    author: 'SubSilicon',
    category: 'ui',
    icon: 'Map',
    keywords: ['minimap', 'navigation', 'canvas'],
    permissions: ['ui'],
  },
  {
    id: 'export-json',
    name: 'JSON 导出',
    version: '1.0.0',
    description: '导出故事结构为 JSON，方便与其他工具集成',
    author: 'SubSilicon',
    category: 'export',
    icon: 'Braces',
    keywords: ['json', 'export', 'integration'],
    permissions: ['export'],
  },
]

const STORAGE_KEY = 'subsilicon_installed_plugins'

export function getInstalledPluginIds(): string[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

export function saveInstalledPluginIds(ids: string[]): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
}

export function installPlugin(pluginId: string): boolean {
  const manifest = OFFICIAL_PLUGINS.find((p) => p.id === pluginId)
  if (!manifest) return false

  const installed = getInstalledPluginIds()
  if (installed.includes(pluginId)) return true

  const plugin = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    enabled: true,
    extensions: [],
    hooks: {},
    settings: {},
  }

  pluginManager.register(manifest, {})
  saveInstalledPluginIds([...installed, pluginId])
  return true
}

export function uninstallPlugin(pluginId: string): boolean {
  const installed = getInstalledPluginIds()
  if (!installed.includes(pluginId)) return false

  pluginManager.unregister(pluginId)
  saveInstalledPluginIds(installed.filter((id) => id !== pluginId))
  return true
}

export function isPluginInstalled(pluginId: string): boolean {
  return getInstalledPluginIds().includes(pluginId)
}

export function getAvailablePlugins(category?: string): PluginManifest[] {
  const installed = getInstalledPluginIds()
  let plugins = OFFICIAL_PLUGINS

  if (category) {
    plugins = plugins.filter((p) => p.category === category)
  }

  return plugins.map((p) => ({
    ...p,
    enabled: installed.includes(p.id),
  }))
}

export function getPluginManifest(pluginId: string): PluginManifest | undefined {
  return OFFICIAL_PLUGINS.find((p) => p.id === pluginId)
}