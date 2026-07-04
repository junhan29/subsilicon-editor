/**
 * 提交配置（向后兼容）
 *
 * 当前默认值取自 submit-providers 中内置的 SubSilicon 官方作品墙。
 * 新代码应直接使用 submit-providers 模块以支持多提供商。
 */
import { getActiveProvider } from './submit-providers'

export const SUBMIT_CONFIG = {
  get apiUrl(): string {
    return getActiveProvider().apiUrl
  },
  get storyUnlockUrl(): string {
    // 故事解锁接口沿用官方端点，第三方作品墙通常不实现此能力
    return 'https://subsilicon.cn/api/story-unlock'
  },
  get submitToken(): string {
    return getActiveProvider().authToken || ''
  },
}
