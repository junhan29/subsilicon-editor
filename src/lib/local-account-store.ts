export interface LocalAccount {
  id: string
  email: string
  displayName: string
  passwordHash: string
  bio: string
  createdAt: number
  nameChangeCount: number
  nameLastChangedAt: number
}

export interface CreatorIdentity {
  id: string
  displayName: string
  publicKey: string
  privateKey: string
  registeredAt: number
  syncedToServer: boolean
}

let currentAccount: Omit<LocalAccount, 'passwordHash'> | null = null

const DB_NAME = 'subsilicon-editor'
const STORE_NAME = 'accounts'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'email' })
        store.createIndex('email', 'email', { unique: true })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function generateId(): string {
  return 'acc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function register(
  email: string,
  password: string,
  displayName: string,
  bio?: string
): Promise<{ success: boolean; error?: string }> {
  const trimmedEmail = email.trim().toLowerCase()
  const trimmedDisplayName = displayName.trim()

  if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return { success: false, error: '请输入正确的邮箱地址' }
  }
  if (password.length < 8) {
    return { success: false, error: '密码至少 8 位' }
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { success: false, error: '密码必须包含字母和数字' }
  }
  if (!trimmedDisplayName) {
    return { success: false, error: '请输入显示名称' }
  }

  try {
    const db = await openDB()

    const existing = await new Promise<LocalAccount | undefined>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(trimmedEmail)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(undefined)
    })

    if (existing) {
      db.close()
      return { success: false, error: '该邮箱已注册，请直接登录' }
    }

    const passwordHash = await sha256(password)
    const now = Date.now()
    const account: LocalAccount = {
      id: generateId(),
      email: trimmedEmail,
      displayName: trimmedDisplayName,
      passwordHash,
      bio: bio?.trim() || '',
      createdAt: now,
      nameChangeCount: 0,
      nameLastChangedAt: now,
    }

    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    await new Promise<void>((resolve, reject) => {
      const req = store.put(account)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
    db.close()

    currentAccount = {
      id: account.id,
      email: account.email,
      displayName: account.displayName,
      bio: account.bio,
      createdAt: account.createdAt,
      nameChangeCount: account.nameChangeCount,
      nameLastChangedAt: account.nameLastChangedAt,
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: '注册失败：数据库异常' }
  }
}

export async function login(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; account?: Omit<LocalAccount, 'passwordHash'> }> {
  const trimmedEmail = email.trim().toLowerCase()

  if (!trimmedEmail || !password) {
    return { success: false, error: '请填写邮箱和密码' }
  }

  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const account = await new Promise<LocalAccount | undefined>((resolve) => {
      const req = store.get(trimmedEmail)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(undefined)
    })
    db.close()

    if (!account) {
      return { success: false, error: '该邮箱未注册' }
    }

    const passwordHash = await sha256(password)
    if (account.passwordHash !== passwordHash) {
      return { success: false, error: '密码错误' }
    }

    const accountInfo: Omit<LocalAccount, 'passwordHash'> = {
      id: account.id,
      email: account.email,
      displayName: account.displayName,
      bio: account.bio,
      createdAt: account.createdAt,
      nameChangeCount: account.nameChangeCount || 0,
      nameLastChangedAt: account.nameLastChangedAt || account.createdAt,
    }
    currentAccount = accountInfo

    return { success: true, account: accountInfo }
  } catch (err) {
    return { success: false, error: '登录失败：数据库异常' }
  }
}

export function getAccount(): Omit<LocalAccount, 'passwordHash'> | null {
  return currentAccount
}

export function logout(): void {
  currentAccount = null
}

export function isLoggedIn(): boolean {
  return currentAccount !== null
}

export async function updateDisplayName(
  email: string,
  newDisplayName: string
): Promise<{ success: boolean; error?: string }> {
  const trimmedEmail = email.trim().toLowerCase()
  const trimmedDisplayName = newDisplayName.trim()

  if (!trimmedDisplayName) {
    return { success: false, error: '请输入新的显示名称' }
  }

  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const account = await new Promise<LocalAccount | undefined>((resolve) => {
      const req = store.get(trimmedEmail)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(undefined)
    })
    db.close()

    if (!account) {
      return { success: false, error: '账号不存在' }
    }

    if (account.displayName === trimmedDisplayName) {
      return { success: false, error: '新昵称与原昵称相同' }
    }

    const MAX_CHANGES_PER_YEAR = 1
    const now = new Date()
    const currentYear = now.getFullYear()
    const lastChangeYear = account.nameLastChangedAt
      ? new Date(account.nameLastChangedAt).getFullYear()
      : null

    if (lastChangeYear === currentYear && account.nameChangeCount >= MAX_CHANGES_PER_YEAR) {
      const nextYear = currentYear + 1
      return { success: false, error: `每年仅可修改${MAX_CHANGES_PER_YEAR}次昵称，今年已用完，请${nextYear}年再试` }
    }

    const nameChangeCount = lastChangeYear === currentYear
      ? (account.nameChangeCount || 0) + 1
      : 1

    const tx2 = db.transaction(STORE_NAME, 'readwrite')
    const store2 = tx2.objectStore(STORE_NAME)
    const updatedAccount: LocalAccount = {
      ...account,
      displayName: trimmedDisplayName,
      nameChangeCount,
      nameLastChangedAt: Date.now(),
    }
    await new Promise<void>((resolve, reject) => {
      const req = store2.put(updatedAccount)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
    db.close()

    currentAccount = {
      id: updatedAccount.id,
      email: updatedAccount.email,
      displayName: updatedAccount.displayName,
      bio: updatedAccount.bio,
      createdAt: updatedAccount.createdAt,
      nameChangeCount: updatedAccount.nameChangeCount,
      nameLastChangedAt: updatedAccount.nameLastChangedAt,
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: '更新昵称失败：数据库异常' }
  }
}

// ============================================
// 创作者身份系统（RSA 密钥对）
// ============================================

const IDENTITY_STORE = 'creator-identities'

function openIdentityDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(IDENTITY_STORE)) {
        const store = db.createObjectStore(IDENTITY_STORE, { keyPath: 'id' })
        store.createIndex('displayName', 'displayName', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function saveIdentity(identity: CreatorIdentity): Promise<void> {
  const db = await openIdentityDB()
  const tx = db.transaction(IDENTITY_STORE, 'readwrite')
  const store = tx.objectStore(IDENTITY_STORE)
  await new Promise<void>((resolve, reject) => {
    const req = store.put(identity)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
  db.close()
}

async function loadIdentities(): Promise<CreatorIdentity[]> {
  const db = await openIdentityDB()
  const tx = db.transaction(IDENTITY_STORE, 'readonly')
  const store = tx.objectStore(IDENTITY_STORE)
  const identities = await new Promise<CreatorIdentity[]>((resolve, reject) => {
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
  db.close()
  return identities
}

async function exportPublicKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('spki', key)
  const binary = String.fromCharCode(...new Uint8Array(exported))
  return `-----BEGIN PUBLIC KEY-----\n${btoa(binary).match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`
}

async function exportPrivateKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('pkcs8', key)
  const binary = String.fromCharCode(...new Uint8Array(exported))
  return `-----BEGIN PRIVATE KEY-----\n${btoa(binary).match(/.{1,64}/g)?.join('\n')}\n-----END PRIVATE KEY-----`
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemHeader = '-----BEGIN PRIVATE KEY-----'
  const pemFooter = '-----END PRIVATE KEY-----'
  const pemContents = pem.substring(pemHeader.length, pem.indexOf(pemFooter))
  const binaryDer = Uint8Array.from(atob(pemContents.replace(/\n/g, '')), c => c.charCodeAt(0))
  return crypto.subtle.importKey('pkcs8', binaryDer, { name: 'RSA-PSS', hash: 'SHA-256' }, false, ['sign'])
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

let currentIdentity: CreatorIdentity | null = null

export async function registerCreatorIdentity(name: string): Promise<CreatorIdentity> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'RSA-PSS', modulusLength: 2048, hash: 'SHA-256' } as any,
    true,
    ['sign', 'verify']
  )

  const publicKey = await exportPublicKey(keyPair.publicKey)
  const privateKey = await exportPrivateKey(keyPair.privateKey)

  const identity: CreatorIdentity = {
    id: 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
    displayName: name,
    publicKey,
    privateKey,
    registeredAt: Date.now(),
    syncedToServer: false,
  }

  await saveIdentity(identity)
  currentIdentity = identity
  return identity
}

export async function signContent(content: string, privateKeyPem: string): Promise<string> {
  const privateKey = await importPrivateKey(privateKeyPem)
  const encoder = new TextEncoder()
  const signature = await crypto.subtle.sign(
    { name: 'RSA-PSS', saltLength: 32 },
    privateKey,
    encoder.encode(content)
  )
  return arrayBufferToBase64(signature)
}

export function getCurrentIdentity(): CreatorIdentity | null {
  return currentIdentity
}

export async function switchIdentity(identityId: string): Promise<CreatorIdentity | null> {
  const identities = await loadIdentities()
  const identity = identities.find(i => i.id === identityId) || null
  currentIdentity = identity
  return identity
}

export function logoutIdentity(): void {
  currentIdentity = null
}

export async function getAllIdentities(): Promise<CreatorIdentity[]> {
  return loadIdentities()
}

export async function exportIdentityToFile(identity: CreatorIdentity): Promise<void> {
  const blob = new Blob([JSON.stringify({ id: identity.id, displayName: identity.displayName, publicKey: identity.publicKey, privateKey: identity.privateKey }, null, 2)], {
    type: 'application/vnd.subsilicon.identity+json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${identity.displayName}.subsilicon-key`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importIdentityFromFile(): Promise<CreatorIdentity | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.subsilicon-key'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) { resolve(null); return }
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        if (!data.id || !data.publicKey || !data.privateKey) {
          resolve(null)
          return
        }
        const identity: CreatorIdentity = {
          id: data.id,
          displayName: data.displayName || '已导入身份',
          publicKey: data.publicKey,
          privateKey: data.privateKey,
          registeredAt: data.registeredAt || Date.now(),
          syncedToServer: true,
        }
        await saveIdentity(identity)
        currentIdentity = identity
        resolve(identity)
      } catch {
        resolve(null)
      }
    }
    input.click()
  })
}
