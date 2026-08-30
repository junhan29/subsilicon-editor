import { useEffect, useState } from 'react'
import { Accessibility, ArrowLeft, Cpu, Globe, Info, Key, Monitor, Moon, Sparkles, Sun } from 'lucide-react'
import { Toggle } from '@editor/components/ui/toggle'
import { refreshAiConfig } from '@editor/lib/ai'
import { getGlobalStylePrompt, saveGlobalStylePrompt } from '@editor/lib/ai/services/media-generation-service'
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

  // 全局画面风格（一致性锁）：生成图片/视频时统一注入
  const [styleInput, setStyleInput] = useState(() => getGlobalStylePrompt())

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
    <div className="h-screen w-screen bg-background flex overflow-hidden">
      {/* 左侧导航 - P5剪贴风面板 */}
      <nav className="w-52 bg-background border-r border-border flex flex-col relative">
        {/* 订书钉装饰 - 顶部 */}
        <div className="absolute top-0 left-5 w-5 h-1.5 bg-slate-400/60 rounded-b-[1px] z-20 shadow-[0_1px_0_rgba(0,0,0,0.15)]" />
        <div className="absolute top-0 right-4 w-5 h-1.5 bg-slate-400/60 rounded-b-[1px] z-20 shadow-[0_1px_0_rgba(0,0,0,0.15)]" />

        <div className="flex items-center gap-3 px-4 py-4 border-b border-border relative">
          <button
            onClick={onBack}
            className="p-1.5 rounded-[2px] hover:bg-gold-400/15 text-muted-foreground hover:text-foreground transition-all hover:shadow-[2px_2px_0_hsl(var(--gold)/0.25)] border border-transparent hover:border-gold-400/30"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={2.2} />
          </button>
          <h2 className="text-sm font-bold text-foreground tracking-wider">设置</h2>
          {/* 印章贴纸 */}
          <div className="absolute -top-2 right-6 rotate-[10deg] z-10">
            <span className="text-[9px] font-black px-1.5 py-0.5 border border-p5-red/60 bg-p5-red/10 text-p5-red tracking-tighter">
              SETUP
            </span>
          </div>
        </div>
        <div className="flex-1 p-2.5 space-y-1">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-[2px] transition-all ${
                activeSection === s.id
                  ? 'bg-gold-400/15 text-foreground font-bold tracking-wide border border-gold-400/40 shadow-[3px_3px_0_hsl(var(--gold)/0.22)]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-gold-400/8 border border-dashed border-transparent hover:border-gold-400/25'
              }`}
            >
              <s.icon className="w-4 h-4" strokeWidth={2} />
              {s.label}
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-border">
          <p className="text-[10px] font-medium text-muted-foreground bg-gold-400/10 border border-gold-400/30 rounded-[2px] px-2 py-1 tracking-tight inline-block">
            {__APP_NAME__} v{__APP_VERSION__}
          </p>
        </div>
      </nav>

      {/* 右侧内容 - P5剪贴卡片区 */}
      <div className="flex-1 overflow-y-auto relative">
        {/* 半调网点装饰 - 右上 */}
        <div className="absolute top-4 right-6 w-16 h-16 opacity-[0.08] pointer-events-none z-0"
          style={{
            backgroundImage: 'radial-gradient(hsl(var(--gold)) 1px, transparent 1px)',
            backgroundSize: '6px 6px',
          }}
        />

        {activeSection === 'general' && (
          <div className="p-6 max-w-2xl space-y-6 relative z-10">
            <div>
              {/* 节标题 + 贴纸装饰 */}
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-[2px] bg-gold-400/15 border border-gold-400/35 flex items-center justify-center shadow-[2px_2px_0_hsl(var(--gold)/0.2)]">
                  <Globe className="w-4 h-4 text-gold-500" strokeWidth={2} />
                </div>
                <h3 className="text-sm font-bold text-foreground tracking-wider">通用设置</h3>
                <div className="rotate-[6deg] ml-1">
                  <span className="text-[9px] font-black px-1.5 py-0.5 border border-cyber-cyan-400/50 bg-cyber-cyan-400/10 text-cyber-cyan-500 tracking-tighter">
                    BASIC
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                {/* 语言卡片 - 小斜切角硬阴影 */}
                <div className="flex items-center justify-between p-3 rounded-[2px] bg-card border border-border
                  clip-path-polygon-[0_0,calc(100%-10px)_0,100%_10px,100%_100%,0_100%]
                  shadow-[3px_3px_0_hsl(var(--gold)/0.15)]">
                  <div>
                    <p className="text-xs font-semibold text-foreground">语言</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">界面显示语言</p>
                  </div>
                  <select
                    className="h-8 text-xs rounded-[2px] border border-border bg-input px-2 text-foreground focus:outline-none focus:border-gold-400 shadow-[1px_1px_0_hsl(var(--gold)/0.1)] disabled:opacity-60"
                    defaultValue="zh-CN"
                    disabled
                    title="当前仅支持简体中文"
                  >
                    <option value="zh-CN">简体中文</option>
                    <option value="en" disabled>English (即将支持)</option>
                  </select>
                </div>

                {/* 主题容器 */}
                <div className="p-4 rounded-[2px] bg-card border border-border shadow-[4px_4px_0_hsl(var(--gold)/0.18)]">
                  <div className="mb-3">
                    <div className="flex items-center gap-1.5">
                      <Sun className="w-3.5 h-3.5 text-gold-500" />
                      <Moon className="w-3.5 h-3.5 text-cyber-cyan-500" />
                      <p className="text-xs font-bold text-foreground tracking-wide">主题</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">编辑器外观风格 — 选择一套你喜欢的视觉</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {(Object.keys(THEME_LABELS) as Theme[]).map((t, idx) => {
                      const active = theme === t
                      const palette = (() => {
                        if (t === 'dark') {
                          return {
                            bg: 'linear-gradient(135deg, hsl(0 0% 5%) 0%, hsl(0 0% 10%) 100%)',
                            accent1: 'hsl(0 84% 47%)',
                            accent2: 'hsl(43 90% 54%)',
                            accent3: 'hsl(180 100% 50%)',
                            text: 'hsl(0 0% 96%)',
                            border: active ? 'hsl(43 90% 54%)' : 'hsl(0 0% 18%)',
                          }
                        }
                        if (t === 'sepia') {
                          return {
                            bg: 'linear-gradient(135deg, hsl(25 15% 94%) 0%, hsl(25 20% 88%) 100%)',
                            accent1: 'hsl(25 40% 30%)',
                            accent2: 'hsl(30 50% 50%)',
                            accent3: 'hsl(25 30% 45%)',
                            text: 'hsl(25 20% 15%)',
                            border: active ? 'hsl(30 50% 50%)' : 'hsl(25 20% 78%)',
                          }
                        }
                        return {
                          bg: 'linear-gradient(135deg, hsl(0 0% 97%) 0%, hsl(0 0% 100%) 100%)',
                          accent1: 'hsl(0 84% 47%)',
                          accent2: 'hsl(43 90% 54%)',
                          accent3: 'hsl(0 0% 45%)',
                          text: 'hsl(0 0% 6%)',
                          border: active ? 'hsl(0 84% 47%)' : 'hsl(0 0% 82%)',
                        }
                      })()
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTheme(t)}
                          className={`group relative text-left rounded-lg overflow-hidden transition-all ${
                            active
                              ? 'shadow-[4px_4px_0_hsl(var(--primary)/0.35)] scale-[1.02]'
                              : 'hover:-translate-y-0.5 hover:shadow-[3px_3px_0_hsl(var(--primary)/0.25)]'
                          }`}
                          style={{
                            background: palette.bg,
                            border: `2px solid ${palette.border}`,
                          }}
                        >
                          {/* 预览：模拟编辑器色块布局 */}
                          <div className="aspect-[4/3] p-2 relative">
                            {/* 半调网点装饰 */}
                            {t === 'dark' && (
                              <div className="absolute inset-0 halftone-bg opacity-30 pointer-events-none" />
                            )}
                            {t === 'sepia' && (
                              <div className="absolute inset-0 halftone-bg-gold opacity-30 pointer-events-none" />
                            )}
                            {/* 顶部斜切装饰（模拟 P5 剪贴） */}
                            <div
                              className="absolute top-0 right-0 w-4 h-4"
                              style={{
                                background:
                                  `linear-gradient(135deg, transparent 50%, ${palette.accent1} 50%)`,
                              }}
                            />
                            {/* 左栏色块 */}
                            <div
                              className="w-1/3 h-full rounded-sm opacity-90"
                              style={{ background: palette.accent1 + '22', border: `1px solid ${palette.accent1}55` }}
                            >
                              <div
                                className="mt-1.5 mx-1 h-1.5 rounded-sm"
                                style={{ background: palette.accent2 }}
                              />
                              <div
                                className="mt-1 mx-1 h-1.5 rounded-sm"
                                style={{ background: palette.accent3, opacity: 0.7 }}
                              />
                              <div
                                className="mt-1 mx-1 h-1.5 rounded-sm"
                                style={{ background: palette.accent3, opacity: 0.4 }}
                              />
                            </div>
                          </div>
                          {/* 底部标签 */}
                          <div
                            className="px-2 py-1.5 text-[10px] font-bold tracking-wide border-t flex items-center justify-between"
                            style={{
                              background: active ? palette.accent1 + '15' : 'transparent',
                              borderColor: palette.border,
                              color: palette.text,
                            }}
                          >
                            <span className="truncate">{THEME_LABELS[t]}</span>
                            {active && (
                              <span
                                className="w-4 h-4 rounded-full flex items-center justify-center text-[9px]"
                                style={{ background: palette.accent2, color: '#000' }}
                              >
                                ✓
                              </span>
                            )}
                          </div>
                          {/* 激活时的印章标签 */}
                          {active && (
                            <div className="absolute -top-1.5 -right-1.5 rotate-[8deg]">
                              <span className="inline-block text-[9px] font-black px-1.5 py-0.5 border"
                                style={{
                                  background: palette.accent2 + '22',
                                  borderColor: palette.accent2,
                                  color: palette.accent1 === palette.accent2 ? palette.accent1 : palette.accent2,
                                }}
                              >
                                IN USE
                              </span>
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 创作助理名字卡片 */}
                <div className="flex items-center justify-between p-3 rounded-[2px] bg-card border border-border
                  clip-path-polygon-[0_0,calc(100%-10px)_0,100%_10px,100%_100%,0_100%]
                  shadow-[3px_3px_0_hsl(var(--gold)/0.15)]">
                  <div>
                    <p className="text-xs font-semibold text-foreground">创作助理名字</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">自定义 AI 创作搭档的名字，全局生效</p>
                  </div>
                  <input
                    value={nameInput}
                    maxLength={20}
                    onChange={(e) => {
                      setNameInput(e.target.value)
                      setAssistantName(e.target.value)
                    }}
                    className="w-40 h-8 text-xs rounded-[2px] border border-border bg-input px-2 text-foreground text-right focus:outline-none focus:border-gold-400 shadow-[1px_1px_0_hsl(var(--gold)/0.1)]"
                    placeholder={DEFAULT_ASSISTANT_NAME}
                  />
                </div>

                {/* 自动保存卡片 */}
                <div className="flex items-center justify-between p-3 rounded-[2px] bg-card border border-border
                  clip-path-polygon-[0_0,calc(100%-10px)_0,100%_10px,100%_100%,0_100%]
                  shadow-[3px_3px_0_hsl(var(--gold)/0.15)]">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-[2px] bg-gold-400/12 border border-gold-400/25 flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5 text-gold-500" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">自动保存</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">编辑时自动保存项目</p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 bg-gold-400/12 border border-gold-400/25 text-gold-500 rounded-[2px] font-semibold">已开启</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'ai' && (
          <div className="p-6 max-w-2xl space-y-6 relative z-10">
            <div>
              {/* AI节标题 + 赛博青印章贴纸 */}
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-[2px] bg-cyber-cyan-400/15 border border-cyber-cyan-400/40 flex items-center justify-center shadow-[2px_2px_0_hsl(var(--cyber-cyan)/0.2)]">
                  <Cpu className="w-4 h-4 text-cyber-cyan-500" strokeWidth={2} />
                </div>
                <h3 className="text-sm font-bold text-foreground tracking-wider">{assistantName}服务配置</h3>
                <div className="rotate-[-5deg] ml-1">
                  <span className="text-[9px] font-black px-1.5 py-0.5 border border-cyber-magenta-400/50 bg-cyber-magenta-400/10 text-cyber-magenta-500 tracking-tighter">
                    BYOK
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                {/* 启用AI卡片 - 金色系（主开关） */}
                <div className="flex items-center justify-between p-3 rounded-[2px] bg-card border border-border
                  clip-path-polygon-[0_0,calc(100%-10px)_0,100%_10px,100%_100%,0_100%]
                  shadow-[3px_3px_0_hsl(var(--gold)/0.15)]">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-[2px] bg-gold-400/15 border border-gold-400/30 flex items-center justify-center shadow-[1px_1px_0_hsl(var(--gold)/0.15)]">
                      <Sparkles className="w-3.5 h-3.5 text-gold-500" strokeWidth={2} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">启用{assistantName}功能</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">开启后可访问{assistantName}故事生成、角色生成等功能</p>
                    </div>
                  </div>
                  <Toggle checked={aiEnabled} onChange={setAiEnabled} />
                </div>

                {aiEnabled && (
                  <>
                    {/* AI配置大容器 - 赛博青硬阴影标识AI区块 */}
                    <div className="p-4 rounded-[2px] bg-card border border-border
                      clip-path-polygon-[0_0,calc(100%-12px)_0,100%_12px,100%_100%,0_100%]
                      shadow-[4px_4px_0_hsl(var(--cyber-cyan)/0.18)] space-y-3.5">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-muted-foreground font-semibold tracking-wide">{assistantName}服务商</label>
                        <select
                          value={aiConfig.provider}
                          onChange={(e) => updateProvider(e.target.value)}
                          className="w-full h-8 text-xs rounded-[2px] border border-border bg-input px-2 text-foreground focus:outline-none focus:border-cyber-cyan-400 shadow-[1px_1px_0_hsl(var(--cyber-cyan)/0.1)]"
                        >
                          <option value="openai">OpenAI</option>
                          <option value="anthropic">Anthropic Claude</option>
                          <option value="deepseek">DeepSeek</option>
                          <option value="google">Google Gemini</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <Key className="w-3 h-3 text-cyber-cyan-500" />
                          <label className="text-[10px] text-muted-foreground font-semibold tracking-wide">API Key</label>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type={showApiKey ? 'text' : 'password'}
                            value={aiConfig.apiKey}
                            onChange={(e) => setAiConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
                            className="flex-1 h-8 text-xs rounded-[2px] border border-border bg-input px-2 text-foreground focus:outline-none focus:border-cyber-cyan-400 shadow-[1px_1px_0_hsl(var(--cyber-cyan)/0.1)] font-mono"
                            placeholder="sk-..."
                          />
                          <button
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="px-2.5 h-8 text-xs text-muted-foreground hover:text-foreground bg-secondary rounded-[2px] border border-border transition-colors shadow-[1px_1px_0_hsl(var(--cyber-cyan)/0.08)] hover:border-cyber-cyan-400/30"
                          >
                            {showApiKey ? '隐藏' : '显示'}
                          </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          Key 加密存储在本机，不上传服务器。若更换浏览器或屏幕分辨率变化导致无法识别，请重新填写。
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] text-muted-foreground font-semibold tracking-wide">API 地址</label>
                        <input
                          value={aiConfig.apiUrl}
                          onChange={(e) => setAiConfig((prev) => ({ ...prev, apiUrl: e.target.value }))}
                          className="w-full h-8 text-xs rounded-[2px] border border-border bg-input px-2 text-foreground focus:outline-none focus:border-cyber-cyan-400 shadow-[1px_1px_0_hsl(var(--cyber-cyan)/0.1)] font-mono"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] text-muted-foreground font-semibold tracking-wide">模型</label>
                        <select
                          value={aiConfig.model}
                          onChange={(e) => setAiConfig((prev) => ({ ...prev, model: e.target.value }))}
                          className="w-full h-8 text-xs rounded-[2px] border border-border bg-input px-2 text-foreground focus:outline-none focus:border-cyber-cyan-400 shadow-[1px_1px_0_hsl(var(--cyber-cyan)/0.1)]"
                        >
                          {getModelsForProvider(aiConfig.provider).map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] text-muted-foreground font-semibold tracking-wide">全局画面风格（一致性锁）</label>
                        <textarea
                          value={styleInput}
                          onChange={(e) => {
                            setStyleInput(e.target.value)
                            saveGlobalStylePrompt(e.target.value)
                          }}
                          placeholder="如：赛博朋克城市夜景，霓虹灯，蓝紫调，电影级光影，高细节"
                          className="w-full h-16 text-xs rounded-[2px] border border-border bg-input px-2 py-1.5 text-foreground resize-none focus:outline-none focus:border-cyber-cyan-400 shadow-[2px_2px_0_hsl(var(--cyber-cyan)/0.1)] leading-relaxed"
                        />
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          生成图片/视频时自动注入该风格描述，让整部作品的画面风格保持一致。留空则不注入。
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {activeSection === 'accessibility' && (
          <div className="p-6 max-w-2xl space-y-6 relative z-10">
            <div>
              {/* 无障碍节标题 + P5红贴纸 */}
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-[2px] bg-p5-red/15 border border-p5-red/35 flex items-center justify-center shadow-[2px_2px_0_hsl(var(--p5-red)/0.2)]">
                  <Accessibility className="w-4 h-4 text-p5-red" strokeWidth={2} />
                </div>
                <h3 className="text-sm font-bold text-foreground tracking-wider">无障碍（ADHD 适配）</h3>
                <div className="rotate-[7deg] ml-1">
                  <span className="text-[9px] font-black px-1.5 py-0.5 border border-p5-red/60 bg-p5-red/10 text-p5-red tracking-tighter">
                    A11Y
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mb-4 ml-9">针对注意力难以集中的使用场景，提供降低干扰的界面选项，全部默认关闭</p>
              <div className="space-y-3">
                {[
                  { key: 'low', label: '低干扰模式', desc: '减少动画与视觉刺激，让界面更安静', value: lowStimulus, setter: setLowStimulus },
                  { key: 'compact', label: '精简界面', desc: '折叠右侧面板分组，节点库只显示常用节点', value: compactInterface, setter: setCompactInterface },
                  { key: 'simple', label: '基础快捷键', desc: '移除单字母快捷键，防止误触添加节点', value: simpleShortcuts, setter: setSimpleShortcuts },
                  { key: 'long', label: '长反馈', desc: '提示信息停留更久，并播报更多操作结果', value: longFeedback, setter: setLongFeedback },
                ].map((item) => (
                  <div key={item.key}
                    className="flex items-center justify-between p-3 rounded-[2px] bg-card border border-border
                      clip-path-polygon-[0_0,calc(100%-10px)_0,100%_10px,100%_100%,0_100%]
                      shadow-[3px_3px_0_hsl(var(--p5-red)/0.12)]">
                    <div>
                      <p className="text-xs font-semibold text-foreground">{item.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                    <Toggle checked={item.value} onChange={item.setter} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeSection === 'about' && (
          <div className="p-6 max-w-2xl space-y-6 relative z-10">
            <div>
              {/* 关于节标题 */}
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-[2px] bg-gold-400/15 border border-gold-400/35 flex items-center justify-center shadow-[2px_2px_0_hsl(var(--gold)/0.2)]">
                  <Info className="w-4 h-4 text-gold-500" strokeWidth={2} />
                </div>
                <h3 className="text-sm font-bold text-foreground tracking-wider">关于 SubSilicon Editor</h3>
                <div className="rotate-[-6deg] ml-1">
                  <span className="text-[9px] font-black px-1.5 py-0.5 border border-gold-400/60 bg-gold-400/15 text-gold-600 dark:text-gold-500 tracking-tighter">
                    ABOUT
                  </span>
                </div>
              </div>
              <div className="p-4 rounded-[2px] bg-card border border-border
                clip-path-polygon-[0_0,calc(100%-14px)_0,100%_14px,100%_100%,0_100%]
                shadow-[5px_5px_0_hsl(var(--gold)/0.22)] space-y-3.5">
                <div className="flex items-center gap-3">
                  {/* Logo容器 - 金边斜切角硬阴影 */}
                  <div className="w-12 h-12 rounded-[2px] clip-path-polygon-[0_0,75%_0,100%_25%,100%_100%,0_100%]
                    bg-gradient-to-br from-p5-red via-p5-red to-gold-500 border-2 border-gold-400
                    flex items-center justify-center shadow-[3px_3px_0_hsl(var(--p5-red)/0.3)]">
                    <Sparkles className="w-6 h-6 text-white" strokeWidth={2.2} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground tracking-wide">SubSilicon Editor</p>
                    <p className="text-[10px] font-medium text-muted-foreground bg-gold-400/10 border border-gold-400/30 rounded-[2px] px-1.5 py-0.5 mt-1 inline-block">
                      v{__APP_VERSION__}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-foreground/80 leading-relaxed">
                  SubSilicon（硅基之下）是一个互动叙事编辑器，
                  支持可视化故事编辑、分支剧情设计、{assistantName}辅助创作等功能。
                </p>
                <div className="text-[10px] text-muted-foreground space-y-1 border-t border-border pt-3">
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
