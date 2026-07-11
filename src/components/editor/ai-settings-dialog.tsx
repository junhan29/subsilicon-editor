'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Sparkles, X, CheckCircle2, Globe, Key, Copy,
  ExternalLink, Loader2, AlertCircle, Trash2, ChevronDown, ChevronUp
} from 'lucide-react'
import { Button } from '@editor/components/ui/button'
import { showToast } from './toast'
import {
  loadAiConfig,
  saveAiConfig,
  testConnection,
  PROVIDER_PRESETS,
  type AiConfig,
  type AiProviderConfig,
  type AiProviderType,
} from '@editor/lib/ai-client'

interface AiSettingsDialogProps {
  open: boolean
  onClose: () => void
}

export function AiSettingsDialog({ open, onClose }: AiSettingsDialogProps) {
  const [config, setConfig] = useState<AiConfig>({ enabled: false, providers: [], defaultProviderId: '' })
  const [selectedProvider, setSelectedProvider] = useState<AiProviderType>('aliyun')
  const [apiKey, setApiKey] = useState('')
  const [apiUrl, setApiUrl] = useState('')
  const [model, setModel] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [expandedSection, setExpandedSection] = useState('providers')

  useEffect(() => {
    if (open) {
      loadAiConfig().then((c) => {
        setConfig(c)
        if (c.providers.length > 0) {
          const p = c.providers[0]
          setSelectedProvider(p.provider)
          setApiUrl(p.apiUrl)
          setModel(p.model)
        }
      })
    }
  }, [open])

  useEffect(() => {
    const preset = PROVIDER_PRESETS[selectedProvider]
    if (preset && selectedProvider !== 'custom') {
      setApiUrl(preset.apiUrl)
      setModel(preset.defaultModel)
    }
  }, [selectedProvider])

  const handleSaveProvider = useCallback(async () => {
    if (!apiKey.trim()) {
      showToast('error', '请输入 API 密钥')
      return
    }
    const preset = PROVIDER_PRESETS[selectedProvider]
    const newProvider: AiProviderConfig = {
      id: `provider-${Date.now()}`,
      name: preset.name,
      provider: selectedProvider,
      apiKey: apiKey.trim(),
      apiUrl: apiUrl.trim() || preset.apiUrl,
      model: model.trim() || preset.defaultModel,
      enabled: true,
    }
    const existing = config.providers.filter((p) => p.provider !== selectedProvider)
    const newConfig: AiConfig = {
      ...config,
      enabled: true,
      providers: [...existing, newProvider],
      defaultProviderId: newProvider.id,
    }
    await saveAiConfig(newConfig)
    setConfig(newConfig)
    showToast('success', 'AI 设置已保存')
  }, [apiKey, apiUrl, model, selectedProvider, config])

  const handleTestConnection = useCallback(async () => {
    if (!apiKey.trim()) {
      showToast('error', '请先输入 API 密钥')
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const preset = PROVIDER_PRESETS[selectedProvider]
      const ok = await testConnection({
        id: 'test',
        name: preset.name,
        provider: selectedProvider,
        apiKey: apiKey.trim(),
        apiUrl: apiUrl.trim() || preset.apiUrl,
        model: model.trim() || preset.defaultModel,
        enabled: true,
      })
      setTestResult(ok ? 'success' : 'error')
      if (ok) {
        showToast('success', '连接测试成功')
      } else {
        showToast('error', '连接测试失败')
      }
    } catch (error) {
      setTestResult('error')
      showToast('error', (error as Error).message)
    } finally {
      setTesting(false)
    }
  }, [apiKey, apiUrl, model, selectedProvider])

  const handleRemoveProvider = useCallback(async (providerId: string) => {
    const newProviders = config.providers.filter((p) => p.id !== providerId)
    const newConfig: AiConfig = {
      ...config,
      providers: newProviders,
      defaultProviderId: newProviders[0]?.id || '',
      enabled: newProviders.length > 0,
    }
    await saveAiConfig(newConfig)
    setConfig(newConfig)
    showToast('success', '已删除配置')
  }, [config])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-background rounded-xl shadow-2xl border">
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-background z-10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-medium">AI 辅助创作设置</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              AI 功能需要您自行配置 API 密钥。所有密钥本地加密存储，平台不会获取或使用您的密钥。
            </p>
          </div>

          <div className="border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === 'providers' ? '' : 'providers')}
              className="flex items-center justify-between w-full p-4 bg-muted/20 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                <span className="font-medium text-sm">添加 AI 服务商</span>
              </div>
              {expandedSection === 'providers' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {expandedSection === 'providers' && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(PROVIDER_PRESETS) as [AiProviderType, typeof PROVIDER_PRESETS.openai][]).map(([key, info]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedProvider(key)}
                      className={`p-2.5 rounded-lg border transition-colors text-left ${
                        selectedProvider === key
                          ? 'border-amber-500 bg-amber-500/10'
                          : 'border-border hover:border-amber-500/30'
                      }`}
                    >
                      <p className="font-medium text-xs">{info.name}</p>
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium mb-1 flex items-center gap-1">
                      <Key className="w-3.5 h-3.5" />
                      API 密钥
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-xxxxxxxxxxxxxxxx"
                        className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 pr-16"
                      />
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
                      >
                        {showApiKey ? <Key className="w-4 h-4" /> : <Key className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {selectedProvider === 'custom' && (
                    <div>
                      <label className="text-xs font-medium mb-1 block">API 地址</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={apiUrl}
                          onChange={(e) => setApiUrl(e.target.value)}
                          placeholder="https://api.example.com/v1"
                          className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 pr-16"
                        />
                        <button
                          onClick={() => { navigator.clipboard.writeText(apiUrl); showToast('success', '已复制') }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-medium mb-1 block">模型名称</label>
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="模型名"
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleTestConnection} disabled={testing || !apiKey} className="flex-1" variant="outline">
                    {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      : testResult === 'success' ? <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                      : testResult === 'error' ? <AlertCircle className="w-4 h-4 mr-2 text-red-500" />
                      : null}
                    {testing ? '测试中...' : testResult === 'success' ? '连接成功' : testResult === 'error' ? '连接失败' : '测试连接'}
                  </Button>
                  <Button onClick={handleSaveProvider} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white">
                    保存配置
                  </Button>
                </div>
              </div>
            )}
          </div>

          {config.providers.length > 0 && (
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="p-4 bg-muted/20">
                <p className="font-medium text-sm">已配置服务商</p>
              </div>
              <div className="p-3 space-y-2">
                {config.providers.map((provider) => (
                  <div
                    key={provider.id}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium">{provider.name}</p>
                      <p className="text-xs text-muted-foreground">{provider.model}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {config.defaultProviderId === provider.id && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">
                          默认
                        </span>
                      )}
                      <button
                        onClick={() => handleRemoveProvider(provider.id)}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-[11px] text-muted-foreground space-y-1">
            <p>• API 密钥使用 AES-256 加密存储在本地</p>
            <p>• 使用 AI 功能产生的费用由服务商直接收取</p>
            <p>• 建议开启按量付费，根据使用量调整</p>
          </div>
        </div>
      </div>
    </div>
  )
}
