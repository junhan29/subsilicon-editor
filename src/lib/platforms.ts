import type { PublishPlatform } from '@editor/types/creator'

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

export function getPlatformById(id: string): PublishPlatform | undefined {
  return BUILTIN_PLATFORMS.find((p) => p.id === id)
}

export function getAllPlatforms(): PublishPlatform[] {
  return [...BUILTIN_PLATFORMS]
}
