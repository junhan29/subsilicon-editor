const ENCRYPTION_KEY_BITS = 256
const SALT_SIZE = 16
const IV_SIZE = 12
const KEY_DERIVATION_ITERATIONS = 100000

const DEFAULT_PASSPHRASE = 'subsilicon-editor-local-encryption-key'

function getPassphrase(): string {
  return DEFAULT_PASSPHRASE
}

function stringToArrayBuffer(str: string): ArrayBuffer {
  return new TextEncoder().encode(str).buffer
}

function arrayBufferToString(buf: ArrayBuffer): string {
  return new TextDecoder().decode(buf)
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

async function deriveKey(passphrase: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    stringToArrayBuffer(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: KEY_DERIVATION_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: ENCRYPTION_KEY_BITS },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptString(plaintext: string): Promise<string> {
  if (!plaintext) return plaintext

  const salt = crypto.getRandomValues(new Uint8Array(SALT_SIZE))
  const iv = crypto.getRandomValues(new Uint8Array(IV_SIZE))
  const key = await deriveKey(getPassphrase(), salt.buffer)

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    stringToArrayBuffer(plaintext)
  )

  const result = new Uint8Array(SALT_SIZE + IV_SIZE + encrypted.byteLength)
  result.set(salt, 0)
  result.set(iv, SALT_SIZE)
  result.set(new Uint8Array(encrypted), SALT_SIZE + IV_SIZE)

  return `enc:${arrayBufferToBase64(result.buffer)}`
}

export async function decryptString(ciphertext: string): Promise<string> {
  if (!ciphertext || !ciphertext.startsWith('enc:')) {
    return ciphertext
  }

  try {
    const raw = base64ToArrayBuffer(ciphertext.slice(4))
    const salt = raw.slice(0, SALT_SIZE)
    const iv = raw.slice(SALT_SIZE, SALT_SIZE + IV_SIZE)
    const data = raw.slice(SALT_SIZE + IV_SIZE)

    const key = await deriveKey(getPassphrase(), salt)
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    )

    return arrayBufferToString(decrypted)
  } catch {
    return ciphertext
  }
}
