'use client'

import { useEffect, useState } from 'react'
import { Globe, Monitor, Check, X, Info } from 'lucide-react'
import { environment, getFeatureSupport } from '@editor/lib/environment-detector'

interface FeatureItem {
  key: string
  label: string
  description: string
}

const FEATURES: FeatureItem[] = [
  { key: 'fileSystem', label: '本地文件访问', description: '打开/保存本地 .story 文件' },
  { key: 'autoUpdate', label: '自动更新', description: '自动检测并安装应用更新' },
  { key: 'localAI', label: '本地模型', description: '使用 Ollama 运行本地大模型' },
  { key: 'nativeDialogs', label: '原生对话框', description: '系统文件选择器和消息框' },
  { key: 'performanceMonitor', label: '性能监控', description: '内存和 CPU 使用监控' },
]

export function EnvironmentBanner() {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    const hasSeenBanner = localStorage.getItem('subsilicon_env_banner_seen')
    if (!hasSeenBanner && environment.isWeb) {
      setShowBanner(true)
    }
  }, [])

  const handleClose = () => {
    setShowBanner(false)
    localStorage.setItem('subsilicon_env_banner_seen', 'true')
  }

  const handleLearnMore = () => {
    showBanner && setShowBanner(false)
    localStorage.setItem('subsilicon_env_banner_seen', 'true')
  }

  if (!showBanner) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-amber-500/20 px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center gap-3">
        <Globe className="w-5 h-5 text-amber-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-800">
            您正在使用 Web 版编辑器
          </p>
          <p className="text-xs text-amber-600 truncate">
            部分功能在 Web 环境中受限，建议下载桌面版获得完整体验
          </p>
        </div>
        <button
          onClick={handleLearnMore}
          className="px-3 py-1 text-xs bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors"
        >
          了解更多
        </button>
        <button
          onClick={handleClose}
          className="p-1 hover:bg-amber-500/10 rounded transition-colors"
        >
          <X className="w-4 h-4 text-amber-600" />
        </button>
      </div>
    </div>
  )
}

export function FeatureSupportPanel() {
  const support = getFeatureSupport()

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Monitor className="w-5 h-5 text-amber-500" />
        <h3 className="font-medium">环境检测</h3>
      </div>

      <div className="p-3 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          {environment.isElectron ? (
            <>
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium">桌面版 (Electron)</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-sm font-medium">Web 版</span>
            </>
          )}
          {environment.platform !== 'web' && (
            <span className="text-xs text-muted-foreground ml-auto">{environment.platform}</span>
          )}
        </div>

        <div className="space-y-2">
          {FEATURES.map((feature) => {
            const supported = support[feature.key as keyof typeof support]
            return (
              <div
                key={feature.key}
                className="flex items-start gap-2 p-2 rounded-lg"
                style={{
                  backgroundColor: supported ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                }}
              >
                {supported ? (
                  <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                ) : (
                  <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium" style={{ color: supported ? '#22c55e' : '#f87171' }}>
                    {feature.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {feature.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {environment.isWeb && (
          <div className="mt-3 flex items-start gap-2 p-2 bg-amber-500/10 rounded-lg">
            <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-600">
              <p className="font-medium mb-1">建议使用桌面版</p>
              <p className="text-[10px]">
                桌面版支持完整的文件系统访问和本地模型功能
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function useEnvironment() {
  return {
    ...environment,
    features: getFeatureSupport(),
  }
}

export function checkFeatureSupport(feature: keyof ReturnType<typeof getFeatureSupport>): boolean {
  return getFeatureSupport()[feature]
}
