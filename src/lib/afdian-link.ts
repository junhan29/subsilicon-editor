/**
 * 爱发电（afdian）链接解析 —— 纯函数，无 React 依赖，供编辑器与单元测试复用。
 *
 * 从创作者主页链接中提取平台用户 ID（user_id）与方案 ID（plan_id），
 * 供导出对话框「第三方平台自动验证（爱发电）」配置区自动填充。
 */

export interface AfdianLinkInfo {
  /** 平台用户ID（主页路径段，如 afdian.com/a/xxx 中的 xxx，可含 . 等） */
  userId?: string
  /** 方案/商品 ID（query 中的 plan_id 或 planId） */
  planId?: string
}

/** 主页链接：https://afdian.com/a/xxx、https://afdian.net/a/xxx（允许 www. 前缀与省略协议） */
const AFDIAN_HOST_RE = /(?:https?:\/\/)?(?:www\.)?afdian\.(?:com|net|cn)\/a\/([^/?#]+)/i
/** query 中的 plan_id / planId（大小写不敏感，值截至 & 或 #） */
const AFDIAN_PLAN_RE = /[?&](?:plan_id|planId)=([^&#]+)/i

export function parseAfdianLink(link: string): AfdianLinkInfo {
  // String 原型安全：入参可能是空字符串 / 非 string，统一先转字符串再 trim
  const input = (typeof link === 'string' ? link : '').trim()
  if (!input) return {}

  const info: AfdianLinkInfo = {}

  const userMatch = input.match(AFDIAN_HOST_RE)
  if (userMatch && userMatch[1]) info.userId = userMatch[1]

  const planMatch = input.match(AFDIAN_PLAN_RE)
  if (planMatch && planMatch[1]) info.planId = planMatch[1]

  return info
}
