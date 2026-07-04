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
