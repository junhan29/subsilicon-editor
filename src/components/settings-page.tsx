import { useState, useEffect } from 'react'
import { ArrowLeft, Sparkles, Key, Globe, Cpu, Sun, Moon, Monitor, Info } from 'lucide-react'
import { Toggle } from '@editor/components/ui/toggle'

interface SettingsPageProps {
  onBack: () => void
}

interface FlatAiConfig {
  enabled: boolean
  provider: string
  apiKey: string
  apiUrl: string
  model: string
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const [activeSection, setActiveSection] = useState<'general' | 'ai' | 'about'>('general')
  const [aiEnabled, setAiEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('subsilicon_ai_config')
      return saved ? JSON.parse(saved).enabled ?? false : false
    } catch { return false }
  })
  const [aiConfig, setAiConfig] = useState<FlatAiConfig>(() => {
    try {
      const saved = localStorage.getItem('subsilicon_ai_config')
      return saved ? JSON.parse(saved) : {
        enabled: false, provider: 'openai', apiKey: '', apiUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini',
      }
    } catch {
      return { enabled: false, provider: 'openai', apiKey: '', apiUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' }
    }
  })
  const [showApiKey, setShowApiKey] = useState(false)

  useEffect(() => {
    const config = { ...aiConfig, enabled: aiEnabled }
    localStorage.setItem('subsilicon_ai_config', JSON.stringify(config))
  }, [aiConfig, aiEnabled])

  const updateProvider = (provider: string) => {
    const defaults: Record<string, { apiUrl: string; model: string }> = {
      openai: { apiUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
      anthropic: { apiUrl: 'https://api.anthropic.com', model: 'claude-3-5-haiku-latest' },
      deepseek: { apiUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
      google: { apiUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.0-flash' },
    }
    const info = defaults[provider] || defaults.openai
    setAiConfig((prev) => ({ ...prev, provider, apiUrl: info.apiUrl, model: info.model }))
  }

  const sections = [
    { id: 'general' as const, label: '通用', icon: Monitor },
    { id: 'ai' as const, label: 'AI 服务', icon: Cpu },
    { id: 'about' as const, label: '关于', icon: Info },
  ]

  return (
    <div className="h-screen w-screen bg-slate-900 flex overflow-hidden">
      {/* 左侧导航 */}
      <nav className="w-52 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-800">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-sm font-semibold text-white">设置</h2>
        </div>
        <div className="flex-1 p-2 space-y-0.5">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg transition-colors ${
                activeSection === s.id
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <s.icon className="w-4 h-4" />
              {s.label}
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-slate-800">
          <p className="text-[10px] text-slate-600">SubSilicon Editor v1.2.2</p>
        </div>
      </nav>

      {/* 右侧内容 */}
      <div className="flex-1 overflow-y-auto">
        {activeSection === 'general' && (
          <div className="p-6 max-w-2xl space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-white mb-4">通用设置</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                  <div>
                    <p className="text-xs font-medium text-white">语言</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">界面显示语言</p>
                  </div>
                  <select
                    className="h-7 text-xs rounded border border-slate-600 bg-slate-700 px-2 text-white"
                    defaultValue="zh-CN"
                  >
                    <option value="zh-CN">简体中文</option>
                    <option value="en" disabled>English (即将支持)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                  <div>
                    <p className="text-xs font-medium text-white">主题</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">编辑器外观主题</p>
                  </div>
                  <select
                    className="h-7 text-xs rounded border border-slate-600 bg-slate-700 px-2 text-white"
                    defaultValue="dark"
                  >
                    <option value="dark">深色</option>
                    <option value="light">浅色</option>
                    <option value="system">跟随系统</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                  <div>
                    <p className="text-xs font-medium text-white">自动保存</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">编辑时自动保存项目</p>
                  </div>
                  <Toggle checked={true} onChange={() => {}} />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'ai' && (
          <div className="p-6 max-w-2xl space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-white mb-4">AI 服务配置</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-purple-400" />
                    <div>
                      <p className="text-xs font-medium text-white">启用 AI 功能</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">开启后可访问 AI 故事生成、角色生成等功能</p>
                    </div>
                  </div>
                  <Toggle checked={aiEnabled} onChange={setAiEnabled} />
                </div>

                {aiEnabled && (
                  <>
                    <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 space-y-3">
                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-400 font-medium">AI 服务商</label>
                        <select
                          value={aiConfig.provider}
                          onChange={(e) => updateProvider(e.target.value)}
                          className="w-full h-8 text-xs rounded border border-slate-600 bg-slate-700 px-2 text-white"
                        >
                          <option value="openai">OpenAI</option>
                          <option value="anthropic">Anthropic Claude</option>
                          <option value="deepseek">DeepSeek</option>
                          <option value="google">Google Gemini</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-400 font-medium">API Key</label>
                        <div className="flex gap-2">
                          <input
                            type={showApiKey ? 'text' : 'password'}
                            value={aiConfig.apiKey}
                            onChange={(e) => setAiConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
                            className="flex-1 h-8 text-xs rounded border border-slate-600 bg-slate-700 px-2 text-white"
                            placeholder="sk-..."
                          />
                          <button
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="px-2 h-8 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 rounded border border-slate-600 transition-colors"
                          >
                            {showApiKey ? '隐藏' : '显示'}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-400 font-medium">API 地址</label>
                        <input
                          value={aiConfig.apiUrl}
                          onChange={(e) => setAiConfig((prev) => ({ ...prev, apiUrl: e.target.value }))}
                          className="w-full h-8 text-xs rounded border border-slate-600 bg-slate-700 px-2 text-white"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-400 font-medium">模型名称</label>
                        <input
                          value={aiConfig.model}
                          onChange={(e) => setAiConfig((prev) => ({ ...prev, model: e.target.value }))}
                          className="w-full h-8 text-xs rounded border border-slate-600 bg-slate-700 px-2 text-white"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {activeSection === 'about' && (
          <div className="p-6 max-w-2xl space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-white mb-4">关于 SubSilicon Editor</h3>
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">SubSilicon Editor</p>
                    <p className="text-[10px] text-slate-400">版本 1.2.2</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  SubSilicon（硅基之下）是一个互动叙事编辑器，
                  支持可视化故事编辑、分支剧情设计、AI 辅助创作等功能。
                </p>
                <div className="text-[10px] text-slate-500 space-y-1">
                  <p>使用技术：React 19 + TypeScript + XYFlow + Vite + Electron</p>
                  <p>数据存储：IndexedDB（本地数据库）</p>
                  <p>项目地址：github.com/junhan29/SubSilicon</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
