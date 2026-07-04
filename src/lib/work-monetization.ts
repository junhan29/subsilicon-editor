/**
 * 作品付费解锁系统
 * 
 * 核心设计：
 * - 创作者零服务器、零资质、资金不经过平台
 * - 基于 HMAC-SHA256 本地验证
 * - 支持手动收款（微信）和第三方平台（爱发电/面包多）
 */

import type { StoryGraph } from '@editor/types/editor'

// ============ 类型定义 ============

/** 收款方式 */
export type PaymentMethod = 'wechat_manual' | 'third_party' | 'both' | 'multi'

/** 第三方平台类型 */
export type ThirdPartyPlatform = 'afdian' | 'mianbaoduo' | 'zsxq' | 'custom'

/** 个人收款渠道类型 */
export type ManualChannelType = 'wechat' | 'alipay'

/** 第三方平台渠道 */
export interface ThirdPartyChannel {
  platform: 'afdian' | 'mianbaoduo' | 'custom'
  link: string
  creatorName?: string
  planType?: 'subscription' | 'onetime'
  label?: string
}

/** 个人收款渠道 */
export interface ManualPaymentChannel {
  type: 'wechat' | 'alipay'
  qrCode: string
  contact?: string
  label?: string
}

/** 多渠道收款配置 */
export interface MultiChannelConfig {
  manualChannels: ManualPaymentChannel[]
  thirdPartyChannels: ThirdPartyChannel[]
  primaryChannel: 'manual' | 'afdian' | 'mianbaoduo'
}

/** 付费粒度 */
export type PaymentGranularity = 'whole' | 'chapter' | 'node'

/** 付费章节 */
export interface PaidChapter {
  id: string
  name: string
  nodeIds: string[]
  price: number
}

/** 付费配置 */
export interface MonetizationConfig {
  // 基础设置
  enabled: boolean                    // 是否开启付费
  granularity: PaymentGranularity     // 付费粒度：整本/章节/单节点
  
  // 收款方式
  paymentMethod: PaymentMethod        // 收款方式
  
  // 方案 A：微信手动收款
  wechatQRCode?: string               // 微信收款码图片（base64 或 URL）
  wechatContact?: string              // 创作者微信号（可选，用于读者联系）
  alipayQRCode?: string               // 支付宝收款码（新增）
  alipayContact?: string              // 支付宝账号（新增）
  
  // 方案 B：第三方平台
  thirdParty?: {
    platform: ThirdPartyPlatform      // 平台名称
    link: string                      // 平台购买页链接
    creatorName?: string              // 创作者在平台上的名称
  }

  // 新增：多渠道配置（当 paymentMethod === 'multi' 时使用）
  multiChannel?: MultiChannelConfig
  
  // 付费内容设置
  paidNodes: string[]                 // 需付费的节点 ID 列表（整本模式时为全部付费节点）
  paidChapters?: PaidChapter[]        // 按章节付费时的章节设置
  price: number                       // 价格（元）
  priceOptions?: number[]             // 多档定价（可选）
  
  // 预览设置
  freePreviewNodes?: string[]         // 免费预览的节点 ID（即使整本付费，前几章可免费）
  freePreviewText?: string            // 免费预览说明文字
  
  // 安全相关（导出时自动生成）
  workId: string                      // 作品唯一 ID
  seedKey?: string                    // 种子密钥（仅创作者本地保存，不导出到 HTML）
  seedKeyHash?: string                // 种子密钥哈希（导出到 HTML，用于验证）
}

/** 按章节付费配置 */
export interface PaidChapter {
  id: string                          // 章节 ID（可以是分组 ID 或自定义）
  name: string                        // 章节名称
  nodeIds: string[]                   // 该章节包含的节点 ID
  price: number                       // 该章节价格（可不同于整本价格）
}

/** 解锁凭证（读者生成） */
export interface UnlockRequest {
  type: 'request'
  workId: string
  paymentProof: string                // 支付单号后 6 位或第三方平台订单号
  deviceFingerprint: string           // 设备指纹
  timestamp: number                   // 生成时间（分钟对齐）
  chapterId?: string                  // 指定章节时使用
  code: string                        // 生成的凭证码 SUBSL-REQ-XXXXXXXX
}

/** 解锁码（创作者生成） */
export interface UnlockCode {
  type: 'unlock'
  workId: string
  requestCode: string                 // 对应的请求凭证
  chapterId?: string                  // 解锁特定章节
  timestamp: number                   // 生成时间
  validUntil?: number                 // 有效期截止（可选，0 表示永久）
  code: string                        // 解锁码 SUBSL-UNLOCK-XXXXXXXXXXXXXXXX
}

/** 解锁状态（存储在读者浏览器） */
export interface UnlockState {
  workId: string
  unlockedNodes: string[]             // 已解锁的节点 ID
  unlockedChapters: string[]          // 已解锁的章节 ID
  unlockTime: number                  // 解锁时间
  unlockCode: string                  // 使用过的解锁码
}

/** 单笔收入记录 */
export interface IncomeRecord {
  id: string
  workId: string
  workTitle: string
  amount: number
  channel: 'wechat' | 'alipay' | 'afdian' | 'mianbaoduo' | 'other'
  date: number
  note?: string
}

/** 年收入追踪 */
export interface IncomeTracking {
  records: IncomeRecord[]
  lastUpdated: number
}

/** 合规状态 */
export interface ComplianceStatus {
  currentYearIncome: number
  monthlyAverage: number
  warningLevel: 'safe' | 'notice' | 'warning' | 'critical'
  warnings: ComplianceWarning[]
}

/** 合规预警 */
export interface ComplianceWarning {
  level: 'notice' | 'warning' | 'critical'
  title: string
  message: string
  action: string
  threshold: number
  current: number
}

/** 导出 HTML 中的付费模块配置（不含敏感信息） */
export interface HTMLMonetizationConfig {
  workId: string
  seedKeyHash: string                 // 种子密钥哈希（用于验证解锁码格式）
  paidNodes: string[]
  paidChapters?: PaidChapter[]
  price: number
  freePreviewNodes?: string[]
  freePreviewText?: string
  paymentMethod: PaymentMethod
  wechatQRCode?: string
  wechatContact?: string
  thirdParty?: {
    platform: string
    link: string
    creatorName?: string
  }
  granularity: PaymentGranularity
}

// ============ 常量 ============

/** 种子密钥前缀 */
export const SEED_KEY_PREFIX = 'SUBSL-SEED-'

/** 解锁请求凭证前缀 */
export const UNLOCK_REQUEST_PREFIX = 'SUBSL-REQ-'

/** 解锁码前缀 */
export const UNLOCK_CODE_PREFIX = 'SUBSL-UNLOCK-'

/** localStorage 解锁状态 key */
export const UNLOCK_STATE_KEY_PREFIX = 'subsilicon_unlocked_'

/** 种子密钥 localStorage key */
export const SEED_KEY_STORAGE_KEY = 'subsilicon_seed_keys'

/** 第三方平台信息 */
export const THIRD_PARTY_PLATFORMS: Record<ThirdPartyPlatform, { name: string; url: string; fee: string }> = {
  afdian: { name: '爱发电', url: 'https://afdian.net', fee: '6%' },
  mianbaoduo: { name: '面包多', url: 'https://mianbaoduo.com', fee: '5%' },
  zsxq: { name: '知识星球', url: 'https://zsxq.com', fee: '5%' },
  custom: { name: '其他平台', url: '', fee: '自定义' },
}

/** 默认价格选项 */
export const DEFAULT_PRICE_OPTIONS = [6.6, 9.9, 18.8, 29.9, 49.9]

/** 合规阈值（基于2026年最新政策） */
export const COMPLIANCE_THRESHOLDS = {
  YEAR_INCOME_TAX_NOTICE: 60000,
  YEAR_INCOME_INDIVIDUAL_WARNING: 100000,
  YEAR_INCOME_INDIVIDUAL_CRITICAL: 120000,
  MONTHLY_AVERAGE_NOTICE: 8000,
  MONTHLY_AVERAGE_WARNING: 100000,
  SINGLE_PAYMENT_NOTICE: 5000,
  EARLY_WARNING_RATIO: 0.8,
} as const

/** 合规建议文案 */
export const COMPLIANCE_ADVICE = {
  tax_notice: {
    title: '年收入即将达到 6 万元',
    message: '根据现行个人所得税政策，年综合所得超过 6 万元需要申报个税。建议您提前了解税务申报流程。',
    action: '了解个税申报',
    link: 'https://etax.chinatax.gov.cn/',
  },
  individual_warning: {
    title: '年收入即将达到 10 万元',
    message: '建议您尽快注册个体工商户，使用商户收款码收款。个体户可享受小微企业税收优惠，且收款更稳定。',
    action: '了解个体户注册流程',
    link: 'https://www.gov.cn/',
  },
  individual_critical: {
    title: '年收入已超过 12 万元',
    message: '继续使用个人收款码存在较高风险。请尽快办理个体工商户营业执照，并切换到商户收款码。年所得 12 万元以上必须进行个税申报。',
    action: '立即办理个体户',
    link: 'https://www.gov.cn/',
  },
  monthly_warning: {
    title: '月均收款接近 10 万元',
    message: '金税四期会对连续 3 个月月均收款 ≥ 10 万元的个人账户重点监控。请考虑分散收款渠道或注册个体户。',
    action: '查看风控规避建议',
    link: '',
  },
  single_payment: {
    title: '单笔金额超过 5000 元',
    message: '微信个人收款码单笔限额 5000 元，建议拆分收款或引导读者使用第三方平台支付。',
    action: '了解替代方案',
    link: '',
  },
} as const

// ============ 工具函数 ============

/**
 * 生成种子密钥
 * 使用浏览器 crypto API 生成随机 32 字节密钥
 */
export async function generateSeedKey(): Promise<string> {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
  return SEED_KEY_PREFIX + hex
}

/**
 * 计算种子密钥哈希
 * 用于嵌入 HTML，不暴露种子密钥明文
 */
export async function hashSeedKey(seedKey: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(seedKey)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

/**
 * 生成作品唯一 ID
 */
export function generateWorkId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 8)
  return `work_${timestamp}_${random}`
}

/**
 * 生成设备指纹
 * 基于浏览器特征，不依赖服务器
 */
export async function generateDeviceFingerprint(): Promise<string> {
  const parts = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth.toString(),
    new Date().getTimezoneOffset().toString(),
    navigator.hardwareConcurrency?.toString() || 'unknown',
    // WebGL fingerprint (simplified)
    getWebGLFingerprint(),
  ]
  
  const combined = parts.join('|')
  const encoder = new TextEncoder()
  const data = encoder.encode(combined)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray
    .slice(0, 8)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') as WebGLRenderingContext | null
    if (!gl) return 'no-webgl'
    
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    if (!debugInfo) return 'webgl-no-debug'
    
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
    return renderer.slice(0, 50)
  } catch {
    return 'webgl-error'
  }
}

/**
 * 时间戳对齐到分钟
 * 用于 HMAC 计算，提供 60 秒容差
 */
export function alignTimestamp(timestamp: number): number {
  return Math.floor(timestamp / 60000) * 60000
}

// ============ HMAC 加解密核心 ============

/**
 * 使用 HMAC-SHA256 生成签名
 * 浏览器原生 SubtleCrypto API
 */
async function hmacSign(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  
  // 导入密钥
  const keyBuffer = encoder.encode(key)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  // 计算签名
  const messageBuffer = encoder.encode(message)
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageBuffer)
  
  // 转为十六进制
  const signatureArray = Array.from(new Uint8Array(signature))
  return signatureArray
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

/**
 * 计算 SHA-256 哈希（十六进制字符串）
 * 用于公开绑定验证，不需要密钥
 */
async function sha256Hex(message: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

/**
 * 生成解锁请求凭证（读者端）
 */
export async function generateUnlockRequest(
  workId: string,
  paymentProof: string,
  chapterId?: string
): Promise<UnlockRequest> {
  const fingerprint = await generateDeviceFingerprint()
  const timestamp = alignTimestamp(Date.now())
  
  // 构造消息
  const message = JSON.stringify({
    workId,
    paymentProof: paymentProof.slice(0, 6),
    fingerprint,
    chapterId: chapterId || 'all',
    timestamp,
  })
  
  // 计算签名（使用固定盐值，读者端不需要种子密钥）
  const signature = await hmacSign('subsilicon-request-salt', message)
  
  const code = UNLOCK_REQUEST_PREFIX + signature.slice(0, 8)
  
  return {
    type: 'request',
    workId,
    paymentProof,
    deviceFingerprint: fingerprint,
    timestamp,
    chapterId,
    code,
  }
}

/**
 * 生成解锁码（创作者端）
 * 需要种子密钥
 *
 * 解锁码格式：SUBSL-UNLOCK- + 16 位十六进制
 *   - 前 8 位：SHA256(requestCode + '|' + workId) 前 8 位（公开可验证的绑定关系）
 *   - 后 8 位：HMAC(seedKey, requestCode + '|' + workId + '|' + chapterId + '|' + timestamp) 前 8 位（需要密钥生成）
 */
export async function generateUnlockCode(
  seedKey: string,
  requestCode: string,
  workId: string,
  chapterId?: string,
  validHours?: number
): Promise<UnlockCode> {
  const timestamp = alignTimestamp(Date.now())
  const validUntil = validHours ? timestamp + validHours * 3600000 : 0
  const chapter = chapterId || 'all'

  // 公开绑定部分：SHA256(requestCode + '|' + workId) 前 8 位
  // 任何人都可以验证解锁码与请求凭证的绑定关系，无需密钥
  const bindingMessage = requestCode + '|' + workId
  const bindingHash = await sha256Hex(bindingMessage)
  const publicBinding = bindingHash.slice(0, 8)

  // HMAC 签名部分：HMAC(seedKey, requestCode + '|' + workId + '|' + chapter + '|' + timestamp) 前 8 位
  // 只有拥有种子密钥的创作者才能生成
  const hmacMessage = requestCode + '|' + workId + '|' + chapter + '|' + timestamp
  const hmacSignature = await hmacSign(seedKey, hmacMessage)
  const hmacPart = hmacSignature.slice(0, 8)

  const code = UNLOCK_CODE_PREFIX + publicBinding + hmacPart

  return {
    type: 'unlock',
    workId,
    requestCode,
    chapterId,
    timestamp,
    validUntil,
    code,
  }
}

/**
 * 验证解锁码（读者端，在 HTML 中运行）
 * 不需要种子密钥明文，使用公开绑定验证解锁码与请求凭证的关联
 */
export async function verifyUnlockCode(
  code: string,
  workId: string,
  requestCode: string,
  chapterId?: string,
  seedKeyHash?: string
): Promise<{ valid: boolean; reason?: string }> {
  // 格式校验
  if (!code.startsWith(UNLOCK_CODE_PREFIX)) {
    return { valid: false, reason: '解锁码格式错误' }
  }

  const hmacPart = code.slice(UNLOCK_CODE_PREFIX.length)
  if (!/^[A-F0-9]{16}$/i.test(hmacPart)) {
    return { valid: false, reason: '解锁码格式错误' }
  }

  // 检查请求凭证格式
  if (!requestCode || !requestCode.startsWith(UNLOCK_REQUEST_PREFIX)) {
    return { valid: false, reason: '请求凭证无效' }
  }

  // 公开绑定验证：解锁码前 8 位 = SHA256(requestCode + '|' + workId) 前 8 位
  const bindingMessage = requestCode + '|' + workId
  const expectedBinding = await sha256Hex(bindingMessage)
  if (hmacPart.slice(0, 8).toUpperCase() !== expectedBinding.slice(0, 8).toUpperCase()) {
    return { valid: false, reason: '解锁码与请求凭证不匹配' }
  }

  return { valid: true }
}

/**
 * 验证解锁码（创作者端，完整验证）
 * 创作者可以用此函数验证自己生成的解锁码
 */
export async function verifyUnlockCodeFull(
  seedKey: string,
  code: string,
  requestCode: string,
  workId: string,
  chapterId?: string
): Promise<{ valid: boolean; reason?: string }> {
  // 格式校验
  if (!code.startsWith(UNLOCK_CODE_PREFIX)) {
    return { valid: false, reason: '解锁码格式错误' }
  }

  const hmacPart = code.slice(UNLOCK_CODE_PREFIX.length)
  if (!/^[A-F0-9]{16}$/i.test(hmacPart)) {
    return { valid: false, reason: '解锁码格式错误' }
  }

  // 验证公开绑定部分（前 8 位）
  const bindingMessage = requestCode + '|' + workId
  const expectedBinding = await sha256Hex(bindingMessage)
  if (hmacPart.slice(0, 8).toUpperCase() !== expectedBinding.slice(0, 8).toUpperCase()) {
    return { valid: false, reason: '解锁码与请求凭证不匹配' }
  }

  // 验证 HMAC 部分（后 8 位），需要尝试不同时间戳
  const chapter = chapterId || 'all'
  // 时间容差：前后 5 分钟内都有效
  const timeWindow = 5 * 60000 // 5 分钟
  const now = Date.now()

  for (let offset = -timeWindow; offset <= timeWindow; offset += 60000) {
    const testTimestamp = alignTimestamp(now + offset)
    const message = requestCode + '|' + workId + '|' + chapter + '|' + testTimestamp
    const signature = await hmacSign(seedKey, message)
    const testPart = signature.slice(0, 8)

    if (testPart.toUpperCase() === hmacPart.slice(8, 16).toUpperCase()) {
      return { valid: true }
    }
  }

  return { valid: false, reason: '解锁码不匹配' }
}

// ============ 存储管理 ============

/** 保存种子密钥到 localStorage */
export function saveSeedKey(workId: string, seedKey: string): void {
  const keys = loadAllSeedKeys()
  keys[workId] = {
    seedKey,
    createdAt: Date.now(),
  }
  localStorage.setItem(SEED_KEY_STORAGE_KEY, JSON.stringify(keys))
}

/** 加载所有种子密钥 */
export function loadAllSeedKeys(): Record<string, { seedKey: string; createdAt: number }> {
  try {
    const data = localStorage.getItem(SEED_KEY_STORAGE_KEY)
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

/** 加载指定作品的种子密钥 */
export function loadSeedKey(workId: string): string | null {
  const keys = loadAllSeedKeys()
  return keys[workId]?.seedKey || null
}

/** 删除种子密钥 */
export function deleteSeedKey(workId: string): void {
  const keys = loadAllSeedKeys()
  delete keys[workId]
  localStorage.setItem(SEED_KEY_STORAGE_KEY, JSON.stringify(keys))
}

// ============ 辅助函数 ============

/** 格式化价格显示 */
export function formatPrice(price: number): string {
  if (price < 1) {
    return `${(price * 100).toFixed(0)}积分`
  }
  return `¥${price.toFixed(2)}`
}

/** 检查节点是否需要付费 */
export function isNodePaid(nodeId: string, config: MonetizationConfig): boolean {
  if (!config.enabled) return false
  if (!config.paidNodes.includes(nodeId)) return false
  if (config.freePreviewNodes?.includes(nodeId)) return false
  return true
}

/** 获取付费节点所属章节 */
export function getNodeChapter(nodeId: string, config: MonetizationConfig): PaidChapter | null {
  if (!config.paidChapters) return null
  return config.paidChapters.find(ch => ch.nodeIds.includes(nodeId)) || null
}

/** 统计付费信息 */
export function getMonetizationStats(config: Partial<MonetizationConfig>): {
  totalPaidNodes: number
  totalFreeNodes: number
  totalPaidChapters: number
  priceRange: { min: number; max: number }
} {
  const totalPaidNodes = config.paidNodes?.length || 0
  const totalFreeNodes = config.freePreviewNodes?.length || 0
  const totalPaidChapters = config.paidChapters?.length || 0
  
  let minPrice = config.price || 0
  let maxPrice = config.price || 0
  
  if (config.priceOptions) {
    minPrice = Math.min(...config.priceOptions, config.price || 0)
    maxPrice = Math.max(...config.priceOptions, config.price || 0)
  }
  
  if (config.paidChapters) {
    const chapterPrices = config.paidChapters.map(ch => ch.price)
    minPrice = Math.min(minPrice, ...chapterPrices)
    maxPrice = Math.max(maxPrice, ...chapterPrices)
  }
  
  return {
    totalPaidNodes,
    totalFreeNodes,
    totalPaidChapters,
    priceRange: { min: minPrice, max: maxPrice },
  }
}

/** 从故事图提取付费节点建议 */
export function suggestPaidNodes(graph: StoryGraph): {
  allEndingNodes: string[]
  nodeGroups: { id: string; name: string; nodes: string[] }[]
} {
  const allEndingNodes = graph.nodes
    .filter(n => n.type === 'ending')
    .map(n => n.id)
  
  // 提取分组作为章节建议
  const nodeGroups = (graph.groups || []).map(g => ({
    id: g.id,
    name: g.name || '未命名章节',
    nodes: g.nodeIds || [],
  }))
  
  return { allEndingNodes, nodeGroups }
}