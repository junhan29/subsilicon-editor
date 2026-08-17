export interface PublishPlatform {
  id: string
  name: string
  type: 'subsilicon' | 'custom'
  apiUrl: string
  submitTokenKey?: string
  description: string
  icon: string
  supportedFields: {
    title: boolean
    summary: boolean
    tags: boolean
    cover: boolean
    screenshots: boolean
    contactInfo: boolean
    externalLink: boolean
    previewHtml: boolean
  }
  maxScreenshots: number
  maxCoverSize: number
  maxScreenshotSize: number
}

export interface PlatformConfig {
  id: string
  platformId: string
  name: string
  config: Record<string, string>
  enabled: boolean
  createdAt: number
  updatedAt: number
  /** 归属的本地账号邮箱（账号双轨统一后，平台配置挂到本地账户名下） */
  ownerEmail?: string
}

export interface CreatorAccount {
  id: string
  email: string
  displayName: string
  passwordHash?: string
  authToken?: string
  bio: string
  createdAt: number
  nameChangeCount: number
  nameLastChangedAt: number
}

export interface PublishRecord {
  id: string
  workId: string
  platformId: string
  platformConfigId: string
  title: string
  status: 'pending' | 'approved' | 'rejected' | 'published'
  rejectReason?: string
  platformResponse: Record<string, unknown>
  publishedAt: number
  updatedAt: number
  /** 发布归属的本地账号邮箱（账号双轨统一后，发布记录归属本地账号） */
  creatorEmail?: string
}

export interface CreatorCenterState {
  platforms: PublishPlatform[]
  platformConfigs: PlatformConfig[]
  account: CreatorAccount | null
  publishRecords: PublishRecord[]
}
