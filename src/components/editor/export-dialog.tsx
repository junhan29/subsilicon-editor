'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Download, FileCode, Archive, FileText, BookOpen, Image as ImageIcon, Settings2, Loader2, Languages, Lock, ShieldCheck } from 'lucide-react'
import { Button } from '@editor/components/ui/button'
import type { StoryGraph } from '@editor/types/editor'
import type { MonetizationConfig } from '@editor/lib/work-monetization'
import { exportToHTML } from '@editor/lib/export-html'
import { exportToZIP } from '@editor/lib/export-zip'
import { exportToScript } from '@editor/lib/export-script'
import { exportToEPUB } from '@editor/lib/export-epub'
import { exportToStoryHTML, type StoryExportConfig, type UnlockMode } from '@editor/lib/export-story-html'
import { READER_THEME_PRESETS, themeToCSS, type ReaderTheme } from '@editor/lib/theme-presets'
import { I18nExportPanel } from './i18n-export-panel'
import { SUBMIT_CONFIG } from '@editor/lib/submit-config'
import { showToast } from './toast'
import { trapFocus, focusFirstInteractive, restoreFocus } from '@editor/lib/focus-manager'

type ExportFormat = 'html' | 'zip' | 'script' | 'epub' | 'i18n' | 'story_exec'
type ImageQuality = 'original' | 'high' | 'medium' | 'low'

interface ExportDialogProps {
  open: boolean
  graph: StoryGraph
  onClose: () => void
  onImportTranslation?: (newGraph: StoryGraph) => void
  monetization?: MonetizationConfig | null
}

const FORMATS: { id: ExportFormat; name: string; description: string; icon: typeof FileCode; ext: string }[] = [
  { id: 'html', name: 'HTML 单文件', description: '可直接在浏览器打开', icon: FileCode, ext: '.html' },
  { id: 'zip', name: 'ZIP 包', description: '含 HTML 和资源文件', icon: Archive, ext: '.zip' },
  { id: 'story_exec', name: '可执行故事', description: '加密 + 扫码付费解锁', icon: ShieldCheck, ext: '.story.html' },
  { id: 'script', name: '剧本文本', description: '剧本格式的纯文本', icon: FileText, ext: '.txt' },
  { id: 'epub', name: 'EPUB 电子书', description: '可导入阅读器阅读', icon: BookOpen, ext: '.epub' },
  { id: 'i18n', name: '翻译表', description: '提取文本用于多语言翻译', icon: Languages, ext: '.json/.csv' },
]

const IMAGE_QUALITY_OPTIONS: { id: ImageQuality; label: string; value: number }[] = [
  { id: 'original', label: '原图', value: 0 },
  { id: 'high', label: '高', value: 1 },
  { id: 'medium', label: '中', value: 2 },
  { id: 'low', label: '低', value: 3 },
]

// 文件名安全化
function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || '未命名故事'
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function applyThemeToHTML(html: string, theme: ReaderTheme): string {
  const css = themeToCSS(theme)
  return html.replace('</style>', `${css}\n  </style>`)
}

export function ExportDialog({ open, graph, onClose, onImportTranslation, monetization }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('html')
  const [themeId, setThemeId] = useState<string>(READER_THEME_PRESETS[0].id)
  const [includeAssets, setIncludeAssets] = useState(true)
  const [imageQuality, setImageQuality] = useState<ImageQuality>('high')
  const [includeDebug, setIncludeDebug] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const dialogRef = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef<(() => void) | null>(null)
  const titleId = 'export-dialog-title'
  const descId = 'export-dialog-description'

  const [drmEnabled, setDrmEnabled] = useState(false)
  const [drmPrice, setDrmPrice] = useState<number>(9.9)
  const [drmFreePreview, setDrmFreePreview] = useState<number>(3)
  const [drmUnlockMode, setDrmUnlockMode] = useState<UnlockMode>('semi_auto')
  const [drmWechatQR, setDrmWechatQR] = useState<string>('')
  const [drmAlipayQR, setDrmAlipayQR] = useState<string>('')
  const [drmContact, setDrmContact] = useState<string>('')
  const [drmWebhookUrl, setDrmWebhookUrl] = useState<string>('')
  const [drmWebhookProvider, setDrmWebhookProvider] = useState<string>('stripe')
  const [drmStripeUrl, setDrmStripeUrl] = useState<string>('')
  const [drmPaypalUrl, setDrmPaypalUrl] = useState<string>('')
  const [drmPatreonUrl, setDrmPatreonUrl] = useState<string>('')
  const [drmKofiUrl, setDrmKofiUrl] = useState<string>('')
  const [drmCurrency, setDrmCurrency] = useState<string>('CNY')

  // 从 monetization 配置初始化 DRM 设置
  useEffect(() => {
    if (!monetization) return
    setDrmEnabled(monetization.enabled)
    setDrmPrice(monetization.price || 9.9)
    setDrmWechatQR(monetization.wechatQRCode || '')
    setDrmAlipayQR(monetization.alipayQRCode || '')
    setDrmContact(monetization.wechatContact || monetization.alipayContact || '')
    // 如果有第三方平台配置，提取链接
    if (monetization.thirdParty) {
      if (monetization.thirdParty.platform === 'afdian') setDrmPatreonUrl(monetization.thirdParty.link)
      if (monetization.thirdParty.platform === 'mianbaoduo') setDrmKofiUrl(monetization.thirdParty.link)
    }
  }, [monetization])

  useEffect(() => {
    if (!open) return
    if (dialogRef.current) {
      restoreFocusRef.current = restoreFocus(dialogRef.current)
      focusFirstInteractive(dialogRef.current)
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !exporting) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (restoreFocusRef.current) {
        restoreFocusRef.current()
      }
    }
  }, [open, exporting, onClose])

  useEffect(() => {
    if (!open || !dialogRef.current) return
    const cleanup = trapFocus(dialogRef.current)
    return cleanup
  }, [open])

  const selectedTheme = READER_THEME_PRESETS.find((t) => t.id === themeId) || READER_THEME_PRESETS[0]

  const themeApplicable = format !== 'script' && format !== 'i18n' && format !== 'story_exec'
  const assetsApplicable = format === 'zip' || format === 'epub'
  const isI18nFormat = format === 'i18n'
  const isStoryExecFormat = format === 'story_exec'

  const handleExport = useCallback(async () => {
    if (exporting) return
    setExporting(true)
    setProgress(10)

    try {
      const safeTitle = sanitizeFilename(graph.title || '未命名故事')
      let blob: Blob | null = null
      let filename = ''

      await new Promise((r) => setTimeout(r, 60))
      setProgress(30)

      switch (format) {
        case 'html': {
          let html = await exportToHTML(graph, monetization ?? undefined)
          if (themeApplicable) {
            html = applyThemeToHTML(html, selectedTheme)
          }
          if (includeDebug) {
            const debugInfo = `\n<!-- 调试信息\n节点数: ${graph.nodes?.length || 0}\n连线数: ${graph.edges?.length || 0}\n角色数: ${graph.characters?.length || 0}\n导出时间: ${new Date().toISOString()}\n主题: ${selectedTheme.name}\n图片质量: ${imageQuality}\n付费解锁: ${monetization?.enabled ? '已开启' : '未开启'}\n-->\n`
            html = html.replace('</body>', `${debugInfo}</body>`)
          }
          blob = new Blob([html], { type: 'text/html;charset=utf-8' })
          filename = `${safeTitle}.html`
          break
        }
        case 'zip': {
          blob = await exportToZIP(graph)
          filename = `${safeTitle}.zip`
          break
        }
        case 'script': {
          const text = exportToScript(graph)
          blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
          filename = `${safeTitle}.txt`
          break
        }
        case 'epub': {
          blob = await exportToEPUB(graph)
          filename = `${safeTitle}.epub`
          break
        }
        case 'story_exec': {
          // 根据 monetization 配置确定解锁模式
          let unlockMode: UnlockMode = monetization?.paymentMethod === 'multi' ? 'hybrid' : drmUnlockMode
          if (monetization?.paymentMethod === 'offline') {
            unlockMode = 'offline'
          }
          const storyConfig: StoryExportConfig = {
            unlockMode,
            price: drmEnabled ? drmPrice : 0,
            currency: drmCurrency,
            freePreview: drmFreePreview,
            wechatQRCode: drmWechatQR || undefined,
            alipayQRCode: drmAlipayQR || undefined,
            contactInfo: drmContact || undefined,
            // Webhook 相关
            webhookUrl: drmWebhookUrl || undefined,
            webhookProvider: (drmWebhookProvider as any) || undefined,
            stripeCheckoutUrl: drmStripeUrl || undefined,
            paypalLink: drmPaypalUrl || undefined,
            patreonLink: drmPatreonUrl || undefined,
            kofiLink: drmKofiUrl || undefined,
            // 混合模式配置
            multiChannel: monetization?.multiChannel,
            // 去中心化配置
            customApiUrl: monetization?.customApiUrl,
            offlineCodes: monetization?.offlineCodes?.map(c => ({
              code: c.code,
              maskedKeyBase64: c.maskedKeyBase64,
            })),
          }

          setProgress(50)
          const result = await exportToStoryHTML(graph, storyConfig)
          setProgress(70)

          // 仅在非离线模式下向服务端注册密钥
          if (drmEnabled && result.keyBase64 && unlockMode !== 'offline') {
            try {
              await fetch(SUBMIT_CONFIG.storyUnlockUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'register',
                  workId: result.workId,
                  keyBase64: result.keyBase64,
                  ivBase64: result.ivBase64,
                  unlockMode: drmUnlockMode,
                  price: drmPrice,
                  freePreview: drmFreePreview,
                  submitToken: SUBMIT_CONFIG.submitToken,
                }),
              })
              setProgress(80)
            } catch {
              showToast('info', '密钥上传失败，请检查网络后重试导出')
            }
          } else if (unlockMode === 'offline') {
            setProgress(80)
          }

          blob = new Blob([result.html], { type: 'text/html;charset=utf-8' })
          filename = `${safeTitle}.story.html`
          break
        }
      }

      setProgress(85)
      if (blob) {
        triggerDownload(blob, filename)
        setProgress(100)
        showToast('success', `已导出为 ${filename}`)
        setTimeout(() => {
          setExporting(false)
          setProgress(0)
          onClose()
        }, 800)
      } else {
        throw new Error('生成失败：未产生内容')
      }
    } catch (err) {
      setExporting(false)
      setProgress(0)
      const msg = err instanceof Error ? err.message : String(err)
      showToast('error', `导出失败：${msg}`)
    }
  }, [exporting, format, graph, themeApplicable, selectedTheme, includeDebug, imageQuality, onClose, drmEnabled, drmPrice, drmFreePreview, drmUnlockMode, drmWechatQR, drmAlipayQR, drmContact, drmWebhookUrl, drmWebhookProvider, drmStripeUrl, drmPaypalUrl, drmPatreonUrl, drmKofiUrl, drmCurrency])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-2xl max-h-[90vh] bg-background rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Download className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 id={titleId} className="font-semibold text-sm">导出作品</h3>
              <p id={descId} className="text-[10px] text-muted-foreground">{graph.title || '未命名故事'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={exporting}
            className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-5">
          <section>
            <div className="flex items-center gap-2 mb-2.5">
              <FileCode className="w-3.5 h-3.5 text-muted-foreground" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                导出格式
              </h4>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {FORMATS.map((fmt) => {
                const Icon = fmt.icon
                const isActive = format === fmt.id
                return (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setFormat(fmt.id)}
                    disabled={exporting}
                    className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all disabled:cursor-not-allowed ${
                      isActive
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'border-border hover:border-primary/40 hover:bg-muted/40'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium flex items-center gap-1.5">
                        {fmt.name}
                        <span className="text-[10px] text-muted-foreground font-mono">{fmt.ext}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                {fmt.description}
                {fmt.id === 'html' && monetization?.enabled && (
                  <span className="inline-flex items-center gap-1 ml-2 text-primary">
                    <Lock className="w-3 h-3" />
                    付费
                  </span>
                )}
              </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          {isI18nFormat ? (
            <I18nExportPanel graph={graph} onImport={onImportTranslation} />
          ) : isStoryExecFormat ? (
            <>
          <section>
            <div className="flex items-center gap-2 mb-2.5">
              <Lock className="w-3.5 h-3.5 text-muted-foreground" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                付费与保护设置
              </h4>
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border hover:bg-muted/40 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={drmEnabled}
                  onChange={(e) => setDrmEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-border accent-primary"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">启用付费解锁</div>
                  <div className="text-[11px] text-muted-foreground">
                    关闭则导出免费故事，读者无需付款即可阅读
                  </div>
                </div>
              </label>

              {drmEnabled && (
                <>
                  <div className="p-2.5 rounded-lg border border-border">
                    <div className="text-sm mb-2">作品价格</div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm">¥</span>
                      <input
                        type="number"
                        value={drmPrice}
                        onChange={(e) => setDrmPrice(Math.max(0, Math.min(999, Number(e.target.value))))}
                        min={0}
                        max={999}
                        step={0.01}
                        className="w-24 px-2 py-1.5 rounded border border-border bg-background text-sm text-center"
                      />
                      <span className="text-[11px] text-muted-foreground">元</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg border border-border">
                    <div className="text-sm mb-2">免费试读节点数</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={drmFreePreview}
                        onChange={(e) => setDrmFreePreview(Math.max(0, Math.min(99, Number(e.target.value))))}
                        min={0}
                        max={99}
                        className="w-20 px-2 py-1.5 rounded border border-border bg-background text-sm text-center"
                      />
                      <span className="text-[11px] text-muted-foreground">
                        个节点 · 设为 0 则所有内容均需付费
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg border border-border">
                    <div className="text-sm mb-2">解锁方式</div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setDrmUnlockMode('hybrid')}
                        className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                          drmUnlockMode === 'hybrid'
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                            : 'border-border hover:bg-muted/40'
                        }`}
                      >
                        <div className="font-medium">混合模式</div>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          支持多种收款方式，读者自主选择
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDrmUnlockMode('offline')}
                        className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                          drmUnlockMode === 'offline'
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                            : 'border-border hover:bg-muted/40'
                        }`}
                      >
                        <div className="font-medium">纯离线模式</div>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          预生成解锁码，完全无需服务器
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDrmUnlockMode('webhook')}
                        className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                          drmUnlockMode === 'webhook'
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                            : 'border-border hover:bg-muted/40'
                        }`}
                      >
                        <div className="font-medium">Webhook 自动解锁</div>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          Stripe/PayPal 等海外渠道自动发放解锁码
                        </div>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setDrmUnlockMode('semi_auto')}
                        className={`p-2 rounded-lg border text-left text-xs transition-all ${
                          drmUnlockMode === 'semi_auto'
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                            : 'border-border hover:bg-muted/40'
                        }`}
                      >
                        <div className="font-medium">半自动解锁</div>
                        <div className="text-[10px] text-muted-foreground mt-1">粘贴订单号自动验证</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDrmUnlockMode('manual')}
                        className={`p-2 rounded-lg border text-left text-xs transition-all ${
                          drmUnlockMode === 'manual'
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                            : 'border-border hover:bg-muted/40'
                        }`}
                      >
                        <div className="font-medium">手动激活码</div>
                        <div className="text-[10px] text-muted-foreground mt-1">联系创作者获取激活码</div>
                      </button>
                    </div>
                  </div>

                  {drmUnlockMode !== 'webhook' && (
                    <div className="p-2.5 rounded-lg border border-border">
                      <div className="text-sm mb-2">收款二维码（可选）</div>
                      <div className="text-[11px] text-muted-foreground mb-2">
                        粘贴你个人微信/支付宝收款码的图片 URL，读者的付款直接到你的账户。
                        推荐先在编辑器中导入收款码图片作为素材，然后右键复制图片地址。
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] text-muted-foreground block mb-1">微信收款码 URL</label>
                          <input
                            type="text"
                            value={drmWechatQR}
                            onChange={(e) => setDrmWechatQR(e.target.value)}
                            placeholder="data:image/png;base64,..."
                            className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-muted-foreground block mb-1">支付宝收款码 URL</label>
                          <input
                            type="text"
                            value={drmAlipayQR}
                            onChange={(e) => setDrmAlipayQR(e.target.value)}
                            placeholder="data:image/png;base64,..."
                            className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {drmUnlockMode === 'webhook' && (
                    <>
                      <div className="p-2.5 rounded-lg border border-border">
                        <div className="text-sm mb-2">货币</div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setDrmCurrency('CNY')}
                            className={`px-3 py-1.5 rounded text-xs ${drmCurrency === 'CNY' ? 'bg-primary text-white' : 'bg-muted'}`}
                          >
                            CNY (人民币)
                          </button>
                          <button
                            type="button"
                            onClick={() => setDrmCurrency('USD')}
                            className={`px-3 py-1.5 rounded text-xs ${drmCurrency === 'USD' ? 'bg-primary text-white' : 'bg-muted'}`}
                          >
                            USD (美元)
                          </button>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg border border-border">
                        <div className="text-sm mb-2">付款渠道</div>
                        <div className="grid grid-cols-5 gap-1.5 mb-3">
                          {['stripe', 'paypal', 'patreon', 'kofi', 'custom'].map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setDrmWebhookProvider(p)}
                              className={`py-1.5 px-2 rounded text-[10px] font-medium transition-all ${
                                drmWebhookProvider === p ? 'bg-primary text-white' : 'bg-muted hover:bg-muted/80'
                              }`}
                            >
                              {p === 'stripe' ? 'Stripe' : p === 'paypal' ? 'PayPal' : p === 'patreon' ? 'Patreon' : p === 'kofi' ? 'Ko-fi' : '自定义'}
                            </button>
                          ))}
                        </div>

                        <div className="space-y-2">
                          <div>
                            <label className="text-[11px] text-muted-foreground block mb-1">Webhook 端点 URL</label>
                            <input
                              type="text"
                              value={drmWebhookUrl}
                              onChange={(e) => setDrmWebhookUrl(e.target.value)}
                              placeholder="https://your-server.com/api/unlock"
                              className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                            />
                            <div className="text-[10px] text-muted-foreground mt-1">
                              读者付款后，系统将向此地址 POST 请求以获取解锁码
                            </div>
                          </div>

                          <div>
                            <label className="text-[11px] text-muted-foreground block mb-1">Stripe 结账链接</label>
                            <input
                              type="text"
                              value={drmStripeUrl}
                              onChange={(e) => setDrmStripeUrl(e.target.value)}
                              placeholder="https://buy.stripe.com/..."
                              className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] text-muted-foreground block mb-1">PayPal 付款链接</label>
                            <input
                              type="text"
                              value={drmPaypalUrl}
                              onChange={(e) => setDrmPaypalUrl(e.target.value)}
                              placeholder="https://paypal.me/..."
                              className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] text-muted-foreground block mb-1">Patreon 赞助链接</label>
                            <input
                              type="text"
                              value={drmPatreonUrl}
                              onChange={(e) => setDrmPatreonUrl(e.target.value)}
                              placeholder="https://patreon.com/..."
                              className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] text-muted-foreground block mb-1">Ko-fi 赞助链接</label>
                            <input
                              type="text"
                              value={drmKofiUrl}
                              onChange={(e) => setDrmKofiUrl(e.target.value)}
                              placeholder="https://ko-fi.com/..."
                              className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="p-2.5 rounded-lg border border-border">
                    <div className="text-sm mb-2">联系方式（可选）</div>
                    <input
                      type="text"
                      value={drmContact}
                      onChange={(e) => setDrmContact(e.target.value)}
                      placeholder="微信号：xxx 或 邮箱：xxx@example.com"
                      className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                    />
                    <div className="text-[10px] text-muted-foreground mt-1">
                      将显示在付款页，方便读者在付款遇到问题时联系你
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
            </>
          ) : (
            <>
          <section className={themeApplicable ? '' : 'opacity-40 pointer-events-none'}>
            <div className="flex items-center gap-2 mb-2.5">
              <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                主题皮肤
              </h4>
              {!themeApplicable && (
                <span className="text-[10px] text-muted-foreground ml-auto">剧本文本不适用</span>
              )}
            </div>
            <div className="grid grid-cols-5 gap-2">
              {READER_THEME_PRESETS.map((theme) => {
                const isActive = themeId === theme.id && themeApplicable
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setThemeId(theme.id)}
                    disabled={exporting || !themeApplicable}
                    className={`group relative rounded-lg overflow-hidden border-2 transition-all disabled:cursor-not-allowed ${
                      isActive ? 'border-primary scale-[1.02]' : 'border-border hover:border-primary/50'
                    }`}
                    title={theme.name}
                  >
                    <div
                      className="h-14 px-2 py-1.5 flex flex-col justify-between"
                      style={{ backgroundColor: theme.backgroundColor, color: theme.textColor }}
                    >
                      <div className="text-[9px] font-medium leading-tight truncate">
                        {theme.name}
                      </div>
                      <div className="flex items-center gap-1">
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: theme.primaryColor }}
                        />
                        <span
                          className="text-[8px] truncate leading-none"
                          style={{ color: theme.textColor, opacity: 0.85 }}
                        >
                          Aa 对话
                        </span>
                        <span
                          className="ml-auto inline-block w-1 h-1 rounded-full"
                          style={{ backgroundColor: theme.accentColor }}
                        />
                      </div>
                    </div>
                    {isActive && (
                      <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="4">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
            <div className="text-[11px] text-muted-foreground mt-2">
              当前选择：<span className="font-medium text-foreground">{selectedTheme.name}</span>
              <span className="mx-1.5">·</span>
              对话框风格 {selectedTheme.dialogueBoxStyle}，字号 {selectedTheme.fontSize}px，动画 {selectedTheme.textAnimation}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-2.5">
              <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                导出选项
              </h4>
            </div>
            <div className="space-y-2.5">
              <label
                className={`flex items-center gap-2.5 p-2.5 rounded-lg border border-border hover:bg-muted/40 transition-colors cursor-pointer ${
                  !assetsApplicable ? 'opacity-40 pointer-events-none' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={includeAssets && assetsApplicable}
                  onChange={(e) => setIncludeAssets(e.target.checked)}
                  className="w-4 h-4 rounded border-border accent-primary"
                  disabled={!assetsApplicable}
                />
                <div className="flex-1">
                  <div className="text-sm">包含资源文件</div>
                  <div className="text-[11px] text-muted-foreground">
                    {assetsApplicable ? '导出图片、音频等媒体资源' : '当前格式不支持，仅 ZIP / EPUB 可选'}
                  </div>
                </div>
              </label>

              <div
                className={`p-2.5 rounded-lg border border-border ${
                  !assetsApplicable ? 'opacity-40 pointer-events-none' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <div className="text-sm">压缩图片质量</div>
                    <div className="text-[11px] text-muted-foreground">
                      降低图片体积以加快加载
                    </div>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted">
                    {IMAGE_QUALITY_OPTIONS.find((q) => q.id === imageQuality)?.label}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {IMAGE_QUALITY_OPTIONS.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setImageQuality(q.id)}
                      disabled={!assetsApplicable || exporting}
                      className={`text-xs py-1.5 rounded border transition-all ${
                        imageQuality === q.id
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:bg-muted/40 text-muted-foreground'
                      }`}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border hover:bg-muted/40 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeDebug}
                  onChange={(e) => setIncludeDebug(e.target.checked)}
                  className="w-4 h-4 rounded border-border accent-primary"
                />
                <div className="flex-1">
                  <div className="text-sm">包含调试信息</div>
                  <div className="text-[11px] text-muted-foreground">
                    在 HTML 注释中附加节点数、连线数、导出时间等元数据
                  </div>
                </div>
              </label>
            </div>
          </section>
            </>
          )}
        </div>

        <div className="px-5 py-3.5 border-t bg-muted/20 shrink-0">
          {exporting && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  正在生成导出文件...
                </span>
                <span className="font-mono">{progress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={exporting}
            >
              {isI18nFormat ? '关闭' : '取消'}
            </Button>
            {!isI18nFormat && (
              <Button
                size="sm"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {isStoryExecFormat ? '加密导出中...' : '导出中...'}
                  </>
                ) : (
                  <>
                    {isStoryExecFormat ? <ShieldCheck className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                    {isStoryExecFormat ? '加密导出' : '导出'}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
