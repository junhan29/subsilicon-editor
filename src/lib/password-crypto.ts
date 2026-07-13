/**
 * 密码加密模块
 *
 * 用于加密存储在 IndexedDB 中的平台密码
 * 使用 AES-256-GCM 加密，密钥从设备指纹派生
 */

const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256
const SALT_LENGTH = 16
const IV_LENGTH = 12
const ENCRYPTION_PREFIX = '__ENC__:'

// 固定盐值，用于密钥派生（每个设备不同）
const APP_SALT = new TextEncoder().encode('SubSilicon-Platform-Password-Encryption-2024')

/**
 * 从设备指纹派生加密密钥
 * 密钥不存储，每次从相同输入重新生成
 */
async function deriveKeyFromDevice(): Promise<CryptoKey> {
  // 获取设备指纹因子
  const deviceFactors = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    String(new Date().getTimezoneOffset()),
    navigator.hardwareConcurrency?.toString() || '8',
  ].join('|')

  // 组合应用盐值和设备因子
  const combinedInput = new TextEncoder().encode(deviceFactors + Array.from(APP_SALT).join(','))

  // 使用 SHA-256 派生密钥材料
  const keyMaterial = await crypto.subtle.digest('SHA-256', combinedInput)

  // 导入为 CryptoKey
  return crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: ALGORITHM },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * 生成随机盐值
 */
function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
}

/**
 * 生成随机 IV
 */
function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH))
}

/**
 * Base64 编码
 */
function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

/**
 * Base64 解码
 */
function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * 加密密码
 *
 * @param plaintext 明文密码
 * @returns 加密后的字符串，格式: __ENC__:base64(salt):base64(iv):base64(ciphertext)
 */
export async function encryptPassword(plaintext: string): Promise<string> {
  if (!plaintext) return ''

  const key = await deriveKeyFromDevice()
  const salt = generateSalt()
  const iv = generateIV()

  // 将盐值混入明文，增加唯一性
  const dataToEncrypt = new TextEncoder().encode(plaintext)

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    dataToEncrypt
  )

  // 格式: __ENC__:salt:iv:ciphertext
  const saltB64 = toBase64(salt)
  const ivB64 = toBase64(iv)
  const cipherB64 = toBase64(new Uint8Array(ciphertext))

  return `${ENCRYPTION_PREFIX}${saltB64}:${ivB64}:${cipherB64}`
}

/**
 * 解密密码
 *
 * @param encrypted 加密的密码字符串
 * @returns 解密后的明文密码
 */
export async function decryptPassword(encrypted: string): Promise<string> {
  if (!encrypted) return ''

  // 如果不是加密格式，直接返回（兼容旧数据）
  if (!encrypted.startsWith(ENCRYPTION_PREFIX)) {
    return encrypted
  }

  try {
    const key = await deriveKeyFromDevice()

    // 解析格式: __ENC__:salt:iv:ciphertext
    const parts = encrypted.slice(ENCRYPTION_PREFIX.length).split(':')
    if (parts.length !== 3) {
      console.warn('Invalid encrypted password format')
      return encrypted
    }

    const [_saltB64, ivB64, cipherB64] = parts
    const iv = fromBase64(ivB64)
    const ciphertext = fromBase64(cipherB64)

    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      ciphertext
    )

    return new TextDecoder().decode(decrypted)
  } catch (error) {
    console.error('Failed to decrypt password:', error)
    return ''
  }
}

/**
 * 检查字符串是否已加密
 */
export function isEncrypted(value: string): boolean {
  return value?.startsWith(ENCRYPTION_PREFIX) ?? false
}

/**
 * 批量加密密码字段
 */
export async function encryptPasswordFields(
  data: Record<string, string>,
  fields: string[]
): Promise<Record<string, string>> {
  const result = { ...data }
  for (const field of fields) {
    if (result[field] && !isEncrypted(result[field])) {
      result[field] = await encryptPassword(result[field])
    }
  }
  return result
}

/**
 * 批量解密密码字段
 */
export async function decryptPasswordFields(
  data: Record<string, string>,
  fields: string[]
): Promise<Record<string, string>> {
  const result = { ...data }
  for (const field of fields) {
    if (result[field] && isEncrypted(result[field])) {
      result[field] = await decryptPassword(result[field])
    }
  }
  return result
}