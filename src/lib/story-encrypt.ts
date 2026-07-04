/**
 * 故事作品 AES-256-GCM 加密工具
 *
 * 设计原则：
 * - 内容密钥在导出时随机生成，不在 HTML 中存储
 * - 密钥上传到平台服务器（仅用于订单号验证后发放）
 * - HTML 中只包含加密后的故事数据和付款方式信息
 * - 服务器不碰钱，仅做 DRM 授权（订单号去重 + 密钥发放）
 */

// ============ 常量 ============

/** 加密密钥长度 (bytes) */
const KEY_LENGTH = 32 // 256 bits

/** GCM IV 长度 (bytes) */
const IV_LENGTH = 12 // 96 bits (recommended for GCM)

/** 加密前缀，用于标识加密内容 */
export const AES_ENC_PREFIX = '__AES256__:'

// ============ 生成密钥 ============

/**
 * 生成随机 AES-256 密钥和 IV
 */
export function generateEncryptionKey(): { key: Uint8Array; iv: Uint8Array } {
  const key = crypto.getRandomValues(new Uint8Array(KEY_LENGTH))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  return { key, iv }
}

// ============ ArrayBuffer / Base64 转换工具 ============

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer as ArrayBuffer
}

function textEncode(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

function textDecode(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(buffer)
}

function toBufferSource(data: Uint8Array): BufferSource {
  return data.buffer as ArrayBuffer
}

// ============ AES-256-GCM 加密/解密 ============

/**
 * 加密字符串数据
 * 返回 Base64 编码的密文（含 GCM 认证标签）
 */
export async function encryptWithAES(
  plaintext: string,
  key: Uint8Array,
  iv: Uint8Array
): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key.buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )

  const data = textEncode(plaintext)
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toBufferSource(iv) },
    cryptoKey,
    toBufferSource(data)
  )

  return arrayBufferToBase64(encrypted)
}

/**
 * 解密 AES-256-GCM 密文
 */
export async function decryptWithAES(
  cipherBase64: string,
  keyBase64: string,
  ivBase64: string
): Promise<string> {
  const keyBytes = new Uint8Array(base64ToArrayBuffer(keyBase64))
  const ivBytes = new Uint8Array(base64ToArrayBuffer(ivBase64))
  const cipherBytes = base64ToArrayBuffer(cipherBase64)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toBufferSource(ivBytes) },
    cryptoKey,
    toBufferSource(new Uint8Array(cipherBytes))
  )

  return textDecode(decrypted)
}

/**
 * 加密整个故事图数据
 * 返回加密后的 JSON（前缀标记），以及需要上传到服务器的密钥信息
 */
export async function encryptStoryData(
  graphJSON: string
): Promise<{
  encryptedData: string
  keyBase64: string
  ivBase64: string
}> {
  const { key, iv } = generateEncryptionKey()
  const encrypted = await encryptWithAES(graphJSON, key, iv)

  return {
    encryptedData: AES_ENC_PREFIX + encrypted,
    keyBase64: arrayBufferToBase64(key.buffer as ArrayBuffer),
    ivBase64: arrayBufferToBase64(iv.buffer as ArrayBuffer),
  }
}

/**
 * 在浏览器环境中解密故事数据
 * 用于 .story.html 运行时解密（需要从服务器获取密钥）
 */
export async function decryptStoryData(
  encryptedData: string,
  keyBase64: string,
  ivBase64: string
): Promise<string> {
  if (!encryptedData.startsWith(AES_ENC_PREFIX)) {
    throw new Error('数据未加密或加密格式不正确')
  }

  const cipherBase64 = encryptedData.slice(AES_ENC_PREFIX.length)
  return decryptWithAES(cipherBase64, keyBase64, ivBase64)
}

// ============ 辅助函数 ============

/**
 * 将密钥信息编码为可传输的 JSON
 */
export function encodeKeyInfo(keyBase64: string, ivBase64: string): string {
  return JSON.stringify({ key: keyBase64, iv: ivBase64 })
}

/**
 * 从 JSON 解码密钥信息
 */
export function decodeKeyInfo(json: string): { key: string; iv: string } {
  return JSON.parse(json)
}
