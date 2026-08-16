/**
 * AI API Key 本地加密（AES-256-GCM）
 *
 * 满足「AI API keys must be encrypted with AES-256」约束：所有落盘到
 * localStorage 的 AI Key 均为密文，明文只出现在使用点（请求构建 / UI 回显）。
 *
 * - 密钥从设备指纹派生（不落盘），每次加解密重新生成
 * - 存储格式：__AIENC__:base64(iv):base64(ciphertext)（GCM tag 并入密文尾部）
 * - 兼容旧明文数据：decryptAiKey 对无前缀值原样返回；保存时对未加密值自动加密迁移
 * - 解密失败返回 ''（避免坏数据被当成 Key 发请求），并告警
 */

const ALGORITHM = 'AES-GCM'
const IV_LENGTH = 12
export const ENCRYPTED_PREFIX = '__AIENC__:'

// 独立盐值（与平台密码加密区分），用于密钥派生
const APP_SALT = new TextEncoder().encode('SubSilicon-AI-Key-Vault-2026')

function deviceFactors(): string {
  if (typeof navigator === 'undefined') return 'no-navigator'
  const nav = navigator as Navigator & { hardwareConcurrency?: number }
  return [
    nav.userAgent ?? '',
    nav.language ?? '',
    typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : '',
    String(new Date().getTimezoneOffset()),
    String(nav.hardwareConcurrency ?? 8),
  ].join('|')
}

/** 从设备指纹派生 AES 密钥（SHA-256 → importKey） */
async function deriveKey(): Promise<CryptoKey> {
  const combined = new TextEncoder().encode(deviceFactors() + Array.from(APP_SALT).join(','))
  const keyMaterial = await crypto.subtle.digest('SHA-256', combined)
  return crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: ALGORITHM },
    false,
    ['encrypt', 'decrypt']
  )
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** 是否已是加密格式 */
export function isEncryptedAiKey(value: string | undefined | null): boolean {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX)
}

/** 加密明文 Key；空值返回空串 */
export async function encryptAiKey(plain: string): Promise<string> {
  if (!plain) return ''
  if (isEncryptedAiKey(plain)) return plain
  const key = await deriveKey()
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, new TextEncoder().encode(plain))
  return `${ENCRYPTED_PREFIX}${toBase64(iv)}:${toBase64(new Uint8Array(ciphertext))}`
}

/**
 * 解密存储值。
 * - 空值 → ''
 * - 无前缀（旧明文）→ 原样返回（兼容）
 * - 解密失败 → ''（并告警，避免把损坏数据当 Key）
 */
export async function decryptAiKey(stored: string): Promise<string> {
  if (!stored) return ''
  if (!isEncryptedAiKey(stored)) return stored
  try {
    const key = await deriveKey()
    const parts = stored.slice(ENCRYPTED_PREFIX.length).split(':')
    if (parts.length !== 2) {
      console.warn('AI Key 加密格式无效，已忽略该 Key')
      return ''
    }
    const [ivB64, cipherB64] = parts
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv: fromBase64(ivB64) },
      key,
      fromBase64(cipherB64)
    )
    return new TextDecoder().decode(decrypted)
  } catch (error) {
    console.warn('AI Key 解密失败（设备指纹可能变化），已忽略该 Key:', error)
    return ''
  }
}

/** 加密单字段配置对象中的 apiKey（已加密跳过） */
export async function encryptApiKeyField<T extends { apiKey?: string }>(cfg: T): Promise<T> {
  if (!cfg.apiKey || isEncryptedAiKey(cfg.apiKey)) return cfg
  return { ...cfg, apiKey: await encryptAiKey(cfg.apiKey) }
}

/** 解密单字段配置对象中的 apiKey（返回 apiKey 为明文的副本） */
export async function decryptApiKeyField<T extends { apiKey?: string }>(cfg: T): Promise<T> {
  if (!cfg.apiKey) return cfg
  return { ...cfg, apiKey: await decryptAiKey(cfg.apiKey) }
}

export type ConfigLike = { enabled?: boolean; apiKey?: unknown; providers?: unknown }

/** 加密 AiConfig 中所有 apiKey（兼容 flat 顶层格式与 providers 数组格式） */
export async function encryptAiConfig<T extends ConfigLike>(config: T): Promise<T> {
  if (Array.isArray(config.providers)) {
    const providers = await Promise.all(
      config.providers.map(async (p) => await encryptApiKeyField(p as { apiKey?: string }))
    )
    return { ...config, providers } as T
  }
  if (typeof config.apiKey === 'string') {
    return { ...config, apiKey: await encryptAiKey(config.apiKey) } as T
  }
  return config
}

/** 解密 AiConfig 中所有 apiKey（用于 UI 回显；解密失败字段置空） */
export async function decryptAiConfig<T extends ConfigLike>(config: T): Promise<T> {
  if (Array.isArray(config.providers)) {
    const providers = await Promise.all(
      config.providers.map(async (p) => await decryptApiKeyField(p as { apiKey?: string }))
    )
    return { ...config, providers } as T
  }
  if (typeof config.apiKey === 'string') {
    return { ...config, apiKey: await decryptAiKey(config.apiKey) } as T
  }
  return config
}
