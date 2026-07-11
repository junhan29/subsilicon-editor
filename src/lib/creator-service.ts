import type { PlatformConfig, CreatorAccount, PublishRecord, PublishPlatform } from '@editor/types/creator'
import { BUILTIN_PLATFORMS, getPlatformById } from './platforms'
import {
  savePlatformConfig,
  getAllPlatformConfigs,
  deletePlatformConfig,
  saveCreatorAccount,
  getCreatorAccount,
  deleteCreatorAccount,
  savePublishRecord,
  getAllPublishRecords,
  getPublishRecordsByWork,
} from './creator-store'
import { SUBMIT_CONFIG } from './submit-config'

const CURRENT_ACCOUNT_KEY = 'subsilicon_creator_current_account'

let currentAccount: Omit<CreatorAccount, 'passwordHash'> | null = null
let initPromise: Promise<void> | null = null

async function persistCurrent(account: Omit<CreatorAccount, 'passwordHash'> | null) {
  currentAccount = account
  if (typeof window !== 'undefined') {
    if (account) {
      try {
        localStorage.setItem(CURRENT_ACCOUNT_KEY, JSON.stringify(account))
      } catch {
        // ignore
      }
    } else {
      try {
        localStorage.removeItem(CURRENT_ACCOUNT_KEY)
      } catch {
        // ignore
      }
    }
  }
}

function initFromStorage(): Promise<void> {
  if (initPromise) return initPromise
  if (typeof window === 'undefined') {
    initPromise = Promise.resolve()
    return initPromise
  }
  initPromise = (async () => {
    try {
      const stored = localStorage.getItem(CURRENT_ACCOUNT_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Omit<CreatorAccount, 'passwordHash'>
        if (parsed && parsed.email) {
          const account = await getCreatorAccount(parsed.email)
          if (account) {
            currentAccount = {
              id: account.id,
              email: account.email,
              displayName: account.displayName,
              authToken: account.authToken,
              bio: account.bio,
              createdAt: account.createdAt,
              nameChangeCount: account.nameChangeCount || 0,
              nameLastChangedAt: account.nameLastChangedAt || account.createdAt,
            }
          }
        }
      }
    } catch {
      // ignore
    }
  })()
  return initPromise
}

export function ensureCreatorServiceInit(): Promise<void> {
  return initFromStorage()
}

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

function generateId(): string {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

export async function registerAccount(
  email: string,
  password: string,
  displayName: string,
  bio?: string
): Promise<{ success: boolean; error?: string }> {
  const trimmedEmail = email.trim().toLowerCase()
  const trimmedDisplayName = displayName.trim()

  if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return { success: false, error: '请输入正确的邮箱地址' }
  }
  if (password.length < 8) {
    return { success: false, error: '密码至少 8 位' }
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { success: false, error: '密码必须包含字母和数字' }
  }
  if (!trimmedDisplayName) {
    return { success: false, error: '请输入显示名称' }
  }

  try {
    const existing = await getCreatorAccount(trimmedEmail)
    if (existing) {
      return { success: false, error: '该邮箱已注册，请直接登录' }
    }

    const passwordHash = await sha256(password)
    const now = Date.now()
    const account: CreatorAccount = {
      id: generateId(),
      email: trimmedEmail,
      displayName: trimmedDisplayName,
      passwordHash,
      bio: bio?.trim() || '',
      createdAt: now,
      nameChangeCount: 0,
      nameLastChangedAt: now,
    }

    await saveCreatorAccount(account)
    const accountInfo: Omit<CreatorAccount, 'passwordHash'> = {
      id: account.id,
      email: account.email,
      displayName: account.displayName,
      authToken: account.authToken,
      bio: account.bio,
      createdAt: account.createdAt,
      nameChangeCount: account.nameChangeCount,
      nameLastChangedAt: account.nameLastChangedAt,
    }
    await persistCurrent(accountInfo)

    return { success: true }
  } catch {
    return { success: false, error: '注册失败：数据库异常' }
  }
}

export async function loginAccount(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; account?: Omit<CreatorAccount, 'passwordHash'> }> {
  const trimmedEmail = email.trim().toLowerCase()

  if (!trimmedEmail || !password) {
    return { success: false, error: '请填写邮箱和密码' }
  }

  try {
    const account = await getCreatorAccount(trimmedEmail)
    if (!account) {
      return { success: false, error: '该邮箱未注册' }
    }

    const passwordHash = await sha256(password)
    if (account.passwordHash !== passwordHash) {
      return { success: false, error: '密码错误' }
    }

    const accountInfo: Omit<CreatorAccount, 'passwordHash'> = {
      id: account.id,
      email: account.email,
      displayName: account.displayName,
      authToken: account.authToken,
      bio: account.bio,
      createdAt: account.createdAt,
      nameChangeCount: account.nameChangeCount || 0,
      nameLastChangedAt: account.nameLastChangedAt || account.createdAt,
    }
    await persistCurrent(accountInfo)

    return { success: true, account: accountInfo }
  } catch {
    return { success: false, error: '登录失败：数据库异常' }
  }
}

export function getCurrentAccount(): Omit<CreatorAccount, 'passwordHash'> | null {
  return currentAccount
}

export function logoutAccount(): void {
  persistCurrent(null)
}

export function isLoggedIn(): boolean {
  return currentAccount !== null
}

export async function addPlatformConfig(config: Omit<PlatformConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<PlatformConfig> {
  const now = Date.now()
  const newConfig: PlatformConfig = {
    ...config,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  }
  await savePlatformConfig(newConfig)
  return newConfig
}

export async function updatePlatformConfig(config: PlatformConfig): Promise<void> {
  config.updatedAt = Date.now()
  await savePlatformConfig(config)
}

export async function removePlatformConfig(id: string): Promise<void> {
  await deletePlatformConfig(id)
}

export async function getPlatformConfigs(): Promise<PlatformConfig[]> {
  return getAllPlatformConfigs()
}

export async function publishToPlatform(
  workId: string,
  platformConfigId: string,
  title: string,
  summary: string,
  tags: string[],
  coverImage: File | null,
  screenshots: { file: File; preview: string }[],
  contactInfo: string,
  externalLink: string,
  previewHtml: string,
  account: Omit<CreatorAccount, 'passwordHash'>
): Promise<{ success: boolean; error?: string; record?: PublishRecord }> {
  const configs = await getAllPlatformConfigs()
  const config = configs.find((c) => c.id === platformConfigId)
  if (!config) {
    return { success: false, error: '平台配置不存在' }
  }

  const platform: PublishPlatform = getPlatformById(config.platformId) || {
    id: config.platformId,
    name: config.name,
    type: 'custom',
    apiUrl: config.config.apiUrl || '',
    submitTokenKey: config.config.submitTokenKey,
    description: config.config.description || '自定义平台',
    icon: '🔗',
    supportedFields: {
      title: true,
      summary: true,
      tags: true,
      cover: true,
      screenshots: true,
      contactInfo: true,
      externalLink: true,
      previewHtml: true,
    },
    maxScreenshots: 6,
    maxCoverSize: 5 * 1024 * 1024,
    maxScreenshotSize: 2 * 1024 * 1024,
  }

  try {
    const formData = new FormData()
    const platformUsername = config.config.platformUsername || ''
    const platformPassword = config.config.platformPassword || ''
    if (platformUsername) {
      formData.append('platformUsername', platformUsername)
    }
    if (platformPassword) {
      formData.append('platformPassword', platformPassword)
    }
    formData.append('creatorEmail', account.email)
    formData.append('creatorName', account.displayName)
    formData.append('creatorBio', account.bio || '')
    formData.append('title', title.trim())
    formData.append('summary', summary.trim())
    formData.append('tags', JSON.stringify(tags))
    if (coverImage) formData.append('coverImage', coverImage)
    screenshots.forEach((s, i) => {
      formData.append(`screenshot-${i}`, s.file)
    })
    formData.append('contactInfo', contactInfo.trim())
    formData.append('externalLink', externalLink.trim())
    formData.append('previewHtml', new Blob([previewHtml], { type: 'text/html;charset=utf-8' }), 'preview.html')
    if (workId) formData.append('workId', workId)

    const headers: Record<string, string> = {}
    if (platform.submitTokenKey) {
      headers[platform.submitTokenKey] = config.config.submitToken || SUBMIT_CONFIG.submitToken
    }

    const res = await fetch(platform.apiUrl, {
      method: 'POST',
      headers,
      body: formData,
    })

    const responseData = await res.json().catch(() => ({}))

    const record: PublishRecord = {
      id: generateId(),
      workId,
      platformId: config.platformId,
      platformConfigId: config.id,
      title: title.trim(),
      status: res.ok ? 'pending' : 'rejected',
      rejectReason: res.ok ? undefined : (responseData.error || responseData.message || `服务器响应异常（${res.status}）`),
      platformResponse: responseData,
      publishedAt: Date.now(),
      updatedAt: Date.now(),
    }

    await savePublishRecord(record)

    if (!res.ok) {
      return { success: false, error: record.rejectReason, record }
    }

    return { success: true, record }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const record: PublishRecord = {
      id: generateId(),
      workId,
      platformId: config.platformId,
      platformConfigId: config.id,
      title: title.trim(),
      status: 'rejected',
      rejectReason: msg,
      platformResponse: {},
      publishedAt: Date.now(),
      updatedAt: Date.now(),
    }
    await savePublishRecord(record)
    return { success: false, error: msg, record }
  }
}

export async function getPublishRecords(workId?: string): Promise<PublishRecord[]> {
  if (workId) {
    return getPublishRecordsByWork(workId)
  }
  return getAllPublishRecords()
}

export async function getAvailablePlatforms(): Promise<
  (typeof BUILTIN_PLATFORMS[0] & { hasConfig: boolean })[]
> {
  const configs = await getAllPlatformConfigs()
  return BUILTIN_PLATFORMS.map((platform) => ({
    ...platform,
    hasConfig: configs.some((c) => c.platformId === platform.id && c.enabled),
  }))
}
