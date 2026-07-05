const KEY_LENGTH = 32

const IV_LENGTH = 12

export const AES_ENC_PREFIX = '__AES256__:'

export function generateEncryptionKey(): { key: Uint8Array; iv: Uint8Array } {
  const key = crypto.getRandomValues(new Uint8Array(KEY_LENGTH))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  return { key, iv }
}

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

export function encodeKeyInfo(keyBase64: string, ivBase64: string): string {
  return JSON.stringify({ key: keyBase64, iv: ivBase64 })
}

export function decodeKeyInfo(json: string): { key: string; iv: string } {
  return JSON.parse(json)
}
