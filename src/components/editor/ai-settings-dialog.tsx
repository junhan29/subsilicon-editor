'use client'

import { useState, useEffect } from 'react'
import { X, Key, Globe, Cpu, CheckCircle2, Loader2, ExternalLink } from 'lucide-react'
import { showToast } from './toast'

interface AiSettingsDialogProps {
  open: boolean
  onClose: () => void
}

interface FlatAiConfig {
  enabled: boolean
  provider: string
  apiKey: string
  apiUrl: string
  model: string
}

const PROVIDER_INFO: Record<string, {
  name: string
  website: string
  apiUrl: string
  defaultModel: string
}> = {
  openai: { name: 'OpenAI', website: 'https://platform.openai.com', apiUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
  anthropic: { name: 'Anthropic', website: 'https://console.anthropic.com', apiUrl: 'https://api.anthropic.com', defaultModel: 'claude-3-5-haiku-latest' },
  deepseek: { name: 'DeepSeek', website: 'https://platform.deepseek.com', apiUrl: 'https://api.deepseek.com', defaultModel: 'deepseek-chat' },
  google: { name: 'Google AI', website: 'https://aistudio.google.com', apiUrl: 'https://generativelanguage.googleapis.com/v1beta', defaultModel: 'gemini-2.0-flash' },
}

export function AiSettingsDialog({ open, onClose }: AiSettingsDialogProps) {
  const [aiEnabled, setAiEnabled] = useState(false)
  const [aiConfig, setAiConfig] = useState<FlatAiConfig>({
    enabled: false,
    provider: 'openai',
    apiKey: '',
    apiUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  })
  const [showApiKey, setShowApiKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    if (open) {
      try {
        const saved = localStorage.getItem('subsilicon_ai_config')
        if (saved) {
          const parsed = JSON.parse(saved)
          setAiEnabled(parsed.enabled ?? false)
          setAiConfig(parsed)
        }
      } catch {
        // ignore
      }
    }
  }, [open])

  const updateProvider = (provider: string) => {
    const info = PROVIDER_INFO[provider]
    setAiConfig((prev) => ({
      ...prev,
      provider,
      apiUrl: info.apiUrl,
      model: info.defaultModel,
    }))
    setTestResult(null)
  }

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const resp = await fetch(aiConfig.apiUrl + '/models', {
        headers: { Authorization: `Bearer ${aiConfig.apiKey}` },
      })
      if (resp.ok) {
        setTestResult({ ok: true, message: '连接成功' })
      } else {
        setTestResult({ ok: false, message: `连接失败 (${resp.status})` })
      }
    } catch {
      setTestResult({ ok: false, message: '无法连接到 API 地址' })
    }
    setTesting(false)
  }

  const handleSave = () => {
    const config = { ...aiConfig, enabled: aiEnabled }
    localStorage.setItem('subsilicon_ai_config', JSON.stringify(config))
    showToast('success', 'AI 设置已保存')
    onClose()
  }

  const currentProvider = PROVIDER_INFO[aiConfig.provider]

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl w-full max-w-md border border-slate-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-pink-400" />
            <h3 className="text-sm font-semibold text-white">AI 服务设置</h3>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-full hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-white">启用 AI</p>
              <p className="text-[10px] text-slate-500">开启后将使用 AI 辅助创作</p>
            </div>
            <button
              onClick={() => setAiEnabled(!aiEnabled)}
              className={`w-10 h-5 rounded-full transition-colors ${
                aiEnabled ? 'bg-pink-500' : 'bg-slate-600'
              }`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                aiEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {aiEnabled && (
            <>
              {/* Provider */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">服务商</label>
                <select
                  value={aiConfig.provider}
                  onChange={(e) => updateProvider(e.target.value)}
                  className="w-full h-8 text-xs rounded border border-slate-600 bg-slate-700 px-2 text-white"
                >
                  {Object.entries(PROVIDER_INFO).map(([key, info]) => (
                    <option key={key} value={key}>{info.name}</option>
                  ))}
                </select>
                {currentProvider && (
                  <a
                    href={currentProvider.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-pink-400 hover:text-pink-300"
                  >
                    <ExternalLink className="w-3 h-3" />
                    访问 {currentProvider.name} 官网
                  </a>
                )}
              </div>

              {/* API Key */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">API Key</label>
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={aiConfig.apiKey}
                      onChange={(e) => {
                        setAiConfig((prev) => ({ ...prev, apiKey: e.target.value }))
                        setTestResult(null)
                      }}
                      placeholder="sk-..."
                      className="w-full h-8 text-xs rounded border border-slate-600 bg-slate-700 px-2 pr-16 text-white"
                    />
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-200"
                    >
                      {showApiKey ? '隐藏' : '显示'}
                    </button>
                  </div>
                </div>
              </div>

              {/* API URL */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">API 地址</label>
                <div className="flex gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-2" />
                  <input
                    value={aiConfig.apiUrl}
                    onChange={(e) => {
                      setAiConfig((prev) => ({ ...prev, apiUrl: e.target.value }))
                      setTestResult(null)
                    }}
                    className="flex-1 h-8 text-xs rounded border border-slate-600 bg-slate-700 px-2 text-white"
                  />
                </div>
              </div>

              {/* Model */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">模型名称</label>
                <input
                  value={aiConfig.model}
                  onChange={(e) => {
                    setAiConfig((prev) => ({ ...prev, model: e.target.value }))
                    setTestResult(null)
                  }}
                  className="w-full h-8 text-xs rounded border border-slate-600 bg-slate-700 px-2 text-white"
                />
              </div>

              {/* Test Connection */}
              <div className="flex items-center gap-2">
                <button
                  onClick={testConnection}
                  disabled={testing || !aiConfig.apiKey}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded transition-colors disabled:opacity-50"
                >
                  {testing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Globe className="w-3 h-3" />
                  )}
                  测试连接
                </button>
                {testResult && (
                  <span className={`text-xs flex items-center gap-1 ${
                    testResult.ok ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {testResult.ok && <CheckCircle2 className="w-3 h-3" />}
                    {testResult.message}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-xs bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 rounded transition-colors"
          >
            保存设置
          </button>
        </div>
      </div>
    </div>
  )
}