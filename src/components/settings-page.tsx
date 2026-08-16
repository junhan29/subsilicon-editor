import { useEffect, useState } from 'react'
import { Accessibility, ArrowLeft, Cpu, Globe, Info, Key, Monitor, Moon, Sparkles, Sun } from 'lucide-react'
import { Toggle } from '@editor/components/ui/toggle'
import { refreshAiConfig } from '@editor/lib/ai'
import { getDefaultModel, getModelsForProvider } from '@editor/lib/ai/model-presets'
import { decryptAiConfig } from '@editor/lib/ai/ai-key-vault'
import { saveAiConfigEncrypted } from '@editor/lib/ai/ai-config-store'
import { useAccessibilityStore } from '@editor/stores/accessibility-store'
import { type Theme, THEME_LABELS, getCurrentTheme, setTheme, subscribeTheme } from '@editor/lib/theme-manager'
import { DEFAULT_ASSISTANT_NAME, getAssistantName, setAssistantName, useAssistantName } from '@editor/lib/assistant-name'

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
  const [activeSection, setActiveSection] = useState<'general' | 'ai' | 'about' | 'accessibility'>('general')
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

  // 主题状态：跟随全局主题切换
  const [theme, setThemeState] = useState<Theme>(() => getCurrentTheme())
  useEffect(() => {
    const unsub = subscribeTheme((t) => setThemeState(t))
    return unsub
  }, [])

  // 创作助理名字：跟随全局自定义名字变化
  const assistantName = useAssistantName()
  const [nameInput, setNameInput] = useState(() => getAssistantName())

  // ADHD 无障碍设置（zustand persist）
  const lowStimulus = useAccessibilityStore((s) => s.lowStimulus)
  const compactInterface = useAccessibilityStore((s) => s.compactInterface)
  const simpleShortcuts = useAccessibilityStore((s) => s.simpleShortcuts)
  const longFeedback = useAccessibilityStore((s) => s.longFeedback)
  const setLowStimulus = useAccessibilityStore((s) => s.setLowStimulus)
  const setCompactInterface = useAccessibilityStore((s) => s.setCompactInterface)
  const setSimpleShortcuts = useAccessibilityStore((s) => s.setSimpleShortcuts)
  const setLongFeedback = useAccessibilityStore((s) => s.setLongFeedback)

  // 挂载时解密回显 apiKey（落盘为密文，输入框需明文；兼容旧明文数据）
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const saved = localStorage.getItem('subsilicon_ai_config')
        if (!saved) return
        const decrypted = await decryptAiConfig(JSON.parse(saved))
        if (!cancelled) setAiConfig((prev) => ({ ...prev, ...decrypted }))
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [])

  // 保存（落盘前 AES-256 加密全部 apiKey）
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const config = { ...aiConfig, enabled: aiEnabled }
      await saveAiConfigEncrypted(config)
      if (!cancelled) refreshAiConfig()
    })()
    return () => { cancelled = true }
  }, [aiConfig, aiEnabled])

  const updateProvider = (provider: string) => {
    const apiUrls: Record<string, string> = {
      openai: 'https://api.openai.com/v1',
      anthropic: 'https://api.anthropic.com/v1',
      deepseek: 'https://api.deepseek.com/v1',
      google: 'https://generativelanguage.googleapis.com/v1beta/openai',
    }
    const info = apiUrls[provider] || apiUrls.openai
    setAiConfig((prev) => ({ ...prev, provider, apiUrl: info, model: getDefaultModel(provider) }))
  }

  const sections = [
    { id: 'general' as const, label: '通用', icon: Monitor },
    { id: 'ai' as const, label: `${assistantName}服务`, icon: Cpu },
    { id: 'accessibility' as const, label: '无障碍', icon: Accessibility },
    { id: 'about' as const, label: '关于', icon: Info },
  ]

  return (
    <div className="h-screen w-screen bg-[hsl(var(--background))] flex overflow-hidden">
      {/* 左侧导航 */}
      <nav className="w-52 bg-[hsl(var(--background))] border-r border-[hsl(var(--border))] flex flex-col">
        <div className="flex items-center gap-3 px-4 py-4 border-b border-[hsl(var(--border))]">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">设置</h2>
        </div>
        <div className="flex-1 p-2 space-y-0.5">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg transition-colors ${
                activeSection === s.id
                  ? 'bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))]'
              }`}
            >
              <s.icon className="w-4 h-4" />
              {s.label}
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-[hsl(var(--border))]">
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{__APP_NAME__} v{__APP_VERSION__}</p>
        </div>
      </nav>

      {/* 右侧内容 */}
      <div className="flex-1 overflow-y-auto">
        {activeSection === 'general' && (
          <div className="p-6 max-w-2xl space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-4">通用设置</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--card))] border border-[hsl(var(--border))]">
                  <div>
                    <p className="text-xs font-medium text-[hsl(var(--foreground))]">语言</p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">界面显示语言</p>
                  </div>
                  <select
                    className="h-7 text-xs rounded border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-2 text-[hsl(var(--foreground))]"
                    defaultValue="zh-CN"
                  >
                    <option value="zh-CN">简体中文</option>
                    <option value="en" disabled>English (即将支持)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--card))] border border-[hsl(var(--border))]">
                  <div>
                    <p className="text-xs font-medium text-[hsl(var(--foreground))]">主题</p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">编辑器外观主题</p>
                  </div>
                  <select
                    className="h-7 text-xs rounded border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-2 text-[hsl(var(--foreground))]"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as Theme)}
                  >
                    {(Object.keys(THEME_LABELS) as Theme[]).map((t) => (
                      <option key={t} value={t}>{THEME_LABELS[t]}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--card))] border border-[hsl(var(--border))]">
                  <div>
                    <p className="text-xs font-medium text-[hsl(var(--foreground))]">创作助理名字</p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">自定义 AI 创作搭档的名字，全局生效</p>
                  </div>
                  <input
                    value={nameInput}
                    maxLength={20}
                    onChange={(e) => {
                      setNameInput(e.target.value)
                      setAssistantName(e.target.value)
                    }}
                    className="w-40 h-7 text-xs rounded border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-2 text-[hsl(var(--foreground))] text-right"
                    placeholder={DEFAULT_ASSISTANT_NAME}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--card))] border border-[hsl(var(--border))]">
                  <div>
                    <p className="text-xs font-medium text-[hsl(var(--foreground))]">自动保存</p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">编辑时自动保存项目</p>
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
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-amber-500/30 to-cyan-400/30 flex items-center justify-center">
                  <Cpu className="w-3.5 h-3.5 text-amber-300" />
                </div>
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">{assistantName}服务配置</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--card))] border border-[hsl(var(--border))]">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md bg-gradient-to-br from-amber-500/20 to-cyan-400/20 flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[hsl(var(--foreground))]">启用{assistantName}功能</p>
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">开启后可访问{assistantName}故事生成、角色生成等功能</p>
                    </div>
                  </div>
                  <Toggle checked={aiEnabled} onChange={setAiEnabled} />
                </div>

                {aiEnabled && (
                  <>
                    <div className="p-3 rounded-lg bg-[hsl(var(--card))] border border-[hsl(var(--border))] space-y-3">
                      <div className="space-y-2">
                        <label className="text-[10px] text-[hsl(var(--muted-foreground))] font-medium">{assistantName}服务商</label>
                        <select
                          value={aiConfig.provider}
                          onChange={(e) => updateProvider(e.target.value)}
                          className="w-full h-8 text-xs rounded border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-2 text-[hsl(var(--foreground))]"
                        >
                          <option value="openai">OpenAI</option>
                          <option value="anthropic">Anthropic Claude</option>
                          <option value="deepseek">DeepSeek</option>
                          <option value="google">Google Gemini</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-[hsl(var(--muted-foreground))] font-medium">API Key</label>
                        <div className="flex gap-2">
                          <input
                            type={showApiKey ? 'text' : 'password'}
                            value={aiConfig.apiKey}
                            onChange={(e) => setAiConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
                            className="flex-1 h-8 text-xs rounded border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-2 text-[hsl(var(--foreground))]"
                            placeholder="sk-..."
                          />
                          <button
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="px-2 h-8 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] bg-[hsl(var(--secondary))] rounded border border-[hsl(var(--border))] transition-colors"
                          >
                            {showApiKey ? '隐藏' : '显示'}
                          </button>
                        </div>
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))] leading-relaxed">
                          Key 加密存储在本机，不上传服务器。若更换浏览器或屏幕分辨率变化导致无法识别，请重新填写。
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-[hsl(var(--muted-foreground))] font-medium">API 地址</label>
                        <input
                          value={aiConfig.apiUrl}
                          onChange={(e) => setAiConfig((prev) => ({ ...prev, apiUrl: e.target.value }))}
                          className="w-full h-8 text-xs rounded border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-2 text-[hsl(var(--foreground))]"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-[hsl(var(--muted-foreground))] font-medium">模型</label>
                        <select
                          value={aiConfig.model}
                          onChange={(e) => setAiConfig((prev) => ({ ...prev, model: e.target.value }))}
                          className="w-full h-8 text-xs rounded border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-2 text-[hsl(var(--foreground))]"
                        >
                          {getModelsForProvider(aiConfig.provider).map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {activeSection === 'accessibility' && (
          <div className="p-6 max-w-2xl space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-1">无障碍（ADHD 适配）</h3>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mb-4">针对注意力难以集中的使用场景，提供降低干扰的界面选项，全部默认关闭</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--card))] border border-[hsl(var(--border))]">
                  <div>
                    <p className="text-xs font-medium text-[hsl(var(--foreground))]">低干扰模式</p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">减少动画与视觉刺激，让界面更安静</p>
                  </div>
                  <Toggle checked={lowStimulus} onChange={setLowStimulus} />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--card))] border border-[hsl(var(--border))]">
                  <div>
                    <p className="text-xs font-medium text-[hsl(var(--foreground))]">精简界面</p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">折叠右侧面板分组，节点库只显示常用节点</p>
                  </div>
                  <Toggle checked={compactInterface} onChange={setCompactInterface} />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--card))] border border-[hsl(var(--border))]">
                  <div>
                    <p className="text-xs font-medium text-[hsl(var(--foreground))]">基础快捷键</p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">移除单字母快捷键，防止误触添加节点</p>
                  </div>
                  <Toggle checked={simpleShortcuts} onChange={setSimpleShortcuts} />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--card))] border border-[hsl(var(--border))]">
                  <div>
                    <p className="text-xs font-medium text-[hsl(var(--foreground))]">长反馈</p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">提示信息停留更久，并播报更多操作结果</p>
                  </div>
                  <Toggle checked={longFeedback} onChange={setLongFeedback} />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'about' && (
          <div className="p-6 max-w-2xl space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-4">关于 SubSilicon Editor</h3>
              <div className="p-4 rounded-lg bg-[hsl(var(--card))] border border-[hsl(var(--border))] space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[hsl(var(--foreground))]">SubSilicon Editor</p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">v{__APP_VERSION__}</p>
                  </div>
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                  SubSilicon（硅基之下）是一个互动叙事编辑器，
                  支持可视化故事编辑、分支剧情设计、{assistantName}辅助创作等功能。
                </p>
                <div className="text-[10px] text-[hsl(var(--muted-foreground))] space-y-1">
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
