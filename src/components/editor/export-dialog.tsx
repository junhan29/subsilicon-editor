'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Archive, BookOpen, Download, FileCode, FileText, Film, Image as ImageIcon, Languages, ListVideo, Loader2, Lock, Monitor, MonitorPlay, PlayCircle, Settings2, ShieldCheck, X } from 'lucide-react'
import { Button } from '@editor/components/ui/button'
import type { StoryGraph } from '@editor/types/editor'
import type { WorkTypeId } from '@editor/types/work'
import type { MonetizationConfig, StoryExportSettings } from '@editor/lib/work-monetization'
import {
  buildOfflineCodesForExport,
  generateOfflineUnlockCodes,
  getOrCreateOfflineKey,
  hydrateOfflineCodesFromLocal,
  hydrateSeedKeyFromLocal,
  loadOfflineCodes,
  loadOfflineKey,
  saveOfflineCodes,
} from '@editor/lib/work-monetization'
import { generateEncryptionKeyBase64 } from '@editor/lib/story-encrypt'
import { getWorkType } from '@editor/lib/work-registry'
import { exportToHTML } from '@editor/lib/export-html'
import { exportToZIP } from '@editor/lib/export-zip'
import { exportToScript } from '@editor/lib/export-script'
import { exportToEPUB } from '@editor/lib/export-epub'
import { type StoryExportConfig, type UnlockMode, exportToStoryHTML } from '@editor/lib/export-story-html'
import { READER_THEME_PRESETS, type ReaderTheme, themeToCSS } from '@editor/lib/theme-presets'
import { I18nExportPanel } from './i18n-export-panel'
import { SUBMIT_CONFIG } from '@editor/lib/submit-config'
import { saveUnlockWorkToken } from '@editor/lib/unlock-request-client'
import { parseAfdianLink } from '@editor/lib/afdian-link'
import { getAccount } from '@editor/lib/local-account-store'
import { showToast } from './toast'
import { useA11yAnnouncer } from './a11y-announcer'
import { focusFirstInteractive, restoreFocus, trapFocus } from '@editor/lib/focus-manager'
import {
  type DesktopAppOptions,
  canBuildDesktopInstaller,
  exportDesktopApp,
} from '@editor/lib/export-desktop-app'
import {
  type BilibiliInteractiveOptions,
  type VideoBinding,
  exportBilibiliInteractive,
} from '@editor/lib/export-bilibili-interactive'

type ExportFormat = 'html' | 'zip' | 'script' | 'epub' | 'i18n' | 'story_exec' | 'desktop_app' | 'bilibili_interactive'
type ImageQuality = 'original' | 'high' | 'medium' | 'low'

/** 离线解锁码默认生成数量（创作者可发放给读者的激活码批次） */
const OFFLINE_CODE_COUNT = 100

interface ExportDialogProps {
  open: boolean
  graph: StoryGraph
  onClose: () => void
  onImportTranslation?: (newGraph: StoryGraph) => void
  monetization?: MonetizationConfig | null
  /** v2.0：作品类型（默认互动叙事，用于按类型过滤导出格式） */
  workType?: WorkTypeId
  /** 作品 id（用于付费配置 workId） */
  workId?: string
  /** 付费设置变更回调：把对话框中的 DRM 配置合并写回作品并随保存持久化 */
  onMonetizationChange?: (config: MonetizationConfig | null) => void
}

const FORMATS: { id: ExportFormat; name: string; description: string; icon: typeof FileCode; ext: string }[] = [
  { id: 'html', name: 'HTML 单文件', description: '可直接在浏览器打开', icon: FileCode, ext: '.html' },
  { id: 'zip', name: 'ZIP 包', description: '含 HTML 和资源文件', icon: Archive, ext: '.zip' },
  { id: 'story_exec', name: '可执行故事', description: '加密 + 扫码付费解锁', icon: ShieldCheck, ext: '.story.html' },
  { id: 'script', name: '剧本文本', description: '剧本格式的纯文本', icon: FileText, ext: '.txt' },
  { id: 'epub', name: 'EPUB 电子书', description: '可导入阅读器阅读', icon: BookOpen, ext: '.epub' },
  { id: 'i18n', name: '翻译表', description: '提取文本用于多语言翻译', icon: Languages, ext: '.json/.csv' },
  { id: 'desktop_app', name: '独立游戏 / 桌面软件', description: '打包为 .dmg / .exe / .AppImage', icon: MonitorPlay, ext: '.zip / 安装包' },
  { id: 'bilibili_interactive', name: 'B 站互动视频 / 伪互动', description: '分 P 配置 CSV + 章节拼接脚本', icon: Film, ext: '.zip' },
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

export function ExportDialog({ open, graph, onClose, onImportTranslation, monetization, workType = 'interactive-narrative', workId, onMonetizationChange }: ExportDialogProps) {
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

  // 无障碍播报（ExportDialog 渲染于 A11yAnnouncer Provider 内；无 Provider 时为空操作）
  const { announce } = useA11yAnnouncer()

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
  const [drmOnlineCodeVerify, setDrmOnlineCodeVerify] = useState(false)
  const [drmInWorkCodeRequest, setDrmInWorkCodeRequest] = useState(false)
  // 第三方平台自动验证（爱发电）：链接 + 自动验证开关 + 开发者凭据（token 敏感，不随作品持久化）
  const [drmAfdianLink, setDrmAfdianLink] = useState<string>('')
  const [drmAfdianAutoVerify, setDrmAfdianAutoVerify] = useState(false)
  const [drmAfdianUserId, setDrmAfdianUserId] = useState<string>('')
  const [drmAfdianToken, setDrmAfdianToken] = useState<string>('')
  const [drmAfdianPlanId, setDrmAfdianPlanId] = useState<string>('')

  // 独立游戏软件（桌面 App）导出
  const [desktopVersion, setDesktopVersion] = useState<string>('1.0.0')
  const [desktopAuthor, setDesktopAuthor] = useState<string>('')
  const [desktopDescription, setDesktopDescription] = useState<string>('')
  const [desktopTargets, setDesktopTargets] = useState<Record<'mac' | 'win' | 'linux' | 'current', boolean>>({
    current: true, mac: false, win: false, linux: false,
  })
  const [desktopBuildLog, setDesktopBuildLog] = useState<Array<{ level: string; msg: string }>>([])

  // B 站互动视频导出
  const [biliMode, setBiliMode] = useState<'interactive' | 'pseudo'>('interactive')
  const [biliDefaultSegSec, setBiliDefaultSegSec] = useState<number>(15)
  const [biliBindings, setBiliBindings] = useState<Record<string, VideoBinding>>(() => {
    return {}
  })
  const [buildLogCollapsed, setBuildLogCollapsed] = useState<boolean>(false)

  // 从 monetization 配置初始化 DRM 设置（含持久化的可执行故事导出配置）
  useEffect(() => {
    if (!monetization) return
    const es = monetization.exportSettings
    setDrmEnabled(monetization.enabled)
    setDrmPrice(monetization.price || 9.9)
    setDrmFreePreview(es?.freePreview ?? 3)
    setDrmUnlockMode(es?.unlockMode || 'semi_auto')
    setDrmWechatQR(monetization.wechatQRCode || '')
    setDrmAlipayQR(monetization.alipayQRCode || '')
    setDrmContact(monetization.wechatContact || monetization.alipayContact || '')
    setDrmWebhookUrl(es?.webhookUrl || '')
    setDrmWebhookProvider(es?.webhookProvider || 'stripe')
    setDrmStripeUrl(es?.stripeCheckoutUrl || '')
    setDrmPaypalUrl(es?.paypalLink || '')
    setDrmPatreonUrl(es?.patreonLink || '')
    setDrmKofiUrl(es?.kofiLink || '')
    setDrmCurrency(es?.currency || 'CNY')
    setDrmOnlineCodeVerify(es?.onlineCodeVerify || false)
    setDrmInWorkCodeRequest(es?.inWorkCodeRequest || false)
    // 第三方平台自动验证（爱发电）：从既有 multiChannel 的 afdian 渠道恢复
    // （token 属敏感凭据不落盘，每次打开留空，导出时由用户重新填写）
    const afdianChannel = monetization.multiChannel?.thirdPartyChannels?.find((c) => c.platform === 'afdian')
    setDrmAfdianLink(afdianChannel?.link || '')
    setDrmAfdianAutoVerify(afdianChannel?.autoVerify || false)
    setDrmAfdianUserId(afdianChannel?.platformUserId || '')
    setDrmAfdianPlanId(afdianChannel?.planId || '')
    // 兼容旧数据：第三方平台链接（未持久化 exportSettings 时的历史字段）
    if (monetization.thirdParty && !es?.patreonLink && !es?.kofiLink) {
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

  // v2.0：按作品类型过滤可用导出格式（互动叙事返回全部既有格式）
  const availableFormats = useMemo(() => {
    const adapter = getWorkType(workType)
    const supported = new Set(adapter.getExportFormats().map((f) => f.id))
    return FORMATS.filter((f) => supported.has(f.id))
  }, [workType])

  // 若当前选中格式被过滤（理论不会发生），回退到第一个
  useEffect(() => {
    if (!availableFormats.some((f) => f.id === format)) {
      setFormat((availableFormats[0]?.id as ExportFormat) || 'html')
    }
  }, [availableFormats, format])

  const themeApplicable = format !== 'script' && format !== 'i18n' && format !== 'story_exec' && format !== 'desktop_app' && format !== 'bilibili_interactive'
  const assetsApplicable = format === 'zip' || format === 'epub'
  const isI18nFormat = format === 'i18n'
  const isStoryExecFormat = format === 'story_exec'
  const isDesktopFormat = format === 'desktop_app'
  const isBiliFormat = format === 'bilibili_interactive'
  const canDirectBuild = canBuildDesktopInstaller()

  const handleExport = useCallback(async () => {
    if (exporting) return
    setExporting(true)
    setProgress(10)

    // 构建合并后的付费配置：所有导出分支统一使用 merged，
    // 避免 HTML 分支仍引用旧 monetization prop 导致本次配置不生效。
    const base = monetization || ({} as MonetizationConfig)
    const exportSettings: StoryExportSettings = {
      unlockMode: drmUnlockMode,
      currency: drmCurrency,
      freePreview: drmFreePreview,
      webhookUrl: drmWebhookUrl.trim() || undefined,
      webhookProvider: drmWebhookProvider,
      stripeCheckoutUrl: drmStripeUrl || undefined,
      paypalLink: drmPaypalUrl || undefined,
      patreonLink: drmPatreonUrl || undefined,
      kofiLink: drmKofiUrl || undefined,
      onlineCodeVerify: drmOnlineCodeVerify,
      inWorkCodeRequest: drmInWorkCodeRequest,
    }
    const merged: MonetizationConfig = {
      ...base,
      enabled: drmEnabled,
      price: drmPrice,
      workId: workId || base.workId || '',
      wechatQRCode: drmWechatQR || undefined,
      alipayQRCode: drmAlipayQR || undefined,
      wechatContact: drmContact || undefined,
      alipayContact: drmContact || undefined,
      customApiUrl: drmWebhookUrl.trim() || base.customApiUrl || undefined,
      paidNodes: base.paidNodes || [],
      granularity: base.granularity || 'whole',
      paymentMethod: drmUnlockMode === 'offline' ? 'offline' : drmUnlockMode === 'hybrid' ? 'multi' : base.paymentMethod || 'wechat_manual',
      exportSettings,
    }
    // 第三方平台自动验证（爱发电）：开启且已填链接时，把 afdian 渠道合并进 multiChannel，
    // 保留既有 manualChannels；token 属敏感凭据不写入作品数据（仅运行时 register 发送）。
    if (drmAfdianAutoVerify && drmAfdianLink.trim()) {
      merged.multiChannel = {
        manualChannels: merged.multiChannel?.manualChannels || [],
        thirdPartyChannels: [
          {
            platform: 'afdian',
            link: drmAfdianLink.trim(),
            autoVerify: true,
            verifyEndpoint: SUBMIT_CONFIG.storyUnlockUrl,
            platformUserId: drmAfdianUserId.trim() || undefined,
            planId: drmAfdianPlanId.trim() || undefined,
          },
        ],
        primaryChannel: merged.multiChannel?.primaryChannel || 'afdian',
      }
    }
    // 把对话框中的 DRM 设置合并写回作品（仅覆盖本对话框可编辑字段，
    // 其余字段如 paidNodes/paidChapters/seedKeyHash 保留原值），
    // 随作品保存持久化——此前设置仅存于对话框本地 state，关闭即丢失。
    if (onMonetizationChange) {
      onMonetizationChange(merged)
    }

    try {
      const safeTitle = sanitizeFilename(graph.title || '未命名故事')
      let blob: Blob | null = null
      let filename = ''

      await new Promise((r) => setTimeout(r, 60))
      setProgress(30)

      switch (format) {
        case 'html': {
          // 作品数据不携带明文 seedKey，导出时从本机 localStorage 恢复；
          // 接收自他人的副本若无本地密钥，将无法签发解锁码（需创作者重新生成）。
          let html = await exportToHTML(graph, merged.enabled ? hydrateSeedKeyFromLocal(merged) : undefined)
          if (themeApplicable) {
            html = applyThemeToHTML(html, selectedTheme)
          }
          if (includeDebug) {
            const debugInfo = `\n<!-- 调试信息\n节点数: ${graph.nodes?.length || 0}\n连线数: ${graph.edges?.length || 0}\n角色数: ${graph.characters?.length || 0}\n导出时间: ${new Date().toISOString()}\n主题: ${selectedTheme.name}\n图片质量: ${imageQuality}\n付费解锁: ${merged.enabled ? '已开启' : '未开启'}\n-->\n`
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
          // 在线验码注册解锁服务需要本地账号邮箱；未登录时直接阻止导出
          const account = getAccount()
          if ((drmOnlineCodeVerify || drmInWorkCodeRequest) && !account) {
            setExporting(false)
            setProgress(0)
            showToast('error', '启用在线验码需先登录创作者账号')
            return
          }
          // 从本机 localStorage 恢复该作品的既有配置（多渠道 / 自定义验证端点）。
          const hydratedMonetization = merged.enabled ? hydrateOfflineCodesFromLocal(merged) : undefined
          // 解锁模式以对话框当前选择为准（drmUnlockMode 从持久化的 exportSettings 恢复，
          // 不随旧数据 paymentMethod 覆盖——旧数据以 drmUnlockMode 为准）
          const unlockMode: UnlockMode = drmUnlockMode
          // 离线解锁码：离线/混合模式下确保本机存在与导出密钥匹配的码。
          // 密钥与码都持久化在创作者本机 localStorage，多次导出复用同一批码，
          // 保证已售出的离线码在后续导出物（重新加密）中依然有效。
          // 导出物只内嵌 codeHash（明文码绝不进入导出文件），读者凭真实码 SHA-256 匹配。
          let offlineCodesForExport: import('@editor/lib/work-monetization').OfflineCodeExportEntry[] | undefined
          let exportKeyBase64: string | undefined
          if (drmEnabled && (unlockMode === 'offline' || unlockMode === 'hybrid' || unlockMode === 'manual')) {
            // manual 模式同样内置离线码：创作者把本机保存的离线码作为激活码发给读者，
            // 读者在「粘贴激活码」处输入即可离线解锁（无需自建服务）。
            const existingCodes = loadOfflineCodes(merged.workId)
            const existingKey = loadOfflineKey(merged.workId)
            if (existingKey && existingCodes.length > 0) {
              exportKeyBase64 = existingKey
              offlineCodesForExport = await buildOfflineCodesForExport(existingCodes)
            } else {
              exportKeyBase64 = getOrCreateOfflineKey(merged.workId, generateEncryptionKeyBase64)
              const codes = await generateOfflineUnlockCodes(OFFLINE_CODE_COUNT, exportKeyBase64)
              saveOfflineCodes(merged.workId, codes)
              offlineCodesForExport = await buildOfflineCodesForExport(codes)
              showToast('info', `已生成 ${codes.length} 个离线解锁码并保存在本机，发放给读者即可离线解锁`)
            }
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
            multiChannel: hydratedMonetization?.multiChannel,
            // 去中心化配置
            customApiUrl: hydratedMonetization?.customApiUrl,
            offlineCodes: offlineCodesForExport,
            keyBase64: exportKeyBase64,
            // 在线验码 / 站内工单验码配置
            onlineCodeVerify: drmOnlineCodeVerify,
            inWorkCodeRequest: drmInWorkCodeRequest,
            creatorEmail: account?.email,
          }

          setProgress(50)
          const result = await exportToStoryHTML(graph, storyConfig)
          setProgress(70)

          // 平台托管解锁（semi_auto/webhook 且未配置自建验证端点）时，把本次导出密钥
          // 注册到平台解锁服务，读者端经该端点验证订单并取回密钥。
          // 已配置 customApiUrl（创作者自建验证服务）或 offline/manual 模式时**不注册**，
          // 密钥仅存本机——确保去中心化：密钥默认不离开创作者设备。
          const usesPlatformUnlock =
            drmEnabled && unlockMode !== 'offline' && unlockMode !== 'manual' && !hydratedMonetization?.customApiUrl
          if ((usesPlatformUnlock || drmOnlineCodeVerify) && result.keyBase64) {
            try {
              const registerBody: Record<string, unknown> = {
                action: 'register',
                workId: result.workId,
                keyBase64: result.keyBase64,
                ivBase64: result.ivBase64,
                unlockMode: drmUnlockMode,
                price: drmPrice,
                freePreview: drmFreePreview,
                creatorEmail: account?.email,
              }
              // 第三方平台自动验证（爱发电）：开发者凭据随 register 提交，服务端据此调用爱发电 API 验证订单
              if (drmAfdianAutoVerify) {
                registerBody.afdian = {
                  userId: drmAfdianUserId.trim() || undefined,
                  token: drmAfdianToken,
                  planId: drmAfdianPlanId.trim() || undefined,
                }
              }
              // 在线验码模式：把本机离线码哈希一并注册到平台，读者凭真实码经平台在线验证
              if (drmOnlineCodeVerify && offlineCodesForExport?.length) {
                registerBody.codeHashes = offlineCodesForExport.map((c) => c.codeHash)
              }
              const res = await fetch(SUBMIT_CONFIG.storyUnlockUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Submit-Token': SUBMIT_CONFIG.submitToken,
                },
                body: JSON.stringify(registerBody),
              })
              if (!res.ok) throw new Error(`register ${res.status}`)
              // 每次注册服务端都会轮换 workToken（旧值失效），保存到本机供发码申请面板按作品归属使用
              const registerData = (await res.json().catch(() => ({}))) as { workToken?: string }
              if (registerData.workToken) {
                saveUnlockWorkToken(result.workId, registerData.workToken)
              }
              setProgress(80)
            } catch {
              showToast('info', '在线解锁服务注册失败，读者将无法在线验码（离线解锁仍可用）')
            }
          } else {
            setProgress(80)
          }

          blob = new Blob([result.html], { type: 'text/html;charset=utf-8' })
          filename = `${safeTitle}.story.html`
          break
        }
        case 'desktop_app': {
          setDesktopBuildLog([])
          const platforms: DesktopAppOptions['platforms'] =
            ((Object.keys(desktopTargets) as Array<keyof typeof desktopTargets>)
              .filter((k) => desktopTargets[k])) as unknown as DesktopAppOptions['platforms']
          const result = await exportDesktopApp(graph, {
            workId: safeTitle,
            workTitle: graph.title || safeTitle,
            version: desktopVersion,
            author: desktopAuthor || undefined,
            description: desktopDescription || undefined,
            monetization: merged.enabled ? hydrateSeedKeyFromLocal(merged) : undefined,
            platforms: (platforms || []).length ? (platforms || ['current']) : ['current'],
            onProgress: (stage, info) => {
              const map = { shell: 20, zip: 40, build: 70, done: 90 } as const
              setProgress(map[stage] ?? 60)
              setDesktopBuildLog((prev) => [...prev, { level: 'info', msg: `[${stage}] ${info || ''}` }].slice(-300))
            },
            onBuildLog: (level, msg) => {
              setDesktopBuildLog((prev) => [...prev, { level, msg }].slice(-300))
            },
          })
          setProgress(95)
          if (result.type === 'shell-zip' && result.zip) {
            blob = result.zip
            filename = result.fileName
          } else if (result.outputs && result.outputs.length) {
            // 已生成安装包到磁盘：打包成一个元信息文件下载（因文件在远程磁盘，浏览器侧拿不到内容；直接 toast）
            const meta = {
              type: 'installers',
              shellDir: result.shellDir,
              files: result.outputs,
              messages: result.messages,
              generatedAt: new Date().toISOString(),
            }
            blob = new Blob([JSON.stringify(meta, null, 2)], { type: 'application/json;charset=utf-8' })
            filename = `${safeTitle}-desktop-installers.json`
          } else {
            const meta = { type: 'error', messages: result.messages, generatedAt: new Date().toISOString() }
            blob = new Blob([JSON.stringify(meta, null, 2)], { type: 'application/json;charset=utf-8' })
            filename = `${safeTitle}-desktop-build-failed.json`
          }
          break
        }
        case 'bilibili_interactive': {
          setProgress(50)
          const bindings = Object.values(biliBindings)
          const result = await exportBilibiliInteractive(graph, {
            workId: safeTitle,
            workTitle: graph.title || safeTitle,
            bindings,
            pseudo: biliMode === 'pseudo',
            defaultSegmentSec: biliDefaultSegSec,
          })
          setProgress(95)
          blob = result.zip
          filename = result.fileName
          if (result.summary.missingBindings.length) {
            showToast(
              'info',
              `仍有 ${result.summary.missingBindings.length} 个节点未绑定视频素材（清单已包含），建议在节点视频素材 Tab 补全后重导出`
            )
          }
          break
        }
      }

      setProgress(85)
      if (blob) {
        triggerDownload(blob, filename)
        setProgress(100)
        showToast('success', `已导出为 ${filename}`)
        announce('作品导出完成')
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
  }, [announce, exporting, format, graph, themeApplicable, selectedTheme, includeDebug, imageQuality, onClose, drmEnabled, drmPrice, drmFreePreview, drmUnlockMode, drmWechatQR, drmAlipayQR, drmContact, drmWebhookUrl, drmWebhookProvider, drmStripeUrl, drmPaypalUrl, drmPatreonUrl, drmKofiUrl, drmCurrency, drmOnlineCodeVerify, drmInWorkCodeRequest, drmAfdianLink, drmAfdianAutoVerify, drmAfdianUserId, drmAfdianToken, drmAfdianPlanId, desktopTargets, desktopVersion, desktopAuthor, desktopDescription, biliMode, biliDefaultSegSec, biliBindings, monetization, workId, onMonetizationChange])

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
              {availableFormats.map((fmt) => {
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
          ) : isDesktopFormat ? (
            <>
              <section>
                <div className="flex items-center gap-2 mb-2.5">
                  <Monitor className="w-3.5 h-3.5 text-muted-foreground" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    桌面作品元信息
                  </h4>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">版本号</label>
                    <input
                      type="text"
                      value={desktopVersion}
                      onChange={(e) => setDesktopVersion(e.target.value)}
                      placeholder="1.0.0"
                      className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">作者（版权页）</label>
                    <input
                      type="text"
                      value={desktopAuthor}
                      onChange={(e) => setDesktopAuthor(e.target.value)}
                      placeholder="可选"
                      className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                    />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="text-[11px] text-muted-foreground block mb-1">作品描述（About / DMG 简介）</label>
                  <textarea
                    value={desktopDescription}
                    onChange={(e) => setDesktopDescription(e.target.value)}
                    rows={2}
                    placeholder="可选"
                    className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs resize-none"
                  />
                </div>
              </section>
              <section>
                <div className="flex items-center gap-2 mb-2.5">
                  <MonitorPlay className="w-3.5 h-3.5 text-muted-foreground" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    打包目标平台
                  </h4>
                </div>
                <div className={`p-2.5 rounded-lg border border-border space-y-2 ${canDirectBuild ? '' : 'opacity-80'}`}>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['current', 'mac', 'win', 'linux'] as const).map((p) => (
                      <label key={p} className={`flex items-center justify-center gap-1.5 py-2 rounded border text-[11px] cursor-pointer transition-colors ${desktopTargets[p] ? 'bg-primary/10 border-primary text-primary' : 'border-border hover:bg-muted/40'}`}>
                        <input
                          type="checkbox"
                          className="w-3.5 h-3.5 accent-primary"
                          checked={desktopTargets[p]}
                          onChange={(e) => setDesktopTargets((s) => ({ ...s, [p]: e.target.checked }))}
                        />
                        <span>
                          {p === 'current' ? '当前系统' : p === 'mac' ? 'macOS' : p === 'win' ? 'Windows' : 'Linux'}
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-relaxed">
                    {canDirectBuild
                      ? '当前环境具备打包能力（SubSilicon Editor Electron 版），导出时会调用 electron-builder 在本机生成安装包，并把生成位置告知。'
                      : '当前为纯前端环境，将生成「壳目录 ZIP」—— 你在本地解压后执行 npm install && npm run dist:xxx（xxx=mac/win/linux） 即可得到安装包。'}
                  </div>
                </div>
              </section>
              {desktopBuildLog.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <ListVideo className="w-3.5 h-3.5 text-muted-foreground" />
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">构建日志</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBuildLogCollapsed((v) => !v)}
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      {buildLogCollapsed ? '展开' : '收起'}
                    </button>
                  </div>
                  {!buildLogCollapsed && (
                    <pre className="max-h-40 overflow-auto rounded-lg border border-border bg-muted/40 p-2 text-[10px] leading-snug font-mono">
                      {desktopBuildLog.map((l, i) => (
                        <div key={i} className={
                          l.level === 'error' ? 'text-rose-600' :
                            l.level === 'warn' ? 'text-amber-600' : 'text-muted-foreground'
                        }>
                          {l.msg}
                        </div>
                      ))}
                    </pre>
                  )}
                </section>
              )}
            </>
          ) : isBiliFormat ? (
            <>
              <section>
                <div className="flex items-center gap-2 mb-2.5">
                  <PlayCircle className="w-3.5 h-3.5 text-muted-foreground" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    B 站发布模式
                  </h4>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setBiliMode('interactive')}
                    className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                      biliMode === 'interactive'
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'border-border hover:bg-muted/40'
                    }`}
                  >
                    <div className="font-medium">互动视频（分 P + 选项跳转）</div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      上传多个分 P → 导入 CSV → B 站播放器自动弹选项，支持真·分支剧情
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBiliMode('pseudo')}
                    className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                      biliMode === 'pseudo'
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'border-border hover:bg-muted/40'
                    }`}
                  >
                    <div className="font-medium">伪互动（单视频 + 章节跳转）</div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      拼成一个视频，简介 / 置顶评论放章节链接，观众手动跳转；适合不想申互动权限的 UP
                    </div>
                  </button>
                </div>
                <div className="p-2.5 rounded-lg border border-border mb-2">
                  <label className="text-[11px] text-muted-foreground block mb-1">
                    默认每段占位时长（秒） · 未单独绑定素材的节点用这个值排期
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={300}
                    value={biliDefaultSegSec}
                    onChange={(e) => setBiliDefaultSegSec(Math.max(3, Math.min(300, Number(e.target.value))))}
                    className="w-24 px-2 py-1.5 rounded border border-border bg-background text-sm text-center"
                  />
                </div>
              </section>
              <section>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Film className="w-3.5 h-3.5 text-muted-foreground" />
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      节点 → 视频素材绑定（共 {graph.nodes?.length || 0} 个节点）
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next: Record<string, VideoBinding> = {}
                      for (const n of graph.nodes || []) {
                        const old = biliBindings[n.id] || {}
                        const data = (n.data || {}) as { title?: string }
                        next[n.id] = {
                          nodeId: n.id,
                          partTitle: old.partTitle || data.title || undefined,
                          durationSec: old.durationSec,
                          assetRef: old.assetRef,
                          popupOffsetSec: old.popupOffsetSec,
                        }
                      }
                      setBiliBindings(next)
                      showToast('info', '已根据图重建绑定表（保留旧值）')
                    }}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    刷新列表
                  </button>
                </div>
                <div className="max-h-72 overflow-auto rounded-lg border border-border divide-y text-[11px]">
                  {(graph.nodes || []).slice(0, 200).map((n, idx) => {
                    const cur = biliBindings[n.id] || { nodeId: n.id }
                    const set = <K extends keyof VideoBinding>(k: K, v: VideoBinding[K]) =>
                      setBiliBindings((s) => ({ ...s, [n.id]: { ...(s[n.id] || { nodeId: n.id }), [k]: v } }))
                    return (
                      <div key={n.id} className="p-2 grid grid-cols-12 gap-1.5 items-center">
                        <div className="col-span-2 text-muted-foreground truncate">#{idx + 1} {n.id.slice(0, 6)}</div>
                        <div className="col-span-4">
                          <input
                            type="text"
                            value={cur.partTitle || ''}
                            onChange={(e) => set('partTitle', e.target.value)}
                            placeholder="分 P 标题（建议 20 字内）"
                            className="w-full px-1.5 py-1 rounded border border-border bg-background text-[11px]"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            value={cur.durationSec == null ? '' : cur.durationSec}
                            onChange={(e) => set('durationSec', e.target.value === '' ? undefined : Math.max(1, Number(e.target.value)))}
                            placeholder="秒"
                            className="w-full px-1.5 py-1 rounded border border-border bg-background text-[11px] text-center"
                          />
                        </div>
                        <div className="col-span-4">
                          <input
                            type="text"
                            value={cur.assetRef || ''}
                            onChange={(e) => set('assetRef', e.target.value)}
                            placeholder="素材路径 / 素材库 ID"
                            className="w-full px-1.5 py-1 rounded border border-border bg-background text-[11px]"
                          />
                        </div>
                      </div>
                    )
                  })}
                  {(graph.nodes?.length || 0) === 0 && (
                    <div className="p-4 text-center text-muted-foreground">暂无节点</div>
                  )}
                  {(graph.nodes?.length || 0) > 200 && (
                    <div className="p-2 text-[11px] text-muted-foreground text-center">
                      节点过多：仅显示前 200，其余节点用默认占位
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                  素材绑定可后续回节点属性面板「视频素材」Tab 精细编辑；导出时未绑定时会自动按节点标题生成默认分 P。
                </p>
              </section>
            </>
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

                  <div className="p-2.5 rounded-lg border border-border">
                    <div className="text-sm mb-2">在线解锁服务</div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2.5 rounded-lg border border-border p-2.5 hover:bg-muted/40 transition-colors cursor-pointer">
                        <input
                          type="checkbox"
                          checked={drmOnlineCodeVerify}
                          onChange={(e) => setDrmOnlineCodeVerify(e.target.checked)}
                          className="w-4 h-4 rounded border-border accent-primary"
                        />
                        <div className="flex-1">
                          <div className="text-sm">在线验码（严格一次一用）</div>
                          <div className="text-[11px] text-muted-foreground">
                            读者需联网验证解锁码，同一码不可跨设备重复使用；未开启则保持纯离线
                          </div>
                        </div>
                      </label>

                      <label className="flex items-center gap-2.5 rounded-lg border border-border p-2.5 hover:bg-muted/40 transition-colors cursor-pointer">
                        <input
                          type="checkbox"
                          checked={drmInWorkCodeRequest}
                          onChange={(e) => setDrmInWorkCodeRequest(e.target.checked)}
                          className="w-4 h-4 rounded border-border accent-primary"
                        />
                        <div className="flex-1">
                          <div className="text-sm">作品内发码申请</div>
                          <div className="text-[11px] text-muted-foreground">
                            读者付款后在作品内申请解锁码，创作者在编辑器创作者中心确认后自动回传解锁
                          </div>
                        </div>
                      </label>

                      {(drmOnlineCodeVerify || drmInWorkCodeRequest) && (
                        <div className="text-[11px] text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-md px-2.5 py-2 leading-relaxed">
                          需要联网使用 SubSilicon 解锁服务；导出时会向服务端注册解锁信息（不含作品内容）。离线码模式仍作为兜底保留
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg border border-border">
                    <div className="text-sm mb-2">第三方平台自动验证（爱发电）</div>
                    <div className="space-y-2">
                      <div>
                        <label className="text-[11px] text-muted-foreground block mb-1">爱发电方案链接</label>
                        <input
                          type="text"
                          value={drmAfdianLink}
                          onChange={(e) => {
                            const value = e.target.value
                            setDrmAfdianLink(value)
                            // 自动提取 userId / planId（保留可编辑：仅在开启开关且解析出值时填充）
                            if (drmAfdianAutoVerify) {
                              const info = parseAfdianLink(value)
                              if (info.userId) setDrmAfdianUserId(info.userId)
                              if (info.planId) setDrmAfdianPlanId(info.planId)
                            }
                          }}
                          placeholder="https://afdian.com/a/你的主页"
                          className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                        />
                      </div>

                      <label className="flex items-center gap-2.5 rounded-lg border border-border p-2.5 hover:bg-muted/40 transition-colors cursor-pointer">
                        <input
                          type="checkbox"
                          checked={drmAfdianAutoVerify}
                          onChange={(e) => setDrmAfdianAutoVerify(e.target.checked)}
                          className="w-4 h-4 rounded border-border accent-primary"
                        />
                        <div className="flex-1">
                          <div className="text-sm">自动验证订单</div>
                          <div className="text-[11px] text-muted-foreground">
                            读者在爱发电下单后输入订单号即可自动解锁，无需你手动发码
                          </div>
                        </div>
                      </label>

                      {drmAfdianAutoVerify && (
                        <div className="space-y-2">
                          <div>
                            <label className="text-[11px] text-muted-foreground block mb-1">爱发电开发者 user_id</label>
                            <input
                              type="text"
                              value={drmAfdianUserId}
                              onChange={(e) => setDrmAfdianUserId(e.target.value)}
                              placeholder="如 8d6f5a9c3e21"
                              className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-muted-foreground block mb-1">爱发电开发者 token</label>
                            <input
                              type="password"
                              value={drmAfdianToken}
                              onChange={(e) => setDrmAfdianToken(e.target.value)}
                              placeholder="仅用于导出时注册验证服务，不随作品保存"
                              className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-muted-foreground block mb-1">方案 ID（自动提取，可修改）</label>
                            <input
                              type="text"
                              value={drmAfdianPlanId}
                              onChange={(e) => setDrmAfdianPlanId(e.target.value)}
                              placeholder="如 plan_xxxxxx"
                              className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                            />
                          </div>
                          <div className="text-[11px] text-muted-foreground leading-relaxed">
                            在爱发电 → 开发者中心获取 user_id 和 token（用于服务端验证订单，不会随作品发布）
                          </div>
                        </div>
                      )}
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
