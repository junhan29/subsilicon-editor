import type { PublishPlatform } from '@editor/types/creator'

const CUSTOM_PLATFORMS_KEY = 'subsilicon_custom_platforms'

export const BUILTIN_PLATFORMS: PublishPlatform[] = [
  {
    id: 'subsilicon',
    name: 'SubSilicon 作品墙',
    type: 'subsilicon',
    apiUrl: 'https://subsilicon.cn/api/creator/preview/submit',
    submitTokenKey: 'X-Submit-Token',
    description: '官方作品墙，审核通过后展示给所有用户',
    icon: '🏠',
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
  },
]

/** 从 localStorage 加载自定义平台 */
function loadCustomPlatforms(): PublishPlatform[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PLATFORMS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** 保存自定义平台到 localStorage */
function saveCustomPlatforms(platforms: PublishPlatform[]) {
  localStorage.setItem(CUSTOM_PLATFORMS_KEY, JSON.stringify(platforms))
}

/** 添加自定义平台 */
export function addCustomPlatform(platform: Omit<PublishPlatform, 'type'>): PublishPlatform {
  const custom: PublishPlatform = {
    ...platform,
    type: 'custom',
  }
  const existing = loadCustomPlatforms()
  const updated = [...existing.filter(p => p.id !== custom.id), custom]
  saveCustomPlatforms(updated)
  return custom
}

/** 删除自定义平台 */
export function removeCustomPlatform(id: string) {
  const existing = loadCustomPlatforms()
  const updated = existing.filter(p => p.id !== id)
  saveCustomPlatforms(updated)
}

export function getPlatformById(id: string): PublishPlatform | undefined {
  return BUILTIN_PLATFORMS.find((p) => p.id === id) ?? loadCustomPlatforms().find((p) => p.id === id)
}

export function getAllPlatforms(): PublishPlatform[] {
  return [...BUILTIN_PLATFORMS, ...loadCustomPlatforms()]
}
