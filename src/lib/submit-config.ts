/**
 * 提交配置
 *
 * 说明：默认 URL 指向 SubSilicon 官方服务器（subsilicon.cn）。
 * 如果你想将作品提交到自己的服务器，可以修改下面的 apiUrl 和 storyUnlockUrl。
 *
 * - apiUrl: 作品墙上传接口（用于将作品提交到 SubSilicon 作品墙）
 * - storyUnlockUrl: 故事解锁接口（用于付费故事的密钥注册和解锁验证）
 * - submitToken: 提交令牌，可通过环境变量 SUBMIT_TOKEN 配置，默认占位符需要替换为你自己的令牌
 *
 * 修改示例：
 *   apiUrl: 'https://your-domain.com/api/creator/preview/submit'
 *   storyUnlockUrl: 'https://your-domain.com/api/story-unlock'
 */
export const SUBMIT_CONFIG = {
  apiUrl: 'https://subsilicon.cn/api/creator/preview/submit',
  storyUnlockUrl: 'https://subsilicon.cn/api/story-unlock',
  submitToken: process.env.SUBMIT_TOKEN || '__SUBMIT_TOKEN__',
}
