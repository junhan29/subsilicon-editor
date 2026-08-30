'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  FileText,
  Home,
  Image as ImageIcon,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MessagesSquare,
  Pencil,
  Plus,
  Send,
  Server,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react'
import type { StoryGraph } from '@editor/types/editor'
import type {
  PlatformConfig,
  PublishPlatform,
  PublishRecord,
} from '@editor/types/creator'
import {
  addPlatformConfig,
  getPlatformConfigs,
  getPublishRecords,
  publishToPlatform,
  removePlatformConfig,
  updatePlatformConfig,
} from '@editor/lib/creator-service'
import type { LocalAccount } from '@editor/lib/local-account-store'
import { getAccount, isLoggedIn, login, logout, register } from '@editor/lib/local-account-store'
import { exportPreviewHTML } from '@editor/lib/export-preview-html'
import { UnlockCodeGenerator } from './unlock-code-generator'
import { UnlockRequestsPanel } from './unlock-requests-panel'
import { showToast } from './toast'

interface CreatorCenterDialogProps {
  open: boolean
  onClose: () => void
  graph: StoryGraph
  workId?: string
  initialTab?: 'account' | 'platforms' | 'publish' | 'records' | 'unlock' | 'unlock-requests'
  /** 预填发布表单的作品标题（可选，未传则回退到 graph.title） */
  initialTitle?: string
  /** 预填发布表单的作品简介（可选） */
  initialSummary?: string
  onLoginStateChange?: () => void
}

const PRESET_TAGS = ['古风', '悬疑', '科幻', '恋爱', '恐怖', '冒险', '治愈', '搞笑']

const MAX_SUMMARY_LENGTH = 100
const MAX_SCREENSHOTS = 6
const MAX_TITLE_LENGTH = 60
const MAX_COVER_SIZE = 5 * 1024 * 1024
const MAX_SCREENSHOT_SIZE = 2 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

const SUBSILICON_PLATFORM_ID = 'subsilicon'
const SUBSILICON_DEFAULT_NAME = 'SubSilicon 自由集市'
const SUBSILICON_DEFAULT_API = 'https://subsilicon.cn/api/creator/preview/submit'
const SUBSILICON_DEFAULT_DESC = '官方自由集市，审核通过后展示给所有用户'
// 与 submit-config.ts 的 storyUnlockUrl 判定写法保持一致：开发环境指向本地服务端便于联调
const SUBMIT_TOKEN_ORIGIN = (import.meta as any).env?.DEV ? 'http://localhost:3000' : 'https://subsilicon.cn'

type Tab = 'account' | 'platforms' | 'publish' | 'records' | 'unlock' | 'unlock-requests'
type AccountTab = 'login' | 'register'

type PlatformConfigWithPlatform = PlatformConfig & { platform?: PublishPlatform }

const STATUS_META: Record<PublishRecord['status'], { label: string; className: string }> = {
  pending: { label: '待审核', className: 'text-gold-400 bg-gold-400/10 border-gold-400/30' },
  approved: { label: '已通过', className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  rejected: { label: '已拒绝', className: 'text-red-400 bg-primary/10 border-primary/30' },
  published: { label: '已发布', className: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
}

const TAB_ITEMS: { id: Tab; label: string; icon: typeof User }[] = [
  { id: 'account', label: '账号管理', icon: User },
  { id: 'platforms', label: '平台管理', icon: Server },
  { id: 'publish', label: '发布作品', icon: Send },
  { id: 'records', label: '发布记录', icon: FileText },
  { id: 'unlock', label: '解锁码', icon: Lock },
  { id: 'unlock-requests', label: '发码申请', icon: MessagesSquare },
]

const inputClass =
  'w-full px-3 py-2 text-sm bg-muted border border-border rounded-[2px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold-400/60 focus:ring-1 focus:ring-gold-400/30'
const iconInputClass =
  'w-full pl-9 pr-3 py-2 text-sm bg-muted border border-border rounded-[2px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold-400/60'
const labelClass = 'flex items-center gap-1.5 text-xs font-medium text-foreground mb-1.5'
const errorTextClass = 'mt-1 text-[11px] text-red-400 flex items-center gap-1'

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(ts)
  }
}

export function CreatorCenterDialog({
  open,
  onClose,
  graph,
  workId,
  initialTab,
  initialTitle,
  initialSummary,
  onLoginStateChange,
}: CreatorCenterDialogProps) {
  const [tab, setTab] = useState<Tab>('account')

  const [guideDismissed, setGuideDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('subsilicon_creator_center_guide_dismissed') === 'true'
    } catch {
      return false
    }
  })

  const [account, setAccount] = useState<Omit<LocalAccount, 'passwordHash'> | null>(getAccount())
  const [accountTab, setAccountTab] = useState<AccountTab>('login')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirm, setRegConfirm] = useState('')
  const [regDisplayName, setRegDisplayName] = useState('')
  const [regBio, setRegBio] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [accountSubmitting, setAccountSubmitting] = useState(false)
  const [accountError, setAccountError] = useState('')

  const [platforms, setPlatforms] = useState<PlatformConfigWithPlatform[]>([])
  const [showPlatformForm, setShowPlatformForm] = useState(false)
  const [editingPlatform, setEditingPlatform] = useState<PlatformConfigWithPlatform | null>(null)
  const [platformForm, setPlatformForm] = useState({
    isBuiltin: true,
    name: SUBSILICON_DEFAULT_NAME,
    apiUrl: SUBSILICON_DEFAULT_API,
    submitToken: '',
    submitTokenKey: 'X-Submit-Token',
    description: SUBSILICON_DEFAULT_DESC,
    enabled: true,
    platformUsername: '',
    platformPassword: '',
  })
  const [platformSubmitting, setPlatformSubmitting] = useState(false)

  const [showTokenDialog, setShowTokenDialog] = useState(false)
  const [tokenTab, setTokenTab] = useState<'login' | 'register'>('login')
  const [tokenEmail, setTokenEmail] = useState('')
  const [tokenPassword, setTokenPassword] = useState('')
  const [tokenDisplayName, setTokenDisplayName] = useState('')
  const [tokenSubmitting, setTokenSubmitting] = useState(false)
  const [tokenError, setTokenError] = useState('')
  const [showTokenPassword, setShowTokenPassword] = useState(false)

  const [selectedPlatformId, setSelectedPlatformId] = useState('')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [customTagInput, setCustomTagInput] = useState('')
  const [wechat, setWechat] = useState('')
  const [afdianLink, setAfdianLink] = useState('')
  const [coverImage, setCoverImage] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState('')
  const [screenshots, setScreenshots] = useState<{ file: File; preview: string }[]>([])
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [records, setRecords] = useState<PublishRecord[]>([])
  const [platformToDelete, setPlatformToDelete] = useState<PlatformConfigWithPlatform | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const screenshotsInputRef = useRef<HTMLInputElement>(null)
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showRegPassword, setShowRegPassword] = useState(false)
  const [showRegConfirm, setShowRegConfirm] = useState(false)
  const [showPlatformPassword, setShowPlatformPassword] = useState(false)

  const loadPlatforms = async (ownerEmail?: string) => {
    try {
      // 账号双轨统一：平台配置归属当前登录的本地账号邮箱
      const list = await getPlatformConfigs(ownerEmail)
      setPlatforms(list)
      setSelectedPlatformId((prev) => {
        if (prev && list.some((p) => p.id === prev && p.enabled)) return prev
        const firstEnabled = list.find((p) => p.enabled)
        return firstEnabled?.id || ''
      })
    } catch {
      setPlatforms([])
    }
  }

  const loadRecords = async (ownerEmail?: string) => {
    try {
      // 账号双轨统一：发布记录归属当前登录的本地账号邮箱
      const list = await getPublishRecords(undefined, ownerEmail)
      setRecords(list)
    } catch {
      setRecords([])
    }
  }

  useEffect(() => {
    if (!open) return
    setTab(initialTab || 'account')
    // 账号双轨统一：登录态复用本地账户（local-account-store）
    const acc = isLoggedIn() ? getAccount() : null
    setAccount(acc)
    setAccountTab('login')
    setRegEmail('')
    setRegPassword('')
    setRegConfirm('')
    setRegDisplayName('')
    setRegBio('')
    setLoginEmail('')
    setLoginPassword('')
    setAccountError('')
    setShowPlatformForm(false)
    setEditingPlatform(null)
    setShowPlatformPassword(false)
    setShowTokenDialog(false)
    setTokenTab('login')
    setTokenEmail('')
    setTokenPassword('')
    setTokenDisplayName('')
    setTokenError('')
    setShowTokenPassword(false)
    setShowLoginPassword(false)
    setShowRegPassword(false)
    setShowRegConfirm(false)
    setPlatformToDelete(null)
    setTitle(initialTitle ?? (graph.title || ''))
    setSummary(initialSummary ?? '')
    setTags([])
    setCustomTagInput('')
    setWechat('')
    setAfdianLink('')
    setCoverImage(null)
    setCoverPreview('')
    setScreenshots([])
    setPublished(false)
    setErrors({})
    setSelectedPlatformId('')
    loadPlatforms(acc?.email)
    loadRecords(acc?.email)
  }, [open, initialTab, graph, initialTitle, initialSummary])

  // 预填作品标题/简介：首次打开或 prop 变化时填入，但仅在当前值为空时生效，
  // 避免覆盖用户在发布表单里已输入的内容
  useEffect(() => {
    if (!open) return
    if (initialTitle) setTitle((prev) => (prev === '' ? initialTitle : prev))
    if (initialSummary) setSummary((prev) => (prev === '' ? initialSummary : prev))
  }, [open, initialTitle, initialSummary])

  const busy = publishing || accountSubmitting || platformSubmitting

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, busy, onClose])

  const handleRegister = async () => {
    setAccountError('')
    if (!regEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) {
      setAccountError('请输入正确的邮箱地址')
      return
    }
    if (regPassword.length < 8) {
      setAccountError('密码至少 8 位')
      return
    }
    if (!/[a-zA-Z]/.test(regPassword) || !/[0-9]/.test(regPassword)) {
      setAccountError('密码必须包含字母和数字')
      return
    }
    if (regPassword !== regConfirm) {
      setAccountError('两次密码不一致')
      return
    }
    if (!regDisplayName.trim()) {
      setAccountError('请输入显示名称')
      return
    }
    setAccountSubmitting(true)
    try {
      const result = await register(regEmail, regPassword, regDisplayName, regBio)
      if (!result.success) {
        setAccountError(result.error || '注册失败')
        return
      }
      setAccount(getAccount())
      onLoginStateChange?.()
      showToast('success', '注册成功')
    } catch (e) {
      setAccountError(e instanceof Error ? e.message : '注册失败')
    } finally {
      setAccountSubmitting(false)
    }
  }

  const handleLogin = async () => {
    setAccountError('')
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setAccountError('请填写邮箱和密码')
      return
    }
    setAccountSubmitting(true)
    try {
      const result = await login(loginEmail, loginPassword)
      if (!result.success) {
        setAccountError(result.error || '登录失败')
        return
      }
      setAccount(result.account || getAccount())
      onLoginStateChange?.()
      showToast('success', `欢迎回来，${result.account?.displayName || ''}`)
    } catch (e) {
      setAccountError(e instanceof Error ? e.message : '登录失败')
    } finally {
      setAccountSubmitting(false)
    }
  }

  const handleLogout = () => {
    logout()
    setAccount(null)
    onLoginStateChange?.()
    showToast('info', '已退出登录')
  }

  const startAddPlatform = () => {
    setEditingPlatform(null)
    setPlatformForm({
      isBuiltin: true,
      name: SUBSILICON_DEFAULT_NAME,
      apiUrl: SUBSILICON_DEFAULT_API,
      submitToken: '',
      submitTokenKey: 'X-Submit-Token',
      description: SUBSILICON_DEFAULT_DESC,
      enabled: true,
      platformUsername: '',
      platformPassword: '',
    })
    setShowPlatformForm(true)
  }

  const startEditPlatform = (config: PlatformConfigWithPlatform) => {
    setEditingPlatform(config)
    setPlatformForm({
      isBuiltin: config.platformId === SUBSILICON_PLATFORM_ID,
      name: config.name,
      apiUrl: config.config.apiUrl || (config.platformId === SUBSILICON_PLATFORM_ID ? SUBSILICON_DEFAULT_API : ''),
      submitToken: config.config.submitToken || '',
      submitTokenKey: config.config.submitTokenKey || (config.platformId === SUBSILICON_PLATFORM_ID ? 'X-Submit-Token' : 'X-Submit-Token'),
      description: config.config.description || (config.platformId === SUBSILICON_PLATFORM_ID ? SUBSILICON_DEFAULT_DESC : ''),
      enabled: config.enabled,
      platformUsername: config.config.platformUsername || '',
      platformPassword: config.config.platformPassword || '',
    })
    setShowPlatformForm(true)
  }

  const handleSavePlatform = async () => {
    if (!platformForm.name.trim()) {
      showToast('error', '请输入平台名称')
      return
    }
    if (!platformForm.apiUrl.trim() || !/^https?:\/\/.+/.test(platformForm.apiUrl.trim())) {
      showToast('error', '请输入有效的 API 地址')
      return
    }
    setPlatformSubmitting(true)
    try {
      const configData: Record<string, string> = {
        apiUrl: platformForm.apiUrl.trim(),
        submitToken: platformForm.submitToken.trim(),
        submitTokenKey: platformForm.submitTokenKey.trim(),
        description: platformForm.description.trim(),
        platformUsername: platformForm.platformUsername.trim(),
        platformPassword: platformForm.platformPassword.trim(),
      }
      const platformId = platformForm.isBuiltin ? SUBSILICON_PLATFORM_ID : 'custom'
      if (editingPlatform) {
        const clean: PlatformConfig = {
          id: editingPlatform.id,
          platformId,
          name: platformForm.name.trim(),
          config: configData,
          enabled: platformForm.enabled,
          createdAt: editingPlatform.createdAt,
          updatedAt: Date.now(),
          // 保留平台配置的账号归属
          ownerEmail: editingPlatform.ownerEmail,
        }
        await updatePlatformConfig(clean)
        showToast('success', '平台已更新')
      } else {
        await addPlatformConfig({
          platformId,
          name: platformForm.name.trim(),
          config: configData,
          enabled: true,
        }, account?.email)
        showToast('success', '平台已添加')
      }
      setShowPlatformForm(false)
      setEditingPlatform(null)
      // 刷新时按当前本地账号邮箱过滤，保持平台配置归属一致
      await loadPlatforms(account?.email)
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : '操作失败')
    } finally {
      setPlatformSubmitting(false)
    }
  }

  const openTokenDialog = (mode: 'login' | 'register') => {
    setTokenTab(mode)
    setTokenEmail('')
    setTokenPassword('')
    setTokenDisplayName('')
    setTokenError('')
    setShowTokenPassword(false)
    setShowTokenDialog(true)
  }

  const handleGetToken = async () => {
    setTokenError('')
    const email = tokenEmail.trim()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setTokenError('请输入正确的邮箱地址')
      return
    }
    if (tokenTab === 'register') {
      if (tokenPassword.length < 8) {
        setTokenError('密码至少 8 位')
        return
      }
      if (!/[a-zA-Z]/.test(tokenPassword) || !/[0-9]/.test(tokenPassword)) {
        setTokenError('密码必须包含字母和数字')
        return
      }
    } else if (!tokenPassword) {
      setTokenError('请输入密码')
      return
    }
    setTokenSubmitting(true)
    try {
      const payload: Record<string, string> = { email, password: tokenPassword }
      if (tokenTab === 'register') {
        // 显示名可选，默认取邮箱前缀
        payload.displayName = tokenDisplayName.trim() || email.split('@')[0]
      }
      const res = await fetch(`${SUBMIT_TOKEN_ORIGIN}/api/creator/submit-token/${tokenTab}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        // 优先展示接口返回的 error 文案（如「该邮箱已注册，请直接登录获取令牌」「邮箱或密码错误」）
        setTokenError((data as { error?: string }).error || `获取令牌失败（${res.status}）`)
        return
      }
      const token = (data as { token?: string }).token
      if (!token) {
        setTokenError('接口返回异常，未获取到令牌')
        return
      }
      // 只回填输入框，不自动保存，避免误覆盖平台配置
      setPlatformForm((prev) => ({ ...prev, submitToken: token }))
      setShowTokenDialog(false)
      showToast('success', '已获取提交令牌并填入，请保存平台配置')
    } catch (e) {
      setTokenError(e instanceof Error ? e.message : '获取令牌失败，请检查网络后重试')
    } finally {
      setTokenSubmitting(false)
    }
  }

  const handleTogglePlatform = async (config: PlatformConfigWithPlatform) => {
    try {
      const clean: PlatformConfig = {
        id: config.id,
        platformId: config.platformId,
        name: config.name,
        config: { ...config.config },
        enabled: !config.enabled,
        createdAt: config.createdAt,
        updatedAt: Date.now(),
        // 保留平台配置的账号归属
        ownerEmail: config.ownerEmail,
      }
      await updatePlatformConfig(clean)
      // 刷新时按当前本地账号邮箱过滤，保持平台配置归属一致
      await loadPlatforms(account?.email)
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : '操作失败')
    }
  }

  const handleRemovePlatform = (config: PlatformConfigWithPlatform) => {
    setPlatformToDelete(config)
  }

  const confirmRemovePlatform = async () => {
    if (!platformToDelete) return
    try {
      await removePlatformConfig(platformToDelete.id)
      showToast('success', '平台已删除')
      // 刷新时按当前本地账号邮箱过滤，保持平台配置归属一致
      await loadPlatforms(account?.email)
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : '删除失败')
    } finally {
      setPlatformToDelete(null)
    }
  }

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const addCustomTag = () => {
    const trimmed = customTagInput.trim()
    if (!trimmed) return
    if (tags.includes(trimmed)) {
      setCustomTagInput('')
      return
    }
    setTags((prev) => [...prev, trimmed])
    setCustomTagInput('')
  }

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      showToast('error', '仅支持 JPEG/PNG/GIF/WebP 格式')
      return
    }
    if (file.size > MAX_COVER_SIZE) {
      showToast('error', '封面图大小不能超过 5MB')
      return
    }
    setCoverImage(file)
    const reader = new FileReader()
    reader.onload = () => setCoverPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const clearCover = () => {
    setCoverImage(null)
    setCoverPreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleScreenshotsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const remainingSlots = MAX_SCREENSHOTS - screenshots.length
    const filesToAdd = Array.from(files).slice(0, remainingSlots)
    if (filesToAdd.length === 0) {
      showToast('error', `最多只能上传 ${MAX_SCREENSHOTS} 张截图`)
      return
    }
    filesToAdd.forEach((file) => {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        showToast('error', '仅支持 JPEG/PNG/GIF/WebP 格式')
        return
      }
      if (file.size > MAX_SCREENSHOT_SIZE) {
        showToast('error', '截图大小不能超过 2MB')
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        setScreenshots((prev) => [...prev, { file, preview: reader.result as string }])
      }
      reader.readAsDataURL(file)
    })
    if (screenshotsInputRef.current) screenshotsInputRef.current.value = ''
  }

  const removeScreenshot = (index: number) => {
    setScreenshots((prev) => prev.filter((_, i) => i !== index))
  }

  const validatePublish = (): boolean => {
    const next: Record<string, string> = {}
    if (!selectedPlatformId) next.platform = '请选择目标平台'
    if (!title.trim()) next.title = '请填写作品标题'
    else if (title.trim().length > MAX_TITLE_LENGTH) next.title = '标题长度不能超过60字'
    if (!summary.trim()) next.summary = '请填写一句话简介'
    if (summary.length > MAX_SUMMARY_LENGTH) next.summary = `简介不能超过 ${MAX_SUMMARY_LENGTH} 字`
    if (tags.length > 10) next.tags = '标签不能超过10个'
    const hasContact = wechat.trim() || afdianLink.trim()
    if (!hasContact) next.contact = '请至少填写微信号或爱发电链接之一'
    if (afdianLink.trim() && !/^https?:\/\/.+/.test(afdianLink.trim())) {
      next.afdianLink = '爱发电链接格式不正确'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handlePublish = async () => {
    if (publishing) return
    if (!account) {
      showToast('error', '请先登录账号')
      setTab('account')
      return
    }
    if (!validatePublish()) return
    setPublishing(true)
    try {
      const previewHtml = exportPreviewHTML(graph)
      const result = await publishToPlatform(
        workId || '',
        selectedPlatformId,
        title.trim(),
        summary.trim(),
        tags,
        coverImage,
        screenshots,
        wechat.trim(),
        afdianLink.trim(),
        previewHtml,
        account,
      )
      if (!result.success) {
        showToast('error', `提交失败：${result.error || '未知错误'}`)
        return
      }
      setPublished(true)
      showToast('success', '提交成功，等待平台审核')
      // 刷新时按当前本地账号邮箱过滤，保持发布记录归属一致
      await loadRecords(account?.email)
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : '提交失败')
    } finally {
      setPublishing(false)
    }
  }

  const resolvePlatformName = (record: PublishRecord): string => {
    const matched = platforms.find((p) => p.id === record.platformConfigId || p.platformId === record.platformId)
    if (matched?.name) return matched.name
    return record.platformId === SUBSILICON_PLATFORM_ID ? SUBSILICON_DEFAULT_NAME : '自定义平台'
  }

  const platformIcon = (config: PlatformConfigWithPlatform) =>
    config.platformId === SUBSILICON_PLATFORM_ID ? (
      <Home className="w-4 h-4 text-gold-400" />
    ) : (
      <Link2 className="w-4 h-4 text-sky-400" />
    )

  const enabledPlatforms = platforms.filter((p) => p.enabled)

  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
        onClick={(e) => {
          if (e.target === e.currentTarget && !busy) onClose()
        }}
      />
      <div className="fixed right-0 top-0 z-[60] h-full w-full max-w-6xl max-h-[92vh] bg-card border-l border-border shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300" style={{ clipPath: 'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)' }}>
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[2px] bg-gold-400/15 flex items-center justify-center">
              <Send className="w-5 h-5 text-gold-400" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">创作者中心</h3>
              <p className="text-[10px] text-muted-foreground">本地管理账号、平台与发布记录</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="关闭"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {!guideDismissed && (
            <div className="absolute top-[57px] right-3 z-10 w-[min(92%,480px)] rounded-[2px] border border-gold-400/30 bg-gold-400/10 backdrop-blur p-3 shadow-[4px_4px_0_hsl(var(--gold)/0.2)]">
              <div className="flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 text-xs text-amber-100/90 leading-relaxed">
                  <div className="font-semibold text-amber-200 mb-1">创作者中心使用流程</div>
                  <ol className="space-y-0.5 list-decimal list-inside text-[11px] text-amber-100/80">
                    <li><b>账号管理</b>：注册或登录本地账号（数据存储在本机 IndexedDB）</li>
                    <li><b>平台管理</b>：添加发布平台（如 SubSilicon 自由集市），填写独立账号</li>
                    <li><b>发布作品</b>：填写标题/简介/标签/封面，提交至所选平台</li>
                    <li><b>发布记录</b>：查看各平台审核状态</li>
                    <li><b>解锁码</b>：离线支付后，用读者发来的凭证生成解锁码</li>
                  </ol>
                </div>
                <button
                  onClick={() => {
                    setGuideDismissed(true)
                    try { localStorage.setItem('subsilicon_creator_center_guide_dismissed', 'true') } catch {}
                  }}
                  className="w-6 h-6 rounded-full hover:bg-gold-400/20 flex items-center justify-center text-gold-400 shrink-0"
                  aria-label="关闭引导"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
          <nav className="w-52 shrink-0 border-r border-border bg-card/60 py-2">
            {TAB_ITEMS.map((item) => {
              const Icon = item.icon
              const active = tab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors text-left ${
                    active
                      ? 'bg-muted text-gold-400 border-r-2 border-gold-400'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              )
            })}
          </nav>

          <main className="flex-1 overflow-y-auto px-5 py-4">
            {tab === 'account' && (
              <div className="space-y-4">
                {account ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 rounded-[2px] bg-muted/60 border border-border" style={{ clipPath: 'polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)' }}>
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <User className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{account.displayName}</div>
                        <div className="text-xs text-muted-foreground truncate">{account.email}</div>
                      </div>
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    </div>
                    {account.bio && <p className="text-xs text-muted-foreground">{account.bio}</p>}
                    <p className="text-xs text-muted-foreground">
                      显示名称将作为创作者署名，发布作品时随作品一同提交。
                    </p>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center justify-center gap-2 rounded-[2px] border border-border hover:bg-muted text-foreground text-sm py-2 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      退出登录
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex rounded-[2px] border border-border overflow-hidden">
                      <button
                        onClick={() => { setAccountTab('login'); setAccountError('') }}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${
                          accountTab === 'login'
                            ? 'bg-muted text-foreground'
                            : 'bg-transparent text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        登录
                      </button>
                      <button
                        onClick={() => { setAccountTab('register'); setAccountError('') }}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${
                          accountTab === 'register'
                            ? 'bg-muted text-foreground'
                            : 'bg-transparent text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        注册
                      </button>
                    </div>

                    {accountTab === 'login' ? (
                      <div className="space-y-3">
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            type="email"
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                            placeholder="邮箱"
                            className={iconInputClass}
                          />
                        </div>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            type={showLoginPassword ? 'text' : 'password'}
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                            placeholder="密码"
                            className={`${iconInputClass} pr-9`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowLoginPassword(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            tabIndex={-1}
                          >
                            {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <button
                          onClick={handleLogin}
                          disabled={accountSubmitting}
                          className="w-full flex items-center justify-center gap-2 rounded-[2px] bg-gold-400 hover:bg-gold-300 disabled:opacity-60 text-slate-900 shadow-[3px_3px_0_hsl(var(--gold)/0.3)] font-semibold text-sm py-2.5 transition-colors"
                        >
                          {accountSubmitting ? (
                            <><Loader2 className="w-4 h-4 animate-spin" />登录中...</>
                          ) : '登录'}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            type="email"
                            value={regEmail}
                            onChange={(e) => setRegEmail(e.target.value)}
                            placeholder="邮箱"
                            className={iconInputClass}
                          />
                        </div>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            type={showRegPassword ? 'text' : 'password'}
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            placeholder="密码（至少 8 位，含字母和数字）"
                            className={`${iconInputClass} pr-9`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegPassword(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            tabIndex={-1}
                          >
                            {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            type={showRegConfirm ? 'text' : 'password'}
                            value={regConfirm}
                            onChange={(e) => setRegConfirm(e.target.value)}
                            placeholder="确认密码"
                            className={`${iconInputClass} pr-9`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegConfirm(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            tabIndex={-1}
                          >
                            {showRegConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            type="text"
                            value={regDisplayName}
                            onChange={(e) => setRegDisplayName(e.target.value)}
                            placeholder="显示名称（创作者署名）"
                            className={iconInputClass}
                          />
                        </div>
                        <textarea
                          value={regBio}
                          onChange={(e) => setRegBio(e.target.value)}
                          placeholder="个人简介（可选）"
                          rows={2}
                          className={`${inputClass} resize-none`}
                        />
                        <button
                          onClick={handleRegister}
                          disabled={accountSubmitting}
                          className="w-full flex items-center justify-center gap-2 rounded-[2px] bg-gold-400 hover:bg-gold-300 disabled:opacity-60 text-slate-900 shadow-[3px_3px_0_hsl(var(--gold)/0.3)] font-semibold text-sm py-2.5 transition-colors"
                        >
                          {accountSubmitting ? (
                            <><Loader2 className="w-4 h-4 animate-spin" />注册中...</>
                          ) : '注册'}
                        </button>
                      </div>
                    )}

                    {accountError && (
                      <div className="flex items-center gap-2 text-sm text-red-400 bg-red-900/20 rounded-[2px] px-3 py-2 border border-p5-red/30 shadow-[2px_2px_0_hsl(var(--p5-red)/0.2)]">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{accountError}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === 'platforms' && (
              <div className="space-y-4">
                {!account ? (
                  <div className="p-4 rounded-[2px] border border-blue-700/50 bg-blue-900/20 shadow-[2px_2px_0_hsl(var(--blue)/0.15)]">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-blue-200">请先登录账号</div>
                        <p className="text-[12px] text-blue-300/80 leading-relaxed">
                          登录后即可管理要连接的发布平台。
                        </p>
                        <button
                          onClick={() => setTab('account')}
                          className="mt-2 px-3 py-1 text-xs rounded-[2px] bg-blue-500 hover:bg-blue-400 text-white"
                        >
                          前往登录
                        </button>
                      </div>
                    </div>
                  </div>
                ) : showPlatformForm ? (
                  <div className="space-y-3 p-4 rounded-[2px] border border-border bg-muted/40" style={{ clipPath: 'polygon(6px 0, calc(100% - 6px) 0, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0 calc(100% - 6px), 0 6px)' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">
                        {editingPlatform ? '编辑平台' : '添加平台'}
                      </span>
                      <button
                        onClick={() => { setShowPlatformForm(false); setEditingPlatform(null) }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex rounded-[2px] border border-border overflow-hidden">
                      <button
                        onClick={() =>
                          setPlatformForm((prev) => ({
                            ...prev,
                            isBuiltin: true,
                            name: SUBSILICON_DEFAULT_NAME,
                            apiUrl: SUBSILICON_DEFAULT_API,
                            description: SUBSILICON_DEFAULT_DESC,
                          }))
                        }
                        className={`flex-1 py-2 text-xs font-medium transition-colors ${
                          platformForm.isBuiltin ? 'bg-muted text-foreground' : 'bg-transparent text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        SubSilicon 自由集市
                      </button>
                      <button
                        onClick={() =>
                          setPlatformForm((prev) => ({ ...prev, isBuiltin: false, name: '', apiUrl: '', description: '' }))
                        }
                        className={`flex-1 py-2 text-xs font-medium transition-colors ${
                          !platformForm.isBuiltin ? 'bg-muted text-foreground' : 'bg-transparent text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        自定义平台
                      </button>
                    </div>
                    <div>
                      <label className={labelClass}>平台名称</label>
                      <input
                        type="text"
                        value={platformForm.name}
                        onChange={(e) => setPlatformForm((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="平台名称"
                        disabled={platformForm.isBuiltin}
                        className={`${inputClass} disabled:opacity-70`}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>API 地址</label>
                      <input
                        type="url"
                        value={platformForm.apiUrl}
                        onChange={(e) => setPlatformForm((prev) => ({ ...prev, apiUrl: e.target.value }))}
                        placeholder="https://example.com/api/submit"
                        disabled={platformForm.isBuiltin}
                        className={`${inputClass} disabled:opacity-70`}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        提交令牌
                        <span
                          className="text-[10px] text-muted-foreground font-normal cursor-help"
                          title="留空则使用内置默认令牌（可能不可用）；推荐点击右侧按钮获取个人令牌"
                        >
                          留空则使用内置默认令牌
                        </span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={platformForm.submitToken}
                          onChange={(e) => setPlatformForm((prev) => ({ ...prev, submitToken: e.target.value }))}
                          placeholder="提交令牌"
                          className={inputClass}
                        />
                        <button
                          type="button"
                          onClick={() => openTokenDialog('login')}
                          className="px-3 py-2 text-xs rounded-[2px] border border-gold-400/40 bg-gold-400/10 text-gold-400 hover:bg-gold-400/20 transition-colors flex items-center gap-1.5 shrink-0"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          获取提交令牌
                        </button>
                      </div>
                    </div>
                    {!platformForm.isBuiltin && (
                      <>
                        <div>
                          <label className={labelClass}>
                            令牌字段名
                            <span className="text-[10px] text-muted-foreground font-normal">HTTP 请求头名称</span>
                          </label>
                          <input
                            type="text"
                            value={platformForm.submitTokenKey}
                            onChange={(e) => setPlatformForm((prev) => ({ ...prev, submitTokenKey: e.target.value }))}
                            placeholder="X-Submit-Token"
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>
                            平台账号
                            <span className="text-[10px] text-muted-foreground font-normal">该平台的登录用户名</span>
                          </label>
                          <input
                            type="text"
                            value={platformForm.platformUsername}
                            onChange={(e) => setPlatformForm((prev) => ({ ...prev, platformUsername: e.target.value }))}
                            placeholder="平台用户名"
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>
                            平台密码
                            <span className="text-[10px] text-muted-foreground font-normal">该平台的登录密码</span>
                          </label>
                          <div className="relative">
                            <input
                              type={showPlatformPassword ? 'text' : 'password'}
                              value={platformForm.platformPassword}
                              onChange={(e) => setPlatformForm((prev) => ({ ...prev, platformPassword: e.target.value }))}
                              placeholder="平台密码"
                              className={`${inputClass} pr-9`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPlatformPassword(v => !v)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              tabIndex={-1}
                            >
                              {showPlatformPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                    <div>
                      <label className={labelClass}>描述</label>
                      <textarea
                        value={platformForm.description}
                        onChange={(e) => setPlatformForm((prev) => ({ ...prev, description: e.target.value }))}
                        rows={2}
                        placeholder="平台描述"
                        disabled={platformForm.isBuiltin}
                        className={`${inputClass} resize-none disabled:opacity-70`}
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => { setShowPlatformForm(false); setEditingPlatform(null) }}
                        disabled={platformSubmitting}
                        className="px-3 py-1.5 text-xs rounded-[2px] border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-40"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleSavePlatform}
                        disabled={platformSubmitting}
                        className="px-3 py-1.5 text-xs rounded-[2px] bg-gold-400 hover:bg-gold-300 text-slate-900 shadow-[3px_3px_0_hsl(var(--gold)/0.3)] font-semibold transition-colors disabled:opacity-60 flex items-center gap-1.5"
                      >
                        {platformSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        保存
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        已配置 {platforms.length} 个平台，可同时连接任意数量的发布平台。
                      </p>
                      <button
                        onClick={startAddPlatform}
                        className="px-3 py-1.5 text-xs rounded-[2px] bg-gold-400 hover:bg-gold-300 text-slate-900 shadow-[3px_3px_0_hsl(var(--gold)/0.3)] font-semibold transition-colors flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        添加平台
                      </button>
                    </div>
                    {platforms.length === 0 ? (
                      <div className="py-10 text-center text-sm text-muted-foreground">
                        暂未配置任何平台，点击「添加平台」开始
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {platforms.map((config) => (
                          <div
                            key={config.id}
                            className="p-3 rounded-[2px] border border-border bg-muted/40"
                            style={{ clipPath: 'polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)' }}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-[2px] bg-secondary/60 flex items-center justify-center shrink-0">
                                {platformIcon(config)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-foreground truncate">{config.name}</span>
                                  {config.platformId === SUBSILICON_PLATFORM_ID && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold-400/15 text-gold-400 border border-gold-400/30">
                                      内置
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-muted-foreground truncate">
                                  {config.config.apiUrl || (config.platformId === SUBSILICON_PLATFORM_ID ? SUBSILICON_DEFAULT_API : '')}
                                </div>
                                {config.config.platformUsername && (
                                  <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    <span className="truncate">{config.config.platformUsername}</span>
                                  </div>
                                )}
                                {config.config.description && (
                                  <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{config.config.description}</div>
                                )}
                              </div>
                              <label className="flex items-center gap-2 cursor-pointer shrink-0">
                                <button
                                  onClick={() => handleTogglePlatform(config)}
                                  className={`relative w-9 h-5 rounded-full transition-colors ${config.enabled ? 'bg-gold-400' : 'bg-slate-600'}`}
                                >
                                  <span
                                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${config.enabled ? 'translate-x-4' : ''}`}
                                  />
                                </button>
                                <span className="text-[11px] text-muted-foreground">{config.enabled ? '启用' : '禁用'}</span>
                              </label>
                            </div>
                            <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-border/60">
                              <button
                                onClick={() => startEditPlatform(config)}
                                className="px-2.5 py-1 text-[11px] rounded-[2px] border border-border text-foreground hover:bg-muted transition-colors flex items-center gap-1"
                              >
                                <Pencil className="w-3 h-3" />
                                编辑
                              </button>
                              <button
                                onClick={() => handleRemovePlatform(config)}
                                className="px-2.5 py-1 text-[11px] rounded-[2px] border border-red-900/60 text-red-300 hover:bg-red-900/30 transition-colors flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" />
                                删除
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {tab === 'publish' && (
              <div className="space-y-4">
                {!account ? (
                  <div className="p-4 rounded-[2px] border border-blue-700/50 bg-blue-900/20 shadow-[2px_2px_0_hsl(var(--blue)/0.15)]">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-blue-200">请先登录账号</div>
                        <p className="text-[12px] text-blue-300/80 leading-relaxed">
                          登录后即可将作品发布到已配置的平台。
                        </p>
                        <button
                          onClick={() => setTab('account')}
                          className="mt-2 px-3 py-1 text-xs rounded-[2px] bg-blue-500 hover:bg-blue-400 text-white"
                        >
                          前往登录
                        </button>
                      </div>
                    </div>
                  </div>
                ) : enabledPlatforms.length === 0 ? (
                  <div className="p-4 rounded-[2px] border border-amber-700/50 bg-amber-900/20 shadow-[2px_2px_0_hsl(var(--gold)/0.15)]">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-5 h-5 text-gold-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-amber-200">暂无可用平台</div>
                        <p className="text-[12px] text-gold-400/80 leading-relaxed">
                          请先在「平台管理」中添加并启用至少一个平台。
                        </p>
                        <button
                          onClick={() => setTab('platforms')}
                          className="mt-2 px-3 py-1 text-xs rounded-[2px] bg-gold-400 hover:bg-gold-300 text-slate-900 shadow-[3px_3px_0_hsl(var(--gold)/0.3)] font-semibold"
                        >
                          前往配置平台
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {published && (
                      <div className="p-4 rounded-[2px] border border-emerald-700/50 bg-emerald-900/20 shadow-[2px_2px_0_hsl(var(--emerald)/0.15)]">
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-start gap-2.5">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                              <div className="text-sm font-medium text-emerald-200">提交成功</div>
                              <p className="text-[12px] text-emerald-300/80 leading-relaxed">
                                作品已提交至目标平台，可在「发布记录」中查看审核状态。
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setPublished(false)
                              setSummary('')
                              setTags([])
                              setCustomTagInput('')
                              setWechat('')
                              setAfdianLink('')
                              setCoverImage(null)
                              setCoverPreview('')
                              setScreenshots([])
                              setErrors({})
                              if (fileInputRef.current) fileInputRef.current.value = ''
                              if (screenshotsInputRef.current) screenshotsInputRef.current.value = ''
                            }}
                            className="px-3 py-1.5 text-xs rounded-[2px] border border-emerald-600 text-emerald-300 hover:bg-emerald-900/40 transition-colors shrink-0"
                          >
                            再次发布
                          </button>
                        </div>
                      </div>
                    )}
                    <div className={`${published ? 'opacity-50 pointer-events-none' : ''} space-y-4`}>
                      <div>
                        <label className={labelClass}>
                          目标平台 <span className="text-red-400">*</span>
                        </label>
                        <select
                          value={selectedPlatformId}
                          onChange={(e) => setSelectedPlatformId(e.target.value)}
                          className={inputClass}
                        >
                          <option value="">请选择平台</option>
                          {enabledPlatforms.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        {errors.platform && (
                          <p className={errorTextClass}>
                            <AlertCircle className="w-3 h-3" />
                            {errors.platform}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className={labelClass}>
                          作品标题 <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="请输入作品标题"
                          className={inputClass}
                        />
                        {errors.title && (
                          <p className={errorTextClass}>
                            <AlertCircle className="w-3 h-3" />
                            {errors.title}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="flex items-center justify-between text-xs font-medium text-foreground mb-1.5">
                          <span className="flex items-center gap-1.5">
                            一句话简介 <span className="text-red-400">*</span>
                          </span>
                          <span className={`text-[10px] ${summary.length > MAX_SUMMARY_LENGTH ? 'text-red-400' : 'text-muted-foreground'}`}>
                            {summary.length}/{MAX_SUMMARY_LENGTH}
                          </span>
                        </label>
                        <textarea
                          value={summary}
                          onChange={(e) => setSummary(e.target.value.slice(0, MAX_SUMMARY_LENGTH))}
                          placeholder="用一句话介绍你的作品"
                          rows={2}
                          className={`${inputClass} resize-none`}
                        />
                        {errors.summary && (
                          <p className={errorTextClass}>
                            <AlertCircle className="w-3 h-3" />
                            {errors.summary}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className={labelClass}>
                          <Tag className="w-3.5 h-3.5" />
                          分类标签
                        </label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {PRESET_TAGS.map((tag) => {
                            const active = tags.includes(tag)
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => toggleTag(tag)}
                                className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
                                  active
                                    ? 'border-gold-400 bg-gold-400/15 text-gold-400'
                                    : 'border-border bg-muted text-foreground hover:border-border'
                                }`}
                              >
                                {tag}
                              </button>
                            )
                          })}
                          {tags
                            .filter((t) => !PRESET_TAGS.includes(t))
                            .map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border border-gold-400 bg-gold-400/15 text-gold-400"
                              >
                                {tag}
                                <button type="button" onClick={() => toggleTag(tag)} className="hover:text-amber-100">
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                        </div>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={customTagInput}
                            onChange={(e) => setCustomTagInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                addCustomTag()
                              }
                            }}
                            placeholder="自定义标签，回车添加"
                            className="flex-1 px-3 py-1.5 text-xs bg-muted border border-border rounded-[2px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold-400/60"
                          />
                          <button
                            type="button"
                            onClick={addCustomTag}
                            className="px-2.5 py-1.5 text-xs rounded-[2px] border border-border bg-muted text-foreground hover:border-border flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            添加
                          </button>
                        </div>
                        {errors.tags && (
                          <p className={errorTextClass}>
                            <AlertCircle className="w-3 h-3" />
                            {errors.tags}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className={labelClass}>
                          联系方式 <span className="text-red-400">*</span>
                          <span className="text-[10px] text-muted-foreground font-normal">至少填写一项</span>
                        </label>
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={wechat}
                            onChange={(e) => setWechat(e.target.value)}
                            placeholder="微信号"
                            className={inputClass}
                          />
                          <input
                            type="url"
                            value={afdianLink}
                            onChange={(e) => setAfdianLink(e.target.value)}
                            placeholder="爱发电链接（https://...）"
                            className={inputClass}
                          />
                          {errors.afdianLink && (
                            <p className={errorTextClass}>
                              <AlertCircle className="w-3 h-3" />
                              {errors.afdianLink}
                            </p>
                          )}
                        </div>
                        {errors.contact && (
                          <p className={errorTextClass}>
                            <AlertCircle className="w-3 h-3" />
                            {errors.contact}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className={labelClass}>
                          <ImageIcon className="w-3.5 h-3.5" />
                          封面图
                          <span className="text-[10px] text-muted-foreground font-normal">可选，最大 2MB</span>
                        </label>
                        {coverPreview ? (
                          <div className="relative w-full max-w-[200px] rounded-[2px] overflow-hidden border border-border">
                            <img src={coverPreview} alt="封面预览" className="w-full h-auto" />
                            <button
                              type="button"
                              onClick={clearCover}
                              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 hover:bg-black/90 flex items-center justify-center text-white"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-6 rounded-[2px] border border-dashed border-border bg-muted/50 hover:border-gold-400/50 hover:bg-muted flex flex-col items-center gap-1.5 transition-colors"
                          >
                            <ImageIcon className="w-6 h-6 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">点击上传封面图</span>
                            <span className="text-[10px] text-muted-foreground">支持 JPG / PNG / WebP，最大 5MB</span>
                          </button>
                        )}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleCoverChange}
                          className="hidden"
                        />
                      </div>

                      <div>
                        <label className={labelClass}>
                          <ImageIcon className="w-3.5 h-3.5" />
                          作品截图
                          <span className="text-[10px] text-muted-foreground font-normal">
                            可选，最多 {MAX_SCREENSHOTS} 张，每张最大 2MB
                          </span>
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {screenshots.map((s, index) => (
                            <div key={index} className="relative aspect-video rounded-[2px] overflow-hidden border border-border">
                              <img src={s.preview} alt={`截图 ${index + 1}`} className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => removeScreenshot(index)}
                                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-black/90 flex items-center justify-center text-white"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                          {screenshots.length < MAX_SCREENSHOTS && (
                            <button
                              type="button"
                              onClick={() => screenshotsInputRef.current?.click()}
                              className="aspect-video rounded-[2px] border border-dashed border-border bg-muted/50 hover:border-gold-400/50 hover:bg-muted flex flex-col items-center justify-center gap-1 transition-colors"
                            >
                              <Plus className="w-5 h-5 text-muted-foreground" />
                              <span className="text-[10px] text-muted-foreground">添加截图</span>
                            </button>
                          )}
                        </div>
                        <input
                          ref={screenshotsInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleScreenshotsChange}
                          className="hidden"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                      <button
                        onClick={onClose}
                        disabled={publishing}
                        className="px-3.5 py-1.5 text-sm rounded-[2px] border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-40"
                      >
                        {published ? '关闭' : '取消'}
                      </button>
                      <button
                        onClick={handlePublish}
                        disabled={publishing || published}
                        className="px-3.5 py-1.5 text-sm rounded-[2px] bg-gold-400 hover:bg-gold-300 text-slate-900 shadow-[3px_3px_0_hsl(var(--gold)/0.3)] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                      >
                        {publishing ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            提交中...
                          </>
                        ) : published ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            已提交
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5" />
                            提交审核
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {tab === 'records' && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  共 {records.length} 条发布记录，展示所有平台的提交状态。
                </p>
                {records.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    暂无发布记录
                  </div>
                ) : (
                  <div className="space-y-2">
                    {records.map((record) => {
                      const meta = STATUS_META[record.status]
                      return (
                        <div key={record.id} className="p-3 rounded-[2px] border border-border bg-muted/40"
                            style={{ clipPath: 'polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)' }}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-foreground truncate">{record.title}</div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">{resolvePlatformName(record)}</div>
                            </div>
                            <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full border ${meta.className}`}>
                              {meta.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-2 text-[11px] text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>{formatTime(record.publishedAt)}</span>
                          </div>
                          {record.status === 'rejected' && record.rejectReason && (
                            <div className="mt-2 flex items-start gap-1.5 text-[11px] text-red-400 bg-red-900/20 rounded-[2px] px-2 py-1.5">
                              <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                              <span>拒绝原因：{record.rejectReason}</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {tab === 'unlock' && (
              <div className="space-y-4">
                {!workId ? (
                  <div className="p-4 rounded-[2px] border border-blue-700/50 bg-blue-900/20 shadow-[2px_2px_0_hsl(var(--blue)/0.15)]">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-blue-200">当前作品未保存</div>
                        <p className="text-[12px] text-blue-300/80 leading-relaxed">
                          请先保存作品，再为读者生成离线解锁码。
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <UnlockCodeGenerator
                    workId={workId}
                    paidChapters={graph.monetization?.paidChapters?.map((c) => ({ id: c.id, name: c.name, price: c.price }))}
                  />
                )}
              </div>
            )}

            {tab === 'unlock-requests' && (
              <UnlockRequestsPanel onRequireLogin={() => setTab('account')} />
            )}
          </main>
        </div>
      </div>

      {platformToDelete && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setPlatformToDelete(null) }}
        >
          <div className="w-full max-w-sm bg-card border border-border rounded-[2px] shadow-2xl p-5 space-y-4" style={{ clipPath: 'polygon(6px 0, calc(100% - 6px) 0, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0 calc(100% - 6px), 0 6px)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <Trash2 className="w-4.5 h-4.5 text-red-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">删除平台</div>
                <div className="text-xs text-muted-foreground mt-0.5">此操作不可撤销</div>
              </div>
            </div>
            <p className="text-xs text-foreground leading-relaxed">
              确定要删除「{platformToDelete.name}」吗？相关的发布记录将保留，但后续无法再向该平台提交作品。
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setPlatformToDelete(null)}
                className="px-3 py-1.5 text-xs rounded-[2px] border border-border text-foreground hover:bg-muted transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmRemovePlatform}
                className="px-3 py-1.5 text-xs rounded-[2px] bg-primary hover:bg-red-400 text-white font-medium transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {showTokenDialog && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !tokenSubmitting) setShowTokenDialog(false) }}
        >
          <div className="w-full max-w-sm bg-card border border-border rounded-[2px] shadow-2xl p-5 space-y-4" style={{ clipPath: 'polygon(6px 0, calc(100% - 6px) 0, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0 calc(100% - 6px), 0 6px)' }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-full bg-gold-400/15 flex items-center justify-center shrink-0">
                  <KeyRound className="w-4.5 h-4.5 text-gold-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">获取提交令牌</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    令牌绑定你的邮箱，提交作品时将以此身份上墙
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowTokenDialog(false)}
                disabled={tokenSubmitting}
                className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center transition-colors disabled:opacity-40 shrink-0"
                aria-label="关闭"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="flex rounded-[2px] border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => { setTokenTab('login'); setTokenError('') }}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  tokenTab === 'login' ? 'bg-muted text-foreground' : 'bg-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                已有账号登录
              </button>
              <button
                type="button"
                onClick={() => { setTokenTab('register'); setTokenError('') }}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  tokenTab === 'register' ? 'bg-muted text-foreground' : 'bg-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                注册新账号
              </button>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={tokenEmail}
                  onChange={(e) => setTokenEmail(e.target.value)}
                  placeholder="邮箱"
                  className={iconInputClass}
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showTokenPassword ? 'text' : 'password'}
                  value={tokenPassword}
                  onChange={(e) => setTokenPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGetToken()}
                  placeholder={tokenTab === 'register' ? '密码（至少 8 位，含字母和数字）' : '密码'}
                  className={`${iconInputClass} pr-9`}
                />
                <button
                  type="button"
                  onClick={() => setShowTokenPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showTokenPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {tokenTab === 'register' && (
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={tokenDisplayName}
                    onChange={(e) => setTokenDisplayName(e.target.value)}
                    placeholder="显示名（可选，默认取邮箱前缀）"
                    className={iconInputClass}
                  />
                </div>
              )}
              {tokenError && (
                <div className="flex items-start gap-2 text-xs text-red-400 bg-red-900/20 rounded-[2px] px-3 py-2 border border-p5-red/30 shadow-[2px_2px_0_hsl(var(--p5-red)/0.2)]">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{tokenError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setShowTokenDialog(false)}
                disabled={tokenSubmitting}
                className="px-3 py-1.5 text-xs rounded-[2px] border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-40"
              >
                取消
              </button>
              <button
                onClick={handleGetToken}
                disabled={tokenSubmitting}
                className="px-3 py-1.5 text-xs rounded-[2px] bg-gold-400 hover:bg-gold-300 text-slate-900 shadow-[3px_3px_0_hsl(var(--gold)/0.3)] font-semibold transition-colors disabled:opacity-60 flex items-center gap-1.5"
              >
                {tokenSubmitting ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" />获取中...</>
                ) : (
                  <><KeyRound className="w-3.5 h-3.5" />获取令牌</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default CreatorCenterDialog
