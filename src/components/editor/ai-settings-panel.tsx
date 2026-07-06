'use client'

import { useState, useEffect } from 'react'
import {
  Sparkles, Settings, ChevronDown, ChevronUp, CheckCircle2,
  ExternalLink, Copy, AlertCircle, Loader2, Key, Globe
} from 'lucide-react'
import { Button } from '@editor/components/ui/button'
import { Toggle } from '@editor/components/ui/toggle'
import { showToast } from './toast'

interface AiSettingsPanelProps {
  enabled?: boolean
  onChange: (config: AiConfig) => void
}

export interface AiConfig {
  enabled: boolean
  providers: AiProviderConfig[]
  defaultProvider: string
  autoPolish: boolean
  autoPolishStyle: 'general' | 'vivid' | 'concise' | 'literary'
}

export interface AiProviderConfig {
  id: string
  name: string
  provider: 'openai' | 'anthropic' | 'deepseek' | 'google' | 'custom'
  apiKey: string
  apiUrl?: string
  model: string
  enabled: boolean
}

const PROVIDER_INFO: Record<string, {
  name: string
  website: string
  apiUrl: string
  defaultModel: string
  price: string
  features: string[]
  setupGuide: string[]
}> = {
  openai: {
    name: 'OpenAI',
    website: 'https://platform.openai.com',
    apiUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    price: '$0.15/百万token',
    features: ['GPT-4o', 'GPT-4o-mini', 'DALL·E 3', '语音识别'],
    setupGuide: [
      '访问 https://platform.openai.com 注册账号',
      '登录后进入 API Keys 页面',
      '点击 Create new secret key 创建新密钥',
      '复制密钥（只显示一次，请妥善保存）',
      '粘贴到下方输入框'
    ]
  },
  anthropic: {
    name: 'Anthropic',
    website: 'https://console.anthropic.com',
    apiUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-sonnet-20240229',
    price: '$0.30/百万token',
    features: ['Claude 3.5 Sonnet', 'Claude 3 Opus', '长文本处理'],
    setupGuide: [
      '访问 https://console.anthropic.com 注册账号',
      '登录后进入 API Keys 页面',
      '点击 Create Key 创建新密钥',
      '复制密钥（只显示一次，请妥善保存）',
      '粘贴到下方输入框'
    ]
  },
  deepseek: {
    name: 'DeepSeek',
    website: 'https://platform.deepseek.com',
    apiUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    price: '¥1/百万token',
    features: ['DeepSeek-V3', 'DeepSeek-R1', '中文优化', '高性价比'],
    setupGuide: [
      '访问 https://platform.deepseek.com 注册账号',
      '登录后进入 API Keys 页面',
      '点击创建新密钥',
      '复制密钥并粘贴到下方'
    ]
  },
  google: {
    name: 'Google AI',
    website: 'https://aistudio.google.com',
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.0-flash',
    price: '$0.10/百万token',
    features: ['Gemini 2.0 Flash', 'Gemini 2.5 Pro', '多模态', '长上下文'],
    setupGuide: [
      '访问 https://aistudio.google.com 注册账号',
      '登录后点击 Get API Key',
      '创建或选择一个 Google Cloud 项目',
      '复制 API 密钥并粘贴到下方'
    ]
  },
  custom: {
    name: '自定义',
    website: '',
    apiUrl: '',
    defaultModel: 'gpt-4',
    price: '自定义',
    features: ['兼容 OpenAI 格式', '私有化部署'],
    setupGuide: [
      '准备兼容 OpenAI API 格式的服务',
      '获取 API 密钥',
      '填写 API 基础 URL',
      '填写模型名称',
      '测试连接'
    ]
  }
}

export function AiSettingsPanel({ enabled: initialEnabled, onChange }: AiSettingsPanelProps) {
  const [enabled, setEnabled] = useState(initialEnabled ?? false)
  const [expandedSection, setExpandedSection] = useState('providers')
  const [selectedProvider, setSelectedProvider] = useState<string>('deepseek')
  const [apiKey, setApiKey] = useState('')
  const [apiUrl, setApiUrl] = useState('')
  const [model, setModel] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [providers, setProviders] = useState<AiProviderConfig[]>([])
  const [autoPolish, setAutoPolish] = useState(false)
  const [autoPolishStyle, setAutoPolishStyle] = useState<'general' | 'vivid' | 'concise' | 'literary'>('general')

  useEffect(() => {
    const saved = localStorage.getItem('subsilicon_ai_config')
    if (saved) {
      try {
        const config = JSON.parse(saved) as AiConfig
        setEnabled(config.enabled)
        setProviders(config.providers || [])
        setAutoPolish(config.autoPolish || false)
        setAutoPolishStyle(config.autoPolishStyle || 'general')
      } catch {}
    }
  }, [])

  useEffect(() => {
    const info = PROVIDER_INFO[selectedProvider]
    if (info) {
      setApiUrl(info.apiUrl)
      setModel(info.defaultModel)
    }
  }, [selectedProvider])

  const handleSave = () => {
    const newConfig: AiConfig = {
      enabled,
      providers,
      defaultProvider: selectedProvider,
      autoPolish,
      autoPolishStyle,
    }
    
    if (enabled && apiKey) {
      const newProvider: AiProviderConfig = {
        id: Date.now().toString(),
        name: PROVIDER_INFO[selectedProvider].name,
        provider: selectedProvider as any,
        apiKey,
        apiUrl: apiUrl || PROVIDER_INFO[selectedProvider].apiUrl,
        model,
        enabled: true,
      }
      newConfig.providers = [...providers.filter(p => p.provider !== selectedProvider), newProvider]
      localStorage.setItem('subsilicon_ai_config', JSON.stringify(newConfig))
    }
    
    onChange(newConfig)
    showToast('success', 'AI 设置已保存')
  }

  const handleTestConnection = async () => {
    if (!apiKey) {
      showToast('error', '请先输入 API 密钥')
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      const url = `${apiUrl}/chat/completions`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: '测试连接，请回复"成功"' }],
          max_tokens: 10,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const content = data.choices?.[0]?.message?.content || ''
        if (content.includes('成功')) {
          setTestResult('success')
          showToast('success', 'API 连接测试成功')
        } else {
          setTestResult('error')
          showToast('error', '连接成功但响应异常')
        }
      } else {
        setTestResult('error')
        const text = await response.text()
        showToast('error', '连接失败：' + text.slice(0, 50))
      }
    } catch (error) {
      setTestResult('error')
      showToast('error', '连接失败：' + (error as Error).message)
    } finally {
      setTesting(false)
    }
  }

  const handleCopyApiUrl = () => {
    navigator.clipboard.writeText(apiUrl)
    showToast('success', '已复制 API 地址')
  }

  const handleRemoveProvider = (providerId: string) => {
    const newProviders = providers.filter(p => p.id !== providerId)
    setProviders(newProviders)
    const newConfig: AiConfig = {
      enabled,
      providers: newProviders,
      defaultProvider: selectedProvider,
      autoPolish,
      autoPolishStyle,
    }
    localStorage.setItem('subsilicon_ai_config', JSON.stringify(newConfig))
    onChange(newConfig)
    showToast('success', '已删除服务商配置')
  }

  return (
    <div className="space-y-4">
      {/* 开关 */}
      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <div>
            <p className="font-medium">AI 辅助创作</p>
            <p className="text-xs text-muted-foreground">润色、排版、续写等 AI 功能</p>
          </div>
        </div>
        <Toggle
          checked={enabled}
          onChange={setEnabled}
          color="bg-amber-500"
        />
      </div>

      {enabled && (
        <>
          {/* 服务商选择 */}
          <div className="border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === 'providers' ? '' : 'providers')}
              className="flex items-center justify-between w-full p-4 bg-muted/20 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                <span className="font-medium">选择 AI 服务商</span>
              </div>
              {expandedSection === 'providers' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {expandedSection === 'providers' && (
              <div className="p-4 space-y-4">
                {/* 服务商列表 */}
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(PROVIDER_INFO).map(([key, info]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedProvider(key)}
                      className={`p-3 rounded-lg border transition-colors text-left ${
                        selectedProvider === key
                          ? 'border-amber-500 bg-amber-500/10'
                          : 'border-border hover:border-amber-500/30'
                      }`}
                    >
                      <p className="font-medium text-sm">{info.name}</p>
                      <p className="text-xs text-muted-foreground">{info.price}</p>
                    </button>
                  ))}
                </div>

                {/* 选中服务商详情 */}
                {PROVIDER_INFO[selectedProvider] && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <h4 className="font-medium text-sm">{PROVIDER_INFO[selectedProvider].name}</h4>
                      <a
                        href={PROVIDER_INFO[selectedProvider].website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="w-3 h-3 inline" />
                      </a>
                    </div>
                    
                    <p className="text-xs text-muted-foreground mb-2">核心功能：</p>
                    <div className="flex flex-wrap gap-1">
                      {PROVIDER_INFO[selectedProvider].features.map((feature, i) => (
                        <span key={i} className="px-2 py-0.5 bg-muted rounded text-xs">
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* API 配置 */}
                <div className="space-y-3">
                  {/* API 密钥 */}
                  <div>
                    <label className="text-sm font-medium mb-1 block flex items-center gap-2">
                      <Key className="w-3.5 h-3.5" />
                      API 密钥
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-xxxxxxxxxxxxxxxx"
                        className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 pr-20"
                      />
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
                      >
                        {showApiKey ? <Settings className="w-4 h-4" /> : <Key className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* API 地址 */}
                  {selectedProvider === 'custom' && (
                    <div>
                      <label className="text-sm font-medium mb-1 block">API 基础地址</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={apiUrl}
                          onChange={(e) => setApiUrl(e.target.value)}
                          placeholder="https://api.example.com/v1"
                          className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 pr-20"
                        />
                        <button
                          onClick={handleCopyApiUrl}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 模型选择 */}
                  <div>
                    <label className="text-sm font-medium mb-1 block">模型名称</label>
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="gpt-4o-mini"
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>

                {/* 测试连接 */}
                <Button
                  onClick={handleTestConnection}
                  disabled={testing || !apiKey}
                  className="w-full"
                >
                  {testing ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : testResult === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  ) : testResult === 'error' ? (
                    <AlertCircle className="w-4 h-4 mr-2" />
                  ) : null}
                  {testing ? '测试中...' : testResult === 'success' ? '连接成功' : testResult === 'error' ? '连接失败' : '测试连接'}
                </Button>

                {/* 配置指南 */}
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-xs font-medium text-blue-500 mb-2">配置步骤：</p>
                  <ol className="text-xs text-muted-foreground space-y-1">
                    {PROVIDER_INFO[selectedProvider]?.setupGuide.map((step, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-500 text-[10px] flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
          </div>

          {/* 已配置服务商 */}
          {providers.length > 0 && (
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="p-4 bg-muted/20">
                <p className="font-medium text-sm">已配置服务商</p>
              </div>
              <div className="p-4 space-y-2">
                {providers.map(provider => (
                  <div
                    key={provider.id}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium">{provider.name}</p>
                      <p className="text-xs text-muted-foreground">{provider.model}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveProvider(provider.id)}
                      className="text-xs text-destructive hover:underline"
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 自动润色设置 */}
          <div className="border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === 'auto' ? '' : 'auto')}
              className="flex items-center justify-between w-full p-4 bg-muted/20 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span className="font-medium">自动润色</span>
              </div>
              {expandedSection === 'auto' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {expandedSection === 'auto' && (
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">启用自动润色</span>
                  <Toggle
                    checked={autoPolish}
                    onChange={setAutoPolish}
                    color="bg-primary"
                  />
                </div>

                {autoPolish && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">润色风格</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'general', label: '通用', desc: '流畅自然' },
                        { id: 'vivid', label: '生动', desc: '富有感染力' },
                        { id: 'concise', label: '精简', desc: '简洁有力' },
                        { id: 'literary', label: '文学', desc: '增加文采' },
                      ].map(style => (
                        <button
                          key={style.id}
                          onClick={() => setAutoPolishStyle(style.id as any)}
                          className={`p-2 rounded-lg border transition-colors text-left ${
                            autoPolishStyle === style.id
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-primary/30'
                          }`}
                        >
                          <p className="text-sm font-medium">{style.label}</p>
                          <p className="text-xs text-muted-foreground">{style.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 保存按钮 */}
          <Button
            onClick={handleSave}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            保存 AI 设置
          </Button>

          {/* 提示 */}
          <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
            <p className="font-medium mb-1">注意事项：</p>
            <ul className="space-y-1">
              <li>• API 密钥由您自行管理，平台不会存储或使用您的密钥</li>
              <li>• 使用 AI 功能会产生 API 费用，由服务商直接收取</li>
              <li>• 建议从按量付费开始，根据使用情况调整</li>
              <li>• 密钥丢失后无法找回，请妥善保管在密码管理器中</li>
            </ul>
          </div>
        </>
      )}
    </div>
  )
}