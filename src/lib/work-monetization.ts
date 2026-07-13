import type { StoryGraph } from '@editor/types/editor'

export type PaymentMethod = 'wechat_manual' | 'third_party' | 'both' | 'multi'

export type ThirdPartyPlatform = 'afdian' | 'mianbaoduo' | 'patreon' | 'ko-fi' | 'custom'

export type ManualChannelType = 'wechat' | 'alipay' | 'stripe' | 'paypal'

export interface ThirdPartyChannel {
  platform: 'afdian' | 'mianbaoduo' | 'patreon' | 'ko-fi' | 'custom'
  link: string
  creatorName?: string
  planType?: 'subscription' | 'onetime'
  label?: string
}

export interface ManualPaymentChannel {
  type: 'wechat' | 'alipay' | 'stripe' | 'paypal'
  qrCode: string
  contact?: string
  label?: string
}

export interface MultiChannelConfig {
  manualChannels: ManualPaymentChannel[]
  thirdPartyChannels: ThirdPartyChannel[]
  primaryChannel: 'manual' | 'afdian' | 'mianbaoduo' | 'patreon' | 'ko-fi'
}

export type PaymentGranularity = 'whole' | 'chapter' | 'node'

export interface PaidChapter {
  id: string
  name: string
  nodeIds: string[]
  price: number
}

export interface MonetizationConfig {
  enabled: boolean
  granularity: PaymentGranularity
  paymentMethod: PaymentMethod
  wechatQRCode?: string
  wechatContact?: string
  alipayQRCode?: string
  alipayContact?: string
  thirdParty?: {
    platform: ThirdPartyPlatform
    link: string
    creatorName?: string
  }
  multiChannel?: MultiChannelConfig
  paidNodes: string[]
  paidChapters?: PaidChapter[]
  price: number
  priceOptions?: number[]
  freePreviewNodes?: string[]
  freePreviewText?: string
  workId: string
  seedKey?: string
  seedKeyHash?: string
}

export interface PaidChapter {
  id: string
  name: string
  nodeIds: string[]
  price: number
}

export interface UnlockRequest {
  type: 'request'
  workId: string
  paymentProof: string
  deviceFingerprint: string
  timestamp: number
  chapterId?: string
  code: string
}

export interface UnlockCode {
  type: 'unlock'
  workId: string
  requestCode: string
  chapterId?: string
  timestamp: number
  validUntil?: number
  code: string
}

export interface UnlockState {
  workId: string
  unlockedNodes: string[]
  unlockedChapters: string[]
  unlockTime: number
  unlockCode: string
}

export interface IncomeRecord {
  id: string
  workId: string
  workTitle: string
  amount: number
  channel: 'wechat' | 'alipay' | 'stripe' | 'paypal' | 'afdian' | 'mianbaoduo' | 'patreon' | 'ko-fi' | 'other'
  date: number
  note?: string
}

export interface IncomeTracking {
  records: IncomeRecord[]
  lastUpdated: number
}

export interface ComplianceStatus {
  currentYearIncome: number
  monthlyAverage: number
  warningLevel: 'safe' | 'notice' | 'warning' | 'critical'
  warnings: ComplianceWarning[]
}

export interface ComplianceWarning {
  level: 'notice' | 'warning' | 'critical'
  title: string
  message: string
  action: string
  threshold: number
  current: number
}

export interface HTMLMonetizationConfig {
  workId: string
  seedKeyHash: string
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

export const SEED_KEY_PREFIX = 'SUBSL-SEED-'

export const UNLOCK_REQUEST_PREFIX = 'SUBSL-REQ-'

export const UNLOCK_CODE_PREFIX = 'SUBSL-UNLOCK-'

export const UNLOCK_STATE_KEY_PREFIX = 'subsilicon_unlocked_'

export const SEED_KEY_STORAGE_KEY = 'subsilicon_seed_keys'

export const THIRD_PARTY_PLATFORMS: Record<ThirdPartyPlatform, { name: string; url: string; fee: string }> = {
  afdian: { name: '爱发电', url: 'https://afdian.net', fee: '6%' },
  mianbaoduo: { name: '面包多', url: 'https://mianbaoduo.com', fee: '5%' },
  patreon: { name: 'Patreon', url: 'https://patreon.com', fee: '8%' },
  'ko-fi': { name: 'Ko-fi', url: 'https://ko-fi.com', fee: '0%' },
  custom: { name: '其他平台', url: '', fee: '自定义' },
}

export const DEFAULT_PRICE_OPTIONS = [6.6, 9.9, 18.8, 29.9, 49.9]

// 基于2026年最新政策
export const COMPLIANCE_THRESHOLDS = {
  YEAR_INCOME_TAX_NOTICE: 60000,
  YEAR_INCOME_INDIVIDUAL_WARNING: 100000,
  YEAR_INCOME_INDIVIDUAL_CRITICAL: 120000,
  MONTHLY_AVERAGE_NOTICE: 8000,
  MONTHLY_AVERAGE_WARNING: 100000,
  SINGLE_PAYMENT_NOTICE: 5000,
  EARLY_WARNING_RATIO: 0.8,
} as const

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

export async function generateSeedKey(): Promise<string> {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
  return SEED_KEY_PREFIX + hex
}

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

export function generateWorkId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 8)
  return `work_${timestamp}_${random}`
}

export async function generateDeviceFingerprint(): Promise<string> {
  const parts = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth.toString(),
    new Date().getTimezoneOffset().toString(),
    navigator.hardwareConcurrency?.toString() || 'unknown',
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

export function alignTimestamp(timestamp: number): number {
  return Math.floor(timestamp / 60000) * 60000
}

async function hmacSign(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder()

  const keyBuffer = encoder.encode(key)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const messageBuffer = encoder.encode(message)
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageBuffer)

  const signatureArray = Array.from(new Uint8Array(signature))
  return signatureArray
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

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

export async function generateUnlockRequest(
  workId: string,
  paymentProof: string,
  chapterId?: string
): Promise<UnlockRequest> {
  const fingerprint = await generateDeviceFingerprint()
  const timestamp = alignTimestamp(Date.now())

  const message = JSON.stringify({
    workId,
    paymentProof: paymentProof.slice(0, 6),
    fingerprint,
    chapterId: chapterId || 'all',
    timestamp,
  })

  // 读者端不需要种子密钥，使用固定盐值
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

  // 公开绑定部分：任何人都可以验证解锁码与请求凭证的绑定关系，无需密钥
  const bindingMessage = requestCode + '|' + workId
  const bindingHash = await sha256Hex(bindingMessage)
  const publicBinding = bindingHash.slice(0, 8)

  // HMAC 签名部分：只有拥有种子密钥的创作者才能生成
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
  if (!code.startsWith(UNLOCK_CODE_PREFIX)) {
    return { valid: false, reason: '解锁码格式错误' }
  }

  const hmacPart = code.slice(UNLOCK_CODE_PREFIX.length)
  if (!/^[A-F0-9]{16}$/i.test(hmacPart)) {
    return { valid: false, reason: '解锁码格式错误' }
  }

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

export async function verifyUnlockCodeFull(
  seedKey: string,
  code: string,
  requestCode: string,
  workId: string,
  chapterId?: string
): Promise<{ valid: boolean; reason?: string }> {
  if (!code.startsWith(UNLOCK_CODE_PREFIX)) {
    return { valid: false, reason: '解锁码格式错误' }
  }

  const hmacPart = code.slice(UNLOCK_CODE_PREFIX.length)
  if (!/^[A-F0-9]{16}$/i.test(hmacPart)) {
    return { valid: false, reason: '解锁码格式错误' }
  }

  const bindingMessage = requestCode + '|' + workId
  const expectedBinding = await sha256Hex(bindingMessage)
  if (hmacPart.slice(0, 8).toUpperCase() !== expectedBinding.slice(0, 8).toUpperCase()) {
    return { valid: false, reason: '解锁码与请求凭证不匹配' }
  }

  // 验证 HMAC 部分（后 8 位），需要尝试不同时间戳
  const chapter = chapterId || 'all'
  // 时间容差：前后 5 分钟内都有效
  const timeWindow = 5 * 60000
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

export function saveSeedKey(workId: string, seedKey: string): void {
  const keys = loadAllSeedKeys()
  keys[workId] = {
    seedKey,
    createdAt: Date.now(),
  }
  localStorage.setItem(SEED_KEY_STORAGE_KEY, JSON.stringify(keys))
}

export function loadAllSeedKeys(): Record<string, { seedKey: string; createdAt: number }> {
  try {
    const data = localStorage.getItem(SEED_KEY_STORAGE_KEY)
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

export function loadSeedKey(workId: string): string | null {
  const keys = loadAllSeedKeys()
  return keys[workId]?.seedKey || null
}

export function deleteSeedKey(workId: string): void {
  const keys = loadAllSeedKeys()
  delete keys[workId]
  localStorage.setItem(SEED_KEY_STORAGE_KEY, JSON.stringify(keys))
}

export function formatPrice(price: number): string {
  if (price < 1) {
    return `${(price * 100).toFixed(0)}积分`
  }
  return `¥${price.toFixed(2)}`
}

export function isNodePaid(nodeId: string, config: MonetizationConfig): boolean {
  if (!config.enabled) return false
  if (!config.paidNodes.includes(nodeId)) return false
  if (config.freePreviewNodes?.includes(nodeId)) return false
  return true
}

export function getNodeChapter(nodeId: string, config: MonetizationConfig): PaidChapter | null {
  if (!config.paidChapters) return null
  return config.paidChapters.find(ch => ch.nodeIds.includes(nodeId)) || null
}

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

export function suggestPaidNodes(graph: StoryGraph): {
  allEndingNodes: string[]
  nodeGroups: { id: string; name: string; nodes: string[] }[]
} {
  const allEndingNodes = graph.nodes
    .filter(n => n.type === 'ending')
    .map(n => n.id)

  const nodeGroups = (graph.groups || []).map(g => ({
    id: g.id,
    name: g.name || '未命名章节',
    nodes: g.nodeIds || [],
  }))

  return { allEndingNodes, nodeGroups }
}
