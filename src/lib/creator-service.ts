import type { CreatorAccount, PlatformConfig, PublishPlatform, PublishRecord } from '@editor/types/creator'
import { BUILTIN_PLATFORMS, getPlatformById } from './platforms'
import {
  deletePlatformConfig,
  getAllPlatformConfigs,
  getAllPublishRecords,
  getPublishRecordsByWork,
  savePlatformConfig,
  savePublishRecord,
} from './creator-store'
import { SUBMIT_CONFIG } from './submit-config'
import { decryptPasswordFields, encryptPasswordFields } from './password-crypto'

const PASSWORD_FIELDS = ['platformPassword', 'submitToken']

function generateId(): string {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

export async function addPlatformConfig(
  config: Omit<PlatformConfig, 'id' | 'createdAt' | 'updatedAt'>,
  ownerEmail?: string
): Promise<PlatformConfig> {
  const now = Date.now()
  // 加密密码字段
  const encryptedConfig = await encryptPasswordFields(config.config, PASSWORD_FIELDS)
  const newConfig: PlatformConfig = {
    ...config,
    config: encryptedConfig,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    // 账号双轨统一：平台配置挂到本地账户名下
    ownerEmail: ownerEmail?.trim().toLowerCase(),
  }
  await savePlatformConfig(newConfig)
  return newConfig
}

export async function updatePlatformConfig(config: PlatformConfig): Promise<void> {
  // 加密密码字段
  const encryptedConfig = await encryptPasswordFields(config.config, PASSWORD_FIELDS)
  config.config = encryptedConfig
  config.updatedAt = Date.now()
  await savePlatformConfig(config)
}

export async function removePlatformConfig(id: string): Promise<void> {
  await deletePlatformConfig(id)
}

export async function getPlatformConfigs(ownerEmail?: string): Promise<PlatformConfig[]> {
  const configs = await getAllPlatformConfigs()
  // 账号双轨统一：平台配置归属本地账号，读取时按当前登录邮箱过滤；
  // 兼容旧数据（无归属字段的配置仍可见，避免用户配置丢失不可见）
  const owned = ownerEmail
    ? configs.filter((c) => !c.ownerEmail || c.ownerEmail === ownerEmail.trim().toLowerCase())
    : configs
  // 解密所有配置中的密码字段
  return Promise.all(
    owned.map(async (config) => ({
      ...config,
      config: await decryptPasswordFields(config.config, PASSWORD_FIELDS),
    }))
  )
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
  account: Omit<CreatorAccount, 'passwordHash'>,
  extraFields?: Record<string, string>
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
    // 网站端不托管内容、不读取 previewHtml，为减小无效流量不再发送；参数保留仅为向后兼容调用方
    if (workId) formData.append('workId', workId)
    // DDP 1.1：摊位层元数据（可选，旧接收方忽略）
    if (extraFields) {
      for (const [key, value] of Object.entries(extraFields)) {
        if (value !== undefined && value !== null) {
          formData.append(key, value)
        }
      }
    }

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
      rejectReason: res.ok
        ? undefined
        : (responseData.message || responseData.error || `服务器响应异常（${res.status}）`),
      platformResponse: responseData,
      publishedAt: Date.now(),
      updatedAt: Date.now(),
      // 账号双轨统一：发布记录归属本地账号邮箱
      creatorEmail: account.email,
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
      // 账号双轨统一：发布记录归属本地账号邮箱
      creatorEmail: account.email,
    }
    await savePublishRecord(record)
    return { success: false, error: msg, record }
  }
}

export async function getPublishRecords(workId?: string, ownerEmail?: string): Promise<PublishRecord[]> {
  const all = workId ? await getPublishRecordsByWork(workId) : await getAllPublishRecords()
  // 账号双轨统一：发布记录归属本地账号邮箱，读取时按当前登录邮箱过滤；
  // 兼容旧数据（无归属字段的记录仍可见）
  if (!ownerEmail) return all
  const email = ownerEmail.trim().toLowerCase()
  return all.filter((r) => !r.creatorEmail || r.creatorEmail === email)
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
