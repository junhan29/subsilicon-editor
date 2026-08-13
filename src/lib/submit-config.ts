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
    // 开发环境指向本地服务端便于联调，生产指向官方端点；
    // import.meta 用 (import.meta as any) 兼容（tsconfig 未引入 vite/client 类型）
    return (import.meta as any).env?.DEV
      ? 'http://localhost:3000/api/story-unlock'
      : 'https://subsilicon.cn/api/story-unlock'
  },
  get submitToken(): string {
    return getActiveProvider().authToken || ''
  },
}
