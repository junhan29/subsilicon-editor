export type Theme = 'dark' | 'light' | 'sepia'

export const THEME_LABELS: Record<Theme, string> = {
  dark: '预告函 · 红黑',
  light: '纸面 · 白',
  sepia: '古纸 · 棕',
}

const STORAGE_KEY = 'subsilicon-editor-theme'

const THEME_ORDER: Theme[] = ['dark', 'light', 'sepia']

/** 获取当前生效的主题（默认深色 P5 预告函） */
export function getCurrentTheme(): Theme {
  if (typeof document === 'undefined') return 'dark'
  const root = document.documentElement
  if (root.classList.contains('dark')) return 'dark'
  if (root.classList.contains('sepia')) return 'sepia'
  return 'light'
}

/** 设置主题：清理全部主题 class 后应用目标 class，并持久化 */
export function setTheme(theme: Theme): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.remove('dark', 'light', 'sepia')
  if (theme === 'dark') root.classList.add('dark')
  else if (theme === 'sepia') root.classList.add('sepia')
  try {
    window.localStorage.setItem(STORAGE_KEY, theme)
  } catch {
  }
  // 通知监听者
  window.dispatchEvent(new CustomEvent('subsilicon-theme-change', { detail: theme }))
}

export function toggleTheme(): Theme {
  const next = THEME_ORDER[(THEME_ORDER.indexOf(getCurrentTheme()) + 1) % THEME_ORDER.length]
  setTheme(next)
  return next
}

/** 从 localStorage 读取已保存的主题偏好（不修改 DOM） */
export function getStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v === 'dark' || v === 'light' || v === 'sepia') return v
  } catch {
  }
  return null
}

/**
 * 初始化主题：在编辑器挂载时调用，根据 localStorage 偏好应用主题。
 * 若无偏好，默认应用深色（P5 预告函红黑）主题。
 */
export function initTheme(): Theme {
  const stored = getStoredTheme()
  if (stored) {
    setTheme(stored)
    return stored
  }
  setTheme('dark')
  return 'dark'
}

/** 订阅主题变化，返回取消订阅函数 */
export function subscribeTheme(callback: (theme: Theme) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (e: Event) => {
    callback((e as CustomEvent<Theme>).detail)
  }
  window.addEventListener('subsilicon-theme-change', handler)
  return () => window.removeEventListener('subsilicon-theme-change', handler)
}
